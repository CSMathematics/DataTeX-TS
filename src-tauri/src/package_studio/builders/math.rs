use super::{
    BuilderBuildProfileRequirement, BuilderOutput, BuilderPackageRequirement, BuilderWarning,
    BuilderWarningSeverity,
};
use crate::package_studio::SourceRange;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MathBuilderRequest {
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    pub mode: String,
    pub environment_type: String,
    pub starred: bool,
    pub label: String,
    pub content: String,
    pub matrix_type: String,
    pub matrix_rows: u32,
    pub matrix_columns: u32,
    pub matrix_starred: bool,
    pub matrix_alignment: String,
    #[serde(default)]
    pub matrix_cells: Vec<Vec<String>>,
    pub tool_type: String,
    pub arrow_type: String,
    pub arrow_above: String,
    pub arrow_below: String,
    pub bracket_type: String,
    pub bracket_content: String,
    pub bracket_thickness: String,
    pub bracket_height: String,
    pub split_fraction_type: String,
    pub split_fraction_top: String,
    pub split_fraction_bottom: String,
    pub prescript_sup: String,
    pub prescript_sub: String,
    pub prescript_arg: String,
    pub delimiter_command: String,
    pub delimiter_left: String,
    pub delimiter_right: String,
    pub tag_action: String,
    pub tag_name: String,
    pub tag_left: String,
    pub tag_right: String,
    pub tag_format: String,
    pub tag_ref_label: String,
    pub delimiter_math_type: String,
    pub delimiter_math_content: String,
    #[serde(default)]
    pub imported_source_range: Option<SourceRange>,
}

pub type MathBuilderOutput = BuilderOutput;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MathImportedSnippet {
    pub id: String,
    pub kind: String,
    pub label: String,
    pub preview: String,
    pub line: usize,
    pub request: MathBuilderRequest,
}

impl Default for MathBuilderRequest {
    fn default() -> Self {
        Self {
            enabled: true,
            mode: "environment".to_string(),
            environment_type: "align".to_string(),
            starred: false,
            label: "eq:example".to_string(),
            content: "x &= y + z".to_string(),
            matrix_type: "pmatrix".to_string(),
            matrix_rows: 2,
            matrix_columns: 2,
            matrix_starred: false,
            matrix_alignment: "c".to_string(),
            matrix_cells: vec![
                vec!["a".to_string(), "b".to_string()],
                vec!["c".to_string(), "d".to_string()],
            ],
            tool_type: "arrow".to_string(),
            arrow_type: "xrightarrow".to_string(),
            arrow_above: "f".to_string(),
            arrow_below: String::new(),
            bracket_type: "underbracket".to_string(),
            bracket_content: "a + b".to_string(),
            bracket_thickness: String::new(),
            bracket_height: String::new(),
            split_fraction_type: "splitfrac".to_string(),
            split_fraction_top: "a + b".to_string(),
            split_fraction_bottom: "c + d".to_string(),
            prescript_sup: "14".to_string(),
            prescript_sub: "6".to_string(),
            prescript_arg: "C".to_string(),
            delimiter_command: "norm".to_string(),
            delimiter_left: "\\lVert".to_string(),
            delimiter_right: "\\rVert".to_string(),
            tag_action: "newtagform".to_string(),
            tag_name: "brackets".to_string(),
            tag_left: "[".to_string(),
            tag_right: "]".to_string(),
            tag_format: String::new(),
            tag_ref_label: "eq:example".to_string(),
            delimiter_math_type: "display_brackets".to_string(),
            delimiter_math_content: "E = mc^2".to_string(),
            imported_source_range: None,
        }
    }
}

pub fn generate_math(request: MathBuilderRequest) -> MathBuilderOutput {
    if !request.enabled {
        return MathBuilderOutput::empty("math");
    }

    let request = normalize_request(request);
    let code = match request.mode.as_str() {
        "matrix" => format_matrix(&request),
        "tool" => format_tool(&request),
        "tag" => format_tag(&request),
        "delimited" => format_delimited_math(&request),
        _ => format_environment(&request),
    };

    MathBuilderOutput {
        schema_version: 1,
        builder_id: "math".to_string(),
        code,
        requirements: package_requirements(&request),
        build_profile: BuilderBuildProfileRequirement::default(),
        warnings: math_warnings(&request),
    }
}

