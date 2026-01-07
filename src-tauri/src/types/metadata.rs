// ============================================================================
// Typed Metadata Structures
// Rust definitions for strongly-typed resource metadata
// ============================================================================

#![allow(dead_code)]

use serde::{Deserialize, Serialize};

// ============================================================================
// Common Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub file_type_id: Option<String>,
    pub field_id: Option<String>,
    pub difficulty: Option<i32>,
    pub date: Option<String>,
    pub solved_prooved: Option<bool>,
    pub solution_id: Option<String>,
    pub bibliography: Option<String>,
    pub file_content: Option<String>,
    pub preamble_id: Option<String>,
    pub build_command: Option<String>,
    pub file_description: Option<String>,
    // Arrays (will be stored in junction tables)
    pub chapters: Option<Vec<String>>,
    pub sections: Option<Vec<String>>,
    pub exercise_types: Option<Vec<String>>,
    pub required_packages: Option<Vec<String>>,
    pub custom_tags: Option<Vec<String>>,
    pub bib_entries: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentMetadata {
    pub title: Option<String>,
    pub document_type_id: Option<String>,
    pub basic_folder: Option<String>,
    pub sub_folder: Option<String>,
    pub subsub_folder: Option<String>,
    pub date: Option<String>,
    pub content: Option<String>,
    pub preamble_id: Option<String>,
    pub build_command: Option<String>,
    pub needs_update: Option<bool>,
    pub bibliography: Option<String>,
    pub description: Option<String>,
    pub solution_document_id: Option<String>,
    // Arrays
    pub included_files: Option<Vec<IncludedFile>>,
    pub custom_tags: Option<Vec<String>>,
    pub bib_entries: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncludedFile {
    pub file_id: String,
    pub order_index: i32,
    pub files_database_source: Option<String>,
    pub database_type: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableMetadata {
    pub table_type_id: Option<String>,
    pub date: Option<String>,
    pub content: Option<String>,
    pub caption: Option<String>,
    // Arrays
    pub required_packages: Option<Vec<String>>,
    pub custom_tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FigureMetadata {
    pub plot_type_id: Option<String>,
    pub environment: Option<String>,
    pub date: Option<String>,
    pub content: Option<String>,
    pub caption: Option<String>,
    pub preamble_id: Option<String>,
    pub build_command: Option<String>,
    pub description: Option<String>,
    // Arrays
    pub required_packages: Option<Vec<String>>,
    pub custom_tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandMetadata {
    pub name: Option<String>,
    pub file_type_id: Option<String>,
    pub content: Option<String>,
    pub description: Option<String>,
    pub built_in: Option<bool>,
    pub macro_command_type_id: Option<String>,
    // Arrays
    pub required_packages: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageMetadata {
    pub name: Option<String>,
    pub topic_id: Option<String>,
    pub date: Option<String>,
    pub content: Option<String>,
    pub description: Option<String>,
    // Arrays
    pub dependencies: Option<Vec<String>>,
    pub topics: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreambleMetadata {
    pub name: Option<String>,
    pub file_type_id: Option<String>,
    pub content: Option<String>,
    pub description: Option<String>,
    pub built_in: Option<bool>,
    // Arrays
    pub required_packages: Option<Vec<String>>,
    pub command_types: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassMetadata {
    pub name: Option<String>,
    pub file_type_id: Option<String>,
    pub date: Option<String>,
    pub content: Option<String>,
    pub description: Option<String>,
    // Arrays
    pub custom_tags: Option<Vec<String>>,
}

// ============================================================================
// Unified TypedMetadata enum
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum TypedMetadata {
    File(FileMetadata),
    Document(DocumentMetadata),
    Table(TableMetadata),
    Figure(FigureMetadata),
    Command(CommandMetadata),
    Package(PackageMetadata),
    Preamble(PreambleMetadata),
    Class(ClassMetadata),
}

// ============================================================================
// Database Result Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceWithTypedMetadata {
    pub id: String,
    pub path: String,
    pub r#type: String,
    pub collection: String,
    pub title: Option<String>,
    pub content_hash: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub typed_metadata: Option<TypedMetadata>,
}

// ============================================================================
// Helper Functions
// ============================================================================

impl FileMetadata {
    pub fn new() -> Self {
        Self {
            file_type_id: None,
            field_id: None,
            difficulty: None,
            date: None,
            solved_prooved: None,
            solution_id: None,
            bibliography: None,
            file_content: None,
            preamble_id: None,
            build_command: None,
            file_description: None,
            chapters: None,
            sections: None,
            exercise_types: None,
            required_packages: None,
            custom_tags: None,
            bib_entries: None,
        }
    }
}

impl DocumentMetadata {
    pub fn new() -> Self {
        Self {
            title: None,
            document_type_id: None,
            basic_folder: None,
            sub_folder: None,
            subsub_folder: None,
            date: None,
            content: None,
            preamble_id: None,
            build_command: None,
            needs_update: None,
            bibliography: None,
            description: None,
            solution_document_id: None,
            included_files: None,
            custom_tags: None,
            bib_entries: None,
        }
    }
}

// Similar constructors for other types...

impl Default for FileMetadata {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for DocumentMetadata {
    fn default() -> Self {
        Self::new()
    }
}
