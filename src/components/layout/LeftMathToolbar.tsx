import React, { useMemo, useCallback } from 'react';
import { Stack, ActionIcon, Tooltip, Menu, Divider, Text, Box, rem } from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEquals, faSuperscript, faBook, faFont, faLayerGroup,
  faHatWizard, faArrowsAltH, faSquareRootAlt, faSubscript,
  faDivide, faCode, faBold, faItalic, faTerminal, faFontAwesome,
  faListOl, faPlusMinus // Added a couple generic fallbacks
} from "@fortawesome/free-solid-svg-icons";
import { IconMathFunction } from '@tabler/icons-react';
import { MATH_TOOLBAR_ITEMS, MathToolbarItem } from './MathToolbarItems';

// --- Interfaces ---
interface LeftMathToolbarProps {
  editor: any; // Ideally this should be the Monaco Editor interface (IStandaloneCodeEditor)
}

// --- Icon Mappings ---
const MENU_ICONS: Record<string, any> = {
  'mathmodegroup': faPlusMinus,
  'equations': faEquals,
  'functions': IconMathFunction,
  'definitions': faBook,
  'fontstyles': faFont,
  'grouping': faLayerGroup,
  'fontaccent': faHatWizard,
  'fontspaces': faArrowsAltH,
  'roots': faSquareRootAlt,
  'brackets': faCode,
  'fractions': faDivide,
};

const ITEM_ICONS: Record<string, any> = {
  'mathmode': faCode,
  'subscript': faSubscript,
  'superscript': faSuperscript,
  'sqrt': faSquareRootAlt,
  'frac': faDivide,
  'dfrac': faDivide,
  'mathrm': faFont,
  'mathit': faItalic,
  'mathbf': faBold,
  'mathtt': faTerminal,
  'equation': faListOl,
};

// --- Helper Function: Convert Custom Template to Monaco Snippet ---
const convertToMonacoSnippet = (template: string): string => {
  let counter = 1;

  // 1. Handle named placeholders: %<variable%:translatable%> or %<variable%>
  // We convert them to standard Monaco syntax: ${1:variable}
  let snippet = template.replace(/%<([^%>]+)%>/g, (_, content) => {
    // Remove flags like :translatable
    let cleanContent = content.split('%:')[0];
    // Remove explicit cursor marker inside placeholder if present
    cleanContent = cleanContent.replace('%|', '');
    
    return `\${${counter++}:${cleanContent}}`;
  });

  // 2. Handle the final cursor position marker %| -> $0
  snippet = snippet.replace(/%\|/g, '$0');

  // 3. Clean up escaped newlines logic from the XML source
  // Replacing %\n with actual newlines for the editor
  snippet = snippet.replace(/%\\n/g, '\n').replace(/%\n/g, '\n');

  return snippet;
};

