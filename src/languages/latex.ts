import { languages, editor } from 'monaco-editor'

export const latexConfiguration: languages.LanguageConfiguration = {
  comments: {
    lineComment: '%'
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')']
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '$', close: '$' },
    { open: '"', close: '"' },
    { open: "'", close: "'" }
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '$', close: '$' },
    { open: '"', close: '"' },
    { open: "'", close: "'" }
  ],
  folding: {
    markers: {
      start: new RegExp('^\\s*\\\\begin\\{[a-zA-Z0-9]+\\}'),
      end: new RegExp('^\\s*\\\\end\\{[a-zA-Z0-9]+\\}')
    }
  }
}

export const latexLanguage: languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.latex',

  // Structural/control keywords
  keywords: [
    'begin',
    'end',
    'documentclass',
    'usepackage',
    'newcommand',
    'renewcommand',
    'providecommand',
    'newenvironment',
    'renewenvironment',
    'newtheorem',
    'input',
    'include',
    'if',
    'else',
    'fi',
    'def',
    'edef',
    'gdef',
    'xdef',
    'let'
  ],

  // Sectioning commands
  sections: [
    'part',
    'chapter',
    'section',
    'subsection',
    'subsubsection',
    'paragraph',
    'subparagraph'
  ],

  // Formatting commands
  formatting: [
    'textbf',
    'textit',
    'texttt',
    'textsf',
    'textsc',
    'textmd',
    'textlf',
    'emph',
    'underline',
    'boldmath',
    'bf',
    'it',
    'tt',
    'sc',
    'sf',
    'sl',
    'rm',
    'textrm',
    'textup',
    'textsl'
  ],

  // Reference commands
  references: [
    'label',
    'ref',
    'eqref',
    'pageref',
    'cite',
    'citep',
    'citet',
    'autocite',
    'footcite'
  ],

  // Document structure functions
  functions: [
    'url',
    'href',
    'title',
    'author',
    'date',
    'maketitle',
    'tableofcontents',
    'listoffigures',
    'listoftables',
    'item',
    'caption',
    'footnote',
    'centering',
    'raggedright',
    'raggedleft',
    'newpage',
    'clearpage',
    'cleardoublepage',
    'vspace',
    'hspace',
    'bibliographystyle',
    'bibliography',
    'printbibliography',
    'includegraphics',
    'include',
    'input'
  ],

  // Math environments
  mathEnvironments: [
    'equation',
    'equation*',
    'align',
    'align*',
    'gather',
    'gather*',
    'multline',
    'multline*',
    'split',
    'array',
    'matrix',
    'pmatrix',
    'bmatrix',
    'Bmatrix',
    'vmatrix',
    'Vmatrix',
    'cases',
    'displaymath',
    'eqnarray',
    'eqnarray*'
  ],

  // Math commands
  mathCommands: [
    // Greek letters
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'vartheta',
    'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'varpi', 'rho', 'varrho', 'sigma', 'varsigma',
    'tau', 'upsilon', 'phi', 'varphi', 'chi', 'psi', 'omega',
    'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega',
    
    // Math operators and functions
    'frac', 'dfrac', 'tfrac', 'cfrac',
    'sqrt', 'root',
    'sum', 'prod', 'int', 'iint', 'iiint', 'oint',
    'lim', 'limsup', 'liminf',
    'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
    'arcsin', 'arccos', 'arctan',
    'sinh', 'cosh', 'tanh', 'coth',
    'exp', 'ln', 'log', 'lg',
    'det', 'dim', 'ker', 'max', 'min', 'sup', 'inf',
    'gcd', 'deg', 'arg', 'hom',
    
    // Delimiters and brackets
    'left', 'right', 'big', 'Big', 'bigg', 'Bigg',
    'langle', 'rangle', 'lfloor', 'rfloor', 'lceil', 'rceil',
    
    // Arrows
    'leftarrow', 'rightarrow', 'leftrightarrow', 'Leftarrow', 'Rightarrow', 'Leftrightarrow',
    'uparrow', 'downarrow', 'updownarrow', 'Uparrow', 'Downarrow', 'Updownarrow',
    'longleftarrow', 'longrightarrow', 'longleftrightarrow',
    'Longleftarrow', 'Longrightarrow', 'Longleftrightarrow',
    'mapsto', 'longmapsto', 'hookrightarrow', 'hookleftarrow',
    'nearrow', 'searrow', 'swarrow', 'nwarrow',
    
    // Binary operators
    'times', 'div', 'cdot', 'circ', 'bullet', 'oplus', 'ominus', 'otimes', 'oslash', 'odot',
    'cup', 'cap', 'sqcup', 'sqcap', 'vee', 'wedge',
    'setminus', 'wr', 'diamond', 'bigtriangleup', 'bigtriangledown',
    'triangleleft', 'triangleright', 'star', 'ast',
    
    // Relations
    'leq', 'geq', 'equiv', 'approx', 'cong', 'simeq', 'sim', 'propto',
    'neq', 'pm', 'mp', 'll', 'gg',
    'subset', 'supset', 'subseteq', 'supseteq', 'in', 'ni', 'notin',
    'mid', 'parallel', 'perp', 'prec', 'succ', 'preceq', 'succeq',
    
    // Symbols
    'infty', 'partial', 'nabla', 'forall', 'exists', 'nexists',
    'emptyset', 'varnothing', 'ell', 'wp', 'Re', 'Im',
    'aleph', 'hbar', 'imath', 'jmath',
    
    // Accents and fonts
    'hat', 'widehat', 'tilde', 'widetilde', 'bar', 'overline', 'underline',
    'vec', 'dot', 'ddot', 'acute', 'grave', 'breve', 'check',
    'mathbf', 'mathit', 'mathrm', 'mathsf', 'mathtt', 'mathcal', 'mathbb', 'mathfrak',
    
    // Spacing
    'quad', 'qquad', 'hspace', 'vspace',
    
    // Text in math
    'text', 'mbox', 'textrm', 'textit', 'textbf'
  ],

  // Math operators (symbols, not commands)
  mathOperators: [
    '+', '-', '=', '<', '>', '/', '*', '|', ':', '!'
  ],

  tokenizer: {
    root: [
      // Comments - must be first to avoid interference
      [/(%)(.*?)$/, ['comment.line.latex', 'comment.content.latex']],

      // \begin{environment} and \end{environment}
      [
        /(\\)(begin|end)(\s*)(\{)([a-zA-Z0-9*]+)(\})/,
        [
          '',
          'keyword.control.latex',
          '',
          'delimiter.curly.latex',
          { 
            cases: {
              '@mathEnvironments': { token: 'entity.name.type.environment.math.latex', next: '@mathEnvironment.$5' },
              '@default': 'entity.name.type.environment.latex'
            }
          },
          'delimiter.curly.latex'
        ]
      ],

      // \documentclass{class} - highlight class name
      [
        /(\\)(documentclass)(\s*)(\[.*?\])?(\s*)(\{)([a-zA-Z0-9-]+)(\})/,
        [
          '',
          'keyword.control.latex',
          '',
          'meta.bracket.latex',
          '',
          'delimiter.curly.latex',
          'entity.name.class.latex',
          'delimiter.curly.latex'
        ]
      ],

      // \usepackage{package} - highlight package name
      [
        /(\\)(usepackage)((?:\s*\[.*?\])?)(\s*)(\{)/,
        [
          '',
          'keyword.control.latex',
          'meta.bracket.latex',
          '',
          { token: 'delimiter.curly.latex', next: '@packageContent' }
        ]
      ],

      // \newcommand, \renewcommand definitions
      [
        /(\\)(newcommand|renewcommand|providecommand|def|edef|gdef|xdef)(\s*)(\{)?(\\[a-zA-Z@]+)(\})?/,
        [
          '',
          'keyword.control.latex',
          '',
          'delimiter.curly.latex',
          'entity.name.function.user.latex',
          'delimiter.curly.latex'
        ]
      ],

      // Sectioning commands with arguments
      [
        /(\\)(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)(\s*)(\*)?((\[.*?\])?(\s*)(\{))/,
        [
          '',
          'entity.name.section.latex',
          '',
          'keyword.operator.latex',
          '',
          'meta.bracket.latex',
          '',
          { token: 'delimiter.curly.latex', next: '@sectionContent' }
        ]
      ],

      // Reference commands (\label, \ref, \cite, etc.)
      [
        /(\\)(label|ref|eqref|pageref|cite|citep|citet|autocite|footcite)(\s*)(\{)/,
        [
          '',
          'entity.name.reference.latex',
          '',
          { token: 'delimiter.curly.latex', next: '@referenceContent' }
        ]
      ],

      // Formatting commands with arguments
      [
        /(\\)(textbf|textit|texttt|textsf|textsc|textmd|textlf|emph|underline|boldmath|bf|it|tt|sc|sf|sl|rm|textrm|textup|textsl)(\s*)(\{)/,
        [
          '',
          'entity.name.function.formatting.latex',
          '',
          { token: 'delimiter.curly.latex', next: '@formattingContent' }
        ]
      ],

      // Generic LaTeX commands
      [
        /(\\)([a-zA-Z@]+)/,
        [
          '',
          {
            cases: {
              '@keywords': 'keyword.control.latex',
              '@sections': 'entity.name.section.latex',
              '@formatting': 'entity.name.function.formatting.latex',
              '@references': 'entity.name.reference.latex',
              '@functions': 'entity.name.function.latex',
              '@default': 'keyword.latex'
            }
          }
        ]
      ],

      // Display math: \[ ... \] - Must come before bracket delimiters!
      [/\\\[/, { token: 'keyword.math.delimiter.latex', next: '@displayMathBracket' }],

      // Display math: \] closing - Must come before bracket delimiters!
      [/\\\]/, 'keyword.math.delimiter.latex'],

      // Inline math: \( ... \) - Must come before parenthesis delimiters!
      [/\\\(/, { token: 'keyword.math.delimiter.latex', next: '@inlineMathBracket' }],

      // Inline math: \) closing - Must come before parenthesis delimiters!
      [/\\\)/, 'keyword.math.delimiter.latex'],

      // Display math: $$ ... $$
      [/\$\$/, { token: 'keyword.math.delimiter.latex', next: '@displayMath' }],

      // Inline math: $ ... $
      [/\$/, { token: 'keyword.math.delimiter.latex', next: '@inlineMath' }],

      // Escaped characters or single-char commands (\\, \_, \$, etc.)
      // This must come AFTER the specific math delimiters
      [/\\./, 'keyword.escape.latex'],

      // Brackets and delimiters
      [/[{}]/, 'delimiter.curly.latex'],
      [/[\[\]]/, 'delimiter.bracket.latex'],
      [/[()]/, 'delimiter.parenthesis.latex'],

      // Numbers (including decimals and LaTeX lengths like 12pt, 3.5cm)
      [/\d+\.?\d*\s*(pt|em|ex|cm|mm|in|pc|bp|dd|cc|sp)?/, 'constant.numeric.latex'],

      // Special characters
      [/[&~]/, 'keyword.operator.latex']
    ],

    // Section content (e.g., \section{Title Here})
    sectionContent: [
      [/\}/, { token: 'delimiter.curly.latex', next: '@pop' }],
      [/./, 'entity.name.section.content.latex']
    ],

    // Reference content (e.g., \ref{eq:label})
    referenceContent: [
      [/\}/, { token: 'delimiter.curly.latex', next: '@pop' }],
      [/./, 'entity.name.reference.content.latex']
    ],

    // Package content (e.g., \usepackage{amsmath,graphicx})
    packageContent: [
      [/\}/, { token: 'delimiter.curly.latex', next: '@pop' }],
      [/[a-zA-Z0-9_-]+/, 'entity.name.package.latex'],
      [/,/, 'delimiter.comma.latex'],
      [/\s+/, '']
    ],

    // Formatting content (e.g., \textbf{bold text})
    formattingContent: [
      [/\}/, { token: 'delimiter.curly.latex', next: '@pop' }],
      [/\$/, { token: 'keyword.math.delimiter.latex', next: '@inlineMath' }],
      [/(\\)([a-zA-Z@]+)/, ['', 'keyword.latex']],
      [/./, 'text.formatting.latex']
    ],

    // Math environment (equation, align, etc.)
    mathEnvironment: [
      // End of environment must match the start
      [
        /(\\)(end)(\s*)(\{)([a-zA-Z0-9*]+)(\})/,
        {
          cases: {
            '$5==$S2': [
              '',
              'keyword.control.latex',
              '',
              'delimiter.curly.latex',
              'entity.name.type.environment.math.latex',
              { token: 'delimiter.curly.latex', next: '@pop' }
            ],
            '@default': ['', 'keyword.control.latex', '', 'delimiter.curly.latex', 'entity.name.type.environment.math.latex', 'delimiter.curly.latex']
          }
        }
      ],
      { include: '@mathMode' }
    ],

    // Inline math mode: $ ... $
    inlineMath: [
      [/\$/, { token: 'keyword.math.delimiter.latex', next: '@pop' }],
      { include: '@mathMode' }
    ],

    // Display math mode: $$ ... $$
    displayMath: [
      [/\$\$/, { token: 'keyword.math.delimiter.latex', next: '@pop' }],
      { include: '@mathMode' }
    ],

    // Inline math mode: \( ... \)
    inlineMathBracket: [
      [/\\\)/, { token: 'keyword.math.delimiter.latex', next: '@pop' }],
      { include: '@mathMode' }
    ],

    // Display math mode: \[ ... \]
    displayMathBracket: [
      [/\\\]/, { token: 'keyword.math.delimiter.latex', next: '@pop' }],
      { include: '@mathMode' }
    ],

    // Common math mode content
    mathMode: [
      // Comments in math mode
      [/(%)(.*?)$/, ['comment.line.latex', 'comment.content.latex']],

      // Math commands
      [
        /(\\)([a-zA-Z@]+)/,
        [
          '',
          {
            cases: {
              '@mathCommands': 'entity.name.function.math.latex',
              '@references': 'entity.name.reference.latex',
              '@default': 'keyword.math.latex'
            }
          }
        ]
      ],

      // Escaped characters in math
      [/\\./, 'keyword.escape.math.latex'],

      // Numbers in math mode
      [/\d+\.?\d*/, 'constant.numeric.math.latex'],

      // Math operators
      [/[+\-=<>/*|:!]/, 'keyword.operator.math.latex'],

      // Subscript and superscript
      [/[_^]/, 'keyword.operator.subscript.latex'],

      // Delimiters in math
      [/[{}]/, 'delimiter.curly.math.latex'],
      [/[\[\]]/, 'delimiter.bracket.math.latex'],
      [/[()]/, 'delimiter.parenthesis.math.latex'],

      // Variables and identifiers (single letters typically)
      [/[a-zA-Z]/, 'variable.math.latex'],

      // Special symbols
      [/[&~]/, 'keyword.operator.math.latex']
    ]
  }
}

export function setupLatexProviders(monaco: any) {
  monaco.languages.registerCompletionItemProvider('my-latex', {
    provideCompletionItems: (model: editor.ITextModel, position: any) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };

      const suggestions = [
        // === ENVIRONMENTS ===
        
        // Lists
        {
          label: 'itemize',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{itemize}',
            '\t\\item $0',
            '\\end{itemize}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Bulleted list environment',
          range
        },
        {
          label: 'enumerate',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{enumerate}',
            '\t\\item $0',
            '\\end{enumerate}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Numbered list environment',
          range
        },
        {
          label: 'description',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{description}',
            '\t\\item[$1] $0',
            '\\end{description}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Description list environment',
          range
        },
        
        // Math Environments
        {
          label: 'equation',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{equation}',
            '\t$0',
            '\\end{equation}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Numbered equation',
          range
        },
        {
          label: 'equation*',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{equation*}',
            '\t$0',
            '\\end{equation*}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Unnumbered equation',
          range
        },
        {
          label: 'align',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{align}',
            '\t$0',
            '\\end{align}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Aligned equations',
          range
        },
        {
          label: 'align*',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{align*}',
            '\t$0',
            '\\end{align*}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Unnumbered aligned equations',
          range
        },
        {
          label: 'gather',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{gather}',
            '\t$0',
            '\\end{gather}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Centered equations',
          range
        },
        {
          label: 'multline',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{multline}',
            '\t$0',
            '\\end{multline}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Multi-line equation',
          range
        },
        {
          label: 'split',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{split}',
            '\t$0',
            '\\end{split}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Split equation (inside equation/align)',
          range
        },
        {
          label: 'cases',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{cases}',
            '\t$1 & \\text{if } $2 \\\\',
            '\t$3 & \\text{otherwise}',
            '\\end{cases}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Piecewise function',
          range
        },
        {
          label: 'matrix',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{matrix}',
            '\t$1 & $2 \\\\',
            '\t$3 & $4',
            '\\end{matrix}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Matrix (no delimiters)',
          range
        },
        {
          label: 'pmatrix',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{pmatrix}',
            '\t$1 & $2 \\\\',
            '\t$3 & $4',
            '\\end{pmatrix}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Matrix with parentheses',
          range
        },
        {
          label: 'bmatrix',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{bmatrix}',
            '\t$1 & $2 \\\\',
            '\t$3 & $4',
            '\\end{bmatrix}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Matrix with brackets',
          range
        },
        
        // Theorem Environments
        {
          label: 'theorem',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{theorem}[$1]',
            '\t$0',
            '\\end{theorem}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Theorem environment',
          range
        },
        {
          label: 'lemma',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{lemma}[$1]',
            '\t$0',
            '\\end{lemma}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Lemma environment',
          range
        },
        {
          label: 'proof',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{proof}',
            '\t$0',
            '\\end{proof}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Proof environment',
          range
        },
        {
          label: 'definition',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{definition}[$1]',
            '\t$0',
            '\\end{definition}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Definition environment',
          range
        },
        {
          label: 'corollary',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{corollary}[$1]',
            '\t$0',
            '\\end{corollary}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Corollary environment',
          range
        },
        {
          label: 'proposition',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{proposition}[$1]',
            '\t$0',
            '\\end{proposition}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Proposition environment',
          range
        },
        {
          label: 'example',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{example}',
            '\t$0',
            '\\end{example}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Example environment',
          range
        },
        {
          label: 'remark',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{remark}',
            '\t$0',
            '\\end{remark}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Remark environment',
          range
        },
        
        // Floats
        {
          label: 'figure',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{figure}[h]',
            '\t\\centering',
            '\t\\includegraphics[width=0.8\\textwidth]{$1}',
            '\t\\caption{$2}',
            '\t\\label{fig:$3}',
            '\\end{figure}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Figure with image',
          range
        },
        {
          label: 'table',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{table}[h]',
            '\t\\centering',
            '\t\\begin{tabular}{|c|c|}',
            '\t\t\\hline',
            '\t\t$1 & $2 \\\\',
            '\t\t\\hline',
            '\t\\end{tabular}',
            '\t\\caption{$3}',
            '\t\\label{tab:$4}',
            '\\end{table}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Table environment',
          range
        },
        {
          label: 'tabular',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{tabular}{${1:c|c|c}}',
            '\t\\hline',
            '\t$2 & $3 & $4 \\\\',
            '\t\\hline',
            '\t$0',
            '\\end{tabular}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Tabular data',
          range
        },
        
        // Other Environments
        {
          label: 'center',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{center}',
            '\t$0',
            '\\end{center}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Center environment',
          range
        },
        {
          label: 'quote',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{quote}',
            '\t$0',
            '\\end{quote}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Block quote',
          range
        },
        {
          label: 'verbatim',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{verbatim}',
            '\t$0',
            '\\end{verbatim}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Verbatim text',
          range
        },
        {
          label: 'abstract',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{abstract}',
            '\t$0',
            '\\end{abstract}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Abstract section',
          range
        },
        
        // === SECTIONING ===
        
        {
          label: 'section',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\section{$1}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Section heading',
          range
        },
        {
          label: 'subsection',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\subsection{$1}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Subsection heading',
          range
        },
        {
          label: 'subsubsection',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\subsubsection{$1}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Subsubsection heading',
          range
        },
        {
          label: 'chapter',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\chapter{$1}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Chapter heading (book/report)',
          range
        },
        {
          label: 'part',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\part{$1}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Part heading',
          range
        },
        
        // === FORMATTING ===
        
        {
          label: 'textbf',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\textbf{$1}$0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Bold text',
          range
        },
        {
          label: 'textit',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\textit{$1}$0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Italic text',
          range
        },
        {
          label: 'texttt',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\texttt{$1}$0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Monospace text',
          range
        },
        {
          label: 'underline',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\underline{$1}$0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Underlined text',
          range
        },
        {
          label: 'emph',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\emph{$1}$0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Emphasized text',
          range
        },
        
        // === REFERENCES ===
        
        {
          label: 'label',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\label{$1}$0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Create a label for referencing',
          range
        },
        {
          label: 'ref',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\ref{$1}$0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Reference to a label',
          range
        },
        {
          label: 'eqref',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\eqref{$1}$0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Reference to equation',
          range
        },
        {
          label: 'cite',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\cite{$1}$0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Citation',
          range
        },
        {
          label: 'footnote',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\footnote{$1}$0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Footnote',
          range
        },
        
        // === MATH COMMANDS ===
        
        {
          label: 'frac',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\frac{$1}{$2}$0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Fraction',
          range
        },
        {
          label: 'sqrt',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\sqrt{$1}$0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Square root',
          range
        },
        {
          label: 'sum',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\sum_{$1}^{$2} $0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Summation',
          range
        },
        {
          label: 'int',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\int_{$1}^{$2} $0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Integral',
          range
        },
        {
          label: 'lim',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\lim_{$1 \\to $2} $0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Limit',
          range
        },
        {
          label: 'prod',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '\\prod_{$1}^{$2} $0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Product',
          range
        },
        
        // === GENERIC ===
        
        {
            label: 'begin',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
                '\\begin{$1}',
                '\t$0',
                '\\end{$1}'
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Generic environment',
            range
        }
      ];

      return { suggestions: suggestions };
    }
  });
}
