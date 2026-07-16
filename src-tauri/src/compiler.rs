#![allow(dead_code)]

use std::collections::HashMap;
use std::env;
use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::{Arc, Condvar, Mutex, MutexGuard};
use std::thread;
use std::time::Duration;

const GRACEFUL_STOP_TIMEOUT: Duration = Duration::from_millis(750);
const FORCE_STOP_TIMEOUT: Duration = Duration::from_secs(2);

#[derive(Default)]
struct ProcessLifecycle {
    pid: Option<u32>,
    finished: bool,
}

#[derive(Default)]
struct ProcessSignal {
    lifecycle: Mutex<ProcessLifecycle>,
    changed: Condvar,
}

struct ActiveCompilation {
    cancellation_requested: bool,
    signal: Arc<ProcessSignal>,
}

#[derive(Clone, Default)]
pub struct CompilationManager {
    active: Arc<Mutex<HashMap<String, ActiveCompilation>>>,
}

/// RAII registration for a compilation request. Dropping it always removes the
/// request from the registry and wakes a concurrent stop command.
pub struct CompilationPermit {
    id: String,
    manager: CompilationManager,
    signal: Arc<ProcessSignal>,
}

impl CompilationManager {
    pub fn begin(&self, id: String) -> Result<CompilationPermit, String> {
        let signal = Arc::new(ProcessSignal::default());
        let mut active = lock_unpoisoned(&self.active);
        if active.contains_key(&id) {
            return Err(format!("Compilation request '{}' is already active", id));
        }
        active.insert(
            id.clone(),
            ActiveCompilation {
                cancellation_requested: false,
                signal: Arc::clone(&signal),
            },
        );
        drop(active);

        Ok(CompilationPermit {
            id,
            manager: self.clone(),
            signal,
        })
    }

    /// Request termination of a compilation. This is idempotent: a request that
    /// has just completed is treated as already stopped.
    pub fn stop(&self, id: &str) -> Result<(), String> {
        let (pid, signal) = {
            let mut active = lock_unpoisoned(&self.active);
            let Some(compilation) = active.get_mut(id) else {
                return Ok(());
            };
            compilation.cancellation_requested = true;
            let signal = Arc::clone(&compilation.signal);
            let pid = lock_unpoisoned(&signal.lifecycle).pid;
            (pid, signal)
        };

        // The blocking compilation task may still be preparing its input. The
        // cancellation flag ensures that, if it spawns later, it is terminated
        // immediately during process registration.
        let Some(pid) = pid else {
            return Ok(());
        };

        let graceful_error = signal_process_tree(pid, false).err();
        if wait_until_finished(&signal, GRACEFUL_STOP_TIMEOUT) {
            return Ok(());
        }

        let force_result = signal_process_tree(pid, true);
        if wait_until_finished(&signal, FORCE_STOP_TIMEOUT) {
            return Ok(());
        }

        let signal_error = force_result
            .err()
            .or(graceful_error)
            .map(|error| format!(" ({})", error))
            .unwrap_or_default();
        Err(format!(
            "Timed out while stopping compilation process {}{}",
            pid, signal_error
        ))
    }

    fn cancellation_requested(&self, id: &str) -> bool {
        lock_unpoisoned(&self.active)
            .get(id)
            .map(|compilation| compilation.cancellation_requested)
            .unwrap_or(true)
    }

    fn finish(&self, id: &str, signal: &ProcessSignal) {
        lock_unpoisoned(&self.active).remove(id);
        let mut lifecycle = lock_unpoisoned(&signal.lifecycle);
        lifecycle.finished = true;
        signal.changed.notify_all();
    }

    #[cfg(test)]
    fn process_started(&self, id: &str) -> bool {
        lock_unpoisoned(&self.active)
            .get(id)
            .map(|compilation| lock_unpoisoned(&compilation.signal.lifecycle).pid.is_some())
            .unwrap_or(false)
    }
}

impl CompilationPermit {
    pub fn ensure_not_cancelled(&self) -> Result<(), String> {
        if self.manager.cancellation_requested(&self.id) {
            Err("Compilation stopped by user".to_string())
        } else {
            Ok(())
        }
    }