export const LeftMathToolbar = React.memo<LeftMathToolbarProps>(({ editor }) => {

  // --- Handlers ---
  const insertSnippet = useCallback((template: string) => {
    if (!editor) return;
    
    const contribution = editor.getContribution('snippetController2');
    
    if (contribution) {
      const snippet = convertToMonacoSnippet(template);
      contribution.insert(snippet);
      editor.focus();
    } else {
      // Fallback if snippet controller isn't available (rare in Monaco)
      const snippet = convertToMonacoSnippet(template).replace(/\$\{\d+:([^}]+)\}/g, '$1').replace('$0', '');
      editor.trigger('keyboard', 'type', { text: snippet });
    }
  }, [editor]);

  // --- Recursive Item Renderer ---
  const renderItem = (item: MathToolbarItem, depth: number = 0) => {
    // 1. Separator
    if (item.type === 'separator') {
      return <Divider key={item.id} my={4} color="dark.5" />;
    }

    // 2. Insert Item (Leaf)
    if (item.type === 'insert') {
      // Logic for Items INSIDE a Menu (Dropdown)
      if (depth > 0) {
        return (
          <Menu.Item
            key={item.id}
            leftSection={
              ITEM_ICONS[item.id] ? (
                <FontAwesomeIcon icon={ITEM_ICONS[item.id]} style={{ width: rem(14) }} />
              ) : (
                <Text size="xs" c="dimmed" style={{ width: rem(14), textAlign: 'center' }}>
                    {/* Fallback: use first 2 letters if no icon */}
                    {item.id.substring(0, 1).toUpperCase()}
                </Text>
              )
            }
            onClick={() => item.insert && insertSnippet(item.insert)}
            rightSection={item.shortcut && <Text size="xs" c="dimmed">{item.shortcut}</Text>}
          >
             <Box>
                <Text size="sm">{item.text?.split(' - ')[0]}</Text>
                {item.info && <Text size="xs" c="dimmed" lineClamp={1}>{item.info}</Text>}
             </Box>
          </Menu.Item>
        );
      }

      // Logic for Top-Level Toolbar Buttons (No Menu)
      // Usually these are frequent actions like Inline Math, Bold, etc.
      const icon = ITEM_ICONS[item.id] || faCode; // Used implicitly? Actually it seems I can just restore it to be safe.

      return (
        <Tooltip 
          key={item.id} 
          label={`${item.text} ${item.shortcut ? `(${item.shortcut})` : ''}`} 
          position="right" 
          openDelay={300}
          withArrow
        >
          <ActionIcon
            variant="subtle"
            color="gray.4"
            onClick={() => item.insert && insertSnippet(item.insert)}
            size="md"
            radius="md"
            className="hover:bg-dark-6"
          >
             {ITEM_ICONS[item.id] ? 
                <FontAwesomeIcon icon={ITEM_ICONS[item.id]} /> : 
                <Text size="xs" fw={700}>{item.id.slice(0, 2)}</Text>
             }
          </ActionIcon>
        </Tooltip>
      );
    }

    // 3. Menu Item (Group)
    if (item.type === 'menu') {
       const icon = MENU_ICONS[item.id] || faFontAwesome; // Default icon if missing

       return (
         <Menu 
            key={item.id} 
            shadow="md" 
            width={280} 
            position="right-start" 
            trigger="hover" 
            openDelay={50} 
            closeDelay={200}
            offset={12}
            withArrow
         >
            <Menu.Target>
               {/* Wrapper div needed because Tooltip/MenuTarget refs can conflict if not careful */}
               <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                 <Tooltip label={item.text} position="left" openDelay={300} withArrow>
                    <ActionIcon variant="subtle" color="gray.7" size="md" radius="md">
                        { item.id !== 'functions' ? <FontAwesomeIcon icon={icon} />: <IconMathFunction /> }
                    </ActionIcon>
                 </Tooltip>
               </div>
            </Menu.Target>

            <Menu.Dropdown bg="dark.7" style={{ border: "1px solid var(--mantine-color-dark-5)" }}>
                {item.text && <Menu.Label>{item.text}</Menu.Label>}
                {item.items?.map(subItem => renderItem(subItem, depth + 1))}
            </Menu.Dropdown>
         </Menu>
       );
    }

    return null;
  };

  // --- Data Preparation ---
  // Extract the children of the 'main/math' group to display on the toolbar
  const rootItems = useMemo(() => {
     const root = MATH_TOOLBAR_ITEMS.find(i => i.id === 'main/math');
     return root?.items || [];
  }, []);

  // --- Main Render ---
  return (
    <Stack
        gap={8}
        p={4}
        bg="dark.7"
        style={{
            borderRight: "1px solid var(--mantine-color-dark-6)",
            overflowY: 'auto',
            width: 40, // Slightly wider for better click targets
            flexShrink: 0,
            alignItems: 'center',
            height: '100%'
        }}
    >
        {rootItems.map(item => renderItem(item))}
    </Stack>
  );
});