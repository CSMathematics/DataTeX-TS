// Definition of "DataTex Light" theme for Monaco Editor
export const dataTexLightTheme = {
  base: 'vs', // Based on VSCode Light theme
  inherit: true,
  rules: [
    // LaTeX specific highlighting rules
    { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' }, // \documentclass, \begin, etc.
    { token: 'comment', foreground: '008000', fontStyle: 'italic' }, // % Comments
    { token: 'string', foreground: 'A31515' }, // Strings
    { token: 'string.math', foreground: 'A31515' }, // Math formulas
    { token: 'variable', foreground: '001080' },
    { token: 'delimiter.bracket', foreground: '800000' }, // [ ... ]
    { token: 'delimiter.parenthesis', foreground: '000000' }, // { ... }
    { token: 'number', foreground: '098658' },
    { token: 'tag', foreground: '800000' }, // Math symbols might fall here
    { token: 'attribute.name', foreground: 'FF0000' } // Formatting commands like \textbf
  ],
  colors: {
    'editor.background': '#FFFFFF',
    'editor.foreground': '#000000',
    'editor.lineHighlightBackground': '#E8E8E8',
    'editorCursor.foreground': '#000000',
    'editorWhitespace.foreground': '#D4D4D4',
    'editorIndentGuide.background': '#D3D3D3',
    'editorLineNumber.foreground': '#2B91AF'
  }
}
