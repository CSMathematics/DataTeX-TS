use crate::bibliography::parser::BibDiagnostic;
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportedBibliographyEntry {
    pub entry_type: String,
    pub citation_key: Option<String>,
    pub fields: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportedBibliography {
    pub format: String,
    pub entries: Vec<ImportedBibliographyEntry>,
    pub diagnostics: Vec<BibDiagnostic>,
}

pub fn import_bibliography(content: &str, requested_format: Option<&str>) -> ImportedBibliography {
    let format = requested_format
        .map(str::trim)
        .filter(|value| !value.is_empty() && !value.eq_ignore_ascii_case("auto"))
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_else(|| detect_format(content));

    match format.as_str() {
        "csl" | "csl-json" | "json" => parse_csl_json(content),
        "endnote" | "enw" => parse_endnote_tagged(content),
        "pubmed" | "medline" | "nbib" => parse_pubmed_medline(content),
        "ris" => parse_ris(content),
        _ => ImportedBibliography {
            format,
            entries: Vec::new(),
            diagnostics: vec![diagnostic(
                "Unsupported bibliography import format",
                0,
                content.len(),
            )],
        },
    }
}

fn detect_format(content: &str) -> String {
    let trimmed = content.trim_start();
    if trimmed.starts_with('[') || trimmed.starts_with('{') {
        return "csl-json".to_string();
    }
    if trimmed.lines().any(|line| line.starts_with("TY  -")) {
        return "ris".to_string();
    }
    if trimmed.lines().any(|line| line.starts_with("%0")) {
        return "endnote".to_string();
    }
    if trimmed
        .lines()
        .any(|line| line.starts_with("PMID-") || line.starts_with("PMID -"))
    {
        return "pubmed".to_string();
    }
    "ris".to_string()
}

fn parse_ris(content: &str) -> ImportedBibliography {
    let mut records = Vec::new();
    let mut current: HashMap<String, Vec<String>> = HashMap::new();
    let mut last_tag: Option<String> = None;
    let mut diagnostics = Vec::new();

    for (line_number, line) in content.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        if line.len() >= 6 && line.as_bytes().get(2..6) == Some(b"  - ") {
            let tag = line[..2].trim().to_ascii_uppercase();
            let value = line[6..].trim().to_string();
            if tag == "TY" && !current.is_empty() {
                records.push(std::mem::take(&mut current));
            }
            if tag == "ER" {
                if !current.is_empty() {
                    records.push(std::mem::take(&mut current));
                }
                last_tag = None;
                continue;
            }
            current.entry(tag.clone()).or_default().push(value);
            last_tag = Some(tag);
        } else if line.starts_with(' ') || line.starts_with('\t') {
            if let Some(tag) = &last_tag {
                if let Some(values) = current.get_mut(tag) {
                    if let Some(last) = values.last_mut() {
                        if !last.is_empty() {
                            last.push(' ');
                        }
                        last.push_str(line.trim());
                    }
                }
            }
        } else {
            diagnostics.push(diagnostic(
                &format!("Ignored unrecognized RIS line {}", line_number + 1),
                0,
                0,
            ));
        }
    }
    if !current.is_empty() {
        records.push(current);
    }

    let entries = records
        .into_iter()
        .filter_map(ris_record_to_entry)
        .collect::<Vec<_>>();
    if entries.is_empty() && diagnostics.is_empty() {
        diagnostics.push(diagnostic("No RIS records were found", 0, content.len()));
    }
    ImportedBibliography {
        format: "ris".to_string(),
        entries,
        diagnostics,
    }
}

