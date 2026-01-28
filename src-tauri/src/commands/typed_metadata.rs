// ============================================================================
// Typed Metadata Tauri Commands
// ============================================================================

use rusqlite::Connection;
use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::State;

use crate::db::typed_metadata::*;
use crate::db::typed_metadata_helpers::*;
use crate::types::metadata::*;

// ============================================================================
// Metadata CRUD Commands
// ============================================================================

#[tauri::command]
pub async fn save_typed_metadata_cmd(
    db: State<'_, Mutex<Connection>>,
    resource_id: String,
    resource_type: String,
    metadata: Value,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    match resource_type.as_str() {
        "file" => {
            let meta: FileMetadata = serde_json::from_value(metadata)
                .map_err(|e| format!("Failed to parse FileMetadata: {}", e))?;
            save_file_metadata(&conn, &resource_id, &meta).map_err(|e| e.to_string())?;
        }
        "document" => {
            let meta: DocumentMetadata = serde_json::from_value(metadata)
                .map_err(|e| format!("Failed to parse DocumentMetadata: {}", e))?;
            save_document_metadata(&conn, &resource_id, &meta).map_err(|e| e.to_string())?;
        }
        "table" => {
            let meta: TableMetadata = serde_json::from_value(metadata)
                .map_err(|e| format!("Failed to parse TableMetadata: {}", e))?;
            save_table_metadata(&conn, &resource_id, &meta).map_err(|e| e.to_string())?;
        }
        "figure" => {
            let meta: FigureMetadata = serde_json::from_value(metadata)
                .map_err(|e| format!("Failed to parse FigureMetadata: {}", e))?;
            save_figure_metadata(&conn, &resource_id, &meta).map_err(|e| e.to_string())?;
        }
        "command" => {
            let meta: CommandMetadata = serde_json::from_value(metadata)
                .map_err(|e| format!("Failed to parse CommandMetadata: {}", e))?;
            save_command_metadata(&conn, &resource_id, &meta).map_err(|e| e.to_string())?;
        }
        "package" => {
            let meta: PackageMetadata = serde_json::from_value(metadata)
                .map_err(|e| format!("Failed to parse PackageMetadata: {}", e))?;
            save_package_metadata(&conn, &resource_id, &meta).map_err(|e| e.to_string())?;
        }
        "preamble" => {
            let meta: PreambleMetadata = serde_json::from_value(metadata)
                .map_err(|e| format!("Failed to parse PreambleMetadata: {}", e))?;
            save_preamble_metadata(&conn, &resource_id, &meta).map_err(|e| e.to_string())?;
        }
        "class" => {
            let meta: ClassMetadata = serde_json::from_value(metadata)
                .map_err(|e| format!("Failed to parse ClassMetadata: {}", e))?;
            save_class_metadata(&conn, &resource_id, &meta).map_err(|e| e.to_string())?;
        }
        _ => return Err(format!("Unknown resource type: {}", resource_type)),
    }

    Ok(())
}

#[tauri::command]
pub async fn load_typed_metadata_cmd(
    db: State<'_, Mutex<Connection>>,
    resource_id: String,
    resource_type: String,
) -> Result<Option<Value>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let result =
        load_typed_metadata(&conn, &resource_id, &resource_type).map_err(|e| e.to_string())?;

    match result {
        Some(meta) => Ok(Some(serde_json::to_value(meta).map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn migrate_resource_to_typed_cmd(
    db: State<'_, Mutex<Connection>>,
    resource_id: String,
    resource_type: String,
    json_metadata: Value,
) -> Result<(), String> {
    save_typed_metadata_cmd(db, resource_id, resource_type, json_metadata).await
}

// ============================================================================
// Lookup Data Commands
// ============================================================================

#[tauri::command]
pub async fn get_fields_cmd(
    db: State<'_, Mutex<Connection>>,
    collection_name: Option<String>,
) -> Result<Vec<Value>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let mut stmt = if let Some(col) = &collection_name {
        conn.prepare(
            "SELECT id, name FROM fields WHERE collection IS NULL OR collection = ?1 ORDER BY name",
        )
        .map_err(|e| e.to_string())?
    } else {
        conn.prepare("SELECT id, name FROM fields WHERE collection IS NULL ORDER BY name")
            .map_err(|e| e.to_string())?
    };

    let rows = if let Some(col) = collection_name {
        stmt.query_map(params![col], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            Ok(json!({"id": id, "name": name}))
        })
    } else {
        stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            Ok(json!({"id": id, "name": name}))
        })
    }
    .map_err(|e| e.to_string())?;

    let mut fields = Vec::new();
    for row in rows {
        fields.push(row.map_err(|e| e.to_string())?);
    }

    Ok(fields)
}

