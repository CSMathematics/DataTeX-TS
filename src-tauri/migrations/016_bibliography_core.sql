-- ============================================================================
-- Bibliography Core
-- Structured bibliography sources, entries, aliases, links, and citation scans.
-- This schema coexists with the legacy bibliography tables during migration.
-- ============================================================================

CREATE TABLE IF NOT EXISTS bib_sources (
    id TEXT PRIMARY KEY NOT NULL,
    resource_id TEXT UNIQUE,
    source_kind TEXT NOT NULL DEFAULT 'file',
    path TEXT,
    content_hash TEXT,
    parse_status TEXT NOT NULL DEFAULT 'pending'
        CHECK(parse_status IN ('pending', 'ok', 'warning', 'error')),
    diagnostics_json JSON DEFAULT '[]',
    parsed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bib_sources_resource ON bib_sources(resource_id);
CREATE INDEX IF NOT EXISTS idx_bib_sources_status ON bib_sources(parse_status);

CREATE TABLE IF NOT EXISTS bib_entries (
    id TEXT PRIMARY KEY NOT NULL,
    source_id TEXT NOT NULL,
    entry_type TEXT NOT NULL,
    citation_key TEXT NOT NULL,
    title TEXT,
    subtitle TEXT,
    year TEXT,
    date TEXT,
    doi TEXT,
    isbn TEXT,
    issn TEXT,
    url TEXT,
    abstract TEXT,
    raw_entry TEXT NOT NULL DEFAULT '',
    fields_json JSON DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_id, citation_key),
    FOREIGN KEY(source_id) REFERENCES bib_sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bib_entries_source ON bib_entries(source_id);
CREATE INDEX IF NOT EXISTS idx_bib_entries_citation_key ON bib_entries(citation_key);
CREATE INDEX IF NOT EXISTS idx_bib_entries_type ON bib_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_bib_entries_year ON bib_entries(year);
CREATE INDEX IF NOT EXISTS idx_bib_entries_doi ON bib_entries(doi);

CREATE TABLE IF NOT EXISTS bib_entry_names (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT NOT NULL,
    role TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    full_name TEXT NOT NULL,
    family TEXT,
    given TEXT,
    prefix TEXT,
    suffix TEXT,
    normalized_name TEXT,
    FOREIGN KEY(entry_id) REFERENCES bib_entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bib_entry_names_entry_role
    ON bib_entry_names(entry_id, role, position);
CREATE INDEX IF NOT EXISTS idx_bib_entry_names_normalized
    ON bib_entry_names(normalized_name);

CREATE TABLE IF NOT EXISTS bib_entry_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT NOT NULL,
    alias_key TEXT NOT NULL,
    alias_kind TEXT NOT NULL DEFAULT 'previous'
        CHECK(alias_kind IN ('previous', 'imported', 'manual')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entry_id, alias_key),
    FOREIGN KEY(entry_id) REFERENCES bib_entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bib_entry_aliases_key ON bib_entry_aliases(alias_key);

CREATE TABLE IF NOT EXISTS resource_bib_sources (
    resource_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    link_kind TEXT NOT NULL DEFAULT 'uses'
        CHECK(link_kind IN ('uses', 'exports', 'generated')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(resource_id, source_id, link_kind),
    FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE,
    FOREIGN KEY(source_id) REFERENCES bib_sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_resource_bib_sources_source
    ON resource_bib_sources(source_id);

CREATE TABLE IF NOT EXISTS resource_citations (
    resource_id TEXT NOT NULL,
    entry_id TEXT NOT NULL,
    link_kind TEXT NOT NULL DEFAULT 'cites'
        CHECK(link_kind IN ('cites', 'related', 'nocite')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(resource_id, entry_id, link_kind),
    FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE,
    FOREIGN KEY(entry_id) REFERENCES bib_entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_resource_citations_entry
    ON resource_citations(entry_id);

CREATE TABLE IF NOT EXISTS citation_occurrences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT NOT NULL,
    entry_id TEXT,
    command_name TEXT NOT NULL,
    citation_key TEXT NOT NULL,
    byte_start INTEGER NOT NULL,
    byte_end INTEGER NOT NULL,
    scan_status TEXT NOT NULL DEFAULT 'resolved'
        CHECK(scan_status IN ('resolved', 'missing', 'ambiguous')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE,
    FOREIGN KEY(entry_id) REFERENCES bib_entries(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_citation_occurrences_resource
    ON citation_occurrences(resource_id);
CREATE INDEX IF NOT EXISTS idx_citation_occurrences_key
    ON citation_occurrences(citation_key);

CREATE TRIGGER IF NOT EXISTS update_bib_sources_timestamp
AFTER UPDATE ON bib_sources
BEGIN
    UPDATE bib_sources SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_bib_entries_timestamp
AFTER UPDATE ON bib_entries
BEGIN
    UPDATE bib_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
