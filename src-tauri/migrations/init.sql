-- ============================================================================
-- DataTex v2 Unified Schema
-- ============================================================================

-- 1. RESOURCES
CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY NOT NULL,
    path TEXT NOT NULL,
    type TEXT NOT NULL,
    collection TEXT NOT NULL,
    title TEXT,
    content_hash TEXT,
    metadata JSON DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(path)
);

CREATE INDEX IF NOT EXISTS idx_resources_collection ON resources(collection);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);

-- 2. DOCUMENTS
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    category TEXT,
    metadata JSON DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. DOCUMENT ITEMS
CREATE TABLE IF NOT EXISTS document_items (
    document_id TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    PRIMARY KEY (document_id, resource_id),
    FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE
);

-- 4. BIBLIOGRAPHY
CREATE TABLE IF NOT EXISTS bibliography (
    citation_key TEXT PRIMARY KEY NOT NULL,
    entry_type TEXT NOT NULL,
    data JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. DEPENDENCIES
CREATE TABLE IF NOT EXISTS dependencies (
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (source_id, target_id, relation_type)
);

-- Trigger
CREATE TRIGGER IF NOT EXISTS update_timestamp_resources 
AFTER UPDATE ON resources 
BEGIN
    UPDATE resources SET updated_at = CURRENT_TIMESTAMP WHERE id = new.id;
END;