fn normalize_request(mut request: MathBuilderRequest) -> MathBuilderRequest {
    request.mode = choice(
        &request.mode,
        &["environment", "matrix", "tool", "tag", "delimited"],
        "environment",
    );
    request.environment_type = choice(
        &request.environment_type,
        &[
            "equation",
            "align",
            "aligned",
            "gather",
            "gathered",
            "lgathered",
            "rgathered",
            "multline",
            "flalign",
            "cases",
            "split",
            "dcases",
            "rcases",
        ],
        "align",
    );
    request.matrix_type = choice(
        &request.matrix_type,
        &[
            "pmatrix",
            "bmatrix",
            "Bmatrix",
            "vmatrix",
            "Vmatrix",
            "matrix",
            "smallmatrix",
        ],
        "pmatrix",
    );
    request.matrix_rows = request.matrix_rows.clamp(1, 12);
    request.matrix_columns = request.matrix_columns.clamp(1, 12);
    request.matrix_alignment = choice(&request.matrix_alignment, &["l", "c", "r"], "c");
    request.tool_type = choice(
        &request.tool_type,
        &[
            "arrow",
            "bracket",
            "split_fraction",
            "prescript",
            "delimiter",
        ],
        "arrow",
    );
    request.arrow_type = choice(
        &request.arrow_type,
        &[
            "xrightarrow",
            "xleftarrow",
            "xleftrightarrow",
            "xRightarrow",
            "xLeftarrow",
            "xLeftrightarrow",
            "xlongequal",
            "xmapsto",
            "xhookleftarrow",
            "xhookrightarrow",
            "xleftharpoondown",
            "xleftharpoonup",
            "xleftrightharpoons",
            "xrightharpoondown",
            "xrightharpoonup",
            "xrightleftharpoons",
        ],
        "xrightarrow",
    );
    request.bracket_type = choice(
        &request.bracket_type,
        &["underbracket", "overbracket", "underbrace", "overbrace"],
        "underbracket",
    );
    request.split_fraction_type = choice(
        &request.split_fraction_type,
        &["splitfrac", "splitdfrac"],
        "splitfrac",
    );
    request.tag_action = choice(
        &request.tag_action,
        &["newtagform", "usetagform", "eqref", "refeq", "noeqref"],
        "newtagform",
    );
    request.delimiter_math_type = choice(
        &request.delimiter_math_type,
        &[
            "inline_parens",
            "display_brackets",
            "inline_dollar",
            "display_dollars",
        ],
        "display_brackets",
    );
    request
}

fn package_requirements(request: &MathBuilderRequest) -> Vec<BuilderPackageRequirement> {
    if request.mode == "delimited" {
        return Vec::new();
    }

    let needs_mathtools = request.mode == "tool"
        || (request.mode == "tag"
            && matches!(
                request.tag_action.as_str(),
                "newtagform" | "usetagform" | "refeq" | "noeqref"
            ))
        || matches!(
            request.environment_type.as_str(),
            "lgathered" | "rgathered" | "dcases" | "rcases"
        )
        || request.matrix_starred;

    if needs_mathtools {
        vec![BuilderPackageRequirement {
            package_id: "mathtools".to_string(),
            options: Vec::new(),
        }]
    } else {
        vec![BuilderPackageRequirement {
            package_id: "amsmath".to_string(),
            options: Vec::new(),
        }]
    }
}

fn format_environment(request: &MathBuilderRequest) -> String {
    let name = if request.starred {
        format!("{}*", request.environment_type)
    } else {
        request.environment_type.clone()
    };
    let mut code = format!("\\begin{{{name}}}\n");
    let label = sanitize_text(&request.label);
    if !request.starred
        && !label.is_empty()
        && environment_supports_label(&request.environment_type)
    {
        code.push_str(&format!("  \\label{{{label}}}\n"));
    }
    code.push_str(&format!("  {}\n", environment_content(request)));
    code.push_str(&format!("\\end{{{name}}}"));
    code
}

fn environment_content(request: &MathBuilderRequest) -> String {
    let content = sanitize_multiline(&request.content);
    if !content.is_empty() {
        return content.replace('\n', "\n  ");
    }
    match request.environment_type.as_str() {
        "cases" | "dcases" | "rcases" => "x^2, & x \\ge 0 \\\\\n  -x, & x < 0".to_string(),
        "equation" => "E = mc^2".to_string(),
        _ => "x &= y + z \\\\\n  a &= b + c".to_string(),
    }
}

