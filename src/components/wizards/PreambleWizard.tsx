import React, { useState, useEffect } from 'react';
import { 
  Stack, Button, Tabs, ScrollArea, Box, Grid, Code
} from '@mantine/core';
import { 
  FileText, Layout, Package, Palette, Code as CodeIcon, List as ListIcon, Check
} from 'lucide-react';

// --- Imports from Separated Files ---
// Κρατάμε μόνο τους τύπους που χρειαζόμαστε για το State
import { 
  CustomColorDef, CustomListDef 
} from './preamble/LanguageDb';

import {
  PreambleConfig,
  generateFullPreamble
} from './preamble/generators/preambleGenerators';

import { GeneralTab } from './preamble/tabs/GeneralTab';
import { LayoutTab } from './preamble/tabs/LayoutTab';
import { PackagesTab } from './preamble/tabs/PackagesTab';
import { CodeHighlightingTab, CodeHighlightConfig } from './preamble/tabs/CodeHighlightingTab';
import { ListsTab } from './preamble/tabs/ListsTab';
import { ColorsTab } from './preamble/tabs/ColorsTab';
import { PageVisualizer } from './preamble/preview/PageVisualizer';

interface PreambleWizardProps {
  onInsert: (code: string) => void;
}

export const PreambleWizard: React.FC<PreambleWizardProps> = ({ onInsert }) => {
  const [activeTab, setActiveTab] = useState<string | null>('general');
  const [previewMode, setPreviewMode] = useState<'code' | 'visual'>('visual');
  const [generatedCode, setGeneratedCode] = useState('');

  // --- Configuration State ---
  const [config, setConfig] = useState<PreambleConfig>({
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
    marginTop: 2.5, marginBottom: 2.5, marginLeft: 2.5, marginRight: 2.5,
    columns: 'one', columnSep: 0.5, sidedness: 'oneside',
    marginNotes: false, marginSep: 0.5, marginWidth: 3.0, includeMp: false,
    
    headHeight: 0, headSep: 0, footSkip: 0, bindingOffset: 0,
    hOffset: 0, vOffset: 0, includeHead: false, includeFoot: false,
    
    // Packages
    pkgAmsmath: true, pkgGraphicx: true, pkgHyperref: true,
    pkgTikz: false, pkgPgfplots: false, pkgBooktabs: false,
    pkgFloat: false, pkgFancyhdr: false, pkgXcolor: true,

    // New Packages
    pkgSiunitx: false, pkgMicrotype: false, pkgCsquotes: false,
    pkgMultirow: false, pkgTabularx: false, pkgMulticol: false,
    pkgTitlesec: false, pkgCaption: false, pkgSubcaption: false,
    pkgListings: false, pkgCleveref: false, pkgTodonotes: false,

    // Lists (Enumitem)
    pkgEnumitem: false,
    enumitemSep: 'default',
    enumitemItemize: 'default',
    enumitemEnumerate: 'default',
  });

  // --- Code Highlighting State ---
  const [codeSettings, setCodeSettings] = useState<CodeHighlightConfig>({
    engine: 'none',
    langs: ['python'],
    showNumbers: true,
    showFrame: true,
    breakLines: true,
    mintedStyle: 'friendly',
    lstColors: {
      keyword: '#0000FF',
      string: '#A020F0',
      comment: '#008000',
      background: '#F5F5F5'
    }
  });

  // --- Custom Definitions State ---
  const [customColors, setCustomColors] = useState<CustomColorDef[]>([]);
  const [customLists, setCustomLists] = useState<CustomListDef[]>([]);

  // --- Handlers ---
  const handleChange = (key: string, val: any) => {
    setConfig(prev => ({ ...prev, [key]: val }));
  };

  const handleCodeChange = (key: keyof CodeHighlightConfig, val: any) => {
    setCodeSettings(prev => ({ ...prev, [key]: val }));
  };

  const handleCodeColorChange = (key: keyof CodeHighlightConfig['lstColors'], val: string) => {
    setCodeSettings(prev => ({
        ...prev,
        lstColors: { ...prev.lstColors, [key]: val }
    }));
  };

  const handleAddColor = (name: string, model: string, value: string, previewHex: string) => {
    setCustomColors(prev => [...prev, { id: Date.now(), name, model, value, previewHex }]);
  };

  const handleAddList = (name: string, type: string, label: string) => {
    // @ts-ignore
    setCustomLists(prev => [...prev, { id: Date.now(), name, baseType: type, label }]);
  };

  // --- Code Generation Effect ---
  useEffect(() => {
    const code = generateFullPreamble(config, customColors, customLists, codeSettings);
    setGeneratedCode(code);
  }, [config, customColors, customLists, codeSettings]);

  // --- RENDER ---
  return (
    <Stack gap={0} h="100%">
      
      {/* CONTENT GRID */}
      <Grid gutter={0} style={{ flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT COLUMN: Controls */}
        <Grid.Col span={7} h="100%" style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--mantine-color-dark-6)' }}>
            
            {/* Tabs Header */}
            <Tabs value={activeTab} onChange={setActiveTab} variant="pills" radius="sm" p="xs">
              <Tabs.List grow>
                <Tabs.Tab value="general" leftSection={<FileText size={16}/>}>General</Tabs.Tab>
                <Tabs.Tab value="layout" leftSection={<Layout size={16}/>}>Layout</Tabs.Tab>
                <Tabs.Tab value="packages" leftSection={<Package size={16}/>}>Packages</Tabs.Tab>
                <Tabs.Tab value="code" leftSection={<CodeIcon size={16}/>}>Code</Tabs.Tab>
                <Tabs.Tab value="lists" leftSection={<ListIcon size={16}/>}>Lists</Tabs.Tab>
                <Tabs.Tab value="colors" leftSection={<Palette size={16}/>}>Colors</Tabs.Tab>
              </Tabs.List>
            </Tabs>

            {/* Scrollable Content Area */}
            <ScrollArea style={{ flex: 1 }} p="md">
                {activeTab === 'general' && <GeneralTab config={config} onChange={handleChange} />}
                {activeTab === 'layout' && <LayoutTab config={config} onChange={handleChange} />}
                {activeTab === 'packages' && <PackagesTab config={config} onChange={handleChange} />}
                {activeTab === 'code' && (
                    <CodeHighlightingTab 
                        config={codeSettings} 
                        onChange={handleCodeChange} 
                        onColorChange={handleCodeColorChange} 
                    />
                )}
                {activeTab === 'lists' && (
                    <ListsTab 
                        config={config} 
                        customLists={customLists} 
                        onChange={handleChange} 
                        onAddList={handleAddList}
                        onRemoveList={(id) => setCustomLists(l => l.filter(x => x.id !== id))}
                    />
                )}
                {activeTab === 'colors' && (
                    <ColorsTab 
                        config={config} 
                        customColors={customColors} 
                        onChange={handleChange} 
                        onAddColor={handleAddColor}
                        onRemoveColor={(id) => setCustomColors(c => c.filter(x => x.id !== id))}
                    />
                )}
            </ScrollArea>

            {/* Bottom Action Bar */}
            <Box p="sm" bg="dark.8" style={{ borderTop: '1px solid var(--mantine-color-dark-6)' }}>
                <Button fullWidth onClick={() => onInsert(generatedCode)} leftSection={<Check size={16}/>}>
                    Insert Preamble
                </Button>
            </Box>
        </Grid.Col>

        {/* RIGHT COLUMN: Preview (Code or Visual) */}
        <Grid.Col span={5} bg="dark.9" h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
            
            {/* Preview Mode Switcher */}
            <Box p="xs" bg="dark.8" style={{ borderBottom: '1px solid var(--mantine-color-dark-6)' }}>
                 <Button.Group>
                    <Button size="xs" variant={previewMode === 'code' ? 'filled' : 'default'} onClick={() => setPreviewMode('code')}>Code</Button>
                    <Button size="xs" variant={previewMode === 'visual' ? 'filled' : 'default'} onClick={() => setPreviewMode('visual')}>Visual</Button>
                 </Button.Group>
            </Box>

            <Box style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {previewMode === 'code' ? (
                    <ScrollArea h="100%">
                        <Code block style={{ whiteSpace: 'pre-wrap', backgroundColor: 'transparent', minHeight: '100%', fontSize: 11 }}>
                            {generatedCode}
                        </Code>
                    </ScrollArea>
                ) : (
                    <PageVisualizer config={config} />
                )}
            </Box>
        </Grid.Col>

      </Grid>
    </Stack>
  );
};