fn ris_record_to_entry(record: HashMap<String, Vec<String>>) -> Option<ImportedBibliographyEntry> {
    let entry_type = record
        .get("TY")
        .and_then(|values| values.first())
        .map(|value| map_ris_type(value))
        .unwrap_or_else(|| "misc".to_string());
    let mut fields = BTreeMap::new();
    insert_first(&mut fields, &record, "title", &["TI", "T1", "CT"]);
    insert_first(&mut fields, &record, "subtitle", &["ST"]);
    insert_first(&mut fields, &record, "journal", &["JO", "JF", "JA"]);
    insert_first(&mut fields, &record, "booktitle", &["T2", "BT"]);
    insert_first(&mut fields, &record, "year", &["PY", "Y1", "Y2"]);
    insert_first(&mut fields, &record, "doi", &["DO"]);
    insert_first(&mut fields, &record, "isbn", &["SN"]);
    insert_first(&mut fields, &record, "url", &["UR", "L2"]);
    insert_first(&mut fields, &record, "abstract", &["AB", "N2"]);
    insert_first(&mut fields, &record, "publisher", &["PB"]);
    insert_first(&mut fields, &record, "volume", &["VL"]);
    insert_first(&mut fields, &record, "number", &["IS"]);
    insert_pages(&mut fields, &record);
    insert_people(&mut fields, &record, "author", &["AU", "A1"]);
    insert_people(&mut fields, &record, "editor", &["ED", "A2"]);
    insert_all_joined(&mut fields, &record, "keywords", &["KW"], ", ");
    normalize_year(&mut fields);
    if fields.is_empty() {
        return None;
    }
    Some(ImportedBibliographyEntry {
        entry_type,
        citation_key: first_value(&record, &["ID"]),
        fields,
    })
}

fn parse_endnote_tagged(content: &str) -> ImportedBibliography {
    let mut records = Vec::new();
    let mut current: HashMap<String, Vec<String>> = HashMap::new();
    let mut last_tag: Option<String> = None;

    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }
        if line.starts_with("%0") && !current.is_empty() {
            records.push(std::mem::take(&mut current));
        }
        if line.starts_with('%') && line.len() >= 2 {
            let tag = line[1..2].to_string();
            let value = line[2..].trim().to_string();
            current.entry(tag.clone()).or_default().push(value);
            last_tag = Some(tag);
        } else if let Some(tag) = &last_tag {
            if let Some(values) = current.get_mut(tag) {
                if let Some(last) = values.last_mut() {
                    if !last.is_empty() {
                        last.push(' ');
                    }
                    last.push_str(line.trim());
                }
            }
        }
    }
    if !current.is_empty() {
        records.push(current);
    }

    let entries = records
        .into_iter()
        .filter_map(endnote_record_to_entry)
        .collect::<Vec<_>>();
    let diagnostics = if entries.is_empty() {
        vec![diagnostic(
            "No EndNote tagged records were found",
            0,
            content.len(),
        )]
    } else {
        Vec::new()
    };
    ImportedBibliography {
        format: "endnote".to_string(),
        entries,
        diagnostics,
    }
}

fn endnote_record_to_entry(
    record: HashMap<String, Vec<String>>,
) -> Option<ImportedBibliographyEntry> {
    let entry_type = record
        .get("0")
        .and_then(|values| values.first())
        .map(|value| map_endnote_type(value))
        .unwrap_or_else(|| "misc".to_string());
    let mut fields = BTreeMap::new();
    insert_first(&mut fields, &record, "title", &["T"]);
    insert_first(&mut fields, &record, "journal", &["J"]);
    insert_first(&mut fields, &record, "booktitle", &["B"]);
    insert_first(&mut fields, &record, "year", &["D"]);
    insert_first(&mut fields, &record, "doi", &["R"]);
    insert_first(&mut fields, &record, "url", &["U"]);
    insert_first(&mut fields, &record, "abstract", &["X"]);
    insert_first(&mut fields, &record, "publisher", &["I"]);
    insert_first(&mut fields, &record, "volume", &["V"]);
    insert_first(&mut fields, &record, "number", &["N"]);
    insert_first(&mut fields, &record, "pages", &["P"]);
    insert_people(&mut fields, &record, "author", &["A"]);
    insert_people(&mut fields, &record, "editor", &["E"]);
    insert_all_joined(&mut fields, &record, "keywords", &["K"], ", ");
    normalize_year(&mut fields);
    if fields.is_empty() {
        return None;
    }
    Some(ImportedBibliographyEntry {
        entry_type,
        citation_key: first_value(&record, &["F", "L"]),
        fields,
    })
}

