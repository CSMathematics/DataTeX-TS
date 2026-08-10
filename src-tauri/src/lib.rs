use directories::ProjectDirs;
use sqlx::Row;
use std::fs;
use tauri::{Manager, State};
use tokio::sync::Mutex;
use uuid::Uuid;
use walkdir::WalkDir; // For typed metadata queries

mod agent;
mod ai;
mod bibliography;
mod compiler;
mod database;
mod diagnostics;
mod git;
mod history;
mod lsp;
mod package_studio;
mod pdf_renderer;
mod search;
mod texlab_downloader;
mod tools;
mod vectors;
mod watcher;

// Legacy rusqlite modules - kept for future typed metadata implementation
mod graph_processor;
mod log_parser;
mod tree_builder;
mod types;
mod commands {
    pub mod ctan;
    pub mod dtex;
    pub mod outline;
    pub mod project_files;
}

use database::entities::{Collection, Resource};
use database::DatabaseManager;
use lsp::TexlabManager;
use vectors::VectorStoreState;

// Typed metadata commands now defined below with sqlx (rusqlite commands removed)

use std::sync::Arc;
// ... imports

// 1. App State
struct AppState {
    db_manager: Arc<Mutex<Option<DatabaseManager>>>,
    lsp_manager: Arc<Mutex<Option<TexlabManager>>>,
    compilation_manager: compiler::CompilationManager,
    bibliography_watcher: Arc<Mutex<watcher::BibliographyWatcher>>,
}

// 2. Open Project Command
#[tauri::command]
async fn open_project(
    path: String,
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    println!("Switching active project database to: {}", path);

    // Re-initialize the database manager with the new path
    match DatabaseManager::new(&path).await {
        Ok(new_manager) => {
            let pool = new_manager.pool.clone();
            let mut db_guard = state.db_manager.lock().await;
            *db_guard = Some(new_manager);
            drop(db_guard);
            backfill_and_watch_bibliography(
                pool,
                app_handle,
                Arc::clone(&state.bibliography_watcher),
            )
            .await;
            println!("Database successfully switched to: {}/project.db", path);
            Ok(format!("Database switched to {}", path))
        }
        Err(e) => {
            eprintln!("Failed to switch database: {}", e);
            Err(format!("Failed to switch database: {}", e))
        }
    }
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
async fn compile_tex(
    file_path: String,
    engine: String,
    args: Vec<String>,
    output_dir: String,
    compilation_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let compilation_id = compilation_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let permit = state.compilation_manager.begin(compilation_id)?;
    tokio::task::spawn_blocking(move || {
        compiler::compile(&file_path, &engine, args, &output_dir, permit)
    })
    .await
    .map_err(|error| format!("Compilation task failed: {}", error))?
}

#[tauri::command]
async fn stop_compile(compilation_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let manager = state.compilation_manager.clone();
    tokio::task::spawn_blocking(move || manager.stop(&compilation_id))
        .await
        .map_err(|error| format!("Stop compilation task failed: {}", error))?
}

#[tauri::command]
async fn run_synctex_command(args: Vec<String>, cwd: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || compiler::run_synctex(args, &cwd))
        .await
        .map_err(|error| format!("SyncTeX task failed: {}", error))?
}

#[tauri::command]
async fn run_texcount_command(args: Vec<String>, cwd: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || compiler::run_texcount(args, &cwd))
        .await
        .map_err(|error| format!("TeXcount task failed: {}", error))?
}

#[tauri::command]
fn parse_bibliography_preview_cmd(content: String) -> bibliography::parser::ParsedBibliography {
    bibliography::parser::parse_bibliography(&content)
}

#[tauri::command]
async fn reparse_bibliography_resource_cmd(
    resource_id: String,
    state: State<'_, AppState>,
) -> Result<bibliography::service::BibliographyImportResult, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::reparse_bibliography_resource(&db.pool, &resource_id).await
}

#[tauri::command]
async fn backfill_existing_bibliography_metadata_cmd(
    state: State<'_, AppState>,
) -> Result<bibliography::service::BibliographyBackfillResult, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::backfill_existing_bibliography_metadata(&db.pool).await
}

#[tauri::command]
async fn list_bibliography_entries_for_resource_cmd(
    resource_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<bibliography::service::BibliographyEntrySummary>, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::list_bibliography_entries_for_resource(&db.pool, &resource_id).await
}

#[tauri::command]
async fn search_bibliography_entries_cmd(
    resource_id: Option<String>,
    query: String,
    limit: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<bibliography::service::BibliographyEntrySummary>, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::search_bibliography_entries(
        &db.pool,
        resource_id.as_deref(),
        &query,
        limit.unwrap_or(80),
    )
    .await
}

#[tauri::command]
async fn list_bibliography_workspace_entries_cmd(
    source_id: Option<String>,
    query: String,
    entry_type: Option<String>,
    smart_view: Option<String>,
    tag: Option<String>,
    limit: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<bibliography::service::BibliographyEntrySummary>, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::list_workspace_bibliography_entries(
        &db.pool,
        source_id.as_deref(),
        &query,
        entry_type.as_deref(),
        smart_view.as_deref(),
        tag.as_deref(),
        limit.unwrap_or(500),
    )
    .await
}

#[tauri::command]
async fn update_bibliography_entry_cmd(
    request: bibliography::service::BibliographyEntryUpdateRequest,
    state: State<'_, AppState>,
) -> Result<bibliography::service::BibliographyEntrySummary, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::update_bibliography_entry(&db.pool, request).await
}

#[tauri::command]
async fn batch_update_bibliography_entries_cmd(
    request: bibliography::service::BatchBibliographyEntryUpdateRequest,
    state: State<'_, AppState>,
) -> Result<Vec<bibliography::service::BibliographyEntrySummary>, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::batch_update_bibliography_entries(&db.pool, request).await
}

#[tauri::command]
async fn export_bibliography_entries_cmd(
    entry_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::export_bibliography_entries(&db.pool, entry_ids).await
}

#[tauri::command]
async fn export_bibliography_entries_as_cmd(
    entry_ids: Vec<String>,
    format: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::export_bibliography_entries_as(&db.pool, entry_ids, &format).await
}

#[tauri::command]
async fn import_bibliography_content_cmd(
    request: bibliography::service::BibliographyContentImportRequest,
    state: State<'_, AppState>,
) -> Result<bibliography::service::BibliographyContentImportResult, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::import_bibliography_content(&db.pool, request).await
}

#[tauri::command]
async fn lookup_bibliography_doi_cmd(
    request: bibliography::service::BibliographyDoiLookupRequest,
) -> Result<bibliography::service::BibliographyDoiLookupResult, String> {
    bibliography::service::lookup_bibliography_doi(request).await
}

#[tauri::command]
async fn import_bibliography_doi_cmd(
    request: bibliography::service::BibliographyDoiLookupRequest,
    state: State<'_, AppState>,
) -> Result<bibliography::service::BibliographyContentImportResult, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::import_bibliography_doi(&db.pool, request).await
}

#[tauri::command]
async fn list_bibliography_tags_cmd(
    state: State<'_, AppState>,
) -> Result<Vec<bibliography::service::BibliographyTagSummary>, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::list_bibliography_tags(&db.pool).await
}

#[tauri::command]
async fn list_bibliography_history_cmd(
    source_id: Option<String>,
    entry_id: Option<String>,
    resource_id: Option<String>,
    limit: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<bibliography::service::BibliographyHistorySummary>, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::list_bibliography_history(
        &db.pool,
        source_id.as_deref(),
        entry_id.as_deref(),
        resource_id.as_deref(),
        limit.unwrap_or(100),
    )
    .await
}

#[tauri::command]
async fn list_bibliography_entry_notes_cmd(
    entry_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<bibliography::service::BibliographyEntryNoteSummary>, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::list_bibliography_entry_notes(&db.pool, &entry_id).await
}

#[tauri::command]
async fn save_bibliography_entry_note_cmd(
    request: bibliography::service::BibliographyEntryNoteUpsertRequest,
    state: State<'_, AppState>,
) -> Result<bibliography::service::BibliographyEntryNoteSummary, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::save_bibliography_entry_note(&db.pool, request).await
}

#[tauri::command]
async fn delete_bibliography_entry_note_cmd(
    note_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::delete_bibliography_entry_note(&db.pool, &note_id).await
}

#[tauri::command]
async fn list_bibliography_entry_attachments_cmd(
    entry_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<bibliography::service::BibliographyEntryAttachmentSummary>, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::list_bibliography_entry_attachments(&db.pool, &entry_id).await
}

#[tauri::command]
async fn attach_bibliography_entry_file_cmd(
    request: bibliography::service::BibliographyEntryAttachmentRequest,
    state: State<'_, AppState>,
) -> Result<bibliography::service::BibliographyEntryAttachmentSummary, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::attach_bibliography_entry_file(&db.pool, request).await
}

#[tauri::command]
async fn delete_bibliography_entry_attachment_cmd(
    attachment_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::delete_bibliography_entry_attachment(&db.pool, &attachment_id).await
}

#[tauri::command]
async fn list_bibliography_pdf_annotations_cmd(
    entry_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<bibliography::service::BibliographyPdfAnnotationSummary>, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::list_bibliography_pdf_annotations(&db.pool, &entry_id).await
}

#[tauri::command]
async fn save_bibliography_pdf_annotation_cmd(
    request: bibliography::service::BibliographyPdfAnnotationUpsertRequest,
    state: State<'_, AppState>,
) -> Result<bibliography::service::BibliographyPdfAnnotationSummary, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::save_bibliography_pdf_annotation(&db.pool, request).await
}

#[tauri::command]
async fn delete_bibliography_pdf_annotation_cmd(
    annotation_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::delete_bibliography_pdf_annotation(&db.pool, &annotation_id).await
}

#[tauri::command]
async fn bibliography_citation_graph_cmd(
    entry_id: String,
    limit: Option<i64>,
    state: State<'_, AppState>,
) -> Result<bibliography::service::BibliographyCitationGraphSummary, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::bibliography_citation_graph(&db.pool, &entry_id, limit.unwrap_or(80))
        .await
}

#[tauri::command]
async fn list_bibliography_collection_federation_cmd(
    state: State<'_, AppState>,
) -> Result<Vec<bibliography::service::BibliographyCollectionFederationSummary>, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::list_bibliography_collection_federation(&db.pool).await
}

#[tauri::command]
async fn save_bibliography_collection_federation_cmd(
    request: bibliography::service::BibliographyCollectionFederationRequest,
    state: State<'_, AppState>,
) -> Result<bibliography::service::BibliographyCollectionFederationSummary, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::save_bibliography_collection_federation(&db.pool, request).await
}

#[tauri::command]
async fn delete_bibliography_collection_federation_cmd(
    collection: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::delete_bibliography_collection_federation(&db.pool, &collection).await
}

#[tauri::command]
async fn watch_bibliography_resources_cmd(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<watcher::BibliographyWatchSummary, String> {
    let pool = {
        let db_guard = state.db_manager.lock().await;
        let db = db_guard.as_ref().ok_or("Database not initialized")?;
        db.pool.clone()
    };
    let watcher = state.bibliography_watcher.lock().await;
    watcher.watch_tracked(pool, app_handle).await
}

#[tauri::command]
async fn unwatch_bibliography_resources_cmd(state: State<'_, AppState>) -> Result<(), String> {
    let watcher = state.bibliography_watcher.lock().await;
    watcher.unwatch();
    Ok(())
}

async fn backfill_and_watch_bibliography(
    pool: sqlx::SqlitePool,
    app_handle: tauri::AppHandle,
    bibliography_watcher: Arc<Mutex<watcher::BibliographyWatcher>>,
) {
    match bibliography::service::backfill_existing_bibliography_metadata(&pool).await {
        Ok(result) => {
            if result.entries_imported > 0
                || result.sources_created > 0
                || !result.warnings.is_empty()
            {
                println!(
                    "Bibliography backfill complete: {} sources, {} entries, {} skipped existing, {} skipped invalid.",
                    result.sources_created,
                    result.entries_imported,
                    result.skipped_existing,
                    result.skipped_invalid
                );
                for warning in result.warnings.iter().take(5) {
                    eprintln!("Bibliography backfill warning: {warning}");
                }
            }
        }
        Err(error) => eprintln!("Failed to backfill bibliography metadata: {error}"),
    }

    match bibliography_watcher
        .lock()
        .await
        .watch_tracked(pool, app_handle)
        .await
    {
        Ok(summary) => println!(
            "Bibliography watcher started: {} resources in {} directories.",
            summary.tracked_resources, summary.watched_directories
        ),
        Err(error) => {
            eprintln!("Failed to start bibliography watcher: {error}");
        }
    }
}

#[tauri::command]
async fn set_bibliography_entry_tags_cmd(
    entry_id: String,
    tags: Vec<String>,
    state: State<'_, AppState>,
) -> Result<bibliography::service::BibliographyEntrySummary, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::set_bibliography_entry_tags(&db.pool, &entry_id, tags).await
}

#[tauri::command]
async fn list_all_bibliography_sources_cmd(
    state: State<'_, AppState>,
) -> Result<Vec<bibliography::service::BibliographySourceOption>, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::list_all_bibliography_sources(&db.pool).await
}

#[tauri::command]
async fn list_linked_bibliography_sources_cmd(
    resource_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<bibliography::service::BibliographySourceOption>, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::list_linked_bibliography_sources(&db.pool, &resource_id).await
}

#[tauri::command]
async fn link_bibliography_source_cmd(
    resource_id: String,
    source_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::link_bibliography_source(&db.pool, &resource_id, &source_id).await
}

#[tauri::command]
async fn unlink_bibliography_source_cmd(
    resource_id: String,
    source_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::unlink_bibliography_source(&db.pool, &resource_id, &source_id).await
}

#[tauri::command]
async fn detect_bibliography_declarations_cmd(
    resource_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<bibliography::service::BibliographyDeclarationSummary>, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::detect_bibliography_declarations(&db.pool, &resource_id).await
}

#[tauri::command]
async fn auto_link_declared_bibliography_sources_cmd(
    resource_id: String,
    state: State<'_, AppState>,
) -> Result<bibliography::service::BibliographyAutoLinkResult, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::auto_link_declared_bibliography_sources(&db.pool, &resource_id).await
}

#[tauri::command]
async fn scan_resource_citations_cmd(
    resource_id: String,
    state: State<'_, AppState>,
) -> Result<bibliography::service::CitationScanResult, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::scan_resource_citations(&db.pool, &resource_id).await
}

#[tauri::command]
async fn resolve_citation_keys_cmd(
    resource_id: Option<String>,
    citation_keys: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Vec<bibliography::service::CitationKeyResolutionSummary>, String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;
    bibliography::service::resolve_citation_keys(&db.pool, resource_id.as_deref(), citation_keys)
        .await
}

