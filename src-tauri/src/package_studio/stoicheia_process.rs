//! DataTeX-owned process runner for Stoicheia exact previews.
//!
//! This adapter deliberately reuses the application's `CompilationPermit` and
//! process-tree primitives. The copied engine only sees its narrow runner
//! contract and therefore does not own a second job registry.

use std::{
    io,
    process::{Output, Stdio},
    time::Duration,
};

use stoicheia_engine::process_runner::{ExternalProcessRunner, ProcessRunError, ProcessRunFuture};
use tokio::{
    io::AsyncReadExt,
    process::{Child, Command},
    task::JoinHandle,
    time::timeout,
};

use crate::compiler::{
    configure_process_group, signal_process_tree, CompilationPermit, FORCE_STOP_TIMEOUT,
    GRACEFUL_STOP_TIMEOUT,
};

pub(crate) struct TrackedStoicheiaProcessRunner {
    permit: CompilationPermit,
}

impl TrackedStoicheiaProcessRunner {
    pub(crate) fn new(permit: CompilationPermit) -> Self {
        Self { permit }
    }
}

impl ExternalProcessRunner for TrackedStoicheiaProcessRunner {
    fn ensure_active(&self) -> Result<(), String> {
        self.permit.ensure_not_cancelled()
    }

    fn run<'a>(&'a self, command: Command, timeout_duration: Duration) -> ProcessRunFuture<'a> {
        Box::pin(run_tracked_command(command, timeout_duration, &self.permit))
    }
}

async fn run_tracked_command(
    mut command: Command,
    timeout_duration: Duration,
    permit: &CompilationPermit,
) -> Result<Output, ProcessRunError> {
    permit
        .ensure_not_cancelled()
        .map_err(ProcessRunError::Interrupted)?;

    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    configure_process_group(command.as_std_mut());

    let mut child = command.spawn().map_err(ProcessRunError::Io)?;
    let pid = child.id().ok_or_else(|| {
        ProcessRunError::Io(io::Error::other(
            "External preview process did not expose a process id",
        ))
    })?;
    let (process_token, cancellation_raced_startup) = permit.attach_process(pid);

    let stdout_reader = spawn_output_reader(child.stdout.take());
    let stderr_reader = spawn_output_reader(child.stderr.take());

    let outcome = if cancellation_raced_startup {
        match terminate_and_reap(&mut child, pid).await {
            Ok(()) => Err(ProcessRunError::Interrupted(
                "Compilation stopped by user".to_string(),
            )),
            Err(error) => Err(error),
        }
    } else {
        match timeout(timeout_duration, child.wait()).await {
            Ok(Ok(status)) => Ok(status),
            Ok(Err(error)) => {
                let _ = force_kill_and_reap(&mut child, pid).await;
                Err(ProcessRunError::Io(error))
            }
            Err(_) => match terminate_and_reap(&mut child, pid).await {
                Ok(()) => Err(ProcessRunError::TimedOut),
                Err(error) => Err(error),
            },
        }
    };

    // Keep the stage registered until inherited pipes close. A compiler may
    // exit after spawning a descendant; in that case a reader timeout force-
    // terminates the still-live process group before the PID is cleared.
    let stdout = join_output_reader(stdout_reader, "stdout", pid).await;
    let stderr = join_output_reader(stderr_reader, "stderr", pid).await;
    permit.mark_process_exited(process_token);
    let stdout = stdout?;
    let stderr = stderr?;

    let status = outcome?;
    permit
        .ensure_not_cancelled()
        .map_err(ProcessRunError::Interrupted)?;
    Ok(Output {
        status,
        stdout,
        stderr,
    })
}

fn spawn_output_reader<R>(reader: Option<R>) -> Option<JoinHandle<io::Result<Vec<u8>>>>
where
    R: tokio::io::AsyncRead + Unpin + Send + 'static,
{
    reader.map(|mut reader| {
        tokio::spawn(async move {
            let mut output = Vec::new();
            reader.read_to_end(&mut output).await.map(|_| output)
        })
    })
}