fn parse_pubmed_medline(content: &str) -> ImportedBibliography {
    let mut records = Vec::new();
    let mut current: HashMap<String, Vec<String>> = HashMap::new();
    let mut last_tag: Option<String> = None;

    for line in content.lines() {
        if line.trim().is_empty() {
            if !current.is_empty() {
                records.push(std::mem::take(&mut current));
                last_tag = None;
            }
            continue;
        }
        if line.len() >= 6 && line.as_bytes().get(4..6) == Some(b"- ") {
            let tag = line[..4].trim().to_ascii_uppercase();
            let value = line[6..].trim().to_string();
            if tag == "PMID" && !current.is_empty() {
                records.push(std::mem::take(&mut current));
            }
            current.entry(tag.clone()).or_default().push(value);
            last_tag = Some(tag);
        } else if line.starts_with(' ') || line.starts_with('\t') {
            if let Some(tag) = &last_tag {
                if let Some(values) = current.get_mut(tag) {
                    if let Some(last) = values.last_mut() {
                        if !last.is_empty() {
                            last.push(' ');
                        }
                        last.push_str(line.trim());
                    }
                }
            }
        }
    }
    if !current.is_empty() {
        records.push(current);
    }

    let entries = records
        .into_iter()
        .filter_map(pubmed_record_to_entry)
        .collect::<Vec<_>>();
    let diagnostics = if entries.is_empty() {
        vec![diagnostic(
            "No PubMed/MEDLINE records were found",
            0,
            content.len(),
        )]
    } else {
        Vec::new()
    };
    ImportedBibliography {
        format: "pubmed".to_string(),
        entries,
        diagnostics,
    }
}

fn pubmed_record_to_entry(
    record: HashMap<String, Vec<String>>,
) -> Option<ImportedBibliographyEntry> {
    let mut fields = BTreeMap::new();
    insert_first(&mut fields, &record, "title", &["TI"]);
    insert_first(&mut fields, &record, "journal", &["JT", "TA"]);
    insert_first(&mut fields, &record, "date", &["DP"]);
    insert_first(&mut fields, &record, "volume", &["VI"]);
    insert_first(&mut fields, &record, "number", &["IP"]);
    insert_first(&mut fields, &record, "pages", &["PG"]);
    insert_first(&mut fields, &record, "abstract", &["AB"]);
    insert_first(&mut fields, &record, "language", &["LA"]);
    insert_people(&mut fields, &record, "author", &["AU"]);
    insert_all_joined(&mut fields, &record, "keywords", &["MH", "OT"], ", ");
    if let Some(pmid) = first_value(&record, &["PMID"]) {
        fields.insert("pmid".to_string(), pmid);
    }
    if let Some(doi) = pubmed_doi(&record) {
        fields.insert("doi".to_string(), doi);
    }
    normalize_year_from_date(&mut fields);
    if fields.is_empty() {
        return None;
    }
    Some(ImportedBibliographyEntry {
        entry_type: "article".to_string(),
        citation_key: first_value(&record, &["PMID"]).map(|pmid| format!("pmid{pmid}")),
        fields,
    })
}

fn parse_csl_json(content: &str) -> ImportedBibliography {
    let parsed = match serde_json::from_str::<Value>(content) {
        Ok(value) => value,
        Err(error) => {
            return ImportedBibliography {
                format: "csl-json".to_string(),
                entries: Vec::new(),
                diagnostics: vec![diagnostic(
                    &format!("Invalid CSL JSON: {error}"),
                    0,
                    content.len(),
                )],
            };
        }
    };
    let items = match parsed {
        Value::Array(items) => items,
        Value::Object(mut object) => match object.remove("items") {
            Some(Value::Array(items)) => items,
            _ => vec![Value::Object(object)],
        },
        _ => Vec::new(),
    };
    let entries = items
        .iter()
        .filter_map(csl_item_to_entry)
        .collect::<Vec<_>>();
    let diagnostics = if entries.is_empty() {
        vec![diagnostic(
            "No CSL JSON bibliography items were found",
            0,
            content.len(),
        )]
    } else {
        Vec::new()
    };
    ImportedBibliography {
        format: "csl-json".to_string(),
        entries,
        diagnostics,
    }
}

