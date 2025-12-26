import React, { useState, useLayoutEffect, useRef, useMemo } from 'react';
import { Group, ActionIcon, Tooltip, Menu, Text, Box } from "@mantine/core";
import { useElementSize } from '@mantine/hooks';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBold, faItalic, faUnderline, faStrikethrough, faFont, faPen, faCode,
  faQuoteRight, faEllipsisH, faListUl, faListOl, faSubscript, faSuperscript,
  faLink, faUnlink, faAlignLeft, faAlignCenter, faAlignRight, faAlignJustify,
  faUndo, faRedo, faEllipsisV
} from "@fortawesome/free-solid-svg-icons";

interface EditorToolbarProps {
  editor: any; // Monaco editor instance
}

export const EditorToolbar = React.memo<EditorToolbarProps>(({ editor }) => {
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
        const position = editor.getPosition();
        if (position) {
             const newPos = {
                lineNumber: position.lineNumber,
                column: position.column - suffix.length
            };
            editor.setPosition(newPos);
        }
    }
    editor.focus();
  };

  const wrapEnvironment = (envName: string) => {
      wrapSelection(`\\begin{${envName}}\n`, `\n\\end{${envName}}`);
  };

  const handleUndo = () => editor.trigger('toolbar', 'undo', null);
  const handleRedo = () => editor.trigger('toolbar', 'redo', null);

  // --- Toolbar Groups Configuration ---
  const toolbarGroups = useMemo(() => [
      {
          id: 'formatting',
          render: () => (
            <Group gap={2} bg="dark.7" p={2} style={{ borderRadius: 4, flexShrink: 0 }}>
                <Tooltip label="Bold (\textbf)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => wrapSelection('\\textbf{', '}')}><FontAwesomeIcon icon={faBold} /></ActionIcon></Tooltip>
                <Tooltip label="Italic (\textit)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => wrapSelection('\\textit{', '}')}><FontAwesomeIcon icon={faItalic} /></ActionIcon></Tooltip>
                <Tooltip label="Underline (\underline)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => wrapSelection('\\underline{', '}')}><FontAwesomeIcon icon={faUnderline} /></ActionIcon></Tooltip>
                <Tooltip label="Strikethrough (\st)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => wrapSelection('\\st{', '}')}><FontAwesomeIcon icon={faStrikethrough} /></ActionIcon></Tooltip>
                <Tooltip label="Text (\text)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => wrapSelection('\\text{', '}')}><FontAwesomeIcon icon={faFont} /></ActionIcon></Tooltip>
                <Tooltip label="Highlight (\hl)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => wrapSelection('\\hl{', '}')}><FontAwesomeIcon icon={faPen} /></ActionIcon></Tooltip>
                <Tooltip label="Code (\texttt)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => wrapSelection('\\texttt{', '}')}><FontAwesomeIcon icon={faCode} /></ActionIcon></Tooltip>
            </Group>
          )
      },
      {
          id: 'headings',
          render: () => (
            <Group gap={2} bg="dark.7" p={2} style={{ borderRadius: 4, flexShrink: 0 }}>
                <Tooltip label="Heading 1 (\chapter)"><ActionIcon variant="subtle" size="sm" color='gray.5' w={28} onClick={() => wrapSelection('\\chapter{', '}')}><Text size="xs" fw={700}>H1</Text></ActionIcon></Tooltip>
                <Tooltip label="Heading 2 (\section)"><ActionIcon variant="subtle" size="sm" color='gray.5' w={28} onClick={() => wrapSelection('\\section{', '}')}><Text size="xs" fw={700}>H2</Text></ActionIcon></Tooltip>
                <Tooltip label="Heading 3 (\subsection)"><ActionIcon variant="subtle" size="sm" color='gray.5' w={28} onClick={() => wrapSelection('\\subsection{', '}')}><Text size="xs" fw={700}>H3</Text></ActionIcon></Tooltip>
                <Tooltip label="Heading 4 (\subsubsection)"><ActionIcon variant="subtle" size="sm" color='gray.5' w={28} onClick={() => wrapSelection('\\subsubsection{', '}')}><Text size="xs" fw={700}>H4</Text></ActionIcon></Tooltip>
                <Tooltip label="Heading 5 (\paragraph)"><ActionIcon variant="subtle" size="sm" color='gray.5' w={28} onClick={() => wrapSelection('\\paragraph{', '}')}><Text size="xs" fw={700}>H5</Text></ActionIcon></Tooltip>
            </Group>
          )
      },
      {
          id: 'align',
          render: () => (
            <Group gap={2} bg="dark.7" p={2} style={{ borderRadius: 4, flexShrink: 0 }}>
                <Tooltip label="Align Left (flushleft)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => wrapEnvironment('flushleft')}><FontAwesomeIcon icon={faAlignLeft} /></ActionIcon></Tooltip>
                <Tooltip label="Align Center (center)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => wrapEnvironment('center')}><FontAwesomeIcon icon={faAlignCenter} /></ActionIcon></Tooltip>
                <Tooltip label="Align Right (flushright)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => wrapEnvironment('flushright')}><FontAwesomeIcon icon={faAlignRight} /></ActionIcon></Tooltip>
                <Tooltip label="Justify (default)"><ActionIcon variant="subtle" size="sm" color='gray.5' disabled><FontAwesomeIcon icon={faAlignJustify} /></ActionIcon></Tooltip>
            </Group>
          )
      },
      {
          id: 'lists',
          render: () => (
            <Group gap={2} bg="dark.7" p={2} style={{ borderRadius: 4, flexShrink: 0 }}>
                <Tooltip label="Quote environment"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => wrapEnvironment('quote')}><FontAwesomeIcon icon={faQuoteRight} /></ActionIcon></Tooltip>
                <Tooltip label="Ellipsis (\dots)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => insertText('\\dots')}><FontAwesomeIcon icon={faEllipsisH} /></ActionIcon></Tooltip>
                <Tooltip label="Bullet List (itemize)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => insertText('\\begin{itemize}\n  \\item \n\\end{itemize}')}><FontAwesomeIcon icon={faListUl} /></ActionIcon></Tooltip>
                <Tooltip label="Numbered List (enumerate)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => insertText('\\begin{enumerate}\n  \\item \n\\end{enumerate}')}><FontAwesomeIcon icon={faListOl} /></ActionIcon></Tooltip>
            </Group>
          )
        },
        {
            id: 'math',
            render: () => (
                <Group gap={2} bg="dark.7" p={2} style={{ borderRadius: 4, flexShrink: 0 }}>
                <Tooltip label="Inline Math ($...$)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => wrapSelection('$', '$')}><Text size="xs" fw={200}>Σ</Text></ActionIcon></Tooltip>
                    <Tooltip label="Display Math (\[...\])"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => wrapSelection('\\[', '\\]')}><Text size="xs" fw={700}>Σ</Text></ActionIcon></Tooltip>
                    <Tooltip label="Subscript (_{})"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => wrapSelection('_{', '}')}><FontAwesomeIcon icon={faSubscript} /></ActionIcon></Tooltip>
                    <Tooltip label="Superscript (^{})"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => wrapSelection('^{', '}')}><FontAwesomeIcon icon={faSuperscript} /></ActionIcon></Tooltip>
                </Group>
            )
      },
      {
            id: 'spacing',
            render: () => (
                <Group gap={2} bg="dark.7" p={2} style={{ borderRadius: 4, flexShrink: 0 }}>
                    <Tooltip label="Horizontal Space (\hspace)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => insertText('\\hspace{length}')}><Text size="xs" fw={700}>HS</Text></ActionIcon></Tooltip>
                    <Tooltip label="Vertical Space (\vspace)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => insertText('\\vspace{length}')}><Text size="xs" fw={700}>VS</Text></ActionIcon></Tooltip>
                    <Tooltip label="Small Space (\,)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => insertText('\\,')}><Text size="xs" fw={700}>,</Text></ActionIcon></Tooltip>
                    <Tooltip label="Medium Space (\:)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => insertText('\\:')}><Text size="xs" fw={700}>:</Text></ActionIcon></Tooltip>
                    <Tooltip label="Large Space (\;)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => insertText('\\;')}><Text size="xs" fw={700}>;</Text></ActionIcon></Tooltip>
                    <Tooltip label=" Negative Space (\!)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => insertText('\\!')}><Text size="xs" fw={700}>!</Text></ActionIcon></Tooltip>
                </Group>
            )
      },
      {
          id: 'links',
          render: () => (
            <Group gap={2} bg="dark.7" p={2} style={{ borderRadius: 4, flexShrink: 0 }}>
                <Tooltip label="Link (\href)"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={() => wrapSelection('\\href{url}{', '}')}><FontAwesomeIcon icon={faLink} /></ActionIcon></Tooltip>
                <Tooltip label="Unlink (Remove Link)"><ActionIcon variant="subtle" size="sm" color='gray.5' disabled><FontAwesomeIcon icon={faUnlink} /></ActionIcon></Tooltip>
            </Group>
          )
      },
      {
          id: 'history',
          render: () => (
            <Group gap={2} bg="dark.7" p={2} style={{ borderRadius: 4, flexShrink: 0 }}>
                <Tooltip label="Undo"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={handleUndo}><FontAwesomeIcon icon={faUndo} /></ActionIcon></Tooltip>
                <Tooltip label="Redo"><ActionIcon variant="subtle" size="sm" color='gray.5' onClick={handleRedo}><FontAwesomeIcon icon={faRedo} /></ActionIcon></Tooltip>
            </Group>
          )
      }
  ], [editor]);

  // --- Responsive Logic ---
  const { ref: containerRef, width: containerWidth } = useElementSize();
  const [groupWidths, setGroupWidths] = useState<number[]>([]);
  
  // NEW STATE: Track if we have finished measuring
  const [measurementsDone, setMeasurementsDone] = useState(false);
  
  const ghostRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Measure ghost elements
  useLayoutEffect(() => {
     // If we haven't measured yet, and we have refs
     if (!measurementsDone && ghostRefs.current.length > 0) {
         const widths = ghostRefs.current.map(el => el?.getBoundingClientRect().width || 0);
         // Ensure we actually got measurements (elements were rendered)
         if (widths.some(w => w > 0)) {
             setGroupWidths(widths);
             setMeasurementsDone(true); // Stop rendering ghosts!
         }
     }
  }, [toolbarGroups, measurementsDone]);

  // If toolbar groups configuration changes fundamentally (rare), reset measurements
  useLayoutEffect(() => {
      setMeasurementsDone(false);
      setGroupWidths([]);
  }, [toolbarGroups]);


  // Calculate Visible Count
  let visibleCount = toolbarGroups.length;
  if (groupWidths.length > 0 && containerWidth > 0) {
      const moreBtnWidth = 32;
      const gap = 8;
      let currentWidth = 0;
      visibleCount = 0;

      for (let i = 0; i < groupWidths.length; i++) {
          const w = groupWidths[i];
          const needsMoreIfChecking = (i < groupWidths.length - 1);
          const widthWithItem = currentWidth + w;
          const totalRequired = widthWithItem + (needsMoreIfChecking ? gap + moreBtnWidth : 0);

          if (totalRequired <= containerWidth) {
              visibleCount++;
              currentWidth += w + gap;
          } else {
              break;
          }
      }
  }

  const visibleGroups = toolbarGroups.slice(0, visibleCount);
  const hiddenGroups = toolbarGroups.slice(visibleCount);

  return (
    <div ref={containerRef} style={{ width: '100%', overflow: 'hidden' }}>
        <Group p={4} bg="dark.7" gap={8} wrap="nowrap" style={{ borderBottom: "1px solid var(--mantine-color-dark-6)" }}>

            {visibleGroups.map((group) => (
                <React.Fragment key={group.id}>
                    {group.render()}
                </React.Fragment>
            ))}

            {hiddenGroups.length > 0 && (
                <Menu shadow="md" width={200} position="bottom-end">
                    <Menu.Target>
                        <ActionIcon variant="subtle" size="md" color="gray">
                            <FontAwesomeIcon icon={faEllipsisV} />
                        </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown bg="dark.7" style={{ border: "1px solid var(--mantine-color-dark-4)" }}>
                        {hiddenGroups.map((group) => (
                            <Box key={group.id} p={4} style={{ borderBottom: "1px solid var(--mantine-color-dark-6)" }}>
                                {group.render()}
                            </Box>
                        ))}
                    </Menu.Dropdown>
                </Menu>
            )}

            {/* Ghost Toolbar for Measurement - ONLY RENDER IF NOT MEASURED YET */}
            {!measurementsDone && (
                <div
                    style={{
                        position: 'absolute',
                        top: -9999,
                        left: 0,
                        visibility: 'hidden',
                        pointerEvents: 'none',
                        display: 'flex',
                        gap: 8
                    }}
                    aria-hidden="true"
                >
                    {toolbarGroups.map((group, i) => (
                        <div key={group.id} ref={(el) => { ghostRefs.current[i] = el; }}>
                            {group.render()}
                        </div>
                    ))}
                </div>
            )}

        </Group>
    </div>
  );
});