#[tauri::command]
async fn compile_resource_cmd(
    id: String,
    preamble_override: Option<String>,
    compilation_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let compilation_id = compilation_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let permit = state.compilation_manager.begin(compilation_id)?;
    let (resource, preamble_id, build_command, preamble_path, use_bibliography, bib_compile_engine) = {
        let db_guard = state.db_manager.lock().await;
        let db = db_guard.as_ref().ok_or("Database not initialized")?;
        let resource = db
            .get_resource_by_id(&id)
            .await?
            .ok_or("Resource not found")?;
        let metadata = resource.metadata.as_ref().ok_or("No metadata found")?;
        let preamble_id = metadata
            .get("preamble")
            .and_then(|value| value.as_str())
            .map(str::to_owned);
        let build_command = metadata
            .get("buildCommand")
            .and_then(|value| value.as_str())
            .unwrap_or("pdflatex")
            .to_owned();
        let use_bibliography = metadata
            .get("useBibliography")
            .or_else(|| metadata.get("use_bibliography"))
            .and_then(|value| value.as_bool())
            .unwrap_or(false);
        let bib_compile_engine = metadata
            .get("bibCompileEngine")
            .or_else(|| metadata.get("bib_compile_engine"))
            .and_then(|value| value.as_str())
            .unwrap_or("biber")
            .to_owned();
        let preamble_path = match (&preamble_override, &preamble_id) {
            (None, Some(preamble_id)) if !preamble_id.starts_with("builtin:") => Some(
                db.get_resource_by_id(preamble_id)
                    .await?
                    .ok_or("Preamble resource not found")?
                    .path,
            ),
            _ => None,
        };
        (
            resource,
            preamble_id,
            build_command,
            preamble_path,
            use_bibliography,
            bib_compile_engine,
        )
    };

    tokio::task::spawn_blocking(move || {
        permit.ensure_not_cancelled()?;
        let original_path = std::path::PathBuf::from(&resource.path);
        let parent_dir = original_path
            .parent()
            .unwrap_or(std::path::Path::new("."));
        let file_stem = original_path
            .file_stem()
            .ok_or("Resource path has no file name")?
            .to_string_lossy()
            .to_string();
        let output_dir = parent_dir.to_string_lossy().to_string();

        if preamble_override.is_some() || preamble_id.is_some() {
            let preamble_content = if let Some(content) = preamble_override {
                content
            } else if let Some(preamble_id) = preamble_id {
                if preamble_id == "builtin:beamer" {
                    "\\documentclass{beamer}\n\\usepackage[utf8]{inputenc}\n\\usepackage{graphicx}\n\\usepackage{hyperref}\n".to_string()
                } else if preamble_id.starts_with("builtin:") {
                    "\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amsmath}\n".to_string()
                } else {
                    let path = preamble_path.ok_or("Preamble resource has no path")?;
                    fs::read_to_string(path)
                        .map_err(|error| format!("Failed to read preamble file: {}", error))?
                }
            } else {
                return Err("No preamble source".to_string());
            };

            let body_content = fs::read_to_string(&original_path)
                .map_err(|error| format!("Failed to read resource file: {}", error))?;
            let full_document = format!(
                "{}\n\\begin{{document}}\n{}\n\\end{{document}}",
                preamble_content, body_content
            );
            let temp_path = parent_dir.join(format!("{}_preview.tex", file_stem));
            fs::write(&temp_path, full_document)
                .map_err(|error| format!("Failed to write preview file: {}", error))?;

            let result = compiler::compile_with_bibliography(
                &temp_path.to_string_lossy(),
                &build_command,
                vec![
                    "-interaction=nonstopmode".to_string(),
                    "-synctex=1".to_string(),
                    format!("-jobname={}", file_stem),
                ],
                &output_dir,
                use_bibliography.then_some(bib_compile_engine.as_str()),
                permit,
            );
            let _ = fs::remove_file(&temp_path);
            result?;
        } else {
            compiler::compile_with_bibliography(
                &resource.path,
                &build_command,
                vec![
                    "-interaction=nonstopmode".to_string(),
                    "-synctex=1".to_string(),
                ],
                &output_dir,
                use_bibliography.then_some(bib_compile_engine.as_str()),
                permit,
            )?;
        }

        Ok(original_path
            .with_extension("pdf")
            .to_string_lossy()
            .to_string())
    })
    .await
    .map_err(|error| format!("Compilation task failed: {}", error))?
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
        eprintln!("get_collections_cmd querying DB: {}", db.path);
        db.get_collections().await
    } else {
        Err("Database not initialized".to_string())
    }
}

#[tauri::command]
async fn create_collection_cmd(
    name: String,
    path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    eprintln!(
        "create_collection_cmd: name='{}', path='{}' in DB: {}",
        name, path, db.path
    );

    let collection = Collection {
        name: name.clone(),
        description: Some("Manually created collection".to_string()),
        icon: Some("database".to_string()),
        kind: "manual".to_string(),
        path: Some(path),
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
async fn get_resource_cmd(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<Resource>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    manager.get_resource_by_id(&id).await
}

struct ScannedFolderResource {
    id: String,
    path: String,
    kind: &'static str,
    title: String,
}

#[tauri::command]
async fn import_folder_cmd(
    path: String,
    collection_name: String,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    eprintln!(
        "import_folder_cmd called with path: {}, name: {}",
        path, collection_name
    );

    // Clone the pool while holding the global manager lock, then release it
    // before either filesystem traversal or database I/O.
    let pool = {
        let db_guard = state.db_manager.lock().await;
        db_guard
            .as_ref()
            .ok_or("Database not initialized")?
            .pool
            .clone()
    };

    let scan_path = path.clone();
    let resources =
        tokio::task::spawn_blocking(move || -> Result<Vec<ScannedFolderResource>, String> {
            let root_metadata = fs::metadata(&scan_path).map_err(|error| {
                format!("Failed to access import folder '{}': {}", scan_path, error)
            })?;
            if !root_metadata.is_dir() {
                return Err(format!("Import path is not a directory: {}", scan_path));
            }

            let mut resources = Vec::new();
            for entry in WalkDir::new(&scan_path) {
                let entry = entry.map_err(|error| {
                    format!(
                        "Failed while scanning import folder '{}': {}",
                        scan_path, error
                    )
                })?;
                if !entry.file_type().is_file() {
                    continue;
                }

                let file_path = entry
                    .path()
                    .to_str()
                    .ok_or_else(|| {
                        format!("Import path is not valid UTF-8: {}", entry.path().display())
                    })?
                    .to_string();
                let file_name = entry
                    .file_name()
                    .to_str()
                    .ok_or_else(|| {
                        format!(
                            "Imported file name is not valid UTF-8: {}",
                            entry.path().display()
                        )
                    })?
                    .to_string();
                let extension = entry
                    .path()
                    .extension()
                    .and_then(|extension| extension.to_str())
                    .unwrap_or_default()
                    .to_ascii_lowercase();
                let kind = match extension.as_str() {
                    "bib" => "bibliography",
                    "sty" => "package",
                    "cls" => "class",
                    "dtx" => "dtx",
                    "ins" => "ins",
                    "png" | "jpg" | "jpeg" | "pdf" => "figure",
                    _ => "file",
                };

                resources.push(ScannedFolderResource {
                    id: Uuid::new_v4().to_string(),
                    path: file_path,
                    kind,
                    title: file_name,
                });
            }
            Ok(resources)
        })
        .await
        .map_err(|error| format!("Folder scan task failed: {}", error))??;

    persist_folder_import(&pool, &path, &collection_name, &resources).await
}

async fn persist_folder_import(
    pool: &sqlx::SqlitePool,
    path: &str,
    collection_name: &str,
    resources: &[ScannedFolderResource],
) -> Result<usize, String> {
    let resource_count = resources.len();
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("Failed to begin folder import: {}", error))?;

    sqlx::query(
        "INSERT INTO collections (name, description, icon, type, path)
         VALUES (?, ?, 'folder', 'files', ?)
         ON CONFLICT(name) DO UPDATE SET
           description = excluded.description,
           icon = excluded.icon,
           type = excluded.type,
           path = excluded.path",
    )
    .bind(collection_name)
    .bind(format!("Imported from {}", path))
    .bind(path)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("Failed to create or update imported collection: {}", error))?;

    // Stay below SQLite's default bind-parameter limit while still reducing a
    // large import to a small number of database round trips.
    for chunk in resources.chunks(100) {
        let mut query = sqlx::QueryBuilder::<sqlx::Sqlite>::new(
            "INSERT INTO resources (id, path, type, collection, title, content_hash, metadata) ",
        );
        query.push_values(chunk, |mut values, resource| {
            values
                .push_bind(&resource.id)
                .push_bind(&resource.path)
                .push_bind(resource.kind)
                .push_bind(collection_name)
                .push_bind(&resource.title)
                .push_bind(Option::<String>::None)
                .push_bind("{}");
        });
        query.push(
            " ON CONFLICT(path) DO UPDATE SET
                type = excluded.type,
                collection = excluded.collection,
                title = excluded.title",
        );
        query
            .build()
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("Failed to import resource batch: {}", error))?;
    }

    transaction
        .commit()
        .await
        .map_err(|error| format!("Failed to commit folder import: {}", error))?;
    Ok(resource_count)
}