fn csl_item_to_entry(item: &Value) -> Option<ImportedBibliographyEntry> {
    let object = item.as_object()?;
    let entry_type = object
        .get("type")
        .and_then(Value::as_str)
        .map(map_csl_type)
        .unwrap_or_else(|| "misc".to_string());
    let mut fields = BTreeMap::new();
    csl_string(&mut fields, object, "title", "title");
    csl_string(&mut fields, object, "container-title", "journal");
    csl_string(&mut fields, object, "collection-title", "series");
    csl_string(&mut fields, object, "publisher", "publisher");
    csl_string(&mut fields, object, "publisher-place", "location");
    csl_string(&mut fields, object, "volume", "volume");
    csl_string(&mut fields, object, "issue", "number");
    csl_string(&mut fields, object, "page", "pages");
    csl_string(&mut fields, object, "DOI", "doi");
    csl_string(&mut fields, object, "ISBN", "isbn");
    csl_string(&mut fields, object, "ISSN", "issn");
    csl_string(&mut fields, object, "URL", "url");
    csl_string(&mut fields, object, "abstract", "abstract");
    csl_string(&mut fields, object, "language", "language");
    csl_names(&mut fields, object, "author", "author");
    csl_names(&mut fields, object, "editor", "editor");
    csl_names(&mut fields, object, "translator", "translator");
    if let Some(year) = csl_year(object.get("issued")) {
        fields.insert("year".to_string(), year);
    }
    if let Some(date) = csl_raw_date(object.get("issued")) {
        fields.insert("date".to_string(), date);
    }
    if fields.is_empty() {
        return None;
    }
    Some(ImportedBibliographyEntry {
        entry_type,
        citation_key: object
            .get("citation-key")
            .or_else(|| object.get("id"))
            .and_then(csl_id_to_string),
        fields,
    })
}

fn insert_first(
    fields: &mut BTreeMap<String, String>,
    record: &HashMap<String, Vec<String>>,
    field_name: &str,
    tags: &[&str],
) {
    if let Some(value) = first_value(record, tags) {
        let value = clean_scalar(&value);
        if !value.is_empty() {
            fields.insert(field_name.to_string(), value);
        }
    }
}

fn insert_people(
    fields: &mut BTreeMap<String, String>,
    record: &HashMap<String, Vec<String>>,
    field_name: &str,
    tags: &[&str],
) {
    let values = values(record, tags);
    if !values.is_empty() {
        fields.insert(field_name.to_string(), values.join(" and "));
    }
}

fn insert_all_joined(
    fields: &mut BTreeMap<String, String>,
    record: &HashMap<String, Vec<String>>,
    field_name: &str,
    tags: &[&str],
    separator: &str,
) {
    let values = values(record, tags);
    if !values.is_empty() {
        fields.insert(field_name.to_string(), values.join(separator));
    }
}

fn insert_pages(fields: &mut BTreeMap<String, String>, record: &HashMap<String, Vec<String>>) {
    let start = first_value(record, &["SP"]);
    let end = first_value(record, &["EP"]);
    match (start, end) {
        (Some(start), Some(end)) if !end.is_empty() => {
            fields.insert("pages".to_string(), format!("{start}--{end}"));
        }
        (Some(start), _) => {
            fields.insert("pages".to_string(), start);
        }
        _ => insert_first(fields, record, "pages", &["PG"]),
    }
}

fn first_value(record: &HashMap<String, Vec<String>>, tags: &[&str]) -> Option<String> {
    tags.iter()
        .find_map(|tag| record.get(*tag).and_then(|values| values.first()))
        .map(|value| clean_scalar(value))
        .filter(|value| !value.is_empty())
}

