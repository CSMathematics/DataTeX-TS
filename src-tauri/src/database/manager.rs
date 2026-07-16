use crate::database::entities::{Collection, Resource};
use sqlx::{migrate::MigrateDatabase, sqlite::SqlitePoolOptions, Pool, Row, Sqlite};

pub struct DatabaseManager {
    pub pool: Pool<Sqlite>,
    pub path: String,
}

impl DatabaseManager {
    pub async fn new(data_dir: &str) -> Result<Self, sqlx::Error> {
        let db_path = format!("{}/project.db", data_dir);
        let db_url = format!("sqlite://{}", db_path);

        if !Sqlite::database_exists(&db_url).await.unwrap_or(false) {
            Sqlite::create_database(&db_url).await?;
        }

        let pool = SqlitePoolOptions::new().connect(&db_url).await?;

        // Initialize schema
        Self::init_schema(&pool).await?;

        Ok(Self {
            pool,
            path: db_path,
        })
    }

    async fn init_schema(pool: &Pool<Sqlite>) -> Result<(), sqlx::Error> {
        // Load all schema files in numeric order
        // New migrations should be added at the end with incrementing numbers
        let schemas = [
            include_str!("../../migrations/init.sql"), // 0
            include_str!("../../migrations/002_common_infrastructure.sql"), // 1
            include_str!("../../migrations/003_resource_files.sql"), // 2
            include_str!("../../migrations/004_resource_documents.sql"), // 3
            include_str!("../../migrations/005_resource_tables.sql"), // 4
            include_str!("../../migrations/006_resource_figures.sql"), // 5
            include_str!("../../migrations/007_resource_commands.sql"), // 6
            include_str!("../../migrations/008_resource_packages.sql"), // 7
            include_str!("../../migrations/009_resource_preambles.sql"), // 8
            include_str!("../../migrations/010_resource_classes.sql"), // 9
            include_str!("../../migrations/012_resource_bibliographies.sql"), // 11
            include_str!("../../migrations/013_resource_dtx_ins.sql"), // 12
            include_str!("../../migrations/014_json_metadata_backfill.sql"), // 13
        ];

        // `user_version` is the number of successfully applied entries in `schemas`.
        // A legacy database may legitimately contain tables while still reporting 0;
        // all migrations are idempotent, so replaying them is safer than guessing a
        // version and silently skipping schema changes.
        let version_row: (i64,) = sqlx::query_as("PRAGMA user_version")
            .fetch_one(pool)
            .await?;
        let stored_version = version_row.0.max(0) as usize;
        // Older releases used exactly 20 as a sentinel for an unversioned
        // legacy DB. Other versions beyond this binary's schema are rejected:
        // silently downgrading a genuinely newer database could corrupt it.
        let current_version = match stored_version {
            20 => 0,
            version if version > schemas.len() => {
                return Err(sqlx::Error::InvalidArgument(format!(
                    "Database schema version {} is newer than supported version {}",
                    version,
                    schemas.len()
                )))
            }
            version => version,
        };

        for (i, init_script) in schemas.iter().enumerate() {
            if i < current_version {
                continue;
            }

            println!("Applying migration {}...", i + 1);
            Self::apply_migration(pool, i + 1, init_script).await?;
        }
        Ok(())
    }

    /// Apply a complete migration and its version marker atomically.
    ///
    /// If any statement fails, dropping the transaction rolls back both
    /// schema/data changes and `user_version`.
    async fn apply_migration(
        pool: &Pool<Sqlite>,
        new_version: usize,
        script: &'static str,
    ) -> Result<(), sqlx::Error> {
        let statements = Self::migration_statements(script);
        let mut transaction = pool.begin().await?;
        for statement in statements {
            sqlx::query(&statement).execute(&mut *transaction).await?;
        }
        sqlx::query(&format!("PRAGMA user_version = {new_version}"))
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await
    }

