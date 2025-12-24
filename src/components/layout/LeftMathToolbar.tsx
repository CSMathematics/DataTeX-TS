import React, { useMemo } from 'react';
import { Stack, ActionIcon, Tooltip, Menu, Divider, Text, Box } from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEquals, faSuperscript, faBook, faFont, faLayerGroup,
  faHatWizard, faArrowsAltH, faSquareRootAlt, faSubscript,
  faDivide, faCode, faBold, faItalic, faTerminal, faFontAwesome
} from "@fortawesome/free-solid-svg-icons"; // Add more as needed
import { MATH_TOOLBAR_ITEMS, MathToolbarItem } from './MathToolbarItems';

interface LeftMathToolbarProps {
  editor: any;
}

const convertToMonacoSnippet = (template: string): string => {
  let counter = 1;

  // Handle placeholders like %<num%|%:translatable%>
  let snippet = template.replace(/%<([^%>]+)%>/g, (_, content) => {
    // Remove :translatable and other flags if any (assuming syntax :flag)
    let cleanContent = content.split('%:')[0];

    // Handle %| inside placeholder - usually means cursor position,
    // but in snippet world, it's just the default text or tabstop.
    // We'll strip it for the label.
    cleanContent = cleanContent.replace('%|', '');

    return `\${${counter++}:${cleanContent}}`;
  });

  // Handle remaining %| as final cursor position $0
  // or if it was handled inside, we might want to check.
  // But usually %| outside means "cursor here".
  snippet = snippet.replace(/%\|/g, '$0');

  // Handle %\n or %\\n patterns which seem to be escaped newlines in the XML source?
  // The XML provided has "%\n" or just newlines.
  // We should unescape if necessary.
  // In the TS file I created, I kept them as written in the prompt's XML but as JS strings.
  // The prompt XML had: insert="\begin{equation}%\    %<eqn%>%\n\end{equation}"
  // I converted to: "\\begin{equation}%\n    %<eqn%>%\n\\end{equation}"
  // The `%` at end of line in LaTeX means "comment/ignore newline", but here it might just be formatting.
  // Let's strip `%\n` to just `\n` or empty?
  // Actually in LaTeX `%\n` connects lines.
  // Let's assume the user wants standard LaTeX formatting.
  // We will replace `%\n` with just `\n` to keep it clean, or maybe the user WANTS the %.
  // Let's replace `%\n` with `\n`.
  snippet = snippet.replace(/%\\n/g, '\n').replace(/%\n/g, '\n');

  return snippet;
};

// Map IDs to Icons for Top-Level Menus
const MENU_ICONS: Record<string, any> = {
  'equations': faEquals,
  'functions': faSuperscript, // approximate
  'definitions': faBook,
  'fontstyles': faFont,
  'grouping': faLayerGroup,
  'fontaccent': faHatWizard, // approximate
  'fontspaces': faArrowsAltH,
};

// Map IDs to Icons for specific items if needed (overriding text/generic)
const ITEM_ICONS: Record<string, any> = {
  'mathmode': faCode, // $...$
  'subscript': faSubscript,
  'superscript': faSuperscript,
  'sqrt': faSquareRootAlt,
  'frac': faDivide, // approximate
  'dfrac': faDivide,
  'mathrm': faFont,
  'mathit': faItalic,
  'mathbf': faBold,
  'mathtt': faTerminal,
};

export const LeftMathToolbar = React.memo<LeftMathToolbarProps>(({ editor }) => {

  const insertSnippet = (template: string) => {
    if (!editor) return;
    const contribution = editor.getContribution('snippetController2');
    if (contribution) {
      const snippet = convertToMonacoSnippet(template);
      contribution.insert(snippet);
      editor.focus();
    }
  };

  const renderItem = (item: MathToolbarItem, depth: number = 0) => {
    if (item.type === 'separator') {
      return <Divider key={item.id} my={4} />;
    }

    if (item.type === 'insert') {
      // If depth > 0 (inside menu), render as Menu.Item
      if (depth > 0) {
        return (
          <Menu.Item
            key={item.id}
            leftSection={ITEM_ICONS[item.id] ? <FontAwesomeIcon icon={ITEM_ICONS[item.id]} size="xs" /> : null}
            onClick={() => item.insert && insertSnippet(item.insert)}
          >
             <Box>
                <Text size="sm">{item.text?.split(' - ')[0]}</Text>
                {item.info && <Text size="xs" c="dimmed">{item.info}</Text>}
             </Box>
          </Menu.Item>
        );
      }

      // Top level insert item (Toolbar Button)
      // const icon = ITEM_ICONS[item.id] || faCode; // Fallback - removed unused var
      // For some items we might want text labels if defined in icon prop in XML?
      // The XML has icon="mathmode", "subscript" etc.
      // I'll stick to FontAwesome mapping for now.

      return (
        <Tooltip key={item.id} label={item.text} position="right" openDelay={300}>
          <ActionIcon
            variant="subtle"
            color="gray.5"
            onClick={() => item.insert && insertSnippet(item.insert)}
            size="md"
          >
             {/* If we have a specific icon map, use it, otherwise maybe use the id initials? */}
             {ITEM_ICONS[item.id] ? <FontAwesomeIcon icon={ITEM_ICONS[item.id]} /> : <Text size="xs">{item.id.slice(0,2)}</Text>}
          </ActionIcon>
        </Tooltip>
      );
    }

    if (item.type === 'menu') {
       // Menu Group
       const icon = MENU_ICONS[item.id] || faFontAwesome;

       return (
         <Menu key={item.id} shadow="md" width={250} position="right-start" trigger="hover" openDelay={100} closeDelay={200}>
            <Menu.Target>
               <ActionIcon variant="subtle" color="gray.5" size="md">
                  <FontAwesomeIcon icon={icon} />
               </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown bg="dark.7" style={{ border: "1px solid var(--mantine-color-dark-5)" }}>
                <Menu.Label>{item.text}</Menu.Label>
                {item.items?.map(subItem => renderItem(subItem, depth + 1))}
            </Menu.Dropdown>
         </Menu>
       );
    }

    return null;
  };

  const rootItems = useMemo(() => {
     // The structure has a root 'main/math' menu. We want to render its CHILDREN as the toolbar items.
     const root = MATH_TOOLBAR_ITEMS.find(i => i.id === 'main/math');
     return root?.items || [];
  }, []);

  return (
    <Stack
        gap={4}
        p={4}
        bg="dark.8"
        style={{
            borderRight: "1px solid var(--mantine-color-dark-6)",
            overflowY: 'auto',
            width: 40,
            flexShrink: 0,
            alignItems: 'center'
        }}
    >
        {rootItems.map(item => renderItem(item))}
    </Stack>
  );
});