fn values(record: &HashMap<String, Vec<String>>, tags: &[&str]) -> Vec<String> {
    tags.iter()
        .filter_map(|tag| record.get(*tag))
        .flat_map(|values| values.iter())
        .map(|value| clean_scalar(value))
        .filter(|value| !value.is_empty())
        .collect()
}

fn pubmed_doi(record: &HashMap<String, Vec<String>>) -> Option<String> {
    values(record, &["AID", "LID"])
        .into_iter()
        .find_map(|value| {
            let lower = value.to_ascii_lowercase();
            if lower.contains("[doi]") {
                Some(
                    value
                        .replace("[doi]", "")
                        .replace("[DOI]", "")
                        .trim()
                        .to_string(),
                )
            } else if value.starts_with("10.") {
                Some(value)
            } else {
                None
            }
        })
}

fn normalize_year(fields: &mut BTreeMap<String, String>) {
    if let Some(year) = fields.get("year").cloned() {
        if let Some(normalized) = first_four_digit_year(&year) {
            fields.insert("year".to_string(), normalized);
        }
    }
}

fn normalize_year_from_date(fields: &mut BTreeMap<String, String>) {
    if fields.contains_key("year") {
        return;
    }
    if let Some(date) = fields.get("date").cloned() {
        if let Some(year) = first_four_digit_year(&date) {
            fields.insert("year".to_string(), year);
        }
    }
}

fn first_four_digit_year(value: &str) -> Option<String> {
    value
        .as_bytes()
        .windows(4)
        .find(|window| window.iter().all(u8::is_ascii_digit))
        .map(|window| String::from_utf8_lossy(window).to_string())
}

fn csl_string(
    fields: &mut BTreeMap<String, String>,
    object: &serde_json::Map<String, Value>,
    csl_key: &str,
    bib_key: &str,
) {
    if let Some(value) = object.get(csl_key).and_then(csl_value_to_string) {
        fields.insert(bib_key.to_string(), value);
    }
}

fn csl_names(
    fields: &mut BTreeMap<String, String>,
    object: &serde_json::Map<String, Value>,
    csl_key: &str,
    bib_key: &str,
) {
    let Some(Value::Array(names)) = object.get(csl_key) else {
        return;
    };
    let values = names.iter().filter_map(csl_name).collect::<Vec<_>>();
    if !values.is_empty() {
        fields.insert(bib_key.to_string(), values.join(" and "));
    }
}

fn csl_name(value: &Value) -> Option<String> {
    let object = value.as_object()?;
    if let Some(literal) = object.get("literal").and_then(Value::as_str) {
        return Some(clean_scalar(literal));
    }
    let family = object
        .get("family")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    let given = object
        .get("given")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    match (family.is_empty(), given.is_empty()) {
        (false, false) => Some(format!("{family}, {given}")),
        (false, true) => Some(family.to_string()),
        (true, false) => Some(given.to_string()),
        (true, true) => None,
    }
}

fn csl_year(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::Object(object) => {
            if let Some(Value::Array(parts)) = object.get("date-parts") {
                return parts
                    .first()
                    .and_then(Value::as_array)
                    .and_then(|part| part.first())
                    .and_then(csl_id_to_string);
            }
            object
                .get("raw")
                .and_then(Value::as_str)
                .and_then(first_four_digit_year)
        }
        _ => None,
    }
}

fn csl_raw_date(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::Object(object) => object
            .get("raw")
            .and_then(Value::as_str)
            .map(clean_scalar)
            .or_else(|| csl_year(value)),
        _ => None,
    }
}

fn csl_value_to_string(value: &Value) -> Option<String> {
    match value {
        Value::String(value) => Some(clean_scalar(value)),
        Value::Number(_) | Value::Bool(_) => Some(value.to_string()),
        Value::Array(values) => {
            let joined = values
                .iter()
                .filter_map(csl_value_to_string)
                .collect::<Vec<_>>()
                .join(", ");
            if joined.is_empty() {
                None
            } else {
                Some(joined)
            }
        }
        _ => None,
    }
    .filter(|value| !value.is_empty())
}

