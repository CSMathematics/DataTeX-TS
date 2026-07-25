use super::{
    BuilderBuildProfileRequirement, BuilderOutput, BuilderPackageRequirement, BuilderWarning,
    BuilderWarningSeverity,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct XcolorDefinition {
    pub name: String,
    pub model: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct XcolorAlias {
    pub name: String,
    pub primary: String,
    pub percentage: u8,
    pub secondary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct XcolorBuilderRequest {
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default)]
    pub package_options: Vec<String>,
    #[serde(default)]
    pub colors: Vec<XcolorDefinition>,
    #[serde(default)]
    pub aliases: Vec<XcolorAlias>,
}

pub type XcolorBuilderOutput = BuilderOutput;

impl Default for XcolorBuilderRequest {
    fn default() -> Self {
        Self {
            enabled: true,
            package_options: vec!["table".to_string(), "dvipsnames".to_string()],
            colors: vec![
                XcolorDefinition {
                    name: "datatexPrimary".to_string(),
                    model: "HTML".to_string(),
                    value: "228BE6".to_string(),
                },
                XcolorDefinition {
                    name: "datatexAccent".to_string(),
                    model: "HTML".to_string(),
                    value: "7950F2".to_string(),
                },
                XcolorDefinition {
                    name: "datatexSuccess".to_string(),
                    model: "HTML".to_string(),
                    value: "40C057".to_string(),
                },
            ],
            aliases: Vec::new(),
        }
    }
}

pub fn generate_xcolor(request: XcolorBuilderRequest) -> XcolorBuilderOutput {
    if !request.enabled {
        return XcolorBuilderOutput::empty("xcolor");
    }

    let package_options = sanitize_options(&request.package_options);
    let mut warnings = Vec::new();
    let mut seen = HashSet::new();
    let mut code = "% --- Xcolor Palette ---\n".to_string();

    for color in request.colors {
        let Some(name) = sanitize_color_name(&color.name) else {
            warnings.push(BuilderWarning {
                code: "invalid-xcolor-name".to_string(),
                severity: BuilderWarningSeverity::Warning,
                message: format!("Skipped invalid color name `{}`.", color.name),
                package_id: Some("xcolor".to_string()),
            });
            continue;
        };

        if seen.contains(&name) {
            warnings.push(BuilderWarning {
                code: "duplicate-xcolor-name".to_string(),
                severity: BuilderWarningSeverity::Warning,
                message: format!("Skipped duplicate color `{}`.", name),
                package_id: Some("xcolor".to_string()),
            });
            continue;
        }

        let Some(model) = sanitize_model(&color.model) else {
            warnings.push(BuilderWarning {
                code: "invalid-xcolor-model".to_string(),
                severity: BuilderWarningSeverity::Warning,
                message: format!(
                    "Skipped color `{}` because `{}` is not a supported xcolor model.",
                    name, color.model
                ),
                package_id: Some("xcolor".to_string()),
            });
            continue;
        };
        let Some(value) = sanitize_color_value(&model, &color.value) else {
            warnings.push(BuilderWarning {
                code: "invalid-xcolor-value".to_string(),
                severity: BuilderWarningSeverity::Warning,
                message: format!(
                    "Skipped color `{}` because `{}` is invalid for model `{}`.",
                    name, color.value, model
                ),
                package_id: Some("xcolor".to_string()),
            });
            continue;
        };
        seen.insert(name.clone());
        code.push_str(&format!("\\definecolor{{{name}}}{{{model}}}{{{value}}}\n"));
    }

    for alias in request.aliases {
        let Some(name) = sanitize_color_name(&alias.name) else {
            warnings.push(BuilderWarning {
                code: "invalid-xcolor-alias-name".to_string(),
                severity: BuilderWarningSeverity::Warning,
                message: format!("Skipped invalid color alias name `{}`.", alias.name),
                package_id: Some("xcolor".to_string()),
            });
            continue;
        };
        if seen.contains(&name) {
            warnings.push(BuilderWarning {
                code: "duplicate-xcolor-name".to_string(),
                severity: BuilderWarningSeverity::Warning,
                message: format!("Skipped duplicate color or alias `{}`.", name),
                package_id: Some("xcolor".to_string()),
            });
            continue;
        }
        let Some(primary) = sanitize_color_name(&alias.primary) else {
            warnings.push(BuilderWarning {
                code: "invalid-xcolor-alias-source".to_string(),
                severity: BuilderWarningSeverity::Warning,
                message: format!(
                    "Skipped alias `{}` because its primary color is invalid.",
                    name
                ),
                package_id: Some("xcolor".to_string()),
            });
            continue;
        };
        let Some(secondary) = sanitize_color_name(&alias.secondary) else {
            warnings.push(BuilderWarning {
                code: "invalid-xcolor-alias-source".to_string(),
                severity: BuilderWarningSeverity::Warning,
                message: format!(
                    "Skipped alias `{}` because its secondary color is invalid.",
                    name
                ),
                package_id: Some("xcolor".to_string()),
            });
            continue;
        };
        let expression = if alias.percentage >= 100 {
            primary
        } else {
            format!("{}!{}!{}", primary, alias.percentage, secondary)
        };
        seen.insert(name.clone());
        code.push_str(&format!("\\colorlet{{{name}}}{{{expression}}}\n"));
    }

    if code.trim() == "% --- Xcolor Palette ---" {
        code.clear();
    }

    XcolorBuilderOutput {
        schema_version: 1,
        builder_id: "xcolor".to_string(),
        code,
        requirements: vec![BuilderPackageRequirement {
            package_id: "xcolor".to_string(),
            options: package_options,
        }],
        build_profile: BuilderBuildProfileRequirement::default(),
        warnings,
    }
}

fn sanitize_options(options: &[String]) -> Vec<String> {
    options
        .iter()
        .map(|option| option.trim())
        .filter(|option| !option.is_empty())
        .filter(|option| {
            option
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'))
        })
        .map(ToString::to_string)
        .collect()
}

fn sanitize_color_name(name: &str) -> Option<String> {
    let name = name.trim();
    if name.is_empty() {
        return None;
    }
    if !name
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '_')
    {
        return None;
    }
    Some(name.to_string())
}