    fn attach_process(&self, pid: u32) -> bool {
        {
            let mut lifecycle = lock_unpoisoned(&self.signal.lifecycle);
            lifecycle.pid = Some(pid);
            self.signal.changed.notify_all();
        }
        self.manager.cancellation_requested(&self.id)
    }

    fn mark_process_exited(&self) {
        let mut lifecycle = lock_unpoisoned(&self.signal.lifecycle);
        lifecycle.finished = true;
        self.signal.changed.notify_all();
    }
}

impl Drop for CompilationPermit {
    fn drop(&mut self) {
        self.manager.finish(&self.id, &self.signal);
    }
}

fn lock_unpoisoned<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|error| error.into_inner())
}

fn wait_until_finished(signal: &ProcessSignal, timeout: Duration) -> bool {
    let lifecycle = lock_unpoisoned(&signal.lifecycle);
    if lifecycle.finished {
        return true;
    }
    let (lifecycle, _) = signal
        .changed
        .wait_timeout_while(lifecycle, timeout, |state| !state.finished)
        .unwrap_or_else(|error| error.into_inner());
    lifecycle.finished
}

#[cfg(unix)]
fn configure_process_group(command: &mut Command) {
    use std::os::unix::process::CommandExt;
    command.process_group(0);
}

#[cfg(windows)]
fn configure_process_group(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    // CREATE_NEW_PROCESS_GROUP: lets taskkill terminate the whole compiler tree.
    command.creation_flags(0x0000_0200);
}

#[cfg(not(any(unix, windows)))]
fn configure_process_group(_command: &mut Command) {}

#[cfg(unix)]
fn signal_process_tree(pid: u32, force: bool) -> Result<(), String> {
    use std::io;

    const SIGTERM: i32 = 15;
    const SIGKILL: i32 = 9;
    const ESRCH: i32 = 3;

    unsafe extern "C" {
        fn kill(pid: i32, signal: i32) -> i32;
    }

    let pid = i32::try_from(pid).map_err(|_| "Compiler process id is invalid".to_string())?;
    let signal = if force { SIGKILL } else { SIGTERM };
    // The compiler is started as its own process-group leader; a negative PID
    // signals it and any subprocesses (for example latexmk -> pdflatex).
    let result = unsafe { kill(-pid, signal) };
    if result == 0 {
        return Ok(());
    }

    let error = io::Error::last_os_error();
    if error.raw_os_error() == Some(ESRCH) {
        Ok(())
    } else {
        Err(format!(
            "Failed to signal compiler process group: {}",
            error
        ))
    }
}

#[cfg(windows)]
fn signal_process_tree(pid: u32, force: bool) -> Result<(), String> {
    let mut command = Command::new("taskkill");
    let pid = pid.to_string();
    command.args(["/PID", pid.as_str(), "/T"]);
    if force {
        command.arg("/F");
    }
    let output = command
        .output()
        .map_err(|error| format!("Failed to run taskkill: {}", error))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "taskkill failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

#[cfg(not(any(unix, windows)))]
fn signal_process_tree(_pid: u32, _force: bool) -> Result<(), String> {
    Err("Stopping compilation is not supported on this platform".to_string())
}

fn is_allowed_engine(engine: &str) -> bool {
    let allowed_engines = [
        "pdflatex", "xelatex", "lualatex", "latexmk", "synctex", "texcount",
    ];
    let path = Path::new(engine);
    let name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    allowed_engines.contains(&name.as_str())
}

// Helper to add common LaTeX paths.
fn get_augmented_path() -> String {
    let current_path = env::var("PATH").unwrap_or_default();
    let delimiter = if cfg!(windows) { ";" } else { ":" };

    // List of potential LaTeX bin paths.
    let common_paths = if cfg!(target_os = "macos") {
        vec!["/Library/TeX/texbin", "/usr/local/bin", "/opt/homebrew/bin"]
    } else if cfg!(target_os = "linux") {
        vec!["/usr/bin", "/usr/local/bin", "/usr/texbin"]
    } else {
        vec![]
    };

    // Construct new PATH.
    let mut new_path = current_path;
    for p in common_paths {
        if !new_path.contains(p) {
            // Simple validation.
            new_path.push_str(delimiter);
            new_path.push_str(p);
        }
    }
    new_path
}

fn run_command_generic(
    command: &str,
    args: Vec<String>,
    cwd: Option<&Path>,
) -> Result<String, String> {
    if !is_allowed_engine(command) {
        return Err(format!("Command not allowed: {}", command));
    }

    let mut cmd = Command::new(command);

    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    let new_path_env = get_augmented_path();
    cmd.env("PATH", &new_path_env);

    for arg in args {
        cmd.arg(arg);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute '{}': {}", command, e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!(
            "Command failed: {}\nStderr: {}",
            String::from_utf8_lossy(&output.stdout),
            stderr
        ))
    }
}

