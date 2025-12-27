use tauri::{State, Manager};
use tokio::sync::Mutex;
use directories::ProjectDirs;
use std::fs;

mod compiler;
mod db; // Import το module της βάσης
use db::DatabaseManager;

// 1. Το State για τη βάση δεδομένων
struct AppState {
    db_manager: Mutex<Option<DatabaseManager>>,
}

// 2. Η εντολή για άνοιγμα Project - Πλέον δεν αλλάζει βάση δεδομένων
#[tauri::command]
async fn open_project(path: String, _state: State<'_, AppState>) -> Result<String, String> {
    println!("Setting active project path to: {}", path);
    // Εδώ θα μπορούσαμε να αποθηκεύσουμε το path ως "active working directory"
    // αλλά η βάση δεδομένων είναι πλέον Global και έχει φορτωθεί στο startup.
    Ok("Project path set (Global DB in use)".to_string())
}

// ... Οι υπάρχουσες εντολές σου ...
#[tauri::command]
fn compile_tex(file_path: String, engine: String, args: Vec<String>, output_dir: String) -> Result<String, String> {
    compiler::compile(&file_path, &engine, args, &output_dir)
}

#[tauri::command]
fn run_synctex_command(args: Vec<String>, cwd: String) -> Result<String, String> {
    compiler::run_synctex(args, &cwd)
}

#[tauri::command]
fn run_texcount_command(args: Vec<String>, cwd: String) -> Result<String, String> {
    compiler::run_texcount(args, &cwd)
}

#[tauri::command]
fn get_system_fonts() -> Vec<String> {
    use std::process::Command;
    // ... (ο κώδικας για τα fonts παραμένει ίδιος όπως τον είχες)
    let output = if cfg!(target_os = "linux") {
        Command::new("fc-list").arg(":").arg("family").output().ok()
    } else {
        None
    };

    if let Some(output) = output {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let mut fonts: Vec<String> = stdout
                .lines()
                .flat_map(|line| line.split(','))
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            fonts.sort();
            fonts.dedup();
            return fonts;
        }
    }
    vec![
        "Consolas".to_string(), "Monaco".to_string(), "Courier New".to_string(),
        "monospace".to_string(), "Arial".to_string(),
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 3. Αρχικοποίηση του State
        .manage(AppState {
            db_manager: Mutex::new(None),
        })
        .setup(|app| {
            // Εύρεση του φακέλου δεδομένων
            let proj_dirs = ProjectDirs::from("com", "datatex", "DataTeX");
            let data_dir = if let Some(proj_dirs) = proj_dirs {
                let dir = proj_dirs.data_dir().to_path_buf();
                // Δημιουργία του φακέλου αν δεν υπάρχει
                if let Err(e) = fs::create_dir_all(&dir) {
                    eprintln!("Error creating data directory: {}", e);
                    return Err(Box::new(e));
                }
                dir
            } else {
                // Fallback (θα μπορούσε να είναι το current dir ή panic)
                eprintln!("Could not determine project directories");
                return Err("Could not determine project directories".into());
            };

            let data_dir_str = data_dir.to_string_lossy().to_string();
            println!("Initializing Global DB at: {}", data_dir_str);

            // Ασύγχρονη αρχικοποίηση της βάσης
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match DatabaseManager::new(&data_dir_str).await {
                    Ok(manager) => {
                        let state = app_handle.state::<AppState>();
                        let mut db_guard = state.db_manager.lock().await;
                        *db_guard = Some(manager);
                        println!("Global database initialized successfully.");
                    }
                    Err(e) => {
                        eprintln!("Failed to initialize global database: {}", e);
                    }
                }
            });

            Ok(())
        })
        // 4. Τα Plugins σου (για να δουλεύουν οι διάλογοι)
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        // 5. Καταχώρηση ΟΛΩΝ των εντολών
        .invoke_handler(tauri::generate_handler![
            open_project,      // Η νέα εντολή
            compile_tex,
            run_synctex_command,
            run_texcount_command,
            get_system_fonts
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
