import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import test from "node:test";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { compile } from "../node_modules/monaco-editor/esm/vs/editor/standalone/common/monarch/monarchCompile.js";
import { MonarchTokenizer } from "../node_modules/monaco-editor/esm/vs/editor/standalone/common/monarch/monarchLexer.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const moduleUrlCache = new Map();

function resolveTypeScriptImport(importerPath, specifier) {
  const unresolved = resolve(dirname(importerPath), specifier);
  const candidates = extname(unresolved)
    ? [unresolved]
    : [
        unresolved,
        `${unresolved}.ts`,
        `${unresolved}.tsx`,
        resolve(unresolved, "index.ts"),
        resolve(unresolved, "index.tsx"),
      ];

  const resolvedPath = candidates.find((candidate) => existsSync(candidate));
  assert.ok(
    resolvedPath,
    `Cannot resolve TypeScript import ${JSON.stringify(specifier)} from ${importerPath}`,
  );
  return resolvedPath;
}

/**
 * Loads the project's small, browser-free TypeScript configuration modules in
 * Node without adding a test runner or a TS loader. Relative imports are
 * recursively converted to data URLs, so normal Vite-style extensionless
 * imports continue to work in this headless test.
 */
async function typeScriptModuleUrl(filePath) {
  const absolutePath = resolve(filePath);
  const cached = moduleUrlCache.get(absolutePath);
  if (cached) return cached;

  const loading = (async () => {
    const source = await readFile(absolutePath, "utf8");
    const transpiled = ts.transpileModule(source, {
      fileName: absolutePath,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
      },
      reportDiagnostics: true,
    });

    const errors = (transpiled.diagnostics ?? []).filter(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    );
    assert.deepEqual(
      errors,
      [],
      `TypeScript transpilation failed for ${absolutePath}`,
    );

    // transpileModule has already erased type-only imports. Rewriting quoted
    // relative module specifiers is sufficient for these configuration files.
    const relativeImport = /(["'])(\.\.?\/[^"'\n]+)\1/g;
    const matches = [...transpiled.outputText.matchAll(relativeImport)];
    let cursor = 0;
    let javascript = "";

    for (const match of matches) {
      const matchStart = match.index;
      const dependencyPath = resolveTypeScriptImport(absolutePath, match[2]);
      const dependencyUrl = await typeScriptModuleUrl(dependencyPath);
      javascript += transpiled.outputText.slice(cursor, matchStart);
      javascript += JSON.stringify(dependencyUrl);
      cursor = matchStart + match[0].length;
    }
    javascript += transpiled.outputText.slice(cursor);

    return `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`;
  })();

  moduleUrlCache.set(absolutePath, loading);
  return loading;
}

async function importTypeScript(relativePath) {
  const moduleUrl = await typeScriptModuleUrl(resolve(projectRoot, relativePath));
  return import(moduleUrl);
}

const { latexLanguage } = await importTypeScript("src/languages/latex.ts");
const latexThemeCustomization = await importTypeScript(
  "src/themes/latex-theme-customization.ts",
);
const {
  LATEX_EDITOR_THEME_IDS,
  LATEX_SYNTAX_COLOR_GROUPS,
  LATEX_SYNTAX_COLOR_SLOTS,
  LATEX_SYNTAX_FONT_STYLES,
  buildLatexTheme,
  getLatexThemeBackground,
  getResolvedLatexSyntaxColor,
  getResolvedLatexSyntaxFontStyles,
  normalizeLatexSyntaxColor,
  sanitizeLatexSyntaxColorOverrides,
  sanitizeLatexSyntaxHighlightingSettings,
  sanitizeLatexSyntaxThemeOverrides,
} = latexThemeCustomization;
const lexer = compile("my-latex", latexLanguage);

const disposable = { dispose() {} };
const languageService = {
  getLanguageIdByLanguageName() {},
  getLanguageIdByMimeType() {},
  isRegisteredLanguageId() {
    return false;
  },
  requestBasicLanguageFeatures() {},
  languageIdCodec: {
    encodeLanguageId() {
      return 1;
    },
  },
};
const themeService = {
  getColorTheme() {
    return { tokenTheme: {} };
  },
};
const configurationService = {
  getValue() {
    return 100_000;
  },
  onDidChangeConfiguration() {
    return disposable;
  },
};

function createTokenizer() {
  return new MonarchTokenizer(
    languageService,
    themeService,
    "my-latex",
    lexer,
    configurationService,
  );
}

function tokenizeDocument(source) {
  const tokenizer = createTokenizer();
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const tokenLines = [];
  let state = tokenizer.getInitialState();

  try {
    for (const line of lines) {
      const result = tokenizer.tokenize(line, true, state);
      tokenLines.push(result.tokens);
      state = result.endState;
    }
  } finally {
    tokenizer.dispose();
  }

  return { lines, tokenLines, state };
}

function nthIndexOf(text, needle, occurrence = 0) {
  let fromIndex = 0;
  let index = -1;
  for (let current = 0; current <= occurrence; current += 1) {
    index = text.indexOf(needle, fromIndex);
    if (index < 0) return -1;
    fromIndex = index + needle.length;
  }
  return index;
}

function scopeAt(document, lineNumber, needle, occurrence = 0) {
  const line = document.lines[lineNumber - 1];
  const offset = nthIndexOf(line, needle, occurrence);
  assert.notEqual(
    offset,
    -1,
    `Fixture line ${lineNumber} does not contain ${JSON.stringify(needle)}`,
  );

  const tokens = document.tokenLines[lineNumber - 1];
  let activeToken = tokens[0];
  for (const token of tokens) {
    if (token.offset > offset) break;
    activeToken = token;
  }
  return activeToken?.type ?? "";
}

function assertScope(document, lineNumber, needle, expected, occurrence = 0) {
  assert.equal(
    scopeAt(document, lineNumber, needle, occurrence),
    expected,
    `Unexpected scope for ${JSON.stringify(needle)} on line ${lineNumber}`,
  );
}

function assertRootState(document) {
  assert.equal(document.state.stack.state, "root");
  assert.equal(document.state.stack.depth, 1);
}

const existingLatexScopes = [
  "text.plain.latex",
  "keyword.control.latex",
  "keyword.latex",
  "keyword.escape.latex",
  "entity.name.type.environment.latex",
  "entity.name.type.environment.math.latex",
  "entity.name.type.environment.document.latex",
  "entity.name.type.environment.list.latex",
  "entity.name.type.environment.theorem.latex",
  "entity.name.type.environment.float.latex",
  "entity.name.type.environment.table.latex",
  "entity.name.type.environment.drawing.latex",
  "entity.name.type.environment.verbatim.latex",
  "entity.name.class.latex",
  "entity.name.package.latex",
  "entity.name.section.latex",
  "entity.name.section.content.latex",
  "entity.name.function.formatting.latex",
  "text.formatting.latex",
  "entity.name.reference.latex",
  "entity.name.reference.content.latex",
  "entity.name.function.latex",
  "entity.name.function.user.latex",
  "keyword.math.delimiter.latex",
  "entity.name.function.math.latex",
  "keyword.math.latex",
  "keyword.escape.math.latex",
  "keyword.operator.math.latex",
  "keyword.operator.subscript.latex",
  "constant.numeric.math.latex",
  "variable.math.latex",
  "delimiter.curly.math.latex",
  "delimiter.bracket.math.latex",
  "delimiter.parenthesis.math.latex",
  "comment.line.latex",
  "comment.content.latex",
  "constant.numeric.latex",
  "delimiter.curly.latex",
  "delimiter.bracket.latex",
  "delimiter.parenthesis.latex",
  "keyword.operator.latex",
  "meta.bracket.latex",
  "meta.block.latex",
  "delimiter.comma.latex",
];

const richLatexScopes = [
  "constant.language.math.greek.latex",
  "support.function.math.latex",
  "keyword.operator.math.large.latex",
  "keyword.operator.math.binary.latex",
  "keyword.operator.math.relation.latex",
  "keyword.operator.math.arrow.latex",
  "constant.language.math.symbol.latex",
  "entity.name.function.math.accent.latex",
  "storage.type.math.font.latex",
  "keyword.math.delimiter.command.latex",
  "keyword.math.spacing.latex",
  "string.math.text.latex",
  "delimiter.punctuation.math.latex",
  "keyword.operator.math.arithmetic.latex",
  "keyword.operator.math.relation.symbol.latex",
  "keyword.operator.math.logic.latex",
  "keyword.operator.alignment.math.latex",
  "keyword.operator.prime.math.latex",
  "attribute.name.latex",
  "keyword.operator.assignment.latex",
  "string.option-value.latex",
  "constant.numeric.option.latex",
  "string.verbatim.latex",
];

const requiredThemeScopes = [...existingLatexScopes, ...richLatexScopes];

const themeModules = [
  ["DataTeX Dark", "src/themes/monaco-theme.ts", "dataTexDarkTheme"],
  ["DataTeX Light", "src/themes/monaco-light.ts", "dataTexLightTheme"],
  ["High Contrast", "src/themes/monaco-hc.ts", "dataTexHCTheme"],
  ["Monokai", "src/themes/monaco-monokai.ts", "monokaiTheme"],
  ["Nord", "src/themes/monaco-nord.ts", "nordTheme"],
];

test("Monarch definition compiles and emits one LaTeX scope suffix", () => {
  assert.ok(Object.hasOwn(lexer.tokenizer, "root"));
  assert.ok(
    lexer.tokenPostfix === "" || lexer.tokenPostfix === ".latex",
    `Unexpected token postfix: ${lexer.tokenPostfix}`,
  );

  const document = tokenizeDocument(String.raw`\textbf{value} and $x+1$`);
  for (const token of document.tokenLines.flat()) {
    assert.ok(
      !token.type.endsWith(".latex.latex"),
      `Scope has a duplicated language postfix: ${token.type}`,
    );
  }
});

test("common structural commands and nested arguments never crash", () => {
  const document = tokenizeDocument(String.raw`\documentclass{article}
\documentclass[12pt]{book}
\usepackage[utf8]{amsmath,tikz}
\section{Outer \textbf{Inner} tail}
\section*[Short]{Long \emph{Title}}
\newcommand\foo[1]{\mathbf{#1}}
\def\bar#1{\textit{#1}}
\begin{document}
Body
\end{document}`);

  assertScope(document, 1, "documentclass", "keyword.control.latex");
  assertScope(document, 1, "article", "entity.name.class.latex");
  assertScope(document, 3, "amsmath", "entity.name.package.latex");
  assertScope(document, 4, "section", "entity.name.section.latex");
  assertScope(
    document,
    4,
    "textbf",
    "entity.name.function.formatting.latex",
  );
  assertScope(
    document,
    8,
    "document",
    "entity.name.type.environment.document.latex",
  );
  assertRootState(document);
});

test("inline and display math keep commands, numbers, operations and symbols distinct", () => {
  const document = tokenizeDocument(String.raw`Text $x_1 + 12.5 \sin(\alpha) \times y \leq \infty \rightarrow z'$
\[ \sum_{n=1}^{\infty} \frac{-3}{4} \in \mathbb{R},\quad n\neq0 \]
\( p \land q \Rightarrow p \)
$\left\langle \widehat{x}, \text{value} \right\rangle = y$`);

  assertScope(document, 1, "$", "keyword.math.delimiter.latex");
  // The first lowercase x is in "Text"; the second one is the math variable.
  assertScope(document, 1, "x", "variable.math.latex", 1);
  assertScope(document, 1, "_", "keyword.operator.subscript.latex");
  assertScope(document, 1, "+", "keyword.operator.math.arithmetic.latex");
  assertScope(document, 1, "12.5", "constant.numeric.math.latex");
  assertScope(document, 1, "sin", "support.function.math.latex");
  assertScope(document, 1, "alpha", "constant.language.math.greek.latex");
  assertScope(document, 1, "times", "keyword.operator.math.binary.latex");
  assertScope(document, 1, "leq", "keyword.operator.math.relation.latex");
  assertScope(document, 1, "infty", "constant.language.math.symbol.latex");
  assertScope(document, 1, "rightarrow", "keyword.operator.math.arrow.latex");
  assertScope(document, 1, "'", "keyword.operator.prime.math.latex");
  assertScope(document, 2, "sum", "keyword.operator.math.large.latex");
  assertScope(document, 2, "mathbb", "storage.type.math.font.latex");
  assertScope(document, 2, ",", "delimiter.punctuation.math.latex");
  assertScope(document, 2, "quad", "keyword.math.spacing.latex");
  assertScope(document, 3, "land", "keyword.operator.math.logic.latex");
  assertScope(
    document,
    4,
    "left",
    "keyword.math.delimiter.command.latex",
  );
  assertScope(
    document,
    4,
    "widehat",
    "entity.name.function.math.accent.latex",
  );
  assertScope(document, 4, "value", "string.math.text.latex");
  assertScope(
    document,
    4,
    "=",
    "keyword.operator.math.relation.symbol.latex",
  );
  assertRootState(document);
});

test("Unicode math glyphs receive the same semantic roles as command forms", () => {
  const document = tokenizeDocument(
    String.raw`$ α + Γ ∑_{n=1}^{∞} n × 2 ≤ x → y ∧ ∀ z ∈ ∅ $`,
  );

  assertScope(
    document,
    1,
    "α",
    "constant.language.math.greek.latex",
  );
  assertScope(
    document,
    1,
    "Γ",
    "constant.language.math.greek.latex",
  );
  assertScope(document, 1, "∑", "keyword.operator.math.large.latex");
  assertScope(document, 1, "∞", "constant.language.math.symbol.latex");
  assertScope(
    document,
    1,
    "×",
    "keyword.operator.math.arithmetic.latex",
  );
  assertScope(
    document,
    1,
    "≤",
    "keyword.operator.math.relation.symbol.latex",
  );
  assertScope(document, 1, "→", "keyword.operator.math.arrow.latex");
  assertScope(document, 1, "∧", "keyword.operator.math.logic.latex");
  assertScope(document, 1, "∀", "keyword.operator.math.logic.latex");
  assertScope(
    document,
    1,
    "∅",
    "constant.language.math.symbol.latex",
  );
  assertRootState(document);
});

test("the double-backslash row separator keeps its alignment scope", () => {
  const document = tokenizeDocument(String.raw`$a &= b \\ c &= d$`);

  assertScope(
    document,
    1,
    String.raw`\\`,
    "keyword.operator.alignment.math.latex",
  );
  assertScope(
    document,
    1,
    "&",
    "keyword.operator.alignment.math.latex",
  );
  assertRootState(document);
});

test("math text commands preserve nested textual payloads then resume math", () => {
  const document = tokenizeDocument(
    String.raw`$x + \text{rate \% for {nested text} is 50} + y$`,
  );

  assertScope(document, 1, "text", "string.math.text.latex");
  assertScope(document, 1, "rate", "string.math.text.latex");
  assertScope(document, 1, "nested text", "string.math.text.latex");
  assertScope(document, 1, "50", "string.math.text.latex");
  assertScope(
    document,
    1,
    "+",
    "keyword.operator.math.arithmetic.latex",
    1,
  );
  assertScope(document, 1, "y", "variable.math.latex");
  assertRootState(document);
});

test("LaTeX3 command names do not absorb ordinary math subscripts", () => {
  const document = tokenizeDocument(
    String.raw`$\tl_set:Nn x_1 + \foo_bar + \cs_if_exist:NTF y_2$`,
  );

  assertScope(document, 1, "tl_set:Nn", "keyword.math.latex");
  assertScope(document, 1, "cs_if_exist:NTF", "keyword.math.latex");
  assertScope(
    document,
    1,
    "_",
    "keyword.operator.subscript.latex",
    1,
  );
  assertScope(
    document,
    1,
    "_",
    "keyword.operator.subscript.latex",
    2,
  );
  assertScope(document, 1, "bar", "variable.math.latex");
  assertScope(document, 1, "2", "constant.numeric.math.latex");
  assertRootState(document);
});

test("nested AMS math environments return cleanly to text mode", () => {
  const source = String.raw`\begin{alignat*}{2}
f(x) &= \begin{cases}
1, & x > 0 \\
0, & x \leq 0
\end{cases} \\
A &= \begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}
\end{alignat*}
plain 42 text`;
  const document = tokenizeDocument(source);

  assertScope(
    document,
    1,
    "alignat*",
    "entity.name.type.environment.math.latex",
  );
  assertScope(
    document,
    2,
    "cases",
    "entity.name.type.environment.math.latex",
  );
  assertScope(
    document,
    6,
    "pmatrix",
    "entity.name.type.environment.math.latex",
  );
  assertScope(
    document,
    3,
    "&",
    "keyword.operator.alignment.math.latex",
  );
  assertScope(document, 8, "plain", "text.plain.latex");
  assertScope(document, 8, "42", "constant.numeric.latex");
  assertRootState(document);
});

test("all common math environment families enter math mode", () => {
  const mathEnvironments = [
    "math",
    "displaymath",
    "equation",
    "equation*",
    "align",
    "align*",
    "alignat",
    "alignat*",
    "aligned",
    "alignedat",
    "gather",
    "gather*",
    "gathered",
    "multline",
    "multline*",
    "flalign",
    "flalign*",
    "split",
    "array",
    "matrix",
    "smallmatrix",
    "pmatrix",
    "bmatrix",
    "Bmatrix",
    "vmatrix",
    "Vmatrix",
    "cases",
    "dcases",
    "rcases",
    "eqnarray",
    "eqnarray*",
    "IEEEeqnarray",
  ];

  for (const environment of mathEnvironments) {
    const document = tokenizeDocument(
      `\\begin{${environment}} x_1 + 2 \\end{${environment}}`,
    );
    assertScope(
      document,
      1,
      environment,
      "entity.name.type.environment.math.latex",
    );
    assertScope(document, 1, "+", "keyword.operator.math.arithmetic.latex");
    assertRootState(document);
  }
});

test("math-like package environment names use the broad math fallback", () => {
  const source = String.raw`\begin{custommatrix@v2*}
a_1 + 2
\end{custommatrix@v2*}
\begin{researchalignbox*}
x \leq y
\end{researchalignbox*}
plain text`;
  const document = tokenizeDocument(source);

  assertScope(
    document,
    1,
    "custommatrix@v2*",
    "entity.name.type.environment.math.latex",
  );
  assertScope(document, 2, "+", "keyword.operator.math.arithmetic.latex");
  assertScope(
    document,
    4,
    "researchalignbox*",
    "entity.name.type.environment.math.latex",
  );
  assertScope(document, 5, "leq", "keyword.operator.math.relation.latex");
  assertScope(document, 7, "plain", "text.plain.latex");
  assertRootState(document);
});

test("generic, starred and punctuation-rich environment names stay structural", () => {
  const document = tokenizeDocument(String.raw`\begin{tikzpicture}
\end{tikzpicture}
\begin{custom-env@v2*}
content
\end{custom-env@v2*}`);

  assertScope(
    document,
    1,
    "tikzpicture",
    "entity.name.type.environment.drawing.latex",
  );
  assertScope(
    document,
    3,
    "custom-env@v2*",
    "entity.name.type.environment.latex",
  );
  assertRootState(document);
});

test("comments, escaped percent signs and verbatim constructs do not leak states", () => {
  const document = tokenizeDocument(String.raw`% $x$ \section{not syntax}
escaped \% value
\verb|$x \command % literal|
\begin{verbatim}
$x + 1$ \command % literal
\end{verbatim}
\begin{lstlisting}[language=TeX]
\section{still literal} % literal
\end{lstlisting}
\begin{minted}{python}
print("$x$ % literal")
\end{minted}
\section{Syntax again}`);

  assertScope(document, 1, "%", "comment.line.latex");
  assertScope(document, 2, "%", "keyword.escape.latex");
  assertScope(document, 3, "$x", "string.verbatim.latex");
  assertScope(document, 5, "$x", "string.verbatim.latex");
  assertScope(document, 8, "section", "string.verbatim.latex");
  assertScope(document, 11, "print", "string.verbatim.latex");
  assertScope(document, 13, "section", "entity.name.section.latex");
  assertRootState(document);
});

test("starred verbatim environments remain literal and close cleanly", () => {
  const document = tokenizeDocument(String.raw`\begin{verbatim*}
$x + 1$ \section{literal} % still literal
\end{verbatim*}
\section{Syntax again}`);

  assertScope(
    document,
    1,
    "verbatim*",
    "entity.name.type.environment.verbatim.latex",
  );
  assertScope(document, 2, "section", "string.verbatim.latex");
  assertScope(
    document,
    3,
    "verbatim*",
    "entity.name.type.environment.verbatim.latex",
  );
  assertScope(document, 4, "section", "entity.name.section.latex");
  assertRootState(document);
});

test("TikZ and package options distinguish keys, values, assignments and numbers", () => {
  const document = tokenizeDocument(String.raw`\draw[line width=0.7pt, color={rgb,255:red,145;green,65;blue,172}, dashed] (A) -- ++(1,2);
\node[above right=2mm and 3mm, draw=cyan] {$\Gamma_2$};
\section{normal state}`);

  assertScope(document, 1, "line width", "attribute.name.latex");
  assertScope(document, 1, "=", "keyword.operator.assignment.latex");
  assertScope(document, 1, "0.7pt", "constant.numeric.option.latex");
  assertScope(document, 1, "rgb", "string.option-value.latex");
  assertScope(document, 1, ",", "delimiter.comma.latex");
  assertScope(document, 2, "above right", "attribute.name.latex");
  assertScope(document, 2, "cyan", "string.option-value.latex");
  assertScope(document, 2, "Gamma", "constant.language.math.greek.latex");
  assertScope(document, 3, "section", "entity.name.section.latex");
  assertRootState(document);
});

test("nested braced option values return to keys after every comma", () => {
  const document = tokenizeDocument(String.raw`\draw[
  color={rgb,255:red,{145;green,65}},
  line width=0.7pt,
  decoration={markings, mark=at position 0.5 with {\node[above] {A};}},
  after key=2mm,
  dashed
] (A) -- (B);
\section{normal state}`);

  assertScope(document, 2, "color", "attribute.name.latex");
  assertScope(document, 2, "rgb", "string.option-value.latex");
  assertScope(document, 2, "255", "constant.numeric.option.latex");
  assertScope(document, 3, "line width", "attribute.name.latex");
  assertScope(document, 3, "0.7pt", "constant.numeric.option.latex");
  assertScope(document, 4, "decoration", "attribute.name.latex");
  assertScope(document, 5, "after key", "attribute.name.latex");
  assertScope(document, 5, "2mm", "constant.numeric.option.latex");
  assertScope(document, 6, "dashed", "attribute.name.latex");
  assertScope(document, 8, "section", "entity.name.section.latex");
  assertRootState(document);
});

test("each editor theme maps the complete LaTeX taxonomy with a varied math palette", async () => {
  const mathVarietyScopes = [
    "constant.numeric.math.latex",
    "keyword.operator.math.arithmetic.latex",
    "keyword.operator.math.relation.latex",
    "constant.language.math.symbol.latex",
    "constant.language.math.greek.latex",
    "support.function.math.latex",
  ];
  const bracketColors = [
    "editorBracketHighlight.foreground1",
    "editorBracketHighlight.foreground2",
    "editorBracketHighlight.foreground3",
    "editorBracketHighlight.foreground4",
    "editorBracketHighlight.foreground5",
    "editorBracketHighlight.foreground6",
    "editorBracketHighlight.unexpectedBracket.foreground",
  ];

  for (const [label, modulePath, exportName] of themeModules) {
    const themeModule = await importTypeScript(modulePath);
    const theme = themeModule[exportName];
    assert.ok(theme, `${label} does not export ${exportName}`);

    const rulesByScope = new Map(theme.rules.map((rule) => [rule.token, rule]));
    for (const scope of requiredThemeScopes) {
      assert.ok(rulesByScope.has(scope), `${label} does not style ${scope}`);
    }

    const mathForegrounds = new Set(
      mathVarietyScopes.map((scope) => rulesByScope.get(scope)?.foreground),
    );
    mathForegrounds.delete(undefined);
    assert.ok(
      mathForegrounds.size >= 4,
      `${label} needs at least four distinct colors across core math roles`,
    );

    for (const colorKey of bracketColors) {
      assert.match(
        theme.colors[colorKey] ?? "",
        /^#[0-9a-f]{6,8}$/i,
        `${label} does not define ${colorKey}`,
      );
    }
  }
});

test("every customization slot has complete bilingual metadata and resolves in every theme", () => {
  const groupIds = new Set(LATEX_SYNTAX_COLOR_GROUPS.map(({ id }) => id));
  const slotIds = new Set();
  const mappedScopes = new Set(
    LATEX_SYNTAX_COLOR_SLOTS.flatMap(({ tokenScopes = [] }) => tokenScopes),
  );

  assert.equal(LATEX_EDITOR_THEME_IDS.length, 5);
  assert.equal(groupIds.size, LATEX_SYNTAX_COLOR_GROUPS.length);
  for (const scope of [
    ...requiredThemeScopes,
    "string",
    "string.math",
    "variable",
    "number",
    "tag",
    "attribute.name",
  ]) {
    assert.ok(mappedScopes.has(scope), `${scope} has no customization slot`);
  }

  for (const group of LATEX_SYNTAX_COLOR_GROUPS) {
    assert.ok(group.label.trim(), `${group.id} needs an English label`);
    assert.ok(group.labelEl.trim(), `${group.id} needs a Greek label`);
    assert.ok(group.description.trim(), `${group.id} needs an English description`);
    assert.ok(group.descriptionEl.trim(), `${group.id} needs a Greek description`);
  }

  for (const colorSlot of LATEX_SYNTAX_COLOR_SLOTS) {
    assert.ok(!slotIds.has(colorSlot.id), `Duplicate slot id: ${colorSlot.id}`);
    slotIds.add(colorSlot.id);
    assert.ok(groupIds.has(colorSlot.groupId), `${colorSlot.id} has an unknown group`);
    assert.ok(colorSlot.label.trim(), `${colorSlot.id} needs an English label`);
    assert.ok(colorSlot.labelEl.trim(), `${colorSlot.id} needs a Greek label`);
    assert.ok(colorSlot.description.trim(), `${colorSlot.id} needs an English description`);
    assert.ok(colorSlot.descriptionEl.trim(), `${colorSlot.id} needs a Greek description`);
    assert.ok(colorSlot.sample.length > 0, `${colorSlot.id} needs a preview sample`);
    assert.ok(
      (colorSlot.tokenScopes?.length ?? 0) +
        (colorSlot.editorColorKeys?.length ?? 0) >
        0,
      `${colorSlot.id} is not connected to a Monaco color`,
    );

    for (const themeId of LATEX_EDITOR_THEME_IDS) {
      assert.match(
        getResolvedLatexSyntaxColor(themeId, colorSlot.id),
        /^#[0-9A-F]{6}$/,
        `${themeId}/${colorSlot.id} does not resolve to #RRGGBB`,
      );
    }
  }
});

test("semantic slots are independent and override only their exact Monaco targets", () => {
  const baseTheme = buildLatexTheme("data-tex-dark");
  const scopeOwners = new Map();
  const colorKeyOwners = new Map();

  for (const colorSlot of LATEX_SYNTAX_COLOR_SLOTS) {
    for (const scope of colorSlot.tokenScopes ?? []) {
      assert.ok(!scopeOwners.has(scope), `${scope} belongs to multiple slots`);
      scopeOwners.set(scope, colorSlot.id);
    }
    for (const colorKey of colorSlot.editorColorKeys ?? []) {
      assert.ok(!colorKeyOwners.has(colorKey), `${colorKey} belongs to multiple slots`);
      colorKeyOwners.set(colorKey, colorSlot.id);
    }
  }

  for (const colorSlot of LATEX_SYNTAX_COLOR_SLOTS) {
    const customized = buildLatexTheme("data-tex-dark", {
      [colorSlot.id]: "#123456",
    });

    assert.equal(
      getResolvedLatexSyntaxColor("data-tex-dark", colorSlot.id, {
        [colorSlot.id]: "#123456",
      }),
      "#123456",
    );

    for (let index = 0; index < baseTheme.rules.length; index += 1) {
      const baseRule = baseTheme.rules[index];
      const customRule = customized.rules[index];
      const isTarget = colorSlot.tokenScopes?.includes(baseRule.token) ?? false;
      assert.equal(
        customRule.foreground,
        isTarget ? "123456" : baseRule.foreground,
        `${colorSlot.id} unexpectedly changed ${baseRule.token}`,
      );
      assert.equal(
        customRule.fontStyle,
        baseRule.fontStyle,
        `${colorSlot.id} lost the font style for ${baseRule.token}`,
      );
    }

    for (const [colorKey, baseColor] of Object.entries(baseTheme.colors)) {
      const isTarget = colorSlot.editorColorKeys?.includes(colorKey) ?? false;
      assert.equal(
        customized.colors[colorKey],
        isTarget ? "#123456" : baseColor,
        `${colorSlot.id} unexpectedly changed ${colorKey}`,
      );
    }
  }
});

test("v1 colors migrate to v2 slot styles and persistence sanitizers prune malformed data", () => {
  assert.equal(normalizeLatexSyntaxColor(" #a1b2c3 "), "#A1B2C3");
  assert.equal(normalizeLatexSyntaxColor("abc"), "#AABBCC");
  assert.equal(normalizeLatexSyntaxColor("#0F8"), "#00FF88");
  assert.equal(normalizeLatexSyntaxColor("#12345678"), undefined);
  assert.equal(normalizeLatexSyntaxColor("transparent"), undefined);
  assert.equal(normalizeLatexSyntaxColor(null), undefined);

  assert.deepEqual(
    sanitizeLatexSyntaxColorOverrides({
      command: "#abcdef",
      mathVariable: {
        foreground: "0f8",
        fontStyles: {
          bold: true,
          italic: false,
          underline: "invalid",
          strikethrough: false,
          futureStyle: true,
        },
        background: "#FFFFFF",
      },
      editorBackground: {
        foreground: "101010",
        fontStyles: { bold: true },
      },
      bracketLevel1: { fontStyles: { italic: true } },
      mathNumber: { foreground: "bad-value", fontStyles: {} },
      unknownSlot: "#112233",
    }),
    {
      command: { foreground: "#ABCDEF" },
      mathVariable: {
        foreground: "#00FF88",
        fontStyles: {
          bold: true,
          italic: false,
          strikethrough: false,
        },
      },
      editorBackground: { foreground: "#101010" },
    },
  );
  assert.deepEqual(
    sanitizeLatexSyntaxThemeOverrides({
      "data-tex-dark": { command: "112233" },
      "unknown-theme": { command: "#445566" },
      "data-tex-light": { command: "nope" },
    }),
    {
      "data-tex-dark": {
        command: { foreground: "#112233" },
      },
    },
  );
  const migrated = sanitizeLatexSyntaxHighlightingSettings({
    version: 1,
    themes: {
      "data-tex-nord": {
        mathVariable: "#c0ffee",
        comment: {
          fontStyles: { italic: false, underline: true },
        },
      },
    },
    ignored: true,
  });
  assert.deepEqual(migrated, {
    version: 2,
    themes: {
      "data-tex-nord": {
        mathVariable: { foreground: "#C0FFEE" },
        comment: {
          fontStyles: { italic: false, underline: true },
        },
      },
    },
  });
  assert.deepEqual(
    sanitizeLatexSyntaxHighlightingSettings(migrated),
    migrated,
    "Sanitizing canonical v2 settings must be idempotent",
  );
  assert.deepEqual(sanitizeLatexSyntaxHighlightingSettings("corrupt"), {
    version: 2,
    themes: {},
  });
});

test("font-style overrides are tri-state, canonical and resolve across exact scopes", async () => {
  const { dataTexDarkTheme } = await importTypeScript(
    "src/themes/monaco-theme.ts",
  );
  const { dataTexHCTheme } = await importTypeScript("src/themes/monaco-hc.ts");
  const darkSnapshot = structuredClone(dataTexDarkTheme);
  const hcSnapshot = structuredClone(dataTexHCTheme);

  assert.deepEqual(LATEX_SYNTAX_FONT_STYLES, [
    "bold",
    "italic",
    "underline",
    "strikethrough",
  ]);
  assert.deepEqual(
    getResolvedLatexSyntaxFontStyles(
      "data-tex-dark",
      "controlCommand",
    ),
    {
      bold: true,
      italic: false,
      underline: false,
      strikethrough: false,
    },
  );

  const customized = buildLatexTheme("data-tex-dark", {
    controlCommand: { fontStyles: { bold: false } },
    command: {
      foreground: "#123456",
      fontStyles: { italic: true, strikethrough: true },
    },
    mathVariable: {
      fontStyles: { bold: true, underline: true, italic: false },
    },
  });
  const customizedRules = new Map(
    customized.rules.map((rule) => [rule.token, rule]),
  );

  assert.equal(
    customizedRules.get("keyword.control.latex").fontStyle,
    "",
    "An explicit false must clear the bundled bold style",
  );
  assert.equal(customizedRules.get("keyword.control.latex").foreground,
    dataTexDarkTheme.rules.find(
      ({ token }) => token === "keyword.control.latex",
    ).foreground,
  );
  assert.equal(customizedRules.get("keyword.latex").foreground, "123456");
  assert.equal(
    customizedRules.get("keyword.latex").fontStyle,
    "italic strikethrough",
  );
  assert.equal(
    customizedRules.get("variable.math.latex").fontStyle,
    "bold underline",
  );
  assert.deepEqual(
    getResolvedLatexSyntaxFontStyles("data-tex-dark", "command", {
      command: {
        fontStyles: { italic: true, strikethrough: true },
      },
    }),
    {
      bold: false,
      italic: true,
      underline: false,
      strikethrough: true,
    },
  );

  // The exact math-text scope is italic while Monaco's compatibility scope is
  // not, so the helper must expose an indeterminate state until overridden.
  assert.equal(
    getResolvedLatexSyntaxFontStyles("data-tex-dark", "mathText").italic,
    "mixed",
  );
  assert.equal(
    getResolvedLatexSyntaxFontStyles("data-tex-dark", "mathText", {
      mathText: { fontStyles: { italic: false } },
    }).italic,
    false,
  );

  const highContrastCustomized = buildLatexTheme("data-tex-hc", {
    environmentFloat: {
      fontStyles: { italic: false, bold: true },
    },
  });
  assert.equal(
    highContrastCustomized.rules.find(
      ({ token }) =>
        token === "entity.name.type.environment.float.latex",
    ).fontStyle,
    "bold underline",
    "Unspecified underline must remain inherited from the HC theme",
  );

  assert.deepEqual(dataTexDarkTheme, darkSnapshot, "The dark theme was mutated");
  assert.deepEqual(dataTexHCTheme, hcSnapshot, "The HC theme was mutated");
});

test("theme building is immutable, preserves font styles and customizes all bracket levels", async () => {
  const { dataTexHCTheme } = await importTypeScript("src/themes/monaco-hc.ts");
  const snapshot = structuredClone(dataTexHCTheme);
  const bracketOverrides = Object.fromEntries(
    [1, 2, 3, 4, 5, 6].map((level) => [
      `bracketLevel${level}`,
      `#00000${level}`,
    ]),
  );
  bracketOverrides.unexpectedBracket = "#FF0000";

  const customized = buildLatexTheme("data-tex-hc", {
    ...bracketOverrides,
    environmentFloat: "#123456",
    mathRelationCommand: "#654321",
  });

  assert.deepEqual(dataTexHCTheme, snapshot, "The static theme was mutated");
  assert.notEqual(customized, dataTexHCTheme);
  assert.notEqual(customized.rules, dataTexHCTheme.rules);
  assert.notEqual(customized.colors, dataTexHCTheme.colors);
  assert.equal(
    customized.rules.find(
      ({ token }) => token === "entity.name.type.environment.float.latex",
    )?.fontStyle,
    "italic underline",
  );
  assert.equal(
    customized.rules.find(
      ({ token }) => token === "keyword.operator.math.relation.latex",
    )?.fontStyle,
    "underline",
  );
  for (let level = 1; level <= 6; level += 1) {
    assert.equal(
      customized.colors[`editorBracketHighlight.foreground${level}`],
      `#00000${level}`,
    );
  }
  assert.equal(
    customized.colors["editorBracketHighlight.unexpectedBracket.foreground"],
    "#FF0000",
  );
  assert.equal(getLatexThemeBackground("data-tex-hc"), "#000000");
});

test("Monaco runtime redefines only changed themes and never remounts or switches them", async () => {
  const { applyLatexSyntaxThemeOverrides, configureLatexMonaco } =
    await importTypeScript("src/services/latexMonaco.ts");

  const createMonacoMock = () => {
    const definitions = [];
    const registeredLanguages = [];
    let providerRegistrations = 0;
    const monaco = {
      definitions,
      registeredLanguages,
      get providerRegistrations() {
        return providerRegistrations;
      },
      editor: {
        defineTheme(themeId, theme) {
          definitions.push({ themeId, theme });
        },
        setTheme() {
          assert.fail("Theme refresh must not call setTheme");
        },
      },
      languages: {
        CompletionItemKind: { Snippet: 27 },
        CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
        getLanguages() {
          return registeredLanguages.map((id) => ({ id }));
        },
        register({ id }) {
          registeredLanguages.push(id);
        },
        setMonarchTokensProvider() {},
        setLanguageConfiguration() {},
        registerCompletionItemProvider() {
          providerRegistrations += 1;
          return { dispose() {} };
        },
      },
    };
    return monaco;
  };

  // Applying before the first editor mounts must be retained for that editor.
  applyLatexSyntaxThemeOverrides({
    "data-tex-dark": { command: "#102030" },
  });

  const firstMonaco = createMonacoMock();
  const secondMonaco = createMonacoMock();
  configureLatexMonaco(firstMonaco);
  configureLatexMonaco(firstMonaco);
  configureLatexMonaco(secondMonaco);

  assert.equal(firstMonaco.definitions.length, 5);
  assert.equal(secondMonaco.definitions.length, 5);
  assert.equal(firstMonaco.providerRegistrations, 1);
  assert.equal(secondMonaco.providerRegistrations, 1);
  assert.equal(
    firstMonaco.definitions
      .find(({ themeId }) => themeId === "data-tex-dark")
      .theme.rules.find(({ token }) => token === "keyword.latex").foreground,
    "102030",
  );

  applyLatexSyntaxThemeOverrides({
    "data-tex-dark": { command: "#203040" },
  });
  assert.equal(firstMonaco.definitions.length, 6);
  assert.equal(secondMonaco.definitions.length, 6);
  assert.equal(firstMonaco.definitions.at(-1).themeId, "data-tex-dark");
  assert.equal(secondMonaco.definitions.at(-1).themeId, "data-tex-dark");

  // Semantic equality is a no-op, even when a fresh object is supplied.
  applyLatexSyntaxThemeOverrides({
    "data-tex-dark": { command: "#203040" },
  });
  assert.equal(firstMonaco.definitions.length, 6);
  assert.equal(secondMonaco.definitions.length, 6);

  // Canonical v2 and migrated v1 values are semantically equal.
  applyLatexSyntaxThemeOverrides({
    "data-tex-dark": { command: { foreground: "#203040" } },
  });
  assert.equal(firstMonaco.definitions.length, 6);
  assert.equal(secondMonaco.definitions.length, 6);

  applyLatexSyntaxThemeOverrides({
    "data-tex-dark": { command: "#203040" },
    "data-tex-light": { editorBackground: "#FAFAFA" },
  });
  assert.equal(firstMonaco.definitions.length, 7);
  assert.equal(secondMonaco.definitions.length, 7);
  assert.equal(firstMonaco.definitions.at(-1).themeId, "data-tex-light");

  applyLatexSyntaxThemeOverrides({
    "data-tex-dark": {
      command: {
        foreground: "#203040",
        fontStyles: { bold: true, italic: false },
      },
    },
    "data-tex-light": {
      editorBackground: { foreground: "#FAFAFA" },
    },
  });
  assert.equal(firstMonaco.definitions.length, 8);
  assert.equal(secondMonaco.definitions.length, 8);
  assert.equal(firstMonaco.definitions.at(-1).themeId, "data-tex-dark");
  assert.equal(
    firstMonaco.definitions.at(-1).theme.rules.find(
      ({ token }) => token === "keyword.latex",
    ).fontStyle,
    "bold",
  );

  // Fresh, deeply equal objects must not trigger an expensive theme redefine.
  applyLatexSyntaxThemeOverrides({
    "data-tex-dark": {
      command: {
        foreground: "203040",
        fontStyles: { italic: false, bold: true },
      },
    },
    "data-tex-light": {
      editorBackground: { foreground: "fafafa" },
    },
  });
  assert.equal(firstMonaco.definitions.length, 8);
  assert.equal(secondMonaco.definitions.length, 8);

  // `false` is a meaningful override and differs from both true and inherit.
  applyLatexSyntaxThemeOverrides({
    "data-tex-dark": {
      command: {
        foreground: "#203040",
        fontStyles: { bold: false, italic: false },
      },
    },
    "data-tex-light": {
      editorBackground: { foreground: "#FAFAFA" },
    },
  });
  assert.equal(firstMonaco.definitions.length, 9);
  assert.equal(secondMonaco.definitions.length, 9);
  assert.equal(
    firstMonaco.definitions.at(-1).theme.rules.find(
      ({ token }) => token === "keyword.latex",
    ).fontStyle,
    "",
  );
});

test("representative large documents tokenize within a safe smoke-test budget", () => {
  const block = String.raw`\section{Nested \textbf{title}}
\draw[line width=0.7pt, color=cyan] (0,0) -- (1,2);
\begin{align}
x_1 &= \sum_{n=1}^{10} \frac{n^2 + \alpha}{n+1} \\
y_2 &= \sin(x) \leq \infty
\end{align}`;
  const source = Array.from({ length: 400 }, () => block).join("\n");

  const startedAt = performance.now();
  const document = tokenizeDocument(source);
  const elapsed = performance.now() - startedAt;

  assertRootState(document);
  assert.ok(
    elapsed < 5_000,
    `Tokenizing the large fixture took ${elapsed.toFixed(1)}ms`,
  );
});
