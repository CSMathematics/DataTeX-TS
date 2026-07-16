use crate::database::entities::Resource;
use rayon::prelude::*;
use regex::{NoExpand, Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Instant;

/// Search query parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQuery {
    pub text: String,
    pub case_sensitive: bool,
    pub use_regex: bool,
    pub file_types: Vec<String>,
    pub max_results: usize,
}

/// A single search match with context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMatch {
    pub resource_id: String,
    pub file_path: String,
    pub file_name: String,
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
    pub context_before: Vec<String>,
    pub context_after: Vec<String>,
}

/// Search result containing all matches and metadata
#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub matches: Vec<SearchMatch>,
    pub total_files_searched: usize,
    pub search_duration_ms: u64,
}

/// Replace query parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplaceQuery {
    pub search: SearchQuery,
    pub replace_with: String,
}

/// Replace result
#[derive(Debug, Serialize, Deserialize)]
pub struct ReplaceResult {
    pub total_files_changed: usize,
    pub total_replacements: usize,
    pub replace_duration_ms: u64,
}

/// Main search function - searches through multiple resources in parallel
pub fn search_in_files(
    query: &SearchQuery,
    resources: Vec<Resource>,
) -> Result<SearchResult, String> {
    let start_time = Instant::now();
    if query.text.is_empty() || query.max_results == 0 {
        return Ok(SearchResult {
            matches: Vec::new(),
            total_files_searched: 0,
            search_duration_ms: 0,
        });
    }
    let regex = build_search_regex(query)?;

    // Filter resources by file type if specified
    let filtered_resources: Vec<Resource> = if query.file_types.is_empty() {
        resources
    } else {
        resources
            .into_iter()
            .filter(|r| {
                let path = r.path.to_lowercase();
                query
                    .file_types
                    .iter()
                    .any(|ext| path.ends_with(&format!(".{}", ext.to_lowercase())))
            })
            .collect()
    };

    let total_files = filtered_resources.len();

    // Use Rayon for parallel search across files
    // Collect all matches from all files, then flatten and limit
    let remaining = AtomicUsize::new(query.max_results);
    let all_matches: Vec<SearchMatch> = filtered_resources
        .par_iter()
        .map(|resource| {
            if remaining.load(Ordering::Relaxed) == 0 {
                return Vec::new();
            }

            search_single_file(&resource.path, &resource.id, &regex, query.max_results)
                .unwrap_or_default()
                .into_iter()
                .filter(|_| {
                    remaining
                        .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |value| {
                            value.checked_sub(1)
                        })
                        .is_ok()
                })
                .collect()
        })
        .flatten()
        .collect();

    let duration = start_time.elapsed();

    Ok(SearchResult {
        matches: all_matches,
        total_files_searched: total_files,
        search_duration_ms: duration.as_millis() as u64,
    })
}

