use std::{
    collections::BTreeSet,
    env,
    ffi::OsString,
    fs,
    path::{Path, PathBuf},
};

use stoicheia_engine::compiler::{compile_latex, LatexEnginePaths};

struct SmokeWorkspace {
    path: PathBuf,
    original_path: Option<OsString>,
    original_counter_dir: Option<OsString>,
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

#[tokio::test(flavor = "current_thread")]
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
    assert_eq!(stoicheia_temp_dirs(), temp_dirs_before);
}
