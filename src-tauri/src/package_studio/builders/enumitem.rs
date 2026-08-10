use super::{BuilderBuildProfileRequirement, BuilderOutput, BuilderPackageRequirement};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EnumitemCustomList {
    pub name: String,
    pub base_type: String,
    pub inline: bool,
    pub label: String,
    pub spacing: String,
    pub wide: bool,
    pub left_margin_star: bool,
    pub bold: bool,
    pub italic: bool,
    pub align: String,
    pub resume: bool,
    pub start: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EnumitemBuilderRequest {
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    pub inline: bool,
    pub global_spacing: String,
    pub itemize_label: String,
    pub enumerate_label: String,
    #[serde(default)]
    pub custom_lists: Vec<EnumitemCustomList>,
}

pub type EnumitemBuilderOutput = BuilderOutput;

impl Default for EnumitemBuilderRequest {
    fn default() -> Self {
        Self {
            enabled: true,
            inline: false,
            global_spacing: "default".to_string(),
            itemize_label: "default".to_string(),
            enumerate_label: "default".to_string(),
            custom_lists: Vec::new(),
        }
    }
}

pub fn generate_enumitem(request: EnumitemBuilderRequest) -> EnumitemBuilderOutput {
    if !request.enabled {
        return EnumitemBuilderOutput::empty("enumitem");
    }

    let mut code = "% --- Enumitem Setup ---\n".to_string();
    push_global_spacing(&mut code, &request.global_spacing);
    push_itemize_label(&mut code, &request.itemize_label);
    push_enumerate_label(&mut code, &request.enumerate_label);

    let custom_lists = request
        .custom_lists
        .into_iter()
        .filter_map(sanitize_custom_list)
        .collect::<Vec<_>>();

    if !custom_lists.is_empty() {
        code.push('\n');
        code.push_str("% --- Custom Lists ---\n");
        for list in custom_lists {
            let base_type =
                if list.inline && (list.base_type == "enumerate" || list.base_type == "itemize") {
                    format!("{}*", list.base_type)
                } else {
                    list.base_type.clone()
                };
            code.push_str(&format!(
                "\\newlist{{{}}}{{{}}}{{3}}\n",
                list.name, base_type
            ));
            let options = custom_list_options(&list);
            if !options.is_empty() {
                code.push_str(&format!(
                    "\\setlist[{}]{{{}}}\n",
                    list.name,
                    options.join(", ")
                ));
            }
        }
    }

    EnumitemBuilderOutput {
        schema_version: 1,
        builder_id: "enumitem".to_string(),
        code,
        requirements: vec![BuilderPackageRequirement {
            package_id: "enumitem".to_string(),
            options: if request.inline {
                vec!["inline".to_string()]
            } else {
                Vec::new()
            },
        }],
        build_profile: BuilderBuildProfileRequirement::default(),
        warnings: Vec::new(),
    }
}

fn push_global_spacing(code: &mut String, spacing: &str) {
    match spacing {
        "nosep" => code.push_str("\\setlist{nosep}\n"),
        "noitemsep" => code.push_str("\\setlist{noitemsep}\n"),
        "half" => code.push_str("\\setlist{itemsep=0.5ex}\n"),
        _ => {}
    }
}

fn push_itemize_label(code: &mut String, label: &str) {
    let option = match label {
        "bullet" | "label=\\bullet" => Some("label=\\textbullet"),
        "dash" | "label=--" => Some("label={--}"),
        "asterisk" | "label=*" => Some("label={*}"),
        "arrow" | "label=\\Rightarrow" => Some("label=$\\Rightarrow$"),
        _ => None,
    };
    if let Some(option) = option {
        code.push_str(&format!("\\setlist[itemize]{{{option}}}\n"));
    }
}

fn push_enumerate_label(code: &mut String, label: &str) {
    let option = match label {
        "arabic_paren" | "label=\\arabic*)" => Some("label=\\arabic*), ref=\\arabic*)"),
        "arabic_wrapped" | "label=(\\arabic*)" => Some("label=(\\arabic*), ref=(\\arabic*)"),
        "alph" | "label=\\alph*)" => Some("label=\\alph*), ref=\\alph*)"),
        "alph_wrapped" | "label=(\\alph*)" => Some("label=(\\alph*), ref=(\\alph*)"),
        "Alph" => Some("label=\\Alph*., ref=\\Alph*"),
        "roman" => Some("label=\\roman*), ref=\\roman*)"),
        "Roman" => Some("label=\\Roman*., ref=\\Roman*"),
        _ => None,
    };
    if let Some(option) = option {
        code.push_str(&format!("\\setlist[enumerate]{{{option}}}\n"));
    }
}

fn sanitize_custom_list(list: EnumitemCustomList) -> Option<EnumitemCustomList> {
    let name = sanitize_identifier(&list.name)?;
    let base_type = match list.base_type.as_str() {
        "enumerate" | "itemize" | "description" => list.base_type,
        "enumerate*" => "enumerate".to_string(),
        "itemize*" => "itemize".to_string(),
        _ => "enumerate".to_string(),
    };

    Some(EnumitemCustomList {
        name,
        base_type,
        inline: list.inline,
        label: sanitize_option_value(&list.label),
        spacing: sanitize_keyword(&list.spacing, "default"),
        wide: list.wide,
        left_margin_star: list.left_margin_star,
        bold: list.bold,
        italic: list.italic,
        align: sanitize_keyword(&list.align, "default"),
        resume: list.resume,
        start: list.start.filter(|value| *value > 0),
    })
}

fn custom_list_options(list: &EnumitemCustomList) -> Vec<String> {
    let mut options = Vec::new();

    if list.base_type != "description" && !list.label.trim().is_empty() {
        options.push(format!("label={}", list.label.trim()));
    }

    match list.spacing.as_str() {
        "nosep" => options.push("nosep".to_string()),
        "noitemsep" => options.push("noitemsep".to_string()),
        "half" => options.push("itemsep=0.5ex".to_string()),
        _ => {}
    }

    if list.wide {
        options.push("wide=0pt".to_string());
    }
    if list.left_margin_star {
        options.push("leftmargin=*".to_string());
    }

    let mut font = String::new();
    if list.bold {
        font.push_str("\\bfseries");
    }
    if list.italic {
        font.push_str("\\itshape");
    }
    if !font.is_empty() {
        options.push(format!("font={font}"));
    }

    if matches!(list.align.as_str(), "left" | "parleft") {
        options.push(format!("align={}", list.align));
    }

    if list.base_type == "enumerate" {
        if list.resume {
            options.push("resume".to_string());
        }
        if let Some(start) = list.start {
            if start != 1 {
                options.push(format!("start={start}"));
            }
        }
    }

    options
}

fn sanitize_identifier(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty() {
        return None;
    }
    let sanitized = value
        .chars()
        .filter(|ch| ch.is_ascii_alphabetic())
        .collect::<String>();
    if sanitized.is_empty() {
        None
    } else {
        Some(sanitized)
    }
}

fn sanitize_keyword(value: &str, fallback: &str) -> String {
    let value = value.trim();
    if value
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'))
        && !value.is_empty()
    {
        value.to_string()
    } else {
        fallback.to_string()
    }
}

fn sanitize_option_value(value: &str) -> String {
    value
        .trim()
        .chars()
        .filter(|ch| *ch != '\0' && *ch != '\r' && *ch != '\n')
        .collect()
}

fn default_enabled() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_enumitem_generates_package_requirement_only() {
        let output = generate_enumitem(EnumitemBuilderRequest::default());
        assert_eq!(output.requirements[0].package_id, "enumitem");
        assert!(output.requirements[0].options.is_empty());
        assert_eq!(output.code, "% --- Enumitem Setup ---\n");
    }

    #[test]
    fn enumitem_generates_global_settings_and_inline_requirement() {
        let output = generate_enumitem(EnumitemBuilderRequest {
            inline: true,
            global_spacing: "nosep".to_string(),
            itemize_label: "dash".to_string(),
            enumerate_label: "alph_wrapped".to_string(),
            ..EnumitemBuilderRequest::default()
        });

        assert_eq!(output.requirements[0].options, vec!["inline"]);
        assert!(output.code.contains("\\setlist{nosep}"));
        assert!(output.code.contains("\\setlist[itemize]{label={--}}"));
        assert!(output
            .code
            .contains("\\setlist[enumerate]{label=(\\alph*), ref=(\\alph*)}"));
    }

    #[test]
    fn enumitem_generates_custom_lists() {
        let output = generate_enumitem(EnumitemBuilderRequest {
            inline: true,
            custom_lists: vec![EnumitemCustomList {
                name: "questions".to_string(),
                base_type: "enumerate".to_string(),
                inline: true,
                label: "\\arabic*.".to_string(),
                spacing: "nosep".to_string(),
                wide: true,
                left_margin_star: true,
                bold: true,
                italic: true,
                align: "left".to_string(),
                resume: true,
                start: Some(3),
            }],
            ..EnumitemBuilderRequest::default()
        });

        assert!(output.code.contains("\\newlist{questions}{enumerate*}{3}"));
        assert!(output.code.contains(
            "\\setlist[questions]{label=\\arabic*., nosep, wide=0pt, leftmargin=*, font=\\bfseries\\itshape, align=left, resume, start=3}"
        ));
    }

    #[test]
    fn disabled_enumitem_outputs_empty_code_and_no_requirements() {
        let output = generate_enumitem(EnumitemBuilderRequest {
            enabled: false,
            ..EnumitemBuilderRequest::default()
        });
        assert!(output.code.is_empty());
        assert!(output.requirements.is_empty());
    }
}
