use tauri::{State, Manager};
use tokio::sync::Mutex;

mod compiler;
mod db; // Import το module της βάσης
use db::DatabaseManager;

// 1. Το State για τη βάση δεδομένων
struct AppState {
    db_manager: Mutex<Option<DatabaseManager>>,
}

// 2. Η εντολή για άνοιγμα Project (και σύνδεση DB)
#[tauri::command]
async fn open_project(path: String, state: State<'_, AppState>) -> Result<String, String> {
    println!("Opening project at: {}", path);

    // Σύνδεση στη βάση project.db μέσα στον φάκελο path
    let manager = DatabaseManager::new(&path)
        .await
        .map_err(|e| {
            println!("Error connecting to DB: {}", e);
            e.to_string()
        })?;

    // Αποθήκευση στο State
    let mut db_guard = state.db_manager.lock().await;
    *db_guard = Some(manager);

    Ok("Project opened and DB connected successfully".to_string())
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