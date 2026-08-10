use super::{BuilderBuildProfileRequirement, BuilderOutput, BuilderPackageRequirement};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GraphicxBuilderRequest {
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    pub file_path: String,
    pub width: String,
    pub width_unit: String,
    pub height: String,
    pub height_unit: String,
    pub keep_aspect_ratio: bool,
    pub scale: Option<f64>,
    pub angle: Option<f64>,
    pub use_figure: bool,
    pub center: bool,
    pub caption: String,
    pub label: String,
    pub placement: String,
}

pub type GraphicxBuilderOutput = BuilderOutput;

impl Default for GraphicxBuilderRequest {
    fn default() -> Self {
        Self {
            enabled: true,
            file_path: "image.png".to_string(),
            width: "0.8".to_string(),
            width_unit: "\\textwidth".to_string(),
            height: String::new(),
            height_unit: "cm".to_string(),
            keep_aspect_ratio: true,
            scale: None,
            angle: None,
            use_figure: true,
            center: true,
            caption: "Caption".to_string(),
            label: "fig:my_image".to_string(),
            placement: "ht".to_string(),
        }
    }
}

pub fn generate_graphicx(request: GraphicxBuilderRequest) -> GraphicxBuilderOutput {
    if !request.enabled {
        return GraphicxBuilderOutput::empty("graphicx");
    }

    let includegraphics = format_includegraphics(&request);
    let code = if request.use_figure {
        format_figure(&request, &includegraphics)
    } else {
        includegraphics
    };

    GraphicxBuilderOutput {
        schema_version: 1,
        builder_id: "graphicx".to_string(),
        code,
        requirements: vec![BuilderPackageRequirement {
            package_id: "graphicx".to_string(),
            options: Vec::new(),
        }],
        build_profile: BuilderBuildProfileRequirement::default(),
        warnings: Vec::new(),
    }
}

fn format_includegraphics(request: &GraphicxBuilderRequest) -> String {
    let mut options = Vec::new();

    if let Some(width) = format_dimension(&request.width, &request.width_unit) {
        options.push(format!("width={width}"));
    }
    if let Some(height) = format_dimension(&request.height, &request.height_unit) {
        options.push(format!("height={height}"));
    }
    if request.keep_aspect_ratio
        && (!request.width.trim().is_empty() || !request.height.trim().is_empty())
    {
        options.push("keepaspectratio".to_string());
    }
    if let Some(scale) = request
        .scale
        .filter(|value| value.is_finite() && *value > 0.0)
    {
        options.push(format!("scale={}", format_number(scale)));
    }
    if let Some(angle) = request.angle.filter(|value| value.is_finite()) {
        options.push(format!("angle={}", format_number(angle)));
    }

    let options = if options.is_empty() {
        String::new()
    } else {
        format!("[{}]", options.join(", "))
    };
    format!(
        "\\includegraphics{}{{{}}}",
        options,
        sanitize_graphics_path(&request.file_path)
    )
}

fn format_figure(request: &GraphicxBuilderRequest, includegraphics: &str) -> String {
    let mut code = format!(
        "\\begin{{figure}}[{}]\n",
        sanitize_placement(&request.placement)
    );
    if request.center {
        code.push_str("  \\centering\n");
    }
    code.push_str(&format!("  {includegraphics}\n"));
    let caption = sanitize_fragment(&request.caption);
    if !caption.is_empty() {
        code.push_str(&format!("  \\caption{{{caption}}}\n"));
    }
    let label = sanitize_fragment(&request.label);
    if !label.is_empty() {
        code.push_str(&format!("  \\label{{{label}}}\n"));
    }
    code.push_str("\\end{figure}");
    code
}

fn format_dimension(value: &str, unit: &str) -> Option<String> {
    let value = sanitize_fragment(value);
    if value.is_empty() {
        return None;
    }
    let unit = sanitize_unit(unit);
    Some(format!("{value}{unit}"))
}

fn sanitize_unit(unit: &str) -> String {
    match unit.trim() {
        "\\textwidth" => "\\textwidth".to_string(),
        "\\linewidth" => "\\linewidth".to_string(),
        "\\textheight" => "\\textheight".to_string(),
        "cm" | "mm" | "in" | "pt" => unit.trim().to_string(),
        _ => "cm".to_string(),
    }
}

fn sanitize_graphics_path(path: &str) -> String {
    let mut path = sanitize_fragment(path).replace('\\', "/");
    if path.is_empty() {
        path = "imagefile".to_string();
    }
    if path.contains(' ') && !(path.starts_with('"') && path.ends_with('"')) {
        format!("\"{path}\"")
    } else {
        path
    }
}

fn sanitize_placement(value: &str) -> String {
    let value = value.trim();
    if value.is_empty()
        || !value
            .chars()
            .all(|ch| matches!(ch, 'h' | 't' | 'b' | 'p' | '!' | 'H'))
    {
        "ht".to_string()
    } else {
        value.to_string()
    }
}

fn sanitize_fragment(value: &str) -> String {
    value
        .trim()
        .chars()
        .filter(|ch| *ch != '\0' && *ch != '\r')
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
    fn default_graphicx_generates_figure_snippet_and_requirement() {
        let output = generate_graphicx(GraphicxBuilderRequest::default());

        assert_eq!(output.requirements[0].package_id, "graphicx");
        assert!(output.code.contains("\\begin{figure}[ht]"));
        assert!(output
            .code
            .contains("\\includegraphics[width=0.8\\textwidth, keepaspectratio]{image.png}"));
        assert!(output.code.contains("\\caption{Caption}"));
        assert!(output.code.contains("\\label{fig:my_image}"));
    }

    #[test]
    fn graphicx_generates_plain_includegraphics_with_options() {
        let output = generate_graphicx(GraphicxBuilderRequest {
            file_path: "figures/my plot.pdf".to_string(),
            width: "10".to_string(),
            width_unit: "cm".to_string(),
            height: "4".to_string(),
            height_unit: "cm".to_string(),
            scale: Some(1.25),
            angle: Some(90.0),
            use_figure: false,
            ..GraphicxBuilderRequest::default()
        });

        assert_eq!(
            output.code,
            "\\includegraphics[width=10cm, height=4cm, keepaspectratio, scale=1.25, angle=90]{\"figures/my plot.pdf\"}"
        );
    }

    #[test]
    fn disabled_graphicx_outputs_empty_code_and_no_requirements() {
        let output = generate_graphicx(GraphicxBuilderRequest {
            enabled: false,
            ..GraphicxBuilderRequest::default()
        });

        assert!(output.code.is_empty());
        assert!(output.requirements.is_empty());
    }
}