fn environment_supports_label(environment: &str) -> bool {
    !matches!(
        environment,
        "aligned"
            | "gathered"
            | "lgathered"
            | "rgathered"
            | "cases"
            | "split"
            | "dcases"
            | "rcases"
    )
}

fn format_matrix(request: &MathBuilderRequest) -> String {
    let mut name = request.matrix_type.clone();
    let mut suffix = String::new();
    if request.matrix_starred {
        name.push('*');
        suffix = format!("[{}]", request.matrix_alignment);
    }
    let rows = normalized_matrix_cells(request);
    let mut code = format!("\\begin{{{name}}}{suffix}\n");
    for (index, row) in rows.iter().enumerate() {
        code.push_str("  ");
        code.push_str(&row.join(" & "));
        if index + 1 < rows.len() {
            code.push_str(" \\\\");
        }
        code.push('\n');
    }
    code.push_str(&format!("\\end{{{name}}}"));
    code
}

fn normalized_matrix_cells(request: &MathBuilderRequest) -> Vec<Vec<String>> {
    (0..request.matrix_rows as usize)
        .map(|row_index| {
            (0..request.matrix_columns as usize)
                .map(|column_index| {
                    request
                        .matrix_cells
                        .get(row_index)
                        .and_then(|row| row.get(column_index))
                        .map(|value| sanitize_text(value))
                        .filter(|value| !value.is_empty())
                        .unwrap_or_else(|| {
                            let letter = (b'a'
                                + ((row_index * request.matrix_columns as usize + column_index)
                                    % 26) as u8) as char;
                            letter.to_string()
                        })
                })
                .collect()
        })
        .collect()
}

fn format_tool(request: &MathBuilderRequest) -> String {
    match request.tool_type.as_str() {
        "bracket" => format_bracket(request),
        "split_fraction" => format!(
            "\\{}{{{}}}{{{}}}",
            request.split_fraction_type,
            sanitize_text(&request.split_fraction_top),
            sanitize_text(&request.split_fraction_bottom)
        ),
        "prescript" => format!(
            "\\prescript{{{}}}{{{}}}{{{}}}",
            sanitize_text(&request.prescript_sup),
            sanitize_text(&request.prescript_sub),
            sanitize_text(&request.prescript_arg)
        ),
        "delimiter" => format!(
            "\\DeclarePairedDelimiter\\{}{{{}}}{{{}}}",
            sanitize_command_name(&request.delimiter_command),
            sanitize_text(&request.delimiter_left),
            sanitize_text(&request.delimiter_right)
        ),
        _ => format_arrow(request),
    }
}

fn format_arrow(request: &MathBuilderRequest) -> String {
    let mut code = format!("\\{}", request.arrow_type);
    let below = sanitize_text(&request.arrow_below);
    let above = sanitize_text(&request.arrow_above);
    if !below.is_empty() {
        code.push_str(&format!("[{below}]"));
    }
    code.push_str(&format!("{{{above}}}"));
    code
}

fn format_bracket(request: &MathBuilderRequest) -> String {
    let thickness = sanitize_dimension_like(&request.bracket_thickness);
    let height = sanitize_dimension_like(&request.bracket_height);
    let options = match (thickness.is_empty(), height.is_empty()) {
        (true, true) => String::new(),
        (false, true) => format!("[{thickness}]"),
        (true, false) => format!("[][{height}]"),
        (false, false) => format!("[{thickness}][{height}]"),
    };
    format!(
        "\\{}{}{{{}}}",
        request.bracket_type,
        options,
        sanitize_text(&request.bracket_content)
    )
}

fn format_tag(request: &MathBuilderRequest) -> String {
    let name = sanitize_command_name(&request.tag_name);
    match request.tag_action.as_str() {
        "usetagform" => format!("\\usetagform{{{name}}}"),
        "eqref" => format!("\\eqref{{{}}}", sanitize_label(&request.tag_ref_label)),
        "refeq" => format!("\\refeq{{{}}}", sanitize_label(&request.tag_ref_label)),
        "noeqref" => format!("\\noeqref{{{}}}", sanitize_label(&request.tag_ref_label)),
        _ => {
            let left = sanitize_text(&request.tag_left);
            let right = sanitize_text(&request.tag_right);
            let format = sanitize_text(&request.tag_format);
            if format.is_empty() {
                format!("\\newtagform{{{name}}}{{{left}}}{{{right}}}")
            } else {
                format!("\\newtagform{{{name}}}[{format}]{{{left}}}{{{right}}}")
            }
        }
    }
}

