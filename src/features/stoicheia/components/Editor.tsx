import Editor from '@monaco-editor/react';
import { useEditorStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import {
  STOICHEIA_LANGUAGE_ID,
  STOICHEIA_LIGHT_THEME_ID,
  STOICHEIA_THEME_ID,
  registerStoicheiaLanguage,
} from '../editor/stoicheiaLanguage';

export function CodeEditor() {
  const { source, setSource, theme, showEditorMinimap, editorFontSize, editorWordWrap, editorLineNumbers } = useEditorStore(useShallow(state => ({
    source: state.source,
    setSource: state.setSource,
    theme: state.theme,
    showEditorMinimap: state.showEditorMinimap,
    editorFontSize: state.settings.editorFontSize,
    editorWordWrap: state.settings.editorWordWrap,
    editorLineNumbers: state.settings.editorLineNumbers,
  })));

  return (
    <div className="theme-editor w-full h-full">
      <Editor
        height="100%"
        beforeMount={registerStoicheiaLanguage}
        defaultLanguage={STOICHEIA_LANGUAGE_ID}
        theme={theme === 'dark' ? STOICHEIA_THEME_ID : STOICHEIA_LIGHT_THEME_ID}
        value={source}
        onChange={(val) => setSource(val || '')}
        options={{
          minimap: { enabled: showEditorMinimap },
          fontSize: editorFontSize,
          lineHeight: Math.round(editorFontSize * 1.62),
          fontLigatures: true,
          wordWrap: editorWordWrap ? 'on' : 'off',
          lineNumbers: editorLineNumbers ? 'on' : 'off',
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          padding: { top: 14, bottom: 14 },
          renderLineHighlight: 'line',
          scrollBeyondLastLine: false,
          overviewRulerBorder: false,
          folding: true,
          tabSize: 2,
          automaticLayout: true,
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
        }}
      />
    </div>
  );
}
