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

// Legacy rusqlite modules - kept for future typed metadata implementation
mod graph_processor;
mod log_parser;
mod tree_builder;
mod types;

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
                "file" // can be more specific like 'exercise' if we parse it, but 'file' is safe
            } else if file_name.ends_with(".bib") {
                "bibliography"
            } else if file_name.ends_with(".sty") || file_name.ends_with(".cls") {
                "package"
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
    } else if file_name.ends_with(".sty") || file_name.ends_with(".cls") {
        "package"
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

            sqlx::query(
                "INSERT OR REPLACE INTO resource_documents (resource_id, title, document_type_id, description)
                 VALUES (?, ?, ?, ?)"
            )
            .bind(&resource_id)
            .bind(&title)
            .bind(&document_type_id)
            .bind(&description)
            .execute(&manager.pool)
            .await
            .map_err(|e| e.to_string())?;
        }
        "figure" => {
            let environment: Option<String> = metadata
                .get("environment")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let caption: Option<String> = metadata
                .get("caption")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let description: Option<String> = metadata
                .get("description")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            sqlx::query(
                "INSERT OR REPLACE INTO resource_figures (resource_id, environment, caption, description)
                 VALUES (?, ?, ?, ?)"
            )
            .bind(&resource_id)
            .bind(&environment)
            .bind(&caption)
            .bind(&description)
            .execute(&manager.pool)
            .await
            .map_err(|e| e.to_string())?;
        }
        "table" => {
            let caption: Option<String> = metadata
                .get("caption")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            sqlx::query(
                "INSERT OR REPLACE INTO resource_tables (resource_id, caption)
                 VALUES (?, ?)",
            )
            .bind(&resource_id)
            .bind(&caption)
            .execute(&manager.pool)
            .await
            .map_err(|e| e.to_string())?;
        }
        "command" => {
            let name: Option<String> = metadata
                .get("name")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let description: Option<String> = metadata
                .get("description")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let built_in: Option<bool> = metadata.get("builtIn").and_then(|v| v.as_bool());

            sqlx::query(
                "INSERT OR REPLACE INTO resource_commands (resource_id, name, description, built_in)
                 VALUES (?, ?, ?, ?)"
            )
            .bind(&resource_id)
            .bind(&name)
            .bind(&description)
            .bind(built_in)
            .execute(&manager.pool)
            .await
            .map_err(|e| e.to_string())?;
        }
        _ => {
            // For other types, just succeed silently for now
        }
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
                "SELECT title, document_type_id, description FROM resource_documents WHERE resource_id = ?"
            )
            .bind(&resource_id)
            .fetch_optional(&manager.pool)
            .await
            .map_err(|e| e.to_string())?;

            if let Some(row) = main_row {
                return Ok(Some(serde_json::json!({
                    "title": row.try_get::<String, _>("title").ok(),
                    "documentTypeId": row.try_get::<String, _>("document_type_id").ok(),
                    "description": row.try_get::<String, _>("description").ok()
                })));
            }
        }
        "figure" => {
            let main_row = sqlx::query(
                "SELECT environment, caption, description FROM resource_figures WHERE resource_id = ?"
            )
            .bind(&resource_id)
            .fetch_optional(&manager.pool)
            .await
            .map_err(|e| e.to_string())?;

            if let Some(row) = main_row {
                return Ok(Some(serde_json::json!({
                    "environment": row.try_get::<String, _>("environment").ok(),
                    "caption": row.try_get::<String, _>("caption").ok(),
                    "description": row.try_get::<String, _>("description").ok()
                })));
            }
        }
        "table" => {
            let main_row = sqlx::query("SELECT caption FROM resource_tables WHERE resource_id = ?")
                .bind(&resource_id)
                .fetch_optional(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;

            if let Some(row) = main_row {
                return Ok(Some(serde_json::json!({
                    "caption": row.try_get::<String, _>("caption").ok()
                })));
            }
        }
        "command" => {
            let main_row = sqlx::query(
                "SELECT name, description, built_in FROM resource_commands WHERE resource_id = ?",
            )
            .bind(&resource_id)
            .fetch_optional(&manager.pool)
            .await
            .map_err(|e| e.to_string())?;

            if let Some(row) = main_row {
                return Ok(Some(serde_json::json!({
                    "name": row.try_get::<String, _>("name").ok(),
                    "description": row.try_get::<String, _>("description").ok(),
                    "builtIn": row.try_get::<bool, _>("built_in").ok()
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
            // Typed Metadata CRUD Commands (sqlx-based)
            save_typed_metadata_cmd,
            load_typed_metadata_cmd,
            // New Lookup Commands
            get_package_topics_cmd,
            get_macro_command_types_cmd,
            create_package_topic_cmd,
            create_macro_command_type_cmd,
            // Graph Processing
            graph_processor::get_graph_data_cmd
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
