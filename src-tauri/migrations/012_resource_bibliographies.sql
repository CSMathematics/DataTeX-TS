-- ============================================================================
-- Migration 017: Detailed Bibliography Metadata
-- Adds tables to store structured BibTeX/BibLaTeX fields for bibliography resources
-- ============================================================================

-- Main Table for Bibliography Entry Metadata
CREATE TABLE IF NOT EXISTS resource_bibliographies (
    resource_id TEXT PRIMARY KEY NOT NULL,
    entry_type TEXT, -- @article, @book, etc.
    citation_key TEXT, -- The unique cite key
    
    -- Periodic / Series Info
    journal TEXT,
    volume TEXT,
    series TEXT,
    number TEXT,
    issue TEXT,
    
    -- Date Info
    year TEXT,
    month TEXT,
    
    -- Publication Info
    publisher TEXT,
    edition TEXT,
    institution TEXT,
    school TEXT,
    organization TEXT,
    address TEXT, -- Publisher's address or location
    location TEXT, -- Conference location, etc.
    
    -- Identification
    isbn TEXT,
    issn TEXT,
    doi TEXT,
    url TEXT,
    language TEXT,
    
    -- Content Info
    title TEXT, -- Often overrides resource title or is the main title
    subtitle TEXT,
    booktitle TEXT, -- For parts of books/proceedings
    chapter TEXT,
    pages TEXT,
    abstract TEXT,
    note TEXT,
    crossref TEXT, -- Cross-reference to another entry
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE
);

-- Persons associated with the entry (Authors, Editors, Translators)
-- Using a junction table allows strictly typed roles and ordering
CREATE TABLE IF NOT EXISTS resource_bibliography_persons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('author', 'editor', 'translator')),
    full_name TEXT NOT NULL, -- "Smith, John" or "John Smith"
    position INTEGER NOT NULL DEFAULT 0, -- For ordering
    FOREIGN KEY(resource_id) REFERENCES resource_bibliographies(resource_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bib_persons_res ON resource_bibliography_persons(resource_id, role);

-- Custom/Extra Fields (Key-Value pairs)
CREATE TABLE IF NOT EXISTS resource_bibliography_extras (
    resource_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    PRIMARY KEY(resource_id, key),
    FOREIGN KEY(resource_id) REFERENCES resource_bibliographies(resource_id) ON DELETE CASCADE
);

-- Trigger to update timestamp
CREATE TRIGGER IF NOT EXISTS update_resource_bibliographies_timestamp
AFTER UPDATE ON resource_bibliographies
BEGIN
    UPDATE resource_bibliographies SET updated_at = CURRENT_TIMESTAMP 
    WHERE resource_id = NEW.resource_id;
END;
