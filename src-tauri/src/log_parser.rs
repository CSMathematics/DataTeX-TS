use regex::Regex;
use serde::Serialize;

#[derive(Serialize)]
pub struct LogEntry {
    pub r#type: String, // "error" | "warning" | "info"
    pub message: String,
    pub line: i32,
    pub file: Option<String>,
}

pub fn parse_log(log_content: &str) -> Vec<LogEntry> {
    let mut entries: Vec<LogEntry> = Vec::new();
    let lines: Vec<&str> = log_content.split('\n').collect();

    // Compile regexes once
    let error_start_regex = Regex::new(r"^!\s+(.*)$").unwrap();
    let line_regex = Regex::new(r"^l\.(\d+)").unwrap();

    let warning_regex = Regex::new(r"^LaTeX Warning:\s+(.*)\son input line\s+(\d+)\.$").unwrap();
    let package_warning_regex =
        Regex::new(r"^(?:Package|Class)\s+(\w+)\s+Warning:\s+(.*)$").unwrap();
    let input_line_regex = Regex::new(r"on input line (\d+)\.$").unwrap();

    let mut i = 0;
    while i < lines.len() {
        let line = lines[i].trim();

        // 1. Check for Errors (starts with !)
        if let Some(caps) = error_start_regex.captures(line) {
            let message = caps.get(1).map_or("", |m| m.as_str()).to_string();
            let mut found_line = 0;

            // Look ahead for line number
            let limit = std::cmp::min(i + 10, lines.len());
            for j in (i + 1)..limit {
                let next_line = lines[j].trim();
                if let Some(line_caps) = line_regex.captures(next_line) {
                    if let Some(m) = line_caps.get(1) {
                        if let Ok(n) = m.as_str().parse::<i32>() {
                            found_line = n;
                        }
                    }
                    break;
                }
            }

            entries.push(LogEntry {
                r#type: "error".to_string(),
                message,
                line: found_line,
                file: None,
            });
            i += 1;
            continue;
        }

        // 2. Check for Standard Warnings
        if let Some(caps) = warning_regex.captures(line) {
            let message = caps.get(1).map_or("", |m| m.as_str()).to_string();
            let line_num = caps
                .get(2)
                .and_then(|m| m.as_str().parse::<i32>().ok())
                .unwrap_or(0);

            entries.push(LogEntry {
                r#type: "warning".to_string(),
                message,
                line: line_num,
                file: None,
            });
            i += 1;
            continue;
        }

        // 3. Check for Package Warnings
        if let Some(caps) = package_warning_regex.captures(line) {
            let pkg_name = caps.get(1).map_or("", |m| m.as_str());
            let mut message_part = caps.get(2).map_or("", |m| m.as_str()).to_string();
            let mut found_line = 0;

            // Look ahead for "on input line X"
            let limit = std::cmp::min(i + 5, lines.len());
            for j in i..limit {
                let next_line = lines[j].trim();
                if j != i {
                    message_part.push(' ');
                    message_part.push_str(next_line);
                }

                if let Some(ln_caps) = input_line_regex.captures(next_line) {
                    if let Some(m) = ln_caps.get(1) {
                        if let Ok(n) = m.as_str().parse::<i32>() {
                            found_line = n;
                        }
                    }
                    break;
                }
            }

            entries.push(LogEntry {
                r#type: "warning".to_string(),
                message: format!("{}: {}", pkg_name, message_part),
                line: found_line,
                file: None,
            });
        }

        i += 1;
    }

    entries
}
