-- ============================================================================
-- DataTex v2 Unified Schema
-- ============================================================================

-- 0. COLLECTIONS (New Virtual Libraries)
CREATE TABLE IF NOT EXISTS collections (
    name TEXT PRIMARY KEY NOT NULL,
    description TEXT,
    icon TEXT, -- e.g. "folder", "book", "functions"
    type TEXT NOT NULL, -- 'files', 'documents', 'bibliography'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 1. RESOURCES (Files, Tables, Figures, Commands, etc.)
CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY NOT NULL,
    path TEXT NOT NULL,
    type TEXT NOT NULL, -- 'file', 'table', 'figure', 'command', 'preamble', 'package', 'class'
    collection TEXT NOT NULL,
    title TEXT,
    content_hash TEXT,
    metadata JSON DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(path),
    FOREIGN KEY(collection) REFERENCES collections(name) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_resources_collection ON resources(collection);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);

-- 2. DOCUMENTS (Exams, Notes, etc.)
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    collection TEXT NOT NULL, -- Was 'category', now linked to collections
    metadata JSON DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(collection) REFERENCES collections(name) ON UPDATE CASCADE ON DELETE CASCADE
);

-- 3. DOCUMENT ITEMS (The content of a document)
CREATE TABLE IF NOT EXISTS document_items (
    document_id TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    PRIMARY KEY (document_id, resource_id),
    FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE
);

-- 4. BIBLIOGRAPHY (Global)
CREATE TABLE IF NOT EXISTS bibliography (
    citation_key TEXT PRIMARY KEY NOT NULL,
    entry_type TEXT NOT NULL, -- 'book', 'article', etc.
    data JSON NOT NULL, -- All fields: author, year, publisher, etc.
    collection TEXT, -- Optional
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(collection) REFERENCES collections(name) ON DELETE SET NULL
);

-- 5. DEPENDENCIES (Internal links)
CREATE TABLE IF NOT EXISTS dependencies (
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (source_id, target_id, relation_type)
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS update_timestamp_resources
AFTER UPDATE ON resources
BEGIN
    UPDATE resources SET updated_at = CURRENT_TIMESTAMP WHERE id = new.id;
END;