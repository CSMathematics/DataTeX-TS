use crate::database::entities::Resource;
use rayon::prelude::*;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufRead, BufReader};
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
    let mut all_matches: Vec<SearchMatch> = filtered_resources
        .par_iter()
        .map(|resource| search_single_file(&resource.path, &resource.id, query).unwrap_or_default())
        .flatten()
        .collect();

    // Limit results
    all_matches.truncate(query.max_results);

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
    query: &SearchQuery,
) -> Result<Vec<SearchMatch>, String> {
    let file = File::open(file_path).map_err(|e| format!("Failed to open file: {}", e))?;
    let reader = BufReader::new(file);

    let mut matches = Vec::new();
    let mut lines: Vec<String> = Vec::new();

    // Read all lines first for context access
    for line in reader.lines() {
        if let Ok(line) = line {
            lines.push(line);
        }
    }

    // Prepare search pattern
    let pattern = if query.use_regex {
        query.text.clone()
    } else {
        regex::escape(&query.text)
    };

    let regex_pattern = if query.case_sensitive {
        Regex::new(&pattern).map_err(|e| format!("Invalid regex: {}", e))?
    } else {
        Regex::new(&format!("(?i){}", pattern)).map_err(|e| format!("Invalid regex: {}", e))?
    };

    // Extract file name from path
    let file_name = std::path::Path::new(file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(file_path)
        .to_string();

    // Search through lines
    for (line_idx, line_content) in lines.iter().enumerate() {
        if let Some(mat) = regex_pattern.find(line_content) {
            // Debug log
            println!("Found match at line {}: '{}'", line_idx + 1, line_content);
            println!("Match positions: start={}, end={}", mat.start(), mat.end());

            // Get context lines (2 before and 2 after)
            let context_before: Vec<String> = if line_idx >= 2 {
                lines[line_idx - 2..line_idx].to_vec()
            } else if line_idx >= 1 {
                lines[line_idx - 1..line_idx].to_vec()
            } else {
                Vec::new()
            };

            let context_after: Vec<String> = if line_idx + 3 <= lines.len() {
                lines[line_idx + 1..line_idx + 3].to_vec()
            } else if line_idx + 2 <= lines.len() {
                lines[line_idx + 1..line_idx + 2].to_vec()
            } else {
                Vec::new()
            };

            matches.push(SearchMatch {
                resource_id: resource_id.to_string(),
                file_path: file_path.to_string(),
                file_name: file_name.clone(),
                line_number: line_idx + 1, // 1-indexed
                line_content: line_content.clone(),
                match_start: mat.start(),
                match_end: mat.end(),
                context_before,
                context_after,
            });

            // Stop if we've reached max results
            if matches.len() >= query.max_results {
                break;
            }
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
    let results: Vec<(bool, usize)> = filtered_resources
        .par_iter()
        .map(|resource| replace_in_single_file(&resource.path, query).unwrap_or((false, 0)))
        .collect();

    let total_files_changed = results.iter().filter(|(changed, _)| *changed).count();
    let total_replacements = results.iter().map(|(_, count)| count).sum();

    let duration = start_time.elapsed();

    Ok(ReplaceResult {
        total_files_changed,
        total_replacements,
        replace_duration_ms: duration.as_millis() as u64,
    })
}

/// Replace within a single file
fn replace_in_single_file(file_path: &str, query: &ReplaceQuery) -> Result<(bool, usize), String> {
    let file = File::open(file_path).map_err(|e| format!("Failed to open file: {}", e))?;
    let reader = BufReader::new(file);

    let mut lines: Vec<String> = Vec::new();
    let mut changed = false;
    let mut replacements = 0;

    // Read all lines
    for line in reader.lines() {
        if let Ok(line) = line {
            lines.push(line);
        }
    }

    // Prepare search pattern
    let pattern = if query.search.use_regex {
        query.search.text.clone()
    } else {
        regex::escape(&query.search.text)
    };

    let regex_pattern = if query.search.case_sensitive {
        Regex::new(&pattern).map_err(|e| format!("Invalid regex: {}", e))?
    } else {
        Regex::new(&format!("(?i){}", pattern)).map_err(|e| format!("Invalid regex: {}", e))?
    };

    // Perform replacement in memory
    let mut new_lines = Vec::new();
    for line in lines {
        if regex_pattern.is_match(&line) {
            let replaced = regex_pattern.replace_all(&line, &query.replace_with);
            if replaced != line {
                replacements += line.match_indices(&query.search.text).count(); // Approximate count for regex
                if query.search.use_regex {
                    replacements = regex_pattern.find_iter(&line).count();
                }
                new_lines.push(replaced.to_string());
                changed = true;
            } else {
                new_lines.push(line);
            }
        } else {
            new_lines.push(line);
        }
    }

    // Write back to file if changed
    if changed {
        use std::io::Write;
        let mut file = File::create(file_path)
            .map_err(|e| format!("Failed to create file for writing: {}", e))?;
        for line in new_lines {
            writeln!(file, "{}", line).map_err(|e| format!("Failed to write line: {}", e))?;
        }
    }

    Ok((changed, replacements))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_query_case_sensitive() {
        // This is a placeholder test
        // In a real scenario, we'd create a temp file and test searching
        let query = SearchQuery {
            text: "test".to_string(),
            case_sensitive: true,
            use_regex: false,
            file_types: vec!["tex".to_string()],
            max_results: 100,
        };

        assert_eq!(query.text, "test");
        assert!(query.case_sensitive);
    }

    #[test]
    fn test_regex_escape() {
        let text = "\\begin{equation}";
        let escaped = regex::escape(text);
        // Regex special chars should be escaped
        assert!(escaped.contains("\\\\"));
    }
}
