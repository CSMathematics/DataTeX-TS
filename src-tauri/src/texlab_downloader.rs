//! Texlab auto-download module
//! Downloads texlab binary from GitHub releases on first run

use std::fs::{self, File};
use std::io;
use std::path::PathBuf;

/// Get the directory where texlab binary should be stored
pub fn get_texlab_dir() -> Result<PathBuf, String> {
    let base_dirs = directories::BaseDirs::new().ok_or("Failed to determine base directories")?;

    let data_dir = base_dirs.data_local_dir();
    let bin_dir = data_dir.join("datatex").join("bin");

    Ok(bin_dir)
}

/// Get the full path to the texlab binary
pub fn get_texlab_path() -> Result<PathBuf, String> {
    let bin_dir = get_texlab_dir()?;

    #[cfg(target_os = "windows")]
    let binary_name = "texlab.exe";
    #[cfg(not(target_os = "windows"))]
    let binary_name = "texlab";

    Ok(bin_dir.join(binary_name))
}

/// Check if texlab is already installed locally
pub fn is_texlab_installed() -> bool {
    if let Ok(path) = get_texlab_path() {
        path.exists()
    } else {
        false
    }
}

/// Determine the correct download URL based on OS and architecture
fn get_download_url() -> Result<String, String> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;

    let asset_name = match (os, arch) {
        ("linux", "x86_64") => "texlab-x86_64-linux.tar.gz",
        ("linux", "aarch64") => "texlab-aarch64-linux.tar.gz",
        ("macos", "x86_64") => "texlab-x86_64-macos.tar.gz",
        ("macos", "aarch64") => "texlab-aarch64-macos.tar.gz",
        ("windows", "x86_64") => "texlab-x86_64-windows.zip",
        ("windows", "aarch64") => "texlab-aarch64-windows.zip",
        _ => return Err(format!("Unsupported platform: {} {}", os, arch)),
    };

    // Use GitHub releases API to get latest version
    // For simplicity, we'll use the known latest version URL pattern
    Ok(format!(
        "https://github.com/latex-lsp/texlab/releases/latest/download/{}",
        asset_name
    ))
}

/// Download and extract texlab
pub async fn download_texlab() -> Result<PathBuf, String> {
    let url = get_download_url()?;
    let bin_dir = get_texlab_dir()?;
    let texlab_path = get_texlab_path()?;

    // Create bin directory if it doesn't exist
    fs::create_dir_all(&bin_dir).map_err(|e| format!("Failed to create bin directory: {}", e))?;

    println!("📥 Downloading texlab from: {}", url);

    // Download the archive
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to download texlab: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Download failed with status: {}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read download: {}", e))?;

    println!("📦 Extracting texlab...");

    // Extract based on file type
    if url.ends_with(".tar.gz") {
        extract_tar_gz(&bytes, &bin_dir)?;
    } else if url.ends_with(".zip") {
        extract_zip(&bytes, &bin_dir)?;
    } else {
        return Err("Unknown archive format".to_string());
    }

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&texlab_path)
            .map_err(|e| format!("Failed to get file metadata: {}", e))?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&texlab_path, perms)
            .map_err(|e| format!("Failed to set permissions: {}", e))?;
    }

    println!("✅ Texlab downloaded successfully to: {:?}", texlab_path);

    Ok(texlab_path)
}

/// Extract a .tar.gz archive
fn extract_tar_gz(data: &[u8], dest_dir: &PathBuf) -> Result<(), String> {
    use flate2::read::GzDecoder;
    use tar::Archive;

    let decoder = GzDecoder::new(data);
    let mut archive = Archive::new(decoder);

    for entry in archive
        .entries()
        .map_err(|e| format!("Failed to read archive: {}", e))?
    {
        let mut entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry
            .path()
            .map_err(|e| format!("Failed to get path: {}", e))?;

        // Only extract the texlab binary (skip directories and other files)
        if let Some(filename) = path.file_name() {
            if filename == "texlab" {
                let dest_path = dest_dir.join("texlab");
                let mut file = File::create(&dest_path)
                    .map_err(|e| format!("Failed to create file: {}", e))?;
                io::copy(&mut entry, &mut file)
                    .map_err(|e| format!("Failed to write file: {}", e))?;
                return Ok(());
            }
        }
    }

    Err("texlab binary not found in archive".to_string())
}

/// Extract a .zip archive (Windows)
fn extract_zip(data: &[u8], dest_dir: &PathBuf) -> Result<(), String> {
    use std::io::Cursor;
    use zip::ZipArchive;

    let cursor = Cursor::new(data);
    let mut archive = ZipArchive::new(cursor).map_err(|e| format!("Failed to open zip: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {}", e))?;

        if let Some(filename) = file.name().split('/').last() {
            if filename == "texlab.exe" || filename == "texlab" {
                let dest_path = dest_dir.join(filename);
                let mut out_file = File::create(&dest_path)
                    .map_err(|e| format!("Failed to create file: {}", e))?;
                io::copy(&mut file, &mut out_file)
                    .map_err(|e| format!("Failed to write file: {}", e))?;
                return Ok(());
            }
        }
    }

    Err("texlab binary not found in archive".to_string())
}

/// Ensure texlab is available (download if needed)
pub async fn ensure_texlab() -> Result<PathBuf, String> {
    if is_texlab_installed() {
        get_texlab_path()
    } else {
        download_texlab().await
    }
}
