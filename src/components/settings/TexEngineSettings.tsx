import { useState, useEffect } from 'react';
import { TextInput, Select, Checkbox, Button, Stack, Title, Group, Text, Box } from '@mantine/core';

export interface TexEngineConfig {
    defaultEngine: 'pdflatex' | 'xelatex' | 'lualatex';
    pdflatexPath: string;
    xelatexPath: string;
    lualatexPath: string;
    outputDirectory: string;
    shellEscape: boolean;
    synctex: boolean;
    bibtex: boolean;
}

const DEFAULT_CONFIG: TexEngineConfig = {
    defaultEngine: 'pdflatex',
    pdflatexPath: 'pdflatex',
    xelatexPath: 'xelatex',
    lualatexPath: 'lualatex',
    outputDirectory: 'build',
    shellEscape: false,
    synctex: true,
    bibtex: false
};

export const TexEngineSettings = () => {
    const [config, setConfig] = useState<TexEngineConfig>(DEFAULT_CONFIG);

    useEffect(() => {
        // Load from localStorage for now
        const saved = localStorage.getItem('tex-engine-config');
        if (saved) {
            try {
                setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved) });
            } catch (e) {
                console.error("Failed to parse settings", e);
            }
        }
    }, []);

    const handleChange = (key: keyof TexEngineConfig, value: any) => {
        const newConfig = { ...config, [key]: value };
        setConfig(newConfig);
        localStorage.setItem('tex-engine-config', JSON.stringify(newConfig));
    };

    return (
        <Stack gap="md" maw={600}>
            <Title order={4}>TeX Engine Configuration</Title>
            <Text size="sm" c="dimmed">Configure how your LaTeX documents are compiled.</Text>

            <Select
                label="Default Engine"
                description="The engine used when no specific magic comment is found."
                data={[
                    { value: 'pdflatex', label: 'pdfLaTeX' },
                    { value: 'xelatex', label: 'XeLaTeX' },
                    { value: 'lualatex', label: 'LuaLaTeX' }
                ]}
                value={config.defaultEngine}
                onChange={(val) => handleChange('defaultEngine', val)}
            />

            <Group grow align="flex-start">
                <TextInput
                    label="pdfLaTeX Path"
                    placeholder="pdflatex"
                    value={config.pdflatexPath}
                    onChange={(e) => handleChange('pdflatexPath', e.currentTarget.value)}
                />
            </Group>
             <Group grow align="flex-start">
                <TextInput
                    label="XeLaTeX Path"
                    placeholder="xelatex"
                    value={config.xelatexPath}
                    onChange={(e) => handleChange('xelatexPath', e.currentTarget.value)}
                />
            </Group>
             <Group grow align="flex-start">
                <TextInput
                    label="LuaLaTeX Path"
                    placeholder="lualatex"
                    value={config.lualatexPath}
                    onChange={(e) => handleChange('lualatexPath', e.currentTarget.value)}
                />
            </Group>

            <TextInput
                label="Output Directory"
                description="Directory for auxiliary files (relative to document)."
                value={config.outputDirectory}
                onChange={(e) => handleChange('outputDirectory', e.currentTarget.value)}
            />

            <Checkbox
                label="Enable Shell Escape (--shell-escape)"
                description="Allows execution of external commands (e.g., for minted)."
                checked={config.shellEscape}
                onChange={(e) => handleChange('shellEscape', e.currentTarget.checked)}
            />

            <Checkbox
                label="Enable SyncTeX"
                description="Allows synchronization between source and PDF."
                checked={config.synctex}
                onChange={(e) => handleChange('synctex', e.currentTarget.checked)}
            />

            <Checkbox
                label="Enable BibTeX"
                description="Run bibtex after compilation to generate bibliography."
                checked={config.bibtex}
                onChange={(e) => handleChange('bibtex', e.currentTarget.checked)}
            />

            <Box mt="md">
                <Button variant="default" onClick={() => {
                    setConfig(DEFAULT_CONFIG);
                    localStorage.removeItem('tex-engine-config');
                }}>
                    Reset to Defaults
                </Button>
            </Box>
        </Stack>
    );
};
