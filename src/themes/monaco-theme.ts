// Ορισμός του "DataTex Dark" θέματος για τον Monaco Editor
export const dataTexDarkTheme = {
  base: 'vs-dark', // Βασίζεται στο Dark theme του VSCode
  inherit: true,
  rules: [
    // LaTeX specific highlighting rules
    { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' }, // \documentclass, \begin, etc.
    { token: 'comment', foreground: '6A9955', fontStyle: 'italic' }, // % Comments
    { token: 'string', foreground: 'CE9178' }, // Strings
    { token: 'string.math', foreground: 'CE9178' }, // Math formulas
    { token: 'variable', foreground: '9CDCFE' },
    { token: 'delimiter.bracket', foreground: 'FFD700' }, // [ ... ]
    { token: 'delimiter.parenthesis', foreground: 'D4D4D4' }, // { ... }
    { token: 'number', foreground: 'B5CEA8' },
    { token: 'tag', foreground: '4EC9B0' }, // Math symbols might fall here
    { token: 'attribute.name', foreground: 'DCDCAA' } // Formatting commands like \textbf
  ],
  colors: {
    'editor.background': '#1f1f1f', // Το σκούρο γκρι του VSCode
    'editor.foreground': '#D4D4D4',
    'editor.lineHighlightBackground': '#2a2a2a', // Η γραμμή που έχεις τον κέρσορα
    'editorCursor.foreground': '#A6E22E', // Πράσινος κέρσορας
    'editorWhitespace.foreground': '#3B3A32',
    'editorIndentGuide.background': '#404040',
    'editorLineNumber.foreground': '#858585'
  }
}
