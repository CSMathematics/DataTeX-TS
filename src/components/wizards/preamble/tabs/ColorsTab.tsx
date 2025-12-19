import React, { useState, useEffect, useMemo } from 'react';
import { 
  Stack, Checkbox, Card, Text, Group, TextInput, Select, ColorInput, Button, 
  Tooltip, Badge, ActionIcon, MultiSelect, SegmentedControl, Slider, Box, Divider,
  SimpleGrid, NumberInput, ColorPicker, Tabs, Paper, Code
} from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, faSync, faTrash, faPalette, faFlask, faPrint, faList, faCheckCircle,
  faCode, faFileAlt, faHighlighter, faBorderAll, faFont
} from '@fortawesome/free-solid-svg-icons';
import { PreambleConfig } from '../generators/preambleGenerators';
import { CustomColorDef, COLOR_MODELS, hexToModelValue } from '../LanguageDb';

interface ColorsTabProps {
  config: PreambleConfig;
  customColors: CustomColorDef[];
  onChange: (key: string, val: any) => void;
  onAddColor: (name: string, model: string, value: string, previewHex: string) => void;
  onRemoveColor: (id: number) => void;
  onInsert?: (code: string) => void; // New prop for inserting usage snippets
}

// --- Constants ---
const XCOLOR_OPTIONS = [
  {
    group: 'Palettes',
    items: [
      { value: 'dvipsnames', label: 'Classic Names (dvipsnames)' },
      { value: 'svgnames', label: 'Web/SVG Names (svgnames)' },
      { value: 'x11names', label: 'Unix/X11 Names (x11names)' },
    ]
  },
  {
    group: 'Features & Target Models',
    items: [
      { value: 'table', label: 'Table Support (table)' },
      { value: 'cmyk', label: 'Force CMYK Output (cmyk)' },
      { value: 'monochrome', label: 'Monochrome / Grayscale' },
      { value: 'natural', label: 'Natural Color Model' },
      { value: 'fixpdftex', label: 'Fix pdfTeX Colors' },
    ]
  },
  {
    group: 'Drivers',
    items: [
      { value: 'pdftex', label: 'Driver: pdfTeX' },
      { value: 'xetex', label: 'Driver: XeTeX' },
      { value: 'luatex', label: 'Driver: LuaTeX' },
      { value: 'dvips', label: 'Driver: dvips (PostScript)' },
      { value: 'xdvi', label: 'Driver: xdvi' },
      { value: 'dvipdfmx', label: 'Driver: dvipdfmx' },
      { value: 'dvisvgm', label: 'Driver: dvisvgm (SVG)' },
    ]
  }
];

const STANDARD_LATEX_COLORS = ['black', 'blue', 'brown', 'cyan', 'darkgray', 'gray', 'green', 'lightgray', 'lime', 'magenta', 'olive', 'orange', 'pink', 'purple', 'red', 'teal', 'violet', 'white', 'yellow'];

