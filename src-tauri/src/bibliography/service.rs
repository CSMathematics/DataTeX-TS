use crate::bibliography::importers::{import_bibliography, ImportedBibliographyEntry};
use crate::bibliography::lookup::lookup_doi;
use crate::bibliography::parser::{parse_bibliography, BibDiagnostic, BibEntry, BibField};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{Pool, Row, Sqlite};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::{Path, PathBuf};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibliographySourceSummary {
    pub id: String,
    pub resource_id: String,
    pub path: String,
    pub parse_status: String,
    pub content_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibliographyImportResult {
    pub source: BibliographySourceSummary,
    pub entries_imported: usize,
    pub diagnostics: Vec<BibDiagnostic>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibliographySourceOption {
    pub id: String,
    pub resource_id: String,
    pub title: Option<String>,
    pub collection: Option<String>,
    pub path: String,
    pub parse_status: String,
    pub entry_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibliographyEntrySummary {
    pub id: String,
    pub source_id: String,
    pub entry_type: String,
    pub citation_key: String,
    pub title: Option<String>,
    pub year: Option<String>,
    pub date: Option<String>,
    pub doi: Option<String>,
    pub url: Option<String>,
    pub raw_entry: Option<String>,
    pub tags: Vec<String>,
    pub fields: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibliographyTagSummary {
    pub id: String,
    pub name: String,
    pub entry_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibliographyHistorySummary {
    pub id: i64,
    pub source_id: Option<String>,
    pub entry_id: Option<String>,
    pub resource_id: Option<String>,
    pub action: String,
    pub summary: Option<String>,
    pub details: serde_json::Value,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibliographyEntryNoteSummary {
    pub id: String,
    pub entry_id: String,
    pub body: String,
    pub note_kind: String,
    pub is_pinned: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibliographyEntryNoteUpsertRequest {
    pub id: Option<String>,
    pub entry_id: String,
    pub body: String,
    pub note_kind: Option<String>,
    pub is_pinned: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibliographyEntryAttachmentSummary {
    pub id: String,
    pub entry_id: String,
    pub resource_id: Option<String>,
    pub path: String,
    pub title: Option<String>,
    pub attachment_kind: String,
    pub mime_type: Option<String>,
    pub file_size: Option<i64>,
    pub is_primary: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibliographyEntryAttachmentRequest {
    pub entry_id: String,
    pub path: String,
    pub title: Option<String>,
    pub attachment_kind: Option<String>,
    pub is_primary: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibliographyPdfAnnotationSummary {
    pub id: String,
    pub entry_id: String,
    pub attachment_id: String,
    pub attachment_path: String,
    pub attachment_title: Option<String>,
    pub page: i64,
    pub annotation_kind: String,
    pub selected_text: Option<String>,
    pub comment: Option<String>,
    pub color: Option<String>,
    pub rects: serde_json::Value,
    pub external_annotation_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibliographyPdfAnnotationUpsertRequest {
    pub id: Option<String>,
    pub entry_id: String,
    pub attachment_id: String,
    pub page: i64,
    pub annotation_kind: Option<String>,
    pub selected_text: Option<String>,
    pub comment: Option<String>,
    pub color: Option<String>,
    pub rects: Option<serde_json::Value>,
    pub external_annotation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibliographyBackfillResult {
    pub sources_created: usize,
    pub entries_imported: usize,
    pub skipped_existing: usize,
    pub skipped_invalid: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibliographyContentImportRequest {
    pub content: String,
    pub format: Option<String>,
    pub source_label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibliographyContentImportResult {
    pub source: BibliographySourceSummary,
    pub format: String,
    pub entries_imported: usize,
    pub skipped_invalid: usize,
    pub diagnostics: Vec<BibDiagnostic>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibliographyDoiLookupRequest {
    pub doi: String,
    pub provider: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibliographyDoiLookupResult {
    pub provider: String,
    pub doi: String,
    pub entry_type: String,
    pub citation_key: Option<String>,
    pub fields: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackedBibliographyResource {
    pub resource_id: String,
    pub path: String,
    pub content_hash: Option<String>,
    pub source_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibliographyEntryUpdateRequest {
    pub entry_id: String,
    pub entry_type: Option<String>,
    pub citation_key: Option<String>,
    pub fields: Option<serde_json::Value>,
    pub raw_entry: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchBibliographyEntryUpdateRequest {
    pub entry_ids: Vec<String>,
    pub set_fields: Option<serde_json::Value>,
    pub remove_fields: Option<Vec<String>>,
    pub add_tags: Option<Vec<String>>,
    pub remove_tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CitationOccurrenceSummary {
    pub command_name: String,
    pub citation_key: String,
    pub byte_start: usize,
    pub byte_end: usize,
    pub scan_status: String,
    pub entry_id: Option<String>,
    pub entry_type: Option<String>,
    pub title: Option<String>,
    pub year: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CitationScanResult {
    pub resource_id: String,
    pub linked_source_count: usize,
    pub total: usize,
    pub resolved: usize,
    pub missing: usize,
    pub ambiguous: usize,
    pub occurrences: Vec<CitationOccurrenceSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CitationKeyResolutionSummary {
    pub citation_key: String,
    pub scan_status: String,
    pub entry_count: usize,
    pub entries: Vec<BibliographyEntrySummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibliographyDeclarationSummary {
    pub command_name: String,
    pub requested: String,
    pub normalized_name: String,
    pub byte_start: usize,
    pub byte_end: usize,
    pub matches: Vec<BibliographySourceOption>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibliographyAutoLinkResult {
    pub resource_id: String,
    pub declarations: Vec<BibliographyDeclarationSummary>,
    pub linked_sources: Vec<BibliographySourceOption>,
    pub linked_count: usize,
    pub unresolved_count: usize,
    pub ambiguous_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibliographyEntryUsageSummary {
    pub resource_id: String,
    pub resource_path: String,
    pub resource_title: Option<String>,
    pub resource_type: String,
    pub collection: String,
    pub occurrence_count: i64,
    pub first_byte_start: Option<i64>,
    pub commands: Vec<String>,
    pub scan_statuses: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibliographyRelatedEntrySummary {
    pub entry_id: String,
    pub citation_key: String,
    pub entry_type: String,
    pub title: Option<String>,
    pub year: Option<String>,
    pub resource_count: i64,
    pub occurrence_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibliographyCitationGraphSummary {
    pub entry_id: String,
    pub citation_key: String,
    pub used_by: Vec<BibliographyEntryUsageSummary>,
    pub related_entries: Vec<BibliographyRelatedEntrySummary>,
    pub resource_count: usize,
    pub occurrence_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BibliographyCollectionFederationSummary {
    pub id: Option<String>,
    pub collection: String,
    pub remote_kind: String,
    pub remote_url: Option<String>,
    pub sync_mode: String,
    pub conflict_policy: String,
    pub is_enabled: bool,
    pub sync_status: String,
    pub last_sync_at: Option<String>,
    pub last_error: Option<String>,
    pub source_count: i64,
    pub entry_count: i64,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibliographyCollectionFederationRequest {
    pub collection: String,
    pub remote_kind: Option<String>,
    pub remote_url: Option<String>,
    pub sync_mode: Option<String>,
    pub conflict_policy: Option<String>,
    pub is_enabled: Option<bool>,
}

pub async fn reparse_bibliography_resource(
    pool: &Pool<Sqlite>,
    resource_id: &str,
) -> Result<BibliographyImportResult, String> {
    let resource = sqlx::query("SELECT id, path, type FROM resources WHERE id = ?")
        .bind(resource_id)
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("Failed to load bibliography resource: {error}"))?
        .ok_or_else(|| format!("Resource '{resource_id}' was not found"))?;

    let kind: String = resource
        .try_get("type")
        .map_err(|error| format!("Failed to read resource type: {error}"))?;
    if kind != "bibliography" {
        return Err(format!(
            "Resource '{resource_id}' is type '{kind}', not bibliography"
        ));
    }

    let path: String = resource
        .try_get("path")
        .map_err(|error| format!("Failed to read bibliography path: {error}"))?;
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|error| format!("Failed to read bibliography file '{path}': {error}"))?;
    let content_hash = hash_content(&content);
    let parsed = parse_bibliography(&content);
    let parse_status = parse_status(parsed.entries.len(), parsed.diagnostics.len());

    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("Failed to begin bibliography import: {error}"))?;

    let existing_source_id: Option<String> =
        sqlx::query_scalar("SELECT id FROM bib_sources WHERE resource_id = ?")
            .bind(resource_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|error| format!("Failed to look up bibliography source: {error}"))?;
    let source_id = existing_source_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let diagnostics_json = serde_json::to_value(&parsed.diagnostics)
        .map_err(|error| format!("Failed to serialize bibliography diagnostics: {error}"))?;
    let preserved_tags = load_tags_by_citation_key(&mut transaction, &source_id).await?;

    sqlx::query(
        "INSERT INTO bib_sources (
            id, resource_id, source_kind, path, content_hash, parse_status, diagnostics_json, parsed_at
         )
         VALUES (?, ?, 'file', ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(resource_id) DO UPDATE SET
            path = excluded.path,
            content_hash = excluded.content_hash,
            parse_status = excluded.parse_status,
            diagnostics_json = excluded.diagnostics_json,
            parsed_at = excluded.parsed_at",
    )
    .bind(&source_id)
    .bind(resource_id)
    .bind(&path)
    .bind(&content_hash)
    .bind(parse_status)
    .bind(diagnostics_json)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("Failed to save bibliography source: {error}"))?;

    sqlx::query("DELETE FROM bib_entry_fts WHERE source_id = ?")
        .bind(&source_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to clear previous bibliography search index: {error}"))?;

    sqlx::query("DELETE FROM bib_entries WHERE source_id = ?")
        .bind(&source_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to clear previous bibliography entries: {error}"))?;

    for entry in &parsed.entries {
        let entry_id = Uuid::new_v4().to_string();
        let fields_json = fields_to_json(&entry.fields)?;

        sqlx::query(
            "INSERT INTO bib_entries (
                id, source_id, entry_type, citation_key, title, subtitle, year, date,
                doi, isbn, issn, url, abstract, raw_entry, fields_json
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&entry_id)
        .bind(&source_id)
        .bind(&entry.entry_type)
        .bind(&entry.citation_key)
        .bind(field_value(entry, "title"))
        .bind(field_value(entry, "subtitle"))
        .bind(field_value(entry, "year"))
        .bind(field_value(entry, "date"))
        .bind(field_value(entry, "doi"))
        .bind(field_value(entry, "isbn"))
        .bind(field_value(entry, "issn"))
        .bind(field_value(entry, "url"))
        .bind(field_value(entry, "abstract"))
        .bind(&entry.raw)
        .bind(fields_json)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to save bibliography entry: {error}"))?;

        insert_names(&mut transaction, &entry_id, entry).await?;
        if let Some(tags) = preserved_tags.get(&entry.citation_key.to_ascii_lowercase()) {
            for tag_name in tags {
                let tag_id = ensure_tag(&mut transaction, tag_name).await?;
                sqlx::query(
                    "INSERT OR IGNORE INTO bib_entry_tags (entry_id, tag_id) VALUES (?, ?)",
                )
                .bind(&entry_id)
                .bind(tag_id)
                .execute(&mut *transaction)
                .await
                .map_err(|error| format!("Failed to restore bibliography tag link: {error}"))?;
            }
        }
        refresh_bibliography_fts_for_entry(&mut transaction, &entry_id).await?;
    }

    sqlx::query("UPDATE resources SET content_hash = ? WHERE id = ?")
        .bind(&content_hash)
        .bind(resource_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to update bibliography resource hash: {error}"))?;

    record_bibliography_history(
        &mut transaction,
        Some(&source_id),
        None,
        Some(resource_id),
        "import",
        Some(&format!(
            "Imported {} bibliography entr{}",
            parsed.entries.len(),
            if parsed.entries.len() == 1 {
                "y"
            } else {
                "ies"
            }
        )),
        serde_json::json!({
            "entriesImported": parsed.entries.len(),
            "diagnostics": parsed.diagnostics.len(),
            "contentHash": content_hash,
            "parseStatus": parse_status,
        }),
    )
    .await?;

    transaction
        .commit()
        .await
        .map_err(|error| format!("Failed to commit bibliography import: {error}"))?;

    Ok(BibliographyImportResult {
        source: BibliographySourceSummary {
            id: source_id,
            resource_id: resource_id.to_string(),
            path,
            parse_status: parse_status.to_string(),
            content_hash,
        },
        entries_imported: parsed.entries.len(),
        diagnostics: parsed.diagnostics,
    })
}

pub async fn list_bibliography_entries_for_resource(
    pool: &Pool<Sqlite>,
    resource_id: &str,
) -> Result<Vec<BibliographyEntrySummary>, String> {
    let rows = sqlx::query(
        "SELECT e.id, e.source_id, e.entry_type, e.citation_key, e.title, e.year,
                e.date, e.doi, e.url, e.raw_entry, e.fields_json,
                COALESCE((
                    SELECT group_concat(name, char(31))
                    FROM (
                        SELECT t.name AS name
                        FROM bib_entry_tags et
                        INNER JOIN bib_tags t ON t.id = et.tag_id
                        WHERE et.entry_id = e.id
                        ORDER BY lower(t.name)
                    )
                ), '') AS tags_joined
         FROM bib_entries e
         INNER JOIN bib_sources s ON s.id = e.source_id
         WHERE s.resource_id = ?
         ORDER BY lower(e.citation_key) ASC",
    )
    .bind(resource_id)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("Failed to list bibliography entries: {error}"))?;

    rows.into_iter().map(entry_summary_from_row).collect()
}

pub async fn search_bibliography_entries(
    pool: &Pool<Sqlite>,
    resource_id: Option<&str>,
    query_text: &str,
    limit: i64,
) -> Result<Vec<BibliographyEntrySummary>, String> {
    let linked_source_ids = match resource_id {
        Some(resource_id) => linked_source_ids(pool, resource_id).await?,
        None => Vec::new(),
    };
    let limit = limit.clamp(1, 200);
    let query_text = query_text.trim().to_ascii_lowercase();
    let fts_query = fts_query_text(&query_text);
    let like_query = format!("%{query_text}%");
    let prefix_query = format!("{query_text}%");

    let mut sql = String::from(
        "SELECT e.id, e.source_id, e.entry_type, e.citation_key, e.title, e.year,
                e.date, e.doi, e.url, e.raw_entry, e.fields_json,
                COALESCE((
                    SELECT group_concat(name, char(31))
                    FROM (
                        SELECT t.name AS name
                        FROM bib_entry_tags et
                        INNER JOIN bib_tags t ON t.id = et.tag_id
                        WHERE et.entry_id = e.id
                        ORDER BY lower(t.name)
                    )
                ), '') AS tags_joined
         FROM bib_entries e",
    );
    let mut conditions = Vec::new();
    if !linked_source_ids.is_empty() {
        let placeholders = std::iter::repeat("?")
            .take(linked_source_ids.len())
            .collect::<Vec<_>>()
            .join(", ");
        conditions.push(format!("e.source_id IN ({placeholders})"));
    }
    if fts_query.is_some() {
        conditions.push(
            "e.id IN (
                SELECT entry_id FROM bib_entry_fts
                WHERE bib_entry_fts MATCH ?
            )"
            .to_string(),
        );
    } else if !query_text.is_empty() {
        conditions.push(
            "(lower(e.citation_key) LIKE ?
              OR lower(COALESCE(e.title, '')) LIKE ?
              OR lower(COALESCE(e.year, '')) LIKE ?
              OR lower(COALESCE(e.doi, '')) LIKE ?
              OR EXISTS (
                  SELECT 1 FROM bib_entry_names n
                  WHERE n.entry_id = e.id AND n.normalized_name LIKE ?
              ))"
            .to_string(),
        );
    }
    if !conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }
    sql.push_str(
        " ORDER BY
            CASE
                WHEN lower(e.citation_key) = ? THEN 0
                WHEN lower(e.citation_key) LIKE ? THEN 1
                ELSE 2
            END,
            lower(e.citation_key) ASC
          LIMIT ?",
    );

    let mut query = sqlx::query(&sql);
    for source_id in &linked_source_ids {
        query = query.bind(source_id);
    }
    if let Some(fts_query) = &fts_query {
        query = query.bind(fts_query);
    } else if !query_text.is_empty() {
        query = query
            .bind(&like_query)
            .bind(&like_query)
            .bind(&like_query)
            .bind(&like_query)
            .bind(&like_query);
    }
    let rows = query
        .bind(&query_text)
        .bind(&prefix_query)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|error| format!("Failed to search bibliography entries: {error}"))?;

    rows.into_iter().map(entry_summary_from_row).collect()
}

pub async fn list_workspace_bibliography_entries(
    pool: &Pool<Sqlite>,
    source_id: Option<&str>,
    query_text: &str,
    entry_type: Option<&str>,
    smart_view: Option<&str>,
    tag: Option<&str>,
    limit: i64,
) -> Result<Vec<BibliographyEntrySummary>, String> {
    let limit = limit.clamp(1, 1000);
    let query_text = query_text.trim().to_ascii_lowercase();
    let entry_type = entry_type
        .map(str::trim)
        .filter(|value| !value.is_empty() && *value != "__all__")
        .map(str::to_ascii_lowercase);
    let smart_view = smart_view
        .map(str::trim)
        .filter(|value| !value.is_empty() && *value != "all");
    let tag = tag
        .map(normalize_tag_name)
        .filter(|value| !value.is_empty() && value != "__all__");
    let fts_query = fts_query_text(&query_text);
    let like_query = format!("%{query_text}%");
    let prefix_query = format!("{query_text}%");

    let mut sql = String::from(
        "SELECT e.id, e.source_id, e.entry_type, e.citation_key, e.title, e.year,
                e.date, e.doi, e.url, e.raw_entry, e.fields_json,
                COALESCE((
                    SELECT group_concat(name, char(31))
                    FROM (
                        SELECT t.name AS name
                        FROM bib_entry_tags et
                        INNER JOIN bib_tags t ON t.id = et.tag_id
                        WHERE et.entry_id = e.id
                        ORDER BY lower(t.name)
                    )
                ), '') AS tags_joined
         FROM bib_entries e",
    );
    let mut conditions = Vec::new();
    if source_id.is_some() {
        conditions.push("e.source_id = ?".to_string());
    }
    if entry_type.is_some() {
        conditions.push("lower(e.entry_type) = ?".to_string());
    }
    if tag.is_some() {
        conditions.push(
            "EXISTS (
                SELECT 1
                FROM bib_entry_tags et
                INNER JOIN bib_tags t ON t.id = et.tag_id
                WHERE et.entry_id = e.id AND lower(t.name) = ?
            )"
            .to_string(),
        );
    }
    if fts_query.is_some() {
        conditions.push(
            "e.id IN (
                SELECT entry_id FROM bib_entry_fts
                WHERE bib_entry_fts MATCH ?
            )"
            .to_string(),
        );
    } else if !query_text.is_empty() {
        conditions.push(
            "(lower(e.citation_key) LIKE ?
              OR lower(COALESCE(e.entry_type, '')) LIKE ?
              OR lower(COALESCE(e.title, '')) LIKE ?
              OR lower(COALESCE(e.year, '')) LIKE ?
              OR lower(COALESCE(e.date, '')) LIKE ?
              OR lower(COALESCE(e.doi, '')) LIKE ?
              OR lower(COALESCE(e.url, '')) LIKE ?
              OR EXISTS (
                  SELECT 1 FROM bib_entry_names n
                  WHERE n.entry_id = e.id AND n.normalized_name LIKE ?
              ))"
            .to_string(),
        );
    }
    match smart_view {
        Some("missing_metadata") => conditions.push(
            "(COALESCE(trim(e.title), '') = ''
              OR COALESCE(trim(COALESCE(e.year, e.date)), '') = ''
              OR NOT EXISTS (
                  SELECT 1 FROM bib_entry_names n
                  WHERE n.entry_id = e.id AND n.role IN ('author', 'editor')
              ))"
            .to_string(),
        ),
        Some("with_doi") => {
            conditions.push("COALESCE(trim(e.doi), '') != ''".to_string());
        }
        Some("without_doi") => {
            conditions.push("COALESCE(trim(e.doi), '') = ''".to_string());
        }
        Some("duplicate_candidates") => conditions.push(
            "EXISTS (
                SELECT 1 FROM bib_entries other
                WHERE other.id != e.id
                  AND (
                    lower(other.citation_key) = lower(e.citation_key)
                    OR (
                      COALESCE(trim(other.doi), '') != ''
                      AND lower(other.doi) = lower(e.doi)
                    )
                    OR (
                      COALESCE(trim(other.title), '') != ''
                      AND lower(trim(other.title)) = lower(trim(e.title))
                      AND lower(COALESCE(other.year, other.date, '')) =
                          lower(COALESCE(e.year, e.date, ''))
                    )
                  )
              )"
            .to_string(),
        ),
        Some(_) | None => {}
    }
    if !conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }
    sql.push_str(
        " ORDER BY
            CASE
                WHEN lower(e.citation_key) = ? THEN 0
                WHEN lower(e.citation_key) LIKE ? THEN 1
                ELSE 2
            END,
            lower(COALESCE(e.year, e.date, '')) DESC,
            lower(e.citation_key) ASC
          LIMIT ?",
    );

    let mut query = sqlx::query(&sql);
    if let Some(source_id) = source_id {
        query = query.bind(source_id);
    }
    if let Some(entry_type) = &entry_type {
        query = query.bind(entry_type);
    }
    if let Some(tag) = &tag {
        query = query.bind(tag);
    }
    if let Some(fts_query) = &fts_query {
        query = query.bind(fts_query);
    } else if !query_text.is_empty() {
        query = query
            .bind(&like_query)
            .bind(&like_query)
            .bind(&like_query)
            .bind(&like_query)
            .bind(&like_query)
            .bind(&like_query)
            .bind(&like_query)
            .bind(&like_query);
    }

    let rows = query
        .bind(&query_text)
        .bind(&prefix_query)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|error| format!("Failed to list bibliography workspace entries: {error}"))?;

    rows.into_iter().map(entry_summary_from_row).collect()
}

pub async fn update_bibliography_entry(
    pool: &Pool<Sqlite>,
    request: BibliographyEntryUpdateRequest,
) -> Result<BibliographyEntrySummary, String> {
    let existing = sqlx::query(
        "SELECT id, source_id, entry_type, citation_key, fields_json, raw_entry
         FROM bib_entries
         WHERE id = ?",
    )
    .bind(&request.entry_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("Failed to load bibliography entry: {error}"))?
    .ok_or_else(|| format!("Bibliography entry '{}' was not found", request.entry_id))?;

    let mut entry_type: String = existing.get("entry_type");
    let mut citation_key: String = existing.get("citation_key");
    let mut fields: serde_json::Value = existing
        .try_get("fields_json")
        .map_err(|error| format!("Failed to read bibliography fields: {error}"))?;
    let raw_entry = request
        .raw_entry
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let raw_entry = if let Some(raw_entry) = raw_entry {
        let parsed = parse_bibliography(raw_entry);
        if let Some(diagnostic) = parsed.diagnostics.first() {
            return Err(format!(
                "Raw BibTeX could not be parsed: {}",
                diagnostic.message
            ));
        }
        let entry = parsed
            .entries
            .first()
            .ok_or_else(|| "Raw BibTeX must contain one bibliography entry".to_string())?;
        if parsed.entries.len() != 1 {
            return Err("Raw BibTeX editor accepts exactly one bibliography entry".to_string());
        }
        entry_type = entry.entry_type.clone();
        citation_key = entry.citation_key.clone();
        fields = fields_to_json(&entry.fields)?;
        entry.raw.clone()
    } else {
        if let Some(value) = request.entry_type {
            entry_type = sanitize_bib_identifier(&value)
                .ok_or_else(|| "Entry type cannot be empty".to_string())?;
        }
        if let Some(value) = request.citation_key {
            citation_key = sanitize_citation_key(&value)
                .ok_or_else(|| "Citation key cannot be empty".to_string())?;
        }
        if let Some(value) = request.fields {
            fields = normalize_fields_json(value)?;
        }
        build_raw_entry(&entry_type, &citation_key, &fields)?
    };

    let source_id: String = existing.get("source_id");
    let duplicate: Option<String> = sqlx::query_scalar(
        "SELECT id FROM bib_entries
         WHERE source_id = ? AND citation_key = ? AND id != ?
         LIMIT 1",
    )
    .bind(&source_id)
    .bind(&citation_key)
    .bind(&request.entry_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("Failed to validate citation key: {error}"))?;
    if duplicate.is_some() {
        return Err(format!(
            "Citation key '{}' already exists in this bibliography source",
            citation_key
        ));
    }

    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("Failed to begin bibliography entry update: {error}"))?;
    sqlx::query(
        "UPDATE bib_entries
         SET entry_type = ?, citation_key = ?, title = ?, subtitle = ?, year = ?, date = ?,
             doi = ?, isbn = ?, issn = ?, url = ?, abstract = ?, raw_entry = ?, fields_json = ?
         WHERE id = ?",
    )
    .bind(&entry_type)
    .bind(&citation_key)
    .bind(json_field_value(&fields, "title"))
    .bind(json_field_value(&fields, "subtitle"))
    .bind(json_field_value(&fields, "year"))
    .bind(json_field_value(&fields, "date"))
    .bind(json_field_value(&fields, "doi"))
    .bind(json_field_value(&fields, "isbn"))
    .bind(json_field_value(&fields, "issn"))
    .bind(json_field_value(&fields, "url"))
    .bind(json_field_value(&fields, "abstract"))
    .bind(&raw_entry)
    .bind(&fields)
    .bind(&request.entry_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("Failed to save bibliography entry: {error}"))?;

    sqlx::query("DELETE FROM bib_entry_names WHERE entry_id = ?")
        .bind(&request.entry_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to clear bibliography creators: {error}"))?;
    insert_names_from_fields(&mut transaction, &request.entry_id, &fields).await?;
    refresh_bibliography_fts_for_entry(&mut transaction, &request.entry_id).await?;
    record_bibliography_history(
        &mut transaction,
        Some(&source_id),
        Some(&request.entry_id),
        None,
        "entry_update",
        Some(&format!("Updated bibliography entry {citation_key}")),
        serde_json::json!({
            "entryType": entry_type,
            "citationKey": citation_key,
            "rawEdit": request.raw_entry.is_some(),
        }),
    )
    .await?;

    transaction
        .commit()
        .await
        .map_err(|error| format!("Failed to commit bibliography entry update: {error}"))?;

    let row = sqlx::query(
        "SELECT e.id, e.source_id, e.entry_type, e.citation_key, e.title, e.year,
                e.date, e.doi, e.url, e.raw_entry, e.fields_json,
                COALESCE((
                    SELECT group_concat(name, char(31))
                    FROM (
                        SELECT t.name AS name
                        FROM bib_entry_tags et
                        INNER JOIN bib_tags t ON t.id = et.tag_id
                        WHERE et.entry_id = e.id
                        ORDER BY lower(t.name)
                    )
                ), '') AS tags_joined
         FROM bib_entries e
         WHERE e.id = ?",
    )
    .bind(&request.entry_id)
    .fetch_one(pool)
    .await
    .map_err(|error| format!("Failed to reload bibliography entry: {error}"))?;
    entry_summary_from_row(row)
}

pub async fn list_bibliography_tags(
    pool: &Pool<Sqlite>,
) -> Result<Vec<BibliographyTagSummary>, String> {
    let rows = sqlx::query(
        "SELECT t.id, t.name, COUNT(et.entry_id) AS entry_count
         FROM bib_tags t
         LEFT JOIN bib_entry_tags et ON et.tag_id = t.id
         GROUP BY t.id, t.name
         ORDER BY lower(t.name)",
    )
    .fetch_all(pool)
    .await
    .map_err(|error| format!("Failed to list bibliography tags: {error}"))?;

    Ok(rows
        .into_iter()
        .map(|row| BibliographyTagSummary {
            id: row.get("id"),
            name: row.get("name"),
            entry_count: row.get("entry_count"),
        })
        .collect())
}

pub async fn list_tracked_bibliography_resources(
    pool: &Pool<Sqlite>,
) -> Result<Vec<TrackedBibliographyResource>, String> {
    let rows = sqlx::query(
        "SELECT r.id AS resource_id, r.path, r.content_hash, s.id AS source_id
         FROM resources r
         LEFT JOIN bib_sources s ON s.resource_id = r.id
         WHERE r.type = 'bibliography' AND COALESCE(trim(r.path), '') != ''
         ORDER BY lower(r.path)",
    )
    .fetch_all(pool)
    .await
    .map_err(|error| format!("Failed to list tracked bibliography resources: {error}"))?;

    Ok(rows
        .into_iter()
        .map(|row| TrackedBibliographyResource {
            resource_id: row.get("resource_id"),
            path: row.get("path"),
            content_hash: row.try_get("content_hash").ok(),
            source_id: row.try_get("source_id").ok(),
        })
        .collect())
}

pub async fn reparse_changed_bibliography_path(
    pool: &Pool<Sqlite>,
    changed_path: &Path,
) -> Result<Option<BibliographyImportResult>, String> {
    let Some(resource) = find_tracked_bibliography_by_path(pool, changed_path).await? else {
        return Ok(None);
    };
    let content = tokio::fs::read_to_string(&resource.path)
        .await
        .map_err(|error| {
            format!(
                "Failed to read changed bibliography '{}': {error}",
                resource.path
            )
        })?;
    let content_hash = hash_content(&content);
    if resource
        .content_hash
        .as_deref()
        .is_some_and(|current| current == content_hash)
    {
        return Ok(None);
    }
    reparse_bibliography_resource(pool, &resource.resource_id)
        .await
        .map(Some)
}

pub async fn backfill_existing_bibliography_metadata(
    pool: &Pool<Sqlite>,
) -> Result<BibliographyBackfillResult, String> {
    let mut result = BibliographyBackfillResult {
        sources_created: 0,
        entries_imported: 0,
        skipped_existing: 0,
        skipped_invalid: 0,
        warnings: Vec::new(),
    };

    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("Failed to begin bibliography backfill: {error}"))?;

    backfill_global_bibliography_table(&mut transaction, &mut result).await?;
    backfill_resource_bibliography_tables(&mut transaction, &mut result).await?;
    backfill_resource_bibliography_metadata_json(&mut transaction, &mut result).await?;

    transaction
        .commit()
        .await
        .map_err(|error| format!("Failed to commit bibliography backfill: {error}"))?;

    Ok(result)
}

pub async fn list_bibliography_history(
    pool: &Pool<Sqlite>,
    source_id: Option<&str>,
    entry_id: Option<&str>,
    resource_id: Option<&str>,
    limit: i64,
) -> Result<Vec<BibliographyHistorySummary>, String> {
    let limit = limit.clamp(1, 500);
    let mut sql = String::from(
        "SELECT id, source_id, entry_id, resource_id, action, summary, details_json, created_at
         FROM bib_history",
    );
    let mut conditions = Vec::new();
    if source_id.is_some() {
        conditions.push("source_id = ?");
    }
    if entry_id.is_some() {
        conditions.push("entry_id = ?");
    }
    if resource_id.is_some() {
        conditions.push("resource_id = ?");
    }
    if !conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }
    sql.push_str(" ORDER BY datetime(created_at) DESC, id DESC LIMIT ?");

    let mut query = sqlx::query(&sql);
    if let Some(source_id) = source_id {
        query = query.bind(source_id);
    }
    if let Some(entry_id) = entry_id {
        query = query.bind(entry_id);
    }
    if let Some(resource_id) = resource_id {
        query = query.bind(resource_id);
    }

    let rows = query
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|error| format!("Failed to list bibliography history: {error}"))?;

    rows.into_iter()
        .map(|row| {
            let details = row
                .try_get::<serde_json::Value, _>("details_json")
                .unwrap_or_else(|_| serde_json::json!({}));
            Ok(BibliographyHistorySummary {
                id: row.get("id"),
                source_id: row.try_get("source_id").ok(),
                entry_id: row.try_get("entry_id").ok(),
                resource_id: row.try_get("resource_id").ok(),
                action: row.get("action"),
                summary: row.try_get("summary").ok(),
                details,
                created_at: row.get("created_at"),
            })
        })
        .collect()
}

pub async fn list_bibliography_entry_notes(
    pool: &Pool<Sqlite>,
    entry_id: &str,
) -> Result<Vec<BibliographyEntryNoteSummary>, String> {
    let rows = sqlx::query(
        "SELECT id, entry_id, body, note_kind, is_pinned, created_at, updated_at
         FROM bib_entry_notes
         WHERE entry_id = ?
         ORDER BY is_pinned DESC, datetime(updated_at) DESC, datetime(created_at) DESC",
    )
    .bind(entry_id)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("Failed to list bibliography entry notes: {error}"))?;

    Ok(rows.into_iter().map(note_summary_from_row).collect())
}

pub async fn save_bibliography_entry_note(
    pool: &Pool<Sqlite>,
    request: BibliographyEntryNoteUpsertRequest,
) -> Result<BibliographyEntryNoteSummary, String> {
    let body = request.body.trim();
    if body.is_empty() {
        return Err("Bibliography note cannot be empty".to_string());
    }
    let note_kind = normalize_note_kind(request.note_kind.as_deref());
    let is_pinned = request.is_pinned.unwrap_or(false);
    let updating_existing = request.id.is_some();
    let note_id = request.id.unwrap_or_else(|| Uuid::new_v4().to_string());

    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("Failed to begin bibliography note save: {error}"))?;
    ensure_entry_exists(&mut transaction, &request.entry_id).await?;
    let source_id: Option<String> =
        sqlx::query_scalar("SELECT source_id FROM bib_entries WHERE id = ?")
            .bind(&request.entry_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|error| format!("Failed to load bibliography entry source: {error}"))?;

    if updating_existing {
        let result = sqlx::query(
            "UPDATE bib_entry_notes
             SET body = ?, note_kind = ?, is_pinned = ?
             WHERE id = ? AND entry_id = ?",
        )
        .bind(body)
        .bind(&note_kind)
        .bind(if is_pinned { 1 } else { 0 })
        .bind(&note_id)
        .bind(&request.entry_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to update bibliography note: {error}"))?;
        if result.rows_affected() == 0 {
            return Err(format!(
                "Bibliography note '{}' was not found for this entry",
                note_id
            ));
        }
    } else {
        sqlx::query(
            "INSERT INTO bib_entry_notes (id, entry_id, body, note_kind, is_pinned)
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&note_id)
        .bind(&request.entry_id)
        .bind(body)
        .bind(&note_kind)
        .bind(if is_pinned { 1 } else { 0 })
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to create bibliography note: {error}"))?;
    }

    record_bibliography_history(
        &mut transaction,
        source_id.as_deref(),
        Some(&request.entry_id),
        None,
        "entry_update",
        Some("Updated bibliography entry note"),
        serde_json::json!({
            "noteId": note_id,
            "noteKind": note_kind,
            "isPinned": is_pinned,
        }),
    )
    .await?;

    transaction
        .commit()
        .await
        .map_err(|error| format!("Failed to commit bibliography note save: {error}"))?;

    let row = sqlx::query(
        "SELECT id, entry_id, body, note_kind, is_pinned, created_at, updated_at
         FROM bib_entry_notes
         WHERE id = ?",
    )
    .bind(&note_id)
    .fetch_one(pool)
    .await
    .map_err(|error| format!("Failed to reload bibliography note: {error}"))?;
    Ok(note_summary_from_row(row))
}

pub async fn delete_bibliography_entry_note(
    pool: &Pool<Sqlite>,
    note_id: &str,
) -> Result<(), String> {
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("Failed to begin bibliography note delete: {error}"))?;
    let note = sqlx::query(
        "SELECT n.entry_id, e.source_id
         FROM bib_entry_notes n
         INNER JOIN bib_entries e ON e.id = n.entry_id
         WHERE n.id = ?",
    )
    .bind(note_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("Failed to load bibliography note: {error}"))?
    .ok_or_else(|| format!("Bibliography note '{}' was not found", note_id))?;
    let entry_id: String = note.get("entry_id");
    let source_id: String = note.get("source_id");

    sqlx::query("DELETE FROM bib_entry_notes WHERE id = ?")
        .bind(note_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to delete bibliography note: {error}"))?;

    record_bibliography_history(
        &mut transaction,
        Some(&source_id),
        Some(&entry_id),
        None,
        "entry_update",
        Some("Deleted bibliography entry note"),
        serde_json::json!({ "noteId": note_id }),
    )
    .await?;

    transaction
        .commit()
        .await
        .map_err(|error| format!("Failed to commit bibliography note delete: {error}"))?;
    Ok(())
}

pub async fn list_bibliography_entry_attachments(
    pool: &Pool<Sqlite>,
    entry_id: &str,
) -> Result<Vec<BibliographyEntryAttachmentSummary>, String> {
    let rows = sqlx::query(
        "SELECT id, entry_id, resource_id, path, title, attachment_kind, mime_type,
                file_size, is_primary, created_at, updated_at
         FROM bib_entry_attachments
         WHERE entry_id = ?
         ORDER BY is_primary DESC, datetime(updated_at) DESC, datetime(created_at) DESC",
    )
    .bind(entry_id)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("Failed to list bibliography entry attachments: {error}"))?;

    Ok(rows.into_iter().map(attachment_summary_from_row).collect())
}

pub async fn attach_bibliography_entry_file(
    pool: &Pool<Sqlite>,
    request: BibliographyEntryAttachmentRequest,
) -> Result<BibliographyEntryAttachmentSummary, String> {
    let canonical_path = canonical_attachment_path(&request.path)?;
    if !canonical_path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("pdf"))
    {
        return Err("Only PDF attachments are supported in this step".to_string());
    }
    let path = canonical_path.to_string_lossy().to_string();
    let metadata = std::fs::metadata(&canonical_path)
        .map_err(|error| format!("Failed to read attachment metadata '{}': {error}", path))?;
    if !metadata.is_file() {
        return Err(format!("Attachment '{}' is not a file", path));
    }
    let attachment_kind = normalize_attachment_kind(request.attachment_kind.as_deref());
    let mime_type = if attachment_kind == "pdf" {
        Some("application/pdf".to_string())
    } else {
        None
    };
    let title = request
        .title
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            canonical_path
                .file_name()
                .and_then(|name| name.to_str())
                .map(ToOwned::to_owned)
        });

    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("Failed to begin bibliography attachment save: {error}"))?;
    ensure_entry_exists(&mut transaction, &request.entry_id).await?;
    let source_id: Option<String> =
        sqlx::query_scalar("SELECT source_id FROM bib_entries WHERE id = ?")
            .bind(&request.entry_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|error| format!("Failed to load bibliography entry source: {error}"))?;
    let resource_id: Option<String> = sqlx::query_scalar("SELECT id FROM resources WHERE path = ?")
        .bind(&path)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to match attachment resource: {error}"))?;

    let existing_attachment = sqlx::query(
        "SELECT id, is_primary FROM bib_entry_attachments WHERE entry_id = ? AND path = ?",
    )
    .bind(&request.entry_id)
    .bind(&path)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("Failed to check existing bibliography attachment: {error}"))?;
    let existing_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM bib_entry_attachments WHERE entry_id = ?")
            .bind(&request.entry_id)
            .fetch_one(&mut *transaction)
            .await
            .map_err(|error| format!("Failed to count bibliography attachments: {error}"))?;
    let existing_is_primary = existing_attachment
        .as_ref()
        .and_then(|row| row.try_get::<i64, _>("is_primary").ok())
        .map(|value| value != 0)
        .unwrap_or(false);
    let is_primary = request
        .is_primary
        .unwrap_or(existing_count == 0 || existing_is_primary);
    let attachment_id = existing_attachment
        .as_ref()
        .map(|row| row.get("id"))
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    if is_primary {
        sqlx::query("UPDATE bib_entry_attachments SET is_primary = 0 WHERE entry_id = ?")
            .bind(&request.entry_id)
            .execute(&mut *transaction)
            .await
            .map_err(|error| {
                format!("Failed to update primary bibliography attachment: {error}")
            })?;
    }

    sqlx::query(
        "INSERT INTO bib_entry_attachments (
            id, entry_id, resource_id, path, title, attachment_kind, mime_type, file_size, is_primary
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(entry_id, path) DO UPDATE SET
            resource_id = excluded.resource_id,
            title = excluded.title,
            attachment_kind = excluded.attachment_kind,
            mime_type = excluded.mime_type,
            file_size = excluded.file_size,
            is_primary = excluded.is_primary",
    )
    .bind(&attachment_id)
    .bind(&request.entry_id)
    .bind(resource_id.as_deref())
    .bind(&path)
    .bind(title.as_deref())
    .bind(&attachment_kind)
    .bind(mime_type.as_deref())
    .bind(metadata.len() as i64)
    .bind(if is_primary { 1 } else { 0 })
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("Failed to save bibliography attachment: {error}"))?;

    record_bibliography_history(
        &mut transaction,
        source_id.as_deref(),
        Some(&request.entry_id),
        None,
        "entry_update",
        Some("Updated bibliography entry attachment"),
        serde_json::json!({
            "attachmentId": attachment_id,
            "path": path,
            "attachmentKind": attachment_kind,
            "isPrimary": is_primary,
        }),
    )
    .await?;

    transaction
        .commit()
        .await
        .map_err(|error| format!("Failed to commit bibliography attachment save: {error}"))?;

    load_bibliography_attachment(pool, &attachment_id).await
}

pub async fn delete_bibliography_entry_attachment(
    pool: &Pool<Sqlite>,
    attachment_id: &str,
) -> Result<(), String> {
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("Failed to begin bibliography attachment delete: {error}"))?;
    let attachment = sqlx::query(
        "SELECT a.entry_id, a.is_primary, e.source_id
         FROM bib_entry_attachments a
         INNER JOIN bib_entries e ON e.id = a.entry_id
         WHERE a.id = ?",
    )
    .bind(attachment_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("Failed to load bibliography attachment: {error}"))?
    .ok_or_else(|| format!("Bibliography attachment '{}' was not found", attachment_id))?;
    let entry_id: String = attachment.get("entry_id");
    let source_id: String = attachment.get("source_id");
    let was_primary = attachment
        .try_get::<i64, _>("is_primary")
        .map(|value| value != 0)
        .unwrap_or(false);

    sqlx::query("DELETE FROM bib_entry_attachments WHERE id = ?")
        .bind(attachment_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to delete bibliography attachment: {error}"))?;

    if was_primary {
        sqlx::query(
            "UPDATE bib_entry_attachments
             SET is_primary = 1
             WHERE id = (
                SELECT id FROM bib_entry_attachments
                WHERE entry_id = ?
                ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC
                LIMIT 1
             )",
        )
        .bind(&entry_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to promote primary bibliography attachment: {error}"))?;
    }

    record_bibliography_history(
        &mut transaction,
        Some(&source_id),
        Some(&entry_id),
        None,
        "entry_update",
        Some("Deleted bibliography entry attachment"),
        serde_json::json!({ "attachmentId": attachment_id }),
    )
    .await?;

    transaction
        .commit()
        .await
        .map_err(|error| format!("Failed to commit bibliography attachment delete: {error}"))?;
    Ok(())
}

pub async fn list_bibliography_pdf_annotations(
    pool: &Pool<Sqlite>,
    entry_id: &str,
) -> Result<Vec<BibliographyPdfAnnotationSummary>, String> {
    let rows = sqlx::query(
        "SELECT pa.id, pa.entry_id, pa.attachment_id, a.path AS attachment_path,
                a.title AS attachment_title, pa.page, pa.annotation_kind,
                pa.selected_text, pa.comment, pa.color, pa.rects_json,
                pa.external_annotation_id, pa.created_at, pa.updated_at
         FROM bib_entry_pdf_annotations pa
         INNER JOIN bib_entry_attachments a ON a.id = pa.attachment_id
         WHERE pa.entry_id = ?
         ORDER BY pa.page ASC, datetime(pa.updated_at) DESC, datetime(pa.created_at) DESC",
    )
    .bind(entry_id)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("Failed to list bibliography PDF annotations: {error}"))?;

    Ok(rows
        .into_iter()
        .map(pdf_annotation_summary_from_row)
        .collect())
}

pub async fn save_bibliography_pdf_annotation(
    pool: &Pool<Sqlite>,
    request: BibliographyPdfAnnotationUpsertRequest,
) -> Result<BibliographyPdfAnnotationSummary, String> {
    if request.page < 1 {
        return Err("PDF annotation page must be 1 or greater".to_string());
    }
    let annotation_kind = normalize_pdf_annotation_kind(request.annotation_kind.as_deref());
    let selected_text = normalized_optional_text(request.selected_text.as_deref());
    let comment = normalized_optional_text(request.comment.as_deref());
    let color = normalize_annotation_color(request.color.as_deref());
    let rects = normalize_rects_json(request.rects)?;
    let external_annotation_id =
        normalized_optional_text(request.external_annotation_id.as_deref());
    let updating_existing = request.id.is_some();
    let annotation_id = request.id.unwrap_or_else(|| Uuid::new_v4().to_string());

    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("Failed to begin bibliography PDF annotation save: {error}"))?;
    ensure_entry_exists(&mut transaction, &request.entry_id).await?;
    let source_id: Option<String> =
        sqlx::query_scalar("SELECT source_id FROM bib_entries WHERE id = ?")
            .bind(&request.entry_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|error| format!("Failed to load bibliography entry source: {error}"))?;
    let attachment_entry_id: Option<String> =
        sqlx::query_scalar("SELECT entry_id FROM bib_entry_attachments WHERE id = ?")
            .bind(&request.attachment_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|error| format!("Failed to validate bibliography PDF attachment: {error}"))?;
    if attachment_entry_id.as_deref() != Some(request.entry_id.as_str()) {
        return Err(
            "PDF annotation must reference an attachment of the same bibliography entry"
                .to_string(),
        );
    }

    if updating_existing {
        let result = sqlx::query(
            "UPDATE bib_entry_pdf_annotations
             SET attachment_id = ?, page = ?, annotation_kind = ?, selected_text = ?,
                 comment = ?, color = ?, rects_json = ?, external_annotation_id = ?
             WHERE id = ? AND entry_id = ?",
        )
        .bind(&request.attachment_id)
        .bind(request.page)
        .bind(&annotation_kind)
        .bind(selected_text.as_deref())
        .bind(comment.as_deref())
        .bind(color.as_deref())
        .bind(&rects)
        .bind(external_annotation_id.as_deref())
        .bind(&annotation_id)
        .bind(&request.entry_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to update bibliography PDF annotation: {error}"))?;
        if result.rows_affected() == 0 {
            return Err(format!(
                "Bibliography PDF annotation '{}' was not found for this entry",
                annotation_id
            ));
        }
    } else {
        sqlx::query(
            "INSERT INTO bib_entry_pdf_annotations (
                id, entry_id, attachment_id, page, annotation_kind, selected_text,
                comment, color, rects_json, external_annotation_id
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&annotation_id)
        .bind(&request.entry_id)
        .bind(&request.attachment_id)
        .bind(request.page)
        .bind(&annotation_kind)
        .bind(selected_text.as_deref())
        .bind(comment.as_deref())
        .bind(color.as_deref())
        .bind(&rects)
        .bind(external_annotation_id.as_deref())
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to create bibliography PDF annotation: {error}"))?;
    }

    record_bibliography_history(
        &mut transaction,
        source_id.as_deref(),
        Some(&request.entry_id),
        None,
        "entry_update",
        Some("Updated bibliography PDF annotation link"),
        serde_json::json!({
            "annotationId": annotation_id,
            "attachmentId": request.attachment_id,
            "page": request.page,
            "annotationKind": annotation_kind,
        }),
    )
    .await?;

    transaction
        .commit()
        .await
        .map_err(|error| format!("Failed to commit bibliography PDF annotation save: {error}"))?;

    load_bibliography_pdf_annotation(pool, &annotation_id).await
}

pub async fn delete_bibliography_pdf_annotation(
    pool: &Pool<Sqlite>,
    annotation_id: &str,
) -> Result<(), String> {
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("Failed to begin bibliography PDF annotation delete: {error}"))?;
    let annotation = sqlx::query(
        "SELECT pa.entry_id, e.source_id
         FROM bib_entry_pdf_annotations pa
         INNER JOIN bib_entries e ON e.id = pa.entry_id
         WHERE pa.id = ?",
    )
    .bind(annotation_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| format!("Failed to load bibliography PDF annotation: {error}"))?
    .ok_or_else(|| {
        format!(
            "Bibliography PDF annotation '{}' was not found",
            annotation_id
        )
    })?;
    let entry_id: String = annotation.get("entry_id");
    let source_id: String = annotation.get("source_id");

    sqlx::query("DELETE FROM bib_entry_pdf_annotations WHERE id = ?")
        .bind(annotation_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to delete bibliography PDF annotation: {error}"))?;

    record_bibliography_history(
        &mut transaction,
        Some(&source_id),
        Some(&entry_id),
        None,
        "entry_update",
        Some("Deleted bibliography PDF annotation link"),
        serde_json::json!({ "annotationId": annotation_id }),
    )
    .await?;

    transaction
        .commit()
        .await
        .map_err(|error| format!("Failed to commit bibliography PDF annotation delete: {error}"))?;
    Ok(())
}

pub async fn bibliography_citation_graph(
    pool: &Pool<Sqlite>,
    entry_id: &str,
    limit: i64,
) -> Result<BibliographyCitationGraphSummary, String> {
    let limit = limit.clamp(1, 200);
    let citation_key: String =
        sqlx::query_scalar("SELECT citation_key FROM bib_entries WHERE id = ?")
            .bind(entry_id)
            .fetch_optional(pool)
            .await
            .map_err(|error| format!("Failed to load bibliography entry for graph: {error}"))?
            .ok_or_else(|| format!("Bibliography entry '{}' was not found", entry_id))?;

    let usage_rows = sqlx::query(
        "SELECT r.id AS resource_id, r.path AS resource_path, r.title AS resource_title,
                r.type AS resource_type, r.collection AS collection,
                COUNT(co.id) AS occurrence_count,
                MIN(co.byte_start) AS first_byte_start,
                COALESCE(group_concat(DISTINCT co.command_name), '') AS commands_joined,
                COALESCE(group_concat(DISTINCT co.scan_status), '') AS statuses_joined
         FROM citation_occurrences co
         INNER JOIN resources r ON r.id = co.resource_id
         WHERE co.entry_id = ? OR (co.entry_id IS NULL AND co.citation_key = ?)
         GROUP BY r.id, r.path, r.title, r.type, r.collection
         ORDER BY occurrence_count DESC, lower(r.title), r.path
         LIMIT ?",
    )
    .bind(entry_id)
    .bind(&citation_key)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("Failed to load bibliography used-by view: {error}"))?;
    let used_by = usage_rows
        .into_iter()
        .map(usage_summary_from_row)
        .collect::<Vec<_>>();

    let related_rows = sqlx::query(
        "WITH citing_resources AS (
            SELECT DISTINCT resource_id
            FROM citation_occurrences
            WHERE entry_id = ? OR (entry_id IS NULL AND citation_key = ?)
         )
         SELECT e.id AS entry_id, e.citation_key, e.entry_type, e.title, e.year,
                COUNT(DISTINCT co.resource_id) AS resource_count,
                COUNT(co.id) AS occurrence_count
         FROM citation_occurrences co
         INNER JOIN citing_resources cr ON cr.resource_id = co.resource_id
         INNER JOIN bib_entries e ON e.id = co.entry_id
         WHERE e.id != ?
         GROUP BY e.id, e.citation_key, e.entry_type, e.title, e.year
         ORDER BY resource_count DESC, occurrence_count DESC, lower(e.citation_key)
         LIMIT ?",
    )
    .bind(entry_id)
    .bind(&citation_key)
    .bind(entry_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("Failed to load bibliography citation graph: {error}"))?;
    let related_entries = related_rows
        .into_iter()
        .map(related_entry_summary_from_row)
        .collect::<Vec<_>>();

    let occurrence_count = used_by
        .iter()
        .map(|usage| usage.occurrence_count)
        .sum::<i64>();

    Ok(BibliographyCitationGraphSummary {
        entry_id: entry_id.to_string(),
        citation_key,
        resource_count: used_by.len(),
        occurrence_count,
        used_by,
        related_entries,
    })
}

pub async fn list_bibliography_collection_federation(
    pool: &Pool<Sqlite>,
) -> Result<Vec<BibliographyCollectionFederationSummary>, String> {
    let rows = sqlx::query(
        "SELECT c.name AS collection,
                f.id, f.remote_kind, f.remote_url, f.sync_mode, f.conflict_policy,
                f.is_enabled, f.sync_status, f.last_sync_at, f.last_error,
                f.created_at, f.updated_at,
                COALESCE(COUNT(DISTINCT s.id), 0) AS source_count,
                COALESCE(COUNT(DISTINCT e.id), 0) AS entry_count
         FROM collections c
         LEFT JOIN resources r ON r.collection = c.name AND r.type = 'bibliography'
         LEFT JOIN bib_sources s ON s.resource_id = r.id
         LEFT JOIN bib_entries e ON e.source_id = s.id
         LEFT JOIN bib_collection_federation f ON f.collection = c.name
         WHERE c.type = 'bibliography'
         GROUP BY c.name, f.id, f.remote_kind, f.remote_url, f.sync_mode,
                  f.conflict_policy, f.is_enabled, f.sync_status, f.last_sync_at,
                  f.last_error, f.created_at, f.updated_at
         ORDER BY lower(c.name)",
    )
    .fetch_all(pool)
    .await
    .map_err(|error| format!("Failed to list bibliography federation settings: {error}"))?;

    Ok(rows
        .into_iter()
        .map(collection_federation_summary_from_row)
        .collect())
}

pub async fn save_bibliography_collection_federation(
    pool: &Pool<Sqlite>,
    request: BibliographyCollectionFederationRequest,
) -> Result<BibliographyCollectionFederationSummary, String> {
    let collection = request.collection.trim();
    if collection.is_empty() {
        return Err("Bibliography collection cannot be empty".to_string());
    }
    let collection_type: Option<String> =
        sqlx::query_scalar("SELECT type FROM collections WHERE name = ?")
            .bind(collection)
            .fetch_optional(pool)
            .await
            .map_err(|error| format!("Failed to validate bibliography collection: {error}"))?;
    if collection_type.as_deref() != Some("bibliography") {
        return Err(format!(
            "Collection '{}' is not a bibliography collection",
            collection
        ));
    }

    let remote_kind = normalize_remote_kind(request.remote_kind.as_deref());
    let remote_url = normalized_optional_text(request.remote_url.as_deref());
    let sync_mode = normalize_sync_mode(request.sync_mode.as_deref());
    let conflict_policy = normalize_conflict_policy(request.conflict_policy.as_deref());
    let is_enabled = request.is_enabled.unwrap_or(false);
    let sync_status = if is_enabled && remote_url.is_some() {
        "idle"
    } else {
        "not_configured"
    };
    let federation_id: Option<String> =
        sqlx::query_scalar("SELECT id FROM bib_collection_federation WHERE collection = ?")
            .bind(collection)
            .fetch_optional(pool)
            .await
            .map_err(|error| {
                format!("Failed to check bibliography federation settings: {error}")
            })?;
    let federation_id = federation_id.unwrap_or_else(|| Uuid::new_v4().to_string());

    sqlx::query(
        "INSERT INTO bib_collection_federation (
            id, collection, remote_kind, remote_url, sync_mode, conflict_policy,
            is_enabled, sync_status, last_error
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
         ON CONFLICT(collection) DO UPDATE SET
            remote_kind = excluded.remote_kind,
            remote_url = excluded.remote_url,
            sync_mode = excluded.sync_mode,
            conflict_policy = excluded.conflict_policy,
            is_enabled = excluded.is_enabled,
            sync_status = excluded.sync_status,
            last_error = NULL",
    )
    .bind(&federation_id)
    .bind(collection)
    .bind(&remote_kind)
    .bind(remote_url.as_deref())
    .bind(&sync_mode)
    .bind(&conflict_policy)
    .bind(if is_enabled { 1 } else { 0 })
    .bind(sync_status)
    .execute(pool)
    .await
    .map_err(|error| format!("Failed to save bibliography federation settings: {error}"))?;

    load_bibliography_collection_federation(pool, collection).await
}

pub async fn delete_bibliography_collection_federation(
    pool: &Pool<Sqlite>,
    collection: &str,
) -> Result<(), String> {
    sqlx::query("DELETE FROM bib_collection_federation WHERE collection = ?")
        .bind(collection.trim())
        .execute(pool)
        .await
        .map_err(|error| format!("Failed to delete bibliography federation settings: {error}"))?;
    Ok(())
}

pub async fn set_bibliography_entry_tags(
    pool: &Pool<Sqlite>,
    entry_id: &str,
    tags: Vec<String>,
) -> Result<BibliographyEntrySummary, String> {
    let tags = normalize_tag_names(tags);
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("Failed to begin bibliography tag update: {error}"))?;
    ensure_entry_exists(&mut transaction, entry_id).await?;
    let source_id: Option<String> =
        sqlx::query_scalar("SELECT source_id FROM bib_entries WHERE id = ?")
            .bind(entry_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|error| format!("Failed to load bibliography entry source: {error}"))?;

    sqlx::query("DELETE FROM bib_entry_tags WHERE entry_id = ?")
        .bind(entry_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to clear bibliography tags: {error}"))?;
    for tag in &tags {
        let tag_id = ensure_tag(&mut transaction, tag).await?;
        sqlx::query("INSERT OR IGNORE INTO bib_entry_tags (entry_id, tag_id) VALUES (?, ?)")
            .bind(entry_id)
            .bind(tag_id)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("Failed to save bibliography tag link: {error}"))?;
    }
    refresh_bibliography_fts_for_entry(&mut transaction, entry_id).await?;
    record_bibliography_history(
        &mut transaction,
        source_id.as_deref(),
        Some(entry_id),
        None,
        "tag_update",
        Some("Updated bibliography entry tags"),
        serde_json::json!({ "tags": tags }),
    )
    .await?;

    transaction
        .commit()
        .await
        .map_err(|error| format!("Failed to commit bibliography tag update: {error}"))?;
    load_entries_by_ids(pool, &[entry_id.to_string()])
        .await?
        .into_iter()
        .next()
        .ok_or_else(|| format!("Bibliography entry '{}' was not found", entry_id))
}

pub async fn batch_update_bibliography_entries(
    pool: &Pool<Sqlite>,
    request: BatchBibliographyEntryUpdateRequest,
) -> Result<Vec<BibliographyEntrySummary>, String> {
    let entry_ids = normalized_entry_ids(request.entry_ids);
    if entry_ids.is_empty() {
        return Err("Select at least one bibliography entry".to_string());
    }
    let set_fields = request
        .set_fields
        .map(normalize_fields_json)
        .transpose()?
        .unwrap_or_else(|| serde_json::Value::Object(serde_json::Map::new()));
    let remove_fields = request
        .remove_fields
        .unwrap_or_default()
        .into_iter()
        .filter_map(|field| sanitize_bib_identifier(&field))
        .collect::<std::collections::HashSet<_>>();
    let add_tags = normalize_tag_names(request.add_tags.unwrap_or_default());
    let remove_tags = normalize_tag_names(request.remove_tags.unwrap_or_default());

    if set_fields
        .as_object()
        .is_none_or(|object| object.is_empty())
        && remove_fields.is_empty()
        && add_tags.is_empty()
        && remove_tags.is_empty()
    {
        return Err("Batch update has no field changes".to_string());
    }

    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("Failed to begin bibliography batch update: {error}"))?;

    for entry_id in &entry_ids {
        let existing = sqlx::query(
            "SELECT source_id, entry_type, citation_key, fields_json
             FROM bib_entries
             WHERE id = ?",
        )
        .bind(entry_id)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to load bibliography entry: {error}"))?
        .ok_or_else(|| format!("Bibliography entry '{}' was not found", entry_id))?;

        let source_id: String = existing.get("source_id");
        let entry_type: String = existing.get("entry_type");
        let citation_key: String = existing.get("citation_key");
        let mut fields: serde_json::Value = existing
            .try_get("fields_json")
            .map_err(|error| format!("Failed to read bibliography fields: {error}"))?;
        merge_fields_json(&mut fields, &set_fields, &remove_fields)?;
        let raw_entry = build_raw_entry(&entry_type, &citation_key, &fields)?;

        sqlx::query(
            "UPDATE bib_entries
             SET title = ?, subtitle = ?, year = ?, date = ?,
                 doi = ?, isbn = ?, issn = ?, url = ?, abstract = ?, raw_entry = ?, fields_json = ?
             WHERE id = ?",
        )
        .bind(json_field_value(&fields, "title"))
        .bind(json_field_value(&fields, "subtitle"))
        .bind(json_field_value(&fields, "year"))
        .bind(json_field_value(&fields, "date"))
        .bind(json_field_value(&fields, "doi"))
        .bind(json_field_value(&fields, "isbn"))
        .bind(json_field_value(&fields, "issn"))
        .bind(json_field_value(&fields, "url"))
        .bind(json_field_value(&fields, "abstract"))
        .bind(&raw_entry)
        .bind(&fields)
        .bind(entry_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to save bibliography entry: {error}"))?;

        sqlx::query("DELETE FROM bib_entry_names WHERE entry_id = ?")
            .bind(entry_id)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("Failed to clear bibliography creators: {error}"))?;
        insert_names_from_fields(&mut transaction, entry_id, &fields).await?;
        apply_tag_delta(&mut transaction, entry_id, &add_tags, &remove_tags).await?;
        refresh_bibliography_fts_for_entry(&mut transaction, entry_id).await?;
        record_bibliography_history(
            &mut transaction,
            Some(&source_id),
            Some(entry_id),
            None,
            "batch_update",
            Some(&format!("Batch updated bibliography entry {citation_key}")),
            serde_json::json!({
                "setFields": set_fields.clone(),
                "removeFields": remove_fields.iter().cloned().collect::<Vec<_>>(),
                "addTags": add_tags.clone(),
                "removeTags": remove_tags.clone(),
            }),
        )
        .await?;
    }

    transaction
        .commit()
        .await
        .map_err(|error| format!("Failed to commit bibliography batch update: {error}"))?;

    load_entries_by_ids(pool, &entry_ids).await
}

pub async fn export_bibliography_entries(
    pool: &Pool<Sqlite>,
    entry_ids: Vec<String>,
) -> Result<String, String> {
    let entry_ids = normalized_entry_ids(entry_ids);
    if entry_ids.is_empty() {
        return Err("Select at least one bibliography entry to export".to_string());
    }

    let entries = load_entries_by_ids(pool, &entry_ids).await?;
    let mut raw_entries = Vec::with_capacity(entries.len());
    for entry in entries {
        if let Some(raw_entry) = entry.raw_entry.filter(|raw| !raw.trim().is_empty()) {
            raw_entries.push(raw_entry);
        } else {
            raw_entries.push(build_raw_entry(
                &entry.entry_type,
                &entry.citation_key,
                &entry.fields,
            )?);
        }
    }
    Ok(format!("{}\n", raw_entries.join("\n\n")))
}

pub async fn export_bibliography_entries_as(
    pool: &Pool<Sqlite>,
    entry_ids: Vec<String>,
    format: &str,
) -> Result<String, String> {
    match format.trim().to_ascii_lowercase().as_str() {
        "bibtex" | "biblatex" | "bib" => export_bibliography_entries(pool, entry_ids).await,
        "csl" | "csl-json" | "json" | "zotero-csl-json" => {
            let entry_ids = normalized_entry_ids(entry_ids);
            if entry_ids.is_empty() {
                return Err("Select at least one bibliography entry to export".to_string());
            }
            let entries = load_entries_by_ids(pool, &entry_ids).await?;
            let items = entries.iter().map(entry_to_csl_json).collect::<Vec<_>>();
            serde_json::to_string_pretty(&items)
                .map(|json| format!("{json}\n"))
                .map_err(|error| format!("Failed to serialize CSL JSON export: {error}"))
        }
        other => Err(format!("Unsupported bibliography export format '{other}'")),
    }
}

pub async fn import_bibliography_content(
    pool: &Pool<Sqlite>,
    request: BibliographyContentImportRequest,
) -> Result<BibliographyContentImportResult, String> {
    let content = request.content.trim();
    if content.is_empty() {
        return Err("Select a non-empty bibliography import file".to_string());
    }

    let imported = import_bibliography(content, request.format.as_deref());
    let source_label = request
        .source_label
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("Imported bibliography");
    let content_hash = hash_content(content);
    let parse_status = parse_status(imported.entries.len(), imported.diagnostics.len());
    let import_format = imported.format.clone();

    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("Failed to begin bibliography import: {error}"))?;
    let source_id = Uuid::new_v4().to_string();
    let diagnostics_json = serde_json::to_value(&imported.diagnostics)
        .map_err(|error| format!("Failed to serialize import diagnostics: {error}"))?;

    sqlx::query(
        "INSERT INTO bib_sources (
            id, resource_id, source_kind, path, content_hash, parse_status, diagnostics_json, parsed_at
         )
         VALUES (?, NULL, 'imported', ?, ?, ?, ?, CURRENT_TIMESTAMP)",
    )
    .bind(&source_id)
    .bind(source_label)
    .bind(&content_hash)
    .bind(parse_status)
    .bind(diagnostics_json)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("Failed to create imported bibliography source: {error}"))?;

    let mut diagnostics = imported.diagnostics;
    let mut skipped_invalid = 0usize;
    let mut seen_keys = HashSet::new();
    let mut imported_count = 0usize;
    for (index, entry) in imported.entries.iter().enumerate() {
        match insert_external_bibliography_entry(
            &mut transaction,
            &source_id,
            entry,
            index,
            &mut seen_keys,
        )
        .await
        {
            Ok(citation_key) => {
                imported_count += 1;
                record_bibliography_history(
                    &mut transaction,
                    Some(&source_id),
                    None,
                    None,
                    "import",
                    Some(&format!("Imported bibliography entry {citation_key}")),
                    serde_json::json!({
                        "format": import_format.clone(),
                        "sourceLabel": source_label,
                        "citationKey": citation_key,
                    }),
                )
                .await?;
            }
            Err(error) => {
                skipped_invalid += 1;
                diagnostics.push(BibDiagnostic {
                    message: error,
                    byte_start: 0,
                    byte_end: 0,
                });
            }
        }
    }

    record_bibliography_history(
        &mut transaction,
        Some(&source_id),
        None,
        None,
        "import",
        Some(&format!(
            "Imported {} {} bibliography entr{}",
            imported_count,
            import_format,
            if imported_count == 1 { "y" } else { "ies" }
        )),
        serde_json::json!({
            "format": import_format.clone(),
            "sourceLabel": source_label,
            "entriesImported": imported_count,
            "skippedInvalid": skipped_invalid,
            "contentHash": content_hash.clone(),
        }),
    )
    .await?;

    transaction
        .commit()
        .await
        .map_err(|error| format!("Failed to commit bibliography import: {error}"))?;

    Ok(BibliographyContentImportResult {
        source: BibliographySourceSummary {
            id: source_id,
            resource_id: String::new(),
            path: source_label.to_string(),
            parse_status: parse_status.to_string(),
            content_hash,
        },
        format: import_format,
        entries_imported: imported_count,
        skipped_invalid,
        diagnostics,
    })
}

