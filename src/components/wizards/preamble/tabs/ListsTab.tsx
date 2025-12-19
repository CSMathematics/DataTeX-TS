import React, { useState, useMemo } from 'react';
import { 
  Stack, Select, Divider, Card, Group, Switch, Text, TextInput, Button, ActionIcon,
  SegmentedControl, Box, Code, SimpleGrid, Badge, Checkbox, NumberInput, ThemeIcon
} from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, faTrash, faListOl, faListUl, faCheck, faBold, faItalic
} from '@fortawesome/free-solid-svg-icons';
import { PreambleConfig } from '../generators/preambleGenerators';
import { CustomListDef } from '../LanguageDb';

interface ListsTabProps {
  config: PreambleConfig;
  customLists: CustomListDef[];
  onChange: (key: string, val: any) => void;
  onAddList: (name: string, type: string, label: string, options?: string) => void;
  onRemoveList: (id: number) => void;
}

// --- Presets ---
const ENUM_PRESETS = [
  { value: '\\arabic*.', label: '1.', example: '1. Item' },
  { value: '(\\arabic*)', label: '(1)', example: '(1) Item' },
  { value: '\\alph*)', label: 'a)', example: 'a) Item' },
  { value: '(\\alph*)', label: '(a)', example: '(a) Item' },
  { value: '\\Roman*.', label: 'I.', example: 'I. Item' },
  { value: '\\roman*.', label: 'i.', example: 'i. Item' },
];

const ITEM_PRESETS = [
  { value: '\\bullet', label: '•', example: '• Item' },
  { value: '\\textendash', label: '–', example: '– Item' },
  { value: '\\textasteriskcentered', label: '*', example: '* Item' },
  { value: '\\Rightarrow', label: '⇒', example: '⇒ Item' },
];