export const ColorsTab: React.FC<ColorsTabProps> = ({ 
  config, 
  customColors, 
  onChange, 
  onAddColor, 
  onRemoveColor,
  onInsert
}) => {
  // --- Global Options State ---
  const selectedOptions = (config as any).xcolorOptions || ['table', 'dvipsnames'];

  const handleOptionChange = (vals: string[]) => {
    onChange('xcolorOptions', vals);
  };

  // --- Definition Mode State ---
  // Added 'snippets' mode
  const [defMode, setDefMode] = useState<'palette' | 'cmyk' | 'mixer' | 'snippets'>('palette');
  
  // 1. PALETTE MODE (Generic Picker)
  const [palName, setPalName] = useState('');
  const [palColor, setPalColor] = useState('#1c7ed6');
  const [palModel, setPalModel] = useState('HTML'); 
  const [palCalculated, setPalCalculated] = useState('');

  // 4. SNIPPETS MODE STATE
  const [snipColor, setSnipColor] = useState('blue');
  const [snipSecColor, setSnipSecColor] = useState('white'); // for fcolorbox frame
  const [snipText, setSnipText] = useState('Sample Text');
  const [snipType, setSnipType] = useState<'textcolor' | 'colorbox' | 'fcolorbox' | 'pagecolor' | 'rowcolor'>('textcolor');

  // Use hexToModelValue for live preview based on Selected Model
  useEffect(() => {
    setPalCalculated(hexToModelValue(palColor, palModel));
  }, [palColor, palModel]);

  // 2. CMYK MODE (Manual Sliders)
  const [cmykName, setCmykName] = useState('');
  const [cmykValues, setCmykValues] = useState({ c: 100, m: 50, y: 0, k: 0 });

  // 3. MIXER MODE (\colorlet)
  const [mixName, setMixName] = useState('');
  const [mixBase, setMixBase] = useState('blue');
  const [mixPercent, setMixPercent] = useState<string | number>(100); 
  const [mixSecondary, setMixSecondary] = useState('white'); 
  
  // --- Handlers ---

  const handleAddPalette = () => {
    if (!palName) return;
    let val = palCalculated;
    if (palModel === 'HTML') val = val.replace('#', '').toUpperCase();
    onAddColor(palName, palModel, val, palColor);
    setPalName('');
  };

  const handleAddCmyk = () => {
    if (!cmykName) return;
    const c = (cmykValues.c / 100).toFixed(2);
    const m = (cmykValues.m / 100).toFixed(2);
    const y = (cmykValues.y / 100).toFixed(2);
    const k = (cmykValues.k / 100).toFixed(2);
    const val = `${c},${m},${y},${k}`;
    
    // Approximate preview
    const r = 255 * (1 - parseFloat(c)) * (1 - parseFloat(k));
    const g = 255 * (1 - parseFloat(m)) * (1 - parseFloat(k));
    const b = 255 * (1 - parseFloat(y)) * (1 - parseFloat(k));
    const hex = `#${((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1)}`;

    onAddColor(cmykName, 'cmyk', val, hex);
    setCmykName('');
  };

  const handleAddMix = () => {
    if (!mixName) return;
    let val = '';
    if (Number(mixPercent) === 100) val = mixBase; 
    else val = `${mixBase}!${mixPercent}!${mixSecondary}`;
    onAddColor(mixName, 'named (mix)', val, '#868e96');
    setMixName('');
  };

  const handleResetMixer = () => {
      setMixBase('blue');
      setMixPercent(100);
      setMixSecondary('white');
  };

  const handleInsertSnippet = () => {
      if (!onInsert) return;
      let code = '';
      switch (snipType) {
          case 'textcolor': code = `\\textcolor{${snipColor}}{${snipText}}`; break;
          case 'colorbox': code = `\\colorbox{${snipColor}}{${snipText}}`; break;
          case 'fcolorbox': code = `\\fcolorbox{${snipSecColor}}{${snipColor}}{${snipText}}`; break;
          case 'pagecolor': code = `\\pagecolor{${snipColor}}`; break;
          case 'rowcolor': code = `\\rowcolor{${snipColor}}`; break;
      }
      onInsert(code);
  };

  // Deduplicate base options
  const allColors = useMemo(() => {
      return Array.from(new Set([...STANDARD_LATEX_COLORS, ...customColors.map(c => c.name)]));
  }, [customColors]);
  
  const supportedModelsText = useMemo(() => COLOR_MODELS.map(m => m.label).join(', '), []);

  return (
    <Stack gap="md" h="100%" style={{ overflow: 'hidden' }}>
      
      {/* 1. Global Settings Section */}
      <Card withBorder p="sm" bg="dark.7">
        <Group justify="space-between" mb="xs">
            <Group gap="xs">
                <Checkbox 
                    label="Load xcolor package" 
                    checked={config.pkgXcolor} 
                    onChange={(e) => onChange('pkgXcolor', e.currentTarget.checked)} 
                    styles={{ label: { fontWeight: 700 } }}
                />
            </Group>
            {config.pkgXcolor && <Badge variant="outline" color="yellow">Recommended</Badge>}
        </Group>

        {config.pkgXcolor && (
            <MultiSelect 
                data={XCOLOR_OPTIONS}
                value={selectedOptions}
                onChange={handleOptionChange}
                placeholder="Select options..."
                label="Package Options & Drivers"
                description="Select Color Palettes, Features, or Drivers."
                searchable
                size="xs"
                clearable
                maxDropdownHeight={250}
            />
        )}
      </Card>

      {/* 2. Color Definition Area */}
      {config.pkgXcolor && (
        <Card withBorder p="0" bg="dark.7" style={{ overflow: 'visible' }}>
            <Box p="xs" bg="dark.8" style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}>
                <Group justify="space-between">
                    <Group gap="xs">
                        {defMode === 'snippets' 
                            ? <FontAwesomeIcon icon={faCode} color="#20c997" /> 
                            : <FontAwesomeIcon icon={faPalette} color="#fab005" />
                        }
                        <Text size="sm" fw={700}>{defMode === 'snippets' ? 'Use Colors (Snippets)' : 'Define New Color'}</Text>
                    </Group>
                    <SegmentedControl 
                        size="xs"
                        value={defMode}
                        onChange={(v: any) => setDefMode(v)}
                        data={[
                            { label: 'Picker', value: 'palette' },
                            { label: 'CMYK', value: 'cmyk' },
                            { label: 'Mixer', value: 'mixer' },
                            { label: 'Snippets', value: 'snippets' }
                        ]}
                    />
                </Group>
            </Box>

            <Box p="md">
                {/* --- PALETTE MODE --- */}
                {defMode === 'palette' && (
                    <Group align="flex-start" grow>
                        <Stack gap="xs" style={{ flex: 1 }}>
                            <TextInput 
                                label="Color Name" placeholder="e.g. brandBlue" 
                                value={palName} onChange={(e) => setPalName(e.currentTarget.value.replace(/[^a-zA-Z0-9]/g, ''))}
                            />
                            <Select 
                                label="Target Model" data={COLOR_MODELS}
                                value={palModel} onChange={(v) => setPalModel(v || 'HTML')} searchable
                            />
                            <TextInput 
                                label={`Calculated Value (${palModel})`} value={palCalculated} readOnly variant="filled"
                                rightSection={<Tooltip label="Auto-converted"><FontAwesomeIcon icon={faSync} /></Tooltip>}
                            />
                            <Button mt="md" onClick={handleAddPalette} leftSection={<FontAwesomeIcon icon={faPlus} />}>Add Color</Button>
                        </Stack>
                        <Stack align="center" gap="xs">
                            <Text size="sm" fw={500}>Pick Color</Text>
                            <ColorPicker format="hex" value={palColor} onChange={setPalColor} />
                            <ColorInput value={palColor} onChange={setPalColor} size="xs" w="100%" />
                        </Stack>
                    </Group>
                )}

                {/* --- CMYK MODE --- */}
                {defMode === 'cmyk' && (
                    <Stack gap="xs">
                         <TextInput label="Color Name" placeholder="e.g. printGold" value={cmykName} onChange={(e) => setCmykName(e.currentTarget.value.replace(/[^a-zA-Z0-9]/g, ''))} />
                        <SimpleGrid cols={2} spacing="xs">
                            <Group gap="xs" align="center">
                                <NumberInput label="Cyan" min={0} max={100} size="xs" w={70} value={cmykValues.c} onChange={(v) => setCmykValues({ ...cmykValues, c: Number(v) })} />
                                <Slider style={{ flex: 1 }} color="cyan" value={cmykValues.c} onChange={(v) => setCmykValues({ ...cmykValues, c: v })} label={null} />
                            </Group>
                            <Group gap="xs" align="center">
                                <NumberInput label="Magenta" min={0} max={100} size="xs" w={70} value={cmykValues.m} onChange={(v) => setCmykValues({ ...cmykValues, m: Number(v) })} />
                                <Slider style={{ flex: 1 }} color="grape" value={cmykValues.m} onChange={(v) => setCmykValues({ ...cmykValues, m: v })} label={null} />
                            </Group>
                            <Group gap="xs" align="center">
                                <NumberInput label="Yellow" min={0} max={100} size="xs" w={70} value={cmykValues.y} onChange={(v) => setCmykValues({ ...cmykValues, y: Number(v) })} />
                                <Slider style={{ flex: 1 }} color="yellow.4" value={cmykValues.y} onChange={(v) => setCmykValues({ ...cmykValues, y: v })} label={null} />
                            </Group>
                            <Group gap="xs" align="center">
                                <NumberInput label="Key/Black" min={0} max={100} size="xs" w={70} value={cmykValues.k} onChange={(v) => setCmykValues({ ...cmykValues, k: Number(v) })} />
                                <Slider style={{ flex: 1 }} color="black" value={cmykValues.k} onChange={(v) => setCmykValues({ ...cmykValues, k: v })} label={null} />
                            </Group>
                        </SimpleGrid>
                        <Button fullWidth mt="xs" variant="light" onClick={handleAddCmyk} leftSection={<FontAwesomeIcon icon={faPrint} />}>Define CMYK Color</Button>
                    </Stack>
                )}

                {/* --- MIXER MODE --- */}
                {defMode === 'mixer' && (
                    <Stack gap="xs">
                        <Group grow align="flex-end">
                            <TextInput label="New Alias Name" placeholder="e.g. softRed" value={mixName} onChange={(e) => setMixName(e.currentTarget.value.replace(/[^a-zA-Z0-9]/g, ''))} />
                            <ActionIcon variant="light" color="gray" size="lg" mb={4} onClick={handleResetMixer} title="Reset Mixer"><FontAwesomeIcon icon={faSync} /></ActionIcon>
                        </Group>
                        <Group grow>
                            <Select label="Base Color" data={allColors} value={mixBase} onChange={(v) => setMixBase(v || 'blue')} searchable />
                            <Select label="Mix With" data={allColors} value={mixSecondary} onChange={(v) => setMixSecondary(v || 'white')} searchable />
                        </Group>
                        <Stack gap={0}>
                            <Group justify="space-between">
                                <Text size="xs">Mix Amount: <b>{mixPercent}%</b> {mixBase}</Text>
                                <NumberInput value={mixPercent} onChange={setMixPercent} min={0} max={100} step={5} size="xs" w={80} />
                            </Group>
                            <Slider value={Number(mixPercent)} onChange={setMixPercent} marks={[{ value: 25 }, { value: 50 }, { value: 75 }]} />
                        </Stack>
                        <Button mt="xs" onClick={handleAddMix} leftSection={<FontAwesomeIcon icon={faFlask} />}>Create Mix</Button>
                    </Stack>
                )}

                {/* --- SNIPPETS MODE (New) --- */}
                {defMode === 'snippets' && (
                    <Stack gap="xs">
                         <SegmentedControl 
                            fullWidth
                            size="xs"
                            value={snipType}
                            onChange={(v: any) => setSnipType(v)}
                            data={[
                                { label: 'Text Color', value: 'textcolor' },
                                { label: 'Highlight', value: 'colorbox' },
                                { label: 'Frame', value: 'fcolorbox' },
                                { label: 'Page', value: 'pagecolor' },
                                { label: 'Table', value: 'rowcolor' }
                            ]}
                        />
                        
                        <SimpleGrid cols={2}>
                            <Select label={snipType === 'fcolorbox' ? "Fill Color" : "Color"} data={allColors} value={snipColor} onChange={(v) => setSnipColor(v || 'blue')} searchable />
                            {snipType === 'fcolorbox' && (
                                <Select label="Frame Color" data={allColors} value={snipSecColor} onChange={(v) => setSnipSecColor(v || 'black')} searchable />
                            )}
                        </SimpleGrid>

                        {['textcolor', 'colorbox', 'fcolorbox'].includes(snipType) && (
                            <TextInput label="Content Text" value={snipText} onChange={(e) => setSnipText(e.currentTarget.value)} />
                        )}

                        <Paper p="xs" bg="dark.6" mt="xs">
                            <Code block>
                                {snipType === 'textcolor' && `\\textcolor{${snipColor}}{${snipText}}`}
                                {snipType === 'colorbox' && `\\colorbox{${snipColor}}{${snipText}}`}
                                {snipType === 'fcolorbox' && `\\fcolorbox{${snipSecColor}}{${snipColor}}{${snipText}}`}
                                {snipType === 'pagecolor' && `\\pagecolor{${snipColor}}`}
                                {snipType === 'rowcolor' && `\\rowcolor{${snipColor}}`}
                            </Code>
                        </Paper>
                        
                        <Group grow>
                             <Button variant="light" onClick={() => navigator.clipboard.writeText(
                                snipType === 'textcolor' ? `\\textcolor{${snipColor}}{${snipText}}` :
                                snipType === 'colorbox' ? `\\colorbox{${snipColor}}{${snipText}}` :
                                snipType === 'fcolorbox' ? `\\fcolorbox{${snipSecColor}}{${snipColor}}{${snipText}}` :
                                snipType === 'pagecolor' ? `\\pagecolor{${snipColor}}` :
                                `\\rowcolor{${snipColor}}`
                             )}>Copy</Button>
                             {onInsert && (
                                 <Button onClick={handleInsertSnippet} color="teal">Insert</Button>
                             )}
                        </Group>
                    </Stack>
                )}
            </Box>
        </Card>
      )}

      {/* 3. Defined Colors List */}
      <Stack gap="xs" style={{ flex: 1, overflow: 'hidden' }}>
        <Divider label="Defined Colors" labelPosition="center" />
        <Stack gap="xs" style={{ overflowY: 'auto' }}>
            {customColors.map(c => (
            <Group key={c.id} justify="space-between" bg="dark.6" p="xs" style={{ borderRadius: 4, borderLeft: `4px solid ${c.previewHex}` }}>
                <Group gap="sm">
                    {/* Color Preview Block */}
                    <Tooltip label={c.model === 'named (mix)' ? 'Mix Preview Unavailable' : `Hex: ${c.previewHex}`}>
                        <Box 
                            style={{ 
                                width: 32, height: 32, borderRadius: 4, 
                                backgroundColor: c.previewHex, 
                                boxShadow: '0 0 0 1px rgba(255,255,255,0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            {c.model === 'named (mix)' && <FontAwesomeIcon icon={faFlask} style={{ opacity: 0.5, fontSize: 10 }} />}
                        </Box>
                    </Tooltip>
                    
                    <Stack gap={0}>
                        <Group gap={6}>
                            <FontAwesomeIcon icon={faCheckCircle} style={{ width: 10, height: 10, color: '#40c057' }} />
                            <Text size="sm" fw={700}>{c.name}</Text>
                            {c.model === 'cmyk' && <Badge size="xs" color="grape" variant="dot">CMYK</Badge>}
                            {c.model === 'named (mix)' && <Badge size="xs" color="orange" variant="dot">MIX</Badge>}
                        </Group>
                        <Code color="dark.4" style={{ fontSize: 10, padding: 2 }}>
                            {c.model === 'named (mix)' 
                                ? `\\colorlet{${c.name}}{${c.value}}` 
                                : `\\definecolor{${c.name}}{${c.model}}{${c.value}}`
                            }
                        </Code>
                    </Stack>
                </Group>

                <ActionIcon color="red" variant="subtle" size="sm" onClick={() => onRemoveColor(c.id)}>
                    <FontAwesomeIcon icon={faTrash} />
                </ActionIcon>
            </Group>
            ))}
            
            {customColors.length === 0 && (
                <Stack align="center" gap="xs" py="xl" opacity={0.5}>
                    <FontAwesomeIcon icon={faList} size="2x" />
                    <Text size="sm">No custom colors added.</Text>
                </Stack>
            )}
        </Stack>
      </Stack>
    </Stack>
  );
};