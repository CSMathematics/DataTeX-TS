-- ============================================================================
-- Type-Specific Extension Tables: TABLES
-- LaTeX tables/tabular environments
-- ============================================================================

CREATE TABLE IF NOT EXISTS table_types (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

INSERT OR IGNORE INTO table_types (id, name, description) VALUES 
('results', 'Results Table', 'Main results presentation'),
('comparison', 'Comparison Table', 'Comparison with other works'),
('data', 'Data Table', 'Raw or processed data'),
('appendix', 'Appendix Table', 'Supplementary material'),
('general', 'General Table', 'General purpose table');

CREATE TABLE IF NOT EXISTS resource_tables (
    resource_id TEXT PRIMARY KEY NOT NULL,
    table_type_id TEXT,  -- FK to table_types
    date DATE,
    content TEXT,  -- LaTeX table code
    caption TEXT,
    description TEXT,
    environment TEXT DEFAULT 'tabular', -- tabular, tabularx, longtable, tabularray
    placement TEXT, -- htbp
    label TEXT, -- tab:xyz
    width TEXT, -- 1.0\textwidth
    alignment TEXT, -- |l|c|r|
    rows INTEGER,
    columns INTEGER,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE,
    FOREIGN KEY(table_type_id) REFERENCES table_types(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_resource_tables_type ON resource_tables(table_type_id);
CREATE INDEX IF NOT EXISTS idx_resource_tables_env ON resource_tables(environment);

-- ============================================================================
-- JUNCTION TABLES for Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS resource_table_packages (
    resource_id TEXT NOT NULL,
    package_id TEXT NOT NULL,
    PRIMARY KEY(resource_id, package_id),
    FOREIGN KEY(resource_id) REFERENCES resource_tables(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(package_id) REFERENCES texlive_packages(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS resource_table_tags (
    resource_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    PRIMARY KEY(resource_id, tag),
    FOREIGN KEY(resource_id) REFERENCES resource_tables(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(tag) REFERENCES custom_tags(tag) ON UPDATE CASCADE ON DELETE CASCADE
);

-- ============================================================================
-- EDIT HISTORY for Tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS resource_table_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT NOT NULL,
    date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    modification TEXT,
    content TEXT,
    metadata TEXT,
    FOREIGN KEY(resource_id) REFERENCES resource_tables(resource_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_table_history_resource ON resource_table_history(resource_id);

CREATE TRIGGER IF NOT EXISTS update_resource_tables_timestamp
AFTER UPDATE ON resource_tables
BEGIN
    UPDATE resource_tables SET updated_at = CURRENT_TIMESTAMP 
    WHERE resource_id = NEW.resource_id;
END;
