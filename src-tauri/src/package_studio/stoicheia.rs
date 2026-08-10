//! Thin Tauri boundary for the copied Stoicheia engine.
//!
//! Keep host concerns in this module. The engine crate remains a copy-first
//! compatibility island: parser and geometry stay verbatim, while the compiler
//! exposes only the post-parity process-runner seam required by DataTeX.

pub use stoicheia_engine::compiler::CompileResult;
pub use stoicheia_engine::parser::ParseResult;
use stoicheia_engine::process_runner::ExternalProcessRunner;
use tauri::State;

use super::stoicheia_process::TrackedStoicheiaProcessRunner;
use crate::AppState;

#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Deserialize)]
pub struct LatexEnginePaths {
    #[serde(alias = "lualatexPath")]
    pub lualatex: Option<String>,
    #[serde(alias = "pdflatexPath")]
    pub pdflatex: Option<String>,
    #[serde(alias = "xelatexPath")]
    pub xelatex: Option<String>,
    #[serde(alias = "dvisvgmPath")]
    pub dvisvgm: Option<String>,
}

impl From<LatexEnginePaths> for stoicheia_engine::compiler::LatexEnginePaths {
    fn from(paths: LatexEnginePaths) -> Self {
        Self {
            lualatex: paths.lualatex,
            pdflatex: paths.pdflatex,
            xelatex: paths.xelatex,
            dvisvgm: paths.dvisvgm,
        }
    }
}

fn source_line(source: &str, byte_index: usize) -> usize {
    source[..byte_index.min(source.len())]
        .bytes()
        .filter(|byte| *byte == b'\n')
        .count()
        + 1
}

fn source_tail(source: &str) -> (usize, String) {
    let mut tail = (1, String::new());
    for (index, line) in source.lines().enumerate() {
        if !line.trim().is_empty() {
            tail = (index + 1, line.trim().chars().take(160).collect::<String>());
        }
    }
    tail
}

fn source_fingerprint(source: &str) -> String {
    let hash = source.bytes().fold(0xcbf29ce484222325_u64, |hash, byte| {
        (hash ^ u64::from(byte)).wrapping_mul(0x100000001b3)
    });
    let (_, tail) = source_tail(source);
    format!(
        "bytes={} lines={} fnv1a={hash:016x} tail={:?}",
        source.len(),
        source.lines().count(),
        tail,
    )
}

