use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::future::Future;
use std::path::Path;
use std::pin::Pin;
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Mutex;

use crate::database::DatabaseManager;
use crate::vectors::VectorStoreState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

pub trait Tool: Send + Sync {
    fn definition(&self) -> ToolDefinition;
    fn execute(
        &self,
        args: serde_json::Value,
    ) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send + '_>>;
}

// --- Tool Implementations ---

pub struct DatabaseSearchTool {
    pub db_manager: Arc<Mutex<Option<DatabaseManager>>>,
}

impl Tool for DatabaseSearchTool {
    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "search_files".to_string(),
            description: "Search for text patterns (regex or string) inside files in the database."
                .to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Text to search for" },
                    "regex": { "type": "boolean", "description": "Use regex? Default false" },
                    "extensions": { "type": "array", "items": { "type": "string" }, "description": "File extensions (tex, bib...)" }
                },
                "required": ["query"]
            }),
        }
    }

    fn execute(
        &self,
        args: serde_json::Value,
    ) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send + '_>> {
        let db_manager = self.db_manager.clone();
        Box::pin(async move {
            let query_text = args["query"].as_str().ok_or("Missing query")?.to_string();
            let use_regex = args["regex"].as_bool().unwrap_or(false);
            let extensions = args["extensions"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default();

            let resources = {
                let guard = db_manager.lock().await;
                let db = guard.as_ref().ok_or("Database not initialized")?;
                let collections = db.get_collections().await.unwrap_or_default();
                let col_names: Vec<String> = collections.into_iter().map(|c| c.name).collect();
                db.get_resources_by_collections(&col_names)
                    .await
                    .unwrap_or_default()
            };

            let search_query = crate::search::SearchQuery {
                text: query_text,
                case_sensitive: false,
                use_regex,
                file_types: extensions,
                max_results: 20,
            };

            let result = tokio::task::spawn_blocking(move || {
                crate::search::search_in_files(&search_query, resources)
            })
            .await
            .map_err(|error| format!("Search task failed: {}", error))?;

            match result {
                Ok(res) => {
                    let mut out = String::new();
                    out.push_str(&format!(
                        "Found {} matches in {} files:\n",
                        res.matches.len(),
                        res.total_files_searched
                    ));
                    for m in res.matches {
                        out.push_str(&format!(
                            "{}:{} - {}\n",
                            m.file_name,
                            m.line_number,
                            m.line_content.trim()
                        ));
                    }
                    Ok(out)
                }
                Err(e) => Err(e),
            }
        })
    }
}

// Registry to hold tools
pub struct ToolRegistry {
    tools: std::collections::HashMap<String, Box<dyn Tool>>,
}

impl ToolRegistry {
    pub fn new(
        app_handle: tauri::AppHandle,
        db_manager: Arc<Mutex<Option<DatabaseManager>>>,
        vector_store: Arc<VectorStoreState>,
        config: crate::ai::ProviderConfig,
    ) -> Self {
        let mut registry = ToolRegistry {
            tools: std::collections::HashMap::new(),
        };

        registry.register(Box::new(ProposeEditTool {
            app_handle: app_handle.clone(),
        }));
        registry.register(Box::new(FindResourceTool {
            db_manager: db_manager.clone(),
        }));

        registry.register(Box::new(DatabaseSearchTool { db_manager }));

        // For Semantic Search, we need to handle the embedding generation.
        registry.register(Box::new(SemanticSearchTool {
            vector_store,
            config,
        }));

        registry
    }

    pub fn register(&mut self, tool: Box<dyn Tool>) {
        self.tools.insert(tool.definition().name, tool);
    }

    pub fn get(&self, name: &str) -> Option<&dyn Tool> {
        self.tools.get(name).map(Box::as_ref)
    }

    pub fn get_definitions(&self) -> Vec<ToolDefinition> {
        self.tools.values().map(|t| t.definition()).collect()
    }
}

// ... (ProposeEditTool impl was NOT missing, but the Struct was?)
// Actually, looking at previous output, `ProposeEditTool` struct was at lines 371-373.
// My edit targeted 371.
// So I DELETED it.
// I must restore it.

pub struct ProposeEditTool {
    pub app_handle: tauri::AppHandle,
}

pub struct FindResourceTool {
    pub db_manager: Arc<Mutex<Option<DatabaseManager>>>,
}

