use regex::Regex;
use serde::Serialize;
use tauri::command;

#[derive(Debug, Serialize)]
pub struct OutlineNode {
    pub id: String,
    pub title: String,
    pub level: i32,
    pub line_number: usize,
    pub children: Vec<OutlineNode>,
}

#[command]
pub fn get_outline(content: String) -> Result<Vec<OutlineNode>, String> {
    let mut nodes = Vec::new();
    let re =
        Regex::new(r"\\(chapter|section|subsection|subsubsection|label)\*?(?:\[.*?\])?\{(.+?)\}")
            .map_err(|e| e.to_string())?;

    for (index, line) in content.lines().enumerate() {
        if let Some(captures) = re.captures(line) {
            if let (Some(type_match), Some(title_match)) = (captures.get(1), captures.get(2)) {
                let node_type = type_match.as_str();
                let title = title_match.as_str().to_string();

                let level;
                let mut display_title = title.clone();

                match node_type {
                    "chapter" => level = 1,
                    "section" => level = 2,
                    "subsection" => level = 3,
                    "subsubsection" => level = 4,
                    "label" => {
                        level = 5;
                        display_title = format!("Label: {}", title);
                    }
                    _ => continue,
                }

                nodes.push(OutlineNode {
                    id: format!("{}-{}", index, title),
                    title: display_title,
                    level,
                    line_number: index + 1,
                    children: vec![], // Flat list for now heavily simplifies things, just like the JS version
                });
            }
        }
    }

    Ok(nodes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_outline() {
        let content = r#"
\documentclass{article}
\begin{document}
\chapter{Introduction}
Some text here.
\section{Background}
More text.
\label{sec:bg}
\subsection{Details}
\end{document}
"#;
        let outline = get_outline(content.to_string()).unwrap();
        assert_eq!(outline.len(), 4);
        assert_eq!(outline[0].title, "Introduction");
        assert_eq!(outline[0].level, 1);
        assert_eq!(outline[1].title, "Background");
        assert_eq!(outline[1].level, 2);
        assert_eq!(outline[2].title, "Label: sec:bg");
        assert_eq!(outline[2].level, 5);
        assert_eq!(outline[3].title, "Details");
        assert_eq!(outline[3].level, 3);
    }
}