#[tauri::command]
pub async fn get_chapters_cmd(
    db: State<'_, Mutex<Connection>>,
    field_id: Option<String>,
) -> Result<Vec<Value>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let mut chapters = Vec::new();

    if let Some(fid) = field_id {
        let mut stmt = conn
            .prepare("SELECT id, name, field_id FROM chapters WHERE field_id = ?1 ORDER BY name")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([&fid], |row| {
                let id: String = row.get(0)?;
                let name: String = row.get(1)?;
                let field_id: String = row.get(2)?;
                Ok(json!({"id": id, "name": name, "fieldId": field_id}))
            })
            .map_err(|e| e.to_string())?;

        for row in rows {
            chapters.push(row.map_err(|e| e.to_string())?);
        }
    } else {
        let mut stmt = conn
            .prepare("SELECT id, name, field_id FROM chapters ORDER BY name")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                let name: String = row.get(1)?;
                let field_id: String = row.get(2)?;
                Ok(json!({"id": id, "name": name, "fieldId": field_id}))
            })
            .map_err(|e| e.to_string())?;

        for row in rows {
            chapters.push(row.map_err(|e| e.to_string())?);
        }
    }

    Ok(chapters)
}

#[tauri::command]
pub async fn get_sections_cmd(
    db: State<'_, Mutex<Connection>>,
    chapter_id: Option<String>,
) -> Result<Vec<Value>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let mut sections = Vec::new();

    if let Some(cid) = chapter_id {
        let mut stmt = conn
            .prepare(
                "SELECT id, name, chapter_id FROM sections WHERE chapter_id = ?1 ORDER BY name",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([&cid], |row| {
                let id: String = row.get(0)?;
                let name: String = row.get(1)?;
                let chapter_id: String = row.get(2)?;
                Ok(json!({"id": id, "name": name, "chapterId": chapter_id}))
            })
            .map_err(|e| e.to_string())?;

        for row in rows {
            sections.push(row.map_err(|e| e.to_string())?);
        }
    } else {
        let mut stmt = conn
            .prepare("SELECT id, name, chapter_id FROM sections ORDER BY name")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                let name: String = row.get(1)?;
                let chapter_id: String = row.get(2)?;
                Ok(json!({"id": id, "name": name, "chapterId": chapter_id}))
            })
            .map_err(|e| e.to_string())?;

        for row in rows {
            sections.push(row.map_err(|e| e.to_string())?);
        }
    }

    Ok(sections)
}

#[tauri::command]
pub async fn get_file_types_cmd(db: State<'_, Mutex<Connection>>) -> Result<Vec<Value>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, folder_name, solvable, description FROM file_types ORDER BY name",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let folder_name: Option<String> = row.get(2)?;
            let solvable: Option<bool> = row.get(3)?;
            let description: Option<String> = row.get(4)?;
            Ok(json!({
                "id": id,
                "name": name,
                "folderName": folder_name,
                "solvable": solvable,
                "description": description
            }))
        })
        .map_err(|e| e.to_string())?;

    let mut types = Vec::new();
    for row in rows {
        types.push(row.map_err(|e| e.to_string())?);
    }

    Ok(types)
}

#[tauri::command]
pub async fn get_exercise_types_cmd(
    db: State<'_, Mutex<Connection>>,
) -> Result<Vec<Value>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, name, description FROM exercise_types ORDER BY name")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let description: Option<String> = row.get(2)?;
            Ok(json!({"id": id, "name": name, "description": description}))
        })
        .map_err(|e| e.to_string())?;

    let mut types = Vec::new();
    for row in rows {
        types.push(row.map_err(|e| e.to_string())?);
    }

    Ok(types)
}
#[tauri::command]
pub async fn get_subsections_cmd(
    db: State<'_, Mutex<Connection>>,
    section_id: Option<String>,
) -> Result<Vec<Value>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let mut subsections = Vec::new();

    if let Some(sid) = section_id {
        let mut stmt = conn
            .prepare(
                "SELECT id, name, section_id FROM subsections WHERE section_id = ?1 ORDER BY name",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([&sid], |row| {
                let id: String = row.get(0)?;
                let name: String = row.get(1)?;
                let section_id: String = row.get(2)?;
                Ok(json!({"id": id, "name": name, "sectionId": section_id}))
            })
            .map_err(|e| e.to_string())?;

        for row in rows {
            subsections.push(row.map_err(|e| e.to_string())?);
        }
    } else {
        let mut stmt = conn
            .prepare("SELECT id, name, section_id FROM subsections ORDER BY name")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                let name: String = row.get(1)?;
                let section_id: String = row.get(2)?;
                Ok(json!({"id": id, "name": name, "sectionId": section_id}))
            })
            .map_err(|e| e.to_string())?;

        for row in rows {
            subsections.push(row.map_err(|e| e.to_string())?);
        }
    }

    Ok(subsections)
}
