use super::{
    BuilderBuildProfileRequirement, BuilderOutput, BuilderPackageRequirement, BuilderWarning,
    BuilderWarningSeverity,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SiunitxUnitComponent {
    pub prefix: String,
    pub unit: String,
    pub power: String,
    pub per: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SiunitxBuilderRequest {
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    pub snippet_mode: String,
    pub number: String,
    pub exponent_mode: String,
    pub round_mode: String,
    pub round_precision: u32,
    #[serde(default)]
    pub units: Vec<SiunitxUnitComponent>,
    pub list_content: String,
    pub range_start: String,
    pub range_end: String,
    pub per_mode: String,
    pub inter_unit_product: String,
    pub range_phrase: String,
    #[serde(default)]
    pub compatibility_warnings: Vec<BuilderWarning>,
}

pub type SiunitxBuilderOutput = BuilderOutput;

impl Default for SiunitxBuilderRequest {
    fn default() -> Self {
        Self {
            enabled: true,
            snippet_mode: "qty".to_string(),
            number: "10.5".to_string(),
            exponent_mode: "input".to_string(),
            round_mode: "none".to_string(),
            round_precision: 2,
            units: vec![SiunitxUnitComponent {
                prefix: "\\kilo".to_string(),
                unit: "\\meter".to_string(),
                power: String::new(),
                per: false,
            }],
            list_content: "10; 20; 30".to_string(),
            range_start: "5".to_string(),
            range_end: "10".to_string(),
            per_mode: "power".to_string(),
            inter_unit_product: "thin".to_string(),
            range_phrase: "to".to_string(),
            compatibility_warnings: Vec::new(),
        }
    }
}

pub fn generate_siunitx(request: SiunitxBuilderRequest) -> SiunitxBuilderOutput {
    if !request.enabled {
        return SiunitxBuilderOutput::empty("siunitx");
    }

    let request = normalize_request(request);
    let code = match request.snippet_mode.as_str() {
        "num" => format_num(&request),
        "unit" => format!("\\unit{{{}}}", format_units(&request.units)),
        "qtylist" => format_qtylist(&request),
        "qtyrange" => format_qtyrange(&request),
        "setup" => format_setup(&request),
        _ => format_qty(&request),
    };

    SiunitxBuilderOutput {
        schema_version: 1,
        builder_id: "siunitx".to_string(),
        code,
        requirements: vec![BuilderPackageRequirement {
            package_id: "siunitx".to_string(),
            options: Vec::new(),
        }],
        build_profile: BuilderBuildProfileRequirement::default(),
        warnings: siunitx_warnings(&request),
    }
}

fn siunitx_warnings(request: &SiunitxBuilderRequest) -> Vec<BuilderWarning> {
    let mut warnings = request.compatibility_warnings.clone();

    if matches!(request.snippet_mode.as_str(), "num" | "qty")
        && sanitize_number(&request.number).is_empty()
    {
        warnings.push(BuilderWarning {
            code: "siunitx-empty-number".to_string(),
            severity: BuilderWarningSeverity::Warning,
            message:
                "The generated snippet has an empty number argument; enter a value before inserting it into the document."
                    .to_string(),
            package_id: Some("siunitx".to_string()),
        });
    }

    if request.snippet_mode == "qtylist" {
        let count = sanitized_list_values(request).len();
        if count < 2 {
            warnings.push(BuilderWarning {
                code: "siunitx-short-list".to_string(),
                severity: BuilderWarningSeverity::Info,
                message:
                    "\\qtylist is most useful with two or more values; use \\qty for a single quantity."
                        .to_string(),
                package_id: Some("siunitx".to_string()),
            });
        }
    }

    if request.snippet_mode == "qtyrange"
        && (sanitize_number(&request.range_start).is_empty()
            || sanitize_number(&request.range_end).is_empty())
    {
        warnings.push(BuilderWarning {
            code: "siunitx-incomplete-range".to_string(),
            severity: BuilderWarningSeverity::Warning,
            message:
                "\\qtyrange needs both start and end values; fill both bounds before insertion."
                    .to_string(),
            package_id: Some("siunitx".to_string()),
        });
    }

    if request.round_mode == "uncertainty" && request.round_precision > 0 {
        warnings.push(BuilderWarning {
            code: "siunitx-uncertainty-precision-ignored".to_string(),
            severity: BuilderWarningSeverity::Info,
            message:
                "round-precision is not emitted for round-mode=uncertainty in this builder; siunitx will use uncertainty-aware rounding."
                    .to_string(),
            package_id: Some("siunitx".to_string()),
        });
    }

    if request
        .units
        .iter()
        .any(|unit| !unit.prefix.is_empty() && is_non_prefix_friendly_unit(&unit.unit))
    {
        warnings.push(BuilderWarning {
            code: "siunitx-prefix-on-special-unit".to_string(),
            severity: BuilderWarningSeverity::Warning,
            message:
                "A prefix is attached to a special/non-SI unit such as percent, degree, Celsius, bit, or byte. Verify that this is intended."
                    .to_string(),
            package_id: Some("siunitx".to_string()),
        });
    }

    warnings
}

fn normalize_request(mut request: SiunitxBuilderRequest) -> SiunitxBuilderRequest {
    if !matches!(
        request.snippet_mode.as_str(),
        "qty" | "num" | "unit" | "qtylist" | "qtyrange" | "setup"
    ) {
        request.snippet_mode = "qty".to_string();
    }
    if !matches!(
        request.exponent_mode.as_str(),
        "input" | "scientific" | "engineering" | "fixed"
    ) {
        request.exponent_mode = "input".to_string();
    }
    if !matches!(
        request.round_mode.as_str(),
        "none" | "places" | "figures" | "uncertainty"
    ) {
        request.round_mode = "none".to_string();
    }
    request.round_precision = request.round_precision.min(20);
    request.per_mode =
        sanitize_choice(&request.per_mode, &["power", "fraction", "symbol"], "power");
    request.inter_unit_product = sanitize_choice(
        &request.inter_unit_product,
        &["thin", "tight", "cdot"],
        "thin",
    );
    request.range_phrase = sanitize_choice(&request.range_phrase, &["to", "--"], "to");
    request.units = request
        .units
        .into_iter()
        .filter_map(sanitize_unit_component)
        .collect();
    if request.units.is_empty() {
        request.units.push(SiunitxUnitComponent {
            prefix: String::new(),
            unit: "\\meter".to_string(),
            power: String::new(),
            per: false,
        });
    }
    request
}

fn format_num(request: &SiunitxBuilderRequest) -> String {
    let options = format_number_options(request);
    format!("\\num{}{{{}}}", options, sanitize_number(&request.number))
}

fn format_qty(request: &SiunitxBuilderRequest) -> String {
    let options = format_number_options(request);
    format!(
        "\\qty{}{{{}}}{{{}}}",
        options,
        sanitize_number(&request.number),
        format_units(&request.units)
    )
}

fn format_qtylist(request: &SiunitxBuilderRequest) -> String {
    let options = format_number_options(request);
    let list = sanitized_list_values(request).join(";");
    format!(
        "\\qtylist{}{{{}}}{{{}}}",
        options,
        list,
        format_units(&request.units)
    )
}

fn sanitized_list_values(request: &SiunitxBuilderRequest) -> Vec<String> {
    request
        .list_content
        .split(';')
        .map(sanitize_number)
        .filter(|value| !value.is_empty())
        .collect()
}

fn format_qtyrange(request: &SiunitxBuilderRequest) -> String {
    let options = format_number_options(request);
    format!(
        "\\qtyrange{}{{{}}}{{{}}}{{{}}}",
        options,
        sanitize_number(&request.range_start),
        sanitize_number(&request.range_end),
        format_units(&request.units)
    )
}

fn format_setup(request: &SiunitxBuilderRequest) -> String {
    let product = match request.inter_unit_product.as_str() {
        "tight" => "\\!",
        "cdot" => "\\cdot",
        _ => "\\,",
    };
    let phrase = if request.range_phrase == "--" {
        "--"
    } else {
        "to"
    };
    format!(
        "\\sisetup{{\n  per-mode = {},\n  inter-unit-product = \\ensuremath{{{{{}}}}},\n  range-phrase = {{{}}}\n}}",
        request.per_mode, product, phrase
    )
}

fn format_number_options(request: &SiunitxBuilderRequest) -> String {
    let mut options = Vec::new();
    match request.exponent_mode.as_str() {
        "scientific" => options.push("exponent-mode=scientific".to_string()),
        "engineering" => options.push("exponent-mode=engineering".to_string()),
        "fixed" => options.push("exponent-mode=fixed".to_string()),
        _ => {}
    }
    match request.round_mode.as_str() {
        "places" | "figures" => {
            options.push(format!("round-mode={}", request.round_mode));
            options.push(format!("round-precision={}", request.round_precision));
        }
        "uncertainty" => options.push("round-mode=uncertainty".to_string()),
        _ => {}
    }
    if options.is_empty() {
        String::new()
    } else {
        format!("[{}]", options.join(", "))
    }
}

fn format_units(units: &[SiunitxUnitComponent]) -> String {
    units
        .iter()
        .map(|unit| {
            let mut code = String::new();
            if unit.per {
                code.push_str("\\per");
            }
            code.push_str(&unit.prefix);
            code.push_str(&unit.unit);
            code.push_str(&unit.power);
            code
        })
        .collect::<Vec<_>>()
        .join("")
}

fn sanitize_unit_component(component: SiunitxUnitComponent) -> Option<SiunitxUnitComponent> {
    let prefix = sanitize_macro_fragment(&component.prefix)?;
    let unit = sanitize_macro_fragment(&component.unit)?;
    let power = sanitize_power(&component.power)?;
    if unit.is_empty() {
        return None;
    }
    Some(SiunitxUnitComponent {
        prefix,
        unit,
        power,
        per: component.per,
    })
}

fn sanitize_macro_fragment(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty() {
        return Some(String::new());
    }
    if value.len() <= 48
        && value.starts_with('\\')
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphabetic() || ch == '\\')
    {
        Some(value.to_string())
    } else {
        None
    }
}

fn sanitize_power(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty() || matches!(value, "\\squared" | "\\cubed") {
        return Some(value.to_string());
    }
    if value.len() <= 8
        && value.starts_with("^{")
        && value.ends_with('}')
        && value[2..value.len() - 1]
            .chars()
            .all(|ch| ch.is_ascii_digit() || ch == '-')
    {
        Some(value.to_string())
    } else {
        None
    }
}

fn sanitize_number(value: &str) -> String {
    value
        .trim()
        .chars()
        .filter(|ch| {
            ch.is_ascii_alphanumeric()
                || matches!(ch, '+' | '-' | '.' | ',' | ';' | 'e' | 'E' | '(' | ')')
        })
        .collect()
}

fn sanitize_choice(value: &str, allowed: &[&str], fallback: &str) -> String {
    let value = value.trim();
    if allowed.contains(&value) {
        value.to_string()
    } else {
        fallback.to_string()
    }
}

fn is_non_prefix_friendly_unit(value: &str) -> bool {
    matches!(
        value,
        "\\degreeCelsius"
            | "\\degree"
            | "\\arcminute"
            | "\\arcsecond"
            | "\\percent"
            | "\\permille"
            | "\\bit"
            | "\\byte"
    )
}

const fn default_enabled() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_siunitx_generates_quantity_and_requirement() {
        let output = generate_siunitx(SiunitxBuilderRequest::default());

        assert_eq!(output.builder_id, "siunitx");
        assert_eq!(output.requirements[0].package_id, "siunitx");
        assert_eq!(output.code, "\\qty{10.5}{\\kilo\\meter}");
    }

    #[test]
    fn siunitx_generates_number_options() {
        let output = generate_siunitx(SiunitxBuilderRequest {
            snippet_mode: "num".to_string(),
            number: "1234.567".to_string(),
            exponent_mode: "scientific".to_string(),
            round_mode: "places".to_string(),
            round_precision: 2,
            ..SiunitxBuilderRequest::default()
        });

        assert_eq!(
            output.code,
            "\\num[exponent-mode=scientific, round-mode=places, round-precision=2]{1234.567}"
        );
    }

    #[test]
    fn siunitx_generates_lists_ranges_and_setup() {
        let list = generate_siunitx(SiunitxBuilderRequest {
            snippet_mode: "qtylist".to_string(),
            list_content: "1; 2; 3".to_string(),
            ..SiunitxBuilderRequest::default()
        });
        assert!(list.code.contains("\\qtylist{1;2;3}{\\kilo\\meter}"));

        let range = generate_siunitx(SiunitxBuilderRequest {
            snippet_mode: "qtyrange".to_string(),
            range_start: "5".to_string(),
            range_end: "10".to_string(),
            ..SiunitxBuilderRequest::default()
        });
        assert!(range.code.contains("\\qtyrange{5}{10}{\\kilo\\meter}"));

        let setup = generate_siunitx(SiunitxBuilderRequest {
            snippet_mode: "setup".to_string(),
            per_mode: "symbol".to_string(),
            inter_unit_product: "cdot".to_string(),
            range_phrase: "--".to_string(),
            ..SiunitxBuilderRequest::default()
        });
        assert!(setup.code.contains("per-mode = symbol"));
        assert!(setup
            .code
            .contains("inter-unit-product = \\ensuremath{{\\cdot}}"));
        assert!(setup.code.contains("range-phrase = {--}"));
    }

    #[test]
    fn siunitx_reports_input_diagnostics() {
        let empty_number = generate_siunitx(SiunitxBuilderRequest {
            snippet_mode: "qty".to_string(),
            number: "   ".to_string(),
            ..SiunitxBuilderRequest::default()
        });
        assert!(empty_number
            .warnings
            .iter()
            .any(|warning| warning.code == "siunitx-empty-number"));

        let short_list = generate_siunitx(SiunitxBuilderRequest {
            snippet_mode: "qtylist".to_string(),
            list_content: "42".to_string(),
            ..SiunitxBuilderRequest::default()
        });
        assert!(short_list
            .warnings
            .iter()
            .any(|warning| warning.code == "siunitx-short-list"));

        let incomplete_range = generate_siunitx(SiunitxBuilderRequest {
            snippet_mode: "qtyrange".to_string(),
            range_end: String::new(),
            ..SiunitxBuilderRequest::default()
        });
        assert!(incomplete_range
            .warnings
            .iter()
            .any(|warning| warning.code == "siunitx-incomplete-range"));
    }

    #[test]
    fn siunitx_reports_option_and_unit_diagnostics() {
        let uncertainty = generate_siunitx(SiunitxBuilderRequest {
            round_mode: "uncertainty".to_string(),
            round_precision: 4,
            ..SiunitxBuilderRequest::default()
        });
        assert!(uncertainty
            .warnings
            .iter()
            .any(|warning| warning.code == "siunitx-uncertainty-precision-ignored"));

        let special_unit = generate_siunitx(SiunitxBuilderRequest {
            units: vec![SiunitxUnitComponent {
                prefix: "\\kilo".to_string(),
                unit: "\\percent".to_string(),
                power: String::new(),
                per: false,
            }],
            ..SiunitxBuilderRequest::default()
        });
        assert!(special_unit
            .warnings
            .iter()
            .any(|warning| warning.code == "siunitx-prefix-on-special-unit"));
    }
}
