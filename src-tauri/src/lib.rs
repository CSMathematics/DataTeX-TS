use directories::ProjectDirs;
use sqlx::Row;
use std::fs;
use tauri::{Manager, State};
use tokio::sync::Mutex;
use uuid::Uuid;
use walkdir::WalkDir; // For typed metadata queries

mod compiler;
mod database;
mod lsp;
mod search;

// Legacy rusqlite modules - kept for future typed metadata implementation
mod graph_processor;
mod log_parser;
mod tree_builder;
mod types;
mod commands {
    pub mod ctan;
}

use database::entities::{Collection, Resource};
use database::DatabaseManager;
use lsp::TexlabManager;

// Typed metadata commands now defined below with sqlx (rusqlite commands removed)

// 1. App State
struct AppState {
    db_manager: Mutex<Option<DatabaseManager>>,
    lsp_manager: Mutex<Option<TexlabManager>>,
}

// 2. Open Project Command
#[tauri::command]
async fn open_project(path: String, _state: State<'_, AppState>) -> Result<String, String> {
    println!("Setting active project path to: {}", path);
    Ok("Project path set (Global DB in use)".to_string())
}

#[tauri::command]
fn get_db_path() -> Result<String, String> {
    let proj_dirs = ProjectDirs::from("", "", "datatex");
    if let Some(proj_dirs) = proj_dirs {
        let db_path = proj_dirs.data_dir().join("project.db");
        Ok(db_path.to_string_lossy().to_string())
    } else {
        Err("Could not determine project directories".to_string())
    }
}

// ... Existing commands ...
#[tauri::command]
fn compile_tex(
    file_path: String,
    engine: String,
    args: Vec<String>,
    output_dir: String,
) -> Result<String, String> {
    compiler::compile(&file_path, &engine, args, &output_dir)
}

#[tauri::command]
fn run_synctex_command(args: Vec<String>, cwd: String) -> Result<String, String> {
    compiler::run_synctex(args, &cwd)
}

#[tauri::command]
fn run_texcount_command(args: Vec<String>, cwd: String) -> Result<String, String> {
    compiler::run_texcount(args, &cwd)
}

#[tauri::command]
async fn compile_resource_cmd(id: String, state: State<'_, AppState>) -> Result<String, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    let resource_opt = db.get_resource_by_id(&id).await?;
    let resource = resource_opt.ok_or("Resource not found")?;

    // Parse metadata
    let metadata_json = resource.metadata.as_ref().ok_or("No metadata found")?;
    let preamble_id_opt = metadata_json.get("preamble").and_then(|v| v.as_str());
    let build_command = metadata_json
        .get("buildCommand")
        .and_then(|v| v.as_str())
        .unwrap_or("pdflatex");

    if let Some(preamble_id) = preamble_id_opt {
        // Need to wrap content
        let preamble_content = if preamble_id.starts_with("builtin:") {
            // Simple built-in defaults
            if preamble_id == "builtin:beamer" {
                "\\documentclass{beamer}\n\\usepackage[utf8]{inputenc}\n".to_string()
            } else {
                "\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amsmath}\n"
                    .to_string()
            }
        } else {
            // Fetch preamble resource
            let preamble_res = db
                .get_resource_by_id(preamble_id)
                .await?
                .ok_or("Preamble resource not found")?;

            // If preamble resource is physically on disk, read it
            fs::read_to_string(&preamble_res.path)
                .map_err(|e| format!("Failed to read preamble file: {}", e))?
        };

        // Read the actual resource content
        // Assuming resource.path is valid
        let body_content = fs::read_to_string(&resource.path)
            .map_err(|e| format!("Failed to read resource file: {}", e))?;

        // Construct full document
        let full_doc = format!(
            "{}\n\\begin{{document}}\n{}\n\\end{{document}}",
            preamble_content, body_content
        );

        // Save to temporary file in same directory?
        // Or in a temp folder. Same directory is safer for relative image paths.
        let original_path = std::path::Path::new(&resource.path);
        let parent_dir = original_path.parent().unwrap_or(std::path::Path::new("."));
        let file_stem = original_path.file_stem().unwrap().to_str().unwrap();
        let temp_filename = format!("{}_preview.tex", file_stem);
        let temp_path = parent_dir.join(&temp_filename);

        fs::write(&temp_path, full_doc).map_err(|e| format!("Failed to write temp file: {}", e))?;

        // Compile
        let output_dir = parent_dir.to_string_lossy().to_string();

        // Use -jobname to output the PDF with the original filename (overwriting any previous build)
        // This ensures that the main editor's PDF viewer (which looks for filename.pdf) picks it up automatically.
        let jobname_arg = format!("-jobname={}", file_stem);

        let result = compiler::compile(
            &temp_path.to_string_lossy(),
            build_command,
            vec![jobname_arg],
            &output_dir,
        );

        // Clean up temp tex file (optional? maybe keep for debugging or user inspection?)
        // Let's keep it for now as '_preview.tex'

        // Output path logic (compiler usually replaces extension)
        match result {
            Ok(_) => {
                // Since we used -jobname=file_stem, the output is file_stem.pdf
                let pdf_name = format!("{}.pdf", file_stem);
                let pdf_path = parent_dir.join(pdf_name);
                Ok(pdf_path.to_string_lossy().to_string())
            }
            Err(e) => Err(e),
        }
    } else {
        // Normal compilation
        let parent_dir = std::path::Path::new(&resource.path)
            .parent()
            .unwrap_or(std::path::Path::new("."));
        let output_dir = parent_dir.to_string_lossy().to_string();

        match compiler::compile(&resource.path, build_command, vec![], &output_dir) {
            Ok(_) => {
                // Assume PDF is [filename].pdf
                let original_path = std::path::Path::new(&resource.path);
                let file_stem = original_path.file_stem().unwrap().to_str().unwrap();
                let pdf_name = format!("{}.pdf", file_stem);
                let pdf_path = original_path.with_file_name(pdf_name);
                Ok(pdf_path.to_string_lossy().to_string())
            }
            Err(e) => Err(e),
        }
    }
}

#[tauri::command]
fn get_system_fonts() -> Vec<String> {
    use std::process::Command;
    let output = if cfg!(target_os = "linux") {
        Command::new("fc-list").arg(":").arg("family").output().ok()
    } else {
        None
    };

    if let Some(output) = output {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let mut fonts: Vec<String> = stdout
                .lines()
                .flat_map(|line| line.split(','))
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            fonts.sort();
            fonts.dedup();
            return fonts;
        }
    }
    vec![
        "Consolas".to_string(),
        "Monaco".to_string(),
        "Courier New".to_string(),
        "monospace".to_string(),
        "Arial".to_string(),
    ]
}

#[derive(serde::Serialize)]
struct TableDataResponse {
    data: Vec<serde_json::Value>,
    total_count: i64,
    columns: Vec<String>,
}

#[tauri::command]
async fn get_table_data_cmd(
    table_name: String,
    page: i64,
    page_size: i64,
    search: String,
    search_cols: Vec<String>,
    state: State<'_, AppState>,
) -> Result<TableDataResponse, String> {
    let db_guard = state.db_manager.lock().await;
    if let Some(db) = &*db_guard {
        let (data, total_count, columns) = db
            .get_table_data(table_name, page, page_size, search, search_cols)
            .await?;
        Ok(TableDataResponse {
            data,
            total_count,
            columns,
        })
    } else {
        Err("Database not initialized".to_string())
    }
}

#[tauri::command]
async fn update_cell_cmd(
    table_name: String,
    id: String,
    column: String,
    value: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    if let Some(db) = &*db_guard {
        db.update_cell(table_name, id, column, value).await
    } else {
        Err("Database not initialized".to_string())
    }
}

// ===== New Database Commands =====

#[tauri::command]
async fn get_collections_cmd(state: State<'_, AppState>) -> Result<Vec<Collection>, String> {
    let db_guard = state.db_manager.lock().await;
    if let Some(db) = &*db_guard {
        db.get_collections().await
    } else {
        Err("Database not initialized".to_string())
    }
}

#[tauri::command]
async fn create_collection_cmd(name: String, state: State<'_, AppState>) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    let collection = Collection {
        name: name.clone(),
        description: Some("Manually created collection".to_string()),
        icon: Some("database".to_string()),
        kind: "manual".to_string(),
        created_at: None,
    };
    db.create_collection(&collection).await?;
    Ok(())
}

#[tauri::command]
async fn get_resources_by_collection_cmd(
    collection: String,
    state: State<'_, AppState>,
) -> Result<Vec<Resource>, String> {
    let db_guard = state.db_manager.lock().await;
    if let Some(db) = &*db_guard {
        db.get_resources_by_collection(&collection).await
    } else {
        Err("Database not initialized".to_string())
    }
}

/// Batch command: fetch resources for multiple collections in single IPC call
/// More efficient than multiple get_resources_by_collection_cmd calls
#[tauri::command]
async fn get_resources_by_collections_cmd(
    collections: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Vec<Resource>, String> {
    let db_guard = state.db_manager.lock().await;
    if let Some(db) = &*db_guard {
        db.get_resources_by_collections(&collections).await
    } else {
        Err("Database not initialized".to_string())
    }
}

#[tauri::command]
async fn import_folder_cmd(
    path: String,
    collection_name: String,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    // 2. Create Collection if not exists
    let collection = Collection {
        name: collection_name.clone(),
        description: Some(format!("Imported from {}", path)),
        icon: Some("folder".to_string()),
        kind: "files".to_string(),
        created_at: None,
    };
    db.create_collection(&collection).await?;

    // 2. Walk directory
    let mut count = 0;
    for entry in WalkDir::new(&path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            let file_path = entry.path().to_string_lossy().to_string();
            let file_name = entry.file_name().to_string_lossy().to_string();

            // Simple type detection extension
            let kind = if file_name.ends_with(".tex") {
                "file"
            } else if file_name.ends_with(".bib") {
                "bibliography"
            } else if file_name.ends_with(".sty") {
                "package"
            } else if file_name.ends_with(".cls") {
                "class"
            } else if file_name.ends_with(".dtx") {
                "dtx"
            } else if file_name.ends_with(".ins") {
                "ins"
            } else if file_name.ends_with(".png")
                || file_name.ends_with(".jpg")
                || file_name.ends_with(".pdf")
            {
                "figure"
            } else {
                "file"
            };

            let resource = Resource {
                id: Uuid::new_v4().to_string(),
                path: file_path,
                kind: kind.to_string(),
                collection: collection_name.clone(),
                title: Some(file_name),
                content_hash: None, // TODO: calculate hash
                metadata: Some(serde_json::json!({})),
                created_at: None,
                updated_at: None,
            };

            if let Err(e) = db.add_resource(&resource).await {
                eprintln!("Failed to add resource: {}", e);
                // Continue despite errors? or fail?
                // For now, log and continue.
            } else {
                count += 1;
            }
        }
    }

    Ok(count)
}

#[tauri::command]
async fn delete_collection_cmd(
    collection_name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.delete_collection(&collection_name).await
}

#[tauri::command]
async fn delete_resource_cmd(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.delete_resource(&id).await
}