pub fn compile(
    file_path: &str,
    engine: &str,
    args: Vec<String>,
    _output_dir: &str,
    permit: CompilationPermit,
) -> Result<String, String> {
    permit.ensure_not_cancelled()?;

    // 1. Validate engine
    if !is_allowed_engine(engine) {
        return Err(format!(
            "Invalid engine: {}. Allowed engines are: pdflatex, xelatex, lualatex, latexmk",
            engine
        ));
    }

    let path = Path::new(file_path);

    // 2. Check if file exists
    if !path.exists() {
        return Err(format!("The file was not found at path: {:?}", path));
    }

    let parent_dir = path.parent().unwrap_or(Path::new("."));
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "The LaTeX file path has no valid UTF-8 file name".to_string())?;

    // 3. Setup Command
    let mut cmd = Command::new(engine);
    cmd.current_dir(parent_dir);
    configure_process_group(&mut cmd);

    // Inject augmented PATH.
    let new_path_env = get_augmented_path();
    cmd.env("PATH", &new_path_env);

    // Add arguments
    for arg in args {
        cmd.arg(arg);
    }

    // Always add the filename last
    cmd.arg(file_name);
    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Spawn explicitly so the stop command can signal the live process tree.
    let mut child = cmd.spawn().map_err(|e| {
        format!(
            "Failed to execute command '{}'. \nSystem Error: {} \nDebug Path: {}",
            engine, e, new_path_env
        )
    })?;

    let pid = child.id();
    let stdout = child.stdout.take().map(|mut pipe| {
        thread::spawn(move || {
            let mut output = Vec::new();
            pipe.read_to_end(&mut output).map(|_| output)
        })
    });
    let stderr = child.stderr.take().map(|mut pipe| {
        thread::spawn(move || {
            let mut output = Vec::new();
            pipe.read_to_end(&mut output).map(|_| output)
        })
    });

    if permit.attach_process(pid) {
        // A stop may race with process startup. In that case no stop command is
        // waiting to apply the force-kill fallback, so arm a short watchdog.
        let cancellation_signal = Arc::clone(&permit.signal);
        thread::spawn(move || {
            let _ = signal_process_tree(pid, false);
            if !wait_until_finished(&cancellation_signal, GRACEFUL_STOP_TIMEOUT) {
                let _ = signal_process_tree(pid, true);
            }
        });
    }

    let status = match child.wait() {
        Ok(status) => status,
        Err(error) => {
            let _ = signal_process_tree(pid, true);
            let _ = child.kill();
            let _ = child.wait();
            permit.mark_process_exited();
            return Err(format!("Failed to wait for compiler process: {}", error));
        }
    };
    // Mark the PID as finished before joining output readers, preventing a stop
    // watchdog from ever signalling a PID that the OS has already recycled.
    permit.mark_process_exited();
    let stdout = join_output_reader(stdout, "stdout")?;
    let stderr = join_output_reader(stderr, "stderr")?;

    if permit.ensure_not_cancelled().is_err() {
        return Err("Compilation stopped by user".to_string());
    }

    if status.success() {
        Ok("Compilation successful".to_string())
    } else {
        Err(format!(
            "Compilation failed with status code: {:?}\n\nSTDOUT:\n{}\n\nSTDERR:\n{}",
            status.code(),
            String::from_utf8_lossy(&stdout),
            String::from_utf8_lossy(&stderr)
        ))
    }
}

