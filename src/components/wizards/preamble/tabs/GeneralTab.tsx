import React from 'react';
import { 
  SimpleGrid, Select, Divider, TextInput, Group, Switch 
} from '@mantine/core';
import { LANGUAGES, PAPER_SIZES } from '../LanguageDb';
import { PreambleConfig } from '../generators/preambleGenerators';

interface GeneralTabProps {
  config: PreambleConfig;
  onChange: (key: string, val: any) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ config, onChange }) => {
  return (
    <>
      <SimpleGrid cols={2} spacing="md">
        <Select 
          label="Document Class" 
          data={['article', 'report', 'book', 'beamer']} 
          value={config.docClass} 
          onChange={(v) => onChange('docClass', v)} 
        />
        <Select 
          label="Font Size (pt)" 
          data={['10', '11', '12']} 
          value={config.fontSize} 
          onChange={(v) => onChange('fontSize', v)} 
        />
        <Select 
          label="Paper Size" 
          data={PAPER_SIZES} 
          value={config.paperSize} 
          onChange={(v) => onChange('paperSize', v)} 
        />
        <Select 
          label="Language" 
          data={LANGUAGES} 
          value={config.mainLang} 
          onChange={(v) => onChange('mainLang', v)} 
          searchable 
        />
      </SimpleGrid>
      
      <Divider my="md" />
      
      <TextInput 
        label="Title" 
        mb="sm" 
        value={config.title} 
        onChange={(e) => onChange('title', e.currentTarget.value)} 
      />
      
      <Group grow align="flex-end">
         <TextInput 
           label="Author" 
           value={config.author} 
           onChange={(e) => onChange('author', e.currentTarget.value)} 
         />
         <Switch 
           label="Include Date" 
           checked={config.date} 
           onChange={(e) => onChange('date', e.currentTarget.checked)} 
           mb={8} // Align with input text
         />
      </Group>
    </>
  );
};