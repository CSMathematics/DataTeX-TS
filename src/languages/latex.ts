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
    'xdef'
  ],

  sections: [
    'part',
    'chapter',
    'section',
    'subsection',
    'subsubsection',
    'paragraph',
    'subparagraph'
  ],

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
    'rm'
  ],

  functions: [
    'label',
    'ref',
    'cite',
    'pageref',
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
    'printbibliography'
  ],

  tokenizer: {
    root: [
      // Environments: \begin{...} and \end{...}
      [
        /(\\(?:begin|end))(\s*)(\{)([a-zA-Z0-9*]+)(\})/,
        ['keyword', '', '@brackets', 'tag', '@brackets']
      ],

      // Commands
      [
        /(\\)([a-zA-Z@]+)/,
        [
          'keyword',
          {
            cases: {
              '@keywords': 'keyword',
              '@sections': 'tag',
              '@formatting': 'attribute.name',
              '@functions': 'variable',
              '@default': 'keyword'
            }
          }
        ]
      ],

      // Escaped characters or single-char commands
      [/(\\.)/, 'keyword'],

      // Brackets & delimiters
      [/[{}()[\]]/, '@brackets'],

      // Math mode
      [/\$\$/, 'string.math', '@displayMath'], // $$ ... $$
      [/\$/, 'string.math', '@inlineMath'], // $ ... $
      [/\\\[/, 'string.math', '@displayMathBracket'], // \[ ... \]
      [/\\\(/, 'string.math', '@inlineMathBracket'], // \( ... \)

      // Comments
      [/(%)(.*)$/, ['comment', 'comment.content']],

      // Numbers
      [/\d+/, 'number'],

      // Control characters
      [/[&]/, 'keyword']
    ],

    displayMath: [
      [/\$\$/, { token: 'string.math', next: '@pop' }],
      [/./, 'string.math']
    ],

    inlineMath: [
      [/\$/, { token: 'string.math', next: '@pop' }],
      [/./, 'string.math']
    ],

    displayMathBracket: [
      [/\\\]/, { token: 'string.math', next: '@pop' }],
      [/./, 'string.math']
    ],

    inlineMathBracket: [
      [/\\\)/, { token: 'string.math', next: '@pop' }],
      [/./, 'string.math']
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
        // Environments
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
        {
          label: 'equation',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{equation}',
            '\t$0',
            '\\end{equation}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Equation environment',
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
          documentation: 'Align environment',
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
          documentation: 'Gather environment',
          range
        },
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
          documentation: 'Figure environment',
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
          label: 'cases',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '\\begin{cases}',
            '\t$1 & \\text{if } $2 \\\\',
            '\t$3 & \\text{otherwise}',
            '\\end{cases}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Cases environment',
          range
        },
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
