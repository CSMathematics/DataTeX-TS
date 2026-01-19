//! Local File History Module
//!
//! Provides automatic versioning of files with snapshot, diff, and restore capabilities.

use sha2::{Digest, Sha256};
use similar::{ChangeTag, TextDiff};
use sqlx::{Pool, Row, Sqlite};
use uuid::Uuid;

/// Represents a single history entry for a file
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub file_path: String,
    pub content_hash: String,
    pub created_at: String,
    pub summary: Option<String>,
    pub is_manual_snapshot: bool,
}

/// Represents the result of a diff operation
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DiffResult {
    pub old_content: String,
    pub new_content: String,
    pub changes: Vec<DiffChange>,
    pub stats: DiffStats,
}

/// Represents a single change in a diff
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DiffChange {
    pub tag: String, // "equal", "delete", "insert"
    pub old_start: Option<usize>,
    pub old_end: Option<usize>,
    pub new_start: Option<usize>,
    pub new_end: Option<usize>,
    pub content: String,
}

/// Statistics for a diff
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DiffStats {
    pub additions: usize,
    pub deletions: usize,
    pub unchanged: usize,
}

/// Calculate SHA256 hash of content
pub fn hash_content(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Save a snapshot of file content to history
pub async fn save_snapshot(
    pool: &Pool<Sqlite>,
    file_path: &str,
    content: &str,
    summary: Option<&str>,
    is_manual: bool,
) -> Result<String, String> {
    let content_hash = hash_content(content);

    // Check if the last snapshot has the same hash (avoid duplicate snapshots)
    let last_hash: Option<String> = sqlx::query_scalar(
        "SELECT content_hash FROM file_history WHERE file_path = ? ORDER BY created_at DESC LIMIT 1"
    )
    .bind(file_path)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    if let Some(last) = last_hash {
        if last == content_hash && !is_manual {
            return Ok("no_change".to_string());
        }
    }

    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO file_history (id, file_path, content, content_hash, summary, is_manual_snapshot) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(file_path)
    .bind(content)
    .bind(&content_hash)
    .bind(summary)
    .bind(if is_manual { 1 } else { 0 })
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(id)
}

/// Get history entries for a file (without content for performance)
pub async fn get_file_history(
    pool: &Pool<Sqlite>,
    file_path: &str,
    limit: Option<i32>,
) -> Result<Vec<HistoryEntry>, String> {
    let limit = limit.unwrap_or(50);

    let rows = sqlx::query(
        "SELECT id, file_path, content_hash, created_at, summary, is_manual_snapshot
         FROM file_history
         WHERE file_path = ?
         ORDER BY created_at DESC
         LIMIT ?",
    )
    .bind(file_path)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let entries = rows
        .iter()
        .map(|row| HistoryEntry {
            id: row.get("id"),
            file_path: row.get("file_path"),
            content_hash: row.get("content_hash"),
            created_at: row.get("created_at"),
            summary: row.get("summary"),
            is_manual_snapshot: row.get::<i32, _>("is_manual_snapshot") == 1,
        })
        .collect();

    Ok(entries)
}

/// Get the content of a specific snapshot
pub async fn get_snapshot_content(
    pool: &Pool<Sqlite>,
    snapshot_id: &str,
) -> Result<String, String> {
    let content: String = sqlx::query_scalar("SELECT content FROM file_history WHERE id = ?")
        .bind(snapshot_id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(content)
}

/// Restore a file to a specific snapshot (returns the content)
pub async fn get_restore_content(
    pool: &Pool<Sqlite>,
    snapshot_id: &str,
) -> Result<(String, String), String> {
    let row = sqlx::query("SELECT file_path, content FROM file_history WHERE id = ?")
        .bind(snapshot_id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    let file_path: String = row.get("file_path");
    let content: String = row.get("content");

    Ok((file_path, content))
}

/// Generate diff between two snapshots or between snapshot and current content
pub fn generate_diff(old_content: &str, new_content: &str) -> DiffResult {
    let diff = TextDiff::from_lines(old_content, new_content);

    let mut changes = Vec::new();
    let mut additions = 0;
    let mut deletions = 0;
    let mut unchanged = 0;

    for change in diff.iter_all_changes() {
        let tag = match change.tag() {
            ChangeTag::Equal => {
                unchanged += 1;
                "equal"
            }
            ChangeTag::Delete => {
                deletions += 1;
                "delete"
            }
            ChangeTag::Insert => {
                additions += 1;
                "insert"
            }
        };

        changes.push(DiffChange {
            tag: tag.to_string(),
            old_start: change.old_index(),
            old_end: change.old_index().map(|i| i + 1),
            new_start: change.new_index(),
            new_end: change.new_index().map(|i| i + 1),
            content: change.value().to_string(),
        });
    }

    DiffResult {
        old_content: old_content.to_string(),
        new_content: new_content.to_string(),
        changes,
        stats: DiffStats {
            additions,
            deletions,
            unchanged,
        },
    }
}

/// Generate diff between two snapshots
pub async fn diff_snapshots(
    pool: &Pool<Sqlite>,
    old_id: &str,
    new_id: &str,
) -> Result<DiffResult, String> {
    let old_content = get_snapshot_content(pool, old_id).await?;
    let new_content = get_snapshot_content(pool, new_id).await?;

    Ok(generate_diff(&old_content, &new_content))
}

/// Diff between a snapshot and current content
pub fn diff_with_current(snapshot_content: &str, current_content: &str) -> DiffResult {
    generate_diff(snapshot_content, current_content)
}

/// Delete a specific snapshot
pub async fn delete_snapshot(pool: &Pool<Sqlite>, snapshot_id: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM file_history WHERE id = ?")
        .bind(snapshot_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Cleanup old snapshots (keep last N or from last N days)
pub async fn cleanup_old_snapshots(
    pool: &Pool<Sqlite>,
    file_path: &str,
    keep_count: i32,
) -> Result<usize, String> {
    // Get IDs to keep (most recent + all manual snapshots)
    let result = sqlx::query(
        "DELETE FROM file_history
         WHERE file_path = ?
         AND is_manual_snapshot = 0
         AND id NOT IN (
             SELECT id FROM file_history
             WHERE file_path = ?
             ORDER BY created_at DESC
             LIMIT ?
         )",
    )
    .bind(file_path)
    .bind(file_path)
    .bind(keep_count)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(result.rows_affected() as usize)
}