pub async fn lookup_bibliography_doi(
    request: BibliographyDoiLookupRequest,
) -> Result<BibliographyDoiLookupResult, String> {
    let candidate = lookup_doi(&request.doi, request.provider.as_deref()).await?;
    Ok(BibliographyDoiLookupResult {
        provider: candidate.provider,
        doi: candidate.doi,
        entry_type: candidate.entry.entry_type,
        citation_key: candidate.entry.citation_key,
        fields: candidate.entry.fields,
    })
}

pub async fn import_bibliography_doi(
    pool: &Pool<Sqlite>,
    request: BibliographyDoiLookupRequest,
) -> Result<BibliographyContentImportResult, String> {
    let candidate = lookup_doi(&request.doi, request.provider.as_deref()).await?;
    let source_label = format!("DOI lookup: {}", candidate.doi);
    let source_id = Uuid::new_v4().to_string();
    let content_hash = hash_content(&format!(
        "{}:{}:{:?}",
        candidate.provider, candidate.doi, candidate.entry.fields
    ));
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("Failed to begin DOI bibliography import: {error}"))?;

    sqlx::query(
        "INSERT INTO bib_sources (
            id, resource_id, source_kind, path, content_hash, parse_status, diagnostics_json, parsed_at
         )
         VALUES (?, NULL, 'imported', ?, ?, 'ok', '[]', CURRENT_TIMESTAMP)",
    )
    .bind(&source_id)
    .bind(&source_label)
    .bind(&content_hash)
    .execute(&mut *transaction)
    .await
    .map_err(|error| format!("Failed to create DOI bibliography source: {error}"))?;

    let mut seen_keys = HashSet::new();
    let citation_key = insert_external_bibliography_entry(
        &mut transaction,
        &source_id,
        &candidate.entry,
        0,
        &mut seen_keys,
    )
    .await?;

    record_bibliography_history(
        &mut transaction,
        Some(&source_id),
        None,
        None,
        "import",
        Some(&format!("Imported DOI metadata {citation_key}")),
        serde_json::json!({
            "format": format!("doi:{}", candidate.provider),
            "doi": candidate.doi,
            "citationKey": citation_key,
        }),
    )
    .await?;

    transaction
        .commit()
        .await
        .map_err(|error| format!("Failed to commit DOI bibliography import: {error}"))?;

    Ok(BibliographyContentImportResult {
        source: BibliographySourceSummary {
            id: source_id,
            resource_id: String::new(),
            path: source_label,
            parse_status: "ok".to_string(),
            content_hash,
        },
        format: format!("doi:{}", candidate.provider),
        entries_imported: 1,
        skipped_invalid: 0,
        diagnostics: Vec::new(),
    })
}

