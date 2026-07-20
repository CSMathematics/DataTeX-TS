-- ============================================================================
-- Bibliography Attachments
-- Files attached to bibliography entries. Phase 5 starts with PDFs, while the
-- schema leaves room for supplements, datasets, and future annotation links.
-- ============================================================================

CREATE TABLE IF NOT EXISTS bib_entry_attachments (
    id TEXT PRIMARY KEY NOT NULL,
    entry_id TEXT NOT NULL,
    resource_id TEXT,
    path TEXT NOT NULL,
    title TEXT,
    attachment_kind TEXT NOT NULL DEFAULT 'pdf'
        CHECK(attachment_kind IN ('pdf', 'supplement', 'dataset', 'other')),
    mime_type TEXT,
    file_size INTEGER,
    is_primary INTEGER NOT NULL DEFAULT 0
        CHECK(is_primary IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entry_id, path),
    FOREIGN KEY(entry_id) REFERENCES bib_entries(id) ON DELETE CASCADE,
    FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bib_entry_attachments_entry_primary
    ON bib_entry_attachments(entry_id, is_primary DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bib_entry_attachments_resource
    ON bib_entry_attachments(resource_id);
CREATE INDEX IF NOT EXISTS idx_bib_entry_attachments_path
    ON bib_entry_attachments(path);

CREATE TRIGGER IF NOT EXISTS update_bib_entry_attachments_timestamp
AFTER UPDATE ON bib_entry_attachments
BEGIN
    UPDATE bib_entry_attachments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
