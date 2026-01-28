// Helper implementations for remaining resource types
use crate::types::metadata::*;
use rusqlite::{params, Connection, Result};

// ============================================================================
// TABLE Metadata Operations
// ============================================================================

pub fn save_table_metadata(
    conn: &Connection,
    resource_id: &str,
    metadata: &TableMetadata,
) -> Result<()> {
    let mut field_id = metadata.field_id.as_ref().filter(|s| !s.is_empty());

    // Check Field ID
    if let Some(fid) = field_id {
        let field_exists: bool = conn
            .query_row("SELECT 1 FROM fields WHERE id = ?1", params![fid], |_| {
                Ok(true)
            })
            .unwrap_or(false);

        if !field_exists {
            println!(
                "[WARNING] Field ID {} not found in Table save! Setting to NULL.",
                fid
            );
            field_id = None;
        }
    }

    conn.execute(
        "INSERT OR REPLACE INTO resource_tables (
            resource_id, table_type_id, date, content, caption, field_id
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            resource_id,
            metadata.table_type_id,
            metadata.date,
            metadata.content,
            metadata.caption,
            field_id,
        ],
    )?;

    // Save required packages
    if let Some(packages) = &metadata.required_packages {
        conn.execute(
            "DELETE FROM resource_table_packages WHERE resource_id = ?1",
            params![resource_id],
        )?;
        for package_id in packages {
            conn.execute(
                "INSERT OR IGNORE INTO resource_table_packages (resource_id, package_id) VALUES (?1, ?2)",
                params![resource_id, package_id],
            )?;
        }
    }

    // Save custom tags
    if let Some(tags) = &metadata.custom_tags {
        conn.execute(
            "DELETE FROM resource_table_tags WHERE resource_id = ?1",
            params![resource_id],
        )?;
        for tag in tags {
            conn.execute(
                "INSERT OR IGNORE INTO custom_tags (tag) VALUES (?1)",
                params![tag],
            )?;
            conn.execute(
                "INSERT OR IGNORE INTO resource_table_tags (resource_id, tag) VALUES (?1, ?2)",
                params![resource_id, tag],
            )?;
        }
    }

    // Save Hierarchy
    if let Some(chapters) = &metadata.chapters {
        conn.execute(
            "DELETE FROM resource_table_chapters WHERE resource_id = ?1",
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
                    conn.execute("INSERT OR IGNORE INTO resource_table_chapters (resource_id, chapter_id) VALUES (?1, ?2)", params![resource_id, id])?;
                } else {
                    println!("[WARNING] Skipping invalid chapter_id in Table: {}", id);
                }
            }
        }
    }
    if let Some(sections) = &metadata.sections {
        conn.execute(
            "DELETE FROM resource_table_sections WHERE resource_id = ?1",
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
                    conn.execute("INSERT OR IGNORE INTO resource_table_sections (resource_id, section_id) VALUES (?1, ?2)", params![resource_id, id])?;
                } else {
                    println!("[WARNING] Skipping invalid section_id in Table: {}", id);
                }
            }
        }
    }
    if let Some(subsections) = &metadata.subsections {
        conn.execute(
            "DELETE FROM resource_table_subsections WHERE resource_id = ?1",
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
                    conn.execute("INSERT OR IGNORE INTO resource_table_subsections (resource_id, subsection_id) VALUES (?1, ?2)", params![resource_id, id])?;
                } else {
                    println!("[WARNING] Skipping invalid subsection_id in Table: {}", id);
                }
            }
        }
    }

    Ok(())
}

// ============================================================================
// FIGURE Metadata Operations
// ============================================================================

