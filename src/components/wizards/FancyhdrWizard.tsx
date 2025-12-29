import React, { useState, useEffect } from 'react';
import {
  Stack, TextInput, Checkbox, NumberInput,
  Select, Tabs, Button, Divider, Text,
  ScrollArea, Box, SimpleGrid, Code, Group, Tooltip, ActionIcon, Menu, CopyButton
} from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCogs, faFileAlt, faCheck, faCopy, faList } from '@fortawesome/free-solid-svg-icons';
import { FancyhdrVisualizer } from './FancyhdrVisualizer';

interface FancyhdrWizardProps {
  onInsert: (code: string) => void;
}

// Preset configurations
const PRESETS = {
  bookStandard: {
    name: 'Book Standard',
    description: 'Standard book layout with page numbers in outer margins',
    documentType: 'twoside' as const,
    headerOddLeft: '',
    headerOddCenter: '',
    headerOddRight: '\\thepage',
    headerEvenLeft: '\\thepage',
    headerEvenCenter: '',
    headerEvenRight: '',
    footerOddLeft: '',
    footerOddCenter: '',
    footerOddRight: '',
    footerEvenLeft: '',
    footerEvenCenter: '',
    footerEvenRight: '',
    headRuleWidth: 0.4,
    footRuleWidth: 0
  },
  thesis: {
    name: 'Thesis Style',
    description: 'Academic thesis with chapter/section in headers',
    documentType: 'twoside' as const,
    headerOddLeft: '\\leftmark',
    headerOddCenter: '',
    headerOddRight: '\\thepage',
    headerEvenLeft: '\\thepage',
    headerEvenCenter: '',
    headerEvenRight: '\\rightmark',
    footerOddLeft: '',
    footerOddCenter: '',
    footerOddRight: '',
    footerEvenLeft: '',
    footerEvenCenter: '',
    footerEvenRight: '',
    headRuleWidth: 0.4,
    footRuleWidth: 0
  },
  article: {
    name: 'Article Simple',
    description: 'Simple article with centered page numbers in footer',
    documentType: 'oneside' as const,
    headerOddLeft: '',
    headerOddCenter: '',
    headerOddRight: '',
    headerEvenLeft: '',
    headerEvenCenter: '',
    headerEvenRight: '',
    footerOddLeft: '',
    footerOddCenter: '\\thepage',
    footerOddRight: '',
    footerEvenLeft: '',
    footerEvenCenter: '',
    footerEvenRight: '',
    headRuleWidth: 0,
    footRuleWidth: 0
  },
  report: {
    name: 'Report Format',
    description: 'Professional report with title and date',
    documentType: 'oneside' as const,
    headerOddLeft: '\\@title',
    headerOddCenter: '',
    headerOddRight: '\\today',
    headerEvenLeft: '',
    headerEvenCenter: '',
    headerEvenRight: '',
    footerOddLeft: '',
    footerOddCenter: '\\thepage',
    footerOddRight: '',
    footerEvenLeft: '',
    footerEvenCenter: '',
    footerEvenRight: '',
    headRuleWidth: 0.4,
    footRuleWidth: 0.4
  }
};