pub async fn list_all_bibliography_sources(
    pool: &Pool<Sqlite>,
) -> Result<Vec<BibliographySourceOption>, String> {
    list_bibliography_sources(pool, None).await
}

pub async fn list_linked_bibliography_sources(
    pool: &Pool<Sqlite>,
    resource_id: &str,
) -> Result<Vec<BibliographySourceOption>, String> {
    list_bibliography_sources(pool, Some(resource_id)).await
}

pub async fn link_bibliography_source(
    pool: &Pool<Sqlite>,
    resource_id: &str,
    source_id: &str,
) -> Result<(), String> {
    let resource_type = resource_type(pool, resource_id).await?;
    if resource_type == "bibliography" {
        return Err("Cannot link a bibliography source to itself as a LaTeX resource".to_string());
    }
    ensure_source_exists(pool, source_id).await?;

    sqlx::query(
        "INSERT OR IGNORE INTO resource_bib_sources (resource_id, source_id, link_kind)
         VALUES (?, ?, 'uses')",
    )
    .bind(resource_id)
    .bind(source_id)
    .execute(pool)
    .await
    .map_err(|error| format!("Failed to link bibliography source: {error}"))?;

    Ok(())
}

pub async fn unlink_bibliography_source(
    pool: &Pool<Sqlite>,
    resource_id: &str,
    source_id: &str,
) -> Result<(), String> {
    sqlx::query(
        "DELETE FROM resource_bib_sources
         WHERE resource_id = ? AND source_id = ? AND link_kind = 'uses'",
    )
    .bind(resource_id)
    .bind(source_id)
    .execute(pool)
    .await
    .map_err(|error| format!("Failed to unlink bibliography source: {error}"))?;

    Ok(())
}

