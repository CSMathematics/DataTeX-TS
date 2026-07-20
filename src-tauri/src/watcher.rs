use crate::bibliography;
use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use sqlx::{Pool, Sqlite};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::mpsc::channel;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

pub struct GitWatcher {
    watcher: Arc<Mutex<Option<RecommendedWatcher>>>,
}

impl GitWatcher {
    pub fn new() -> Self {
        Self {
            watcher: Arc::new(Mutex::new(None)),
        }
    }

    pub fn watch(&self, path: &str, app: AppHandle) -> Result<(), String> {
        let (tx, rx) = channel();

        // Create a watcher object, delivering debounced events.
        // The notification back-end is selected based on the platform.
        let mut watcher =
            RecommendedWatcher::new(tx, Config::default()).map_err(|e| e.to_string())?;

        // Add a path to be watched. All files and directories at that path and
        // below will be monitored for changes.
        watcher
            .watch(Path::new(path), RecursiveMode::Recursive)
            .map_err(|e| e.to_string())?;

        // Store the watcher so it stays alive
        *self.watcher.lock().unwrap() = Some(watcher);

        // Spawn a thread to handle events
        std::thread::spawn(move || {
            for res in rx {
                match res {
                    Ok(_) => {
                        // Debounce logic could be here, or frontend can debounce.
                        // For simply telling frontend "something changed", we emit event.
                        // Filter for relevant git events if needed, but monitoring whole repo is safer.
                        let _ = app.emit("git-refresh", ());
                    }
                    Err(e) => println!("watch error: {:?}", e),
                }
            }
        });

        Ok(())
    }

    pub fn unwatch(&self) {
        // Dropping the watcher stops it
        *self.watcher.lock().unwrap() = None;
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BibliographyWatchSummary {
    pub tracked_resources: usize,
    pub watched_directories: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BibliographyReparseEvent {
    pub resource_id: Option<String>,
    pub source_id: Option<String>,
    pub path: String,
    pub entries_imported: Option<usize>,
    pub parse_status: Option<String>,
    pub diagnostics_count: Option<usize>,
    pub skipped: bool,
    pub error: Option<String>,
}

pub struct BibliographyWatcher {
    watcher: Arc<Mutex<Option<RecommendedWatcher>>>,
    pending: Arc<Mutex<HashMap<PathBuf, Instant>>>,
}

impl BibliographyWatcher {
    pub fn new() -> Self {
        Self {
            watcher: Arc::new(Mutex::new(None)),
            pending: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn watch_tracked(
        &self,
        pool: Pool<Sqlite>,
        app: AppHandle,
    ) -> Result<BibliographyWatchSummary, String> {
        let resources = bibliography::service::list_tracked_bibliography_resources(&pool).await?;
        let directories = resources
            .iter()
            .filter_map(|resource| Path::new(&resource.path).parent().map(comparable_path))
            .collect::<HashSet<_>>();

        let (tx, rx) = channel();
        let mut watcher =
            RecommendedWatcher::new(tx, Config::default()).map_err(|error| error.to_string())?;

        for directory in &directories {
            watcher
                .watch(directory, RecursiveMode::NonRecursive)
                .map_err(|error| {
                    format!(
                        "Failed to watch bibliography directory '{}': {error}",
                        directory.display()
                    )
                })?;
        }

        *self.watcher.lock().unwrap() = Some(watcher);
        self.pending.lock().unwrap().clear();

        let pending = Arc::clone(&self.pending);
        std::thread::spawn(move || {
            for result in rx {
                match result {
                    Ok(event) => {
                        for path in event.paths.into_iter().filter(is_bibliography_path) {
                            schedule_bibliography_reparse(
                                Arc::clone(&pending),
                                pool.clone(),
                                app.clone(),
                                comparable_path(&path),
                            );
                        }
                    }
                    Err(error) => {
                        let _ = app.emit(
                            "bibliography-watch-error",
                            format!("Bibliography watch error: {error}"),
                        );
                    }
                }
            }
        });

        Ok(BibliographyWatchSummary {
            tracked_resources: resources.len(),
            watched_directories: directories.len(),
        })
    }

    pub fn unwatch(&self) {
        *self.watcher.lock().unwrap() = None;
        self.pending.lock().unwrap().clear();
    }
}

fn schedule_bibliography_reparse(
    pending: Arc<Mutex<HashMap<PathBuf, Instant>>>,
    pool: Pool<Sqlite>,
    app: AppHandle,
    path: PathBuf,
) {
    let stamp = Instant::now();
    pending.lock().unwrap().insert(path.clone(), stamp);

    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(700)).await;
        let should_run = {
            let mut pending = pending.lock().unwrap();
            if pending.get(&path).copied() != Some(stamp) {
                false
            } else {
                pending.remove(&path);
                true
            }
        };
        if !should_run {
            return;
        }

        let path_string = path.to_string_lossy().to_string();
        match bibliography::service::reparse_changed_bibliography_path(&pool, &path).await {
            Ok(Some(result)) => {
                let _ = app.emit(
                    "bibliography-resource-reparsed",
                    BibliographyReparseEvent {
                        resource_id: Some(result.source.resource_id),
                        source_id: Some(result.source.id),
                        path: result.source.path,
                        entries_imported: Some(result.entries_imported),
                        parse_status: Some(result.source.parse_status),
                        diagnostics_count: Some(result.diagnostics.len()),
                        skipped: false,
                        error: None,
                    },
                );
            }
            Ok(None) => {
                let _ = app.emit(
                    "bibliography-resource-reparsed",
                    BibliographyReparseEvent {
                        resource_id: None,
                        source_id: None,
                        path: path_string,
                        entries_imported: None,
                        parse_status: None,
                        diagnostics_count: None,
                        skipped: true,
                        error: None,
                    },
                );
            }
            Err(error) => {
                let _ = app.emit(
                    "bibliography-resource-reparsed",
                    BibliographyReparseEvent {
                        resource_id: None,
                        source_id: None,
                        path: path_string,
                        entries_imported: None,
                        parse_status: None,
                        diagnostics_count: None,
                        skipped: false,
                        error: Some(error),
                    },
                );
            }
        }
    });
}

fn is_bibliography_path(path: &PathBuf) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("bib"))
}

fn comparable_path(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}
