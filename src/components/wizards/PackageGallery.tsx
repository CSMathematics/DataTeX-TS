import React, { useState, useEffect, useMemo } from 'react';
import { 
  Text, Group, Button, TextInput,
  ScrollArea, Stack, ThemeIcon, Box, NavLink,
  Code, ActionIcon, Tooltip, Select, Switch, Textarea, SegmentedControl,
} from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSearch, faCalculator, faImage,
  faTable, faLayerGroup, faCode, faBoxOpen,
  faCheck, faCopy, faInfoCircle, faChevronRight, faSquareRootAlt, faFileCode, faCog,
  faBars, faArrowLeft, faColumns, faPalette, 
} from '@fortawesome/free-solid-svg-icons';
import { ViewType } from '../layout/Sidebar';

// IMPORT SHARED DATA
import { LANGUAGES_DB, MINTED_STYLES, CustomColorDef, CustomListDef } from './preamble/LanguageDb';
import { PACKAGES_DB, Category, LatexPackage } from './preamble/packages';

import { TikzWizard } from './TikzWizard';
import { TableWizard } from './TableWizard';
import { ColorsTab } from './preamble/tabs/ColorsTab';
import { ListsTab } from './preamble/tabs/ListsTab';

interface PackageGalleryProps {
  onInsert: (code: string) => void;
  onClose: () => void;
  onOpenWizard: (view: ViewType) => void;
}

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

