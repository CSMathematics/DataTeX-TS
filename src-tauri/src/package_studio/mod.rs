pub mod builders;
pub mod stoicheia;
mod stoicheia_process;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SourcePosition {
    pub byte: usize,
    pub line: usize,
    pub column: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SourceRange {
    pub start: SourcePosition,
    pub end: SourcePosition,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PackageDeclarationKind {
    UsePackage,
    RequirePackage,
    DocumentClass,
    TikzLibrary,
    PgfplotsCompat,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PackageDeclaration {
    pub kind: PackageDeclarationKind,
    pub name: String,
    pub options: Vec<String>,
    pub range: SourceRange,
    pub command_range: SourceRange,
    pub raw: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PackageDiagnosticSeverity {
    Info,
    Warning,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PackageDiagnostic {
    pub code: String,
    pub severity: PackageDiagnosticSeverity,
    pub message: String,
    pub range: Option<SourceRange>,
    pub package_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LatexPackageAnalysis {
    pub schema_version: u32,
    pub revision: u64,
    pub declarations: Vec<PackageDeclaration>,
    pub packages: Vec<String>,
    pub document_class: Option<PackageDeclaration>,
    pub diagnostics: Vec<PackageDiagnostic>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TextEdit {
    pub range: SourceRange,
    pub replacement: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PackageEditPlan {
    pub schema_version: u32,
    pub revision: u64,
    pub title: String,
    pub summary: String,
    pub edits: Vec<TextEdit>,
    pub diagnostics: Vec<PackageDiagnostic>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphicsDocumentEditRequest {
    pub schema_version: u32,
    pub revision: u64,
    pub document_id: String,
    pub target_file_path: String,
    pub baseline_source: String,
    pub replacement_source: String,
    pub baseline_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum GraphicsTikzpictureTarget {
    Cursor {
        byte: usize,
    },
    Range {
        #[serde(rename = "startByte")]
        start_byte: usize,
        #[serde(rename = "endByte")]
        end_byte: usize,
    },
    /// Zero-based position among the real `tikzpicture` environments in the
    /// baseline document, ordered by their opening command.
    Ordinal {
        ordinal: usize,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphicsTikzpictureEditRequest {
    pub schema_version: u32,
    pub revision: u64,
    pub document_id: String,
    pub target_file_path: String,
    pub baseline_source: String,
    pub replacement_source: String,
    pub baseline_sha256: String,
    pub target: GraphicsTikzpictureTarget,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphicsTikzpictureDiscoveryRequest {
    pub schema_version: u32,
    pub revision: u64,
    pub document_id: String,
    pub target_file_path: String,
    pub baseline_source: String,
    pub replacement_source: String,
    pub baseline_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphicsTikzpictureTargetDescriptor {
    /// Zero-based position in document order.
    pub ordinal: usize,
    pub baseline_range: SourceRange,
    pub replacement_range: Option<SourceRange>,
    pub source_sha256: String,
    pub label: String,
    pub preview: String,
    pub changed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphicsTikzpictureDiscovery {
    pub schema_version: u32,
    pub revision: u64,
    pub document_id: String,
    pub target_file_path: String,
    pub baseline_sha256: String,
    pub targets: Vec<GraphicsTikzpictureTargetDescriptor>,
    pub outside_changes: bool,
    pub structurally_compatible: bool,
    pub structural_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphicsTikzpictureFocusRequest {
    pub schema_version: u32,
    pub revision: u64,
    pub document_id: String,
    pub target_file_path: String,
    pub baseline_source: String,
    pub baseline_sha256: String,
    pub target: GraphicsTikzpictureTarget,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphicsTikzpictureFocus {
    pub schema_version: u32,
    pub revision: u64,
    pub document_id: String,
    pub target_file_path: String,
    pub baseline_sha256: String,
    pub working_source: String,
    pub working_sha256: String,
    pub target: GraphicsTikzpictureTargetDescriptor,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphicsNewDrawingTemplateRequest {
    pub schema_version: u32,
    pub revision: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphicsNewDrawingTemplate {
    pub schema_version: u32,
    pub revision: u64,
    pub source: String,
    pub source_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum GraphicsDrawingInsertionTarget {
    Cursor {
        byte: usize,
    },
    BeforeEndDocument,
    Selection {
        #[serde(rename = "startByte")]
        start_byte: usize,
        #[serde(rename = "endByte")]
        end_byte: usize,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum GraphicsDrawingWrapper {
    #[default]
    Inline,
    Figure {
        placement: Option<String>,
        #[serde(default = "default_graphics_figure_centering")]
        centering: bool,
        caption: Option<String>,
        label: Option<String>,
    },
}

fn default_graphics_figure_centering() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphicsDrawingInsertRequest {
    pub schema_version: u32,
    pub revision: u64,
    pub document_id: String,
    pub target_file_path: String,
    pub baseline_source: String,
    pub drawing_source: String,
    pub baseline_sha256: String,
    pub target: GraphicsDrawingInsertionTarget,
    #[serde(default)]
    pub wrapper: GraphicsDrawingWrapper,
    #[serde(default)]
    pub required_packages: Vec<String>,
    #[serde(default)]
    pub required_tikz_libraries: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AddPackageRequest {
    pub source: String,
    pub revision: u64,
    pub package_id: String,
    #[serde(default)]
    pub options: Vec<String>,
    #[serde(default)]
    pub update_existing: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemovePackageRequest {
    pub source: String,
    pub revision: u64,
    pub package_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MovePackageRequest {
    pub source: String,
    pub revision: u64,
    pub package_id: String,
    pub target: String,
    pub after_package_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedBlockRequest {
    pub source: String,
    pub revision: u64,
    pub block_id: String,
    pub code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ManagedGeneratedBlock {
    pub block_id: String,
    pub code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApplyBuilderConfigurationRequest {
    pub source: String,
    pub revision: u64,
    pub builder_id: String,
    pub enabled: bool,
    #[serde(default)]
    pub managed_package_ids: Vec<String>,
    #[serde(default)]
    pub requirements: Vec<builders::BuilderPackageRequirement>,
    #[serde(default)]
    pub generated_blocks: Vec<ManagedGeneratedBlock>,
}

#[tauri::command]
pub fn package_studio_analyze_latex_cmd(source: String, revision: u64) -> LatexPackageAnalysis {
    analyze_latex_packages(&source, revision)
}

#[tauri::command]
pub fn package_studio_plan_add_package_cmd(
    request: AddPackageRequest,
) -> Result<PackageEditPlan, String> {
    plan_add_package(request)
}

#[tauri::command]
pub fn package_studio_plan_remove_package_cmd(
    request: RemovePackageRequest,
) -> Result<PackageEditPlan, String> {
    plan_remove_package(request)
}

#[tauri::command]
pub fn package_studio_plan_move_package_cmd(
    request: MovePackageRequest,
) -> Result<PackageEditPlan, String> {
    plan_move_package(request)
}

#[tauri::command]
pub fn package_studio_plan_generated_block_cmd(
    request: GeneratedBlockRequest,
) -> Result<PackageEditPlan, String> {
    plan_generated_block(request)
}

#[tauri::command]
pub fn package_studio_plan_apply_builder_configuration_cmd(
    request: ApplyBuilderConfigurationRequest,
) -> Result<PackageEditPlan, String> {
    plan_apply_builder_configuration(request)
}

#[tauri::command]
pub fn package_studio_plan_graphics_document_edit_cmd(
    request: GraphicsDocumentEditRequest,
) -> Result<PackageEditPlan, String> {
    plan_graphics_document_edit(request)
}

#[tauri::command]
pub fn package_studio_plan_graphics_tikzpicture_edit_cmd(
    request: GraphicsTikzpictureEditRequest,
) -> Result<PackageEditPlan, String> {
    plan_graphics_tikzpicture_edit(request)
}

#[tauri::command]
pub fn package_studio_discover_graphics_tikzpictures_cmd(
    request: GraphicsTikzpictureDiscoveryRequest,
) -> Result<GraphicsTikzpictureDiscovery, String> {
    discover_graphics_tikzpicture_targets(request)
}

#[tauri::command]
pub fn package_studio_prepare_graphics_tikzpicture_cmd(
    request: GraphicsTikzpictureFocusRequest,
) -> Result<GraphicsTikzpictureFocus, String> {
    prepare_graphics_tikzpicture(request)
}

#[tauri::command]
pub fn package_studio_prepare_graphics_new_drawing_cmd(
    request: GraphicsNewDrawingTemplateRequest,
) -> Result<GraphicsNewDrawingTemplate, String> {
    prepare_graphics_new_drawing(request)
}

#[tauri::command]
pub fn package_studio_plan_graphics_drawing_insert_cmd(
    request: GraphicsDrawingInsertRequest,
) -> Result<PackageEditPlan, String> {
    plan_graphics_drawing_insert(request)
}

#[tauri::command]
pub fn package_studio_list_builders_cmd() -> Vec<builders::BuilderDescriptor> {
    builders::list_builders()
}

#[tauri::command]
pub fn package_studio_list_builder_options_cmd(
    builder_id: String,
) -> Vec<builders::BuilderPackageOptionDescriptor> {
    builders::list_builder_options(&builder_id)
}

#[tauri::command]
pub fn package_studio_generate_geometry_cmd(
    request: builders::geometry::GeometryBuilderRequest,
) -> builders::geometry::GeometryBuilderOutput {
    builders::geometry::generate_geometry(request)
}

#[tauri::command]
pub fn package_studio_generate_graphicx_cmd(
    request: builders::graphicx::GraphicxBuilderRequest,
) -> builders::graphicx::GraphicxBuilderOutput {
    builders::graphicx::generate_graphicx(request)
}

#[tauri::command]
pub fn package_studio_generate_table_cmd(
    request: builders::tables::TableBuilderRequest,
) -> builders::tables::TableBuilderOutput {
    builders::tables::generate_table(request)
}

#[tauri::command]
pub fn package_studio_generate_siunitx_cmd(
    request: builders::siunitx::SiunitxBuilderRequest,
) -> builders::siunitx::SiunitxBuilderOutput {
    builders::siunitx::generate_siunitx(request)
}

#[tauri::command]
pub fn package_studio_generate_math_cmd(
    request: builders::math::MathBuilderRequest,
) -> builders::math::MathBuilderOutput {
    builders::math::generate_math(request)
}

#[tauri::command]
pub fn package_studio_import_math_cmd(source: String) -> builders::math::MathBuilderRequest {
    import_math_from_source(&source)
}

#[tauri::command]
pub fn package_studio_list_math_imports_cmd(
    source: String,
) -> Vec<builders::math::MathImportedSnippet> {
    list_math_imports_from_source(&source)
}

#[tauri::command]
pub fn package_studio_import_siunitx_cmd(
    source: String,
) -> builders::siunitx::SiunitxBuilderRequest {
    import_siunitx_from_source(&source)
}

#[tauri::command]
pub fn package_studio_import_graphicx_cmd(
    source: String,
) -> builders::graphicx::GraphicxBuilderRequest {
    import_graphicx_from_source(&source)
}

#[tauri::command]
pub fn package_studio_import_geometry_cmd(
    source: String,
) -> builders::geometry::GeometryBuilderRequest {
    import_geometry_from_source(&source)
}

#[tauri::command]
pub fn package_studio_generate_fancyhdr_cmd(
    request: builders::fancyhdr::FancyhdrBuilderRequest,
) -> builders::fancyhdr::FancyhdrBuilderOutput {
    builders::fancyhdr::generate_fancyhdr(request)
}

#[tauri::command]
pub fn package_studio_import_fancyhdr_cmd(
    source: String,
) -> builders::fancyhdr::FancyhdrBuilderRequest {
    import_fancyhdr_from_source(&source)
}

#[tauri::command]
pub fn package_studio_generate_enumitem_cmd(
    request: builders::enumitem::EnumitemBuilderRequest,
) -> builders::enumitem::EnumitemBuilderOutput {
    builders::enumitem::generate_enumitem(request)
}

#[tauri::command]
pub fn package_studio_import_enumitem_cmd(
    source: String,
) -> builders::enumitem::EnumitemBuilderRequest {
    import_enumitem_from_source(&source)
}

#[tauri::command]
pub fn package_studio_generate_code_highlighting_cmd(
    request: builders::code_highlighting::CodeHighlightingBuilderRequest,
) -> builders::code_highlighting::CodeHighlightingBuilderOutput {
    builders::code_highlighting::generate_code_highlighting(request)
}

#[tauri::command]
pub fn package_studio_generate_code_highlighting_snippet_cmd(
    request: builders::code_highlighting::CodeHighlightingBuilderRequest,
    code: String,
) -> String {
    builders::code_highlighting::generate_code_highlighting_snippet(request, code)
}

#[tauri::command]
pub fn package_studio_import_code_highlighting_cmd(
    source: String,
) -> builders::code_highlighting::CodeHighlightingBuilderRequest {
    import_code_highlighting_from_source(&source)
}

#[tauri::command]
pub fn package_studio_generate_xcolor_cmd(
    request: builders::xcolor::XcolorBuilderRequest,
) -> builders::xcolor::XcolorBuilderOutput {
    builders::xcolor::generate_xcolor(request)
}

#[tauri::command]
pub fn package_studio_import_xcolor_cmd(source: String) -> builders::xcolor::XcolorBuilderRequest {
    import_xcolor_from_source(&source)
}

pub fn analyze_latex_packages(source: &str, revision: u64) -> LatexPackageAnalysis {
    let mut declarations = Vec::new();
    let mut document_class = None;

    for command in find_latex_commands(source) {
        match command.name.as_str() {
            "usepackage" | "RequirePackage" => {
                if let Some(required) = command.required_args.first() {
                    for package_name in split_csv(required) {
                        declarations.push(PackageDeclaration {
                            kind: if command.name == "usepackage" {
                                PackageDeclarationKind::UsePackage
                            } else {
                                PackageDeclarationKind::RequirePackage
                            },
                            name: package_name,
                            options: command
                                .optional_args
                                .first()
                                .map(|arg| split_csv(arg))
                                .unwrap_or_default(),
                            range: command.range.clone(),
                            command_range: command.command_range.clone(),
                            raw: command.raw.clone(),
                        });
                    }
                }
            }
            "documentclass" => {
                if let Some(class_name) = command.required_args.first() {
                    let declaration = PackageDeclaration {
                        kind: PackageDeclarationKind::DocumentClass,
                        name: class_name.trim().to_string(),
                        options: command
                            .optional_args
                            .first()
                            .map(|arg| split_csv(arg))
                            .unwrap_or_default(),
                        range: command.range.clone(),
                        command_range: command.command_range.clone(),
                        raw: command.raw.clone(),
                    };
                    document_class = Some(declaration.clone());
                    declarations.push(declaration);
                }
            }
            "usetikzlibrary" => {
                if let Some(libraries) = command.required_args.first() {
                    for library in split_csv(libraries) {
                        declarations.push(PackageDeclaration {
                            kind: PackageDeclarationKind::TikzLibrary,
                            name: library,
                            options: Vec::new(),
                            range: command.range.clone(),
                            command_range: command.command_range.clone(),
                            raw: command.raw.clone(),
                        });
                    }
                }
            }
            "pgfplotsset" => {
                if let Some(body) = command.required_args.first() {
                    if let Some(compat) = parse_pgfplots_compat(body) {
                        declarations.push(PackageDeclaration {
                            kind: PackageDeclarationKind::PgfplotsCompat,
                            name: compat,
                            options: Vec::new(),
                            range: command.range.clone(),
                            command_range: command.command_range.clone(),
                            raw: command.raw.clone(),
                        });
                    }
                }
            }
            _ => {}
        }
    }

    let mut package_names = BTreeSet::new();
    let mut package_occurrences: BTreeMap<String, Vec<SourceRange>> = BTreeMap::new();
    for declaration in &declarations {
        if matches!(
            declaration.kind,
            PackageDeclarationKind::UsePackage | PackageDeclarationKind::RequirePackage
        ) {
            let key = declaration.name.to_lowercase();
            package_names.insert(declaration.name.clone());
            package_occurrences
                .entry(key)
                .or_default()
                .push(declaration.range.clone());
        }
    }

    let mut diagnostics = Vec::new();
    for (package_id, ranges) in package_occurrences {
        if ranges.len() > 1 {
            diagnostics.push(PackageDiagnostic {
                code: "duplicate-package".to_string(),
                severity: PackageDiagnosticSeverity::Warning,
                message: format!(
                    "Package `{}` is declared {} times.",
                    package_id,
                    ranges.len()
                ),
                range: ranges.first().cloned(),
                package_id: Some(package_id),
            });
        }
    }

    add_package_relationship_diagnostics(&declarations, &mut diagnostics);

    LatexPackageAnalysis {
        schema_version: 1,
        revision,
        declarations,
        packages: package_names.into_iter().collect(),
        document_class,
        diagnostics,
    }
}

pub fn import_enumitem_from_source(source: &str) -> builders::enumitem::EnumitemBuilderRequest {
    let mut request = builders::enumitem::EnumitemBuilderRequest::default();
    let mut custom_lists = BTreeMap::<String, builders::enumitem::EnumitemCustomList>::new();

    for command in find_latex_commands(source) {
        match command.name.as_str() {
            "usepackage" | "RequirePackage" => {
                let options = command
                    .optional_args
                    .first()
                    .map(|arg| split_csv(arg))
                    .unwrap_or_default();
                let loads_enumitem = command
                    .required_args
                    .first()
                    .map(|packages| {
                        split_csv(packages)
                            .iter()
                            .any(|package| package.eq_ignore_ascii_case("enumitem"))
                    })
                    .unwrap_or(false);
                if loads_enumitem {
                    request.inline = options
                        .iter()
                        .any(|option| option.trim().eq_ignore_ascii_case("inline"));
                }
            }
            "newlist" => {
                let Some(name) = command.required_args.first() else {
                    continue;
                };
                let Some(base_type) = command.required_args.get(1) else {
                    continue;
                };
                let Some(name) = enumitem_identifier(name) else {
                    continue;
                };
                let (base_type, inline) = normalize_enumitem_base_type(base_type);
                let label = default_enumitem_label(&base_type).to_string();
                custom_lists.insert(
                    name.clone(),
                    builders::enumitem::EnumitemCustomList {
                        name,
                        base_type,
                        inline,
                        label,
                        spacing: "default".to_string(),
                        wide: false,
                        left_margin_star: false,
                        bold: false,
                        italic: false,
                        align: "default".to_string(),
                        resume: false,
                        start: None,
                    },
                );
            }
            "setlist" => {
                let options = command
                    .required_args
                    .first()
                    .map(String::as_str)
                    .unwrap_or("");
                let target = command.optional_args.first().map(|value| value.trim());
                match target {
                    None => {
                        request.global_spacing = detect_enumitem_spacing(options);
                    }
                    Some("itemize") => {
                        request.itemize_label = detect_enumitem_itemize_label(options);
                    }
                    Some("enumerate") => {
                        request.enumerate_label = detect_enumitem_enumerate_label(options);
                    }
                    Some(target) => {
                        let Some(name) = enumitem_identifier(target) else {
                            continue;
                        };
                        let entry = custom_lists.entry(name.clone()).or_insert_with(|| {
                            builders::enumitem::EnumitemCustomList {
                                name,
                                base_type: "enumerate".to_string(),
                                inline: false,
                                label: "\\arabic*.".to_string(),
                                spacing: "default".to_string(),
                                wide: false,
                                left_margin_star: false,
                                bold: false,
                                italic: false,
                                align: "default".to_string(),
                                resume: false,
                                start: None,
                            }
                        });
                        apply_enumitem_custom_options(entry, options);
                    }
                }
            }
            _ => {}
        }
    }

    if custom_lists.values().any(|list| list.inline) {
        request.inline = true;
    }
    request.custom_lists = custom_lists.into_values().collect();
    request
}

pub fn import_geometry_from_source(source: &str) -> builders::geometry::GeometryBuilderRequest {
    let mut request = builders::geometry::GeometryBuilderRequest::default();

    for command in find_latex_commands(source) {
        match command.name.as_str() {
            "documentclass" => {
                let options = command
                    .optional_args
                    .first()
                    .map(|arg| split_csv(arg))
                    .unwrap_or_default();
                if options
                    .iter()
                    .any(|option| option.trim().eq_ignore_ascii_case("twoside"))
                {
                    request.sidedness = "twoside".to_string();
                }
                if options
                    .iter()
                    .any(|option| option.trim().eq_ignore_ascii_case("oneside"))
                {
                    request.sidedness = "oneside".to_string();
                }
            }
            "usepackage" | "RequirePackage" => {
                let loads_geometry = command
                    .required_args
                    .first()
                    .map(|packages| {
                        split_csv(packages)
                            .iter()
                            .any(|package| package.eq_ignore_ascii_case("geometry"))
                    })
                    .unwrap_or(false);
                if !loads_geometry {
                    continue;
                }
                let options = command
                    .optional_args
                    .first()
                    .map(|arg| split_csv(arg))
                    .unwrap_or_default();
                apply_geometry_options(&mut request, &options);
            }
            _ => {}
        }
    }

    request
}

pub fn import_siunitx_from_source(source: &str) -> builders::siunitx::SiunitxBuilderRequest {
    let mut request = builders::siunitx::SiunitxBuilderRequest::default();
    let mut imported_body_snippet = false;
    let mut imported_setup = false;

    for command in find_latex_commands(source) {
        match command.name.as_str() {
            "usepackage" | "RequirePackage" => {
                let loads_siunitx = command
                    .required_args
                    .first()
                    .map(|packages| {
                        split_csv(packages)
                            .iter()
                            .any(|package| package.eq_ignore_ascii_case("siunitx"))
                    })
                    .unwrap_or(false);
                if loads_siunitx {
                    for option in command
                        .optional_args
                        .first()
                        .map(|arg| split_csv(arg))
                        .unwrap_or_default()
                    {
                        push_siunitx_option_compatibility_warning(
                            &mut request.compatibility_warnings,
                            &option,
                        );
                    }
                }
            }
            "sisetup" => {
                if let Some(options) = command.required_args.first() {
                    apply_siunitx_setup_options(&mut request, options);
                    for option in split_csv(options) {
                        push_siunitx_option_compatibility_warning(
                            &mut request.compatibility_warnings,
                            &option,
                        );
                    }
                    imported_setup = true;
                }
            }
            "SI" => {
                request.snippet_mode = "qty".to_string();
                push_siunitx_legacy_command_warning(&mut request.compatibility_warnings, "\\SI");
                push_siunitx_optional_arg_compatibility_warnings(
                    &mut request.compatibility_warnings,
                    command.optional_args.first(),
                );
                apply_siunitx_number_options(&mut request, command.optional_args.first());
                if let Some(number) = command.required_args.first() {
                    request.number = number.trim().to_string();
                }
                if let Some(units) = command.required_args.get(1) {
                    request.units = parse_siunitx_units(units);
                }
                imported_body_snippet = true;
            }
            "si" => {
                request.snippet_mode = "unit".to_string();
                push_siunitx_legacy_command_warning(&mut request.compatibility_warnings, "\\si");
                if let Some(units) = command.required_args.first() {
                    request.units = parse_siunitx_units(units);
                }
                imported_body_snippet = true;
            }
            "SIlist" => {
                request.snippet_mode = "qtylist".to_string();
                push_siunitx_legacy_command_warning(
                    &mut request.compatibility_warnings,
                    "\\SIlist",
                );
                push_siunitx_optional_arg_compatibility_warnings(
                    &mut request.compatibility_warnings,
                    command.optional_args.first(),
                );
                apply_siunitx_number_options(&mut request, command.optional_args.first());
                if let Some(list_content) = command.required_args.first() {
                    request.list_content = list_content
                        .split(';')
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .collect::<Vec<_>>()
                        .join("; ");
                }
                if let Some(units) = command.required_args.get(1) {
                    request.units = parse_siunitx_units(units);
                }
                imported_body_snippet = true;
            }
            "SIrange" => {
                request.snippet_mode = "qtyrange".to_string();
                push_siunitx_legacy_command_warning(
                    &mut request.compatibility_warnings,
                    "\\SIrange",
                );
                push_siunitx_optional_arg_compatibility_warnings(
                    &mut request.compatibility_warnings,
                    command.optional_args.first(),
                );
                apply_siunitx_number_options(&mut request, command.optional_args.first());
                if let Some(start) = command.required_args.first() {
                    request.range_start = start.trim().to_string();
                }
                if let Some(end) = command.required_args.get(1) {
                    request.range_end = end.trim().to_string();
                }
                if let Some(units) = command.required_args.get(2) {
                    request.units = parse_siunitx_units(units);
                }
                imported_body_snippet = true;
            }
            "num" => {
                request.snippet_mode = "num".to_string();
                push_siunitx_optional_arg_compatibility_warnings(
                    &mut request.compatibility_warnings,
                    command.optional_args.first(),
                );
                apply_siunitx_number_options(&mut request, command.optional_args.first());
                if let Some(number) = command.required_args.first() {
                    request.number = number.trim().to_string();
                }
                imported_body_snippet = true;
            }
            "unit" => {
                request.snippet_mode = "unit".to_string();
                if let Some(units) = command.required_args.first() {
                    request.units = parse_siunitx_units(units);
                }
                imported_body_snippet = true;
            }
            "qty" => {
                request.snippet_mode = "qty".to_string();
                push_siunitx_optional_arg_compatibility_warnings(
                    &mut request.compatibility_warnings,
                    command.optional_args.first(),
                );
                apply_siunitx_number_options(&mut request, command.optional_args.first());
                if let Some(number) = command.required_args.first() {
                    request.number = number.trim().to_string();
                }
                if let Some(units) = command.required_args.get(1) {
                    request.units = parse_siunitx_units(units);
                }
                imported_body_snippet = true;
            }
            "qtylist" => {
                request.snippet_mode = "qtylist".to_string();
                push_siunitx_optional_arg_compatibility_warnings(
                    &mut request.compatibility_warnings,
                    command.optional_args.first(),
                );
                apply_siunitx_number_options(&mut request, command.optional_args.first());
                if let Some(list_content) = command.required_args.first() {
                    request.list_content = list_content
                        .split(';')
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .collect::<Vec<_>>()
                        .join("; ");
                }
                if let Some(units) = command.required_args.get(1) {
                    request.units = parse_siunitx_units(units);
                }
                imported_body_snippet = true;
            }
            "qtyrange" => {
                request.snippet_mode = "qtyrange".to_string();
                push_siunitx_optional_arg_compatibility_warnings(
                    &mut request.compatibility_warnings,
                    command.optional_args.first(),
                );
                apply_siunitx_number_options(&mut request, command.optional_args.first());
                if let Some(start) = command.required_args.first() {
                    request.range_start = start.trim().to_string();
                }
                if let Some(end) = command.required_args.get(1) {
                    request.range_end = end.trim().to_string();
                }
                if let Some(units) = command.required_args.get(2) {
                    request.units = parse_siunitx_units(units);
                }
                imported_body_snippet = true;
            }
            _ => {}
        }
    }

    if imported_setup && !imported_body_snippet {
        request.snippet_mode = "setup".to_string();
    }

    request
}

pub fn import_math_from_source(source: &str) -> builders::math::MathBuilderRequest {
    list_math_imports_from_source(source)
        .into_iter()
        .next()
        .map(|snippet| snippet.request)
        .unwrap_or_default()
}

pub fn list_math_imports_from_source(source: &str) -> Vec<builders::math::MathImportedSnippet> {
    let commands = find_latex_commands(source);
    let mut snippets = Vec::new();

    collect_math_environment_imports(source, &commands, &mut snippets);
    collect_math_delimiter_imports(source, &mut snippets);
    collect_paired_delimiter_imports(source, &mut snippets);
    collect_math_command_imports(&commands, &mut snippets);

    snippets.sort_by_key(|snippet| {
        snippet
            .request
            .imported_source_range
            .as_ref()
            .map(|range| range.start.byte)
            .unwrap_or(usize::MAX)
    });
    snippets.dedup_by_key(|snippet| {
        snippet
            .request
            .imported_source_range
            .as_ref()
            .map(|range| (range.start.byte, range.end.byte))
            .unwrap_or((usize::MAX, usize::MAX))
    });
    snippets
}

fn collect_math_command_imports(
    commands: &[ParsedCommand],
    snippets: &mut Vec<builders::math::MathImportedSnippet>,
) {
    for command in commands {
        if let Some(request) = import_math_command(command) {
            push_math_import_candidate(snippets, request, command.name.clone());
        }
    }
}

fn import_math_command(command: &ParsedCommand) -> Option<builders::math::MathBuilderRequest> {
    match command.name.as_str() {
        "prescript" => {
            let mut request = builders::math::MathBuilderRequest {
                mode: "tool".to_string(),
                tool_type: "prescript".to_string(),
                ..builders::math::MathBuilderRequest::default()
            };
            if let Some(value) = command.required_args.first() {
                request.prescript_sup = value.trim().to_string();
            }
            if let Some(value) = command.required_args.get(1) {
                request.prescript_sub = value.trim().to_string();
            }
            if let Some(value) = command.required_args.get(2) {
                request.prescript_arg = value.trim().to_string();
            }
            request.imported_source_range = Some(command.range.clone());
            Some(request)
        }
        "splitfrac" | "splitdfrac" => {
            let mut request = builders::math::MathBuilderRequest {
                mode: "tool".to_string(),
                tool_type: "split_fraction".to_string(),
                split_fraction_type: command.name.clone(),
                ..builders::math::MathBuilderRequest::default()
            };
            if let Some(value) = command.required_args.first() {
                request.split_fraction_top = value.trim().to_string();
            }
            if let Some(value) = command.required_args.get(1) {
                request.split_fraction_bottom = value.trim().to_string();
            }
            request.imported_source_range = Some(command.range.clone());
            Some(request)
        }
        "newtagform" => {
            let mut request = builders::math::MathBuilderRequest {
                mode: "tag".to_string(),
                tag_action: "newtagform".to_string(),
                ..builders::math::MathBuilderRequest::default()
            };
            if let Some(value) = command.required_args.first() {
                request.tag_name = value.trim().to_string();
            }
            if let Some(value) = command.required_args.get(1) {
                request.tag_left = value.trim().to_string();
            }
            if let Some(value) = command.required_args.get(2) {
                request.tag_right = value.trim().to_string();
            }
            if let Some(value) = command.optional_args.first() {
                request.tag_format = value.trim().to_string();
            }
            request.imported_source_range = Some(command.range.clone());
            Some(request)
        }
        "usetagform" | "eqref" | "refeq" | "noeqref" => {
            let mut request = builders::math::MathBuilderRequest {
                mode: "tag".to_string(),
                tag_action: command.name.clone(),
                ..builders::math::MathBuilderRequest::default()
            };
            if let Some(value) = command.required_args.first() {
                if command.name == "usetagform" {
                    request.tag_name = value.trim().to_string();
                } else {
                    request.tag_ref_label = value.trim().to_string();
                }
            }
            request.imported_source_range = Some(command.range.clone());
            Some(request)
        }
        name if is_mathtools_arrow_name(name) => {
            let mut request = builders::math::MathBuilderRequest {
                mode: "tool".to_string(),
                tool_type: "arrow".to_string(),
                arrow_type: name.to_string(),
                ..builders::math::MathBuilderRequest::default()
            };
            if let Some(value) = command.optional_args.first() {
                request.arrow_below = value.trim().to_string();
            }
            if let Some(value) = command.required_args.first() {
                request.arrow_above = value.trim().to_string();
            }
            request.imported_source_range = Some(command.range.clone());
            Some(request)
        }
        name if is_mathtools_bracket_name(name) => {
            let mut request = builders::math::MathBuilderRequest {
                mode: "tool".to_string(),
                tool_type: "bracket".to_string(),
                bracket_type: name.to_string(),
                ..builders::math::MathBuilderRequest::default()
            };
            if let Some(value) = command.required_args.first() {
                request.bracket_content = value.trim().to_string();
            }
            if let Some(value) = command.optional_args.first() {
                request.bracket_thickness = value.trim().to_string();
            }
            if let Some(value) = command.optional_args.get(1) {
                request.bracket_height = value.trim().to_string();
            }
            request.imported_source_range = Some(command.range.clone());
            Some(request)
        }
        _ => None,
    }
}

fn collect_math_environment_imports(
    source: &str,
    commands: &[ParsedCommand],
    snippets: &mut Vec<builders::math::MathImportedSnippet>,
) {
    for begin in commands.iter().filter(|command| command.name == "begin") {
        let Some(request) = import_math_environment_from_begin(source, commands, begin) else {
            continue;
        };
        let label = request_label(&request);
        push_math_import_candidate(
            snippets,
            request,
            if label.is_empty() {
                begin
                    .required_args
                    .first()
                    .map(|value| value.trim().to_string())
                    .unwrap_or_else(|| "environment".to_string())
            } else {
                label
            },
        );
    }
}

fn import_math_environment_from_begin(
    source: &str,
    commands: &[ParsedCommand],
    begin: &ParsedCommand,
) -> Option<builders::math::MathBuilderRequest> {
    let environment = begin.required_args.first()?.trim();
    let (base_environment, starred) = strip_math_environment_star(environment);
    if !is_supported_math_environment(base_environment) {
        return None;
    }
    let end = commands.iter().find(|command| {
        command.name == "end"
            && command.range.start.byte > begin.range.end.byte
            && command
                .required_args
                .first()
                .map(|value| value.trim() == environment)
                .unwrap_or(false)
    })?;

    let body_start = begin.range.end.byte;
    let body_end = end.range.start.byte;
    let body = &source[body_start..body_end];

    if is_supported_matrix_environment(base_environment) {
        let (cells, rows, columns) = import_matrix_cells(body);
        return Some(builders::math::MathBuilderRequest {
            mode: "matrix".to_string(),
            matrix_type: base_environment.to_string(),
            matrix_starred: starred,
            matrix_alignment: begin
                .optional_args
                .first()
                .map(|value| value.trim().to_string())
                .filter(|value| matches!(value.as_str(), "l" | "c" | "r"))
                .unwrap_or_else(|| "c".to_string()),
            matrix_rows: rows,
            matrix_columns: columns,
            matrix_cells: cells,
            imported_source_range: Some(SourceRange {
                start: begin.range.start.clone(),
                end: end.range.end.clone(),
            }),
            ..builders::math::MathBuilderRequest::default()
        });
    }

    let label = commands
        .iter()
        .find(|command| {
            command.name == "label"
                && command.range.start.byte >= body_start
                && command.range.end.byte <= body_end
        })
        .and_then(|command| command.required_args.first())
        .map(|value| value.trim().to_string())
        .unwrap_or_default();
    let content = strip_label_lines(body);
    Some(builders::math::MathBuilderRequest {
        mode: "environment".to_string(),
        environment_type: base_environment.to_string(),
        starred,
        label,
        content,
        imported_source_range: Some(SourceRange {
            start: begin.range.start.clone(),
            end: end.range.end.clone(),
        }),
        ..builders::math::MathBuilderRequest::default()
    })
}

fn collect_math_delimiter_imports(
    source: &str,
    snippets: &mut Vec<builders::math::MathImportedSnippet>,
) {
    let bytes = source.as_bytes();
    let mut index = 0;

    while index < bytes.len() {
        if is_in_comment(source, index) {
            index += 1;
            continue;
        }

        if bytes[index] == b'\\' && index + 1 < bytes.len() {
            match bytes[index + 1] {
                b'[' => {
                    if let Some(end) = find_math_command_delimiter_end(source, index + 2, "\\]") {
                        push_math_delimiter_candidate(
                            source,
                            snippets,
                            index,
                            end + 2,
                            index + 2,
                            end,
                            "display_brackets",
                            "\\[ … \\]",
                        );
                        index = end + 2;
                        continue;
                    }
                }
                b'(' => {
                    if let Some(end) = find_math_command_delimiter_end(source, index + 2, "\\)") {
                        push_math_delimiter_candidate(
                            source,
                            snippets,
                            index,
                            end + 2,
                            index + 2,
                            end,
                            "inline_parens",
                            "\\( … \\)",
                        );
                        index = end + 2;
                        continue;
                    }
                }
                _ => {}
            }
        }

        if bytes[index] == b'$' && !is_escaped_ascii_marker(source, index) {
            if index + 1 < bytes.len() && bytes[index + 1] == b'$' {
                if let Some(end) = find_dollar_delimiter_end(source, index + 2, true) {
                    push_math_delimiter_candidate(
                        source,
                        snippets,
                        index,
                        end + 2,
                        index + 2,
                        end,
                        "display_dollars",
                        "$$ … $$",
                    );
                    index = end + 2;
                    continue;
                }
            } else if let Some(end) = find_dollar_delimiter_end(source, index + 1, false) {
                push_math_delimiter_candidate(
                    source,
                    snippets,
                    index,
                    end + 1,
                    index + 1,
                    end,
                    "inline_dollar",
                    "$ … $",
                );
                index = end + 1;
                continue;
            }
        }

        index += 1;
    }
}

fn push_math_delimiter_candidate(
    source: &str,
    snippets: &mut Vec<builders::math::MathImportedSnippet>,
    range_start: usize,
    range_end: usize,
    content_start: usize,
    content_end: usize,
    delimiter_type: &str,
    label: &str,
) {
    if content_start > content_end || range_start >= range_end || range_end > source.len() {
        return;
    }
    let content = source[content_start..content_end].trim();
    if content.is_empty() {
        return;
    }

    let request = builders::math::MathBuilderRequest {
        mode: "delimited".to_string(),
        delimiter_math_type: delimiter_type.to_string(),
        delimiter_math_content: content.to_string(),
        imported_source_range: Some(range_for_bytes(source, range_start, range_end)),
        ..builders::math::MathBuilderRequest::default()
    };
    push_math_import_candidate_with_label(snippets, request, label.to_string());
}

fn find_math_command_delimiter_end(source: &str, start: usize, close: &str) -> Option<usize> {
    let mut cursor = start;
    while cursor < source.len() {
        if is_in_comment(source, cursor) {
            cursor += 1;
            continue;
        }
        if source[cursor..].starts_with(close) {
            return Some(cursor);
        }
        cursor += source[cursor..].chars().next()?.len_utf8();
    }
    None
}

fn find_dollar_delimiter_end(source: &str, start: usize, double: bool) -> Option<usize> {
    let bytes = source.as_bytes();
    let mut cursor = start;
    while cursor < bytes.len() {
        if is_in_comment(source, cursor) {
            cursor += 1;
            continue;
        }
        if bytes[cursor] == b'$' && !is_escaped_ascii_marker(source, cursor) {
            if double {
                if cursor + 1 < bytes.len() && bytes[cursor + 1] == b'$' {
                    return Some(cursor);
                }
            } else {
                return Some(cursor);
            }
        }
        cursor += 1;
    }
    None
}

fn collect_paired_delimiter_imports(
    source: &str,
    snippets: &mut Vec<builders::math::MathImportedSnippet>,
) {
    let marker = "\\DeclarePairedDelimiter\\";
    let mut offset = 0;
    while let Some(relative_start) = source[offset..].find(marker) {
        let range_start = offset + relative_start;
        if let Some((request, next_offset)) =
            import_paired_delimiter_at_source_offset(source, range_start, marker)
        {
            let label = request_label(&request);
            push_math_import_candidate(snippets, request, label);
            offset = next_offset.max(range_start + marker.len());
        } else {
            offset = range_start + marker.len();
        }
    }
}

fn import_paired_delimiter_at_source_offset(
    source: &str,
    range_start: usize,
    marker: &str,
) -> Option<(builders::math::MathBuilderRequest, usize)> {
    let start = range_start + marker.len();
    let command_end = source[start..]
        .find(|ch: char| !ch.is_ascii_alphabetic())
        .map(|offset| start + offset)
        .unwrap_or(source.len());
    if command_end == start {
        return None;
    }
    let command = &source[start..command_end];
    let mut cursor = skip_horizontal_whitespace(source, command_end);
    let (left, next) = parse_balanced_group(source, cursor, b'{', b'}')?;
    cursor = skip_horizontal_whitespace(source, next);
    let (right, range_end) = parse_balanced_group(source, cursor, b'{', b'}')?;

    let request = builders::math::MathBuilderRequest {
        mode: "tool".to_string(),
        tool_type: "delimiter".to_string(),
        delimiter_command: command.to_string(),
        delimiter_left: left.trim().to_string(),
        delimiter_right: right.trim().to_string(),
        imported_source_range: Some(range_for_bytes(source, range_start, range_end)),
        ..builders::math::MathBuilderRequest::default()
    };
    Some((request, range_end))
}

fn push_math_import_candidate(
    snippets: &mut Vec<builders::math::MathImportedSnippet>,
    request: builders::math::MathBuilderRequest,
    fallback_label: String,
) {
    let label = request_label(&request);
    push_math_import_candidate_inner(
        snippets,
        request,
        if label.is_empty() {
            fallback_label
        } else {
            label
        },
    );
}

fn push_math_import_candidate_with_label(
    snippets: &mut Vec<builders::math::MathImportedSnippet>,
    request: builders::math::MathBuilderRequest,
    label: String,
) {
    push_math_import_candidate_inner(snippets, request, label);
}

fn push_math_import_candidate_inner(
    snippets: &mut Vec<builders::math::MathImportedSnippet>,
    request: builders::math::MathBuilderRequest,
    label: String,
) {
    let Some(range) = request.imported_source_range.clone() else {
        return;
    };
    let kind = math_request_kind(&request);
    let preview = request_preview(&request);
    snippets.push(builders::math::MathImportedSnippet {
        id: format!("math-{}-{}", range.start.byte, range.end.byte),
        kind,
        label,
        preview,
        line: range.start.line,
        request,
    });
}

fn math_request_kind(request: &builders::math::MathBuilderRequest) -> String {
    match request.mode.as_str() {
        "matrix" => "Matrix".to_string(),
        "tool" => match request.tool_type.as_str() {
            "delimiter" => "Paired delimiter".to_string(),
            "split_fraction" => "Split fraction".to_string(),
            "prescript" => "Prescript".to_string(),
            "bracket" => "Bracket".to_string(),
            _ => "Arrow".to_string(),
        },
        "tag" => "Tag".to_string(),
        "delimited" => "Delimited".to_string(),
        _ => "Environment".to_string(),
    }
}

fn request_label(request: &builders::math::MathBuilderRequest) -> String {
    match request.mode.as_str() {
        "matrix" => {
            let star = if request.matrix_starred { "*" } else { "" };
            format!("{}{}", request.matrix_type, star)
        }
        "tool" => match request.tool_type.as_str() {
            "delimiter" => format!("\\DeclarePairedDelimiter\\{}", request.delimiter_command),
            "split_fraction" => format!("\\{}", request.split_fraction_type),
            "prescript" => "\\prescript".to_string(),
            "bracket" => format!("\\{}", request.bracket_type),
            _ => format!("\\{}", request.arrow_type),
        },
        "tag" => format!("\\{}", request.tag_action),
        "delimited" => match request.delimiter_math_type.as_str() {
            "inline_parens" => "\\( … \\)".to_string(),
            "inline_dollar" => "$ … $".to_string(),
            "display_dollars" => "$$ … $$".to_string(),
            _ => "\\[ … \\]".to_string(),
        },
        _ => {
            let star = if request.starred { "*" } else { "" };
            if request.label.trim().is_empty() {
                format!("{}{}", request.environment_type, star)
            } else {
                format!(
                    "{}{} · {}",
                    request.environment_type,
                    star,
                    request.label.trim()
                )
            }
        }
    }
}

fn request_preview(request: &builders::math::MathBuilderRequest) -> String {
    let preview = match request.mode.as_str() {
        "matrix" => request
            .matrix_cells
            .iter()
            .take(2)
            .map(|row| row.join(" & "))
            .collect::<Vec<_>>()
            .join(" \\\\ "),
        "tool" => match request.tool_type.as_str() {
            "delimiter" => format!("{} … {}", request.delimiter_left, request.delimiter_right),
            "split_fraction" => format!(
                "{} / {}",
                request.split_fraction_top, request.split_fraction_bottom
            ),
            "prescript" => format!(
                "^{} _{} {}",
                request.prescript_sup, request.prescript_sub, request.prescript_arg
            ),
            "bracket" => request.bracket_content.clone(),
            _ => {
                if request.arrow_below.trim().is_empty() {
                    request.arrow_above.clone()
                } else {
                    format!("{} / {}", request.arrow_above, request.arrow_below)
                }
            }
        },
        "tag" => {
            if request.tag_action == "newtagform" {
                format!(
                    "{} {}{}",
                    request.tag_name, request.tag_left, request.tag_right
                )
            } else if request.tag_action == "usetagform" {
                request.tag_name.clone()
            } else {
                request.tag_ref_label.clone()
            }
        }
        "delimited" => request.delimiter_math_content.clone(),
        _ => request.content.clone(),
    };
    preview
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(120)
        .collect()
}

fn strip_math_environment_star(environment: &str) -> (&str, bool) {
    environment
        .strip_suffix('*')
        .map(|base| (base, true))
        .unwrap_or((environment, false))
}

fn is_supported_math_environment(environment: &str) -> bool {
    matches!(
        environment,
        "equation"
            | "align"
            | "aligned"
            | "gather"
            | "gathered"
            | "lgathered"
            | "rgathered"
            | "multline"
            | "flalign"
            | "cases"
            | "split"
            | "dcases"
            | "rcases"
            | "pmatrix"
            | "bmatrix"
            | "Bmatrix"
            | "vmatrix"
            | "Vmatrix"
            | "matrix"
            | "smallmatrix"
    )
}

fn is_supported_matrix_environment(environment: &str) -> bool {
    matches!(
        environment,
        "pmatrix" | "bmatrix" | "Bmatrix" | "vmatrix" | "Vmatrix" | "matrix" | "smallmatrix"
    )
}

fn is_mathtools_arrow_name(name: &str) -> bool {
    matches!(
        name,
        "xrightarrow"
            | "xleftarrow"
            | "xleftrightarrow"
            | "xRightarrow"
            | "xLeftarrow"
            | "xLeftrightarrow"
            | "xlongequal"
            | "xmapsto"
            | "xhookleftarrow"
            | "xhookrightarrow"
            | "xleftharpoondown"
            | "xleftharpoonup"
            | "xleftrightharpoons"
            | "xrightharpoondown"
            | "xrightharpoonup"
            | "xrightleftharpoons"
    )
}

fn is_mathtools_bracket_name(name: &str) -> bool {
    matches!(
        name,
        "underbracket" | "overbracket" | "underbrace" | "overbrace"
    )
}

fn import_matrix_cells(body: &str) -> (Vec<Vec<String>>, u32, u32) {
    let mut rows = body
        .split("\\\\")
        .map(|row| {
            row.split('&')
                .map(|cell| cell.trim().to_string())
                .filter(|cell| !cell.is_empty())
                .collect::<Vec<_>>()
        })
        .filter(|row| !row.is_empty())
        .collect::<Vec<_>>();
    if rows.is_empty() {
        rows.push(vec!["a".to_string()]);
    }
    let columns = rows.iter().map(Vec::len).max().unwrap_or(1);
    for row in &mut rows {
        while row.len() < columns {
            row.push(String::new());
        }
    }
    let row_count = rows.len().clamp(1, 12) as u32;
    let column_count = columns.clamp(1, 12) as u32;
    rows.truncate(row_count as usize);
    for row in &mut rows {
        row.truncate(column_count as usize);
    }
    (rows, row_count, column_count)
}

fn strip_label_lines(body: &str) -> String {
    body.lines()
        .filter(|line| !line.trim_start().starts_with("\\label"))
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

fn push_siunitx_legacy_command_warning(
    warnings: &mut Vec<builders::BuilderWarning>,
    command: &str,
) {
    let code = format!(
        "siunitx-legacy-command-{}",
        command.trim_start_matches('\\')
    );
    if warnings.iter().any(|warning| warning.code == code) {
        return;
    }
    warnings.push(builders::BuilderWarning {
        code,
        severity: builders::BuilderWarningSeverity::Warning,
        message: format!(
            "{command} is a legacy siunitx command. Package Studio imports it and will generate the modern v3-style equivalent where possible."
        ),
        package_id: Some("siunitx".to_string()),
    });
}

fn push_siunitx_option_compatibility_warning(
    warnings: &mut Vec<builders::BuilderWarning>,
    option: &str,
) {
    let key = option
        .split_once('=')
        .map(|(key, _)| key.trim())
        .unwrap_or(option.trim());
    if !is_siunitx_version_sensitive_option(key) {
        return;
    }
    let code = format!("siunitx-version-sensitive-option-{key}");
    if warnings.iter().any(|warning| warning.code == code) {
        return;
    }
    warnings.push(builders::BuilderWarning {
        code,
        severity: builders::BuilderWarningSeverity::Info,
        message: format!(
            "`{key}` is a legacy or version-sensitive siunitx option. Review the generated v3-style setup before applying it."
        ),
        package_id: Some("siunitx".to_string()),
    });
}

fn push_siunitx_optional_arg_compatibility_warnings(
    warnings: &mut Vec<builders::BuilderWarning>,
    options: Option<&String>,
) {
    let Some(options) = options else {
        return;
    };
    for option in split_csv(options) {
        push_siunitx_option_compatibility_warning(warnings, &option);
    }
}

fn is_siunitx_version_sensitive_option(key: &str) -> bool {
    matches!(
        key,
        "binary-units"
            | "detect-all"
            | "detect-family"
            | "detect-inline-family"
            | "detect-inline-weight"
            | "detect-mode"
            | "detect-shape"
            | "detect-weight"
            | "load-configurations"
            | "separate-uncertainty"
            | "scientific-notation"
            | "retain-unity-mantissa"
            | "quotient-mode"
    )
}

fn apply_siunitx_setup_options(
    request: &mut builders::siunitx::SiunitxBuilderRequest,
    options: &str,
) {
    for option in split_csv(options) {
        let Some((key, value)) = option.split_once('=') else {
            continue;
        };
        let key = key.trim();
        let value = value.trim();
        match key {
            "per-mode" => {
                if matches!(value, "power" | "fraction" | "symbol") {
                    request.per_mode = value.to_string();
                }
            }
            "inter-unit-product" => {
                request.inter_unit_product = detect_siunitx_product(value);
            }
            "range-phrase" => {
                request.range_phrase = if value.contains("--") {
                    "--".to_string()
                } else {
                    "to".to_string()
                };
            }
            _ => {}
        }
    }
}

fn apply_siunitx_number_options(
    request: &mut builders::siunitx::SiunitxBuilderRequest,
    options: Option<&String>,
) {
    let Some(options) = options else {
        return;
    };
    for option in split_csv(options) {
        let Some((key, value)) = option.split_once('=') else {
            continue;
        };
        let key = key.trim();
        let value = value.trim();
        match key {
            "exponent-mode" => {
                if matches!(value, "input" | "scientific" | "engineering" | "fixed") {
                    request.exponent_mode = value.to_string();
                }
            }
            "round-mode" => {
                if matches!(value, "none" | "places" | "figures" | "uncertainty") {
                    request.round_mode = value.to_string();
                }
            }
            "round-precision" => {
                if let Ok(precision) = value.parse::<u32>() {
                    request.round_precision = precision.min(20);
                }
            }
            _ => {}
        }
    }
}

fn detect_siunitx_product(value: &str) -> String {
    if value.contains("\\!") || value.eq_ignore_ascii_case("tight") {
        "tight".to_string()
    } else if value.contains("\\cdot") || value.eq_ignore_ascii_case("cdot") {
        "cdot".to_string()
    } else {
        "thin".to_string()
    }
}

fn parse_siunitx_units(value: &str) -> Vec<builders::siunitx::SiunitxUnitComponent> {
    let tokens = siunitx_macro_tokens(value);
    let mut units = Vec::new();
    let mut index = 0usize;
    let mut per = false;

    while index < tokens.len() {
        let token = tokens[index].as_str();
        if token == "\\per" {
            per = true;
            index += 1;
            continue;
        }

        let mut prefix = String::new();
        let mut unit = token.to_string();
        if is_siunitx_prefix(token) && index + 1 < tokens.len() {
            prefix = token.to_string();
            index += 1;
            unit = tokens[index].clone();
        }

        if unit == "\\per" {
            per = true;
            index += 1;
            continue;
        }

        let mut power = String::new();
        if index + 1 < tokens.len() && is_siunitx_power(&tokens[index + 1]) {
            index += 1;
            power = tokens[index].clone();
        }

        units.push(builders::siunitx::SiunitxUnitComponent {
            prefix,
            unit,
            power,
            per,
        });
        per = false;
        index += 1;
    }

    if units.is_empty() {
        builders::siunitx::SiunitxBuilderRequest::default().units
    } else {
        units
    }
}

fn siunitx_macro_tokens(value: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let bytes = value.as_bytes();
    let mut index = 0usize;

    while index < bytes.len() {
        if bytes[index] == b'\\' {
            let start = index;
            index += 1;
            while index < bytes.len() && bytes[index].is_ascii_alphabetic() {
                index += 1;
            }
            if index > start + 1 {
                tokens.push(value[start..index].to_string());
                continue;
            }
        }
        if bytes[index] == b'^' && index + 1 < bytes.len() && bytes[index + 1] == b'{' {
            if let Some((power, next)) = parse_balanced_group(value, index + 1, b'{', b'}') {
                tokens.push(format!("^{{{power}}}"));
                index = next;
                continue;
            }
        }
        index += 1;
    }

    tokens
}

fn is_siunitx_prefix(value: &str) -> bool {
    matches!(
        value,
        "\\yocto"
            | "\\zepto"
            | "\\atto"
            | "\\femto"
            | "\\pico"
            | "\\nano"
            | "\\micro"
            | "\\milli"
            | "\\centi"
            | "\\deci"
            | "\\deca"
            | "\\hecto"
            | "\\kilo"
            | "\\mega"
            | "\\giga"
            | "\\tera"
            | "\\peta"
            | "\\exa"
            | "\\zetta"
            | "\\yotta"
    )
}

fn is_siunitx_power(value: &str) -> bool {
    value == "\\squared" || value == "\\cubed" || value.starts_with("^{")
}

pub fn import_graphicx_from_source(source: &str) -> builders::graphicx::GraphicxBuilderRequest {
    let commands = find_latex_commands(source);

    for begin in commands.iter().filter(|command| {
        command.name == "begin"
            && command
                .required_args
                .first()
                .map(|env| env.trim() == "figure")
                .unwrap_or(false)
    }) {
        let Some(end) = commands.iter().find(|command| {
            command.name == "end"
                && command.range.start.byte > begin.range.end.byte
                && command
                    .required_args
                    .first()
                    .map(|env| env.trim() == "figure")
                    .unwrap_or(false)
        }) else {
            continue;
        };

        let body_start = begin.range.end.byte;
        let body_end = end.range.start.byte;
        let Some(includegraphics) = commands.iter().find(|command| {
            command.name == "includegraphics"
                && command.range.start.byte >= body_start
                && command.range.end.byte <= body_end
        }) else {
            continue;
        };

        let mut request = import_graphicx_include_command(includegraphics);
        request.use_figure = true;
        request.center = source[body_start..body_end].contains("\\centering");
        request.placement = begin
            .optional_args
            .first()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "ht".to_string());

        if let Some(caption) = commands.iter().find(|command| {
            command.name == "caption"
                && command.range.start.byte >= body_start
                && command.range.end.byte <= body_end
        }) {
            if let Some(value) = caption.required_args.first() {
                request.caption = value.trim().to_string();
            }
        }

        if let Some(label) = commands.iter().find(|command| {
            command.name == "label"
                && command.range.start.byte >= body_start
                && command.range.end.byte <= body_end
        }) {
            if let Some(value) = label.required_args.first() {
                request.label = value.trim().to_string();
            }
        }

        return request;
    }

    commands
        .iter()
        .find(|command| command.name == "includegraphics")
        .map(import_graphicx_include_command)
        .unwrap_or_default()
}

fn import_graphicx_include_command(
    command: &ParsedCommand,
) -> builders::graphicx::GraphicxBuilderRequest {
    let mut request = builders::graphicx::GraphicxBuilderRequest {
        file_path: command
            .required_args
            .first()
            .map(|value| import_graphicx_path(value))
            .unwrap_or_else(|| "image.png".to_string()),
        width: String::new(),
        width_unit: "\\textwidth".to_string(),
        height: String::new(),
        height_unit: "cm".to_string(),
        keep_aspect_ratio: false,
        scale: None,
        angle: None,
        use_figure: false,
        center: true,
        caption: String::new(),
        label: String::new(),
        ..builders::graphicx::GraphicxBuilderRequest::default()
    };

    for option in command
        .optional_args
        .first()
        .map(|value| split_csv(value))
        .unwrap_or_default()
    {
        let option = option.trim();
        let key = option
            .split_once('=')
            .map(|(key, _)| key.trim())
            .unwrap_or(option)
            .to_ascii_lowercase();
        let value = option.split_once('=').map(|(_, value)| value.trim());

        match key.as_str() {
            "width" => {
                if let Some((amount, unit)) = value.and_then(import_graphicx_dimension) {
                    request.width = amount;
                    request.width_unit = unit;
                }
            }
            "height" => {
                if let Some((amount, unit)) = value.and_then(import_graphicx_dimension) {
                    request.height = amount;
                    request.height_unit = unit;
                }
            }
            "keepaspectratio" => request.keep_aspect_ratio = true,
            "scale" => request.scale = value.and_then(import_graphicx_number),
            "angle" => request.angle = value.and_then(import_graphicx_number),
            _ => {}
        }
    }

    request
}

fn import_graphicx_path(value: &str) -> String {
    value
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
        .replace('\\', "/")
}

fn import_graphicx_dimension(value: &str) -> Option<(String, String)> {
    let value = value.trim();
    if value.is_empty() {
        return None;
    }

    for unit in [
        "\\textwidth",
        "\\linewidth",
        "\\textheight",
        "cm",
        "mm",
        "in",
        "pt",
    ] {
        if let Some(amount) = value.strip_suffix(unit) {
            let amount = amount.trim();
            return Some((
                if amount.is_empty() {
                    "1".to_string()
                } else {
                    amount.to_string()
                },
                unit.to_string(),
            ));
        }
    }

    None
}

fn import_graphicx_number(value: &str) -> Option<f64> {
    value
        .trim()
        .parse::<f64>()
        .ok()
        .filter(|value| value.is_finite())
}

fn apply_geometry_options(
    request: &mut builders::geometry::GeometryBuilderRequest,
    options: &[String],
) {
    for option in options {
        let option = option.trim();
        let key = option
            .split_once('=')
            .map(|(key, _)| key.trim())
            .unwrap_or(option)
            .to_ascii_lowercase();
        let value = option.split_once('=').map(|(_, value)| value.trim());

        match key.as_str() {
            "top" => apply_geometry_dimension(&mut request.margin_top, value),
            "bottom" => apply_geometry_dimension(&mut request.margin_bottom, value),
            "left" => apply_geometry_dimension(&mut request.margin_left, value),
            "right" => apply_geometry_dimension(&mut request.margin_right, value),
            "margin" => {
                if let Some(value) = parse_geometry_dimension(value) {
                    request.margin_top = value;
                    request.margin_bottom = value;
                    request.margin_left = value;
                    request.margin_right = value;
                }
            }
            "columnsep" => {
                request.columns = "two".to_string();
                apply_geometry_dimension(&mut request.column_sep, value);
            }
            "marginparsep" => {
                request.margin_notes = true;
                apply_geometry_dimension(&mut request.margin_sep, value);
            }
            "marginparwidth" => {
                request.margin_notes = true;
                apply_geometry_dimension(&mut request.margin_width, value);
            }
            "headheight" => apply_geometry_dimension(&mut request.head_height, value),
            "headsep" => apply_geometry_dimension(&mut request.head_sep, value),
            "footskip" => apply_geometry_dimension(&mut request.foot_skip, value),
            "bindingoffset" => apply_geometry_dimension(&mut request.binding_offset, value),
            "hoffset" => apply_geometry_dimension(&mut request.h_offset, value),
            "voffset" => apply_geometry_dimension(&mut request.v_offset, value),
            "includehead" => request.include_head = true,
            "includefoot" => request.include_foot = true,
            "includemp" => {
                request.margin_notes = true;
                request.include_mp = true;
            }
            "asymmetric" => request.sidedness = "asymmetric".to_string(),
            _ => {}
        }
    }
}

fn apply_geometry_dimension(target: &mut f64, value: Option<&str>) {
    if let Some(value) = parse_geometry_dimension(value) {
        *target = value;
    }
}

fn parse_geometry_dimension(value: Option<&str>) -> Option<f64> {
    value?
        .trim()
        .trim_end_matches("cm")
        .trim()
        .parse::<f64>()
        .ok()
        .filter(|value| value.is_finite())
}

pub fn import_fancyhdr_from_source(source: &str) -> builders::fancyhdr::FancyhdrBuilderRequest {
    let mut request = empty_fancyhdr_import_request();
    let mut has_simple_positions = false;
    let mut has_two_side_positions = false;

    for command in find_latex_commands(source) {
        match command.name.as_str() {
            "documentclass" => {
                let options = command
                    .optional_args
                    .first()
                    .map(|arg| split_csv(arg))
                    .unwrap_or_default();
                if options
                    .iter()
                    .any(|option| option.trim().eq_ignore_ascii_case("twoside"))
                {
                    request.document_type = "twoside".to_string();
                }
                if options
                    .iter()
                    .any(|option| option.trim().eq_ignore_ascii_case("oneside"))
                {
                    request.document_type = "oneside".to_string();
                }
            }
            "usepackage" | "RequirePackage" => {
                let options = command
                    .optional_args
                    .first()
                    .map(|arg| split_csv(arg))
                    .unwrap_or_default();
                let loads_fancyhdr = command
                    .required_args
                    .first()
                    .map(|packages| {
                        split_csv(packages)
                            .iter()
                            .any(|package| package.eq_ignore_ascii_case("fancyhdr"))
                    })
                    .unwrap_or(false);
                if loads_fancyhdr {
                    request.package_options = options;
                }
            }
            "pagestyle" => {
                if let Some(page_style) = command.required_args.first() {
                    request.page_style = sanitize_import_identifier(page_style, "fancy");
                }
            }
            "fancyhf" => {
                request.clear_fields = true;
            }
            "fancyhead" | "fancyfoot" => {
                let Some(value) = command.required_args.first() else {
                    continue;
                };
                let positions = command
                    .optional_args
                    .first()
                    .map(|arg| split_csv(arg))
                    .filter(|items| !items.is_empty())
                    .unwrap_or_else(|| vec!["L".to_string(), "C".to_string(), "R".to_string()]);
                for position in positions {
                    let normalized = position.trim().to_uppercase();
                    if normalized.contains('O') || normalized.contains('E') {
                        has_two_side_positions = true;
                    } else {
                        has_simple_positions = true;
                    }
                    apply_fancyhdr_position(
                        &mut request,
                        command.name == "fancyhead",
                        &normalized,
                        value,
                    );
                }
            }
            "renewcommand" => {
                let Some(command_name) = command.required_args.first() else {
                    continue;
                };
                let Some(value) = command.required_args.get(1) else {
                    continue;
                };
                match command_name.trim() {
                    "\\headrulewidth" => {
                        if let Some(width) = parse_pt_width(value) {
                            request.head_rule_width = width;
                        }
                    }
                    "\\footrulewidth" => {
                        if let Some(width) = parse_pt_width(value) {
                            request.foot_rule_width = width;
                        }
                    }
                    _ => {}
                }
            }
            _ => {}
        }
    }

    if has_two_side_positions {
        request.document_type = "twoside".to_string();
    } else if has_simple_positions {
        request.document_type = "oneside".to_string();
    }

    request
}

pub fn import_code_highlighting_from_source(
    source: &str,
) -> builders::code_highlighting::CodeHighlightingBuilderRequest {
    let mut request = empty_code_highlighting_import_request();

    for command in find_latex_commands(source) {
        match command.name.as_str() {
            "usepackage" | "RequirePackage" => {
                let packages = command
                    .required_args
                    .first()
                    .map(|arg| split_csv(arg))
                    .unwrap_or_default();
                if packages
                    .iter()
                    .any(|package| package.eq_ignore_ascii_case("minted"))
                {
                    request.engine = "minted".to_string();
                } else if packages
                    .iter()
                    .any(|package| package.eq_ignore_ascii_case("listings"))
                    && request.engine != "minted"
                {
                    request.engine = "listings".to_string();
                }
            }
            "lstdefinestyle" => {
                if let Some(options) = command.required_args.get(1) {
                    request.engine = "listings".to_string();
                    apply_listings_options(&mut request, options);
                }
            }
            "lstset" => {
                if let Some(options) = command.required_args.first() {
                    request.engine = "listings".to_string();
                    apply_listings_options(&mut request, options);
                }
            }
            "usemintedstyle" => {
                if let Some(style) = command.required_args.first() {
                    request.engine = "minted".to_string();
                    request.minted_style = sanitize_import_identifier(style, "friendly");
                }
            }
            "setminted" => {
                if let Some(options) = command.required_args.first() {
                    request.engine = "minted".to_string();
                    apply_minted_options(&mut request, options);
                }
            }
            _ => {}
        }
    }

    request
}

pub fn import_xcolor_from_source(source: &str) -> builders::xcolor::XcolorBuilderRequest {
    let mut request = empty_xcolor_import_request();

    for command in find_latex_commands(source) {
        match command.name.as_str() {
            "usepackage" | "RequirePackage" => {
                let options = command
                    .optional_args
                    .first()
                    .map(|arg| split_csv(arg))
                    .unwrap_or_default();
                let loads_xcolor = command
                    .required_args
                    .first()
                    .map(|packages| {
                        split_csv(packages)
                            .iter()
                            .any(|package| package.eq_ignore_ascii_case("xcolor"))
                    })
                    .unwrap_or(false);
                if loads_xcolor {
                    request.package_options = options;
                }
            }
            "definecolor" => {
                let Some(name) = command.required_args.first() else {
                    continue;
                };
                let Some(model) = command.required_args.get(1) else {
                    continue;
                };
                let Some(value) = command.required_args.get(2) else {
                    continue;
                };
                let Some(name) = xcolor_import_name(name) else {
                    continue;
                };
                let Some(model) = xcolor_import_model(model) else {
                    continue;
                };
                if !xcolor_import_value_looks_valid(&model, value) {
                    continue;
                }
                request.colors.push(builders::xcolor::XcolorDefinition {
                    name,
                    model,
                    value: value.trim().trim_start_matches('#').to_string(),
                });
            }
            "colorlet" => {
                let Some(name) = command.required_args.first() else {
                    continue;
                };
                let Some(expression) = command.required_args.get(1) else {
                    continue;
                };
                let Some(name) = xcolor_import_name(name) else {
                    continue;
                };
                if let Some(alias) = parse_xcolor_alias(name, expression) {
                    request.aliases.push(alias);
                }
            }
            _ => {}
        }
    }

    dedupe_xcolor_import(&mut request);
    request
}

fn empty_xcolor_import_request() -> builders::xcolor::XcolorBuilderRequest {
    builders::xcolor::XcolorBuilderRequest {
        enabled: true,
        package_options: Vec::new(),
        colors: Vec::new(),
        aliases: Vec::new(),
    }
}

fn xcolor_import_name(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty()
        || !value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_')
    {
        None
    } else {
        Some(value.to_string())
    }
}

fn xcolor_import_model(value: &str) -> Option<String> {
    match value.trim() {
        "rgb" | "cmy" | "cmyk" | "hsb" | "gray" | "Gray" | "HSB" => Some(value.trim().to_string()),
        other => match other.to_ascii_uppercase().as_str() {
            "RGB" | "RGB255" => Some("RGB".to_string()),
            "HTML" => Some("HTML".to_string()),
            _ => None,
        },
    }
}

fn xcolor_import_value_looks_valid(model: &str, value: &str) -> bool {
    let value = value.trim().trim_start_matches('#');
    if model == "HTML" {
        return value.len() == 6 && value.chars().all(|ch| ch.is_ascii_hexdigit());
    }
    let expected = match model {
        "RGB" | "rgb" | "cmy" | "hsb" | "HSB" => 3,
        "cmyk" => 4,
        "gray" | "Gray" => 1,
        _ => return false,
    };
    value
        .split(',')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .count()
        == expected
}

fn parse_xcolor_alias(name: String, expression: &str) -> Option<builders::xcolor::XcolorAlias> {
    let parts = expression.split('!').map(str::trim).collect::<Vec<_>>();
    match parts.as_slice() {
        [primary] => Some(builders::xcolor::XcolorAlias {
            name,
            primary: xcolor_import_name(primary)?,
            percentage: 100,
            secondary: "white".to_string(),
        }),
        [primary, percentage, secondary] => Some(builders::xcolor::XcolorAlias {
            name,
            primary: xcolor_import_name(primary)?,
            percentage: percentage.parse::<u8>().ok()?.min(100),
            secondary: xcolor_import_name(secondary)?,
        }),
        _ => None,
    }
}

fn dedupe_xcolor_import(request: &mut builders::xcolor::XcolorBuilderRequest) {
    let mut seen = BTreeSet::new();
    request
        .colors
        .retain(|color| seen.insert(color.name.clone()));
    request
        .aliases
        .retain(|alias| seen.insert(alias.name.clone()));
}

fn empty_code_highlighting_import_request(
) -> builders::code_highlighting::CodeHighlightingBuilderRequest {
    builders::code_highlighting::CodeHighlightingBuilderRequest {
        engine: "none".to_string(),
        language: "python".to_string(),
        show_numbers: false,
        break_lines: false,
        show_frame: false,
        minted_style: "friendly".to_string(),
        lst_colors: builders::code_highlighting::ListingsColors::default(),
    }
}

fn apply_listings_options(
    request: &mut builders::code_highlighting::CodeHighlightingBuilderRequest,
    options: &str,
) {
    for option in split_csv(options) {
        let option = option.trim();
        if option.eq_ignore_ascii_case("breaklines")
            || option.eq_ignore_ascii_case("breaklines=true")
        {
            request.break_lines = true;
        }
        if option.eq_ignore_ascii_case("breaklines=false") {
            request.break_lines = false;
        }
        if let Some((key, value)) = option.split_once('=') {
            let key = key.trim();
            let value = value.trim();
            if key.eq_ignore_ascii_case("numbers") {
                request.show_numbers =
                    !value.eq_ignore_ascii_case("none") && !value.eq_ignore_ascii_case("false");
            }
            if key.eq_ignore_ascii_case("frame") {
                request.show_frame =
                    !value.eq_ignore_ascii_case("none") && !value.eq_ignore_ascii_case("false");
            }
        }
    }
}

fn apply_minted_options(
    request: &mut builders::code_highlighting::CodeHighlightingBuilderRequest,
    options: &str,
) {
    for option in split_csv(options) {
        let option = option.trim();
        if option.eq_ignore_ascii_case("linenos") || option.eq_ignore_ascii_case("linenos=true") {
            request.show_numbers = true;
        }
        if option.eq_ignore_ascii_case("linenos=false") {
            request.show_numbers = false;
        }
        if option.eq_ignore_ascii_case("breaklines")
            || option.eq_ignore_ascii_case("breaklines=true")
        {
            request.break_lines = true;
        }
        if option.eq_ignore_ascii_case("breaklines=false") {
            request.break_lines = false;
        }
        if let Some((key, value)) = option.split_once('=') {
            let key = key.trim();
            let value = value.trim();
            if key.eq_ignore_ascii_case("frame") {
                request.show_frame =
                    !value.eq_ignore_ascii_case("none") && !value.eq_ignore_ascii_case("false");
            }
        }
    }
}

fn empty_fancyhdr_import_request() -> builders::fancyhdr::FancyhdrBuilderRequest {
    builders::fancyhdr::FancyhdrBuilderRequest {
        enabled: true,
        document_type: "twoside".to_string(),
        page_style: "fancy".to_string(),
        clear_fields: false,
        package_options: Vec::new(),
        header_odd_left: String::new(),
        header_odd_center: String::new(),
        header_odd_right: String::new(),
        header_even_left: String::new(),
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

fn apply_fancyhdr_position(
    request: &mut builders::fancyhdr::FancyhdrBuilderRequest,
    is_header: bool,
    position: &str,
    value: &str,
) {
    let value = value.trim().to_string();
    if value.is_empty() {
        return;
    }

    let left = position.contains('L') || !position.contains('C') && !position.contains('R');
    let center = position.contains('C') || !position.contains('L') && !position.contains('R');
    let right = position.contains('R') || !position.contains('L') && !position.contains('C');
    let odd = position.contains('O') || !position.contains('E');
    let even = position.contains('E') || !position.contains('O');

    match (is_header, odd, even, left, center, right) {
        (true, true, _, true, _, _) => request.header_odd_left = value.clone(),
        _ => {}
    }
    if is_header && odd && center {
        request.header_odd_center = value.clone();
    }
    if is_header && odd && right {
        request.header_odd_right = value.clone();
    }
    if is_header && even && left {
        request.header_even_left = value.clone();
    }
    if is_header && even && center {
        request.header_even_center = value.clone();
    }
    if is_header && even && right {
        request.header_even_right = value.clone();
    }
    if !is_header && odd && left {
        request.footer_odd_left = value.clone();
    }
    if !is_header && odd && center {
        request.footer_odd_center = value.clone();
    }
    if !is_header && odd && right {
        request.footer_odd_right = value.clone();
    }
    if !is_header && even && left {
        request.footer_even_left = value.clone();
    }
    if !is_header && even && center {
        request.footer_even_center = value.clone();
    }
    if !is_header && even && right {
        request.footer_even_right = value;
    }
}

fn parse_pt_width(value: &str) -> Option<f64> {
    let trimmed = value.trim().trim_end_matches("pt").trim();
    trimmed.parse::<f64>().ok().filter(|width| *width >= 0.0)
}

fn sanitize_import_identifier(value: &str, fallback: &str) -> String {
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

fn normalize_enumitem_base_type(value: &str) -> (String, bool) {
    match value.trim() {
        "itemize*" => ("itemize".to_string(), true),
        "enumerate*" => ("enumerate".to_string(), true),
        "itemize" => ("itemize".to_string(), false),
        "description" => ("description".to_string(), false),
        _ => ("enumerate".to_string(), false),
    }
}

fn default_enumitem_label(base_type: &str) -> &str {
    match base_type {
        "itemize" => "\\bullet",
        "description" => "",
        _ => "\\arabic*.",
    }
}

fn enumitem_identifier(value: &str) -> Option<String> {
    let sanitized = value
        .trim()
        .chars()
        .filter(|ch| ch.is_ascii_alphabetic())
        .collect::<String>();
    if sanitized.is_empty() {
        None
    } else {
        Some(sanitized)
    }
}

fn detect_enumitem_spacing(options: &str) -> String {
    let normalized = options.replace(' ', "");
    if normalized.contains("nosep") {
        "nosep".to_string()
    } else if normalized.contains("noitemsep") {
        "noitemsep".to_string()
    } else if normalized.contains("itemsep=0.5ex") {
        "half".to_string()
    } else {
        "default".to_string()
    }
}

fn detect_enumitem_itemize_label(options: &str) -> String {
    let label = enumitem_option_value(options, "label").unwrap_or_default();
    let label = strip_outer_braces(label.trim());
    match label {
        "\\textbullet" | "\\bullet" => "bullet".to_string(),
        "--" | "\\textendash" => "dash".to_string(),
        "*" | "\\textasteriskcentered" => "asterisk".to_string(),
        "$\\Rightarrow$" | "\\Rightarrow" => "arrow".to_string(),
        _ => "default".to_string(),
    }
}

fn detect_enumitem_enumerate_label(options: &str) -> String {
    let label = enumitem_option_value(options, "label").unwrap_or_default();
    let label = strip_outer_braces(label.trim());
    if label.contains("(\\arabic*)") {
        "arabic_wrapped".to_string()
    } else if label.contains("\\arabic*)") {
        "arabic_paren".to_string()
    } else if label.contains("(\\alph*)") {
        "alph_wrapped".to_string()
    } else if label.contains("\\alph*)") {
        "alph".to_string()
    } else if label.contains("\\Roman*") {
        "Roman".to_string()
    } else if label.contains("\\roman*") {
        "roman".to_string()
    } else {
        "default".to_string()
    }
}

fn apply_enumitem_custom_options(list: &mut builders::enumitem::EnumitemCustomList, options: &str) {
    list.spacing = detect_enumitem_spacing(options);
    list.wide = enumitem_has_option(options, "wide=0pt");
    list.left_margin_star = enumitem_has_option(options, "leftmargin=*");
    list.resume = enumitem_has_option(options, "resume");

    if list.base_type != "description" {
        if let Some(label) = enumitem_option_value(options, "label") {
            list.label = strip_outer_braces(label.trim()).to_string();
        }
    }
    if let Some(font) = enumitem_option_value(options, "font") {
        list.bold = font.contains("\\bfseries");
        list.italic = font.contains("\\itshape");
    }
    if let Some(align) = enumitem_option_value(options, "align") {
        let align = align.trim();
        if matches!(align, "left" | "parleft") {
            list.align = align.to_string();
        }
    }
    if let Some(start) = enumitem_option_value(options, "start") {
        list.start = start.trim().parse::<u32>().ok().filter(|value| *value > 0);
    }
}

fn enumitem_has_option(options: &str, needle: &str) -> bool {
    split_csv(options)
        .iter()
        .any(|option| option.trim() == needle)
}

fn enumitem_option_value(options: &str, key: &str) -> Option<String> {
    split_csv(options).into_iter().find_map(|option| {
        let (raw_key, raw_value) = option.split_once('=')?;
        if raw_key.trim() == key {
            Some(raw_value.trim().to_string())
        } else {
            None
        }
    })
}

fn strip_outer_braces(value: &str) -> &str {
    let value = value.trim();
    if value.starts_with('{') && value.ends_with('}') && value.len() >= 2 {
        &value[1..value.len() - 1]
    } else {
        value
    }
}

pub fn graphics_document_source_sha256(source: &str) -> String {
    let digest = Sha256::digest(source.as_bytes());
    digest
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>()
}

pub fn plan_graphics_document_edit(
    request: GraphicsDocumentEditRequest,
) -> Result<PackageEditPlan, String> {
    const SCHEMA_VERSION: u32 = 1;

    if request.schema_version != SCHEMA_VERSION {
        return Err(format!(
            "Unsupported Graphics Studio edit request schema version `{}`; expected `{SCHEMA_VERSION}`.",
            request.schema_version
        ));
    }
    if request.document_id.trim().is_empty() {
        return Err("Graphics Studio document identity cannot be empty.".to_string());
    }
    if request.target_file_path.trim().is_empty() {
        return Err("Graphics Studio target file path cannot be empty.".to_string());
    }

    let supplied_fingerprint = request
        .baseline_sha256
        .strip_prefix("sha256:")
        .unwrap_or(&request.baseline_sha256);
    if supplied_fingerprint.len() != 64
        || !supplied_fingerprint
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
    {
        return Err(
            "Graphics Studio baseline SHA-256 must contain exactly 64 hexadecimal characters."
                .to_string(),
        );
    }

    let actual_fingerprint = graphics_document_source_sha256(&request.baseline_source);
    if !supplied_fingerprint.eq_ignore_ascii_case(&actual_fingerprint) {
        return Err(
            "Graphics Studio document baseline is stale: SHA-256 fingerprint mismatch.".to_string(),
        );
    }

    let target_name = std::path::Path::new(request.target_file_path.trim())
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("active document");

    if request.baseline_source == request.replacement_source {
        return Ok(PackageEditPlan {
            schema_version: SCHEMA_VERSION,
            revision: request.revision,
            title: format!("Update Graphics Studio document `{target_name}`"),
            summary: "The Graphics Studio document already matches the generated source."
                .to_string(),
            edits: Vec::new(),
            diagnostics: vec![PackageDiagnostic {
                code: "graphics-document-unchanged".to_string(),
                severity: PackageDiagnosticSeverity::Info,
                message: "No document changes are required.".to_string(),
                range: None,
                package_id: None,
            }],
        });
    }

    Ok(PackageEditPlan {
        schema_version: SCHEMA_VERSION,
        revision: request.revision,
        title: format!("Update Graphics Studio document `{target_name}`"),
        summary: format!(
            "Replace the complete contents of `{target_name}` with the reviewed Graphics Studio source."
        ),
        edits: vec![TextEdit {
            range: range_for_bytes(
                &request.baseline_source,
                0,
                request.baseline_source.len(),
            ),
            replacement: request.replacement_source,
        }],
        diagnostics: Vec::new(),
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct TikzpictureByteRange {
    start: usize,
    end: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TikzpictureMarkerKind {
    Begin,
    End,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct TikzpictureMarker {
    kind: TikzpictureMarkerKind,
    start: usize,
    end: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct LatexDocumentByteRange {
    begin_start: usize,
    body_start: usize,
    body_end: usize,
    end: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct GraphicsPackageRequirement {
    package_id: String,
    options: Vec<String>,
}

fn validate_graphics_tikzpicture_request(
    schema_version: u32,
    document_id: &str,
    target_file_path: &str,
    baseline_source: &str,
    baseline_sha256: &str,
) -> Result<(String, String), String> {
    const SCHEMA_VERSION: u32 = 1;

    if schema_version != SCHEMA_VERSION {
        return Err(format!(
            "Unsupported Graphics Studio tikzpicture request schema version `{schema_version}`; expected `{SCHEMA_VERSION}`."
        ));
    }
    if document_id.trim().is_empty() {
        return Err("Graphics Studio document identity cannot be empty.".to_string());
    }
    if target_file_path.trim().is_empty() {
        return Err("Graphics Studio target file path cannot be empty.".to_string());
    }

    let supplied_fingerprint = baseline_sha256
        .strip_prefix("sha256:")
        .unwrap_or(baseline_sha256);
    if supplied_fingerprint.len() != 64
        || !supplied_fingerprint
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
    {
        return Err(
            "Graphics Studio baseline SHA-256 must contain exactly 64 hexadecimal characters."
                .to_string(),
        );
    }

    let actual_fingerprint = graphics_document_source_sha256(baseline_source);
    if !supplied_fingerprint.eq_ignore_ascii_case(&actual_fingerprint) {
        return Err(
            "Graphics Studio document baseline is stale: SHA-256 fingerprint mismatch.".to_string(),
        );
    }

    let target_name = std::path::Path::new(target_file_path.trim())
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("active document")
        .to_string();

    Ok((actual_fingerprint, target_name))
}

/// Finds syntactically active `tikzpicture` environments.
///
/// The scanner deliberately recognizes only real LaTeX command backslashes:
/// occurrences in comments and occurrences escaped by another backslash do not
/// participate in environment matching. Ranges are half-open UTF-8 byte ranges
/// and include both the `\begin{tikzpicture}` and `\end{tikzpicture}` commands.
fn find_tikzpicture_byte_ranges(source: &str) -> Result<Vec<TikzpictureByteRange>, String> {
    let mut ranges = Vec::new();
    let mut open_start = None;
    let mut index = 0usize;
    let mut in_comment = false;

    while index < source.len() {
        let ch = source[index..]
            .chars()
            .next()
            .expect("index must remain on a UTF-8 boundary");
        if in_comment {
            if ch == '\n' {
                in_comment = false;
            }
            index += ch.len_utf8();
            continue;
        }
        if ch == '%' && !is_escaped_percent(source, index) {
            in_comment = true;
            index += 1;
            continue;
        }
        if ch != '\\' || !is_active_latex_command_backslash(source, index) {
            index += ch.len_utf8();
            continue;
        }

        let Some(marker) = parse_tikzpicture_marker(source, index)? else {
            index += 1;
            continue;
        };

        match marker.kind {
            TikzpictureMarkerKind::Begin => {
                if open_start.is_some() {
                    return Err(format!(
                        "Nested tikzpicture environments are ambiguous near byte {}.",
                        marker.start
                    ));
                }
                open_start = Some(marker.start);
            }
            TikzpictureMarkerKind::End => {
                let Some(start) = open_start.take() else {
                    return Err(format!(
                        "Malformed LaTeX: unmatched `\\end{{tikzpicture}}` near byte {}.",
                        marker.start
                    ));
                };
                ranges.push(TikzpictureByteRange {
                    start,
                    end: marker.end,
                });
            }
        }

        index = marker.end;
    }

    if let Some(start) = open_start {
        return Err(format!(
            "Malformed LaTeX: `\\begin{{tikzpicture}}` near byte {start} has no matching end."
        ));
    }

    Ok(ranges)
}

fn is_active_latex_command_backslash(source: &str, backslash_index: usize) -> bool {
    let mut preceding_backslashes = 0usize;
    let mut index = backslash_index;
    while index > 0 && source.as_bytes()[index - 1] == b'\\' {
        preceding_backslashes += 1;
        index -= 1;
    }
    preceding_backslashes & 1 == 0
}

fn parse_tikzpicture_marker(
    source: &str,
    command_start: usize,
) -> Result<Option<TikzpictureMarker>, String> {
    let bytes = source.as_bytes();
    let name_start = command_start + 1;
    let mut name_end = name_start;
    while name_end < bytes.len() && bytes[name_end].is_ascii_alphabetic() {
        name_end += 1;
    }

    let kind = match &source[name_start..name_end] {
        "begin" => TikzpictureMarkerKind::Begin,
        "end" => TikzpictureMarkerKind::End,
        _ => return Ok(None),
    };

    let group_start = skip_latex_layout_and_comments(source, name_end);
    if bytes.get(group_start).copied() != Some(b'{') {
        return Ok(None);
    }

    let Some(group_end) = parse_latex_balanced_group_end(source, group_start, b'{', b'}') else {
        let unfinished_name = source[group_start + 1..].trim_start();
        if unfinished_name.starts_with("tikzpicture") {
            return Err(format!(
                "Malformed LaTeX: unterminated tikzpicture environment name near byte {command_start}."
            ));
        }
        return Ok(None);
    };

    if source[group_start + 1..group_end - 1].trim() != "tikzpicture" {
        return Ok(None);
    }

    Ok(Some(TikzpictureMarker {
        kind,
        start: command_start,
        end: group_end,
    }))
}

fn find_latex_document_byte_range(source: &str) -> Result<Option<LatexDocumentByteRange>, String> {
    let mut open = None;
    let mut completed = None;
    let mut index = 0usize;
    let mut in_comment = false;

    while index < source.len() {
        let ch = source[index..]
            .chars()
            .next()
            .expect("index must remain on a UTF-8 boundary");
        if in_comment {
            if ch == '\n' {
                in_comment = false;
            }
            index += ch.len_utf8();
            continue;
        }
        if ch == '%' && !is_escaped_percent(source, index) {
            in_comment = true;
            index += 1;
            continue;
        }
        if ch != '\\' || !is_active_latex_command_backslash(source, index) {
            index += ch.len_utf8();
            continue;
        }

        let Some(marker) = parse_named_environment_marker(source, index, "document")? else {
            index += 1;
            continue;
        };

        match marker.kind {
            TikzpictureMarkerKind::Begin => {
                if open.is_some() || completed.is_some() {
                    return Err(format!(
                        "Malformed LaTeX: multiple or nested `document` environments near byte {}.",
                        marker.start
                    ));
                }
                open = Some(marker);
            }
            TikzpictureMarkerKind::End => {
                let Some(begin) = open.take() else {
                    return Err(format!(
                        "Malformed LaTeX: unmatched `\\end{{document}}` near byte {}.",
                        marker.start
                    ));
                };
                completed = Some(LatexDocumentByteRange {
                    begin_start: begin.start,
                    body_start: begin.end,
                    body_end: marker.start,
                    end: marker.end,
                });
            }
        }
        index = marker.end;
    }

    if let Some(begin) = open {
        return Err(format!(
            "Malformed LaTeX: `\\begin{{document}}` near byte {} has no matching end.",
            begin.start
        ));
    }

    Ok(completed)
}

fn parse_named_environment_marker(
    source: &str,
    command_start: usize,
    environment_name: &str,
) -> Result<Option<TikzpictureMarker>, String> {
    let bytes = source.as_bytes();
    let name_start = command_start + 1;
    let mut name_end = name_start;
    while name_end < bytes.len() && bytes[name_end].is_ascii_alphabetic() {
        name_end += 1;
    }

    let kind = match &source[name_start..name_end] {
        "begin" => TikzpictureMarkerKind::Begin,
        "end" => TikzpictureMarkerKind::End,
        _ => return Ok(None),
    };
    let group_start = skip_latex_layout_and_comments(source, name_end);
    if bytes.get(group_start).copied() != Some(b'{') {
        return Ok(None);
    }
    let Some(group_end) = parse_latex_balanced_group_end(source, group_start, b'{', b'}') else {
        let unfinished_name = source[group_start + 1..].trim_start();
        if unfinished_name.starts_with(environment_name) {
            return Err(format!(
                "Malformed LaTeX: unterminated `{environment_name}` environment name near byte {command_start}."
            ));
        }
        return Ok(None);
    };
    if source[group_start + 1..group_end - 1].trim() != environment_name {
        return Ok(None);
    }

    Ok(Some(TikzpictureMarker {
        kind,
        start: command_start,
        end: group_end,
    }))
}

fn skip_latex_layout_and_comments(source: &str, mut index: usize) -> usize {
    while index < source.len() {
        let ch = source[index..]
            .chars()
            .next()
            .expect("index must remain on a UTF-8 boundary");
        if ch.is_whitespace() {
            index += ch.len_utf8();
            continue;
        }
        if ch == '%' && !is_escaped_percent(source, index) {
            index = source[index..]
                .find('\n')
                .map(|offset| index + offset + 1)
                .unwrap_or(source.len());
            continue;
        }
        break;
    }
    index
}

fn parse_latex_balanced_group_end(
    source: &str,
    start: usize,
    open: u8,
    close: u8,
) -> Option<usize> {
    if source.as_bytes().get(start).copied() != Some(open) {
        return None;
    }

    let mut depth = 0usize;
    let mut index = start;
    while index < source.len() {
        let ch = source[index..].chars().next()?;
        if ch == '%' && !is_escaped_percent(source, index) {
            index = source[index..]
                .find('\n')
                .map(|offset| index + offset + 1)
                .unwrap_or(source.len());
            continue;
        }
        if ch.len_utf8() == 1 {
            let byte = ch as u8;
            if byte == open && !is_escaped_ascii_marker(source, index) {
                depth += 1;
            } else if byte == close && !is_escaped_ascii_marker(source, index) {
                depth = depth.checked_sub(1)?;
                if depth == 0 {
                    return Some(index + 1);
                }
            }
        }
        index += ch.len_utf8();
    }
    None
}

fn select_tikzpicture_target(
    source: &str,
    ranges: &[TikzpictureByteRange],
    target: &GraphicsTikzpictureTarget,
) -> Result<(usize, TikzpictureByteRange), String> {
    if ranges.is_empty() {
        return Err("The active document contains no real tikzpicture environment.".to_string());
    }

    match target {
        GraphicsTikzpictureTarget::Cursor { byte } => {
            if *byte > source.len() || !source.is_char_boundary(*byte) {
                return Err(format!(
                    "Graphics Studio cursor byte `{byte}` is not a valid UTF-8 boundary."
                ));
            }
            let matches = ranges
                .iter()
                .enumerate()
                .filter(|(_, range)| range.start <= *byte && *byte < range.end)
                .collect::<Vec<_>>();
            match matches.as_slice() {
                [(ordinal, range)] => Ok((*ordinal, **range)),
                [] => Err(format!(
                    "The cursor at byte {byte} is outside every tikzpicture environment."
                )),
                _ => Err(format!(
                    "The cursor at byte {byte} matches multiple tikzpicture environments."
                )),
            }
        }
        GraphicsTikzpictureTarget::Range {
            start_byte,
            end_byte,
        } => {
            if start_byte >= end_byte
                || *end_byte > source.len()
                || !source.is_char_boundary(*start_byte)
                || !source.is_char_boundary(*end_byte)
            {
                return Err(
                    "Graphics Studio target range is not a valid non-empty UTF-8 byte range."
                        .to_string(),
                );
            }
            ranges
                .iter()
                .enumerate()
                .find(|(_, range)| range.start == *start_byte && range.end == *end_byte)
                .map(|(ordinal, range)| (ordinal, *range))
                .ok_or_else(|| {
                    "Graphics Studio target range must exactly match one baseline tikzpicture environment."
                        .to_string()
                })
        }
        GraphicsTikzpictureTarget::Ordinal { ordinal } => ranges
            .get(*ordinal)
            .copied()
            .map(|range| (*ordinal, range))
            .ok_or_else(|| {
                format!(
                    "Graphics Studio tikzpicture ordinal `{ordinal}` is out of range; the document contains {} environment(s).",
                    ranges.len()
                )
            }),
    }
}

fn tikzpicture_outside_bytes_are_equal(
    baseline_source: &str,
    baseline_range: TikzpictureByteRange,
    replacement_source: &str,
    replacement_range: TikzpictureByteRange,
) -> bool {
    baseline_source[..baseline_range.start] == replacement_source[..replacement_range.start]
        && baseline_source[baseline_range.end..] == replacement_source[replacement_range.end..]
}

fn all_tikzpicture_outside_bytes_are_equal(
    baseline_source: &str,
    baseline_ranges: &[TikzpictureByteRange],
    replacement_source: &str,
    replacement_ranges: &[TikzpictureByteRange],
) -> bool {
    if baseline_ranges.len() != replacement_ranges.len() {
        return false;
    }

    let mut baseline_cursor = 0usize;
    let mut replacement_cursor = 0usize;
    for (baseline, replacement) in baseline_ranges.iter().zip(replacement_ranges) {
        if baseline_source[baseline_cursor..baseline.start]
            != replacement_source[replacement_cursor..replacement.start]
        {
            return false;
        }
        baseline_cursor = baseline.end;
        replacement_cursor = replacement.end;
    }

    baseline_source[baseline_cursor..] == replacement_source[replacement_cursor..]
}

fn tikzpicture_preview(source: &str, range: TikzpictureByteRange) -> String {
    let environment = &source[range.start..range.end];
    let candidate = environment
        .lines()
        .map(str::trim)
        .find(|line| {
            !line.is_empty()
                && !line.starts_with("\\begin")
                && !line.starts_with("\\end")
                && !line.starts_with('%')
        })
        .unwrap_or("\\begin{tikzpicture}");
    let mut preview = candidate.chars().take(96).collect::<String>();
    if candidate.chars().count() > 96 {
        preview.push('…');
    }
    preview
}

fn focused_tikzpicture_source(
    source: &str,
    ranges: &[TikzpictureByteRange],
    selected_ordinal: usize,
) -> Result<(String, TikzpictureByteRange), String> {
    if selected_ordinal >= ranges.len() {
        return Err(format!(
            "Graphics Studio tikzpicture ordinal `{selected_ordinal}` is out of range; the document contains {} environment(s).",
            ranges.len()
        ));
    }

    let mut focused = String::with_capacity(source.len());
    let mut source_cursor = 0usize;
    let mut focused_target = None;
    for (ordinal, range) in ranges.iter().enumerate() {
        focused.push_str(&source[source_cursor..range.start]);
        if ordinal == selected_ordinal {
            let start = focused.len();
            focused.push_str(&source[range.start..range.end]);
            focused_target = Some(TikzpictureByteRange {
                start,
                end: focused.len(),
            });
        }
        source_cursor = range.end;
    }
    focused.push_str(&source[source_cursor..]);

    let target = focused_target
        .ok_or_else(|| "Graphics Studio could not prepare the selected tikzpicture.".to_string())?;
    Ok((focused, target))
}

pub fn discover_graphics_tikzpicture_targets(
    request: GraphicsTikzpictureDiscoveryRequest,
) -> Result<GraphicsTikzpictureDiscovery, String> {
    let (actual_fingerprint, _) = validate_graphics_tikzpicture_request(
        request.schema_version,
        &request.document_id,
        &request.target_file_path,
        &request.baseline_source,
        &request.baseline_sha256,
    )?;
    let baseline_ranges = find_tikzpicture_byte_ranges(&request.baseline_source)?;
    let (replacement_ranges, structural_error) = match find_tikzpicture_byte_ranges(
        &request.replacement_source,
    ) {
        Ok(ranges) if ranges.len() == baseline_ranges.len() => (ranges, None),
        Ok(ranges) => {
            let message = format!(
                    "The replacement contains {} tikzpicture environment(s), but the baseline contains {}.",
                    ranges.len(),
                    baseline_ranges.len()
                );
            (ranges, Some(message))
        }
        Err(error) => (Vec::new(), Some(error)),
    };
    let structurally_compatible = structural_error.is_none();
    let outside_changes = !structurally_compatible
        || !all_tikzpicture_outside_bytes_are_equal(
            &request.baseline_source,
            &baseline_ranges,
            &request.replacement_source,
            &replacement_ranges,
        );

    let targets = baseline_ranges
        .iter()
        .enumerate()
        .map(|(ordinal, baseline)| {
            let replacement = structurally_compatible
                .then(|| replacement_ranges.get(ordinal).copied())
                .flatten();
            let baseline_range =
                range_for_bytes(&request.baseline_source, baseline.start, baseline.end);
            let replacement_range = replacement
                .map(|range| range_for_bytes(&request.replacement_source, range.start, range.end));
            let changed = replacement
                .map(|range| {
                    request.baseline_source[baseline.start..baseline.end]
                        != request.replacement_source[range.start..range.end]
                })
                .unwrap_or(true);
            let line_label = if baseline_range.start.line == baseline_range.end.line {
                format!("line {}", baseline_range.start.line)
            } else {
                format!(
                    "lines {}–{}",
                    baseline_range.start.line, baseline_range.end.line
                )
            };

            GraphicsTikzpictureTargetDescriptor {
                ordinal,
                baseline_range,
                replacement_range,
                source_sha256: graphics_document_source_sha256(
                    &request.baseline_source[baseline.start..baseline.end],
                ),
                label: format!("TikZ picture {} · {line_label}", ordinal + 1),
                preview: tikzpicture_preview(&request.baseline_source, *baseline),
                changed,
            }
        })
        .collect();

    Ok(GraphicsTikzpictureDiscovery {
        schema_version: 1,
        revision: request.revision,
        document_id: request.document_id,
        target_file_path: request.target_file_path,
        baseline_sha256: actual_fingerprint,
        targets,
        outside_changes,
        structurally_compatible,
        structural_error,
    })
}

pub fn prepare_graphics_tikzpicture(
    request: GraphicsTikzpictureFocusRequest,
) -> Result<GraphicsTikzpictureFocus, String> {
    let (actual_fingerprint, _) = validate_graphics_tikzpicture_request(
        request.schema_version,
        &request.document_id,
        &request.target_file_path,
        &request.baseline_source,
        &request.baseline_sha256,
    )?;
    let baseline_ranges = find_tikzpicture_byte_ranges(&request.baseline_source)?;
    let (ordinal, baseline) =
        select_tikzpicture_target(&request.baseline_source, &baseline_ranges, &request.target)?;
    let (working_source, working_range) =
        focused_tikzpicture_source(&request.baseline_source, &baseline_ranges, ordinal)?;
    let baseline_range = range_for_bytes(&request.baseline_source, baseline.start, baseline.end);
    let line_label = if baseline_range.start.line == baseline_range.end.line {
        format!("line {}", baseline_range.start.line)
    } else {
        format!(
            "lines {}–{}",
            baseline_range.start.line, baseline_range.end.line
        )
    };
    let source_sha256 =
        graphics_document_source_sha256(&request.baseline_source[baseline.start..baseline.end]);
    let target = GraphicsTikzpictureTargetDescriptor {
        ordinal,
        baseline_range,
        replacement_range: Some(range_for_bytes(
            &working_source,
            working_range.start,
            working_range.end,
        )),
        source_sha256,
        label: format!("TikZ picture {} · {line_label}", ordinal + 1),
        preview: tikzpicture_preview(&request.baseline_source, baseline),
        changed: false,
    };
    let working_sha256 = graphics_document_source_sha256(&working_source);

    Ok(GraphicsTikzpictureFocus {
        schema_version: 1,
        revision: request.revision,
        document_id: request.document_id,
        target_file_path: request.target_file_path,
        baseline_sha256: actual_fingerprint,
        working_source,
        working_sha256,
        target,
    })
}

pub fn plan_graphics_tikzpicture_edit(
    request: GraphicsTikzpictureEditRequest,
) -> Result<PackageEditPlan, String> {
    let (_, target_name) = validate_graphics_tikzpicture_request(
        request.schema_version,
        &request.document_id,
        &request.target_file_path,
        &request.baseline_source,
        &request.baseline_sha256,
    )?;
    let baseline_ranges = find_tikzpicture_byte_ranges(&request.baseline_source)?;
    let (ordinal, baseline_range) =
        select_tikzpicture_target(&request.baseline_source, &baseline_ranges, &request.target)?;
    let replacement_ranges = find_tikzpicture_byte_ranges(&request.replacement_source)?;
    let mut focused_comparison = None;
    let (comparison_range, replacement_range) = if replacement_ranges.len() == baseline_ranges.len()
    {
        (baseline_range, replacement_ranges[ordinal])
    } else if replacement_ranges.len() == 1 {
        let (focused_source, focused_range) =
            focused_tikzpicture_source(&request.baseline_source, &baseline_ranges, ordinal)?;
        focused_comparison = Some(focused_source);
        (focused_range, replacement_ranges[0])
    } else {
        return Err(format!(
                "Graphics Studio cannot safely map the selected environment: the replacement contains {} tikzpicture environment(s), but a full replacement requires {} and a focused replacement requires exactly 1.",
                replacement_ranges.len(),
                baseline_ranges.len()
            ));
    };
    let comparison_source = focused_comparison
        .as_deref()
        .unwrap_or(&request.baseline_source);

    if !tikzpicture_outside_bytes_are_equal(
        comparison_source,
        comparison_range,
        &request.replacement_source,
        replacement_range,
    ) {
        return Err(
            "Graphics Studio rejected the selected-environment edit because bytes outside the chosen tikzpicture were modified."
                .to_string(),
        );
    }

    let baseline_environment = &request.baseline_source[baseline_range.start..baseline_range.end];
    let replacement_environment =
        &request.replacement_source[replacement_range.start..replacement_range.end];

    if baseline_environment == replacement_environment {
        return Ok(PackageEditPlan {
            schema_version: 1,
            revision: request.revision,
            title: format!("Update TikZ picture {} in `{target_name}`", ordinal + 1),
            summary: "The selected tikzpicture already matches the generated source.".to_string(),
            edits: Vec::new(),
            diagnostics: vec![PackageDiagnostic {
                code: "graphics-tikzpicture-unchanged".to_string(),
                severity: PackageDiagnosticSeverity::Info,
                message: "No changes are required for the selected tikzpicture.".to_string(),
                range: Some(range_for_bytes(
                    &request.baseline_source,
                    baseline_range.start,
                    baseline_range.end,
                )),
                package_id: None,
            }],
        });
    }

    Ok(PackageEditPlan {
        schema_version: 1,
        revision: request.revision,
        title: format!(
            "Update TikZ picture {} in `{target_name}`",
            ordinal + 1
        ),
        summary: format!(
            "Replace only TikZ picture {} while preserving every byte outside the selected environment.",
            ordinal + 1
        ),
        edits: vec![TextEdit {
            range: range_for_bytes(
                &request.baseline_source,
                baseline_range.start,
                baseline_range.end,
            ),
            replacement: replacement_environment.to_string(),
        }],
        diagnostics: Vec::new(),
    })
}

pub fn prepare_graphics_new_drawing(
    request: GraphicsNewDrawingTemplateRequest,
) -> Result<GraphicsNewDrawingTemplate, String> {
    const SCHEMA_VERSION: u32 = 1;
    if request.schema_version != SCHEMA_VERSION {
        return Err(format!(
            "Unsupported Graphics Studio new-drawing schema version `{}`; expected `{SCHEMA_VERSION}`.",
            request.schema_version
        ));
    }

    let source = concat!(
        "\\documentclass{article}\n",
        "\\usepackage{tikz}\n",
        "\\usepackage{tkz-euclide}\n",
        "\\pagestyle{empty}\n",
        "\\begin{document}\n",
        "\\begin{tikzpicture}\n",
        "\\end{tikzpicture}\n",
        "\\end{document}\n",
    )
    .to_string();
    let ranges = find_tikzpicture_byte_ranges(&source)?;
    if ranges.len() != 1 || find_latex_document_byte_range(&source)?.is_none() {
        return Err("Graphics Studio could not prepare a valid drawing template.".to_string());
    }

    Ok(GraphicsNewDrawingTemplate {
        schema_version: SCHEMA_VERSION,
        revision: request.revision,
        source_sha256: graphics_document_source_sha256(&source),
        source,
    })
}

pub fn plan_graphics_drawing_insert(
    request: GraphicsDrawingInsertRequest,
) -> Result<PackageEditPlan, String> {
    let (_, target_name) = validate_graphics_tikzpicture_request(
        request.schema_version,
        &request.document_id,
        &request.target_file_path,
        &request.baseline_source,
        &request.baseline_sha256,
    )?;
    let host_document = find_latex_document_byte_range(&request.baseline_source)?;
    let drawing_ranges = find_tikzpicture_byte_ranges(&request.drawing_source)?;
    if drawing_ranges.len() != 1 {
        return Err(format!(
            "Graphics Studio new-drawing insertion requires exactly one real tikzpicture environment; found {}.",
            drawing_ranges.len()
        ));
    }
    let drawing_range = drawing_ranges[0];
    let drawing_document = find_latex_document_byte_range(&request.drawing_source)?;
    if let Some(document) = drawing_document {
        if drawing_range.start < document.body_start || drawing_range.end > document.body_end {
            return Err(
                "The scratch tikzpicture must be inside its LaTeX `document` environment."
                    .to_string(),
            );
        }
    }

    let mut diagnostics = Vec::new();
    if drawing_document
        .map(|document| {
            !latex_layout_and_comments_only(
                &request.drawing_source[document.body_start..drawing_range.start],
            ) || !latex_layout_and_comments_only(
                &request.drawing_source[drawing_range.end..document.body_end],
            )
        })
        .unwrap_or(false)
    {
        diagnostics.push(PackageDiagnostic {
            code: "graphics-drawing-scratch-content-ignored".to_string(),
            severity: PackageDiagnosticSeverity::Warning,
            message: "Content outside the scratch tikzpicture was intentionally not inserted."
                .to_string(),
            range: None,
            package_id: None,
        });
    }

    let (desired_packages, desired_libraries) = graphics_drawing_dependencies(
        &request.drawing_source,
        drawing_range,
        drawing_document,
        &request.required_packages,
        &request.required_tikz_libraries,
    )?;
    let line_ending = preferred_line_ending(&request.baseline_source);
    let drawing_environment = &request.drawing_source[drawing_range.start..drawing_range.end];

    let Some(host_document) = host_document else {
        if !request.baseline_source.is_empty() {
            return Err(
                "Graphics Studio can only insert a drawing into a complete LaTeX `document` environment."
                    .to_string(),
            );
        }
        match &request.target {
            GraphicsDrawingInsertionTarget::BeforeEndDocument
            | GraphicsDrawingInsertionTarget::Cursor { byte: 0 } => {}
            _ => {
                return Err(
                    "An empty destination supports only byte-zero cursor or before-document-end insertion."
                        .to_string(),
                )
            }
        }
        let wrapped_drawing = format_graphics_drawing_wrapper(
            drawing_environment,
            &request.wrapper,
            line_ending,
            "",
        )?;
        let dependency_block = format_graphics_dependency_block(
            "",
            0,
            &desired_packages,
            &desired_libraries,
            line_ending,
        );
        let replacement = format!(
            "\\documentclass{{article}}{line_ending}{dependency_block}\\pagestyle{{empty}}{line_ending}\\begin{{document}}{line_ending}{wrapped_drawing}{line_ending}\\end{{document}}{line_ending}"
        );
        return Ok(PackageEditPlan {
            schema_version: 1,
            revision: request.revision,
            title: format!("Create `{target_name}` with a new TikZ drawing"),
            summary:
                "Create a complete LaTeX document containing exactly one reviewed tikzpicture."
                    .to_string(),
            edits: vec![TextEdit {
                range: empty_range_at("", 0),
                replacement,
            }],
            diagnostics,
        });
    };

    let (body_start, body_end) = graphics_drawing_destination_range(
        &request.baseline_source,
        host_document,
        &request.target,
    )?;
    reject_nested_graphics_drawing_destination(&request.baseline_source, body_start, body_end)?;
    let wrapped_drawing = format_graphics_drawing_wrapper(
        drawing_environment,
        &request.wrapper,
        line_ending,
        drawing_insertion_indent(&request.baseline_source, body_start),
    )?;
    let body_replacement = surround_graphics_body_insertion(
        &request.baseline_source,
        body_start,
        body_end,
        &wrapped_drawing,
        line_ending,
    );

    let mut edits = Vec::new();
    if request.baseline_source[body_start..body_end] != body_replacement {
        edits.push(TextEdit {
            range: range_for_bytes(&request.baseline_source, body_start, body_end),
            replacement: body_replacement,
        });
    }

    let analysis = analyze_latex_packages(&request.baseline_source, request.revision);
    let existing_packages = analysis
        .declarations
        .iter()
        .filter(|declaration| {
            declaration.range.start.byte < host_document.begin_start
                && is_active_latex_command_backslash(
                    &request.baseline_source,
                    declaration.range.start.byte,
                )
                && matches!(
                    declaration.kind,
                    PackageDeclarationKind::UsePackage | PackageDeclarationKind::RequirePackage
                )
        })
        .map(|declaration| declaration.name.to_ascii_lowercase())
        .collect::<BTreeSet<_>>();
    let existing_libraries = analysis
        .declarations
        .iter()
        .filter(|declaration| {
            declaration.range.start.byte < host_document.begin_start
                && is_active_latex_command_backslash(
                    &request.baseline_source,
                    declaration.range.start.byte,
                )
                && declaration.kind == PackageDeclarationKind::TikzLibrary
        })
        .map(|declaration| declaration.name.to_ascii_lowercase())
        .collect::<BTreeSet<_>>();

    let missing_packages = desired_packages
        .into_iter()
        .filter(|requirement| {
            !existing_packages.contains(&requirement.package_id.to_ascii_lowercase())
        })
        .collect::<Vec<_>>();
    let missing_libraries = desired_libraries
        .into_iter()
        .filter(|library| !existing_libraries.contains(&library.to_ascii_lowercase()))
        .collect::<Vec<_>>();

    if !missing_packages.is_empty() || !missing_libraries.is_empty() {
        let insertion_byte = graphics_preamble_insertion_byte(
            &request.baseline_source,
            &analysis,
            host_document.begin_start,
        );
        if insertion_byte >= body_start && body_start == body_end {
            return Err(
                "Graphics Studio could not produce non-overlapping preamble and drawing edits."
                    .to_string(),
            );
        }
        let dependency_block = format_graphics_dependency_block(
            &request.baseline_source,
            insertion_byte,
            &missing_packages,
            &missing_libraries,
            line_ending,
        );
        edits.push(TextEdit {
            range: empty_range_at(&request.baseline_source, insertion_byte),
            replacement: dependency_block,
        });
    }

    edits.sort_by_key(|edit| edit.range.start.byte);
    let dependency_count = missing_packages.len() + missing_libraries.len();
    if edits.is_empty() {
        diagnostics.push(PackageDiagnostic {
            code: "graphics-drawing-insertion-unchanged".to_string(),
            severity: PackageDiagnosticSeverity::Info,
            message: "The selected destination already contains the requested drawing.".to_string(),
            range: Some(range_for_bytes(
                &request.baseline_source,
                body_start,
                body_end,
            )),
            package_id: None,
        });
    }

    Ok(PackageEditPlan {
        schema_version: 1,
        revision: request.revision,
        title: format!("Insert a new TikZ drawing into `{target_name}`"),
        summary: if edits.is_empty() {
            "The destination and required graphics dependencies are already up to date.".to_string()
        } else if dependency_count == 0 {
            "Insert exactly one reviewed tikzpicture into the selected document location."
                .to_string()
        } else {
            format!(
                "Insert exactly one reviewed tikzpicture and add {dependency_count} missing graphics dependenc{}.",
                if dependency_count == 1 { "y" } else { "ies" }
            )
        },
        edits,
        diagnostics,
    })
}

fn graphics_drawing_destination_range(
    source: &str,
    document: LatexDocumentByteRange,
    target: &GraphicsDrawingInsertionTarget,
) -> Result<(usize, usize), String> {
    let validate_boundary = |byte: usize, label: &str| -> Result<(), String> {
        if byte > source.len() || !source.is_char_boundary(byte) {
            return Err(format!(
                "Graphics Studio {label} byte `{byte}` is not a valid UTF-8 boundary."
            ));
        }
        Ok(())
    };
    let validate_in_body = |byte: usize, label: &str| -> Result<(), String> {
        if byte < document.body_start || byte > document.body_end {
            return Err(format!(
                "Graphics Studio {label} byte `{byte}` is outside the LaTeX document body."
            ));
        }
        Ok(())
    };

    match target {
        GraphicsDrawingInsertionTarget::Cursor { byte } => {
            validate_boundary(*byte, "cursor")?;
            validate_in_body(*byte, "cursor")?;
            Ok((*byte, *byte))
        }
        GraphicsDrawingInsertionTarget::BeforeEndDocument => {
            Ok((document.body_end, document.body_end))
        }
        GraphicsDrawingInsertionTarget::Selection {
            start_byte,
            end_byte,
        } => {
            validate_boundary(*start_byte, "selection start")?;
            validate_boundary(*end_byte, "selection end")?;
            if start_byte >= end_byte {
                return Err(
                    "Graphics Studio selection must be a non-empty half-open byte range."
                        .to_string(),
                );
            }
            validate_in_body(*start_byte, "selection start")?;
            validate_in_body(*end_byte, "selection end")?;
            Ok((*start_byte, *end_byte))
        }
    }
}

fn reject_nested_graphics_drawing_destination(
    source: &str,
    start: usize,
    end: usize,
) -> Result<(), String> {
    let existing = find_tikzpicture_byte_ranges(source)?;
    if start == end {
        if existing
            .iter()
            .any(|range| range.start < start && start < range.end)
        {
            return Err(
                "Graphics Studio cannot insert a new tikzpicture inside an existing tikzpicture."
                    .to_string(),
            );
        }
        return Ok(());
    }

    for range in existing {
        let overlaps = start < range.end && range.start < end;
        let removes_complete_environment = start <= range.start && range.end <= end;
        if overlaps && !removes_complete_environment {
            return Err(
                "Graphics Studio selection partially overlaps an existing tikzpicture; select the complete environment or insert outside it."
                    .to_string(),
            );
        }
    }
    Ok(())
}

fn graphics_drawing_dependencies(
    drawing_source: &str,
    drawing_range: TikzpictureByteRange,
    drawing_document: Option<LatexDocumentByteRange>,
    requested_packages: &[String],
    requested_libraries: &[String],
) -> Result<(Vec<GraphicsPackageRequirement>, Vec<String>), String> {
    let preamble_end = drawing_document
        .map(|document| document.begin_start)
        .unwrap_or(drawing_range.start);
    let analysis = analyze_latex_packages(drawing_source, 0);
    let mut packages = vec![
        GraphicsPackageRequirement {
            package_id: "tikz".to_string(),
            options: Vec::new(),
        },
        GraphicsPackageRequirement {
            package_id: "tkz-euclide".to_string(),
            options: Vec::new(),
        },
    ];
    let mut libraries = Vec::new();

    for declaration in analysis.declarations.iter().filter(|declaration| {
        declaration.range.start.byte < preamble_end
            && is_active_latex_command_backslash(drawing_source, declaration.range.start.byte)
    }) {
        match declaration.kind {
            PackageDeclarationKind::UsePackage | PackageDeclarationKind::RequirePackage => {
                let package_id = normalize_package_id(&declaration.name)?;
                push_graphics_package_requirement(
                    &mut packages,
                    package_id,
                    declaration.options.clone(),
                );
            }
            PackageDeclarationKind::TikzLibrary => {
                let library = normalize_tikz_library_id(&declaration.name)?;
                push_case_insensitive_unique(&mut libraries, library);
            }
            _ => {}
        }
    }
    for package_id in requested_packages {
        push_graphics_package_requirement(
            &mut packages,
            normalize_package_id(package_id)?,
            Vec::new(),
        );
    }
    for library in requested_libraries {
        let library = normalize_tikz_library_id(library)?;
        push_case_insensitive_unique(&mut libraries, library);
    }

    Ok((packages, libraries))
}

fn push_graphics_package_requirement(
    requirements: &mut Vec<GraphicsPackageRequirement>,
    package_id: String,
    options: Vec<String>,
) {
    if let Some(existing) = requirements
        .iter_mut()
        .find(|existing| existing.package_id.eq_ignore_ascii_case(&package_id))
    {
        if existing.options.is_empty() && !options.is_empty() {
            existing.options = options;
        }
        return;
    }
    requirements.push(GraphicsPackageRequirement {
        package_id,
        options,
    });
}

fn push_case_insensitive_unique(values: &mut Vec<String>, value: String) {
    if !values
        .iter()
        .any(|existing| existing.eq_ignore_ascii_case(&value))
    {
        values.push(value);
    }
}

fn normalize_tikz_library_id(library: &str) -> Result<String, String> {
    let library = library.trim();
    if library.is_empty()
        || !library
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.' | '/'))
    {
        return Err(format!("Invalid TikZ library id `{library}`."));
    }
    Ok(library.to_string())
}

fn graphics_preamble_insertion_byte(
    source: &str,
    analysis: &LatexPackageAnalysis,
    document_begin: usize,
) -> usize {
    let anchor = analysis
        .declarations
        .iter()
        .filter(|declaration| {
            declaration.range.start.byte < document_begin
                && is_active_latex_command_backslash(source, declaration.range.start.byte)
        })
        .filter(|declaration| {
            matches!(
                declaration.kind,
                PackageDeclarationKind::UsePackage | PackageDeclarationKind::RequirePackage
            )
        })
        .max_by_key(|declaration| declaration.range.end.byte)
        .or_else(|| {
            analysis.document_class.as_ref().filter(|declaration| {
                declaration.range.start.byte < document_begin
                    && is_active_latex_command_backslash(source, declaration.range.start.byte)
            })
        });

    let Some(anchor) = anchor else {
        return document_begin;
    };
    let next_line = next_line_start(source, anchor.range.end.byte);
    if next_line <= document_begin {
        next_line
    } else {
        anchor.range.end.byte
    }
}

fn format_graphics_dependency_block(
    source: &str,
    insertion_byte: usize,
    packages: &[GraphicsPackageRequirement],
    libraries: &[String],
    line_ending: &str,
) -> String {
    let mut lines = packages
        .iter()
        .map(|requirement| {
            format_package_declaration(
                PackageDeclarationKind::UsePackage,
                &requirement.options,
                &[requirement.package_id.as_str()],
            )
        })
        .collect::<Vec<_>>();
    if !libraries.is_empty() {
        lines.push(format!("\\usetikzlibrary{{{}}}", libraries.join(", ")));
    }

    let mut block = String::new();
    if insertion_byte > 0 && source.as_bytes().get(insertion_byte - 1) != Some(&b'\n') {
        block.push_str(line_ending);
    }
    block.push_str(&lines.join(line_ending));
    block.push_str(line_ending);
    block
}

fn preferred_line_ending(source: &str) -> &'static str {
    if source.contains("\r\n") {
        "\r\n"
    } else {
        "\n"
    }
}

fn normalize_graphics_line_endings(source: &str, line_ending: &str) -> String {
    source
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .replace('\n', line_ending)
}

fn drawing_insertion_indent(source: &str, byte: usize) -> &str {
    let line_start = line_start_for_byte(source, byte);
    let prefix = &source[line_start..byte];
    if prefix.chars().all(|ch| matches!(ch, ' ' | '\t')) {
        prefix
    } else {
        ""
    }
}

fn format_graphics_drawing_wrapper(
    environment: &str,
    wrapper: &GraphicsDrawingWrapper,
    line_ending: &str,
    base_indent: &str,
) -> Result<String, String> {
    let normalized = normalize_graphics_line_endings(environment, "\n");
    let environment = normalized.trim_matches('\n');
    match wrapper {
        GraphicsDrawingWrapper::Inline => Ok(indent_graphics_block(
            environment,
            base_indent,
            "",
            line_ending,
        )),
        GraphicsDrawingWrapper::Figure {
            placement,
            centering,
            caption,
            label,
        } => {
            let placement = normalize_figure_placement(placement.as_deref())?;
            let caption = normalize_figure_caption(caption.as_deref())?;
            let label = normalize_figure_label(label.as_deref())?;
            let mut lines = vec![match placement {
                Some(placement) => format!("\\begin{{figure}}[{placement}]"),
                None => "\\begin{figure}".to_string(),
            }];
            if *centering {
                lines.push(format!("{base_indent}  \\centering"));
            }
            lines.extend(
                normalize_graphics_line_endings(environment, "\n")
                    .split('\n')
                    .map(|line| format!("{base_indent}  {line}")),
            );
            if let Some(caption) = caption {
                lines.push(format!("{base_indent}  \\caption{{{caption}}}"));
            }
            if let Some(label) = label {
                lines.push(format!("{base_indent}  \\label{{{label}}}"));
            }
            lines.push(format!("{base_indent}\\end{{figure}}"));
            Ok(lines.join(line_ending))
        }
    }
}

fn indent_graphics_block(
    block: &str,
    continuation_indent: &str,
    inner_indent: &str,
    line_ending: &str,
) -> String {
    block
        .split('\n')
        .enumerate()
        .map(|(index, line)| {
            if index == 0 {
                line.to_string()
            } else {
                format!("{continuation_indent}{inner_indent}{line}")
            }
        })
        .collect::<Vec<_>>()
        .join(line_ending)
}

fn normalize_figure_placement(value: Option<&str>) -> Result<Option<String>, String> {
    let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    let value = value
        .strip_prefix('[')
        .and_then(|value| value.strip_suffix(']'))
        .unwrap_or(value);
    if value.is_empty()
        || !value
            .chars()
            .all(|ch| matches!(ch, 'h' | 't' | 'b' | 'p' | 'H' | '!'))
    {
        return Err(
            "Figure placement may contain only `h`, `t`, `b`, `p`, `H`, and `!`.".to_string(),
        );
    }
    Ok(Some(value.to_string()))
}

fn normalize_figure_caption(value: Option<&str>) -> Result<Option<String>, String> {
    let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    if value.contains('\0') || value.lines().count() != 1 || !latex_braces_are_balanced(value) {
        return Err("Figure caption must be a single line with balanced LaTeX braces.".to_string());
    }
    if value
        .char_indices()
        .any(|(index, ch)| ch == '%' && !is_escaped_percent(value, index))
    {
        return Err("Figure caption must escape literal percent signs as `\\%`.".to_string());
    }
    Ok(Some(value.to_string()))
}

fn normalize_figure_label(value: Option<&str>) -> Result<Option<String>, String> {
    let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    if !value
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, ':' | '-' | '_' | '.' | '/'))
    {
        return Err(
            "Figure label may contain only letters, numbers, `:`, `-`, `_`, `.`, and `/`."
                .to_string(),
        );
    }
    Ok(Some(value.to_string()))
}

fn latex_braces_are_balanced(value: &str) -> bool {
    let mut depth = 0usize;
    for (index, ch) in value.char_indices() {
        if !matches!(ch, '{' | '}') || is_escaped_ascii_marker(value, index) {
            continue;
        }
        if ch == '{' {
            depth += 1;
        } else if let Some(next) = depth.checked_sub(1) {
            depth = next;
        } else {
            return false;
        }
    }
    depth == 0
}

fn surround_graphics_body_insertion(
    source: &str,
    start: usize,
    end: usize,
    drawing: &str,
    line_ending: &str,
) -> String {
    let line_start = line_start_for_byte(source, start);
    let prefix_on_line = &source[line_start..start];
    let needs_prefix = start > 0
        && source.as_bytes().get(start - 1) != Some(&b'\n')
        && !prefix_on_line.chars().all(|ch| matches!(ch, ' ' | '\t'));
    let remaining_line_end = source[end..]
        .find('\n')
        .map(|offset| end + offset)
        .unwrap_or(source.len());
    let suffix_on_line = &source[end..remaining_line_end];
    let needs_suffix = end < source.len()
        && !source[end..].starts_with('\n')
        && !source[end..].starts_with("\r\n")
        && !suffix_on_line
            .chars()
            .all(|ch| matches!(ch, ' ' | '\t' | '\r'));

    let mut replacement = String::new();
    if needs_prefix {
        replacement.push_str(line_ending);
    }
    replacement.push_str(drawing);
    if needs_suffix {
        replacement.push_str(line_ending);
    }
    replacement
}

fn latex_layout_and_comments_only(source: &str) -> bool {
    let mut index = 0usize;
    while index < source.len() {
        let ch = source[index..]
            .chars()
            .next()
            .expect("index must remain on a UTF-8 boundary");
        if ch.is_whitespace() {
            index += ch.len_utf8();
            continue;
        }
        if ch == '%' && !is_escaped_percent(source, index) {
            index = source[index..]
                .find('\n')
                .map(|offset| index + offset + 1)
                .unwrap_or(source.len());
            continue;
        }
        return false;
    }
    true
}

pub fn plan_add_package(request: AddPackageRequest) -> Result<PackageEditPlan, String> {
    let package_id = normalize_package_id(&request.package_id)?;
    let analysis = analyze_latex_packages(&request.source, request.revision);

    let existing_declaration = analysis.declarations.iter().find(|decl| {
        matches!(
            decl.kind,
            PackageDeclarationKind::UsePackage | PackageDeclarationKind::RequirePackage
        ) && decl.name.eq_ignore_ascii_case(&package_id)
    });

    if let Some(existing) = existing_declaration {
        if request.update_existing {
            let replacement =
                format_updated_package_declaration(existing, &package_id, &request.options);

            if existing.raw.trim() == replacement.trim() {
                return Ok(PackageEditPlan {
                    schema_version: 1,
                    revision: request.revision,
                    title: format!("Update package `{}`", package_id),
                    summary: format!("`{}` already matches the requested options.", package_id),
                    edits: Vec::new(),
                    diagnostics: vec![PackageDiagnostic {
                        code: "package-already-up-to-date".to_string(),
                        severity: PackageDiagnosticSeverity::Info,
                        message: format!("Package `{}` is already up to date.", package_id),
                        range: Some(existing.range.clone()),
                        package_id: Some(package_id),
                    }],
                });
            }

            return Ok(PackageEditPlan {
                schema_version: 1,
                revision: request.revision,
                title: format!("Update package `{}`", package_id),
                summary: format!(
                    "Replace `{}` with `{}`.",
                    existing.raw,
                    replacement.trim_end()
                ),
                edits: vec![TextEdit {
                    range: existing.range.clone(),
                    replacement,
                }],
                diagnostics: Vec::new(),
            });
        }

        return Ok(PackageEditPlan {
            schema_version: 1,
            revision: request.revision,
            title: format!("Add package `{}`", package_id),
            summary: format!("`{}` is already declared in this document.", package_id),
            edits: Vec::new(),
            diagnostics: vec![PackageDiagnostic {
                code: "package-already-present".to_string(),
                severity: PackageDiagnosticSeverity::Info,
                message: format!("Package `{}` is already present.", package_id),
                range: Some(existing.range.clone()),
                package_id: Some(package_id),
            }],
        });
    }

    let declaration = format!(
        "{}\n",
        format_package_declaration(
            PackageDeclarationKind::UsePackage,
            &request.options,
            &[package_id.as_str()]
        )
    );
    let insertion_byte = find_package_insertion_byte(&request.source, &analysis);
    let range = empty_range_at(&request.source, insertion_byte);

    Ok(PackageEditPlan {
        schema_version: 1,
        revision: request.revision,
        title: format!("Add package `{}`", package_id),
        summary: format!("Insert `{}` in the preamble.", declaration.trim_end()),
        edits: vec![TextEdit {
            range,
            replacement: declaration,
        }],
        diagnostics: Vec::new(),
    })
}

fn add_package_relationship_diagnostics(
    declarations: &[PackageDeclaration],
    diagnostics: &mut Vec<PackageDiagnostic>,
) {
    if let (Some(color), Some(_xcolor)) = (
        first_package_declaration(declarations, "color"),
        first_package_declaration(declarations, "xcolor"),
    ) {
        diagnostics.push(PackageDiagnostic {
            code: "package-conflict-color-xcolor".to_string(),
            severity: PackageDiagnosticSeverity::Warning,
            message: "Packages `color` and `xcolor` are both declared. Prefer `xcolor` unless the document explicitly needs both.".to_string(),
            range: Some(color.range.clone()),
            package_id: Some("color".to_string()),
        });
    }

    if let Some(epsfig) = first_package_declaration(declarations, "epsfig") {
        diagnostics.push(PackageDiagnostic {
            code: "obsolete-package-epsfig".to_string(),
            severity: PackageDiagnosticSeverity::Warning,
            message: "Package `epsfig` is obsolete; prefer `graphicx` for new documents."
                .to_string(),
            range: Some(epsfig.range.clone()),
            package_id: Some("epsfig".to_string()),
        });
    }

    if let (Some(subfigure), Some(_subcaption)) = (
        first_package_declaration(declarations, "subfigure"),
        first_package_declaration(declarations, "subcaption"),
    ) {
        diagnostics.push(PackageDiagnostic {
            code: "package-conflict-subfigure-subcaption".to_string(),
            severity: PackageDiagnosticSeverity::Warning,
            message:
                "Packages `subfigure` and `subcaption` conflict. Prefer `subcaption` for new documents."
                    .to_string(),
            range: Some(subfigure.range.clone()),
            package_id: Some("subfigure".to_string()),
        });
    }

    if let Some(hyperref) = first_package_declaration(declarations, "hyperref") {
        if let Some(later) = first_package_after(declarations, hyperref.range.start.byte) {
            if !package_allowed_after_hyperref(&later.name) {
                diagnostics.push(PackageDiagnostic {
                    code: "package-order-hyperref-late".to_string(),
                    severity: PackageDiagnosticSeverity::Warning,
                    message: format!(
                        "Package `hyperref` is usually loaded near the end of the preamble; `{}` appears after it.",
                        later.name
                    ),
                    range: Some(hyperref.range.clone()),
                    package_id: Some("hyperref".to_string()),
                });
            }
        }
    }

    if let (Some(cleveref), Some(hyperref)) = (
        first_package_declaration(declarations, "cleveref"),
        first_package_declaration(declarations, "hyperref"),
    ) {
        if cleveref.range.start.byte < hyperref.range.start.byte {
            diagnostics.push(PackageDiagnostic {
                code: "package-order-cleveref-after-hyperref".to_string(),
                severity: PackageDiagnosticSeverity::Warning,
                message: "Package `cleveref` should usually be loaded after `hyperref`."
                    .to_string(),
                range: Some(cleveref.range.clone()),
                package_id: Some("cleveref".to_string()),
            });
        }
    }
}

fn first_package_declaration<'a>(
    declarations: &'a [PackageDeclaration],
    package_id: &str,
) -> Option<&'a PackageDeclaration> {
    declarations.iter().find(|declaration| {
        matches!(
            declaration.kind,
            PackageDeclarationKind::UsePackage | PackageDeclarationKind::RequirePackage
        ) && declaration.name.eq_ignore_ascii_case(package_id)
    })
}

fn first_package_after(
    declarations: &[PackageDeclaration],
    start_byte: usize,
) -> Option<&PackageDeclaration> {
    declarations
        .iter()
        .filter(|declaration| {
            matches!(
                declaration.kind,
                PackageDeclarationKind::UsePackage | PackageDeclarationKind::RequirePackage
            ) && declaration.range.start.byte > start_byte
        })
        .min_by_key(|declaration| declaration.range.start.byte)
}

fn package_allowed_after_hyperref(package_id: &str) -> bool {
    matches!(
        package_id.to_ascii_lowercase().as_str(),
        "bookmark" | "cleveref" | "hypcap" | "glossaries" | "glossaries-extra"
    )
}

pub fn plan_remove_package(request: RemovePackageRequest) -> Result<PackageEditPlan, String> {
    let package_id = normalize_package_id(&request.package_id)?;
    let analysis = analyze_latex_packages(&request.source, request.revision);
    let mut target_declarations = analysis
        .declarations
        .iter()
        .filter(|decl| {
            matches!(
                decl.kind,
                PackageDeclarationKind::UsePackage | PackageDeclarationKind::RequirePackage
            ) && decl.name.eq_ignore_ascii_case(&package_id)
        })
        .collect::<Vec<_>>();

    target_declarations.sort_by_key(|decl| (decl.range.start.byte, decl.range.end.byte));
    target_declarations.dedup_by_key(|decl| (decl.range.start.byte, decl.range.end.byte));

    if target_declarations.is_empty() {
        return Ok(PackageEditPlan {
            schema_version: 1,
            revision: request.revision,
            title: format!("Remove package `{}`", package_id),
            summary: format!("`{}` is not declared in this document.", package_id),
            edits: Vec::new(),
            diagnostics: vec![PackageDiagnostic {
                code: "package-not-present".to_string(),
                severity: PackageDiagnosticSeverity::Info,
                message: format!("Package `{}` is not present.", package_id),
                range: None,
                package_id: Some(package_id),
            }],
        });
    }

    let edits = target_declarations
        .iter()
        .map(|declaration| {
            let replacement = format_removed_package_declaration(declaration, &package_id);
            if replacement.is_empty() {
                TextEdit {
                    range: removable_declaration_range(&request.source, declaration),
                    replacement,
                }
            } else {
                TextEdit {
                    range: declaration.range.clone(),
                    replacement,
                }
            }
        })
        .collect::<Vec<_>>();

    Ok(PackageEditPlan {
        schema_version: 1,
        revision: request.revision,
        title: format!("Remove package `{}`", package_id),
        summary: format!(
            "Remove `{}` from {} package declaration{}.",
            package_id,
            edits.len(),
            if edits.len() == 1 { "" } else { "s" }
        ),
        edits,
        diagnostics: Vec::new(),
    })
}

pub fn plan_move_package(request: MovePackageRequest) -> Result<PackageEditPlan, String> {
    let package_id = normalize_package_id(&request.package_id)?;
    let analysis = analyze_latex_packages(&request.source, request.revision);
    let Some(declaration) = first_package_declaration(&analysis.declarations, &package_id) else {
        return Ok(PackageEditPlan {
            schema_version: 1,
            revision: request.revision,
            title: format!("Move package `{}`", package_id),
            summary: format!("`{}` is not declared in this document.", package_id),
            edits: Vec::new(),
            diagnostics: vec![PackageDiagnostic {
                code: "package-not-present".to_string(),
                severity: PackageDiagnosticSeverity::Info,
                message: format!("Package `{}` is not present.", package_id),
                range: None,
                package_id: Some(package_id),
            }],
        });
    };

    let insertion_byte = match request.target.as_str() {
        "latePreamble" => find_package_insertion_byte(&request.source, &analysis),
        "afterPackage" => {
            let after_package_id = request
                .after_package_id
                .as_deref()
                .ok_or_else(|| "afterPackage target requires afterPackageId.".to_string())?;
            let after_package_id = normalize_package_id(after_package_id)?;
            let Some(after_declaration) =
                first_package_declaration(&analysis.declarations, &after_package_id)
            else {
                return Ok(PackageEditPlan {
                    schema_version: 1,
                    revision: request.revision,
                    title: format!("Move package `{}`", package_id),
                    summary: format!(
                        "Cannot move `{}` because `{}` is not declared.",
                        package_id, after_package_id
                    ),
                    edits: Vec::new(),
                    diagnostics: vec![PackageDiagnostic {
                        code: "package-move-anchor-not-present".to_string(),
                        severity: PackageDiagnosticSeverity::Warning,
                        message: format!("Package `{}` is not present.", after_package_id),
                        range: None,
                        package_id: Some(after_package_id),
                    }],
                });
            };
            next_line_start(&request.source, after_declaration.range.end.byte)
        }
        other => return Err(format!("Unsupported package move target `{}`.", other)),
    };

    if next_line_start(&request.source, declaration.range.end.byte) == insertion_byte {
        return Ok(PackageEditPlan {
            schema_version: 1,
            revision: request.revision,
            title: format!("Move package `{}`", package_id),
            summary: format!("`{}` is already in the requested position.", package_id),
            edits: Vec::new(),
            diagnostics: vec![PackageDiagnostic {
                code: "package-already-in-position".to_string(),
                severity: PackageDiagnosticSeverity::Info,
                message: format!(
                    "Package `{}` is already in the requested position.",
                    package_id
                ),
                range: Some(declaration.range.clone()),
                package_id: Some(package_id),
            }],
        });
    }

    let removal_replacement = format_removed_package_declaration(declaration, &package_id);
    let removal_range = if removal_replacement.is_empty() {
        removable_declaration_range(&request.source, declaration)
    } else {
        declaration.range.clone()
    };
    let moved_declaration = format!(
        "{}\n",
        format_package_declaration(
            declaration.kind.clone(),
            &declaration.options,
            &[declaration.name.as_str()]
        )
    );

    Ok(PackageEditPlan {
        schema_version: 1,
        revision: request.revision,
        title: format!("Move package `{}`", package_id),
        summary: format!("Move `{}` to the requested package position.", package_id),
        edits: vec![
            TextEdit {
                range: empty_range_at(&request.source, insertion_byte),
                replacement: moved_declaration,
            },
            TextEdit {
                range: removal_range,
                replacement: removal_replacement,
            },
        ],
        diagnostics: Vec::new(),
    })
}

pub fn plan_generated_block(request: GeneratedBlockRequest) -> Result<PackageEditPlan, String> {
    let block_id = normalize_block_id(&request.block_id)?;
    let replacement = format_generated_block(&block_id, &request.code);
    let existing_range = find_generated_block_range(&request.source, &block_id);

    if let Some(range) = existing_range {
        if replacement.is_empty() {
            return Ok(PackageEditPlan {
                schema_version: 1,
                revision: request.revision,
                title: format!("Remove generated block `{}`", block_id),
                summary: format!("Remove existing Package Studio `{}` block.", block_id),
                edits: vec![TextEdit { range, replacement }],
                diagnostics: Vec::new(),
            });
        }

        return Ok(PackageEditPlan {
            schema_version: 1,
            revision: request.revision,
            title: format!("Update generated block `{}`", block_id),
            summary: format!("Replace existing Package Studio `{}` block.", block_id),
            edits: vec![TextEdit { range, replacement }],
            diagnostics: Vec::new(),
        });
    }

    if replacement.is_empty() {
        return Ok(PackageEditPlan {
            schema_version: 1,
            revision: request.revision,
            title: format!("Remove generated block `{}`", block_id),
            summary: format!("No existing Package Studio `{}` block was found.", block_id),
            edits: Vec::new(),
            diagnostics: vec![PackageDiagnostic {
                code: "generated-block-not-present".to_string(),
                severity: PackageDiagnosticSeverity::Info,
                message: format!("No generated `{}` block is present.", block_id),
                range: None,
                package_id: None,
            }],
        });
    }

    let analysis = analyze_latex_packages(&request.source, request.revision);
    let insertion_byte = find_package_insertion_byte(&request.source, &analysis);
    let range = empty_range_at(&request.source, insertion_byte);

    Ok(PackageEditPlan {
        schema_version: 1,
        revision: request.revision,
        title: format!("Insert generated block `{}`", block_id),
        summary: format!(
            "Insert Package Studio `{}` block in the preamble.",
            block_id
        ),
        edits: vec![TextEdit { range, replacement }],
        diagnostics: Vec::new(),
    })
}

/// Builds one reviewable edit for a complete Package Studio configuration.
///
/// The individual package and generated-block planners are deliberately reused
/// here. Applying their plans to an in-memory source first means a builder can
/// switch package variants, update options, and replace/remove its managed
/// setup atomically without producing overlapping source edits.
pub fn plan_apply_builder_configuration(
    request: ApplyBuilderConfigurationRequest,
) -> Result<PackageEditPlan, String> {
    let builder_id = normalize_block_id(&request.builder_id)?;
    let mut managed_package_ids = request
        .managed_package_ids
        .iter()
        .map(|package_id| normalize_package_id(package_id))
        .collect::<Result<Vec<_>, _>>()?;
    managed_package_ids.sort_by_key(|package_id| package_id.to_ascii_lowercase());
    managed_package_ids.dedup_by(|left, right| left.eq_ignore_ascii_case(right));

    let requirements = if request.enabled {
        request.requirements.clone()
    } else {
        Vec::new()
    };

    for requirement in &requirements {
        normalize_package_id(&requirement.package_id)?;
    }

    let desired_package_ids = requirements
        .iter()
        .map(|requirement| requirement.package_id.to_ascii_lowercase())
        .collect::<BTreeSet<_>>();
    let mut next_source = request.source.clone();
    let mut diagnostics = Vec::new();

    for package_id in &managed_package_ids {
        if desired_package_ids.contains(&package_id.to_ascii_lowercase()) {
            continue;
        }
        let plan = plan_remove_package(RemovePackageRequest {
            source: next_source.clone(),
            revision: request.revision,
            package_id: package_id.clone(),
        })?;
        diagnostics.extend(plan.diagnostics);
        next_source = apply_plan_to_source(&next_source, &plan.edits)?;
    }

    for requirement in &requirements {
        let update_existing = managed_package_ids
            .iter()
            .any(|managed| managed.eq_ignore_ascii_case(&requirement.package_id));
        let plan = plan_add_package(AddPackageRequest {
            source: next_source.clone(),
            revision: request.revision,
            package_id: requirement.package_id.clone(),
            options: requirement.options.clone(),
            update_existing,
        })?;
        diagnostics.extend(plan.diagnostics);
        next_source = apply_plan_to_source(&next_source, &plan.edits)?;
    }

    for block in &request.generated_blocks {
        let plan = plan_generated_block(GeneratedBlockRequest {
            source: next_source.clone(),
            revision: request.revision,
            block_id: block.block_id.clone(),
            code: if request.enabled {
                block.code.clone()
            } else {
                String::new()
            },
        })?;
        diagnostics.extend(plan.diagnostics);
        next_source = apply_plan_to_source(&next_source, &plan.edits)?;
    }

    let edits = minimal_source_edit(&request.source, &next_source)
        .into_iter()
        .collect::<Vec<_>>();
    let action = if request.enabled { "Apply" } else { "Remove" };

    Ok(PackageEditPlan {
        schema_version: 1,
        revision: request.revision,
        title: format!("{} `{}` configuration", action, builder_id),
        summary: if edits.is_empty() {
            format!("The `{}` configuration is already up to date.", builder_id)
        } else if request.enabled {
            format!(
                "Synchronize packages, options, and generated setup for `{}`.",
                builder_id
            )
        } else {
            format!(
                "Remove packages and generated setup managed by `{}`.",
                builder_id
            )
        },
        edits,
        diagnostics,
    })
}

fn apply_plan_to_source(source: &str, edits: &[TextEdit]) -> Result<String, String> {
    let mut next = source.to_string();
    let mut ordered = edits.to_vec();
    ordered.sort_by_key(|edit| std::cmp::Reverse(edit.range.start.byte));

    for edit in ordered {
        let start = edit.range.start.byte;
        let end = edit.range.end.byte;
        if start > end
            || end > next.len()
            || !next.is_char_boundary(start)
            || !next.is_char_boundary(end)
        {
            return Err("Package Studio generated an invalid UTF-8 source range.".to_string());
        }
        next.replace_range(start..end, &edit.replacement);
    }

    Ok(next)
}

fn minimal_source_edit(current: &str, next: &str) -> Option<TextEdit> {
    if current == next {
        return None;
    }

    let mut prefix = 0usize;
    for (current_char, next_char) in current.chars().zip(next.chars()) {
        if current_char != next_char {
            break;
        }
        prefix += current_char.len_utf8();
    }

    let current_tail = &current[prefix..];
    let next_tail = &next[prefix..];
    let mut suffix = 0usize;
    for (current_char, next_char) in current_tail.chars().rev().zip(next_tail.chars().rev()) {
        if current_char != next_char {
            break;
        }
        suffix += current_char.len_utf8();
    }

    let current_end = current.len() - suffix;
    let next_end = next.len() - suffix;
    Some(TextEdit {
        range: range_for_bytes(current, prefix, current_end),
        replacement: next[prefix..next_end].to_string(),
    })
}

#[derive(Debug, Clone)]
struct ParsedCommand {
    name: String,
    optional_args: Vec<String>,
    required_args: Vec<String>,
    range: SourceRange,
    command_range: SourceRange,
    raw: String,
}

fn find_latex_commands(source: &str) -> Vec<ParsedCommand> {
    let mut commands = Vec::new();
    let bytes = source.as_bytes();
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] != b'\\' || is_escaped_backslash(source, index) {
            index += 1;
            continue;
        }

        let name_start = index + 1;
        let mut name_end = name_start;
        while name_end < bytes.len() && bytes[name_end].is_ascii_alphabetic() {
            name_end += 1;
        }

        if name_end == name_start {
            index += 1;
            continue;
        }

        let name = &source[name_start..name_end];
        if !matches!(
            name,
            "usepackage"
                | "RequirePackage"
                | "documentclass"
                | "usetikzlibrary"
                | "pgfplotsset"
                | "setlist"
                | "newlist"
                | "pagestyle"
                | "fancyhf"
                | "fancyhead"
                | "fancyfoot"
                | "renewcommand"
                | "lstdefinestyle"
                | "lstset"
                | "usemintedstyle"
                | "setminted"
                | "definecolor"
                | "colorlet"
                | "sisetup"
                | "SI"
                | "si"
                | "SIlist"
                | "SIrange"
                | "num"
                | "unit"
                | "qty"
                | "qtylist"
                | "qtyrange"
                | "prescript"
                | "splitfrac"
                | "splitdfrac"
                | "newtagform"
                | "usetagform"
                | "eqref"
                | "refeq"
                | "noeqref"
                | "xrightarrow"
                | "xleftarrow"
                | "xleftrightarrow"
                | "xRightarrow"
                | "xLeftarrow"
                | "xLeftrightarrow"
                | "xlongequal"
                | "xmapsto"
                | "xhookleftarrow"
                | "xhookrightarrow"
                | "xleftharpoondown"
                | "xleftharpoonup"
                | "xleftrightharpoons"
                | "xrightharpoondown"
                | "xrightharpoonup"
                | "xrightleftharpoons"
                | "underbracket"
                | "overbracket"
                | "underbrace"
                | "overbrace"
                | "DeclarePairedDelimiter"
                | "begin"
                | "end"
                | "includegraphics"
                | "caption"
                | "label"
        ) {
            index = name_end;
            continue;
        }

        let command_start = index;
        let command_range = range_for_bytes(source, command_start, name_end);
        let mut cursor = skip_horizontal_whitespace(source, name_end);
        let mut optional_args = Vec::new();
        let mut required_args = Vec::new();

        loop {
            cursor = skip_horizontal_whitespace(source, cursor);
            if cursor >= bytes.len() {
                break;
            }
            match bytes[cursor] {
                b'[' => {
                    if let Some((arg, next)) = parse_balanced_group(source, cursor, b'[', b']') {
                        optional_args.push(arg);
                        cursor = next;
                    } else {
                        break;
                    }
                }
                b'{' => {
                    if let Some((arg, next)) = parse_balanced_group(source, cursor, b'{', b'}') {
                        required_args.push(arg);
                        cursor = next;
                    } else {
                        break;
                    }
                }
                _ => break,
            }
        }

        if !required_args.is_empty() {
            commands.push(ParsedCommand {
                name: name.to_string(),
                optional_args,
                required_args,
                range: range_for_bytes(source, command_start, cursor),
                command_range,
                raw: source[command_start..cursor].to_string(),
            });
        }

        index = cursor.max(name_end);
    }

    commands
}

fn is_escaped_backslash(source: &str, backslash_index: usize) -> bool {
    is_in_comment(source, backslash_index)
}

fn is_in_comment(source: &str, byte_index: usize) -> bool {
    let line_start = source[..byte_index].rfind('\n').map(|i| i + 1).unwrap_or(0);
    let mut index = line_start;
    while index < byte_index {
        let Some(ch) = source[index..].chars().next() else {
            return false;
        };
        if ch == '%' && !is_escaped_percent(source, index) {
            return true;
        }
        index += ch.len_utf8();
    }
    false
}

fn is_escaped_percent(source: &str, percent_index: usize) -> bool {
    is_escaped_ascii_marker(source, percent_index)
}

fn is_escaped_ascii_marker(source: &str, marker_index: usize) -> bool {
    let mut slash_count = 0;
    let mut index = marker_index;
    while index > 0 {
        let prev = source[..index].chars().next_back().unwrap();
        if prev != '\\' {
            break;
        }
        slash_count += 1;
        index -= prev.len_utf8();
    }
    slash_count % 2 == 1
}

fn skip_horizontal_whitespace(source: &str, mut index: usize) -> usize {
    while index < source.len() {
        let ch = source[index..].chars().next().unwrap();
        if ch == ' ' || ch == '\t' {
            index += ch.len_utf8();
        } else {
            break;
        }
    }
    index
}

fn parse_balanced_group(
    source: &str,
    start: usize,
    open: u8,
    close: u8,
) -> Option<(String, usize)> {
    let bytes = source.as_bytes();
    if bytes.get(start).copied() != Some(open) {
        return None;
    }

    let mut depth = 0usize;
    let mut index = start;
    while index < bytes.len() {
        let byte = bytes[index];
        if byte == b'\\' {
            index += 1;
            if index < bytes.len() {
                index += 1;
            }
            continue;
        }
        if byte == open {
            depth += 1;
        } else if byte == close {
            depth -= 1;
            if depth == 0 {
                return Some((source[start + 1..index].to_string(), index + 1));
            }
        }
        index += 1;
    }

    None
}

fn split_csv(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(ToString::to_string)
        .collect()
}

fn parse_pgfplots_compat(body: &str) -> Option<String> {
    body.split(',').find_map(|part| {
        let (key, value) = part.split_once('=')?;
        if key.trim() == "compat" {
            Some(value.trim().to_string())
        } else {
            None
        }
    })
}

fn normalize_package_id(package_id: &str) -> Result<String, String> {
    let package_id = package_id.trim();
    if package_id.is_empty() {
        return Err("Package id cannot be empty.".to_string());
    }
    if !package_id
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
    {
        return Err(format!("Invalid package id `{}`.", package_id));
    }
    Ok(package_id.to_string())
}

fn normalize_block_id(block_id: &str) -> Result<String, String> {
    let block_id = block_id.trim();
    if block_id.is_empty() {
        return Err("Generated block id cannot be empty.".to_string());
    }
    if !block_id
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'))
    {
        return Err(format!("Invalid generated block id `{}`.", block_id));
    }
    Ok(block_id.to_string())
}

fn format_generated_block(block_id: &str, code: &str) -> String {
    let code = code.trim_matches('\n');
    if code.trim().is_empty() {
        return String::new();
    }

    format!(
        "% --- DataTeX Package Studio: {block_id}:start ---\n{code}\n% --- DataTeX Package Studio: {block_id}:end ---\n"
    )
}

fn find_generated_block_range(source: &str, block_id: &str) -> Option<SourceRange> {
    find_managed_generated_block_range(source, block_id)
        .or_else(|| find_legacy_generated_block_range(source, block_id))
}

fn find_managed_generated_block_range(source: &str, block_id: &str) -> Option<SourceRange> {
    let start_marker = format!("% --- DataTeX Package Studio: {block_id}:start ---");
    let end_marker = format!("% --- DataTeX Package Studio: {block_id}:end ---");
    let start = source.find(&start_marker)?;
    let end_marker_start = source[start..]
        .find(&end_marker)
        .map(|offset| start + offset)?;
    let end_marker_end = end_marker_start + end_marker.len();
    let end = next_line_start(source, end_marker_end);
    Some(range_for_bytes(
        source,
        line_start_for_byte(source, start),
        end,
    ))
}

fn find_legacy_generated_block_range(source: &str, block_id: &str) -> Option<SourceRange> {
    if block_id != "code-highlighting" {
        return None;
    }

    let marker_start = source.find("% --- Code Highlighting (")?;
    let start = line_start_for_byte(source, marker_start);
    let after_marker = next_line_start(source, marker_start);
    let rest = &source[after_marker..];

    if let Some(offset) = rest.find("\\lstset{style=mystyle}") {
        let end = next_line_start(
            source,
            after_marker + offset + "\\lstset{style=mystyle}".len(),
        );
        return Some(range_for_bytes(source, start, end));
    }

    if let Some(offset) = rest.find("\\setminted{") {
        let command_start = after_marker + offset;
        if let Some(close_offset) = source[command_start..].find("\n}") {
            let end = next_line_start(source, command_start + close_offset + 2);
            return Some(range_for_bytes(source, start, end));
        }
    }

    None
}

fn format_options(options: &[String]) -> String {
    let options: Vec<String> = options
        .iter()
        .map(|option| option.trim())
        .filter(|option| !option.is_empty())
        .map(ToString::to_string)
        .collect();
    if options.is_empty() {
        String::new()
    } else {
        format!("[{}]", options.join(", "))
    }
}

fn format_updated_package_declaration(
    declaration: &PackageDeclaration,
    package_id: &str,
    options: &[String],
) -> String {
    let packages = declaration_packages(declaration);
    let mut lines = Vec::new();
    let mut untouched_group = Vec::new();

    for package in packages {
        if package.eq_ignore_ascii_case(package_id) {
            push_package_group_line(
                &mut lines,
                declaration.kind.clone(),
                &declaration.options,
                &untouched_group,
            );
            untouched_group.clear();
            lines.push(format_package_declaration(
                declaration.kind.clone(),
                options,
                &[package_id],
            ));
        } else {
            untouched_group.push(package);
        }
    }

    push_package_group_line(
        &mut lines,
        declaration.kind.clone(),
        &declaration.options,
        &untouched_group,
    );

    lines.join("\n")
}

fn format_removed_package_declaration(
    declaration: &PackageDeclaration,
    package_id: &str,
) -> String {
    let packages = declaration_packages(declaration)
        .into_iter()
        .filter(|package| !package.eq_ignore_ascii_case(package_id))
        .collect::<Vec<_>>();

    if packages.is_empty() {
        return String::new();
    }

    let package_refs = packages.iter().map(String::as_str).collect::<Vec<_>>();
    format_package_declaration(
        declaration.kind.clone(),
        &declaration.options,
        &package_refs,
    )
}

fn removable_declaration_range(source: &str, declaration: &PackageDeclaration) -> SourceRange {
    let line_start = line_start_for_byte(source, declaration.range.start.byte);
    let line_end = next_line_start(source, declaration.range.end.byte);
    let line = &source[line_start..line_end.min(source.len())];

    if line.trim() == declaration.raw.trim() {
        range_for_bytes(source, line_start, line_end)
    } else {
        declaration.range.clone()
    }
}

fn push_package_group_line(
    lines: &mut Vec<String>,
    kind: PackageDeclarationKind,
    options: &[String],
    packages: &[String],
) {
    if packages.is_empty() {
        return;
    }

    let package_refs = packages.iter().map(String::as_str).collect::<Vec<_>>();
    lines.push(format_package_declaration(kind, options, &package_refs));
}

fn format_package_declaration(
    kind: PackageDeclarationKind,
    options: &[String],
    packages: &[&str],
) -> String {
    let command = match kind {
        PackageDeclarationKind::RequirePackage => "\\RequirePackage",
        _ => "\\usepackage",
    };
    format!(
        "{}{}{{{}}}",
        command,
        format_options(options),
        packages.join(", ")
    )
}

fn declaration_packages(declaration: &PackageDeclaration) -> Vec<String> {
    let Some(required_start) = declaration.raw.rfind('{') else {
        return Vec::new();
    };
    let Some(required_end) = declaration.raw.rfind('}') else {
        return Vec::new();
    };
    if required_end <= required_start {
        return Vec::new();
    }

    split_csv(&declaration.raw[required_start + 1..required_end])
}

fn find_package_insertion_byte(source: &str, analysis: &LatexPackageAnalysis) -> usize {
    let last_package_end = analysis
        .declarations
        .iter()
        .filter(|decl| {
            matches!(
                decl.kind,
                PackageDeclarationKind::UsePackage | PackageDeclarationKind::RequirePackage
            )
        })
        .map(|decl| decl.range.end.byte)
        .max();

    if let Some(byte) = last_package_end {
        return next_line_start(source, byte);
    }

    if let Some(document_class) = &analysis.document_class {
        return next_line_start(source, document_class.range.end.byte);
    }

    0
}

fn next_line_start(source: &str, byte: usize) -> usize {
    if byte >= source.len() {
        return source.len();
    }
    source[byte..]
        .find('\n')
        .map(|offset| byte + offset + 1)
        .unwrap_or(byte)
}

fn line_start_for_byte(source: &str, byte: usize) -> usize {
    source[..byte.min(source.len())]
        .rfind('\n')
        .map(|index| index + 1)
        .unwrap_or(0)
}

fn empty_range_at(source: &str, byte: usize) -> SourceRange {
    let position = position_for_byte(source, byte);
    SourceRange {
        start: position.clone(),
        end: position,
    }
}

fn range_for_bytes(source: &str, start: usize, end: usize) -> SourceRange {
    SourceRange {
        start: position_for_byte(source, start),
        end: position_for_byte(source, end),
    }
}

fn position_for_byte(source: &str, target_byte: usize) -> SourcePosition {
    let mut line = 1usize;
    let mut column = 1usize;
    let mut byte = 0usize;

    for ch in source.chars() {
        if byte >= target_byte {
            break;
        }
        if ch == '\n' {
            line += 1;
            column = 1;
        } else {
            // Monaco positions use UTF-16 code units rather than Unicode scalar
            // values. Non-BMP characters (for example emoji) therefore advance
            // the editor column by two.
            column += ch.len_utf16();
        }
        byte += ch.len_utf8();
    }

    SourcePosition {
        byte: target_byte.min(source.len()),
        line,
        column,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn graphics_document_request(
        baseline_source: &str,
        replacement_source: &str,
    ) -> GraphicsDocumentEditRequest {
        GraphicsDocumentEditRequest {
            schema_version: 1,
            revision: 42,
            document_id: "editor-tab-1".to_string(),
            target_file_path: "/tmp/geometry-demo.tex".to_string(),
            baseline_source: baseline_source.to_string(),
            replacement_source: replacement_source.to_string(),
            baseline_sha256: graphics_document_source_sha256(baseline_source),
        }
    }

    fn graphics_tikzpicture_request(
        baseline_source: &str,
        replacement_source: &str,
        target: GraphicsTikzpictureTarget,
    ) -> GraphicsTikzpictureEditRequest {
        GraphicsTikzpictureEditRequest {
            schema_version: 1,
            revision: 43,
            document_id: "editor-tab-tikz".to_string(),
            target_file_path: "/tmp/multiple-figures.tex".to_string(),
            baseline_source: baseline_source.to_string(),
            replacement_source: replacement_source.to_string(),
            baseline_sha256: graphics_document_source_sha256(baseline_source),
            target,
        }
    }

    fn graphics_tikzpicture_discovery_request(
        baseline_source: &str,
        replacement_source: &str,
    ) -> GraphicsTikzpictureDiscoveryRequest {
        GraphicsTikzpictureDiscoveryRequest {
            schema_version: 1,
            revision: 44,
            document_id: "editor-tab-tikz".to_string(),
            target_file_path: "/tmp/multiple-figures.tex".to_string(),
            baseline_source: baseline_source.to_string(),
            replacement_source: replacement_source.to_string(),
            baseline_sha256: graphics_document_source_sha256(baseline_source),
        }
    }

    fn graphics_tikzpicture_focus_request(
        baseline_source: &str,
        target: GraphicsTikzpictureTarget,
    ) -> GraphicsTikzpictureFocusRequest {
        GraphicsTikzpictureFocusRequest {
            schema_version: 1,
            revision: 45,
            document_id: "editor-tab-tikz".to_string(),
            target_file_path: "/tmp/multiple-figures.tex".to_string(),
            baseline_source: baseline_source.to_string(),
            baseline_sha256: graphics_document_source_sha256(baseline_source),
            target,
        }
    }

    fn graphics_drawing_insert_request(
        baseline_source: &str,
        drawing_source: &str,
        target: GraphicsDrawingInsertionTarget,
    ) -> GraphicsDrawingInsertRequest {
        GraphicsDrawingInsertRequest {
            schema_version: 1,
            revision: 46,
            document_id: "editor-tab-new-drawing".to_string(),
            target_file_path: "/tmp/new-drawing.tex".to_string(),
            baseline_source: baseline_source.to_string(),
            drawing_source: drawing_source.to_string(),
            baseline_sha256: graphics_document_source_sha256(baseline_source),
            target,
            wrapper: GraphicsDrawingWrapper::Inline,
            required_packages: Vec::new(),
            required_tikz_libraries: Vec::new(),
        }
    }

    fn apply_graphics_drawing_plan(source: &str, plan: &PackageEditPlan) -> String {
        apply_plan_to_source(source, &plan.edits).expect("apply graphics drawing plan")
    }

    #[test]
    fn graphics_document_sha256_matches_known_utf8_digest() {
        assert_eq!(
            graphics_document_source_sha256("abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn graphics_document_plan_replaces_the_complete_unicode_source() {
        let baseline = "α😀";
        let replacement = "\\begin{tikzpicture}\n  \\node {νέο 😀};\n\\end{tikzpicture}\n";
        let plan = plan_graphics_document_edit(graphics_document_request(baseline, replacement))
            .expect("full-document plan");

        assert_eq!(plan.schema_version, 1);
        assert_eq!(plan.revision, 42);
        assert_eq!(plan.edits.len(), 1);
        assert_eq!(plan.edits[0].range.start.byte, 0);
        assert_eq!(plan.edits[0].range.start.line, 1);
        assert_eq!(plan.edits[0].range.start.column, 1);
        assert_eq!(plan.edits[0].range.end.byte, baseline.len());
        assert_eq!(plan.edits[0].range.end.line, 1);
        assert_eq!(
            plan.edits[0].range.end.column, 4,
            "Monaco columns must count the emoji as two UTF-16 code units"
        );
        assert_eq!(plan.edits[0].replacement, replacement);
        assert_eq!(
            apply_plan_to_source(baseline, &plan.edits).expect("apply plan"),
            replacement
        );
    }

    #[test]
    fn graphics_document_plan_inserts_into_an_empty_source() {
        let replacement = "\\documentclass{article}\n";
        let plan = plan_graphics_document_edit(graphics_document_request("", replacement))
            .expect("empty-document plan");

        assert_eq!(plan.edits.len(), 1);
        assert_eq!(
            plan.edits[0].range,
            SourceRange {
                start: SourcePosition {
                    byte: 0,
                    line: 1,
                    column: 1,
                },
                end: SourcePosition {
                    byte: 0,
                    line: 1,
                    column: 1,
                },
            }
        );
        assert_eq!(plan.edits[0].replacement, replacement);
    }

    #[test]
    fn graphics_document_plan_is_a_diagnostic_noop_when_unchanged() {
        let source = "\\documentclass{article}\n";
        let plan = plan_graphics_document_edit(graphics_document_request(source, source))
            .expect("no-op plan");

        assert!(plan.edits.is_empty());
        assert_eq!(plan.diagnostics.len(), 1);
        assert_eq!(plan.diagnostics[0].code, "graphics-document-unchanged");
        assert_eq!(
            plan.diagnostics[0].severity,
            PackageDiagnosticSeverity::Info
        );
    }

    #[test]
    fn graphics_document_plan_rejects_a_stale_baseline_fingerprint() {
        let mut request = graphics_document_request("old source", "new source");
        request.baseline_sha256 = graphics_document_source_sha256("different source");

        let error = plan_graphics_document_edit(request).expect_err("stale request");
        assert!(error.contains("stale"));
        assert!(error.contains("fingerprint mismatch"));
    }

    #[test]
    fn graphics_document_plan_rejects_a_malformed_fingerprint() {
        let mut request = graphics_document_request("old source", "new source");
        request.baseline_sha256 = "not-a-sha256".to_string();

        let error = plan_graphics_document_edit(request).expect_err("invalid fingerprint");
        assert!(error.contains("64 hexadecimal characters"));
    }

    #[test]
    fn graphics_document_plan_accepts_prefixed_uppercase_sha256() {
        let mut request = graphics_document_request("old source", "new source");
        request.baseline_sha256 =
            format!("sha256:{}", request.baseline_sha256.to_ascii_uppercase());

        let plan = plan_graphics_document_edit(request).expect("valid prefixed fingerprint");
        assert_eq!(plan.edits.len(), 1);
    }

    #[test]
    fn graphics_document_plan_rejects_an_unsupported_schema() {
        let mut request = graphics_document_request("old source", "new source");
        request.schema_version = 2;

        let error = plan_graphics_document_edit(request).expect_err("unsupported schema");
        assert!(error.contains("Unsupported"));
        assert!(error.contains("expected `1`"));
    }

    #[test]
    fn graphics_document_plan_rejects_missing_document_identity_or_path() {
        let mut missing_identity = graphics_document_request("old source", "new source");
        missing_identity.document_id = "  ".to_string();
        let error =
            plan_graphics_document_edit(missing_identity).expect_err("missing document identity");
        assert!(error.contains("identity cannot be empty"));

        let mut missing_path = graphics_document_request("old source", "new source");
        missing_path.target_file_path = String::new();
        let error = plan_graphics_document_edit(missing_path).expect_err("missing target path");
        assert!(error.contains("target file path cannot be empty"));
    }

    #[test]
    fn tikzpicture_discovery_ignores_comments_and_escaped_commands() {
        let baseline = concat!(
            "% \\begin{tikzpicture}\\node {comment};\\end{tikzpicture}\n",
            "\\\\begin{tikzpicture}\\node {escaped};\\\\end{tikzpicture}\n",
            "\\begin{tikzpicture}[scale={1 + {2}}]\n",
            "  \\node {first}; % \\end{tikzpicture}\n",
            "\\end{tikzpicture}\n",
            "\\begin {tikzpicture}[baseline={(current bounding box.center)}]\n",
            "  \\node {second};\n",
            "\\end {tikzpicture}\n",
        );
        let replacement = baseline.replacen("\\node {second}", "\\node {updated}", 1);
        let discovery = discover_graphics_tikzpicture_targets(
            graphics_tikzpicture_discovery_request(baseline, &replacement),
        )
        .expect("discover active tikzpictures");

        assert_eq!(discovery.targets.len(), 2);
        assert!(discovery.structurally_compatible);
        assert!(!discovery.outside_changes);
        assert!(!discovery.targets[0].changed);
        assert!(discovery.targets[1].changed);
        assert_eq!(discovery.targets[0].ordinal, 0);
        assert!(discovery.targets[0].label.contains("lines"));
        assert_eq!(
            discovery.targets[0].preview,
            "\\node {first}; % \\end{tikzpicture}"
        );
        assert_eq!(discovery.targets[1].preview, "\\node {second};");
        assert_eq!(discovery.targets[0].source_sha256.len(), 64);

        let first = &discovery.targets[0].baseline_range;
        assert!(baseline[first.start.byte..first.end.byte].starts_with("\\begin{tikzpicture}"));
        let second_replacement = discovery.targets[1]
            .replacement_range
            .as_ref()
            .expect("replacement mapping");
        assert!(
            replacement[second_replacement.start.byte..second_replacement.end.byte]
                .contains("\\node {updated}")
        );
    }

    #[test]
    fn tikzpicture_focus_keeps_the_document_shell_and_only_the_selected_environment() {
        let baseline = concat!(
            "\\documentclass{article}\n",
            "\\begin{document}\n",
            "before\n",
            "\\begin{tikzpicture}\n\\node {first};\n\\end{tikzpicture}\n",
            "between\n",
            "\\begin{tikzpicture}[x=2cm]\n\\node {second};\n\\end{tikzpicture}\n",
            "after\n",
            "\\end{document}\n",
        );
        let baseline_ranges = find_tikzpicture_byte_ranges(baseline).expect("baseline ranges");
        let focus = prepare_graphics_tikzpicture(graphics_tikzpicture_focus_request(
            baseline,
            GraphicsTikzpictureTarget::Ordinal { ordinal: 1 },
        ))
        .expect("prepare focused source");

        assert!(focus.working_source.contains("\\documentclass{article}"));
        assert!(focus.working_source.contains("\\begin{document}"));
        assert!(focus.working_source.contains("before"));
        assert!(focus.working_source.contains("between"));
        assert!(focus.working_source.contains("after"));
        assert!(!focus.working_source.contains("\\node {first};"));
        assert!(focus.working_source.contains("\\node {second};"));
        assert_eq!(
            find_tikzpicture_byte_ranges(&focus.working_source)
                .expect("focused ranges")
                .len(),
            1
        );
        assert_eq!(focus.target.ordinal, 1);
        assert_eq!(
            focus.target.baseline_range.start.byte,
            baseline_ranges[1].start
        );
        let focused_range = focus
            .target
            .replacement_range
            .as_ref()
            .expect("focused target range");
        assert_eq!(
            &focus.working_source[focused_range.start.byte..focused_range.end.byte],
            &baseline[baseline_ranges[1].start..baseline_ranges[1].end]
        );
        assert_eq!(
            focus.working_sha256,
            graphics_document_source_sha256(&focus.working_source)
        );
    }

    #[test]
    fn tikzpicture_plan_maps_a_focused_edit_back_to_only_the_selected_full_document_range() {
        let baseline = concat!(
            "\\documentclass{article}\n\\begin{document}\n",
            "\\begin{tikzpicture}\n\\node {first};\n\\end{tikzpicture}\n",
            "interstitial text 😀\n",
            "\\begin{tikzpicture}\n\\node {second};\n\\end{tikzpicture}\n",
            "\\end{document}\n",
        );
        let baseline_ranges = find_tikzpicture_byte_ranges(baseline).expect("baseline ranges");
        let focus = prepare_graphics_tikzpicture(graphics_tikzpicture_focus_request(
            baseline,
            GraphicsTikzpictureTarget::Ordinal { ordinal: 1 },
        ))
        .expect("focus second picture");
        let replacement = focus
            .working_source
            .replace("\\node {second};", "\\node {δεύτερο 😀};");
        let plan = plan_graphics_tikzpicture_edit(graphics_tikzpicture_request(
            baseline,
            &replacement,
            GraphicsTikzpictureTarget::Ordinal { ordinal: 1 },
        ))
        .expect("focused environment plan");

        assert_eq!(plan.revision, 43);
        assert_eq!(plan.edits.len(), 1);
        assert_eq!(plan.edits[0].range.start.byte, baseline_ranges[1].start);
        assert_eq!(plan.edits[0].range.end.byte, baseline_ranges[1].end);
        assert!(plan.edits[0].replacement.contains("δεύτερο 😀"));
        assert!(!plan.edits[0].replacement.contains("first"));

        let applied = apply_plan_to_source(baseline, &plan.edits).expect("apply selected edit");
        assert_eq!(
            applied,
            concat!(
                "\\documentclass{article}\n\\begin{document}\n",
                "\\begin{tikzpicture}\n\\node {first};\n\\end{tikzpicture}\n",
                "interstitial text 😀\n",
                "\\begin{tikzpicture}\n\\node {δεύτερο 😀};\n\\end{tikzpicture}\n",
                "\\end{document}\n",
            ),
            "focused edits must preserve every byte outside the selected picture"
        );
        assert!(applied.contains("\\node {first};"));
        assert!(applied.contains("interstitial text 😀"));
        assert!(applied.contains("\\node {δεύτερο 😀};"));
        assert_eq!(
            &applied[..baseline_ranges[1].start],
            &baseline[..baseline_ranges[1].start]
        );
        let replacement_end = baseline_ranges[1].start + plan.edits[0].replacement.len();
        assert_eq!(
            &applied[replacement_end..],
            &baseline[baseline_ranges[1].end..]
        );
    }

    #[test]
    fn tikzpicture_plan_accepts_full_source_when_only_the_selected_environment_changed() {
        let baseline = concat!(
            "head\n",
            "\\begin{tikzpicture}\\node {one};\\end{tikzpicture}\n",
            "middle\n",
            "\\begin{tikzpicture}\\node {two};\\end{tikzpicture}\n",
            "tail\n",
        );
        let replacement = baseline.replace("\\node {one};", "\\node {updated};");
        let plan = plan_graphics_tikzpicture_edit(graphics_tikzpicture_request(
            baseline,
            &replacement,
            GraphicsTikzpictureTarget::Ordinal { ordinal: 0 },
        ))
        .expect("full-source selected edit");

        assert_eq!(plan.edits.len(), 1);
        assert_eq!(
            apply_plan_to_source(baseline, &plan.edits).expect("apply plan"),
            replacement
        );
    }

    #[test]
    fn tikzpicture_plan_rejects_outside_edits_in_full_and_focused_sources() {
        let baseline = concat!(
            "head\n",
            "\\begin{tikzpicture}\\node {one};\\end{tikzpicture}\n",
            "middle\n",
            "\\begin{tikzpicture}\\node {two};\\end{tikzpicture}\n",
            "tail\n",
        );
        let full_replacement = baseline
            .replace("head", "changed head")
            .replace("\\node {two};", "\\node {updated};");
        let full_error = plan_graphics_tikzpicture_edit(graphics_tikzpicture_request(
            baseline,
            &full_replacement,
            GraphicsTikzpictureTarget::Ordinal { ordinal: 1 },
        ))
        .expect_err("outside full-source change must be rejected");
        assert!(full_error.contains("outside the chosen tikzpicture"));

        let focus = prepare_graphics_tikzpicture(graphics_tikzpicture_focus_request(
            baseline,
            GraphicsTikzpictureTarget::Ordinal { ordinal: 1 },
        ))
        .expect("focus target");
        let focused_replacement = focus
            .working_source
            .replace("tail", "changed tail")
            .replace("\\node {two};", "\\node {updated};");
        let focused_error = plan_graphics_tikzpicture_edit(graphics_tikzpicture_request(
            baseline,
            &focused_replacement,
            GraphicsTikzpictureTarget::Ordinal { ordinal: 1 },
        ))
        .expect_err("outside focused-source change must be rejected");
        assert!(focused_error.contains("outside the chosen tikzpicture"));
    }

    #[test]
    fn tikzpicture_cursor_selection_uses_half_open_ranges_and_utf8_boundaries() {
        let baseline = concat!(
            "\\begin{tikzpicture}\\node {😀};\\end{tikzpicture}",
            "\\begin{tikzpicture}\\node {two};\\end{tikzpicture}",
        );
        let ranges = find_tikzpicture_byte_ranges(baseline).expect("ranges");
        assert_eq!(ranges[0].end, ranges[1].start);

        let (ordinal, _) = select_tikzpicture_target(
            baseline,
            &ranges,
            &GraphicsTikzpictureTarget::Cursor {
                byte: ranges[1].start,
            },
        )
        .expect("shared boundary belongs to second half-open range");
        assert_eq!(ordinal, 1);

        let after_last = select_tikzpicture_target(
            baseline,
            &ranges,
            &GraphicsTikzpictureTarget::Cursor {
                byte: ranges[1].end,
            },
        )
        .expect_err("exclusive end is outside");
        assert!(after_last.contains("outside every"));

        let emoji_byte = baseline.find('😀').expect("emoji");
        let invalid_utf8 = select_tikzpicture_target(
            baseline,
            &ranges,
            &GraphicsTikzpictureTarget::Cursor {
                byte: emoji_byte + 1,
            },
        )
        .expect_err("middle of emoji is not a UTF-8 boundary");
        assert!(invalid_utf8.contains("UTF-8 boundary"));
    }

    #[test]
    fn tikzpicture_target_json_contract_is_tagged_and_camel_case() {
        let value = serde_json::to_value(GraphicsTikzpictureTarget::Range {
            start_byte: 12,
            end_byte: 48,
        })
        .expect("serialize target");
        assert_eq!(value["kind"], "range");
        assert_eq!(value["startByte"], 12);
        assert_eq!(value["endByte"], 48);
        assert!(value.get("start_byte").is_none());

        let target: GraphicsTikzpictureTarget =
            serde_json::from_value(serde_json::json!({"kind": "cursor", "byte": 7}))
                .expect("deserialize target");
        assert_eq!(target, GraphicsTikzpictureTarget::Cursor { byte: 7 });
    }

    #[test]
    fn tikzpicture_exact_range_and_ordinal_selectors_reject_inexact_or_missing_targets() {
        let baseline = "\\begin{tikzpicture}\\draw (0,0);\\end{tikzpicture}\n";
        let ranges = find_tikzpicture_byte_ranges(baseline).expect("range");
        let (_, selected) = select_tikzpicture_target(
            baseline,
            &ranges,
            &GraphicsTikzpictureTarget::Range {
                start_byte: ranges[0].start,
                end_byte: ranges[0].end,
            },
        )
        .expect("exact range");
        assert_eq!(selected, ranges[0]);

        let inexact = select_tikzpicture_target(
            baseline,
            &ranges,
            &GraphicsTikzpictureTarget::Range {
                start_byte: ranges[0].start + 1,
                end_byte: ranges[0].end,
            },
        )
        .expect_err("inexact target");
        assert!(inexact.contains("exactly match"));

        let missing = select_tikzpicture_target(
            baseline,
            &ranges,
            &GraphicsTikzpictureTarget::Ordinal { ordinal: 9 },
        )
        .expect_err("missing ordinal");
        assert!(missing.contains("out of range"));
        assert!(missing.contains("1 environment"));
    }

    #[test]
    fn tikzpicture_plan_emits_monaco_utf16_positions_for_unicode_prefixes() {
        let baseline = "😀 α \\begin{tikzpicture}\n\\node {old};\n\\end{tikzpicture}\n";
        let replacement = baseline.replace("{old}", "{νέο 😀}");
        let plan = plan_graphics_tikzpicture_edit(graphics_tikzpicture_request(
            baseline,
            &replacement,
            GraphicsTikzpictureTarget::Ordinal { ordinal: 0 },
        ))
        .expect("unicode plan");
        let range = &plan.edits[0].range;

        assert_eq!(range.start.byte, baseline.find("\\begin").unwrap());
        assert_eq!(range.start.line, 1);
        assert_eq!(
            range.start.column, 6,
            "emoji counts as two UTF-16 code units"
        );
        assert_eq!(
            apply_plan_to_source(baseline, &plan.edits).expect("unicode apply"),
            replacement
        );
    }

    #[test]
    fn tikzpicture_scanner_rejects_missing_unmatched_nested_and_unterminated_structures() {
        let missing_end = "\\begin{tikzpicture}\n\\draw (0,0);\n";
        assert!(find_tikzpicture_byte_ranges(missing_end)
            .expect_err("missing end")
            .contains("no matching end"));

        let unmatched_end = "\\end{tikzpicture}\n";
        assert!(find_tikzpicture_byte_ranges(unmatched_end)
            .expect_err("unmatched end")
            .contains("unmatched"));

        let nested = concat!(
            "\\begin{tikzpicture}\n",
            "\\begin{tikzpicture}\\end{tikzpicture}\n",
            "\\end{tikzpicture}\n",
        );
        assert!(find_tikzpicture_byte_ranges(nested)
            .expect_err("nested target")
            .contains("ambiguous"));

        let unterminated_name = "\\begin{tikzpicture";
        assert!(find_tikzpicture_byte_ranges(unterminated_name)
            .expect_err("unterminated name")
            .contains("unterminated"));
    }

    #[test]
    fn tikzpicture_plan_rejects_missing_or_structurally_changed_replacements() {
        let baseline = concat!(
            "\\begin{tikzpicture}\\node {one};\\end{tikzpicture}\n",
            "\\begin{tikzpicture}\\node {two};\\end{tikzpicture}\n",
        );
        let no_target = plan_graphics_tikzpicture_edit(graphics_tikzpicture_request(
            "plain document",
            "plain document",
            GraphicsTikzpictureTarget::Ordinal { ordinal: 0 },
        ))
        .expect_err("missing target");
        assert!(no_target.contains("no real tikzpicture"));

        let replacement_without_tikz = "plain focused source\n";
        let removed = plan_graphics_tikzpicture_edit(graphics_tikzpicture_request(
            baseline,
            replacement_without_tikz,
            GraphicsTikzpictureTarget::Ordinal { ordinal: 0 },
        ))
        .expect_err("removed target");
        assert!(removed.contains("focused replacement requires exactly 1"));

        let replacement_with_three =
            format!("{baseline}\\begin{{tikzpicture}}\\node {{three}};\\end{{tikzpicture}}\n");
        let added = plan_graphics_tikzpicture_edit(graphics_tikzpicture_request(
            baseline,
            &replacement_with_three,
            GraphicsTikzpictureTarget::Ordinal { ordinal: 0 },
        ))
        .expect_err("added target");
        assert!(added.contains("full replacement requires 2"));
    }

    #[test]
    fn tikzpicture_plan_rejects_stale_schema_identity_and_path_inputs() {
        let baseline = "\\begin{tikzpicture}\\node {old};\\end{tikzpicture}";
        let replacement = baseline.replace("old", "new");
        let target = GraphicsTikzpictureTarget::Ordinal { ordinal: 0 };

        let mut stale = graphics_tikzpicture_request(baseline, &replacement, target.clone());
        stale.baseline_sha256 = graphics_document_source_sha256("other");
        assert!(plan_graphics_tikzpicture_edit(stale)
            .expect_err("stale")
            .contains("stale"));

        let mut schema = graphics_tikzpicture_request(baseline, &replacement, target.clone());
        schema.schema_version = 99;
        assert!(plan_graphics_tikzpicture_edit(schema)
            .expect_err("schema")
            .contains("expected `1`"));

        let mut identity = graphics_tikzpicture_request(baseline, &replacement, target.clone());
        identity.document_id.clear();
        assert!(plan_graphics_tikzpicture_edit(identity)
            .expect_err("identity")
            .contains("identity cannot be empty"));

        let mut path = graphics_tikzpicture_request(baseline, &replacement, target);
        path.target_file_path = " ".to_string();
        assert!(plan_graphics_tikzpicture_edit(path)
            .expect_err("path")
            .contains("target file path cannot be empty"));
    }

    #[test]
    fn tikzpicture_plan_returns_a_diagnostic_noop_for_an_unchanged_target() {
        let baseline = "\\begin{tikzpicture}\\node {same};\\end{tikzpicture}";
        let plan = plan_graphics_tikzpicture_edit(graphics_tikzpicture_request(
            baseline,
            baseline,
            GraphicsTikzpictureTarget::Cursor { byte: 1 },
        ))
        .expect("no-op");

        assert!(plan.edits.is_empty());
        assert_eq!(plan.diagnostics.len(), 1);
        assert_eq!(plan.diagnostics[0].code, "graphics-tikzpicture-unchanged");
        assert!(plan.diagnostics[0].range.is_some());
    }

    #[test]
    fn tikzpicture_discovery_reports_structural_and_outside_changes() {
        let baseline = concat!(
            "head\n",
            "\\begin{tikzpicture}\\node {one};\\end{tikzpicture}\n",
            "middle\n",
            "\\begin{tikzpicture}\\node {two};\\end{tikzpicture}\n",
            "tail\n",
        );
        let one_environment = "\\begin{tikzpicture}\\node {only};\\end{tikzpicture}\n";
        let incompatible = discover_graphics_tikzpicture_targets(
            graphics_tikzpicture_discovery_request(baseline, one_environment),
        )
        .expect("incompatible discovery result");
        assert!(!incompatible.structurally_compatible);
        assert!(incompatible.outside_changes);
        assert!(incompatible.structural_error.is_some());
        assert_eq!(incompatible.targets.len(), 2);
        assert!(incompatible
            .targets
            .iter()
            .all(|target| target.replacement_range.is_none()));

        let changed_shell = baseline.replace("middle", "changed middle");
        let outside = discover_graphics_tikzpicture_targets(
            graphics_tikzpicture_discovery_request(baseline, &changed_shell),
        )
        .expect("outside discovery");
        assert!(outside.structurally_compatible);
        assert!(outside.outside_changes);
    }

    #[test]
    fn graphics_new_drawing_template_is_deterministic_compile_ready_and_empty() {
        let request = GraphicsNewDrawingTemplateRequest {
            schema_version: 1,
            revision: 47,
        };
        let first = prepare_graphics_new_drawing(request.clone()).expect("new drawing template");
        let second = prepare_graphics_new_drawing(request).expect("same template");

        assert_eq!(first, second);
        assert_eq!(first.revision, 47);
        assert_eq!(
            first.source,
            concat!(
                "\\documentclass{article}\n",
                "\\usepackage{tikz}\n",
                "\\usepackage{tkz-euclide}\n",
                "\\pagestyle{empty}\n",
                "\\begin{document}\n",
                "\\begin{tikzpicture}\n",
                "\\end{tikzpicture}\n",
                "\\end{document}\n",
            ),
            "the scratch-document template is a byte-exact host contract"
        );
        assert_eq!(
            first.source_sha256,
            graphics_document_source_sha256(&first.source)
        );
        assert!(first.source.contains("\\documentclass{article}"));
        assert!(first.source.contains("\\usepackage{tikz}"));
        assert!(first.source.contains("\\usepackage{tkz-euclide}"));
        assert_eq!(
            find_tikzpicture_byte_ranges(&first.source)
                .expect("template tikzpicture")
                .len(),
            1
        );
        let range = find_tikzpicture_byte_ranges(&first.source).unwrap()[0];
        assert!(latex_layout_and_comments_only(
            &first.source[range.start + "\\begin{tikzpicture}".len()
                ..range.end - "\\end{tikzpicture}".len()]
        ));
        assert!(find_latex_document_byte_range(&first.source)
            .expect("template document")
            .is_some());

        let error = prepare_graphics_new_drawing(GraphicsNewDrawingTemplateRequest {
            schema_version: 2,
            revision: 47,
        })
        .expect_err("unsupported template schema");
        assert!(error.contains("expected `1`"));
    }

    #[test]
    fn graphics_drawing_insert_extracts_one_environment_and_adds_only_missing_dependencies() {
        let baseline = concat!(
            "\\documentclass{article}\n",
            "\\usepackage{tikz}\n",
            "\\usetikzlibrary{calc}\n",
            "\\begin{document}\n",
            "Existing text.\n",
            "\\end{document}\n",
        );
        let drawing = concat!(
            "\\documentclass{standalone}\n",
            "\\usepackage{tikz, amsmath}\n",
            "\\usepackage[dvipsnames]{xcolor}\n",
            "\\usepackage{tkz-euclide}\n",
            "\\usetikzlibrary{calc, intersections}\n",
            "\\begin{document}\n",
            "\\begin{tikzpicture}\n",
            "  \\tkzDefPoint(0,0){A}\n",
            "\\end{tikzpicture}\n",
            "\\end{document}\n",
        );
        let plan = plan_graphics_drawing_insert(graphics_drawing_insert_request(
            baseline,
            drawing,
            GraphicsDrawingInsertionTarget::BeforeEndDocument,
        ))
        .expect("new drawing insert plan");

        assert_eq!(plan.revision, 46);
        assert_eq!(plan.edits.len(), 2, "one preamble edit and one body edit");
        assert!(
            plan.edits[0].range.end.byte <= plan.edits[1].range.start.byte,
            "plan edits must not overlap"
        );
        let next = apply_graphics_drawing_plan(baseline, &plan);
        assert_eq!(next.matches("\\begin{tikzpicture}").count(), 1);
        assert_eq!(next.matches("\\usepackage{tikz}").count(), 1);
        assert_eq!(next.matches("\\usetikzlibrary{calc}").count(), 1);
        assert!(next.contains("\\usepackage{tkz-euclide}"));
        assert!(next.contains("\\usepackage{amsmath}"));
        assert!(next.contains("\\usepackage[dvipsnames]{xcolor}"));
        assert!(next.contains("\\usetikzlibrary{intersections}"));
        assert!(!next.contains("\\documentclass{standalone}"));
        assert!(!next.contains("\\end{document}\n\\end{document}"));
        assert!(next.find("\\begin{tikzpicture}").unwrap() < next.find("\\end{document}").unwrap());
    }

    #[test]
    fn graphics_drawing_cursor_insert_preserves_unicode_positions_and_line_indentation() {
        let baseline = concat!(
            "\\documentclass{article}\n",
            "\\usepackage{tikz}\n",
            "\\usepackage{tkz-euclide}\n",
            "\\begin{document}\n",
            "😀 εισαγωγή: PLACEHOLDER\n",
            "\\end{document}\n",
        );
        let cursor = baseline.find("PLACEHOLDER").unwrap();
        let drawing = "\\begin{tikzpicture}\n  \\node {νέο 😀};\n\\end{tikzpicture}";
        let plan = plan_graphics_drawing_insert(graphics_drawing_insert_request(
            baseline,
            drawing,
            GraphicsDrawingInsertionTarget::Cursor { byte: cursor },
        ))
        .expect("cursor insertion");

        assert_eq!(plan.edits.len(), 1, "dependencies already exist");
        assert_eq!(plan.edits[0].range.start.byte, cursor);
        assert_eq!(plan.edits[0].range.start.line, 5);
        assert_eq!(
            plan.edits[0].range.start.column,
            baseline[line_start_for_byte(baseline, cursor)..cursor]
                .encode_utf16()
                .count()
                + 1
        );
        let next = apply_graphics_drawing_plan(baseline, &plan);
        assert!(next.contains("😀 εισαγωγή: \n\\begin{tikzpicture}"));
        assert!(next.contains("\\end{tikzpicture}\nPLACEHOLDER"));
    }

    #[test]
    fn graphics_drawing_selection_can_be_replaced_by_a_configured_figure() {
        let baseline = concat!(
            "\\documentclass{article}\n",
            "\\usepackage{tikz}\n",
            "\\usepackage{tkz-euclide}\n",
            "\\begin{document}\n",
            "  OLD DRAWING\n",
            "\\end{document}\n",
        );
        let start = baseline.find("OLD DRAWING").unwrap();
        let end = start + "OLD DRAWING".len();
        let mut request = graphics_drawing_insert_request(
            baseline,
            "\\begin{tikzpicture}\n\\draw (0,0) -- (1,1);\n\\end{tikzpicture}",
            GraphicsDrawingInsertionTarget::Selection {
                start_byte: start,
                end_byte: end,
            },
        );
        request.wrapper = GraphicsDrawingWrapper::Figure {
            placement: Some("[htbp!]".to_string()),
            centering: true,
            caption: Some("Σχήμα με {TikZ}".to_string()),
            label: Some("fig:tikz-1".to_string()),
        };
        let plan = plan_graphics_drawing_insert(request).expect("figure insertion");
        let next = apply_graphics_drawing_plan(baseline, &plan);

        assert!(!next.contains("OLD DRAWING"));
        assert!(next.contains("  \\begin{figure}[htbp!]"));
        assert!(next.contains("    \\centering"));
        assert!(next.contains("    \\begin{tikzpicture}"));
        assert!(next.contains("    \\caption{Σχήμα με {TikZ}}"));
        assert!(next.contains("    \\label{fig:tikz-1}"));
        assert!(next.contains("  \\end{figure}"));
    }

    #[test]
    fn graphics_drawing_insert_matches_byte_exact_crlf_dependency_figure_golden() {
        let baseline =
            "\\documentclass{article}\r\n\\begin{document}\r\nBody\r\n\\end{document}\r\n";
        let drawing = concat!(
            "\\documentclass{standalone}\n",
            "\\usepackage{tikz}\n",
            "\\usepackage[dvipsnames]{xcolor}\n",
            "\\usepackage{tkz-euclide}\n",
            "\\usetikzlibrary{calc}\n",
            "\\begin{document}\n",
            "\\begin{tikzpicture}\n",
            "  \\node {νέο 😀};\n",
            "\\end{tikzpicture}\n",
            "\\end{document}\n",
        );
        let mut request = graphics_drawing_insert_request(
            baseline,
            drawing,
            GraphicsDrawingInsertionTarget::BeforeEndDocument,
        );
        request.wrapper = GraphicsDrawingWrapper::Figure {
            placement: Some("[htbp!]".to_string()),
            centering: true,
            caption: Some("Σχήμα με {Unicode}".to_string()),
            label: Some("fig:unicode".to_string()),
        };
        request.required_packages = vec!["amsmath".to_string()];
        request.required_tikz_libraries = vec!["arrows.meta".to_string()];
        let next = apply_graphics_drawing_plan(
            baseline,
            &plan_graphics_drawing_insert(request).expect("CRLF plan"),
        );

        assert_eq!(
            next,
            concat!(
                "\\documentclass{article}\r\n",
                "\\usepackage{tikz}\r\n",
                "\\usepackage{tkz-euclide}\r\n",
                "\\usepackage[dvipsnames]{xcolor}\r\n",
                "\\usepackage{amsmath}\r\n",
                "\\usetikzlibrary{calc, arrows.meta}\r\n",
                "\\begin{document}\r\n",
                "Body\r\n",
                "\\begin{figure}[htbp!]\r\n",
                "  \\centering\r\n",
                "  \\begin{tikzpicture}\r\n",
                "    \\node {νέο 😀};\r\n",
                "  \\end{tikzpicture}\r\n",
                "  \\caption{Σχήμα με {Unicode}}\r\n",
                "  \\label{fig:unicode}\r\n",
                "\\end{figure}\r\n",
                "\\end{document}\r\n",
            ),
        );
        assert!(
            !next.replace("\r\n", "").contains('\n'),
            "planner must not introduce lone LF line endings"
        );
    }

    #[test]
    fn graphics_drawing_insert_can_create_a_complete_document_from_an_empty_destination() {
        let drawing = concat!(
            "\\documentclass{article}\n",
            "\\usepackage{tikz}\n",
            "\\usepackage{tkz-euclide}\n",
            "\\usetikzlibrary{calc}\n",
            "\\begin{document}\n",
            "\\begin{tikzpicture}\\draw (0,0);\\end{tikzpicture}\n",
            "\\end{document}\n",
        );
        let request = graphics_drawing_insert_request(
            "",
            drawing,
            GraphicsDrawingInsertionTarget::BeforeEndDocument,
        );
        let plan = plan_graphics_drawing_insert(request).expect("create complete document");
        assert_eq!(plan.edits.len(), 1);
        assert_eq!(plan.edits[0].range.start.byte, 0);
        assert_eq!(plan.edits[0].range.end.byte, 0);
        let next = apply_graphics_drawing_plan("", &plan);

        assert!(next.starts_with("\\documentclass{article}\n"));
        assert!(next.contains("\\usepackage{tikz}\n"));
        assert!(next.contains("\\usepackage{tkz-euclide}\n"));
        assert!(next.contains("\\usetikzlibrary{calc}\n"));
        assert_eq!(next.matches("\\begin{document}").count(), 1);
        assert_eq!(next.matches("\\begin{tikzpicture}").count(), 1);
        assert_eq!(next.matches("\\end{document}").count(), 1);
        assert!(next.ends_with("\\end{document}\n"));

        let invalid_target = plan_graphics_drawing_insert(graphics_drawing_insert_request(
            "",
            "\\begin{tikzpicture}\\end{tikzpicture}",
            GraphicsDrawingInsertionTarget::Cursor { byte: 1 },
        ))
        .expect_err("nonzero empty-document cursor");
        assert!(invalid_target.contains("empty destination"));
    }

    #[test]
    fn graphics_drawing_insert_prevents_nested_or_partial_existing_tikzpictures() {
        let baseline = concat!(
            "\\begin{document}\n",
            "\\begin{tikzpicture}\\draw (0,0);\\end{tikzpicture}\n",
            "\\end{document}\n",
        );
        let existing = find_tikzpicture_byte_ranges(baseline).unwrap()[0];
        let drawing = "\\begin{tikzpicture}\\draw (1,1);\\end{tikzpicture}";
        let nested = plan_graphics_drawing_insert(graphics_drawing_insert_request(
            baseline,
            drawing,
            GraphicsDrawingInsertionTarget::Cursor {
                byte: existing.start + "\\begin{tikzpicture}".len(),
            },
        ))
        .expect_err("nested insertion");
        assert!(nested.contains("inside an existing tikzpicture"));

        let partial = plan_graphics_drawing_insert(graphics_drawing_insert_request(
            baseline,
            drawing,
            GraphicsDrawingInsertionTarget::Selection {
                start_byte: existing.start + 1,
                end_byte: existing.end,
            },
        ))
        .expect_err("partial existing selection");
        assert!(partial.contains("partially overlaps"));

        let complete = plan_graphics_drawing_insert(graphics_drawing_insert_request(
            baseline,
            drawing,
            GraphicsDrawingInsertionTarget::Selection {
                start_byte: existing.start,
                end_byte: existing.end,
            },
        ))
        .expect("complete existing environment replacement is safe");
        let next = apply_graphics_drawing_plan(baseline, &complete);
        assert_eq!(next.matches("\\begin{tikzpicture}").count(), 1);
        assert!(next.contains("\\draw (1,1);"));
        assert!(!next.contains("\\draw (0,0);"));
    }

    #[test]
    fn graphics_drawing_insert_rejects_zero_multiple_and_malformed_tikzpictures() {
        let baseline = "\\begin{document}\n\\end{document}\n";
        let missing = plan_graphics_drawing_insert(graphics_drawing_insert_request(
            baseline,
            "plain scratch text",
            GraphicsDrawingInsertionTarget::BeforeEndDocument,
        ))
        .expect_err("missing tikzpicture");
        assert!(missing.contains("exactly one"));

        let multiple = plan_graphics_drawing_insert(graphics_drawing_insert_request(
            baseline,
            concat!(
                "\\begin{tikzpicture}\\end{tikzpicture}",
                "\\begin{tikzpicture}\\end{tikzpicture}",
            ),
            GraphicsDrawingInsertionTarget::BeforeEndDocument,
        ))
        .expect_err("multiple tikzpictures");
        assert!(multiple.contains("found 2"));

        let malformed = plan_graphics_drawing_insert(graphics_drawing_insert_request(
            baseline,
            "\\begin{tikzpicture}\n\\draw (0,0);",
            GraphicsDrawingInsertionTarget::BeforeEndDocument,
        ))
        .expect_err("malformed tikzpicture");
        assert!(malformed.contains("no matching end"));
    }

    #[test]
    fn graphics_drawing_insert_rejects_stale_identity_schema_path_and_host_document_errors() {
        let baseline = "\\begin{document}\n\\end{document}\n";
        let drawing = "\\begin{tikzpicture}\\end{tikzpicture}";
        let target = GraphicsDrawingInsertionTarget::BeforeEndDocument;

        let mut stale = graphics_drawing_insert_request(baseline, drawing, target.clone());
        stale.baseline_sha256 = graphics_document_source_sha256("different");
        assert!(plan_graphics_drawing_insert(stale)
            .expect_err("stale")
            .contains("stale"));

        let mut schema = graphics_drawing_insert_request(baseline, drawing, target.clone());
        schema.schema_version = 2;
        assert!(plan_graphics_drawing_insert(schema)
            .expect_err("schema")
            .contains("expected `1`"));

        let mut identity = graphics_drawing_insert_request(baseline, drawing, target.clone());
        identity.document_id.clear();
        assert!(plan_graphics_drawing_insert(identity)
            .expect_err("identity")
            .contains("identity cannot be empty"));

        let mut path = graphics_drawing_insert_request(baseline, drawing, target.clone());
        path.target_file_path.clear();
        assert!(plan_graphics_drawing_insert(path)
            .expect_err("path")
            .contains("target file path cannot be empty"));

        let missing_document = graphics_drawing_insert_request("plain", drawing, target.clone());
        assert!(plan_graphics_drawing_insert(missing_document)
            .expect_err("missing document")
            .contains("complete LaTeX `document`"));

        let malformed_document =
            graphics_drawing_insert_request("\\begin{document}\n", drawing, target);
        assert!(plan_graphics_drawing_insert(malformed_document)
            .expect_err("malformed document")
            .contains("no matching end"));
    }

    #[test]
    fn graphics_drawing_insert_validates_utf8_body_targets_and_exact_selections() {
        let baseline = "\\begin{document}\n😀 body\n\\end{document}\n";
        let drawing = "\\begin{tikzpicture}\\end{tikzpicture}";
        let emoji = baseline.find('😀').unwrap();

        let invalid_utf8 = plan_graphics_drawing_insert(graphics_drawing_insert_request(
            baseline,
            drawing,
            GraphicsDrawingInsertionTarget::Cursor { byte: emoji + 1 },
        ))
        .expect_err("invalid UTF-8 target");
        assert!(invalid_utf8.contains("UTF-8 boundary"));

        let preamble = plan_graphics_drawing_insert(graphics_drawing_insert_request(
            baseline,
            drawing,
            GraphicsDrawingInsertionTarget::Cursor { byte: 0 },
        ))
        .expect_err("cursor outside body");
        assert!(preamble.contains("outside the LaTeX document body"));

        let empty_selection = plan_graphics_drawing_insert(graphics_drawing_insert_request(
            baseline,
            drawing,
            GraphicsDrawingInsertionTarget::Selection {
                start_byte: emoji,
                end_byte: emoji,
            },
        ))
        .expect_err("empty selection");
        assert!(empty_selection.contains("non-empty half-open"));

        let selection_outside = plan_graphics_drawing_insert(graphics_drawing_insert_request(
            baseline,
            drawing,
            GraphicsDrawingInsertionTarget::Selection {
                start_byte: 0,
                end_byte: emoji,
            },
        ))
        .expect_err("selection crosses preamble");
        assert!(selection_outside.contains("outside the LaTeX document body"));
    }

    #[test]
    fn graphics_drawing_insert_ignores_and_diagnoses_unrelated_scratch_body_content() {
        let baseline = "\\begin{document}\n\\end{document}\n";
        let drawing = concat!(
            "\\documentclass{article}\n",
            "\\begin{document}\n",
            "DO NOT INSERT THIS\n",
            "\\begin{tikzpicture}\\draw (0,0);\\end{tikzpicture}\n",
            "OR THIS\n",
            "\\end{document}\n",
        );
        let plan = plan_graphics_drawing_insert(graphics_drawing_insert_request(
            baseline,
            drawing,
            GraphicsDrawingInsertionTarget::BeforeEndDocument,
        ))
        .expect("ignore unrelated scratch content");
        assert!(plan
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "graphics-drawing-scratch-content-ignored"));
        let next = apply_graphics_drawing_plan(baseline, &plan);
        assert!(next.contains("\\draw (0,0);"));
        assert!(!next.contains("DO NOT INSERT THIS"));
        assert!(!next.contains("OR THIS"));
    }

    #[test]
    fn graphics_drawing_dependencies_dedupe_requests_and_ignore_comments_or_escaped_commands() {
        let baseline = concat!(
            "\\documentclass{article}\n",
            "\\usepackage{TikZ}\n",
            "\\usepackage{tkz-euclide}\n",
            "\\begin{document}\n",
            "\\end{document}\n",
        );
        let drawing = concat!(
            "% \\usepackage{commented}\n",
            "\\\\usepackage{escaped}\n",
            "\\usetikzlibrary{calc}\n",
            "\\begin{tikzpicture}\\end{tikzpicture}",
        );
        let mut request = graphics_drawing_insert_request(
            baseline,
            drawing,
            GraphicsDrawingInsertionTarget::BeforeEndDocument,
        );
        request.required_packages = vec![
            "tikz".to_string(),
            "TKZ-EUCLIDE".to_string(),
            "xcolor".to_string(),
            "XCOLOR".to_string(),
        ];
        request.required_tikz_libraries = vec![
            "calc".to_string(),
            "CALC".to_string(),
            "arrows.meta".to_string(),
        ];
        let next = apply_graphics_drawing_plan(
            baseline,
            &plan_graphics_drawing_insert(request).expect("deduped dependencies"),
        );

        assert_eq!(
            next.to_ascii_lowercase()
                .matches("\\usepackage{tikz}")
                .count(),
            1
        );
        assert_eq!(
            next.to_ascii_lowercase()
                .matches("\\usepackage{tkz-euclide}")
                .count(),
            1
        );
        assert_eq!(
            next.to_ascii_lowercase()
                .matches("\\usepackage{xcolor}")
                .count(),
            1
        );
        assert!(!next.contains("\\usepackage{commented}"));
        assert!(!next.contains("\\usepackage{escaped}"));
        assert_eq!(next.to_ascii_lowercase().matches("calc").count(), 1);
        assert_eq!(next.to_ascii_lowercase().matches("arrows.meta").count(), 1);

        let mut invalid = graphics_drawing_insert_request(
            baseline,
            "\\begin{tikzpicture}\\end{tikzpicture}",
            GraphicsDrawingInsertionTarget::BeforeEndDocument,
        );
        invalid.required_tikz_libraries = vec!["calc}".to_string()];
        assert!(plan_graphics_drawing_insert(invalid)
            .expect_err("invalid library")
            .contains("Invalid TikZ library"));
    }

    #[test]
    fn graphics_drawing_figure_options_reject_latex_breakage() {
        let baseline = "\\begin{document}\n\\end{document}\n";
        let drawing = "\\begin{tikzpicture}\\end{tikzpicture}";
        let wrappers = [
            GraphicsDrawingWrapper::Figure {
                placement: Some("htbx".to_string()),
                centering: true,
                caption: None,
                label: None,
            },
            GraphicsDrawingWrapper::Figure {
                placement: None,
                centering: true,
                caption: Some("unbalanced {".to_string()),
                label: None,
            },
            GraphicsDrawingWrapper::Figure {
                placement: None,
                centering: true,
                caption: None,
                label: Some("fig:{bad}".to_string()),
            },
        ];
        for wrapper in wrappers {
            let mut request = graphics_drawing_insert_request(
                baseline,
                drawing,
                GraphicsDrawingInsertionTarget::BeforeEndDocument,
            );
            request.wrapper = wrapper;
            assert!(plan_graphics_drawing_insert(request).is_err());
        }
    }

    #[test]
    fn graphics_drawing_insert_json_contract_is_tagged_and_camel_case() {
        let cursor =
            serde_json::to_value(GraphicsDrawingInsertionTarget::Cursor { byte: 17 }).unwrap();
        assert_eq!(cursor, serde_json::json!({"kind": "cursor", "byte": 17}));
        let before =
            serde_json::to_value(GraphicsDrawingInsertionTarget::BeforeEndDocument).unwrap();
        assert_eq!(before, serde_json::json!({"kind": "beforeEndDocument"}));
        let selection = serde_json::to_value(GraphicsDrawingInsertionTarget::Selection {
            start_byte: 4,
            end_byte: 9,
        })
        .unwrap();
        assert_eq!(
            selection,
            serde_json::json!({"kind": "selection", "startByte": 4, "endByte": 9})
        );

        let wrapper: GraphicsDrawingWrapper = serde_json::from_value(serde_json::json!({
            "kind": "figure",
            "placement": "htbp",
            "caption": null,
            "label": null
        }))
        .expect("figure wrapper defaults");
        assert!(matches!(
            wrapper,
            GraphicsDrawingWrapper::Figure {
                centering: true,
                ..
            }
        ));
    }

    #[test]
    fn analyzes_package_declarations_and_document_class() {
        let source = "\\documentclass[12pt,a4paper]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amsmath, amssymb}\n";
        let analysis = analyze_latex_packages(source, 7);

        assert_eq!(analysis.revision, 7);
        assert_eq!(
            analysis
                .document_class
                .as_ref()
                .map(|decl| decl.name.as_str()),
            Some("article")
        );
        assert_eq!(analysis.packages, vec!["amsmath", "amssymb", "inputenc"]);
        assert_eq!(
            analysis
                .declarations
                .iter()
                .filter(|decl| matches!(
                    decl.kind,
                    PackageDeclarationKind::UsePackage | PackageDeclarationKind::RequirePackage
                ))
                .count(),
            3
        );
    }

    #[test]
    fn ignores_commented_declarations() {
        let source = "% \\usepackage{hidden}\n\\usepackage{visible} % \\usepackage{alsohidden}\n";
        let analysis = analyze_latex_packages(source, 1);

        assert_eq!(analysis.packages, vec!["visible"]);
    }

    #[test]
    fn detects_require_package_tikz_libraries_and_pgfplots_compat() {
        let source = "\\RequirePackage{expl3}\n\\usetikzlibrary{calc,intersections}\n\\pgfplotsset{compat=1.18,width=8cm}\n";
        let analysis = analyze_latex_packages(source, 1);

        assert!(analysis.declarations.iter().any(|decl| decl.kind
            == PackageDeclarationKind::RequirePackage
            && decl.name == "expl3"));
        assert!(analysis
            .declarations
            .iter()
            .any(|decl| decl.kind == PackageDeclarationKind::TikzLibrary && decl.name == "calc"));
        assert!(analysis.declarations.iter().any(|decl| {
            decl.kind == PackageDeclarationKind::PgfplotsCompat && decl.name == "1.18"
        }));
    }

    #[test]
    fn imports_enumitem_setup_from_existing_source() {
        let source = "\\usepackage[inline]{enumitem}\n\\setlist{nosep}\n\\setlist[itemize]{label={--}}\n\\setlist[enumerate]{label=(\\alph*), ref=(\\alph*)}\n\\newlist{questions}{enumerate*}{3}\n\\setlist[questions]{label=\\arabic*., wide=0pt, leftmargin=*, font=\\bfseries\\itshape, align=left, resume, start=4}\n";
        let request = import_enumitem_from_source(source);

        assert!(request.inline);
        assert_eq!(request.global_spacing, "nosep");
        assert_eq!(request.itemize_label, "dash");
        assert_eq!(request.enumerate_label, "alph_wrapped");
        assert_eq!(request.custom_lists.len(), 1);

        let list = &request.custom_lists[0];
        assert_eq!(list.name, "questions");
        assert_eq!(list.base_type, "enumerate");
        assert!(list.inline);
        assert_eq!(list.label, "\\arabic*.");
        assert!(list.wide);
        assert!(list.left_margin_star);
        assert!(list.bold);
        assert!(list.italic);
        assert_eq!(list.align, "left");
        assert!(list.resume);
        assert_eq!(list.start, Some(4));
    }

    #[test]
    fn imports_fancyhdr_setup_from_existing_source() {
        let source = "\\documentclass[twoside]{book}\n\\usepackage[headtopline,nocheck]{fancyhdr}\n\\pagestyle{fancy}\n\\fancyhf{}\n\\fancyhead[LO]{\\rightmark}\n\\fancyhead[RE]{\\leftmark}\n\\fancyhead[LE,RO]{\\thepage}\n\\fancyfoot[CO,CE]{Draft}\n\\renewcommand{\\headrulewidth}{0.6pt}\n\\renewcommand{\\footrulewidth}{0.2pt}\n";
        let request = import_fancyhdr_from_source(source);

        assert_eq!(request.document_type, "twoside");
        assert_eq!(request.page_style, "fancy");
        assert!(request.clear_fields);
        assert_eq!(request.package_options, vec!["headtopline", "nocheck"]);
        assert_eq!(request.header_odd_left, "\\rightmark");
        assert_eq!(request.header_even_right, "\\leftmark");
        assert_eq!(request.header_even_left, "\\thepage");
        assert_eq!(request.header_odd_right, "\\thepage");
        assert_eq!(request.footer_odd_center, "Draft");
        assert_eq!(request.footer_even_center, "Draft");
        assert_eq!(request.head_rule_width, 0.6);
        assert_eq!(request.foot_rule_width, 0.2);
    }

    #[test]
    fn imports_simple_fancyhdr_positions_as_oneside() {
        let source = "\\usepackage{fancyhdr}\n\\pagestyle{plainish}\n\\fancyhead[L]{\\@title}\n\\fancyfoot[C]{\\thepage}\n";
        let request = import_fancyhdr_from_source(source);

        assert_eq!(request.document_type, "oneside");
        assert_eq!(request.page_style, "plainish");
        assert_eq!(request.header_odd_left, "\\@title");
        assert_eq!(request.header_even_left, "\\@title");
        assert_eq!(request.footer_odd_center, "\\thepage");
        assert_eq!(request.footer_even_center, "\\thepage");
    }

    #[test]
    fn imports_geometry_setup_and_documentclass_twoside() {
        let source = "\\documentclass[twoside]{book}\n\\usepackage[margin=2cm,columnsep=0.7cm,includehead,asymmetric]{geometry}\n";
        let request = import_geometry_from_source(source);

        assert_eq!(request.margin_top, 2.0);
        assert_eq!(request.margin_bottom, 2.0);
        assert_eq!(request.margin_left, 2.0);
        assert_eq!(request.margin_right, 2.0);
        assert_eq!(request.columns, "two");
        assert_eq!(request.column_sep, 0.7);
        assert!(request.include_head);
        assert_eq!(request.sidedness, "asymmetric");
    }

    #[test]
    fn imports_siunitx_setup_and_body_snippet_from_existing_source() {
        let source = "\\usepackage{siunitx}\n\\sisetup{per-mode = symbol, inter-unit-product = \\ensuremath{{\\cdot}}, range-phrase = {--}}\nThe speed is \\qtyrange[exponent-mode=scientific, round-mode=figures, round-precision=3]{1.234}{9.876}{\\kilo\\meter\\per\\second\\squared}.\n";
        let request = import_siunitx_from_source(source);

        assert_eq!(request.snippet_mode, "qtyrange");
        assert_eq!(request.per_mode, "symbol");
        assert_eq!(request.inter_unit_product, "cdot");
        assert_eq!(request.range_phrase, "--");
        assert_eq!(request.exponent_mode, "scientific");
        assert_eq!(request.round_mode, "figures");
        assert_eq!(request.round_precision, 3);
        assert_eq!(request.range_start, "1.234");
        assert_eq!(request.range_end, "9.876");
        assert_eq!(request.units.len(), 2);
        assert_eq!(request.units[0].prefix, "\\kilo");
        assert_eq!(request.units[0].unit, "\\meter");
        assert!(!request.units[0].per);
        assert_eq!(request.units[1].unit, "\\second");
        assert_eq!(request.units[1].power, "\\squared");
        assert!(request.units[1].per);
    }

    #[test]
    fn imports_standalone_siunitx_setup_when_no_body_snippet_exists() {
        let source = "\\sisetup{per-mode=fraction, inter-unit-product=\\!, range-phrase={to}}\n";
        let request = import_siunitx_from_source(source);

        assert_eq!(request.snippet_mode, "setup");
        assert_eq!(request.per_mode, "fraction");
        assert_eq!(request.inter_unit_product, "tight");
        assert_eq!(request.range_phrase, "to");
    }

    #[test]
    fn imports_legacy_siunitx_commands_with_compatibility_warnings() {
        let source = "\\usepackage[binary-units]{siunitx}\nMass: \\SI[separate-uncertainty=true]{1.23(4)}{\\kilo\\gram}.\n";
        let request = import_siunitx_from_source(source);

        assert_eq!(request.snippet_mode, "qty");
        assert_eq!(request.number, "1.23(4)");
        assert_eq!(request.units[0].prefix, "\\kilo");
        assert_eq!(request.units[0].unit, "\\gram");
        assert!(request
            .compatibility_warnings
            .iter()
            .any(|warning| warning.code == "siunitx-legacy-command-SI"));
        assert!(request
            .compatibility_warnings
            .iter()
            .any(|warning| warning.code == "siunitx-version-sensitive-option-binary-units"));
        assert!(request.compatibility_warnings.iter().any(|warning| {
            warning.code == "siunitx-version-sensitive-option-separate-uncertainty"
        }));

        let output = builders::siunitx::generate_siunitx(request);
        assert!(output
            .warnings
            .iter()
            .any(|warning| warning.code == "siunitx-legacy-command-SI"));
    }

    #[test]
    fn imports_legacy_siunitx_ranges_and_units() {
        let source = "\\si{\\meter\\per\\second}\n\\SIrange{3}{7}{\\meter}\n";
        let request = import_siunitx_from_source(source);

        assert_eq!(request.snippet_mode, "qtyrange");
        assert_eq!(request.range_start, "3");
        assert_eq!(request.range_end, "7");
        assert_eq!(request.units[0].unit, "\\meter");
        assert!(request
            .compatibility_warnings
            .iter()
            .any(|warning| warning.code == "siunitx-legacy-command-si"));
        assert!(request
            .compatibility_warnings
            .iter()
            .any(|warning| warning.code == "siunitx-legacy-command-SIrange"));
    }

    #[test]
    fn imports_math_environment_from_existing_source() {
        let source =
            "\\begin{align}\n  \\label{eq:main}\n  a &= b + c \\\\\n  d &= e - f\n\\end{align}\n";
        let request = import_math_from_source(source);

        assert_eq!(request.mode, "environment");
        assert_eq!(request.environment_type, "align");
        assert!(!request.starred);
        assert_eq!(request.label, "eq:main");
        assert!(request.content.contains("a &= b + c"));
        assert!(request.content.contains("d &= e - f"));
        assert!(!request.content.contains("\\label"));
        let range = request.imported_source_range.as_ref().unwrap();
        assert_eq!(
            &source[range.start.byte..range.end.byte],
            "\\begin{align}\n  \\label{eq:main}\n  a &= b + c \\\\\n  d &= e - f\n\\end{align}"
        );
    }

    #[test]
    fn imports_math_matrix_from_existing_source() {
        let source = "\\begin{pmatrix*}[r]\n  a & b \\\\\n  c & d\n\\end{pmatrix*}\n";
        let request = import_math_from_source(source);

        assert_eq!(request.mode, "matrix");
        assert_eq!(request.matrix_type, "pmatrix");
        assert!(request.matrix_starred);
        assert_eq!(request.matrix_alignment, "r");
        assert_eq!(request.matrix_rows, 2);
        assert_eq!(request.matrix_columns, 2);
        assert_eq!(request.matrix_cells[0][0], "a");
        assert_eq!(request.matrix_cells[1][1], "d");
        let range = request.imported_source_range.as_ref().unwrap();
        assert_eq!(
            &source[range.start.byte..range.end.byte],
            "\\begin{pmatrix*}[r]\n  a & b \\\\\n  c & d\n\\end{pmatrix*}"
        );
    }

    #[test]
    fn imports_mathtools_tool_snippets_from_existing_source() {
        let delimiter =
            import_math_from_source("\\DeclarePairedDelimiter\\norm{\\lVert}{\\rVert}\n");
        assert_eq!(delimiter.mode, "tool");
        assert_eq!(delimiter.tool_type, "delimiter");
        assert_eq!(delimiter.delimiter_command, "norm");
        assert_eq!(delimiter.delimiter_left, "\\lVert");
        assert_eq!(delimiter.delimiter_right, "\\rVert");
        let range = delimiter.imported_source_range.as_ref().unwrap();
        assert_eq!(
            &"\\DeclarePairedDelimiter\\norm{\\lVert}{\\rVert}\n"[range.start.byte..range.end.byte],
            "\\DeclarePairedDelimiter\\norm{\\lVert}{\\rVert}"
        );

        let arrow = import_math_from_source("\\xrightarrow[below]{above}");
        assert_eq!(arrow.mode, "tool");
        assert_eq!(arrow.tool_type, "arrow");
        assert_eq!(arrow.arrow_type, "xrightarrow");
        assert_eq!(arrow.arrow_above, "above");
        assert_eq!(arrow.arrow_below, "below");
        assert!(arrow.imported_source_range.is_some());

        let harpoon = import_math_from_source("\\xrightleftharpoons[back]{forward}");
        assert_eq!(harpoon.mode, "tool");
        assert_eq!(harpoon.tool_type, "arrow");
        assert_eq!(harpoon.arrow_type, "xrightleftharpoons");
        assert_eq!(harpoon.arrow_above, "forward");
        assert_eq!(harpoon.arrow_below, "back");
        assert!(harpoon.imported_source_range.is_some());

        let split_fraction = import_math_from_source("\\splitdfrac{a + b}{c + d}");
        assert_eq!(split_fraction.mode, "tool");
        assert_eq!(split_fraction.tool_type, "split_fraction");
        assert_eq!(split_fraction.split_fraction_type, "splitdfrac");
        assert_eq!(split_fraction.split_fraction_top, "a + b");
        assert_eq!(split_fraction.split_fraction_bottom, "c + d");
        assert!(split_fraction.imported_source_range.is_some());
    }

    #[test]
    fn imports_mathtools_tag_snippets_from_existing_source() {
        let tag = import_math_from_source("\\newtagform{boxed}[\\bfseries]{[}{]}");

        assert_eq!(tag.mode, "tag");
        assert_eq!(tag.tag_action, "newtagform");
        assert_eq!(tag.tag_name, "boxed");
        assert_eq!(tag.tag_format, "\\bfseries");
        assert_eq!(tag.tag_left, "[");
        assert_eq!(tag.tag_right, "]");
        assert!(tag.imported_source_range.is_some());

        let reference = import_math_from_source("\\noeqref{eq:main}");
        assert_eq!(reference.mode, "tag");
        assert_eq!(reference.tag_action, "noeqref");
        assert_eq!(reference.tag_ref_label, "eq:main");
        assert!(reference.imported_source_range.is_some());

        let ams_reference = import_math_from_source("\\eqref{eq:main}");
        assert_eq!(ams_reference.mode, "tag");
        assert_eq!(ams_reference.tag_action, "eqref");
        assert_eq!(ams_reference.tag_ref_label, "eq:main");
        assert!(ams_reference.imported_source_range.is_some());
    }

    #[test]
    fn imports_additional_ams_math_environments() {
        let aligned = import_math_from_source("\\begin{aligned}\n  a &= b\n\\end{aligned}");
        assert_eq!(aligned.mode, "environment");
        assert_eq!(aligned.environment_type, "aligned");
        assert_eq!(aligned.content, "a &= b");

        let split = import_math_from_source("\\begin{split}\n  x &= y + z\n\\end{split}");
        assert_eq!(split.mode, "environment");
        assert_eq!(split.environment_type, "split");
        assert_eq!(split.content, "x &= y + z");
    }

    #[test]
    fn lists_multiple_math_import_candidates_in_source_order() {
        let source = "\\begin{align}\n  a &= b\n\\end{align}\nText\n\\begin{bmatrix}\n  1 & 0 \\\\\n  0 & 1\n\\end{bmatrix}\n\\DeclarePairedDelimiter\\abs{\\lvert}{\\rvert}\n\\xrightarrow{f}\n";
        let snippets = list_math_imports_from_source(source);

        assert!(snippets.len() >= 4);
        assert_eq!(snippets[0].kind, "Environment");
        assert_eq!(snippets[0].label, "align");
        assert_eq!(snippets[0].request.mode, "environment");
        assert_eq!(snippets[1].kind, "Matrix");
        assert_eq!(snippets[1].label, "bmatrix");
        assert_eq!(snippets[1].request.mode, "matrix");
        assert_eq!(snippets[2].kind, "Paired delimiter");
        assert_eq!(snippets[2].label, "\\DeclarePairedDelimiter\\abs");
        assert_eq!(snippets[3].kind, "Arrow");
        assert_eq!(snippets[3].label, "\\xrightarrow");
        assert!(snippets.windows(2).all(|pair| pair[0]
            .request
            .imported_source_range
            .as_ref()
            .unwrap()
            .start
            .byte
            < pair[1]
                .request
                .imported_source_range
                .as_ref()
                .unwrap()
                .start
                .byte));
    }

    #[test]
    fn imports_delimited_math_snippets_and_ignores_escaped_or_commented_delimiters() {
        let source = "Inline \\(a+b\\), dollar $c+d$, display \\[\nE = mc^2\n\\], old $$x=y$$, escaped \\$not math$.\n% $commented$\n";
        let snippets = list_math_imports_from_source(source);
        let delimited = snippets
            .iter()
            .filter(|snippet| snippet.request.mode == "delimited")
            .collect::<Vec<_>>();

        assert_eq!(delimited.len(), 4);
        assert_eq!(delimited[0].label, "\\( … \\)");
        assert_eq!(delimited[0].request.delimiter_math_type, "inline_parens");
        assert_eq!(delimited[0].request.delimiter_math_content, "a+b");
        assert_eq!(delimited[1].label, "$ … $");
        assert_eq!(delimited[1].request.delimiter_math_type, "inline_dollar");
        assert_eq!(delimited[1].request.delimiter_math_content, "c+d");
        assert_eq!(delimited[2].label, "\\[ … \\]");
        assert_eq!(delimited[2].request.delimiter_math_type, "display_brackets");
        assert_eq!(delimited[2].request.delimiter_math_content, "E = mc^2");
        assert_eq!(delimited[3].label, "$$ … $$");
        assert_eq!(delimited[3].request.delimiter_math_type, "display_dollars");
        assert_eq!(delimited[3].request.delimiter_math_content, "x=y");
    }

    #[test]
    fn imports_graphicx_figure_snippet_from_existing_source() {
        let source = "\\begin{figure}[!ht]\n  \\centering\n  \\includegraphics[width=.75\\linewidth, height=4cm, keepaspectratio, angle=15]{figures/my plot.pdf}\n  \\caption{Imported caption}\n  \\label{fig:imported}\n\\end{figure}\n";
        let request = import_graphicx_from_source(source);

        assert!(request.use_figure);
        assert!(request.center);
        assert_eq!(request.placement, "!ht");
        assert_eq!(request.file_path, "figures/my plot.pdf");
        assert_eq!(request.width, ".75");
        assert_eq!(request.width_unit, "\\linewidth");
        assert_eq!(request.height, "4");
        assert_eq!(request.height_unit, "cm");
        assert!(request.keep_aspect_ratio);
        assert_eq!(request.angle, Some(15.0));
        assert_eq!(request.caption, "Imported caption");
        assert_eq!(request.label, "fig:imported");
    }

    #[test]
    fn imports_standalone_graphicx_includegraphics_from_existing_source() {
        let source =
            "\\includegraphics[scale=1.25, angle=-90]{\"figures/image with spaces.png\"}\n";
        let request = import_graphicx_from_source(source);

        assert!(!request.use_figure);
        assert_eq!(request.file_path, "figures/image with spaces.png");
        assert_eq!(request.scale, Some(1.25));
        assert_eq!(request.angle, Some(-90.0));
        assert!(request.caption.is_empty());
        assert!(request.label.is_empty());
    }

    #[test]
    fn imported_twoside_is_not_emitted_as_geometry_option() {
        let source = "\\documentclass[twoside]{book}\n\\usepackage[top=2cm,bottom=2cm,left=3cm,right=3cm]{geometry}\n";
        let request = import_geometry_from_source(source);
        let output = builders::geometry::generate_geometry(request);

        assert!(output.code.contains("\\usepackage["));
        assert!(!output.code.contains("twoside"));
        assert!(!output.requirements[0]
            .options
            .iter()
            .any(|option| option == "twoside"));
    }

    #[test]
    fn imports_listings_setup_from_existing_source() {
        let source = "\\usepackage{listings}\n\\lstdefinestyle{mystyle}{\n  breaklines=true,\n  numbers=left,\n  frame=single,\n  tabsize=2\n}\n\\lstset{style=mystyle}\n";
        let request = import_code_highlighting_from_source(source);

        assert_eq!(request.engine, "listings");
        assert!(request.break_lines);
        assert!(request.show_numbers);
        assert!(request.show_frame);
        assert_eq!(request.language, "python");
    }

    #[test]
    fn imports_minted_setup_from_existing_source() {
        let source = "\\usepackage{minted}\n\\usemintedstyle{monokai}\n\\setminted{\n  linenos,\n  breaklines,\n  frame=lines,\n  fontsize=\\footnotesize\n}\n";
        let request = import_code_highlighting_from_source(source);

        assert_eq!(request.engine, "minted");
        assert_eq!(request.minted_style, "monokai");
        assert!(request.break_lines);
        assert!(request.show_numbers);
        assert!(request.show_frame);
    }

    #[test]
    fn imports_xcolor_palette_from_existing_source() {
        let source = "\\usepackage[table,dvipsnames]{xcolor}\n\\definecolor{brandBlue}{HTML}{228BE6}\n\\definecolor{printCmyk}{cmyk}{0.1,0.2,0.3,0.4}\n\\colorlet{softBlue}{brandBlue!25!white}\n\\colorlet{brandCopy}{brandBlue}\n";
        let request = import_xcolor_from_source(source);

        assert_eq!(request.package_options, vec!["table", "dvipsnames"]);
        assert_eq!(request.colors.len(), 2);
        assert_eq!(request.colors[0].name, "brandBlue");
        assert_eq!(request.colors[0].model, "HTML");
        assert_eq!(request.colors[0].value, "228BE6");
        assert_eq!(request.colors[1].name, "printCmyk");
        assert_eq!(request.aliases.len(), 2);
        assert_eq!(request.aliases[0].name, "softBlue");
        assert_eq!(request.aliases[0].primary, "brandBlue");
        assert_eq!(request.aliases[0].percentage, 25);
        assert_eq!(request.aliases[0].secondary, "white");
        assert_eq!(request.aliases[1].name, "brandCopy");
        assert_eq!(request.aliases[1].percentage, 100);
    }

    #[test]
    fn xcolor_import_deduplicates_palette_names() {
        let source = "\\definecolor{brand}{HTML}{111111}\n\\definecolor{brand}{HTML}{222222}\n\\colorlet{brand}{red!50!white}\n";
        let request = import_xcolor_from_source(source);

        assert_eq!(request.colors.len(), 1);
        assert_eq!(request.colors[0].value, "111111");
        assert!(request.aliases.is_empty());
    }

    #[test]
    fn reports_duplicate_packages_case_insensitively() {
        let source = "\\usepackage{amsmath}\n\\RequirePackage{AMSMATH}\n";
        let analysis = analyze_latex_packages(source, 1);

        assert_eq!(analysis.diagnostics.len(), 1);
        assert_eq!(analysis.diagnostics[0].code, "duplicate-package");
    }

    #[test]
    fn reports_common_package_conflicts_and_obsolete_packages() {
        let source = "\\usepackage{color}\n\\usepackage{xcolor}\n\\usepackage{epsfig}\n\\usepackage{subfigure}\n\\usepackage{subcaption}\n";
        let analysis = analyze_latex_packages(source, 1);
        let codes = analysis
            .diagnostics
            .iter()
            .map(|diagnostic| diagnostic.code.as_str())
            .collect::<Vec<_>>();

        assert!(codes.contains(&"package-conflict-color-xcolor"));
        assert!(codes.contains(&"obsolete-package-epsfig"));
        assert!(codes.contains(&"package-conflict-subfigure-subcaption"));
    }

    #[test]
    fn reports_hyperref_order_diagnostic_for_late_package() {
        let source = "\\usepackage{hyperref}\n\\usepackage{geometry}\n";
        let analysis = analyze_latex_packages(source, 1);

        assert!(analysis
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "package-order-hyperref-late"));
    }

    #[test]
    fn allows_cleveref_after_hyperref_but_warns_before_hyperref() {
        let ok_source = "\\usepackage{hyperref}\n\\usepackage{cleveref}\n";
        let ok_analysis = analyze_latex_packages(ok_source, 1);
        assert!(!ok_analysis
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "package-order-hyperref-late"));

        let bad_source = "\\usepackage{cleveref}\n\\usepackage{hyperref}\n";
        let bad_analysis = analyze_latex_packages(bad_source, 1);
        assert!(bad_analysis
            .diagnostics
            .iter()
            .any(|diagnostic| { diagnostic.code == "package-order-cleveref-after-hyperref" }));
    }

    #[test]
    fn plans_package_insertion_after_existing_packages() {
        let request = AddPackageRequest {
            source: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n"
                .to_string(),
            revision: 3,
            package_id: "graphicx".to_string(),
            options: vec!["draft".to_string()],
            update_existing: false,
        };

        let plan = plan_add_package(request).expect("plan");
        assert_eq!(plan.revision, 3);
        assert_eq!(plan.edits.len(), 1);
        assert_eq!(plan.edits[0].replacement, "\\usepackage[draft]{graphicx}\n");
        assert_eq!(plan.edits[0].range.start.line, 3);
    }

    #[test]
    fn add_package_is_noop_when_package_exists() {
        let request = AddPackageRequest {
            source: "\\usepackage{graphicx}\n".to_string(),
            revision: 4,
            package_id: "GraphicX".to_string(),
            options: Vec::new(),
            update_existing: false,
        };

        let plan = plan_add_package(request).expect("plan");
        assert!(plan.edits.is_empty());
        assert_eq!(plan.diagnostics[0].code, "package-already-present");
    }

    #[test]
    fn update_existing_single_package_replaces_declaration() {
        let request = AddPackageRequest {
            source:
                "\\documentclass{article}\n\\usepackage[margin=2cm]{geometry}\n\\begin{document}\n"
                    .to_string(),
            revision: 5,
            package_id: "geometry".to_string(),
            options: vec![
                "top=1.5cm".to_string(),
                "bottom=2cm".to_string(),
                "left=2cm".to_string(),
                "right=2cm".to_string(),
            ],
            update_existing: true,
        };

        let plan = plan_add_package(request).expect("plan");
        assert_eq!(plan.edits.len(), 1);
        assert_eq!(
            plan.edits[0].replacement,
            "\\usepackage[top=1.5cm, bottom=2cm, left=2cm, right=2cm]{geometry}"
        );
        assert_eq!(plan.edits[0].range.start.line, 2);
    }

    #[test]
    fn update_existing_multi_package_declaration_splits_safely() {
        let request = AddPackageRequest {
            source: "\\usepackage{amsmath, geometry, xcolor}\n".to_string(),
            revision: 6,
            package_id: "geometry".to_string(),
            options: vec!["margin=1cm".to_string()],
            update_existing: true,
        };

        let plan = plan_add_package(request).expect("plan");
        assert_eq!(plan.edits.len(), 1);
        assert_eq!(
            plan.edits[0].replacement,
            "\\usepackage{amsmath}\n\\usepackage[margin=1cm]{geometry}\n\\usepackage{xcolor}"
        );
    }

    #[test]
    fn update_existing_multi_package_preserves_shared_options_for_other_packages() {
        let request = AddPackageRequest {
            source: "\\RequirePackage[draft]{graphicx, geometry}\n".to_string(),
            revision: 7,
            package_id: "geometry".to_string(),
            options: vec!["top=2cm".to_string(), "bottom=2cm".to_string()],
            update_existing: true,
        };

        let plan = plan_add_package(request).expect("plan");
        assert_eq!(plan.edits.len(), 1);
        assert_eq!(
            plan.edits[0].replacement,
            "\\RequirePackage[draft]{graphicx}\n\\RequirePackage[top=2cm, bottom=2cm]{geometry}"
        );
    }

    #[test]
    fn update_existing_multi_package_keeps_target_position() {
        let request = AddPackageRequest {
            source: "\\usepackage{geometry, amsmath, xcolor}\n".to_string(),
            revision: 8,
            package_id: "geometry".to_string(),
            options: vec!["left=1cm".to_string()],
            update_existing: true,
        };

        let plan = plan_add_package(request).expect("plan");
        assert_eq!(
            plan.edits[0].replacement,
            "\\usepackage[left=1cm]{geometry}\n\\usepackage{amsmath, xcolor}"
        );
    }

    #[test]
    fn remove_single_package_removes_safe_whole_line() {
        let request = RemovePackageRequest {
            source: "\\documentclass{article}\n\\usepackage{geometry}\n\\begin{document}\n"
                .to_string(),
            revision: 9,
            package_id: "geometry".to_string(),
        };

        let plan = plan_remove_package(request).expect("plan");
        assert_eq!(plan.edits.len(), 1);
        assert_eq!(plan.edits[0].replacement, "");
        assert_eq!(plan.edits[0].range.start.line, 2);
        assert_eq!(plan.edits[0].range.end.line, 3);
    }

    #[test]
    fn remove_package_from_multi_package_declaration_preserves_others() {
        let request = RemovePackageRequest {
            source: "\\usepackage[draft]{amsmath, geometry, xcolor}\n".to_string(),
            revision: 10,
            package_id: "geometry".to_string(),
        };

        let plan = plan_remove_package(request).expect("plan");
        assert_eq!(plan.edits.len(), 1);
        assert_eq!(
            plan.edits[0].replacement,
            "\\usepackage[draft]{amsmath, xcolor}"
        );
    }

    #[test]
    fn remove_package_is_noop_when_package_is_absent() {
        let request = RemovePackageRequest {
            source: "\\usepackage{amsmath}\n".to_string(),
            revision: 11,
            package_id: "geometry".to_string(),
        };

        let plan = plan_remove_package(request).expect("plan");
        assert!(plan.edits.is_empty());
        assert_eq!(plan.diagnostics[0].code, "package-not-present");
    }

    #[test]
    fn move_package_to_late_preamble_uses_remove_and_insert_edits() {
        let request = MovePackageRequest {
            source: "\\documentclass{article}\n\\usepackage{hyperref}\n\\usepackage{geometry}\n"
                .to_string(),
            revision: 12,
            package_id: "hyperref".to_string(),
            target: "latePreamble".to_string(),
            after_package_id: None,
        };

        let plan = plan_move_package(request).expect("plan");
        assert_eq!(plan.edits.len(), 2);
        assert_eq!(plan.edits[0].replacement, "\\usepackage{hyperref}\n");
        assert_eq!(plan.edits[0].range.start.line, 4);
        assert_eq!(plan.edits[1].replacement, "");
        assert_eq!(plan.edits[1].range.start.line, 2);
    }

    #[test]
    fn move_package_after_anchor_supports_cleveref_after_hyperref() {
        let request = MovePackageRequest {
            source: "\\usepackage{cleveref}\n\\usepackage{hyperref}\n".to_string(),
            revision: 13,
            package_id: "cleveref".to_string(),
            target: "afterPackage".to_string(),
            after_package_id: Some("hyperref".to_string()),
        };

        let plan = plan_move_package(request).expect("plan");
        assert_eq!(plan.edits.len(), 2);
        assert_eq!(plan.edits[0].replacement, "\\usepackage{cleveref}\n");
        assert_eq!(plan.edits[0].range.start.line, 3);
        assert_eq!(plan.edits[1].replacement, "");
        assert_eq!(plan.edits[1].range.start.line, 1);
    }

    #[test]
    fn golden_preamble_fixture_exposes_expected_packages() {
        let fixture = include_str!("fixtures/preamble-default-article.tex");
        let analysis = analyze_latex_packages(fixture, 1);

        for package_id in [
            "inputenc", "fontenc", "lmodern", "babel", "geometry", "amsmath", "amsfonts",
            "amssymb", "graphicx", "xcolor", "hyperref",
        ] {
            assert!(
                analysis
                    .packages
                    .iter()
                    .any(|package| package == package_id),
                "missing package `{package_id}` in golden preamble fixture"
            );
        }
        assert_eq!(analysis.diagnostics, Vec::new());
    }

    #[test]
    fn golden_geometry_fixtures_remain_parseable() {
        for fixture in [
            include_str!("fixtures/geometry-default.tex"),
            include_str!("fixtures/geometry-advanced-layout.tex"),
        ] {
            let analysis = analyze_latex_packages(fixture, 1);
            assert_eq!(analysis.packages, vec!["geometry"]);
            assert_eq!(analysis.diagnostics, Vec::new());
            assert!(analysis.declarations.iter().any(
                |declaration| declaration.name == "geometry" && !declaration.options.is_empty()
            ));
        }
    }

    #[test]
    fn golden_code_highlighting_fixtures_remain_parseable() {
        let listings_source = format!(
            "\\usepackage{{listings}}\n{}",
            include_str!("fixtures/code-listings-default.tex")
        );
        let listings = analyze_latex_packages(&listings_source, 1);
        assert!(listings
            .packages
            .iter()
            .any(|package| package == "listings"));

        let minted_source = format!(
            "\\usepackage{{minted}}\n{}",
            include_str!("fixtures/code-minted-default.tex")
        );
        let minted = analyze_latex_packages(&minted_source, 1);
        assert!(minted.packages.iter().any(|package| package == "minted"));
    }

    #[test]
    fn generated_block_plan_inserts_after_existing_packages() {
        let request = GeneratedBlockRequest {
            source: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n"
                .to_string(),
            revision: 9,
            block_id: "code-highlighting".to_string(),
            code: include_str!("fixtures/code-listings-default.tex").to_string(),
        };

        let plan = plan_generated_block(request).expect("plan");
        assert_eq!(plan.edits.len(), 1);
        assert_eq!(plan.edits[0].range.start.line, 3);
        assert!(plan.edits[0]
            .replacement
            .contains("DataTeX Package Studio: code-highlighting:start"));
        assert!(plan.edits[0].replacement.contains("\\lstdefinestyle"));
    }

    #[test]
    fn generated_block_plan_replaces_managed_block() {
        let source = "\\documentclass{article}\n% --- DataTeX Package Studio: code-highlighting:start ---\nold\n% --- DataTeX Package Studio: code-highlighting:end ---\n\\begin{document}\n";
        let request = GeneratedBlockRequest {
            source: source.to_string(),
            revision: 10,
            block_id: "code-highlighting".to_string(),
            code: include_str!("fixtures/code-minted-default.tex").to_string(),
        };

        let plan = plan_generated_block(request).expect("plan");
        assert_eq!(plan.edits.len(), 1);
        assert_eq!(plan.edits[0].range.start.line, 2);
        assert_eq!(plan.edits[0].range.end.line, 5);
        assert!(plan.edits[0].replacement.contains("\\usemintedstyle"));
        assert!(!plan.edits[0].replacement.contains("\nold\n"));
    }

    #[test]
    fn generated_block_plan_replaces_legacy_code_highlighting_block() {
        let source = format!(
            "\\documentclass{{article}}\n{}\\begin{{document}}\n",
            include_str!("fixtures/code-listings-default.tex")
        );
        let request = GeneratedBlockRequest {
            source,
            revision: 11,
            block_id: "code-highlighting".to_string(),
            code: include_str!("fixtures/code-minted-default.tex").to_string(),
        };

        let plan = plan_generated_block(request).expect("plan");
        assert_eq!(plan.edits.len(), 1);
        assert!(plan.edits[0]
            .replacement
            .contains("DataTeX Package Studio: code-highlighting:start"));
        assert!(plan.edits[0].replacement.contains("\\usemintedstyle"));
    }

    #[test]
    fn generated_block_plan_removes_existing_block_when_code_is_empty() {
        let source = "\\documentclass{article}\n% --- DataTeX Package Studio: code-highlighting:start ---\nold\n% --- DataTeX Package Studio: code-highlighting:end ---\n\\begin{document}\n";
        let request = GeneratedBlockRequest {
            source: source.to_string(),
            revision: 12,
            block_id: "code-highlighting".to_string(),
            code: String::new(),
        };

        let plan = plan_generated_block(request).expect("plan");
        assert_eq!(plan.edits.len(), 1);
        assert!(plan.edits[0].replacement.is_empty());
    }

    #[test]
    fn builder_configuration_switches_package_and_setup_atomically() {
        let source = "\\documentclass{article}\n\\usepackage[table,dvipsnames]{xcolor}\n\\usepackage{listings}\n% --- DataTeX Package Studio: code-highlighting:start ---\nold setup\n% --- DataTeX Package Studio: code-highlighting:end ---\n\\begin{document}\n";
        let request = ApplyBuilderConfigurationRequest {
            source: source.to_string(),
            revision: 21,
            builder_id: "code-highlighting".to_string(),
            enabled: true,
            managed_package_ids: vec!["listings".to_string(), "minted".to_string()],
            requirements: vec![
                builders::BuilderPackageRequirement {
                    package_id: "minted".to_string(),
                    options: Vec::new(),
                },
                builders::BuilderPackageRequirement {
                    package_id: "xcolor".to_string(),
                    options: Vec::new(),
                },
            ],
            generated_blocks: vec![ManagedGeneratedBlock {
                block_id: "code-highlighting".to_string(),
                code: "\\usemintedstyle{friendly}".to_string(),
            }],
        };

        let plan = plan_apply_builder_configuration(request).expect("plan");
        assert_eq!(plan.edits.len(), 1);
        let next = apply_plan_to_source(source, &plan.edits).expect("apply");
        assert!(!next.contains("\\usepackage{listings}"));
        assert!(next.contains("\\usepackage{minted}"));
        assert!(next.contains("\\usepackage[table,dvipsnames]{xcolor}"));
        assert!(next.contains("\\usemintedstyle{friendly}"));
        assert!(!next.contains("old setup"));
    }

    #[test]
    fn disabled_builder_removes_package_and_managed_setup() {
        let source = "\\documentclass{article}\n\\usepackage[table]{xcolor}\n% --- DataTeX Package Studio: xcolor-palette:start ---\n\\definecolor{brand}{HTML}{228BE6}\n% --- DataTeX Package Studio: xcolor-palette:end ---\n\\begin{document}\n";
        let request = ApplyBuilderConfigurationRequest {
            source: source.to_string(),
            revision: 22,
            builder_id: "xcolor".to_string(),
            enabled: false,
            managed_package_ids: vec!["xcolor".to_string()],
            requirements: Vec::new(),
            generated_blocks: vec![ManagedGeneratedBlock {
                block_id: "xcolor-palette".to_string(),
                code: String::new(),
            }],
        };

        let plan = plan_apply_builder_configuration(request).expect("plan");
        let next = apply_plan_to_source(source, &plan.edits).expect("apply");
        assert!(!next.contains("\\usepackage[table]{xcolor}"));
        assert!(!next.contains("xcolor-palette:start"));
        assert!(next.contains("\\begin{document}"));
    }
}