fn csl_id_to_string(value: &Value) -> Option<String> {
    match value {
        Value::String(value) => Some(clean_scalar(value)),
        Value::Number(_) => Some(value.to_string()),
        _ => None,
    }
    .filter(|value| !value.is_empty())
}

fn map_ris_type(value: &str) -> String {
    match value.trim().to_ascii_uppercase().as_str() {
        "JOUR" | "MGZN" | "NEWS" => "article",
        "BOOK" => "book",
        "CHAP" => "inbook",
        "CONF" | "CPAPER" => "inproceedings",
        "THES" => "thesis",
        "ELEC" | "WEB" => "online",
        "RPRT" => "report",
        _ => "misc",
    }
    .to_string()
}

fn map_endnote_type(value: &str) -> String {
    match value.trim().to_ascii_lowercase().as_str() {
        "journal article" => "article",
        "book" => "book",
        "book section" => "inbook",
        "conference paper" | "conference proceedings" => "inproceedings",
        "thesis" => "thesis",
        "web page" => "online",
        "report" => "report",
        _ => "misc",
    }
    .to_string()
}

fn map_csl_type(value: &str) -> String {
    match value.trim().to_ascii_lowercase().as_str() {
        "article" | "article-journal" | "article-magazine" | "article-newspaper" => "article",
        "book" => "book",
        "chapter" => "inbook",
        "paper-conference" => "inproceedings",
        "thesis" => "thesis",
        "webpage" | "post-weblog" => "online",
        "report" => "report",
        _ => "misc",
    }
    .to_string()
}

fn clean_scalar(value: &str) -> String {
    value
        .replace('\r', "")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .trim_end_matches('.')
        .to_string()
}

fn diagnostic(message: &str, byte_start: usize, byte_end: usize) -> BibDiagnostic {
    BibDiagnostic {
        message: message.to_string(),
        byte_start,
        byte_end,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn imports_ris_records() {
        let imported = import_bibliography(
            "TY  - JOUR\nAU  - Doe, Jane\nTI  - RIS Title\nPY  - 2024/01/01\nDO  - 10.1/example\nER  -\n",
            Some("ris"),
        );
        assert_eq!(imported.entries.len(), 1);
        assert_eq!(imported.entries[0].entry_type, "article");
        assert_eq!(
            imported.entries[0].fields.get("author").unwrap(),
            "Doe, Jane"
        );
        assert_eq!(imported.entries[0].fields.get("year").unwrap(), "2024");
    }

    #[test]
    fn imports_csl_json_records() {
        let imported = import_bibliography(
            r#"[{"id":"doe2024","type":"article-journal","title":"CSL Title","author":[{"family":"Doe","given":"Jane"}],"issued":{"date-parts":[[2024]]},"DOI":"10.1/csl"}]"#,
            Some("csl-json"),
        );
        assert_eq!(imported.entries.len(), 1);
        assert_eq!(imported.entries[0].citation_key.as_deref(), Some("doe2024"));
        assert_eq!(
            imported.entries[0].fields.get("author").unwrap(),
            "Doe, Jane"
        );
        assert_eq!(imported.entries[0].fields.get("year").unwrap(), "2024");
    }

    #[test]
    fn imports_endnote_and_pubmed_records() {
        let endnote = import_bibliography(
            "%0 Journal Article\n%A Doe, Jane\n%T EndNote Title\n%D 2025\n%R 10.1/endnote\n",
            Some("endnote"),
        );
        assert_eq!(endnote.entries.len(), 1);
        assert_eq!(endnote.entries[0].entry_type, "article");

        let pubmed = import_bibliography(
            "PMID- 12345\nAU  - Doe J\nTI  - PubMed Title\nDP  - 2026 Jan\nAID - 10.1/pubmed [doi]\n",
            Some("pubmed"),
        );
        assert_eq!(pubmed.entries.len(), 1);
        assert_eq!(pubmed.entries[0].citation_key.as_deref(), Some("pmid12345"));
        assert_eq!(pubmed.entries[0].fields.get("doi").unwrap(), "10.1/pubmed");
        assert_eq!(pubmed.entries[0].fields.get("year").unwrap(), "2026");
    }
}
