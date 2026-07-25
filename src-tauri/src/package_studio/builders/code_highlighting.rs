use super::{
    BuilderBuildProfileRequirement, BuilderOutput, BuilderPackageRequirement, BuilderWarning,
    BuilderWarningSeverity,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ListingsColors {
    pub keyword: String,
    pub string: String,
    pub comment: String,
    pub background: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CodeHighlightingBuilderRequest {
    pub engine: String,
    #[serde(default = "default_language")]
    pub language: String,
    pub show_numbers: bool,
    pub break_lines: bool,
    pub show_frame: bool,
    pub minted_style: String,
    pub lst_colors: ListingsColors,
}

pub type CodeHighlightingBuilderOutput = BuilderOutput;

impl Default for ListingsColors {
    fn default() -> Self {
        Self {
            keyword: "#0000FF".to_string(),
            string: "#A020F0".to_string(),
            comment: "#008000".to_string(),
            background: "#F5F5F5".to_string(),
        }
    }
}

impl Default for CodeHighlightingBuilderRequest {
    fn default() -> Self {
        Self {
            engine: "none".to_string(),
            language: default_language(),
            show_numbers: true,
            break_lines: true,
            show_frame: true,
            minted_style: "friendly".to_string(),
            lst_colors: ListingsColors::default(),
        }
    }
}

pub fn generate_code_highlighting_snippet(
    request: CodeHighlightingBuilderRequest,
    code: String,
) -> String {
    let code = sanitize_code_body(&code);
    match request.engine.as_str() {
        "listings" => {
            let language = listings_language(&request.language)
                .map(|language| format!("[language={language}]"))
                .unwrap_or_default();
            format!("\\begin{{lstlisting}}{language}\n{code}\n\\end{{lstlisting}}")
        }
        "minted" => {
            let language = minted_language(&request.language);
            format!("\\begin{{minted}}{{{language}}}\n{code}\n\\end{{minted}}")
        }
        _ => code,
    }
}

pub fn generate_code_highlighting(
    request: CodeHighlightingBuilderRequest,
) -> CodeHighlightingBuilderOutput {
    match request.engine.as_str() {
        "listings" => generate_listings(request),
        "minted" => generate_minted(request),
        "none" | "" => empty_output(),
        other => CodeHighlightingBuilderOutput {
            schema_version: 1,
            builder_id: "code-highlighting".to_string(),
            code: String::new(),
            requirements: Vec::new(),
            build_profile: BuilderBuildProfileRequirement::default(),
            warnings: vec![BuilderWarning {
                code: "unsupported-code-highlighting-engine".to_string(),
                severity: BuilderWarningSeverity::Warning,
                message: format!("Unsupported code highlighting engine `{other}`."),
                package_id: None,
            }],
        },
    }
}

fn generate_listings(request: CodeHighlightingBuilderRequest) -> CodeHighlightingBuilderOutput {
    let mut code = "\n% --- Code Highlighting (listings) ---\n".to_string();
    code.push_str(&format!(
        "\\definecolor{{codegreen}}{{rgb}}{{{}}}\n",
        hex_to_listings_rgb(&request.lst_colors.comment)
    ));
    code.push_str("\\definecolor{codegray}{rgb}{0.5,0.5,0.5}\n");
    code.push_str(&format!(
        "\\definecolor{{codepurple}}{{rgb}}{{{}}}\n",
        hex_to_listings_rgb(&request.lst_colors.string)
    ));
    code.push_str(&format!(
        "\\definecolor{{codeblue}}{{rgb}}{{{}}}\n",
        hex_to_listings_rgb(&request.lst_colors.keyword)
    ));
    code.push_str(&format!(
        "\\definecolor{{backcolour}}{{rgb}}{{{}}}\n\n",
        hex_to_listings_rgb(&request.lst_colors.background)
    ));

    code.push_str("\\lstdefinestyle{mystyle}{\n");
    code.push_str("    backgroundcolor=\\color{backcolour},\n");
    code.push_str("    commentstyle=\\color{codegreen},\n");
    code.push_str("    keywordstyle=\\color{codeblue},\n");
    code.push_str("    numberstyle=\\tiny\\color{codegray},\n");
    code.push_str("    stringstyle=\\color{codepurple},\n");
    code.push_str("    basicstyle=\\ttfamily\\footnotesize,\n");
    if request.break_lines {
        code.push_str("    breaklines=true,\n");
    }
    code.push_str("    captionpos=b,\n    keepspaces=true,\n");
    if request.show_numbers {
        code.push_str("    numbers=left,\n    numbersep=5pt,\n");
    }
    if request.show_frame {
        code.push_str("    frame=single,\n");
    }
    code.push_str("    tabsize=2\n}\n");
    code.push_str("\\lstset{style=mystyle}\n");

    CodeHighlightingBuilderOutput {
        schema_version: 1,
        builder_id: "code-highlighting".to_string(),
        code,
        requirements: vec![
            BuilderPackageRequirement {
                package_id: "listings".to_string(),
                options: Vec::new(),
            },
            BuilderPackageRequirement {
                package_id: "xcolor".to_string(),
                options: Vec::new(),
            },
        ],
        build_profile: BuilderBuildProfileRequirement::default(),
        warnings: Vec::new(),
    }
}

fn generate_minted(request: CodeHighlightingBuilderRequest) -> CodeHighlightingBuilderOutput {
    let minted_style = sanitize_minted_style(&request.minted_style);
    let mut code = "\n% --- Code Highlighting (minted) ---\n".to_string();
    code.push_str(&format!("\\usemintedstyle{{{minted_style}}}\n"));
    code.push_str("\\setminted{\n");
    if request.show_numbers {
        code.push_str("    linenos,\n");
    }
    if request.break_lines {
        code.push_str("    breaklines,\n");
    }
    if request.show_frame {
        code.push_str("    frame=lines,\n");
    }
    code.push_str("    fontsize=\\footnotesize,\n    tabsize=4\n}\n");

    CodeHighlightingBuilderOutput {
        schema_version: 1,
        builder_id: "code-highlighting".to_string(),
        code,
        requirements: vec![BuilderPackageRequirement {
            package_id: "minted".to_string(),
            options: Vec::new(),
        }],
        build_profile: BuilderBuildProfileRequirement {
            shell_escape_required: true,
        },
        warnings: vec![BuilderWarning {
            code: "shell-escape-required".to_string(),
            severity: BuilderWarningSeverity::Warning,
            message:
                "`minted` usually requires shell-escape and Python/Pygments in the build profile."
                    .to_string(),
            package_id: Some("minted".to_string()),
        }],
    }
}

fn empty_output() -> CodeHighlightingBuilderOutput {
    CodeHighlightingBuilderOutput::empty("code-highlighting")
}

fn hex_to_listings_rgb(hex: &str) -> String {
    let hex = hex.trim().trim_start_matches('#');
    if hex.len() != 6 || !hex.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return "0.00,0.00,0.00".to_string();
    }

    let red = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0) as f64 / 255.0;
    let green = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0) as f64 / 255.0;
    let blue = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0) as f64 / 255.0;
    format!("{red:.2},{green:.2},{blue:.2}")
}

