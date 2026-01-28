// ============================================================================
// Typed Metadata Database Operations
// CRUD operations for strongly-typed metadata
// ============================================================================

use crate::types::metadata::*;
use rusqlite::{params, Connection, OptionalExtension, Result};

// ============================================================================
// CREATE Operations
// ============================================================================

/// Save FileMetadata to database
pub fn save_file_metadata(
    conn: &Connection,
    resource_id: &str,
    metadata: &FileMetadata,
) -> Result<()> {
    // Insert main record
    conn.execute(
        "INSERT OR REPLACE INTO resource_files (
            resource_id, file_type_id, field_id, difficulty, date,
            solved_prooved, solution_id, bibliography, file_content,
            preamble_id, build_command, file_description
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            resource_id,
            metadata.file_type_id,
            metadata.field_id,
            metadata.difficulty,
            metadata.date,
            metadata.solved_prooved,
            metadata.solution_id,
            metadata.bibliography,
            metadata.file_content,
            metadata.preamble_id,
            metadata.build_command,
            metadata.file_description,
        ],
    )?;

    // Save chapters
    if let Some(chapters) = &metadata.chapters {
        conn.execute(
            "DELETE FROM resource_file_chapters WHERE resource_id = ?1",
            params![resource_id],
        )?;
        for chapter_id in chapters {
            conn.execute(
                "INSERT OR IGNORE INTO resource_file_chapters (resource_id, chapter_id) VALUES (?1, ?2)",
                params![resource_id, chapter_id],
            )?;
        }
    }

    // Save sections
    if let Some(sections) = &metadata.sections {
        conn.execute(
            "DELETE FROM resource_file_sections WHERE resource_id = ?1",
            params![resource_id],
        )?;
        for section_id in sections {
            conn.execute(
                "INSERT OR IGNORE INTO resource_file_sections (resource_id, section_id) VALUES (?1, ?2)",
                params![resource_id, section_id],
            )?;
        }
    }

    // Save exercise types
    if let Some(exercise_types) = &metadata.exercise_types {
        conn.execute(
            "DELETE FROM resource_file_exercise_types WHERE resource_id = ?1",
            params![resource_id],
        )?;
        for exercise_type_id in exercise_types {
            conn.execute(
                "INSERT OR IGNORE INTO resource_file_exercise_types (resource_id, exercise_type_id) VALUES (?1, ?2)",
                params![resource_id, exercise_type_id],
            )?;
        }
    }

    // Save custom tags
    if let Some(tags) = &metadata.custom_tags {
        conn.execute(
            "DELETE FROM resource_file_tags WHERE resource_id = ?1",
            params![resource_id],
        )?;
        for tag in tags {
            conn.execute(
                "INSERT OR IGNORE INTO custom_tags (tag) VALUES (?1)",
                params![tag],
            )?;
            conn.execute(
                "INSERT OR IGNORE INTO resource_file_tags (resource_id, tag) VALUES (?1, ?2)",
                params![resource_id, tag],
            )?;
        }
    }

    Ok(())
}

