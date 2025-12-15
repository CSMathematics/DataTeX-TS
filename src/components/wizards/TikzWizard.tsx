import React, { useState } from 'react';
import { 
  Grid, Select, TextInput, Button, Tabs, Stack, Text, Code, 
  Group, ScrollArea, ColorInput, NumberInput, Divider
} from '@mantine/core';
import { PenTool, Check, Activity, Square, Circle, Type } from 'lucide-react';

interface TikzWizardProps {
  onInsert: (code: string) => void;
}

export const TikzWizard: React.FC<TikzWizardProps> = ({ onInsert }) => {
  const [activeTab, setActiveTab] = useState<string | null>('basic');
  
  // Basic Shapes State
  const [shape, setShape] = useState('node');
  const [coords, setCoords] = useState('0,0');
  const [content, setContent] = useState('Text');
  const [color, setColor] = useState('black');
  const [thickness, setThickness] = useState('thin');
  const [fill, setFill] = useState('');

  // Plot State
  const [plotType, setPlotType] = useState('2d');
  const [func, setFunc] = useState('x^2');
  const [domainMin, setDomainMin] = useState('-5');
  const [domainMax, setDomainMax] = useState('5');
  const [xlabel, setXlabel] = useState('$x$');
  const [ylabel, setYlabel] = useState('$y$');

  const getCode = () => {
    let code = '';
    
    if (activeTab === 'basic') {
      code += `\\begin{tikzpicture}\n`;
      let options = [];
      if (color !== 'black') options.push(color);
      if (thickness !== 'thin') options.push(thickness);
      if (fill) options.push(`fill=${fill}`);
      if (shape === 'node') options.push('draw');
      
      const optStr = options.length > 0 ? `[${options.join(', ')}]` : '';
      
      if (shape === 'node') {
        code += `  \\node${optStr} at (${coords}) {${content}};\n`;
      } else if (shape === 'circle') {
        code += `  \\draw${optStr} (${coords}) circle (${content}cm);\n`;
      } else if (shape === 'rectangle') {
        code += `  \\draw${optStr} (${coords}) rectangle ++(${content});\n`;
      } else if (shape === 'line') {
        code += `  \\draw${optStr} (${coords}) -- (${content});\n`;
      }
      code += `\\end{tikzpicture}`;
    } 
    else if (activeTab === 'plot') {
      code += `\\begin{tikzpicture}\n`;
      code += `  \\begin{axis}[\n`;
      code += `    axis lines = middle,\n`;
      code += `    xlabel = {${xlabel}},\n`;
      code += `    ylabel = {${ylabel}},\n`;
      if (plotType === '3d') code += `    view={60}{30},\n`;
      code += `  ]\n`;
      
      if (plotType === '2d') {
        code += `    \\addplot[color=blue, domain=${domainMin}:${domainMax}, samples=100] {${func}};\n`;
      } else {
        code += `    \\addplot3[surf, domain=${domainMin}:${domainMax}] {${func}};\n`;
      }
      
      code += `  \\end{axis}\n`;
      code += `\\end{tikzpicture}`;
    }
    return code;
  };

  return (
    <Grid h="100%" gutter={0}>
      {/* LEFT: Configuration */}
      <Grid.Col span={6} p="md" h="100%">
        <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="sm">
          <Tabs.List>
            <Tabs.Tab value="basic" leftSection={<Square size={14}/>}>Basic Shapes</Tabs.Tab>
            <Tabs.Tab value="plot" leftSection={<Activity size={14}/>}>Plots (Pgfplots)</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="basic" pt="md">
            <Stack gap="md">
              <Select 
                label="Shape Type" 
                data={[
                  { value: 'node', label: 'Node (Text Box)' },
                  { value: 'circle', label: 'Circle' },
                  { value: 'rectangle', label: 'Rectangle' },
                  { value: 'line', label: 'Line / Path' }
                ]} 
                value={shape} 
                onChange={(v) => setShape(v || 'node')} 
              />
              
              <Group grow>
                 <TextInput label="Start Coordinates (x,y)" value={coords} onChange={(e) => setCoords(e.currentTarget.value)} placeholder="0,0" />
                 <TextInput 
                   label={shape === 'node' ? 'Content' : shape === 'line' ? 'End Coordinates' : shape === 'circle' ? 'Radius' : 'Size (w,h)'} 
                   value={content} 
                   onChange={(e) => setContent(e.currentTarget.value)} 
                 />
              </Group>

              <Divider label="Styling" labelPosition="center" />
              
              <Group grow>
                <Select label="Color" data={['black', 'red', 'blue', 'green', 'orange', 'purple']} value={color} onChange={(v) => setColor(v || 'black')} />
                <Select label="Thickness" data={['ultra thin', 'very thin', 'thin', 'semithick', 'thick', 'very thick', 'ultra thick']} value={thickness} onChange={(v) => setThickness(v || 'thin')} />
              </Group>
              
              <TextInput label="Fill Color (Optional)" placeholder="e.g. red!20" value={fill} onChange={(e) => setFill(e.currentTarget.value)} />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="plot" pt="md">
            <Stack gap="md">
              <Select 
                label="Plot Type" 
                data={[{value:'2d', label: '2D Function'}, {value:'3d', label: '3D Surface'}]} 
                value={plotType} 
                onChange={(v) => setPlotType(v || '2d')} 
              />
              
              <TextInput 
                label={`Function f(${plotType === '2d' ? 'x' : 'x,y'}) =`} 
                value={func} 
                onChange={(e) => setFunc(e.currentTarget.value)} 
                description="Use standard math syntax, e.g. x^2, sin(deg(x)), etc."
              />

              <Group grow>
                <TextInput label="Domain Min" value={domainMin} onChange={(e) => setDomainMin(e.currentTarget.value)} />
                <TextInput label="Domain Max" value={domainMax} onChange={(e) => setDomainMax(e.currentTarget.value)} />
              </Group>

              <Group grow>
                <TextInput label="X Axis Label" value={xlabel} onChange={(e) => setXlabel(e.currentTarget.value)} />
                <TextInput label="Y Axis Label" value={ylabel} onChange={(e) => setYlabel(e.currentTarget.value)} />
              </Group>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Grid.Col>

      {/* RIGHT: Preview */}
      <Grid.Col span={6} bg="dark.8" p="md" h="100%" style={{ borderLeft: '1px solid var(--mantine-color-dark-6)', display: 'flex', flexDirection: 'column' }}>
        <Stack h="100%">
           <Text size="sm" fw={700} c="dimmed">CODE PREVIEW</Text>
           <ScrollArea style={{ flex: 1, backgroundColor: 'var(--mantine-color-dark-9)', borderRadius: 4 }} p="xs">
             <Code block style={{ backgroundColor: 'transparent', whiteSpace: 'pre-wrap' }}>{getCode()}</Code>
           </ScrollArea>
           
           <Button leftSection={<Check size={16}/>} onClick={() => onInsert(getCode())}>
             Insert Code
           </Button>
        </Stack>
      </Grid.Col>
    </Grid>
  );
};