#[tauri::command]
async fn create_resource_cmd(
    path: String,
    collection_name: String,
    content: String,
    metadata: Option<serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    // 1. Write file to disk
    fs::write(&path, &content).map_err(|e| e.to_string())?;

    // 2. Add to database
    let file_name = std::path::Path::new(&path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let kind = if file_name.ends_with(".tex") {
        "file"
    } else if file_name.ends_with(".bib") {
        "bibliography"
    } else if file_name.ends_with(".sty") {
        "package"
    } else if file_name.ends_with(".cls") {
        "class"
    } else if file_name.ends_with(".dtx") {
        "dtx"
    } else if file_name.ends_with(".ins") {
        "ins"
    } else {
        "file"
    };

    let resource = Resource {
        id: Uuid::new_v4().to_string(),
        path: path.clone(),
        kind: kind.to_string(),
        collection: collection_name,
        title: Some(file_name),
        content_hash: None,
        metadata: Some(metadata.unwrap_or(serde_json::json!({}))),
        created_at: None,
        updated_at: None,
    };

    db.add_resource(&resource).await
}

#[tauri::command]
async fn import_file_cmd(
    path: String,
    collection_name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    let file_name = std::path::Path::new(&path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    // Simple type detection extension - reusing logic could be better but copying for now
    let kind = if file_name.ends_with(".tex") {
        "file"
    } else if file_name.ends_with(".bib") {
        "bibliography"
    } else if file_name.ends_with(".sty") {
        "package"
    } else if file_name.ends_with(".cls") {
        "class"
    } else if file_name.ends_with(".dtx") {
        "dtx"
    } else if file_name.ends_with(".ins") {
        "ins"
    } else if file_name.ends_with(".png")
        || file_name.ends_with(".jpg")
        || file_name.ends_with(".pdf")
    {
        "figure"
    } else {
        "file"
    };

    let resource = Resource {
        id: Uuid::new_v4().to_string(),
        path: path.clone(),
        kind: kind.to_string(),
        collection: collection_name,
        title: Some(file_name),
        content_hash: None,
        metadata: Some(serde_json::json!({})),
        created_at: None,
        updated_at: None,
    };

    db.add_resource(&resource).await
}

#[tauri::command]
fn reveal_path_cmd(path: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn link_resources_cmd(
    source_id: String,
    target_id: String,
    relation_type: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.add_dependency(&source_id, &target_id, &relation_type)
        .await
}

#[tauri::command]
async fn get_linked_resources_cmd(
    source_id: String,
    relation_type: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<Resource>, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.get_dependencies(&source_id, relation_type.as_deref())
        .await
}

#[tauri::command]
async fn get_all_dependencies_cmd(
    state: State<'_, AppState>,
) -> Result<Vec<(String, String, String)>, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    db.get_all_dependencies().await
}

// ===== Search Command =====

#[tauri::command]
async fn search_database_files(
    query: String,
    case_sensitive: bool,
    use_regex: bool,
    file_types: Vec<String>,
    collections: Vec<String>,
    max_results: usize,
    state: State<'_, AppState>,
) -> Result<search::SearchResult, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    // Get resources from the specified collections
    let resources = if collections.is_empty() {
        // If no collections specified, search all
        let all_collections = db.get_collections().await?;
        let collection_names: Vec<String> =
            all_collections.iter().map(|c| c.name.clone()).collect();
        db.get_resources_by_collections(&collection_names).await?
    } else {
        db.get_resources_by_collections(&collections).await?
    };

    // Build search query
    let search_query = search::SearchQuery {
        text: query,
        case_sensitive,
        use_regex,
        file_types,
        max_results,
    };

    // Perform search
    search::search_in_files(&search_query, resources)
}

#[tauri::command]
async fn replace_database_files(
    query: String,
    replace_with: String,
    case_sensitive: bool,
    use_regex: bool,
    file_types: Vec<String>,
    collections: Vec<String>,
    state: State<'_, AppState>,
) -> Result<search::ReplaceResult, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    // Get resources from the specified collections
    let resources = if collections.is_empty() {
        // If no collections specified, search all
        let all_collections = db.get_collections().await?;
        let collection_names: Vec<String> =
            all_collections.iter().map(|c| c.name.clone()).collect();
        db.get_resources_by_collections(&collection_names).await?
    } else {
        db.get_resources_by_collections(&collections).await?
    };

    let replace_query = search::ReplaceQuery {
        search: search::SearchQuery {
            text: query,
            case_sensitive,
            use_regex,
            file_types,
            max_results: usize::MAX, // Replace typically processes all matches
        },
        replace_with,
    };

    search::replace_in_files(&replace_query, resources)
}

// ===== LSP Commands =====

#[tauri::command]
async fn lsp_initialize(root_uri: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut lsp_guard = state.lsp_manager.lock().await;

    if lsp_guard.is_none() {
        let mut manager = TexlabManager::new();
        manager.start().await?;

        let params = serde_json::json!({
            "processId": std::process::id(),
            "rootUri": root_uri,
            "capabilities": {
                "textDocument": {
                    "completion": {
                        "completionItem": {
                            "snippetSupport": true,
                            "documentationFormat": ["markdown", "plaintext"]
                        }
                    },
                    "hover": {
                        "contentFormat": ["markdown", "plaintext"]
                    },
                    "definition": {
                        "linkSupport": true
                    }
                }
            }
        });

        manager.send_request("initialize", params).await?;

        manager
            .send_notification("initialized", serde_json::json!({}))
            .await?;

        let config = serde_json::json!({
            "settings": {
                "texlab": {
                    "completion": {
                        "matcher": "fuzzy-ignore-case"
                    },
                    "build": {
                        "onSave": false
                    }
                }
            }
        });
        manager
            .send_notification("workspace/didChangeConfiguration", config)
            .await?;

        *lsp_guard = Some(manager);
        Ok(())
    } else {
        Ok(())
    }
}

#[tauri::command]
async fn lsp_completion(
    uri: String,
    line: u32,
    character: u32,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let mut lsp_guard = state.lsp_manager.lock().await;

    if let Some(manager) = lsp_guard.as_mut() {
        let params = serde_json::json!({
            "textDocument": { "uri": uri },
            "position": { "line": line, "character": character }
        });

        manager
            .send_request("textDocument/completion", params)
            .await
    } else {
        Err("LSP not initialized".to_string())
    }
}

#[tauri::command]
async fn lsp_hover(
    uri: String,
    line: u32,
    character: u32,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let mut lsp_guard = state.lsp_manager.lock().await;

    if let Some(manager) = lsp_guard.as_mut() {
        let params = serde_json::json!({
            "textDocument": { "uri": uri },
            "position": { "line": line, "character": character }
        });

        manager.send_request("textDocument/hover", params).await
    } else {
        Err("LSP not initialized".to_string())
    }
}

#[tauri::command]
fn parse_log_cmd(content: String) -> Vec<log_parser::LogEntry> {
    log_parser::parse_log(&content)
}

#[tauri::command]
async fn get_file_tree_cmd(
    collections: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Vec<tree_builder::TreeNode>, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    let mut all_resources = Vec::new();
    for col in collections {
        let resources = db.get_resources_by_collection(&col).await?;
        all_resources.extend(resources);
    }

    Ok(tree_builder::build_file_tree(all_resources))
}

#[tauri::command]
async fn lsp_definition(
    uri: String,
    line: u32,
    character: u32,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let mut lsp_guard = state.lsp_manager.lock().await;

    if let Some(manager) = lsp_guard.as_mut() {
        let params = serde_json::json!({
            "textDocument": { "uri": uri },
            "position": { "line": line, "character": character }
        });

        manager
            .send_request("textDocument/definition", params)
            .await
    } else {
        Err("LSP not initialized".to_string())
    }
}

#[tauri::command]
async fn lsp_did_open(
    uri: String,
    language_id: String,
    version: i32,
    text: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut lsp_guard = state.lsp_manager.lock().await;

    if let Some(manager) = lsp_guard.as_mut() {
        let params = serde_json::json!({
            "textDocument": {
                "uri": uri,
                "languageId": language_id,
                "version": version,
                "text": text
            }
        });

        manager
            .send_notification("textDocument/didOpen", params)
            .await
    } else {
        Err("LSP not initialized".to_string())
    }
}

#[tauri::command]
async fn lsp_did_change(
    uri: String,
    version: i32,
    text: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut lsp_guard = state.lsp_manager.lock().await;

    if let Some(manager) = lsp_guard.as_mut() {
        let params = serde_json::json!({
            "textDocument": {
                "uri": uri,
                "version": version
            },
            "contentChanges": [{
                "text": text
            }]
        });

        manager
            .send_notification("textDocument/didChange", params)
            .await
    } else {
        Err("LSP not initialized".to_string())
    }
}

// ============================================================================
// Typed Metadata Commands (sqlx-based)
// ============================================================================

#[tauri::command]
async fn get_fields_cmd(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let rows = sqlx::query("SELECT id, name FROM fields ORDER BY name")
        .fetch_all(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut fields = Vec::new();
    for row in rows {
        let id: String = row.get("id");
        let name: String = row.get("name");
        fields.push(serde_json::json!({"id": id, "name": name}));
    }
    Ok(fields)
}

#[tauri::command]
async fn create_field_cmd(
    state: State<'_, AppState>,
    name: String,
) -> Result<serde_json::Value, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO fields (id, name) VALUES (?, ?)")
        .bind(&id)
        .bind(&name)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({"id": id, "name": name}))
}

#[tauri::command]
async fn create_chapter_cmd(
    state: State<'_, AppState>,
    name: String,
    field_id: String,
) -> Result<serde_json::Value, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO chapters (id, name, field_id) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(&name)
        .bind(&field_id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({"id": id, "name": name, "fieldId": field_id}))
}

#[tauri::command]
async fn create_section_cmd(
    state: State<'_, AppState>,
    name: String,
    chapter_id: String,
) -> Result<serde_json::Value, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO sections (id, name, chapter_id) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(&name)
        .bind(&chapter_id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({"id": id, "name": name, "chapterId": chapter_id}))
}

// ============================================================================
// Subsection Commands
// ============================================================================

#[tauri::command]
async fn get_subsections_cmd(
    state: State<'_, AppState>,
    section_id: Option<String>,
) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let mut subsections = Vec::new();

    if let Some(sid) = section_id {
        let rows = sqlx::query(
            "SELECT id, name, section_id FROM subsections WHERE section_id = ? ORDER BY name",
        )
        .bind(&sid)
        .fetch_all(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

        for row in rows {
            let id: String = row.get("id");
            let name: String = row.get("name");
            let section_id: String = row.get("section_id");
            subsections.push(serde_json::json!({"id": id, "name": name, "sectionId": section_id}));
        }
    } else {
        let rows = sqlx::query("SELECT id, name, section_id FROM subsections ORDER BY name")
            .fetch_all(&manager.pool)
            .await
            .map_err(|e| e.to_string())?;

        for row in rows {
            let id: String = row.get("id");
            let name: String = row.get("name");
            let section_id: String = row.get("section_id");
            subsections.push(serde_json::json!({"id": id, "name": name, "sectionId": section_id}));
        }
    }

    Ok(subsections)
}

#[tauri::command]
async fn create_subsection_cmd(
    state: State<'_, AppState>,
    name: String,
    section_id: String,
) -> Result<serde_json::Value, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO subsections (id, name, section_id) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(&name)
        .bind(&section_id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({"id": id, "name": name, "sectionId": section_id}))
}

// ============================================================================
// Delete Hierarchy Commands
// ============================================================================

