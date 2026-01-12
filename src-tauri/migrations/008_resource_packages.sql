-- ============================================================================
-- Type-Specific Extension Tables: PACKAGES
-- Custom .sty packages
-- ============================================================================

-- Topic categories for packages
CREATE TABLE IF NOT EXISTS package_topics (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO package_topics (id, name, description) VALUES
    ('math', 'Mathematics', 'Mathematical packages'),
    ('graphics', 'Graphics', 'Graphics and drawing packages'),
    ('fonts', 'Fonts', 'Font packages'),
    ('formatting', 'Formatting', 'Document formatting'),
    ('other', 'Other', 'Miscellaneous packages');

CREATE TABLE IF NOT EXISTS resource_packages (
    resource_id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,  -- Package name
    topic_id TEXT,  -- Category/Topic FK
    date DATE,
    content TEXT,  -- .sty file content
    description TEXT,
    
    -- New Fields
    options TEXT, -- Package options (comma separated or JSON array)
    built_in BOOLEAN DEFAULT 0,
    documentation TEXT, -- Path or URL
    example TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE,
    FOREIGN KEY(topic_id) REFERENCES package_topics(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_resource_packages_name ON resource_packages(name);
CREATE INDEX IF NOT EXISTS idx_resource_packages_topic ON resource_packages(topic_id);

-- ============================================================================
-- JUNCTION TABLES for Packages
-- ============================================================================

-- Required TeXLive dependencies
CREATE TABLE IF NOT EXISTS resource_package_dependencies (
    resource_id TEXT NOT NULL,
    package_id TEXT NOT NULL,  -- TeXLive package dependency
    PRIMARY KEY(resource_id, package_id),
    FOREIGN KEY(resource_id) REFERENCES resource_packages(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(package_id) REFERENCES texlive_packages(id) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Multiple topic categorization
CREATE TABLE IF NOT EXISTS resource_package_topics (
    resource_id TEXT NOT NULL,
    topic_id TEXT NOT NULL,
    PRIMARY KEY(resource_id, topic_id),
    FOREIGN KEY(resource_id) REFERENCES resource_packages(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(topic_id) REFERENCES package_topics(id) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Package Provided Commands (Simple List)
CREATE TABLE IF NOT EXISTS resource_package_provided_commands (
    resource_id TEXT NOT NULL,
    command_name TEXT NOT NULL,
    PRIMARY KEY(resource_id, command_name),
    FOREIGN KEY(resource_id) REFERENCES resource_packages(resource_id) ON DELETE CASCADE
);

-- Package Custom Tags
CREATE TABLE IF NOT EXISTS resource_package_tags (
    resource_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    PRIMARY KEY(resource_id, tag),
    FOREIGN KEY(resource_id) REFERENCES resource_packages(resource_id) ON DELETE CASCADE,
    FOREIGN KEY(tag) REFERENCES custom_tags(tag) ON UPDATE CASCADE ON DELETE CASCADE
);

-- ============================================================================
-- EDIT HISTORY for Packages
-- ============================================================================
CREATE TABLE IF NOT EXISTS resource_package_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT NOT NULL,
    date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    modification TEXT,
    content TEXT,
    metadata TEXT,
    FOREIGN KEY(resource_id) REFERENCES resource_packages(resource_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_package_history_resource ON resource_package_history(resource_id);

CREATE TRIGGER IF NOT EXISTS update_resource_packages_timestamp
AFTER UPDATE ON resource_packages
BEGIN
    UPDATE resource_packages SET updated_at = CURRENT_TIMESTAMP 
    WHERE resource_id = NEW.resource_id;
END;
