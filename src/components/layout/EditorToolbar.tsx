import React, { useState, useLayoutEffect, useRef, useMemo } from 'react';
import { Group, ActionIcon, Tooltip, Menu, Text, Box } from "@mantine/core";
import { useElementSize } from '@mantine/hooks';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBold, faItalic, faUnderline, faStrikethrough, faFont, faPen, faCode,
  faQuoteRight, faEllipsisH, faListUl, faListOl, faSubscript, faSuperscript,
  faLink, faUnlink, faAlignLeft, faAlignCenter, faAlignRight, faAlignJustify,
  faEllipsisV, faChevronDown
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



  // --- Structure Menu Component ---
  const StructureMenu = ({ label, cmd }: { label: string, cmd: string }) => {
      return (
          <Menu shadow="sm" width={150}>
              <Menu.Target>
                  <Tooltip label={`${cmd} options`}>
                      <ActionIcon variant="subtle" size="xs" color='gray.5' w={36}>
                          <Group gap={2}>
                              <Text size="xs" fw={700}>{label}</Text>
                              <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 8, opacity: 0.5 }} />
                          </Group>
                      </ActionIcon>
                  </Tooltip>
              </Menu.Target>
              <Menu.Dropdown bg="dark.7" style={{ border: "1px solid var(--mantine-color-dark-4)" }}>
                  <Menu.Item 
                      color="white"
                      onClick={() => wrapSelection(`\\${cmd}{`, '}')}
                  >
                      <Text size="xs"><Text span fw={700}>\{cmd}</Text> (Numbered)</Text>
                  </Menu.Item>
                  <Menu.Item 
                      color="white"
                      onClick={() => wrapSelection(`\\${cmd}*{`, '}')}
                  >
                        <Text size="xs"><Text span fw={700}>\{cmd}*</Text> (Unnumbered)</Text>
                  </Menu.Item>
              </Menu.Dropdown>
          </Menu>
      );
  };

  // --- Toolbar Groups Configuration ---
  const toolbarGroups = useMemo(() => [
      {
          id: 'formatting',
          render: () => (
            <Group gap={2} bg="dark.7" p={2} style={{ borderRadius: 4, flexShrink: 0 }}>
                <Tooltip label="Bold (\textbf)"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => wrapSelection('\\textbf{', '}')}><FontAwesomeIcon icon={faBold} /></ActionIcon></Tooltip>
                <Tooltip label="Italic (\textit)"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => wrapSelection('\\textit{', '}')}><FontAwesomeIcon icon={faItalic} /></ActionIcon></Tooltip>
                <Tooltip label="Underline (\underline)"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => wrapSelection('\\underline{', '}')}><FontAwesomeIcon icon={faUnderline} /></ActionIcon></Tooltip>
                <Tooltip label="Strikethrough (\st)"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => wrapSelection('\\st{', '}')}><FontAwesomeIcon icon={faStrikethrough} /></ActionIcon></Tooltip>
                <Tooltip label="Text (\text)"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => wrapSelection('\\text{', '}')}><FontAwesomeIcon icon={faFont} /></ActionIcon></Tooltip>
                <Tooltip label="Highlight (\hl)"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => wrapSelection('\\hl{', '}')}><FontAwesomeIcon icon={faPen} /></ActionIcon></Tooltip>
                <Tooltip label="Code (\texttt)"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => wrapSelection('\\texttt{', '}')}><FontAwesomeIcon icon={faCode} /></ActionIcon></Tooltip>
            </Group>
          )
      },
      {
          id: 'headings',
          render: () => (
            <Group gap={2} bg="dark.7" p={2} style={{ borderRadius: 4, flexShrink: 0 }}>
                <StructureMenu label="H1" cmd="chapter" />
                <StructureMenu label="H2" cmd="section" />
                <StructureMenu label="H3" cmd="subsection" />
                <StructureMenu label="H4" cmd="subsubsection" />
                <StructureMenu label="H5" cmd="paragraph" />
            </Group>
          )
      },
      {
          id: 'align',
          render: () => (
            <Group gap={2} bg="dark.7" p={2} style={{ borderRadius: 4, flexShrink: 0 }}>
                <Tooltip label="Align Left (flushleft)"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => wrapEnvironment('flushleft')}><FontAwesomeIcon icon={faAlignLeft} /></ActionIcon></Tooltip>
                <Tooltip label="Align Center (center)"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => wrapEnvironment('center')}><FontAwesomeIcon icon={faAlignCenter} /></ActionIcon></Tooltip>
                <Tooltip label="Align Right (flushright)"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => wrapEnvironment('flushright')}><FontAwesomeIcon icon={faAlignRight} /></ActionIcon></Tooltip>
                <Tooltip label="Justify (default)"><ActionIcon variant="subtle" size="xs" color='gray.5' disabled><FontAwesomeIcon icon={faAlignJustify} /></ActionIcon></Tooltip>
            </Group>
          )
      },
      {
          id: 'lists',
          render: () => (
            <Group gap={2} bg="dark.7" p={2} style={{ borderRadius: 4, flexShrink: 0 }}>
                <Tooltip label="Quote environment"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => wrapEnvironment('quote')}><FontAwesomeIcon icon={faQuoteRight} /></ActionIcon></Tooltip>
                <Tooltip label="Ellipsis (\dots)"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => insertText('\\dots')}><FontAwesomeIcon icon={faEllipsisH} /></ActionIcon></Tooltip>
                <Tooltip label="Bullet List (itemize)"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => insertText('\\begin{itemize}\n  \\item \n\\end{itemize}')}><FontAwesomeIcon icon={faListUl} /></ActionIcon></Tooltip>
                <Tooltip label="Numbered List (enumerate)"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => insertText('\\begin{enumerate}\n  \\item \n\\end{enumerate}')}><FontAwesomeIcon icon={faListOl} /></ActionIcon></Tooltip>
            </Group>
          )
        },
        {
            id: 'math',
            render: () => (
                <Group gap={2} bg="dark.7" p={2} style={{ borderRadius: 4, flexShrink: 0 }}>
                <Tooltip label="Inline Math ($...$)"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => wrapSelection('$', '$')}><Text size="xs" fw={200}>Σ</Text></ActionIcon></Tooltip>
                    <Tooltip label="Display Math (\[...\])"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => wrapSelection('\\[', '\\]')}><Text size="xs" fw={700}>Σ</Text></ActionIcon></Tooltip>
                    <Tooltip label="Subscript (_{})"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => wrapSelection('_{', '}')}><FontAwesomeIcon icon={faSubscript} /></ActionIcon></Tooltip>
                    <Tooltip label="Superscript (^{})"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => wrapSelection('^{', '}')}><FontAwesomeIcon icon={faSuperscript} /></ActionIcon></Tooltip>
                </Group>
            )
      },
      {
            id: 'spacing',
            render: () => (
                <Group gap={2} bg="dark.7" p={2} style={{ borderRadius: 4, flexShrink: 0 }}>
                    <Tooltip label="Horizontal Space (\hspace)"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => insertText('\\hspace{length}')}><Text size="xs" fw={700}>HS</Text></ActionIcon></Tooltip>
                    <Tooltip label="Vertical Space (\vspace)"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => insertText('\\vspace{length}')}><Text size="xs" fw={700}>VS</Text></ActionIcon></Tooltip>
                </Group>
            )
      },
      {
          id: 'links',
          render: () => (
            <Group gap={2} bg="dark.7" p={2} style={{ borderRadius: 4, flexShrink: 0 }}>
                <Tooltip label="Link (\href)"><ActionIcon variant="subtle" size="xs" color='gray.5' onClick={() => wrapSelection('\\href{url}{', '}')}><FontAwesomeIcon icon={faLink} /></ActionIcon></Tooltip>
                <Tooltip label="Unlink (Remove Link)"><ActionIcon variant="subtle" size="xs" color='gray.5' disabled><FontAwesomeIcon icon={faUnlink} /></ActionIcon></Tooltip>
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
         // Ensure we actually got ALL measurements (elements were rendered)
         if (widths.length === toolbarGroups.length && widths.every(w => w > 0)) {
             setGroupWidths(widths);
             setMeasurementsDone(true);
         }
     }
  }, [toolbarGroups, measurementsDone]);
  
  // FALLBACK: Force measurement after a timeout if it never completes
  useLayoutEffect(() => {
      const timer = setTimeout(() => {
          if (!measurementsDone && ghostRefs.current.length > 0) {
              const widths = ghostRefs.current.map(el => el?.getBoundingClientRect().width || 0);
              // Use whatever we have, even if some are 0
              setGroupWidths(widths);
              setMeasurementsDone(true);
          }
      }, 500);
      return () => clearTimeout(timer);
  }, [measurementsDone]);

  // If toolbar groups configuration changes fundamentally (rare), reset measurements
  useLayoutEffect(() => {
      setMeasurementsDone(false);
      setGroupWidths([]);
      ghostRefs.current = []; // Clear refs
  }, [toolbarGroups]);


  // Calculate Visible Count
  // Default to 0. If we haven't measured, we render nothing (except ghosts) to prevent flickering.
  // Once measured, we calculate.
  let visibleCount = 0; 

  if (measurementsDone && groupWidths.length > 0) {
      if (containerWidth <= 0) {
          // If container width is 0 (hidden), we can't calculate.
          // Keep visibleCount = 0.
      } else {
          // Calculate how many fit
          const moreBtnWidth = 40; 
          const gap = 8;
          let currentWidth = 0;
          
          for (let i = 0; i < groupWidths.length; i++) {
              const w = groupWidths[i];
              const isLastItem = (i === groupWidths.length - 1);
              const gapSpace = (i > 0 ? gap : 0);
              
              const widthWithItem = currentWidth + gapSpace + w;
              const requiredSpace = isLastItem ? widthWithItem : widthWithItem + gap + moreBtnWidth;

              if (requiredSpace <= containerWidth) {
                  visibleCount++;
                  currentWidth += gapSpace + w;
              } else {
                  break;
              }
          }

          // SAFEGUARD: If nothing fits, but we have space, show at least the "Three Dots" menu.
          // visibleCount = 0 means "Show 0 groups", so all go to hidden. "More" button appears (if hidden > 0).
          // This is correct behavior for very narrow screens.
      }
  } else {
     // If not measured yet, render NOTHING (visibleCount = 0). 
     // The "More" button logic below checks hiddenGroups.length > 0.
     // If visibleCount = 0, hiddenGroups = all. "More" button would show ALL items.
     // This causes a flicker of "Just a menu button" before layout.
     // To avoid this, we can set visibleCount to toolbarGroups.length (Show All) initially,
     // but that causes "All items flash then collapse". 
     // A cleaner approach is to render NOTHING visible until measured.
     // But 'hiddenGroups' would be ALL.
     // Let's force visibleCount = length (All Visible) if !measurementsDone,
     // AND ensure 'hiddenGroups' is empty so "More" doesn't show.
     if (!measurementsDone) {
         visibleCount = toolbarGroups.length;
     }
  }
  
  // FORCE RE-MEASURE ON RESIZE (Debounced)
  React.useEffect(() => {
     if (containerWidth > 0) {
         // Trigger a state update to force re-calc if needed, though render does it.
         // This is just to log or verify.
     }
  }, [containerWidth]);

  // Slicing logic
  const visibleGroups = toolbarGroups.slice(0, visibleCount);
  const hiddenGroups = !measurementsDone ? [] : toolbarGroups.slice(visibleCount);

  return (
    <div ref={containerRef} style={{ width: '100%', overflow: 'hidden' }}>
        <Group p={4} bg="dark.7" gap={8} wrap="nowrap" style={{ borderBottom: "none", paddingBottom: "9px" }}>

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