async fn join_output_reader(
    reader: Option<JoinHandle<io::Result<Vec<u8>>>>,
    stream_name: &str,
    pid: u32,
) -> Result<Vec<u8>, ProcessRunError> {
    let Some(mut reader) = reader else {
        return Ok(Vec::new());
    };

    match timeout(FORCE_STOP_TIMEOUT, &mut reader).await {
        Ok(Ok(Ok(output))) => Ok(output),
        Ok(Ok(Err(error))) => Err(ProcessRunError::Io(error)),
        Ok(Err(error)) => Err(ProcessRunError::Interrupted(format!(
            "External preview {stream_name} reader failed: {error}",
        ))),
        Err(_) => {
            let _ = signal_process_tree(pid, true);
            match timeout(FORCE_STOP_TIMEOUT, &mut reader).await {
                Ok(Ok(Ok(output))) => Ok(output),
                Ok(Ok(Err(error))) => Err(ProcessRunError::Io(error)),
                Ok(Err(error)) => Err(ProcessRunError::Interrupted(format!(
                    "External preview {stream_name} reader failed after tree termination: {error}",
                ))),
                Err(_) => {
                    reader.abort();
                    Err(ProcessRunError::Interrupted(format!(
                        "External preview {stream_name} pipe stayed open after process-tree termination",
                    )))
                }
            }
        }
    }
}

async fn terminate_and_reap(child: &mut Child, pid: u32) -> Result<(), ProcessRunError> {
    let _ = signal_process_tree(pid, false);
    match timeout(GRACEFUL_STOP_TIMEOUT, child.wait()).await {
        Ok(Ok(_)) => return Ok(()),
        Ok(Err(error)) => return Err(ProcessRunError::Io(error)),
        Err(_) => {}
    }

    force_kill_and_reap(child, pid).await
}

