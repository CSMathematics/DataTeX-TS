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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init()) // Plugin για αρχεία
        .plugin(tauri_plugin_dialog::init()) // Plugin για διαλόγους (Open Folder)
        .plugin(tauri_plugin_shell::init()) // Plugin για εντολές (pdflatex)
        .invoke_handler(tauri::generate_handler![compile_tex, run_synctex_command, run_texcount_command]) // Δήλωση εντολής
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
