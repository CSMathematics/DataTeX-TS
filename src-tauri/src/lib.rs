mod compiler;

// Η εντολή που θα καλείται από το React
#[tauri::command]
fn compile_tex(file_path: String, engine: String, args: Vec<String>, output_dir: String) -> Result<String, String> {
    compiler::compile(&file_path, &engine, args, &output_dir)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init()) // Plugin για αρχεία
        .plugin(tauri_plugin_dialog::init()) // Plugin για διαλόγους (Open Folder)
        .plugin(tauri_plugin_shell::init()) // Plugin για εντολές (pdflatex)
        .invoke_handler(tauri::generate_handler![compile_tex]) // Δήλωση εντολής
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
