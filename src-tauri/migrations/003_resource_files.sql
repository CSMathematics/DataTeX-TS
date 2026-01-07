-- ============================================================================
-- Type-Specific Extension Tables: FILES
-- Μεμονωμένα αρχεία LaTeX (fragments χωρίς preamble)
-- ============================================================================

CREATE TABLE IF NOT EXISTS resource_files (
    resource_id TEXT PRIMARY KEY NOT NULL,
    file_type_id TEXT,
    field_id TEXT,
    difficulty INTEGER CHECK(difficulty IS NULL OR difficulty BETWEEN 1 AND 5),
    date DATE,
    solved_prooved BOOLEAN DEFAULT FALSE,
    solution_id TEXT,  -- FK to resources.id
    bibliography TEXT,
    file_content TEXT,  -- Snapshot of LaTeX content
    preamble_id TEXT,  -- FK to resources.id (preamble resource)
    build_command TEXT,  -- pdflatex, xelatex, lualatex
    file_description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE,
    FOREIGN KEY(file_type_id) REFERENCES file_types(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY(field_id) REFERENCES fields(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY(solution_id) REFERENCES resources(id) ON DELETE SET NULL,
    FOREIGN KEY(preamble_id) REFERENCES resources(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_resource_files_type ON resource_files(file_type_id);
CREATE INDEX IF NOT EXISTS idx_resource_files_field ON resource_files(field_id);
CREATE INDEX IF NOT EXISTS idx_resource_files_difficulty ON resource_files(difficulty);
CREATE INDEX IF NOT EXISTS idx_resource_files_solved ON resource_files(solved_prooved);

-- ============================================================================
-- JUNCTION TABLES for Files
-- ============================================================================

-- Chapters per File (many-to-many)
CREATE TABLE IF NOT EXISTS resource_file_chapters (
    resource_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    PRIMARY KEY(resource_id, chapter_id),
    FOREIGN KEY(resource_id) REFERENCES resource_files(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(chapter_id) REFERENCES chapters(id) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Sections per File (many-to-many)
CREATE TABLE IF NOT EXISTS resource_file_sections (
    resource_id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    PRIMARY KEY(resource_id, section_id),
    FOREIGN KEY(resource_id) REFERENCES resource_files(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(section_id) REFERENCES sections(id) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Exercise Types per File (many-to-many)
CREATE TABLE IF NOT EXISTS resource_file_exercise_types (
    resource_id TEXT NOT NULL,
    exercise_type_id TEXT NOT NULL,
    PRIMARY KEY(resource_id, exercise_type_id),
    FOREIGN KEY(resource_id) REFERENCES resource_files(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(exercise_type_id) REFERENCES exercise_types(id) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Required Packages per File (many-to-many)
CREATE TABLE IF NOT EXISTS resource_file_packages (
    resource_id TEXT NOT NULL,
    package_id TEXT NOT NULL,  -- TeXLive package name
    PRIMARY KEY(resource_id, package_id),
    FOREIGN KEY(resource_id) REFERENCES resource_files(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(package_id) REFERENCES texlive_packages(id) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Custom Tags per File (many-to-many)
CREATE TABLE IF NOT EXISTS resource_file_tags (
    resource_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    PRIMARY KEY(resource_id, tag),
    FOREIGN KEY(resource_id) REFERENCES resource_files(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(tag) REFERENCES custom_tags(tag) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Bibliography Entries per File (many-to-many)
CREATE TABLE IF NOT EXISTS resource_file_bib_entries (
    resource_id TEXT NOT NULL,
    bib_id TEXT NOT NULL,  -- Citation key
    PRIMARY KEY(resource_id, bib_id),
    FOREIGN KEY(resource_id) REFERENCES resource_files(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(bib_id) REFERENCES bibliography(citation_key) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Solutions per File (many-to-many for multiple solutions)
CREATE TABLE IF NOT EXISTS resource_file_solutions (
    file_id TEXT NOT NULL,
    solution_id TEXT NOT NULL,
    solution_path TEXT,  -- Path to solution file
    PRIMARY KEY(file_id, solution_id),
    FOREIGN KEY(file_id) REFERENCES resource_files(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(solution_id) REFERENCES resource_files(resource_id) ON DELETE CASCADE
);

-- ============================================================================
-- EDIT HISTORY for Files
-- ============================================================================
CREATE TABLE IF NOT EXISTS resource_file_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT NOT NULL,
    date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    modification TEXT,  -- Description of changes
    file_content TEXT,  -- Content snapshot
    metadata TEXT,  -- Metadata snapshot (JSON)
    FOREIGN KEY(resource_id) REFERENCES resource_files(resource_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_file_history_resource ON resource_file_history(resource_id);
CREATE INDEX IF NOT EXISTS idx_file_history_date ON resource_file_history(date_time);

-- ============================================================================
-- TRIGGERS for Files
-- ============================================================================

-- Update timestamp trigger
CREATE TRIGGER IF NOT EXISTS update_resource_files_timestamp
AFTER UPDATE ON resource_files
BEGIN
    UPDATE resource_files SET updated_at = CURRENT_TIMESTAMP 
    WHERE resource_id = NEW.resource_id;
END;

-- Auto-create history snapshot on update
CREATE TRIGGER IF NOT EXISTS create_file_history_on_update
AFTER UPDATE ON resource_files
WHEN OLD.file_content != NEW.file_content OR OLD.file_description != NEW.file_description
BEGIN
    INSERT INTO resource_file_history (resource_id, modification, file_content, metadata)
    VALUES (
        NEW.resource_id,
        'Content updated',
        OLD.file_content,
        json_object(
            'difficulty', OLD.difficulty,
            'solved_prooved', OLD.solved_prooved,
            'file_description', OLD.file_description
        )
    );
END;