pub async fn detect_bibliography_declarations(
    pool: &Pool<Sqlite>,
    resource_id: &str,
) -> Result<Vec<BibliographyDeclarationSummary>, String> {
    let (path, kind) = resource_path_and_type(pool, resource_id).await?;
    if kind == "bibliography" {
        return Err("Bibliography declarations are scanned from LaTeX resources".to_string());
    }

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|error| format!("Failed to read LaTeX resource '{path}': {error}"))?;
    let declarations = scan_bibliography_declarations(&content);
    let sources = list_all_bibliography_sources(pool).await?;
    let base_dir = Path::new(&path).parent().map(Path::to_path_buf);

    Ok(declarations
        .into_iter()
        .map(|declaration| {
            let normalized_name = normalize_bib_request(&declaration.requested);
            let matches = matching_sources(&sources, base_dir.as_deref(), &normalized_name);
            BibliographyDeclarationSummary {
                command_name: declaration.command_name,
                requested: declaration.requested,
                normalized_name,
                byte_start: declaration.byte_start,
                byte_end: declaration.byte_end,
                matches,
            }
        })
        .collect())
}

pub async fn auto_link_declared_bibliography_sources(
    pool: &Pool<Sqlite>,
    resource_id: &str,
) -> Result<BibliographyAutoLinkResult, String> {
    let declarations = detect_bibliography_declarations(pool, resource_id).await?;
    let mut linked_sources = Vec::new();
    let mut linked_ids = std::collections::HashSet::new();
    let mut unresolved_count = 0;
    let mut ambiguous_count = 0;

    for declaration in &declarations {
        match declaration.matches.as_slice() {
            [] => unresolved_count += 1,
            [source] => {
                if linked_ids.insert(source.id.clone()) {
                    link_bibliography_source(pool, resource_id, &source.id).await?;
                    linked_sources.push(source.clone());
                }
            }
            _ => ambiguous_count += 1,
        }
    }

    Ok(BibliographyAutoLinkResult {
        resource_id: resource_id.to_string(),
        declarations,
        linked_count: linked_sources.len(),
        linked_sources,
        unresolved_count,
        ambiguous_count,
    })
}

pub async fn scan_resource_citations(
    pool: &Pool<Sqlite>,
    resource_id: &str,
) -> Result<CitationScanResult, String> {
    let (path, kind) = resource_path_and_type(pool, resource_id).await?;
    if kind == "bibliography" {
        return Err("Citation scan is for LaTeX resources, not bibliography sources".to_string());
    }

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|error| format!("Failed to read LaTeX resource '{path}': {error}"))?;
    let drafts = scan_latex_citations(&content);
    let mut summaries = Vec::with_capacity(drafts.len());
    let linked_source_ids = linked_source_ids(pool, resource_id).await?;

    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("Failed to begin citation scan: {error}"))?;

    sqlx::query("DELETE FROM citation_occurrences WHERE resource_id = ?")
        .bind(resource_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to clear previous citation occurrences: {error}"))?;

    for draft in drafts {
        let resolved =
            resolve_citation_key(&mut transaction, &draft.citation_key, &linked_source_ids).await?;
        let scan_status = match resolved.len() {
            0 => "missing",
            1 => "resolved",
            _ => "ambiguous",
        };
        let entry = resolved.first();
        let entry_id = if resolved.len() == 1 {
            entry.map(|entry| entry.id.clone())
        } else {
            None
        };

        sqlx::query(
            "INSERT INTO citation_occurrences (
                resource_id, entry_id, command_name, citation_key, byte_start, byte_end, scan_status
             )
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(resource_id)
        .bind(entry_id.as_deref())
        .bind(&draft.command_name)
        .bind(&draft.citation_key)
        .bind(draft.byte_start as i64)
        .bind(draft.byte_end as i64)
        .bind(scan_status)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to save citation occurrence: {error}"))?;

        summaries.push(CitationOccurrenceSummary {
            command_name: draft.command_name,
            citation_key: draft.citation_key,
            byte_start: draft.byte_start,
            byte_end: draft.byte_end,
            scan_status: scan_status.to_string(),
            entry_id,
            entry_type: entry.map(|entry| entry.entry_type.clone()),
            title: entry.and_then(|entry| entry.title.clone()),
            year: entry.and_then(|entry| entry.year.clone()),
        });
    }

    transaction
        .commit()
        .await
        .map_err(|error| format!("Failed to commit citation scan: {error}"))?;

    let resolved = summaries
        .iter()
        .filter(|occurrence| occurrence.scan_status == "resolved")
        .count();
    let missing = summaries
        .iter()
        .filter(|occurrence| occurrence.scan_status == "missing")
        .count();
    let ambiguous = summaries
        .iter()
        .filter(|occurrence| occurrence.scan_status == "ambiguous")
        .count();

    Ok(CitationScanResult {
        resource_id: resource_id.to_string(),
        linked_source_count: linked_source_ids.len(),
        total: summaries.len(),
        resolved,
        missing,
        ambiguous,
        occurrences: summaries,
    })
}

pub async fn resolve_citation_keys(
    pool: &Pool<Sqlite>,
    resource_id: Option<&str>,
    citation_keys: Vec<String>,
) -> Result<Vec<CitationKeyResolutionSummary>, String> {
    let linked_source_ids = match resource_id {
        Some(resource_id) => linked_source_ids(pool, resource_id).await?,
        None => Vec::new(),
    };
    let mut seen = std::collections::HashSet::new();
    let mut summaries = Vec::new();

    for citation_key in citation_keys {
        let citation_key = citation_key.trim();
        if citation_key.is_empty() || citation_key == "*" || !seen.insert(citation_key.to_string())
        {
            continue;
        }

        let entries = exact_citation_entries(pool, citation_key, &linked_source_ids).await?;
        let scan_status = match entries.len() {
            0 => "missing",
            1 => "resolved",
            _ => "ambiguous",
        };

        summaries.push(CitationKeyResolutionSummary {
            citation_key: citation_key.to_string(),
            scan_status: scan_status.to_string(),
            entry_count: entries.len(),
            entries,
        });
    }

    Ok(summaries)
}

async fn list_bibliography_sources(
    pool: &Pool<Sqlite>,
    linked_to_resource_id: Option<&str>,
) -> Result<Vec<BibliographySourceOption>, String> {
    let (query, resource_id) = if linked_to_resource_id.is_some() {
        (
            "SELECT s.id, s.resource_id, r.title, r.collection, s.path, s.parse_status,
                    COUNT(e.id) AS entry_count
             FROM bib_sources s
             INNER JOIN resource_bib_sources link ON link.source_id = s.id
             LEFT JOIN resources r ON r.id = s.resource_id
             LEFT JOIN bib_entries e ON e.source_id = s.id
             WHERE link.resource_id = ? AND link.link_kind = 'uses'
             GROUP BY s.id, s.resource_id, r.title, r.collection, s.path, s.parse_status
             ORDER BY lower(COALESCE(r.title, s.path)) ASC",
            linked_to_resource_id,
        )
    } else {
        (
            "SELECT s.id, s.resource_id, r.title, r.collection, s.path, s.parse_status,
                    COUNT(e.id) AS entry_count
             FROM bib_sources s
             LEFT JOIN resources r ON r.id = s.resource_id
             LEFT JOIN bib_entries e ON e.source_id = s.id
             GROUP BY s.id, s.resource_id, r.title, r.collection, s.path, s.parse_status
             ORDER BY lower(COALESCE(r.title, s.path)) ASC",
            None,
        )
    };

    let mut query = sqlx::query(query);
    if let Some(resource_id) = resource_id {
        query = query.bind(resource_id);
    }

    let rows = query
        .fetch_all(pool)
        .await
        .map_err(|error| format!("Failed to list bibliography sources: {error}"))?;

    Ok(rows
        .into_iter()
        .map(|row| BibliographySourceOption {
            id: row.get("id"),
            resource_id: row
                .try_get::<Option<String>, _>("resource_id")
                .ok()
                .flatten()
                .unwrap_or_default(),
            title: row.try_get("title").ok(),
            collection: row.try_get("collection").ok(),
            path: row.get("path"),
            parse_status: row.get("parse_status"),
            entry_count: row.get("entry_count"),
        })
        .collect())
}

fn entry_summary_from_row(
    row: sqlx::sqlite::SqliteRow,
) -> Result<BibliographyEntrySummary, String> {
    let fields: serde_json::Value = row
        .try_get("fields_json")
        .map_err(|error| format!("Failed to read bibliography fields: {error}"))?;
    Ok(BibliographyEntrySummary {
        id: row.get("id"),
        source_id: row.get("source_id"),
        entry_type: row.get("entry_type"),
        citation_key: row.get("citation_key"),
        title: optional_row_string(&row, "title"),
        year: optional_row_string(&row, "year"),
        date: optional_row_string(&row, "date"),
        doi: optional_row_string(&row, "doi"),
        url: optional_row_string(&row, "url"),
        raw_entry: row.try_get("raw_entry").ok(),
        tags: row
            .try_get::<String, _>("tags_joined")
            .ok()
            .map(|value| {
                value
                    .split('\u{1f}')
                    .map(str::trim)
                    .filter(|tag| !tag.is_empty())
                    .map(ToOwned::to_owned)
                    .collect()
            })
            .unwrap_or_default(),
        fields,
    })
}

