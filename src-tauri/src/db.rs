use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite, migrate::MigrateDatabase};
use std::path::Path;

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

        let pool = SqlitePoolOptions::new()
            .connect(&db_url)
            .await?;

        // Execute initialization script
        let init_script = include_str!("../migrations/init.sql");

        // Simple SQL parser to remove comments and split by semicolon
        let clean_sql = init_script
            .lines()
            .filter(|line| !line.trim().starts_with("--")) // Remove full line comments
            .map(|line| {
                // Remove trailing comments (simple version, might break strings with '--')
                if let Some(idx) = line.find("--") {
                    &line[..idx]
                } else {
                    line
                }
            })
            .collect::<Vec<&str>>()
            .join("\n");

        for statement in clean_sql.split(';') {
            let stmt = statement.trim();
            if !stmt.is_empty() {
                sqlx::query(stmt).execute(&pool).await?;
            }
        }

        Ok(Self { pool })
    }
}
