use crate::bibliography::importers::ImportedBibliographyEntry;
use reqwest::{Client, StatusCode, Url};
use serde_json::Value;
use std::collections::BTreeMap;
use std::time::Duration;

const USER_AGENT: &str = "DataTeX/2.1.1 (desktop bibliography DOI lookup)";

#[derive(Debug, Clone)]
pub struct DoiLookupCandidate {
    pub provider: String,
    pub doi: String,
    pub entry: ImportedBibliographyEntry,
}

pub async fn lookup_doi(doi: &str, provider: Option<&str>) -> Result<DoiLookupCandidate, String> {
    let doi = normalize_doi(doi).ok_or_else(|| "Enter a valid DOI".to_string())?;
    let provider = provider
        .map(str::trim)
        .filter(|value| !value.is_empty() && !value.eq_ignore_ascii_case("auto"))
        .map(str::to_ascii_lowercase);
    let client = Client::builder()
        .timeout(Duration::from_secs(12))
        .user_agent(USER_AGENT)
        .build()
        .map_err(|error| format!("Failed to create DOI lookup client: {error}"))?;

    match provider.as_deref() {
        Some("crossref") => lookup_crossref(&client, &doi).await,
        Some("datacite") => lookup_datacite(&client, &doi).await,
        Some(other) => Err(format!("Unsupported DOI lookup provider '{other}'")),
        None => {
            let crossref_error = match lookup_crossref(&client, &doi).await {
                Ok(candidate) => return Ok(candidate),
                Err(error) => error,
            };
            match lookup_datacite(&client, &doi).await {
                Ok(candidate) => Ok(candidate),
                Err(datacite_error) => Err(format!(
                    "DOI lookup failed. Crossref: {crossref_error}. DataCite: {datacite_error}"
                )),
            }
        }
    }
}

async fn lookup_crossref(client: &Client, doi: &str) -> Result<DoiLookupCandidate, String> {
    let mut url = Url::parse("https://api.crossref.org/works/")
        .map_err(|error| format!("Invalid Crossref API URL: {error}"))?;
    url.path_segments_mut()
        .map_err(|_| "Invalid Crossref API base URL".to_string())?
        .push(doi);

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("Crossref request failed: {error}"))?;
    if response.status() == StatusCode::NOT_FOUND {
        return Err("DOI was not found by Crossref".to_string());
    }
    if !response.status().is_success() {
        return Err(format!("Crossref returned HTTP {}", response.status()));
    }
    let json = response
        .json::<Value>()
        .await
        .map_err(|error| format!("Crossref response was not valid JSON: {error}"))?;
    crossref_json_to_candidate(doi, &json)
}

async fn lookup_datacite(client: &Client, doi: &str) -> Result<DoiLookupCandidate, String> {
    let mut url = Url::parse("https://api.datacite.org/dois/")
        .map_err(|error| format!("Invalid DataCite API URL: {error}"))?;
    url.path_segments_mut()
        .map_err(|_| "Invalid DataCite API base URL".to_string())?
        .push(doi);

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("DataCite request failed: {error}"))?;
    if response.status() == StatusCode::NOT_FOUND {
        return Err("DOI was not found by DataCite".to_string());
    }
    if !response.status().is_success() {
        return Err(format!("DataCite returned HTTP {}", response.status()));
    }
    let json = response
        .json::<Value>()
        .await
        .map_err(|error| format!("DataCite response was not valid JSON: {error}"))?;
    datacite_json_to_candidate(doi, &json)
}