pub fn save_figure_metadata(
    conn: &Connection,
    resource_id: &str,
    metadata: &FigureMetadata,
) -> Result<()> {
    let mut field_id = metadata.field_id.as_ref().filter(|s| !s.is_empty());
    let mut preamble_id = metadata.preamble_id.as_ref().filter(|s| !s.is_empty());

    // Check Field ID
    if let Some(fid) = field_id {
        let field_exists: bool = conn
            .query_row("SELECT 1 FROM fields WHERE id = ?1", params![fid], |_| {
                Ok(true)
            })
            .unwrap_or(false);

        if !field_exists {
            println!(
                "[WARNING] Field ID {} not found in Figure save! Setting to NULL.",
                fid
            );
            field_id = None;
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
            println!(
                "[WARNING] Preamble ID {} not found in Figure save! Setting to NULL.",
                pid
            );
            preamble_id = None;
        }
    }

    conn.execute(
        "INSERT OR REPLACE INTO resource_figures (
            resource_id, plot_type_id, environment, date, content,
            caption, preamble_id, build_command, description, field_id
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            resource_id,
            metadata.plot_type_id,
            metadata.environment,
            metadata.date,
            metadata.content,
            metadata.caption,
            preamble_id,
            metadata.build_command,
            metadata.description,
            field_id,
        ],
    )?;

    // Save required packages
    if let Some(packages) = &metadata.required_packages {
        conn.execute(
            "DELETE FROM resource_figure_packages WHERE resource_id = ?1",
            params![resource_id],
        )?;
        for package_id in packages {
            conn.execute(
                "INSERT OR IGNORE INTO resource_figure_packages (resource_id, package_id) VALUES (?1, ?2)",
                params![resource_id, package_id],
            )?;
        }
    }

    // Save custom tags
    if let Some(tags) = &metadata.custom_tags {
        conn.execute(
            "DELETE FROM resource_figure_tags WHERE resource_id = ?1",
            params![resource_id],
        )?;
        for tag in tags {
            conn.execute(
                "INSERT OR IGNORE INTO custom_tags (tag) VALUES (?1)",
                params![tag],
            )?;
            conn.execute(
                "INSERT OR IGNORE INTO resource_figure_tags (resource_id, tag) VALUES (?1, ?2)",
                params![resource_id, tag],
            )?;
        }
    }

    // Save Hierarchy
    if let Some(chapters) = &metadata.chapters {
        conn.execute(
            "DELETE FROM resource_figure_chapters WHERE resource_id = ?1",
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
                    conn.execute("INSERT OR IGNORE INTO resource_figure_chapters (resource_id, chapter_id) VALUES (?1, ?2)", params![resource_id, id])?;
                } else {
                    println!("[WARNING] Skipping invalid chapter_id in Figure: {}", id);
                }
            }
        }
    }
    if let Some(sections) = &metadata.sections {
        conn.execute(
            "DELETE FROM resource_figure_sections WHERE resource_id = ?1",
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
                    conn.execute("INSERT OR IGNORE INTO resource_figure_sections (resource_id, section_id) VALUES (?1, ?2)", params![resource_id, id])?;
                } else {
                    println!("[WARNING] Skipping invalid section_id in Figure: {}", id);
                }
            }
        }
    }
    if let Some(subsections) = &metadata.subsections {
        conn.execute(
            "DELETE FROM resource_figure_subsections WHERE resource_id = ?1",
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
                    conn.execute("INSERT OR IGNORE INTO resource_figure_subsections (resource_id, subsection_id) VALUES (?1, ?2)", params![resource_id, id])?;
                } else {
                    println!("[WARNING] Skipping invalid subsection_id in Figure: {}", id);
                }
            }
        }
    }

    Ok(())
}

// ============================================================================
// COMMAND Metadata Operations
// ============================================================================

pub fn save_command_metadata(
    conn: &Connection,
    resource_id: &str,
    metadata: &CommandMetadata,
) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO resource_commands (
            resource_id, name, file_type_id, content, description,
            built_in, macro_command_type_id
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            resource_id,
            metadata.name,
            metadata.file_type_id,
            metadata.content,
            metadata.description,
            metadata.built_in,
            metadata.macro_command_type_id,
        ],
    )?;

    // Save required packages
    if let Some(packages) = &metadata.required_packages {
        conn.execute(
            "DELETE FROM resource_command_packages WHERE resource_id = ?1",
            params![resource_id],
        )?;
        for package_id in packages {
            conn.execute(
                "INSERT OR IGNORE INTO resource_command_packages (resource_id, package_id) VALUES (?1, ?2)",
                params![resource_id, package_id],
            )?;
        }
    }

    Ok(())
}

// ============================================================================
// PACKAGE Metadata Operations
// ============================================================================

