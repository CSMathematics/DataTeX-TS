#![allow(dead_code)]

use std::env;
use std::path::Path;
use std::process::Command;

fn is_allowed_engine(engine: &str) -> bool {
    let allowed_engines = [
        "pdflatex", "xelatex", "lualatex", "latexmk", "synctex", "texcount",
    ];
    let path = Path::new(engine);
    let name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    allowed_engines.contains(&name.as_str())
}

// Helper to add common LaTeX paths.
fn get_augmented_path() -> String {
    let current_path = env::var("PATH").unwrap_or_default();
    let delimiter = if cfg!(windows) { ";" } else { ":" };

    // List of potential LaTeX bin paths.
    let common_paths = if cfg!(target_os = "macos") {
        vec!["/Library/TeX/texbin", "/usr/local/bin", "/opt/homebrew/bin"]
    } else if cfg!(target_os = "linux") {
        vec!["/usr/bin", "/usr/local/bin", "/usr/texbin"]
    } else {
        vec![]
    };

    // Construct new PATH.
    let mut new_path = current_path;
    for p in common_paths {
        if !new_path.contains(p) {
            // Simple validation.
            new_path.push_str(delimiter);
            new_path.push_str(p);
        }
    }
    new_path
}

fn run_command_generic(
    command: &str,
    args: Vec<String>,
    cwd: Option<&Path>,
) -> Result<String, String> {
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

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute '{}': {}", command, e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!(
            "Command failed: {}\nStderr: {}",
            String::from_utf8_lossy(&output.stdout),
            stderr
        ))
    }
}

pub fn compile(
    file_path: &str,
    engine: &str,
    args: Vec<String>,
    output_dir: &str,
) -> Result<String, String> {
    // 1. Validate engine
    if !is_allowed_engine(engine) {
        return Err(format!(
            "Invalid engine: {}. Allowed engines are: pdflatex, xelatex, lualatex, latexmk",
            engine
        ));
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

    // Inject augmented PATH.
    let new_path_env = get_augmented_path();
    cmd.env("PATH", &new_path_env);

    // Add arguments
    for arg in args {
        cmd.arg(arg);
    }

    // Handle output directory
    if !output_dir.is_empty() {
        // Note: Output directory args should be handled by the caller/args.
    }

    // Always add the filename last
    cmd.arg(file_name);

    // Execute command with enhanced error mapping.
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
        Err(format!(
            "Compilation failed with status code: {:?}\n\nSTDOUT:\n{}\n\nSTDERR:\n{}",
            output.status.code(),
            stdout,
            stderr
        ))
    }
}

pub fn run_synctex(args: Vec<String>, cwd_path: &str) -> Result<String, String> {
    // Determine CWD
    let cwd = if cwd_path.is_empty() {
        None
    } else {
        Some(Path::new(cwd_path))
    };
    run_command_generic("synctex", args, cwd)
}

pub fn run_texcount(args: Vec<String>, cwd_path: &str) -> Result<String, String> {
    let cwd = if cwd_path.is_empty() {
        None
    } else {
        Some(Path::new(cwd_path))
    };
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
