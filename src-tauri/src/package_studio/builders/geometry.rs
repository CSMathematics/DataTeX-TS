use super::{BuilderBuildProfileRequirement, BuilderOutput, BuilderPackageRequirement};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GeometryBuilderRequest {
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    pub margin_top: f64,
    pub margin_bottom: f64,
    pub margin_left: f64,
    pub margin_right: f64,
    pub columns: String,
    pub column_sep: f64,
    pub sidedness: String,
    pub margin_notes: bool,
    pub margin_sep: f64,
    pub margin_width: f64,
    pub include_mp: bool,
    pub head_height: f64,
    pub head_sep: f64,
    pub foot_skip: f64,
    pub binding_offset: f64,
    pub h_offset: f64,
    pub v_offset: f64,
    pub include_head: bool,
    pub include_foot: bool,
}

pub type GeometryBuilderOutput = BuilderOutput;

impl Default for GeometryBuilderRequest {
    fn default() -> Self {
        Self {
            enabled: true,
            margin_top: 2.5,
            margin_bottom: 2.5,
            margin_left: 2.5,
            margin_right: 2.5,
            columns: "one".to_string(),
            column_sep: 0.5,
            sidedness: "oneside".to_string(),
            margin_notes: false,
            margin_sep: 0.5,
            margin_width: 3.0,
            include_mp: false,
            head_height: 0.0,
            head_sep: 0.0,
            foot_skip: 0.0,
            binding_offset: 0.0,
            h_offset: 0.0,
            v_offset: 0.0,
            include_head: false,
            include_foot: false,
        }
    }
}

pub fn generate_geometry(request: GeometryBuilderRequest) -> GeometryBuilderOutput {
    if !request.enabled {
        return GeometryBuilderOutput::empty("geometry");
    }

    let mut options = vec![
        format!("top={}cm", format_number(request.margin_top)),
        format!("bottom={}cm", format_number(request.margin_bottom)),
        format!("left={}cm", format_number(request.margin_left)),
        format!("right={}cm", format_number(request.margin_right)),
    ];

    if request.columns == "two" {
        options.push(format!("columnsep={}cm", format_number(request.column_sep)));
    }

    if request.margin_notes {
        options.push(format!(
            "marginparsep={}cm",
            format_number(request.margin_sep)
        ));
        options.push(format!(
            "marginparwidth={}cm",
            format_number(request.margin_width)
        ));
        if request.include_mp {
            options.push("includemp".to_string());
        }
    }

    push_positive_dimension(&mut options, "headheight", request.head_height);
    push_positive_dimension(&mut options, "headsep", request.head_sep);
    push_positive_dimension(&mut options, "footskip", request.foot_skip);
    push_positive_dimension(&mut options, "bindingoffset", request.binding_offset);

    if request.h_offset != 0.0 {
        options.push(format!("hoffset={}cm", format_number(request.h_offset)));
    }
    if request.v_offset != 0.0 {
        options.push(format!("voffset={}cm", format_number(request.v_offset)));
    }

    if request.include_head {
        options.push("includehead".to_string());
    }
    if request.include_foot {
        options.push("includefoot".to_string());
    }
    if request.sidedness == "asymmetric" {
        options.push("asymmetric".to_string());
    }

    GeometryBuilderOutput {
        schema_version: 1,
        builder_id: "geometry".to_string(),
        code: format!("\\usepackage[{}]{{geometry}}\n", options.join(", ")),
        requirements: vec![BuilderPackageRequirement {
            package_id: "geometry".to_string(),
            options,
        }],
        build_profile: BuilderBuildProfileRequirement::default(),
        warnings: Vec::new(),
    }
}

fn push_positive_dimension(options: &mut Vec<String>, key: &str, value: f64) {
    if value > 0.0 {
        options.push(format!("{key}={}cm", format_number(value)));
    }
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
    fn default_geometry_matches_golden_fixture() {
        let output = generate_geometry(GeometryBuilderRequest::default());

        assert_eq!(
            output.code,
            include_str!("../fixtures/geometry-default.tex")
        );
        assert_eq!(output.requirements.len(), 1);
        assert_eq!(output.requirements[0].package_id, "geometry");
    }

    #[test]
    fn advanced_geometry_matches_golden_fixture() {
        let output = generate_geometry(GeometryBuilderRequest {
            margin_top: 1.5,
            margin_bottom: 2.0,
            margin_left: 2.2,
            margin_right: 1.8,
            columns: "two".to_string(),
            column_sep: 0.7,
            sidedness: "asymmetric".to_string(),
            margin_notes: true,
            margin_sep: 0.4,
            margin_width: 2.6,
            include_mp: true,
            head_height: 0.6,
            head_sep: 0.4,
            foot_skip: 0.8,
            binding_offset: 0.5,
            h_offset: 0.1,
            v_offset: -0.1,
            include_head: true,
            include_foot: true,
            ..GeometryBuilderRequest::default()
        });

        assert_eq!(
            output.code,
            include_str!("../fixtures/geometry-advanced-layout.tex")
        );
        assert_eq!(output.requirements[0].options.len(), 17);
    }

    #[test]
    fn disabled_geometry_outputs_empty_code_and_no_requirements() {
        let output = generate_geometry(GeometryBuilderRequest {
            enabled: false,
            ..GeometryBuilderRequest::default()
        });

        assert!(output.code.is_empty());
        assert!(output.requirements.is_empty());
    }
}