#[tauri::command]
async fn delete_field_cmd(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    // Cascade delete is handled by SQLite foreign keys
    sqlx::query("DELETE FROM fields WHERE id = ?")
        .bind(&id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn delete_chapter_cmd(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("DELETE FROM chapters WHERE id = ?")
        .bind(&id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn delete_section_cmd(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("DELETE FROM sections WHERE id = ?")
        .bind(&id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn delete_subsection_cmd(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("DELETE FROM subsections WHERE id = ?")
        .bind(&id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================================
// Rename Hierarchy Commands
// ============================================================================

#[tauri::command]
async fn rename_field_cmd(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("UPDATE fields SET name = ? WHERE id = ?")
        .bind(&name)
        .bind(&id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn rename_chapter_cmd(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("UPDATE chapters SET name = ? WHERE id = ?")
        .bind(&name)
        .bind(&id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn rename_section_cmd(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("UPDATE sections SET name = ? WHERE id = ?")
        .bind(&name)
        .bind(&id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn rename_subsection_cmd(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("UPDATE subsections SET name = ? WHERE id = ?")
        .bind(&name)
        .bind(&id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn create_file_type_cmd(
    state: State<'_, AppState>,
    name: String,
) -> Result<serde_json::Value, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO file_types (id, name) VALUES (?, ?)")
        .bind(&id)
        .bind(&name)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({"id": id, "name": name}))
}

#[tauri::command]
async fn create_exercise_type_cmd(
    state: State<'_, AppState>,
    name: String,
) -> Result<serde_json::Value, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO exercise_types (id, name) VALUES (?, ?)")
        .bind(&id)
        .bind(&name)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({"id": id, "name": name}))
}

// ============================================================================
// FileType and ExerciseType Rename/Delete Commands
// ============================================================================

#[tauri::command]
async fn rename_file_type_cmd(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("UPDATE file_types SET name = ? WHERE id = ?")
        .bind(&name)
        .bind(&id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn delete_file_type_cmd(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("DELETE FROM file_types WHERE id = ?")
        .bind(&id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn rename_exercise_type_cmd(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("UPDATE exercise_types SET name = ? WHERE id = ?")
        .bind(&name)
        .bind(&id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn delete_exercise_type_cmd(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("DELETE FROM exercise_types WHERE id = ?")
        .bind(&id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================================
// Document Types CRUD Commands
// ============================================================================

#[tauri::command]
async fn get_document_types_cmd(
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let rows = sqlx::query("SELECT id, name, description FROM document_types ORDER BY name")
        .fetch_all(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    let results: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            serde_json::json!({
                "id": row.try_get::<String, _>("id").unwrap_or_default(),
                "name": row.try_get::<String, _>("name").unwrap_or_default(),
                "description": row.try_get::<String, _>("description").ok()
            })
        })
        .collect();

    Ok(results)
}

#[tauri::command]
async fn create_document_type_cmd(
    state: State<'_, AppState>,
    name: String,
) -> Result<serde_json::Value, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO document_types (id, name) VALUES (?, ?)")
        .bind(&id)
        .bind(&name)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({"id": id, "name": name}))
}

#[tauri::command]
async fn rename_document_type_cmd(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("UPDATE document_types SET name = ? WHERE id = ?")
        .bind(&name)
        .bind(&id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn delete_document_type_cmd(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("DELETE FROM document_types WHERE id = ?")
        .bind(&id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn create_package_topic_cmd(
    state: State<'_, AppState>,
    name: String,
) -> Result<serde_json::Value, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO package_topics (id, name) VALUES (?, ?)")
        .bind(&id)
        .bind(&name)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({"id": id, "name": name}))
}

#[tauri::command]
async fn create_macro_command_type_cmd(
    state: State<'_, AppState>,
    name: String,
) -> Result<serde_json::Value, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO macro_command_types (id, name) VALUES (?, ?)")
        .bind(&id)
        .bind(&name)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({"id": id, "name": name}))
}

#[tauri::command]
async fn get_chapters_cmd(
    state: State<'_, AppState>,
    field_id: Option<String>,
) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let mut chapters = Vec::new();

    if let Some(fid) = field_id {
        let rows =
            sqlx::query("SELECT id, name, field_id FROM chapters WHERE field_id = ? ORDER BY name")
                .bind(&fid)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;

        for row in rows {
            let id: String = row.get("id");
            let name: String = row.get("name");
            let field_id: String = row.get("field_id");
            chapters.push(serde_json::json!({"id": id, "name": name, "fieldId": field_id}));
        }
    } else {
        let rows = sqlx::query("SELECT id, name, field_id FROM chapters ORDER BY name")
            .fetch_all(&manager.pool)
            .await
            .map_err(|e| e.to_string())?;

        for row in rows {
            let id: String = row.get("id");
            let name: String = row.get("name");
            let field_id: String = row.get("field_id");
            chapters.push(serde_json::json!({"id": id, "name": name, "fieldId": field_id}));
        }
    }

    Ok(chapters)
}

#[tauri::command]
async fn get_sections_cmd(
    state: State<'_, AppState>,
    chapter_id: Option<String>,
) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let mut sections = Vec::new();

    if let Some(cid) = chapter_id {
        let rows = sqlx::query(
            "SELECT id, name, chapter_id FROM sections WHERE chapter_id = ? ORDER BY name",
        )
        .bind(&cid)
        .fetch_all(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

        for row in rows {
            let id: String = row.get("id");
            let name: String = row.get("name");
            let chapter_id: String = row.get("chapter_id");
            sections.push(serde_json::json!({"id": id, "name": name, "chapterId": chapter_id}));
        }
    } else {
        let rows = sqlx::query("SELECT id, name, chapter_id FROM sections ORDER BY name")
            .fetch_all(&manager.pool)
            .await
            .map_err(|e| e.to_string())?;

        for row in rows {
            let id: String = row.get("id");
            let name: String = row.get("name");
            let chapter_id: String = row.get("chapter_id");
            sections.push(serde_json::json!({"id": id, "name": name, "chapterId": chapter_id}));
        }
    }

    Ok(sections)
}

#[tauri::command]
async fn get_file_types_cmd(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let rows = sqlx::query(
        "SELECT id, name, folder_name, solvable, description FROM file_types ORDER BY name",
    )
    .fetch_all(&manager.pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut types = Vec::new();
    for row in rows {
        let id: String = row.get("id");
        let name: String = row.get("name");
        let folder_name: Option<String> = row.try_get("folder_name").ok();
        let solvable: Option<bool> = row.try_get("solvable").ok();
        let description: Option<String> = row.try_get("description").ok();
        types.push(serde_json::json!({
            "id": id,
            "name": name,
            "folderName": folder_name,
            "solvable": solvable,
            "description": description
        }));
    }
    Ok(types)
}

#[tauri::command]
async fn get_exercise_types_cmd(
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let rows = sqlx::query("SELECT id, name, description FROM exercise_types ORDER BY name")
        .fetch_all(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut types = Vec::new();
    for row in rows {
        let id: String = row.get("id");
        let name: String = row.get("name");
        let description: Option<String> = row.try_get("description").ok();
        types.push(serde_json::json!({"id": id, "name": name, "description": description}));
    }
    Ok(types)
}

#[tauri::command]
async fn get_table_types_cmd(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let rows = sqlx::query("SELECT id, name, description FROM table_types ORDER BY name")
        .fetch_all(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut types = Vec::new();
    for row in rows {
        let id: String = row.get("id");
        let name: String = row.get("name");
        let description: Option<String> = row.try_get("description").ok();
        types.push(serde_json::json!({"id": id, "name": name, "description": description}));
    }
    Ok(types)
}

#[tauri::command]
async fn create_table_type_cmd(
    state: State<'_, AppState>,
    name: String,
) -> Result<serde_json::Value, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let id = name.trim().to_lowercase().replace(" ", "_");

    sqlx::query("INSERT INTO table_types (id, name) VALUES (?, ?)")
        .bind(&id)
        .bind(&name)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({"id": id, "name": name}))
}

#[tauri::command]
async fn rename_table_type_cmd(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("UPDATE table_types SET name = ? WHERE id = ?")
        .bind(&name)
        .bind(&id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn delete_table_type_cmd(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("DELETE FROM table_types WHERE id = ?")
        .bind(&id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn get_figure_types_cmd(
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let rows = sqlx::query("SELECT id, name, description FROM figure_types ORDER BY name")
        .fetch_all(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut types = Vec::new();
    for row in rows {
        let id: String = row.get("id");
        let name: String = row.get("name");
        let description: Option<String> = row.try_get("description").ok();
        types.push(serde_json::json!({"id": id, "name": name, "description": description}));
    }
    Ok(types)
}

#[tauri::command]
async fn create_figure_type_cmd(
    state: State<'_, AppState>,
    name: String,
) -> Result<serde_json::Value, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let id = name.trim().to_lowercase().replace(" ", "_");

    sqlx::query("INSERT INTO figure_types (id, name) VALUES (?, ?)")
        .bind(&id)
        .bind(&name)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({"id": id, "name": name}))
}

#[tauri::command]
async fn rename_figure_type_cmd(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("UPDATE figure_types SET name = ? WHERE id = ?")
        .bind(&name)
        .bind(&id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn delete_figure_type_cmd(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("DELETE FROM figure_types WHERE id = ?")
        .bind(&id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn get_package_topics_cmd(
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let rows = sqlx::query("SELECT id, name, description FROM package_topics ORDER BY name")
        .fetch_all(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut topics = Vec::new();
    for row in rows {
        let id: String = row.get("id");
        let name: String = row.get("name");
        let description: Option<String> = row.try_get("description").ok();
        topics.push(serde_json::json!({"id": id, "name": name, "description": description}));
    }
    Ok(topics)
}

#[tauri::command]
async fn get_macro_command_types_cmd(
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let rows = sqlx::query("SELECT id, name, description FROM macro_command_types ORDER BY name")
        .fetch_all(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut types = Vec::new();
    for row in rows {
        let id: String = row.get("id");
        let name: String = row.get("name");
        let description: Option<String> = row.try_get("description").ok();
        types.push(serde_json::json!({"id": id, "name": name, "description": description}));
    }
    Ok(types)
}

#[tauri::command]
async fn get_command_types_cmd(
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let rows = sqlx::query("SELECT id, name, description FROM command_types ORDER BY name")
        .fetch_all(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut types = Vec::new();
    for row in rows {
        let id: String = row.get("id");
        let name: String = row.get("name");
        let description: Option<String> = row.try_get("description").ok();
        types.push(serde_json::json!({"id": id, "name": name, "description": description}));
    }
    Ok(types)
}

#[tauri::command]
async fn create_command_type_cmd(
    state: State<'_, AppState>,
    name: String,
) -> Result<serde_json::Value, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let id = name.trim().to_lowercase().replace(" ", "_");

    sqlx::query("INSERT INTO command_types (id, name) VALUES (?, ?)")
        .bind(&id)
        .bind(&name)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({"id": id, "name": name}))
}

#[tauri::command]
async fn rename_command_type_cmd(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("UPDATE command_types SET name = ? WHERE id = ?")
        .bind(&name)
        .bind(&id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn delete_command_type_cmd(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("DELETE FROM command_types WHERE id = ?")
        .bind(&id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================================
// Typed Metadata CRUD Commands (sqlx-based)
// ============================================================================

#[tauri::command]
async fn save_typed_metadata_cmd(
    state: State<'_, AppState>,
    resource_id: String,
    resource_type: String,
    metadata: serde_json::Value,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    match resource_type.as_str() {
        "file" => {
            // Parse metadata
            let file_type_id: Option<String> = metadata
                .get("fileTypeId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let field_id: Option<String> = metadata
                .get("fieldId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let difficulty: Option<i32> = metadata
                .get("difficulty")
                .and_then(|v| v.as_i64())
                .map(|n| n as i32);
            let solved_prooved: Option<bool> =
                metadata.get("solvedProoved").and_then(|v| v.as_bool());
            let build_command: Option<String> = metadata
                .get("buildCommand")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let file_description: Option<String> = metadata
                .get("fileDescription")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            // Insert or replace main record
            sqlx::query(
                "INSERT OR REPLACE INTO resource_files (resource_id, file_type_id, field_id, difficulty, solved_prooved, build_command, file_description)
                 VALUES (?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(&resource_id)
            .bind(&file_type_id)
            .bind(&field_id)
            .bind(difficulty)
            .bind(solved_prooved)
            .bind(&build_command)
            .bind(&file_description)
            .execute(&manager.pool)
            .await
            .map_err(|e| e.to_string())?;

            // Save chapters (junction table)
            if let Some(chapters) = metadata.get("chapters").and_then(|v| v.as_array()) {
                // Clear existing
                sqlx::query("DELETE FROM resource_file_chapters WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;

                for chapter in chapters {
                    if let Some(chapter_id) = chapter.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_file_chapters (resource_id, chapter_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(chapter_id)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Save sections
            if let Some(sections) = metadata.get("sections").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_file_sections WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;

                for section in sections {
                    if let Some(section_id) = section.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_file_sections (resource_id, section_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(section_id)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Save subsections
            if let Some(subsections) = metadata.get("subsections").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_file_subsections WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;

                for subsection in subsections {
                    if let Some(subsection_id) = subsection.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_file_subsections (resource_id, subsection_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(subsection_id)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Save exercise types
            if let Some(exercise_types) = metadata.get("exerciseTypes").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_file_exercise_types WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;

                for et in exercise_types {
                    if let Some(et_id) = et.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_file_exercise_types (resource_id, exercise_type_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(et_id)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Save custom tags
            if let Some(tags) = metadata.get("customTags").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_file_tags WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;

                for tag in tags {
                    if let Some(tag_str) = tag.as_str() {
                        // Ensure tag exists
                        sqlx::query("INSERT OR IGNORE INTO custom_tags (tag) VALUES (?)")
                            .bind(tag_str)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;

                        sqlx::query("INSERT OR IGNORE INTO resource_file_tags (resource_id, tag) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(tag_str)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }
        }
        "document" => {
            // Parse all document metadata fields
            let title: Option<String> = metadata
                .get("title")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let document_type_id: Option<String> = metadata
                .get("documentTypeId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let description: Option<String> = metadata
                .get("description")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let field_id: Option<String> = metadata
                .get("fieldId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let date: Option<String> = metadata
                .get("date")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let preamble_id: Option<String> = metadata
                .get("preambleId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let build_command: Option<String> = metadata
                .get("buildCommand")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let bibliography: Option<String> = metadata
                .get("bibliography")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let solution_document_id: Option<String> = metadata
                .get("solutionDocumentId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            // Insert or replace main document record (folder fields are optional now)
            sqlx::query(
                "INSERT OR REPLACE INTO resource_documents 
                 (resource_id, title, document_type_id, field_id, date, 
                  preamble_id, build_command, bibliography, description, solution_document_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&resource_id)
            .bind(&title)
            .bind(&document_type_id)
            .bind(&field_id)
            .bind(&date)
            .bind(&preamble_id)
            .bind(&build_command)
            .bind(&bibliography)
            .bind(&description)
            .bind(&solution_document_id)
            .execute(&manager.pool)
            .await
            .map_err(|e| e.to_string())?;

            // Save chapters (junction table)
            if let Some(chapters) = metadata.get("chapters").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_document_chapters WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;

                for chapter in chapters {
                    if let Some(chapter_id) = chapter.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_document_chapters (resource_id, chapter_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(chapter_id)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Save sections
            if let Some(sections) = metadata.get("sections").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_document_sections WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;

                for section in sections {
                    if let Some(section_id) = section.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_document_sections (resource_id, section_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(section_id)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Save subsections
            if let Some(subsections) = metadata.get("subsections").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_document_subsections WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;

                for subsection in subsections {
                    if let Some(subsection_id) = subsection.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_document_subsections (resource_id, subsection_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(subsection_id)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Save custom tags
            if let Some(tags) = metadata.get("customTags").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_document_tags WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;

                for tag in tags {
                    if let Some(tag_str) = tag.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO custom_tags (tag) VALUES (?)")
                            .bind(tag_str)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;

                        sqlx::query("INSERT OR IGNORE INTO resource_document_tags (resource_id, tag) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(tag_str)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }
        }
        "bibliography" => {
            // Helper to get string option
            let get_str = |key: &str| -> Option<String> {
                metadata
                    .get(key)
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            };

            // 1. Upsert into resource_bibliographies
            let exists: bool =
                sqlx::query("SELECT 1 FROM resource_bibliographies WHERE resource_id = ?")
                    .bind(&resource_id)
                    .fetch_optional(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?
                    .is_some();

            let stmt = if exists {
                "UPDATE resource_bibliographies SET 
                    entry_type=?, citation_key=?, journal=?, volume=?, series=?, number=?, issue=?,
                    year=?, month=?, publisher=?, edition=?, institution=?, school=?, organization=?,
                    address=?, location=?, isbn=?, issn=?, doi=?, url=?, language=?,
                    title=?, subtitle=?, booktitle=?, chapter=?, pages=?, abstract=?, note=?, crossref=?
                 WHERE resource_id=?"
            } else {
                "INSERT INTO resource_bibliographies (
                    entry_type, citation_key, journal, volume, series, number, issue,
                    year, month, publisher, edition, institution, school, organization,
                    address, location, isbn, issn, doi, url, language,
                    title, subtitle, booktitle, chapter, pages, abstract, note, crossref,
                    resource_id
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
            };

            sqlx::query(stmt)
                .bind(get_str("entryType"))
                .bind(get_str("citationKey"))
                .bind(get_str("journal"))
                .bind(get_str("volume"))
                .bind(get_str("series"))
                .bind(get_str("number"))
                .bind(get_str("issue"))
                .bind(get_str("year"))
                .bind(get_str("month"))
                .bind(get_str("publisher"))
                .bind(get_str("edition"))
                .bind(get_str("institution"))
                .bind(get_str("school"))
                .bind(get_str("organization"))
                .bind(get_str("address"))
                .bind(get_str("location"))
                .bind(get_str("isbn"))
                .bind(get_str("issn"))
                .bind(get_str("doi"))
                .bind(get_str("url"))
                .bind(get_str("language"))
                .bind(get_str("title"))
                .bind(get_str("subtitle"))
                .bind(get_str("booktitle"))
                .bind(get_str("chapter"))
                .bind(get_str("pages"))
                .bind(get_str("abstract"))
                .bind(get_str("note"))
                .bind(get_str("crossref"))
                .bind(&resource_id)
                .execute(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;

            // 2. Handle Persons
            sqlx::query("DELETE FROM resource_bibliography_persons WHERE resource_id = ?")
                .bind(&resource_id)
                .execute(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;

            let roles = vec![
                ("authors", "author"),
                ("editors", "editor"),
                ("translators", "translator"),
            ];
            for (key, role) in roles {
                if let Some(list) = metadata.get(key).and_then(|v| v.as_array()) {
                    for (pos, person) in list.iter().enumerate() {
                        if let Some(name) = person.as_str() {
                            if !name.trim().is_empty() {
                                sqlx::query("INSERT INTO resource_bibliography_persons (resource_id, role, full_name, position) VALUES (?, ?, ?, ?)")
                                    .bind(&resource_id)
                                    .bind(role)
                                    .bind(name)
                                    .bind(pos as i32)
                                    .execute(&manager.pool)
                                    .await
                                    .map_err(|e| e.to_string())?;
                            }
                        }
                    }
                }
            }

            // 3. Handle Extras
            sqlx::query("DELETE FROM resource_bibliography_extras WHERE resource_id = ?")
                .bind(&resource_id)
                .execute(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;

            if let Some(extras) = metadata.get("extras").and_then(|v| v.as_object()) {
                for (k, v) in extras {
                    if let Some(val_str) = v.as_str() {
                        sqlx::query("INSERT INTO resource_bibliography_extras (resource_id, \"key\", value) VALUES (?, ?, ?)")
                            .bind(&resource_id)
                            .bind(k)
                            .bind(val_str)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }
        }
        "figure" => {
            let get_str = |key: &str| -> Option<String> {
                metadata
                    .get(key)
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            };

            let exists: bool = sqlx::query("SELECT 1 FROM resource_figures WHERE resource_id = ?")
                .bind(&resource_id)
                .fetch_optional(&manager.pool)
                .await
                .map_err(|e| e.to_string())?
                .is_some();

            let stmt = if exists {
                "UPDATE resource_figures SET 
                    figure_type_id=?, environment=?, caption=?, description=?, 
                    width=?, height=?, options=?, tikz_style=?, label=?, placement=?, alignment=?
                 WHERE resource_id=?"
            } else {
                "INSERT INTO resource_figures (
                    figure_type_id, environment, caption, description,
                    width, height, options, tikz_style, label, placement, alignment,
                    resource_id
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
            };

            sqlx::query(stmt)
                .bind(get_str("figureTypeId"))
                .bind(get_str("environment"))
                .bind(get_str("caption"))
                .bind(get_str("description"))
                .bind(get_str("width"))
                .bind(get_str("height"))
                .bind(get_str("options"))
                .bind(get_str("tikzStyle"))
                .bind(get_str("label"))
                .bind(get_str("placement"))
                .bind(get_str("alignment"))
                .bind(&resource_id)
                .execute(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;

            // Packages
            if let Some(packages) = metadata.get("requiredPackages").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_figure_packages WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;

                for pkg in packages {
                    if let Some(pkg_id) = pkg.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_figure_packages (resource_id, package_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(pkg_id)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Tags
            if let Some(tags) = metadata.get("customTags").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_figure_tags WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;

                for tag in tags {
                    if let Some(tag_str) = tag.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO custom_tags (tag) VALUES (?)")
                            .bind(tag_str)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;

                        sqlx::query("INSERT OR IGNORE INTO resource_figure_tags (resource_id, tag) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(tag_str)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }
        }

        "command" => {
            let name: Option<String> = metadata
                .get("name")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let command_type_id: Option<String> = metadata
                .get("commandTypeId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let arguments_num: Option<i64> = metadata.get("argumentsNum").and_then(|v| v.as_i64());
            let optional_argument: Option<String> = metadata
                .get("optionalArgument")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let content: Option<String> = metadata
                .get("content")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let example: Option<String> = metadata
                .get("example")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let description: Option<String> = metadata
                .get("description")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let built_in: Option<bool> = metadata.get("builtIn").and_then(|v| v.as_bool());

            let exists: bool = sqlx::query("SELECT 1 FROM resource_commands WHERE resource_id = ?")
                .bind(&resource_id)
                .fetch_optional(&manager.pool)
                .await
                .map_err(|e| e.to_string())?
                .is_some();

            if exists {
                sqlx::query("UPDATE resource_commands SET name=?, command_type_id=?, arguments_num=?, optional_argument=?, content=?, example=?, description=?, built_in=? WHERE resource_id=?")
                    .bind(&name)
                    .bind(&command_type_id)
                    .bind(arguments_num)
                    .bind(&optional_argument)
                    .bind(&content)
                    .bind(&example)
                    .bind(&description)
                    .bind(built_in)
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;
            } else {
                sqlx::query("INSERT INTO resource_commands (resource_id, name, command_type_id, arguments_num, optional_argument, content, example, description, built_in) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
                     .bind(&resource_id)
                     .bind(&name)
                     .bind(&command_type_id)
                     .bind(arguments_num)
                     .bind(&optional_argument)
                     .bind(&content)
                     .bind(&example)
                     .bind(&description)
                     .bind(built_in)
                     .execute(&manager.pool)
                     .await
                     .map_err(|e| e.to_string())?;
            }

            // Tags
            if let Some(tags) = metadata.get("customTags").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_command_tags WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;
                for tag in tags {
                    if let Some(tag_str) = tag.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO custom_tags (tag) VALUES (?)")
                            .bind(tag_str)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                        sqlx::query("INSERT OR IGNORE INTO resource_command_tags (resource_id, tag) VALUES (?, ?)").bind(&resource_id).bind(tag_str).execute(&manager.pool).await.map_err(|e| e.to_string())?;
                    }
                }
            }
            // Packages
            if let Some(packages) = metadata.get("requiredPackages").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_command_packages WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;
                for pkg in packages {
                    if let Some(pkg_id) = pkg.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_command_packages (resource_id, package_id) VALUES (?, ?)").bind(&resource_id).bind(pkg_id).execute(&manager.pool).await.map_err(|e| e.to_string())?;
                    }
                }
            }
        }
        "table" => {
            // Helper to get string option
            let get_str = |key: &str| -> Option<String> {
                metadata
                    .get(key)
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            };
            // Helper to get int option
            let get_int = |key: &str| -> Option<i64> { metadata.get(key).and_then(|v| v.as_i64()) };

            let exists: bool = sqlx::query("SELECT 1 FROM resource_tables WHERE resource_id = ?")
                .bind(&resource_id)
                .fetch_optional(&manager.pool)
                .await
                .map_err(|e| e.to_string())?
                .is_some();

            let stmt = if exists {
                "UPDATE resource_tables SET 
                    table_type_id=?, date=?, caption=?, description=?, 
                    environment=?, placement=?, label=?, width=?, alignment=?,
                    rows=?, columns=?
                 WHERE resource_id=?"
            } else {
                "INSERT INTO resource_tables (
                    table_type_id, date, caption, description,
                    environment, placement, label, width, alignment,
                    rows, columns,
                    resource_id
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
            };

            sqlx::query(stmt)
                .bind(get_str("tableTypeId"))
                .bind(get_str("date"))
                .bind(get_str("caption"))
                .bind(get_str("description"))
                .bind(get_str("environment"))
                .bind(get_str("placement"))
                .bind(get_str("label"))
                .bind(get_str("width"))
                .bind(get_str("alignment"))
                .bind(get_int("rows"))
                .bind(get_int("columns"))
                .bind(&resource_id)
                .execute(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;

            // Save required packages
            if let Some(packages) = metadata.get("requiredPackages").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_table_packages WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;

                for pkg in packages {
                    if let Some(pkg_id) = pkg.as_str() {
                        // Ensure package exists (simple heuristic for now or strict FK)
                        // Assuming texlive_packages are pre-populated or we ignore errors?
                        // Actually FK constraint ON DELETE CASCADE usually implies strict.
                        // For now we assume package_id is valid or we insert it?
                        // Usually packages are selected from a list.
                        sqlx::query("INSERT OR IGNORE INTO resource_table_packages (resource_id, package_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(pkg_id)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Save custom tags
            if let Some(tags) = metadata.get("customTags").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_table_tags WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;

                for tag in tags {
                    if let Some(tag_str) = tag.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO custom_tags (tag) VALUES (?)")
                            .bind(tag_str)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;

                        sqlx::query("INSERT OR IGNORE INTO resource_table_tags (resource_id, tag) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(tag_str)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }
        }
        "package" => {
            let get_str = |key: &str| -> Option<String> {
                metadata
                    .get(key)
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            };
            let get_bool =
                |key: &str| -> Option<bool> { metadata.get(key).and_then(|v| v.as_bool()) };

            let exists: bool = sqlx::query("SELECT 1 FROM resource_packages WHERE resource_id = ?")
                .bind(&resource_id)
                .fetch_optional(&manager.pool)
                .await
                .map_err(|e| e.to_string())?
                .is_some();

            if exists {
                sqlx::query(
                    "UPDATE resource_packages SET 
                     name=?, topic_id=?, date=?, content=?, description=?, 
                     options=?, built_in=?, documentation=?, example=? 
                     WHERE resource_id=?",
                )
                .bind(get_str("name"))
                .bind(get_str("topicId"))
                .bind(get_str("date"))
                .bind(get_str("content"))
                .bind(get_str("description"))
                .bind(get_str("options"))
                .bind(get_bool("builtIn"))
                .bind(get_str("documentation"))
                .bind(get_str("example"))
                .bind(&resource_id)
                .execute(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
            } else {
                sqlx::query(
                    "INSERT INTO resource_packages (
                     name, topic_id, date, content, description, 
                     options, built_in, documentation, example, resource_id
                     ) VALUES (?,?,?,?,?,?,?,?,?,?)",
                )
                .bind(get_str("name"))
                .bind(get_str("topicId"))
                .bind(get_str("date"))
                .bind(get_str("content"))
                .bind(get_str("description"))
                .bind(get_str("options"))
                .bind(get_bool("builtIn"))
                .bind(get_str("documentation"))
                .bind(get_str("example"))
                .bind(&resource_id)
                .execute(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
            }

            // Junctions

            // Custom Tags
            if let Some(tags) = metadata.get("customTags").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_package_tags WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;
                for tag in tags {
                    if let Some(tag_str) = tag.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO custom_tags (tag) VALUES (?)")
                            .bind(tag_str)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                        sqlx::query("INSERT OR IGNORE INTO resource_package_tags (resource_id, tag) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(tag_str)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Provided Commands
            if let Some(cmds) = metadata.get("providedCommands").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_package_provided_commands WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;
                for cmd in cmds {
                    if let Some(cmd_str) = cmd.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_package_provided_commands (resource_id, command_name) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(cmd_str)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Topics (Related Topics)
            if let Some(topics) = metadata.get("topics").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_package_topics WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;
                for topic in topics {
                    if let Some(topic_id) = topic.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_package_topics (resource_id, topic_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(topic_id)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Dependencies (Required Packages)
            if let Some(deps) = metadata.get("requiredPackages").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_package_dependencies WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;
                for dep in deps {
                    if let Some(dep_id) = dep.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_package_dependencies (resource_id, package_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(dep_id)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }
        }
        "class" => {
            let get_str = |key: &str| -> Option<String> {
                metadata
                    .get(key)
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            };
            let get_int = |key: &str| -> Option<i64> { metadata.get(key).and_then(|v| v.as_i64()) };

            let exists: bool = sqlx::query("SELECT 1 FROM resource_classes WHERE resource_id = ?")
                .bind(&resource_id)
                .fetch_optional(&manager.pool)
                .await
                .map_err(|e| e.to_string())?
                .is_some();

            if exists {
                sqlx::query(
                    "UPDATE resource_classes SET 
                     name=?, file_type_id=?, date=?, content=?, description=?, 
                     engines=?, paper_size=?, font_size=?, geometry=?, options=?, languages=? 
                     WHERE resource_id=?",
                )
                .bind(get_str("name"))
                .bind(get_str("fileTypeId"))
                .bind(get_str("date"))
                .bind(get_str("content"))
                .bind(get_str("description"))
                .bind(get_str("engines"))
                .bind(get_str("paperSize"))
                .bind(get_int("fontSize"))
                .bind(get_str("geometry"))
                .bind(get_str("options"))
                .bind(get_str("languages"))
                .bind(&resource_id)
                .execute(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
            } else {
                sqlx::query(
                    "INSERT INTO resource_classes (
                     name, file_type_id, date, content, description, 
                     engines, paper_size, font_size, geometry, options, languages, resource_id
                     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                )
                .bind(get_str("name"))
                .bind(get_str("fileTypeId"))
                .bind(get_str("date"))
                .bind(get_str("content"))
                .bind(get_str("description"))
                .bind(get_str("engines"))
                .bind(get_str("paperSize"))
                .bind(get_int("fontSize"))
                .bind(get_str("geometry"))
                .bind(get_str("options"))
                .bind(get_str("languages"))
                .bind(&resource_id)
                .execute(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
            }

            // Junctions

            // Custom Tags
            if let Some(tags) = metadata.get("customTags").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_class_tags WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;
                for tag in tags {
                    if let Some(tag_str) = tag.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO custom_tags (tag) VALUES (?)")
                            .bind(tag_str)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                        sqlx::query("INSERT OR IGNORE INTO resource_class_tags (resource_id, tag) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(tag_str)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Required Packages
            if let Some(pkgs) = metadata.get("requiredPackages").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_class_packages WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;
                for pkg in pkgs {
                    if let Some(pkg_id) = pkg.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_class_packages (resource_id, package_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(pkg_id)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Provided Commands
            if let Some(cmds) = metadata.get("providedCommands").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_class_provided_commands WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;
                for cmd in cmds {
                    if let Some(cmd_str) = cmd.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_class_provided_commands (resource_id, command_name) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(cmd_str)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }
        }
        "preamble" => {
            let get_str = |key: &str| -> Option<String> {
                metadata
                    .get(key)
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            };
            let get_int = |key: &str| -> Option<i64> { metadata.get(key).and_then(|v| v.as_i64()) };
            let get_bool =
                |key: &str| -> Option<bool> { metadata.get(key).and_then(|v| v.as_bool()) };

            let exists: bool =
                sqlx::query("SELECT 1 FROM resource_preambles WHERE resource_id = ?")
                    .bind(&resource_id)
                    .fetch_optional(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?
                    .is_some();

            if exists {
                sqlx::query(
                    "UPDATE resource_preambles SET 
                     name=?, preamble_type_id=?, content=?, description=?, built_in=?,
                     engines=?, date=?, class=?, paper_size=?, font_size=?, options=?, languages=?, 
                     geometry=?, author=?, title=?, 
                     use_bibliography=?, bib_compile_engine=?, make_index=?, make_glossaries=?, 
                     has_toc=?, has_lot=?, has_lof=?
                     WHERE resource_id=?",
                )
                .bind(get_str("name"))
                .bind(get_str("preambleTypeId"))
                .bind(get_str("content"))
                .bind(get_str("description"))
                .bind(get_bool("builtIn"))
                .bind(get_str("engines"))
                .bind(get_str("date"))
                .bind(get_str("class"))
                .bind(get_str("paperSize"))
                .bind(get_int("fontSize"))
                .bind(get_str("options"))
                .bind(get_str("languages"))
                .bind(get_str("geometry"))
                .bind(get_str("author"))
                .bind(get_str("title"))
                .bind(get_bool("useBibliography"))
                .bind(get_str("bibCompileEngine"))
                .bind(get_bool("makeIndex"))
                .bind(get_bool("makeGlossaries"))
                .bind(get_bool("hasToc"))
                .bind(get_bool("hasLot"))
                .bind(get_bool("hasLof"))
                .bind(&resource_id)
                .execute(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
            } else {
                sqlx::query(
                    "INSERT INTO resource_preambles (
                     name, preamble_type_id, content, description, built_in,
                     engines, date, class, paper_size, font_size, options, languages,
                     geometry, author, title,
                     use_bibliography, bib_compile_engine, make_index, make_glossaries,
                     has_toc, has_lot, has_lof, resource_id
                     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                )
                .bind(get_str("name"))
                .bind(get_str("preambleTypeId"))
                .bind(get_str("content"))
                .bind(get_str("description"))
                .bind(get_bool("builtIn"))
                .bind(get_str("engines"))
                .bind(get_str("date"))
                .bind(get_str("class"))
                .bind(get_str("paperSize"))
                .bind(get_int("fontSize"))
                .bind(get_str("options"))
                .bind(get_str("languages"))
                .bind(get_str("geometry"))
                .bind(get_str("author"))
                .bind(get_str("title"))
                .bind(get_bool("useBibliography"))
                .bind(get_str("bibCompileEngine"))
                .bind(get_bool("makeIndex"))
                .bind(get_bool("makeGlossaries"))
                .bind(get_bool("hasToc"))
                .bind(get_bool("hasLot"))
                .bind(get_bool("hasLof"))
                .bind(&resource_id)
                .execute(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
            }

            // Junctions

            // Required Packages
            if let Some(pkgs) = metadata.get("requiredPackages").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_preamble_packages WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;
                for pkg in pkgs {
                    if let Some(pkg_id) = pkg.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_preamble_packages (resource_id, package_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(pkg_id)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Command Types
            if let Some(ctypes) = metadata.get("commandTypes").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_preamble_command_types WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;
                for ctype in ctypes {
                    if let Some(ctype_id) = ctype.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_preamble_command_types (resource_id, command_type_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(ctype_id)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Provided Commands
            if let Some(cmds) = metadata.get("providedCommands").and_then(|v| v.as_array()) {
                sqlx::query(
                    "DELETE FROM resource_preamble_provided_commands WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .execute(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                for cmd in cmds {
                    if let Some(cmd_str) = cmd.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_preamble_provided_commands (resource_id, command_name) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(cmd_str)
                            .execute(&manager.pool)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }
        }
        "dtx" => {
            let get_str = |key: &str| -> Option<String> {
                metadata
                    .get(key)
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            };

            let exists: bool = sqlx::query("SELECT 1 FROM resource_dtx WHERE resource_id = ?")
                .bind(&resource_id)
                .fetch_optional(&manager.pool)
                .await
                .map_err(|e| e.to_string())?
                .is_some();

            if exists {
                sqlx::query(
                    "UPDATE resource_dtx SET 
                     base_name=?, version=?, date=?, description=?, 
                     provides_classes=?, provides_packages=?, documentation_checksum=?
                     WHERE resource_id=?",
                )
                .bind(get_str("baseName"))
                .bind(get_str("version"))
                .bind(get_str("date"))
                .bind(get_str("description"))
                .bind(metadata.get("providesClasses").map(|v| v.to_string()))
                .bind(metadata.get("providesPackages").map(|v| v.to_string()))
                .bind(get_str("documentationChecksum"))
                .bind(&resource_id)
                .execute(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
            } else {
                sqlx::query(
                    "INSERT INTO resource_dtx (
                     base_name, version, date, description, 
                     provides_classes, provides_packages, documentation_checksum,
                     resource_id
                     ) VALUES (?,?,?,?,?,?,?,?)",
                )
                .bind(get_str("baseName"))
                .bind(get_str("version"))
                .bind(get_str("date"))
                .bind(get_str("description"))
                .bind(metadata.get("providesClasses").map(|v| v.to_string()))
                .bind(metadata.get("providesPackages").map(|v| v.to_string()))
                .bind(get_str("documentationChecksum"))
                .bind(&resource_id)
                .execute(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
            }
        }
        "ins" => {
            let get_str = |key: &str| -> Option<String> {
                metadata
                    .get(key)
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            };

            let exists: bool = sqlx::query("SELECT 1 FROM resource_ins WHERE resource_id = ?")
                .bind(&resource_id)
                .fetch_optional(&manager.pool)
                .await
                .map_err(|e| e.to_string())?
                .is_some();

            if exists {
                sqlx::query(
                    "UPDATE resource_ins SET 
                     target_dtx_id=?, generated_files=?
                     WHERE resource_id=?",
                )
                .bind(get_str("targetDtxId"))
                .bind(metadata.get("generatedFiles").map(|v| v.to_string()))
                .bind(&resource_id)
                .execute(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
            } else {
                sqlx::query(
                    "INSERT INTO resource_ins (
                     target_dtx_id, generated_files, resource_id
                     ) VALUES (?,?,?)",
                )
                .bind(get_str("targetDtxId"))
                .bind(metadata.get("generatedFiles").map(|v| v.to_string()))
                .bind(&resource_id)
                .execute(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
            }
        }

        _ => {}
    }

    Ok(())
}

#[tauri::command]
async fn load_typed_metadata_cmd(
    state: State<'_, AppState>,
    resource_id: String,
    resource_type: String,
) -> Result<Option<serde_json::Value>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    match resource_type.as_str() {
        "file" => {
            // Load main record
            let main_row = sqlx::query(
                "SELECT file_type_id, field_id, difficulty, solved_prooved, build_command, file_description
                 FROM resource_files WHERE resource_id = ?"
            )
            .bind(&resource_id)
            .fetch_optional(&manager.pool)
            .await
            .map_err(|e| e.to_string())?;

            if let Some(row) = main_row {
                let file_type_id: Option<String> = row.try_get("file_type_id").ok();
                let field_id: Option<String> = row.try_get("field_id").ok();
                let difficulty: Option<i32> = row.try_get("difficulty").ok();
                let solved_prooved: Option<bool> = row.try_get("solved_prooved").ok();
                let build_command: Option<String> = row.try_get("build_command").ok();
                let file_description: Option<String> = row.try_get("file_description").ok();

                // Load chapters
                let chapter_rows = sqlx::query(
                    "SELECT chapter_id FROM resource_file_chapters WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let chapters: Vec<String> =
                    chapter_rows.iter().map(|r| r.get("chapter_id")).collect();

                // Load sections
                let section_rows = sqlx::query(
                    "SELECT section_id FROM resource_file_sections WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let sections: Vec<String> =
                    section_rows.iter().map(|r| r.get("section_id")).collect();

                // Load subsections
                let subsection_rows = sqlx::query(
                    "SELECT subsection_id FROM resource_file_subsections WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let subsections: Vec<String> = subsection_rows
                    .iter()
                    .map(|r| r.get("subsection_id"))
                    .collect();

                // Load exercise types
                let et_rows = sqlx::query("SELECT exercise_type_id FROM resource_file_exercise_types WHERE resource_id = ?")
                    .bind(&resource_id)
                    .fetch_all(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;
                let exercise_types: Vec<String> =
                    et_rows.iter().map(|r| r.get("exercise_type_id")).collect();

                // Load custom tags
                let tag_rows =
                    sqlx::query("SELECT tag FROM resource_file_tags WHERE resource_id = ?")
                        .bind(&resource_id)
                        .fetch_all(&manager.pool)
                        .await
                        .map_err(|e| e.to_string())?;
                let custom_tags: Vec<String> = tag_rows.iter().map(|r| r.get("tag")).collect();

                return Ok(Some(serde_json::json!({
                    "fileTypeId": file_type_id,
                    "fieldId": field_id,
                    "difficulty": difficulty,
                    "solvedProoved": solved_prooved,
                    "buildCommand": build_command,
                    "fileDescription": file_description,
                    "chapters": if chapters.is_empty() { None } else { Some(chapters) },
                    "sections": if sections.is_empty() { None } else { Some(sections) },
                    "subsections": if subsections.is_empty() { None } else { Some(subsections) },
                    "exerciseTypes": if exercise_types.is_empty() { None } else { Some(exercise_types) },
                    "customTags": if custom_tags.is_empty() { None } else { Some(custom_tags) }
                })));
            }
        }
        "document" => {
            let main_row = sqlx::query(
                "SELECT title, document_type_id, description, field_id, date, preamble_id, 
                        build_command, bibliography, solution_document_id 
                 FROM resource_documents WHERE resource_id = ?",
            )
            .bind(&resource_id)
            .fetch_optional(&manager.pool)
            .await
            .map_err(|e| e.to_string())?;

            if let Some(row) = main_row {
                // Fetch chapters
                let chapter_rows = sqlx::query(
                    "SELECT chapter_id FROM resource_document_chapters WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let chapters: Vec<String> = chapter_rows
                    .iter()
                    .filter_map(|r| r.try_get("chapter_id").ok())
                    .collect();

                // Fetch sections
                let section_rows = sqlx::query(
                    "SELECT section_id FROM resource_document_sections WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let sections: Vec<String> = section_rows
                    .iter()
                    .filter_map(|r| r.try_get("section_id").ok())
                    .collect();

                // Fetch subsections
                let subsection_rows = sqlx::query(
                    "SELECT subsection_id FROM resource_document_subsections WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let subsections: Vec<String> = subsection_rows
                    .iter()
                    .filter_map(|r| r.try_get("subsection_id").ok())
                    .collect();

                // Fetch custom tags
                let tag_rows =
                    sqlx::query("SELECT tag FROM resource_document_tags WHERE resource_id = ?")
                        .bind(&resource_id)
                        .fetch_all(&manager.pool)
                        .await
                        .map_err(|e| e.to_string())?;
                let custom_tags: Vec<String> = tag_rows
                    .iter()
                    .filter_map(|r| r.try_get("tag").ok())
                    .collect();

                return Ok(Some(serde_json::json!({
                    "title": row.try_get::<String, _>("title").ok(),
                    "documentTypeId": row.try_get::<String, _>("document_type_id").ok(),
                    "description": row.try_get::<String, _>("description").ok(),
                    "fieldId": row.try_get::<String, _>("field_id").ok(),
                    "date": row.try_get::<String, _>("date").ok(),
                    "preambleId": row.try_get::<String, _>("preamble_id").ok(),
                    "buildCommand": row.try_get::<String, _>("build_command").ok(),
                    "bibliography": row.try_get::<String, _>("bibliography").ok(),
                    "solutionDocumentId": row.try_get::<String, _>("solution_document_id").ok(),
                    "chapters": if chapters.is_empty() { None } else { Some(chapters) },
                    "sections": if sections.is_empty() { None } else { Some(sections) },
                    "subsections": if subsections.is_empty() { None } else { Some(subsections) },
                    "customTags": if custom_tags.is_empty() { None } else { Some(custom_tags) }
                })));
            }
        }

        "bibliography" => {
            // 1. Load Main Fields
            let main_row =
                sqlx::query("SELECT * FROM resource_bibliographies WHERE resource_id = ?")
                    .bind(&resource_id)
                    .fetch_optional(&manager.pool)
                    .await
                    .map_err(|e| e.to_string())?;

            if let Some(row) = main_row {
                // 2. Load Persons
                let person_rows = sqlx::query(
                     "SELECT role, full_name FROM resource_bibliography_persons WHERE resource_id = ? ORDER BY position"
                 )
                 .bind(&resource_id)
                 .fetch_all(&manager.pool)
                 .await
                 .map_err(|e| e.to_string())?;

                let mut authors = Vec::new();
                let mut editors = Vec::new();
                let mut translators = Vec::new();

                for p in person_rows {
                    let role: String = p.try_get("role").unwrap_or_default();
                    let name: String = p.try_get("full_name").unwrap_or_default();
                    match role.as_str() {
                        "author" => authors.push(name),
                        "editor" => editors.push(name),
                        "translator" => translators.push(name),
                        _ => {}
                    }
                }

                // 3. Load Extras
                let extra_rows = sqlx::query(
                    "SELECT \"key\", value FROM resource_bibliography_extras WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;

                let mut extras_map = serde_json::Map::new();
                for ex in extra_rows {
                    let key: String = ex.try_get("key").unwrap_or_default();
                    let val: String = ex.try_get("value").unwrap_or_default();
                    extras_map.insert(key, serde_json::Value::String(val));
                }

                return Ok(Some(serde_json::json!({
                    "entryType": row.try_get::<String, _>("entry_type").ok(),
                    "citationKey": row.try_get::<String, _>("citation_key").ok(),
                    "journal": row.try_get::<String, _>("journal").ok(),
                    "volume": row.try_get::<String, _>("volume").ok(),
                    "series": row.try_get::<String, _>("series").ok(),
                    "number": row.try_get::<String, _>("number").ok(),
                    "issue": row.try_get::<String, _>("issue").ok(),
                    "year": row.try_get::<String, _>("year").ok(),
                    "month": row.try_get::<String, _>("month").ok(),
                    "publisher": row.try_get::<String, _>("publisher").ok(),
                    "edition": row.try_get::<String, _>("edition").ok(),
                    "institution": row.try_get::<String, _>("institution").ok(),
                    "school": row.try_get::<String, _>("school").ok(),
                    "organization": row.try_get::<String, _>("organization").ok(),
                    "address": row.try_get::<String, _>("address").ok(),
                    "location": row.try_get::<String, _>("location").ok(),
                    "isbn": row.try_get::<String, _>("isbn").ok(),
                    "issn": row.try_get::<String, _>("issn").ok(),
                    "doi": row.try_get::<String, _>("doi").ok(),
                    "url": row.try_get::<String, _>("url").ok(),
                    "language": row.try_get::<String, _>("language").ok(),
                    "title": row.try_get::<String, _>("title").ok(),
                    "subtitle": row.try_get::<String, _>("subtitle").ok(),
                    "booktitle": row.try_get::<String, _>("booktitle").ok(),
                    "chapter": row.try_get::<String, _>("chapter").ok(),
                    "pages": row.try_get::<String, _>("pages").ok(),
                    "abstract": row.try_get::<String, _>("abstract").ok(),
                    "note": row.try_get::<String, _>("note").ok(),
                    "crossref": row.try_get::<String, _>("crossref").ok(),
                    "authors": if authors.is_empty() { None } else { Some(authors) },
                    "editors": if editors.is_empty() { None } else { Some(editors) },
                    "translators": if translators.is_empty() { None } else { Some(translators) },
                    "extras": if extras_map.is_empty() { None } else { Some(extras_map) }
                })));
            } else {
                // Fallback if no specific record found? Return empty or basic?
                return Ok(None);
            }
        }
        "figure" => {
            let main_row = sqlx::query("SELECT * FROM resource_figures WHERE resource_id = ?")
                .bind(&resource_id)
                .fetch_optional(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;

            if let Some(row) = main_row {
                // Packages
                let pkg_rows = sqlx::query(
                    "SELECT package_id FROM resource_figure_packages WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let packages: Vec<String> = pkg_rows.iter().map(|r| r.get("package_id")).collect();

                // Tags
                let tag_rows =
                    sqlx::query("SELECT tag FROM resource_figure_tags WHERE resource_id = ?")
                        .bind(&resource_id)
                        .fetch_all(&manager.pool)
                        .await
                        .map_err(|e| e.to_string())?;
                let custom_tags: Vec<String> = tag_rows.iter().map(|r| r.get("tag")).collect();

                return Ok(Some(serde_json::json!({
                    "figureTypeId": row.try_get::<String, _>("figure_type_id").ok(),
                    "environment": row.try_get::<String, _>("environment").ok(),
                    "caption": row.try_get::<String, _>("caption").ok(),
                    "description": row.try_get::<String, _>("description").ok(),
                    "width": row.try_get::<String, _>("width").ok(),
                    "height": row.try_get::<String, _>("height").ok(),
                    "options": row.try_get::<String, _>("options").ok(),
                    "tikzStyle": row.try_get::<String, _>("tikz_style").ok(),
                    "label": row.try_get::<String, _>("label").ok(),
                    "placement": row.try_get::<String, _>("placement").ok(),
                    "alignment": row.try_get::<String, _>("alignment").ok(),
                    "requiredPackages": if packages.is_empty() { None } else { Some(packages) },
                    "customTags": if custom_tags.is_empty() { None } else { Some(custom_tags) }
                })));
            }
        }

        "command" => {
            let row = sqlx::query(
                "SELECT name, command_type_id, arguments_num, optional_argument, content, example, description, built_in 
                 FROM resource_commands WHERE resource_id = ?"
            )
            .bind(&resource_id)
            .fetch_optional(&manager.pool)
            .await
            .map_err(|e| e.to_string())?;

            if let Some(r) = row {
                let name: String = r.get("name");
                let command_type_id: Option<String> = r.try_get("command_type_id").ok();
                let arguments_num: Option<i32> = r.try_get("arguments_num").ok();
                let optional_argument: Option<String> = r.try_get("optional_argument").ok();
                let content: Option<String> = r.try_get("content").ok();
                let example: Option<String> = r.try_get("example").ok();
                let description: Option<String> = r.try_get("description").ok();
                let built_in: Option<bool> = r.try_get("built_in").ok();

                // Packages
                let package_rows = sqlx::query(
                    "SELECT package_id FROM resource_command_packages WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let packages: Vec<String> =
                    package_rows.iter().map(|r| r.get("package_id")).collect();

                // Tags
                let tag_rows =
                    sqlx::query("SELECT tag FROM resource_command_tags WHERE resource_id = ?")
                        .bind(&resource_id)
                        .fetch_all(&manager.pool)
                        .await
                        .map_err(|e| e.to_string())?;
                let custom_tags: Vec<String> = tag_rows.iter().map(|r| r.get("tag")).collect();

                return Ok(Some(serde_json::json!({
                    "name": name,
                    "commandTypeId": command_type_id,
                    "argumentsNum": arguments_num,
                    "optionalArgument": optional_argument,
                    "content": content,
                    "example": example,
                    "description": description,
                    "builtIn": built_in,
                    "requiredPackages": if packages.is_empty() { None } else { Some(packages) },
                    "customTags": if custom_tags.is_empty() { None } else { Some(custom_tags) }
                })));
            }
        }
        "table" => {
            // Load main record
            let main_row = sqlx::query("SELECT * FROM resource_tables WHERE resource_id = ?")
                .bind(&resource_id)
                .fetch_optional(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;

            if let Some(row) = main_row {
                // Load packages
                let pkg_rows = sqlx::query(
                    "SELECT package_id FROM resource_table_packages WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let packages: Vec<String> = pkg_rows.iter().map(|r| r.get("package_id")).collect();

                // Load tags
                let tag_rows =
                    sqlx::query("SELECT tag FROM resource_table_tags WHERE resource_id = ?")
                        .bind(&resource_id)
                        .fetch_all(&manager.pool)
                        .await
                        .map_err(|e| e.to_string())?;
                let custom_tags: Vec<String> = tag_rows.iter().map(|r| r.get("tag")).collect();

                // Extract fields
                let table_type_id: Option<String> = row.try_get("table_type_id").ok();
                let date: Option<String> = row.try_get("date").ok();

                let caption: Option<String> = row.try_get("caption").ok();
                let description: Option<String> = row.try_get("description").ok();
                let environment: Option<String> = row.try_get("environment").ok();
                let placement: Option<String> = row.try_get("placement").ok();
                let label: Option<String> = row.try_get("label").ok();
                let width: Option<String> = row.try_get("width").ok();
                let alignment: Option<String> = row.try_get("alignment").ok();
                let rows_count: Option<i64> = row.try_get("rows").ok();
                let cols_count: Option<i64> = row.try_get("columns").ok();

                return Ok(Some(serde_json::json!({
                    "tableTypeId": table_type_id,
                    "date": date,
                    "caption": caption,
                    "description": description,
                    "environment": environment,
                    "placement": placement,
                    "label": label,
                    "width": width,
                    "alignment": alignment,
                    "rows": rows_count,
                    "columns": cols_count,
                    "requiredPackages": packages,
                    "customTags": custom_tags
                })));
            } else {
                return Ok(None);
            }
        }
        "package" => {
            let row = sqlx::query("SELECT * FROM resource_packages WHERE resource_id = ?")
                .bind(&resource_id)
                .fetch_optional(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;

            if let Some(r) = row {
                let name: String = r.get("name");
                let topic_id: Option<String> = r.try_get("topic_id").ok();
                let date: Option<String> = r.try_get("date").ok();
                let content: Option<String> = r.try_get("content").ok();
                let description: Option<String> = r.try_get("description").ok();
                let options: Option<String> = r.try_get("options").ok();
                let built_in: Option<bool> = r.try_get("built_in").ok();
                let documentation: Option<String> = r.try_get("documentation").ok();
                let example: Option<String> = r.try_get("example").ok();

                // Tags
                let tag_rows =
                    sqlx::query("SELECT tag FROM resource_package_tags WHERE resource_id = ?")
                        .bind(&resource_id)
                        .fetch_all(&manager.pool)
                        .await
                        .map_err(|e| e.to_string())?;
                let custom_tags: Vec<String> = tag_rows.iter().map(|t| t.get("tag")).collect();

                // Provided Commands
                let cmd_rows = sqlx::query(
                    "SELECT command_name FROM resource_package_provided_commands WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let provided_commands: Vec<String> =
                    cmd_rows.iter().map(|t| t.get("command_name")).collect();

                // Topics
                let start_rows = sqlx::query(
                    "SELECT topic_id FROM resource_package_topics WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let topics: Vec<String> = start_rows.iter().map(|t| t.get("topic_id")).collect();

                // Dependencies
                let dep_rows = sqlx::query(
                    "SELECT package_id FROM resource_package_dependencies WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let required_packages: Vec<String> =
                    dep_rows.iter().map(|t| t.get("package_id")).collect();

                return Ok(Some(serde_json::json!({
                    "name": name,
                    "topicId": topic_id,
                    "date": date,
                    "content": content,
                    "description": description,
                    "options": options,
                    "builtIn": built_in,
                    "documentation": documentation,
                    "example": example,
                    "customTags": if custom_tags.is_empty() { None } else { Some(custom_tags) },
                    "providedCommands": if provided_commands.is_empty() { None } else { Some(provided_commands) },
                    "topics": if topics.is_empty() { None } else { Some(topics) },
                    "requiredPackages": if required_packages.is_empty() { None } else { Some(required_packages) }
                })));
            } else {
                return Ok(None);
            }
        }
        "class" => {
            let row = sqlx::query("SELECT * FROM resource_classes WHERE resource_id = ?")
                .bind(&resource_id)
                .fetch_optional(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;

            if let Some(r) = row {
                let name: String = r.get("name");
                let file_type_id: Option<String> = r.try_get("file_type_id").ok();
                let date: Option<String> = r.try_get("date").ok();
                let content: Option<String> = r.try_get("content").ok();
                let description: Option<String> = r.try_get("description").ok();
                let engines: Option<String> = r.try_get("engines").ok();
                let paper_size: Option<String> = r.try_get("paper_size").ok();
                let font_size: Option<i32> = r.try_get("font_size").ok();
                let geometry: Option<String> = r.try_get("geometry").ok();
                let options: Option<String> = r.try_get("options").ok();
                let languages: Option<String> = r.try_get("languages").ok();

                // Tags
                let tag_rows =
                    sqlx::query("SELECT tag FROM resource_class_tags WHERE resource_id = ?")
                        .bind(&resource_id)
                        .fetch_all(&manager.pool)
                        .await
                        .map_err(|e| e.to_string())?;
                let custom_tags: Vec<String> = tag_rows.iter().map(|t| t.get("tag")).collect();

                // Required Packages
                let pkg_rows = sqlx::query(
                    "SELECT package_id FROM resource_class_packages WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let required_packages: Vec<String> =
                    pkg_rows.iter().map(|t| t.get("package_id")).collect();

                // Provided Commands
                let cmd_rows = sqlx::query(
                    "SELECT command_name FROM resource_class_provided_commands WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let provided_commands: Vec<String> =
                    cmd_rows.iter().map(|t| t.get("command_name")).collect();

                return Ok(Some(serde_json::json!({
                    "name": name,
                    "fileTypeId": file_type_id,
                    "date": date,
                    "content": content,
                    "description": description,
                    "engines": engines,
                    "paperSize": paper_size,
                    "fontSize": font_size,
                    "geometry": geometry,
                    "options": options,
                    "languages": languages,
                    "customTags": if custom_tags.is_empty() { None } else { Some(custom_tags) },
                    "requiredPackages": if required_packages.is_empty() { None } else { Some(required_packages) },
                    "providedCommands": if provided_commands.is_empty() { None } else { Some(provided_commands) }
                })));
            } else {
                return Ok(None);
            }
        }
        "preamble" => {
            let row = sqlx::query("SELECT * FROM resource_preambles WHERE resource_id = ?")
                .bind(&resource_id)
                .fetch_optional(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;

            if let Some(r) = row {
                let name: String = r.get("name");
                let file_type_id: Option<String> = r.try_get("file_type_id").ok();
                let content: Option<String> = r.try_get("content").ok();
                let description: Option<String> = r.try_get("description").ok();
                let built_in: Option<bool> = r.try_get("built_in").ok();

                let engines: Option<String> = r.try_get("engines").ok();
                let date: Option<String> = r.try_get("date").ok();
                let class_val: Option<String> = r.try_get("class").ok();
                let paper_size: Option<String> = r.try_get("paper_size").ok();
                let font_size: Option<i32> = r.try_get("font_size").ok();
                let options: Option<String> = r.try_get("options").ok();
                let languages: Option<String> = r.try_get("languages").ok();
                let geometry: Option<String> = r.try_get("geometry").ok();
                let author: Option<String> = r.try_get("author").ok();
                let title: Option<String> = r.try_get("title").ok();

                let use_bibliography: Option<bool> = r.try_get("use_bibliography").ok();
                let bib_compile_engine: Option<String> = r.try_get("bib_compile_engine").ok();
                let make_index: Option<bool> = r.try_get("make_index").ok();
                let make_glossaries: Option<bool> = r.try_get("make_glossaries").ok();
                let has_toc: Option<bool> = r.try_get("has_toc").ok();
                let has_lot: Option<bool> = r.try_get("has_lot").ok();
                let has_lof: Option<bool> = r.try_get("has_lof").ok();

                // Packages
                let pkg_rows = sqlx::query(
                    "SELECT package_id FROM resource_preamble_packages WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let required_packages: Vec<String> =
                    pkg_rows.iter().map(|t| t.get("package_id")).collect();

                // Command Types
                let ctype_rows = sqlx::query(
                    "SELECT command_type_id FROM resource_preamble_command_types WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let command_types: Vec<String> = ctype_rows
                    .iter()
                    .map(|t| t.get("command_type_id"))
                    .collect();

                // Provided Commands
                let cmd_rows = sqlx::query(
                    "SELECT command_name FROM resource_preamble_provided_commands WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let provided_commands: Vec<String> =
                    cmd_rows.iter().map(|t| t.get("command_name")).collect();

                return Ok(Some(serde_json::json!({
                    "name": name,
                    "fileTypeId": file_type_id,
                    "content": content,
                    "description": description,
                    "builtIn": built_in,
                    "engines": engines,
                    "date": date,
                    "className": class_val,
                    "paperSize": paper_size,
                    "fontSize": font_size,
                    "options": options,
                    "languages": languages,
                    "geometry": geometry,
                    "author": author,
                    "title": title,
                    "useBibliography": use_bibliography,
                    "bibCompileEngine": bib_compile_engine,
                    "makeIndex": make_index,
                    "makeGlossaries": make_glossaries,
                    "hasToc": has_toc,
                    "hasLot": has_lot,
                    "hasLof": has_lof,
                    "requiredPackages": if required_packages.is_empty() { None } else { Some(required_packages) },
                    "commandTypes": if command_types.is_empty() { None } else { Some(command_types) },
                    "providedCommands": if provided_commands.is_empty() { None } else { Some(provided_commands) }
                })));
            } else {
                return Ok(None);
            }
        }
        "dtx" => {
            let row = sqlx::query(
                "SELECT base_name, version, date, description, provides_classes, provides_packages, documentation_checksum 
                 FROM resource_dtx WHERE resource_id = ?",
            )
            .bind(&resource_id)
            .fetch_optional(&manager.pool)
            .await
            .map_err(|e| e.to_string())?;

            if let Some(r) = row {
                return Ok(Some(serde_json::json!({
                    "baseName": r.try_get::<String, _>("base_name").ok(),
                    "version": r.try_get::<String, _>("version").ok(),
                    "date": r.try_get::<String, _>("date").ok(),
                    "description": r.try_get::<String, _>("description").ok(),
                    "providesClasses": r.try_get::<String, _>("provides_classes").ok(),
                    "providesPackages": r.try_get::<String, _>("provides_packages").ok(),
                    "documentationChecksum": r.try_get::<String, _>("documentation_checksum").ok()
                })));
            }
        }
        "ins" => {
            let row = sqlx::query(
                "SELECT target_dtx_id, generated_files FROM resource_ins WHERE resource_id = ?",
            )
            .bind(&resource_id)
            .fetch_optional(&manager.pool)
            .await
            .map_err(|e| e.to_string())?;

            if let Some(r) = row {
                return Ok(Some(serde_json::json!({
                    "targetDtxId": r.try_get::<String, _>("target_dtx_id").ok(),
                    "generatedFiles": r.try_get::<String, _>("generated_files").ok()
                })));
            }
        }
        _ => {}
    }

    Ok(None)
}

#[tauri::command]
async fn lsp_shutdown(state: State<'_, AppState>) -> Result<(), String> {
    let mut lsp_guard = state.lsp_manager.lock().await;

    if let Some(mut manager) = lsp_guard.take() {
        manager.stop().await?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            db_manager: Mutex::new(None),
            lsp_manager: Mutex::new(None),
        })
        .setup(|app| {
            let proj_dirs = ProjectDirs::from("", "", "datatex");
            let data_dir = if let Some(proj_dirs) = proj_dirs {
                let dir = proj_dirs.data_dir().to_path_buf();
                if let Err(e) = fs::create_dir_all(&dir) {
                    eprintln!("Error creating data directory: {}", e);
                    return Err(Box::new(e));
                }
                dir
            } else {
                eprintln!("Could not determine project directories");
                return Err("Could not determine project directories".into());
            };

            let data_dir_str = data_dir.to_string_lossy().to_string();
            println!("Initializing Global DB at: {}", data_dir_str);

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match DatabaseManager::new(&data_dir_str).await {
                    Ok(manager) => {
                        let state = app_handle.state::<AppState>();
                        let mut db_guard = state.db_manager.lock().await;
                        *db_guard = Some(manager);
                        println!("Global database initialized successfully.");
                    }
                    Err(e) => {
                        eprintln!("Failed to initialize global database: {}", e);
                    }
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            open_project,
            get_db_path,
            compile_tex,
            run_synctex_command,
            run_texcount_command,
            compile_resource_cmd,
            get_system_fonts,
            get_table_data_cmd,
            update_cell_cmd,
            // New Commands
            get_collections_cmd,
            create_collection_cmd,
            get_resources_by_collection_cmd,
            get_resources_by_collections_cmd, // Batch version for performance
            import_folder_cmd,
            delete_collection_cmd,
            delete_resource_cmd,
            create_resource_cmd,
            import_file_cmd,
            reveal_path_cmd,
            link_resources_cmd,
            get_linked_resources_cmd,
            get_all_dependencies_cmd,
            // LSP Commands
            lsp_initialize,
            lsp_completion,
            lsp_hover,
            lsp_definition,
            lsp_did_open,
            lsp_did_change,
            lsp_shutdown,
            parse_log_cmd,
            get_file_tree_cmd,
            // Typed Metadata Lookup Commands (sqlx-based)
            get_fields_cmd,
            get_chapters_cmd,
            get_sections_cmd,
            get_subsections_cmd,
            get_file_types_cmd,
            get_exercise_types_cmd,
            // Create Lookup Commands (for creatable dropdowns)
            create_field_cmd,
            create_chapter_cmd,
            create_section_cmd,
            create_subsection_cmd,
            // Delete Hierarchy Commands
            delete_field_cmd,
            delete_chapter_cmd,
            delete_section_cmd,
            delete_subsection_cmd,
            // Rename Hierarchy Commands
            rename_field_cmd,
            rename_chapter_cmd,
            rename_section_cmd,
            rename_subsection_cmd,
            create_file_type_cmd,
            create_exercise_type_cmd,
            // Rename/Delete FileType and ExerciseType Commands
            rename_file_type_cmd,
            delete_file_type_cmd,
            rename_exercise_type_cmd,
            delete_exercise_type_cmd,
            // Document Types CRUD Commands
            get_document_types_cmd,
            create_document_type_cmd,
            rename_document_type_cmd,
            delete_document_type_cmd,
            // Table Types CRUD Commands
            get_table_types_cmd,
            create_table_type_cmd,
            rename_table_type_cmd,
            delete_table_type_cmd,
            // Figure Types CRUD Commands
            get_figure_types_cmd,
            create_figure_type_cmd,
            rename_figure_type_cmd,
            delete_figure_type_cmd,
            // Command Types CRUD Commands
            get_command_types_cmd,
            create_command_type_cmd,
            rename_command_type_cmd,
            delete_command_type_cmd,
            // Typed Metadata CRUD Commands (sqlx-based)
            save_typed_metadata_cmd,
            load_typed_metadata_cmd,
            // New Lookup Commands
            get_package_topics_cmd,
            get_macro_command_types_cmd,
            create_package_topic_cmd,
            create_macro_command_type_cmd,
            // Graph Processing
            graph_processor::get_graph_data_cmd,
            // CTAN Commands
            commands::ctan::get_packages,
            commands::ctan::get_all_topics,
            commands::ctan::get_package_by_id,
            // Preamble Types CRUD
            get_preamble_types_cmd,
            create_preamble_type_cmd,
            rename_preamble_type_cmd,
            delete_preamble_type_cmd,
            search_database_files,
            replace_database_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ============================================================================
// Preamble Types CRUD
// ============================================================================

#[tauri::command]
async fn get_preamble_types_cmd(
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let rows = sqlx::query("SELECT id, name, description FROM preamble_types ORDER BY name ASC")
        .fetch_all(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    let types = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<String, _>("id"),
                "name": r.get::<String, _>("name"),
                "description": r.get::<Option<String>, _>("description"),
            })
        })
        .collect();

    Ok(types)
}

#[tauri::command]
async fn create_preamble_type_cmd(
    state: State<'_, AppState>,
    name: String,
    description: Option<String>,
) -> Result<String, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let id = slugify(&name);

    sqlx::query("INSERT INTO preamble_types (id, name, description) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(&name)
        .bind(description)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(id)
}

#[tauri::command]
async fn rename_preamble_type_cmd(
    state: State<'_, AppState>,
    id: String,
    new_name: String,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("UPDATE preamble_types SET name = ? WHERE id = ?")
        .bind(new_name)
        .bind(id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn delete_preamble_type_cmd(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    sqlx::query("DELETE FROM preamble_types WHERE id = ?")
        .bind(id)
        .execute(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn slugify(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|&part| !part.is_empty())
        .collect::<Vec<&str>>()
        .join("-")
}
