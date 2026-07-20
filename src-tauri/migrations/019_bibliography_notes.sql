-- ============================================================================
-- Bibliography Notes
-- Research notes attached directly to structured bibliography entries.
-- ============================================================================

CREATE TABLE IF NOT EXISTS bib_entry_notes (
    id TEXT PRIMARY KEY NOT NULL,
    entry_id TEXT NOT NULL,
    body TEXT NOT NULL,
    note_kind TEXT NOT NULL DEFAULT 'note'
        CHECK(note_kind IN ('note', 'quote', 'idea', 'todo')),
    is_pinned INTEGER NOT NULL DEFAULT 0
        CHECK(is_pinned IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(entry_id) REFERENCES bib_entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bib_entry_notes_entry_pinned
    ON bib_entry_notes(entry_id, is_pinned DESC, updated_at DESC);

CREATE TRIGGER IF NOT EXISTS update_bib_entry_notes_timestamp
AFTER UPDATE ON bib_entry_notes
BEGIN
    UPDATE bib_entry_notes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
