import React, { useState, useEffect, useMemo } from 'react';
import { 
  Grid, Card, Text, Group, Badge, Button, TextInput, 
  ScrollArea, Stack, ThemeIcon, Box, NavLink, Divider, 
  Code, ActionIcon, Tooltip, Select, NumberInput, Switch, Textarea, SegmentedControl, MultiSelect
} from '@mantine/core';
import { 
  Search, Calculator, Type, Image as ImageIcon, 
  Table as TableIcon, Layout, Code as CodeIcon, Package, 
  Check, Copy, Info, ChevronRight, Sigma, Hash, FileCode, Plus, Settings, Palette
} from 'lucide-react';
import { ViewType } from '../layout/Sidebar';

// IMPORT SHARED DATA
import { LANGUAGES_DB, MINTED_STYLES } from './preamble/LanguageDb';

interface PackageGalleryProps {
  onInsert: (code: string) => void;
  onClose: () => void;
  onOpenWizard: (view: ViewType) => void;
}

// --- Data Models ---
type Category = 'math' | 'graphics' | 'tables' | 'code' | 'layout' | 'misc';

interface LatexPackage {
  id: string;
  name: string;
  category: Category;
  description: string;
  command?: string;
  hasWizard?: boolean;
}

const PACKAGES_DB: LatexPackage[] = [
  // MATH
  { id: 'amsmath', name: 'AMS Math', category: 'math', description: 'Equations, matrices, and alignment.', command: '\\usepackage{amsmath}' },
  { id: 'amssymb', name: 'AMS Symbols', category: 'math', description: 'Extended symbol collection.', command: '\\usepackage{amssymb}' },
  { id: 'siunitx', name: 'SI Unitx', category: 'math', description: 'SI units and number formatting.', command: '\\usepackage{siunitx}' },
  
  // GRAPHICS
  { id: 'tikz', name: 'TikZ', category: 'graphics', description: 'Create graphics programmatically.', hasWizard: true },
  { id: 'pgfplots', name: 'PGFPlots', category: 'graphics', description: 'Create plots and charts.', hasWizard: true },
  { id: 'graphicx', name: 'Graphicx', category: 'graphics', description: 'Include external images.', command: '\\usepackage{graphicx}' },
  
  // TABLES
  { id: 'booktabs', name: 'Booktabs', category: 'tables', description: 'Professional table layout.', hasWizard: true },
  { id: 'multirow', name: 'Multirow', category: 'tables', description: 'Cells spanning multiple rows.', hasWizard: true },
  
  // LAYOUT
  { id: 'geometry', name: 'Geometry', category: 'layout', description: 'Page dimensions and margins.', hasWizard: true },
  { id: 'fancyhdr', name: 'Fancyhdr', category: 'layout', description: 'Custom headers and footers.', command: '\\usepackage{fancyhdr}' },

  // CODE (Unified Wizard)
  { id: 'listings', name: 'Listings', category: 'code', description: 'Source code printing (Native LaTeX).', command: '\\usepackage{listings}' },
  { id: 'minted', name: 'Minted', category: 'code', description: 'Highlighted source code (Requires Pygments).', command: '\\usepackage{minted}' }, 
];

// --- Sub-Configurators ---