#[cfg(test)]
mod folder_import_tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    #[tokio::test]
    async fn reimport_preserves_resource_id_and_user_metadata() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("in-memory database");
        sqlx::query(
            "CREATE TABLE collections (
                name TEXT PRIMARY KEY NOT NULL,
                description TEXT,
                icon TEXT,
                type TEXT NOT NULL,
                path TEXT
            )",
        )
        .execute(&pool)
        .await
        .expect("collections schema");
        sqlx::query(
            "CREATE TABLE resources (
                id TEXT PRIMARY KEY NOT NULL,
                path TEXT NOT NULL UNIQUE,
                type TEXT NOT NULL,
                collection TEXT NOT NULL,
                title TEXT,
                content_hash TEXT,
                metadata JSON DEFAULT '{}'
            )",
        )
        .execute(&pool)
        .await
        .expect("resources schema");

        let first = vec![ScannedFolderResource {
            id: "original-id".to_string(),
            path: "/library/item.tex".to_string(),
            kind: "file",
            title: "item.tex".to_string(),
        }];
        assert_eq!(
            persist_folder_import(&pool, "/library", "library", &first)
                .await
                .expect("first import"),
            1
        );
        sqlx::query(
            "UPDATE resources
             SET metadata = '{\"custom\":true}', content_hash = 'user-hash'
             WHERE path = '/library/item.tex'",
        )
        .execute(&pool)
        .await
        .expect("user metadata update");

        let reimport = vec![ScannedFolderResource {
            id: "replacement-id".to_string(),
            path: "/library/item.tex".to_string(),
            kind: "file",
            title: "renamed-title.tex".to_string(),
        }];
        persist_folder_import(&pool, "/library", "library", &reimport)
            .await
            .expect("repeat import");

        let row: (String, String, String, String) = sqlx::query_as(
            "SELECT id, title, content_hash, metadata
             FROM resources WHERE path = '/library/item.tex'",
        )
        .fetch_one(&pool)
        .await
        .expect("reimported resource");
        assert_eq!(row.0, "original-id");
        assert_eq!(row.1, "renamed-title.tex");
        assert_eq!(row.2, "user-hash");
        assert_eq!(row.3, "{\"custom\":true}");

        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM resources")
            .fetch_one(&pool)
            .await
            .expect("resource count");
        assert_eq!(count.0, 1);
    }
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
async fn create_folder_cmd(
    path: String,
    collection_name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    // 1. Create directory on disk
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;

    // 2. Add to database
    let file_name = std::path::Path::new(&path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let resource = Resource {
        id: Uuid::new_v4().to_string(),
        path: path.clone(),
        kind: "folder".to_string(), // Explicitly folder
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
async fn import_file_cmd(
    path: String,
    collection_name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    println!(
        "import_file_cmd called with path: '{}', collection: '{}'",
        path, collection_name
    );
    let db_guard = state.db_manager.lock().await;
    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    // 1. Get Collection Path
    // Since we don't have get_collection_by_name exposed yet, fetch all and find.
    let collections = db.get_collections().await?;
    let target_col = collections
        .into_iter()
        .find(|c| c.name == collection_name)
        .ok_or("Collection not found")?;

    let col_path_str = target_col.path.ok_or("Collection has no physical path")?;
    let col_path = std::path::Path::new(&col_path_str);

    // 2. Prepare Destination Path
    let src_path = std::path::Path::new(&path);
    let file_name = src_path.file_name().ok_or("Invalid source file name")?;

    let mut dest_path = col_path.join(file_name);

    // 3. Handle Duplicates (Auto-rename)
    if dest_path.exists() {
        let file_stem = src_path
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let extension = src_path
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let mut counter = 1;
        while dest_path.exists() {
            let new_name = if extension.is_empty() {
                format!("{}_{}", file_stem, counter)
            } else {
                format!("{}_{}.{}", file_stem, counter, extension)
            };
            dest_path = col_path.join(new_name);
            counter += 1;
        }
    }

    // 4. Perform Copy
    // Check if source and dest are the same (already in folder)
    if src_path != dest_path {
        fs::copy(src_path, &dest_path).map_err(|e| format!("Failed to copy file: {}", e))?;
    }

    // 5. Register NEW path in Database
    let final_path_str = dest_path.to_string_lossy().to_string();
    let final_file_name = dest_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    // Simple type detection extension - reusing logic could be better but copying for now
    let kind = if final_file_name.ends_with(".tex") {
        "file"
    } else if final_file_name.ends_with(".bib") {
        "bibliography"
    } else if final_file_name.ends_with(".sty") {
        "package"
    } else if final_file_name.ends_with(".cls") {
        "class"
    } else if final_file_name.ends_with(".dtx") {
        "dtx"
    } else if final_file_name.ends_with(".ins") {
        "ins"
    } else if final_file_name.ends_with(".png")
        || final_file_name.ends_with(".jpg")
        || final_file_name.ends_with(".pdf")
    {
        "figure"
    } else {
        "file"
    };

    let resource = Resource {
        id: Uuid::new_v4().to_string(),
        path: final_path_str,
        kind: kind.to_string(),
        collection: collection_name,
        title: Some(final_file_name),
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
    drop(db_guard);

    // Build search query
    let search_query = search::SearchQuery {
        text: query,
        case_sensitive,
        use_regex,
        file_types,
        max_results,
    };

    // File scanning is blocking and CPU-heavy; keep it off the async runtime.
    tokio::task::spawn_blocking(move || search::search_in_files(&search_query, resources))
        .await
        .map_err(|error| format!("Search task failed: {}", error))?
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
    drop(db_guard);

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

    tokio::task::spawn_blocking(move || search::replace_in_files(&replace_query, resources))
        .await
        .map_err(|error| format!("Replace task failed: {}", error))?
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
fn parse_log_cmd(file_path: String) -> Result<Vec<log_parser::LogEntry>, String> {
    let content = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    Ok(log_parser::parse_log(&content))
}

#[tauri::command]
async fn get_file_tree_cmd(
    collections: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Vec<tree_builder::TreeNode>, String> {
    let (resources, roots) = {
        let db_guard = state.db_manager.lock().await;
        let db = db_guard.as_ref().ok_or("Database not initialized")?;

        let all_collections = db.get_collections().await?;
        let mut roots = std::collections::HashMap::new();
        for collection in all_collections {
            if let Some(path) = collection.path {
                roots.insert(collection.name, path);
            }
        }

        let resources = db.get_resources_by_collections(&collections).await?;
        (resources, roots)
    };

    tokio::task::spawn_blocking(move || tree_builder::build_file_tree(resources, &roots))
        .await
        .map_err(|error| format!("File tree task failed: {}", error))
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
    changes: Vec<serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut lsp_guard = state.lsp_manager.lock().await;

    if let Some(manager) = lsp_guard.as_mut() {
        let params = serde_json::json!({
            "textDocument": {
                "uri": uri,
                "version": version
            },
            "contentChanges": changes
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
async fn get_fields_cmd(
    state: State<'_, AppState>,
    collection_name: Option<String>,
) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let rows = if let Some(col) = &collection_name {
        sqlx::query(
            "SELECT id, name FROM fields WHERE collection IS NULL OR collection = ? ORDER BY name",
        )
        .bind(col)
        .fetch_all(&manager.pool)
        .await
    } else {
        sqlx::query("SELECT id, name FROM fields WHERE collection IS NULL ORDER BY name")
            .fetch_all(&manager.pool)
            .await
    }
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
    collection_name: Option<String>,
) -> Result<serde_json::Value, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO fields (id, name, collection) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(&name)
        .bind(&collection_name)
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
    collection_name: Option<String>,
) -> Result<serde_json::Value, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO chapters (id, name, field_id, collection) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(&name)
        .bind(&field_id)
        .bind(&collection_name)
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
    collection_name: Option<String>,
) -> Result<serde_json::Value, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO sections (id, name, chapter_id, collection) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(&name)
        .bind(&chapter_id)
        .bind(&collection_name)
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
    collection_name: Option<String>,
) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let mut query_str = "SELECT id, name, section_id FROM subsections WHERE 1=1".to_string();
    if section_id.is_some() {
        query_str.push_str(" AND section_id = ?");
    }
    if collection_name.is_some() {
        query_str.push_str(" AND (collection IS NULL OR collection = ?)");
    } else {
        query_str.push_str(" AND collection IS NULL");
    }
    query_str.push_str(" ORDER BY name");

    let mut query = sqlx::query(&query_str);
    if let Some(sid) = &section_id {
        query = query.bind(sid);
    }
    if let Some(col) = &collection_name {
        query = query.bind(col);
    }

    let rows = query
        .fetch_all(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut subsections = Vec::new();
    for row in rows {
        let id: String = row.get("id");
        let name: String = row.get("name");
        let section_id: String = row.get("section_id");
        subsections.push(serde_json::json!({"id": id, "name": name, "sectionId": section_id}));
    }
    Ok(subsections)
}

#[tauri::command]
async fn create_subsection_cmd(
    state: State<'_, AppState>,
    name: String,
    section_id: String,
    collection_name: Option<String>,
) -> Result<serde_json::Value, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO subsections (id, name, section_id, collection) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(&name)
        .bind(&section_id)
        .bind(&collection_name)
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
    collection_name: Option<String>,
) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let mut query_str = "SELECT id, name, field_id FROM chapters WHERE 1=1".to_string();
    if field_id.is_some() {
        query_str.push_str(" AND field_id = ?");
    }
    if collection_name.is_some() {
        query_str.push_str(" AND (collection IS NULL OR collection = ?)");
    } else {
        query_str.push_str(" AND collection IS NULL");
    }
    query_str.push_str(" ORDER BY name");

    let mut query = sqlx::query(&query_str);
    if let Some(fid) = &field_id {
        query = query.bind(fid);
    }
    if let Some(col) = &collection_name {
        query = query.bind(col);
    }

    let rows = query
        .fetch_all(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut chapters = Vec::new();
    for row in rows {
        let id: String = row.get("id");
        let name: String = row.get("name");
        let field_id: String = row.get("field_id");
        chapters.push(serde_json::json!({"id": id, "name": name, "fieldId": field_id}));
    }
    Ok(chapters)
}

#[tauri::command]
async fn get_sections_cmd(
    state: State<'_, AppState>,
    chapter_id: Option<String>,
    collection_name: Option<String>,
) -> Result<Vec<serde_json::Value>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    let mut query_str = "SELECT id, name, chapter_id FROM sections WHERE 1=1".to_string();
    if chapter_id.is_some() {
        query_str.push_str(" AND chapter_id = ?");
    }
    if collection_name.is_some() {
        query_str.push_str(" AND (collection IS NULL OR collection = ?)");
    } else {
        query_str.push_str(" AND collection IS NULL");
    }
    query_str.push_str(" ORDER BY name");

    let mut query = sqlx::query(&query_str);
    if let Some(cid) = &chapter_id {
        query = query.bind(cid);
    }
    if let Some(col) = &collection_name {
        query = query.bind(col);
    }

    let rows = query
        .fetch_all(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut sections = Vec::new();
    for row in rows {
        let id: String = row.get("id");
        let name: String = row.get("name");
        let chapter_id: String = row.get("chapter_id");
        sections.push(serde_json::json!({"id": id, "name": name, "chapterId": chapter_id}));
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

#[derive(Clone, Copy)]
struct MetadataForeignKeySpec {
    key: &'static str,
    table: &'static str,
    column: &'static str,
    is_array: bool,
}

const FILE_METADATA_FOREIGN_KEYS: &[MetadataForeignKeySpec] = &[
    MetadataForeignKeySpec {
        key: "fileTypeId",
        table: "file_types",
        column: "id",
        is_array: false,
    },
    MetadataForeignKeySpec {
        key: "fieldId",
        table: "fields",
        column: "id",
        is_array: false,
    },
    MetadataForeignKeySpec {
        key: "chapters",
        table: "chapters",
        column: "id",
        is_array: true,
    },
    MetadataForeignKeySpec {
        key: "sections",
        table: "sections",
        column: "id",
        is_array: true,
    },
    MetadataForeignKeySpec {
        key: "subsections",
        table: "subsections",
        column: "id",
        is_array: true,
    },
    MetadataForeignKeySpec {
        key: "exerciseTypes",
        table: "exercise_types",
        column: "id",
        is_array: true,
    },
];

const DOCUMENT_METADATA_FOREIGN_KEYS: &[MetadataForeignKeySpec] = &[
    MetadataForeignKeySpec {
        key: "documentTypeId",
        table: "document_types",
        column: "id",
        is_array: false,
    },
    MetadataForeignKeySpec {
        key: "fieldId",
        table: "fields",
        column: "id",
        is_array: false,
    },
    MetadataForeignKeySpec {
        key: "preambleId",
        table: "resources",
        column: "id",
        is_array: false,
    },
    MetadataForeignKeySpec {
        key: "solutionDocumentId",
        table: "resources",
        column: "id",
        is_array: false,
    },
    MetadataForeignKeySpec {
        key: "chapters",
        table: "chapters",
        column: "id",
        is_array: true,
    },
    MetadataForeignKeySpec {
        key: "sections",
        table: "sections",
        column: "id",
        is_array: true,
    },
    MetadataForeignKeySpec {
        key: "subsections",
        table: "subsections",
        column: "id",
        is_array: true,
    },
];

const FIGURE_METADATA_FOREIGN_KEYS: &[MetadataForeignKeySpec] = &[
    MetadataForeignKeySpec {
        key: "figureTypeId",
        table: "figure_types",
        column: "id",
        is_array: false,
    },
    MetadataForeignKeySpec {
        key: "fieldId",
        table: "fields",
        column: "id",
        is_array: false,
    },
    MetadataForeignKeySpec {
        key: "chapters",
        table: "chapters",
        column: "id",
        is_array: true,
    },
    MetadataForeignKeySpec {
        key: "sections",
        table: "sections",
        column: "id",
        is_array: true,
    },
    MetadataForeignKeySpec {
        key: "subsections",
        table: "subsections",
        column: "id",
        is_array: true,
    },
];

const TABLE_METADATA_FOREIGN_KEYS: &[MetadataForeignKeySpec] = &[
    MetadataForeignKeySpec {
        key: "tableTypeId",
        table: "table_types",
        column: "id",
        is_array: false,
    },
    MetadataForeignKeySpec {
        key: "fieldId",
        table: "fields",
        column: "id",
        is_array: false,
    },
    MetadataForeignKeySpec {
        key: "chapters",
        table: "chapters",
        column: "id",
        is_array: true,
    },
    MetadataForeignKeySpec {
        key: "sections",
        table: "sections",
        column: "id",
        is_array: true,
    },
    MetadataForeignKeySpec {
        key: "subsections",
        table: "subsections",
        column: "id",
        is_array: true,
    },
];

const COMMAND_METADATA_FOREIGN_KEYS: &[MetadataForeignKeySpec] = &[MetadataForeignKeySpec {
    key: "commandTypeId",
    table: "command_types",
    column: "id",
    is_array: false,
}];

const PACKAGE_METADATA_FOREIGN_KEYS: &[MetadataForeignKeySpec] = &[
    MetadataForeignKeySpec {
        key: "topicId",
        table: "package_topics",
        column: "id",
        is_array: false,
    },
    MetadataForeignKeySpec {
        key: "topics",
        table: "package_topics",
        column: "id",
        is_array: true,
    },
];

const CLASS_METADATA_FOREIGN_KEYS: &[MetadataForeignKeySpec] = &[MetadataForeignKeySpec {
    key: "fileTypeId",
    table: "file_types",
    column: "id",
    is_array: false,
}];

const PREAMBLE_METADATA_FOREIGN_KEYS: &[MetadataForeignKeySpec] = &[
    MetadataForeignKeySpec {
        key: "preambleTypeId",
        table: "preamble_types",
        column: "id",
        is_array: false,
    },
    MetadataForeignKeySpec {
        key: "commandTypes",
        table: "macro_command_types",
        column: "id",
        is_array: true,
    },
];

const INS_METADATA_FOREIGN_KEYS: &[MetadataForeignKeySpec] = &[MetadataForeignKeySpec {
    key: "targetDtxId",
    table: "resources",
    column: "id",
    is_array: false,
}];

fn metadata_foreign_key_specs(resource_type: &str) -> &'static [MetadataForeignKeySpec] {
    match resource_type {
        "file" => FILE_METADATA_FOREIGN_KEYS,
        "document" => DOCUMENT_METADATA_FOREIGN_KEYS,
        "figure" => FIGURE_METADATA_FOREIGN_KEYS,
        "table" => TABLE_METADATA_FOREIGN_KEYS,
        "command" => COMMAND_METADATA_FOREIGN_KEYS,
        "package" => PACKAGE_METADATA_FOREIGN_KEYS,
        "class" => CLASS_METADATA_FOREIGN_KEYS,
        "preamble" => PREAMBLE_METADATA_FOREIGN_KEYS,
        "ins" => INS_METADATA_FOREIGN_KEYS,
        // Bibliography and DTX only reference their already-validated parent
        // resource. Tags and TeX Live packages are created before junctions.
        _ => &[],
    }
}

/// Validate every external identifier before changing any typed table.
///
/// SQLite reports all of these failures as the same opaque code 787. Doing a
/// preflight in the save transaction keeps rollback semantics while returning
/// the exact metadata key and stale identifier to the editor. Empty optional
/// identifiers are normalized to `null`, and empty array entries are removed.
async fn validate_metadata_foreign_keys(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    resource_id: &str,
    resource_type: &str,
    metadata: &mut serde_json::Value,
) -> Result<(), String> {
    let specs = metadata_foreign_key_specs(resource_type);
    let mut references: Vec<(MetadataForeignKeySpec, String)> = Vec::new();

    {
        let object = metadata
            .as_object_mut()
            .ok_or_else(|| "Metadata payload must be a JSON object".to_string())?;

        for spec in specs {
            if spec.is_array {
                let Some(values) = object
                    .get_mut(spec.key)
                    .and_then(serde_json::Value::as_array_mut)
                else {
                    continue;
                };

                let mut normalized = Vec::with_capacity(values.len());
                let mut seen = std::collections::HashSet::with_capacity(values.len());
                for value in values.iter() {
                    let raw = value.as_str().ok_or_else(|| {
                        format!(
                            "Invalid metadata reference for resource {resource_id}: \
                             {resource_type}.{} must contain only string IDs",
                            spec.key
                        )
                    })?;
                    let id = raw.trim();
                    if id.is_empty() {
                        continue;
                    }
                    if seen.insert(id.to_string()) {
                        normalized.push(serde_json::Value::String(id.to_string()));
                        references.push((*spec, id.to_string()));
                    }
                }
                *values = normalized;
                continue;
            }

            let Some(value) = object.get(spec.key) else {
                continue;
            };
            if value.is_null() {
                continue;
            }
            let raw = value
                .as_str()
                .ok_or_else(|| {
                    format!(
                        "Invalid metadata reference for resource {resource_id}: \
                         {resource_type}.{} must be a string ID or null",
                        spec.key
                    )
                })?
                .to_string();
            let id = raw.trim().to_string();
            if id.is_empty() {
                object.insert(spec.key.to_string(), serde_json::Value::Null);
            } else {
                if id != raw {
                    object.insert(spec.key.to_string(), serde_json::Value::String(id.clone()));
                }
                references.push((*spec, id));
            }
        }
    }

    for (spec, id) in references {
        // Table and column names only come from the constants above; values
        // remain bound parameters.
        let query = format!(
            "SELECT EXISTS(SELECT 1 FROM {} WHERE {} = ?)",
            spec.table, spec.column
        );
        let exists: bool = sqlx::query_scalar(&query)
            .bind(&id)
            .fetch_one(&mut **transaction)
            .await
            .map_err(|error| {
                format!(
                    "Failed to validate {resource_type}.{} for resource \
                     {resource_id}: {error}",
                    spec.key
                )
            })?;
        if !exists {
            return Err(format!(
                "Invalid metadata reference for resource {resource_id}: \
                 {resource_type}.{} contains ID '{id}', but {}.{} does not exist",
                spec.key, spec.table, spec.column
            ));
        }
    }

    Ok(())
}

#[tauri::command]
async fn save_typed_metadata_cmd(
    state: State<'_, AppState>,
    resource_id: String,
    resource_type: String,
    metadata: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let pool = {
        let db_guard = state.db_manager.lock().await;
        db_guard
            .as_ref()
            .ok_or("Database not initialized")?
            .pool
            .clone()
    };
    save_typed_metadata_in_pool(&pool, resource_id, resource_type, metadata).await
}

async fn save_typed_metadata_in_pool(
    pool: &sqlx::Pool<sqlx::Sqlite>,
    resource_id: String,
    resource_type: String,
    metadata: serde_json::Value,
) -> Result<serde_json::Value, String> {
    // The editor sends a complete metadata snapshot. Normalize every
    // relationship field up front so a missing/null/non-array value means an
    // empty selection. This makes clearing the final checkbox/list item delete
    // the corresponding junction rows instead of silently preserving them.
    let (relation_keys, snapshot_keys): (&[&str], &[&str]) = match resource_type.as_str() {
        "file" => (
            &[
                "chapters",
                "sections",
                "subsections",
                "exerciseTypes",
                "customTags",
            ],
            &[
                "fileTypeId",
                "fieldId",
                "difficulty",
                "solvedProoved",
                "buildCommand",
                "fileDescription",
                // Legacy aliases superseded by the typed keys above. Remove
                // them from the JSON snapshot so stale duplicate values do
                // not survive a typed save. `preamble` intentionally is not
                // owned here and is therefore preserved.
                "field",
                "solved_prooved",
                "description",
                "taxonomy",
                "chapters",
                "sections",
                "subsections",
                "exerciseTypes",
                "customTags",
            ],
        ),
        "document" => (
            &["chapters", "sections", "subsections", "customTags"],
            &[
                "title",
                "documentTypeId",
                "description",
                "fieldId",
                "date",
                "preambleId",
                "buildCommand",
                "bibliography",
                "solutionDocumentId",
                "chapters",
                "sections",
                "subsections",
                "customTags",
            ],
        ),
        "bibliography" => (
            &["authors", "editors", "translators"],
            &[
                "entryType",
                "citationKey",
                "journal",
                "volume",
                "series",
                "number",
                "issue",
                "year",
                "month",
                "publisher",
                "edition",
                "institution",
                "school",
                "organization",
                "address",
                "location",
                "isbn",
                "issn",
                "doi",
                "url",
                "language",
                "title",
                "subtitle",
                "booktitle",
                "chapter",
                "pages",
                "abstract",
                "note",
                "crossref",
                "authors",
                "editors",
                "translators",
                "extras",
            ],
        ),
        "figure" => (
            &[
                "requiredPackages",
                "chapters",
                "sections",
                "subsections",
                "customTags",
            ],
            &[
                "figureTypeId",
                "fieldId",
                "date",
                "environment",
                "caption",
                "description",
                "width",
                "height",
                "options",
                "tikzStyle",
                "label",
                "placement",
                "alignment",
                "requiredPackages",
                "chapters",
                "sections",
                "subsections",
                "customTags",
            ],
        ),
        "table" => (
            &[
                "requiredPackages",
                "chapters",
                "sections",
                "subsections",
                "customTags",
            ],
            &[
                "tableTypeId",
                "fieldId",
                "date",
                "caption",
                "description",
                "environment",
                "placement",
                "label",
                "width",
                "alignment",
                "rows",
                "columns",
                "requiredPackages",
                "chapters",
                "sections",
                "subsections",
                "customTags",
            ],
        ),
        "command" => (
            &["requiredPackages", "customTags"],
            &[
                "name",
                "commandTypeId",
                "argumentsNum",
                "optionalArgument",
                "content",
                "example",
                "description",
                "builtIn",
                "requiredPackages",
                "customTags",
            ],
        ),
        "package" => (
            &[
                "requiredPackages",
                "topics",
                "providedCommands",
                "customTags",
            ],
            &[
                "name",
                "topicId",
                "date",
                "content",
                "description",
                "options",
                "builtIn",
                "documentation",
                "example",
                "requiredPackages",
                "topics",
                "providedCommands",
                "customTags",
            ],
        ),
        "class" => (
            &["requiredPackages", "providedCommands", "customTags"],
            &[
                "name",
                "fileTypeId",
                "date",
                "content",
                "description",
                "engines",
                "paperSize",
                "fontSize",
                "geometry",
                "options",
                "languages",
                "requiredPackages",
                "providedCommands",
                "customTags",
            ],
        ),
        "preamble" => (
            &["requiredPackages", "commandTypes", "providedCommands"],
            &[
                "name",
                "preambleTypeId",
                "content",
                "description",
                "builtIn",
                "engines",
                "date",
                "className",
                "paperSize",
                "fontSize",
                "options",
                "languages",
                "geometry",
                "author",
                "title",
                "useBibliography",
                "bibCompileEngine",
                "makeIndex",
                "makeGlossaries",
                "hasToc",
                "hasLot",
                "hasLof",
                "requiredPackages",
                "commandTypes",
                "providedCommands",
            ],
        ),
        "dtx" => (
            &[],
            &[
                "baseName",
                "version",
                "date",
                "description",
                "providesClasses",
                "providesPackages",
                "documentationChecksum",
            ],
        ),
        "ins" => (&[], &["targetDtxId", "generatedFiles"]),
        _ => return Err(format!("Unknown resource type: {}", resource_type)),
    };

    let mut metadata = metadata;
    let metadata_object = metadata
        .as_object_mut()
        .ok_or_else(|| "Metadata payload must be a JSON object".to_string())?;
    for key in relation_keys {
        if !metadata_object
            .get(*key)
            .is_some_and(serde_json::Value::is_array)
        {
            metadata_object.insert((*key).to_string(), serde_json::Value::Array(Vec::new()));
        }
    }
    if resource_type == "bibliography"
        && !metadata_object
            .get("extras")
            .is_some_and(serde_json::Value::is_object)
    {
        metadata_object.insert(
            "extras".to_string(),
            serde_json::Value::Object(serde_json::Map::new()),
        );
    }
    if resource_type == "file" {
        // Legacy JSON aliases may arrive alongside their normalized typed
        // equivalents (notably from imported/.dtex metadata). Do not persist
        // two competing sources of truth after a successful typed save.
        for key in ["field", "solved_prooved", "description", "taxonomy"] {
            metadata_object.remove(key);
        }
    }
    let required_name_label = match resource_type.as_str() {
        "command" => Some("Command name"),
        "package" => Some("Package name"),
        "class" => Some("Class name"),
        "preamble" => Some("Preamble name"),
        _ => None,
    };
    if let Some(label) = required_name_label {
        let has_name = metadata_object
            .get("name")
            .and_then(serde_json::Value::as_str)
            .is_some_and(|name| !name.trim().is_empty());
        if !has_name {
            return Err(format!("{label} is required"));
        }
    }

    let integer_keys: &[&str] = match resource_type.as_str() {
        "file" => &["difficulty"],
        "table" => &["rows", "columns"],
        "command" => &["argumentsNum"],
        "class" | "preamble" => &["fontSize"],
        _ => &[],
    };
    for key in integer_keys {
        let Some(value) = metadata_object.get(*key) else {
            continue;
        };
        if value.is_null() {
            continue;
        }
        let integer = value
            .as_i64()
            .ok_or_else(|| format!("{key} must be a whole number"))?;
        let in_range = match (*key, resource_type.as_str()) {
            ("difficulty", "file") => (1..=5).contains(&integer),
            ("argumentsNum", "command") => (0..=9).contains(&integer),
            ("rows" | "columns", "table") => integer >= 0,
            ("fontSize", "class" | "preamble") => integer > 0,
            _ => true,
        };
        if !in_range {
            return Err(format!("Invalid value for {key}: {integer}"));
        }
    }

    let boolean_keys: &[&str] = match resource_type.as_str() {
        "file" => &["solvedProoved"],
        "command" | "package" => &["builtIn"],
        "preamble" => &[
            "builtIn",
            "useBibliography",
            "makeIndex",
            "makeGlossaries",
            "hasToc",
            "hasLot",
            "hasLof",
        ],
        _ => &[],
    };
    for key in boolean_keys {
        if !metadata_object
            .get(*key)
            .is_some_and(serde_json::Value::is_boolean)
        {
            metadata_object.insert((*key).to_string(), serde_json::Value::Bool(false));
        }
    }

    if resource_type == "table"
        && !metadata_object
            .get("environment")
            .and_then(serde_json::Value::as_str)
            .is_some_and(|environment| !environment.trim().is_empty())
    {
        metadata_object.insert("environment".to_string(), serde_json::json!("tabular"));
    }

    let mut transaction = pool.begin().await.map_err(|e| e.to_string())?;

    // Keep JSON-only/legacy fields while replacing every key owned by the
    // typed editor. Reading the resource in this transaction also guarantees
    // that typed rows cannot be written for an unknown resource even on a
    // connection where foreign-key enforcement was not enabled.
    let resource_row = sqlx::query("SELECT type, metadata FROM resources WHERE id = ?")
        .bind(&resource_id)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Resource not found: {}", resource_id))?;
    let stored_resource_type: String = resource_row
        .try_get("type")
        .map_err(|error| format!("Failed to read resource type for {resource_id}: {error}"))?;
    if stored_resource_type != resource_type {
        return Err(format!(
            "Resource type mismatch for {resource_id}: database has \
             '{stored_resource_type}', save requested '{resource_type}'"
        ));
    }
    let existing_metadata = resource_row
        .try_get::<Option<String>, _>("metadata")
        .ok()
        .flatten()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok());

    validate_metadata_foreign_keys(
        &mut transaction,
        &resource_id,
        &resource_type,
        &mut metadata,
    )
    .await?;

    let mut persisted_object = metadata
        .as_object()
        .expect("metadata was validated as an object")
        .clone();
    if let Some(serde_json::Value::Object(existing_object)) = existing_metadata {
        for (key, value) in existing_object {
            if !snapshot_keys.contains(&key.as_str()) && !persisted_object.contains_key(&key) {
                persisted_object.insert(key, value);
            }
        }
    }
    let persisted_metadata = serde_json::Value::Object(persisted_object);

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

            // Upsert without deleting the parent row. REPLACE can cascade-delete
            // junction rows before recreating the record.
            sqlx::query(
                "INSERT INTO resource_files (resource_id, file_type_id, field_id, difficulty, solved_prooved, build_command, file_description)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(resource_id) DO UPDATE SET
                   file_type_id = excluded.file_type_id,
                   field_id = excluded.field_id,
                   difficulty = excluded.difficulty,
                   solved_prooved = excluded.solved_prooved,
                   build_command = excluded.build_command,
                   file_description = excluded.file_description"
            )
            .bind(&resource_id)
            .bind(&file_type_id)
            .bind(&field_id)
            .bind(difficulty)
            .bind(solved_prooved)
            .bind(&build_command)
            .bind(&file_description)
            .execute(&mut *transaction)
            .await
            .map_err(|e| e.to_string())?;

            // Save chapters (junction table)
            if let Some(chapters) = metadata.get("chapters").and_then(|v| v.as_array()) {
                // Clear existing
                sqlx::query("DELETE FROM resource_file_chapters WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;

                for chapter in chapters {
                    if let Some(chapter_id) = chapter.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_file_chapters (resource_id, chapter_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(chapter_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Save sections
            if let Some(sections) = metadata.get("sections").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_file_sections WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;

                for section in sections {
                    if let Some(section_id) = section.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_file_sections (resource_id, section_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(section_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Save subsections
            if let Some(subsections) = metadata.get("subsections").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_file_subsections WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;

                for subsection in subsections {
                    if let Some(subsection_id) = subsection.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_file_subsections (resource_id, subsection_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(subsection_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Save exercise types
            if let Some(exercise_types) = metadata.get("exerciseTypes").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_file_exercise_types WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;

                for et in exercise_types {
                    if let Some(et_id) = et.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_file_exercise_types (resource_id, exercise_type_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(et_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Save custom tags
            if let Some(tags) = metadata.get("customTags").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_file_tags WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;

                for tag in tags {
                    if let Some(tag_str) = tag.as_str() {
                        // Ensure tag exists
                        sqlx::query("INSERT OR IGNORE INTO custom_tags (tag) VALUES (?)")
                            .bind(tag_str)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;

                        sqlx::query("INSERT OR IGNORE INTO resource_file_tags (resource_id, tag) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(tag_str)
                            .execute(&mut *transaction)
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

            // Upsert without deleting the parent row or cascading into junctions.
            sqlx::query(
                "INSERT INTO resource_documents
                 (resource_id, title, document_type_id, field_id, date, 
                  preamble_id, build_command, bibliography, description, solution_document_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(resource_id) DO UPDATE SET
                   title = excluded.title,
                   document_type_id = excluded.document_type_id,
                   field_id = excluded.field_id,
                   date = excluded.date,
                   preamble_id = excluded.preamble_id,
                   build_command = excluded.build_command,
                   bibliography = excluded.bibliography,
                   description = excluded.description,
                   solution_document_id = excluded.solution_document_id",
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
            .execute(&mut *transaction)
            .await
            .map_err(|e| e.to_string())?;

            // Save chapters (junction table)
            if let Some(chapters) = metadata.get("chapters").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_document_chapters WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;

                for chapter in chapters {
                    if let Some(chapter_id) = chapter.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_document_chapters (resource_id, chapter_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(chapter_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Save sections
            if let Some(sections) = metadata.get("sections").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_document_sections WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;

                for section in sections {
                    if let Some(section_id) = section.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_document_sections (resource_id, section_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(section_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Save subsections
            if let Some(subsections) = metadata.get("subsections").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_document_subsections WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;

                for subsection in subsections {
                    if let Some(subsection_id) = subsection.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_document_subsections (resource_id, subsection_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(subsection_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Save custom tags
            if let Some(tags) = metadata.get("customTags").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_document_tags WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;

                for tag in tags {
                    if let Some(tag_str) = tag.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO custom_tags (tag) VALUES (?)")
                            .bind(tag_str)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;

                        sqlx::query("INSERT OR IGNORE INTO resource_document_tags (resource_id, tag) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(tag_str)
                            .execute(&mut *transaction)
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
                    .fetch_optional(&mut *transaction)
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
                .execute(&mut *transaction)
                .await
                .map_err(|e| e.to_string())?;

            // 2. Handle Persons
            sqlx::query("DELETE FROM resource_bibliography_persons WHERE resource_id = ?")
                .bind(&resource_id)
                .execute(&mut *transaction)
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
                                    .execute(&mut *transaction)
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
                .execute(&mut *transaction)
                .await
                .map_err(|e| e.to_string())?;

            if let Some(extras) = metadata.get("extras").and_then(|v| v.as_object()) {
                for (k, v) in extras {
                    if let Some(val_str) = v.as_str() {
                        sqlx::query("INSERT INTO resource_bibliography_extras (resource_id, \"key\", value) VALUES (?, ?, ?)")
                            .bind(&resource_id)
                            .bind(k)
                            .bind(val_str)
                            .execute(&mut *transaction)
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
                .fetch_optional(&mut *transaction)
                .await
                .map_err(|e| e.to_string())?
                .is_some();

            let stmt = if exists {
                "UPDATE resource_figures SET 
                    figure_type_id=?, field_id=?, date=?, environment=?, caption=?, description=?,
                    width=?, height=?, options=?, tikz_style=?, label=?, placement=?, alignment=?
                 WHERE resource_id=?"
            } else {
                "INSERT INTO resource_figures (
                    figure_type_id, field_id, date, environment, caption, description,
                    width, height, options, tikz_style, label, placement, alignment,
                    resource_id
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
            };

            sqlx::query(stmt)
                .bind(get_str("figureTypeId"))
                .bind(get_str("fieldId")) // Added field_id
                .bind(get_str("date"))
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
                .execute(&mut *transaction)
                .await
                .map_err(|e| e.to_string())?;

            // Packages
            if let Some(packages) = metadata.get("requiredPackages").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_figure_packages WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;

                for pkg in packages {
                    if let Some(pkg_id) = pkg.as_str() {
                        // Ensure package exists in dictionary to avoid FK error
                        sqlx::query("INSERT OR IGNORE INTO texlive_packages (id) VALUES (?)")
                            .bind(pkg_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;

                        sqlx::query("INSERT OR IGNORE INTO resource_figure_packages (resource_id, package_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(pkg_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Save Hierarchy (Chapters, Sections, Subsections)
            // Chapters
            if let Some(chapters) = metadata.get("chapters").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_figure_chapters WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;

                for ch in chapters {
                    if let Some(ch_id) = ch.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_figure_chapters (resource_id, chapter_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(ch_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Sections
            if let Some(sections) = metadata.get("sections").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_figure_sections WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;

                for s in sections {
                    if let Some(s_id) = s.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_figure_sections (resource_id, section_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(s_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Subsections
            if let Some(subsections) = metadata.get("subsections").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_figure_subsections WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;

                for ss in subsections {
                    if let Some(ss_id) = ss.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_figure_subsections (resource_id, subsection_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(ss_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Tags
            if let Some(tags) = metadata.get("customTags").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_figure_tags WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;

                for tag in tags {
                    if let Some(tag_str) = tag.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO custom_tags (tag) VALUES (?)")
                            .bind(tag_str)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;

                        sqlx::query("INSERT OR IGNORE INTO resource_figure_tags (resource_id, tag) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(tag_str)
                            .execute(&mut *transaction)
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
                .fetch_optional(&mut *transaction)
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
                    .execute(&mut *transaction)
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
                     .execute(&mut *transaction)
                     .await
                     .map_err(|e| e.to_string())?;
            }

            // Tags
            if let Some(tags) = metadata.get("customTags").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_command_tags WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;
                for tag in tags {
                    if let Some(tag_str) = tag.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO custom_tags (tag) VALUES (?)")
                            .bind(tag_str)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                        sqlx::query("INSERT OR IGNORE INTO resource_command_tags (resource_id, tag) VALUES (?, ?)").bind(&resource_id).bind(tag_str).execute(&mut *transaction).await.map_err(|e| e.to_string())?;
                    }
                }
            }
            // Packages
            if let Some(packages) = metadata.get("requiredPackages").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_command_packages WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;
                for pkg in packages {
                    if let Some(pkg_id) = pkg.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO texlive_packages (id) VALUES (?)")
                            .bind(pkg_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                        sqlx::query("INSERT OR IGNORE INTO resource_command_packages (resource_id, package_id) VALUES (?, ?)").bind(&resource_id).bind(pkg_id).execute(&mut *transaction).await.map_err(|e| e.to_string())?;
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
                .fetch_optional(&mut *transaction)
                .await
                .map_err(|e| e.to_string())?
                .is_some();

            let stmt = if exists {
                "UPDATE resource_tables SET 
                    table_type_id=?, field_id=?, date=?, caption=?, description=?, 
                    environment=?, placement=?, label=?, width=?, alignment=?,
                    rows=?, columns=?
                 WHERE resource_id=?"
            } else {
                "INSERT INTO resource_tables (
                    table_type_id, field_id, date, caption, description,
                    environment, placement, label, width, alignment,
                    rows, columns,
                    resource_id
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
            };

            sqlx::query(stmt)
                .bind(get_str("tableTypeId"))
                .bind(get_str("fieldId")) // Added field_id
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
                .execute(&mut *transaction)
                .await
                .map_err(|e| e.to_string())?;

            // Save required packages
            if let Some(packages) = metadata.get("requiredPackages").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_table_packages WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;

                for pkg in packages {
                    if let Some(pkg_id) = pkg.as_str() {
                        // Ensure package exists in dictionary to avoid FK error
                        sqlx::query("INSERT OR IGNORE INTO texlive_packages (id) VALUES (?)")
                            .bind(pkg_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;

                        sqlx::query("INSERT OR IGNORE INTO resource_table_packages (resource_id, package_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(pkg_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Save Hierarchy (Chapters, Sections, Subsections)
            // Chapters
            if let Some(chapters) = metadata.get("chapters").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_table_chapters WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;

                for ch in chapters {
                    if let Some(ch_id) = ch.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_table_chapters (resource_id, chapter_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(ch_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Sections
            if let Some(sections) = metadata.get("sections").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_table_sections WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;

                for s in sections {
                    if let Some(s_id) = s.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_table_sections (resource_id, section_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(s_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Subsections
            if let Some(subsections) = metadata.get("subsections").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_table_subsections WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;

                for ss in subsections {
                    if let Some(ss_id) = ss.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_table_subsections (resource_id, subsection_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(ss_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Save custom tags
            if let Some(tags) = metadata.get("customTags").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_table_tags WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;

                for tag in tags {
                    if let Some(tag_str) = tag.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO custom_tags (tag) VALUES (?)")
                            .bind(tag_str)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;

                        sqlx::query("INSERT OR IGNORE INTO resource_table_tags (resource_id, tag) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(tag_str)
                            .execute(&mut *transaction)
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
                .fetch_optional(&mut *transaction)
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
                .execute(&mut *transaction)
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
                .execute(&mut *transaction)
                .await
                .map_err(|e| e.to_string())?;
            }

            // Junctions

            // Custom Tags
            if let Some(tags) = metadata.get("customTags").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_package_tags WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;
                for tag in tags {
                    if let Some(tag_str) = tag.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO custom_tags (tag) VALUES (?)")
                            .bind(tag_str)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                        sqlx::query("INSERT OR IGNORE INTO resource_package_tags (resource_id, tag) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(tag_str)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Provided Commands
            if let Some(cmds) = metadata.get("providedCommands").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_package_provided_commands WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;
                for cmd in cmds {
                    if let Some(cmd_str) = cmd.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_package_provided_commands (resource_id, command_name) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(cmd_str)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Topics (Related Topics)
            if let Some(topics) = metadata.get("topics").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_package_topics WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;
                for topic in topics {
                    if let Some(topic_id) = topic.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_package_topics (resource_id, topic_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(topic_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Dependencies (Required Packages)
            if let Some(deps) = metadata.get("requiredPackages").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_package_dependencies WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;
                for dep in deps {
                    if let Some(dep_id) = dep.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO texlive_packages (id) VALUES (?)")
                            .bind(dep_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                        sqlx::query("INSERT OR IGNORE INTO resource_package_dependencies (resource_id, package_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(dep_id)
                            .execute(&mut *transaction)
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
                .fetch_optional(&mut *transaction)
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
                .execute(&mut *transaction)
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
                .execute(&mut *transaction)
                .await
                .map_err(|e| e.to_string())?;
            }

            // Junctions

            // Custom Tags
            if let Some(tags) = metadata.get("customTags").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_class_tags WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;
                for tag in tags {
                    if let Some(tag_str) = tag.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO custom_tags (tag) VALUES (?)")
                            .bind(tag_str)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                        sqlx::query("INSERT OR IGNORE INTO resource_class_tags (resource_id, tag) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(tag_str)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Required Packages
            if let Some(pkgs) = metadata.get("requiredPackages").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_class_packages WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;
                for pkg in pkgs {
                    if let Some(pkg_id) = pkg.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_class_packages (resource_id, package_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(pkg_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Provided Commands
            if let Some(cmds) = metadata.get("providedCommands").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_class_provided_commands WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;
                for cmd in cmds {
                    if let Some(cmd_str) = cmd.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_class_provided_commands (resource_id, command_name) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(cmd_str)
                            .execute(&mut *transaction)
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
                    .fetch_optional(&mut *transaction)
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
                .bind(get_str("className"))
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
                .execute(&mut *transaction)
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
                .bind(get_str("className"))
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
                .execute(&mut *transaction)
                .await
                .map_err(|e| e.to_string())?;
            }

            // Junctions

            // Required Packages
            if let Some(pkgs) = metadata.get("requiredPackages").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_preamble_packages WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;
                for pkg in pkgs {
                    if let Some(pkg_id) = pkg.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO texlive_packages (id) VALUES (?)")
                            .bind(pkg_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                        sqlx::query("INSERT OR IGNORE INTO resource_preamble_packages (resource_id, package_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(pkg_id)
                            .execute(&mut *transaction)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                }
            }

            // Command Types
            if let Some(ctypes) = metadata.get("commandTypes").and_then(|v| v.as_array()) {
                sqlx::query("DELETE FROM resource_preamble_command_types WHERE resource_id = ?")
                    .bind(&resource_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|e| e.to_string())?;
                for ctype in ctypes {
                    if let Some(ctype_id) = ctype.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_preamble_command_types (resource_id, command_type_id) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(ctype_id)
                            .execute(&mut *transaction)
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
                .execute(&mut *transaction)
                .await
                .map_err(|e| e.to_string())?;
                for cmd in cmds {
                    if let Some(cmd_str) = cmd.as_str() {
                        sqlx::query("INSERT OR IGNORE INTO resource_preamble_provided_commands (resource_id, command_name) VALUES (?, ?)")
                            .bind(&resource_id)
                            .bind(cmd_str)
                            .execute(&mut *transaction)
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
                .fetch_optional(&mut *transaction)
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
                .bind(get_str("providesClasses"))
                .bind(get_str("providesPackages"))
                .bind(get_str("documentationChecksum"))
                .bind(&resource_id)
                .execute(&mut *transaction)
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
                .bind(get_str("providesClasses"))
                .bind(get_str("providesPackages"))
                .bind(get_str("documentationChecksum"))
                .bind(&resource_id)
                .execute(&mut *transaction)
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
                .fetch_optional(&mut *transaction)
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
                .bind(get_str("generatedFiles"))
                .bind(&resource_id)
                .execute(&mut *transaction)
                .await
                .map_err(|e| e.to_string())?;
            } else {
                sqlx::query(
                    "INSERT INTO resource_ins (
                     target_dtx_id, generated_files, resource_id
                     ) VALUES (?,?,?)",
                )
                .bind(get_str("targetDtxId"))
                .bind(get_str("generatedFiles"))
                .bind(&resource_id)
                .execute(&mut *transaction)
                .await
                .map_err(|e| e.to_string())?;
            }
        }

        _ => return Err(format!("Unknown resource type: {}", resource_type)),
    }

    let persisted_metadata_json =
        serde_json::to_string(&persisted_metadata).map_err(|e| e.to_string())?;
    let update_result = sqlx::query("UPDATE resources SET metadata = ? WHERE id = ?")
        .bind(persisted_metadata_json)
        .bind(&resource_id)
        .execute(&mut *transaction)
        .await
        .map_err(|e| e.to_string())?;
    if update_result.rows_affected() != 1 {
        return Err(format!(
            "Expected to update one resource metadata row for {}, updated {}",
            resource_id,
            update_result.rows_affected()
        ));
    }

    transaction.commit().await.map_err(|e| e.to_string())?;
    Ok(persisted_metadata)
}

#[tauri::command]
async fn load_typed_metadata_cmd(
    state: State<'_, AppState>,
    resource_id: String,
    resource_type: String,
) -> Result<Option<serde_json::Value>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;
    load_typed_metadata_with_manager(manager, resource_id, resource_type).await
}

async fn load_typed_metadata_with_manager(
    manager: &DatabaseManager,
    resource_id: String,
    resource_type: String,
) -> Result<Option<serde_json::Value>, String> {
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
                    "chapters": chapters,
                    "sections": sections,
                    "subsections": subsections,
                    "exerciseTypes": exercise_types,
                    "customTags": custom_tags
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
                    "chapters": chapters,
                    "sections": sections,
                    "subsections": subsections,
                    "customTags": custom_tags
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
                    "authors": authors,
                    "editors": editors,
                    "translators": translators,
                    "extras": extras_map
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

                // Fetch Hierarchy (Chapters, Sections, Subsections)
                let chapter_rows = sqlx::query(
                    "SELECT chapter_id FROM resource_figure_chapters WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let chapters: Vec<String> =
                    chapter_rows.iter().map(|r| r.get("chapter_id")).collect();

                let section_rows = sqlx::query(
                    "SELECT section_id FROM resource_figure_sections WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let sections: Vec<String> =
                    section_rows.iter().map(|r| r.get("section_id")).collect();

                let subsection_rows = sqlx::query(
                    "SELECT subsection_id FROM resource_figure_subsections WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let subsections: Vec<String> = subsection_rows
                    .iter()
                    .map(|r| r.get("subsection_id"))
                    .collect();

                return Ok(Some(serde_json::json!({
                    "figureTypeId": row.try_get::<String, _>("figure_type_id").ok(),
                    "fieldId": row.try_get::<String, _>("field_id").ok(),
                    "date": row.try_get::<String, _>("date").ok(),
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
                    "requiredPackages": packages,
                    "customTags": custom_tags,
                    "chapters": chapters,
                    "sections": sections,
                    "subsections": subsections
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
                    "requiredPackages": packages,
                    "customTags": custom_tags
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

                // Fetch Hierarchy
                let chapter_rows = sqlx::query(
                    "SELECT chapter_id FROM resource_table_chapters WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let chapters: Vec<String> =
                    chapter_rows.iter().map(|r| r.get("chapter_id")).collect();

                let section_rows = sqlx::query(
                    "SELECT section_id FROM resource_table_sections WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let sections: Vec<String> =
                    section_rows.iter().map(|r| r.get("section_id")).collect();

                let subsection_rows = sqlx::query(
                    "SELECT subsection_id FROM resource_table_subsections WHERE resource_id = ?",
                )
                .bind(&resource_id)
                .fetch_all(&manager.pool)
                .await
                .map_err(|e| e.to_string())?;
                let subsections: Vec<String> = subsection_rows
                    .iter()
                    .map(|r| r.get("subsection_id"))
                    .collect();

                // Extract fields
                let table_type_id: Option<String> = row.try_get("table_type_id").ok();
                let field_id: Option<String> = row.try_get("field_id").ok(); // Added field_id
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
                    "fieldId": field_id,
                    "requiredPackages": packages,
                    "customTags": custom_tags,
                    "chapters": chapters,
                    "sections": sections,
                    "subsections": subsections
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
                    "customTags": custom_tags,
                    "providedCommands": provided_commands,
                    "topics": topics,
                    "requiredPackages": required_packages
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
                    "customTags": custom_tags,
                    "requiredPackages": required_packages,
                    "providedCommands": provided_commands
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
                let preamble_type_id: Option<String> = r.try_get("preamble_type_id").ok();
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
                    "preambleTypeId": preamble_type_id,
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
                    "requiredPackages": required_packages,
                    "commandTypes": command_types,
                    "providedCommands": provided_commands
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
        _ => return Err(format!("Unknown resource type: {}", resource_type)),
    }

    Ok(None)
}

#[cfg(test)]
mod typed_metadata_round_trip_tests {
    use super::*;
    use serde_json::{json, Value};
    use sqlx::sqlite::SqlitePoolOptions;

    async fn test_manager() -> DatabaseManager {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("in-memory metadata database");
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await
            .expect("enable foreign keys");
        DatabaseManager::init_schema(&pool)
            .await
            .expect("initialize metadata schema");
        sqlx::query("INSERT INTO collections (name, type) VALUES ('metadata-tests', 'files')")
            .execute(&pool)
            .await
            .expect("test collection");

        DatabaseManager {
            pool,
            path: String::new(),
        }
    }

    async fn add_resource(
        manager: &DatabaseManager,
        id: &str,
        resource_type: &str,
        metadata: Value,
    ) {
        sqlx::query(
            "INSERT INTO resources (id, path, type, collection, metadata)
             VALUES (?, ?, ?, 'metadata-tests', ?)",
        )
        .bind(id)
        .bind(format!("/metadata-tests/{id}.tex"))
        .bind(resource_type)
        .bind(metadata.to_string())
        .execute(&manager.pool)
        .await
        .expect("insert test resource");
    }

    async fn add_hierarchy(manager: &DatabaseManager) {
        sqlx::query(
            "INSERT INTO chapters (id, name, field_id, collection)
             VALUES ('metadata-chapter', 'Metadata chapter', 'algebra', 'metadata-tests')",
        )
        .execute(&manager.pool)
        .await
        .expect("test chapter");
        sqlx::query(
            "INSERT INTO sections (id, name, chapter_id, collection)
             VALUES ('metadata-section', 'Metadata section', 'metadata-chapter', 'metadata-tests')",
        )
        .execute(&manager.pool)
        .await
        .expect("test section");
        sqlx::query(
            "INSERT INTO subsections (id, name, section_id, collection)
             VALUES ('metadata-subsection', 'Metadata subsection', 'metadata-section', 'metadata-tests')",
        )
        .execute(&manager.pool)
        .await
        .expect("test subsection");
    }

    async fn save(
        manager: &DatabaseManager,
        id: &str,
        resource_type: &str,
        metadata: Value,
    ) -> Result<Value, String> {
        save_typed_metadata_in_pool(
            &manager.pool,
            id.to_string(),
            resource_type.to_string(),
            metadata,
        )
        .await
    }

    async fn load(manager: &DatabaseManager, id: &str, resource_type: &str) -> Value {
        load_typed_metadata_with_manager(manager, id.to_string(), resource_type.to_string())
            .await
            .expect("load typed metadata")
            .expect("typed metadata row")
    }

    fn assert_fields(expected: &Value, actual: &Value, fields: &[&str]) {
        for field in fields {
            if let (Some(Value::Array(expected_items)), Some(Value::Array(actual_items))) =
                (expected.get(*field), actual.get(*field))
            {
                let mut expected_items = expected_items.clone();
                let mut actual_items = actual_items.clone();
                expected_items.sort_by_key(Value::to_string);
                actual_items.sort_by_key(Value::to_string);
                assert_eq!(
                    actual_items, expected_items,
                    "round-trip mismatch for {field}"
                );
                continue;
            }
            assert_eq!(
                actual.get(*field),
                expected.get(*field),
                "round-trip mismatch for {field}"
            );
        }
    }

    #[tokio::test]
    async fn file_hierarchy_round_trip_clears_the_final_checked_items() {
        let manager = test_manager().await;
        add_hierarchy(&manager).await;
        add_resource(
            &manager,
            "file-resource",
            "file",
            json!({
                "preamble": "builtin:fragment",
                "legacyOnly": "preserve-me",
                "field": "stale-field",
                "solved_prooved": false,
                "description": "stale description",
                "taxonomy": {"chapter": {"id": "stale"}}
            }),
        )
        .await;

        let populated = json!({
            "fileTypeId": "exercise",
            "fieldId": "algebra",
            "difficulty": 4,
            "solvedProoved": true,
            "buildCommand": "xelatex",
            "fileDescription": "Round trip",
            "chapters": ["metadata-chapter"],
            "sections": ["metadata-section"],
            "subsections": ["metadata-subsection"],
            "exerciseTypes": ["proof"],
            "customTags": ["round-trip"],
            "field": "legacy-in-payload",
            "taxonomy": {"chapter": {"id": "legacy-in-payload"}}
        });
        let persisted = save(&manager, "file-resource", "file", populated.clone())
            .await
            .expect("save populated file metadata");
        let loaded = load(&manager, "file-resource", "file").await;
        assert_fields(
            &populated,
            &loaded,
            &[
                "fileTypeId",
                "fieldId",
                "difficulty",
                "solvedProoved",
                "buildCommand",
                "fileDescription",
                "chapters",
                "sections",
                "subsections",
                "exerciseTypes",
                "customTags",
            ],
        );
        assert_eq!(persisted["preamble"], "builtin:fragment");
        assert_eq!(persisted["legacyOnly"], "preserve-me");
        for removed_alias in ["field", "solved_prooved", "description", "taxonomy"] {
            assert!(persisted.get(removed_alias).is_none());
        }

        let stored_json: String =
            sqlx::query_scalar("SELECT metadata FROM resources WHERE id = 'file-resource'")
                .fetch_one(&manager.pool)
                .await
                .expect("stored resource metadata");
        assert_eq!(
            serde_json::from_str::<Value>(&stored_json).expect("valid stored JSON"),
            persisted
        );

        let invalid = save(
            &manager,
            "file-resource",
            "file",
            json!({"difficulty": 1, "chapters": ["missing-chapter"]}),
        )
        .await;
        let invalid_error = invalid.expect_err("invalid hierarchy IDs must roll back");
        assert!(
            invalid_error.contains("file.chapters")
                && invalid_error.contains("missing-chapter")
                && invalid_error.contains("chapters.id"),
            "invalid reference error lacked actionable context: {invalid_error}"
        );
        let after_rollback = load(&manager, "file-resource", "file").await;
        assert_eq!(after_rollback["difficulty"], 4);
        assert_eq!(after_rollback["chapters"], json!(["metadata-chapter"]));
        let json_after_rollback: String =
            sqlx::query_scalar("SELECT metadata FROM resources WHERE id = 'file-resource'")
                .fetch_one(&manager.pool)
                .await
                .expect("resource JSON after rollback");
        assert_eq!(
            serde_json::from_str::<Value>(&json_after_rollback)
                .expect("valid resource JSON after rollback"),
            persisted
        );

        // This mirrors the forms, which omit an empty selection from JSON.
        // Full-snapshot normalization must still delete every old junction.
        let cleared = save(
            &manager,
            "file-resource",
            "file",
            json!({"difficulty": 2, "solvedProoved": false}),
        )
        .await
        .expect("clear file hierarchy");
        let loaded_cleared = load(&manager, "file-resource", "file").await;
        for relation in [
            "chapters",
            "sections",
            "subsections",
            "exerciseTypes",
            "customTags",
        ] {
            assert_eq!(
                loaded_cleared[relation],
                json!([]),
                "{relation} was not cleared"
            );
            assert_eq!(
                cleared[relation],
                json!([]),
                "{relation} JSON was not normalized"
            );
        }
    }

    #[tokio::test]
    async fn all_hierarchy_forms_replace_and_clear_checkbox_relations() {
        let manager = test_manager().await;
        add_hierarchy(&manager).await;

        for (resource_type, id, scalar) in [
            (
                "document",
                "document-resource",
                json!({"title": "Document"}),
            ),
            ("table", "table-resource", json!({"caption": "Table"})),
            ("figure", "figure-resource", json!({"caption": "Figure"})),
        ] {
            add_resource(&manager, id, resource_type, json!({})).await;
            let mut populated = scalar.as_object().expect("scalar object").clone();
            populated.insert("fieldId".into(), json!("algebra"));
            populated.insert("chapters".into(), json!(["metadata-chapter"]));
            populated.insert("sections".into(), json!(["metadata-section"]));
            populated.insert("subsections".into(), json!(["metadata-subsection"]));
            save(&manager, id, resource_type, Value::Object(populated))
                .await
                .unwrap_or_else(|error| panic!("save {resource_type}: {error}"));
            let loaded = load(&manager, id, resource_type).await;
            assert_eq!(loaded["chapters"], json!(["metadata-chapter"]));
            assert_eq!(loaded["sections"], json!(["metadata-section"]));
            assert_eq!(loaded["subsections"], json!(["metadata-subsection"]));

            save(&manager, id, resource_type, scalar)
                .await
                .unwrap_or_else(|error| panic!("clear {resource_type}: {error}"));
            let cleared = load(&manager, id, resource_type).await;
            assert_eq!(cleared["chapters"], json!([]));
            assert_eq!(cleared["sections"], json!([]));
            assert_eq!(cleared["subsections"], json!([]));
        }
    }

    #[tokio::test]
    async fn metadata_reference_preflight_normalizes_ids_and_reports_exact_failures() {
        let manager = test_manager().await;
        add_hierarchy(&manager).await;
        add_resource(&manager, "preflight-file", "file", json!({"keep": true})).await;

        let normalized = save(
            &manager,
            "preflight-file",
            "file",
            json!({
                "fieldId": " algebra ",
                "chapters": ["metadata-chapter", " metadata-chapter ", ""],
                "solvedProoved": false
            }),
        )
        .await
        .expect("valid references should be trimmed and de-duplicated");
        assert_eq!(normalized["fieldId"], "algebra");
        assert_eq!(normalized["chapters"], json!(["metadata-chapter"]));

        let invalid_scalar = save(
            &manager,
            "preflight-file",
            "file",
            json!({"fileTypeId": "missing-file-type"}),
        )
        .await
        .expect_err("a stale scalar lookup ID must fail before writes");
        assert!(
            invalid_scalar.contains("file.fileTypeId")
                && invalid_scalar.contains("missing-file-type")
                && invalid_scalar.contains("file_types.id"),
            "unexpected scalar reference error: {invalid_scalar}"
        );

        let invalid_array = save(
            &manager,
            "preflight-file",
            "file",
            json!({"chapters": [42]}),
        )
        .await
        .expect_err("non-string relation values must not be silently ignored");
        assert!(
            invalid_array.contains("file.chapters") && invalid_array.contains("only string IDs"),
            "unexpected array reference error: {invalid_array}"
        );

        let after_failures = load(&manager, "preflight-file", "file").await;
        assert_eq!(after_failures["fieldId"], "algebra");
        assert_eq!(after_failures["chapters"], json!(["metadata-chapter"]));
        let stored_json: String =
            sqlx::query_scalar("SELECT metadata FROM resources WHERE id = 'preflight-file'")
                .fetch_one(&manager.pool)
                .await
                .expect("resource JSON after failed preflights");
        assert_eq!(
            serde_json::from_str::<Value>(&stored_json).expect("valid resource JSON"),
            normalized
        );

        let type_mismatch = save(&manager, "preflight-file", "table", json!({}))
            .await
            .expect_err("the editor must not write a different typed table");
        assert!(
            type_mismatch.contains("Resource type mismatch")
                && type_mismatch.contains("database has 'file'")
                && type_mismatch.contains("save requested 'table'"),
            "unexpected type mismatch error: {type_mismatch}"
        );
    }

    #[tokio::test]
    async fn visible_defaults_are_persisted_and_required_names_are_validated() {
        let manager = test_manager().await;

        add_resource(&manager, "default-file", "file", json!({})).await;
        let saved_file = save(&manager, "default-file", "file", json!({}))
            .await
            .expect("save default file metadata");
        assert_eq!(saved_file["solvedProoved"], false);
        assert_eq!(
            load(&manager, "default-file", "file").await["solvedProoved"],
            false
        );
        let decimal_error = save(&manager, "default-file", "file", json!({"difficulty": 2.5}))
            .await
            .expect_err("decimal integer fields must be rejected");
        assert!(decimal_error.contains("whole number"));

        add_resource(&manager, "default-table", "table", json!({})).await;
        let saved_table = save(&manager, "default-table", "table", json!({}))
            .await
            .expect("save default table metadata");
        assert_eq!(saved_table["environment"], "tabular");
        assert_eq!(
            load(&manager, "default-table", "table").await["environment"],
            "tabular"
        );

        for (resource_type, id, name) in [
            ("command", "default-command", "\\defaultcommand"),
            ("package", "default-package", "default-package"),
            ("preamble", "default-preamble", "Default preamble"),
        ] {
            add_resource(&manager, id, resource_type, json!({})).await;
            save(&manager, id, resource_type, json!({"name": name}))
                .await
                .unwrap_or_else(|error| panic!("save default {resource_type}: {error}"));
            let loaded = load(&manager, id, resource_type).await;
            assert_eq!(loaded["builtIn"], false, "{resource_type} builtIn");
            if resource_type == "preamble" {
                for flag in [
                    "useBibliography",
                    "makeIndex",
                    "makeGlossaries",
                    "hasToc",
                    "hasLot",
                    "hasLof",
                ] {
                    assert_eq!(loaded[flag], false, "preamble {flag}");
                }
            }
        }

        for (resource_type, id) in [
            ("command", "missing-command-name"),
            ("package", "missing-package-name"),
            ("class", "missing-class-name"),
            ("preamble", "missing-preamble-name"),
        ] {
            add_resource(&manager, id, resource_type, json!({})).await;
            let error = save(&manager, id, resource_type, json!({}))
                .await
                .expect_err("required name must be rejected");
            assert!(
                error.contains("name is required"),
                "unexpected error: {error}"
            );
        }
    }

    #[tokio::test]
    async fn visible_scalar_and_list_fields_round_trip_for_every_resource_form() {
        let manager = test_manager().await;

        let cases: Vec<(&str, &str, Value, Vec<&str>)> = vec![
            (
                "document",
                "document-fields",
                json!({
                    "title": "Notes", "documentTypeId": "notes", "fieldId": "algebra",
                    "date": "2026-07-16", "buildCommand": "lualatex",
                    "bibliography": "refs.bib", "description": "Description",
                    "customTags": ["document-tag"]
                }),
                vec![
                    "title",
                    "documentTypeId",
                    "fieldId",
                    "date",
                    "buildCommand",
                    "bibliography",
                    "description",
                    "customTags",
                ],
            ),
            (
                "table",
                "table-fields",
                json!({
                    "tableTypeId": "data", "fieldId": "algebra", "date": "2026-07-16",
                    "caption": "Results", "description": "Description", "environment": "tabularx",
                    "placement": "htbp", "label": "tab:results", "width": "0.9\\textwidth",
                    "alignment": "lcr", "rows": 3, "columns": 4,
                    "requiredPackages": ["booktabs"], "customTags": ["table-tag"]
                }),
                vec![
                    "tableTypeId",
                    "fieldId",
                    "date",
                    "caption",
                    "description",
                    "environment",
                    "placement",
                    "label",
                    "width",
                    "alignment",
                    "rows",
                    "columns",
                    "requiredPackages",
                    "customTags",
                ],
            ),
            (
                "figure",
                "figure-fields",
                json!({
                    "figureTypeId": "image", "fieldId": "algebra", "date": "2026-07-16",
                    "environment": "figure", "caption": "Plot", "description": "Description",
                    "width": "8cm", "height": "5cm", "options": "scale=.8", "tikzStyle": "plot",
                    "label": "fig:plot", "placement": "htbp", "alignment": "centering",
                    "requiredPackages": ["graphicx"], "customTags": ["figure-tag"]
                }),
                vec![
                    "figureTypeId",
                    "fieldId",
                    "date",
                    "environment",
                    "caption",
                    "description",
                    "width",
                    "height",
                    "options",
                    "tikzStyle",
                    "label",
                    "placement",
                    "alignment",
                    "requiredPackages",
                    "customTags",
                ],
            ),
            (
                "command",
                "command-fields",
                json!({
                    "name": "\\\\mycommand", "commandTypeId": "newcommand", "argumentsNum": 2,
                    "optionalArgument": "default", "content": "#1+#2", "example": "example",
                    "description": "Description", "builtIn": true,
                    "requiredPackages": ["xcolor"], "customTags": ["command-tag"]
                }),
                vec![
                    "name",
                    "commandTypeId",
                    "argumentsNum",
                    "optionalArgument",
                    "content",
                    "example",
                    "description",
                    "builtIn",
                    "requiredPackages",
                    "customTags",
                ],
            ),
            (
                "package",
                "package-fields",
                json!({
                    "name": "metadata-package", "topicId": "math", "date": "2026-07-16",
                    "content": "content", "description": "Description", "options": "option",
                    "builtIn": true, "documentation": "https://example.invalid", "example": "example",
                    "topics": ["math", "graphics"], "providedCommands": ["\\\\pkgcmd"],
                    "requiredPackages": ["package-only-dependency"], "customTags": ["package-tag"]
                }),
                vec![
                    "name",
                    "topicId",
                    "date",
                    "content",
                    "description",
                    "options",
                    "builtIn",
                    "documentation",
                    "example",
                    "topics",
                    "providedCommands",
                    "requiredPackages",
                    "customTags",
                ],
            ),
            (
                "class",
                "class-fields",
                json!({
                    "name": "metadata-class", "fileTypeId": "other", "date": "2026-07-16",
                    "content": "content", "description": "Description", "engines": "pdflatex,xelatex",
                    "paperSize": "a4paper", "fontSize": 11, "geometry": "margin=2cm",
                    "options": "twoside", "languages": "english,greek",
                    "providedCommands": ["\\\\classcmd"], "requiredPackages": ["geometry"],
                    "customTags": ["class-tag"]
                }),
                vec![
                    "name",
                    "fileTypeId",
                    "date",
                    "content",
                    "description",
                    "engines",
                    "paperSize",
                    "fontSize",
                    "geometry",
                    "options",
                    "languages",
                    "providedCommands",
                    "requiredPackages",
                    "customTags",
                ],
            ),
            (
                "preamble",
                "preamble-fields",
                json!({
                    "name": "Metadata preamble", "preambleTypeId": "article", "content": "content",
                    "description": "Description", "builtIn": true, "engines": "xelatex",
                    "date": "2026-07-16", "className": "article", "paperSize": "a4paper",
                    "fontSize": 12, "options": "twoside", "languages": "greek",
                    "geometry": "margin=2cm", "author": "Author", "title": "Title",
                    "useBibliography": true, "bibCompileEngine": "biber", "makeIndex": true,
                    "makeGlossaries": true, "hasToc": true, "hasLot": true, "hasLof": true,
                    "requiredPackages": ["geometry"], "commandTypes": ["math"],
                    "providedCommands": ["\\\\preamblecmd"]
                }),
                vec![
                    "name",
                    "preambleTypeId",
                    "content",
                    "description",
                    "builtIn",
                    "engines",
                    "date",
                    "className",
                    "paperSize",
                    "fontSize",
                    "options",
                    "languages",
                    "geometry",
                    "author",
                    "title",
                    "useBibliography",
                    "bibCompileEngine",
                    "makeIndex",
                    "makeGlossaries",
                    "hasToc",
                    "hasLot",
                    "hasLof",
                    "requiredPackages",
                    "commandTypes",
                    "providedCommands",
                ],
            ),
            (
                "bibliography",
                "bibliography-fields",
                json!({
                    "entryType": "Article", "citationKey": "smith2026", "journal": "Journal",
                    "volume": "4", "series": "Series", "number": "2", "issue": "1",
                    "year": "2026", "month": "July", "publisher": "Publisher", "edition": "2",
                    "institution": "Institute", "school": "School", "organization": "Org",
                    "address": "Address", "location": "Athens", "isbn": "isbn", "issn": "issn",
                    "doi": "doi", "url": "https://example.invalid", "language": "el",
                    "title": "Title", "subtitle": "Subtitle", "booktitle": "Book", "chapter": "3",
                    "pages": "1--10", "abstract": "Abstract", "note": "Note", "crossref": "crossref",
                    "authors": ["Author One", "Author Two"], "editors": ["Editor"],
                    "translators": ["Translator"], "extras": {"custom": "value"}
                }),
                vec![
                    "entryType",
                    "citationKey",
                    "journal",
                    "volume",
                    "series",
                    "number",
                    "issue",
                    "year",
                    "month",
                    "publisher",
                    "edition",
                    "institution",
                    "school",
                    "organization",
                    "address",
                    "location",
                    "isbn",
                    "issn",
                    "doi",
                    "url",
                    "language",
                    "title",
                    "subtitle",
                    "booktitle",
                    "chapter",
                    "pages",
                    "abstract",
                    "note",
                    "crossref",
                    "authors",
                    "editors",
                    "translators",
                    "extras",
                ],
            ),
        ];

        for (resource_type, id, expected, fields) in cases {
            add_resource(&manager, id, resource_type, json!({})).await;
            save(&manager, id, resource_type, expected.clone())
                .await
                .unwrap_or_else(|error| panic!("save {resource_type}: {error}"));
            let actual = load(&manager, id, resource_type).await;
            assert_fields(&expected, &actual, &fields);
        }
    }

    #[tokio::test]
    async fn dtx_and_ins_json_text_fields_do_not_gain_extra_encoding() {
        let manager = test_manager().await;
        add_resource(&manager, "dtx-resource", "dtx", json!({})).await;
        add_resource(&manager, "ins-resource", "ins", json!({})).await;

        let dtx = json!({
            "baseName": "bundle",
            "version": "1.0",
            "providesClasses": "[\"alpha\",\"beta\"]",
            "providesPackages": "[\"gamma\"]"
        });
        save(&manager, "dtx-resource", "dtx", dtx.clone())
            .await
            .expect("first DTX save");
        let loaded_dtx = load(&manager, "dtx-resource", "dtx").await;
        assert_fields(&dtx, &loaded_dtx, &["providesClasses", "providesPackages"]);
        save(&manager, "dtx-resource", "dtx", loaded_dtx.clone())
            .await
            .expect("second DTX save");
        assert_fields(
            &dtx,
            &load(&manager, "dtx-resource", "dtx").await,
            &["providesClasses", "providesPackages"],
        );

        let ins = json!({
            "targetDtxId": "dtx-resource",
            "generatedFiles": "[\"alpha.cls\",\"gamma.sty\"]"
        });
        save(&manager, "ins-resource", "ins", ins.clone())
            .await
            .expect("first INS save");
        let loaded_ins = load(&manager, "ins-resource", "ins").await;
        assert_fields(&ins, &loaded_ins, &["targetDtxId", "generatedFiles"]);
        save(&manager, "ins-resource", "ins", loaded_ins)
            .await
            .expect("second INS save");
        assert_fields(
            &ins,
            &load(&manager, "ins-resource", "ins").await,
            &["targetDtxId", "generatedFiles"],
        );
    }

    #[tokio::test]
    async fn unknown_resource_types_and_ids_are_rejected() {
        let manager = test_manager().await;
        let unknown_type = save(&manager, "missing", "unknown", json!({})).await;
        assert!(unknown_type
            .expect_err("unknown type must fail")
            .contains("Unknown resource type"));

        let missing_resource = save(&manager, "missing", "file", json!({})).await;
        assert!(missing_resource
            .expect_err("missing resource must fail")
            .contains("Resource not found"));
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
    diagnostics::init();
    tauri::Builder::default()
        .manage(AppState {
            db_manager: std::sync::Arc::new(tokio::sync::Mutex::new(None)),
            lsp_manager: std::sync::Arc::new(tokio::sync::Mutex::new(None)),
            compilation_manager: compiler::CompilationManager::default(),
            bibliography_watcher: std::sync::Arc::new(tokio::sync::Mutex::new(
                watcher::BibliographyWatcher::new(),
            )),
        })
        .setup(|app| {
            pdf_renderer::configure_resource_dir(app.path().resource_dir().ok());
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

            // Initialize Vector Store
            let vectors_path = vectors::get_vectors_path(app.handle());
            println!("Loading Vector Store from: {:?}", vectors_path);
            let vector_store = vectors::load_store(&vectors_path).unwrap_or_else(|e| {
                eprintln!("Failed to load vector store: {}", e);
                vectors::VectorStore::new()
            });
            app.manage(VectorStoreState(std::sync::Arc::new(
                tokio::sync::Mutex::new(vector_store),
            )));
            // Initialize Agent State
            app.manage(agent::GlobalAgent(std::sync::Arc::new(
                tokio::sync::Mutex::new(None),
            )));

            let data_dir_str = data_dir.to_string_lossy().to_string();
            println!("Initializing Global DB at: {}", data_dir_str);

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match DatabaseManager::new(&data_dir_str).await {
                    Ok(manager) => {
                        let pool = manager.pool.clone();
                        let state = app_handle.state::<AppState>();
                        let mut db_guard = state.db_manager.lock().await;
                        *db_guard = Some(manager);
                        drop(db_guard);
                        backfill_and_watch_bibliography(
                            pool,
                            app_handle.clone(),
                            Arc::clone(&state.bibliography_watcher),
                        )
                        .await;
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
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(Mutex::new(watcher::GitWatcher::new()))
        .manage(pdf_renderer::PdfRendererState::default())
        .invoke_handler(tauri::generate_handler![
            git_watch_repo_cmd,
            git_unwatch_repo_cmd,
            git_read_gitignore_cmd,
            git_write_gitignore_cmd,
            open_project,
            get_db_path,
            compile_tex,
            stop_compile,
            run_synctex_command,
            run_texcount_command,
            parse_bibliography_preview_cmd,
            reparse_bibliography_resource_cmd,
            backfill_existing_bibliography_metadata_cmd,
            list_bibliography_entries_for_resource_cmd,
            search_bibliography_entries_cmd,
            list_bibliography_workspace_entries_cmd,
            update_bibliography_entry_cmd,
            batch_update_bibliography_entries_cmd,
            export_bibliography_entries_cmd,
            export_bibliography_entries_as_cmd,
            import_bibliography_content_cmd,
            lookup_bibliography_doi_cmd,
            import_bibliography_doi_cmd,
            list_bibliography_tags_cmd,
            list_bibliography_history_cmd,
            list_bibliography_entry_notes_cmd,
            save_bibliography_entry_note_cmd,
            delete_bibliography_entry_note_cmd,
            list_bibliography_entry_attachments_cmd,
            attach_bibliography_entry_file_cmd,
            delete_bibliography_entry_attachment_cmd,
            list_bibliography_pdf_annotations_cmd,
            save_bibliography_pdf_annotation_cmd,
            delete_bibliography_pdf_annotation_cmd,
            bibliography_citation_graph_cmd,
            list_bibliography_collection_federation_cmd,
            save_bibliography_collection_federation_cmd,
            delete_bibliography_collection_federation_cmd,
            watch_bibliography_resources_cmd,
            unwatch_bibliography_resources_cmd,
            set_bibliography_entry_tags_cmd,
            list_all_bibliography_sources_cmd,
            list_linked_bibliography_sources_cmd,
            link_bibliography_source_cmd,
            unlink_bibliography_source_cmd,
            detect_bibliography_declarations_cmd,
            auto_link_declared_bibliography_sources_cmd,
            scan_resource_citations_cmd,
            resolve_citation_keys_cmd,
            compile_resource_cmd,
            get_system_fonts,
            get_table_data_cmd,
            update_cell_cmd,
            vectors::store_embeddings,
            vectors::search_similar,
            vectors::build_index_cmd, // New Command
            // Agent Commands
            agent::start_agent_cmd,
            agent::stop_agent_cmd,
            // New Commands
            get_collections_cmd,
            create_collection_cmd,
            get_resources_by_collection_cmd,
            get_resources_by_collections_cmd, // Batch version for performance
            get_resource_cmd,                 // Single resource
            import_folder_cmd,
            delete_collection_cmd,
            delete_resource_cmd,
            create_resource_cmd,
            create_folder_cmd,
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
            // Package Studio Commands
            package_studio::package_studio_analyze_latex_cmd,
            package_studio::package_studio_generate_code_highlighting_cmd,
            package_studio::package_studio_generate_code_highlighting_snippet_cmd,
            package_studio::package_studio_generate_enumitem_cmd,
            package_studio::package_studio_generate_fancyhdr_cmd,
            package_studio::package_studio_generate_geometry_cmd,
            package_studio::package_studio_generate_graphicx_cmd,
            package_studio::package_studio_generate_math_cmd,
            package_studio::package_studio_generate_siunitx_cmd,
            package_studio::package_studio_generate_table_cmd,
            package_studio::package_studio_generate_xcolor_cmd,
            package_studio::package_studio_import_code_highlighting_cmd,
            package_studio::package_studio_import_enumitem_cmd,
            package_studio::package_studio_import_fancyhdr_cmd,
            package_studio::package_studio_import_geometry_cmd,
            package_studio::package_studio_import_graphicx_cmd,
            package_studio::package_studio_import_math_cmd,
            package_studio::package_studio_import_siunitx_cmd,
            package_studio::package_studio_import_xcolor_cmd,
            package_studio::package_studio_list_math_imports_cmd,
            package_studio::package_studio_list_builders_cmd,
            package_studio::package_studio_list_builder_options_cmd,
            package_studio::package_studio_plan_add_package_cmd,
            package_studio::package_studio_plan_apply_builder_configuration_cmd,
            package_studio::package_studio_plan_generated_block_cmd,
            package_studio::package_studio_plan_graphics_document_edit_cmd,
            package_studio::package_studio_plan_graphics_tikzpicture_edit_cmd,
            package_studio::package_studio_discover_graphics_tikzpictures_cmd,
            package_studio::package_studio_prepare_graphics_tikzpicture_cmd,
            package_studio::package_studio_prepare_graphics_new_drawing_cmd,
            package_studio::package_studio_plan_graphics_drawing_insert_cmd,
            package_studio::package_studio_plan_move_package_cmd,
            package_studio::package_studio_plan_remove_package_cmd,
            package_studio::stoicheia::compile_latex,
            package_studio::stoicheia::parse_tikz,
            // Preamble Types CRUD
            get_preamble_types_cmd,
            create_preamble_type_cmd,
            rename_preamble_type_cmd,
            delete_preamble_type_cmd,
            search_database_files,
            replace_database_files,
            // Local History Commands
            save_history_snapshot_cmd,
            get_file_history_cmd,
            get_snapshot_content_cmd,
            restore_snapshot_cmd,
            diff_snapshots_cmd,
            diff_with_current_cmd,
            delete_snapshot_cmd,
            cleanup_file_history_cmd,
            // Git Integration Commands
            git_detect_repo_cmd,
            git_status_cmd,
            git_stage_file_cmd,
            git_stage_all_cmd,
            git_unstage_file_cmd,
            git_commit_cmd,
            git_log_cmd,
            git_file_diff_cmd,
            git_file_at_commit_cmd,
            git_discard_changes_cmd,
            git_init_repo_cmd,
            git_get_structured_diff_cmd,
            git_get_head_content_cmd,
            git_list_branches_cmd,
            git_create_branch_cmd,
            git_switch_branch_cmd,
            git_delete_branch_cmd,
            git_rename_branch_cmd,
            git_list_remotes_cmd,
            git_fetch_remote_cmd,
            git_push_remote_cmd,
            git_pull_remote_cmd,
            // Stash Commands
            git_list_stashes_cmd,
            git_create_stash_cmd,
            git_apply_stash_cmd,
            git_drop_stash_cmd,
            git_pop_stash_cmd,
            // Commit Amend Commands
            git_get_last_commit_message_cmd,
            git_commit_amend_cmd,
            // Checkout & Cherry-pick
            git_checkout_commit_cmd,
            git_cherry_pick_cmd,
            // Blame, Tags, Revert
            git_blame_cmd,
            git_list_tags_cmd,
            git_create_tag_cmd,
            git_delete_tag_cmd,
            git_revert_commit_cmd,
            // Conflict Detection & Side-by-side Diff
            git_has_conflicts_cmd,
            git_get_conflict_files_cmd,
            git_get_blob_content_cmd,
            git_mark_conflict_resolved_cmd,
            git_get_side_by_side_diff_cmd,
            // Advanced Branch Ops
            git_merge_branch_cmd,
            commands::outline::get_outline,
            commands::project_files::get_project_files,
            commands::dtex::load_dtex_cmd,
            commands::dtex::save_dtex_cmd,
            diagnostics::frontend_debug_log_cmd,
            pdf_renderer::pdfium_renderer_status_cmd,
            pdf_renderer::pdfium_open_document_cmd,
            pdf_renderer::pdfium_render_page_cmd,
            pdf_renderer::pdfium_extract_page_text_cmd,
            pdf_renderer::pdfium_extract_outline_cmd,
            pdf_renderer::pdfium_close_document_cmd,
            pdf_renderer::pdfium_clear_documents_cmd,
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

// ============================================================================
// Local History Commands
// ============================================================================

#[tauri::command]
async fn save_history_snapshot_cmd(
    file_path: String,
    content: String,
    summary: Option<String>,
    is_manual: bool,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    history::save_snapshot(
        &manager.pool,
        &file_path,
        &content,
        summary.as_deref(),
        is_manual,
    )
    .await
}

#[tauri::command]
async fn get_file_history_cmd(
    file_path: String,
    limit: Option<i32>,
    state: State<'_, AppState>,
) -> Result<Vec<history::HistoryEntry>, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    history::get_file_history(&manager.pool, &file_path, limit).await
}

#[tauri::command]
async fn get_snapshot_content_cmd(
    snapshot_id: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    history::get_snapshot_content(&manager.pool, &snapshot_id).await
}

#[tauri::command]
async fn restore_snapshot_cmd(
    snapshot_id: String,
    state: State<'_, AppState>,
) -> Result<(String, String), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    // Returns (file_path, content) so frontend can write to disk
    history::get_restore_content(&manager.pool, &snapshot_id).await
}

#[tauri::command]
async fn diff_snapshots_cmd(
    old_id: String,
    new_id: String,
    state: State<'_, AppState>,
) -> Result<history::DiffResult, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    history::diff_snapshots(&manager.pool, &old_id, &new_id).await
}

#[tauri::command]
fn diff_with_current_cmd(snapshot_content: String, current_content: String) -> history::DiffResult {
    history::diff_with_current(&snapshot_content, &current_content)
}

#[tauri::command]
async fn delete_snapshot_cmd(
    snapshot_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    history::delete_snapshot(&manager.pool, &snapshot_id).await
}

#[tauri::command]
async fn cleanup_file_history_cmd(
    file_path: String,
    keep_count: i32,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    let db_guard = state.db_manager.lock().await;
    let manager = db_guard.as_ref().ok_or("Database not initialized")?;

    history::cleanup_old_snapshots(&manager.pool, &file_path, keep_count).await
}

// ============================================================================
// Git Integration Commands
// ============================================================================

#[tauri::command]
fn git_detect_repo_cmd(path: String) -> Result<Option<git::GitRepoInfo>, String> {
    git::detect_repo(&path)
}

#[tauri::command]
fn git_status_cmd(repo_path: String) -> Result<Vec<git::GitFileStatus>, String> {
    git::get_status(&repo_path)
}

#[tauri::command]
fn git_stage_file_cmd(repo_path: String, file_path: String) -> Result<(), String> {
    git::stage_file(&repo_path, &file_path)
}

#[tauri::command]
fn git_stage_all_cmd(repo_path: String) -> Result<(), String> {
    git::stage_all(&repo_path)
}

#[tauri::command]
fn git_unstage_file_cmd(repo_path: String, file_path: String) -> Result<(), String> {
    git::unstage_file(&repo_path, &file_path)
}

#[tauri::command]
fn git_commit_cmd(repo_path: String, message: String) -> Result<String, String> {
    git::commit(&repo_path, &message)
}

#[tauri::command]
fn git_log_cmd(
    repo_path: String,
    limit: Option<i32>,
    all: Option<bool>,
) -> Result<Vec<git::GitCommitInfo>, String> {
    let all = all.unwrap_or(false);
    git::get_log(&repo_path, limit, all)
}

#[tauri::command]
fn git_file_diff_cmd(repo_path: String, file_path: String) -> Result<String, String> {
    git::get_file_diff(&repo_path, &file_path)
}

#[tauri::command]
fn git_file_at_commit_cmd(
    repo_path: String,
    commit_id: String,
    file_path: String,
) -> Result<String, String> {
    git::get_file_at_commit(&repo_path, &commit_id, &file_path)
}

#[tauri::command]
fn git_discard_changes_cmd(repo_path: String, file_path: String) -> Result<(), String> {
    git::discard_changes(&repo_path, &file_path)
}

#[tauri::command]
fn git_init_repo_cmd(path: String) -> Result<git::GitRepoInfo, String> {
    git::init_repo(&path)
}

#[tauri::command]
fn git_get_structured_diff_cmd(
    repo_path: String,
    file_path: String,
) -> Result<git::StructuredDiff, String> {
    git::get_structured_diff(&repo_path, &file_path)
}

#[tauri::command]
fn git_get_head_content_cmd(repo_path: String, file_path: String) -> Result<String, String> {
    git::get_head_file_content(&repo_path, &file_path)
}

#[tauri::command]
fn git_list_branches_cmd(repo_path: String) -> Result<Vec<git::BranchInfo>, String> {
    git::list_branches(&repo_path)
}

#[tauri::command]
fn git_create_branch_cmd(repo_path: String, name: String) -> Result<(), String> {
    git::create_branch(&repo_path, &name)
}

#[tauri::command]
fn git_switch_branch_cmd(repo_path: String, name: String) -> Result<(), String> {
    git::switch_branch(&repo_path, &name)
}

#[tauri::command]
fn git_delete_branch_cmd(repo_path: String, name: String) -> Result<(), String> {
    git::delete_branch(&repo_path, &name)
}

#[tauri::command]
fn git_merge_branch_cmd(repo_path: String, branch_name: String) -> Result<String, String> {
    git::merge_branch(&repo_path, &branch_name)
}

#[tauri::command]
fn git_rename_branch_cmd(
    repo_path: String,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    git::rename_branch(&repo_path, &old_name, &new_name)
}

#[tauri::command]
fn git_list_remotes_cmd(repo_path: String) -> Result<Vec<git::RemoteInfo>, String> {
    git::list_remotes(&repo_path)
}

#[tauri::command]
fn git_fetch_remote_cmd(repo_path: String, remote: String) -> Result<(), String> {
    git::fetch_remote(&repo_path, &remote)
}

#[tauri::command]
fn git_push_remote_cmd(repo_path: String, remote: String, branch: String) -> Result<(), String> {
    git::push_to_remote(&repo_path, &remote, &branch)
}

#[tauri::command]
fn git_pull_remote_cmd(repo_path: String, remote: String, branch: String) -> Result<(), String> {
    git::pull_from_remote(&repo_path, &remote, &branch)
}

// ============================================================================
// Stash Commands
// ============================================================================

#[tauri::command]
fn git_list_stashes_cmd(repo_path: String) -> Result<Vec<git::StashInfo>, String> {
    git::list_stashes(&repo_path)
}

#[tauri::command]
fn git_create_stash_cmd(repo_path: String, message: Option<String>) -> Result<String, String> {
    git::create_stash(&repo_path, message.as_deref()).map(|oid| oid.to_string())
}

#[tauri::command]
fn git_apply_stash_cmd(repo_path: String, index: usize) -> Result<(), String> {
    git::apply_stash(&repo_path, index)
}

#[tauri::command]
fn git_drop_stash_cmd(repo_path: String, index: usize) -> Result<(), String> {
    git::drop_stash(&repo_path, index)
}

#[tauri::command]
fn git_pop_stash_cmd(repo_path: String, index: usize) -> Result<(), String> {
    git::pop_stash(&repo_path, index)
}

// ============================================================================
// Commit Amend Commands
// ============================================================================

#[tauri::command]
fn git_get_last_commit_message_cmd(repo_path: String) -> Result<String, String> {
    git::get_last_commit_message(&repo_path)
}

#[tauri::command]
fn git_commit_amend_cmd(repo_path: String, message: String) -> Result<String, String> {
    git::commit_amend(&repo_path, &message)
}

#[tauri::command]
fn git_checkout_commit_cmd(repo_path: String, commit_id: String) -> Result<(), String> {
    git::checkout_commit(&repo_path, &commit_id)
}

#[tauri::command]
fn git_cherry_pick_cmd(repo_path: String, commit_id: String) -> Result<String, String> {
    git::cherry_pick(&repo_path, &commit_id)
}

// ============================================================================
// Git Blame, Tags, Revert Commands
// ============================================================================

#[tauri::command]
fn git_blame_cmd(repo_path: String, file_path: String) -> Result<Vec<git::BlameInfo>, String> {
    git::git_blame(&repo_path, &file_path)
}

#[tauri::command]
fn git_list_tags_cmd(repo_path: String) -> Result<Vec<git::TagInfo>, String> {
    git::list_tags(&repo_path)
}

#[tauri::command]
fn git_create_tag_cmd(
    repo_path: String,
    name: String,
    commit_id: Option<String>,
    message: Option<String>,
) -> Result<(), String> {
    git::create_tag(&repo_path, &name, commit_id.as_deref(), message.as_deref())
}

#[tauri::command]
fn git_delete_tag_cmd(repo_path: String, name: String) -> Result<(), String> {
    git::delete_tag(&repo_path, &name)
}

#[tauri::command]
fn git_revert_commit_cmd(repo_path: String, commit_id: String) -> Result<String, String> {
    git::revert_commit(&repo_path, &commit_id)
}

// ============================================================================
// Conflict Detection & Side-by-side Diff Commands
// ============================================================================

#[tauri::command]
fn git_has_conflicts_cmd(repo_path: String) -> Result<bool, String> {
    git::has_conflicts(&repo_path)
}

#[tauri::command]
fn git_get_conflict_files_cmd(repo_path: String) -> Result<Vec<git::ConflictFile>, String> {
    git::get_conflict_files(&repo_path)
}

#[tauri::command]
fn git_get_blob_content_cmd(repo_path: String, blob_oid: String) -> Result<String, String> {
    git::get_blob_content(&repo_path, &blob_oid)
}

#[tauri::command]
fn git_mark_conflict_resolved_cmd(repo_path: String, file_path: String) -> Result<(), String> {
    git::mark_conflict_resolved(&repo_path, &file_path)
}

#[tauri::command]
fn git_get_side_by_side_diff_cmd(
    repo_path: String,
    file_path: String,
) -> Result<Vec<git::SideBySideLine>, String> {
    git::get_side_by_side_diff(&repo_path, &file_path)
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

#[tauri::command]
async fn git_watch_repo_cmd(
    watcher: State<'_, Mutex<watcher::GitWatcher>>,
    app_handle: tauri::AppHandle,
    repo_path: String,
) -> Result<(), String> {
    let watcher = watcher.lock().await;
    watcher.watch(&repo_path, app_handle)
}

#[tauri::command]
async fn git_unwatch_repo_cmd(
    watcher: State<'_, Mutex<watcher::GitWatcher>>,
) -> Result<(), String> {
    let watcher = watcher.lock().await;
    watcher.unwatch();
    Ok(())
}

#[tauri::command]
fn git_read_gitignore_cmd(repo_path: String) -> Result<String, String> {
    git::read_gitignore(&repo_path)
}

#[tauri::command]
fn git_write_gitignore_cmd(repo_path: String, content: String) -> Result<(), String> {
    git::write_gitignore(&repo_path, &content)
}