fn crossref_json_to_candidate(doi: &str, json: &Value) -> Result<DoiLookupCandidate, String> {
    let message = json
        .get("message")
        .and_then(Value::as_object)
        .ok_or_else(|| "Crossref response did not contain a work message".to_string())?;
    let mut fields = BTreeMap::new();
    insert_string_array_first(&mut fields, message, "title", "title");
    insert_string_array_first(&mut fields, message, "subtitle", "subtitle");
    insert_string_array_first(&mut fields, message, "container-title", "journal");
    insert_string_array_first(&mut fields, message, "publisher", "publisher");
    insert_string_array_first(&mut fields, message, "volume", "volume");
    insert_string_array_first(&mut fields, message, "issue", "number");
    insert_string_array_first(&mut fields, message, "page", "pages");
    insert_string_array_first(&mut fields, message, "URL", "url");
    insert_string_array_first(&mut fields, message, "abstract", "abstract");
    insert_string_array_joined(&mut fields, message, "ISBN", "isbn", ", ");
    insert_string_array_joined(&mut fields, message, "ISSN", "issn", ", ");
    fields.insert(
        "doi".to_string(),
        message
            .get("DOI")
            .and_then(Value::as_str)
            .map(clean_scalar)
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| doi.to_string()),
    );
    if let Some(author) = crossref_people(message.get("author")) {
        fields.insert("author".to_string(), author);
    }
    if let Some(editor) = crossref_people(message.get("editor")) {
        fields.insert("editor".to_string(), editor);
    }
    if let Some(year) = crossref_year(message) {
        fields.insert("year".to_string(), year);
    }

    let entry_type = message
        .get("type")
        .and_then(Value::as_str)
        .map(map_crossref_type)
        .unwrap_or_else(|| "misc".to_string());
    Ok(DoiLookupCandidate {
        provider: "crossref".to_string(),
        doi: fields
            .get("doi")
            .cloned()
            .unwrap_or_else(|| doi.to_string()),
        entry: ImportedBibliographyEntry {
            entry_type,
            citation_key: None,
            fields,
        },
    })
}

fn datacite_json_to_candidate(doi: &str, json: &Value) -> Result<DoiLookupCandidate, String> {
    let attributes = json
        .get("data")
        .and_then(|data| data.get("attributes"))
        .and_then(Value::as_object)
        .ok_or_else(|| "DataCite response did not contain DOI attributes".to_string())?;
    let mut fields = BTreeMap::new();
    if let Some(title) = datacite_title(attributes.get("titles")) {
        fields.insert("title".to_string(), title);
    }
    insert_plain(&mut fields, attributes, "publisher", "publisher");
    insert_plain(&mut fields, attributes, "url", "url");
    insert_plain(&mut fields, attributes, "language", "language");
    if let Some(year) = attributes
        .get("publicationYear")
        .and_then(|value| value.as_i64().map(|year| year.to_string()))
        .or_else(|| {
            attributes
                .get("publicationYear")
                .and_then(Value::as_str)
                .map(clean_scalar)
        })
    {
        fields.insert("year".to_string(), year);
    }
    if let Some(creators) = datacite_people(attributes.get("creators")) {
        fields.insert("author".to_string(), creators);
    }
    if let Some(contributors) = datacite_people(attributes.get("contributors")) {
        fields.insert("editor".to_string(), contributors);
    }
    if let Some(description) = datacite_description(attributes.get("descriptions")) {
        fields.insert("abstract".to_string(), description);
    }
    if let Some(subjects) = datacite_subjects(attributes.get("subjects")) {
        fields.insert("keywords".to_string(), subjects);
    }
    fields.insert(
        "doi".to_string(),
        attributes
            .get("doi")
            .and_then(Value::as_str)
            .map(clean_scalar)
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| doi.to_string()),
    );

    let entry_type = attributes
        .get("types")
        .and_then(|types| types.get("resourceTypeGeneral"))
        .and_then(Value::as_str)
        .map(map_datacite_type)
        .unwrap_or_else(|| "misc".to_string());
    Ok(DoiLookupCandidate {
        provider: "datacite".to_string(),
        doi: fields
            .get("doi")
            .cloned()
            .unwrap_or_else(|| doi.to_string()),
        entry: ImportedBibliographyEntry {
            entry_type,
            citation_key: None,
            fields,
        },
    })
}