// 1. AMSMATH Configurator
const AmsMathConfig = ({ onChange }: { onChange: (code: string) => void }) => {
  const [type, setType] = useState('equation');
  const [content, setContent] = useState('E = mc^2');
  const [label, setLabel] = useState('');

  useEffect(() => {
    let code = '';
    const env = type === 'inline' ? '' : type;
    if (type === 'inline') {
        code = `$ ${content} $`;
    } else {
        code = `\\begin{${env}}\n`;
        if (label) code += `  \\label{eq:${label}}\n`;
        code += `  ${content}\n`;
        code += `\\end{${env}}`;
    }
    onChange(code);
  }, [type, content, label]);

  return (
    <Stack>
        <SegmentedControl value={type} onChange={setType} data={[{ label: 'Equation', value: 'equation' }, { label: 'Align', value: 'align' }, { label: 'Inline ($)', value: 'inline' }]} />
        <TextInput label="Math Content" value={content} onChange={(e) => setContent(e.currentTarget.value)} style={{ fontFamily: 'monospace' }} />
        {type !== 'inline' && <TextInput label="Label" placeholder="e.g. energy" value={label} onChange={(e) => setLabel(e.currentTarget.value)} />}
        <Group><Button variant="default" size="xs" onClick={() => setContent(prev => prev + ' \\sum_{i=0}^{n} ')}>Sum</Button><Button variant="default" size="xs" onClick={() => setContent(prev => prev + ' \\int_{a}^{b} ')}>Int</Button><Button variant="default" size="xs" onClick={() => setContent(prev => prev + ' \\frac{a}{b} ')}>Frac</Button></Group>
    </Stack>
  );
};

// 2. UNIFIED CODE WIZARD (Listings & Minted)
const CodeWizard = ({ engine, onChange }: { engine: 'listings' | 'minted', onChange: (code: string) => void }) => {
  const [lang, setLang] = useState('python'); 
  const [caption, setCaption] = useState('');
  const [label, setLabel] = useState('');
  const [codeContent, setCodeContent] = useState('print("Hello World")');
  const [showNumbers, setShowNumbers] = useState(true);
  const [frame, setFrame] = useState(true);
  const [breakLines, setBreakLines] = useState(false);
  const [mintedStyle, setMintedStyle] = useState('friendly'); // New State for Minted Style

  // Filter languages based on engine support
  const availableLangs = useMemo(() => {
      if (engine === 'listings') return LANGUAGES_DB.filter(l => l.listings !== null).map(l => ({ value: l.value, label: l.label }));
      return LANGUAGES_DB.map(l => ({ value: l.value, label: l.label }));
  }, [engine]);

  useEffect(() => {
    const langObj = LANGUAGES_DB.find(l => l.value === lang);
    const langIdentifier = engine === 'listings' ? (langObj?.listings || 'Python') : (langObj?.minted || 'python');

    let code = '';
    if (engine === 'listings') {
        code = `\\begin{lstlisting}[language=${langIdentifier}`;
        if (caption) code += `, caption={${caption}}`;
        if (label) code += `, label={lst:${label}}`;
        if (showNumbers) code += `, numbers=left`;
        if (frame) code += `, frame=single`;
        if (breakLines) code += `, breaklines=true`;
        code += `]\n${codeContent}\n\\end{lstlisting}`;
    } else {
        // Minted Logic
        if (mintedStyle && mintedStyle !== 'default') {
            code += `\\usemintedstyle{${mintedStyle}}\n`;
        }
        
        code += `\\begin{minted}`;
        const opts = [];
        if (showNumbers) opts.push('linenos');
        if (frame) opts.push('frame=lines');
        if (breakLines) opts.push('breaklines');
        if (opts.length > 0) code += `[${opts.join(', ')}]`;
        
        code += `{${langIdentifier}}\n${codeContent}\n\\end{minted}`;
        
        if (caption || label) {
            let wrap = `\\begin{listing}[H]\n`;
            if (caption) wrap += `  \\caption{${caption}}\n`;
            if (label) wrap += `  \\label{lst:${label}}\n`;
            wrap += code + `\n\\end{listing}`;
            code = wrap;
        }
    }
    onChange(code);
  }, [engine, lang, caption, label, codeContent, showNumbers, frame, breakLines, mintedStyle]);

  return (
    <Stack>
        <Select 
            label="Language" 
            value={lang} 
            onChange={(v) => setLang(v || 'python')} 
            data={availableLangs} 
            searchable
        />
        
        {/* Style Selector for Minted */}
        {engine === 'minted' && (
            <Select 
                label="Theme" 
                description="Select a Pygments style."
                value={mintedStyle} 
                onChange={(v) => setMintedStyle(v || 'friendly')} 
                data={MINTED_STYLES} 
                searchable
            />
        )}

        <Group grow>
            <TextInput label="Caption" value={caption} onChange={(e) => setCaption(e.currentTarget.value)} />
            <TextInput label="Label" placeholder="mycode" value={label} onChange={(e) => setLabel(e.currentTarget.value)} />
        </Group>
        <Group>
            <Switch label="Line Numbers" checked={showNumbers} onChange={(e) => setShowNumbers(e.currentTarget.checked)} />
            <Switch label="Frame" checked={frame} onChange={(e) => setFrame(e.currentTarget.checked)} />
            <Switch label="Break Lines" checked={breakLines} onChange={(e) => setBreakLines(e.currentTarget.checked)} />
        </Group>
        <Textarea 
            label="Source Code" 
            value={codeContent} 
            onChange={(e) => setCodeContent(e.currentTarget.value)} 
            minRows={6} 
            styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }} 
        />
    </Stack>
  );
};

