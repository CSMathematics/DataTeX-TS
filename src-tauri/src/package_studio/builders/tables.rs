use super::{
    BuilderBuildProfileRequirement, BuilderOutput, BuilderPackageRequirement, BuilderWarning,
    BuilderWarningSeverity,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TableBuilderRequest {
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    pub mode: String,
    pub rows: usize,
    pub columns: usize,
    pub cells: Vec<Vec<String>>,
    #[serde(default)]
    pub cell_styles: Vec<Vec<TableCellStyle>>,
    #[serde(default)]
    pub cell_spans: Vec<Vec<TableCellSpan>>,
    pub column_alignments: Vec<String>,
    #[serde(default)]
    pub column_weights: Vec<String>,
    pub hlines: bool,
    pub vlines: bool,
    pub use_table_environment: bool,
    pub center: bool,
    pub caption: String,
    pub label: String,
    pub placement: String,
    pub long_table: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TableCellStyle {
    #[serde(default)]
    pub bold: bool,
    #[serde(default)]
    pub italic: bool,
    #[serde(default)]
    pub alignment: String,
    #[serde(default)]
    pub vertical_alignment: String,
    #[serde(default)]
    pub background_color: String,
    #[serde(default)]
    pub text_color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TableCellSpan {
    #[serde(default = "default_span")]
    pub row_span: usize,
    #[serde(default = "default_span")]
    pub col_span: usize,
    #[serde(default)]
    pub hidden: bool,
}

impl Default for TableCellSpan {
    fn default() -> Self {
        Self {
            row_span: 1,
            col_span: 1,
            hidden: false,
        }
    }
}

pub type TableBuilderOutput = BuilderOutput;

impl Default for TableBuilderRequest {
    fn default() -> Self {
        Self {
            enabled: true,
            mode: "booktabs".to_string(),
            rows: 3,
            columns: 3,
            cells: vec![
                vec![
                    "Header 1".to_string(),
                    "Header 2".to_string(),
                    "Header 3".to_string(),
                ],
                vec!["A".to_string(), "B".to_string(), "C".to_string()],
                vec!["1".to_string(), "2".to_string(), "3".to_string()],
            ],
            cell_styles: vec![vec![TableCellStyle::default(); 3]; 3],
            cell_spans: vec![vec![TableCellSpan::default(); 3]; 3],
            column_alignments: vec!["l".to_string(), "c".to_string(), "r".to_string()],
            column_weights: vec![String::new(), String::new(), String::new()],
            hlines: true,
            vlines: false,
            use_table_environment: true,
            center: true,
            caption: "Table caption".to_string(),
            label: "tab:my_table".to_string(),
            placement: "ht".to_string(),
            long_table: false,
        }
    }
}

pub fn generate_table(request: TableBuilderRequest) -> TableBuilderOutput {
    if !request.enabled {
        return TableBuilderOutput::empty("tables");
    }

    let normalized = normalize_request(request);
    let body = match normalized.mode.as_str() {
        "tabularray" => format_tabularray(&normalized),
        "standard" => format_standard_tabular(&normalized, false),
        _ => format_standard_tabular(&normalized, true),
    };

    TableBuilderOutput {
        schema_version: 1,
        builder_id: "tables".to_string(),
        code: body,
        requirements: package_requirements(&normalized),
        build_profile: BuilderBuildProfileRequirement::default(),
        warnings: table_warnings(&normalized),
    }
}

fn normalize_request(mut request: TableBuilderRequest) -> TableBuilderRequest {
    request.rows = request.rows.clamp(1, 50);
    request.columns = request.columns.clamp(1, 20);

    request.cells.resize_with(request.rows, Vec::new);
    for row in &mut request.cells {
        row.resize(request.columns, String::new());
        row.truncate(request.columns);
    }
    request.cells.truncate(request.rows);

    request.cell_styles.resize_with(request.rows, Vec::new);
    for row in &mut request.cell_styles {
        row.resize(request.columns, TableCellStyle::default());
        row.truncate(request.columns);
        for style in row {
            style.alignment = sanitize_cell_alignment(&style.alignment);
            style.vertical_alignment = sanitize_cell_vertical_alignment(&style.vertical_alignment);
        }
    }
    request.cell_styles.truncate(request.rows);

    request.cell_spans.resize_with(request.rows, Vec::new);
    for row in &mut request.cell_spans {
        row.resize(request.columns, TableCellSpan::default());
        row.truncate(request.columns);
        for span in row {
            span.row_span = span.row_span.clamp(1, request.rows);
            span.col_span = span.col_span.clamp(1, request.columns);
        }
    }
    request.cell_spans.truncate(request.rows);

    request
        .column_alignments
        .resize(request.columns, "c".to_string());
    request.column_alignments.truncate(request.columns);
    request.column_alignments = request
        .column_alignments
        .into_iter()
        .map(|alignment| sanitize_alignment(&alignment, request.mode.as_str()))
        .collect();
    request
        .column_weights
        .resize(request.columns, String::new());
    request.column_weights.truncate(request.columns);
    request.column_weights = request
        .column_weights
        .iter()
        .enumerate()
        .map(|(index, weight)| {
            sanitize_column_weight(
                weight,
                request
                    .column_alignments
                    .get(index)
                    .map(String::as_str)
                    .unwrap_or("c"),
                request.mode.as_str(),
            )
        })
        .collect();

    if !matches!(
        request.mode.as_str(),
        "tabularray" | "standard" | "booktabs"
    ) {
        request.mode = "booktabs".to_string();
    }
    request.placement = sanitize_placement(&request.placement);
    request
}

fn package_requirements(request: &TableBuilderRequest) -> Vec<BuilderPackageRequirement> {
    let mut requirements = match request.mode.as_str() {
        "tabularray" => vec![BuilderPackageRequirement {
            package_id: "tabularray".to_string(),
            options: Vec::new(),
        }],
        "booktabs" => vec![BuilderPackageRequirement {
            package_id: "booktabs".to_string(),
            options: Vec::new(),
        }],
        _ => Vec::new(),
    };

    if request.mode != "tabularray" && has_row_spans(request) {
        requirements.push(BuilderPackageRequirement {
            package_id: "multirow".to_string(),
            options: Vec::new(),
        });
    }
    if has_cell_colors(request) {
        requirements.push(BuilderPackageRequirement {
            package_id: "xcolor".to_string(),
            options: vec!["table".to_string()],
        });
    }

    requirements
}

fn has_row_spans(request: &TableBuilderRequest) -> bool {
    request
        .cell_spans
        .iter()
        .flatten()
        .any(|span| !span.hidden && span.row_span > 1)
}

fn has_cell_colors(request: &TableBuilderRequest) -> bool {
    request.cell_styles.iter().flatten().any(|style| {
        normalize_hex_color(&style.background_color).is_some()
            || normalize_hex_color(&style.text_color).is_some()
    })
}

fn table_warnings(request: &TableBuilderRequest) -> Vec<BuilderWarning> {
    let mut warnings = Vec::new();

    if request.mode == "tabularray" && request.long_table {
        if !request.label.trim().is_empty() && request.caption.trim().is_empty() {
            warnings.push(BuilderWarning {
                code: "longtblr-label-without-caption".to_string(),
                severity: BuilderWarningSeverity::Warning,
                message:
                    "longtblr labels are safest when a caption is also present; add a caption or verify the reference anchor after compiling."
                        .to_string(),
                package_id: Some("tabularray".to_string()),
            });
        }

        if request.use_table_environment || request.center || request.placement.trim() != "ht" {
            warnings.push(BuilderWarning {
                code: "longtblr-non-floating-table".to_string(),
                severity: BuilderWarningSeverity::Info,
                message:
                    "longtblr is generated as a multi-page table, not a floating table; float placement and centering controls are ignored."
                        .to_string(),
                package_id: Some("tabularray".to_string()),
            });
        }
    }

    warnings
}

fn format_tabularray(request: &TableBuilderRequest) -> String {
    let env = if request.long_table {
        "longtblr"
    } else {
        "tblr"
    };
    let mut options = Vec::new();
    if !request.caption.trim().is_empty() {
        options.push(format!(
            "caption = {{{}}}",
            sanitize_table_fragment(&request.caption)
        ));
    }
    if !request.label.trim().is_empty() {
        options.push(format!(
            "label = {{{}}}",
            sanitize_table_fragment(&request.label)
        ));
    }

    let mut specs = Vec::new();
    if request.hlines {
        specs.push("hlines".to_string());
    }
    if request.vlines {
        specs.push("vlines".to_string());
    }
    specs.push(format!("colspec = {{{}}}", tabularray_colspec(request)));
    for (row_index, row) in request.cell_styles.iter().enumerate() {
        for (column_index, style) in row.iter().enumerate() {
            let mut style_specs = Vec::new();
            if let Some(span) = request
                .cell_spans
                .get(row_index)
                .and_then(|row| row.get(column_index))
                .filter(|span| !span.hidden)
            {
                if span.row_span > 1 {
                    style_specs.push(format!("r={}", span.row_span));
                }
                if span.col_span > 1 {
                    style_specs.push(format!("c={}", span.col_span));
                }
            }
            if !style.alignment.is_empty() {
                style_specs.push(format!("halign={}", style.alignment));
            }
            if !style.vertical_alignment.is_empty() {
                style_specs.push(format!("valign={}", style.vertical_alignment));
            }
            let mut font_specs = Vec::new();
            if style.bold {
                font_specs.push("\\bfseries");
            }
            if style.italic {
                font_specs.push("\\itshape");
            }
            if !font_specs.is_empty() {
                style_specs.push(format!("font={{{}}}", font_specs.join(" ")));
            }
            if let Some(color) = normalize_hex_color(&style.background_color) {
                style_specs.push(format!("bg=datatable{color}"));
            }
            if let Some(color) = normalize_hex_color(&style.text_color) {
                style_specs.push(format!("fg=datatable{color}"));
            }
            if !style_specs.is_empty() {
                specs.push(format!(
                    "cell{{{}}}{{{}}} = {{{}}}",
                    row_index + 1,
                    column_index + 1,
                    style_specs.join(", ")
                ));
            }
        }
    }

    let mut code = String::new();
    push_color_definitions(&mut code, request, "");
    code.push_str(&format!("\\begin{{{env}}}"));
    if !options.is_empty() {
        code.push_str(&format!("[{}]", options.join(", ")));
    }
    code.push_str(&format!("{{\n  {}\n}}\n", specs.join(",\n  ")));
    push_table_rows(&mut code, request);
    code.push_str(&format!("\\end{{{env}}}"));
    code
}

fn format_standard_tabular(request: &TableBuilderRequest, booktabs: bool) -> String {
    let mut code = String::new();
    push_color_definitions(&mut code, request, "  ");
    if request.use_table_environment {
        code.push_str(&format!(
            "\\begin{{table}}[{}]\n",
            sanitize_placement(&request.placement)
        ));
    }
    if request.center {
        code.push_str("  \\centering\n");
    }

    let colspec = standard_colspec(request, booktabs);
    code.push_str(&format!("  \\begin{{tabular}}{{{colspec}}}\n"));
    if booktabs {
        code.push_str("    \\toprule\n");
    } else if request.hlines {
        code.push_str("    \\hline\n");
    }

    for (index, row) in request.cells.iter().enumerate() {
        code.push_str("    ");
        code.push_str(&format_standard_row(
            row,
            request
                .cell_styles
                .get(index)
                .map(Vec::as_slice)
                .unwrap_or(&[]),
            request
                .cell_spans
                .get(index)
                .map(Vec::as_slice)
                .unwrap_or(&[]),
            request,
            booktabs,
        ));
        code.push_str(" \\\\\n");
        if booktabs && index == 0 && request.rows > 1 {
            code.push_str("    \\midrule\n");
        } else if !booktabs && request.hlines {
            code.push_str("    \\hline\n");
        }
    }

    if booktabs {
        code.push_str("    \\bottomrule\n");
    }
    code.push_str("  \\end{tabular}\n");

    if !request.caption.trim().is_empty() {
        code.push_str(&format!(
            "  \\caption{{{}}}\n",
            sanitize_table_fragment(&request.caption)
        ));
    }
    if !request.label.trim().is_empty() {
        code.push_str(&format!(
            "  \\label{{{}}}\n",
            sanitize_table_fragment(&request.label)
        ));
    }
    if request.use_table_environment {
        code.push_str("\\end{table}");
    }
    code
}

fn push_table_rows(code: &mut String, request: &TableBuilderRequest) {
    for (index, row) in request.cells.iter().enumerate() {
        code.push_str("  ");
        code.push_str(&format_tabularray_row(
            row,
            request
                .cell_styles
                .get(index)
                .map(Vec::as_slice)
                .unwrap_or(&[]),
            request
                .cell_spans
                .get(index)
                .map(Vec::as_slice)
                .unwrap_or(&[]),
            request,
        ));
        code.push_str(" \\\\\n");
    }
}

fn format_tabularray_row(
    row: &[String],
    styles: &[TableCellStyle],
    spans: &[TableCellSpan],
    request: &TableBuilderRequest,
) -> String {
    row.iter()
        .enumerate()
        .map(|(index, cell)| {
            if spans.get(index).map(|span| span.hidden).unwrap_or(false) {
                return String::new();
            }
            format_cell(
                cell,
                styles.get(index),
                spans.get(index),
                request.column_alignments.get(index).map(String::as_str),
                request.mode.as_str(),
                false,
                request.vlines,
            )
        })
        .collect::<Vec<_>>()
        .join(" & ")
}

fn format_standard_row(
    row: &[String],
    styles: &[TableCellStyle],
    spans: &[TableCellSpan],
    request: &TableBuilderRequest,
    booktabs: bool,
) -> String {
    row.iter()
        .enumerate()
        .filter_map(|(index, cell)| {
            if spans.get(index).map(|span| span.hidden).unwrap_or(false) {
                return None;
            }
            Some(format_cell(
                cell,
                styles.get(index),
                spans.get(index),
                request.column_alignments.get(index).map(String::as_str),
                request.mode.as_str(),
                booktabs,
                request.vlines,
            ))
        })
        .collect::<Vec<_>>()
        .join(" & ")
}

fn format_cell(
    cell: &str,
    style: Option<&TableCellStyle>,
    span: Option<&TableCellSpan>,
    column_alignment: Option<&str>,
    mode: &str,
    booktabs: bool,
    vlines: bool,
) -> String {
    let mut content = sanitize_table_fragment(cell);
    if let Some(style) = style {
        if mode != "tabularray" && style.bold {
            content = format!("\\textbf{{{content}}}");
        }
        if mode != "tabularray" && style.italic {
            content = format!("\\textit{{{content}}}");
        }
        if let Some(color) = normalize_hex_color(&style.text_color) {
            content = format!("\\textcolor[HTML]{{{color}}}{{{content}}}");
        }
        if let Some(color) = normalize_hex_color(&style.background_color) {
            content = format!("\\cellcolor[HTML]{{{color}}}{content}");
        }
    }

    if mode != "tabularray" {
        let row_span = span.map(|span| span.row_span).unwrap_or(1);
        let col_span = span.map(|span| span.col_span).unwrap_or(1);
        if row_span > 1 {
            content = format!("\\multirow{{{row_span}}}{{*}}{{{content}}}");
        }
        let style_alignment = style
            .map(|style| style.alignment.as_str())
            .filter(|alignment| !alignment.is_empty());
        let overrides_alignment = style_alignment
            .map(|alignment| Some(alignment) != column_alignment)
            .unwrap_or(false);
        if col_span > 1 || overrides_alignment {
            let alignment = style_alignment.or(column_alignment).unwrap_or("c");
            let alignment = if vlines && !booktabs {
                format!("|{alignment}|")
            } else {
                alignment.to_string()
            };
            content = format!("\\multicolumn{{{col_span}}}{{{alignment}}}{{{content}}}");
        }
    }
    content
}

fn standard_colspec(request: &TableBuilderRequest, booktabs: bool) -> String {
    let columns = request
        .column_alignments
        .iter()
        .map(|alignment| match alignment.as_str() {
            "l" | "c" | "r" => alignment.as_str(),
            _ => "c",
        })
        .collect::<Vec<_>>()
        .join(if request.vlines && !booktabs { "|" } else { "" });

    if request.vlines && !booktabs {
        format!("|{columns}|")
    } else {
        columns
    }
}

fn tabularray_colspec(request: &TableBuilderRequest) -> String {
    request
        .column_alignments
        .iter()
        .enumerate()
        .map(|(index, alignment)| {
            let weight = request
                .column_weights
                .get(index)
                .map(String::as_str)
                .unwrap_or("");
            if !weight.is_empty() && matches!(alignment.as_str(), "X" | "Q") {
                format!("{alignment}[{weight}]")
            } else {
                alignment.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn sanitize_alignment(value: &str, mode: &str) -> String {
    let value = value.trim();
    if mode == "tabularray" {
        match value {
            "l" | "c" | "r" | "X" | "Q" => value.to_string(),
            _ => "c".to_string(),
        }
    } else {
        match value {
            "l" | "c" | "r" => value.to_string(),
            _ => "c".to_string(),
        }
    }
}

fn sanitize_column_weight(value: &str, alignment: &str, mode: &str) -> String {
    let value = value.trim();
    if mode != "tabularray" || !matches!(alignment, "X" | "Q") {
        return String::new();
    }
    if value.is_empty() {
        return String::new();
    }
    if value.len() <= 24
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | ':' | '\\' | '{' | '}'))
    {
        value.to_string()
    } else {
        String::new()
    }
}

fn sanitize_cell_alignment(value: &str) -> String {
    match value.trim() {
        "" => String::new(),
        "l" | "c" | "r" => value.trim().to_string(),
        _ => String::new(),
    }
}

fn sanitize_cell_vertical_alignment(value: &str) -> String {
    match value.trim() {
        "" => String::new(),
        "t" | "m" | "b" => value.trim().to_string(),
        _ => String::new(),
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

fn sanitize_table_fragment(value: &str) -> String {
    value
        .trim()
        .chars()
        .filter(|ch| *ch != '\0' && *ch != '\r')
        .collect()
}

fn push_color_definitions(code: &mut String, request: &TableBuilderRequest, indent: &str) {
    if request.mode != "tabularray" {
        return;
    }

    let mut colors = request
        .cell_styles
        .iter()
        .flatten()
        .flat_map(|style| [&style.background_color, &style.text_color])
        .filter_map(|color| normalize_hex_color(color))
        .collect::<Vec<_>>();
    colors.sort();
    colors.dedup();

    for color in colors {
        code.push_str(&format!(
            "{indent}\\definecolor{{datatable{color}}}{{HTML}}{{{color}}}\n"
        ));
    }
}

fn normalize_hex_color(value: &str) -> Option<String> {
    let color = value.trim().trim_start_matches('#');
    if color.len() == 6 && color.chars().all(|ch| ch.is_ascii_hexdigit()) {
        Some(color.to_ascii_uppercase())
    } else {
        None
    }
}

const fn default_enabled() -> bool {
    true
}

const fn default_span() -> usize {
    1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_tables_generates_booktabs_table_and_requirement() {
        let output = generate_table(TableBuilderRequest::default());

        assert_eq!(output.builder_id, "tables");
        assert_eq!(output.requirements[0].package_id, "booktabs");
        assert!(output.code.contains("\\begin{table}[ht]"));
        assert!(output.code.contains("\\toprule"));
        assert!(output.code.contains("Header 1 & Header 2 & Header 3 \\\\"));
        assert!(output.code.contains("\\caption{Table caption}"));
    }

    #[test]
    fn tabularray_generates_tblr_with_colspec_and_requirement() {
        let output = generate_table(TableBuilderRequest {
            mode: "tabularray".to_string(),
            column_alignments: vec!["l".to_string(), "X".to_string()],
            cells: vec![vec!["A".to_string(), "B".to_string()]],
            rows: 1,
            columns: 2,
            hlines: true,
            vlines: true,
            ..TableBuilderRequest::default()
        });

        assert_eq!(output.requirements[0].package_id, "tabularray");
        assert!(output.code.contains("\\begin{tblr}"));
        assert!(output.code.contains("hlines"));
        assert!(output.code.contains("vlines"));
        assert!(output.code.contains("colspec = {l X}"));
    }

    #[test]
    fn tabularray_column_weights_generate_weighted_x_and_q_colspecs() {
        let output = generate_table(TableBuilderRequest {
            mode: "tabularray".to_string(),
            column_alignments: vec!["X".to_string(), "Q".to_string(), "r".to_string()],
            column_weights: vec!["2".to_string(), "1.5cm".to_string(), "ignored".to_string()],
            cells: vec![vec!["A".to_string(), "B".to_string(), "C".to_string()]],
            rows: 1,
            columns: 3,
            ..TableBuilderRequest::default()
        });

        assert!(output.code.contains("colspec = {X[2] Q[1.5cm] r}"));
    }

    #[test]
    fn tabularray_column_weights_reject_unsafe_values() {
        let output = generate_table(TableBuilderRequest {
            mode: "tabularray".to_string(),
            column_alignments: vec!["X".to_string()],
            column_weights: vec!["2, bad".to_string()],
            cells: vec![vec!["A".to_string()]],
            rows: 1,
            columns: 1,
            ..TableBuilderRequest::default()
        });

        assert!(output.code.contains("colspec = {X}"));
        assert!(!output.code.contains("2, bad"));
    }

    #[test]
    fn longtblr_label_without_caption_reports_warning() {
        let output = generate_table(TableBuilderRequest {
            mode: "tabularray".to_string(),
            long_table: true,
            caption: String::new(),
            label: "tab:long".to_string(),
            ..TableBuilderRequest::default()
        });

        assert!(output.code.contains("\\begin{longtblr}"));
        assert!(output
            .warnings
            .iter()
            .any(|warning| warning.code == "longtblr-label-without-caption"));
    }

    #[test]
    fn longtblr_reports_ignored_float_controls_warning() {
        let output = generate_table(TableBuilderRequest {
            mode: "tabularray".to_string(),
            long_table: true,
            use_table_environment: true,
            center: true,
            placement: "H".to_string(),
            ..TableBuilderRequest::default()
        });

        assert!(output
            .warnings
            .iter()
            .any(|warning| warning.code == "longtblr-non-floating-table"));
    }

    #[test]
    fn standard_table_can_generate_plain_tabular_without_requirement() {
        let output = generate_table(TableBuilderRequest {
            mode: "standard".to_string(),
            use_table_environment: false,
            center: false,
            vlines: true,
            hlines: true,
            rows: 1,
            columns: 2,
            cells: vec![vec!["A".to_string(), "B".to_string()]],
            column_alignments: vec!["l".to_string(), "r".to_string()],
            ..TableBuilderRequest::default()
        });

        assert!(output.requirements.is_empty());
        assert!(output.code.starts_with("  \\begin{tabular}{|l|r|}"));
        assert!(output.code.contains("\\hline"));
    }

    #[test]
    fn styled_cells_generate_text_commands_and_alignment() {
        let output = generate_table(TableBuilderRequest {
            mode: "booktabs".to_string(),
            rows: 1,
            columns: 2,
            cells: vec![vec!["Bold".to_string(), "Italic".to_string()]],
            column_alignments: vec!["l".to_string(), "r".to_string()],
            cell_styles: vec![vec![
                TableCellStyle {
                    bold: true,
                    italic: false,
                    alignment: "c".to_string(),
                    ..TableCellStyle::default()
                },
                TableCellStyle {
                    bold: false,
                    italic: true,
                    alignment: String::new(),
                    ..TableCellStyle::default()
                },
            ]],
            ..TableBuilderRequest::default()
        });

        assert!(output
            .code
            .contains("\\multicolumn{1}{c}{\\textbf{Bold}} & \\textit{Italic}"));
    }

    #[test]
    fn merged_standard_cells_generate_multicolumn() {
        let output = generate_table(TableBuilderRequest {
            mode: "standard".to_string(),
            rows: 1,
            columns: 3,
            cells: vec![vec!["Wide".to_string(), String::new(), "Tail".to_string()]],
            column_alignments: vec!["l".to_string(), "c".to_string(), "r".to_string()],
            cell_spans: vec![vec![
                TableCellSpan {
                    row_span: 1,
                    col_span: 2,
                    hidden: false,
                },
                TableCellSpan {
                    row_span: 1,
                    col_span: 1,
                    hidden: true,
                },
                TableCellSpan::default(),
            ]],
            ..TableBuilderRequest::default()
        });

        assert!(output.code.contains("\\multicolumn{2}{l}{Wide} & Tail"));
    }

    #[test]
    fn row_spans_add_multirow_requirement_for_standard_tables() {
        let output = generate_table(TableBuilderRequest {
            mode: "booktabs".to_string(),
            rows: 2,
            columns: 1,
            cells: vec![vec!["Tall".to_string()], vec![String::new()]],
            cell_spans: vec![
                vec![TableCellSpan {
                    row_span: 2,
                    col_span: 1,
                    hidden: false,
                }],
                vec![TableCellSpan {
                    row_span: 1,
                    col_span: 1,
                    hidden: true,
                }],
            ],
            ..TableBuilderRequest::default()
        });

        assert!(output
            .requirements
            .iter()
            .any(|requirement| requirement.package_id == "multirow"));
        assert!(output.code.contains("\\multirow{2}{*}{Tall}"));
    }

    #[test]
    fn tabularray_cell_alignment_generates_cell_specs() {
        let output = generate_table(TableBuilderRequest {
            mode: "tabularray".to_string(),
            rows: 1,
            columns: 1,
            cells: vec![vec!["Aligned".to_string()]],
            cell_styles: vec![vec![TableCellStyle {
                bold: false,
                italic: false,
                alignment: "r".to_string(),
                vertical_alignment: "b".to_string(),
                ..TableCellStyle::default()
            }]],
            ..TableBuilderRequest::default()
        });

        assert!(output.code.contains("cell{1}{1} = {halign=r, valign=b}"));
    }

    #[test]
    fn tabularray_bold_italic_generate_font_cell_specs() {
        let output = generate_table(TableBuilderRequest {
            mode: "tabularray".to_string(),
            rows: 1,
            columns: 1,
            cells: vec![vec!["Styled".to_string()]],
            cell_styles: vec![vec![TableCellStyle {
                bold: true,
                italic: true,
                ..TableCellStyle::default()
            }]],
            ..TableBuilderRequest::default()
        });

        assert!(output
            .code
            .contains("cell{1}{1} = {font={\\bfseries \\itshape}}"));
        assert!(output.code.contains("Styled \\\\"));
        assert!(!output.code.contains("\\textbf{Styled}"));
        assert!(!output.code.contains("\\textit{Styled}"));
    }

    #[test]
    fn colored_standard_cells_add_xcolor_requirement_and_color_commands() {
        let output = generate_table(TableBuilderRequest {
            mode: "booktabs".to_string(),
            rows: 1,
            columns: 1,
            cells: vec![vec!["Color".to_string()]],
            cell_styles: vec![vec![TableCellStyle {
                background_color: "#fff3bf".to_string(),
                text_color: "#1c7ed6".to_string(),
                ..TableCellStyle::default()
            }]],
            ..TableBuilderRequest::default()
        });

        assert!(output.requirements.iter().any(|requirement| {
            requirement.package_id == "xcolor"
                && requirement.options.iter().any(|option| option == "table")
        }));
        assert!(output
            .code
            .contains("\\cellcolor[HTML]{FFF3BF}\\textcolor[HTML]{1C7ED6}{Color}"));
    }

    #[test]
    fn colored_tabularray_cells_generate_color_definitions_and_cell_specs() {
        let output = generate_table(TableBuilderRequest {
            mode: "tabularray".to_string(),
            rows: 1,
            columns: 1,
            cells: vec![vec!["Color".to_string()]],
            cell_styles: vec![vec![TableCellStyle {
                background_color: "#fff3bf".to_string(),
                text_color: "#1c7ed6".to_string(),
                ..TableCellStyle::default()
            }]],
            ..TableBuilderRequest::default()
        });

        assert!(output
            .code
            .contains("\\definecolor{datatable1C7ED6}{HTML}{1C7ED6}"));
        assert!(output
            .code
            .contains("\\definecolor{datatableFFF3BF}{HTML}{FFF3BF}"));
        assert!(output
            .code
            .contains("cell{1}{1} = {bg=datatableFFF3BF, fg=datatable1C7ED6}"));
    }

    #[test]
    fn tabularray_spans_generate_cell_specs() {
        let output = generate_table(TableBuilderRequest {
            mode: "tabularray".to_string(),
            rows: 1,
            columns: 2,
            cells: vec![vec!["Wide".to_string(), String::new()]],
            cell_spans: vec![vec![
                TableCellSpan {
                    row_span: 1,
                    col_span: 2,
                    hidden: false,
                },
                TableCellSpan {
                    row_span: 1,
                    col_span: 1,
                    hidden: true,
                },
            ]],
            ..TableBuilderRequest::default()
        });

        assert!(output.code.contains("cell{1}{1} = {c=2}"));
        assert!(output.code.contains("Wide &  \\\\"));
    }

    #[test]
    fn disabled_tables_outputs_empty_code_and_no_requirements() {
        let output = generate_table(TableBuilderRequest {
            enabled: false,
            ..TableBuilderRequest::default()
        });

        assert!(output.code.is_empty());
        assert!(output.requirements.is_empty());
    }
}
