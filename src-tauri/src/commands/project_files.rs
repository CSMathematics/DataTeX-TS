use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
pub struct FileSystemNode {
    pub id: String,
    pub name: String,
    pub r#type: String, // "file" | "folder"
    pub path: String,
    pub children: Vec<FileSystemNode>,
}

const IGNORED_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "dist",
    ".gemini",
    ".vscode",
    "out",
];
const IGNORED_EXTS: &[&str] = &[
    "aux",
    "log",
    "out",
    "toc",
    "synctex.gz",
    "fdb_latexmk",
    "fls",
    "bbl",
    "blg",
    "xdv",
    "lof",
    "lot",
    "nav",
    "snm",
    "vrb",
];

fn scan_directory(dir_path: &Path) -> Vec<FileSystemNode> {
    let mut nodes = Vec::new();

    if let Ok(entries) = fs::read_dir(dir_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            if name.starts_with('.') {
                continue;
            }

            if path.is_dir() {
                if IGNORED_DIRS.contains(&name.as_str()) {
                    continue;
                }

                let children = scan_directory(&path);
                nodes.push(FileSystemNode {
                    id: path.to_string_lossy().to_string(),
                    name: name.clone(),
                    r#type: "folder".to_string(),
                    path: path.to_string_lossy().to_string(),
                    children,
                });
            } else {
                if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                    if IGNORED_EXTS.contains(&ext.to_lowercase().as_str()) {
                        continue;
                    }
                }

                nodes.push(FileSystemNode {
                    id: path.to_string_lossy().to_string(),
                    name: name.clone(),
                    r#type: "file".to_string(),
                    path: path.to_string_lossy().to_string(),
                    children: Vec::new(),
                });
            }
        }
    }

    // Sort: folders first, then files (alphabetical)
    nodes.sort_by(|a, b| {
        if a.r#type == b.r#type {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else if a.r#type == "folder" {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    nodes
}

#[tauri::command]
pub fn get_project_files(root_path: String) -> Result<FileSystemNode, String> {
    let path = Path::new(&root_path);
    if !path.exists() || !path.is_dir() {
        return Err("Invalid directory path".to_string());
    }

    let children = scan_directory(path);
    let name = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| root_path.clone());

    Ok(FileSystemNode {
        id: root_path.clone(),
        name: name.to_uppercase(),
        r#type: "folder".to_string(),
        path: root_path,
        children,
    })
}
