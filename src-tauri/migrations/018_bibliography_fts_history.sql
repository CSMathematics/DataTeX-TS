-- ============================================================================
-- Bibliography FTS + History
-- Fast global bibliography search and a lightweight audit log for imports/edits.
-- ============================================================================

CREATE VIRTUAL TABLE IF NOT EXISTS bib_entry_fts USING fts5(
    entry_id UNINDEXED,
    source_id UNINDEXED,
    citation_key,
    entry_type,
    title,
    year,
    date,
    doi,
    isbn,
    url,
    abstract,
    creators,
    tags,
    extra_fields,
    tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS bib_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT,
    entry_id TEXT,
    resource_id TEXT,
    action TEXT NOT NULL
        CHECK(action IN (
            'import',
            'entry_update',
            'batch_update',
            'tag_update',
            'export',
            'link',
            'unlink',
            'citation_scan'
        )),
    summary TEXT,
    details_json JSON DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(source_id) REFERENCES bib_sources(id) ON DELETE SET NULL,
    FOREIGN KEY(entry_id) REFERENCES bib_entries(id) ON DELETE SET NULL,
    FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bib_history_source_created
    ON bib_history(source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bib_history_entry_created
    ON bib_history(entry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bib_history_resource_created
    ON bib_history(resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bib_history_action_created
    ON bib_history(action, created_at DESC);

DELETE FROM bib_entry_fts;

INSERT INTO bib_entry_fts (
    entry_id,
    source_id,
    citation_key,
    entry_type,
    title,
    year,
    date,
    doi,
    isbn,
    url,
    abstract,
    creators,
    tags,
    extra_fields
)
SELECT
    e.id,
    e.source_id,
    e.citation_key,
    e.entry_type,
    COALESCE(e.title, ''),
    COALESCE(e.year, ''),
    COALESCE(e.date, ''),
    COALESCE(e.doi, ''),
    COALESCE(e.isbn, ''),
    COALESCE(e.url, ''),
    COALESCE(e.abstract, ''),
    COALESCE((
        SELECT group_concat(n.full_name, ' ')
        FROM bib_entry_names n
        WHERE n.entry_id = e.id
    ), ''),
    COALESCE((
        SELECT group_concat(t.name, ' ')
        FROM bib_entry_tags et
        INNER JOIN bib_tags t ON t.id = et.tag_id
        WHERE et.entry_id = e.id
    ), ''),
    COALESCE(e.fields_json, '')
FROM bib_entries e;
