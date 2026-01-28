-- ============================================================================
-- Type-Specific Extension Tables: FIGURES
-- Γραφικά, εικόνες, TikZ διαγράμματα
-- ============================================================================

CREATE TABLE IF NOT EXISTS figure_types (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

-- Insert Default Figure Types
INSERT OR IGNORE INTO figure_types (id, name, description) VALUES 
('2d_plot', '2D Plot', 'Two-dimensional plots'),
('3d_plot', '3D Plot', 'Three-dimensional plots'),
('geometric', 'Geometric Shape', 'Geometry shapes and constructions'),
('statistical', 'Statistical Chart', 'Bar charts, pie charts, etc.'),
('diagram', 'Diagram', 'Flowcharts, diagrams, etc.'),
('image', 'Image', 'Raster or vector images');

CREATE TABLE IF NOT EXISTS resource_figures (
    resource_id TEXT PRIMARY KEY NOT NULL,
    figure_type_id TEXT,  -- FK to figure_types
    field_id TEXT, -- FK to fields (added by consolidation)
    environment TEXT,  -- tikzpicture, axis, includegraphics
    date DATE,
    content TEXT,  -- LaTeX/TikZ code
    caption TEXT,
    description TEXT,
    
    -- Technical / Layout
    options TEXT,     -- [scale=0.5]
    tikz_style TEXT,
    width TEXT,
    height TEXT,
    label TEXT,
    placement TEXT,
    alignment TEXT,

    -- Build info
    preamble_id TEXT,  -- FK for standalone compilation
    build_command TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE,
    FOREIGN KEY(figure_type_id) REFERENCES figure_types(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY(preamble_id) REFERENCES resources(id) ON DELETE SET NULL,
    FOREIGN KEY(field_id) REFERENCES fields(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_resource_figures_field ON resource_figures(field_id);

CREATE INDEX IF NOT EXISTS idx_resource_figures_type ON resource_figures(figure_type_id);
CREATE INDEX IF NOT EXISTS idx_resource_figures_environment ON resource_figures(environment);

-- ============================================================================
-- JUNCTION TABLES for Figures
-- ============================================================================

CREATE TABLE IF NOT EXISTS resource_figure_packages (
    resource_id TEXT NOT NULL,
    package_id TEXT NOT NULL,
    PRIMARY KEY(resource_id, package_id),
    FOREIGN KEY(resource_id) REFERENCES resource_figures(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(package_id) REFERENCES texlive_packages(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS resource_figure_tags (
    resource_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    PRIMARY KEY(resource_id, tag),
    FOREIGN KEY(resource_id) REFERENCES resource_figures(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(tag) REFERENCES custom_tags(tag) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Figures Chapters
CREATE TABLE IF NOT EXISTS resource_figure_chapters (
    resource_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    PRIMARY KEY(resource_id, chapter_id),
    FOREIGN KEY(resource_id) REFERENCES resource_figures(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_figure_chapters_resource ON resource_figure_chapters(resource_id);

-- Figures Sections
CREATE TABLE IF NOT EXISTS resource_figure_sections (
    resource_id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    PRIMARY KEY(resource_id, section_id),
    FOREIGN KEY(resource_id) REFERENCES resource_figures(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(section_id) REFERENCES sections(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_figure_sections_resource ON resource_figure_sections(resource_id);

-- Figures Subsections
CREATE TABLE IF NOT EXISTS resource_figure_subsections (
    resource_id TEXT NOT NULL,
    subsection_id TEXT NOT NULL,
    PRIMARY KEY(resource_id, subsection_id),
    FOREIGN KEY(resource_id) REFERENCES resource_figures(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(subsection_id) REFERENCES subsections(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_figure_subsections_resource ON resource_figure_subsections(resource_id);

-- ============================================================================
-- EDIT HISTORY for Figures
-- ============================================================================
CREATE TABLE IF NOT EXISTS resource_figure_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT NOT NULL,
    date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    modification TEXT,
    content TEXT,
    metadata TEXT,
    FOREIGN KEY(resource_id) REFERENCES resource_figures(resource_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_figure_history_resource ON resource_figure_history(resource_id);

CREATE TRIGGER IF NOT EXISTS update_resource_figures_timestamp
AFTER UPDATE ON resource_figures
BEGIN
    UPDATE resource_figures SET updated_at = CURRENT_TIMESTAMP 
    WHERE resource_id = NEW.resource_id;
END;