    /// Split a migration into top-level statements while keeping trigger bodies
    /// together. The migration files use standalone `BEGIN`/`END;` lines for all
    /// triggers, so semicolons inside those blocks must not terminate a statement.
    fn migration_statements(script: &str) -> Vec<String> {
        let mut statements = Vec::new();
        let mut current = String::new();
        let mut trigger_depth = 0_u32;

        for line in script.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with("--") {
                continue;
            }

            current.push_str(line);
            current.push('\n');

            match trimmed.to_ascii_uppercase().as_str() {
                "BEGIN" => trigger_depth += 1,
                "END;" => trigger_depth = trigger_depth.saturating_sub(1),
                _ => {}
            }

            if trigger_depth == 0 && trimmed.ends_with(';') {
                statements.push(std::mem::take(&mut current));
            }
        }

        if !current.trim().is_empty() {
            statements.push(current);
        }

        statements
    }

    // --- New Methods ---

    pub async fn get_collections(&self) -> Result<Vec<Collection>, String> {
        sqlx::query_as::<_, Collection>("SELECT * FROM collections")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_resources_by_collection(
        &self,
        collection: &str,
    ) -> Result<Vec<Resource>, String> {
        sqlx::query_as::<_, Resource>("SELECT * FROM resources WHERE collection = ?")
            .bind(collection)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| e.to_string())
    }

    /// Batch fetch resources for multiple collections in a single query
    /// More efficient than calling get_resources_by_collection multiple times
    pub async fn get_resources_by_collections(
        &self,
        collections: &[String],
    ) -> Result<Vec<Resource>, String> {
        if collections.is_empty() {
            return Ok(Vec::new());
        }

        // Build parameterized query with IN clause
        let placeholders: Vec<&str> = collections.iter().map(|_| "?").collect();
        let query = format!(
            "SELECT * FROM resources WHERE collection IN ({})",
            placeholders.join(", ")
        );

        let mut q = sqlx::query_as::<_, Resource>(&query);
        for collection in collections {
            q = q.bind(collection);
        }

        q.fetch_all(&self.pool).await.map_err(|e| e.to_string())
    }

    pub async fn create_collection(&self, collection: &Collection) -> Result<(), String> {
        sqlx::query(
            "INSERT OR IGNORE INTO collections (name, description, icon, type, path) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&collection.name)
        .bind(&collection.description)
        .bind(&collection.icon)
        .bind(&collection.kind)
        .bind(&collection.path)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn add_resource(&self, resource: &Resource) -> Result<(), String> {
        // Serialize metadata to JSON string
        let meta_str = serde_json::to_string(&resource.metadata).unwrap_or("{}".to_string());

        sqlx::query(
            "INSERT INTO resources (id, path, type, collection, title, content_hash, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                 path = excluded.path,
                 type = excluded.type,
                 collection = excluded.collection,
                 title = excluded.title,
                 content_hash = excluded.content_hash,
                 metadata = excluded.metadata",
        )
        .bind(&resource.id)
        .bind(&resource.path)
        .bind(&resource.kind)
        .bind(&resource.collection)
        .bind(&resource.title)
        .bind(&resource.content_hash)
        .bind(&meta_str)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn validate_identifier(&self, table: &str, column: Option<&str>) -> bool {
        let is_valid_name = |s: &str| s.chars().all(|c| c.is_ascii_alphanumeric() || c == '_');
        if !is_valid_name(table) {
            return false;
        }
        if let Some(col) = column {
            if !is_valid_name(col) {
                return false;
            }
        }
        true
    }

    pub async fn get_table_data(
        &self,
        table_name: String,
        page: i64,
        page_size: i64,
        search: String,
        search_cols: Vec<String>,
    ) -> Result<(Vec<serde_json::Value>, i64, Vec<String>), String> {
        if !self.validate_identifier(&table_name, None).await {
            return Err("Invalid table name".to_string());
        }

        // 1. Get Schema (Columns)
        let schema_query = format!("PRAGMA table_info({})", table_name);
        let schema_rows = sqlx::query(&schema_query)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        let columns: Vec<String> = schema_rows.iter().map(|r| r.get("name")).collect();

        // 2. Build Where Clause
        let mut where_clause = String::new();
        let mut params: Vec<String> = Vec::new();

        if !search.is_empty() && !search_cols.is_empty() {
            let conditions: Vec<String> = search_cols
                .iter()
                .filter(|c| columns.contains(c))
                .map(|c| format!("{} LIKE ?", c))
                .collect();

            if !conditions.is_empty() {
                where_clause = format!("WHERE {}", conditions.join(" OR "));
                for _ in 0..conditions.len() {
                    params.push(format!("%{}%", search));
                }
            }
        }

        // 3. Count Query
        let count_query = format!(
            "SELECT COUNT(*) as count FROM {} {}",
            table_name, where_clause
        );
        let mut count_q = sqlx::query(&count_query);
        for p in &params {
            count_q = count_q.bind(p);
        }
        let count_row = count_q
            .fetch_one(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        let total_count: i64 = count_row.get("count");

        // 4. Data Query
        let offset = (page - 1) * page_size;
        let data_query = format!(
            "SELECT * FROM {} {} LIMIT ? OFFSET ?",
            table_name, where_clause
        );

        let mut data_q = sqlx::query(&data_query);
        for p in &params {
            data_q = data_q.bind(p);
        }
        data_q = data_q.bind(page_size).bind(offset);

        let rows = data_q
            .fetch_all(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        // 5. Convert to JSON
        let mut result_data = Vec::new();
        for row in rows {
            let mut map = serde_json::Map::new();
            for col in &columns {
                let val_res: Result<String, _> = row.try_get(col.as_str());
                if let Ok(v) = val_res {
                    map.insert(col.clone(), serde_json::Value::String(v));
                } else {
                    let int_res: Result<i64, _> = row.try_get(col.as_str());
                    if let Ok(v) = int_res {
                        map.insert(col.clone(), serde_json::Value::Number(v.into()));
                    } else {
                        map.insert(col.clone(), serde_json::Value::Null);
                    }
                }
            }
            result_data.push(serde_json::Value::Object(map));
        }

        Ok((result_data, total_count, columns))
    }

    pub async fn update_cell(
        &self,
        table_name: String,
        id: String,
        column: String,
        value: String,
    ) -> Result<(), String> {
        if !self.validate_identifier(&table_name, Some(&column)).await {
            return Err("Invalid table or column name".to_string());
        }

        let query = format!("UPDATE {} SET {} = ? WHERE id = ?", table_name, column);
        sqlx::query(&query)
            .bind(value)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn delete_collection(&self, collection_name: &str) -> Result<(), String> {
        // First, delete all resources associated with this collection
        sqlx::query("DELETE FROM resources WHERE collection = ?")
            .bind(collection_name)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        // Then, delete the collection itself
        sqlx::query("DELETE FROM collections WHERE name = ?")
            .bind(collection_name)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn delete_resource(&self, id: &str) -> Result<(), String> {
        sqlx::query("DELETE FROM resources WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    // --- Dependency Management ---

    pub async fn add_dependency(
        &self,
        source_id: &str,
        target_id: &str,
        relation_type: &str,
    ) -> Result<(), String> {
        sqlx::query("INSERT OR REPLACE INTO dependencies (source_id, target_id, relation_type) VALUES (?, ?, ?)")
            .bind(source_id)
            .bind(target_id)
            .bind(relation_type)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_dependencies(
        &self,
        source_id: &str,
        relation_type: Option<&str>,
    ) -> Result<Vec<Resource>, String> {
        let query = if relation_type.is_some() {
            "SELECT r.* FROM resources r
             JOIN dependencies d ON r.id = d.target_id
             WHERE d.source_id = ? AND d.relation_type = ?"
        } else {
            "SELECT r.* FROM resources r
             JOIN dependencies d ON r.id = d.target_id
             WHERE d.source_id = ?"
        };

        let mut q = sqlx::query_as::<_, Resource>(query).bind(source_id);

        if let Some(rt) = relation_type {
            q = q.bind(rt);
        }

        q.fetch_all(&self.pool).await.map_err(|e| e.to_string())
    }

    pub async fn get_resource_by_id(&self, id: &str) -> Result<Option<Resource>, String> {
        let r = sqlx::query_as::<_, Resource>("SELECT * FROM resources WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(r)
    }

    pub async fn get_all_dependencies(&self) -> Result<Vec<(String, String, String)>, String> {
        let rows = sqlx::query("SELECT source_id, target_id, relation_type FROM dependencies")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        let mut results = Vec::new();
        for row in rows {
            let source: String = row.try_get("source_id").unwrap_or_default();
            let target: String = row.try_get("target_id").unwrap_or_default();
            let relation: String = row.try_get("relation_type").unwrap_or_default();
            results.push((source, target, relation));
        }
        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    async fn in_memory_pool() -> Pool<Sqlite> {
        SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("in-memory SQLite pool")
    }

    async fn user_version(pool: &Pool<Sqlite>) -> i64 {
        sqlx::query_as::<_, (i64,)>("PRAGMA user_version")
            .fetch_one(pool)
            .await
            .expect("read user_version")
            .0
    }

    #[tokio::test]
    async fn fresh_database_applies_all_migrations() {
        let pool = in_memory_pool().await;

        DatabaseManager::init_schema(&pool)
            .await
            .expect("fresh schema should initialize");

        assert_eq!(user_version(&pool).await, 13);
        for table in [
            "resources",
            "resource_files",
            "resource_documents",
            "resource_bibliographies",
            "resource_dtx",
            "resource_ins",
        ] {
            let count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
            )
            .bind(table)
            .fetch_one(&pool)
            .await
            .expect("inspect schema");
            assert_eq!(count.0, 1, "missing table {table}");
        }
    }

    #[tokio::test]
    async fn failed_migration_rolls_back_schema_and_version() {
        let pool = in_memory_pool().await;
        let invalid_script = "
            CREATE TABLE should_be_rolled_back (id INTEGER PRIMARY KEY);
            INSERT INTO table_that_does_not_exist (id) VALUES (1);
        ";

        assert!(DatabaseManager::apply_migration(&pool, 1, invalid_script)
            .await
            .is_err());
        assert_eq!(user_version(&pool).await, 0);

        let table_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'should_be_rolled_back'",
        )
        .fetch_one(&pool)
        .await
        .expect("inspect rolled-back schema");
        assert_eq!(table_count.0, 0);
    }

    #[tokio::test]
    async fn legacy_zero_version_is_replayed_without_losing_data() {
        let pool = in_memory_pool().await;
        DatabaseManager::init_schema(&pool)
            .await
            .expect("initial schema");
        sqlx::query(
            "INSERT INTO collections (name, type) VALUES ('legacy', 'files');
             INSERT INTO resources (id, path, type, collection, title)
             VALUES ('legacy-resource', '/legacy.tex', 'file', 'legacy', 'Keep me');",
        )
        .execute(&pool)
        .await
        .expect("seed legacy data");
        sqlx::query("PRAGMA user_version = 0")
            .execute(&pool)
            .await
            .expect("simulate unversioned legacy database");

        DatabaseManager::init_schema(&pool)
            .await
            .expect("idempotent replay should succeed");

        assert_eq!(user_version(&pool).await, 13);
        let title: (String,) =
            sqlx::query_as("SELECT title FROM resources WHERE id = 'legacy-resource'")
                .fetch_one(&pool)
                .await
                .expect("legacy resource should survive");
        assert_eq!(title.0, "Keep me");
    }

    #[tokio::test]
    async fn legacy_version_twenty_sentinel_is_replayed() {
        let pool = in_memory_pool().await;
        DatabaseManager::init_schema(&pool)
            .await
            .expect("initial schema");
        sqlx::query("PRAGMA user_version = 20")
            .execute(&pool)
            .await
            .expect("simulate legacy sentinel");

        DatabaseManager::init_schema(&pool)
            .await
            .expect("legacy sentinel should replay safely");

        assert_eq!(user_version(&pool).await, 13);
    }

    #[tokio::test]
    async fn unknown_future_version_is_not_downgraded() {
        let pool = in_memory_pool().await;
        DatabaseManager::init_schema(&pool)
            .await
            .expect("initial schema");
        sqlx::query("PRAGMA user_version = 14")
            .execute(&pool)
            .await
            .expect("simulate newer application schema");

        let error = DatabaseManager::init_schema(&pool)
            .await
            .expect_err("newer schema must be rejected");

        assert!(error.to_string().contains("newer than supported"));
        assert_eq!(user_version(&pool).await, 14);
    }

    #[tokio::test]
    async fn resource_upsert_preserves_typed_child_rows() {
        let pool = in_memory_pool().await;
        DatabaseManager::init_schema(&pool)
            .await
            .expect("initial schema");
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await
            .expect("enable foreign keys");
        sqlx::query("INSERT INTO collections (name, type) VALUES ('library', 'files')")
            .execute(&pool)
            .await
            .expect("collection");

        let manager = DatabaseManager {
            pool: pool.clone(),
            path: String::new(),
        };
        let original = Resource {
            id: "resource-1".into(),
            path: "/resource.tex".into(),
            kind: "file".into(),
            collection: "library".into(),
            title: Some("Original".into()),
            content_hash: Some("one".into()),
            metadata: Some(json!({"revision": 1})),
            created_at: None,
            updated_at: None,
        };
        manager
            .add_resource(&original)
            .await
            .expect("insert resource");
        sqlx::query(
            "INSERT INTO resource_files (resource_id, file_description)
             VALUES ('resource-1', 'typed metadata')",
        )
        .execute(&pool)
        .await
        .expect("typed child");

        let updated = Resource {
            title: Some("Updated".into()),
            content_hash: Some("two".into()),
            metadata: Some(json!({"revision": 2})),
            ..original
        };
        manager
            .add_resource(&updated)
            .await
            .expect("update resource");

        let child_count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM resource_files WHERE resource_id = 'resource-1'")
                .fetch_one(&pool)
                .await
                .expect("typed child count");
        assert_eq!(child_count.0, 1);
    }

    #[tokio::test]
    async fn json_backfill_is_safe_idempotent_and_preserves_existing_typed_rows() {
        let pool = in_memory_pool().await;
        DatabaseManager::init_schema(&pool)
            .await
            .expect("initial schema");
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await
            .expect("enable foreign keys");

        sqlx::query(
            "INSERT INTO collections (name, type) VALUES ('legacy', 'files');
             INSERT INTO chapters (id, name, field_id, collection)
             VALUES ('chapter-1', 'Chapter', 'algebra', 'legacy');
             INSERT INTO sections (id, name, chapter_id, collection)
             VALUES ('section-1', 'Section', 'chapter-1', 'legacy');
             INSERT INTO subsections (id, name, section_id, collection)
             VALUES ('subsection-1', 'Subsection', 'section-1', 'legacy');
             INSERT INTO texlive_packages (id, description)
             VALUES ('amsmath', 'Math package');",
        )
        .execute(&pool)
        .await
        .expect("seed lookup data");

        let resources = [
            (
                "existing-file",
                "file",
                Some("Existing"),
                r#"{"fileDescription":"must not replace typed data"}"#,
            ),
            (
                "legacy-file",
                "file",
                Some("Legacy file"),
                r#"{
                    "fileType":"missing-file-type",
                    "field":"algebra",
                    "difficulty":99,
                    "solutionId":"missing-resource",
                    "preambleId":"missing-resource",
                    "fileDescription":"backfilled",
                    "chapters":["chapter-1","missing-chapter"],
                    "sections":["section-1","missing-section"],
                    "subsections":["subsection-1","missing-subsection"],
                    "exerciseTypes":["proof","missing-exercise-type"],
                    "requiredPackages":["amsmath","missing-package"]
                }"#,
            ),
            (
                "legacy-document",
                "document",
                Some("Legacy document"),
                r#"{
                    "documentType":"article",
                    "field":"algebra",
                    "basicFolder":"obsolete",
                    "chapters":["chapter-1"]
                }"#,
            ),
            (
                "legacy-table",
                "table",
                None,
                r#"{"tableType":"general","rows":2,"columns":3}"#,
            ),
            ("legacy-figure", "figure", None, r#"{"figureType":"image"}"#),
            (
                "legacy-command",
                "command",
                None,
                r#"{
                    "commandName":"legacyCommand",
                    "fileType":"newcommand",
                    "content":"\\newcommand{}"
                }"#,
            ),
            ("legacy-package", "package", None, r#"{}"#),
            (
                "legacy-preamble",
                "preamble",
                None,
                r#"{"preambleType":"article"}"#,
            ),
            (
                "legacy-class",
                "class",
                None,
                r#"{"className":"legacyClass","fileType":"other"}"#,
            ),
            ("invalid-json", "figure", None, r#"{"broken": "#),
        ];

        for (id, resource_type, title, metadata) in resources {
            sqlx::query(
                "INSERT INTO resources (id, path, type, collection, title, metadata)
                 VALUES (?, ?, ?, 'legacy', ?, ?)",
            )
            .bind(id)
            .bind(format!("/{id}.tex"))
            .bind(resource_type)
            .bind(title)
            .bind(metadata)
            .execute(&pool)
            .await
            .expect("seed legacy resource");
        }

        sqlx::query(
            "INSERT INTO resource_files (resource_id, file_description)
             VALUES ('existing-file', 'keep typed data')",
        )
        .execute(&pool)
        .await
        .expect("seed existing typed row");

        // Version 12 represents a database that has every schema table but has
        // never run the skipped JSON backfill.
        sqlx::query("PRAGMA user_version = 12")
            .execute(&pool)
            .await
            .expect("simulate pre-backfill database");
        DatabaseManager::init_schema(&pool)
            .await
            .expect("safe JSON backfill");

        assert_eq!(user_version(&pool).await, 13);
        let existing_description: (Option<String>,) = sqlx::query_as(
            "SELECT file_description FROM resource_files WHERE resource_id = 'existing-file'",
        )
        .fetch_one(&pool)
        .await
        .expect("existing typed row");
        assert_eq!(existing_description.0.as_deref(), Some("keep typed data"));

        let file: (Option<String>, Option<String>, Option<i64>, Option<String>) = sqlx::query_as(
            "SELECT file_type_id, field_id, difficulty, file_description
                 FROM resource_files WHERE resource_id = 'legacy-file'",
        )
        .fetch_one(&pool)
        .await
        .expect("backfilled file");
        assert_eq!(file.0, None, "unknown file type must not violate its FK");
        assert_eq!(file.1.as_deref(), Some("algebra"));
        assert_eq!(file.2, None, "invalid difficulty must not violate CHECK");
        assert_eq!(file.3.as_deref(), Some("backfilled"));

        for (table, expected_id) in [
            ("resource_file_chapters", "chapter-1"),
            ("resource_file_sections", "section-1"),
            ("resource_file_subsections", "subsection-1"),
            ("resource_file_exercise_types", "proof"),
            ("resource_file_packages", "amsmath"),
        ] {
            let id_column = match table {
                "resource_file_chapters" => "chapter_id",
                "resource_file_sections" => "section_id",
                "resource_file_subsections" => "subsection_id",
                "resource_file_exercise_types" => "exercise_type_id",
                _ => "package_id",
            };
            let query = format!(
                "SELECT COUNT(*) FROM {table}
                 WHERE resource_id = 'legacy-file' AND {id_column} = ?",
            );
            let count: (i64,) = sqlx::query_as(&query)
                .bind(expected_id)
                .fetch_one(&pool)
                .await
                .expect("backfilled junction row");
            assert_eq!(count.0, 1, "missing safe junction row in {table}");

            let total: (i64,) = sqlx::query_as(&format!(
                "SELECT COUNT(*) FROM {table} WHERE resource_id = 'legacy-file'"
            ))
            .fetch_one(&pool)
            .await
            .expect("junction count");
            assert_eq!(total.0, 1, "invalid foreign key leaked into {table}");
        }

        let document: (Option<String>, Option<String>) = sqlx::query_as(
            "SELECT document_type_id, field_id
             FROM resource_documents WHERE resource_id = 'legacy-document'",
        )
        .fetch_one(&pool)
        .await
        .expect("backfilled document");
        assert_eq!(document.0.as_deref(), Some("article"));
        assert_eq!(document.1.as_deref(), Some("algebra"));

        let command: (String, Option<String>) = sqlx::query_as(
            "SELECT name, command_type_id
             FROM resource_commands WHERE resource_id = 'legacy-command'",
        )
        .fetch_one(&pool)
        .await
        .expect("backfilled command");
        assert_eq!(command.0, "legacyCommand");
        assert_eq!(command.1.as_deref(), Some("newcommand"));

        for (table, id) in [
            ("resource_tables", "legacy-table"),
            ("resource_figures", "legacy-figure"),
            ("resource_packages", "legacy-package"),
            ("resource_preambles", "legacy-preamble"),
            ("resource_classes", "legacy-class"),
        ] {
            let count: (i64,) = sqlx::query_as(&format!(
                "SELECT COUNT(*) FROM {table} WHERE resource_id = ?"
            ))
            .bind(id)
            .fetch_one(&pool)
            .await
            .expect("typed row count");
            assert_eq!(count.0, 1, "missing backfill row in {table}");
        }

        let package_name: (String,) = sqlx::query_as(
            "SELECT name FROM resource_packages WHERE resource_id = 'legacy-package'",
        )
        .fetch_one(&pool)
        .await
        .expect("package fallback name");
        assert_eq!(package_name.0, "legacy-package", "NOT NULL fallback name");

        let preamble_type: (Option<String>,) = sqlx::query_as(
            "SELECT preamble_type_id
             FROM resource_preambles WHERE resource_id = 'legacy-preamble'",
        )
        .fetch_one(&pool)
        .await
        .expect("legacy preamble type");
        assert_eq!(preamble_type.0.as_deref(), Some("article"));

        let class: (String, Option<String>) = sqlx::query_as(
            "SELECT name, file_type_id
             FROM resource_classes WHERE resource_id = 'legacy-class'",
        )
        .fetch_one(&pool)
        .await
        .expect("legacy class metadata");
        assert_eq!(class.0, "legacyClass");
        assert_eq!(class.1.as_deref(), Some("other"));

        let invalid_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM resource_figures WHERE resource_id = 'invalid-json'",
        )
        .fetch_one(&pool)
        .await
        .expect("invalid JSON row count");
        assert_eq!(invalid_count.0, 0, "malformed JSON must be ignored");

        // Force the final migration to run a second time: it must neither
        // duplicate junction rows nor overwrite any typed values.
        sqlx::query("PRAGMA user_version = 12")
            .execute(&pool)
            .await
            .expect("repeat backfill");
        DatabaseManager::init_schema(&pool)
            .await
            .expect("idempotent repeat");
        let existing_after_repeat: (Option<String>,) = sqlx::query_as(
            "SELECT file_description FROM resource_files WHERE resource_id = 'existing-file'",
        )
        .fetch_one(&pool)
        .await
        .expect("existing row after repeat");
        assert_eq!(existing_after_repeat.0.as_deref(), Some("keep typed data"));
        assert_eq!(user_version(&pool).await, 13);
    }
}
