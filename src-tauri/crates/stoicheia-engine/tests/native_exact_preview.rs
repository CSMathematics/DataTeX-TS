use std::{
    collections::BTreeSet,
    env,
    ffi::OsString,
    fs,
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

use stoicheia_engine::compiler::{compile_latex, LatexEnginePaths};

struct SmokeWorkspace {
    path: PathBuf,
    original_path: Option<OsString>,
    original_counter_dir: Option<OsString>,
    original_latex_delay: Option<OsString>,
}

impl SmokeWorkspace {
    fn create() -> Self {
        let path = env::temp_dir().join(format!(
            "stoicheia-native-exact-preview-{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&path).expect("create native exact-preview smoke workspace");
        Self {
            path,
            original_path: env::var_os("PATH"),
            original_counter_dir: env::var_os("STOICHEIA_SMOKE_COUNTER_DIR"),
            original_latex_delay: env::var_os("STOICHEIA_SMOKE_LATEX_DELAY_MS"),
        }
    }

    fn install_tool(&self, name: &str) -> PathBuf {
        let extension = env::consts::EXE_EXTENSION;
        let file_name = if extension.is_empty() {
            name.to_string()
        } else {
            format!("{name}.{extension}")
        };
        let destination = self.path.join(file_name);
        fs::copy(env!("CARGO_BIN_EXE_stoicheia-tool-smoke"), &destination)
            .expect("copy native fake TeX tool");
        destination
    }

    fn activate(&self) {
        let mut paths = vec![self.path.clone()];
        if let Some(original_path) = self.original_path.as_ref() {
            paths.extend(env::split_paths(original_path));
        }
        env::set_var(
            "PATH",
            env::join_paths(paths).expect("compose native smoke PATH"),
        );
        env::set_var("STOICHEIA_SMOKE_COUNTER_DIR", &self.path);
    }

    fn counter(&self, name: &str) -> u32 {
        fs::read_to_string(self.path.join(name))
            .expect("read native smoke render counter")
            .parse()
            .expect("native smoke render counter should be numeric")
    }
}

impl Drop for SmokeWorkspace {
    fn drop(&mut self) {
        match self.original_path.take() {
            Some(value) => env::set_var("PATH", value),
            None => env::remove_var("PATH"),
        }
        match self.original_counter_dir.take() {
            Some(value) => env::set_var("STOICHEIA_SMOKE_COUNTER_DIR", value),
            None => env::remove_var("STOICHEIA_SMOKE_COUNTER_DIR"),
        }
        match self.original_latex_delay.take() {
            Some(value) => env::set_var("STOICHEIA_SMOKE_LATEX_DELAY_MS", value),
            None => env::remove_var("STOICHEIA_SMOKE_LATEX_DELAY_MS"),
        }
        let _ = fs::remove_dir_all(&self.path);
    }
}

fn stoicheia_temp_dirs() -> BTreeSet<PathBuf> {
    fs::read_dir(env::temp_dir())
        .ok()
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with("stoicheia_"))
        })
        .collect()
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

async fn wait_for_counter(workspace: &SmokeWorkspace, name: &str, expected: u32) {
    let deadline = Instant::now() + Duration::from_secs(3);
    while Instant::now() < deadline {
        if fs::read_to_string(workspace.path.join(name))
            .ok()
            .and_then(|value| value.parse::<u32>().ok())
            .is_some_and(|value| value >= expected)
        {
            return;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    panic!("timed out waiting for native smoke counter {name}={expected}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn native_exact_preview_discovers_executes_caches_and_cleans() {
    let workspace = SmokeWorkspace::create();
    let compiler = workspace.install_tool("fake-lualatex");
    workspace.install_tool("dvisvgm");
    workspace.activate();
    let temp_dirs_before = stoicheia_temp_dirs();

    let source = format!(
        "\\documentclass{{article}}\n\\usepackage{{tikz}}\n\\begin{{document}}\n\\begin{{tikzpicture}}\\draw (0,0)--(1,1);\\end{{tikzpicture}}\n\\end{{document}}\n% {}",
        uuid::Uuid::new_v4()
    );
    let engine_paths = || LatexEnginePaths {
        lualatex: Some(path_string(&compiler)),
        // Deliberately use the program name to cover native PATH/PATHEXT
        // discovery instead of only the explicit-path branch.
        dvisvgm: Some("dvisvgm".to_string()),
        ..Default::default()
    };

    let first = compile_latex(
        source.clone(),
        Some("lualatex".to_string()),
        Some(engine_paths()),
    )
    .await
    .expect("native exact preview should compile");
    let cached = compile_latex(source, Some("lualatex".to_string()), Some(engine_paths()))
        .await
        .expect("native exact preview cache should resolve");

    assert!(first.success);
    assert_eq!(first, cached);
    assert!(first
        .svg
        .as_deref()
        .is_some_and(|svg| { svg.contains("data-datatex-native-smoke=\"ok\"") }));
    assert_eq!(workspace.counter("latex-renders"), 1);
    assert_eq!(workspace.counter("dvisvgm-renders"), 1);

    // A real external compile must not monopolize the runtime used by instant
    // parsing. The native helper stays alive long enough to prove that a new
    // parse can complete while the exact process is still pending.
    env::set_var("STOICHEIA_SMOKE_LATEX_DELAY_MS", "750");
    let concurrent_source = format!(
        "\\begin{{tikzpicture}}\\tkzDefPoint(1,2){{A}}\\end{{tikzpicture}}\n% {}",
        uuid::Uuid::new_v4()
    );
    let compile_source = concurrent_source.clone();
    let compile_paths = engine_paths();
    let compile_task = tokio::spawn(async move {
        compile_latex(
            compile_source,
            Some("lualatex".to_string()),
            Some(compile_paths),
        )
        .await
    });
    wait_for_counter(&workspace, "latex-renders", 2).await;

    let parse_started_at = Instant::now();
    let parsed = stoicheia_engine::parser::parse_tikz(concurrent_source)
        .expect("instant parser should remain available during exact compilation");
    let parse_wall_time = parse_started_at.elapsed();
    assert_eq!(parsed.nodes.len(), 1);
    assert!(
        parse_wall_time < Duration::from_millis(250),
        "instant parse took {parse_wall_time:?} while exact compilation was active"
    );
    assert!(
        !compile_task.is_finished(),
        "exact helper should still be running when the instant parse completes"
    );
    let concurrent_result = tokio::time::timeout(Duration::from_secs(3), compile_task)
        .await
        .expect("native exact compile should finish within the smoke budget")
        .expect("native exact compile task should join")
        .expect("native exact compile should succeed");
    assert!(concurrent_result.success);
    assert_eq!(workspace.counter("dvisvgm-renders"), 2);
    assert_eq!(stoicheia_temp_dirs(), temp_dirs_before);
}