fn sanitize_minted_style(style: &str) -> String {
    let style = style.trim();
    if style.is_empty()
        || !style
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'))
    {
        "friendly".to_string()
    } else {
        style.to_string()
    }
}

fn listings_language(language: &str) -> Option<&'static str> {
    match language.trim().to_lowercase().as_str() {
        "python" => Some("Python"),
        "c" => Some("C"),
        "cpp" => Some("C++"),
        "java" => Some("Java"),
        "sql" => Some("SQL"),
        "html" => Some("HTML"),
        "xml" => Some("XML"),
        "bash" => Some("bash"),
        "matlab" => Some("Matlab"),
        "tex" => Some("TeX"),
        "r" => Some("R"),
        "php" => Some("PHP"),
        "ruby" => Some("Ruby"),
        "perl" => Some("Perl"),
        "lua" => Some("Lua"),
        "fortran" => Some("Fortran"),
        _ => None,
    }
}

fn minted_language(language: &str) -> &'static str {
    match language.trim().to_lowercase().as_str() {
        "python" => "python",
        "c" => "c",
        "cpp" => "cpp",
        "java" => "java",
        "sql" => "sql",
        "html" => "html",
        "xml" => "xml",
        "bash" => "bash",
        "matlab" => "matlab",
        "tex" => "tex",
        "r" => "r",
        "php" => "php",
        "ruby" => "ruby",
        "perl" => "perl",
        "lua" => "lua",
        "fortran" => "fortran",
        "javascript" => "javascript",
        "typescript" => "typescript",
        "json" => "json",
        "yaml" => "yaml",
        "go" => "go",
        "rust" => "rust",
        "swift" => "swift",
        "kotlin" => "kotlin",
        "csharp" => "csharp",
        "css" => "css",
        "markdown" => "markdown",
        "docker" => "docker",
        _ => "text",
    }
}

