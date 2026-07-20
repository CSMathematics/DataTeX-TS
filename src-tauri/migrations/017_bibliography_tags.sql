-- ============================================================================
-- Bibliography Tags
-- Lightweight tagging layer for bibliography workspace filters and batch edits.
-- ============================================================================

CREATE TABLE IF NOT EXISTS bib_tags (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bib_tags_name ON bib_tags(name);

CREATE TABLE IF NOT EXISTS bib_entry_tags (
    entry_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(entry_id, tag_id),
    FOREIGN KEY(entry_id) REFERENCES bib_entries(id) ON DELETE CASCADE,
    FOREIGN KEY(tag_id) REFERENCES bib_tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bib_entry_tags_tag ON bib_entry_tags(tag_id);

CREATE TRIGGER IF NOT EXISTS update_bib_tags_timestamp
AFTER UPDATE ON bib_tags
BEGIN
    UPDATE bib_tags SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
