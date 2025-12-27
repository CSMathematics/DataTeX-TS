use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite, migrate::MigrateDatabase};
use std::path::Path;

pub struct DatabaseManager {
    pub pool: Pool<Sqlite>,
}

impl DatabaseManager {
    // Συνάρτηση για σύνδεση ή δημιουργία της βάσης
    pub async fn new(project_path: &str) -> Result<Self, sqlx::Error> {
        // Φτιάχνουμε το path για το αρχείο .db μέσα στον φάκελο του project
        let db_path = format!("{}/project.db", project_path);
        let db_url = format!("sqlite://{}", db_path);

        // Αν δεν υπάρχει το αρχείο, το δημιουργούμε
        if !Sqlite::database_exists(&db_url).await.unwrap_or(false) {
            Sqlite::create_database(&db_url).await?;
        }

        // Συνδεόμαστε
        let pool = SqlitePoolOptions::new()
            .connect(&db_url)
            .await?;

        // Εδώ τρέχουμε τα migrations (τη δομή των πινάκων)
        sqlx::query(include_str!("../migrations/init.sql"))
            .execute(&pool)
            .await?;

        Ok(Self { pool })
    }
}