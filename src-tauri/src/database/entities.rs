#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Collection {
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    #[sqlx(rename = "type")]
    pub kind: String,
    pub path: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Resource {
    pub id: String,
    pub path: String,
    #[sqlx(rename = "type")]
    pub kind: String,
    pub collection: String,
    pub title: Option<String>,
    pub content_hash: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Document {
    pub id: String,
    pub title: String,
    pub collection: String,
    pub metadata: Option<serde_json::Value>,
    pub created_at: Option<u64>, // SQLite might return different types, check this
    pub updated_at: Option<u64>,
}