fn note_summary_from_row(row: sqlx::sqlite::SqliteRow) -> BibliographyEntryNoteSummary {
    let is_pinned = row
        .try_get::<i64, _>("is_pinned")
        .map(|value| value != 0)
        .unwrap_or(false);
    BibliographyEntryNoteSummary {
        id: row.get("id"),
        entry_id: row.get("entry_id"),
        body: row.get("body"),
        note_kind: row.get("note_kind"),
        is_pinned,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

fn attachment_summary_from_row(row: sqlx::sqlite::SqliteRow) -> BibliographyEntryAttachmentSummary {
    let is_primary = row
        .try_get::<i64, _>("is_primary")
        .map(|value| value != 0)
        .unwrap_or(false);
    BibliographyEntryAttachmentSummary {
        id: row.get("id"),
        entry_id: row.get("entry_id"),
        resource_id: row
            .try_get::<Option<String>, _>("resource_id")
            .ok()
            .flatten(),
        path: row.get("path"),
        title: optional_row_string(&row, "title"),
        attachment_kind: row.get("attachment_kind"),
        mime_type: optional_row_string(&row, "mime_type"),
        file_size: row.try_get::<Option<i64>, _>("file_size").ok().flatten(),
        is_primary,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

fn pdf_annotation_summary_from_row(
    row: sqlx::sqlite::SqliteRow,
) -> BibliographyPdfAnnotationSummary {
    let rects = row
        .try_get::<serde_json::Value, _>("rects_json")
        .unwrap_or_else(|_| serde_json::json!([]));
    BibliographyPdfAnnotationSummary {
        id: row.get("id"),
        entry_id: row.get("entry_id"),
        attachment_id: row.get("attachment_id"),
        attachment_path: row.get("attachment_path"),
        attachment_title: optional_row_string(&row, "attachment_title"),
        page: row.get("page"),
        annotation_kind: row.get("annotation_kind"),
        selected_text: optional_row_string(&row, "selected_text"),
        comment: optional_row_string(&row, "comment"),
        color: optional_row_string(&row, "color"),
        rects,
        external_annotation_id: optional_row_string(&row, "external_annotation_id"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

fn usage_summary_from_row(row: sqlx::sqlite::SqliteRow) -> BibliographyEntryUsageSummary {
    BibliographyEntryUsageSummary {
        resource_id: row.get("resource_id"),
        resource_path: row.get("resource_path"),
        resource_title: optional_row_string(&row, "resource_title"),
        resource_type: row.get("resource_type"),
        collection: row.get("collection"),
        occurrence_count: row.get("occurrence_count"),
        first_byte_start: row
            .try_get::<Option<i64>, _>("first_byte_start")
            .ok()
            .flatten(),
        commands: split_distinct_joined(row.try_get("commands_joined").unwrap_or_default()),
        scan_statuses: split_distinct_joined(row.try_get("statuses_joined").unwrap_or_default()),
    }
}

fn related_entry_summary_from_row(row: sqlx::sqlite::SqliteRow) -> BibliographyRelatedEntrySummary {
    BibliographyRelatedEntrySummary {
        entry_id: row.get("entry_id"),
        citation_key: row.get("citation_key"),
        entry_type: row.get("entry_type"),
        title: optional_row_string(&row, "title"),
        year: optional_row_string(&row, "year"),
        resource_count: row.get("resource_count"),
        occurrence_count: row.get("occurrence_count"),
    }
}

fn collection_federation_summary_from_row(
    row: sqlx::sqlite::SqliteRow,
) -> BibliographyCollectionFederationSummary {
    let is_enabled = row
        .try_get::<Option<i64>, _>("is_enabled")
        .ok()
        .flatten()
        .map(|value| value != 0)
        .unwrap_or(false);
    BibliographyCollectionFederationSummary {
        id: row.try_get::<Option<String>, _>("id").ok().flatten(),
        collection: row.get("collection"),
        remote_kind: optional_row_string(&row, "remote_kind")
            .unwrap_or_else(|| "shared_folder".to_string()),
        remote_url: optional_row_string(&row, "remote_url"),
        sync_mode: optional_row_string(&row, "sync_mode").unwrap_or_else(|| "manual".to_string()),
        conflict_policy: optional_row_string(&row, "conflict_policy")
            .unwrap_or_else(|| "manual".to_string()),
        is_enabled,
        sync_status: optional_row_string(&row, "sync_status")
            .unwrap_or_else(|| "not_configured".to_string()),
        last_sync_at: optional_row_string(&row, "last_sync_at"),
        last_error: optional_row_string(&row, "last_error"),
        source_count: row.get("source_count"),
        entry_count: row.get("entry_count"),
        created_at: optional_row_string(&row, "created_at"),
        updated_at: optional_row_string(&row, "updated_at"),
    }
}

fn optional_row_string(row: &sqlx::sqlite::SqliteRow, column: &str) -> Option<String> {
    row.try_get::<Option<String>, _>(column)
        .ok()
        .flatten()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn split_distinct_joined(value: String) -> Vec<String> {
    value
        .split(',')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

async fn insert_names_from_fields(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    entry_id: &str,
    fields: &serde_json::Value,
) -> Result<(), String> {
    for role in ["author", "editor", "translator"] {
        let Some(value) = json_field_value(fields, role) else {
            continue;
        };
        for (position, full_name) in split_people(&value).into_iter().enumerate() {
            sqlx::query(
                "INSERT INTO bib_entry_names (
                    entry_id, role, position, full_name, family, given, normalized_name
                 )
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(entry_id)
            .bind(role)
            .bind(position as i64)
            .bind(&full_name)
            .bind(name_family(&full_name))
            .bind(name_given(&full_name))
            .bind(normalize_name(&full_name))
            .execute(&mut **transaction)
            .await
            .map_err(|error| format!("Failed to save bibliography creator: {error}"))?;
        }
    }
    Ok(())
}

fn normalize_fields_json(value: serde_json::Value) -> Result<serde_json::Value, String> {
    let object = value
        .as_object()
        .ok_or_else(|| "Bibliography fields must be a JSON object".to_string())?;
    let mut normalized = serde_json::Map::new();
    for (key, value) in object {
        let Some(field_name) = sanitize_bib_identifier(key) else {
            continue;
        };
        let value = match value {
            serde_json::Value::String(value) => value.trim().to_string(),
            serde_json::Value::Null => String::new(),
            other => other.to_string(),
        };
        if !value.is_empty() {
            normalized.insert(field_name, serde_json::Value::String(value));
        }
    }
    Ok(serde_json::Value::Object(normalized))
}

fn merge_fields_json(
    fields: &mut serde_json::Value,
    set_fields: &serde_json::Value,
    remove_fields: &std::collections::HashSet<String>,
) -> Result<(), String> {
    let fields_object = fields
        .as_object_mut()
        .ok_or_else(|| "Existing bibliography fields must be a JSON object".to_string())?;
    for field_name in remove_fields {
        let matching_keys = fields_object
            .keys()
            .filter(|key| key.eq_ignore_ascii_case(field_name))
            .cloned()
            .collect::<Vec<_>>();
        for key in matching_keys {
            fields_object.remove(&key);
        }
    }
    for (key, value) in set_fields
        .as_object()
        .ok_or_else(|| "Batch fields must be a JSON object".to_string())?
    {
        if let Some(field_name) = sanitize_bib_identifier(key) {
            fields_object.insert(field_name, value.clone());
        }
    }
    Ok(())
}

fn normalized_entry_ids(entry_ids: Vec<String>) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    entry_ids
        .into_iter()
        .map(|id| id.trim().to_string())
        .filter(|id| !id.is_empty() && seen.insert(id.clone()))
        .collect()
}

fn normalize_tag_name(value: &str) -> String {
    value
        .trim()
        .trim_start_matches('#')
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_lowercase()
}

fn normalize_tag_names(tags: Vec<String>) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    tags.into_iter()
        .map(|tag| normalize_tag_name(&tag))
        .filter(|tag| !tag.is_empty() && seen.insert(tag.clone()))
        .collect()
}

fn normalize_note_kind(value: Option<&str>) -> String {
    match value.unwrap_or("note").trim().to_ascii_lowercase().as_str() {
        "quote" => "quote".to_string(),
        "idea" => "idea".to_string(),
        "todo" => "todo".to_string(),
        _ => "note".to_string(),
    }
}

fn normalize_attachment_kind(value: Option<&str>) -> String {
    match value.unwrap_or("pdf").trim().to_ascii_lowercase().as_str() {
        "supplement" => "supplement".to_string(),
        "dataset" => "dataset".to_string(),
        "other" => "other".to_string(),
        _ => "pdf".to_string(),
    }
}

fn normalize_remote_kind(value: Option<&str>) -> String {
    match value
        .unwrap_or("shared_folder")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "git" => "git".to_string(),
        "zotero" => "zotero".to_string(),
        "webdav" => "webdav".to_string(),
        "custom" => "custom".to_string(),
        _ => "shared_folder".to_string(),
    }
}

fn normalize_sync_mode(value: Option<&str>) -> String {
    match value
        .unwrap_or("manual")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "pull_only" | "pull-only" => "pull_only".to_string(),
        "push_pull" | "push-pull" => "push_pull".to_string(),
        _ => "manual".to_string(),
    }
}

fn normalize_conflict_policy(value: Option<&str>) -> String {
    match value
        .unwrap_or("manual")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "local_wins" | "local-wins" => "local_wins".to_string(),
        "remote_wins" | "remote-wins" => "remote_wins".to_string(),
        _ => "manual".to_string(),
    }
}

fn normalize_pdf_annotation_kind(value: Option<&str>) -> String {
    match value
        .unwrap_or("highlight")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "note" => "note".to_string(),
        "quote" => "quote".to_string(),
        "bookmark" => "bookmark".to_string(),
        _ => "highlight".to_string(),
    }
}

fn normalize_annotation_color(value: Option<&str>) -> Option<String> {
    let value = normalized_optional_text(value)?;
    if value.starts_with('#')
        && value.len() == 7
        && value.chars().skip(1).all(|ch| ch.is_ascii_hexdigit())
    {
        Some(value.to_ascii_lowercase())
    } else {
        Some(value)
    }
}

fn normalized_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn normalize_rects_json(value: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
    match value {
        Some(value @ serde_json::Value::Array(_)) => Ok(value),
        Some(serde_json::Value::Null) | None => Ok(serde_json::json!([])),
        Some(_) => Err("PDF annotation rects must be a JSON array".to_string()),
    }
}

fn canonical_attachment_path(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Attachment path cannot be empty".to_string());
    }
    std::fs::canonicalize(trimmed)
        .map_err(|error| format!("Failed to resolve attachment path '{}': {error}", trimmed))
}

async fn ensure_entry_exists(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    entry_id: &str,
) -> Result<(), String> {
    let exists: Option<i64> = sqlx::query_scalar("SELECT 1 FROM bib_entries WHERE id = ?")
        .bind(entry_id)
        .fetch_optional(&mut **transaction)
        .await
        .map_err(|error| format!("Failed to check bibliography entry: {error}"))?;
    exists
        .map(|_| ())
        .ok_or_else(|| format!("Bibliography entry '{}' was not found", entry_id))
}

async fn load_bibliography_attachment(
    pool: &Pool<Sqlite>,
    attachment_id: &str,
) -> Result<BibliographyEntryAttachmentSummary, String> {
    let row = sqlx::query(
        "SELECT id, entry_id, resource_id, path, title, attachment_kind, mime_type,
                file_size, is_primary, created_at, updated_at
         FROM bib_entry_attachments
         WHERE id = ?",
    )
    .bind(attachment_id)
    .fetch_one(pool)
    .await
    .map_err(|error| format!("Failed to load bibliography attachment: {error}"))?;
    Ok(attachment_summary_from_row(row))
}

async fn load_bibliography_pdf_annotation(
    pool: &Pool<Sqlite>,
    annotation_id: &str,
) -> Result<BibliographyPdfAnnotationSummary, String> {
    let row = sqlx::query(
        "SELECT pa.id, pa.entry_id, pa.attachment_id, a.path AS attachment_path,
                a.title AS attachment_title, pa.page, pa.annotation_kind,
                pa.selected_text, pa.comment, pa.color, pa.rects_json,
                pa.external_annotation_id, pa.created_at, pa.updated_at
         FROM bib_entry_pdf_annotations pa
         INNER JOIN bib_entry_attachments a ON a.id = pa.attachment_id
         WHERE pa.id = ?",
    )
    .bind(annotation_id)
    .fetch_one(pool)
    .await
    .map_err(|error| format!("Failed to load bibliography PDF annotation: {error}"))?;
    Ok(pdf_annotation_summary_from_row(row))
}

async fn load_bibliography_collection_federation(
    pool: &Pool<Sqlite>,
    collection: &str,
) -> Result<BibliographyCollectionFederationSummary, String> {
    let row = sqlx::query(
        "SELECT c.name AS collection,
                f.id, f.remote_kind, f.remote_url, f.sync_mode, f.conflict_policy,
                f.is_enabled, f.sync_status, f.last_sync_at, f.last_error,
                f.created_at, f.updated_at,
                COALESCE(COUNT(DISTINCT s.id), 0) AS source_count,
                COALESCE(COUNT(DISTINCT e.id), 0) AS entry_count
         FROM collections c
         LEFT JOIN resources r ON r.collection = c.name AND r.type = 'bibliography'
         LEFT JOIN bib_sources s ON s.resource_id = r.id
         LEFT JOIN bib_entries e ON e.source_id = s.id
         LEFT JOIN bib_collection_federation f ON f.collection = c.name
         WHERE c.type = 'bibliography' AND c.name = ?
         GROUP BY c.name, f.id, f.remote_kind, f.remote_url, f.sync_mode,
                  f.conflict_policy, f.is_enabled, f.sync_status, f.last_sync_at,
                  f.last_error, f.created_at, f.updated_at",
    )
    .bind(collection)
    .fetch_one(pool)
    .await
    .map_err(|error| format!("Failed to load bibliography federation settings: {error}"))?;
    Ok(collection_federation_summary_from_row(row))
}

async fn find_tracked_bibliography_by_path(
    pool: &Pool<Sqlite>,
    changed_path: &Path,
) -> Result<Option<TrackedBibliographyResource>, String> {
    let changed_normalized = comparable_path(changed_path);
    for resource in list_tracked_bibliography_resources(pool).await? {
        if comparable_path(Path::new(&resource.path)) == changed_normalized {
            return Ok(Some(resource));
        }
    }
    Ok(None)
}

fn comparable_path(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

async fn backfill_global_bibliography_table(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    result: &mut BibliographyBackfillResult,
) -> Result<(), String> {
    let rows = sqlx::query(
        "SELECT citation_key, entry_type, data, collection
         FROM bibliography
         ORDER BY COALESCE(collection, ''), lower(citation_key)",
    )
    .fetch_all(&mut **transaction)
    .await
    .map_err(|error| format!("Failed to load legacy bibliography table: {error}"))?;

    for row in rows {
        let citation_key: String = row.get("citation_key");
        let entry_type: String = row.get("entry_type");
        let collection: Option<String> = row.try_get("collection").ok();
        let data: String = row.get("data");
        let fields = match serde_json::from_str::<serde_json::Value>(&data) {
            Ok(value) => normalize_legacy_fields(value),
            Err(error) => {
                result.skipped_invalid += 1;
                result.warnings.push(format!(
                    "Skipped legacy bibliography '{}' because data JSON is invalid: {error}",
                    citation_key
                ));
                continue;
            }
        };
        let source_path = format!(
            "legacy:bibliography:{}",
            collection.as_deref().unwrap_or("global")
        );
        let source_id = ensure_legacy_bibliography_source(
            transaction,
            None,
            &source_path,
            collection.as_deref(),
            result,
        )
        .await?;
        insert_legacy_bibliography_entry(
            transaction,
            &source_id,
            None,
            &entry_type,
            &citation_key,
            fields,
            "legacy_global",
            result,
        )
        .await?;
    }

    Ok(())
}

async fn backfill_resource_bibliography_tables(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    result: &mut BibliographyBackfillResult,
) -> Result<(), String> {
    let rows = sqlx::query(
        "SELECT r.id AS resource_id, r.collection, r.title AS resource_title,
                rb.entry_type, rb.citation_key, rb.journal, rb.volume, rb.series, rb.number,
                rb.issue, rb.year, rb.month, rb.publisher, rb.edition, rb.institution,
                rb.school, rb.organization, rb.address, rb.location, rb.isbn, rb.issn,
                rb.doi, rb.url, rb.language, rb.title, rb.subtitle, rb.booktitle, rb.chapter,
                rb.pages, rb.abstract, rb.note, rb.crossref
         FROM resource_bibliographies rb
         INNER JOIN resources r ON r.id = rb.resource_id
         ORDER BY lower(r.id)",
    )
    .fetch_all(&mut **transaction)
    .await
    .map_err(|error| format!("Failed to load legacy resource bibliography metadata: {error}"))?;

    for row in rows {
        let resource_id: String = row.get("resource_id");
        if existing_source_for_resource(transaction, &resource_id)
            .await?
            .is_some()
        {
            result.skipped_existing += 1;
            continue;
        }

        let citation_key = row
            .try_get::<Option<String>, _>("citation_key")
            .ok()
            .flatten()
            .or_else(|| {
                row.try_get::<Option<String>, _>("resource_title")
                    .ok()
                    .flatten()
            })
            .unwrap_or_else(|| resource_id.clone());
        let entry_type = row
            .try_get::<Option<String>, _>("entry_type")
            .ok()
            .flatten()
            .unwrap_or_else(|| "misc".to_string());
        let collection: Option<String> = row.try_get("collection").ok();
        let source_id = ensure_legacy_bibliography_source(
            transaction,
            Some(&resource_id),
            &format!("legacy:resource:{resource_id}"),
            collection.as_deref(),
            result,
        )
        .await?;

        let mut fields = serde_json::Map::new();
        for column in LEGACY_BIBLIOGRAPHY_COLUMNS {
            if let Some(value) = row.try_get::<Option<String>, _>(*column).ok().flatten() {
                insert_legacy_field(&mut fields, column, value);
            }
        }
        append_legacy_person_fields(transaction, &resource_id, &mut fields).await?;
        append_legacy_extra_fields(transaction, &resource_id, &mut fields).await?;

        insert_legacy_bibliography_entry(
            transaction,
            &source_id,
            Some(&resource_id),
            &entry_type,
            &citation_key,
            serde_json::Value::Object(fields),
            "legacy_resource",
            result,
        )
        .await?;
    }

    Ok(())
}

async fn backfill_resource_bibliography_metadata_json(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    result: &mut BibliographyBackfillResult,
) -> Result<(), String> {
    let rows = sqlx::query(
        "SELECT r.id AS resource_id, r.collection, r.title, r.metadata
         FROM resources r
         WHERE r.type = 'bibliography'
           AND COALESCE(trim(r.metadata), '') NOT IN ('', '{}')
           AND NOT EXISTS (
                SELECT 1 FROM resource_bibliographies rb WHERE rb.resource_id = r.id
           )
         ORDER BY lower(r.id)",
    )
    .fetch_all(&mut **transaction)
    .await
    .map_err(|error| format!("Failed to load legacy bibliography JSON metadata: {error}"))?;

    for row in rows {
        let resource_id: String = row.get("resource_id");
        if existing_source_for_resource(transaction, &resource_id)
            .await?
            .is_some()
        {
            result.skipped_existing += 1;
            continue;
        }

        let metadata: String = row.get("metadata");
        let metadata = match serde_json::from_str::<serde_json::Value>(&metadata) {
            Ok(value) => value,
            Err(error) => {
                result.skipped_invalid += 1;
                result.warnings.push(format!(
                    "Skipped bibliography resource '{}' because metadata JSON is invalid: {error}",
                    resource_id
                ));
                continue;
            }
        };
        if !looks_like_bibliography_metadata(&metadata) {
            continue;
        }

        let citation_key = metadata
            .get("citationKey")
            .or_else(|| metadata.get("citation_key"))
            .and_then(|value| value.as_str())
            .map(ToOwned::to_owned)
            .or_else(|| row.try_get::<Option<String>, _>("title").ok().flatten())
            .unwrap_or_else(|| resource_id.clone());
        let entry_type = metadata
            .get("entryType")
            .or_else(|| metadata.get("entry_type"))
            .and_then(|value| value.as_str())
            .unwrap_or("misc")
            .to_string();
        let collection: Option<String> = row.try_get("collection").ok();
        let source_id = ensure_legacy_bibliography_source(
            transaction,
            Some(&resource_id),
            &format!("legacy:resource:{resource_id}"),
            collection.as_deref(),
            result,
        )
        .await?;

        insert_legacy_bibliography_entry(
            transaction,
            &source_id,
            Some(&resource_id),
            &entry_type,
            &citation_key,
            normalize_legacy_fields(metadata),
            "legacy_metadata_json",
            result,
        )
        .await?;
    }

    Ok(())
}

async fn ensure_legacy_bibliography_source(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    resource_id: Option<&str>,
    path: &str,
    collection: Option<&str>,
    result: &mut BibliographyBackfillResult,
) -> Result<String, String> {
    if let Some(resource_id) = resource_id {
        if let Some(source_id) = existing_source_for_resource(transaction, resource_id).await? {
            return Ok(source_id);
        }
    } else if let Some(source_id) = sqlx::query_scalar::<_, String>(
        "SELECT id FROM bib_sources
         WHERE resource_id IS NULL AND source_kind = 'legacy' AND path = ?
         LIMIT 1",
    )
    .bind(path)
    .fetch_optional(&mut **transaction)
    .await
    .map_err(|error| format!("Failed to look up legacy bibliography source: {error}"))?
    {
        return Ok(source_id);
    }

    let source_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO bib_sources (
            id, resource_id, source_kind, path, content_hash, parse_status, diagnostics_json, parsed_at
         )
         VALUES (?, ?, 'legacy', ?, ?, 'ok', '[]', CURRENT_TIMESTAMP)",
    )
    .bind(&source_id)
    .bind(resource_id)
    .bind(path)
    .bind(hash_content(&format!(
        "{}:{}",
        collection.unwrap_or(""),
        path
    )))
    .execute(&mut **transaction)
    .await
    .map_err(|error| format!("Failed to create legacy bibliography source: {error}"))?;
    result.sources_created += 1;
    Ok(source_id)
}

async fn existing_source_for_resource(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    resource_id: &str,
) -> Result<Option<String>, String> {
    sqlx::query_scalar("SELECT id FROM bib_sources WHERE resource_id = ? LIMIT 1")
        .bind(resource_id)
        .fetch_optional(&mut **transaction)
        .await
        .map_err(|error| format!("Failed to look up bibliography source for resource: {error}"))
}

async fn insert_legacy_bibliography_entry(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    source_id: &str,
    resource_id: Option<&str>,
    entry_type: &str,
    citation_key: &str,
    fields: serde_json::Value,
    source_kind: &str,
    result: &mut BibliographyBackfillResult,
) -> Result<(), String> {
    let Some(entry_type) = sanitize_bib_identifier(entry_type).or_else(|| Some("misc".to_string()))
    else {
        return Ok(());
    };
    let Some(citation_key) = sanitize_citation_key(citation_key) else {
        result.skipped_invalid += 1;
        result.warnings.push(format!(
            "Skipped legacy bibliography entry with invalid citation key '{}'",
            citation_key
        ));
        return Ok(());
    };
    let fields = normalize_fields_json(fields)?;
    let exists: Option<String> = sqlx::query_scalar(
        "SELECT id FROM bib_entries
         WHERE source_id = ? AND citation_key = ?
         LIMIT 1",
    )
    .bind(source_id)
    .bind(&citation_key)
    .fetch_optional(&mut **transaction)
    .await
    .map_err(|error| format!("Failed to check legacy bibliography duplicate: {error}"))?;
    if exists.is_some() {
        result.skipped_existing += 1;
        return Ok(());
    }

    let entry_id = Uuid::new_v4().to_string();
    let raw_entry = build_raw_entry(&entry_type, &citation_key, &fields)?;
    sqlx::query(
        "INSERT INTO bib_entries (
            id, source_id, entry_type, citation_key, title, subtitle, year, date,
            doi, isbn, issn, url, abstract, raw_entry, fields_json
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&entry_id)
    .bind(source_id)
    .bind(&entry_type)
    .bind(&citation_key)
    .bind(json_field_value(&fields, "title"))
    .bind(json_field_value(&fields, "subtitle"))
    .bind(json_field_value(&fields, "year"))
    .bind(json_field_value(&fields, "date"))
    .bind(json_field_value(&fields, "doi"))
    .bind(json_field_value(&fields, "isbn"))
    .bind(json_field_value(&fields, "issn"))
    .bind(json_field_value(&fields, "url"))
    .bind(json_field_value(&fields, "abstract"))
    .bind(&raw_entry)
    .bind(&fields)
    .execute(&mut **transaction)
    .await
    .map_err(|error| format!("Failed to insert legacy bibliography entry: {error}"))?;

    insert_names_from_fields(transaction, &entry_id, &fields).await?;
    refresh_bibliography_fts_for_entry(transaction, &entry_id).await?;
    record_bibliography_history(
        transaction,
        Some(source_id),
        Some(&entry_id),
        resource_id,
        "import",
        Some(&format!(
            "Backfilled legacy bibliography entry {citation_key}"
        )),
        serde_json::json!({ "sourceKind": source_kind }),
    )
    .await?;
    result.entries_imported += 1;
    Ok(())
}

async fn insert_external_bibliography_entry(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    source_id: &str,
    entry: &ImportedBibliographyEntry,
    index: usize,
    seen_keys: &mut HashSet<String>,
) -> Result<String, String> {
    let entry_type =
        sanitize_bib_identifier(&entry.entry_type).unwrap_or_else(|| "misc".to_string());
    let fields = imported_fields_to_json(&entry.fields)?;
    let citation_key = unique_imported_citation_key(entry, &fields, index, seen_keys);
    let entry_id = Uuid::new_v4().to_string();
    let raw_entry = build_raw_entry(&entry_type, &citation_key, &fields)?;

    sqlx::query(
        "INSERT INTO bib_entries (
            id, source_id, entry_type, citation_key, title, subtitle, year, date,
            doi, isbn, issn, url, abstract, raw_entry, fields_json
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&entry_id)
    .bind(source_id)
    .bind(&entry_type)
    .bind(&citation_key)
    .bind(json_field_value(&fields, "title"))
    .bind(json_field_value(&fields, "subtitle"))
    .bind(json_field_value(&fields, "year"))
    .bind(json_field_value(&fields, "date"))
    .bind(json_field_value(&fields, "doi"))
    .bind(json_field_value(&fields, "isbn"))
    .bind(json_field_value(&fields, "issn"))
    .bind(json_field_value(&fields, "url"))
    .bind(json_field_value(&fields, "abstract"))
    .bind(&raw_entry)
    .bind(&fields)
    .execute(&mut **transaction)
    .await
    .map_err(|error| format!("Failed to insert imported bibliography entry: {error}"))?;

    insert_names_from_fields(transaction, &entry_id, &fields).await?;
    refresh_bibliography_fts_for_entry(transaction, &entry_id).await?;
    Ok(citation_key)
}

fn imported_fields_to_json(fields: &BTreeMap<String, String>) -> Result<serde_json::Value, String> {
    let object = fields
        .iter()
        .filter_map(|(key, value)| {
            sanitize_bib_identifier(key).and_then(|field_name| {
                let value = value.trim();
                if value.is_empty() {
                    None
                } else {
                    Some((field_name, serde_json::Value::String(value.to_string())))
                }
            })
        })
        .collect::<serde_json::Map<_, _>>();
    normalize_fields_json(serde_json::Value::Object(object))
}

fn unique_imported_citation_key(
    entry: &ImportedBibliographyEntry,
    fields: &serde_json::Value,
    index: usize,
    seen_keys: &mut HashSet<String>,
) -> String {
    let base = entry
        .citation_key
        .as_deref()
        .and_then(sanitize_citation_key)
        .or_else(|| generated_citation_key(fields, index))
        .unwrap_or_else(|| format!("imported{}", index + 1));

    let mut candidate = base.clone();
    let mut suffix = 2usize;
    while !seen_keys.insert(candidate.to_ascii_lowercase()) {
        candidate = format!("{base}-{suffix}");
        suffix += 1;
    }
    candidate
}

fn generated_citation_key(fields: &serde_json::Value, index: usize) -> Option<String> {
    let author = json_field_value(fields, "author")
        .or_else(|| json_field_value(fields, "editor"))
        .unwrap_or_else(|| "imported".to_string());
    let family = author
        .split(" and ")
        .next()
        .unwrap_or(&author)
        .split(',')
        .next()
        .unwrap_or(&author);
    let family = citation_key_token(family);
    let year = json_field_value(fields, "year")
        .and_then(|value| {
            value
                .as_bytes()
                .windows(4)
                .find(|window| window.iter().all(u8::is_ascii_digit))
                .map(|window| String::from_utf8_lossy(window).to_string())
        })
        .unwrap_or_else(|| format!("{:02}", index + 1));
    let title_token = json_field_value(fields, "title")
        .map(|title| citation_key_token(&title))
        .filter(|token| !token.is_empty());
    let mut key = format!("{}{}", family, year);
    if family == "imported" {
        if let Some(title_token) = title_token {
            key = format!("{}{}", title_token, year);
        }
    }
    if key.trim().is_empty() {
        None
    } else {
        Some(key)
    }
}

fn citation_key_token(value: &str) -> String {
    let token = value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .take(24)
        .collect::<String>()
        .to_ascii_lowercase();
    if token.is_empty() {
        "imported".to_string()
    } else {
        token
    }
}

fn entry_to_csl_json(entry: &BibliographyEntrySummary) -> serde_json::Value {
    let mut object = serde_json::Map::new();
    object.insert(
        "id".to_string(),
        serde_json::Value::String(entry.citation_key.clone()),
    );
    object.insert(
        "citation-key".to_string(),
        serde_json::Value::String(entry.citation_key.clone()),
    );
    object.insert(
        "type".to_string(),
        serde_json::Value::String(bib_type_to_csl_type(&entry.entry_type).to_string()),
    );

    for (bib_field, csl_field) in [
        ("title", "title"),
        ("subtitle", "subtitle"),
        ("journal", "container-title"),
        ("journaltitle", "container-title"),
        ("booktitle", "container-title"),
        ("publisher", "publisher"),
        ("location", "publisher-place"),
        ("address", "publisher-place"),
        ("volume", "volume"),
        ("number", "issue"),
        ("issue", "issue"),
        ("pages", "page"),
        ("abstract", "abstract"),
        ("language", "language"),
    ] {
        if let Some(value) = json_field_value(&entry.fields, bib_field) {
            object.insert(csl_field.to_string(), serde_json::Value::String(value));
        }
    }
    for (bib_field, csl_field) in [
        ("doi", "DOI"),
        ("url", "URL"),
        ("isbn", "ISBN"),
        ("issn", "ISSN"),
    ] {
        if let Some(value) =
            json_field_value(&entry.fields, bib_field).or_else(|| match bib_field {
                "doi" => entry.doi.clone(),
                "url" => entry.url.clone(),
                _ => None,
            })
        {
            object.insert(csl_field.to_string(), serde_json::Value::String(value));
        }
    }
    for (bib_field, csl_field) in [
        ("author", "author"),
        ("editor", "editor"),
        ("translator", "translator"),
    ] {
        if let Some(value) = json_field_value(&entry.fields, bib_field) {
            let names = split_people(&value)
                .into_iter()
                .map(person_to_csl_json)
                .collect::<Vec<_>>();
            if !names.is_empty() {
                object.insert(csl_field.to_string(), serde_json::Value::Array(names));
            }
        }
    }
    if let Some(year) = entry
        .year
        .clone()
        .or_else(|| json_field_value(&entry.fields, "year"))
        .and_then(|value| value.parse::<i64>().ok())
    {
        object.insert(
            "issued".to_string(),
            serde_json::json!({ "date-parts": [[year]] }),
        );
    } else if let Some(date) = entry
        .date
        .clone()
        .or_else(|| json_field_value(&entry.fields, "date"))
    {
        object.insert("issued".to_string(), serde_json::json!({ "raw": date }));
    }
    if !entry.tags.is_empty() {
        object.insert(
            "keyword".to_string(),
            serde_json::Value::String(entry.tags.join(", ")),
        );
    }
    serde_json::Value::Object(object)
}

fn person_to_csl_json(name: String) -> serde_json::Value {
    if let Some((family, given)) = name.split_once(',') {
        let mut object = serde_json::Map::new();
        let family = family.trim();
        let given = given.trim();
        if !family.is_empty() {
            object.insert(
                "family".to_string(),
                serde_json::Value::String(family.to_string()),
            );
        }
        if !given.is_empty() {
            object.insert(
                "given".to_string(),
                serde_json::Value::String(given.to_string()),
            );
        }
        if !object.is_empty() {
            return serde_json::Value::Object(object);
        }
    }
    serde_json::json!({ "literal": name })
}

fn bib_type_to_csl_type(entry_type: &str) -> &'static str {
    match entry_type.to_ascii_lowercase().as_str() {
        "article" => "article-journal",
        "book" | "mvbook" | "collection" => "book",
        "inbook" | "incollection" => "chapter",
        "inproceedings" | "conference" => "paper-conference",
        "proceedings" => "paper-conference",
        "thesis" | "phdthesis" | "mastersthesis" => "thesis",
        "online" | "webpage" => "webpage",
        "report" | "techreport" => "report",
        _ => "article",
    }
}

async fn append_legacy_person_fields(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    resource_id: &str,
    fields: &mut serde_json::Map<String, serde_json::Value>,
) -> Result<(), String> {
    let rows = sqlx::query(
        "SELECT role, full_name
         FROM resource_bibliography_persons
         WHERE resource_id = ?
         ORDER BY role, position, id",
    )
    .bind(resource_id)
    .fetch_all(&mut **transaction)
    .await
    .map_err(|error| format!("Failed to load legacy bibliography persons: {error}"))?;

    let mut people: HashMap<String, Vec<String>> = HashMap::new();
    for row in rows {
        let role: String = row.get("role");
        let full_name: String = row.get("full_name");
        people.entry(role).or_default().push(full_name);
    }
    for (role, names) in people {
        let field_name = match role.as_str() {
            "author" => "author",
            "editor" => "editor",
            "translator" => "translator",
            _ => continue,
        };
        fields.insert(
            field_name.to_string(),
            serde_json::Value::String(names.join(" and ")),
        );
    }

    Ok(())
}

async fn append_legacy_extra_fields(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    resource_id: &str,
    fields: &mut serde_json::Map<String, serde_json::Value>,
) -> Result<(), String> {
    let rows = sqlx::query(
        "SELECT key, value
         FROM resource_bibliography_extras
         WHERE resource_id = ?
         ORDER BY lower(key)",
    )
    .bind(resource_id)
    .fetch_all(&mut **transaction)
    .await
    .map_err(|error| format!("Failed to load legacy bibliography extras: {error}"))?;

    for row in rows {
        let key: String = row.get("key");
        let value: Option<String> = row.try_get("value").ok();
        if let Some(value) = value {
            insert_legacy_field(fields, &key, value);
        }
    }
    Ok(())
}

fn normalize_legacy_fields(value: serde_json::Value) -> serde_json::Value {
    let mut fields = serde_json::Map::new();
    let Some(object) = value.as_object() else {
        return serde_json::Value::Object(fields);
    };
    for (key, value) in object {
        if matches!(
            key.as_str(),
            "entryType" | "entry_type" | "citationKey" | "citation_key"
        ) {
            continue;
        }
        match value {
            serde_json::Value::Array(values)
                if matches!(key.as_str(), "authors" | "editors" | "translators") =>
            {
                let names = values
                    .iter()
                    .filter_map(|value| value.as_str())
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .collect::<Vec<_>>();
                let field_name = match key.as_str() {
                    "authors" => "author",
                    "editors" => "editor",
                    "translators" => "translator",
                    _ => key,
                };
                if !names.is_empty() {
                    fields.insert(
                        field_name.to_string(),
                        serde_json::Value::String(names.join(" and ")),
                    );
                }
            }
            serde_json::Value::Object(extra) if key == "extras" => {
                for (extra_key, extra_value) in extra {
                    insert_legacy_field(
                        &mut fields,
                        extra_key,
                        legacy_value_to_string(extra_value),
                    );
                }
            }
            _ => insert_legacy_field(&mut fields, key, legacy_value_to_string(value)),
        }
    }
    serde_json::Value::Object(fields)
}

fn insert_legacy_field(
    fields: &mut serde_json::Map<String, serde_json::Value>,
    key: &str,
    value: String,
) {
    let Some(field_name) = legacy_field_name(key) else {
        return;
    };
    let value = value.trim();
    if !value.is_empty() {
        fields.insert(field_name, serde_json::Value::String(value.to_string()));
    }
}

fn legacy_field_name(key: &str) -> Option<String> {
    let mapped = match key {
        "entryType" | "entry_type" | "citationKey" | "citation_key" => return None,
        "authors" => "author",
        "editors" => "editor",
        "translators" => "translator",
        "location" => "location",
        other => other,
    };
    sanitize_bib_identifier(mapped)
}

fn legacy_value_to_string(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(value) => value.clone(),
        serde_json::Value::Number(value) => value.to_string(),
        serde_json::Value::Bool(value) => value.to_string(),
        serde_json::Value::Array(values) => values
            .iter()
            .map(legacy_value_to_string)
            .filter(|value| !value.trim().is_empty())
            .collect::<Vec<_>>()
            .join(" and "),
        serde_json::Value::Null => String::new(),
        serde_json::Value::Object(_) => value.to_string(),
    }
}

