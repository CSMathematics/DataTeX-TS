import React, { useState, useEffect, useMemo } from 'react';
import { 
  Text, Group, Button, TextInput,
  ScrollArea, Stack, ThemeIcon, Box, NavLink,
  Code, ActionIcon, Tooltip, Select, Switch, Textarea, SegmentedControl, Tabs, SimpleGrid, Paper
} from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSearch, faCalculator, faImage,
  faTable, faLayerGroup, faCode, faBoxOpen,
  faCheck, faCopy, faInfoCircle, faChevronRight, faSquareRootAlt, faFileCode, faCog,
  faBars, faArrowLeft, faColumns, faPalette
} from '@fortawesome/free-solid-svg-icons';
import { ViewType } from '../layout/Sidebar';

// IMPORT SHARED DATA
import { LANGUAGES_DB, MINTED_STYLES, CustomColorDef } from './preamble/LanguageDb';
import { SYMBOLS_DB, SymbolCategory } from './preamble/SymbolDB';

import { TikzWizard } from './TikzWizard';
import { TableWizard } from './TableWizard';
import { ColorsTab } from './preamble/tabs/ColorsTab';

interface PackageGalleryProps {
  onInsert: (code: string) => void;
  onClose: () => void;
  onOpenWizard: (view: ViewType) => void;
}

// --- Data Models ---
type Category = 'math' | 'graphics' | 'colors' | 'tables' | 'code' | 'layout' | 'misc';

interface LatexPackage {
  id: string;
  name: string;
  category: Category;
  description: string;
  command?: string;
  hasWizard?: boolean;
}

const PACKAGES_DB: LatexPackage[] = [
  // COLORS
  { id: 'xcolor', name: 'XColor', category: 'colors', description: 'Driver-independent color extensions.', hasWizard: true },

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

// 2. AMS SYMBOLS Configurator (New)
const AmsSymbolConfig = ({ onInsert }: { onInsert: (code: string) => void }) => {
    const [search, setSearch] = useState('');

    const categories: { key: SymbolCategory, label: string }[] = [
        { key: 'greek', label: 'Greek' },
        { key: 'calculus', label: 'Calculus' },
        { key: 'linear_algebra', label: 'Lin. Algebra' },
        { key: 'operators', label: 'Operators' },
        { key: 'relations', label: 'Relations' },
        { key: 'arrows', label: 'Arrows' },
        { key: 'delimiters', label: 'Delimiters' },
        { key: 'logic', label: 'Logic' },
        { key: 'misc', label: 'Misc' },
    ];

    return (
        <Stack h="100%">
            <TextInput 
                placeholder="Search symbol command..." 
                value={search} onChange={(e) => setSearch(e.currentTarget.value)} 
                leftSection={<FontAwesomeIcon icon={faSearch} style={{ width: 14 }} />}
            />
            <Tabs defaultValue="greek" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Tabs.List style={{ flexWrap: 'nowrap', overflowX: 'auto', overflowY: 'hidden' }}>
                    {categories.map(cat => <Tabs.Tab key={cat.key} value={cat.key} style={{ whiteSpace: 'nowrap' }}>{cat.label}</Tabs.Tab>)}
                </Tabs.List>

                {categories.map(cat => (
                    <Tabs.Panel key={cat.key} value={cat.key} style={{ flex: 1, overflow: 'hidden' }}>
                        <ScrollArea h="100%" pt="md">
                            <SimpleGrid cols={6} spacing="xs">
                                {SYMBOLS_DB[cat.key]
                                    .filter(s => s.cmd.toLowerCase().includes(search.toLowerCase()))
                                    .map((s) => (
                                    <Tooltip key={s.cmd} label={<Code>{s.cmd}</Code>} withArrow transitionProps={{ duration: 200 }}>
                                        <Paper 
                                            withBorder 
                                            p={0}
                                            component="button"
                                            onClick={() => onInsert(s.cmd)}
                                            style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                height: 40,
                                                cursor: 'pointer',
                                                backgroundColor: 'var(--mantine-color-dark-6)',
                                                fontSize: '1.2rem',
                                                border: '1px solid transparent'
                                            }}
                                            // Add hover effect via style prop or class if needed, Mantine Paper handles basic hover
                                        >
                                            {s.char}
                                        </Paper>
                                    </Tooltip>
                                ))}
                            </SimpleGrid>
                            {SYMBOLS_DB[cat.key].filter(s => s.cmd.includes(search)).length === 0 && (
                                <Text c="dimmed" ta="center" mt="xl">No symbols found.</Text>
                            )}
                        </ScrollArea>
                    </Tabs.Panel>
                ))}
            </Tabs>
        </Stack>
    );
};

