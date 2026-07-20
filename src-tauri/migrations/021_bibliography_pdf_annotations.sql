-- ============================================================================
-- Bibliography PDF Annotation Links
-- Structured links from bibliography entries to positions/annotations inside
-- attached PDFs. Rectangles are JSON for future viewer-native selections.
-- ============================================================================

CREATE TABLE IF NOT EXISTS bib_entry_pdf_annotations (
    id TEXT PRIMARY KEY NOT NULL,
    entry_id TEXT NOT NULL,
    attachment_id TEXT NOT NULL,
    page INTEGER NOT NULL CHECK(page >= 1),
    annotation_kind TEXT NOT NULL DEFAULT 'highlight'
        CHECK(annotation_kind IN ('highlight', 'note', 'quote', 'bookmark')),
    selected_text TEXT,
    comment TEXT,
    color TEXT,
    rects_json JSON DEFAULT '[]',
    external_annotation_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(entry_id) REFERENCES bib_entries(id) ON DELETE CASCADE,
    FOREIGN KEY(attachment_id) REFERENCES bib_entry_attachments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bib_entry_pdf_annotations_entry_page
    ON bib_entry_pdf_annotations(entry_id, page, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bib_entry_pdf_annotations_attachment_page
    ON bib_entry_pdf_annotations(attachment_id, page, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bib_entry_pdf_annotations_kind
    ON bib_entry_pdf_annotations(annotation_kind, updated_at DESC);

CREATE TRIGGER IF NOT EXISTS update_bib_entry_pdf_annotations_timestamp
AFTER UPDATE ON bib_entry_pdf_annotations
BEGIN
    UPDATE bib_entry_pdf_annotations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