async fn force_kill_and_reap(child: &mut Child, pid: u32) -> Result<(), ProcessRunError> {
    let tree_error = signal_process_tree(pid, true).err();
    match timeout(FORCE_STOP_TIMEOUT, child.wait()).await {
        Ok(Ok(_)) => Ok(()),
        Ok(Err(error)) => Err(ProcessRunError::Io(error)),
        Err(_) => {
            // Last-resort direct-child kill. The process-tree signal above is
            // still the primary path and is what closes inherited pipes.
            child.start_kill().map_err(ProcessRunError::Io)?;
            child.wait().await.map_err(|error| {
                ProcessRunError::Interrupted(match tree_error {
                    Some(tree_error) => format!(
                        "Failed to reap external preview process after tree termination failed: {tree_error}; {error}",
                    ),
                    None => format!("Failed to reap external preview process: {error}"),
                })
            })?;
            Ok(())
        }
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use crate::compiler::CompilationManager;
    use std::{
        fs,
        os::unix::fs::PermissionsExt,
        path::{Path, PathBuf},
        time::Instant,
    };
    use tokio::time::sleep;

    struct TestWorkspace {
        path: PathBuf,
    }

    impl TestWorkspace {
        fn create(name: &str) -> Self {
            let path = std::env::temp_dir().join(format!(
                "datatex-stoicheia-process-{name}-{}",
                uuid::Uuid::new_v4()
            ));
            fs::create_dir_all(&path).expect("create process-runner test workspace");
            Self { path }
        }

        fn script(&self, source: &str) -> PathBuf {
            let path = self.path.join("runner.sh");
            fs::write(&path, source).expect("write process-runner test script");
            let mut permissions = fs::metadata(&path)
                .expect("read test script metadata")
                .permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(&path, permissions).expect("make test script executable");
            path
        }

        fn join(&self, name: &str) -> PathBuf {
            self.path.join(name)
        }
    }

    impl Drop for TestWorkspace {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    async fn wait_for_file(path: &Path, wait: Duration) {
        let deadline = Instant::now() + wait;
        while !path.exists() && Instant::now() < deadline {
            sleep(Duration::from_millis(10)).await;
        }
        assert!(path.exists(), "timed out waiting for {}", path.display());
    }

    fn recorded_pid(path: &Path) -> i32 {
        fs::read_to_string(path)
            .expect("read recorded process id")
            .trim()
            .parse()
            .expect("recorded process id should be numeric")
    }

    fn process_exists(pid: i32) -> bool {
        unsafe extern "C" {
            fn kill(pid: i32, signal: i32) -> i32;
        }

        // Signal zero performs existence/permission checking without changing
        // the target. Test children have the same owner as this process.
        (unsafe { kill(pid, 0) }) == 0
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn timeout_kills_stubborn_process_group_before_descendant_marker() {
        let workspace = TestWorkspace::create("timeout-tree");
        let parent_pid_path = workspace.join("parent.pid");
        let descendant_pid_path = workspace.join("descendant.pid");
        let marker_path = workspace.join("orphan-marker");
        let script = workspace.script(
            "#!/bin/sh\n\
             trap '' TERM\n\
             printf '%s\\n' \"$$\" > \"$1\"\n\
             (\n\
               trap '' TERM\n\
               sleep 2\n\
               printf 'orphan survived' > \"$3\"\n\
             ) &\n\
             printf '%s\\n' \"$!\" > \"$2\"\n\
             while :; do sleep 1; done\n",
        );

        let manager = CompilationManager::default();
        let runner = TrackedStoicheiaProcessRunner::new(
            manager
                .begin("exact-preview-timeout-tree".to_string())
                .expect("register exact-preview timeout test"),
        );
        let mut command = Command::new(script);
        command
            .arg(&parent_pid_path)
            .arg(&descendant_pid_path)
            .arg(&marker_path);

        let result = runner.run(command, Duration::from_millis(200)).await;
        assert!(matches!(result, Err(ProcessRunError::TimedOut)));
        wait_for_file(&parent_pid_path, Duration::from_secs(1)).await;
        wait_for_file(&descendant_pid_path, Duration::from_secs(1)).await;

        let parent_pid = recorded_pid(&parent_pid_path);
        assert!(
            !process_exists(parent_pid),
            "the timed-out root process must be explicitly reaped"
        );

        // The descendant would write after two seconds if timeout handling
        // killed only the direct shell rather than its whole process group.
        sleep(Duration::from_millis(1_250)).await;
        assert!(
            !marker_path.exists(),
            "a descendant survived process-tree timeout cancellation"
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn manager_stop_cancels_active_runner_and_reaps_root_process() {
        let workspace = TestWorkspace::create("manager-stop");
        let parent_pid_path = workspace.join("parent.pid");
        let marker_path = workspace.join("late-marker");
        let script = workspace.script(
            "#!/bin/sh\n\
             printf '%s\\n' \"$$\" > \"$1\"\n\
             (\n\
               sleep 1\n\
               printf 'runner survived' > \"$2\"\n\
             ) &\n\
             wait\n",
        );

        let compilation_id = "exact-preview-manager-stop".to_string();
        let manager = CompilationManager::default();
        let runner = TrackedStoicheiaProcessRunner::new(
            manager
                .begin(compilation_id.clone())
                .expect("register active exact-preview runner"),
        );
        let mut command = Command::new(script);
        command.arg(&parent_pid_path).arg(&marker_path);
        let runner_task =
            tokio::spawn(async move { runner.run(command, Duration::from_secs(30)).await });

        wait_for_file(&parent_pid_path, Duration::from_secs(2)).await;
        let parent_pid = recorded_pid(&parent_pid_path);
        let stop_started = Instant::now();
        let stop_manager = manager.clone();
        tokio::task::spawn_blocking(move || stop_manager.stop(&compilation_id))
            .await
            .expect("stop task should join")
            .expect("manager should stop the active runner");
        assert!(
            stop_started.elapsed() < Duration::from_secs(4),
            "manager stop exceeded the graceful and forced stop budget"
        );

        let result = runner_task.await.expect("runner task should join");
        assert!(matches!(
            result,
            Err(ProcessRunError::Interrupted(message))
                if message == "Compilation stopped by user"
        ));
        assert!(
            !process_exists(parent_pid),
            "the stopped root process must be reaped before the runner returns"
        );

        sleep(Duration::from_millis(1_250)).await;
        assert!(
            !marker_path.exists(),
            "manager stop left an active descendant behind"
        );
    }
}

/// Cross-platform native process-tree smoke coverage.
///
/// Unlike the focused Unix shell tests above, this module spawns the Rust test
/// executable itself as a parent and descendant. It therefore exercises the
/// production Unix process-group or Windows `taskkill /T` path without relying
/// on a platform-specific scripting shell.
#[cfg(test)]
mod native_smoke_tests {
    use super::*;
    use crate::compiler::CompilationManager;
    use std::{
        env, fs,
        path::{Path, PathBuf},
        process::Stdio,
        thread,
        time::Instant,
    };
    use tokio::time::sleep;

    const HELPER_TEST: &str =
        "package_studio::stoicheia_process::native_smoke_tests::native_process_tree_helper";
    const ROLE_ENV: &str = "DATATEX_NATIVE_PROCESS_SMOKE_ROLE";
    const PARENT_PID_ENV: &str = "DATATEX_NATIVE_PROCESS_SMOKE_PARENT_PID";
    const DESCENDANT_PID_ENV: &str = "DATATEX_NATIVE_PROCESS_SMOKE_DESCENDANT_PID";
    const MARKER_ENV: &str = "DATATEX_NATIVE_PROCESS_SMOKE_MARKER";

    struct NativeSmokeWorkspace {
        path: PathBuf,
    }

    impl NativeSmokeWorkspace {
        fn create(name: &str) -> Self {
            let path = env::temp_dir().join(format!(
                "datatex-native-process-smoke-{name}-{}",
                uuid::Uuid::new_v4()
            ));
            fs::create_dir_all(&path).expect("create native process smoke workspace");
            Self { path }
        }

        fn join(&self, name: &str) -> PathBuf {
            self.path.join(name)
        }

        fn parent_command(&self) -> Command {
            let mut command = Command::new(
                env::current_exe().expect("resolve native process smoke test executable"),
            );
            command
                .arg("--exact")
                .arg(HELPER_TEST)
                .arg("--nocapture")
                .env(ROLE_ENV, "parent")
                .env(PARENT_PID_ENV, self.join("parent.pid"))
                .env(DESCENDANT_PID_ENV, self.join("descendant.pid"))
                .env(MARKER_ENV, self.join("orphan-marker"));
            command
        }
    }

    impl Drop for NativeSmokeWorkspace {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    async fn wait_for_file(path: &Path, wait: Duration) {
        let deadline = Instant::now() + wait;
        while !path.exists() && Instant::now() < deadline {
            sleep(Duration::from_millis(10)).await;
        }
        assert!(path.exists(), "timed out waiting for {}", path.display());
    }

    fn required_path(name: &str) -> PathBuf {
        env::var_os(name)
            .map(PathBuf::from)
            .unwrap_or_else(|| panic!("native process smoke helper is missing {name}"))
    }

    #[cfg(unix)]
    fn process_exists(pid: i32) -> bool {
        unsafe extern "C" {
            fn kill(pid: i32, signal: i32) -> i32;
        }
        (unsafe { kill(pid, 0) }) == 0
    }

    #[test]
    fn native_process_tree_helper() {
        match env::var(ROLE_ENV).ok().as_deref() {
            None => {}
            Some("descendant") => {
                thread::sleep(Duration::from_secs(3));
                fs::write(required_path(MARKER_ENV), b"descendant survived")
                    .expect("write native process smoke orphan marker");
            }
            Some("parent") => {
                fs::write(
                    required_path(PARENT_PID_ENV),
                    std::process::id().to_string(),
                )
                .expect("write native process smoke parent pid");

                let mut descendant = std::process::Command::new(
                    env::current_exe().expect("resolve descendant smoke executable"),
                );
                descendant
                    .arg("--exact")
                    .arg(HELPER_TEST)
                    .arg("--nocapture")
                    .env(ROLE_ENV, "descendant")
                    .env(MARKER_ENV, required_path(MARKER_ENV))
                    .stdin(Stdio::null())
                    .stdout(Stdio::null())
                    .stderr(Stdio::null());
                let descendant = descendant
                    .spawn()
                    .expect("spawn native process smoke descendant");
                fs::write(
                    required_path(DESCENDANT_PID_ENV),
                    descendant.id().to_string(),
                )
                .expect("write native process smoke descendant pid");

                loop {
                    thread::sleep(Duration::from_secs(1));
                }
            }
            Some(role) => panic!("unknown native process smoke helper role: {role}"),
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn native_timeout_reaps_the_process_tree() {
        let workspace = NativeSmokeWorkspace::create("timeout");
        let parent_pid_path = workspace.join("parent.pid");
        let descendant_pid_path = workspace.join("descendant.pid");
        let marker_path = workspace.join("orphan-marker");
        let manager = CompilationManager::default();
        let runner = TrackedStoicheiaProcessRunner::new(
            manager
                .begin("native-exact-preview-timeout".to_string())
                .expect("register native timeout smoke job"),
        );

        let result = runner
            .run(workspace.parent_command(), Duration::from_millis(250))
            .await;
        assert!(matches!(result, Err(ProcessRunError::TimedOut)));
        wait_for_file(&parent_pid_path, Duration::from_secs(1)).await;
        wait_for_file(&descendant_pid_path, Duration::from_secs(1)).await;

        #[cfg(unix)]
        {
            let parent_pid = fs::read_to_string(&parent_pid_path)
                .expect("read native timeout parent pid")
                .trim()
                .parse()
                .expect("native timeout parent pid should be numeric");
            assert!(!process_exists(parent_pid));
        }

        sleep(Duration::from_millis(3_250)).await;
        assert!(
            !marker_path.exists(),
            "native timeout left a descendant process running"
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn native_manager_stop_reaps_the_process_tree() {
        let workspace = NativeSmokeWorkspace::create("manager-stop");
        let parent_pid_path = workspace.join("parent.pid");
        let descendant_pid_path = workspace.join("descendant.pid");
        let marker_path = workspace.join("orphan-marker");
        let compilation_id = "native-exact-preview-manager-stop".to_string();
        let manager = CompilationManager::default();
        let runner = TrackedStoicheiaProcessRunner::new(
            manager
                .begin(compilation_id.clone())
                .expect("register native manager-stop smoke job"),
        );
        let command = workspace.parent_command();
        let runner_task =
            tokio::spawn(async move { runner.run(command, Duration::from_secs(30)).await });

        wait_for_file(&parent_pid_path, Duration::from_secs(2)).await;
        wait_for_file(&descendant_pid_path, Duration::from_secs(2)).await;
        let stop_manager = manager.clone();
        tokio::task::spawn_blocking(move || stop_manager.stop(&compilation_id))
            .await
            .expect("native manager-stop task should join")
            .expect("native manager-stop should terminate the process tree");

        let result = runner_task.await.expect("native runner task should join");
        assert!(matches!(
            result,
            Err(ProcessRunError::Interrupted(message))
                if message == "Compilation stopped by user"
        ));

        #[cfg(unix)]
        {
            let parent_pid = fs::read_to_string(&parent_pid_path)
                .expect("read native manager-stop parent pid")
                .trim()
                .parse()
                .expect("native manager-stop parent pid should be numeric");
            assert!(!process_exists(parent_pid));
        }

        sleep(Duration::from_millis(3_250)).await;
        assert!(
            !marker_path.exists(),
            "native manager stop left a descendant process running"
        );
    }
}
