use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ParsedBibliography {
    pub entries: Vec<BibEntry>,
    pub macros: Vec<BibMacro>,
    pub preambles: Vec<BibRawItem>,
    pub comments: Vec<BibRawItem>,
    pub diagnostics: Vec<BibDiagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BibEntry {
    pub entry_type: String,
    pub citation_key: String,
    pub fields: Vec<BibField>,
    pub raw: String,
    pub byte_start: usize,
    pub byte_end: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BibField {
    pub name: String,
    pub value: String,
    pub raw_value: String,
    pub byte_start: usize,
    pub byte_end: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BibMacro {
    pub name: String,
    pub value: String,
    pub raw: String,
    pub byte_start: usize,
    pub byte_end: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BibRawItem {
    pub kind: String,
    pub raw: String,
    pub byte_start: usize,
    pub byte_end: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BibDiagnostic {
    pub message: String,
    pub byte_start: usize,
    pub byte_end: usize,
}

pub fn parse_bibliography(input: &str) -> ParsedBibliography {
    let mut parser = Parser {
        input,
        pos: 0,
        entries: Vec::new(),
        macros: Vec::new(),
        preambles: Vec::new(),
        comments: Vec::new(),
        diagnostics: Vec::new(),
    };
    parser.parse();
    ParsedBibliography {
        entries: parser.entries,
        macros: parser.macros,
        preambles: parser.preambles,
        comments: parser.comments,
        diagnostics: parser.diagnostics,
    }
}

struct Parser<'a> {
    input: &'a str,
    pos: usize,
    entries: Vec<BibEntry>,
    macros: Vec<BibMacro>,
    preambles: Vec<BibRawItem>,
    comments: Vec<BibRawItem>,
    diagnostics: Vec<BibDiagnostic>,
}

impl Parser<'_> {
    fn parse(&mut self) {
        while self.pos < self.input.len() {
            if self.current_char() == Some('@') {
                self.parse_item();
            } else {
                self.pos = self.next_at_or_end(self.pos);
            }
        }
    }

    fn parse_item(&mut self) {
        let item_start = self.pos;
        self.pos += 1;
        self.skip_whitespace();

        let item_type_start = self.pos;
        while matches!(self.current_char(), Some(c) if is_identifier_char(c)) {
            self.pos += self.current_char().unwrap().len_utf8();
        }

        if item_type_start == self.pos {
            self.push_diagnostic(
                "Expected bibliography item type after @",
                item_start,
                self.pos,
            );
            return;
        }

        let item_type = self.input[item_type_start..self.pos].to_ascii_lowercase();
        self.skip_whitespace();

        let Some(open) = self.current_char() else {
            self.push_diagnostic(
                "Expected { or ( after bibliography item type",
                item_start,
                self.pos,
            );
            return;
        };

        if open != '{' && open != '(' {
            self.push_diagnostic(
                "Expected { or ( after bibliography item type",
                item_start,
                self.pos,
            );
            self.pos += open.len_utf8();
            return;
        }

        let body_start = self.pos + open.len_utf8();
        let Some((body_end, item_end)) = find_item_end(self.input, self.pos, open) else {
            self.push_diagnostic("Unclosed bibliography item", item_start, self.input.len());
            self.pos = self.input.len();
            return;
        };

        let body = &self.input[body_start..body_end];
        let raw = self.input[item_start..item_end].to_string();

        match item_type.as_str() {
            "comment" => self.comments.push(BibRawItem {
                kind: item_type,
                raw,
                byte_start: item_start,
                byte_end: item_end,
            }),
            "preamble" => self.preambles.push(BibRawItem {
                kind: item_type,
                raw,
                byte_start: item_start,
                byte_end: item_end,
            }),
            "string" => self.parse_macro(body, body_start, raw, item_start, item_end),
            _ => self.parse_entry(item_type, body, body_start, raw, item_start, item_end),
        }

        self.pos = item_end;
    }

    fn parse_macro(
        &mut self,
        body: &str,
        body_offset: usize,
        raw: String,
        item_start: usize,
        item_end: usize,
    ) {
        let fields = parse_fields(body, body_offset, &mut self.diagnostics);
        if let Some(field) = fields.into_iter().next() {
            self.macros.push(BibMacro {
                name: field.name,
                value: field.value,
                raw,
                byte_start: item_start,
                byte_end: item_end,
            });
        } else {
            self.push_diagnostic("Expected string macro assignment", item_start, item_end);
        }
    }

    fn parse_entry(
        &mut self,
        entry_type: String,
        body: &str,
        body_offset: usize,
        raw: String,
        item_start: usize,
        item_end: usize,
    ) {
        let Some(comma) = find_top_level_comma(body) else {
            self.push_diagnostic(
                "Expected comma after citation key",
                body_offset,
                body_offset + body.len(),
            );
            return;
        };

        let citation_key = body[..comma].trim().to_string();
        if citation_key.is_empty() {
            self.push_diagnostic(
                "Citation key cannot be empty",
                body_offset,
                body_offset + comma,
            );
        }

        let fields_start = comma + 1;
        let fields = parse_fields(
            &body[fields_start..],
            body_offset + fields_start,
            &mut self.diagnostics,
        );
        self.entries.push(BibEntry {
            entry_type,
            citation_key,
            fields,
            raw,
            byte_start: item_start,
            byte_end: item_end,
        });
    }

    fn current_char(&self) -> Option<char> {
        self.input[self.pos..].chars().next()
    }

    fn next_at_or_end(&self, start: usize) -> usize {
        self.input[start..]
            .find('@')
            .map(|offset| start + offset)
            .unwrap_or(self.input.len())
    }

    fn skip_whitespace(&mut self) {
        while matches!(self.current_char(), Some(c) if c.is_whitespace()) {
            self.pos += self.current_char().unwrap().len_utf8();
        }
    }

    fn push_diagnostic(&mut self, message: &str, byte_start: usize, byte_end: usize) {
        self.diagnostics.push(BibDiagnostic {
            message: message.to_string(),
            byte_start,
            byte_end,
        });
    }
}

fn parse_fields(input: &str, offset: usize, diagnostics: &mut Vec<BibDiagnostic>) -> Vec<BibField> {
    let mut fields = Vec::new();
    let mut pos = 0;

    while pos < input.len() {
        pos = skip_field_separators(input, pos);
        if pos >= input.len() {
            break;
        }

        let name_start = pos;
        while matches!(char_at(input, pos), Some(c) if is_field_name_char(c)) {
            pos += char_at(input, pos).unwrap().len_utf8();
        }

        if name_start == pos {
            diagnostics.push(BibDiagnostic {
                message: "Expected field name".to_string(),
                byte_start: offset + pos,
                byte_end: offset + pos + char_at(input, pos).map(char::len_utf8).unwrap_or(0),
            });
            pos = advance_one(input, pos);
            continue;
        }

        let name = input[name_start..pos].trim().to_ascii_lowercase();
        pos = skip_whitespace(input, pos);

        if char_at(input, pos) != Some('=') {
            diagnostics.push(BibDiagnostic {
                message: "Expected = after field name".to_string(),
                byte_start: offset + pos,
                byte_end: offset + pos + char_at(input, pos).map(char::len_utf8).unwrap_or(0),
            });
            pos = skip_to_next_top_level_comma(input, pos);
            continue;
        }

        pos += 1;
        pos = skip_whitespace(input, pos);
        let value_start = pos;

        match parse_field_value(input, pos) {
            Ok((value_end, value, raw_value)) => {
                fields.push(BibField {
                    name,
                    value,
                    raw_value,
                    byte_start: offset + name_start,
                    byte_end: offset + value_end,
                });
                pos = value_end;
            }
            Err(message) => {
                diagnostics.push(BibDiagnostic {
                    message,
                    byte_start: offset + value_start,
                    byte_end: offset + input.len(),
                });
                break;
            }
        }
    }

    fields
}

fn parse_field_value(input: &str, start: usize) -> Result<(usize, String, String), String> {
    let (value_end, value, raw_value) = match char_at(input, start) {
        Some('{') => {
            let Some((inner_end, value_end)) = find_braced_value_end(input, start) else {
                return Err("Unclosed braced field value".to_string());
            };
            let raw_value = input[start..value_end].to_string();
            (
                value_end,
                input[start + 1..inner_end].trim().to_string(),
                raw_value,
            )
        }
        Some('"') => {
            let Some(value_end) = find_quoted_value_end(input, start) else {
                return Err("Unclosed quoted field value".to_string());
            };
            let raw_value = input[start..value_end].to_string();
            (
                value_end,
                input[start + 1..value_end - 1].trim().to_string(),
                raw_value,
            )
        }
        Some(_) => {
            let value_end = skip_to_next_top_level_comma(input, start);
            let raw_value = input[start..value_end].trim().to_string();
            (value_end, raw_value.clone(), raw_value)
        }
        None => return Err("Expected field value".to_string()),
    };

    if has_concat_after_value(input, value_end) {
        let concat_end = skip_to_next_top_level_comma(input, start);
        let raw_value = input[start..concat_end].trim().to_string();
        Ok((concat_end, raw_value.clone(), raw_value))
    } else {
        Ok((value_end, value, raw_value))
    }
}

fn find_item_end(input: &str, open_pos: usize, open: char) -> Option<(usize, usize)> {
    if open == '{' {
        find_braced_value_end(input, open_pos)
    } else {
        find_parenthesized_item_end(input, open_pos)
    }
}

fn find_braced_value_end(input: &str, open_pos: usize) -> Option<(usize, usize)> {
    let mut depth = 0_i32;

    for (relative, ch) in input[open_pos..].char_indices() {
        let pos = open_pos + relative;

        match ch {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    return Some((pos, pos + ch.len_utf8()));
                }
            }
            _ => {}
        }
    }

    None
}

fn find_parenthesized_item_end(input: &str, open_pos: usize) -> Option<(usize, usize)> {
    let mut paren_depth = 0_i32;
    let mut brace_depth = 0_i32;
    let mut in_quote = false;
    let mut escaped = false;

    for (relative, ch) in input[open_pos..].char_indices() {
        let pos = open_pos + relative;

        if in_quote {
            if escaped {
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                in_quote = false;
            }
            continue;
        }

        match ch {
            '"' if brace_depth == 0 => in_quote = true,
            '{' => brace_depth += 1,
            '}' => brace_depth = brace_depth.saturating_sub(1),
            '(' if brace_depth == 0 => paren_depth += 1,
            ')' if brace_depth == 0 => {
                paren_depth -= 1;
                if paren_depth == 0 {
                    return Some((pos, pos + ch.len_utf8()));
                }
            }
            _ => {}
        }
    }

    None
}

fn find_quoted_value_end(input: &str, quote_pos: usize) -> Option<usize> {
    let mut escaped = false;

    for (relative, ch) in input[quote_pos + 1..].char_indices() {
        let pos = quote_pos + 1 + relative;
        if escaped {
            escaped = false;
        } else if ch == '\\' {
            escaped = true;
        } else if ch == '"' {
            return Some(pos + ch.len_utf8());
        }
    }

    None
}

fn find_top_level_comma(input: &str) -> Option<usize> {
    let mut brace_depth = 0_i32;
    let mut in_quote = false;
    let mut escaped = false;

    for (pos, ch) in input.char_indices() {
        if in_quote {
            if escaped {
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                in_quote = false;
            }
            continue;
        }

        match ch {
            '"' => in_quote = true,
            '{' => brace_depth += 1,
            '}' => brace_depth = brace_depth.saturating_sub(1),
            ',' if brace_depth == 0 => return Some(pos),
            _ => {}
        }
    }

    None
}

fn skip_to_next_top_level_comma(input: &str, start: usize) -> usize {
    find_top_level_comma(&input[start..])
        .map(|offset| start + offset)
        .unwrap_or(input.len())
}

fn has_concat_after_value(input: &str, value_end: usize) -> bool {
    char_at(input, skip_whitespace(input, value_end)) == Some('#')
}

fn skip_field_separators(input: &str, mut pos: usize) -> usize {
    loop {
        pos = skip_whitespace(input, pos);
        if char_at(input, pos) == Some(',') {
            pos += 1;
            continue;
        }
        return pos;
    }
}

fn skip_whitespace(input: &str, mut pos: usize) -> usize {
    while matches!(char_at(input, pos), Some(c) if c.is_whitespace()) {
        pos += char_at(input, pos).unwrap().len_utf8();
    }
    pos
}

fn advance_one(input: &str, pos: usize) -> usize {
    pos + char_at(input, pos).map(char::len_utf8).unwrap_or(0)
}

fn char_at(input: &str, pos: usize) -> Option<char> {
    input.get(pos..)?.chars().next()
}

fn is_identifier_char(ch: char) -> bool {
    ch.is_ascii_alphanumeric() || ch == '_' || ch == '-'
}

fn is_field_name_char(ch: char) -> bool {
    ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' || ch == ':'
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_multiple_biblatex_entries_with_nested_latex() {
        let parsed = parse_bibliography(
            r#"
@string{jgt = {Journal of Great Things}}

@article{knuth1984tex,
  author = {Knuth, Donald E. and Lamport, Leslie},
  title = {The {\TeX} Book and $x^2 + y^2$},
  journaltitle = jgt,
  year = {1984},
  doi = {10.1000/example}
}

@online{doe2026,
  author = "Doe, Jane",
  title = "A quoted title with \"escaped\" text",
  url = {https://example.test/paper},
  date = {2026-07-18}
}
"#,
        );

        assert!(parsed.diagnostics.is_empty(), "{:?}", parsed.diagnostics);
        assert_eq!(parsed.macros.len(), 1);
        assert_eq!(parsed.entries.len(), 2);
        assert_eq!(parsed.entries[0].entry_type, "article");
        assert_eq!(parsed.entries[0].citation_key, "knuth1984tex");
        assert_eq!(
            field(&parsed.entries[0], "title"),
            "The {\\TeX} Book and $x^2 + y^2$"
        );
        assert_eq!(field(&parsed.entries[1], "date"), "2026-07-18");
    }

    #[test]
    fn parses_parenthesized_legacy_bibtex_entries() {
        let parsed = parse_bibliography(
            r#"@book(smith2020,
  author = "Smith, John",
  title = "Legacy BibTeX",
  publisher = "DataTeX Press",
  year = 2020
)"#,
        );

        assert!(parsed.diagnostics.is_empty(), "{:?}", parsed.diagnostics);
        assert_eq!(parsed.entries.len(), 1);
        assert_eq!(parsed.entries[0].citation_key, "smith2020");
        assert_eq!(field(&parsed.entries[0], "year"), "2020");
    }

    #[test]
    fn reports_unclosed_items_without_panicking() {
        let parsed = parse_bibliography(
            r#"@article{broken,
  title = {Missing close brace}
"#,
        );

        assert_eq!(parsed.entries.len(), 0);
        assert_eq!(parsed.diagnostics.len(), 1);
        assert!(parsed.diagnostics[0].message.contains("Unclosed"));
    }

    #[test]
    fn preserves_comments_and_preambles() {
        let parsed = parse_bibliography(
            r#"
@comment{ignored by BibTeX, useful to preserve}
@preamble{"\newcommand{\noop}[1]{}"}
@misc{unicode,
  author = {Παπαδόπουλος, Σπύρος},
  title = {Unicode metadata},
  year = {2026},
}
"#,
        );

        assert!(parsed.diagnostics.is_empty(), "{:?}", parsed.diagnostics);
        assert_eq!(parsed.comments.len(), 1);
        assert_eq!(parsed.preambles.len(), 1);
        assert_eq!(field(&parsed.entries[0], "author"), "Παπαδόπουλος, Σπύρος");
    }

    #[test]
    fn accepts_concatenated_values_and_custom_fields() {
        let parsed = parse_bibliography(
            r#"@misc{concat,
  title = {Part A} # " and " # {Part B},
  archivePrefix = {arXiv},
  eprint = {2607.12345}
}"#,
        );

        assert!(parsed.diagnostics.is_empty(), "{:?}", parsed.diagnostics);
        assert_eq!(parsed.entries.len(), 1);
        assert_eq!(
            field(&parsed.entries[0], "title"),
            r#"{Part A} # " and " # {Part B}"#
        );
        assert_eq!(field(&parsed.entries[0], "archiveprefix"), "arXiv");
    }

    #[test]
    fn treats_latex_quote_accents_inside_braces_as_plain_text() {
        let parsed = parse_bibliography(
            r#"
@book{before,
  title = {Before}
}

@misc{wagner2023sar,
  author       = {Wagner, Wolfgang},
  title        = {{SAR} for Soil Moisture},
  organization = {Department of Geodesy and Geoinformation, Technische Universit{\"a}t Wien},
  year         = {2023}
}

@article{after,
  title = {After}
}
"#,
        );

        assert!(parsed.diagnostics.is_empty(), "{:?}", parsed.diagnostics);
        assert_eq!(parsed.entries.len(), 3);
        assert_eq!(parsed.entries[1].citation_key, "wagner2023sar");
        assert_eq!(parsed.entries[2].citation_key, "after");
    }

    fn field(entry: &BibEntry, name: &str) -> String {
        entry
            .fields
            .iter()
            .find(|field| field.name == name)
            .map(|field| field.value.clone())
            .expect("field should exist")
    }
}
