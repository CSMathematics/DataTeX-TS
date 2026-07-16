use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;

// --- Struct definitions matching Typescript interfaces ---

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DtexFile {
    pub version: String,
    pub created: String,
    pub modified: String,
    pub database: DtexDatabaseInfo,
    pub metadata: DtexMetadata,
    pub bibliography: Vec<String>,
    pub content: DtexContent,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DtexDatabaseInfo {
    pub id: String,
    pub name: String,
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collection: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DtexMetadata {
    pub id: String,
    pub file_type: String, // "file" | "document" | ...
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub difficulty: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub taxonomy: Option<DtexTaxonomy>,
    // Add other fields from LatexFileMetadata if needed
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DtexTaxonomy {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<TaxonomyNode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chapter: Option<TaxonomyNode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub section: Option<TaxonomyNode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subsection: Option<TaxonomyNode>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TaxonomyNode {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DtexContent {
    pub latex: String,
    pub encoding: String,
}

// --- Commands ---

#[tauri::command]
pub fn load_dtex_cmd(file_path: String) -> Result<DtexFile, String> {
    let content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let dtex_file: DtexFile = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(dtex_file)
}

#[tauri::command]
pub fn save_dtex_cmd(file_path: String, file: DtexFile) -> Result<(), String> {
    let content = serde_json::to_string_pretty(&file).map_err(|e| e.to_string())?;
    atomic_write(Path::new(&file_path), content.as_bytes())
}

fn atomic_write(path: &Path, content: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "The .dtex path has no valid UTF-8 file name".to_string())?;
    let temp_path = parent.join(format!(".{}.{}.tmp", file_name, uuid::Uuid::new_v4()));

    let result = (|| -> Result<(), String> {
        let mut temp_file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temp_path)
            .map_err(|error| format!("Failed to create temporary .dtex file: {}", error))?;
        temp_file
            .write_all(content)
            .map_err(|error| format!("Failed to write temporary .dtex file: {}", error))?;
        temp_file
            .sync_all()
            .map_err(|error| format!("Failed to flush temporary .dtex file: {}", error))?;

        if let Ok(metadata) = fs::metadata(path) {
            fs::set_permissions(&temp_path, metadata.permissions())
                .map_err(|error| format!("Failed to preserve .dtex permissions: {}", error))?;
        }

        fs::rename(&temp_path, path)
            .map_err(|error| format!("Failed to replace '{}': {}", path.display(), error))?;

        #[cfg(unix)]
        if let Ok(directory) = fs::File::open(parent) {
            directory
                .sync_all()
                .map_err(|error| format!("Failed to flush .dtex directory: {}", error))?;
        }

        Ok(())
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::atomic_write;
    use std::fs;

    #[test]
    fn atomic_write_replaces_complete_content() {
        let path = std::env::temp_dir().join(format!("datatex-dtex-{}.dtex", uuid::Uuid::new_v4()));
        fs::write(&path, b"old content").expect("seed .dtex fixture");

        atomic_write(&path, b"new complete content").expect("replace .dtex fixture");

        assert_eq!(fs::read(&path).unwrap(), b"new complete content");
        fs::remove_file(path).unwrap();
    }
}