fn validate_latex_source(source: &str) -> Result<(), String> {
    const BEGIN_DOCUMENT: &str = "\\begin{document}";
    const END_DOCUMENT: &str = "\\end{document}";
    const BEGIN_TIKZ: &str = "\\begin{tikzpicture}";
    const END_TIKZ: &str = "\\end{tikzpicture}";

    if let Some(begin) = source.find(BEGIN_DOCUMENT) {
        match source.rfind(END_DOCUMENT) {
            Some(end) if end > begin => {}
            _ => {
                let (line, tail) = source_tail(source);
                return Err(format!(
                    "LaTeX preflight failed near line {line}: the document starts with \
                     `{BEGIN_DOCUMENT}` but has no complete `{END_DOCUMENT}`. The final \
                     closing `}}` is probably missing. Last non-empty line: {:?}",
                    tail,
                ));
            }
        }
    }

    if let Some(begin) = source.find(BEGIN_TIKZ) {
        match source.rfind(END_TIKZ) {
            Some(end) if end > begin => {}
            _ => {
                let line = source_line(source, begin);
                return Err(format!(
                    "LaTeX preflight failed after line {line}: `{BEGIN_TIKZ}` has no \
                     matching `{END_TIKZ}`."
                ));
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn parse_tikz(source: String) -> Result<ParseResult, String> {
    stoicheia_engine::parser::parse_tikz(source)
}

#[tauri::command]
pub async fn compile_latex(
    source: String,
    compiler: Option<String>,
    engine_paths: Option<LatexEnginePaths>,
    compilation_id: String,
    state: State<'_, AppState>,
) -> Result<CompileResult, String> {
    // Register before preflight/cache/file I/O. A cancellation that races the
    // IPC boundary is then observed before either external stage can spawn.
    let runner =
        TrackedStoicheiaProcessRunner::new(state.compilation_manager.begin(compilation_id)?);
    compile_latex_with_process_runner(source, compiler, engine_paths, &runner).await
}

async fn compile_latex_with_process_runner<R: ExternalProcessRunner + ?Sized>(
    source: String,
    compiler: Option<String>,
    engine_paths: Option<LatexEnginePaths>,
    runner: &R,
) -> Result<CompileResult, String> {
    let fingerprint = source_fingerprint(&source);
    if let Err(error_log) = validate_latex_source(&source) {
        crate::diagnostics::terminal_log(
            "ERROR",
            "STOICHEIA_LATEX",
            "preflight-failed",
            Some(&format!("{fingerprint} error={error_log}")),
        );
        return Ok(CompileResult {
            success: false,
            svg: None,
            error_log: Some(error_log),
        });
    }

    let selected_compiler = compiler.as_deref().unwrap_or("lualatex").to_string();
    let result = stoicheia_engine::compiler::compile_latex_with_runner(
        source,
        compiler,
        engine_paths.map(Into::into),
        runner,
    )
    .await?;
    if !result.success {
        crate::diagnostics::terminal_log(
            "ERROR",
            "STOICHEIA_LATEX",
            "compile-failed",
            Some(&format!("compiler={selected_compiler} {fingerprint}")),
        );
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use stoicheia_engine::process_runner::DirectProcessRunner;

    #[cfg(unix)]
    use std::{
        env,
        ffi::OsString,
        fs,
        os::unix::fs::PermissionsExt,
        path::{Path, PathBuf},
        sync::{Mutex, OnceLock},
        time::{Duration, Instant},
    };

    #[cfg(unix)]
    struct PathEnvironmentGuard(Option<OsString>);

    #[cfg(unix)]
    impl Drop for PathEnvironmentGuard {
        fn drop(&mut self) {
            match self.0.take() {
                Some(path) => env::set_var("PATH", path),
                None => env::remove_var("PATH"),
            }
        }
    }

    #[cfg(unix)]
    fn path_environment_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    #[cfg(unix)]
    fn prepend_to_path(directory: &Path) -> PathEnvironmentGuard {
        let original = env::var_os("PATH");
        let mut paths = vec![directory.to_path_buf()];
        if let Some(path) = original.as_ref() {
            paths.extend(env::split_paths(path));
        }
        env::set_var(
            "PATH",
            env::join_paths(paths).expect("test PATH should be valid"),
        );
        PathEnvironmentGuard(original)
    }

    #[cfg(unix)]
    fn write_executable(path: &Path, source: &str) {
        fs::write(path, source).expect("write fake exact-preview executable");
        let mut permissions = fs::metadata(path)
            .expect("read fake executable metadata")
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(path, permissions).expect("make fake executable runnable");
    }

    #[cfg(unix)]
    async fn wait_for_file(path: &Path) {
        let deadline = Instant::now() + Duration::from_secs(5);
        while !path.exists() && Instant::now() < deadline {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        assert!(path.exists(), "timed out waiting for {}", path.display());
    }

    #[cfg(unix)]
    fn cancellation_fixture(name: &str) -> PathBuf {
        let path =
            env::temp_dir().join(format!("datatex-stoicheia-{name}-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&path).expect("create cancellation fixture directory");
        path
    }

    #[test]
    fn parse_command_preserves_the_engine_payload() {
        let source = r"\tkzDefPoint(1,2){A}".to_string();
        let mut adapter_payload =
            serde_json::to_value(parse_tikz(source.clone()).expect("adapter parse should succeed"))
                .expect("adapter payload should serialize");
        let mut engine_payload = serde_json::to_value(
            stoicheia_engine::parser::parse_tikz(source).expect("engine parse should succeed"),
        )
        .expect("engine payload should serialize");

        let adapter_timings = adapter_payload
            .as_object_mut()
            .and_then(|payload| payload.remove("timings"))
            .expect("adapter timings should be present");
        let engine_timings = engine_payload
            .as_object_mut()
            .and_then(|payload| payload.remove("timings"))
            .expect("engine timings should be present");

        assert_eq!(adapter_payload, engine_payload);
        assert!(adapter_payload.get("geometry_complete").is_some());
        assert!(adapter_payload.get("renderScene").is_some());
        assert!(adapter_payload.get("resolved_points").is_none());
        assert!(adapter_payload["renderScene"]
            .get("geometryComplete")
            .is_some());
        assert_eq!(
            adapter_timings
                .as_object()
                .expect("adapter timings should be an object")
                .keys()
                .collect::<Vec<_>>(),
            engine_timings
                .as_object()
                .expect("engine timings should be an object")
                .keys()
                .collect::<Vec<_>>()
        );
        for key in ["parseMs", "geometryMs", "viewportMs", "totalMs"] {
            assert!(adapter_timings[key]
                .as_f64()
                .is_some_and(|value| value >= 0.0));
            assert!(engine_timings[key]
                .as_f64()
                .is_some_and(|value| value >= 0.0));
        }
        for key in ["nodeCount", "resolvedPointCount"] {
            assert_eq!(adapter_timings[key], engine_timings[key]);
        }
    }

    #[test]
    fn compile_command_uses_the_standalone_result_contract() {
        let payload = serde_json::to_value(CompileResult {
            success: true,
            svg: Some("<svg />".to_string()),
            error_log: None,
        })
        .expect("compile result should serialize");

        assert_eq!(payload["success"], true);
        assert_eq!(payload["svg"], "<svg />");
        assert!(payload.get("error_log").is_some());
        assert!(payload.get("errorLog").is_none());
    }

    #[test]
    fn engine_paths_accept_the_standalone_json_contract() {
        let paths: LatexEnginePaths = serde_json::from_value(serde_json::json!({
            "lualatex": "/tex/bin/lualatex",
            "pdflatex": "/tex/bin/pdflatex",
            "xelatex": "/tex/bin/xelatex",
            "dvisvgm": "/tex/bin/dvisvgm"
        }))
        .expect("engine paths should deserialize");

        assert_eq!(paths.lualatex.as_deref(), Some("/tex/bin/lualatex"));
        assert_eq!(paths.pdflatex.as_deref(), Some("/tex/bin/pdflatex"));
        assert_eq!(paths.xelatex.as_deref(), Some("/tex/bin/xelatex"));
        assert_eq!(paths.dvisvgm.as_deref(), Some("/tex/bin/dvisvgm"));
    }

    #[test]
    fn engine_paths_map_datatex_settings_without_changing_the_engine() {
        let host_paths: LatexEnginePaths = serde_json::from_value(serde_json::json!({
            "lualatexPath": "/datatex/bin/lualatex",
            "pdflatexPath": "/datatex/bin/pdflatex",
            "xelatexPath": "/datatex/bin/xelatex",
            "dvisvgmPath": "/datatex/bin/dvisvgm"
        }))
        .expect("DataTeX engine paths should deserialize");
        let engine_paths: stoicheia_engine::compiler::LatexEnginePaths = host_paths.into();

        assert_eq!(
            engine_paths.lualatex.as_deref(),
            Some("/datatex/bin/lualatex")
        );
        assert_eq!(
            engine_paths.pdflatex.as_deref(),
            Some("/datatex/bin/pdflatex")
        );
        assert_eq!(
            engine_paths.xelatex.as_deref(),
            Some("/datatex/bin/xelatex")
        );
        assert_eq!(
            engine_paths.dvisvgm.as_deref(),
            Some("/datatex/bin/dvisvgm")
        );
    }

    #[test]
    fn preflight_reports_a_truncated_document_footer() {
        let source = "\\documentclass{article}\n\\begin{document}\nHello\n\\end{document";
        let error = validate_latex_source(source).expect_err("truncated footer must be rejected");

        assert!(error.contains("\\end{document}"));
        assert!(error.contains("closing `}`"));
        assert!(error.contains("\\end{document"));
    }

    #[test]
    fn preflight_accepts_a_complete_tikz_document() {
        let source = "\\documentclass{article}\n\\begin{document}\n\
                      \\begin{tikzpicture}\n\\end{tikzpicture}\n\\end{document}";

        assert_eq!(validate_latex_source(source), Ok(()));
    }

    #[tokio::test]
    async fn compile_command_stops_before_tex_for_a_truncated_document_footer() {
        let result = compile_latex_with_process_runner(
            "\\begin{document}\n\\begin{tikzpicture}\n\\end{tikzpicture}\n\\end{document"
                .to_string(),
            Some("pdflatex".to_string()),
            Some(LatexEnginePaths {
                pdflatex: Some("/definitely/missing/pdflatex".to_string()),
                ..Default::default()
            }),
            &DirectProcessRunner,
        )
        .await
        .expect("preflight errors use the normal compile result contract");

        assert!(!result.success);
        assert!(result.svg.is_none());
        assert!(result
            .error_log
            .as_deref()
            .is_some_and(|message| message.contains("preflight")));
    }

    #[tokio::test]
    async fn compile_command_preserves_engine_diagnostics() {
        let source = r"\begin{tikzpicture}\end{tikzpicture}".to_string();
        let compiler = Some("unsupported-engine".to_string());
        let adapter_error = compile_latex_with_process_runner(
            source.clone(),
            compiler.clone(),
            None,
            &DirectProcessRunner,
        )
        .await
        .expect_err("unsupported compiler should fail");
        let engine_error = stoicheia_engine::compiler::compile_latex(source, compiler, None)
            .await
            .expect_err("engine should reject the same compiler");

        assert_eq!(adapter_error, engine_error);
    }

    #[cfg(unix)]
    #[tokio::test(flavor = "current_thread")]
    async fn cancelling_stubborn_latex_skips_dvisvgm_and_removes_temp_workspace() {
        let _environment_guard = path_environment_lock().lock().unwrap();
        let fixture = cancellation_fixture("cancel-latex");
        let bin_dir = fixture.join("bin");
        fs::create_dir_all(&bin_dir).expect("create fixture bin directory");

        let compiler_started = fixture.join("compiler-started");
        let workspace_record = fixture.join("workspace-path");
        let dvisvgm_started = fixture.join("dvisvgm-started");
        let compiler_path = bin_dir.join("fake-pdflatex");
        let dvisvgm_path = bin_dir.join("dvisvgm");

        write_executable(
            &compiler_path,
            &format!(
                "#!/bin/sh\nif [ \"$1\" = \"--version\" ]; then echo 'fake-pdflatex 1.0'; exit 0; fi\nprintf '%s' \"$PWD\" > '{}'\ntouch '{}'\ntrap '' TERM\nwhile :; do sleep 1; done\n",
                workspace_record.display(),
                compiler_started.display(),
            ),
        );
        write_executable(
            &dvisvgm_path,
            &format!(
                "#!/bin/sh\nif [ \"$1\" = \"--version\" ]; then echo 'dvisvgm 1.0'; exit 0; fi\ntouch '{}'\nprintf '<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>' > document.svg\n",
                dvisvgm_started.display(),
            ),
        );
        let _path_guard = prepend_to_path(&bin_dir);

        let manager = crate::compiler::CompilationManager::default();
        let compilation_id = format!("stoicheia-cancel-latex-{}", uuid::Uuid::new_v4());
        let runner = TrackedStoicheiaProcessRunner::new(
            manager
                .begin(compilation_id.clone())
                .expect("register exact-preview compilation"),
        );
        let source = format!(
            "\\begin{{tikzpicture}}\\end{{tikzpicture}}\n% {}",
            uuid::Uuid::new_v4()
        );
        let compiler_path_string = compiler_path.to_string_lossy().into_owned();
        let compile_task = tokio::spawn(async move {
            compile_latex_with_process_runner(
                source,
                Some("pdflatex".to_string()),
                Some(LatexEnginePaths {
                    pdflatex: Some(compiler_path_string),
                    dvisvgm: Some(dvisvgm_path.to_string_lossy().into_owned()),
                    ..Default::default()
                }),
                &runner,
            )
            .await
        });

        wait_for_file(&compiler_started).await;
        wait_for_file(&workspace_record).await;
        let workspace = PathBuf::from(
            fs::read_to_string(&workspace_record).expect("read recorded temporary workspace"),
        );
        assert!(workspace.is_dir());

        let stop_manager = manager.clone();
        let stop_id = compilation_id.clone();
        tokio::task::spawn_blocking(move || stop_manager.stop(&stop_id))
            .await
            .expect("join stop task")
            .expect("stop exact-preview compilation");
        let compile_result = tokio::time::timeout(Duration::from_secs(5), compile_task)
            .await
            .expect("cancelled compile should finish promptly")
            .expect("join exact-preview compile task");

        assert_eq!(
            compile_result,
            Err("Compilation stopped by user".to_string())
        );
        assert!(!dvisvgm_started.exists());
        assert!(!workspace.exists());

        fs::remove_dir_all(&fixture).expect("remove cancellation fixture");
    }

    #[cfg(unix)]
    #[tokio::test(flavor = "current_thread")]
    async fn cancelling_stubborn_dvisvgm_removes_temp_workspace() {
        let _environment_guard = path_environment_lock().lock().unwrap();
        let fixture = cancellation_fixture("cancel-dvisvgm");
        let bin_dir = fixture.join("bin");
        fs::create_dir_all(&bin_dir).expect("create fixture bin directory");

        let dvisvgm_started = fixture.join("dvisvgm-started");
        let workspace_record = fixture.join("workspace-path");
        let compiler_path = bin_dir.join("fake-pdflatex");
        let dvisvgm_path = bin_dir.join("dvisvgm");

        write_executable(
            &compiler_path,
            "#!/bin/sh\nif [ \"$1\" = \"--version\" ]; then echo 'fake-pdflatex 1.0'; exit 0; fi\ntouch document.dvi\nexit 0\n",
        );
        write_executable(
            &dvisvgm_path,
            &format!(
                "#!/bin/sh\nif [ \"$1\" = \"--version\" ]; then echo 'dvisvgm 1.0'; exit 0; fi\nprintf '%s' \"$PWD\" > '{}'\ntouch '{}'\ntrap '' TERM\nwhile :; do sleep 1; done\n",
                workspace_record.display(),
                dvisvgm_started.display(),
            ),
        );
        let _path_guard = prepend_to_path(&bin_dir);

        let manager = crate::compiler::CompilationManager::default();
        let compilation_id = format!("stoicheia-cancel-dvisvgm-{}", uuid::Uuid::new_v4());
        let runner = TrackedStoicheiaProcessRunner::new(
            manager
                .begin(compilation_id.clone())
                .expect("register exact-preview compilation"),
        );
        let source = format!(
            "\\begin{{tikzpicture}}\\end{{tikzpicture}}\n% {}",
            uuid::Uuid::new_v4()
        );
        let compiler_path_string = compiler_path.to_string_lossy().into_owned();
        let compile_task = tokio::spawn(async move {
            compile_latex_with_process_runner(
                source,
                Some("pdflatex".to_string()),
                Some(LatexEnginePaths {
                    pdflatex: Some(compiler_path_string),
                    dvisvgm: Some(dvisvgm_path.to_string_lossy().into_owned()),
                    ..Default::default()
                }),
                &runner,
            )
            .await
        });

        wait_for_file(&dvisvgm_started).await;
        wait_for_file(&workspace_record).await;
        let workspace = PathBuf::from(
            fs::read_to_string(&workspace_record).expect("read recorded temporary workspace"),
        );
        assert!(workspace.is_dir());

        let stop_manager = manager.clone();
        let stop_id = compilation_id.clone();
        tokio::task::spawn_blocking(move || stop_manager.stop(&stop_id))
            .await
            .expect("join stop task")
            .expect("stop exact-preview compilation");
        let compile_result = tokio::time::timeout(Duration::from_secs(5), compile_task)
            .await
            .expect("cancelled dvisvgm should finish promptly")
            .expect("join exact-preview compile task");

        assert_eq!(
            compile_result,
            Err("Compilation stopped by user".to_string())
        );
        assert!(!workspace.exists());

        fs::remove_dir_all(&fixture).expect("remove cancellation fixture");
    }
}