// 3. GRAPHICX Configurator (Placeholder)
const GraphicxConfig = ({ onChange }: { onChange: (code: string) => void }) => {
    useEffect(() => onChange(`\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=0.8\\textwidth]{image.png}\n  \\caption{Caption}\n  \\label{fig:my_label}\n\\end{figure}`), []);
    return <Text c="dimmed" size="sm" fs="italic">Graphic settings UI will appear here (Width, Rotate, File Picker)...</Text>;
};

// --- MAIN COMPONENT ---

export const PackageGallery: React.FC<PackageGalleryProps> = ({ onInsert, onClose, onOpenWizard }) => {
  const [selectedPkgId, setSelectedPkgId] = useState<string>('amsmath');
  const [searchQuery, setSearchQuery] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');

  const activePackage = PACKAGES_DB.find(p => p.id === selectedPkgId);

  // Group packages by category
  const categories: Record<string, React.ReactNode> = {
    'math': <Calculator size={16} />,
    'graphics': <ImageIcon size={16} />,
    'tables': <TableIcon size={16} />,
    'code': <CodeIcon size={16} />,
    'layout': <Layout size={16} />,
    'misc': <Package size={16} />
  };

  const getFilteredPackages = () => {
    return PACKAGES_DB.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const handleConfigure = (pkg: LatexPackage) => {
    if (pkg.hasWizard) {
        if (pkg.id === 'tikz' || pkg.id === 'pgfplots') {
            onOpenWizard('wizard-tikz');
        } else if (pkg.id === 'booktabs' || pkg.id === 'multirow') {
            onOpenWizard('wizard-table');
        } else if (pkg.id === 'geometry') {
            onOpenWizard('wizard-preamble'); 
        } else {
            alert(`Opening specialized wizard for ${pkg.name}...`);
        }
    }
  };

  return (
    <Grid h="100%" gutter={0}>
        
        {/* LEFT: PACKAGE BROWSER */}
        <Grid.Col span={4} style={{ borderRight: '1px solid var(--mantine-color-dark-6)', display: 'flex', flexDirection: 'column' }}>
            <Box p="sm" bg="dark.8">
                <TextInput 
                    placeholder="Search tools..." 
                    leftSection={<Search size={14}/>} 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.currentTarget.value)}
                />
            </Box>
            <ScrollArea style={{ flex: 1 }}>
                <Stack gap={4} p="xs">
                    {/* Render Categories */}
                    {(Object.keys(categories) as Category[]).map(cat => {
                        const pkgs = getFilteredPackages().filter(p => p.category === cat);
                        if (pkgs.length === 0) return null;
                        
                        return (
                            <Box key={cat} mb="sm">
                                <Group gap="xs" px="xs" mb={4}>
                                    {categories[cat]}
                                    <Text size="xs" fw={700} tt="uppercase" c="dimmed">{cat}</Text>
                                </Group>
                                {pkgs.map(pkg => (
                                    <NavLink 
                                        key={pkg.id}
                                        label={pkg.name}
                                        description={<Text size="xs" truncate>{pkg.description}</Text>}
                                        active={pkg.id === selectedPkgId}
                                        onClick={() => setSelectedPkgId(pkg.id)}
                                        variant="light"
                                        leftSection={activePackage?.id === pkg.id && <ChevronRight size={14}/>}
                                        style={{ borderRadius: 4 }}
                                    />
                                ))}
                            </Box>
                        );
                    })}
                </Stack>
            </ScrollArea>
        </Grid.Col>

        {/* RIGHT: CONFIGURATOR */}
        <Grid.Col span={8} h="100%" style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--mantine-color-dark-8)' }}>
            
            {/* Header */}
            <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-dark-6)' }}>
                <Group justify="space-between">
                    <Group>
                        <ThemeIcon size="lg" variant="light" color="blue">
                            {activePackage?.category === 'math' ? <Sigma /> : 
                             activePackage?.category === 'code' ? <FileCode /> : 
                             <Package />}
                        </ThemeIcon>
                        <Stack gap={0}>
                            <Text fw={700} size="lg">{activePackage?.name}</Text>
                            <Text size="xs" c="dimmed">Configure options for {activePackage?.name}</Text>
                        </Stack>
                    </Group>
                    <Group>
                        {activePackage?.hasWizard && (
                            <Button 
                                variant="light" 
                                color="teal" 
                                size="xs" 
                                leftSection={<Settings size={14}/>}
                                onClick={() => activePackage && handleConfigure(activePackage)}
                            >
                                Open Full Wizard
                            </Button>
                        )}
                        <Tooltip label="Package Info">
                            <ActionIcon variant="subtle" color="gray"><Info size={18}/></ActionIcon>
                        </Tooltip>
                    </Group>
                </Group>
            </Box>

            {/* Dynamic Configurator Area */}
            <ScrollArea style={{ flex: 1 }} p="md">
                {selectedPkgId === 'amsmath' && <AmsMathConfig onChange={setGeneratedCode} />}
                
                {/* Unified Code Wizard for Listings AND Minted */}
                {(selectedPkgId === 'listings' || selectedPkgId === 'minted') && (
                    <CodeWizard engine={selectedPkgId as 'listings' | 'minted'} onChange={setGeneratedCode} />
                )}
                
                {selectedPkgId === 'graphicx' && <GraphicxConfig onChange={setGeneratedCode} />}
                {selectedPkgId === 'tabularx' && <Text c="dimmed">Tabularx settings would appear here.</Text>}
                
                {activePackage?.hasWizard && !['amsmath', 'listings', 'minted', 'graphicx'].includes(selectedPkgId) && (
                    <Stack align="center" mt="xl">
                        <Text>This package has a dedicated Full Wizard.</Text>
                        <Button onClick={() => activePackage && handleConfigure(activePackage)}>Launch Wizard</Button>
                    </Stack>
                )}
            </ScrollArea>

            {/* Footer: Preview & Insert */}
            <Stack gap={0} p="md" bg="dark.9" style={{ borderTop: '1px solid var(--mantine-color-dark-6)' }}>
                <Group justify="space-between" mb="xs">
                    <Text size="xs" fw={700} c="dimmed">GENERATED CODE</Text>
                    <Group gap="xs">
                        {activePackage?.command && (
                             <Button 
                                variant="default" 
                                size="compact-xs" 
                                onClick={() => onInsert(activePackage.command! + '\n')}
                             >
                                Add \usepackage
                             </Button>
                        )}
                        <ActionIcon size="xs" variant="subtle" onClick={() => navigator.clipboard.writeText(generatedCode)}>
                            <Copy size={12}/>
                        </ActionIcon>
                    </Group>
                </Group>
                <ScrollArea h={80} mb="md" type="auto" style={{ border: '1px solid var(--mantine-color-dark-6)', borderRadius: 4 }} bg="dark.8">
                    <Code block style={{ background: 'transparent', fontSize: 11 }}>
                        {generatedCode}
                    </Code>
                </ScrollArea>
                <Button fullWidth leftSection={<Check size={16}/>} onClick={() => onInsert(generatedCode)}>
                    Insert into Document
                </Button>
            </Stack>

        </Grid.Col>
    </Grid>
  );
};