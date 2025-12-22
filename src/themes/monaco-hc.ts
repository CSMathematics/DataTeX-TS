// Definition of "DataTex High Contrast" theme for Monaco Editor
export const dataTexHCTheme = {
  base: 'hc-black', // Based on High Contrast theme
  inherit: true,
  rules: [
    // LaTeX specific highlighting rules
    { token: 'keyword', foreground: 'FF0000', fontStyle: 'bold' }, // \documentclass, \begin, etc.
    { token: 'comment', foreground: '008000', fontStyle: 'italic' }, // % Comments
    { token: 'string', foreground: 'FFFF00' }, // Strings
    { token: 'string.math', foreground: 'FFFF00' }, // Math formulas
    { token: 'variable', foreground: '00FFFF' },
    { token: 'delimiter.bracket', foreground: 'FFFFFF' }, // [ ... ]
    { token: 'delimiter.parenthesis', foreground: 'FFFFFF' }, // { ... }
    { token: 'number', foreground: 'FFFFFF' },
    { token: 'tag', foreground: 'FFFFFF' },
    { token: 'attribute.name', foreground: 'FFA500' } // Formatting commands like \textbf
  ],
  colors: {
    'editor.background': '#000000',
    'editor.foreground': '#FFFFFF',
    'editor.lineHighlightBackground': '#FFFFFF20',
    'editorCursor.foreground': '#FFFFFF',
    'editorWhitespace.foreground': '#7C7C7C',
    'editorIndentGuide.background': '#FFFFFF',
    'editorLineNumber.foreground': '#FFFFFF'
  }
}