/// Search within a single file
fn search_single_file(
    file_path: &str,
    resource_id: &str,
    regex: &Regex,
    max_results: usize,
) -> Result<Vec<SearchMatch>, String> {
    let mut matches = Vec::new();
    let content = fs::read_to_string(file_path)
        .map_err(|error| format!("Failed to read '{}': {}", file_path, error))?;
    let lines: Vec<&str> = content.lines().collect();

    // Extract file name from path
    let file_name = std::path::Path::new(file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(file_path)
        .to_string();

    // Search through lines
    for (line_idx, line_content) in lines.iter().enumerate() {
        let line_matches = regex.find_iter(line_content);
        for mat in line_matches {
            // Get context lines (2 before and 2 after).
            let context_before: Vec<String> = if line_idx >= 2 {
                lines[line_idx - 2..line_idx]
                    .iter()
                    .map(|line| (*line).to_string())
                    .collect()
            } else if line_idx >= 1 {
                lines[line_idx - 1..line_idx]
                    .iter()
                    .map(|line| (*line).to_string())
                    .collect()
            } else {
                Vec::new()
            };

            let context_after: Vec<String> = if line_idx + 3 <= lines.len() {
                lines[line_idx + 1..line_idx + 3]
                    .iter()
                    .map(|line| (*line).to_string())
                    .collect()
            } else if line_idx + 2 <= lines.len() {
                lines[line_idx + 1..line_idx + 2]
                    .iter()
                    .map(|line| (*line).to_string())
                    .collect()
            } else {
                Vec::new()
            };

            matches.push(SearchMatch {
                resource_id: resource_id.to_string(),
                file_path: file_path.to_string(),
                file_name: file_name.clone(),
                line_number: line_idx + 1, // 1-indexed
                line_content: (*line_content).to_string(),
                match_start: mat.start(),
                match_end: mat.end(),
                context_before,
                context_after,
            });

            // Stop if we've reached the per-task upper bound. The caller also
            // enforces one global bound across all parallel tasks.
            if matches.len() >= max_results {
                break;
            }
        }

        if matches.len() >= max_results {
            break;
        }
    }

    Ok(matches)
}

/// Replace text in files
pub fn replace_in_files(
    query: &ReplaceQuery,
    resources: Vec<Resource>,
) -> Result<ReplaceResult, String> {
    let start_time = Instant::now();
    if query.search.text.is_empty() {
        return Err("Search query cannot be empty".to_string());
    }
    let regex = build_search_regex(&query.search)?;

    // Filter resources by file type if specified
    let filtered_resources: Vec<Resource> = if query.search.file_types.is_empty() {
        resources
    } else {
        resources
            .into_iter()
            .filter(|r| {
                let path = r.path.to_lowercase();
                query
                    .search
                    .file_types
                    .iter()
                    .any(|ext| path.ends_with(&format!(".{}", ext.to_lowercase())))
            })
            .collect()
    };

    // Use Rayon for parallel replace across files
    let results: Vec<Result<(bool, usize), String>> = filtered_resources
        .par_iter()
        .map(|resource| replace_in_single_file(&resource.path, query, &regex))
        .collect();

    let mut total_files_changed = 0;
    let mut total_replacements = 0;
    let mut errors = Vec::new();
    for result in results {
        match result {
            Ok((changed, count)) => {
                total_files_changed += usize::from(changed);
                total_replacements += count;
            }
            Err(error) => errors.push(error),
        }
    }

    if !errors.is_empty() {
        return Err(format!(
            "Replace failed for {} file(s): {}",
            errors.len(),
            errors.join("; ")
        ));
    }

    let duration = start_time.elapsed();

    Ok(ReplaceResult {
        total_files_changed,
        total_replacements,
        replace_duration_ms: duration.as_millis() as u64,
    })
}

/// Replace within a single file
fn replace_in_single_file(
    file_path: &str,
    query: &ReplaceQuery,
    regex: &Regex,
) -> Result<(bool, usize), String> {
    let content = fs::read_to_string(file_path)
        .map_err(|error| format!("Failed to read '{}': {}", file_path, error))?;
    let replacements = regex.find_iter(&content).count();
    if replacements == 0 {
        return Ok((false, 0));
    }

    let replaced = if query.search.use_regex {
        regex.replace_all(&content, query.replace_with.as_str())
    } else {
        regex.replace_all(&content, NoExpand(query.replace_with.as_str()))
    };

    if replaced == content {
        return Ok((false, 0));
    }

    atomic_write(Path::new(file_path), replaced.as_bytes())?;
    Ok((true, replacements))
}

fn build_search_regex(query: &SearchQuery) -> Result<Regex, String> {
    let pattern = if query.use_regex {
        query.text.clone()
    } else {
        regex::escape(&query.text)
    };

    RegexBuilder::new(&pattern)
        .case_insensitive(!query.case_sensitive)
        .build()
        .map_err(|error| format!("Invalid regex: {}", error))
}

fn atomic_write(path: &Path, content: &[u8]) -> Result<(), String> {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("datatex");
    let temp_path = parent.join(format!(".{}.{}.tmp", file_name, uuid::Uuid::new_v4()));

    let write_result = (|| -> Result<(), String> {
        let mut temp_file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temp_path)
            .map_err(|error| format!("Failed to create temporary file: {}", error))?;
        temp_file
            .write_all(content)
            .map_err(|error| format!("Failed to write temporary file: {}", error))?;
        temp_file
            .sync_all()
            .map_err(|error| format!("Failed to flush temporary file: {}", error))?;

        if let Ok(metadata) = fs::metadata(path) {
            fs::set_permissions(&temp_path, metadata.permissions())
                .map_err(|error| format!("Failed to preserve file permissions: {}", error))?;
        }

        fs::rename(&temp_path, path)
            .map_err(|error| format!("Failed to replace '{}': {}", path.display(), error))?;
        Ok(())
    })();

    if write_result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    write_result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn temporary_file(contents: &[u8]) -> PathBuf {
        let path =
            std::env::temp_dir().join(format!("datatex-search-{}.tex", uuid::Uuid::new_v4()));
        fs::write(&path, contents).expect("temporary search fixture should be writable");
        path
    }

    #[test]
    fn literal_replace_preserves_crlf_and_treats_dollar_as_text() {
        let path = temporary_file(b"Foo $1\r\nfoo");
        let query = SearchQuery {
            text: "foo".to_string(),
            case_sensitive: false,
            use_regex: false,
            file_types: vec!["tex".to_string()],
            max_results: 100,
        };
        let replace_query = ReplaceQuery {
            search: query.clone(),
            replace_with: "$1".to_string(),
        };
        let regex = build_search_regex(&query).unwrap();

        let result = replace_in_single_file(path.to_str().unwrap(), &replace_query, &regex);
        assert_eq!(result.unwrap(), (true, 2));
        assert_eq!(fs::read(&path).unwrap(), b"$1 $1\r\n$1");

        fs::remove_file(path).unwrap();
    }

    #[test]
    fn regex_replace_counts_every_match() {
        let path = temporary_file(b"a1\na2\na3");
        let query = SearchQuery {
            text: r"a\d".to_string(),
            case_sensitive: true,
            use_regex: true,
            file_types: Vec::new(),
            max_results: usize::MAX,
        };
        let replace_query = ReplaceQuery {
            search: query.clone(),
            replace_with: "x".to_string(),
        };
        let regex = build_search_regex(&query).unwrap();

        let result = replace_in_single_file(path.to_str().unwrap(), &replace_query, &regex);
        assert_eq!(result.unwrap(), (true, 3));
        assert_eq!(fs::read_to_string(&path).unwrap(), "x\nx\nx");

        fs::remove_file(path).unwrap();
    }

    #[test]
    fn search_reports_every_match_on_a_line() {
        let path = temporary_file(b"foo foo foo");
        let regex = build_search_regex(&SearchQuery {
            text: "foo".to_string(),
            case_sensitive: true,
            use_regex: false,
            file_types: Vec::new(),
            max_results: 10,
        })
        .unwrap();

        let matches = search_single_file(path.to_str().unwrap(), "resource", &regex, 10).unwrap();
        assert_eq!(matches.len(), 3);
        assert_eq!(matches[0].match_start, 0);
        assert_eq!(matches[1].match_start, 4);
        assert_eq!(matches[2].match_start, 8);

        fs::remove_file(path).unwrap();
    }

    #[test]
    fn test_regex_escape() {
        let text = "\\begin{equation}";
        let escaped = regex::escape(text);
        // Regex special chars should be escaped
        assert!(escaped.contains("\\\\"));
    }
}
