// Graph Data Processor Module
// Handles filtering, node mapping, link processing, and centrality calculation
// for the Visual Graph View component.

use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::collections::{HashMap, HashSet};

use crate::database::DatabaseManager;

/// Filter options passed from the frontend
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphFilters {
    pub show_packages: bool,
    pub show_bibliographies: bool,
    pub show_images: bool,
    pub show_classes: bool,
    pub show_dtx: bool,
    pub show_ins: bool,
}

/// A node in the graph
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub id: String,
    pub name: String,
    pub group: String, // Collection name for coloring
    pub kind: String,  // Resource kind (document, package, etc.)
    pub collection: String,
    pub path: String,
    pub val: f64, // Node size based on centrality
}

/// A link in the graph
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GraphLinkOutput {
    pub source: String,
    pub target: String,
    #[serde(rename = "type")]
    pub link_type: String,
}

/// The complete graph data returned to the frontend
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub links: Vec<GraphLinkOutput>,
}

// Extensions that are allowed in the graph
const ALLOWED_EXTENSIONS: &[&str] = &[".tex", ".bib", ".sty", ".cls", ".dtx", ".ins"];

// Extensions that are explicitly excluded (build artifacts, images)
const EXCLUDED_EXTENSIONS: &[&str] = &[
    ".aux",
    ".log",
    ".out",
    ".toc",
    ".synctex.gz",
    ".fls",
    ".fdb_latexmk",
    ".bbl",
    ".blg",
    ".xdv",
    ".jpg",
    ".jpeg",
    ".png",
    ".pdf",
    ".svg",
];

/// Internal resource structure from database
struct ResourceRow {
    id: String,
    path: String,
    title: Option<String>,
    kind: Option<String>,
    collection: String,
}

/// Internal link structure from database
struct LinkRow {
    source_id: String,
    target_id: String,
    link_type: String,
}

/// Process graph data with filtering and centrality calculation
pub async fn process_graph_data(
    manager: &DatabaseManager,
    collections: Vec<String>,
    filters: GraphFilters,
) -> Result<GraphData, String> {
    if collections.is_empty() {
        return Ok(GraphData {
            nodes: vec![],
            links: vec![],
        });
    }

    // 1. Fetch resources from specified collections
    let placeholders: Vec<String> = collections.iter().map(|_| "?".to_string()).collect();
    let query = format!(
        "SELECT id, path, title, type as kind, collection FROM resources WHERE collection IN ({})",
        placeholders.join(", ")
    );

    let mut query_builder = sqlx::query(&query);
    for coll in &collections {
        query_builder = query_builder.bind(coll);
    }

    let rows = query_builder
        .fetch_all(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    let resources: Vec<ResourceRow> = rows
        .iter()
        .map(|row| ResourceRow {
            id: row.get("id"),
            path: row.get("path"),
            title: row.get("title"),
            kind: row.get("kind"),
            collection: row.get("collection"),
        })
        .collect();

    // 2. Fetch all dependencies (links)
    let links_rows = sqlx::query("SELECT source_id, target_id, relation_type FROM dependencies")
        .fetch_all(&manager.pool)
        .await
        .map_err(|e| e.to_string())?;

    let all_links: Vec<LinkRow> = links_rows
        .iter()
        .map(|row| LinkRow {
            source_id: row.get("source_id"),
            target_id: row.get("target_id"),
            link_type: row.get("relation_type"),
        })
        .collect();

    // 3. Filter resources by extension (allowed list)
    let active_resources: Vec<&ResourceRow> = resources
        .iter()
        .filter(|r| {
            let lower_path = r.path.to_lowercase();

            // Check allowed extensions first
            if ALLOWED_EXTENSIONS
                .iter()
                .any(|ext| lower_path.ends_with(ext))
            {
                return true;
            }

            // Exclude known artifacts/images
            if EXCLUDED_EXTENSIONS
                .iter()
                .any(|ext| lower_path.ends_with(ext))
            {
                return false;
            }

            false
        })
        .collect();

    // 4. Apply UI filter toggles
    let filtered_resources: Vec<&ResourceRow> = active_resources
        .into_iter()
        .filter(|r| {
            let kind = r.kind.as_deref().unwrap_or("document");
            let lower_path = r.path.to_lowercase();

            // Always show .tex files
            if lower_path.ends_with(".tex") {
                return true;
            }

            // Apply filter toggles
            if kind == "package" && !filters.show_packages {
                return false;
            }
            if kind == "bibliography" && !filters.show_bibliographies {
                return false;
            }
            if kind == "image" && !filters.show_images {
                return false;
            }
            if kind == "class" && !filters.show_classes {
                return false;
            }
            if kind == "dtx" && !filters.show_dtx {
                return false;
            }
            if kind == "ins" && !filters.show_ins {
                return false;
            }

            true
        })
        .collect();

    // 5. Build node ID set for link filtering
    let node_ids: HashSet<&String> = filtered_resources.iter().map(|r| &r.id).collect();

    // 6. Filter links to only include those with both endpoints in our node set
    let filtered_links: Vec<GraphLinkOutput> = all_links
        .iter()
        .filter(|l| node_ids.contains(&l.source_id) && node_ids.contains(&l.target_id))
        .map(|l| GraphLinkOutput {
            source: l.source_id.clone(),
            target: l.target_id.clone(),
            link_type: l.link_type.clone(),
        })
        .collect();

    // 7. Calculate centrality (connection count per node)
    let mut connection_count: HashMap<&String, usize> = HashMap::new();
    for link in &filtered_links {
        *connection_count.entry(&link.source).or_insert(0) += 1;
        *connection_count.entry(&link.target).or_insert(0) += 1;
    }

    // 8. Build final nodes with centrality-based sizing
    let nodes: Vec<GraphNode> = filtered_resources
        .iter()
        .map(|r| {
            let kind = r.kind.as_deref().unwrap_or("document").to_string();
            let name = r.title.clone().unwrap_or_else(|| {
                r.path
                    .rsplit(|c| c == '/' || c == '\\')
                    .next()
                    .unwrap_or(&r.id)
                    .to_string()
            });

            let count = connection_count.get(&r.id).copied().unwrap_or(0);
            // Cap size: val = min(10, 1 + count * 0.5)
            let val = (1.0 + count as f64 * 0.5).min(10.0);

            GraphNode {
                id: r.id.clone(),
                name,
                group: r.collection.clone(),
                kind,
                collection: r.collection.clone(),
                path: r.path.clone(),
                val,
            }
        })
        .collect();

    Ok(GraphData {
        nodes,
        links: filtered_links,
    })
}

/// Tauri command to get processed graph data
#[tauri::command]
pub async fn get_graph_data_cmd(
    state: tauri::State<'_, crate::AppState>,
    collections: Vec<String>,
    filters: GraphFilters,
) -> Result<GraphData, String> {
    let guard = state.db_manager.lock().await;
    let manager = guard.as_ref().ok_or("Database not initialized")?;

    process_graph_data(manager, collections, filters).await
}
