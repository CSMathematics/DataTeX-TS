use serde::{Deserialize, Serialize};
use std::fs;

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
    fs::write(&file_path, content).map_err(|e| e.to_string())?;
    Ok(())
}
