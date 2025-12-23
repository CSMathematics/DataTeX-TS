mod compiler;

// Η εντολή που θα καλείται από το React
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

    let output = if cfg!(target_os = "linux") {
        Command::new("fc-list")
            .arg(":")
            .arg("family")
            .output()
            .ok()
    } else {
        // Fallback for other OS if not implemented
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

    // Default fallback if command fails or not linux
    vec![
        "Consolas".to_string(),
        "Monaco".to_string(),
        "Courier New".to_string(),
        "monospace".to_string(),
        "Arial".to_string(),
        "Helvetica".to_string(),
        "Times New Roman".to_string(),
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init()) // Plugin για αρχεία
        .plugin(tauri_plugin_dialog::init()) // Plugin για διαλόγους (Open Folder)
        .plugin(tauri_plugin_shell::init()) // Plugin για εντολές (pdflatex)
        .invoke_handler(tauri::generate_handler![compile_tex, run_synctex_command, run_texcount_command, get_system_fonts]) // Δήλωση εντολής
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