fn looks_like_bibliography_metadata(value: &serde_json::Value) -> bool {
    let Some(object) = value.as_object() else {
        return false;
    };
    [
        "entryType",
        "entry_type",
        "citationKey",
        "citation_key",
        "authors",
        "editors",
        "translators",
        "journal",
        "publisher",
        "doi",
        "isbn",
        "issn",
        "booktitle",
    ]
    .iter()
    .any(|key| object.contains_key(*key))
}

const LEGACY_BIBLIOGRAPHY_COLUMNS: &[&str] = &[
    "journal",
    "volume",
    "series",
    "number",
    "issue",
    "year",
    "month",
    "publisher",
    "edition",
    "institution",
    "school",
    "organization",
    "address",
    "location",
    "isbn",
    "issn",
    "doi",
    "url",
    "language",
    "title",
    "subtitle",
    "booktitle",
    "chapter",
    "pages",
    "abstract",
    "note",
    "crossref",
];

async fn load_tags_by_citation_key(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    source_id: &str,
) -> Result<HashMap<String, Vec<String>>, String> {
    let rows = sqlx::query(
        "SELECT e.citation_key, t.name
         FROM bib_entries e
         INNER JOIN bib_entry_tags et ON et.entry_id = e.id
         INNER JOIN bib_tags t ON t.id = et.tag_id
         WHERE e.source_id = ?
         ORDER BY lower(e.citation_key), lower(t.name)",
    )
    .bind(source_id)
    .fetch_all(&mut **transaction)
    .await
    .map_err(|error| format!("Failed to preserve bibliography tags: {error}"))?;

    let mut tags_by_key: HashMap<String, Vec<String>> = HashMap::new();
    for row in rows {
        let citation_key: String = row.get("citation_key");
        let tag_name: String = row.get("name");
        tags_by_key
            .entry(citation_key.to_ascii_lowercase())
            .or_default()
            .push(tag_name);
    }
    Ok(tags_by_key)
}

async fn ensure_tag(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    tag_name: &str,
) -> Result<String, String> {
    if let Some(existing_id) =
        sqlx::query_scalar::<_, String>("SELECT id FROM bib_tags WHERE lower(name) = lower(?)")
            .bind(tag_name)
            .fetch_optional(&mut **transaction)
            .await
            .map_err(|error| format!("Failed to look up bibliography tag: {error}"))?
    {
        return Ok(existing_id);
    }

    let tag_id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO bib_tags (id, name) VALUES (?, ?)")
        .bind(&tag_id)
        .bind(tag_name)
        .execute(&mut **transaction)
        .await
        .map_err(|error| format!("Failed to create bibliography tag: {error}"))?;
    Ok(tag_id)
}

async fn apply_tag_delta(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    entry_id: &str,
    add_tags: &[String],
    remove_tags: &[String],
) -> Result<(), String> {
    for tag_name in remove_tags {
        sqlx::query(
            "DELETE FROM bib_entry_tags
             WHERE entry_id = ?
               AND tag_id IN (SELECT id FROM bib_tags WHERE lower(name) = lower(?))",
        )
        .bind(entry_id)
        .bind(tag_name)
        .execute(&mut **transaction)
        .await
        .map_err(|error| format!("Failed to remove bibliography tag: {error}"))?;
    }

    for tag_name in add_tags {
        let tag_id = ensure_tag(transaction, tag_name).await?;
        sqlx::query("INSERT OR IGNORE INTO bib_entry_tags (entry_id, tag_id) VALUES (?, ?)")
            .bind(entry_id)
            .bind(tag_id)
            .execute(&mut **transaction)
            .await
            .map_err(|error| format!("Failed to add bibliography tag: {error}"))?;
    }
    Ok(())
}

async fn refresh_bibliography_fts_for_entry(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    entry_id: &str,
) -> Result<(), String> {
    let row = sqlx::query(
        "SELECT e.source_id, e.citation_key, e.entry_type, e.title, e.year, e.date,
                e.doi, e.isbn, e.url, e.abstract, COALESCE(e.fields_json, '{}') AS extra_fields,
                COALESCE((
                    SELECT group_concat(n.full_name, ' ')
                    FROM bib_entry_names n
                    WHERE n.entry_id = e.id
                    ORDER BY n.role, n.position
                ), '') AS creators,
                COALESCE((
                    SELECT group_concat(t.name, ' ')
                    FROM bib_entry_tags et
                    INNER JOIN bib_tags t ON t.id = et.tag_id
                    WHERE et.entry_id = e.id
                    ORDER BY lower(t.name)
                ), '') AS tags
         FROM bib_entries e
         WHERE e.id = ?",
    )
    .bind(entry_id)
    .fetch_optional(&mut **transaction)
    .await
    .map_err(|error| format!("Failed to load bibliography entry for search indexing: {error}"))?;

    sqlx::query("DELETE FROM bib_entry_fts WHERE entry_id = ?")
        .bind(entry_id)
        .execute(&mut **transaction)
        .await
        .map_err(|error| format!("Failed to refresh bibliography search index: {error}"))?;

    let Some(row) = row else {
        return Ok(());
    };

    sqlx::query(
        "INSERT INTO bib_entry_fts (
            entry_id, source_id, citation_key, entry_type, title, year, date, doi, isbn, url,
            abstract, creators, tags, extra_fields
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(entry_id)
    .bind(row.get::<String, _>("source_id"))
    .bind(row.get::<String, _>("citation_key"))
    .bind(row.get::<String, _>("entry_type"))
    .bind(optional_row_string(&row, "title").unwrap_or_default())
    .bind(optional_row_string(&row, "year").unwrap_or_default())
    .bind(optional_row_string(&row, "date").unwrap_or_default())
    .bind(optional_row_string(&row, "doi").unwrap_or_default())
    .bind(optional_row_string(&row, "isbn").unwrap_or_default())
    .bind(optional_row_string(&row, "url").unwrap_or_default())
    .bind(optional_row_string(&row, "abstract").unwrap_or_default())
    .bind(row.get::<String, _>("creators"))
    .bind(row.get::<String, _>("tags"))
    .bind(row.get::<String, _>("extra_fields"))
    .execute(&mut **transaction)
    .await
    .map_err(|error| format!("Failed to save bibliography search index: {error}"))?;

    Ok(())
}

async fn record_bibliography_history(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    source_id: Option<&str>,
    entry_id: Option<&str>,
    resource_id: Option<&str>,
    action: &str,
    summary: Option<&str>,
    details: serde_json::Value,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO bib_history (
            source_id, entry_id, resource_id, action, summary, details_json
         )
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(source_id)
    .bind(entry_id)
    .bind(resource_id)
    .bind(action)
    .bind(summary)
    .bind(details)
    .execute(&mut **transaction)
    .await
    .map_err(|error| format!("Failed to save bibliography history: {error}"))?;
    Ok(())
}

fn fts_query_text(value: &str) -> Option<String> {
    let mut seen = std::collections::HashSet::new();
    let normalized = value
        .chars()
        .map(|ch| if ch.is_alphanumeric() { ch } else { ' ' })
        .collect::<String>();
    let tokens = normalized
        .split_whitespace()
        .map(str::trim)
        .filter(|token| !token.is_empty())
        .filter(|token| seen.insert((*token).to_string()))
        .take(8)
        .map(|token| format!("{token}*"))
        .collect::<Vec<_>>();
    if tokens.is_empty() {
        None
    } else {
        Some(tokens.join(" AND "))
    }
}

async fn load_entries_by_ids(
    pool: &Pool<Sqlite>,
    entry_ids: &[String],
) -> Result<Vec<BibliographyEntrySummary>, String> {
    let mut entries = Vec::with_capacity(entry_ids.len());
    for entry_id in entry_ids {
        let row = sqlx::query(
            "SELECT e.id, e.source_id, e.entry_type, e.citation_key, e.title, e.year,
                    e.date, e.doi, e.url, e.raw_entry, e.fields_json,
                    COALESCE((
                        SELECT group_concat(name, char(31))
                        FROM (
                            SELECT t.name AS name
                            FROM bib_entry_tags et
                            INNER JOIN bib_tags t ON t.id = et.tag_id
                            WHERE et.entry_id = e.id
                            ORDER BY lower(t.name)
                        )
                    ), '') AS tags_joined
             FROM bib_entries e
             WHERE e.id = ?",
        )
        .bind(entry_id)
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("Failed to load bibliography entry: {error}"))?
        .ok_or_else(|| format!("Bibliography entry '{}' was not found", entry_id))?;
        entries.push(entry_summary_from_row(row)?);
    }
    Ok(entries)
}

fn sanitize_bib_identifier(value: &str) -> Option<String> {
    let value = value.trim().trim_start_matches('@').to_ascii_lowercase();
    if value
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
        && !value.is_empty()
    {
        Some(value)
    } else {
        None
    }
}

fn sanitize_citation_key(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty()
        || value
            .chars()
            .any(|ch| ch.is_whitespace() || matches!(ch, '{' | '}' | ',' | '\\'))
    {
        None
    } else {
        Some(value.to_string())
    }
}

fn build_raw_entry(
    entry_type: &str,
    citation_key: &str,
    fields: &serde_json::Value,
) -> Result<String, String> {
    let object = fields
        .as_object()
        .ok_or_else(|| "Bibliography fields must be a JSON object".to_string())?;
    let mut keys: Vec<&String> = object.keys().collect();
    keys.sort_by(|left, right| field_sort_key(left).cmp(&field_sort_key(right)));

    let mut raw = format!("@{}{{{}", entry_type, citation_key);
    for key in keys {
        let Some(value) = json_field_value(fields, key) else {
            continue;
        };
        raw.push_str(",\n  ");
        raw.push_str(key);
        raw.push_str(" = {");
        raw.push_str(&escape_bib_value(&value));
        raw.push('}');
    }
    raw.push_str("\n}");
    Ok(raw)
}

fn field_sort_key(field_name: &str) -> (usize, &str) {
    let priority = [
        "author",
        "editor",
        "title",
        "subtitle",
        "journal",
        "booktitle",
        "publisher",
        "year",
        "date",
        "doi",
        "url",
        "isbn",
        "issn",
        "abstract",
    ];
    (
        priority
            .iter()
            .position(|candidate| candidate.eq_ignore_ascii_case(field_name))
            .unwrap_or(priority.len()),
        field_name,
    )
}

fn escape_bib_value(value: &str) -> String {
    value.replace('\r', "").trim().to_string()
}

fn json_field_value(fields: &serde_json::Value, name: &str) -> Option<String> {
    fields
        .as_object()
        .and_then(|object| {
            object
                .iter()
                .find(|(key, _)| key.eq_ignore_ascii_case(name))
                .map(|(_, value)| value)
        })
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

async fn exact_citation_entries(
    pool: &Pool<Sqlite>,
    citation_key: &str,
    linked_source_ids: &[String],
) -> Result<Vec<BibliographyEntrySummary>, String> {
    let rows = if linked_source_ids.is_empty() {
        sqlx::query(
            "SELECT e.id, e.source_id, e.entry_type, e.citation_key, e.title, e.year,
                    e.date, e.doi, e.url, e.raw_entry, e.fields_json,
                    COALESCE((
                        SELECT group_concat(name, char(31))
                        FROM (
                            SELECT t.name AS name
                            FROM bib_entry_tags et
                            INNER JOIN bib_tags t ON t.id = et.tag_id
                            WHERE et.entry_id = e.id
                            ORDER BY lower(t.name)
                        )
                    ), '') AS tags_joined
             FROM bib_entries e
             WHERE e.citation_key = ?
             ORDER BY e.updated_at DESC",
        )
        .bind(citation_key)
        .fetch_all(pool)
        .await
    } else {
        let placeholders = std::iter::repeat("?")
            .take(linked_source_ids.len())
            .collect::<Vec<_>>()
            .join(", ");
        let query = format!(
            "SELECT e.id, e.source_id, e.entry_type, e.citation_key, e.title, e.year,
                    e.date, e.doi, e.url, e.raw_entry, e.fields_json,
                    COALESCE((
                        SELECT group_concat(name, char(31))
                        FROM (
                            SELECT t.name AS name
                            FROM bib_entry_tags et
                            INNER JOIN bib_tags t ON t.id = et.tag_id
                            WHERE et.entry_id = e.id
                            ORDER BY lower(t.name)
                        )
                    ), '') AS tags_joined
             FROM bib_entries e
             WHERE e.citation_key = ? AND e.source_id IN ({placeholders})
             ORDER BY e.updated_at DESC"
        );
        let mut query = sqlx::query(&query).bind(citation_key);
        for source_id in linked_source_ids {
            query = query.bind(source_id);
        }
        query.fetch_all(pool).await
    }
    .map_err(|error| format!("Failed to resolve citation key '{citation_key}': {error}"))?;

    rows.into_iter().map(entry_summary_from_row).collect()
}

async fn resource_path_and_type(
    pool: &Pool<Sqlite>,
    resource_id: &str,
) -> Result<(String, String), String> {
    let resource = sqlx::query("SELECT path, type FROM resources WHERE id = ?")
        .bind(resource_id)
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("Failed to load resource: {error}"))?
        .ok_or_else(|| format!("Resource '{resource_id}' was not found"))?;
    let path: String = resource
        .try_get("path")
        .map_err(|error| format!("Failed to read resource path: {error}"))?;
    let kind: String = resource
        .try_get("type")
        .map_err(|error| format!("Failed to read resource type: {error}"))?;
    Ok((path, kind))
}

async fn resource_type(pool: &Pool<Sqlite>, resource_id: &str) -> Result<String, String> {
    sqlx::query_scalar("SELECT type FROM resources WHERE id = ?")
        .bind(resource_id)
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("Failed to read resource type: {error}"))?
        .ok_or_else(|| format!("Resource '{resource_id}' was not found"))
}

async fn ensure_source_exists(pool: &Pool<Sqlite>, source_id: &str) -> Result<(), String> {
    let exists: Option<i64> = sqlx::query_scalar("SELECT 1 FROM bib_sources WHERE id = ?")
        .bind(source_id)
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("Failed to check bibliography source: {error}"))?;
    exists
        .map(|_| ())
        .ok_or_else(|| format!("Bibliography source '{source_id}' was not found"))
}

async fn linked_source_ids(pool: &Pool<Sqlite>, resource_id: &str) -> Result<Vec<String>, String> {
    sqlx::query_scalar(
        "SELECT source_id
         FROM resource_bib_sources
         WHERE resource_id = ? AND link_kind = 'uses'
         ORDER BY source_id ASC",
    )
    .bind(resource_id)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("Failed to read linked bibliography sources: {error}"))
}

async fn insert_names(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    entry_id: &str,
    entry: &BibEntry,
) -> Result<(), String> {
    for role in ["author", "editor", "translator"] {
        let Some(value) = field_value(entry, role) else {
            continue;
        };
        for (position, full_name) in split_people(&value).into_iter().enumerate() {
            sqlx::query(
                "INSERT INTO bib_entry_names (
                    entry_id, role, position, full_name, family, given, normalized_name
                 )
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(entry_id)
            .bind(role)
            .bind(position as i64)
            .bind(&full_name)
            .bind(name_family(&full_name))
            .bind(name_given(&full_name))
            .bind(normalize_name(&full_name))
            .execute(&mut **transaction)
            .await
            .map_err(|error| format!("Failed to save bibliography creator: {error}"))?;
        }
    }
    Ok(())
}

#[derive(Debug, Clone)]
struct CitationDraft {
    command_name: String,
    citation_key: String,
    byte_start: usize,
    byte_end: usize,
}

#[derive(Debug, Clone)]
struct BibliographyDeclarationDraft {
    command_name: String,
    requested: String,
    byte_start: usize,
    byte_end: usize,
}

#[derive(Debug, Clone)]
struct ResolvedEntry {
    id: String,
    entry_type: String,
    title: Option<String>,
    year: Option<String>,
}

async fn resolve_citation_key(
    transaction: &mut sqlx::Transaction<'_, Sqlite>,
    citation_key: &str,
    linked_source_ids: &[String],
) -> Result<Vec<ResolvedEntry>, String> {
    let rows = if linked_source_ids.is_empty() {
        sqlx::query(
            "SELECT id, entry_type, title, year
             FROM bib_entries
             WHERE citation_key = ?
             ORDER BY updated_at DESC
             LIMIT 2",
        )
        .bind(citation_key)
        .fetch_all(&mut **transaction)
        .await
    } else {
        let placeholders = std::iter::repeat("?")
            .take(linked_source_ids.len())
            .collect::<Vec<_>>()
            .join(", ");
        let query = format!(
            "SELECT id, entry_type, title, year
             FROM bib_entries
             WHERE citation_key = ? AND source_id IN ({placeholders})
             ORDER BY updated_at DESC
             LIMIT 2"
        );
        let mut query = sqlx::query(&query).bind(citation_key);
        for source_id in linked_source_ids {
            query = query.bind(source_id);
        }
        query.fetch_all(&mut **transaction).await
    }
    .map_err(|error| format!("Failed to resolve citation key '{citation_key}': {error}"))?;

    Ok(rows
        .into_iter()
        .map(|row| ResolvedEntry {
            id: row.get("id"),
            entry_type: row.get("entry_type"),
            title: row.try_get("title").ok(),
            year: row.try_get("year").ok(),
        })
        .collect())
}

fn scan_bibliography_declarations(content: &str) -> Vec<BibliographyDeclarationDraft> {
    let mut declarations = Vec::new();
    let mut line_start = 0;

    for line in content.split_inclusive('\n') {
        let scan_end = unescaped_comment_start(line).unwrap_or(line.len());
        scan_declaration_line(&line[..scan_end], line_start, &mut declarations);
        line_start += line.len();
    }

    if !content.ends_with('\n') && line_start < content.len() {
        let line = &content[line_start..];
        let scan_end = unescaped_comment_start(line).unwrap_or(line.len());
        scan_declaration_line(&line[..scan_end], line_start, &mut declarations);
    }

    declarations
}

fn scan_declaration_line(
    line: &str,
    line_start: usize,
    declarations: &mut Vec<BibliographyDeclarationDraft>,
) {
    let mut pos = 0;
    while pos < line.len() {
        if char_at(line, pos) != Some('\\') {
            pos = advance_one(line, pos);
            continue;
        }

        let command_start = pos;
        pos += 1;
        let name_start = pos;
        while matches!(char_at(line, pos), Some(ch) if ch.is_ascii_alphabetic()) {
            pos += 1;
        }

        if name_start == pos {
            continue;
        }

        let command_name = line[name_start..pos].to_string();
        if !is_bibliography_declaration_command(&command_name) {
            continue;
        }

        let mut cursor = skip_ascii_whitespace(line, pos);
        while char_at(line, cursor) == Some('[') {
            let Some((_inner_end, value_end)) = find_balanced(line, cursor, '[', ']') else {
                break;
            };
            cursor = skip_ascii_whitespace(line, value_end);
        }

        if char_at(line, cursor) != Some('{') {
            pos = cursor.max(command_start + 1);
            continue;
        }

        let Some((inner_end, value_end)) = find_balanced(line, cursor, '{', '}') else {
            pos = cursor.max(command_start + 1);
            continue;
        };
        let value_start = cursor + 1;
        let raw_value = &line[value_start..inner_end];
        let values = if command_name.eq_ignore_ascii_case("bibliography") {
            split_bibliography_files(raw_value, value_start)
        } else {
            vec![trimmed_decl_value(raw_value, value_start)]
        };

        for (requested, byte_start, byte_end) in values {
            if requested.is_empty() {
                continue;
            }
            declarations.push(BibliographyDeclarationDraft {
                command_name: command_name.clone(),
                requested,
                byte_start: line_start + byte_start,
                byte_end: line_start + byte_end,
            });
        }

        pos = value_end;
    }
}