fn sanitize_model(model: &str) -> Option<String> {
    match model.trim() {
        "rgb" => Some("rgb".to_string()),
        "cmy" => Some("cmy".to_string()),
        "cmyk" => Some("cmyk".to_string()),
        "hsb" => Some("hsb".to_string()),
        "gray" => Some("gray".to_string()),
        "Gray" => Some("Gray".to_string()),
        "HSB" => Some("HSB".to_string()),
        other => match other.to_ascii_uppercase().as_str() {
            "RGB" | "RGB255" => Some("RGB".to_string()),
            "HTML" => Some("HTML".to_string()),
            _ => None,
        },
    }
}

fn sanitize_color_value(model: &str, value: &str) -> Option<String> {
    match model {
        "HTML" => {
            let hex = value.trim().trim_start_matches('#');
            if hex.len() == 6 && hex.chars().all(|ch| ch.is_ascii_hexdigit()) {
                Some(hex.to_ascii_uppercase())
            } else {
                None
            }
        }
        "RGB" => sanitize_integer_components(value, 3, 0, 255),
        "rgb" | "cmy" | "hsb" => sanitize_decimal_components(value, 3, 0.0, 1.0),
        "cmyk" => sanitize_decimal_components(value, 4, 0.0, 1.0),
        "gray" => sanitize_decimal_components(value, 1, 0.0, 1.0),
        "HSB" => sanitize_integer_components(value, 3, 0, 255),
        "Gray" => sanitize_integer_components(value, 1, 0, 15),
        _ => None,
    }
}

fn sanitize_decimal_components(value: &str, count: usize, min: f64, max: f64) -> Option<String> {
    let raw = value.split(',').map(str::trim).collect::<Vec<_>>();
    if raw.len() != count {
        return None;
    }
    let components = raw
        .iter()
        .map(|part| part.parse::<f64>().ok())
        .collect::<Option<Vec<_>>>()?;
    if components
        .iter()
        .any(|component| !component.is_finite() || *component < min || *component > max)
    {
        return None;
    }
    Some(
        components
            .into_iter()
            .map(format_decimal)
            .collect::<Vec<_>>()
            .join(","),
    )
}

fn sanitize_integer_components(value: &str, count: usize, min: i32, max: i32) -> Option<String> {
    let raw = value.split(',').map(str::trim).collect::<Vec<_>>();
    if raw.len() != count {
        return None;
    }
    let components = raw
        .iter()
        .map(|part| part.parse::<i32>().ok())
        .collect::<Option<Vec<_>>>()?;
    if components
        .iter()
        .any(|component| *component < min || *component > max)
    {
        return None;
    }
    Some(
        components
            .into_iter()
            .map(|component| component.to_string())
            .collect::<Vec<_>>()
            .join(","),
    )
}

