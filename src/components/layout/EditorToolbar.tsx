import React from 'react';
import { Group, ActionIcon, Tooltip, Text } from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBold, faItalic, faUnderline, faStrikethrough, faFont, faPen, faCode,
  faQuoteRight, faEllipsisH, faListUl, faListOl, faSubscript, faSuperscript,
  faLink, faUnlink, faAlignLeft, faAlignCenter, faAlignRight, faAlignJustify,
  faUndo, faRedo
} from "@fortawesome/free-solid-svg-icons";

interface EditorToolbarProps {
  editor: any; // Monaco editor instance
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor }) => {
  if (!editor) return null;

  // --- Helper Functions ---
  const insertText = (text: string) => {
    const selection = editor.getSelection();
    if (!selection) return;
    const op = { range: selection, text: text, forceMoveMarkers: true };
    editor.executeEdits("toolbar", [op]);
    editor.focus();
  };

  const wrapSelection = (prefix: string, suffix: string) => {
    const selection = editor.getSelection();
    if (!selection) return;

    const model = editor.getModel();
    const text = model.getValueInRange(selection);

    const newText = `${prefix}${text}${suffix}`;
    const op = { range: selection, text: newText, forceMoveMarkers: true };

    editor.executeEdits("toolbar", [op]);

    // If text was empty, move cursor between tags
    if (text.length === 0) {
        // Adjust position: current position is after insertion.
        // We want it after prefix.
        // But executeEdits moves cursor to end of edit if forceMoveMarkers is true.
        // We need to calculate manually.
        const newPos = {
            lineNumber: selection.startLineNumber,
            column: selection.startColumn + prefix.length
        };
        editor.setPosition(newPos);
    }

    editor.focus();
  };

  const wrapEnvironment = (envName: string) => {
      wrapSelection(`\\begin{${envName}}\n`, `\n\\end{${envName}}`);
  };

  const handleUndo = () => editor.trigger('toolbar', 'undo', null);
  const handleRedo = () => editor.trigger('toolbar', 'redo', null);

  // --- Toolbar Groups ---

  return (
    <Group p={4} bg="dark.7" gap={8} style={{ borderBottom: "1px solid var(--mantine-color-dark-6)", flexShrink: 0, overflowX: "auto" }}>

      {/* Formatting Group */}
      <Group gap={2} bg="dark.6" p={2} style={{ borderRadius: 4 }}>
        <Tooltip label="Bold (\textbf)"><ActionIcon variant="subtle" size="sm" onClick={() => wrapSelection('\\textbf{', '}')}><FontAwesomeIcon icon={faBold} /></ActionIcon></Tooltip>
        <Tooltip label="Italic (\textit)"><ActionIcon variant="subtle" size="sm" onClick={() => wrapSelection('\\textit{', '}')}><FontAwesomeIcon icon={faItalic} /></ActionIcon></Tooltip>
        <Tooltip label="Underline (\underline)"><ActionIcon variant="subtle" size="sm" onClick={() => wrapSelection('\\underline{', '}')}><FontAwesomeIcon icon={faUnderline} /></ActionIcon></Tooltip>
        <Tooltip label="Strikethrough (\st)"><ActionIcon variant="subtle" size="sm" onClick={() => wrapSelection('\\st{', '}')}><FontAwesomeIcon icon={faStrikethrough} /></ActionIcon></Tooltip>
        <Tooltip label="Text (\text)"><ActionIcon variant="subtle" size="sm" onClick={() => wrapSelection('\\text{', '}')}><FontAwesomeIcon icon={faFont} /></ActionIcon></Tooltip>
        <Tooltip label="Highlight (\hl)"><ActionIcon variant="subtle" size="sm" onClick={() => wrapSelection('\\hl{', '}')}><FontAwesomeIcon icon={faPen} /></ActionIcon></Tooltip>
        <Tooltip label="Code (\texttt)"><ActionIcon variant="subtle" size="sm" onClick={() => wrapSelection('\\texttt{', '}')}><FontAwesomeIcon icon={faCode} /></ActionIcon></Tooltip>
      </Group>

      {/* Headings Group */}
      <Group gap={2} bg="dark.6" p={2} style={{ borderRadius: 4 }}>
        <Tooltip label="Heading 1 (\section)"><ActionIcon variant="subtle" size="sm" w={28} onClick={() => wrapSelection('\\section{', '}')}><Text size="xs" fw={700}>H1</Text></ActionIcon></Tooltip>
        <Tooltip label="Heading 2 (\subsection)"><ActionIcon variant="subtle" size="sm" w={28} onClick={() => wrapSelection('\\subsection{', '}')}><Text size="xs" fw={700} c="blue.4">H2</Text></ActionIcon></Tooltip>
        <Tooltip label="Heading 3 (\subsubsection)"><ActionIcon variant="subtle" size="sm" w={28} onClick={() => wrapSelection('\\subsubsection{', '}')}><Text size="xs" fw={700}>H3</Text></ActionIcon></Tooltip>
        <Tooltip label="Heading 4 (\paragraph)"><ActionIcon variant="subtle" size="sm" w={28} onClick={() => wrapSelection('\\paragraph{', '}')}><Text size="xs" fw={700}>H4</Text></ActionIcon></Tooltip>
      </Group>

      {/* Lists & Quotes Group */}
      <Group gap={2} bg="dark.6" p={2} style={{ borderRadius: 4 }}>
        <Tooltip label="Quote environment"><ActionIcon variant="subtle" size="sm" onClick={() => wrapEnvironment('quote')}><FontAwesomeIcon icon={faQuoteRight} /></ActionIcon></Tooltip>
        <Tooltip label="Ellipsis (\dots)"><ActionIcon variant="subtle" size="sm" onClick={() => insertText('\\dots')}><FontAwesomeIcon icon={faEllipsisH} /></ActionIcon></Tooltip>
        <Tooltip label="Bullet List (itemize)"><ActionIcon variant="subtle" size="sm" onClick={() => insertText('\\begin{itemize}\n  \\item \n\\end{itemize}')}><FontAwesomeIcon icon={faListUl} /></ActionIcon></Tooltip>
        <Tooltip label="Numbered List (enumerate)"><ActionIcon variant="subtle" size="sm" onClick={() => insertText('\\begin{enumerate}\n  \\item \n\\end{enumerate}')}><FontAwesomeIcon icon={faListOl} /></ActionIcon></Tooltip>
        <Tooltip label="Subscript (_{})"><ActionIcon variant="subtle" size="sm" onClick={() => wrapSelection('_{', '}')}><FontAwesomeIcon icon={faSubscript} /></ActionIcon></Tooltip>
        <Tooltip label="Superscript (^{})"><ActionIcon variant="subtle" size="sm" onClick={() => wrapSelection('^{', '}')}><FontAwesomeIcon icon={faSuperscript} /></ActionIcon></Tooltip>
      </Group>

      {/* Links Group */}
      <Group gap={2} bg="dark.6" p={2} style={{ borderRadius: 4 }}>
        <Tooltip label="Link (\href)"><ActionIcon variant="subtle" size="sm" onClick={() => wrapSelection('\\href{url}{', '}')}><FontAwesomeIcon icon={faLink} /></ActionIcon></Tooltip>
        <Tooltip label="Unlink (Remove Link)"><ActionIcon variant="subtle" size="sm" disabled><FontAwesomeIcon icon={faUnlink} /></ActionIcon></Tooltip>
      </Group>

      {/* Alignment Group */}
      <Group gap={2} bg="dark.6" p={2} style={{ borderRadius: 4 }}>
        <Tooltip label="Align Left (flushleft)"><ActionIcon variant="subtle" size="sm" onClick={() => wrapEnvironment('flushleft')}><FontAwesomeIcon icon={faAlignLeft} /></ActionIcon></Tooltip>
        <Tooltip label="Align Center (center)"><ActionIcon variant="subtle" size="sm" onClick={() => wrapEnvironment('center')}><FontAwesomeIcon icon={faAlignCenter} /></ActionIcon></Tooltip>
        <Tooltip label="Align Right (flushright)"><ActionIcon variant="subtle" size="sm" onClick={() => wrapEnvironment('flushright')}><FontAwesomeIcon icon={faAlignRight} /></ActionIcon></Tooltip>
        <Tooltip label="Justify (default)"><ActionIcon variant="subtle" size="sm" disabled><FontAwesomeIcon icon={faAlignJustify} /></ActionIcon></Tooltip>
      </Group>

      {/* History Group */}
      <Group gap={2} bg="dark.6" p={2} style={{ borderRadius: 4 }}>
        <Tooltip label="Undo"><ActionIcon variant="subtle" size="sm" onClick={handleUndo}><FontAwesomeIcon icon={faUndo} /></ActionIcon></Tooltip>
        <Tooltip label="Redo"><ActionIcon variant="subtle" size="sm" onClick={handleRedo}><FontAwesomeIcon icon={faRedo} /></ActionIcon></Tooltip>
      </Group>

    </Group>
  );
};