fn split_bibliography_files(input: &str, offset: usize) -> Vec<(String, usize, usize)> {
    let mut values = Vec::new();
    let mut start = 0;
    for (pos, ch) in input.char_indices() {
        if ch == ',' {
            values.push(trimmed_decl_value(&input[start..pos], offset + start));
            start = pos + ch.len_utf8();
        }
    }
    values.push(trimmed_decl_value(&input[start..], offset + start));
    values
}

fn trimmed_decl_value(input: &str, offset: usize) -> (String, usize, usize) {
    let leading = input.len() - input.trim_start().len();
    let trailing = input.len() - input.trim_end().len();
    let start = leading;
    let end = input.len().saturating_sub(trailing);
    (input[start..end].to_string(), offset + start, offset + end)
}

fn is_bibliography_declaration_command(command_name: &str) -> bool {
    matches!(
        command_name.to_ascii_lowercase().as_str(),
        "bibliography" | "addbibresource" | "addglobalbib" | "addsectionbib"
    )
}

fn normalize_bib_request(request: &str) -> String {
    let without_scheme = request
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
        .replace('\\', "/");
    if without_scheme.to_ascii_lowercase().ends_with(".bib") {
        without_scheme
    } else {
        format!("{without_scheme}.bib")
    }
}

fn matching_sources(
    sources: &[BibliographySourceOption],
    base_dir: Option<&Path>,
    normalized_request: &str,
) -> Vec<BibliographySourceOption> {
    let request_path = Path::new(normalized_request);
    let absolute_request = if request_path.is_absolute() {
        Some(normalize_pathbuf(request_path))
    } else {
        base_dir.map(|base_dir| normalize_pathbuf(&base_dir.join(request_path)))
    };
    let request_file_name = request_path
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());

    let mut exact = Vec::new();
    let mut file_name_matches = Vec::new();

    for source in sources {
        let source_path = normalize_pathbuf(Path::new(&source.path));
        if absolute_request
            .as_ref()
            .is_some_and(|request| request == &source_path)
        {
            exact.push(source.clone());
            continue;
        }

        if let Some(request_file_name) = &request_file_name {
            let source_file_name = Path::new(&source.path)
                .file_name()
                .and_then(|value| value.to_str())
                .map(|value| value.to_ascii_lowercase());
            if source_file_name.as_ref() == Some(request_file_name) {
                file_name_matches.push(source.clone());
            }
        }
    }

    if exact.is_empty() {
        file_name_matches
    } else {
        exact
    }
}

fn normalize_pathbuf(path: &Path) -> String {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::CurDir => {}
            std::path::Component::ParentDir => {
                normalized.pop();
            }
            _ => normalized.push(component.as_os_str()),
        }
    }
    normalized.to_string_lossy().replace('\\', "/")
}

fn scan_latex_citations(content: &str) -> Vec<CitationDraft> {
    let mut drafts = Vec::new();
    let mut line_start = 0;

    for line in content.split_inclusive('\n') {
        let scan_end = unescaped_comment_start(line).unwrap_or(line.len());
        scan_citation_line(&line[..scan_end], line_start, &mut drafts);
        line_start += line.len();
    }

    if !content.ends_with('\n') && line_start < content.len() {
        let line = &content[line_start..];
        let scan_end = unescaped_comment_start(line).unwrap_or(line.len());
        scan_citation_line(&line[..scan_end], line_start, &mut drafts);
    }

    drafts
}

fn scan_citation_line(line: &str, line_start: usize, drafts: &mut Vec<CitationDraft>) {
    let mut pos = 0;
    while pos < line.len() {
        if char_at(line, pos) != Some('\\') {
            pos = advance_one(line, pos);
            continue;
        }

        let command_start = pos;
        pos += 1;
        let name_start = pos;
        while matches!(char_at(line, pos), Some(ch) if ch.is_ascii_alphabetic()) {
            pos += 1;
        }

        if name_start == pos {
            continue;
        }

        let command_name = line[name_start..pos].to_string();
        if char_at(line, pos) == Some('*') {
            pos += 1;
        }
        if !is_citation_command(&command_name) {
            continue;
        }

        let mut cursor = skip_ascii_whitespace(line, pos);
        while char_at(line, cursor) == Some('[') {
            let Some((_inner_end, value_end)) = find_balanced(line, cursor, '[', ']') else {
                break;
            };
            cursor = skip_ascii_whitespace(line, value_end);
        }

        if char_at(line, cursor) != Some('{') {
            pos = cursor.max(command_start + 1);
            continue;
        }

        let Some((inner_end, value_end)) = find_balanced(line, cursor, '{', '}') else {
            pos = cursor.max(command_start + 1);
            continue;
        };
        let keys_start = cursor + 1;
        for (key, start, end) in split_citation_keys(&line[keys_start..inner_end], keys_start) {
            if key == "*" {
                continue;
            }
            drafts.push(CitationDraft {
                command_name: command_name.clone(),
                citation_key: key,
                byte_start: line_start + start,
                byte_end: line_start + end,
            });
        }
        pos = value_end;
    }
}

fn split_citation_keys(input: &str, offset: usize) -> Vec<(String, usize, usize)> {
    let mut keys = Vec::new();
    let mut start = 0;

    for (pos, ch) in input.char_indices() {
        if ch == ',' {
            push_citation_key(input, offset, start, pos, &mut keys);
            start = pos + ch.len_utf8();
        }
    }
    push_citation_key(input, offset, start, input.len(), &mut keys);

    keys
}

fn push_citation_key(
    input: &str,
    offset: usize,
    start: usize,
    end: usize,
    keys: &mut Vec<(String, usize, usize)>,
) {
    let raw = &input[start..end];
    let leading = raw.len() - raw.trim_start().len();
    let trailing = raw.len() - raw.trim_end().len();
    let key_start = start + leading;
    let key_end = end.saturating_sub(trailing);
    if key_start >= key_end {
        return;
    }
    keys.push((
        input[key_start..key_end].to_string(),
        offset + key_start,
        offset + key_end,
    ));
}

fn is_citation_command(command_name: &str) -> bool {
    let lower = command_name.to_ascii_lowercase();
    lower == "nocite"
        || lower.ends_with("cite")
        || matches!(
            lower.as_str(),
            "citep"
                | "citet"
                | "citealt"
                | "citealp"
                | "citeauthor"
                | "citeyear"
                | "citeyearpar"
                | "citetext"
        )
}

fn find_balanced(input: &str, open_pos: usize, open: char, close: char) -> Option<(usize, usize)> {
    let mut depth = 0_i32;
    let mut escaped = false;
    for (relative, ch) in input[open_pos..].char_indices() {
        let pos = open_pos + relative;
        if escaped {
            escaped = false;
            continue;
        }
        if ch == '\\' {
            escaped = true;
            continue;
        }
        if ch == open {
            depth += 1;
        } else if ch == close {
            depth -= 1;
            if depth == 0 {
                return Some((pos, pos + ch.len_utf8()));
            }
        }
    }
    None
}

fn unescaped_comment_start(line: &str) -> Option<usize> {
    for (pos, ch) in line.char_indices() {
        if ch == '%' && !is_escaped(line, pos) {
            return Some(pos);
        }
    }
    None
}

fn is_escaped(input: &str, pos: usize) -> bool {
    let mut slash_count = 0;
    for ch in input[..pos].chars().rev() {
        if ch == '\\' {
            slash_count += 1;
        } else {
            break;
        }
    }
    slash_count % 2 == 1
}

fn skip_ascii_whitespace(input: &str, mut pos: usize) -> usize {
    while matches!(char_at(input, pos), Some(ch) if ch.is_ascii_whitespace()) {
        pos += 1;
    }
    pos
}

fn char_at(input: &str, pos: usize) -> Option<char> {
    input.get(pos..)?.chars().next()
}

fn advance_one(input: &str, pos: usize) -> usize {
    pos + char_at(input, pos).map(char::len_utf8).unwrap_or(1)
}

fn fields_to_json(fields: &[BibField]) -> Result<serde_json::Value, String> {
    let mut object = serde_json::Map::new();
    for field in fields {
        object.insert(
            field.name.clone(),
            serde_json::Value::String(field.value.clone()),
        );
    }
    Ok(serde_json::Value::Object(object))
}

