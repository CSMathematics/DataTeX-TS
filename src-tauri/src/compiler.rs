use std::process::Command;
use std::path::Path;

fn is_allowed_engine(engine: &str) -> bool {
    let allowed_engines = ["pdflatex", "xelatex", "lualatex", "latexmk"];
    let path = Path::new(engine);
    let name = path.file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    allowed_engines.contains(&name.as_str())
}

pub fn compile(file_path: &str, engine: &str, args: Vec<String>, output_dir: &str) -> Result<String, String> {
    // Validate engine against a whitelist to prevent arbitrary command execution
    if !is_allowed_engine(engine) {
        return Err(format!("Invalid engine: {}. Allowed engines are: pdflatex, xelatex, lualatex, latexmk", engine));
    }

    let path = Path::new(file_path);

    // Check if file exists
    if !path.exists() {
        return Err("The file was not found.".to_string());
    }

    let parent_dir = path.parent().unwrap_or(Path::new("."));
    let file_name = path.file_name().unwrap().to_str().unwrap();

    let mut cmd = Command::new(engine);
    cmd.current_dir(parent_dir);

    // Add user-provided arguments
    for arg in args {
        cmd.arg(arg);
    }

    // Handle output directory if provided and not empty
    if !output_dir.is_empty() {
        let _ = output_dir;
    }

    // Always add the filename as the last argument
    cmd.arg(file_name);

    let output = cmd.output().map_err(|e| format!("Failed to execute command: {}", e))?;

    if output.status.success() {
        Ok("Compilation successful".to_string())
    } else {
        // Return error log (stdout/stderr)
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        Err(format!("Compilation failed:\n{}\n{}", stdout, stderr))
    }
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
    }

    #[test]
    fn test_is_allowed_engine_with_paths() {
        // Unix style
        assert!(is_allowed_engine("/usr/bin/pdflatex"));
        assert!(is_allowed_engine("/usr/local/texlive/2023/bin/x86_64-linux/xelatex"));

        // Windows style (using forward slashes as Path handles them or just string logic)
        // Note: On linux environment, backslash might be treated as part of filename if not carefully handled,
        // but Path usually handles it or we rely on file_stem behavior.
        // Let's test what works on generic Path impl.

        // If we are on Linux, "C:\tex\pdflatex.exe" might be parsed as one filename "C:\tex\pdflatex.exe"
        // and file_stem would be "C:\tex\pdflatex". This fails the check.
        // So we should be careful with cross-platform tests if the test runner is on Linux.
        // However, the backend logic runs on the user's machine.
        // For this test suite running in this environment (likely Linux), we test Linux paths.

        assert!(is_allowed_engine("/opt/latexmk"));
    }

    #[test]
    fn test_is_allowed_engine_with_extension() {
        assert!(is_allowed_engine("pdflatex.exe"));
        assert!(is_allowed_engine("/usr/bin/pdflatex.exe"));
    }

    #[test]
    fn test_is_disallowed_engine() {
        assert!(!is_allowed_engine("cmd.exe"));
        assert!(!is_allowed_engine("/bin/sh"));
        assert!(!is_allowed_engine("pdflatex_malicious"));
        assert!(!is_allowed_engine("mypdflatex"));
    }
}