fn sanitize_code_body(code: &str) -> String {
    code.replace('\0', "")
        .replace("\r\n", "\n")
        .replace('\r', "\n")
}

fn default_language() -> String {
    "python".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_listings_matches_golden_fixture() {
        let output = generate_code_highlighting(CodeHighlightingBuilderRequest {
            engine: "listings".to_string(),
            ..CodeHighlightingBuilderRequest::default()
        });

        assert_eq!(
            output.code,
            include_str!("../fixtures/code-listings-default.tex")
        );
        assert_eq!(output.requirements[0].package_id, "listings");
        assert!(!output.build_profile.shell_escape_required);
    }

    #[test]
    fn default_minted_matches_golden_fixture_and_reports_shell_escape() {
        let output = generate_code_highlighting(CodeHighlightingBuilderRequest {
            engine: "minted".to_string(),
            ..CodeHighlightingBuilderRequest::default()
        });

        assert_eq!(
            output.code,
            include_str!("../fixtures/code-minted-default.tex")
        );
        assert_eq!(output.requirements[0].package_id, "minted");
        assert!(output.build_profile.shell_escape_required);
        assert!(!output.warnings.is_empty());
    }

    #[test]
    fn none_engine_generates_no_code() {
        let output = generate_code_highlighting(CodeHighlightingBuilderRequest::default());

        assert!(output.code.is_empty());
        assert!(output.requirements.is_empty());
        assert!(output.warnings.is_empty());
    }

    #[test]
    fn listings_respects_disabled_optional_features() {
        let output = generate_code_highlighting(CodeHighlightingBuilderRequest {
            engine: "listings".to_string(),
            show_numbers: false,
            break_lines: false,
            show_frame: false,
            ..CodeHighlightingBuilderRequest::default()
        });

        assert!(!output.code.contains("numbers=left"));
        assert!(!output.code.contains("breaklines=true"));
        assert!(!output.code.contains("frame=single"));
    }

    #[test]
    fn invalid_minted_style_falls_back_to_friendly() {
        let output = generate_code_highlighting(CodeHighlightingBuilderRequest {
            engine: "minted".to_string(),
            minted_style: "bad style {}".to_string(),
            ..CodeHighlightingBuilderRequest::default()
        });

        assert!(output.code.contains("\\usemintedstyle{friendly}"));
    }

    #[test]
    fn generates_language_aware_listings_snippet() {
        let snippet = generate_code_highlighting_snippet(
            CodeHighlightingBuilderRequest {
                engine: "listings".to_string(),
                language: "python".to_string(),
                ..CodeHighlightingBuilderRequest::default()
            },
            "print('DataTeX')".to_string(),
        );

        assert_eq!(
            snippet,
            "\\begin{lstlisting}[language=Python]\nprint('DataTeX')\n\\end{lstlisting}"
        );
    }

    #[test]
    fn generates_minted_only_language_snippet() {
        let snippet = generate_code_highlighting_snippet(
            CodeHighlightingBuilderRequest {
                engine: "minted".to_string(),
                language: "rust".to_string(),
                ..CodeHighlightingBuilderRequest::default()
            },
            "fn main() {}".to_string(),
        );

        assert_eq!(
            snippet,
            "\\begin{minted}{rust}\nfn main() {}\n\\end{minted}"
        );
    }
}
