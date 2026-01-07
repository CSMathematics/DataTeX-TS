-- ============================================================================
-- SUBSECTIONS (Organized by Section) - Migration 012
-- ============================================================================

-- Subsections table (child of sections)
CREATE TABLE IF NOT EXISTS subsections (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    section_id TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, section_id),
    FOREIGN KEY(section_id) REFERENCES sections(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subsections_section ON subsections(section_id);
CREATE INDEX IF NOT EXISTS idx_subsections_name ON subsections(name);

-- Subsections per File (many-to-many junction table)
CREATE TABLE IF NOT EXISTS resource_file_subsections (
    resource_id TEXT NOT NULL,
    subsection_id TEXT NOT NULL,
    PRIMARY KEY(resource_id, subsection_id),
    FOREIGN KEY(resource_id) REFERENCES resource_files(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(subsection_id) REFERENCES subsections(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_resource_file_subsections_resource ON resource_file_subsections(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_file_subsections_subsection ON resource_file_subsections(subsection_id);