fn field_value(entry: &BibEntry, name: &str) -> Option<String> {
    entry
        .fields
        .iter()
        .find(|field| field.name.eq_ignore_ascii_case(name))
        .map(|field| field.value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn split_people(value: &str) -> Vec<String> {
    value
        .split(" and ")
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn name_family(full_name: &str) -> Option<String> {
    if let Some((family, _given)) = full_name.split_once(',') {
        let family = family.trim();
        if !family.is_empty() {
            return Some(family.to_string());
        }
    }
    full_name
        .split_whitespace()
        .last()
        .map(ToOwned::to_owned)
        .filter(|name| !name.is_empty())
}

fn name_given(full_name: &str) -> Option<String> {
    if let Some((_family, given)) = full_name.split_once(',') {
        let given = given.trim();
        if !given.is_empty() {
            return Some(given.to_string());
        }
    }
    let mut parts: Vec<&str> = full_name.split_whitespace().collect();
    if parts.len() <= 1 {
        return None;
    }
    parts.pop();
    Some(parts.join(" "))
}

fn normalize_name(full_name: &str) -> String {
    full_name
        .to_ascii_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn hash_content(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn parse_status(entries_len: usize, diagnostics_len: usize) -> &'static str {
    match (entries_len, diagnostics_len) {
        (_, 0) => "ok",
        (0, _) => "error",
        _ => "warning",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::DatabaseManager;
    use sqlx::sqlite::SqlitePoolOptions;
    use std::{fs, path::PathBuf};

    #[tokio::test]
    async fn reparses_bibliography_resource_into_core_tables() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("in-memory database");
        DatabaseManager::init_schema(&pool).await.expect("schema");

        let bib_path = temp_bib_path("datatex-bib-import-ok.bib");
        fs::write(
            &bib_path,
            r#"@article{knuth1984,
  author = {Knuth, Donald E. and Lamport, Leslie},
  title = {The {\TeX} Book},
  year = {1984},
  doi = {10.1000/example}
}
"#,
        )
        .expect("write fixture");

        sqlx::query("INSERT INTO collections (name, type) VALUES ('refs', 'bibliography')")
            .execute(&pool)
            .await
            .expect("collection");
        sqlx::query(
            "INSERT INTO resources (id, path, type, collection, title)
             VALUES ('res-bib', ?, 'bibliography', 'refs', 'refs.bib')",
        )
        .bind(bib_path.to_string_lossy().to_string())
        .execute(&pool)
        .await
        .expect("resource");

        let result = reparse_bibliography_resource(&pool, "res-bib")
            .await
            .expect("reparse bibliography");
        assert_eq!(result.entries_imported, 1);
        assert_eq!(result.source.parse_status, "ok");

        let entries = list_bibliography_entries_for_resource(&pool, "res-bib")
            .await
            .expect("list entries");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].citation_key, "knuth1984");
        assert_eq!(entries[0].year.as_deref(), Some("1984"));

        let author_results = search_bibliography_entries(&pool, None, "lamport", 20)
            .await
            .expect("search by author");
        assert_eq!(author_results.len(), 1);
        assert_eq!(author_results[0].citation_key, "knuth1984");

        let updated = update_bibliography_entry(
            &pool,
            BibliographyEntryUpdateRequest {
                entry_id: entries[0].id.clone(),
                entry_type: Some("book".to_string()),
                citation_key: Some("texbook1984".to_string()),
                fields: Some(serde_json::json!({
                    "author": "Knuth, Donald E.",
                    "title": "The TeXbook",
                    "year": "1986",
                    "publisher": "Addison-Wesley"
                })),
                raw_entry: None,
            },
        )
        .await
        .expect("structured update");
        assert_eq!(updated.entry_type, "book");
        assert_eq!(updated.citation_key, "texbook1984");
        assert_eq!(updated.year.as_deref(), Some("1986"));
        assert!(updated
            .raw_entry
            .as_deref()
            .is_some_and(|raw| raw.contains("@book{texbook1984")));
        let publisher_results = search_bibliography_entries(&pool, None, "Addison", 20)
            .await
            .expect("search updated publisher through fts");
        assert_eq!(publisher_results.len(), 1);
        assert_eq!(publisher_results[0].citation_key, "texbook1984");

        let raw_updated = update_bibliography_entry(
            &pool,
            BibliographyEntryUpdateRequest {
                entry_id: updated.id.clone(),
                entry_type: None,
                citation_key: None,
                fields: None,
                raw_entry: Some(
                    "@article{rawKey,title={Raw Title},year={2020},author={Doe, Jane}}".to_string(),
                ),
            },
        )
        .await
        .expect("raw update");
        assert_eq!(raw_updated.entry_type, "article");
        assert_eq!(raw_updated.citation_key, "rawKey");
        assert_eq!(raw_updated.title.as_deref(), Some("Raw Title"));

        let batch_updated = batch_update_bibliography_entries(
            &pool,
            BatchBibliographyEntryUpdateRequest {
                entry_ids: vec![raw_updated.id.clone()],
                set_fields: Some(serde_json::json!({ "note": "Reviewed" })),
                remove_fields: Some(vec!["doi".to_string()]),
                add_tags: Some(vec!["reviewed".to_string(), "Algebra".to_string()]),
                remove_tags: None,
            },
        )
        .await
        .expect("batch update");
        assert_eq!(batch_updated.len(), 1);
        assert_eq!(
            batch_updated[0]
                .fields
                .get("note")
                .and_then(|value| value.as_str()),
            Some("Reviewed")
        );
        assert!(batch_updated[0].doi.is_none());
        assert_eq!(batch_updated[0].tags, vec!["algebra", "reviewed"]);

        let retagged =
            set_bibliography_entry_tags(&pool, &raw_updated.id, vec!["geometry".to_string()])
                .await
                .expect("set entry tags");
        assert_eq!(retagged.tags, vec!["geometry"]);
        let tag_search = search_bibliography_entries(&pool, None, "geometry", 20)
            .await
            .expect("search tag through fts");
        assert_eq!(tag_search.len(), 1);
        assert_eq!(tag_search[0].citation_key, "rawKey");

        let tags = list_bibliography_tags(&pool).await.expect("list tags");
        assert!(tags
            .iter()
            .any(|tag| tag.name == "geometry" && tag.entry_count == 1));
        let tagged_entries =
            list_workspace_bibliography_entries(&pool, None, "", None, None, Some("geometry"), 20)
                .await
                .expect("tag filter");
        assert_eq!(tagged_entries.len(), 1);
        assert_eq!(tagged_entries[0].citation_key, "rawKey");

        let note = save_bibliography_entry_note(
            &pool,
            BibliographyEntryNoteUpsertRequest {
                id: None,
                entry_id: raw_updated.id.clone(),
                body: "Useful source for geometry exercises.".to_string(),
                note_kind: Some("idea".to_string()),
                is_pinned: Some(true),
            },
        )
        .await
        .expect("create entry note");
        assert_eq!(note.note_kind, "idea");
        assert!(note.is_pinned);

        let edited_note = save_bibliography_entry_note(
            &pool,
            BibliographyEntryNoteUpsertRequest {
                id: Some(note.id.clone()),
                entry_id: raw_updated.id.clone(),
                body: "Updated reading note.".to_string(),
                note_kind: Some("quote".to_string()),
                is_pinned: Some(false),
            },
        )
        .await
        .expect("edit entry note");
        assert_eq!(edited_note.body, "Updated reading note.");
        assert_eq!(edited_note.note_kind, "quote");
        assert!(!edited_note.is_pinned);

        let notes = list_bibliography_entry_notes(&pool, &raw_updated.id)
            .await
            .expect("list entry notes");
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].id, note.id);
        delete_bibliography_entry_note(&pool, &note.id)
            .await
            .expect("delete entry note");
        let notes_after_delete = list_bibliography_entry_notes(&pool, &raw_updated.id)
            .await
            .expect("list entry notes after delete");
        assert!(notes_after_delete.is_empty());

        let first_pdf_path = temp_bib_path("datatex-bib-attachment-one.pdf");
        let second_pdf_path = temp_bib_path("datatex-bib-attachment-two.pdf");
        fs::write(&first_pdf_path, b"%PDF-1.7\n% first\n").expect("write first pdf fixture");
        fs::write(&second_pdf_path, b"%PDF-1.7\n% second\n").expect("write second pdf fixture");
        let first_attachment = attach_bibliography_entry_file(
            &pool,
            BibliographyEntryAttachmentRequest {
                entry_id: raw_updated.id.clone(),
                path: first_pdf_path.to_string_lossy().to_string(),
                title: None,
                attachment_kind: Some("pdf".to_string()),
                is_primary: None,
            },
        )
        .await
        .expect("attach first pdf");
        assert!(first_attachment.is_primary);
        assert_eq!(
            first_attachment.mime_type.as_deref(),
            Some("application/pdf")
        );
        let second_attachment = attach_bibliography_entry_file(
            &pool,
            BibliographyEntryAttachmentRequest {
                entry_id: raw_updated.id.clone(),
                path: second_pdf_path.to_string_lossy().to_string(),
                title: Some("Paper PDF".to_string()),
                attachment_kind: Some("pdf".to_string()),
                is_primary: Some(true),
            },
        )
        .await
        .expect("attach second pdf as primary");
        assert!(second_attachment.is_primary);
        let attachments = list_bibliography_entry_attachments(&pool, &raw_updated.id)
            .await
            .expect("list entry attachments");
        assert_eq!(attachments.len(), 2);
        assert_eq!(attachments[0].id, second_attachment.id);
        assert!(attachments[0].is_primary);
        delete_bibliography_entry_attachment(&pool, &second_attachment.id)
            .await
            .expect("delete primary attachment");
        let attachments_after_delete = list_bibliography_entry_attachments(&pool, &raw_updated.id)
            .await
            .expect("list attachments after delete");
        assert_eq!(attachments_after_delete.len(), 1);
        assert_eq!(attachments_after_delete[0].id, first_attachment.id);
        assert!(attachments_after_delete[0].is_primary);

        let annotation = save_bibliography_pdf_annotation(
            &pool,
            BibliographyPdfAnnotationUpsertRequest {
                id: None,
                entry_id: raw_updated.id.clone(),
                attachment_id: first_attachment.id.clone(),
                page: 2,
                annotation_kind: Some("highlight".to_string()),
                selected_text: Some("Important theorem".to_string()),
                comment: Some("Connect this to the exercise introduction.".to_string()),
                color: Some("#ffd43b".to_string()),
                rects: Some(serde_json::json!([
                    { "x": 10.0, "y": 20.0, "width": 120.0, "height": 16.0 }
                ])),
                external_annotation_id: Some("pdf-ann-1".to_string()),
            },
        )
        .await
        .expect("create pdf annotation link");
        assert_eq!(annotation.page, 2);
        assert_eq!(annotation.annotation_kind, "highlight");
        assert_eq!(annotation.attachment_id, first_attachment.id);
        assert_eq!(
            annotation.selected_text.as_deref(),
            Some("Important theorem")
        );

        let edited_annotation = save_bibliography_pdf_annotation(
            &pool,
            BibliographyPdfAnnotationUpsertRequest {
                id: Some(annotation.id.clone()),
                entry_id: raw_updated.id.clone(),
                attachment_id: first_attachment.id.clone(),
                page: 3,
                annotation_kind: Some("quote".to_string()),
                selected_text: Some("Updated quote".to_string()),
                comment: None,
                color: Some("#fab005".to_string()),
                rects: None,
                external_annotation_id: None,
            },
        )
        .await
        .expect("edit pdf annotation link");
        assert_eq!(edited_annotation.page, 3);
        assert_eq!(edited_annotation.annotation_kind, "quote");
        assert_eq!(edited_annotation.comment, None);

        let annotations = list_bibliography_pdf_annotations(&pool, &raw_updated.id)
            .await
            .expect("list pdf annotation links");
        assert_eq!(annotations.len(), 1);
        assert_eq!(annotations[0].id, annotation.id);
        delete_bibliography_pdf_annotation(&pool, &annotation.id)
            .await
            .expect("delete pdf annotation link");
        let annotations_after_delete = list_bibliography_pdf_annotations(&pool, &raw_updated.id)
            .await
            .expect("list pdf annotations after delete");
        assert!(annotations_after_delete.is_empty());

        let exported = export_bibliography_entries(&pool, vec![raw_updated.id.clone()])
            .await
            .expect("export bibliography entries");
        assert!(exported.contains("@article{rawKey"));
        assert!(exported.contains("note = {Reviewed}"));
        let csl_export =
            export_bibliography_entries_as(&pool, vec![raw_updated.id.clone()], "csl-json")
                .await
                .expect("export csl json");
        let csl_items: serde_json::Value =
            serde_json::from_str(&csl_export).expect("valid csl json export");
        assert_eq!(csl_items[0]["citation-key"], "rawKey");
        assert_eq!(csl_items[0]["type"], "article-journal");
        assert_eq!(csl_items[0]["title"], "Raw Title");

        let history = list_bibliography_history(&pool, Some(&result.source.id), None, None, 20)
            .await
            .expect("list bibliography history");
        let actions = history
            .iter()
            .map(|item| item.action.as_str())
            .collect::<Vec<_>>();
        assert!(actions.contains(&"import"));
        assert!(actions.contains(&"entry_update"));
        assert!(actions.contains(&"batch_update"));
        assert!(actions.contains(&"tag_update"));

        let creator_count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM bib_entry_names WHERE role = 'author'")
                .fetch_one(&pool)
                .await
                .expect("creator count");
        assert_eq!(creator_count.0, 1);

        fs::write(
            &bib_path,
            r#"@article{rawKey,
  author = {Doe, Jane},
  title = {Watched Title},
  year = {2027}
}
"#,
        )
        .expect("write watched update");
        let tracked = list_tracked_bibliography_resources(&pool)
            .await
            .expect("list tracked bibliographies");
        assert_eq!(tracked.len(), 1);
        assert_eq!(tracked[0].resource_id, "res-bib");

        let watched_reparse = reparse_changed_bibliography_path(&pool, &bib_path)
            .await
            .expect("reparse changed bibliography path")
            .expect("changed bibliography should reparse");
        assert_eq!(watched_reparse.entries_imported, 1);
        let watched_entries = list_bibliography_entries_for_resource(&pool, "res-bib")
            .await
            .expect("list watched entries");
        assert_eq!(watched_entries.len(), 1);
        assert_eq!(watched_entries[0].citation_key, "rawKey");
        assert_eq!(watched_entries[0].title.as_deref(), Some("Watched Title"));
        assert_eq!(watched_entries[0].tags, vec!["geometry"]);

        let federation = save_bibliography_collection_federation(
            &pool,
            BibliographyCollectionFederationRequest {
                collection: "refs".to_string(),
                remote_kind: Some("git".to_string()),
                remote_url: Some("https://example.test/team/refs.git".to_string()),
                sync_mode: Some("push_pull".to_string()),
                conflict_policy: Some("manual".to_string()),
                is_enabled: Some(true),
            },
        )
        .await
        .expect("save federation strategy");
        assert_eq!(federation.collection, "refs");
        assert_eq!(federation.remote_kind, "git");
        assert_eq!(federation.sync_mode, "push_pull");
        assert_eq!(federation.sync_status, "idle");
        assert!(federation.is_enabled);
        assert_eq!(federation.source_count, 1);
        assert_eq!(federation.entry_count, 1);

        let federated_collections = list_bibliography_collection_federation(&pool)
            .await
            .expect("list federation strategies");
        assert_eq!(federated_collections.len(), 1);
        assert_eq!(federated_collections[0].collection, "refs");
        delete_bibliography_collection_federation(&pool, "refs")
            .await
            .expect("reset federation strategy");
        let reset_federation = list_bibliography_collection_federation(&pool)
            .await
            .expect("list federation after reset");
        assert!(reset_federation[0].id.is_none());
        assert_eq!(reset_federation[0].sync_status, "not_configured");

        let unchanged = reparse_changed_bibliography_path(&pool, &bib_path)
            .await
            .expect("unchanged bibliography path check");
        assert!(unchanged.is_none());

        let _ = fs::remove_file(bib_path);
    }

    #[tokio::test]
    async fn backfills_existing_legacy_bibliography_metadata_idempotently() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("in-memory database");
        DatabaseManager::init_schema(&pool).await.expect("schema");

        sqlx::query("INSERT INTO collections (name, type) VALUES ('legacy', 'bibliography')")
            .execute(&pool)
            .await
            .expect("collection");
        sqlx::query(
            "INSERT INTO bibliography (citation_key, entry_type, data, collection)
             VALUES ('globalKey', 'article', ?, 'legacy')",
        )
        .bind(
            serde_json::json!({
                "author": "Global, Alice",
                "title": "Global Legacy Title",
                "year": "1999",
                "doi": "10.1/global"
            })
            .to_string(),
        )
        .execute(&pool)
        .await
        .expect("legacy global bibliography");

        sqlx::query(
            "INSERT INTO resources (id, path, type, collection, title, metadata)
             VALUES
                ('legacy-resource-bib', '/legacy/resource.bib', 'bibliography', 'legacy', 'Resource Legacy', '{}'),
                ('legacy-json-bib', '/legacy/json.bib', 'bibliography', 'legacy', 'Json Legacy', ?)",
        )
        .bind(
            serde_json::json!({
                "entryType": "book",
                "citationKey": "jsonKey",
                "title": "JSON Legacy Title",
                "authors": ["Json, Jane", "Json, John"],
                "publisher": "JSON Press"
            })
            .to_string(),
        )
        .execute(&pool)
        .await
        .expect("legacy resources");

        sqlx::query(
            "INSERT INTO resource_bibliographies (
                resource_id, entry_type, citation_key, title, year, publisher
             )
             VALUES ('legacy-resource-bib', 'book', 'resourceKey', 'Resource Legacy Title', '2001', 'Legacy Press')",
        )
        .execute(&pool)
        .await
        .expect("legacy resource bibliography");
        sqlx::query(
            "INSERT INTO resource_bibliography_persons (resource_id, role, full_name, position)
             VALUES
                ('legacy-resource-bib', 'author', 'Resource, Author', 0),
                ('legacy-resource-bib', 'editor', 'Editor, One', 0)",
        )
        .execute(&pool)
        .await
        .expect("legacy persons");
        sqlx::query(
            "INSERT INTO resource_bibliography_extras (resource_id, key, value)
             VALUES ('legacy-resource-bib', 'keywords', 'legacy,backfill')",
        )
        .execute(&pool)
        .await
        .expect("legacy extras");

        let result = backfill_existing_bibliography_metadata(&pool)
            .await
            .expect("backfill legacy bibliography metadata");
        assert_eq!(result.entries_imported, 3);
        assert_eq!(result.skipped_invalid, 0);

        let entries = list_workspace_bibliography_entries(&pool, None, "", None, None, None, 20)
            .await
            .expect("list backfilled workspace entries");
        let keys = entries
            .iter()
            .map(|entry| entry.citation_key.as_str())
            .collect::<Vec<_>>();
        assert!(keys.contains(&"globalKey"));
        assert!(keys.contains(&"resourceKey"));
        assert!(keys.contains(&"jsonKey"));

        let author_results = search_bibliography_entries(&pool, None, "Resource Author", 20)
            .await
            .expect("search backfilled author through fts");
        assert_eq!(author_results.len(), 1);
        assert_eq!(author_results[0].citation_key, "resourceKey");
        assert_eq!(
            author_results[0]
                .fields
                .get("keywords")
                .and_then(|value| value.as_str()),
            Some("legacy,backfill")
        );

        let resource_entries = list_bibliography_entries_for_resource(&pool, "legacy-resource-bib")
            .await
            .expect("resource backfilled entries");
        assert_eq!(resource_entries.len(), 1);
        assert_eq!(resource_entries[0].citation_key, "resourceKey");

        let repeat = backfill_existing_bibliography_metadata(&pool)
            .await
            .expect("repeat backfill");
        assert_eq!(repeat.entries_imported, 0);
        assert!(repeat.skipped_existing >= 2);

        let total_entries: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bib_entries")
            .fetch_one(&pool)
            .await
            .expect("entry count");
        assert_eq!(total_entries.0, 3);
    }

    #[tokio::test]
    async fn imports_external_bibliography_formats_into_workspace() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("in-memory database");
        DatabaseManager::init_schema(&pool).await.expect("schema");

        let ris = import_bibliography_content(
            &pool,
            BibliographyContentImportRequest {
                content: "TY  - JOUR\nID  - doe2024\nAU  - Doe, Jane\nTI  - Imported RIS Title\nPY  - 2024\nDO  - 10.1/ris\nER  -\n".to_string(),
                format: Some("ris".to_string()),
                source_label: Some("zotero-export.ris".to_string()),
            },
        )
        .await
        .expect("import ris");
        assert_eq!(ris.entries_imported, 1);
        assert_eq!(ris.format, "ris");

        let csl = import_bibliography_content(
            &pool,
            BibliographyContentImportRequest {
                content: r#"[{"id":"csl2025","type":"book","title":"Imported CSL Title","author":[{"family":"Reader","given":"Rita"}],"issued":{"date-parts":[[2025]]},"publisher":"CSL Press"}]"#.to_string(),
                format: Some("csl-json".to_string()),
                source_label: Some("csl-export.json".to_string()),
            },
        )
        .await
        .expect("import csl");
        assert_eq!(csl.entries_imported, 1);

        let sources = list_all_bibliography_sources(&pool)
            .await
            .expect("list imported sources");
        assert_eq!(sources.len(), 2);
        assert!(sources
            .iter()
            .any(|source| source.path == "zotero-export.ris"));
        assert!(sources.iter().all(|source| source.entry_count == 1));

        let entries =
            list_workspace_bibliography_entries(&pool, None, "Rita", None, None, None, 20)
                .await
                .expect("search imported csl author");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].citation_key, "csl2025");

        let exported = export_bibliography_entries(&pool, vec![entries[0].id.clone()])
            .await
            .expect("export imported entry");
        assert!(exported.contains("@book{csl2025"));
        assert!(exported.contains("publisher = {CSL Press}"));
    }

    #[tokio::test]
    async fn reparse_replaces_previous_entries_for_same_source() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("in-memory database");
        DatabaseManager::init_schema(&pool).await.expect("schema");

        let bib_path = temp_bib_path("datatex-bib-import-replace.bib");
        fs::write(&bib_path, "@misc{old,title={Old}}\n").expect("write old fixture");

        sqlx::query("INSERT INTO collections (name, type) VALUES ('refs', 'bibliography')")
            .execute(&pool)
            .await
            .expect("collection");
        sqlx::query(
            "INSERT INTO resources (id, path, type, collection, title)
             VALUES ('res-bib', ?, 'bibliography', 'refs', 'refs.bib')",
        )
        .bind(bib_path.to_string_lossy().to_string())
        .execute(&pool)
        .await
        .expect("resource");

        reparse_bibliography_resource(&pool, "res-bib")
            .await
            .expect("first reparse");
        fs::write(&bib_path, "@misc{new,title={New}}\n").expect("write new fixture");
        reparse_bibliography_resource(&pool, "res-bib")
            .await
            .expect("second reparse");

        let entries = list_bibliography_entries_for_resource(&pool, "res-bib")
            .await
            .expect("list entries");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].citation_key, "new");

        let source_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bib_sources")
            .fetch_one(&pool)
            .await
            .expect("source count");
        assert_eq!(source_count.0, 1);

        let _ = fs::remove_file(bib_path);
    }

    #[tokio::test]
    async fn scans_latex_citations_and_resolves_known_keys() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("in-memory database");
        DatabaseManager::init_schema(&pool).await.expect("schema");

        let bib_path = temp_bib_path("datatex-citation-scan.bib");
        let tex_path = temp_bib_path("datatex-citation-scan.tex");
        fs::write(
            &bib_path,
            r#"@article{known,title={Known Entry},year={2026}}
@book{other,title={Other Entry},year={2025}}
"#,
        )
        .expect("write bib fixture");
        fs::write(
            &tex_path,
            r#"
Text \cite{known, missing}.
% \cite{commented}
More text \parencite[see][12]{other} and \nocite{*}.
"#,
        )
        .expect("write tex fixture");

        sqlx::query("INSERT INTO collections (name, type) VALUES ('refs', 'bibliography')")
            .execute(&pool)
            .await
            .expect("collection");
        sqlx::query(
            "INSERT INTO resources (id, path, type, collection, title)
             VALUES ('res-bib', ?, 'bibliography', 'refs', 'refs.bib'),
                    ('res-tex', ?, 'file', 'refs', 'file.tex')",
        )
        .bind(bib_path.to_string_lossy().to_string())
        .bind(tex_path.to_string_lossy().to_string())
        .execute(&pool)
        .await
        .expect("resources");

        reparse_bibliography_resource(&pool, "res-bib")
            .await
            .expect("import bibliography");
        let result = scan_resource_citations(&pool, "res-tex")
            .await
            .expect("scan citations");

        assert_eq!(result.total, 3);
        assert_eq!(result.resolved, 2);
        assert_eq!(result.missing, 1);
        assert_eq!(result.ambiguous, 0);
        assert!(result
            .occurrences
            .iter()
            .any(|occurrence| occurrence.citation_key == "known"
                && occurrence.scan_status == "resolved"));
        assert!(result
            .occurrences
            .iter()
            .any(|occurrence| occurrence.citation_key == "missing"
                && occurrence.scan_status == "missing"));
        assert!(!result
            .occurrences
            .iter()
            .any(|occurrence| occurrence.citation_key == "commented"));

        let resolved_keys = resolve_citation_keys(
            &pool,
            Some("res-tex"),
            vec!["known".to_string(), "missing".to_string()],
        )
        .await
        .expect("resolve citation keys");
        assert!(resolved_keys.iter().any(|resolution| {
            resolution.citation_key == "known" && resolution.scan_status == "resolved"
        }));
        assert!(resolved_keys.iter().any(|resolution| {
            resolution.citation_key == "missing" && resolution.scan_status == "missing"
        }));

        let stored_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM citation_occurrences WHERE resource_id = 'res-tex'",
        )
        .fetch_one(&pool)
        .await
        .expect("stored occurrences");
        assert_eq!(stored_count.0, 3);

        let known_entry_id = result
            .occurrences
            .iter()
            .find(|occurrence| occurrence.citation_key == "known")
            .and_then(|occurrence| occurrence.entry_id.clone())
            .expect("known citation entry id");
        let graph = bibliography_citation_graph(&pool, &known_entry_id, 20)
            .await
            .expect("citation graph");
        assert_eq!(graph.resource_count, 1);
        assert_eq!(graph.occurrence_count, 1);
        assert_eq!(graph.used_by[0].resource_id, "res-tex");
        assert_eq!(graph.used_by[0].commands, vec!["cite"]);
        assert!(graph
            .related_entries
            .iter()
            .any(|entry| entry.citation_key == "other"
                && entry.resource_count == 1
                && entry.occurrence_count == 1));

        let _ = fs::remove_file(bib_path);
        let _ = fs::remove_file(tex_path);
    }

    #[tokio::test]
    async fn linked_sources_scope_citation_resolution() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("in-memory database");
        DatabaseManager::init_schema(&pool).await.expect("schema");

        let first_bib_path = temp_bib_path("datatex-first-source.bib");
        let second_bib_path = temp_bib_path("datatex-second-source.bib");
        let tex_path = temp_bib_path("datatex-scoped-citation.tex");
        fs::write(
            &first_bib_path,
            "@article{globalOnly,title={Global Only},year={2024}}\n\
@article{duplicateA,title={Shared Title},year={2024},doi={10.1/shared}}\n\
@misc{missingMeta,note={Needs cleanup}}\n",
        )
        .expect("write first bib");
        fs::write(
            &second_bib_path,
            "@article{scopedOnly,title={Scoped Only},year={2026}}\n\
@book{duplicateB,title={Shared Title},year={2024},doi={10.1/shared}}\n",
        )
        .expect("write second bib");
        fs::write(&tex_path, r#"\cite{globalOnly, scopedOnly}"#).expect("write tex");

        sqlx::query("INSERT INTO collections (name, type) VALUES ('refs', 'bibliography')")
            .execute(&pool)
            .await
            .expect("collection");
        sqlx::query(
            "INSERT INTO resources (id, path, type, collection, title)
             VALUES ('first-bib', ?, 'bibliography', 'refs', 'first.bib'),
                    ('second-bib', ?, 'bibliography', 'refs', 'second.bib'),
                    ('tex-res', ?, 'file', 'refs', 'file.tex')",
        )
        .bind(first_bib_path.to_string_lossy().to_string())
        .bind(second_bib_path.to_string_lossy().to_string())
        .bind(tex_path.to_string_lossy().to_string())
        .execute(&pool)
        .await
        .expect("resources");

        let first = reparse_bibliography_resource(&pool, "first-bib")
            .await
            .expect("import first bibliography");
        let second = reparse_bibliography_resource(&pool, "second-bib")
            .await
            .expect("import second bibliography");

        let unscoped = scan_resource_citations(&pool, "tex-res")
            .await
            .expect("unscoped scan");
        assert_eq!(unscoped.linked_source_count, 0);
        assert_eq!(unscoped.resolved, 2);

        link_bibliography_source(&pool, "tex-res", &second.source.id)
            .await
            .expect("link second source");
        let linked = list_linked_bibliography_sources(&pool, "tex-res")
            .await
            .expect("linked sources");
        assert_eq!(linked.len(), 1);
        assert_eq!(linked[0].id, second.source.id);

        let scoped_suggestions = search_bibliography_entries(&pool, Some("tex-res"), "", 20)
            .await
            .expect("scoped suggestions");
        let scoped_keys: Vec<&str> = scoped_suggestions
            .iter()
            .map(|entry| entry.citation_key.as_str())
            .collect();
        assert!(scoped_keys.contains(&"scopedOnly"));
        assert!(scoped_keys.contains(&"duplicateB"));
        assert!(!scoped_keys.contains(&"globalOnly"));

        let excluded_suggestions =
            search_bibliography_entries(&pool, Some("tex-res"), "global", 20)
                .await
                .expect("excluded suggestions");
        assert!(excluded_suggestions.is_empty());

        let scoped_resolutions = resolve_citation_keys(
            &pool,
            Some("tex-res"),
            vec!["globalOnly".to_string(), "scopedOnly".to_string()],
        )
        .await
        .expect("scoped key resolutions");
        assert!(scoped_resolutions.iter().any(|resolution| {
            resolution.citation_key == "globalOnly" && resolution.scan_status == "missing"
        }));
        assert!(scoped_resolutions.iter().any(|resolution| {
            resolution.citation_key == "scopedOnly" && resolution.scan_status == "resolved"
        }));

        let scoped = scan_resource_citations(&pool, "tex-res")
            .await
            .expect("scoped scan");
        assert_eq!(scoped.linked_source_count, 1);
        assert_eq!(scoped.resolved, 1);
        assert_eq!(scoped.missing, 1);
        assert!(scoped
            .occurrences
            .iter()
            .any(|occurrence| occurrence.citation_key == "globalOnly"
                && occurrence.scan_status == "missing"));
        assert!(scoped
            .occurrences
            .iter()
            .any(|occurrence| occurrence.citation_key == "scopedOnly"
                && occurrence.scan_status == "resolved"));

        unlink_bibliography_source(&pool, "tex-res", &second.source.id)
            .await
            .expect("unlink second source");
        let relinked = list_linked_bibliography_sources(&pool, "tex-res")
            .await
            .expect("linked sources after unlink");
        assert!(relinked.is_empty());

        let fallback_suggestions = search_bibliography_entries(&pool, Some("tex-res"), "", 20)
            .await
            .expect("fallback suggestions");
        let fallback_keys: Vec<&str> = fallback_suggestions
            .iter()
            .map(|entry| entry.citation_key.as_str())
            .collect();
        assert!(fallback_keys.contains(&"globalOnly"));
        assert!(fallback_keys.contains(&"scopedOnly"));

        let all_sources = list_all_bibliography_sources(&pool)
            .await
            .expect("all sources");
        assert_eq!(all_sources.len(), 2);
        assert!(all_sources
            .iter()
            .any(|source| source.id == first.source.id));
        assert!(all_sources
            .iter()
            .any(|source| source.id == second.source.id));

        let workspace_entries = list_workspace_bibliography_entries(
            &pool,
            Some(&first.source.id),
            "",
            None,
            None,
            None,
            20,
        )
        .await
        .expect("workspace source filter");
        assert!(workspace_entries
            .iter()
            .any(|entry| entry.citation_key == "globalOnly"));
        assert!(workspace_entries
            .iter()
            .any(|entry| entry.citation_key == "duplicateA"));
        assert!(!workspace_entries
            .iter()
            .any(|entry| entry.citation_key == "scopedOnly"));

        let workspace_author_search =
            list_workspace_bibliography_entries(&pool, None, "scoped", None, None, None, 20)
                .await
                .expect("workspace search");
        assert!(workspace_author_search
            .iter()
            .any(|entry| entry.citation_key == "scopedOnly"));

        let workspace_books =
            list_workspace_bibliography_entries(&pool, None, "", Some("book"), None, None, 20)
                .await
                .expect("workspace type filter");
        assert_eq!(workspace_books.len(), 1);
        assert_eq!(workspace_books[0].citation_key, "duplicateB");

        let missing_metadata = list_workspace_bibliography_entries(
            &pool,
            None,
            "",
            None,
            Some("missing_metadata"),
            None,
            20,
        )
        .await
        .expect("missing metadata smart view");
        assert!(missing_metadata
            .iter()
            .any(|entry| entry.citation_key == "missingMeta"));

        let duplicate_candidates = list_workspace_bibliography_entries(
            &pool,
            None,
            "",
            None,
            Some("duplicate_candidates"),
            None,
            20,
        )
        .await
        .expect("duplicate candidates smart view");
        let duplicate_keys: Vec<&str> = duplicate_candidates
            .iter()
            .map(|entry| entry.citation_key.as_str())
            .collect();
        assert!(duplicate_keys.contains(&"duplicateA"));
        assert!(duplicate_keys.contains(&"duplicateB"));

        let _ = fs::remove_file(first_bib_path);
        let _ = fs::remove_file(second_bib_path);
        let _ = fs::remove_file(tex_path);
    }

    #[tokio::test]
    async fn auto_links_declared_bibliography_sources_from_latex() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("in-memory database");
        DatabaseManager::init_schema(&pool).await.expect("schema");

        let temp_dir =
            std::env::temp_dir().join(format!("datatex-bib-autolink-{}", Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).expect("temp dir");
        let first_bib_path = temp_dir.join("first_refs.bib");
        let second_bib_path = temp_dir.join("second_refs.bib");
        let ignored_bib_path = temp_dir.join("ignored_refs.bib");
        let tex_path = temp_dir.join("main.tex");
        fs::write(
            &first_bib_path,
            "@article{first,title={First},year={2026}}\n",
        )
        .expect("write first bib");
        fs::write(
            &second_bib_path,
            "@article{second,title={Second},year={2025}}\n",
        )
        .expect("write second bib");
        fs::write(
            &ignored_bib_path,
            "@article{ignored,title={Ignored},year={2024}}\n",
        )
        .expect("write ignored bib");
        fs::write(
            &tex_path,
            r#"\bibliography{first_refs}
\addbibresource{second_refs.bib}
% \addbibresource{ignored_refs.bib}
\cite{first,second,ignored}
"#,
        )
        .expect("write tex");

        sqlx::query("INSERT INTO collections (name, type) VALUES ('refs', 'bibliography')")
            .execute(&pool)
            .await
            .expect("collection");
        sqlx::query(
            "INSERT INTO resources (id, path, type, collection, title)
             VALUES ('first-bib', ?, 'bibliography', 'refs', 'first_refs.bib'),
                    ('second-bib', ?, 'bibliography', 'refs', 'second_refs.bib'),
                    ('ignored-bib', ?, 'bibliography', 'refs', 'ignored_refs.bib'),
                    ('tex-res', ?, 'file', 'refs', 'main.tex')",
        )
        .bind(first_bib_path.to_string_lossy().to_string())
        .bind(second_bib_path.to_string_lossy().to_string())
        .bind(ignored_bib_path.to_string_lossy().to_string())
        .bind(tex_path.to_string_lossy().to_string())
        .execute(&pool)
        .await
        .expect("resources");

        reparse_bibliography_resource(&pool, "first-bib")
            .await
            .expect("import first bibliography");
        reparse_bibliography_resource(&pool, "second-bib")
            .await
            .expect("import second bibliography");
        reparse_bibliography_resource(&pool, "ignored-bib")
            .await
            .expect("import ignored bibliography");

        let declarations = detect_bibliography_declarations(&pool, "tex-res")
            .await
            .expect("detect declarations");
        assert_eq!(declarations.len(), 2);
        assert!(declarations
            .iter()
            .all(|declaration| declaration.matches.len() == 1));

        let result = auto_link_declared_bibliography_sources(&pool, "tex-res")
            .await
            .expect("auto link declarations");
        assert_eq!(result.linked_count, 2);
        assert_eq!(result.unresolved_count, 0);
        assert_eq!(result.ambiguous_count, 0);

        let linked = list_linked_bibliography_sources(&pool, "tex-res")
            .await
            .expect("linked sources");
        assert_eq!(linked.len(), 2);
        assert!(linked
            .iter()
            .any(|source| source.path.ends_with("first_refs.bib")));
        assert!(linked
            .iter()
            .any(|source| source.path.ends_with("second_refs.bib")));

        let scan = scan_resource_citations(&pool, "tex-res")
            .await
            .expect("scoped scan");
        assert_eq!(scan.linked_source_count, 2);
        assert_eq!(scan.resolved, 2);
        assert_eq!(scan.missing, 1);

        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn citation_scanner_handles_common_commands_and_comments() {
        let drafts = scan_latex_citations(
            r#"\cite{a,b}
\textcite[see][42]{c}
\Citeauthor{d}
Escaped percent \% \cite{e}
% \cite{ignored}
"#,
        );
        let keys: Vec<&str> = drafts
            .iter()
            .map(|draft| draft.citation_key.as_str())
            .collect();

        assert_eq!(keys, vec!["a", "b", "c", "d", "e"]);
    }

    fn temp_bib_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("{}-{}", Uuid::new_v4(), name))
    }
}
