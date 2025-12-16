import React, { useState, useEffect, useMemo } from 'react';
import { 
  Grid, Select, TextInput, NumberInput, Checkbox, Switch, 
  Button, Tabs, Divider, ColorInput, ActionIcon, Group, 
  Stack, Text, Code, ScrollArea, Box, Radio, Badge,
  SimpleGrid, Card, Tooltip
} from '@mantine/core';
import { 
  Check, Trash, Plus, FileText, Layout, Package, Palette, 
  Code as CodeIcon, Eye, RefreshCw, List as ListIcon
} from 'lucide-react';

interface PreambleWizardProps {
  onInsert: (code: string) => void;
}

// --- Constants ---
const PAGE_WIDTH_PX = 340;
const A4_ASPECT_RATIO = 1.414;
const PAGE_HEIGHT_PX = PAGE_WIDTH_PX * A4_ASPECT_RATIO;
const A4_WIDTH_CM = 21;
const CM_TO_PX = PAGE_WIDTH_PX / A4_WIDTH_CM;

const LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'greek', label: 'Greek (Ελληνικά)' },
  { value: 'german', label: 'German (Deutsch)' },
  { value: 'french', label: 'French (Français)' },
  { value: 'spanish', label: 'Spanish (Español)' },
  { value: 'italian', label: 'Italian (Italiano)' },
  { value: 'portuguese', label: 'Portuguese (Português)' },
  { value: 'dutch', label: 'Dutch (Nederlands)' },
  { value: 'russian', label: 'Russian (Русский)' },
  { value: 'polish', label: 'Polish (Polski)' },
  { value: 'czech', label: 'Czech (Čeština)' },
  { value: 'turkish', label: 'Turkish (Türkçe)' },
  { value: 'swedish', label: 'Swedish (Svenska)' },
  { value: 'danish', label: 'Danish (Dansk)' },
  { value: 'norwegian', label: 'Norwegian (Norsk)' },
  { value: 'finnish', label: 'Finnish (Suomi)' },
  { value: 'hungarian', label: 'Hungarian (Magyar)' },
  { value: 'romanian', label: 'Romanian (Română)' },
  { value: 'bulgarian', label: 'Bulgarian (Български)' },
  { value: 'ukrainian', label: 'Ukrainian (Українська)' },
  { value: 'hebrew', label: 'Hebrew (עִבְרִית)' },
  { value: 'arabic', label: 'Arabic (العربية)' },
  { value: 'chinese', label: 'Chinese (中文)' },
  { value: 'japanese', label: 'Japanese (日本語)' },
  { value: 'korean', label: 'Korean (한국어)' },
  { value: 'latin', label: 'Latin' },
];

const COLOR_MODELS = [
  { value: 'HTML', label: 'HTML (Hex)' },
  { value: 'rgb', label: 'rgb (0-1)' },
  { value: 'RGB', label: 'RGB (0-255)' },
  { value: 'cmy', label: 'cmy (0-1)' },
  { value: 'cmyk', label: 'cmyk (0-1)' },
  { value: 'hsb', label: 'hsb (0-1)' },
  { value: 'HSB', label: 'HSB (0-255)' },
  { value: 'gray', label: 'gray (0-1)' },
  { value: 'Gray', label: 'Gray (0-15)' },
];

const PAPER_SIZES = [
  { value: 'a4paper', label: 'A4' },
  { value: 'letterpaper', label: 'Letter' },
  { value: 'a5paper', label: 'A5' },
  { value: 'b5paper', label: 'B5' },
  { value: 'executivepaper', label: 'Executive' },
  { value: 'legalpaper', label: 'Legal' },
  { value: 'a3paper', label: 'A3' },
  { value: 'b4paper', label: 'B4' },
];

interface CustomColorDef {
  id: number;
  name: string;
  model: string;
  value: string;
  previewHex: string; // Used strictly for UI preview
}

interface CustomListDef {
  id: number;
  name: string;
  baseType: 'itemize' | 'enumerate' | 'description';
  label: string;
}

// --- Helper: Color Conversion Logic ---
const hexToModelValue = (hex: string, model: string): string => {
  hex = hex.replace('#', '');
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const rgbToHsv = (r: number, g: number, b: number) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    const s = max === 0 ? 0 : d / max;
    const v = max;
    let h = 0;
    if (max !== min) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h, s, v };
  };

  switch (model) {
    case 'HTML': return hex.toUpperCase();
    case 'RGB': return `${r},${g},${b}`;
    case 'rgb': return `${rNorm.toFixed(3)},${gNorm.toFixed(3)},${bNorm.toFixed(3)}`;
    case 'gray': return (0.299 * rNorm + 0.587 * gNorm + 0.114 * bNorm).toFixed(3);
    case 'Gray': return Math.round((0.299 * rNorm + 0.587 * gNorm + 0.114 * bNorm) * 15).toString();
    case 'cmy': return `${(1 - rNorm).toFixed(3)},${(1 - gNorm).toFixed(3)},${(1 - bNorm).toFixed(3)}`;
    case 'cmyk':
      const k = 1 - Math.max(rNorm, gNorm, bNorm);
      if (k === 1) return '0,0,0,1';
      return `${((1 - rNorm - k) / (1 - k)).toFixed(3)},${((1 - gNorm - k) / (1 - k)).toFixed(3)},${((1 - bNorm - k) / (1 - k)).toFixed(3)},${k.toFixed(3)}`;
    case 'hsb':
      const hsb = rgbToHsv(rNorm, gNorm, bNorm);
      return `${hsb.h.toFixed(3)},${hsb.s.toFixed(3)},${hsb.v.toFixed(3)}`;
    case 'HSB':
      const HSB = rgbToHsv(rNorm, gNorm, bNorm);
      return `${Math.round(HSB.h * 255)},${Math.round(HSB.s * 255)},${Math.round(HSB.v * 255)}`;
    default: return hex;
  }
};

