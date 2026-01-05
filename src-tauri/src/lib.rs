use directories::ProjectDirs;
use std::fs;
use tauri::{Manager, State};
use tokio::sync::Mutex;
use uuid::Uuid;
use walkdir::WalkDir;

mod compiler;
mod database;
mod lsp;

use database::entities::{Collection, Resource};
use database::DatabaseManager;
use lsp::TexlabManager;

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
        let mut preamble_content = String::new();

        if preamble_id.starts_with("builtin:") {
            // Simple built-in defaults
            if preamble_id == "builtin:beamer" {
                preamble_content =
                    "\\documentclass{beamer}\n\\usepackage[utf8]{inputenc}\n".to_string();
            } else {
                preamble_content = "\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amsmath}\n".to_string();
            }
        } else {
            // Fetch preamble resource
            let preamble_res = db
                .get_resource_by_id(preamble_id)
                .await?
                .ok_or("Preamble resource not found")?;

            // If preamble resource is physically on disk, read it?
            // Or assumes resource.path points to it.
            // But we want the CONTENT. If it's a file resource, we should read the file.
            // resource.path should be valid.
            preamble_content = fs::read_to_string(&preamble_res.path)
                .map_err(|e| format!("Failed to read preamble file: {}", e))?;
        }

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

#[tauri::command]
async fn import_folder_cmd(
    path: String,
    collection_name: String,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    // 1. Create Collection if not exists
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
            get_resources_by_collection_cmd,
            import_folder_cmd,
            delete_collection_cmd,
            delete_resource_cmd,
            create_resource_cmd,
            import_file_cmd,
            reveal_path_cmd,
            link_resources_cmd,
            get_linked_resources_cmd,
            // LSP Commands
            lsp_initialize,
            lsp_completion,
            lsp_hover,
            lsp_definition,
            lsp_did_open,
            lsp_did_change,
            lsp_shutdown
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