export const ListsTab: React.FC<ListsTabProps> = ({ 
  config, 
  customLists, 
  onChange, 
  onAddList, 
  onRemoveList 
}) => {
  // --- New List State ---
  const [newListName, setNewListName] = useState('');
  const [newListType, setNewListType] = useState<string>('enumerate');
  const [newListLabel, setNewListLabel] = useState('\\arabic*.');
  
  // --- Layout & Spacing Options ---
  const [optNosep, setOptNosep] = useState(false);
  const [optNoItemSep, setOptNoItemSep] = useState(false);
  const [optWide, setOptWide] = useState(false);
  const [optLeftMarginStar, setOptLeftMarginStar] = useState(false); // leftmargin=*
  
  // --- Styling Options ---
  const [optBold, setOptBold] = useState(false);
  const [optItalic, setOptItalic] = useState(false);
  const [optAlign, setOptAlign] = useState<string>('default');

  // --- Enumeration Specifics ---
  const [optResume, setOptResume] = useState(false);
  const [optStart, setOptStart] = useState<number | ''>('');

  // --- Handlers ---
  const handleAdd = () => {
    if (newListName && newListType) {
      // Construct options string for enumitem
      const parts = [];
      
      // 1. Label
      if (newListLabel && newListType !== 'description') parts.push(`label=${newListLabel}`);
      
      // 2. Spacing
      if (optNosep) parts.push('nosep');
      else if (optNoItemSep) parts.push('noitemsep');
      
      // 3. Layout
      if (optWide) parts.push('wide=0pt');
      if (optLeftMarginStar) parts.push('leftmargin=*');
      
      // 4. Styling
      let fontCmd = '';
      if (optBold) fontCmd += '\\bfseries';
      if (optItalic) fontCmd += '\\itshape';
      if (fontCmd) parts.push(`font=${fontCmd}`);
      
      if (optAlign && optAlign !== 'default') parts.push(`align=${optAlign}`);

      // 5. Enumeration features
      if (newListType === 'enumerate') {
          if (optResume) parts.push('resume');
          if (optStart !== '' && optStart !== 1) parts.push(`start=${optStart}`);
      }

      const optionsStr = parts.join(', ');
      
      onAddList(newListName, newListType, optionsStr);
      
      // Reset form
      setNewListName('');
      setOptNosep(false);
      setOptWide(false);
      setOptStart('');
      setOptBold(false);
      setOptItalic(false);
    }
  };

  // Generate preview code
  const previewCode = useMemo(() => {
      const parts = [];
      if (newListLabel && newListType !== 'description') parts.push(`label=${newListLabel}`);
      if (optNosep) parts.push('nosep');
      else if (optNoItemSep) parts.push('noitemsep');
      if (optWide) parts.push('wide=0pt');
      if (optLeftMarginStar) parts.push('leftmargin=*');
      
      let fontCmd = '';
      if (optBold) fontCmd += '\\bfseries';
      if (optItalic) fontCmd += '\\itshape';
      if (fontCmd) parts.push(`font=${fontCmd}`);
      
      if (optAlign && optAlign !== 'default') parts.push(`align=${optAlign}`);

      if (newListType === 'enumerate') {
          if (optResume) parts.push('resume');
          if (optStart !== '' && optStart !== 1) parts.push(`start=${optStart}`);
      }
      
      return `\\newlist{${newListName || 'myList'}}{${newListType}}{3}\n\\setlist[${newListName || 'myList'}]{${parts.join(', ')}}`;
  }, [newListName, newListType, newListLabel, optNosep, optNoItemSep, optWide, optLeftMarginStar, optBold, optItalic, optAlign, optResume, optStart]);

  return (
    <Stack gap="md" pb="xl">
      {/* 1. Global Package Settings */}
      <Card withBorder p="sm" bg="dark.7">
        <Group justify="space-between" mb="xs">
          <Group gap="xs">
             <Text fw={700}>Enumitem Package</Text>
             <Badge variant="outline" color="yellow">Recommended</Badge>
          </Group>
          <Switch 
            checked={config.pkgEnumitem} 
            onChange={(e) => onChange('pkgEnumitem', e.currentTarget.checked)} 
            label="Load Package"
          />
        </Group>
        
        {config.pkgEnumitem && (
            <SimpleGrid cols={2} spacing="xs">
                <Select 
                    label="Global Itemize"
                    placeholder="Default bullet"
                    size="xs"
                    data={[
                        { value: 'default', label: 'Default' },
                        { value: 'label=\\bullet', label: 'Bullet (•)' },
                        { value: 'label=--', label: 'Dash (–)' },
                    ]}
                    value={config.enumitemItemize}
                    onChange={(v) => onChange('enumitemItemize', v)}
                />
                <Select 
                    label="Global Enumerate"
                    placeholder="Default numbering"
                    size="xs"
                    data={[
                        { value: 'default', label: 'Default (1.)' },
                        { value: 'label=\\arabic*)', label: 'Parenthesis 1)' },
                        { value: 'label=(\\alph*)', label: 'Alpha (a)' },
                    ]}
                    value={config.enumitemEnumerate}
                    onChange={(v) => onChange('enumitemEnumerate', v)}
                />
            </SimpleGrid>
        )}
      </Card>

      {config.pkgEnumitem && (
        <>
          <Divider label="Custom List Creator" labelPosition="center" />
          
          {/* 2. Custom List Creator */}
          <Card withBorder p="md" bg="dark.8">
             <Stack gap="sm">
                {/* NAME & TYPE */}
                <Group grow align="flex-start">
                   <TextInput 
                     label="List Name" 
                     description="The command you will use (e.g. \begin{questions})"
                     placeholder="e.g. questions" 
                     value={newListName} 
                     onChange={(e) => setNewListName(e.currentTarget.value.replace(/[^a-zA-Z]/g, ''))} 
                     rightSection={newListName ? <FontAwesomeIcon icon={faCheck} color="green" /> : null}
                   />
                   <Select 
                     label="Base Type" 
                     description="Inherits behavior from..."
                     data={[
                         { value: 'enumerate', label: 'Enumerate (Numbered)' }, 
                         { value: 'itemize', label: 'Itemize (Bulleted)' }, 
                         { value: 'description', label: 'Description (Terms)' }
                     ]} 
                     value={newListType} 
                     onChange={(v) => {
                         setNewListType(v || 'enumerate');
                         setNewListLabel(v === 'enumerate' ? '\\arabic*.' : '\\bullet');
                     }} 
                   />
                </Group>

                {/* LABEL PATTERN (Not for description) */}
                {newListType !== 'description' && (
                    <>
                        <Text size="sm" fw={500} mt="xs">Label Style</Text>
                        <SegmentedControl 
                            value={newListLabel}
                            onChange={setNewListLabel}
                            data={(newListType === 'enumerate' ? ENUM_PRESETS : ITEM_PRESETS).map(p => ({
                                value: p.value,
                                label: (
                                    <Group gap={6} justify="center">
                                        <Text fw={700}>{p.label}</Text>
                                        <Text size="xs" c="dimmed" style={{ fontSize: 9 }}>{p.example}</Text>
                                    </Group>
                                )
                            }))}
                            fullWidth
                            orientation="vertical"
                            size="xs"
                        />
                        <TextInput 
                            label="Custom Label Pattern" 
                            size="xs" 
                            value={newListLabel} 
                            onChange={(e) => setNewListLabel(e.currentTarget.value)}
                            placeholder={newListType === 'enumerate' ? '\\arabic*.' : '\\bullet'}
                        />
                    </>
                )}

                {/* ADVANCED OPTIONS TABS */}
                <SimpleGrid cols={2} spacing="md" mt="xs">
                    
                    {/* Column 1: Spacing & Layout */}
                    <Stack gap="xs">
                        <Text size="xs" fw={700} c="dimmed">LAYOUT & SPACING</Text>
                        <Checkbox 
                            label="Compact (nosep)" 
                            size="xs"
                            description="Removes vertical space"
                            checked={optNosep} 
                            onChange={(e) => setOptNosep(e.currentTarget.checked)} 
                        />
                        <Checkbox 
                            label="No Item Spacing" 
                            size="xs"
                            description="Only between items"
                            checked={optNoItemSep} 
                            onChange={(e) => setOptNoItemSep(e.currentTarget.checked)}
                            disabled={optNosep}
                        />
                        <Checkbox 
                            label="Full Width (wide)" 
                            size="xs"
                            description="Label aligns with margin"
                            checked={optWide} 
                            onChange={(e) => setOptWide(e.currentTarget.checked)} 
                        />
                        <Checkbox 
                            label="Align Text (leftmargin=*)" 
                            size="xs"
                            description="Smart indent adjustment"
                            checked={optLeftMarginStar} 
                            onChange={(e) => setOptLeftMarginStar(e.currentTarget.checked)} 
                        />
                    </Stack>

                    {/* Column 2: Styling & Numbering */}
                    <Stack gap="xs">
                        <Text size="xs" fw={700} c="dimmed">STYLE & LOGIC</Text>
                        <Group gap="xs">
                            <ActionIcon 
                                variant={optBold ? "filled" : "default"} 
                                onClick={() => setOptBold(!optBold)} 
                                title="Bold Label"
                            >
                                <FontAwesomeIcon icon={faBold} />
                            </ActionIcon>
                            <ActionIcon 
                                variant={optItalic ? "filled" : "default"} 
                                onClick={() => setOptItalic(!optItalic)} 
                                title="Italic Label"
                            >
                                <FontAwesomeIcon icon={faItalic} />
                            </ActionIcon>
                            <Select 
                                size="xs" 
                                placeholder="Align"
                                data={[
                                    { value: 'default', label: 'Default (Right)' },
                                    { value: 'left', label: 'Left Align' },
                                    { value: 'parleft', label: 'Parbox Left' }
                                ]}
                                value={optAlign}
                                onChange={(v) => setOptAlign(v || 'default')}
                                style={{ flex: 1 }}
                            />
                        </Group>

                        {newListType === 'enumerate' && (
                            <>
                                <Checkbox 
                                    label="Resume Numbering" 
                                    size="xs"
                                    checked={optResume} 
                                    onChange={(e) => setOptResume(e.currentTarget.checked)} 
                                />
                                <NumberInput
                                    label="Start Value"
                                    size="xs"
                                    placeholder="e.g. 1"
                                    min={0}
                                    value={optStart}
                                    onChange={(v) => setOptStart(v === '' ? '' : Number(v))}
                                    rightSection={<Text size="xs" c="dimmed">#</Text>}
                                />
                            </>
                        )}
                    </Stack>
                </SimpleGrid>

                {/* PREVIEW */}
                <Box mt="sm" p="xs" bg="dark.9" style={{ borderRadius: 4, border: '1px dashed #444' }}>
                    <Text size="xs" c="dimmed" fw={700} mb={4}>CODE PREVIEW</Text>
                    <Code block style={{ background: 'transparent', fontSize: 11 }}>
                        {previewCode}
                    </Code>
                </Box>

                <Button fullWidth mt="xs" onClick={handleAdd} leftSection={<FontAwesomeIcon icon={faPlus} />} color="teal">
                    Create Custom List
                </Button>
             </Stack>
          </Card>

          {/* 3. Defined Lists Display */}
          <Stack gap="xs" mt="md">
             <Text size="sm" fw={700} c="dimmed">ACTIVE CUSTOM LISTS</Text>
             {customLists.map(l => (
                <Group key={l.id} justify="space-between" bg="dark.6" p="xs" style={{ borderRadius: 4, borderLeft: '3px solid var(--mantine-color-blue-6)' }}>
                   <Group gap="sm">
                      <ThemeIcon variant="light" color="gray">
                          <FontAwesomeIcon icon={l.baseType === 'enumerate' ? faListOl : faListUl} />
                      </ThemeIcon>
                      <Stack gap={0}>
                          <Text size="sm" fw={700}>{l.name}</Text>
                          <Text size="xs" c="dimmed" w={200} truncate>
                              Type: {l.baseType} <br/>
                              {l.label && l.label !== 'default' ? `Opts: ${l.label}` : ''}
                          </Text>
                      </Stack>
                   </Group>
                   <ActionIcon color="red" variant="subtle" onClick={() => onRemoveList(l.id)}>
                      <FontAwesomeIcon icon={faTrash} />
                   </ActionIcon>
                </Group>
             ))}
             {customLists.length === 0 && (
                 <Stack align="center" py="xl" opacity={0.5}>
                     <FontAwesomeIcon icon={faListOl} size="2x" />
                     <Text size="sm">No custom lists defined yet.</Text>
                 </Stack>
             )}
          </Stack>
        </>
      )}
    </Stack>
  );
};