/// Save DocumentMetadata to database
pub fn save_document_metadata(
    conn: &Connection,
    resource_id: &str,
    metadata: &DocumentMetadata,
) -> Result<()> {
    // 1. Sanitize Inputs
    let mut field_id = metadata.field_id.as_ref().filter(|s| !s.is_empty());
    let mut document_type_id = metadata.document_type_id.as_ref().filter(|s| !s.is_empty());
    let preamble_id = metadata.preamble_id.as_ref().filter(|s| !s.is_empty());
    let solution_document_id = metadata
        .solution_document_id
        .as_ref()
        .filter(|s| !s.is_empty());

    eprintln!("[DEBUG] Saving Document: {}", resource_id);

    // 2. Validate Key Foreign Keys exist
    // Check Resource ID
    let resource_exists: bool = conn
        .query_row(
            "SELECT 1 FROM resources WHERE id = ?1",
            params![resource_id],
            |_| Ok(true),
        )
        .unwrap_or(false);

    if !resource_exists {
        eprintln!(
            "[ERROR] Resource ID {} not found in resources table!",
            resource_id
        );
        return Err(rusqlite::Error::QueryReturnedNoRows); // Or custom error
    }

    // Check Field ID
    if let Some(fid) = field_id {
        let field_exists: bool = conn
            .query_row("SELECT 1 FROM fields WHERE id = ?1", params![fid], |_| {
                Ok(true)
            })
            .unwrap_or(false);

        if !field_exists {
            eprintln!("[WARNING] Field ID {} not found! Setting to NULL.", fid);
            field_id = None;
        }
    }

    // Check Document Type ID
    if let Some(dtid) = document_type_id {
        let dtype_exists: bool = conn
            .query_row(
                "SELECT 1 FROM document_types WHERE id = ?1",
                params![dtid],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !dtype_exists {
            eprintln!(
                "[WARNING] Document Type ID {} not found! Setting to NULL.",
                dtid
            );
            document_type_id = None;
        }
    }

    // Check Preamble ID
    if let Some(pid) = preamble_id {
        let preamble_exists: bool = conn
            .query_row(
                "SELECT 1 FROM resources WHERE id = ?1",
                params![pid],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !preamble_exists {
            eprintln!("[WARNING] Preamble ID {} not found! Setting to NULL.", pid);
            preamble_id = None;
        }
    }

    // Check Solution Document ID
    if let Some(sid) = solution_document_id {
        let solution_exists: bool = conn
            .query_row(
                "SELECT 1 FROM resources WHERE id = ?1",
                params![sid],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !solution_exists {
            eprintln!(
                "[WARNING] Solution Document ID {} not found! Setting to NULL.",
                sid
            );
            solution_document_id = None;
        }
    }

    eprintln!("[DEBUG] field_id (final): {:?}", field_id);
    eprintln!("[DEBUG] doc_type_id (final): {:?}", document_type_id);
    eprintln!("[DEBUG] preamble_id (final): {:?}", preamble_id);
    eprintln!("[DEBUG] solution_id (final): {:?}", solution_document_id);

    conn.execute(
        "INSERT OR REPLACE INTO resource_documents (
            resource_id, title, document_type_id,
            date, content, preamble_id, build_command,
            bibliography, description, solution_document_id, field_id
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            resource_id,
            metadata.title,
            document_type_id,
            metadata.date,
            metadata.content,
            preamble_id,
            metadata.build_command,
            metadata.bibliography,
            metadata.description,
            solution_document_id,
            field_id,
        ],
    )?;

    // Save custom tags
    if let Some(tags) = &metadata.custom_tags {
        conn.execute(
            "DELETE FROM resource_document_tags WHERE resource_id = ?1",
            params![resource_id],
        )?;
        for tag in tags {
            conn.execute(
                "INSERT OR IGNORE INTO custom_tags (tag) VALUES (?1)",
                params![tag],
            )?;
            conn.execute(
                "INSERT OR IGNORE INTO resource_document_tags (resource_id, tag) VALUES (?1, ?2)",
                params![resource_id, tag],
            )?;
        }
    }

    // Save Hierarchy
    if let Some(chapters) = &metadata.chapters {
        conn.execute(
            "DELETE FROM resource_document_chapters WHERE resource_id = ?1",
            params![resource_id],
        )?;
        for id in chapters {
            if !id.is_empty() {
                let exists: bool = conn
                    .query_row("SELECT 1 FROM chapters WHERE id = ?1", params![id], |_| {
                        Ok(true)
                    })
                    .unwrap_or(false);

                if exists {
                    eprintln!("[DEBUG] Inserting chapter FK: {}", id);
                    conn.execute("INSERT OR IGNORE INTO resource_document_chapters (resource_id, chapter_id) VALUES (?1, ?2)", params![resource_id, id])?;
                } else {
                    eprintln!("[WARNING] Skipping invalid chapter_id: {}", id);
                }
            }
        }
    }
    if let Some(sections) = &metadata.sections {
        conn.execute(
            "DELETE FROM resource_document_sections WHERE resource_id = ?1",
            params![resource_id],
        )?;
        for id in sections {
            if !id.is_empty() {
                let exists: bool = conn
                    .query_row("SELECT 1 FROM sections WHERE id = ?1", params![id], |_| {
                        Ok(true)
                    })
                    .unwrap_or(false);

                if exists {
                    eprintln!("[DEBUG] Inserting section FK: {}", id);
                    conn.execute("INSERT OR IGNORE INTO resource_document_sections (resource_id, section_id) VALUES (?1, ?2)", params![resource_id, id])?;
                } else {
                    eprintln!("[WARNING] Skipping invalid section_id: {}", id);
                }
            }
        }
    }
    if let Some(subsections) = &metadata.subsections {
        conn.execute(
            "DELETE FROM resource_document_subsections WHERE resource_id = ?1",
            params![resource_id],
        )?;
        for id in subsections {
            if !id.is_empty() {
                let exists: bool = conn
                    .query_row(
                        "SELECT 1 FROM subsections WHERE id = ?1",
                        params![id],
                        |_| Ok(true),
                    )
                    .unwrap_or(false);

                if exists {
                    eprintln!("[DEBUG] Inserting subsection FK: {}", id);
                    conn.execute("INSERT OR IGNORE INTO resource_document_subsections (resource_id, subsection_id) VALUES (?1, ?2)", params![resource_id, id])?;
                } else {
                    eprintln!("[WARNING] Skipping invalid subsection_id: {}", id);
                }
            }
        }
    }

    Ok(())
}

// ============================================================================
// READ Operations
// ============================================================================

/// Load FileMetadata from database
pub fn load_file_metadata(conn: &Connection, resource_id: &str) -> Result<Option<FileMetadata>> {
    let mut stmt = conn.prepare(
        "SELECT file_type_id, field_id, difficulty, date, solved_prooved,
                solution_id, bibliography, file_content, preamble_id,
                build_command, file_description
         FROM resource_files WHERE resource_id = ?1",
    )?;

    let metadata = stmt
        .query_row(params![resource_id], |row| {
            Ok(FileMetadata {
                file_type_id: row.get(0)?,
                field_id: row.get(1)?,
                difficulty: row.get(2)?,
                date: row.get(3)?,
                solved_prooved: row.get(4)?,
                solution_id: row.get(5)?,
                bibliography: row.get(6)?,
                file_content: row.get(7)?,
                preamble_id: row.get(8)?,
                build_command: row.get(9)?,
                file_description: row.get(10)?,
                chapters: None,
                sections: None,
                exercise_types: None,
                required_packages: None,
                custom_tags: None,
                bib_entries: None,
            })
        })
        .optional()?;

    if let Some(mut meta) = metadata {
        // Load chapters
        let chapters: Vec<String> = conn
            .prepare("SELECT chapter_id FROM resource_file_chapters WHERE resource_id = ?1")?
            .query_map(params![resource_id], |row| row.get(0))?
            .collect::<Result<Vec<String>>>()?;
        if !chapters.is_empty() {
            meta.chapters = Some(chapters);
        }

        // Load sections
        let sections: Vec<String> = conn
            .prepare("SELECT section_id FROM resource_file_sections WHERE resource_id = ?1")?
            .query_map(params![resource_id], |row| row.get(0))?
            .collect::<Result<Vec<String>>>()?;
        if !sections.is_empty() {
            meta.sections = Some(sections);
        }

        // Load exercise types
        let exercise_types: Vec<String> = conn
            .prepare(
                "SELECT exercise_type_id FROM resource_file_exercise_types WHERE resource_id = ?1",
            )?
            .query_map(params![resource_id], |row| row.get(0))?
            .collect::<Result<Vec<String>>>()?;
        if !exercise_types.is_empty() {
            meta.exercise_types = Some(exercise_types);
        }

        // Load custom tags
        let tags: Vec<String> = conn
            .prepare("SELECT tag FROM resource_file_tags WHERE resource_id = ?1")?
            .query_map(params![resource_id], |row| row.get(0))?
            .collect::<Result<Vec<String>>>()?;
        if !tags.is_empty() {
            meta.custom_tags = Some(tags);
        }

        return Ok(Some(meta));
    }

    Ok(None)
}

/// Load DocumentMetadata from database
pub fn load_document_metadata(
    conn: &Connection,
    resource_id: &str,
) -> Result<Option<DocumentMetadata>> {
    let mut stmt = conn.prepare(
        "SELECT title, document_type_id,
                date, content, preamble_id, build_command,
                bibliography, description, solution_document_id, field_id
         FROM resource_documents WHERE resource_id = ?1",
    )?;

    let metadata = stmt
        .query_row(params![resource_id], |row| {
            Ok(DocumentMetadata {
                title: row.get(0)?,
                document_type_id: row.get(1)?,
                date: row.get(2)?,
                content: row.get(3)?,
                preamble_id: row.get(4)?,
                build_command: row.get(5)?,
                bibliography: row.get(6)?,
                description: row.get(7)?,
                solution_document_id: row.get(8)?,
                included_files: None,
                custom_tags: None,
                bib_entries: None,
                field_id: row.get(9)?,
                chapters: None,
                sections: None,
                subsections: None,
            })
        })
        .optional()?;

    if let Some(mut meta) = metadata {
        // Load custom tags
        let tags: Vec<String> = conn
            .prepare("SELECT tag FROM resource_document_tags WHERE resource_id = ?1")?
            .query_map(params![resource_id], |row| row.get(0))?
            .collect::<Result<Vec<String>>>()?;
        if !tags.is_empty() {
            meta.custom_tags = Some(tags);
        }

        // Load Hierarchy
        meta.chapters = Some(
            conn.prepare(
                "SELECT chapter_id FROM resource_document_chapters WHERE resource_id = ?1",
            )?
            .query_map(params![resource_id], |row| row.get(0))?
            .collect::<Result<Vec<String>>>()?,
        );
        meta.sections = Some(
            conn.prepare(
                "SELECT section_id FROM resource_document_sections WHERE resource_id = ?1",
            )?
            .query_map(params![resource_id], |row| row.get(0))?
            .collect::<Result<Vec<String>>>()?,
        );
        meta.subsections = Some(
            conn.prepare(
                "SELECT subsection_id FROM resource_document_subsections WHERE resource_id = ?1",
            )?
            .query_map(params![resource_id], |row| row.get(0))?
            .collect::<Result<Vec<String>>>()?,
        );

        if meta
            .chapters
            .as_ref()
            .map(|v| v.is_empty())
            .unwrap_or(false)
        {
            meta.chapters = None;
        }
        if meta
            .sections
            .as_ref()
            .map(|v| v.is_empty())
            .unwrap_or(false)
        {
            meta.sections = None;
        }
        if meta
            .subsections
            .as_ref()
            .map(|v| v.is_empty())
            .unwrap_or(false)
        {
            meta.subsections = None;
        }

        return Ok(Some(meta));
    }

    Ok(None)
}

// ============================================================================
// Generic load function by resource type
// ============================================================================

pub fn load_typed_metadata(
    conn: &Connection,
    resource_id: &str,
    resource_type: &str,
) -> Result<Option<TypedMetadata>> {
    match resource_type {
        "file" => {
            if let Some(meta) = load_file_metadata(conn, resource_id)? {
                Ok(Some(TypedMetadata::File(meta)))
            } else {
                Ok(None)
            }
        }
        "document" => {
            if let Some(meta) = load_document_metadata(conn, resource_id)? {
                Ok(Some(TypedMetadata::Document(meta)))
            } else {
                Ok(None)
            }
        }
        "table" => {
            use crate::db::typed_metadata_helpers::load_table_metadata;
            if let Some(meta) = load_table_metadata(conn, resource_id)? {
                Ok(Some(TypedMetadata::Table(meta)))
            } else {
                Ok(None)
            }
        }
        "figure" => {
            use crate::db::typed_metadata_helpers::load_figure_metadata;
            if let Some(meta) = load_figure_metadata(conn, resource_id)? {
                Ok(Some(TypedMetadata::Figure(meta)))
            } else {
                Ok(None)
            }
        }
        _ => Ok(None),
    }
}