export const PreambleWizard: React.FC<PreambleWizardProps> = ({ onInsert }) => {
  const [activeTab, setActiveTab] = useState<string | null>('general');
  const [previewMode, setPreviewMode] = useState<'code' | 'visual'>('visual');
  const [generatedCode, setGeneratedCode] = useState('');

  // --- Configuration State ---
  const [config, setConfig] = useState({
    docClass: 'article',
    fontSize: '11',
    paperSize: 'a4paper',
    encoding: 'utf8',
    mainLang: 'english',
    title: '',
    author: '',
    date: true,
    
    // Geometry
    pkgGeometry: true,
    marginTop: 2.5,
    marginBottom: 2.5,
    marginLeft: 2.5,
    marginRight: 2.5,
    columns: 'one',
    columnSep: 0.5,
    sidedness: 'oneside',
    marginNotes: false,
    marginSep: 0.5,
    marginWidth: 3.0,
    includeMp: false,
    
    headHeight: 0,
    headSep: 0,
    footSkip: 0,
    bindingOffset: 0,
    hOffset: 0,
    vOffset: 0,
    
    includeHead: false,
    includeFoot: false,
    
    // Packages
    pkgAmsmath: true,
    pkgGraphicx: true,
    pkgHyperref: true,
    pkgTikz: false,
    pkgPgfplots: false,
    pkgBooktabs: false,
    pkgFloat: false,
    pkgFancyhdr: false,
    pkgXcolor: true,

    // New Packages
    pkgSiunitx: false,
    pkgMicrotype: false,
    pkgCsquotes: false,
    pkgMultirow: false,
    pkgTabularx: false,
    pkgMulticol: false,
    pkgTitlesec: false,
    pkgCaption: false,
    pkgSubcaption: false,
    pkgListings: false,
    pkgCleveref: false,
    pkgTodonotes: false,

    // Lists (Enumitem)
    pkgEnumitem: false,
    enumitemSep: 'default', // default, nosep, half
    enumitemItemize: 'default', // default, dash, asterisk
    enumitemEnumerate: 'default', // default, alph, roman
  });

  // --- Custom Colors State ---
  const [customColors, setCustomColors] = useState<CustomColorDef[]>([]);
  const [newColorName, setNewColorName] = useState('');
  const [newColorModel, setNewColorModel] = useState('HTML');
  const [pickerColor, setPickerColor] = useState('#1971C2');
  const [newColorValue, setNewColorValue] = useState('');

  // --- Custom Lists State ---
  const [customLists, setCustomLists] = useState<CustomListDef[]>([]);
  const [newListName, setNewListName] = useState('');
  const [newListType, setNewListType] = useState<string>('enumerate');
  const [newListLabel, setNewListLabel] = useState('');

  const handleChange = (key: string, val: any) => {
    setConfig(prev => ({ ...prev, [key]: val }));
  };

  useEffect(() => {
    const val = hexToModelValue(pickerColor, newColorModel);
    setNewColorValue(val);
  }, [pickerColor, newColorModel]);

  // --- Code Generation ---
  useEffect(() => {
    const v = config;
    let code = '';

    // Class Options
    let classOpts: string[] = [`${v.fontSize}pt`, v.paperSize];
    if (v.columns === 'two') classOpts.push('twocolumn');
    if (v.sidedness === 'twoside') classOpts.push('twoside');

    code += `\\documentclass[${classOpts.join(', ')}]{${v.docClass}}\n`;
    code += `\\usepackage[${v.encoding}]{inputenc}\n`;
    code += `\\usepackage[T1]{fontenc}\n`;

    let babelOpts = ['english'];
    if (v.mainLang !== 'english') babelOpts.push(v.mainLang);
    code += `\\usepackage[${babelOpts.join(',')}]{babel}\n`;
    if (v.mainLang === 'greek') code += `\\usepackage{alphabeta}\n`;

    // Geometry Generation
    if (v.pkgGeometry) {
      let gOpts: string[] = [];
      // Basic
      gOpts.push(`top=${v.marginTop}cm`, `bottom=${v.marginBottom}cm`, `left=${v.marginLeft}cm`, `right=${v.marginRight}cm`);
      
      // Columns
      if (v.columns === 'two') gOpts.push(`columnsep=${v.columnSep}cm`);
      
      // Margins
      if (v.marginNotes) {
        gOpts.push(`marginparsep=${v.marginSep}cm`, `marginparwidth=${v.marginWidth}cm`);
        if (v.includeMp) gOpts.push(`includemp`);
      }
      
      // Header/Footer/Offsets
      if (v.headHeight > 0) gOpts.push(`headheight=${v.headHeight}cm`);
      if (v.headSep > 0) gOpts.push(`headsep=${v.headSep}cm`);
      if (v.footSkip > 0) gOpts.push(`footskip=${v.footSkip}cm`);
      if (v.bindingOffset > 0) gOpts.push(`bindingoffset=${v.bindingOffset}cm`);
      if (v.hOffset !== 0) gOpts.push(`hoffset=${v.hOffset}cm`); 
      if (v.vOffset !== 0) gOpts.push(`voffset=${v.vOffset}cm`);
      
      if (v.includeHead) gOpts.push(`includehead`);
      if (v.includeFoot) gOpts.push(`includefoot`);
      if (v.sidedness === 'asymmetric') gOpts.push(`asymmetric`);

      code += `\\usepackage[${gOpts.join(', ')}]{geometry}\n`;
    }

    code += `\n% --- Packages ---\n`;
    if (v.pkgAmsmath) code += `\\usepackage{amsmath, amsfonts, amssymb}\n`;
    if (v.pkgGraphicx) code += `\\usepackage{graphicx}\n`;
    
    if (v.pkgXcolor || customColors.length > 0) {
        code += `\\usepackage[dvipsnames, table]{xcolor}\n`;
    }

    if (customColors.length > 0) {
        code += `\n% --- Custom Colors ---\n`;
        customColors.forEach(c => {
            code += `\\definecolor{${c.name}}{${c.model}}{${c.value}}\n`;
        });
    }

    // Enumitem Configuration
    if (v.pkgEnumitem) {
        code += `\\usepackage{enumitem}\n`;
        
        // Global Spacing
        if (v.enumitemSep === 'nosep') code += `\\setlist{nosep}\n`;
        else if (v.enumitemSep === 'half') code += `\\setlist{itemsep=0.5ex}\n`;

        // Itemize Settings
        if (v.enumitemItemize !== 'default') {
            let label = '';
            if (v.enumitemItemize === 'dash') label = 'label={--}';
            else if (v.enumitemItemize === 'asterisk') label = 'label={*}';
            else if (v.enumitemItemize === 'bullet') label = 'label=\\textbullet';
            if (label) code += `\\setlist[itemize]{${label}}\n`;
        }

        // Enumerate Settings
        if (v.enumitemEnumerate !== 'default') {
            let label = '';
            if (v.enumitemEnumerate === 'alph') label = 'label=\\alph*), ref=\\alph*)';
            else if (v.enumitemEnumerate === 'Alph') label = 'label=\\Alph*., ref=\\Alph*';
            else if (v.enumitemEnumerate === 'roman') label = 'label=\\roman*), ref=\\roman*)';
            else if (v.enumitemEnumerate === 'Roman') label = 'label=\\Roman*., ref=\\Roman*';
            else if (v.enumitemEnumerate === 'arabic_paren') label = 'label=(\\arabic*), ref=(\\arabic*)';
            if (label) code += `\\setlist[enumerate]{${label}}\n`;
        }

        // Custom Lists
        if (customLists.length > 0) {
            code += `\n% --- Custom Lists ---\n`;
            customLists.forEach(l => {
                code += `\\newlist{${l.name}}{${l.baseType}}{3}\n`;
                if (l.label) {
                    code += `\\setlist[${l.name}]{label=${l.label}}\n`;
                }
            });
        }
    }

    if (v.pkgBooktabs) code += `\\usepackage{booktabs}\n`;
    if (v.pkgMultirow) code += `\\usepackage{multirow}\n`;
    if (v.pkgTabularx) code += `\\usepackage{tabularx}\n`;

    if (v.pkgFloat) code += `\\usepackage{float}\n`;
    if (v.pkgCaption) code += `\\usepackage{caption}\n`;
    if (v.pkgSubcaption) code += `\\usepackage{subcaption}\n`;

    if (v.pkgTikz) code += `\\usepackage{tikz}\n`;
    if (v.pkgPgfplots) code += `\\usepackage{pgfplots}\n\\pgfplotsset{compat=1.18}\n`;

    if (v.pkgFancyhdr) code += `\\usepackage{fancyhdr}\n\\pagestyle{fancy}\n`;
    if (v.pkgMulticol) code += `\\usepackage{multicol}\n`;
    if (v.pkgTitlesec) code += `\\usepackage{titlesec}\n`;
    if (v.pkgMicrotype) code += `\\usepackage{microtype}\n`;
    if (v.pkgCsquotes) code += `\\usepackage{csquotes}\n`;
    if (v.pkgSiunitx) code += `\\usepackage{siunitx}\n`;
    if (v.pkgListings) code += `\\usepackage{listings}\n`;

    if (v.pkgHyperref) code += `\\usepackage{hyperref}\n\\hypersetup{colorlinks=true, linkcolor=blue}\n`;
    if (v.pkgTodonotes) code += `\\usepackage{todonotes}\n`;
    if (v.pkgCleveref) code += `\\usepackage{cleveref}\n`;

    code += `\n% --- Metadata ---\n`;
    code += `\\title{${v.title || 'Untitled'}}\n`;
    code += `\\author{${v.author || ''}}\n`;
    code += `\\date{${v.date ? '\\today' : ''}}\n`;

    code += `\n\\begin{document}\n\n\\maketitle\n\n\\section{Introduction}\n% Content here\n\n\\end{document}`;
    setGeneratedCode(code);
  }, [config, customColors, customLists]);

  const addColor = () => {
    if (newColorName && newColorValue) {
      const sanitizedName = newColorName.replace(/[^a-zA-Z0-9]/g, '');
      setCustomColors([
          ...customColors, 
          { 
              id: Date.now(), 
              name: sanitizedName, 
              model: newColorModel, 
              value: newColorValue,
              previewHex: pickerColor 
          }
      ]);
      setNewColorName('');
    }
  };

  const addList = () => {
    if (newListName && newListType) {
       const sanitizedName = newListName.replace(/[^a-zA-Z0-9]/g, '');
       setCustomLists([...customLists, {
          id: Date.now(),
          name: sanitizedName,
          baseType: newListType as any,
          label: newListLabel
       }]);
       setNewListName('');
       setNewListLabel('');
    }
  };

  const geometryStyles = useMemo(() => {
    const headerHeightPx = config.pkgGeometry ? config.headHeight * CM_TO_PX : 0;
    const headerSepPx = config.pkgGeometry ? config.headSep * CM_TO_PX : 0;
    
    const vOffsetPx = config.pkgGeometry ? config.vOffset * CM_TO_PX : 0;
    const hOffsetPx = config.pkgGeometry ? config.hOffset * CM_TO_PX : 0;

    const bodyTopPx = config.pkgGeometry 
        ? config.marginTop * CM_TO_PX + (config.includeHead ? 0 : headerHeightPx + headerSepPx) + vOffsetPx
        : 30;
    
    const bodyBottomMarginPx = config.pkgGeometry ? config.marginBottom * CM_TO_PX : 30;
    const bodyBottomPx = PAGE_HEIGHT_PX - bodyBottomMarginPx + vOffsetPx;

    const bodyRightEdgePx = PAGE_WIDTH_PX - (config.marginRight * CM_TO_PX) + hOffsetPx;
    const marginNotesStartPx = bodyRightEdgePx + (config.marginSep * CM_TO_PX);
    const marginNotesWidthCapPx = config.marginWidth * CM_TO_PX;

    const containerStyle = {
        transform: `translate(${hOffsetPx}px, ${vOffsetPx}px)`,
        transition: 'transform 0.3s ease'
    };

    return { headerHeightPx, headerSepPx, bodyTopPx, bodyBottomPx, bodyBottomMarginPx, marginNotesStartPx, marginNotesWidthCapPx, containerStyle };
  }, [config]);

  return (
    <Grid h="100%" gutter={0}>
      <Grid.Col span={7} h="100%">
        <ScrollArea h="100%">
          <Stack gap="md" p="md">
            
            <Tabs value={activeTab} onChange={setActiveTab} variant="pills" radius="sm">
              <Tabs.List grow>
                <Tabs.Tab value="general" leftSection={<FileText size={16}/>}>General</Tabs.Tab>
                <Tabs.Tab value="layout" leftSection={<Layout size={16}/>}>Layout</Tabs.Tab>
                <Tabs.Tab value="packages" leftSection={<Package size={16}/>}>Packages</Tabs.Tab>
                <Tabs.Tab value="lists" leftSection={<ListIcon size={16}/>}>Lists</Tabs.Tab>
                <Tabs.Tab value="colors" leftSection={<Palette size={16}/>}>Colors</Tabs.Tab>
              </Tabs.List>

              {/* TABS CONTENT */}
              <Tabs.Panel value="general" pt="md">
                <SimpleGrid cols={2} spacing="md">
                  <Select label="Document Class" data={['article', 'report', 'book', 'beamer']} value={config.docClass} onChange={(v) => handleChange('docClass', v)} />
                  <Select label="Font Size (pt)" data={['10', '11', '12']} value={config.fontSize} onChange={(v) => handleChange('fontSize', v)} />
                  <Select label="Paper Size" data={PAPER_SIZES} value={config.paperSize} onChange={(v) => handleChange('paperSize', v)} />
                  <Select label="Language" data={LANGUAGES} value={config.mainLang} onChange={(v) => handleChange('mainLang', v)} searchable />
                </SimpleGrid>
                <Divider my="md" />
                <TextInput label="Title" mb="sm" value={config.title} onChange={(e) => handleChange('title', e.currentTarget.value)} />
                <Group grow>
                   <TextInput label="Author" value={config.author} onChange={(e) => handleChange('author', e.currentTarget.value)} />
                   <Switch label="Include Date" checked={config.date} onChange={(e) => handleChange('date', e.currentTarget.checked)} mt={24} />
                </Group>
              </Tabs.Panel>

              <Tabs.Panel value="layout" pt="md">
                 <Card withBorder p="sm" bg="dark.7" mb="md">
                   <Group justify="space-between">
                     <Text fw={500}>Geometry Package</Text>
                     <Switch checked={config.pkgGeometry} onChange={(e) => handleChange('pkgGeometry', e.currentTarget.checked)} />
                   </Group>
                 </Card>
                 {config.pkgGeometry && (
                   <Stack>
                     <Group grow align="start">
                        <Stack gap="xs">
                            <Text size="sm" fw={500} c="dimmed">COLUMNS</Text>
                            <Radio.Group value={config.columns} onChange={(v) => handleChange('columns', v)}>
                                <Group>
                                    <Radio value="one" label="One" />
                                    <Radio value="two" label="Two" />
                                </Group>
                            </Radio.Group>
                            {config.columns === 'two' && <NumberInput label="Sep (cm)" value={config.columnSep} onChange={(v) => handleChange('columnSep', v)} step={0.1} size="xs" />}
                        </Stack>
                        <Stack gap="xs">
                            <Text size="sm" fw={500} c="dimmed">SIDEDNESS</Text>
                            <Select data={['oneside', 'twoside', 'asymmetric']} value={config.sidedness} onChange={(v) => handleChange('sidedness', v)} />
                        </Stack>
                     </Group>
                     <Divider />
                     <Text size="sm" fw={500} c="dimmed">MARGINS (cm)</Text>
                     <SimpleGrid cols={4}>
                        <NumberInput label="Top" value={config.marginTop} onChange={(v) => handleChange('marginTop', v)} step={0.1} min={0} />
                        <NumberInput label="Bottom" value={config.marginBottom} onChange={(v) => handleChange('marginBottom', v)} step={0.1} min={0} />
                        <NumberInput label="Left" value={config.marginLeft} onChange={(v) => handleChange('marginLeft', v)} step={0.1} min={0} />
                        <NumberInput label="Right" value={config.marginRight} onChange={(v) => handleChange('marginRight', v)} step={0.1} min={0} />
                     </SimpleGrid>
                     <Divider />
                     <Text size="sm" fw={500} c="dimmed">HEADER & FOOTER & OFFSETS (cm)</Text>
                     <SimpleGrid cols={3}>
                        <NumberInput label="Head Height" value={config.headHeight} onChange={(v) => handleChange('headHeight', v)} step={0.1} min={0} />
                        <NumberInput label="Head Sep" value={config.headSep} onChange={(v) => handleChange('headSep', v)} step={0.1} min={0} />
                        <Checkbox label="Include Head" checked={config.includeHead} onChange={(e) => handleChange('includeHead', e.currentTarget.checked)} mt={28} />
                        <NumberInput label="Foot Skip" value={config.footSkip} onChange={(v) => handleChange('footSkip', v)} step={0.1} min={0} />
                        <NumberInput label="Binding Offset" value={config.bindingOffset} onChange={(v) => handleChange('bindingOffset', v)} step={0.1} min={0} />
                        <Checkbox label="Include Foot" checked={config.includeFoot} onChange={(e) => handleChange('includeFoot', e.currentTarget.checked)} mt={28} />
                        <NumberInput label="H Offset" value={config.hOffset} onChange={(v) => handleChange('hOffset', v)} step={0.1} />
                        <NumberInput label="V Offset" value={config.vOffset} onChange={(v) => handleChange('vOffset', v)} step={0.1} />
                     </SimpleGrid>
                     <Divider />
                     <Group>
                        <Checkbox label="Enable Margin Notes" checked={config.marginNotes} onChange={(e) => handleChange('marginNotes', e.currentTarget.checked)} />
                        {config.marginNotes && (
                            <>
                                <Checkbox label="Include MP" checked={config.includeMp} onChange={(e) => handleChange('includeMp', e.currentTarget.checked)} />
                                <NumberInput placeholder="Sep" value={config.marginSep} onChange={(v) => handleChange('marginSep', v)} w={80} size="xs" />
                                <NumberInput placeholder="Width" value={config.marginWidth} onChange={(v) => handleChange('marginWidth', v)} w={80} size="xs" />
                            </>
                        )}
                     </Group>
                   </Stack>
                 )}
              </Tabs.Panel>

              <Tabs.Panel value="packages" pt="md">
                <SimpleGrid cols={2} spacing="lg">
                    <Stack gap="xs">
                        <Text fw={700} size="sm">Mathematics & Science</Text>
                        <Checkbox label="AMS Suite" checked={config.pkgAmsmath} onChange={(e) => handleChange('pkgAmsmath', e.currentTarget.checked)} />
                        <Checkbox label="Siunitx" checked={config.pkgSiunitx} onChange={(e) => handleChange('pkgSiunitx', e.currentTarget.checked)} />
                    </Stack>

                    <Stack gap="xs">
                        <Text fw={700} size="sm">Graphics & Figures</Text>
                        <Checkbox label="Graphicx" checked={config.pkgGraphicx} onChange={(e) => handleChange('pkgGraphicx', e.currentTarget.checked)} />
                        <Checkbox label="TikZ" checked={config.pkgTikz} onChange={(e) => handleChange('pkgTikz', e.currentTarget.checked)} />
                        <Checkbox label="Pgfplots" checked={config.pkgPgfplots} onChange={(e) => handleChange('pkgPgfplots', e.currentTarget.checked)} />
                        <Checkbox label="Float" checked={config.pkgFloat} onChange={(e) => handleChange('pkgFloat', e.currentTarget.checked)} />
                        <Checkbox label="Caption" checked={config.pkgCaption} onChange={(e) => handleChange('pkgCaption', e.currentTarget.checked)} />
                        <Checkbox label="Subcaption" checked={config.pkgSubcaption} onChange={(e) => handleChange('pkgSubcaption', e.currentTarget.checked)} />
                    </Stack>

                    <Stack gap="xs">
                        <Text fw={700} size="sm">Tables</Text>
                        <Checkbox label="Booktabs" checked={config.pkgBooktabs} onChange={(e) => handleChange('pkgBooktabs', e.currentTarget.checked)} />
                        <Checkbox label="Multirow" checked={config.pkgMultirow} onChange={(e) => handleChange('pkgMultirow', e.currentTarget.checked)} />
                        <Checkbox label="Tabularx" checked={config.pkgTabularx} onChange={(e) => handleChange('pkgTabularx', e.currentTarget.checked)} />
                    </Stack>

                    <Stack gap="xs">
                        <Text fw={700} size="sm">Layout & Formatting</Text>
                        <Checkbox label="Fancyhdr" checked={config.pkgFancyhdr} onChange={(e) => handleChange('pkgFancyhdr', e.currentTarget.checked)} />
                        <Checkbox label="Multicol" checked={config.pkgMulticol} onChange={(e) => handleChange('pkgMulticol', e.currentTarget.checked)} />
                        <Checkbox label="Titlesec" checked={config.pkgTitlesec} onChange={(e) => handleChange('pkgTitlesec', e.currentTarget.checked)} />
                        <Checkbox label="Microtype" checked={config.pkgMicrotype} onChange={(e) => handleChange('pkgMicrotype', e.currentTarget.checked)} />
                        <Checkbox label="Csquotes" checked={config.pkgCsquotes} onChange={(e) => handleChange('pkgCsquotes', e.currentTarget.checked)} />
                    </Stack>

                    <Stack gap="xs">
                        <Text fw={700} size="sm">References & Code</Text>
                        <Checkbox label="Hyperref" checked={config.pkgHyperref} onChange={(e) => handleChange('pkgHyperref', e.currentTarget.checked)} />
                        <Checkbox label="Cleveref" checked={config.pkgCleveref} onChange={(e) => handleChange('pkgCleveref', e.currentTarget.checked)} />
                        <Checkbox label="Listings" checked={config.pkgListings} onChange={(e) => handleChange('pkgListings', e.currentTarget.checked)} />
                        <Checkbox label="Todonotes" checked={config.pkgTodonotes} onChange={(e) => handleChange('pkgTodonotes', e.currentTarget.checked)} />
                    </Stack>
                </SimpleGrid>
              </Tabs.Panel>

              {/* LISTS TAB (UPDATED) */}
              <Tabs.Panel value="lists" pt="md">
                <Card withBorder p="sm" bg="dark.7" mb="md">
                   <Group justify="space-between">
                     <Text fw={500}>Enumitem Package</Text>
                     <Switch checked={config.pkgEnumitem} onChange={(e) => handleChange('pkgEnumitem', e.currentTarget.checked)} />
                   </Group>
                </Card>

                {config.pkgEnumitem && (
                    <Stack gap="md">
                        <Select 
                            label="Global Spacing" 
                            description="Sets the vertical spacing for all lists."
                            data={[
                                { value: 'default', label: 'Default' },
                                { value: 'nosep', label: 'No Separation (nosep)' },
                                { value: 'half', label: 'Half Spacing' }
                            ]}
                            value={config.enumitemSep}
                            onChange={(v) => handleChange('enumitemSep', v)}
                        />
                        
                        <Divider label="Itemize Settings" labelPosition="left" />
                        <Select 
                            label="Default Bullet Label"
                            data={[
                                { value: 'default', label: 'Default' },
                                { value: 'bullet', label: 'Bullet (•)' },
                                { value: 'dash', label: 'Dash (–)' },
                                { value: 'asterisk', label: 'Asterisk (*)' },
                            ]}
                            value={config.enumitemItemize}
                            onChange={(v) => handleChange('enumitemItemize', v)}
                        />

                        <Divider label="Enumerate Settings" labelPosition="left" />
                        <Select 
                            label="Default Numbering"
                            data={[
                                { value: 'default', label: 'Default (1.)' },
                                { value: 'arabic_paren', label: 'Parenthesis (1)' },
                                { value: 'alph', label: 'Small Alpha a)' },
                                { value: 'Alph', label: 'Big Alpha A.' },
                                { value: 'roman', label: 'Small Roman i)' },
                                { value: 'Roman', label: 'Big Roman I.' },
                            ]}
                            value={config.enumitemEnumerate}
                            onChange={(v) => handleChange('enumitemEnumerate', v)}
                        />

                        <Divider my="sm" />
                        <Text size="sm" fw={700} mb="xs">Custom Lists</Text>
                        <Card withBorder p="sm" bg="dark.7">
                           <Stack gap="sm">
                              <Group grow>
                                 <TextInput label="Name" placeholder="e.g. questions" value={newListName} onChange={(e) => setNewListName(e.currentTarget.value)} />
                                 <Select label="Base Type" data={['enumerate', 'itemize', 'description']} value={newListType} onChange={(v) => setNewListType(v || 'enumerate')} />
                              </Group>
                              <Group align="flex-end">
                                 <TextInput label="Label Pattern" placeholder="e.g. \arabic*." value={newListLabel} onChange={(e) => setNewListLabel(e.currentTarget.value)} style={{ flex: 1 }} />
                                 <Button onClick={addList} leftSection={<Plus size={16}/>}>Add</Button>
                              </Group>
                           </Stack>
                        </Card>

                        <Stack gap="xs" mt="sm">
                           {customLists.map(l => (
                              <Group key={l.id} justify="space-between" bg="dark.6" p="xs" style={{ borderRadius: 4 }}>
                                 <Stack gap={0}>
                                    <Text size="sm" fw={500}>{l.name}</Text>
                                    <Text size="xs" c="dimmed">Type: {l.baseType} | Label: {l.label || 'Default'}</Text>
                                 </Stack>
                                 <ActionIcon color="red" variant="subtle" onClick={() => setCustomLists(customLists.filter(x => x.id !== l.id))}>
                                    <Trash size={16} />
                                 </ActionIcon>
                              </Group>
                           ))}
                        </Stack>
                    </Stack>
                )}
              </Tabs.Panel>

              {/* COLORS TAB */}
              <Tabs.Panel value="colors" pt="md">
                <Checkbox label="Enable Xcolor Package" checked={config.pkgXcolor} onChange={(e) => handleChange('pkgXcolor', e.currentTarget.checked)} mb="md" />
                
                <Card withBorder p="sm" bg="dark.7" mb="md">
                    <Text size="sm" fw={700} mb="xs">Define New Color</Text>
                    <Stack gap="sm">
                        <Group grow align="flex-end">
                            <TextInput 
                                label="Color Name" 
                                placeholder="e.g. myBlue" 
                                value={newColorName} 
                                onChange={(e) => setNewColorName(e.currentTarget.value)} 
                            />
                            <Select 
                                label="Model" 
                                data={COLOR_MODELS} 
                                value={newColorModel} 
                                onChange={(v) => setNewColorModel(v || 'HTML')}
                            />
                             <ColorInput 
                                label="Pick Color"
                                value={pickerColor} 
                                onChange={setPickerColor}
                                format="hex"
                            />
                        </Group>
                        
                        <Group align="flex-end">
                             <TextInput 
                                label={`Calculated Values (${newColorModel})`} 
                                value={newColorValue}
                                onChange={(e) => setNewColorValue(e.currentTarget.value)}
                                style={{ flex: 1 }}
                                rightSection={<Tooltip label="Auto-calculated."><RefreshCw size={14}/></Tooltip>}
                            />
                            <Button onClick={addColor} leftSection={<Plus size={16}/>}>Add</Button>
                        </Group>
                    </Stack>
                </Card>

                <Stack gap="xs">
                    {customColors.map(c => (
                        <Group key={c.id} justify="space-between" bg="dark.6" p="xs" style={{ borderRadius: 4 }}>
                            <Group>
                                <Tooltip label={`Preview based on: ${c.previewHex}`}>
                                    <div style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: c.previewHex, border: '1px solid white' }} />
                                </Tooltip>
                                <Stack gap={0}>
                                    <Text size="sm" fw={500}>{c.name}</Text>
                                    <Group gap={6}>
                                        <Badge size="xs" variant="light" color="blue">{c.model}</Badge>
                                        <Text size="xs" c="dimmed" style={{fontFamily: 'monospace'}}>{c.value}</Text>
                                    </Group>
                                </Stack>
                            </Group>
                            <ActionIcon color="red" variant="subtle" onClick={() => setCustomColors(customColors.filter(x => x.id !== c.id))}>
                                <Trash size={16} />
                            </ActionIcon>
                        </Group>
                    ))}
                    {customColors.length === 0 && <Text size="sm" c="dimmed" ta="center">No custom colors defined</Text>}
                </Stack>
              </Tabs.Panel>
            </Tabs>
          </Stack>
        </ScrollArea>
      </Grid.Col>

      {/* RIGHT COLUMN: Preview */}
      <Grid.Col span={5} bg="dark.8" h="100%" style={{ borderLeft: '1px solid var(--mantine-color-dark-6)', display: 'flex', flexDirection: 'column' }}>
        <Group p="xs" justify="center" bg="dark.7">
             <Button.Group>
                <Button size="xs" variant={previewMode === 'code' ? 'filled' : 'default'} leftSection={<CodeIcon size={14}/>} onClick={() => setPreviewMode('code')}>Code</Button>
                <Button size="xs" variant={previewMode === 'visual' ? 'filled' : 'default'} leftSection={<Eye size={14}/>} onClick={() => setPreviewMode('visual')}>Visual</Button>
             </Button.Group>
        </Group>

        <Box style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {previewMode === 'code' ? (
                <ScrollArea h="100%">
                    <Code block style={{ whiteSpace: 'pre-wrap', backgroundColor: 'transparent', minHeight: '100%' }}>{generatedCode}</Code>
                </ScrollArea>
            ) : (
                <Box h="100%" bg="dark.9" style={{ display: 'flex', justifyContent: 'center', overflow: 'auto', padding: 20 }}>
                    {/* VISUALIZER */}
                    <div style={{
                        width: PAGE_WIDTH_PX,
                        height: PAGE_HEIGHT_PX,
                        backgroundColor: 'white',
                        position: 'relative',
                        boxShadow: '0 0 20px rgba(0,0,0,0.5)',
                        color: 'black',
                        fontSize: 10,
                        overflow: 'hidden',
                        ...geometryStyles.containerStyle // Apply offset visual
                    }}>
                        {/* Header */}
                        {config.pkgGeometry && geometryStyles.headerHeightPx > 0 && (
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: config.marginLeft * CM_TO_PX,
                                right: config.marginRight * CM_TO_PX,
                                height: geometryStyles.headerHeightPx,
                                background: 'rgba(255, 165, 0, 0.2)',
                                borderBottom: '1px solid orange',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'orange'
                            }}>
                                HEADER
                            </div>
                        )}
                        {/* Body Content */}
                        <div style={{
                            position: 'absolute',
                            top: geometryStyles.bodyTopPx,
                            bottom: PAGE_HEIGHT_PX - geometryStyles.bodyBottomPx,
                            left: config.pkgGeometry ? config.marginLeft * CM_TO_PX : 20,
                            right: config.pkgGeometry ? config.marginRight * CM_TO_PX : 20,
                            border: '1px dashed #339af0',
                            background: 'rgba(51, 154, 240, 0.1)',
                            display: 'flex',
                            gap: config.columns === 'two' ? config.columnSep * CM_TO_PX : 0
                        }}>
                             {config.columns === 'two' ? (
                                <>
                                    <div style={{ flex: 1, border: '1px dotted #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Col 1</div>
                                    <div style={{ flex: 1, border: '1px dotted #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Col 2</div>
                                </>
                             ) : (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Body Text</div>
                             )}
                        </div>
                        {/* Margin Notes */}
                        {config.pkgGeometry && config.marginNotes && (
                            <div style={{
                                position: 'absolute',
                                top: geometryStyles.bodyTopPx,
                                bottom: PAGE_HEIGHT_PX - geometryStyles.bodyBottomPx,
                                left: geometryStyles.marginNotesStartPx,
                                width: geometryStyles.marginNotesWidthCapPx,
                                background: 'rgba(40, 167, 69, 0.2)',
                                border: '1px solid green',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                writingMode: 'vertical-rl',
                                color: 'green'
                            }}>
                                Notes
                            </div>
                        )}
                        {/* Footer */}
                        {config.pkgGeometry && config.footSkip > 0 && (
                            <div style={{
                                position: 'absolute',
                                top: geometryStyles.bodyBottomPx,
                                left: config.marginLeft * CM_TO_PX,
                                right: config.marginRight * CM_TO_PX,
                                paddingTop: config.footSkip * CM_TO_PX,
                                borderTop: '1px solid blue',
                                display: 'flex', justifyContent: 'center'
                            }}>
                                <span style={{ background: 'rgba(0,0,255,0.1)', padding: '2px 8px' }}>Footer</span>
                            </div>
                        )}
                    </div>
                </Box>
            )}
        </Box>
        <Box p="md" bg="dark.7" style={{ borderTop: '1px solid var(--mantine-color-dark-6)' }}>
             <Button fullWidth leftSection={<Check size={16}/>} onClick={() => onInsert(generatedCode)}>Create Document</Button>
        </Box>
      </Grid.Col>
    </Grid>
  );
};