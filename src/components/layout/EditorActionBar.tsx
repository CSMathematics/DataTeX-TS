import React, { useState, useCallback } from 'react';
import { Group, ActionIcon, Tooltip, Menu, Text, Box } from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay, faStop, faFilePdf, faSave, faCopy, faCut, faPaste,
  faUndo, faRedo, faSearch, faChevronRight
} from "@fortawesome/free-solid-svg-icons";
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';

interface EditorActionBarProps {
  editor: any; // Monaco editor instance
  onSave?: () => void;
  
  // Optional compile features
  onCompile?: (engine?: string) => void;
  onStopCompile?: () => void;
  isCompiling?: boolean;
  isTexFile?: boolean;
  
  // Optional PDF toggle
  onTogglePdf?: () => void;
  showPdfButton?: boolean;

  // Compact mode (smaller, no compile button)
  compact?: boolean;
}

export const EditorActionBar = React.memo<EditorActionBarProps>(({
  editor,
  onSave,
  onCompile,
  onStopCompile,
  isCompiling = false,
  isTexFile = true,
  onTogglePdf,
  showPdfButton = false,
  compact = false
}) => {
  const [selectedEngine, setSelectedEngine] = useState<string>('pdflatex');

  // --- Clipboard Handlers ---
  const handleCopy = useCallback(async () => {
    if (!editor) return;
    const selection = editor.getSelection();
    const model = editor.getModel();
    
    if (selection && model && !selection.isEmpty()) {
      const text = model.getValueInRange(selection);
      if (text) {
        try {
          await writeText(text);
        } catch (error) {
          console.error('Failed to copy to clipboard:', error);
        }
      }
    }
  }, [editor]);

  const handleCut = useCallback(async () => {
    if (!editor) return;
    const selection = editor.getSelection();
    const model = editor.getModel();
    
    if (selection && model && !selection.isEmpty()) {
      const text = model.getValueInRange(selection);
      if (text) {
        try {
          await writeText(text);
          editor.executeEdits('toolbar', [{ 
            range: selection, 
            text: '', 
            forceMoveMarkers: true 
          }]);
        } catch (error) {
          console.error('Failed to cut to clipboard:', error);
        }
      }
    }
  }, [editor]);

  const handlePaste = useCallback(async () => {
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;
    
    try {
      const text = await readText();
      if (text) {
        const selection = editor.getSelection();
        if (selection) {
          editor.executeEdits('toolbar', [{
            range: selection,
            text: text,
            forceMoveMarkers: true
          }]);
          // Move cursor to end of pasted text
          const lines = text.split('\n');
          const lastLine = lines[lines.length - 1];
          const newPosition = {
            lineNumber: selection.startLineNumber + lines.length - 1,
            column: lines.length === 1 ? selection.startColumn + lastLine.length : lastLine.length + 1
          };
          editor.setPosition(newPosition);
        }
      }
    } catch (e) {
      console.error("Failed to read from clipboard:", e);
    }
  }, [editor]);

  const handleUndo = useCallback(() => {
    editor?.focus();
    editor?.trigger('toolbar', 'undo');
  }, [editor]);

  const handleRedo = useCallback(() => {
    editor?.focus();
    editor?.trigger('toolbar', 'redo');
  }, [editor]);

  const handleFind = useCallback(() => {
    editor?.focus();
    editor?.trigger('toolbar', 'actions.find');
  }, [editor]);

  const handleSaveClick = useCallback(() => {
    onSave?.();
  }, [onSave]);

  const handleCompileClick = useCallback(() => {
    onCompile?.(selectedEngine);
  }, [onCompile, selectedEngine]);

  const handleSelectEngine = useCallback((engine: string) => {
    setSelectedEngine(engine);
  }, []);

  const iconSize = compact ? 11 : 14;
  const buttonSize = compact ? "xs" : "xs";

  return (
    <Group gap={compact ? 2 : 4} wrap="nowrap">
      {/* Compile Button (only if onCompile provided) */}
      {onCompile && (
        <>
          <Group gap={0} style={{ backgroundColor: 'transparent' }}>
            <Tooltip label={`Compile (${selectedEngine})`}>
              <ActionIcon 
                size={buttonSize} 
                variant="subtle" 
                color="green" 
                onClick={handleCompileClick} 
                loading={isCompiling} 
                disabled={!isTexFile || isCompiling}
                style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
              >
                {!isCompiling && <FontAwesomeIcon icon={faPlay} style={{ width: iconSize, height: iconSize }} />}
              </ActionIcon>
            </Tooltip>
            <Menu shadow="md" width={150} position="bottom-end">
              <Menu.Target>
                <ActionIcon 
                  size={buttonSize} 
                  variant="subtle" 
                  color="green" 
                  disabled={!isTexFile || isCompiling}
                  style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <FontAwesomeIcon icon={faChevronRight} style={{ width: 8, height: 8, transform: 'rotate(90deg)' }} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown bg="dark.7">
                <Menu.Label>Select Engine</Menu.Label>
                <Menu.Item onClick={() => handleSelectEngine('pdflatex')} rightSection={selectedEngine === 'pdflatex' && <Text size="xs" c="dimmed">✓</Text>}>PdfLaTeX</Menu.Item>
                <Menu.Item onClick={() => handleSelectEngine('xelatex')} rightSection={selectedEngine === 'xelatex' && <Text size="xs" c="dimmed">✓</Text>}>XeLaTeX</Menu.Item>
                <Menu.Item onClick={() => handleSelectEngine('lualatex')} rightSection={selectedEngine === 'lualatex' && <Text size="xs" c="dimmed">✓</Text>}>LuaLaTeX</Menu.Item>
                <Menu.Item onClick={() => handleSelectEngine('pythontex')} rightSection={selectedEngine === 'pythontex' && <Text size="xs" c="dimmed">✓</Text>}>PythonTeX</Menu.Item>
                <Menu.Divider />
                <Menu.Item onClick={() => handleSelectEngine('latex')} rightSection={selectedEngine === 'latex' && <Text size="xs" c="dimmed">✓</Text>}>LaTeX</Menu.Item>
                <Menu.Item onClick={() => handleSelectEngine('bibtex')} rightSection={selectedEngine === 'bibtex' && <Text size="xs" c="dimmed">✓</Text>}>BibTeX</Menu.Item>
                <Menu.Item onClick={() => handleSelectEngine('biber')} rightSection={selectedEngine === 'biber' && <Text size="xs" c="dimmed">✓</Text>}>Biber</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>

          {isCompiling && (
            <Tooltip label="Stop">
              <ActionIcon size={buttonSize} variant="subtle" color="red" onClick={onStopCompile}>
                <FontAwesomeIcon icon={faStop} style={{ width: iconSize, height: iconSize }} />
              </ActionIcon>
            </Tooltip>
          )}
        </>
      )}

      {/* PDF Toggle Button */}
      {showPdfButton && onTogglePdf && (
        <Tooltip label="PDF">
          <ActionIcon size={buttonSize} variant="subtle" color="gray.4" onClick={onTogglePdf}>
            <FontAwesomeIcon icon={faFilePdf} style={{ width: iconSize, height: iconSize }} />
          </ActionIcon>
        </Tooltip>
      )}

      {/* Save Button */}
      {onSave && (
        <Tooltip label="Save (Ctrl+S)">
          <ActionIcon size={buttonSize} variant="subtle" color="gray.4" onClick={handleSaveClick}>
            <FontAwesomeIcon icon={faSave} style={{ width: iconSize, height: iconSize }} />
          </ActionIcon>
        </Tooltip>
      )}

      {/* Separator */}
      <Box bg="dark.3" h="16px" w="1px" />

      {/* Clipboard Actions */}
      <Tooltip label="Copy">
        <ActionIcon size={buttonSize} variant="subtle" color="gray.4" onClick={handleCopy}>
          <FontAwesomeIcon icon={faCopy} style={{ width: iconSize, height: iconSize }} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Cut">
        <ActionIcon size={buttonSize} variant="subtle" color="gray.4" onClick={handleCut}>
          <FontAwesomeIcon icon={faCut} style={{ width: iconSize, height: iconSize }} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Paste">
        <ActionIcon size={buttonSize} variant="subtle" color="gray.4" onClick={handlePaste}>
          <FontAwesomeIcon icon={faPaste} style={{ width: iconSize, height: iconSize }} />
        </ActionIcon>
      </Tooltip>

      {/* Separator */}
      <Box bg="dark.3" h="16px" w="1px" />

      {/* Undo/Redo */}
      <Tooltip label="Undo">
        <ActionIcon size={buttonSize} variant="subtle" color="gray.4" onClick={handleUndo}>
          <FontAwesomeIcon icon={faUndo} style={{ width: iconSize, height: iconSize }} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Redo">
        <ActionIcon size={buttonSize} variant="subtle" color="gray.4" onClick={handleRedo}>
          <FontAwesomeIcon icon={faRedo} style={{ width: iconSize, height: iconSize }} />
        </ActionIcon>
      </Tooltip>

      {/* Find */}
      <Tooltip label="Find">
        <ActionIcon size={buttonSize} variant="subtle" color="gray.4" onClick={handleFind}>
          <FontAwesomeIcon icon={faSearch} style={{ width: iconSize, height: iconSize }} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
});