// 2. UNIFIED CODE WIZARD
const CodeWizard = ({ engine, onChange }: { engine: 'listings' | 'minted', onChange: (code: string) => void }) => {
  const [lang, setLang] = useState('python'); 
  const [caption, setCaption] = useState('');
  const [label, setLabel] = useState('');
  const [codeContent, setCodeContent] = useState('print("Hello World")');
  const [showNumbers, setShowNumbers] = useState(true);
  const [frame, setFrame] = useState(true);
  const [breakLines, setBreakLines] = useState(false);
  const [mintedStyle, setMintedStyle] = useState('friendly');

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
        if (mintedStyle && mintedStyle !== 'default') code += `\\usemintedstyle{${mintedStyle}}\n`;
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
        <Select label="Language" value={lang} onChange={(v) => setLang(v || 'python')} data={availableLangs} searchable />
        {engine === 'minted' && <Select label="Theme" value={mintedStyle} onChange={(v) => setMintedStyle(v || 'friendly')} data={MINTED_STYLES} searchable />}
        <Group grow>
            <TextInput label="Caption" value={caption} onChange={(e) => setCaption(e.currentTarget.value)} />
            <TextInput label="Label" placeholder="mycode" value={label} onChange={(e) => setLabel(e.currentTarget.value)} />
        </Group>
        <Group>
            <Switch label="Line Numbers" checked={showNumbers} onChange={(e) => setShowNumbers(e.currentTarget.checked)} />
            <Switch label="Frame" checked={frame} onChange={(e) => setFrame(e.currentTarget.checked)} />
            <Switch label="Break Lines" checked={breakLines} onChange={(e) => setBreakLines(e.currentTarget.checked)} />
        </Group>
        <Textarea label="Source Code" value={codeContent} onChange={(e) => setCodeContent(e.currentTarget.value)} minRows={6} styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }} />
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
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // --- LOCAL STATES FOR WIZARDS ---
  
  // 1. XColor State
  const [colorConfig, setColorConfig] = useState({ pkgXcolor: true, xcolorOptions: ['table', 'dvipsnames'] });
  const [galleryColors, setGalleryColors] = useState<CustomColorDef[]>([]);

  // 2. Enumitem State
  const [listConfig, setListConfig] = useState({ 
      pkgEnumitem: true, 
      enumitemInline: false,
      enumitemSep: 'default', 
      enumitemItemize: 'default', 
      enumitemEnumerate: 'default' 
  });
  const [galleryLists, setGalleryLists] = useState<CustomListDef[]>([]);

  // --- EFFECT: UPDATE GENERATED CODE ---
  useEffect(() => {
    // A. XCOLOR GENERATION
    if (selectedPkgId === 'xcolor') {
        let code = '';
        if (colorConfig.pkgXcolor) {
             const opts = colorConfig.xcolorOptions && colorConfig.xcolorOptions.length > 0 
                ? `[${colorConfig.xcolorOptions.join(',')}]` 
                : '';
             code += `\\usepackage${opts}{xcolor}\n\n`;
        }
        if (galleryColors.length > 0) {
            code += `% --- Custom Colors ---\n`;
            galleryColors.forEach(c => {
                if (c.model === 'named (mix)') code += `\\colorlet{${c.name}}{${c.value}}\n`;
                else code += `\\definecolor{${c.name}}{${c.model}}{${c.value}}\n`;
            });
        }
        setGeneratedCode(code);
    } 
    // B. ENUMITEM GENERATION
    else if (selectedPkgId === 'enumitem') {
        let code = '';
        if (listConfig.pkgEnumitem) {
            code += `\\usepackage${listConfig.enumitemInline ? '[inline]' : ''}{enumitem}\n\n`;
            
            // Global Settings
            if (listConfig.enumitemSep === 'nosep') code += `\\setlist{nosep}\n`;
            else if (listConfig.enumitemSep === 'half') code += `\\setlist{itemsep=0.5em}\n`;
            
            if (listConfig.enumitemItemize && listConfig.enumitemItemize !== 'default') {
                code += `\\setlist[itemize]{${listConfig.enumitemItemize}}\n`;
            }
            if (listConfig.enumitemEnumerate && listConfig.enumitemEnumerate !== 'default') {
                code += `\\setlist[enumerate]{${listConfig.enumitemEnumerate}}\n`;
            }
        }
        // Custom Lists
        if (galleryLists.length > 0) {
            code += `\n% --- Custom Lists ---\n`;
            galleryLists.forEach(l => {
                code += `\\newlist{${l.name}}{${l.baseType}}{3}\n`;
                if (l.options) code += `\\setlist[${l.name}]{${l.options}}\n`;
            });
        }
        setGeneratedCode(code);
    }
  }, [selectedPkgId, colorConfig, galleryColors, listConfig, galleryLists]);

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
        } else if (!['tikz', 'pgfplots', 'booktabs', 'multirow', 'xcolor', 'enumitem'].includes(pkg.id)) {
            alert(`Opening specialized wizard for ${pkg.name}...`);
        }
    }
  };

  const isEmbeddedWizard = ['tikz', 'pgfplots', 'booktabs', 'multirow', 'xcolor', 'enumitem'].includes(selectedPkgId);

  return (
    // MAIN LAYOUT - Replaced Group with Flex Box for better scroll control
    <Box h="100%" style={{ display: 'flex', flexDirection: 'row', overflow: 'hidden', alignItems: 'stretch' }}>
        
        {/* LEFT: PACKAGE BROWSER (Resizable / Collapsible) */}
        <Box 
            style={{ 
                width: isSidebarOpen ? 300 : 0,
                opacity: isSidebarOpen ? 1 : 0,
                borderRight: isSidebarOpen ? '1px solid var(--mantine-color-dark-6)' : 'none',
                transition: 'width 0.3s ease, opacity 0.2s ease', 
                overflow: 'hidden',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* Inner container with Fixed width to avoid text wrapping during collapse */}
            <Box w={300} h="100%" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {/* Search Bar - Fixed Height */}
                <Box p="sm" bg="dark.8" style={{ flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
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
                
                {/* Scrollable Package List - Takes remaining height */}
                <Box style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                    <ScrollArea h="100%" type="auto" offsetScrollbars>
                        <Stack gap={4} p="xs">
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
        </Box>

        {/* RIGHT: CONFIGURATOR (Flex Grow) */}
        <Box 
            style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                backgroundColor: 'var(--mantine-color-dark-8)',
                minWidth: 0, 
                height: '100%',
                overflow: 'hidden'
            }}
        >
            <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-dark-6)', flexShrink: 0 }}>
                <Group justify="space-between">
                    <Group>
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
                             activePackage?.category === 'layout' ? <FontAwesomeIcon icon={faLayerGroup} /> :
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
                        <Tooltip label={isSidebarOpen ? "Expand View" : "Show List"}>
                            <ActionIcon variant="subtle" color="gray" onClick={() => setSidebarOpen(!isSidebarOpen)}>
                                <FontAwesomeIcon icon={faColumns} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                </Group>
            </Box>

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
                    {selectedPkgId === 'enumitem' && (
                        <Box p="md" h="100%">
                            <ScrollArea h="100%" type="auto" offsetScrollbars>
                                <ListsTab 
                                    config={listConfig as any}
                                    customLists={galleryLists}
                                    onChange={(key, val) => setListConfig(prev => ({ ...prev, [key]: val }))}
                                    onAddList={(name, type, options) => {
                                        // "options" argument here receives the options string constructed in ListsTab
                                        const newList: CustomListDef = { 
                                            id: Date.now(), 
                                            name, 
                                            baseType: type,
                                            options: options // Stores full options string
                                        };
                                        setGalleryLists(prev => [...prev, newList]);
                                    }}
                                    onRemoveList={(id) => setGalleryLists(prev => prev.filter(l => l.id !== id))}
                                />
                            </ScrollArea>
                        </Box>
                    )}
                </Box>
            ) : (
                <ScrollArea style={{ flex: 1, minHeight: 0 }} p="md" type="auto" offsetScrollbars>
                    {selectedPkgId === 'amsmath' && <AmsMathConfig onChange={setGeneratedCode} />}
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
            )}

            {!isEmbeddedWizard || ['xcolor', 'enumitem'].includes(selectedPkgId) ? (
                <Stack gap={0} p="md" bg="dark.9" style={{ borderTop: '1px solid var(--mantine-color-dark-6)', flexShrink: 0 }}>
                    <Group justify="space-between" mb="xs">
                        <Text size="xs" fw={700} c="dimmed">GENERATED CODE</Text>
                        <Group gap="xs">
                            {activePackage?.command && !['xcolor', 'enumitem'].includes(selectedPkgId) && (
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
    </Box>
  );
};