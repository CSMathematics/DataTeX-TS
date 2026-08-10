pub mod code_highlighting;
pub mod enumitem;
pub mod fancyhdr;
pub mod geometry;
pub mod graphicx;
pub mod math;
pub mod siunitx;
pub mod tables;
pub mod xcolor;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BuilderCategory {
    Layout,
    Code,
    Tables,
    Math,
    Graphics,
    Bibliography,
    Document,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BuilderOutputTarget {
    Preamble,
    Body,
    FullDocument,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BuilderSupportLevel {
    NativeEditable,
    Generated,
    AssistedSource,
    PreviewOnly,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BuilderCapability {
    pub supports_preview: bool,
    pub supports_import: bool,
    pub supports_presets: bool,
    pub requires_exact_compile: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BuilderDescriptor {
    pub schema_version: u32,
    pub id: String,
    pub display_name: String,
    pub category: BuilderCategory,
    pub package_ids: Vec<String>,
    pub output_targets: Vec<BuilderOutputTarget>,
    pub support_level: BuilderSupportLevel,
    pub capabilities: BuilderCapability,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BuilderPackageRequirement {
    pub package_id: String,
    pub options: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BuilderPackageOptionDescriptor {
    pub package_id: String,
    pub option: String,
    pub label: String,
    pub description: String,
    pub value_kind: String,
    pub group: String,
    pub choices: Vec<BuilderPackageOptionChoice>,
    pub exclusive_group: Option<String>,
    pub default_value: Option<String>,
    pub unit: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BuilderPackageOptionChoice {
    pub value: String,
    pub label: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BuilderBuildProfileRequirement {
    pub shell_escape_required: bool,
}

impl Default for BuilderBuildProfileRequirement {
    fn default() -> Self {
        Self {
            shell_escape_required: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BuilderWarningSeverity {
    Info,
    Warning,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BuilderWarning {
    pub code: String,
    pub severity: BuilderWarningSeverity,
    pub message: String,
    pub package_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BuilderOutput {
    pub schema_version: u32,
    pub builder_id: String,
    pub code: String,
    pub requirements: Vec<BuilderPackageRequirement>,
    pub build_profile: BuilderBuildProfileRequirement,
    pub warnings: Vec<BuilderWarning>,
}

pub fn list_builder_options(builder_id: &str) -> Vec<BuilderPackageOptionDescriptor> {
    match builder_id {
        "geometry" => vec![
            option(
                "geometry",
                "includehead",
                "Include header",
                "Includes the header area in the total page layout calculation.",
                "flag",
                "Header/footer",
            ),
            option(
                "geometry",
                "includefoot",
                "Include footer",
                "Includes the footer area in the total page layout calculation.",
                "flag",
                "Header/footer",
            ),
            option(
                "geometry",
                "includemp",
                "Include margin notes",
                "Includes the margin note area when calculating the page body.",
                "flag",
                "Margin notes",
            ),
            option(
                "geometry",
                "asymmetric",
                "Asymmetric margins",
                "Keeps left/right margins asymmetric instead of mirroring them.",
                "flag",
                "Sidedness",
            ),
            dimension_option(
                "geometry",
                "top",
                "Top margin",
                "Sets the top page margin. Configure the value from the margin controls.",
                "Margins",
                "2.5",
            ),
            dimension_option(
                "geometry",
                "bottom",
                "Bottom margin",
                "Sets the bottom page margin. Configure the value from the margin controls.",
                "Margins",
                "2.5",
            ),
            dimension_option(
                "geometry",
                "left",
                "Left margin",
                "Sets the left page margin. Configure the value from the margin controls.",
                "Margins",
                "2.5",
            ),
            dimension_option(
                "geometry",
                "right",
                "Right margin",
                "Sets the right page margin. Configure the value from the margin controls.",
                "Margins",
                "2.5",
            ),
            dimension_option(
                "geometry",
                "columnsep",
                "Column separation",
                "Controls the space between two columns when two-column layout is enabled.",
                "Columns",
                "0.5",
            ),
            dimension_option(
                "geometry",
                "marginparsep",
                "Margin-note separation",
                "Controls the gap between the main text and the margin-note area.",
                "Margin notes",
                "0.5",
            ),
            dimension_option(
                "geometry",
                "marginparwidth",
                "Margin-note width",
                "Controls the width reserved for margin notes.",
                "Margin notes",
                "3",
            ),
            dimension_option(
                "geometry",
                "headheight",
                "Header height",
                "Reserves vertical space for the header.",
                "Header/footer",
                "0",
            ),
            dimension_option(
                "geometry",
                "headsep",
                "Header separation",
                "Controls the distance between the header and the text body.",
                "Header/footer",
                "0",
            ),
            dimension_option(
                "geometry",
                "footskip",
                "Footer skip",
                "Controls the distance from the text body to the footer baseline.",
                "Header/footer",
                "0",
            ),
            dimension_option(
                "geometry",
                "bindingoffset",
                "Binding offset",
                "Adds extra space for binding in printed documents.",
                "Print layout",
                "0",
            ),
            dimension_option(
                "geometry",
                "hoffset",
                "Horizontal offset",
                "Moves the computed layout horizontally.",
                "Offsets",
                "0",
            ),
            dimension_option(
                "geometry",
                "voffset",
                "Vertical offset",
                "Moves the computed layout vertically.",
                "Offsets",
                "0",
            ),
        ],
        "code-highlighting" => vec![
            option(
                "listings",
                "numbers=left",
                "Line numbers",
                "Shows line numbers on the left side of listings blocks.",
                "flag",
                "Listings",
            ),
            option(
                "listings",
                "breaklines=true",
                "Break long lines",
                "Allows long source-code lines to wrap instead of overflowing.",
                "flag",
                "Listings",
            ),
            option(
                "listings",
                "frame=single",
                "Frame",
                "Draws a border around listings code blocks.",
                "flag",
                "Listings",
            ),
            option(
                "listings",
                "backgroundcolor",
                "Background color",
                "Sets the listings code block background color from the color controls.",
                "color",
                "Listings",
            ),
            option(
                "listings",
                "keywordstyle",
                "Keyword style",
                "Controls the color/style used for recognized programming keywords.",
                "color",
                "Listings",
            ),
            option(
                "minted",
                "linenos",
                "Line numbers",
                "Shows line numbers in minted code blocks.",
                "flag",
                "Minted",
            ),
            option(
                "minted",
                "breaklines",
                "Break long lines",
                "Allows long minted source-code lines to wrap instead of overflowing.",
                "flag",
                "Minted",
            ),
            option(
                "minted",
                "frame=lines",
                "Frame lines",
                "Adds horizontal frame lines around minted code blocks.",
                "flag",
                "Minted",
            ),
            option_with(
                "minted",
                "style",
                "Pygments style",
                "Selects the minted/Pygments color theme from the style selector.",
                "choice",
                "Minted",
                vec![
                    choice("friendly", "friendly"),
                    choice("default", "default"),
                    choice("colorful", "colorful"),
                    choice("monokai", "monokai"),
                    choice("manni", "manni"),
                    choice("material", "material"),
                    choice("borland", "borland"),
                    choice("emacs", "emacs"),
                    choice("vs", "vs"),
                    choice("xcode", "xcode"),
                ],
                None,
                Some("friendly"),
                None,
            ),
        ],
        "xcolor" => vec![
            option(
                "xcolor",
                "dvipsnames",
                "Classic names",
                "Enables the classic named color set such as BrickRed, RoyalBlue, and ForestGreen.",
                "flag",
                "Named colors",
            ),
            option(
                "xcolor",
                "svgnames",
                "SVG names",
                "Enables SVG/CSS-style color names such as DarkSlateBlue and SeaGreen.",
                "flag",
                "Named colors",
            ),
            option(
                "xcolor",
                "x11names",
                "X11 names",
                "Enables the X11 color name set.",
                "flag",
                "Named colors",
            ),
            option(
                "xcolor",
                "table",
                "Table colors",
                "Adds row/column/cell color support for tables.",
                "flag",
                "Features",
            ),
            option(
                "xcolor",
                "cmyk",
                "Force CMYK output",
                "Uses CMYK-oriented color output for print workflows.",
                "flag",
                "Features",
            ),
            option(
                "xcolor",
                "monochrome",
                "Monochrome",
                "Converts color usage toward grayscale/monochrome output.",
                "flag",
                "Features",
            ),
            option(
                "xcolor",
                "natural",
                "Natural model",
                "Keeps colors in their natural model when possible.",
                "flag",
                "Features",
            ),
            option(
                "xcolor",
                "fixpdftex",
                "Fix pdfTeX colors",
                "Enables compatibility fixes for older pdfTeX color handling.",
                "flag",
                "Compatibility",
            ),
            option_with(
                "xcolor",
                "pdftex",
                "Driver: pdfTeX",
                "Selects the pdfTeX color driver explicitly.",
                "flag",
                "Drivers",
                Vec::new(),
                Some("driver"),
                None,
                None,
            ),
            option_with(
                "xcolor",
                "xetex",
                "Driver: XeTeX",
                "Selects the XeTeX color driver explicitly.",
                "flag",
                "Drivers",
                Vec::new(),
                Some("driver"),
                None,
                None,
            ),
            option_with(
                "xcolor",
                "luatex",
                "Driver: LuaTeX",
                "Selects the LuaTeX color driver explicitly.",
                "flag",
                "Drivers",
                Vec::new(),
                Some("driver"),
                None,
                None,
            ),
            option_with(
                "xcolor",
                "dvips",
                "Driver: dvips",
                "Selects the dvips/PostScript color driver explicitly.",
                "flag",
                "Drivers",
                Vec::new(),
                Some("driver"),
                None,
                None,
            ),
            option_with(
                "xcolor",
                "xdvi",
                "Driver: xdvi",
                "Selects the xdvi color driver explicitly.",
                "flag",
                "Drivers",
                Vec::new(),
                Some("driver"),
                None,
                None,
            ),
            option_with(
                "xcolor",
                "dvipdfmx",
                "Driver: dvipdfmx",
                "Selects the dvipdfmx color driver explicitly.",
                "flag",
                "Drivers",
                Vec::new(),
                Some("driver"),
                None,
                None,
            ),
            option_with(
                "xcolor",
                "dvisvgm",
                "Driver: dvisvgm",
                "Selects the dvisvgm/SVG color driver explicitly.",
                "flag",
                "Drivers",
                Vec::new(),
                Some("driver"),
                None,
                None,
            ),
        ],
        "fancyhdr" => vec![
            option("fancyhdr", "headtopline", "Header top line", "Adds an extra rule above the header when supported by the package version.", "flag", "Rules"),
            option("fancyhdr", "footbotline", "Footer bottom line", "Adds an extra rule below the footer when supported by the package version.", "flag", "Rules"),
            option("fancyhdr", "nocheck", "Skip header-height check", "Suppresses fancyhdr header-height warnings when you intentionally manage dimensions yourself.", "flag", "Diagnostics"),
        ],
        "enumitem" => vec![
            option(
                "enumitem",
                "inline",
                "Inline lists",
                "Loads enumitem with inline list environments such as enumerate* and itemize*.",
                "flag",
                "Package",
            ),
            choice_option(
                "enumitem",
                "spacing",
                "Global spacing",
                "Sets a default spacing profile for all enumitem lists.",
                "Global lists",
                "default",
                vec![
                    choice("default", "Default"),
                    choice("nosep", "Compact"),
                    choice("noitemsep", "No item spacing"),
                    choice("half", "Half item spacing"),
                ],
            ),
            choice_option(
                "enumitem",
                "itemize",
                "Global itemize label",
                "Sets the default label marker for itemize environments.",
                "Global lists",
                "default",
                vec![
                    choice("default", "Default"),
                    choice("bullet", "Bullet"),
                    choice("dash", "Dash"),
                    choice("asterisk", "Asterisk"),
                    choice("arrow", "Arrow"),
                ],
            ),
            choice_option(
                "enumitem",
                "enumerate",
                "Global enumerate label",
                "Sets the default numbering style for enumerate environments.",
                "Global lists",
                "default",
                vec![
                    choice("default", "Default"),
                    choice("arabic_paren", "1)"),
                    choice("arabic_wrapped", "(1)"),
                    choice("alph", "a)"),
                    choice("alph_wrapped", "(a)"),
                    choice("roman", "i)"),
                    choice("Roman", "I."),
                ],
            ),
        ],
        _ => Vec::new(),
    }
}

fn option(
    package_id: &str,
    option: &str,
    label: &str,
    description: &str,
    value_kind: &str,
    group: &str,
) -> BuilderPackageOptionDescriptor {
    option_with(
        package_id,
        option,
        label,
        description,
        value_kind,
        group,
        Vec::new(),
        None,
        None,
        None,
    )
}

fn dimension_option(
    package_id: &str,
    option: &str,
    label: &str,
    description: &str,
    group: &str,
    default_value: &str,
) -> BuilderPackageOptionDescriptor {
    option_with(
        package_id,
        option,
        label,
        description,
        "dimension",
        group,
        Vec::new(),
        None,
        Some(default_value),
        Some("cm"),
    )
}

fn choice_option(
    package_id: &str,
    option: &str,
    label: &str,
    description: &str,
    group: &str,
    default_value: &str,
    choices: Vec<BuilderPackageOptionChoice>,
) -> BuilderPackageOptionDescriptor {
    option_with(
        package_id,
        option,
        label,
        description,
        "choice",
        group,
        choices,
        None,
        Some(default_value),
        None,
    )
}

fn choice(value: &str, label: &str) -> BuilderPackageOptionChoice {
    BuilderPackageOptionChoice {
        value: value.to_string(),
        label: label.to_string(),
        description: None,
    }
}

fn option_with(
    package_id: &str,
    option: &str,
    label: &str,
    description: &str,
    value_kind: &str,
    group: &str,
    choices: Vec<BuilderPackageOptionChoice>,
    exclusive_group: Option<&str>,
    default_value: Option<&str>,
    unit: Option<&str>,
) -> BuilderPackageOptionDescriptor {
    BuilderPackageOptionDescriptor {
        package_id: package_id.to_string(),
        option: option.to_string(),
        label: label.to_string(),
        description: description.to_string(),
        value_kind: value_kind.to_string(),
        group: group.to_string(),
        choices,
        exclusive_group: exclusive_group.map(str::to_string),
        default_value: default_value.map(str::to_string),
        unit: unit.map(str::to_string),
    }
}

impl BuilderOutput {
    pub fn empty(builder_id: &str) -> Self {
        Self {
            schema_version: 1,
            builder_id: builder_id.to_string(),
            code: String::new(),
            requirements: Vec::new(),
            build_profile: BuilderBuildProfileRequirement::default(),
            warnings: Vec::new(),
        }
    }
}

pub fn list_builders() -> Vec<BuilderDescriptor> {
    vec![
        BuilderDescriptor {
            schema_version: 1,
            id: "geometry".to_string(),
            display_name: "Geometry".to_string(),
            category: BuilderCategory::Layout,
            package_ids: vec!["geometry".to_string()],
            output_targets: vec![BuilderOutputTarget::Preamble],
            support_level: BuilderSupportLevel::Generated,
            capabilities: BuilderCapability {
                supports_preview: true,
                supports_import: false,
                supports_presets: true,
                requires_exact_compile: false,
            },
            description: "Page size, margins, columns, offsets, and header/footer geometry."
                .to_string(),
        },
        BuilderDescriptor {
            schema_version: 1,
            id: "code-highlighting".to_string(),
            display_name: "Code Highlighting".to_string(),
            category: BuilderCategory::Code,
            package_ids: vec!["listings".to_string(), "minted".to_string()],
            output_targets: vec![BuilderOutputTarget::Preamble],
            support_level: BuilderSupportLevel::Generated,
            capabilities: BuilderCapability {
                supports_preview: true,
                supports_import: false,
                supports_presets: true,
                requires_exact_compile: false,
            },
            description: "Preamble setup for listings or minted code rendering.".to_string(),
        },
        BuilderDescriptor {
            schema_version: 1,
            id: "xcolor".to_string(),
            display_name: "Xcolor Palette".to_string(),
            category: BuilderCategory::Document,
            package_ids: vec!["xcolor".to_string()],
            output_targets: vec![BuilderOutputTarget::Preamble, BuilderOutputTarget::Body],
            support_level: BuilderSupportLevel::Generated,
            capabilities: BuilderCapability {
                supports_preview: true,
                supports_import: false,
                supports_presets: true,
                requires_exact_compile: false,
            },
            description: "Package options and reusable document color definitions.".to_string(),
        },
        BuilderDescriptor {
            schema_version: 1,
            id: "fancyhdr".to_string(),
            display_name: "Fancyhdr".to_string(),
            category: BuilderCategory::Layout,
            package_ids: vec!["fancyhdr".to_string()],
            output_targets: vec![BuilderOutputTarget::Preamble],
            support_level: BuilderSupportLevel::Generated,
            capabilities: BuilderCapability {
                supports_preview: true,
                supports_import: false,
                supports_presets: true,
                requires_exact_compile: false,
            },
            description: "Headers, footers, page styles, and header/footer rule widths."
                .to_string(),
        },
        BuilderDescriptor {
            schema_version: 1,
            id: "enumitem".to_string(),
            display_name: "Enumitem Lists".to_string(),
            category: BuilderCategory::Layout,
            package_ids: vec!["enumitem".to_string()],
            output_targets: vec![BuilderOutputTarget::Preamble],
            support_level: BuilderSupportLevel::NativeEditable,
            capabilities: BuilderCapability {
                supports_preview: true,
                supports_import: false,
                supports_presets: true,
                requires_exact_compile: false,
            },
            description: "Global list settings, inline lists, and custom list environments."
                .to_string(),
        },
        BuilderDescriptor {
            schema_version: 1,
            id: "graphicx".to_string(),
            display_name: "Graphicx Figures".to_string(),
            category: BuilderCategory::Graphics,
            package_ids: vec!["graphicx".to_string()],
            output_targets: vec![BuilderOutputTarget::Preamble, BuilderOutputTarget::Body],
            support_level: BuilderSupportLevel::Generated,
            capabilities: BuilderCapability {
                supports_preview: true,
                supports_import: false,
                supports_presets: true,
                requires_exact_compile: false,
            },
            description: "Generate includegraphics commands and optional figure wrappers."
                .to_string(),
        },
        BuilderDescriptor {
            schema_version: 1,
            id: "tables".to_string(),
            display_name: "Table Workbench".to_string(),
            category: BuilderCategory::Tables,
            package_ids: vec!["tabularray".to_string(), "booktabs".to_string()],
            output_targets: vec![BuilderOutputTarget::Preamble, BuilderOutputTarget::Body],
            support_level: BuilderSupportLevel::Generated,
            capabilities: BuilderCapability {
                supports_preview: true,
                supports_import: false,
                supports_presets: true,
                requires_exact_compile: false,
            },
            description: "Generate standard, booktabs, and tabularray table snippets.".to_string(),
        },
        BuilderDescriptor {
            schema_version: 1,
            id: "math".to_string(),
            display_name: "AMS Math Tools".to_string(),
            category: BuilderCategory::Math,
            package_ids: vec!["amsmath".to_string(), "mathtools".to_string()],
            output_targets: vec![BuilderOutputTarget::Preamble, BuilderOutputTarget::Body],
            support_level: BuilderSupportLevel::Generated,
            capabilities: BuilderCapability {
                supports_preview: true,
                supports_import: false,
                supports_presets: true,
                requires_exact_compile: false,
            },
            description: "Generate AMS math environments, matrices, and mathtools snippets."
                .to_string(),
        },
        BuilderDescriptor {
            schema_version: 1,
            id: "siunitx".to_string(),
            display_name: "Siunitx Units".to_string(),
            category: BuilderCategory::Math,
            package_ids: vec!["siunitx".to_string()],
            output_targets: vec![BuilderOutputTarget::Preamble, BuilderOutputTarget::Body],
            support_level: BuilderSupportLevel::Generated,
            capabilities: BuilderCapability {
                supports_preview: true,
                supports_import: false,
                supports_presets: true,
                requires_exact_compile: false,
            },
            description: "Generate SI numbers, units, quantities, ranges, lists, and setup."
                .to_string(),
        },
        BuilderDescriptor {
            schema_version: 1,
            id: "graphics-studio".to_string(),
            display_name: "Graphics Studio".to_string(),
            category: BuilderCategory::Graphics,
            package_ids: vec!["tikz".to_string(), "tkz-euclide".to_string()],
            output_targets: vec![
                BuilderOutputTarget::Body,
                BuilderOutputTarget::FullDocument,
            ],
            support_level: BuilderSupportLevel::NativeEditable,
            capabilities: BuilderCapability {
                supports_preview: true,
                supports_import: true,
                supports_presets: false,
                requires_exact_compile: false,
            },
            description:
                "Interactive TikZ and tkz-euclide construction editing with instant and exact previews."
                    .to_string(),
        },
    ]
}

#[cfg(test)]
mod registry_tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn registry_contains_unique_builder_ids() {
        let builders = list_builders();
        let unique_ids = builders
            .iter()
            .map(|builder| builder.id.as_str())
            .collect::<HashSet<_>>();

        assert_eq!(builders.len(), unique_ids.len());
        assert!(builders.iter().any(|builder| builder.id == "geometry"));
        assert!(builders
            .iter()
            .any(|builder| builder.id == "code-highlighting"));
        assert!(builders.iter().any(|builder| builder.id == "xcolor"));
        assert!(builders.iter().any(|builder| builder.id == "fancyhdr"));
        assert!(builders.iter().any(|builder| builder.id == "enumitem"));
        assert!(builders.iter().any(|builder| builder.id == "graphicx"));
        assert!(builders
            .iter()
            .any(|builder| builder.id == "graphics-studio"));
        assert!(builders.iter().any(|builder| builder.id == "tables"));
        assert!(builders.iter().any(|builder| builder.id == "math"));
        assert!(builders.iter().any(|builder| builder.id == "siunitx"));
    }

    #[test]
    fn registry_describes_known_packages_and_targets() {
        let builders = list_builders();
        let geometry = builders
            .iter()
            .find(|builder| builder.id == "geometry")
            .expect("geometry descriptor");
        assert_eq!(geometry.category, BuilderCategory::Layout);
        assert_eq!(geometry.package_ids, vec!["geometry"]);
        assert_eq!(geometry.output_targets, vec![BuilderOutputTarget::Preamble]);

        let code = builders
            .iter()
            .find(|builder| builder.id == "code-highlighting")
            .expect("code-highlighting descriptor");
        assert!(code.package_ids.iter().any(|package| package == "listings"));
        assert!(code.package_ids.iter().any(|package| package == "minted"));

        let xcolor = builders
            .iter()
            .find(|builder| builder.id == "xcolor")
            .expect("xcolor descriptor");
        assert_eq!(xcolor.package_ids, vec!["xcolor"]);
        assert_eq!(
            xcolor.output_targets,
            vec![BuilderOutputTarget::Preamble, BuilderOutputTarget::Body]
        );

        let fancyhdr = builders
            .iter()
            .find(|builder| builder.id == "fancyhdr")
            .expect("fancyhdr descriptor");
        assert_eq!(fancyhdr.category, BuilderCategory::Layout);
        assert_eq!(fancyhdr.package_ids, vec!["fancyhdr"]);

        let graphicx = builders
            .iter()
            .find(|builder| builder.id == "graphicx")
            .expect("graphicx descriptor");
        assert_eq!(graphicx.category, BuilderCategory::Graphics);
        assert_eq!(graphicx.package_ids, vec!["graphicx"]);
        assert_eq!(
            graphicx.output_targets,
            vec![BuilderOutputTarget::Preamble, BuilderOutputTarget::Body]
        );

        let graphics_studio = builders
            .iter()
            .find(|builder| builder.id == "graphics-studio")
            .expect("graphics-studio descriptor");
        assert_eq!(graphics_studio.category, BuilderCategory::Graphics);
        assert_eq!(graphics_studio.package_ids, vec!["tikz", "tkz-euclide"]);
        assert_eq!(
            graphics_studio.output_targets,
            vec![BuilderOutputTarget::Body, BuilderOutputTarget::FullDocument]
        );
        assert_eq!(
            graphics_studio.support_level,
            BuilderSupportLevel::NativeEditable
        );
        assert!(graphics_studio.capabilities.supports_preview);
        assert!(graphics_studio.capabilities.supports_import);
        assert!(!graphics_studio.capabilities.supports_presets);
        assert!(!graphics_studio.capabilities.requires_exact_compile);
        let serialized =
            serde_json::to_value(graphics_studio).expect("descriptor should serialize");
        assert_eq!(serialized["category"], "graphics");
        assert_eq!(serialized["outputTargets"][0], "body");
        assert_eq!(serialized["outputTargets"][1], "fullDocument");
        assert_eq!(serialized["supportLevel"], "nativeEditable");
        assert_eq!(serialized["capabilities"]["supportsPreview"], true);
        assert_eq!(serialized["capabilities"]["supportsImport"], true);
        assert_eq!(serialized["capabilities"]["supportsPresets"], false);
        assert_eq!(serialized["capabilities"]["requiresExactCompile"], false);

        let tables = builders
            .iter()
            .find(|builder| builder.id == "tables")
            .expect("tables descriptor");
        assert_eq!(tables.category, BuilderCategory::Tables);
        assert_eq!(tables.package_ids, vec!["tabularray", "booktabs"]);
        assert_eq!(
            tables.output_targets,
            vec![BuilderOutputTarget::Preamble, BuilderOutputTarget::Body]
        );

        let enumitem = builders
            .iter()
            .find(|builder| builder.id == "enumitem")
            .expect("enumitem descriptor");
        assert_eq!(enumitem.category, BuilderCategory::Layout);
        assert_eq!(enumitem.package_ids, vec!["enumitem"]);

        let siunitx = builders
            .iter()
            .find(|builder| builder.id == "siunitx")
            .expect("siunitx descriptor");
        assert_eq!(siunitx.category, BuilderCategory::Math);
        assert_eq!(siunitx.package_ids, vec!["siunitx"]);
        assert_eq!(
            siunitx.output_targets,
            vec![BuilderOutputTarget::Preamble, BuilderOutputTarget::Body]
        );

        let math = builders
            .iter()
            .find(|builder| builder.id == "math")
            .expect("math descriptor");
        assert_eq!(math.category, BuilderCategory::Math);
        assert_eq!(math.package_ids, vec!["amsmath", "mathtools"]);
        assert_eq!(
            math.output_targets,
            vec![BuilderOutputTarget::Preamble, BuilderOutputTarget::Body]
        );
    }

    #[test]
    fn registry_exposes_discoverable_builder_options() {
        let geometry_options = list_builder_options("geometry");
        assert!(geometry_options
            .iter()
            .any(|option| option.option == "includehead" && option.value_kind == "flag"));
        assert!(geometry_options
            .iter()
            .any(|option| option.option == "top" && option.value_kind == "dimension"));
        assert!(geometry_options.iter().any(|option| {
            option.option == "top"
                && option.unit.as_deref() == Some("cm")
                && option.default_value.as_deref() == Some("2.5")
        }));
        assert!(geometry_options
            .iter()
            .any(|option| { option.option == "marginparsep" && option.value_kind == "dimension" }));
        assert!(geometry_options.iter().any(|option| {
            option.option == "marginparwidth" && option.value_kind == "dimension"
        }));

        let code_options = list_builder_options("code-highlighting");
        assert!(code_options
            .iter()
            .any(|option| option.package_id == "listings" && option.option == "numbers=left"));
        assert!(code_options
            .iter()
            .any(|option| option.package_id == "minted" && option.option == "linenos"));
        assert!(code_options.iter().any(|option| {
            option.package_id == "minted"
                && option.option == "style"
                && option.value_kind == "choice"
                && option
                    .choices
                    .iter()
                    .any(|choice| choice.value == "monokai")
        }));

        let xcolor_options = list_builder_options("xcolor");
        assert!(xcolor_options
            .iter()
            .any(|option| option.option == "dvipsnames"));
        assert!(xcolor_options.iter().any(|option| option.option == "cmyk"));
        assert!(xcolor_options.iter().any(|option| {
            option.group == "Drivers"
                && option.option == "pdftex"
                && option.exclusive_group.as_deref() == Some("driver")
        }));

        let enumitem_options = list_builder_options("enumitem");
        assert!(enumitem_options
            .iter()
            .any(|option| option.option == "inline" && option.value_kind == "flag"));
        assert!(enumitem_options.iter().any(|option| {
            option.option == "enumerate"
                && option.value_kind == "choice"
                && option
                    .choices
                    .iter()
                    .any(|choice| choice.value == "alph_wrapped")
        }));
    }
}
