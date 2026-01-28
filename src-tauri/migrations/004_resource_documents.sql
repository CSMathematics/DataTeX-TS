-- ============================================================================
-- Type-Specific Extension Tables: DOCUMENTS
-- Πλήρη έγγραφα LaTeX
-- ============================================================================

CREATE TABLE IF NOT EXISTS resource_documents (
    resource_id TEXT PRIMARY KEY NOT NULL,
    title TEXT,  -- Nullable: document may not have title yet
    document_type_id TEXT,  -- FK to document_types (NOT file_types)
    -- Hierarchy (new system)
    field_id TEXT,  -- FK to fields
    -- Other metadata
    date DATE,
    content TEXT,  -- Document LaTeX content
    preamble_id TEXT,  -- FK to resources.id
    build_command TEXT,
    bibliography TEXT,
    description TEXT,
    solution_document_id TEXT,  -- FK to resources.id
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- Foreign keys
    FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE,
    FOREIGN KEY(document_type_id) REFERENCES document_types(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY(field_id) REFERENCES fields(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY(preamble_id) REFERENCES resources(id) ON DELETE SET NULL,
    FOREIGN KEY(solution_document_id) REFERENCES resources(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_resource_documents_type ON resource_documents(document_type_id);
CREATE INDEX IF NOT EXISTS idx_resource_documents_field ON resource_documents(field_id);

-- ============================================================================
-- HIERARCHY JUNCTION TABLES for Documents
-- ============================================================================

-- Chapters per Document
CREATE TABLE IF NOT EXISTS resource_document_chapters (
    resource_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    PRIMARY KEY(resource_id, chapter_id),
    FOREIGN KEY(resource_id) REFERENCES resource_documents(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_chapters_resource ON resource_document_chapters(resource_id);
CREATE INDEX IF NOT EXISTS idx_document_chapters_chapter ON resource_document_chapters(chapter_id);

-- Sections per Document
CREATE TABLE IF NOT EXISTS resource_document_sections (
    resource_id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    PRIMARY KEY(resource_id, section_id),
    FOREIGN KEY(resource_id) REFERENCES resource_documents(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(section_id) REFERENCES sections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_sections_resource ON resource_document_sections(resource_id);
CREATE INDEX IF NOT EXISTS idx_document_sections_section ON resource_document_sections(section_id);

-- Subsections per Document
CREATE TABLE IF NOT EXISTS resource_document_subsections (
    resource_id TEXT NOT NULL,
    subsection_id TEXT NOT NULL,
    PRIMARY KEY(resource_id, subsection_id),
    FOREIGN KEY(resource_id) REFERENCES resource_documents(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(subsection_id) REFERENCES subsections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_subsections_resource ON resource_document_subsections(resource_id);
CREATE INDEX IF NOT EXISTS idx_document_subsections_subsection ON resource_document_subsections(subsection_id);

-- ============================================================================
-- OTHER JUNCTION TABLES for Documents
-- ============================================================================

-- Files included in Document (with source tracking)
CREATE TABLE IF NOT EXISTS resource_document_files (
    document_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    order_index INTEGER NOT NULL,  -- Order in which files appear
    files_database_source TEXT,  -- Which database the file comes from
    database_type INTEGER,  -- Type identifier
    PRIMARY KEY(document_id, file_id),
    FOREIGN KEY(document_id) REFERENCES resource_documents(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(file_id) REFERENCES resources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_files_order ON resource_document_files(document_id, order_index);

-- Custom Tags per Document
CREATE TABLE IF NOT EXISTS resource_document_tags (
    resource_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    PRIMARY KEY(resource_id, tag),
    FOREIGN KEY(resource_id) REFERENCES resource_documents(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(tag) REFERENCES custom_tags(tag) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Bibliography Entries per Document
CREATE TABLE IF NOT EXISTS resource_document_bib_entries (
    resource_id TEXT NOT NULL,
    bib_id TEXT NOT NULL,
    PRIMARY KEY(resource_id, bib_id),
    FOREIGN KEY(resource_id) REFERENCES resource_documents(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(bib_id) REFERENCES bibliography(citation_key) ON UPDATE CASCADE ON DELETE CASCADE
);

-- ============================================================================
-- EDIT HISTORY for Documents
-- ============================================================================
CREATE TABLE IF NOT EXISTS resource_document_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT NOT NULL,
    date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    modification TEXT,
    content TEXT,  -- Content snapshot
    metadata TEXT,  -- Metadata snapshot (JSON)
    files_included TEXT,  -- Snapshot of included files
    FOREIGN KEY(resource_id) REFERENCES resource_documents(resource_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_history_resource ON resource_document_history(resource_id);
CREATE INDEX IF NOT EXISTS idx_document_history_date ON resource_document_history(date_time);

-- ============================================================================
-- TRIGGERS for Documents
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS update_resource_documents_timestamp
AFTER UPDATE ON resource_documents
BEGIN
    UPDATE resource_documents SET updated_at = CURRENT_TIMESTAMP 
    WHERE resource_id = NEW.resource_id;
END;

CREATE TRIGGER IF NOT EXISTS create_document_history_on_update
AFTER UPDATE ON resource_documents
WHEN OLD.content IS NOT NULL AND NEW.content IS NOT NULL AND OLD.content != NEW.content
BEGIN
    INSERT INTO resource_document_history (resource_id, modification, content, metadata)
    VALUES (
        NEW.resource_id,
        'Content updated',
        OLD.content,
        json_object(
            'title', OLD.title,
            'document_type', OLD.document_type_id,
            'description', OLD.description
        )
    );
END;