// 3. UNIFIED CODE WIZARD (Listings & Minted)
const CodeWizard = ({ engine, onChange }: { engine: 'listings' | 'minted', onChange: (code: string) => void }) => {
  const [lang, setLang] = useState('python'); 
  const [caption, setCaption] = useState('');
  const [label, setLabel] = useState('');
  const [codeContent, setCodeContent] = useState('print("Hello World")');
  const [showNumbers, setShowNumbers] = useState(true);
  const [frame, setFrame] = useState(true);
  const [breakLines, setBreakLines] = useState(false);
  const [mintedStyle, setMintedStyle] = useState('friendly');

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

// 4. GRAPHICX Configurator
const GraphicxConfig = ({ onChange }: { onChange: (code: string) => void }) => {
    useEffect(() => onChange(`\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=0.8\\textwidth]{image.png}\n  \\caption{Caption}\n  \\label{fig:my_label}\n\\end{figure}`), []);
    return <Text c="dimmed" size="sm" fs="italic">Graphic settings UI will appear here (Width, Rotate, File Picker)...</Text>;
};

// --- MAIN COMPONENT ---

export const PackageGallery: React.FC<PackageGalleryProps> = ({ onInsert, onOpenWizard }) => {
  const [selectedPkgId, setSelectedPkgId] = useState<string>('amsmath');
  const [searchQuery, setSearchQuery] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isSidebarOpen, setSidebarOpen] = useState(true); // Toggle State

  // --- XColor Local State (Independent from Global Preamble Config) ---
  const [colorConfig, setColorConfig] = useState({ pkgXcolor: true, xcolorOptions: ['table', 'dvipsnames'] });
  const [galleryColors, setGalleryColors] = useState<CustomColorDef[]>([]);

  // Update Generated Code for XColor
  useEffect(() => {
    if (selectedPkgId === 'xcolor') {
        let code = '';
        // 1. Package loading (Optional check if user wants to copy only this)
        if (colorConfig.pkgXcolor) {
             const opts = colorConfig.xcolorOptions && colorConfig.xcolorOptions.length > 0 
                ? `[${colorConfig.xcolorOptions.join(',')}]` 
                : '';
             code += `\\usepackage${opts}{xcolor}\n\n`;
        }
        
        // 2. Color Definitions
        if (galleryColors.length > 0) {
            code += `% --- Custom Colors ---\n`;
            galleryColors.forEach(c => {
                if (c.model === 'named (mix)') {
                    code += `\\colorlet{${c.name}}{${c.value}}\n`;
                } else {
                    code += `\\definecolor{${c.name}}{${c.model}}{${c.value}}\n`;
                }
            });
        } else {
            code += `% Add colors using the wizard to generate code here.`;
        }
        setGeneratedCode(code);
    }
  }, [selectedPkgId, colorConfig, galleryColors]);

  const activePackage = PACKAGES_DB.find(p => p.id === selectedPkgId);

  // Group packages by category
  const categories: Record<string, React.ReactNode> = {
    'colors': <FontAwesomeIcon icon={faPalette} style={{ width: 16, height: 16 }} />,
    'math': <FontAwesomeIcon icon={faCalculator} style={{ width: 16, height: 16 }} />,
    'graphics': <FontAwesomeIcon icon={faImage} style={{ width: 16, height: 16 }} />,
    'tables': <FontAwesomeIcon icon={faTable} style={{ width: 16, height: 16 }} />,
    'code': <FontAwesomeIcon icon={faCode} style={{ width: 16, height: 16 }} />,
    'layout': <FontAwesomeIcon icon={faLayerGroup} style={{ width: 16, height: 16 }} />,
    'misc': <FontAwesomeIcon icon={faBoxOpen} style={{ width: 16, height: 16 }} />
  };

  const getFilteredPackages = () => {
    return PACKAGES_DB.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const handleConfigure = (pkg: LatexPackage) => {
    if (pkg.hasWizard) {
        if (pkg.id === 'geometry') {
            onOpenWizard('wizard-preamble'); 
        } else if (!['tikz', 'pgfplots', 'booktabs', 'multirow', 'xcolor'].includes(pkg.id)) {
            alert(`Opening specialized wizard for ${pkg.name}...`);
        }
    }
  };

  const isEmbeddedWizard = ['tikz', 'pgfplots', 'booktabs', 'multirow', 'xcolor'].includes(selectedPkgId);
  const isSymbolPalette = selectedPkgId === 'amssymb';

  return (
    <Group h="100%" gap={0} align="stretch" style={{ overflow: 'hidden' }}>
        
        {/* LEFT: PACKAGE BROWSER (Collapsible with Animation) */}
        <Box 
            style={{ 
                width: isSidebarOpen ? 300 : 0,
                opacity: isSidebarOpen ? 1 : 0,
                borderRight: isSidebarOpen ? '1px solid var(--mantine-color-dark-6)' : 'none',
                transition: 'width 0.3s ease, opacity 0.2s ease', 
                overflow: 'hidden',
                flexShrink: 0
            }}
        >
            {/* Inner Container: Keeps content fixed width to avoid ugly wrapping during collapse */}
            <Box w={300} h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
                <Box p="sm" bg="dark.8" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <TextInput 
                        placeholder="Search..." 
                        style={{ flex: 1 }}
                        leftSection={<FontAwesomeIcon icon={faSearch} style={{ width: 14, height: 14 }} />}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.currentTarget.value)}
                    />
                     <Tooltip label="Hide List">
                        <ActionIcon variant="subtle" color="gray" onClick={() => setSidebarOpen(false)}>
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </ActionIcon>
                    </Tooltip>
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
                                            onClick={() => {
                                                setSelectedPkgId(pkg.id);
                                            }}
                                            variant="light"
                                            leftSection={activePackage?.id === pkg.id && <FontAwesomeIcon icon={faChevronRight} style={{ width: 12, height: 12 }} />}
                                            style={{ borderRadius: 4 }}
                                        />
                                    ))}
                                </Box>
                            );
                        })}
                    </Stack>
                </ScrollArea>
            </Box>
        </Box>

        {/* RIGHT: CONFIGURATOR (Flex Grow) */}
        <Box 
            style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                backgroundColor: 'var(--mantine-color-dark-8)',
                minWidth: 0, // Critical for Flex children to shrink properly
                height: '100%'
            }}
        >
            
            {/* Header */}
            <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-dark-6)' }}>
                <Group justify="space-between">
                    <Group>
                        {/* Show Sidebar Button (Only if hidden) */}
                        {!isSidebarOpen && (
                            <Tooltip label="Show Packages">
                                <ActionIcon variant="default" onClick={() => setSidebarOpen(true)} mr="xs">
                                    <FontAwesomeIcon icon={faBars} />
                                </ActionIcon>
                            </Tooltip>
                        )}

                        <ThemeIcon size="lg" variant="light" color="blue">
                            {activePackage?.category === 'math' ? <FontAwesomeIcon icon={faSquareRootAlt} /> :
                             activePackage?.category === 'code' ? <FontAwesomeIcon icon={faFileCode} /> :
                             activePackage?.category === 'colors' ? <FontAwesomeIcon icon={faPalette} /> :
                             <FontAwesomeIcon icon={faBoxOpen} />}
                        </ThemeIcon>
                        <Stack gap={0}>
                            <Text fw={700} size="lg">{activePackage?.name}</Text>
                            <Text size="xs" c="dimmed">Configure options for {activePackage?.name}</Text>
                        </Stack>
                    </Group>
                    <Group>
                        {activePackage?.hasWizard && !isEmbeddedWizard && (
                            <Button 
                                variant="light" 
                                color="teal" 
                                size="xs" 
                                leftSection={<FontAwesomeIcon icon={faCog} style={{ width: 14, height: 14 }} />}
                                onClick={() => activePackage && handleConfigure(activePackage)}
                            >
                                Open Full Wizard
                            </Button>
                        )}
                        <Tooltip label="Package Info">
                            <ActionIcon variant="subtle" color="gray"><FontAwesomeIcon icon={faInfoCircle} style={{ width: 18, height: 18 }} /></ActionIcon>
                        </Tooltip>
                        
                        {/* Toggle Layout Button (Alternative location) */}
                        <Tooltip label={isSidebarOpen ? "Expand View" : "Show List"}>
                            <ActionIcon variant="subtle" color="gray" onClick={() => setSidebarOpen(!isSidebarOpen)}>
                                <FontAwesomeIcon icon={faColumns} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                </Group>
            </Box>

            {/* Dynamic Configurator Area */}
            {isEmbeddedWizard ? (
                <Box style={{ flex: 1, overflow: 'hidden' }}>
                    {(selectedPkgId === 'tikz' || selectedPkgId === 'pgfplots') && (
                        <TikzWizard onInsert={onInsert} />
                    )}
                    {(selectedPkgId === 'booktabs' || selectedPkgId === 'multirow') && (
                        <TableWizard onInsert={onInsert} />
                    )}
                    {selectedPkgId === 'xcolor' && (
                        <Box p="md" h="100%">
                             <ColorsTab 
                                config={colorConfig as any} 
                                customColors={galleryColors}
                                onChange={(key, val) => setColorConfig(prev => ({ ...prev, [key]: val }))}
                                onAddColor={(name, model, value, previewHex) => {
                                    const newCol = { id: Date.now(), name, model, value, previewHex };
                                    setGalleryColors(prev => [...prev, newCol]);
                                }}
                                onRemoveColor={(id) => setGalleryColors(prev => prev.filter(c => c.id !== id))}
                                onInsert={onInsert}
                             />
                        </Box>
                    )}
                </Box>
            ) : (
                <ScrollArea style={{ flex: 1 }} p="md">
                    {/* AMS Symbols Palette (Special Case) */}
                    {selectedPkgId === 'amssymb' && <AmsSymbolConfig onInsert={onInsert} />}

                    {selectedPkgId === 'amsmath' && <AmsMathConfig onChange={setGeneratedCode} />}

                    {/* Unified Code Wizard for Listings AND Minted */}
                    {(selectedPkgId === 'listings' || selectedPkgId === 'minted') && (
                        <CodeWizard engine={selectedPkgId as 'listings' | 'minted'} onChange={setGeneratedCode} />
                    )}

                    {selectedPkgId === 'graphicx' && <GraphicxConfig onChange={setGeneratedCode} />}
                    {selectedPkgId === 'tabularx' && <Text c="dimmed">Tabularx settings would appear here.</Text>}

                    {activePackage?.hasWizard && !['amsmath', 'listings', 'minted', 'graphicx'].includes(selectedPkgId) && selectedPkgId !== 'amssymb' && (
                        <Stack align="center" mt="xl">
                            <Text>This package has a dedicated Full Wizard.</Text>
                            <Button onClick={() => activePackage && handleConfigure(activePackage)}>Launch Wizard</Button>
                        </Stack>
                    )}
                </ScrollArea>
            )}

            {/* Footer: Preview & Insert - HIDDEN for Symbol Palette as it inserts directly */}
            {(!isEmbeddedWizard && !isSymbolPalette) || selectedPkgId === 'xcolor' ? (
                <Stack gap={0} p="md" bg="dark.9" style={{ borderTop: '1px solid var(--mantine-color-dark-6)' }}>
                    <Group justify="space-between" mb="xs">
                        <Text size="xs" fw={700} c="dimmed">GENERATED CODE</Text>
                        <Group gap="xs">
                            {activePackage?.command && selectedPkgId !== 'xcolor' && (
                                <Button
                                    variant="default"
                                    size="compact-xs"
                                    onClick={() => onInsert(activePackage.command! + '\n')}
                                >
                                    Add \usepackage
                                </Button>
                            )}
                            <ActionIcon size="xs" variant="subtle" onClick={() => navigator.clipboard.writeText(generatedCode)}>
                                <FontAwesomeIcon icon={faCopy} style={{ width: 12, height: 12 }} />
                            </ActionIcon>
                        </Group>
                    </Group>
                    <ScrollArea h={80} mb="md" type="auto" style={{ border: '1px solid var(--mantine-color-dark-6)', borderRadius: 4 }} bg="dark.8">
                        <Code block style={{ background: 'transparent', fontSize: 11 }}>
                            {generatedCode}
                        </Code>
                    </ScrollArea>
                    <Button fullWidth leftSection={<FontAwesomeIcon icon={faCheck} style={{ width: 16, height: 16 }} />} onClick={() => onInsert(generatedCode)}>
                        Insert into Document
                    </Button>
                </Stack>
            ) : null}

        </Box>
    </Group>
  );
};