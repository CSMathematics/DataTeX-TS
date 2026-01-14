use crate::database::entities::Resource;
use serde::Serialize;
use std::collections::HashMap;

#[derive(Serialize, Clone, Debug)]
pub struct TreeNode {
    pub id: String,
    pub name: String,
    pub r#type: String, // "file" | "folder"
    pub path: String,
    pub children: Vec<TreeNode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_root: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

const ALLOWED_EXTENSIONS: [&str; 10] = [
    "tex", "pdf", "bib", "sty", "png", "jpg", "jpeg", "gif", "svg", "webp",
];

pub fn build_file_tree(resources: Vec<Resource>) -> Vec<TreeNode> {
    // 1. Filter resources (ignore hidden files and non-allowed extensions)
    let filtered_resources: Vec<&Resource> = resources
        .iter()
        .filter(|r| {
            if r.path.contains("/.") || r.path.contains("\\.") {
                return false;
            }
            let ext = std::path::Path::new(&r.path)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            ALLOWED_EXTENSIONS.contains(&ext.as_str())
        })
        .collect();

    if filtered_resources.is_empty() {
        return Vec::new();
    }

    // 2. Group by collection
    let mut by_collection: HashMap<String, Vec<&Resource>> = HashMap::new();
    for r in filtered_resources {
        by_collection
            .entry(r.collection.clone())
            .or_insert_with(Vec::new)
            .push(r);
    }

    let mut collection_trees: Vec<TreeNode> = Vec::new();

    // 3. Build tree for each collection
    for (collection_name, res_list) in by_collection {
        let paths: Vec<String> = res_list.iter().map(|r| r.path.clone()).collect();
        if paths.is_empty() {
            continue;
        }

        // Determine separator
        let separator = if paths[0].contains('\\') { "\\" } else { "/" };

        // Find common prefix
        let parts_list: Vec<Vec<&str>> =
            paths.iter().map(|p| p.split(separator).collect()).collect();

        let mut common_prefix: Vec<&str> = Vec::new();
        if let Some(first) = parts_list.first() {
            common_prefix = first.clone();
            for parts in parts_list.iter().skip(1) {
                let mut j = 0;
                while j < common_prefix.len() && j < parts.len() && common_prefix[j] == parts[j] {
                    j += 1;
                }
                common_prefix.truncate(j);
            }
        }
        let common_root = common_prefix.join(separator);

        // Root Node
        let mut root_node = TreeNode {
            id: collection_name.clone(),
            name: collection_name.clone(),
            r#type: "folder".to_string(),
            path: common_root.clone(),
            children: Vec::new(),
            is_root: Some(true),
            metadata: Some(serde_json::json!({ "collectionName": collection_name })),
        };

        // Add files to tree (Virtual construction)
        // We'll use a temporary recursive structure or modify TreeNode directly?
        // Modifying TreeNode recursively in Rust is tricky with ownership.
        // Better to use an intermediate Map-based structure.

        #[derive(Debug)]
        struct TempNode {
            id: String,
            name: String,
            r#type: String,
            path: String,
            children: HashMap<String, TempNode>,
        }

        let mut root_children: HashMap<String, TempNode> = HashMap::new();

        fn insert_path(
            map: &mut HashMap<String, TempNode>,
            parts: &[&str],
            collection_name: &str,
            r: &Resource,
            is_file_check: bool,
            current_path_prefix: String,
            separator: &str,
        ) {
            if parts.is_empty() {
                return;
            }

            let part = parts[0];
            let is_last = parts.len() == 1;
            let is_file = is_last && is_file_check;

            // Build path
            let mut my_path = current_path_prefix.clone();
            if !my_path.is_empty() && !my_path.ends_with(separator) {
                my_path.push_str(separator);
            }
            my_path.push_str(part);

            let id = if is_file {
                r.id.clone()
            } else {
                format!("{}-{}", collection_name, my_path)
            };

            let node = map.entry(part.to_string()).or_insert_with(|| TempNode {
                id,
                name: part.to_string(),
                r#type: (if is_file { "file" } else { "folder" }).to_string(),
                path: my_path.clone(),
                children: HashMap::new(),
            });

            if !is_last {
                insert_path(
                    &mut node.children,
                    &parts[1..],
                    collection_name,
                    r,
                    is_file_check,
                    my_path,
                    separator,
                );
            }
        }

        for r in res_list {
            // Relative path
            let relative_path = if r.path.starts_with(&common_root) {
                &r.path[common_root.len()..]
            } else {
                &r.path
            };
            // Trim leading separator
            let relative_clean = relative_path.trim_start_matches(separator);

            // Split
            let parts: Vec<&str> = relative_clean
                .split(separator)
                .filter(|s| !s.is_empty())
                .collect();

            insert_path(
                &mut root_children,
                &parts,
                &collection_name,
                r,
                true,
                common_root.clone(),
                separator,
            );
        }

        // Convert TempNode to TreeNode recursively and sort
        fn convert(map: HashMap<String, TempNode>) -> Vec<TreeNode> {
            let mut nodes: Vec<TreeNode> = map
                .into_iter()
                .map(|(_, v)| {
                    let mut children = convert(v.children);
                    // Sort children: folders first, then alphabetical
                    children.sort_by(|a, b| {
                        if a.r#type != b.r#type {
                            if a.r#type == "folder" {
                                std::cmp::Ordering::Less
                            } else {
                                std::cmp::Ordering::Greater
                            }
                        } else {
                            a.name.cmp(&b.name)
                        }
                    });

                    TreeNode {
                        id: v.id,
                        name: v.name,
                        r#type: v.r#type,
                        path: v.path,
                        children,
                        is_root: None,
                        metadata: None,
                    }
                })
                .collect();

            // Sort at this level too
            nodes.sort_by(|a, b| {
                if a.r#type != b.r#type {
                    if a.r#type == "folder" {
                        std::cmp::Ordering::Less
                    } else {
                        std::cmp::Ordering::Greater
                    }
                } else {
                    a.name.cmp(&b.name)
                }
            });

            nodes
        }

        root_node.children = convert(root_children);

        // 4. Flatten single-child directory chains
        // Logic: recursively peel off wrapper folders
        // Frontend logic specifically for ROOT:
        // let currentChildren = rootNode.children;
        // while (currentChildren.length === 1 && currentChildren[0].type === "folder") { ... }
        // rootNode.children = currentChildren;

        let mut current_children = std::mem::take(&mut root_node.children);
        while current_children.len() == 1 && current_children[0].r#type == "folder" {
            let child = &mut current_children[0];
            let has_single_folder_grandchild =
                child.children.len() == 1 && child.children[0].r#type == "folder";

            if has_single_folder_grandchild {
                // Peel
                current_children = std::mem::take(&mut child.children);
            } else {
                break;
            }
        }
        root_node.children = current_children;

        collection_trees.push(root_node);
    }

    collection_trees
}