export const FancyhdrWizard: React.FC<FancyhdrWizardProps> = ({ onInsert }) => {
  const [activeTab, setActiveTab] = useState<string>('config');
  const [leftPanelWidth, setLeftPanelWidth] = useState(65); // Percentage
  const [isResizing, setIsResizing] = useState(false);

  // Configuration options
  const [documentType, setDocumentType] = useState<'oneside' | 'twoside'>('twoside');
  const [headTopLine, setHeadTopLine] = useState(false);
  const [footBotLine, setFootBotLine] = useState(false);
  const [headRuleWidth, setHeadRuleWidth] = useState<number>(0.4);
  const [footRuleWidth, setFootRuleWidth] = useState<number>(0);
  const [customPackageOptions, setCustomPackageOptions] = useState('');

  // Header content state
  const [headerOddLeft, setHeaderOddLeft] = useState('');
  const [headerOddCenter, setHeaderOddCenter] = useState('');
  const [headerOddRight, setHeaderOddRight] = useState('\\thepage');
  const [headerEvenLeft, setHeaderEvenLeft] = useState('\\thepage');
  const [headerEvenCenter, setHeaderEvenCenter] = useState('');
  const [headerEvenRight, setHeaderEvenRight] = useState('');

  // Footer content state
  const [footerOddLeft, setFooterOddLeft] = useState('');
  const [footerOddCenter, setFooterOddCenter] = useState('');
  const [footerOddRight, setFooterOddRight] = useState('');
  const [footerEvenLeft, setFooterEvenLeft] = useState('');
  const [footerEvenCenter, setFooterEvenCenter] = useState('');
  const [footerEvenRight, setFooterEvenRight] = useState('');

  // Preview mode and zoom
  const [previewMode, setPreviewMode] = useState<'code' | 'visual'>('visual');
  const [zoomLevel, setZoomLevel] = useState(100);

  // Generated code
  const [generatedCode, setGeneratedCode] = useState('');

  // Code generation logic
  useEffect(() => {
    let code = '';

    const pkgOpts: string[] = [];
    if (headTopLine) pkgOpts.push('headtopline');
    if (footBotLine) pkgOpts.push('footbotline');
    if (customPackageOptions.trim()) {
      pkgOpts.push(customPackageOptions.trim());
    }

    if (pkgOpts.length > 0) {
      code += `\\usepackage[${pkgOpts.join(', ')}]{fancyhdr}\n`;
    } else {
      code += `\\usepackage{fancyhdr}\n`;
    }

    code += `\n% Set page style to fancy\n\\pagestyle{fancy}\n\n`;
    code += `% Clear all header and footer fields\n\\fancyhf{}\n\n`;

    const headerCommands: string[] = [];
    
    if (documentType === 'twoside') {
      if (headerOddLeft) headerCommands.push(`\\fancyhead[LO]{${headerOddLeft}}`);
      if (headerOddCenter) headerCommands.push(`\\fancyhead[CO]{${headerOddCenter}}`);
      if (headerOddRight) headerCommands.push(`\\fancyhead[RO]{${headerOddRight}}`);
      if (headerEvenLeft) headerCommands.push(`\\fancyhead[LE]{${headerEvenLeft}}`);
      if (headerEvenCenter) headerCommands.push(`\\fancyhead[CE]{${headerEvenCenter}}`);
      if (headerEvenRight) headerCommands.push(`\\fancyhead[RE]{${headerEvenRight}}`);
    } else {
      if (headerOddLeft) headerCommands.push(`\\fancyhead[L]{${headerOddLeft}}`);
      if (headerOddCenter) headerCommands.push(`\\fancyhead[C]{${headerOddCenter}}`);
      if (headerOddRight) headerCommands.push(`\\fancyhead[R]{${headerOddRight}}`);
    }

    if (headerCommands.length > 0) {
      code += `% Configure headers\n`;
      headerCommands.forEach(cmd => code += `${cmd}\n`);
      code += `\n`;
    }

    const footerCommands: string[] = [];
    
    if (documentType === 'twoside') {
      if (footerOddLeft) footerCommands.push(`\\fancyfoot[LO]{${footerOddLeft}}`);
      if (footerOddCenter) footerCommands.push(`\\fancyfoot[CO]{${footerOddCenter}}`);
      if (footerOddRight) footerCommands.push(`\\fancyfoot[RO]{${footerOddRight}}`);
      if (footerEvenLeft) footerCommands.push(`\\fancyfoot[LE]{${footerEvenLeft}}`);
      if (footerEvenCenter) footerCommands.push(`\\fancyfoot[CE]{${footerEvenCenter}}`);
      if (footerEvenRight) footerCommands.push(`\\fancyfoot[RE]{${footerEvenRight}}`);
    } else {
      if (footerOddLeft) footerCommands.push(`\\fancyfoot[L]{${footerOddLeft}}`);
      if (footerOddCenter) footerCommands.push(`\\fancyfoot[C]{${footerOddCenter}}`);
      if (footerOddRight) footerCommands.push(`\\fancyfoot[R]{${footerOddRight}}`);
    }

    if (footerCommands.length > 0) {
      code += `% Configure footers\n`;
      footerCommands.forEach(cmd => code += `${cmd}\n`);
      code += `\n`;
    }

    if (headRuleWidth !== 0.4) {
      code += `% Header rule width\n\\renewcommand{\\headrulewidth}{${headRuleWidth}pt}\n`;
    }
    if (footRuleWidth !== 0) {
      code += `% Footer rule width\n\\renewcommand{\\footrulewidth}{${footRuleWidth}pt}\n`;
    }

    setGeneratedCode(code);
  }, [
    documentType, headTopLine, footBotLine, headRuleWidth, footRuleWidth, customPackageOptions,
    headerOddLeft, headerOddCenter, headerOddRight, headerEvenLeft, headerEvenCenter, headerEvenRight,
    footerOddLeft, footerOddCenter, footerOddRight, footerEvenLeft, footerEvenCenter, footerEvenRight
  ]);

  const commonCommands = [
    { label: 'Page', cmd: '\\thepage', tooltip: 'Current page number' },
    { label: 'Chapter', cmd: '\\leftmark', tooltip: 'Chapter name (uppercase)' },
    { label: 'Section', cmd: '\\rightmark', tooltip: 'Section name' },
    { label: 'Today', cmd: '\\today', tooltip: 'Current date' },
    { label: 'Author', cmd: '\\@author', tooltip: 'Document author' },
    { label: 'Title', cmd: '\\@title', tooltip: 'Document title' },
  ];

  const handleInsertCode = () => {
    onInsert(generatedCode);
  };

  const applyPreset = (presetKey: keyof typeof PRESETS) => {
    const preset = PRESETS[presetKey];
    setDocumentType(preset.documentType);
    setHeaderOddLeft(preset.headerOddLeft);
    setHeaderOddCenter(preset.headerOddCenter);
    setHeaderOddRight(preset.headerOddRight);
    setHeaderEvenLeft(preset.headerEvenLeft);
    setHeaderEvenCenter(preset.headerEvenCenter);
    setHeaderEvenRight(preset.headerEvenRight);
    setFooterOddLeft(preset.footerOddLeft);
    setFooterOddCenter(preset.footerOddCenter);
    setFooterOddRight(preset.footerOddRight);
    setFooterEvenLeft(preset.footerEvenLeft);
    setFooterEvenCenter(preset.footerEvenCenter);
    setFooterEvenRight(preset.footerEvenRight);
    setHeadRuleWidth(preset.headRuleWidth);
    setFootRuleWidth(preset.footRuleWidth);
  };

  // Resize handling
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const container = document.getElementById('fancyhdr-wizard-container');
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      
      // Constrain between 40% and 80%
      const clampedWidth = Math.max(40, Math.min(80, newWidth));
      setLeftPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
  }, [isResizing]);

  return (
    <Box id="fancyhdr-wizard-container" h="100%" style={{ display: 'flex', overflow: 'hidden', position: 'relative' }}>
      
      {/* LEFT PANEL: Controls */}
      <Box style={{ width: `${leftPanelWidth}%`, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--mantine-color-dark-6)' }}>
        
        {/* Tabs Header */}
        <Tabs value={activeTab} onChange={(v) => v && setActiveTab(v)} variant="pills" radius="sm" p="xs">
          <Tabs.List grow>
            <Tabs.Tab value="config" leftSection={<FontAwesomeIcon icon={faCogs} style={{ width: 16, height: 16 }} />}>
              <Tooltip label="Package and document settings">
                <span>Configuration</span>
              </Tooltip>
            </Tabs.Tab>
            <Tabs.Tab value="headers" leftSection={<FontAwesomeIcon icon={faFileAlt} style={{ width: 16, height: 16 }} />}>
              <Tooltip label="Configure page headers">
                <span>Headers</span>
              </Tooltip>
            </Tabs.Tab>
            <Tabs.Tab value="footers" leftSection={<FontAwesomeIcon icon={faFileAlt} style={{ width: 16, height: 16 }} />}>
              <Tooltip label="Configure page footers">
                <span>Footers</span>
              </Tooltip>
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {/* Scrollable Content */}
        <ScrollArea style={{ flex: 1 }} p="md" type="hover">
          {activeTab === 'config' && (
            <Stack gap="lg">
              {/* Presets Section */}
              <Box>
                <Divider label="Quick Start Templates" labelPosition="left" mb="sm" />
                <Menu shadow="md" width={280}>
                  <Menu.Target>
                    <Button variant="light" leftSection={<FontAwesomeIcon icon={faList} style={{ width: 14, height: 14 }} />} fullWidth>
                      Load Preset Template
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {Object.entries(PRESETS).map(([key, preset]) => (
                      <Menu.Item
                        key={key}
                        onClick={() => applyPreset(key as keyof typeof PRESETS)}
                      >
                        <Text size="sm" fw={600}>{preset.name}</Text>
                        <Text size="xs" c="dimmed">{preset.description}</Text>
                      </Menu.Item>
                    ))}
                  </Menu.Dropdown>
                </Menu>
              </Box>

              <Box>
                <Divider label="Document Settings" labelPosition="left" mb="sm" />
                <Select
                  label="Document Type"
                  description="Choose whether your document is one-sided or two-sided"
                  value={documentType}
                  onChange={(v) => v && setDocumentType(v as 'oneside' | 'twoside')}
                  data={[
                    { value: 'oneside', label: 'One-sided (article, report)' },
                    { value: 'twoside', label: 'Two-sided (book)' }
                  ]}
                />
              </Box>

              <Box>
                <Divider label="Package Options" labelPosition="left" mb="sm" />
                <Stack gap="xs">
                  <Checkbox
                    label="Head Top Line"
                    description="Add a line above the header"
                    checked={headTopLine}
                    onChange={(e) => setHeadTopLine(e.currentTarget.checked)}
                  />
                  <Checkbox
                    label="Foot Bottom Line"
                    description="Add a line below the footer"
                    checked={footBotLine}
                    onChange={(e) => setFootBotLine(e.currentTarget.checked)}
                  />
                  <TextInput
                    label="Custom Package Options"
                    placeholder="e.g., nocheck, footsepline"
                    description="Additional package options (comma-separated)"
                    value={customPackageOptions}
                    onChange={(e) => setCustomPackageOptions(e.currentTarget.value)}
                  />
                </Stack>
              </Box>

              <Box>
                <Divider label="Header and Footer Rules" labelPosition="left" mb="sm" />
                <SimpleGrid cols={2}>
                  <NumberInput
                    label="Header Rule Width (pt)"
                    description="0 = no rule"
                    value={headRuleWidth}
                    onChange={(v) => setHeadRuleWidth(Number(v))}
                    min={0}
                    max={5}
                    step={0.1}
                    decimalScale={1}
                  />
                  <NumberInput
                    label="Footer Rule Width (pt)"
                    description="0 = no rule"
                    value={footRuleWidth}
                    onChange={(v) => setFootRuleWidth(Number(v))}
                    min={0}
                    max={5}
                    step={0.1}
                    decimalScale={1}
                  />
                </SimpleGrid>
              </Box>
            </Stack>
          )}

          {activeTab === 'headers' && (
            <Stack gap="lg">
              <Box>
                <Text size="sm" c="dimmed" mb="md">
                  Configure header content for different page positions. Click any command to copy it.
                </Text>
                
                <Divider label="Quick Insert Commands" labelPosition="left" mb="sm" />
                <Group gap="xs" mb="md">
                  {commonCommands.map((cmd) => (
                    <CopyButton key={cmd.cmd} value={cmd.cmd}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? 'Copied!' : cmd.tooltip}>
                          <Button
                            variant="default"
                            size="compact-xs"
                            onClick={copy}
                            color={copied ? 'teal' : 'gray'}
                            leftSection={copied ? <FontAwesomeIcon icon={faCheck} style={{ width: 10, height: 10 }} /> : <FontAwesomeIcon icon={faCopy} style={{ width: 10, height: 10 }} />}
                          >
                            {cmd.label}
                          </Button>
                        </Tooltip>
                      )}
                    </CopyButton>
                  ))}
                </Group>
              </Box>

              {documentType === 'twoside' ? (
                <>
                  <Box>
                    <Divider label="Odd Pages (Right-hand)" labelPosition="left" mb="sm" />
                    <Group grow align="flex-start">
                      <TextInput
                        label="Left"
                        placeholder="e.g., \\leftmark"
                        value={headerOddLeft}
                        onChange={(e) => setHeaderOddLeft(e.currentTarget.value)}
                      />
                      <TextInput
                        label="Center"
                        placeholder="e.g., Chapter \\thechapter"
                        value={headerOddCenter}
                        onChange={(e) => setHeaderOddCenter(e.currentTarget.value)}
                      />
                      <TextInput
                        label="Right"
                        placeholder="e.g., \\thepage"
                        value={headerOddRight}
                        onChange={(e) => setHeaderOddRight(e.currentTarget.value)}
                      />
                    </Group>
                  </Box>

                  <Box>
                    <Divider label="Even Pages (Left-hand)" labelPosition="left" mb="sm" />
                    <Group grow align="flex-start">
                      <TextInput
                        label="Left"
                        placeholder="e.g., \\thepage"
                        value={headerEvenLeft}
                        onChange={(e) => setHeaderEvenLeft(e.currentTarget.value)}
                      />
                      <TextInput
                        label="Center"
                        placeholder="e.g., \\rightmark"
                        value={headerEvenCenter}
                        onChange={(e) => setHeaderEvenCenter(e.currentTarget.value)}
                      />
                      <TextInput
                        label="Right"
                        placeholder="e.g., Title"
                        value={headerEvenRight}
                        onChange={(e) => setHeaderEvenRight(e.currentTarget.value)}
                      />
                    </Group>
                  </Box>
                </>
              ) : (
                <Box>
                  <Divider label="Header Content (All Pages)" labelPosition="left" mb="sm" />
                  <Group grow align="flex-start">
                    <TextInput
                      label="Left"
                      placeholder="e.g., \\leftmark"
                      value={headerOddLeft}
                      onChange={(e) => setHeaderOddLeft(e.currentTarget.value)}
                    />
                    <TextInput
                      label="Center"
                      placeholder="e.g., Title"
                      value={headerOddCenter}
                      onChange={(e) => setHeaderOddCenter(e.currentTarget.value)}
                    />
                    <TextInput
                      label="Right"
                      placeholder="e.g., \\thepage"
                      value={headerOddRight}
                      onChange={(e) => setHeaderOddRight(e.currentTarget.value)}
                    />
                  </Group>
                </Box>
              )}
            </Stack>
          )}

          {activeTab === 'footers' && (
            <Stack gap="lg">
              <Box>
                <Text size="sm" c="dimmed" mb="md">
                  Configure footer content for different page positions. Click any command to copy it.
                </Text>
                
                <Divider label="Quick Insert Commands" labelPosition="left" mb="sm" />
                <Group gap="xs" mb="md">
                  {commonCommands.map((cmd) => (
                    <CopyButton key={cmd.cmd} value={cmd.cmd}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? 'Copied!' : cmd.tooltip}>
                          <Button
                            variant="default"
                            size="compact-xs"
                            onClick={copy}
                            color={copied ? 'teal' : 'gray'}
                            leftSection={copied ? <FontAwesomeIcon icon={faCheck} style={{ width: 10, height: 10 }} /> : <FontAwesomeIcon icon={faCopy} style={{ width: 10, height: 10 }} />}
                          >
                            {cmd.label}
                          </Button>
                        </Tooltip>
                      )}
                    </CopyButton>
                  ))}
                </Group>
              </Box>

              {documentType === 'twoside' ? (
                <>
                  <Box>
                    <Divider label="Odd Pages (Right-hand)" labelPosition="left" mb="sm" />
                    <Group grow align="flex-start">
                      <TextInput
                        label="Left"
                        placeholder="e.g., Author"
                        value={footerOddLeft}
                        onChange={(e) => setFooterOddLeft(e.currentTarget.value)}
                      />
                      <TextInput
                        label="Center"
                        placeholder="e.g., \\thepage"
                        value={footerOddCenter}
                        onChange={(e) => setFooterOddCenter(e.currentTarget.value)}
                      />
                      <TextInput
                        label="Right"
                        placeholder="e.g., \\today"
                        value={footerOddRight}
                        onChange={(e) => setFooterOddRight(e.currentTarget.value)}
                      />
                    </Group>
                  </Box>

                  <Box>
                    <Divider label="Even Pages (Left-hand)" labelPosition="left" mb="sm" />
                    <Group grow align="flex-start">
                      <TextInput
                        label="Left"
                        placeholder="e.g., \\today"
                        value={footerEvenLeft}
                        onChange={(e) => setFooterEvenLeft(e.currentTarget.value)}
                      />
                      <TextInput
                        label="Center"
                        placeholder="e.g., \\thepage"
                        value={footerEvenCenter}
                        onChange={(e) => setFooterEvenCenter(e.currentTarget.value)}
                      />
                      <TextInput
                        label="Right"
                        placeholder="e.g., Author"
                        value={footerEvenRight}
                        onChange={(e) => setFooterEvenRight(e.currentTarget.value)}
                      />
                    </Group>
                  </Box>
                </>
              ) : (
                <Box>
                  <Divider label="Footer Content (All Pages)" labelPosition="left" mb="sm" />
                  <Group grow align="flex-start">
                    <TextInput
                      label="Left"
                      placeholder="e.g., Author"
                      value={footerOddLeft}
                      onChange={(e) => setFooterOddLeft(e.currentTarget.value)}
                    />
                    <TextInput
                      label="Center"
                      placeholder="e.g., \\thepage"
                      value={footerOddCenter}
                      onChange={(e) => setFooterOddCenter(e.currentTarget.value)}
                    />
                    <TextInput
                      label="Right"
                      placeholder="e.g., \\today"
                      value={footerOddRight}
                      onChange={(e) => setFooterOddRight(e.currentTarget.value)}
                    />
                  </Group>
                </Box>
              )}
            </Stack>
          )}
        </ScrollArea>

        {/* Bottom Action Bar */}
        <Box p="sm" bg="dark.8" style={{ borderTop: '1px solid var(--mantine-color-dark-6)' }}>
          <Button fullWidth onClick={handleInsertCode} leftSection={<FontAwesomeIcon icon={faCheck} style={{ width: 16, height: 16 }} />}>
            Insert Preamble
          </Button>
        </Box>
      </Box>

      {/* RESIZE HANDLE */}
      <Box
        onMouseDown={handleMouseDown}
        style={{
          width: 4,
          cursor: 'col-resize',
          backgroundColor: isResizing ? 'var(--mantine-primary-color-filled)' : 'transparent',
          transition: 'background-color 0.2s',
          ':hover': {
            backgroundColor: 'var(--mantine-primary-color-light)'
          }
        }}
      />

      {/* RIGHT PANEL: Preview */}
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--mantine-color-dark-9)' }}>
        
        {/* Preview Controls */}
        <Box p="xs" bg="dark.8" style={{ borderBottom: '1px solid var(--mantine-color-dark-6)' }}>
          <Group justify="space-between">
            <Button.Group>
              <Button size="xs" variant={previewMode === 'code' ? 'filled' : 'default'} onClick={() => setPreviewMode('code')}>Code</Button>
              <Button size="xs" variant={previewMode === 'visual' ? 'filled' : 'default'} onClick={() => setPreviewMode('visual')}>Visual</Button>
            </Button.Group>
            
            {previewMode === 'visual' && (
              <Group gap="xs">
                <Tooltip label="Zoom out">
                  <ActionIcon size="sm" variant="subtle" onClick={() => setZoomLevel(z => Math.max(50, z - 10))}>
                    <Text size="xs">−</Text>
                  </ActionIcon>
                </Tooltip>
                <Text size="xs" c="dimmed" style={{ minWidth: 50, textAlign: 'center' }}>{zoomLevel}%</Text>
                <Tooltip label="Zoom in">
                  <ActionIcon size="sm" variant="subtle" onClick={() => setZoomLevel(z => Math.min(150, z + 10))}>
                    <Text size="xs">+</Text>
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Reset zoom">
                  <ActionIcon size="sm" variant="subtle" onClick={() => setZoomLevel(100)}>
                    <Text size="xs">Reset</Text>
                  </ActionIcon>
                </Tooltip>
              </Group>
            )}
          </Group>
        </Box>

        {/* Preview Content */}
        <Box style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {previewMode === 'code' ? (
            <ScrollArea h="100%">
              <Code block style={{ whiteSpace: 'pre-wrap', backgroundColor: 'transparent', minHeight: '100%', fontSize: 12 }}>
                {generatedCode}
              </Code>
            </ScrollArea>
          ) : (
            <FancyhdrVisualizer
              documentType={documentType}
              headerOddLeft={headerOddLeft}
              headerOddCenter={headerOddCenter}
              headerOddRight={headerOddRight}
              headerEvenLeft={headerEvenLeft}
              headerEvenCenter={headerEvenCenter}
              headerEvenRight={headerEvenRight}
              footerOddLeft={footerOddLeft}
              footerOddCenter={footerOddCenter}
              footerOddRight={footerOddRight}
              footerEvenLeft={footerEvenLeft}
              footerEvenCenter={footerEvenCenter}
              footerEvenRight={footerEvenRight}
              headRuleWidth={headRuleWidth}
              footRuleWidth={footRuleWidth}
              zoomLevel={zoomLevel}
            />
          )}
        </Box>
      </Box>

    </Box>
  );
};