fn format_delimited_math(request: &MathBuilderRequest) -> String {
    let content = sanitize_multiline(&request.delimiter_math_content);
    let content = if content.trim().is_empty() {
        "E = mc^2".to_string()
    } else {
        content.trim().to_string()
    };

    match request.delimiter_math_type.as_str() {
        "inline_parens" => format!("\\({content}\\)"),
        "inline_dollar" => format!("${content}$"),
        "display_dollars" => format!("$$\n{content}\n$$"),
        _ => format!("\\[\n{content}\n\\]"),
    }
}

fn math_warnings(request: &MathBuilderRequest) -> Vec<BuilderWarning> {
    let mut warnings = Vec::new();

    if request.starred && !request.label.trim().is_empty() {
        warnings.push(BuilderWarning {
            code: "math-starred-label-ignored".to_string(),
            severity: BuilderWarningSeverity::Info,
            message: "Starred math environments are unnumbered, so labels are not emitted."
                .to_string(),
            package_id: Some(required_package(request)),
        });
    }

    if request.matrix_starred && request.matrix_type == "smallmatrix" {
        warnings.push(BuilderWarning {
            code: "math-smallmatrix-starred".to_string(),
            severity: BuilderWarningSeverity::Warning,
            message:
                "smallmatrix* is not broadly supported; verify output with your TeX distribution."
                    .to_string(),
            package_id: Some("mathtools".to_string()),
        });
    }

    if request.tool_type == "delimiter"
        && sanitize_command_name(&request.delimiter_command).is_empty()
    {
        warnings.push(BuilderWarning {
            code: "math-empty-delimiter-command".to_string(),
            severity: BuilderWarningSeverity::Warning,
            message: "DeclarePairedDelimiter needs a command name such as norm or abs.".to_string(),
            package_id: Some("mathtools".to_string()),
        });
    }

    if request.mode == "tag" {
        if matches!(request.tag_action.as_str(), "newtagform" | "usetagform")
            && sanitize_command_name(&request.tag_name).is_empty()
        {
            warnings.push(BuilderWarning {
                code: "math-empty-tag-form-name".to_string(),
                severity: BuilderWarningSeverity::Warning,
                message: "Tag form actions need a form name such as brackets or boldtag."
                    .to_string(),
                package_id: Some("mathtools".to_string()),
            });
        }
        if matches!(request.tag_action.as_str(), "refeq" | "noeqref")
            && sanitize_label(&request.tag_ref_label).is_empty()
        {
            warnings.push(BuilderWarning {
                code: "math-empty-tag-reference".to_string(),
                severity: BuilderWarningSeverity::Warning,
                message: "Equation tag reference actions need a label such as eq:main.".to_string(),
                package_id: Some("mathtools".to_string()),
            });
        }
    }

    warnings
}

fn required_package(request: &MathBuilderRequest) -> String {
    package_requirements(request)
        .first()
        .map(|requirement| requirement.package_id.clone())
        .unwrap_or_else(|| "amsmath".to_string())
}

fn choice(value: &str, allowed: &[&str], fallback: &str) -> String {
    let value = value.trim();
    if allowed.contains(&value) {
        value.to_string()
    } else {
        fallback.to_string()
    }
}

fn sanitize_text(value: &str) -> String {
    value
        .trim()
        .chars()
        .filter(|ch| *ch != '\0' && *ch != '\r')
        .collect()
}

fn sanitize_multiline(value: &str) -> String {
    value
        .lines()
        .map(sanitize_text)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

fn sanitize_command_name(value: &str) -> String {
    value
        .trim()
        .trim_start_matches('\\')
        .chars()
        .filter(|ch| ch.is_ascii_alphabetic())
        .take(32)
        .collect()
}

fn sanitize_label(value: &str) -> String {
    value
        .trim()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, ':' | '-' | '_' | '.' | '/'))
        .take(96)
        .collect()
}

fn sanitize_dimension_like(value: &str) -> String {
    let value = sanitize_text(value);
    if value.len() <= 24
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '\\'))
    {
        value
    } else {
        String::new()
    }
}