pub fn save_package_metadata(
    conn: &Connection,
    resource_id: &str,
    metadata: &PackageMetadata,
) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO resource_packages (
            resource_id, name, topic_id, date, content, description
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            resource_id,
            metadata.name,
            metadata.topic_id,
            metadata.date,
            metadata.content,
            metadata.description,
        ],
    )?;

    // Save dependencies
    if let Some(dependencies) = &metadata.dependencies {
        conn.execute(
            "DELETE FROM resource_package_dependencies WHERE resource_id = ?1",
            params![resource_id],
        )?;
        for package_id in dependencies {
            conn.execute(
                "INSERT OR IGNORE INTO resource_package_dependencies (resource_id, package_id) VALUES (?1, ?2)",
                params![resource_id, package_id],
            )?;
        }
    }

    // Save topics
    if let Some(topics) = &metadata.topics {
        conn.execute(
            "DELETE FROM resource_package_topics WHERE resource_id = ?1",
            params![resource_id],
        )?;
        for topic_id in topics {
            conn.execute(
                "INSERT OR IGNORE INTO resource_package_topics (resource_id, topic_id) VALUES (?1, ?2)",
                params![resource_id, topic_id],
            )?;
        }
    }

    Ok(())
}

// ============================================================================
// PREAMBLE Metadata Operations
// ============================================================================

pub fn save_preamble_metadata(
    conn: &Connection,
    resource_id: &str,
    metadata: &PreambleMetadata,
) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO resource_preambles (
            resource_id, name, file_type_id, content, description, built_in
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            resource_id,
            metadata.name,
            metadata.file_type_id,
            metadata.content,
            metadata.description,
            metadata.built_in,
        ],
    )?;

    // Save required packages
    if let Some(packages) = &metadata.required_packages {
        conn.execute(
            "DELETE FROM resource_preamble_packages WHERE resource_id = ?1",
            params![resource_id],
        )?;
        for package_id in packages {
            conn.execute(
                "INSERT OR IGNORE INTO resource_preamble_packages (resource_id, package_id) VALUES (?1, ?2)",
                params![resource_id, package_id],
            )?;
        }
    }

    // Save command types
    if let Some(command_types) = &metadata.command_types {
        conn.execute(
            "DELETE FROM resource_preamble_command_types WHERE resource_id = ?1",
            params![resource_id],
        )?;
        for cmd_type_id in command_types {
            conn.execute(
                "INSERT OR IGNORE INTO resource_preamble_command_types (resource_id, command_type_id) VALUES (?1, ?2)",
                params![resource_id, cmd_type_id],
            )?;
        }
    }

    Ok(())
}

// ============================================================================
// CLASS Metadata Operations
// ============================================================================

pub fn save_class_metadata(
    conn: &Connection,
    resource_id: &str,
    metadata: &ClassMetadata,
) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO resource_classes (
            resource_id, name, file_type_id, date, content, description
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            resource_id,
            metadata.name,
            metadata.file_type_id,
            metadata.date,
            metadata.content,
            metadata.description,
        ],
    )?;

    // Save custom tags
    if let Some(tags) = &metadata.custom_tags {
        conn.execute(
            "DELETE FROM resource_class_tags WHERE resource_id = ?1",
            params![resource_id],
        )?;
        for tag in tags {
            conn.execute(
                "INSERT OR IGNORE INTO custom_tags (tag) VALUES (?1)",
                params![tag],
            )?;
            conn.execute(
                "INSERT OR IGNORE INTO resource_class_tags (resource_id, tag) VALUES (?1, ?2)",
                params![resource_id, tag],
            )?;
        }
    }

    Ok(())
}
// ============================================================================
// LOAD Operations (Helpers)
// ============================================================================

