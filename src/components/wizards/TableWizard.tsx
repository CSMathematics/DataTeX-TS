import React, { useState } from 'react';
import { 
  Grid, Button, TextInput, Switch, ActionIcon, 
  Group, Stack, Text, ScrollArea, Divider, Code, Tooltip
} from '@mantine/core';
import { 
  Plus, Trash, AlignLeft, AlignCenter, AlignRight, 
  Table as TableIcon, Check
} from 'lucide-react';

interface TableWizardProps {
  onInsert: (code: string) => void;
}

export const TableWizard: React.FC<TableWizardProps> = ({ onInsert }) => {
  // --- State ---
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [data, setData] = useState<string[][]>(
    Array(3).fill(null).map(() => Array(3).fill(''))
  );
  const [alignments, setAlignments] = useState<string[]>(Array(3).fill('c'));
  
  // Options
  const [useBooktabs, setUseBooktabs] = useState(true);
  const [isCentered, setIsCentered] = useState(true);
  const [caption, setCaption] = useState('');
  const [label, setLabel] = useState('');

  // --- Actions ---
  const updateCell = (r: number, c: number, val: string) => {
    const newData = [...data];
    newData[r][c] = val;
    setData(newData);
  };

  const addRow = () => {
    setData([...data, Array(cols).fill('')]);
    setRows(r => r + 1);
  };

  const removeRow = (index: number) => {
    if (rows <= 1) return;
    setData(data.filter((_, i) => i !== index));
    setRows(r => r - 1);
  };

  const addCol = () => {
    setData(data.map(row => [...row, '']));
    setAlignments([...alignments, 'c']);
    setCols(c => c + 1);
  };

  const removeCol = (index: number) => {
    if (cols <= 1) return;
    setData(data.map(row => row.filter((_, i) => i !== index)));
    setAlignments(alignments.filter((_, i) => i !== index));
    setCols(c => c - 1);
  };

  const cycleAlign = (idx: number) => {
    const map = ['l', 'c', 'r'];
    const currentIdx = map.indexOf(alignments[idx]);
    const newAligns = [...alignments];
    newAligns[idx] = map[(currentIdx + 1) % 3];
    setAlignments(newAligns);
  };

  // --- Generator ---
  const generateCode = () => {
    let code = '';
    
    // Environment
    code += `\\begin{table}[h]\n`;
    if (isCentered) code += `  \\centering\n`;
    if (caption) code += `  \\caption{${caption}}\n`;
    if (label) code += `  \\label{${label}}\n`;

    // Tabular setup
    const colSpec = useBooktabs ? alignments.join(' ') : `|${alignments.join('|')}|`;
    code += `  \\begin{tabular}{${colSpec}}\n`;

    // Top Rule
    if (useBooktabs) code += `    \\toprule\n`;
    else code += `    \\hline\n`;

    // Rows
    data.forEach((row, rIdx) => {
      // Clean cells and join
      const rowStr = row.map(c => c.trim()).join(' & ');
      code += `    ${rowStr} \\\\\n`;
      
      // Mid/Bottom Rules
      if (useBooktabs) {
        if (rIdx === 0) code += `    \\midrule\n`; // Header separation
        else if (rIdx === rows - 1) code += `    \\bottomrule\n`;
      } else {
        code += `    \\hline\n`;
      }
    });

    code += `  \\end{tabular}\n`;
    code += `\\end{table}`;
    
    return code;
  };

  return (
    <Grid h="100%" gutter={0}>
      {/* LEFT: Editor Area */}
      <Grid.Col span={9} p="md" h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
        <Group mb="md">
          <Button leftSection={<Plus size={16}/>} variant="light" onClick={addRow} size="xs">Add Row</Button>
          <Button leftSection={<Plus size={16}/>} variant="light" onClick={addCol} size="xs">Add Col</Button>
        </Group>
        
        <ScrollArea style={{ flex: 1, border: '1px solid var(--mantine-color-dark-6)', borderRadius: 4 }} bg="dark.7" p="sm">
          <div style={{ display: 'inline-block' }}>
            
            {/* Header: Alignments & Delete Col */}
            <Group gap={4} mb="xs" wrap="nowrap">
              <div style={{ width: 30 }} /> {/* Spacer for row delete button */}
              {alignments.map((align, i) => (
                <Stack key={`head-${i}`} gap={2} align="center" w={120}>
                  <Group gap={2}>
                    <Tooltip label="Change Alignment">
                      <ActionIcon size="xs" variant="subtle" onClick={() => cycleAlign(i)}>
                        {align === 'l' ? <AlignLeft size={14}/> : align === 'c' ? <AlignCenter size={14}/> : <AlignRight size={14}/>}
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete Column">
                      <ActionIcon size="xs" variant="subtle" color="red" onClick={() => removeCol(i)}>
                        <Trash size={14}/>
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Stack>
              ))}
            </Group>

            {/* Rows */}
            {data.map((row, rIdx) => (
              <Group key={`row-${rIdx}`} gap={4} mb={4} wrap="nowrap">
                {/* Delete Row Button */}
                <Tooltip label="Delete Row">
                  <ActionIcon 
                    color="red" 
                    variant="subtle" 
                    size="sm" 
                    onClick={() => removeRow(rIdx)}
                    style={{ opacity: rows > 1 ? 1 : 0.5 }}
                    disabled={rows <= 1}
                  >
                    <Trash size={14} />
                  </ActionIcon>
                </Tooltip>
                
                {/* Cells */}
                {row.map((cell, cIdx) => (
                  <TextInput 
                    key={`${rIdx}-${cIdx}`}
                    value={cell}
                    onChange={(e) => updateCell(rIdx, cIdx, e.currentTarget.value)}
                    w={120}
                    styles={{ 
                      input: { 
                        textAlign: alignments[cIdx] as any,
                        backgroundColor: rIdx === 0 ? 'var(--mantine-color-dark-5)' : undefined,
                        fontWeight: rIdx === 0 ? 700 : 400
                      } 
                    }}
                    placeholder={rIdx === 0 ? "Header" : "Data"}
                  />
                ))}
              </Group>
            ))}
          </div>
        </ScrollArea>
      </Grid.Col>

      {/* RIGHT: Options & Preview */}
      <Grid.Col span={3} bg="dark.8" p="md" style={{ borderLeft: '1px solid var(--mantine-color-dark-6)', display: 'flex', flexDirection: 'column' }}>
        <Stack gap="md" style={{ flex: 1 }}>
          <Group gap="xs">
            <TableIcon size={18} />
            <Text fw={700}>Table Options</Text>
          </Group>
          <Divider />
          
          <Switch 
            label="Professional (Booktabs)" 
            checked={useBooktabs} 
            onChange={(e) => setUseBooktabs(e.currentTarget.checked)} 
          />
          <Switch 
            label="Center Table" 
            checked={isCentered} 
            onChange={(e) => setIsCentered(e.currentTarget.checked)} 
          />
          
          <TextInput 
            label="Caption" 
            placeholder="My Table" 
            value={caption} 
            onChange={(e) => setCaption(e.currentTarget.value)} 
          />
          <TextInput 
            label="Label" 
            placeholder="tab:mytable" 
            value={label} 
            onChange={(e) => setLabel(e.currentTarget.value)} 
          />

          <Divider label="Preview" labelPosition="center" />
          <ScrollArea style={{ flex: 1 }}>
             <Code block style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>
                {generateCode()}
             </Code>
          </ScrollArea>
        </Stack>

        <Button 
          mt="md" 
          fullWidth 
          leftSection={<Check size={16} />} 
          onClick={() => onInsert(generateCode())}
        >
          Insert Table
        </Button>
      </Grid.Col>
    </Grid>
  );
};