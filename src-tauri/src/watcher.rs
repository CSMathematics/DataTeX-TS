use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::mpsc::channel;
use std::sync::{Arc, Mutex};
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