fn format_decimal(value: f64) -> String {
    let mut formatted = format!("{value:.3}");
    while formatted.contains('.') && formatted.ends_with('0') {
        formatted.pop();
    }
    if formatted.ends_with('.') {
        formatted.pop();
    }
    formatted
}

const fn default_enabled() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_xcolor_generates_palette_and_requirement() {
        let output = generate_xcolor(XcolorBuilderRequest::default());

        assert!(output
            .code
            .contains("\\definecolor{datatexPrimary}{HTML}{228BE6}"));
        assert_eq!(output.requirements[0].package_id, "xcolor");
        assert_eq!(output.requirements[0].options, vec!["table", "dvipsnames"]);
        assert!(output.warnings.is_empty());
    }

    #[test]
    fn invalid_colors_are_skipped_and_names_remain_case_sensitive() {
        let output = generate_xcolor(XcolorBuilderRequest {
            colors: vec![
                XcolorDefinition {
                    name: "bad-name!".to_string(),
                    model: "HTML".to_string(),
                    value: "ffffff".to_string(),
                },
                XcolorDefinition {
                    name: "accent".to_string(),
                    model: "HTML".to_string(),
                    value: "#7950f2".to_string(),
                },
                XcolorDefinition {
                    name: "Accent".to_string(),
                    model: "HTML".to_string(),
                    value: "#000000".to_string(),
                },
            ],
            ..XcolorBuilderRequest::default()
        });

        assert!(output.code.contains("\\definecolor{accent}{HTML}{7950F2}"));
        assert!(!output.code.contains("bad-name"));
        assert!(output.code.contains("\\definecolor{Accent}{HTML}{000000}"));
        assert_eq!(output.warnings.len(), 1);
    }

    #[test]
    fn preserves_legacy_xcolor_models() {
        let output = generate_xcolor(XcolorBuilderRequest {
            package_options: vec![
                "table".to_string(),
                "cmyk".to_string(),
                "pdftex".to_string(),
            ],
            colors: vec![
                XcolorDefinition {
                    name: "screenRgb".to_string(),
                    model: "rgb".to_string(),
                    value: "0.1,0.2,0.3".to_string(),
                },
                XcolorDefinition {
                    name: "printCmyk".to_string(),
                    model: "cmyk".to_string(),
                    value: "0.12,0.5,0.88,0.1".to_string(),
                },
                XcolorDefinition {
                    name: "grayTone".to_string(),
                    model: "Gray".to_string(),
                    value: "12".to_string(),
                },
            ],
            ..XcolorBuilderRequest::default()
        });

        assert_eq!(
            output.requirements[0].options,
            vec!["table", "cmyk", "pdftex"]
        );
        assert!(output
            .code
            .contains("\\definecolor{screenRgb}{rgb}{0.1,0.2,0.3}"));
        assert!(output
            .code
            .contains("\\definecolor{printCmyk}{cmyk}{0.12,0.5,0.88,0.1}"));
        assert!(output.code.contains("\\definecolor{grayTone}{Gray}{12}"));
    }

    #[test]
    fn generates_colorlet_aliases_after_definitions() {
        let output = generate_xcolor(XcolorBuilderRequest {
            colors: vec![XcolorDefinition {
                name: "brandBlue".to_string(),
                model: "HTML".to_string(),
                value: "228BE6".to_string(),
            }],
            aliases: vec![XcolorAlias {
                name: "softBlue".to_string(),
                primary: "brandBlue".to_string(),
                percentage: 25,
                secondary: "white".to_string(),
            }],
            ..XcolorBuilderRequest::default()
        });

        let definition = output.code.find("\\definecolor{brandBlue}").unwrap();
        let alias = output
            .code
            .find("\\colorlet{softBlue}{brandBlue!25!white}")
            .unwrap();
        assert!(definition < alias);
    }

    #[test]
    fn rejects_wrong_component_counts_and_ranges() {
        let output = generate_xcolor(XcolorBuilderRequest {
            colors: vec![
                XcolorDefinition {
                    name: "shortRgb".to_string(),
                    model: "RGB".to_string(),
                    value: "255,10".to_string(),
                },
                XcolorDefinition {
                    name: "overflow".to_string(),
                    model: "rgb".to_string(),
                    value: "1.2,0,0".to_string(),
                },
            ],
            aliases: Vec::new(),
            ..XcolorBuilderRequest::default()
        });

        assert!(output.code.is_empty());
        assert_eq!(output.warnings.len(), 2);
    }
}
