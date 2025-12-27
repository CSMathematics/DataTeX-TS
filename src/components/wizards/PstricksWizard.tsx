import React, { useState, useEffect } from 'react';
import {
  Stack, TextInput, Checkbox, Group, NumberInput,
  Select, Tabs, Button, Divider, Text,
  ScrollArea, Box, SimpleGrid
} from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCogs, faCode } from '@fortawesome/free-solid-svg-icons';

interface PstricksWizardProps {
  onInsert: (code: string) => void;
  onChange: (code: string) => void;
}

export const PstricksWizard: React.FC<PstricksWizardProps> = ({ onInsert, onChange }) => {
  const [activeTab, setActiveTab] = useState<string>('config');

  // Package Options
  const [noXcolor, setNoXcolor] = useState(false);
  const [plain, setPlain] = useState(false);
  const [customPkgOpts, setCustomPkgOpts] = useState('');

  // Global Settings (\psset)
  const [unit, setUnit] = useState<number>(1);
  const [unitType, setUnitType] = useState<string>('cm');
  const [linewidth, setLinewidth] = useState<number>(0.8);
  const [linecolor, setLinecolor] = useState<string>('black');
  const [fillstyle, setFillstyle] = useState<string>('none');
  const [fillcolor, setFillcolor] = useState<string>('');

  // Custom \psset additions
  const [customPsset, setCustomPsset] = useState('');

  // Effect to generate code
  useEffect(() => {
    let pkgOpts = [];
    if (noXcolor) pkgOpts.push('noxcolor');
    if (plain) pkgOpts.push('plain');
    if (customPkgOpts.trim()) pkgOpts.push(customPkgOpts.trim());

    let code = `\\usepackage${pkgOpts.length > 0 ? `[${pkgOpts.join(',')}]` : ''}{pstricks}\n`;

    // Add pstricks-add if useful? User just asked for pstricks.
    // Keeping it simple.

    let pssetOpts = [];
    if (unit !== 1 || unitType !== 'cm') pssetOpts.push(`unit=${unit}${unitType}`);
    if (linewidth !== 0.8) pssetOpts.push(`linewidth=${linewidth}pt`);
    if (linecolor !== 'black') pssetOpts.push(`linecolor=${linecolor.replace('#', '')}`);
    if (fillstyle !== 'none') pssetOpts.push(`fillstyle=${fillstyle}`);
    if (fillcolor && fillstyle !== 'none') pssetOpts.push(`fillcolor=${fillcolor.replace('#', '')}`);
    if (customPsset.trim()) pssetOpts.push(customPsset.trim());

    if (pssetOpts.length > 0) {
        code += `\\psset{${pssetOpts.join(', ')}}\n`;
    }

    onChange(code);
  }, [noXcolor, plain, customPkgOpts, unit, unitType, linewidth, linecolor, fillstyle, fillcolor, customPsset]);

  const insertSnippet = (snippet: string) => {
    onInsert(snippet);
  };

  return (
    <Box h="100%" display="flex" style={{ flexDirection: 'column', overflow: 'hidden' }}>
        <Tabs value={activeTab} onChange={(v) => v && setActiveTab(v)} variant="outline" style={{ flexShrink: 0 }}>
            <Tabs.List>
                <Tabs.Tab value="config" leftSection={<FontAwesomeIcon icon={faCogs} />}>Configuration</Tabs.Tab>
                <Tabs.Tab value="snippets" leftSection={<FontAwesomeIcon icon={faCode} />}>Snippets</Tabs.Tab>
            </Tabs.List>
        </Tabs>

        <ScrollArea style={{ flex: 1 }} p="md">
            {activeTab === 'config' && (
                <Stack gap="lg">
                    <Box>
                        <Divider label="Package Loading Options" labelPosition="left" mb="sm" />
                        <Stack gap="xs">
                            <Checkbox label="No XColor (noxcolor)" checked={noXcolor} onChange={(e) => setNoXcolor(e.currentTarget.checked)} />
                            <Checkbox label="Plain TeX (plain)" checked={plain} onChange={(e) => setPlain(e.currentTarget.checked)} />
                            <TextInput
                                label="Custom Options"
                                placeholder="e.g. 97, dia"
                                value={customPkgOpts}
                                onChange={(e) => setCustomPkgOpts(e.currentTarget.value)}
                            />
                        </Stack>
                    </Box>

                    <Box>
                        <Divider label="Global Settings (\psset)" labelPosition="left" mb="sm" />
                        <Stack gap="md">
                            <Group align="flex-end">
                                <NumberInput label="Unit Size" value={unit} onChange={(v) => setUnit(Number(v))} min={0.1} step={0.1} style={{ flex: 1 }} />
                                <Select data={['cm', 'in', 'mm', 'pt']} value={unitType} onChange={(v) => v && setUnitType(v)} style={{ width: 80 }} />
                            </Group>

                            <SimpleGrid cols={2}>
                                <NumberInput label="Line Width (pt)" value={linewidth} onChange={(v) => setLinewidth(Number(v))} min={0} step={0.1} />
                                <TextInput label="Line Color" value={linecolor} onChange={(e) => setLinecolor(e.currentTarget.value)} placeholder="black, red..." />
                            </SimpleGrid>

                            <SimpleGrid cols={2}>
                                <Select label="Fill Style" value={fillstyle} onChange={(v) => v && setFillstyle(v)} data={['none', 'solid', 'vlines', 'hlines', 'crosshatch']} />
                                <TextInput label="Fill Color" value={fillcolor} onChange={(e) => setFillcolor(e.currentTarget.value)} disabled={fillstyle === 'none'} placeholder="blue!20" />
                            </SimpleGrid>

                            <TextInput
                                label="Custom \psset Options"
                                placeholder="e.g. runit=1cm, gridlabels=0pt"
                                value={customPsset}
                                onChange={(e) => setCustomPsset(e.currentTarget.value)}
                            />
                        </Stack>
                    </Box>
                </Stack>
            )}

            {activeTab === 'snippets' && (
                <Stack gap="md">
                    <Text size="sm" c="dimmed">Click to insert common PSTricks commands into your document.</Text>

                    <Divider label="Basic Shapes" labelPosition="left" />
                    <SimpleGrid cols={2}>
                        <Button variant="default" size="xs" onClick={() => insertSnippet('\\psline(0,0)(3,2)')}>Line</Button>
                        <Button variant="default" size="xs" onClick={() => insertSnippet('\\psframe(0,0)(4,2)')}>Frame (Rect)</Button>
                        <Button variant="default" size="xs" onClick={() => insertSnippet('\\pscircle(2,2){1.5}')}>Circle</Button>
                        <Button variant="default" size="xs" onClick={() => insertSnippet('\\psellipse(2,1)(1.5,0.8)')}>Ellipse</Button>
                    </SimpleGrid>

                    <Divider label="Curves & Arcs" labelPosition="left" />
                    <SimpleGrid cols={2}>
                        <Button variant="default" size="xs" onClick={() => insertSnippet('\\pscurve(0,0)(1,2)(2,1)(4,2)')}>Curve</Button>
                        <Button variant="default" size="xs" onClick={() => insertSnippet('\\psarc(0,0){2}{0}{90}')}>Arc</Button>
                        <Button variant="default" size="xs" onClick={() => insertSnippet('\\psbezier(0,0)(1,2)(3,2)(4,0)')}>Bezier</Button>
                        <Button variant="default" size="xs" onClick={() => insertSnippet('\\pswedge(0,0){2}{0}{60}')}>Wedge</Button>
                    </SimpleGrid>

                    <Divider label="Grids & Axes" labelPosition="left" />
                    <SimpleGrid cols={2}>
                        <Button variant="default" size="xs" onClick={() => insertSnippet('\\psgrid[subgriddiv=1,griddots=10,gridlabels=7pt](0,0)(4,4)')}>Grid</Button>
                        <Button variant="default" size="xs" onClick={() => insertSnippet('\\psaxes{->}(0,0)(5,5)')}>Axes</Button>
                    </SimpleGrid>

                    <Divider label="Text" labelPosition="left" />
                    <Button variant="default" size="xs" onClick={() => insertSnippet('\\rput(2,2){Label}')}>rput (Rotate/Put)</Button>
                    <Button variant="default" size="xs" onClick={() => insertSnippet('\\uput[45](2,2){Label}')}>uput (Unit Put)</Button>
                </Stack>
            )}
        </ScrollArea>
    </Box>
  );
};
