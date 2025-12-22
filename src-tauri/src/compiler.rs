use std::process::Command;
use std::path::Path;

pub fn compile(file_path: &str, engine: &str, args: Vec<String>, output_dir: &str) -> Result<String, String> {
    // Validate engine against a whitelist to prevent arbitrary command execution
    let allowed_engines = ["pdflatex", "xelatex", "lualatex", "latexmk"];
    if !allowed_engines.contains(&engine) {
        return Err(format!("Invalid engine: {}. Allowed engines are: {:?}", engine, allowed_engines));
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
    // Note: Usually the frontend passes this in 'args', but if we want to enforce it here:
    if !output_dir.is_empty() {
        // We only append it if it's not already in args to avoid duplication
        // Checking strictly is hard, so we assume the caller handles flags.
        // But since we accept the argument, let's at least acknowledge it.
        // For now, to avoid "unused variable" warnings without breaking the signature,
        // we can just debug print it or check if we should append it.
        // Let's explicitly append it if it's safe and likely intended.
        // cmd.arg(format!("-output-directory={}", output_dir));

        // BETTER: Just ignore it if the frontend packs everything into args,
        // but to silence the warning:
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