fn normalize_doi(value: &str) -> Option<String> {
    let value = value
        .trim()
        .trim_start_matches("doi:")
        .trim_start_matches("DOI:")
        .trim();
    let value = value
        .strip_prefix("https://doi.org/")
        .or_else(|| value.strip_prefix("http://doi.org/"))
        .or_else(|| value.strip_prefix("https://dx.doi.org/"))
        .or_else(|| value.strip_prefix("http://dx.doi.org/"))
        .unwrap_or(value)
        .trim();
    if value.to_ascii_lowercase().starts_with("10.") && value.contains('/') {
        Some(value.to_string())
    } else {
        None
    }
}

fn insert_plain(
    fields: &mut BTreeMap<String, String>,
    object: &serde_json::Map<String, Value>,
    json_key: &str,
    field_name: &str,
) {
    if let Some(value) = object.get(json_key).and_then(Value::as_str) {
        let value = clean_scalar(value);
        if !value.is_empty() {
            fields.insert(field_name.to_string(), value);
        }
    }
}

fn insert_string_array_first(
    fields: &mut BTreeMap<String, String>,
    object: &serde_json::Map<String, Value>,
    json_key: &str,
    field_name: &str,
) {
    if let Some(value) = string_or_first_array(object.get(json_key)) {
        fields.insert(field_name.to_string(), value);
    }
}

fn insert_string_array_joined(
    fields: &mut BTreeMap<String, String>,
    object: &serde_json::Map<String, Value>,
    json_key: &str,
    field_name: &str,
    separator: &str,
) {
    let Some(value) = object.get(json_key) else {
        return;
    };
    let values = match value {
        Value::Array(values) => values
            .iter()
            .filter_map(Value::as_str)
            .map(clean_scalar)
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>(),
        Value::String(value) => vec![clean_scalar(value)],
        _ => Vec::new(),
    };
    if !values.is_empty() {
        fields.insert(field_name.to_string(), values.join(separator));
    }
}

fn string_or_first_array(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::String(value) => Some(clean_scalar(value)),
        Value::Array(values) => values.first().and_then(Value::as_str).map(clean_scalar),
        _ => None,
    }
    .filter(|value| !value.is_empty())
}