impl Tool for FindResourceTool {
    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "find_resource".to_string(),
            description: "Find files in the database. Can search by name/path and optionally filter by collection.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Filename or partial pattern (e.g. 'Untitled.tex')"
                    },
                    "collection": {
                        "type": "string",
                        "description": "Optional: Filter by collection name (e.g. 'testLatex')"
                    }
                },
                "required": ["name"]
            }),
        }
    }

    fn execute(
        &self,
        args: serde_json::Value,
    ) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send + '_>> {
        let db_manager = self.db_manager.clone();
        Box::pin(async move {
            let raw_name = args["name"].as_str().ok_or("Missing name argument")?;
            // Support glob-like patterns: replace * with %
            let name_pattern = raw_name.replace('*', "%");
            let collection_filter = args["collection"].as_str().map(|s| s.to_string());
            let search_pattern = format!("%{}%", name_pattern);

            let guard = db_manager.lock().await;
            if let Some(db) = guard.as_ref() {
                let rows = if let Some(col) = collection_filter {
                    sqlx::query("SELECT path, collection FROM resources WHERE (path LIKE ? OR title LIKE ?) AND collection = ? LIMIT 10")
                        .bind(&search_pattern)
                        .bind(&search_pattern)
                        .bind(col)
                        .fetch_all(&db.pool)
                        .await
                        .map_err(|e| format!("Database error: {}", e))?
                } else {
                    sqlx::query("SELECT path, collection FROM resources WHERE path LIKE ? OR title LIKE ? LIMIT 10")
                        .bind(&search_pattern)
                        .bind(&search_pattern)
                        .fetch_all(&db.pool)
                        .await
                        .map_err(|e| format!("Database error: {}", e))?
                };

                if rows.is_empty() {
                    return Ok(format!("No files found matching '{}'.", name_pattern));
                }

                let mut out = String::new();
                out.push_str(&format!("Found {} matches:\n", rows.len()));
                for row in rows {
                    let path: String = row.try_get("path").unwrap_or_default();
                    let col: String = row.try_get("collection").unwrap_or_default();
                    out.push_str(&format!("- [{}] {}\n", col, path));
                }
                Ok(out)
            } else {
                Err("Database not initialized".to_string())
            }
        })
    }
}
// (existing code)

impl Tool for ProposeEditTool {
    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "propose_edit".to_string(),
            description: "Propose changes to an existing file. Use this for editing code or text. The user will review the changes in a Diff View.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute path to file"
                    },
                    "new_content": {
                        "type": "string",
                        "description": "The full new content of the file"
                    }
                },
                "required": ["path", "new_content"]
            }),
        }
    }

    fn execute(
        &self,
        args: serde_json::Value,
    ) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send + '_>> {
        let app = self.app_handle.clone();
        Box::pin(async move {
            let path_str = args["path"]
                .as_str()
                .ok_or("Missing path argument")?
                .to_string();
            let new_content = args["new_content"]
                .as_str()
                .ok_or("Missing new_content argument")?
                .to_string();

            if !Path::new(&path_str).exists() {
                return Err(format!(
                    "File does not exist: {}. Use write_file to create new files.",
                    path_str
                ));
            }

            // Emit event to frontend
            app.emit(
                "agent-proposal",
                serde_json::json!({
                    "path": path_str,
                    "new_content": new_content
                }),
            )
            .map_err(|e| e.to_string())?;

            Ok(format!(
                "Proposed edit for {}. User is reviewing changes...",
                path_str
            ))
        })
    }
}

// Actual Impl of SemanticSearchTool with Config
struct SemanticSearchTool {
    vector_store: Arc<VectorStoreState>,
    config: crate::ai::ProviderConfig,
}

impl Tool for SemanticSearchTool {
    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "semantic_search".to_string(),
            description: "Search for similar content by meaning (embeddings). Useful for finding exercises, chapters, or concepts.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Concept or text to find" },
                    "k": { "type": "integer", "description": "Number of results (default 5)" }
                },
                "required": ["query"]
            }),
        }
    }

    fn execute(
        &self,
        args: serde_json::Value,
    ) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send + '_>> {
        let store_state = self.vector_store.clone();
        let config = self.config.clone();

        Box::pin(async move {
            let query_text = args["query"].as_str().ok_or("Missing query")?.to_string();
            let top_k = args["k"].as_u64().unwrap_or(5) as usize;

            let embedding = crate::ai::get_embedding(&query_text, &config)
                .await
                .map_err(|e| e.to_string())?;

            let store = store_state.0.lock().await;
            let results = store.search(&embedding, top_k);

            let mut out = String::new();
            out.push_str(&format!("Found {} semantic matches:\n", results.len()));
            for (id, score) in results {
                out.push_str(&format!("- {} (Score: {:.4})\n", id, score));
            }
            Ok(out)
        })
    }
}
