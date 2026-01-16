use crate::database::entities::{Collection, Resource};
use sqlx::{migrate::MigrateDatabase, sqlite::SqlitePoolOptions, Pool, Row, Sqlite};

pub struct DatabaseManager {
    pub pool: Pool<Sqlite>,
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

        Ok(Self { pool })
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
            include_str!("../../migrations/011_migrate_json_to_typed.sql"), // 10
            include_str!("../../migrations/012_resource_bibliographies.sql"), // 11
            include_str!("../../migrations/013_resource_dtx_ins.sql"), // 12
            include_str!("../../migrations/014_add_collection_path.sql"), // 13
        ];

        // Check current version
        let version_row: (i32,) = sqlx::query_as("PRAGMA user_version")
            .fetch_one(pool)
            .await
            .unwrap_or((0,));
        let mut current_version = version_row.0 as usize;

        // Legacy detection: If version is 0 but tables exist, try to guess version to avoid destructive re-runs
        if current_version == 0 {
            // Check for preamble_types explicitly to avoid closure lifetime issues
            let has_preamble_types: (i32,) = sqlx::query_as(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='preamble_types'",
            )
            .fetch_one(pool)
            .await
            .unwrap_or((0,));

            if has_preamble_types.0 > 0 {
                println!("Detected legacy DB with preamble_types. Setting version to 20.");
                current_version = 20;
                sqlx::query(&format!("PRAGMA user_version = {}", current_version))
                    .execute(pool)
                    .await?;
            }
        }

        for (i, init_script) in schemas.iter().enumerate() {
            if i < current_version {
                continue;
            }

            println!("Aplicating migration {}...", i);

            let mut statements = Vec::new();
            let mut current_stmt = String::new();
            let mut in_block = 0;

            for line in init_script.lines() {
                let trimmed = line.trim();
                // Simple comment skipping (naive)
                if trimmed.starts_with("--") {
                    // Check if it's strictly a comment line, or inline?
                    // The original code skipped empty or starts_with --.
                    // We'll keep original logic but careful with strings.
                }

                if trimmed.is_empty() || trimmed.starts_with("--") {
                    continue;
                }

                current_stmt.push_str(line);
                current_stmt.push('\n');

                let upper = trimmed.to_uppercase();
                if upper.contains("BEGIN") {
                    in_block += 1;
                }
                if upper.ends_with("END;") {
                    in_block -= 1;
                }

                if in_block <= 0 && trimmed.ends_with(';') {
                    statements.push(current_stmt.clone());
                    current_stmt.clear();
                    in_block = 0;
                }
            }

            for stmt in statements {
                let stmt = stmt.trim();
                if !stmt.is_empty() {
                    if let Err(e) = sqlx::query(stmt).execute(pool).await {
                        eprintln!("SQL Warning in migration {}: {}", i, e);
                        // Depending on policy, we might want to stop here.
                        // But for now, detailed logging is good.
                    }
                }
            }

            // Update version after success
            let new_version = i + 1;
            sqlx::query(&format!("PRAGMA user_version = {}", new_version))
                .execute(pool)
                .await?;
        }
        Ok(())
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

        sqlx::query("INSERT OR REPLACE INTO resources (id, path, type, collection, title, content_hash, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)")
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
