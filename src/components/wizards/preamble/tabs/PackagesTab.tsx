import React from 'react';
import { SimpleGrid, Stack, Checkbox, Text } from '@mantine/core';
import { PreambleConfig } from '../generators/preambleGenerators';

interface PackagesTabProps {
  config: PreambleConfig;
  onChange: (key: string, val: any) => void;
}

export const PackagesTab: React.FC<PackagesTabProps> = ({ config, onChange }) => {
  return (
    <SimpleGrid cols={2} spacing="lg">
      <Stack gap="xs">
        <Text fw={700} size="sm">Mathematics & Science</Text>
        <Checkbox label="AMS Suite" checked={config.pkgAmsmath} onChange={(e) => onChange('pkgAmsmath', e.currentTarget.checked)} />
        <Checkbox label="Siunitx" checked={config.pkgSiunitx} onChange={(e) => onChange('pkgSiunitx', e.currentTarget.checked)} />
      </Stack>

      <Stack gap="xs">
        <Text fw={700} size="sm">Graphics & Figures</Text>
        <Checkbox label="Graphicx" checked={config.pkgGraphicx} onChange={(e) => onChange('pkgGraphicx', e.currentTarget.checked)} />
        <Checkbox label="TikZ" checked={config.pkgTikz} onChange={(e) => onChange('pkgTikz', e.currentTarget.checked)} />
        <Checkbox label="Pgfplots" checked={config.pkgPgfplots} onChange={(e) => onChange('pkgPgfplots', e.currentTarget.checked)} />
        <Checkbox label="Float" checked={config.pkgFloat} onChange={(e) => onChange('pkgFloat', e.currentTarget.checked)} />
        <Checkbox label="Caption" checked={config.pkgCaption} onChange={(e) => onChange('pkgCaption', e.currentTarget.checked)} />
        <Checkbox label="Subcaption" checked={config.pkgSubcaption} onChange={(e) => onChange('pkgSubcaption', e.currentTarget.checked)} />
      </Stack>

      <Stack gap="xs">
        <Text fw={700} size="sm">Tables</Text>
        <Checkbox label="Booktabs" checked={config.pkgBooktabs} onChange={(e) => onChange('pkgBooktabs', e.currentTarget.checked)} />
        <Checkbox label="Multirow" checked={config.pkgMultirow} onChange={(e) => onChange('pkgMultirow', e.currentTarget.checked)} />
        <Checkbox label="Tabularx" checked={config.pkgTabularx} onChange={(e) => onChange('pkgTabularx', e.currentTarget.checked)} />
      </Stack>

      <Stack gap="xs">
        <Text fw={700} size="sm">Layout & Formatting</Text>
        <Checkbox label="Fancyhdr" checked={config.pkgFancyhdr} onChange={(e) => onChange('pkgFancyhdr', e.currentTarget.checked)} />
        <Checkbox label="Multicol" checked={config.pkgMulticol} onChange={(e) => onChange('pkgMulticol', e.currentTarget.checked)} />
        <Checkbox label="Titlesec" checked={config.pkgTitlesec} onChange={(e) => onChange('pkgTitlesec', e.currentTarget.checked)} />
        <Checkbox label="Microtype" checked={config.pkgMicrotype} onChange={(e) => onChange('pkgMicrotype', e.currentTarget.checked)} />
        <Checkbox label="Csquotes" checked={config.pkgCsquotes} onChange={(e) => onChange('pkgCsquotes', e.currentTarget.checked)} />
      </Stack>

      <Stack gap="xs">
        <Text fw={700} size="sm">References & Code</Text>
        <Checkbox label="Hyperref" checked={config.pkgHyperref} onChange={(e) => onChange('pkgHyperref', e.currentTarget.checked)} />
        <Checkbox label="Cleveref" checked={config.pkgCleveref} onChange={(e) => onChange('pkgCleveref', e.currentTarget.checked)} />
        <Checkbox label="Listings" checked={config.pkgListings} onChange={(e) => onChange('pkgListings', e.currentTarget.checked)} />
        <Checkbox label="Todonotes" checked={config.pkgTodonotes} onChange={(e) => onChange('pkgTodonotes', e.currentTarget.checked)} />
      </Stack>
    </SimpleGrid>
  );
};