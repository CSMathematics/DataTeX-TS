use super::{BuilderBuildProfileRequirement, BuilderOutput, BuilderPackageRequirement};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FancyhdrBuilderRequest {
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    pub document_type: String,
    pub page_style: String,
    pub clear_fields: bool,
    #[serde(default)]
    pub package_options: Vec<String>,
    pub header_odd_left: String,
    pub header_odd_center: String,
    pub header_odd_right: String,
    pub header_even_left: String,
    pub header_even_center: String,
    pub header_even_right: String,
    pub footer_odd_left: String,
    pub footer_odd_center: String,
    pub footer_odd_right: String,
    pub footer_even_left: String,
    pub footer_even_center: String,
    pub footer_even_right: String,
    pub head_rule_width: f64,
    pub foot_rule_width: f64,
}

pub type FancyhdrBuilderOutput = BuilderOutput;

impl Default for FancyhdrBuilderRequest {
    fn default() -> Self {
        Self {
            enabled: true,
            document_type: "twoside".to_string(),
            page_style: "fancy".to_string(),
            clear_fields: true,
            package_options: Vec::new(),
            header_odd_left: String::new(),
            header_odd_center: String::new(),
            header_odd_right: "\\thepage".to_string(),
            header_even_left: "\\thepage".to_string(),
            header_even_center: String::new(),
            header_even_right: String::new(),
            footer_odd_left: String::new(),
            footer_odd_center: String::new(),
            footer_odd_right: String::new(),
            footer_even_left: String::new(),
            footer_even_center: String::new(),
            footer_even_right: String::new(),
            head_rule_width: 0.4,
            foot_rule_width: 0.0,
        }
    }
}

pub fn generate_fancyhdr(request: FancyhdrBuilderRequest) -> FancyhdrBuilderOutput {
    if !request.enabled {
        return FancyhdrBuilderOutput::empty("fancyhdr");
    }

    let mut code = "% --- Fancyhdr Setup ---\n".to_string();
    code.push_str(&format!(
        "\\pagestyle{{{}}}\n",
        sanitize_identifier(&request.page_style, "fancy")
    ));
    if request.clear_fields {
        code.push_str("\\fancyhf{}\n");
    }

    let two_side = request.document_type == "twoside";

    if two_side {
        push_fancy_command(&mut code, "head", "LO", &request.header_odd_left);
        push_fancy_command(&mut code, "head", "CO", &request.header_odd_center);
        push_fancy_command(&mut code, "head", "RO", &request.header_odd_right);
        push_fancy_command(&mut code, "head", "LE", &request.header_even_left);
        push_fancy_command(&mut code, "head", "CE", &request.header_even_center);
        push_fancy_command(&mut code, "head", "RE", &request.header_even_right);
        push_fancy_command(&mut code, "foot", "LO", &request.footer_odd_left);
        push_fancy_command(&mut code, "foot", "CO", &request.footer_odd_center);
        push_fancy_command(&mut code, "foot", "RO", &request.footer_odd_right);
        push_fancy_command(&mut code, "foot", "LE", &request.footer_even_left);
        push_fancy_command(&mut code, "foot", "CE", &request.footer_even_center);
        push_fancy_command(&mut code, "foot", "RE", &request.footer_even_right);
    } else {
        push_fancy_command(&mut code, "head", "L", &request.header_odd_left);
        push_fancy_command(&mut code, "head", "C", &request.header_odd_center);
        push_fancy_command(&mut code, "head", "R", &request.header_odd_right);
        push_fancy_command(&mut code, "foot", "L", &request.footer_odd_left);
        push_fancy_command(&mut code, "foot", "C", &request.footer_odd_center);
        push_fancy_command(&mut code, "foot", "R", &request.footer_odd_right);
    }

    code.push_str(&format!(
        "\\renewcommand{{\\headrulewidth}}{{{}pt}}\n",
        format_number(request.head_rule_width)
    ));
    code.push_str(&format!(
        "\\renewcommand{{\\footrulewidth}}{{{}pt}}\n",
        format_number(request.foot_rule_width)
    ));

    FancyhdrBuilderOutput {
        schema_version: 1,
        builder_id: "fancyhdr".to_string(),
        code,
        requirements: vec![BuilderPackageRequirement {
            package_id: "fancyhdr".to_string(),
            options: sanitize_options(&request.package_options),
        }],
        build_profile: BuilderBuildProfileRequirement::default(),
        warnings: Vec::new(),
    }
}

fn push_fancy_command(code: &mut String, kind: &str, position: &str, value: &str) {
    let value = sanitize_fragment(value);
    if value.is_empty() {
        return;
    }
    let command = if kind == "foot" {
        "\\fancyfoot"
    } else {
        "\\fancyhead"
    };
    code.push_str(&format!("{command}[{position}]{{{value}}}\n"));
}

fn sanitize_fragment(value: &str) -> String {
    value
        .trim()
        .chars()
        .filter(|ch| *ch != '\0' && *ch != '\r')
        .collect()
}

fn sanitize_identifier(value: &str, fallback: &str) -> String {
    let value = value.trim();
    if value.is_empty()
        || !value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'))
    {
        fallback.to_string()
    } else {
        value.to_string()
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

fn format_number(value: f64) -> String {
    let mut formatted = format!("{value:.6}");
    while formatted.contains('.') && formatted.ends_with('0') {
        formatted.pop();
    }
    if formatted.ends_with('.') {
        formatted.pop();
    }
    if formatted == "-0" {
        "0".to_string()
    } else {
        formatted
    }
}

const fn default_enabled() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_fancyhdr_generates_expected_setup() {
        let output = generate_fancyhdr(FancyhdrBuilderRequest::default());

        assert_eq!(output.requirements[0].package_id, "fancyhdr");
        assert!(output.code.contains("\\pagestyle{fancy}"));
        assert!(output.code.contains("\\fancyhf{}"));
        assert!(output.code.contains("\\fancyhead[RO]{\\thepage}"));
        assert!(output.code.contains("\\fancyhead[LE]{\\thepage}"));
        assert!(output
            .code
            .contains("\\renewcommand{\\headrulewidth}{0.4pt}"));
    }

    #[test]
    fn oneside_uses_simple_header_footer_positions() {
        let output = generate_fancyhdr(FancyhdrBuilderRequest {
            document_type: "oneside".to_string(),
            header_odd_left: "\\leftmark".to_string(),
            footer_odd_center: "\\thepage".to_string(),
            header_odd_right: String::new(),
            header_even_left: String::new(),
            ..FancyhdrBuilderRequest::default()
        });

        assert!(output.code.contains("\\fancyhead[L]{\\leftmark}"));
        assert!(output.code.contains("\\fancyfoot[C]{\\thepage}"));
        assert!(!output.code.contains("\\fancyhead[LO]"));
    }
}
