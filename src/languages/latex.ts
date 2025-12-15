import { languages } from 'monaco-editor'

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
