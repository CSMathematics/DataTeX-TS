-- ============================================================================
-- Type-Specific Extension Tables: PREAMBLES
-- Reusable document preambles
-- ============================================================================

-- Preamble Types
CREATE TABLE IF NOT EXISTS preamble_types (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO preamble_types (id, name, description) VALUES
    ('article', 'Article', 'Standard article class'),
    ('book', 'Book', 'Standard book class'),
    ('report', 'Report', 'Standard report class'),
    ('beamer', 'Beamer', 'Presentation beamer class'),
    ('standalone', 'Standalone', 'Standalone compilable file'),
    ('exam', 'Exam', 'Exam class'),
    ('thesis', 'Thesis', 'Thesis class'),
    ('custom', 'Custom', 'Custom preamble');

-- Macro/Command Types for preambles
CREATE TABLE IF NOT EXISTS macro_command_types (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO macro_command_types (id, name, description) VALUES
    ('math', 'Mathematical', 'Math-related commands'),
    ('formatting', 'Formatting', 'Text formatting commands'),
    ('structure', 'Structural', 'Document structure commands'),
    ('custom', 'Custom', 'User-defined custom commands');

CREATE TABLE IF NOT EXISTS resource_preambles (
    resource_id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,  -- Preamble name/title
    preamble_type_id TEXT, -- specific type
    content TEXT,  -- Preamble LaTeX code
    description TEXT,
    built_in BOOLEAN DEFAULT FALSE,  -- Is it a built-in template
    
    -- Enriched Fields
    engines TEXT,
    date DATE,
    class TEXT,
    paper_size TEXT,
    font_size INTEGER,
    options TEXT,
    languages TEXT,
    geometry TEXT,
    author TEXT,
    title TEXT,
    
    -- Boolean Flags
    use_bibliography BOOLEAN DEFAULT FALSE,
    bib_compile_engine TEXT,
    make_index BOOLEAN DEFAULT FALSE,
    make_glossaries BOOLEAN DEFAULT FALSE,
    has_toc BOOLEAN DEFAULT FALSE,
    has_lot BOOLEAN DEFAULT FALSE,
    has_lof BOOLEAN DEFAULT FALSE,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE,
    FOREIGN KEY(preamble_type_id) REFERENCES preamble_types(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_resource_preambles_name ON resource_preambles(name);
CREATE INDEX IF NOT EXISTS idx_resource_preambles_type ON resource_preambles(preamble_type_id);
CREATE INDEX IF NOT EXISTS idx_resource_preambles_builtin ON resource_preambles(built_in);

-- ============================================================================
-- JUNCTION TABLES for Preambles
-- ============================================================================

CREATE TABLE IF NOT EXISTS resource_preamble_packages (
    resource_id TEXT NOT NULL,
    package_id TEXT NOT NULL,
    PRIMARY KEY(resource_id, package_id),
    FOREIGN KEY(resource_id) REFERENCES resource_preambles(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(package_id) REFERENCES texlive_packages(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS resource_preamble_command_types (
    resource_id TEXT NOT NULL,
    command_type_id TEXT NOT NULL,
    PRIMARY KEY(resource_id, command_type_id),
    FOREIGN KEY(resource_id) REFERENCES resource_preambles(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(command_type_id) REFERENCES macro_command_types(id) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Preamble Provided Commands
CREATE TABLE IF NOT EXISTS resource_preamble_provided_commands (
    resource_id TEXT NOT NULL,
    command_name TEXT NOT NULL,
    PRIMARY KEY(resource_id, command_name),
    FOREIGN KEY(resource_id) REFERENCES resource_preambles(resource_id) ON DELETE CASCADE
);

-- Trigger
CREATE TRIGGER IF NOT EXISTS update_resource_preambles_timestamp
AFTER UPDATE ON resource_preambles
BEGIN
    UPDATE resource_preambles SET updated_at = CURRENT_TIMESTAMP 
    WHERE resource_id = NEW.resource_id;
END;