pub fn load_table_metadata(conn: &Connection, resource_id: &str) -> Result<Option<TableMetadata>> {
    let mut stmt = conn.prepare(
        "SELECT table_type_id, date, content, caption, field_id FROM resource_tables WHERE resource_id = ?1",
    )?;

    let metadata = stmt
        .query_row(params![resource_id], |row| {
            Ok(TableMetadata {
                table_type_id: row.get(0)?,
                date: row.get(1)?,
                content: row.get(2)?,
                caption: row.get(3)?,
                field_id: row.get(4)?,
                required_packages: None,
                custom_tags: None,
                chapters: None,
                sections: None,
                subsections: None,
            })
        })
        .optional()?;

    if let Some(mut meta) = metadata {
        // Load arrays
        meta.required_packages = Some(
            conn.prepare("SELECT package_id FROM resource_table_packages WHERE resource_id = ?1")?
                .query_map(params![resource_id], |row| row.get(0))?
                .collect::<Result<Vec<String>>>()?,
        );

        meta.custom_tags = Some(
            conn.prepare("SELECT tag FROM resource_table_tags WHERE resource_id = ?1")?
                .query_map(params![resource_id], |row| row.get(0))?
                .collect::<Result<Vec<String>>>()?,
        );

        meta.chapters = Some(
            conn.prepare("SELECT chapter_id FROM resource_table_chapters WHERE resource_id = ?1")?
                .query_map(params![resource_id], |row| row.get(0))?
                .collect::<Result<Vec<String>>>()?,
        );

        meta.sections = Some(
            conn.prepare("SELECT section_id FROM resource_table_sections WHERE resource_id = ?1")?
                .query_map(params![resource_id], |row| row.get(0))?
                .collect::<Result<Vec<String>>>()?,
        );

        meta.subsections = Some(
            conn.prepare(
                "SELECT subsection_id FROM resource_table_subsections WHERE resource_id = ?1",
            )?
            .query_map(params![resource_id], |row| row.get(0))?
            .collect::<Result<Vec<String>>>()?,
        );

        // Filter empty arrays to None (optional consistency) - keeping Some(vec![]) is also fine,
        // but existing code seems to prefer None if empty? FileMetadata uses checks.
        // Let's stick to simple Some(vec) for now or match FileMetadata style.
        // FileMetadata does: if !vec.is_empty() { meta.vec = Some(vec) }

        if meta
            .required_packages
            .as_ref()
            .map(|v| v.is_empty())
            .unwrap_or(false)
        {
            meta.required_packages = None;
        }
        if meta
            .custom_tags
            .as_ref()
            .map(|v| v.is_empty())
            .unwrap_or(false)
        {
            meta.custom_tags = None;
        }
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

pub fn load_figure_metadata(
    conn: &Connection,
    resource_id: &str,
) -> Result<Option<FigureMetadata>> {
    let mut stmt = conn.prepare(
        "SELECT plot_type_id, environment, date, content, caption, preamble_id, build_command, description, field_id 
         FROM resource_figures WHERE resource_id = ?1",
    )?;

    let metadata = stmt
        .query_row(params![resource_id], |row| {
            Ok(FigureMetadata {
                plot_type_id: row.get(0)?,
                environment: row.get(1)?,
                date: row.get(2)?,
                content: row.get(3)?,
                caption: row.get(4)?,
                preamble_id: row.get(5)?,
                build_command: row.get(6)?,
                description: row.get(7)?,
                field_id: row.get(8)?,
                required_packages: None,
                custom_tags: None,
                chapters: None,
                sections: None,
                subsections: None,
            })
        })
        .optional()?;

    if let Some(mut meta) = metadata {
        // Load arrays
        meta.required_packages = Some(
            conn.prepare("SELECT package_id FROM resource_figure_packages WHERE resource_id = ?1")?
                .query_map(params![resource_id], |row| row.get(0))?
                .collect::<Result<Vec<String>>>()?,
        );

        meta.custom_tags = Some(
            conn.prepare("SELECT tag FROM resource_figure_tags WHERE resource_id = ?1")?
                .query_map(params![resource_id], |row| row.get(0))?
                .collect::<Result<Vec<String>>>()?,
        );

        meta.chapters = Some(
            conn.prepare("SELECT chapter_id FROM resource_figure_chapters WHERE resource_id = ?1")?
                .query_map(params![resource_id], |row| row.get(0))?
                .collect::<Result<Vec<String>>>()?,
        );

        meta.sections = Some(
            conn.prepare("SELECT section_id FROM resource_figure_sections WHERE resource_id = ?1")?
                .query_map(params![resource_id], |row| row.get(0))?
                .collect::<Result<Vec<String>>>()?,
        );

        meta.subsections = Some(
            conn.prepare(
                "SELECT subsection_id FROM resource_figure_subsections WHERE resource_id = ?1",
            )?
            .query_map(params![resource_id], |row| row.get(0))?
            .collect::<Result<Vec<String>>>()?,
        );

        if meta
            .required_packages
            .as_ref()
            .map(|v| v.is_empty())
            .unwrap_or(false)
        {
            meta.required_packages = None;
        }
        if meta
            .custom_tags
            .as_ref()
            .map(|v| v.is_empty())
            .unwrap_or(false)
        {
            meta.custom_tags = None;
        }
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
