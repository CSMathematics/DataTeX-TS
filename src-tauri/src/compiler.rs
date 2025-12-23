use std::process::Command;
use std::path::{Path, PathBuf};
use std::env;

fn is_allowed_engine(engine: &str) -> bool {
    let allowed_engines = ["pdflatex", "xelatex", "lualatex", "latexmk", "synctex", "texcount"];
    let path = Path::new(engine);
    let name = path.file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    allowed_engines.contains(&name.as_str())
}

// Βοηθητική συνάρτηση για να προσθέσουμε τα κοινά μονοπάτια του LaTeX
fn get_augmented_path() -> String {
    let current_path = env::var("PATH").unwrap_or_default();
    let delimiter = if cfg!(windows) { ";" } else { ":" };
    
    // Λίστα με πιθανά paths όπου κρύβεται το LaTeX
    let common_paths = if cfg!(target_os = "macos") {
        vec![
            "/Library/TeX/texbin",
            "/usr/local/bin",
            "/opt/homebrew/bin"
        ]
    } else if cfg!(target_os = "linux") {
        vec![
            "/usr/bin",
            "/usr/local/bin",
            "/usr/texbin"
        ]
    } else {
        // Στα Windows συνήθως το PATH είναι σωστό, αλλά μπορούμε να προσθέσουμε αν χρειαστεί
        vec![] 
    };

    // Φτιάχνουμε το νέο PATH: "OLD_PATH:/Library/TeX/texbin:/usr/local/bin"
    let mut new_path = current_path;
    for p in common_paths {
        if !new_path.contains(p) { // Απλή ρηχή επιβεβαίωση
            new_path.push_str(delimiter);
            new_path.push_str(p);
        }
    }
    new_path
}

fn run_command_generic(command: &str, args: Vec<String>, cwd: Option<&Path>) -> Result<String, String> {
    if !is_allowed_engine(command) {
         return Err(format!("Command not allowed: {}", command));
    }

    let mut cmd = Command::new(command);

    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    let new_path_env = get_augmented_path();
    cmd.env("PATH", &new_path_env);

    for arg in args {
        cmd.arg(arg);
    }

    let output = cmd.output().map_err(|e| {
         format!("Failed to execute '{}': {}", command, e)
    })?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        // Some commands like synctex might return non-zero but still have useful output?
        // Or if it fails we return error.
        // Synctex view returns 0 on success.
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Sometimes stdout has the info even on "failure" or specialized exit codes.
        // But let's assume standard behavior.
        // Actually texcount returns 0.
        Err(format!("Command failed: {}\nStderr: {}", String::from_utf8_lossy(&output.stdout), stderr))
    }
}

pub fn compile(file_path: &str, engine: &str, args: Vec<String>, output_dir: &str) -> Result<String, String> {
    // 1. Validate engine
    if !is_allowed_engine(engine) {
        return Err(format!("Invalid engine: {}. Allowed engines are: pdflatex, xelatex, lualatex, latexmk", engine));
    }

    let path = Path::new(file_path);

    // 2. Check if file exists
    if !path.exists() {
        return Err(format!("The file was not found at path: {:?}", path));
    }

    let parent_dir = path.parent().unwrap_or(Path::new("."));
    let file_name = path.file_name().unwrap().to_str().unwrap();

    // 3. Setup Command
    let mut cmd = Command::new(engine);
    cmd.current_dir(parent_dir);

    // --- ΒΕΛΤΙΩΣΗ: Προσθήκη Paths ---
    // Ενημερώνουμε το περιβάλλον της εντολής με το ενισχυμένο PATH
    let new_path_env = get_augmented_path();
    cmd.env("PATH", &new_path_env);
    // -------------------------------

    // Add arguments
    for arg in args {
        cmd.arg(arg);
    }

    // Handle output directory
    if !output_dir.is_empty() {
        // Σημείωση: Αν χρησιμοποιείς latexmk ή xelatex, το flag για output directory 
        // ίσως διαφέρει (π.χ. -output-directory vs -outdir). 
        // Εδώ υποθέτουμε ότι τα args τα έχεις περάσει σωστά από το frontend.
        // Αν θες να το χειρίζεσαι εδώ, πρέπει να προσθέσεις cmd.arg(format!("-output-directory={}", output_dir));
    }

    // Always add the filename last
    cmd.arg(file_name);

    // 4. Execute
    // Χρησιμοποιούμε map_err για να πιάσουμε το λάθος αν ΔΕΝ βρεθεί καν η εντολή
    let output = cmd.output().map_err(|e| {
        format!(
            "Failed to execute command '{}'. \nSystem Error: {} \nDebug Path: {}", 
            engine, e, new_path_env
        )
    })?;

    if output.status.success() {
        Ok("Compilation successful".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        Err(format!("Compilation failed with status code: {:?}\n\nSTDOUT:\n{}\n\nSTDERR:\n{}", output.status.code(), stdout, stderr))
    }
}

pub fn run_synctex(args: Vec<String>, cwd_path: &str) -> Result<String, String> {
    // Determine CWD
    let cwd = if cwd_path.is_empty() { None } else { Some(Path::new(cwd_path)) };
    run_command_generic("synctex", args, cwd)
}

pub fn run_texcount(args: Vec<String>, cwd_path: &str) -> Result<String, String> {
    let cwd = if cwd_path.is_empty() { None } else { Some(Path::new(cwd_path)) };
    run_command_generic("texcount", args, cwd)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_allowed_engine_simple() {
        assert!(is_allowed_engine("pdflatex"));
        assert!(is_allowed_engine("xelatex"));
        assert!(is_allowed_engine("lualatex"));
        assert!(is_allowed_engine("latexmk"));
        assert!(is_allowed_engine("synctex"));
        assert!(is_allowed_engine("texcount"));
    }

    #[test]
    fn test_is_allowed_engine_with_paths() {
        assert!(is_allowed_engine("/usr/local/bin/pdflatex"));
        if cfg!(windows) {
            assert!(is_allowed_engine("C:\\texlive\\bin\\pdflatex.exe"));
        }
    }
}