fn crossref_people(value: Option<&Value>) -> Option<String> {
    let values = value?
        .as_array()?
        .iter()
        .filter_map(|person| {
            let object = person.as_object()?;
            if let Some(name) = object.get("name").and_then(Value::as_str) {
                return Some(clean_scalar(name));
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
        })
        .collect::<Vec<_>>();
    if values.is_empty() {
        None
    } else {
        Some(values.join(" and "))
    }
}

fn datacite_people(value: Option<&Value>) -> Option<String> {
    let values = value?
        .as_array()?
        .iter()
        .filter_map(|person| {
            let object = person.as_object()?;
            let family = object
                .get("familyName")
                .and_then(Value::as_str)
                .unwrap_or("")
                .trim();
            let given = object
                .get("givenName")
                .and_then(Value::as_str)
                .unwrap_or("")
                .trim();
            if !family.is_empty() && !given.is_empty() {
                return Some(format!("{family}, {given}"));
            }
            object
                .get("name")
                .and_then(Value::as_str)
                .map(clean_scalar)
                .filter(|value| !value.is_empty())
        })
        .collect::<Vec<_>>();
    if values.is_empty() {
        None
    } else {
        Some(values.join(" and "))
    }
}

fn crossref_year(message: &serde_json::Map<String, Value>) -> Option<String> {
    [
        "published-print",
        "published-online",
        "published",
        "issued",
        "created",
    ]
    .iter()
    .find_map(|key| {
        message
            .get(*key)
            .and_then(|value| value.get("date-parts"))
            .and_then(Value::as_array)
            .and_then(|parts| parts.first())
            .and_then(Value::as_array)
            .and_then(|first| first.first())
            .and_then(|year| {
                year.as_i64()
                    .map(|value| value.to_string())
                    .or_else(|| year.as_str().map(clean_scalar))
            })
    })
}

fn datacite_title(value: Option<&Value>) -> Option<String> {
    value?
        .as_array()?
        .iter()
        .find_map(|item| item.get("title").and_then(Value::as_str))
        .map(clean_scalar)
        .filter(|value| !value.is_empty())
}

fn datacite_description(value: Option<&Value>) -> Option<String> {
    value?
        .as_array()?
        .iter()
        .find_map(|item| item.get("description").and_then(Value::as_str))
        .map(clean_scalar)
        .filter(|value| !value.is_empty())
}

fn datacite_subjects(value: Option<&Value>) -> Option<String> {
    let values = value?
        .as_array()?
        .iter()
        .filter_map(|item| item.get("subject").and_then(Value::as_str))
        .map(clean_scalar)
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    if values.is_empty() {
        None
    } else {
        Some(values.join(", "))
    }
}

fn map_crossref_type(value: &str) -> String {
    match value.trim().to_ascii_lowercase().as_str() {
        "journal-article" | "journal" => "article",
        "book" | "monograph" | "edited-book" => "book",
        "book-chapter" | "book-section" => "inbook",
        "proceedings-article" | "conference-paper" => "inproceedings",
        "proceedings" => "proceedings",
        "dissertation" => "thesis",
        "posted-content" | "webpage" => "online",
        "report" => "report",
        _ => "misc",
    }
    .to_string()
}

fn map_datacite_type(value: &str) -> String {
    match value.trim().to_ascii_lowercase().as_str() {
        "journalarticle" | "text" => "article",
        "book" => "book",
        "bookchapter" => "inbook",
        "conferencepaper" | "conferenceproceeding" => "inproceedings",
        "dissertation" => "thesis",
        "dataset" => "misc",
        "software" => "software",
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_common_doi_forms() {
        assert_eq!(
            normalize_doi("https://doi.org/10.1000/example").as_deref(),
            Some("10.1000/example")
        );
        assert_eq!(
            normalize_doi("doi:10.1000/example").as_deref(),
            Some("10.1000/example")
        );
        assert!(normalize_doi("not-a-doi").is_none());
    }

    #[test]
    fn maps_crossref_work_json() {
        let json = serde_json::json!({
            "message": {
                "type": "journal-article",
                "DOI": "10.1/crossref",
                "title": ["Crossref Title"],
                "container-title": ["Journal"],
                "author": [{"family": "Doe", "given": "Jane"}],
                "issued": {"date-parts": [[2024, 1, 2]]},
                "volume": "5",
                "issue": "2"
            }
        });
        let candidate = crossref_json_to_candidate("10.1/crossref", &json).unwrap();
        assert_eq!(candidate.provider, "crossref");
        assert_eq!(candidate.entry.entry_type, "article");
        assert_eq!(candidate.entry.fields.get("author").unwrap(), "Doe, Jane");
        assert_eq!(candidate.entry.fields.get("year").unwrap(), "2024");
    }

    #[test]
    fn maps_datacite_doi_json() {
        let json = serde_json::json!({
            "data": {
                "attributes": {
                    "doi": "10.1/datacite",
                    "types": {"resourceTypeGeneral": "Book"},
                    "titles": [{"title": "DataCite Title"}],
                    "creators": [{"familyName": "Reader", "givenName": "Rita"}],
                    "publisher": "DataCite Press",
                    "publicationYear": 2025,
                    "subjects": [{"subject": "metadata"}]
                }
            }
        });
        let candidate = datacite_json_to_candidate("10.1/datacite", &json).unwrap();
        assert_eq!(candidate.provider, "datacite");
        assert_eq!(candidate.entry.entry_type, "book");
        assert_eq!(
            candidate.entry.fields.get("author").unwrap(),
            "Reader, Rita"
        );
        assert_eq!(candidate.entry.fields.get("year").unwrap(), "2025");
    }
}
