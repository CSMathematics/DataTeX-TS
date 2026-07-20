-- ============================================================================
-- Bibliography Federation Strategy
-- Per-collection sharing/sync metadata. This is deliberately a strategy layer:
-- it records where and how a bibliography collection should federate without
-- performing network writes or storing credentials.
-- ============================================================================

CREATE TABLE IF NOT EXISTS bib_collection_federation (
    id TEXT PRIMARY KEY NOT NULL,
    collection TEXT NOT NULL UNIQUE,
    remote_kind TEXT NOT NULL DEFAULT 'shared_folder'
        CHECK(remote_kind IN ('shared_folder', 'git', 'zotero', 'webdav', 'custom')),
    remote_url TEXT,
    sync_mode TEXT NOT NULL DEFAULT 'manual'
        CHECK(sync_mode IN ('manual', 'pull_only', 'push_pull')),
    conflict_policy TEXT NOT NULL DEFAULT 'manual'
        CHECK(conflict_policy IN ('manual', 'local_wins', 'remote_wins')),
    is_enabled INTEGER NOT NULL DEFAULT 0
        CHECK(is_enabled IN (0, 1)),
    sync_status TEXT NOT NULL DEFAULT 'not_configured'
        CHECK(sync_status IN ('not_configured', 'idle', 'syncing', 'error')),
    last_sync_at DATETIME,
    last_error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(collection) REFERENCES collections(name) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bib_collection_federation_kind
    ON bib_collection_federation(remote_kind, is_enabled);
CREATE INDEX IF NOT EXISTS idx_bib_collection_federation_status
    ON bib_collection_federation(sync_status, updated_at DESC);

CREATE TRIGGER IF NOT EXISTS update_bib_collection_federation_timestamp
AFTER UPDATE ON bib_collection_federation
BEGIN
    UPDATE bib_collection_federation SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