fn join_output_reader(
    reader: Option<thread::JoinHandle<std::io::Result<Vec<u8>>>>,
    stream_name: &str,
) -> Result<Vec<u8>, String> {
    match reader {
        Some(reader) => reader
            .join()
            .map_err(|_| format!("Compiler {} reader panicked", stream_name))?
            .map_err(|error| format!("Failed to read compiler {}: {}", stream_name, error)),
        None => Ok(Vec::new()),
    }
}

pub fn run_synctex(args: Vec<String>, cwd_path: &str) -> Result<String, String> {
    // Determine CWD
    let cwd = if cwd_path.is_empty() {
        None
    } else {
        Some(Path::new(cwd_path))
    };
    run_command_generic("synctex", args, cwd)
}

pub fn run_texcount(args: Vec<String>, cwd_path: &str) -> Result<String, String> {
    let cwd = if cwd_path.is_empty() {
        None
    } else {
        Some(Path::new(cwd_path))
    };
    run_command_generic("texcount", args, cwd)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_allowed_engine_simple() {
        assert!(is_allowed_engine("pdflatex"));
        assert!(is_allowed_engine("xelatex"));
        assert!(is_allowed_engine("lualatex"));
        assert!(is_allowed_engine("latexmk"));
        assert!(is_allowed_engine("synctex"));
        assert!(is_allowed_engine("texcount"));
    }

    #[test]
    fn test_is_allowed_engine_with_paths() {
        assert!(is_allowed_engine("/usr/local/bin/pdflatex"));
        if cfg!(windows) {
            assert!(is_allowed_engine("C:\\texlive\\bin\\pdflatex.exe"));
        }
    }

    #[test]
    fn cancellation_before_spawn_prevents_compilation_and_cleans_registry() {
        let manager = CompilationManager::default();
        let permit = manager
            .begin("before-spawn".to_string())
            .expect("register compilation");

        manager.stop("before-spawn").expect("request cancellation");
        assert_eq!(
            permit.ensure_not_cancelled(),
            Err("Compilation stopped by user".to_string())
        );
        drop(permit);

        manager
            .begin("before-spawn".to_string())
            .expect("completed registration should be removed");
    }

    #[cfg(unix)]
    #[test]
    fn stop_terminates_running_compiler_process_group() {
        use std::fs;
        use std::os::unix::fs::PermissionsExt;
        use std::time::Instant;

        let test_dir = env::temp_dir().join(format!(
            "datatex-compiler-stop-test-{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&test_dir).expect("create test directory");
        let engine_path = test_dir.join("pdflatex");
        let tex_path = test_dir.join("document.tex");
        // Ignore SIGTERM in the parent script so the manager must exercise its
        // timeout and SIGKILL fallback. The whole process group includes `sleep`.
        fs::write(
            &engine_path,
            "#!/bin/sh\ntrap '' TERM\nwhile :; do sleep 1; done\n",
        )
        .expect("write fake compiler");
        let mut permissions = fs::metadata(&engine_path)
            .expect("fake compiler metadata")
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&engine_path, permissions).expect("make fake compiler executable");
        fs::write(&tex_path, "\\documentclass{article}").expect("write test TeX file");

        let manager = CompilationManager::default();
        let permit = manager
            .begin("running".to_string())
            .expect("register compilation");
        let compile_thread = thread::spawn(move || {
            compile(
                tex_path.to_str().expect("UTF-8 test path"),
                engine_path.to_str().expect("UTF-8 engine path"),
                Vec::new(),
                "",
                permit,
            )
        });

        let registration_deadline = Instant::now() + Duration::from_secs(2);
        while !manager.process_started("running") && Instant::now() < registration_deadline {
            thread::sleep(Duration::from_millis(10));
        }
        assert!(manager.process_started("running"));

        let stop_started = Instant::now();
        manager.stop("running").expect("stop compiler process");
        assert!(stop_started.elapsed() < Duration::from_secs(4));

        let result = compile_thread.join().expect("compiler thread should join");
        assert_eq!(result, Err("Compilation stopped by user".to_string()));
        fs::remove_dir_all(&test_dir).expect("remove test directory");
    }
}
