import type { Monaco } from '@monaco-editor/react';

export const STOICHEIA_LANGUAGE_ID = 'stoicheia-latex';
export const STOICHEIA_THEME_ID = 'stoicheia-dark';
export const STOICHEIA_LIGHT_THEME_ID = 'stoicheia-light';

export const registerStoicheiaLanguage = (monaco: Monaco) => {
  if (!monaco.languages.getLanguages().some((language: { id: string }) => language.id === STOICHEIA_LANGUAGE_ID)) {
    monaco.languages.register({
      id: STOICHEIA_LANGUAGE_ID,
      aliases: ['Stoicheia', 'LaTeX + tkz-euclide'],
      extensions: ['.tex'],
    });
  }

  monaco.languages.setLanguageConfiguration(STOICHEIA_LANGUAGE_ID, {
    comments: { lineComment: '%' },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '$', close: '$' },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '$', close: '$' },
    ],
  });

  monaco.languages.setMonarchTokensProvider(STOICHEIA_LANGUAGE_ID, {
    defaultToken: '',
    tokenPostfix: '.stoicheia',
    tokenizer: {
      root: [
        [/%.*$/, 'comment'],
        [/(\\begin|\\end)(\s*)(\{)([^}]+)(\})/, ['keyword.environment', 'white', 'delimiter.environment', 'type.environment', 'delimiter.environment']],
        [/\\(?:documentclass|usepackage)\b/, 'keyword.preamble'],

        [/\\(?:tkzDefPoint|tkzDefPointWith|tkzDefPointsBy|tkzDefMidPoint|tkzDefGoldenRatio|tkzDefBarycentricPoint|tkzDefSimilitudeCenter|tkzDefHarmonic|tkzDefEquiPoints|tkzDefMidArc|tkzDefPointOnLine|tkzDefPointOnCircle|tkzGetVectxy|tkzGetPoint|tkzGetPoints|tkzDrawPoints|tkzLabelPoint|tkzLabelPoints|tkzAutoLabelPoints|tkzInterLL)\b/, 'function.point'],
        [/\\(?:tkzDrawLine|tkzDrawLines|tkzDrawSegment|tkzDrawSegments|tkzDrawPolySeg|tkzDrawPolygon|tkzDrawCircle|tkzDrawCircles|tkzDrawSemiCircle|tkzDrawSemiCircles|tkzDrawEllipse|tkzDrawArc|tkzDrawSector|tkzFillCircle|tkzFillPolygon|tkzFillSector|tkzFillAngle|tkzFillAngles)\b/, 'function.shape'],
        [/\\(?:tkzInit|tkzClip|tkzShowBB|tkzClipBB|tkzClipPolygon|tkzClipCircle|tkzClipSector|tkzSetUpPoint|tkzSetUpLine|tkzSetUpArc|tkzSetUpCompass|tkzSetUpLabel|tkzSetUpColors|tkzSetUpStyle|tkzCompass|tkzCompasss|tkzShowLine|tkzShowTransformation|tkzProtractor)\b/, 'keyword.environment'],
        [/\\(?:tkzDefLine|tkzDefCircle|tkzDefCircleBy|tkzDefProjExcenter|tkzDefRandPointOn|tkzInterLC|tkzTestInterLC|tkzInterCC|tkzTestInterCC|tkzFindAngle|tkzFindSlopeAngle|tkzGetAngle|tkzCalcLength|tkzGetLength|tkzpttocm|tkzcmtopt|tkzGetPointCoord|tkzSwapPoints|tkzDotProduct|tkzPowerCircle|tkzGetResult|tkzDuplicateSegment|tkzDuplicateLength|tkzDuplicateLen|tkzDefRadicalAxis|tkzIsLinear|tkzIsOrtho|tkzDefPointBy|tkzDefSpcTriangle|tkzDefTriangleCenter|tkzDefTriangle|tkzPermute|tkzDefSquare|tkzDefRectangle|tkzDefParallelogram|tkzDefGoldenRectangle|tkzDefGoldRectangle|tkzDefRegPolygon)\b/, 'function.construction'],
        [/\\(?:tkzMarkAngle|tkzMarkAngles|tkzMarkSegment|tkzMarkSegments|tkzMarkArc|tkzLabelAngle|tkzLabelAngles|tkzLabelCircle|tkzLabelArc|tkzLabelSegment|tkzLabelSegments|tkzLabelLine|tkzMarkRightAngle|tkzMarkRightAngles|tkzPicAngle|tkzPicRightAngle)\b/, 'function.annotation'],
        [/\\(?:draw|path|node|coordinate|fill|filldraw|clip)\b/, 'function.tikz'],
        [/\\[a-zA-Z@]+\*?/, 'keyword.command'],

        [/\[/, { token: 'delimiter.square', next: '@options' }],
        [/\$\$?/, { token: 'delimiter.math', next: '@math' }],
        [/[{}]/, 'delimiter.curly'],
        [/[()]/, 'delimiter.parenthesis'],
        [/:/, 'delimiter.coordinate'],
        [/-?(?:\d+\.?\d*|\.\d+)/, 'number.coordinate'],
      ],

      options: [
        [/%.*$/, 'comment'],
        [/\]/, { token: 'delimiter.square', next: '@pop' }],
        [/(color|fill|draw|opacity|line width|style|size|pos|mark|arc|mksize|mkcolor|mkpos|dotsize|angle radius|angle eccentricity|pic text|center|add|name|projection|orthogonal|perpendicular|parallel|tangent (?:at|from)|two angles|from|dist|K|translation|homothety|reflection|symmetry|rotation(?: in rad| with nodes)?|inversion(?: negative)?|colinear(?: normed)?)(\s*)(=)/, ['attribute.name', 'white', 'operator']],
        [/\b(?:red|blue|green|orange|yellow|purple|violet|magenta|cyan|teal|black|white|gray|grey|brown)\b/, 'string.color'],
        [/\b(?:dashed|dotted|densely dashed|densely dotted|loosely dashed|loosely dotted|thin|semithick|thick|very thick|ultra thick)\b/, 'attribute.value.style'],
        [/<->|->|<-/, 'operator.arrow'],
        [/-?(?:\d+\.?\d*|\.\d+)(?:pt|cm|mm)?/, 'number.option'],
        [/[{},()]/, 'delimiter.option'],
        [/,/, 'delimiter.comma'],
        [/[a-zA-Z][\w-]*/, 'attribute.value'],
      ],

      math: [
        [/\$\$?/, { token: 'delimiter.math', next: '@pop' }],
        [/\\[a-zA-Z]+/, 'keyword.math'],
        [/[{}_^]/, 'delimiter.math'],
        [/-?(?:\d+\.?\d*|\.\d+)/, 'number'],
      ],
    },
  });

  monaco.editor.defineTheme(STOICHEIA_THEME_ID, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '64748B', fontStyle: 'italic' },
      { token: 'keyword.environment', foreground: 'C084FC', fontStyle: 'bold' },
      { token: 'type.environment', foreground: 'E879F9' },
      { token: 'delimiter.environment', foreground: 'A78BFA' },
      { token: 'keyword.preamble', foreground: '94A3B8' },
      { token: 'function.point', foreground: '38BDF8', fontStyle: 'bold' },
      { token: 'function.shape', foreground: '34D399', fontStyle: 'bold' },
      { token: 'function.construction', foreground: 'FBBF24', fontStyle: 'bold' },
      { token: 'function.annotation', foreground: 'FB923C', fontStyle: 'bold' },
      { token: 'function.tikz', foreground: '2DD4BF' },
      { token: 'keyword.command', foreground: '93C5FD' },
      { token: 'attribute.name', foreground: 'F472B6' },
      { token: 'attribute.value', foreground: 'CBD5E1' },
      { token: 'attribute.value.style', foreground: 'FDE68A' },
      { token: 'string.color', foreground: 'FB7185', fontStyle: 'bold' },
      { token: 'operator', foreground: '94A3B8' },
      { token: 'operator.arrow', foreground: 'FACC15' },
      { token: 'number.coordinate', foreground: '67E8F9' },
      { token: 'number.option', foreground: 'A7F3D0' },
      { token: 'delimiter.square', foreground: 'F472B6' },
      { token: 'delimiter.curly', foreground: 'A78BFA' },
      { token: 'delimiter.parenthesis', foreground: '64748B' },
      { token: 'delimiter.coordinate', foreground: '22D3EE', fontStyle: 'bold' },
      { token: 'delimiter.math', foreground: 'FDE047' },
      { token: 'keyword.math', foreground: 'FACC15' },
    ],
    colors: {
      'editor.background': '#1E1E1E',
      'editor.foreground': '#D4D4D4',
      'editorLineNumber.foreground': '#858585',
      'editorLineNumber.activeForeground': '#C6C6C6',
      'editor.lineHighlightBackground': '#2A2D2E',
      'editor.selectionBackground': '#264F78',
      'editorCursor.foreground': '#AEAFAD',
      'editorBracketMatch.border': '#888888',
    },
  });

  monaco.editor.defineTheme(STOICHEIA_LIGHT_THEME_ID, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '64748B', fontStyle: 'italic' },
      { token: 'keyword.environment', foreground: '7C3AED', fontStyle: 'bold' },
      { token: 'type.environment', foreground: 'A21CAF' },
      { token: 'delimiter.environment', foreground: '8B5CF6' },
      { token: 'keyword.preamble', foreground: '475569' },
      { token: 'function.point', foreground: '0369A1', fontStyle: 'bold' },
      { token: 'function.shape', foreground: '047857', fontStyle: 'bold' },
      { token: 'function.construction', foreground: 'B45309', fontStyle: 'bold' },
      { token: 'function.annotation', foreground: 'C2410C', fontStyle: 'bold' },
      { token: 'function.tikz', foreground: '0F766E' },
      { token: 'keyword.command', foreground: '1D4ED8' },
      { token: 'attribute.name', foreground: 'BE185D' },
      { token: 'attribute.value', foreground: '334155' },
      { token: 'attribute.value.style', foreground: 'A16207' },
      { token: 'string.color', foreground: 'E11D48', fontStyle: 'bold' },
      { token: 'operator', foreground: '64748B' },
      { token: 'operator.arrow', foreground: 'CA8A04' },
      { token: 'number.coordinate', foreground: '0E7490' },
      { token: 'number.option', foreground: '047857' },
      { token: 'delimiter.square', foreground: 'DB2777' },
      { token: 'delimiter.curly', foreground: '7C3AED' },
      { token: 'delimiter.parenthesis', foreground: '64748B' },
      { token: 'delimiter.coordinate', foreground: '0891B2', fontStyle: 'bold' },
      { token: 'delimiter.math', foreground: 'A16207' },
      { token: 'keyword.math', foreground: 'B45309' },
    ],
    colors: {
      'editor.background': '#FBFCFE',
      'editor.foreground': '#1E293B',
      'editorLineNumber.foreground': '#94A3B8',
      'editorLineNumber.activeForeground': '#4F46E5',
      'editor.lineHighlightBackground': '#EEF4FF',
      'editor.selectionBackground': '#ADD6FF99',
      'editorCursor.foreground': '#4F46E5',
      'editorBracketMatch.border': '#6366F1',
    },
  });
};
