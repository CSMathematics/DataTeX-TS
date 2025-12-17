use std::process::Command;
use std::path::Path;

// Η εντολή που θα καλείται από το React
#[tauri::command]
fn compile_tex(file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);
    
    // Έλεγχος αν υπάρχει το αρχείο
    if !path.exists() {
        return Err("Το αρχείο δεν βρέθηκε.".to_string());
    }

    let parent_dir = path.parent().unwrap_or(Path::new("."));
    let file_name = path.file_name().unwrap().to_str().unwrap();

    // Εκτέλεση του pdflatex
    // ΣΗΜΕΙΩΣΗ: Πρέπει το pdflatex να είναι στο PATH του συστήματος
    let output = Command::new("pdflatex")
        .current_dir(parent_dir) // Εκτέλεση μέσα στον φάκελο του αρχείου
        .arg("-interaction=nonstopmode")
        .arg("-synctex=1")
        .arg(file_name)
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    if output.status.success() {
        Ok("Compilation successful".to_string())
    } else {
        // Επιστροφή του error log αν αποτύχει (από stderr ή stdout)
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        Err(format!("Compilation failed:\n{}\n{}", stdout, stderr))
    }
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