const fn default_enabled() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn math_generates_amsmath_environment() {
        let output = generate_math(MathBuilderRequest::default());

        assert_eq!(output.builder_id, "math");
        assert_eq!(output.requirements[0].package_id, "amsmath");
        assert!(output.code.contains("\\begin{align}"));
        assert!(output.code.contains("\\label{eq:example}"));
    }

    #[test]
    fn math_generates_mathtools_matrix_and_tools() {
        let matrix = generate_math(MathBuilderRequest {
            mode: "matrix".to_string(),
            matrix_type: "pmatrix".to_string(),
            matrix_starred: true,
            matrix_alignment: "r".to_string(),
            ..MathBuilderRequest::default()
        });
        assert_eq!(matrix.requirements[0].package_id, "mathtools");
        assert!(matrix.code.contains("\\begin{pmatrix*}[r]"));

        let arrow = generate_math(MathBuilderRequest {
            mode: "tool".to_string(),
            tool_type: "arrow".to_string(),
            arrow_type: "xleftrightarrow".to_string(),
            arrow_above: "iso".to_string(),
            arrow_below: "f".to_string(),
            ..MathBuilderRequest::default()
        });
        assert_eq!(arrow.code, "\\xleftrightarrow[f]{iso}");
        assert_eq!(arrow.requirements[0].package_id, "mathtools");
    }

    #[test]
    fn math_generates_delimited_math_without_package_requirement() {
        let inline = generate_math(MathBuilderRequest {
            mode: "delimited".to_string(),
            delimiter_math_type: "inline_parens".to_string(),
            delimiter_math_content: "a^2 + b^2 = c^2".to_string(),
            ..MathBuilderRequest::default()
        });

        assert_eq!(inline.code, "\\(a^2 + b^2 = c^2\\)");
        assert!(inline.requirements.is_empty());

        let display = generate_math(MathBuilderRequest {
            mode: "delimited".to_string(),
            delimiter_math_type: "display_dollars".to_string(),
            delimiter_math_content: "E = mc^2".to_string(),
            ..MathBuilderRequest::default()
        });

        assert_eq!(display.code, "$$\nE = mc^2\n$$");
        assert!(display.requirements.is_empty());
    }

    #[test]
    fn math_generates_mathtools_misc_snippets_and_warnings() {
        let delimiter = generate_math(MathBuilderRequest {
            mode: "tool".to_string(),
            tool_type: "delimiter".to_string(),
            delimiter_command: String::new(),
            ..MathBuilderRequest::default()
        });
        assert!(delimiter.code.contains("\\DeclarePairedDelimiter\\"));
        assert!(delimiter
            .warnings
            .iter()
            .any(|warning| warning.code == "math-empty-delimiter-command"));

        let bracket = generate_math(MathBuilderRequest {
            mode: "tool".to_string(),
            tool_type: "bracket".to_string(),
            bracket_type: "overbracket".to_string(),
            bracket_height: "5pt".to_string(),
            ..MathBuilderRequest::default()
        });
        assert!(bracket.code.contains("\\overbracket[][5pt]"));
    }

    #[test]
    fn math_generates_tag_form_snippets() {
        let tag = generate_math(MathBuilderRequest {
            mode: "tag".to_string(),
            tag_action: "newtagform".to_string(),
            tag_name: "square".to_string(),
            tag_left: "[".to_string(),
            tag_right: "]".to_string(),
            tag_format: "\\bfseries".to_string(),
            ..MathBuilderRequest::default()
        });
        assert_eq!(tag.requirements[0].package_id, "mathtools");
        assert_eq!(tag.code, "\\newtagform{square}[\\bfseries]{[}{]}");

        let reference = generate_math(MathBuilderRequest {
            mode: "tag".to_string(),
            tag_action: "refeq".to_string(),
            tag_ref_label: "eq:main".to_string(),
            ..MathBuilderRequest::default()
        });
        assert_eq!(reference.code, "\\refeq{eq:main}");

        let warning = generate_math(MathBuilderRequest {
            mode: "tag".to_string(),
            tag_action: "usetagform".to_string(),
            tag_name: String::new(),
            ..MathBuilderRequest::default()
        });
        assert!(warning
            .warnings
            .iter()
            .any(|item| item.code == "math-empty-tag-form-name"));
    }
}
