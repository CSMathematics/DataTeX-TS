import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Stack, Text, Group, Tabs, TextInput, NumberInput, 
  ColorInput, Slider, Button, ScrollArea,
  Select, Box, Divider, ActionIcon, Badge, Textarea, Menu, Popover, ColorPicker, Paper
} from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSquare, faChartLine, faPlus, faFont, faLayerGroup, faTrash, faColumns,
  faPencilAlt, faArrowRight, faPalette, faChevronDown, faGripLines, faGripLinesVertical
} from '@fortawesome/free-solid-svg-icons';
import { TIKZ_TEMPLATES } from './tikzTemplates';

interface TikzWizardProps {
  onInsert: (code: string) => void;
}

type Mode = 'shapes' | 'plots' | 'text' | 'templates' | 'coordinates';
type ShapeType = 'circle' | 'rectangle' | 'line' | 'grid' | 'ellipse' | 'arc';
type LineStyle = 'solid' | 'dashed' | 'dotted';
type ArrowType = 'none' | '->' | '<-' | '<->';
type GridStyle = 'none' | 'major' | 'minor' | 'both';

interface SceneElement {
  id: string;
  type: Mode;
  params: any;
  style: {
    color: string;
    fill: string;
    lineWidth: number;
    opacity: number;
    lineStyle: LineStyle;
    arrowHead: ArrowType;
  };
}

export function TikzWizard({ onInsert }: TikzWizardProps) {
  const [activeTab, setActiveTab] = useState<string>('shapes');
  const [elements, setElements] = useState<SceneElement[]>([]);
  const [codeValue, setCodeValue] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // --- Resizing State ---
  const [topSectionHeight, setTopSectionHeight] = useState(250); 
  const [isResizingVert, setIsResizingVert] = useState(false);
  const [leftColWidth, setLeftColWidth] = useState(40); 
  const [isResizingHoriz, setIsResizingHoriz] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);

  // Quick Color Picker State
  const [quickColor, setQuickColor] = useState('#339af0');

  // Ref to skip code update when typing in editor
  const shouldSkipUpdate = useRef(false);

  // --- Global Styling State (Form State) ---
  // These control the FORM inputs. When an element is selected, these sync to that element.
  // When no element is selected, these act as "defaults" for the NEW element.
  const [color, setColor] = useState('#339af0');
  const [lineWidth, setLineWidth] = useState(0.8);
  const [fill, setFill] = useState('');
  const [opacity, setOpacity] = useState(100);
  const [lineStyle, setLineStyle] = useState<LineStyle>('solid');
  const [arrowHead, setArrowHead] = useState<ArrowType>('none');

  // --- Shapes State ---
  const [shapeType, setShapeType] = useState<ShapeType>('circle');
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [radius, setRadius] = useState(2);
  const [width, setWidth] = useState(3);
  const [height, setHeight] = useState(2);
  const [x2, setX2] = useState(2);
  const [y2, setY2] = useState(2);

  // New Shapes Params
  const [rx, setRx] = useState(2);
  const [ry, setRy] = useState(1);
  const [startAngle, setStartAngle] = useState(0);
  const [endAngle, setEndAngle] = useState(90);

  // --- Plots State ---
  const [functionStr, setFunctionStr] = useState('sin(x)');
  const [xMin, setXMin] = useState(-5);
  const [xMax, setXMax] = useState(5);
  const [samples] = useState(100);
  const [showAxis, setShowAxis] = useState(true); // Now per-plot technically, but usually wrapper
  const [plotTitle, setPlotTitle] = useState('');
  const [xLabel, setXLabel] = useState('$x$');
  const [yLabel, setYLabel] = useState('$y$');
  const [grid, setGrid] = useState<GridStyle>('none');

  // --- Text (Node) State ---
  const [textContent, setTextContent] = useState('Label');

  // --- Coordinates State ---
  const [coordName, setCoordName] = useState('A');

  // --- Dragging State ---
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{x: number, y: number, elX: number, elY: number} | null>(null);

  const toSvgX = (val: number) => 150 + (val * 20);
  const toSvgY = (val: number) => 150 - (val * 20); 
  const fromSvgX = (svgX: number) => (svgX - 150) / 20;
  const fromSvgY = (svgY: number) => (150 - svgY) / 20;

  // --- Helpers to sync Form from Element ---
  const syncFormToElement = (el: SceneElement) => {
      // Style
      setColor(el.style.color);
      setFill(el.style.fill);
      setLineWidth(el.style.lineWidth);
      setOpacity(el.style.opacity);
      setLineStyle(el.style.lineStyle);
      setArrowHead(el.style.arrowHead);

      // Params
      const p = el.params;
      if (el.type === 'shapes') {
          setShapeType(p.shapeType);
          setX(p.x); setY(p.y);
          if (p.radius !== undefined) setRadius(p.radius);
          if (p.width !== undefined) setWidth(p.width);
          if (p.height !== undefined) setHeight(p.height);
          if (p.x2 !== undefined) setX2(p.x2);
          if (p.y2 !== undefined) setY2(p.y2);
          if (p.rx !== undefined) setRx(p.rx);
          if (p.ry !== undefined) setRy(p.ry);
          if (p.startAngle !== undefined) setStartAngle(p.startAngle);
          if (p.endAngle !== undefined) setEndAngle(p.endAngle);
      } else if (el.type === 'text') {
          setX(p.x); setY(p.y);
          setTextContent(p.textContent);
      } else if (el.type === 'coordinates') {
          setX(p.x); setY(p.y);
          setCoordName(p.coordName);
      } else if (el.type === 'plots') {
          setFunctionStr(p.functionStr);
          setXMin(p.xMin); setXMax(p.xMax);
          setShowAxis(p.showAxis ?? true);
          setPlotTitle(p.title ?? '');
          setXLabel(p.xlabel ?? '$x$');
          setYLabel(p.ylabel ?? '$y$');
          setGrid(p.grid ?? 'none');
      }
      setActiveTab(el.type);
  };

  // --- Selection Logic ---
  const handleSelect = (id: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setSelectedId(id);
      const el = elements.find(x => x.id === id);
      if (el) syncFormToElement(el);
  };

  const handleBackgroundClick = () => {
      setSelectedId(null);
  };

  // --- Update Logic (Form -> Element) ---
  // This generic updater updates the 'state' and, if an element is selected, updates the element too.
  const updateStateAndElement = (setter: (val: any) => void, paramKey: string, val: any, isStyle = false) => {
    setter(val);
    if (selectedId) {
        setElements(prev => prev.map(el => {
            if (el.id !== selectedId) return el;
            if (isStyle) {
                return { ...el, style: { ...el.style, [paramKey]: val } };
            } else {
                return { ...el, params: { ...el.params, [paramKey]: val } };
            }
        }));
    }
  };

  // Specific updaters for complex cases (e.g. shapes) can call this or do custom logic
  
  // --- Resize Logics ---
  const startResizingVert = useCallback((e: React.MouseEvent) => { e.preventDefault(); setIsResizingVert(true); }, []);
  const startResizingHoriz = useCallback((e: React.MouseEvent) => { e.preventDefault(); setIsResizingHoriz(true); }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (isDragging && dragStartRef.current && selectedId) {
          // Drag Logic
           // We are in global window coordinates.
           // However, calculating delta in SVG coordinates is easier if we look at SVG clicks.
           // But here we are in window mousemove.
           // Let's assume the SVG didn't move relative to screen.
           // Better: we did startDrag on the SVG element.
           // Let's rely on mapToSvg from generic move?
           // Actually, simpler:
           // We need current mouse pos -> map to svg -> map to tikz.
           // But access to svg rect is needed.
           // Let's fallback to handling dragging inside the SVG `onMouseMove`?
           // No, window listener is better for leaving bounds.
           // Ideally we simply track delta from start.
           
           // If we use the SVG onMouseMove for drag, it's easier to get local coords.
      }

      if (isResizingVert && rightColRef.current) {
        const rect = rightColRef.current.getBoundingClientRect();
        setTopSectionHeight(Math.max(100, Math.min(e.clientY - rect.top, rect.height - 150)));
      }
      if (isResizingHoriz && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setLeftColWidth(Math.max(20, Math.min(((e.clientX - rect.left) / rect.width) * 100, 80)));
      }
    };
    const up = () => { 
        setIsResizingVert(false); 
        setIsResizingHoriz(false); 
        setIsDragging(false);
        dragStartRef.current = null;
    };
    
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [isResizingVert, isResizingHoriz, isDragging, selectedId]);

  // --- SVG Drag & Click ---
  const handleSvgMouseDown = (e: React.MouseEvent<SVGElement>, id?: string) => {
    if (id) {
        e.stopPropagation();
        handleSelect(id);
        setIsDragging(true);
        // Calculate starting SVG coords
        const svg = e.currentTarget.closest('svg');
        if (svg) {
            const rect = svg.getBoundingClientRect();
            const rawX = e.clientX - rect.left;
            const rawY = e.clientY - rect.top;
            const tikzX = fromSvgX(rawX * (300 / rect.width));
            const tikzY = fromSvgY(rawY * (300 / rect.height));
            
            const el = elements.find(x => x.id === id);
            if (el) {
                // We store the Offset between Click and Element Origin
                dragStartRef.current = {
                    x: tikzX, 
                    y: tikzY,
                    elX: el.params.x,
                    elY: el.params.y
                };
            }
        }
    } else {
        // Background ID
    }
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
      if (isDragging && dragStartRef.current && selectedId) {
          const svg = e.currentTarget;
          const rect = svg.getBoundingClientRect();
          const rawX = e.clientX - rect.left;
          const rawY = e.clientY - rect.top;
          
          const currentTikzX = fromSvgX(rawX * (300 / rect.width));
          const currentTikzY = fromSvgY(rawY * (300 / rect.height));

          const deltaX = currentTikzX - dragStartRef.current.x;
          const deltaY = currentTikzY - dragStartRef.current.y;

          const newX = parseFloat((dragStartRef.current.elX + deltaX).toFixed(1));
          const newY = parseFloat((dragStartRef.current.elY + deltaY).toFixed(1));

          updateStateAndElement(setX, 'x', newX);
          updateStateAndElement(setY, 'y', newY);
      }
  };

  const handlePreviewClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) {
         // If we clicked background (not an element), update global X/Y to click pos for easy Adding
         const svg = e.currentTarget;
         const rect = svg.getBoundingClientRect();
         const rawX = e.clientX - rect.left;
         const rawY = e.clientY - rect.top;
         const tikzX = fromSvgX(rawX * (300 / rect.width));
         const tikzY = fromSvgY(rawY * (300 / rect.height));
         
         const fixedX = parseFloat(tikzX.toFixed(1));
         const fixedY = parseFloat(tikzY.toFixed(1));
         
         // Only update form if not selecting existing
         if (!selectedId) {
             setX(fixedX);
             setY(fixedY);
         } else {
             handleBackgroundClick();
         }
    }
  };

  // --- Snippet Injection ---
  const insertSnippet = (snippet: string) => {
    shouldSkipUpdate.current = true;
    setCodeValue(prev => {
        const endIdx = prev.lastIndexOf('\\end{tikzpicture}');
        if (endIdx !== -1) return prev.slice(0, endIdx) + '  ' + snippet + '\n' + prev.slice(endIdx);
        return prev + '\n' + snippet;
    });
    // Trigger parser manually after snippet insertion to update elements
    setTimeout(() => parseCode(codeValue + '\n' + snippet), 0);
  };

  // --- Generator: Element -> TikZ String ---
  const generateCommand = (el: SceneElement | null): string => {
    const type = el ? el.type : (activeTab as Mode);
    // Use the element's params if available, else use current Form state
    // Note: the Form state is synced with Selected Element, but if no element is selected, it's the draft state.
    
    // We construct 'p' based on whether we are generating for an existing element or the draft
    let p: any = el ? el.params : { 
        x, y, radius, width, height, x2, y2, rx, ry, startAngle, endAngle, 
        functionStr, xMin, xMax, samples, showAxis, 
        title: plotTitle, xlabel: xLabel, ylabel: yLabel, grid,
        textContent, shapeType, coordName 
    };

    let s = el ? el.style : { color, fill, lineWidth, opacity, lineStyle, arrowHead };

    // --- Style Gen ---
    const styleOptions = [];
    if (s.color && s.color !== '#000000') styleOptions.push(`draw=${s.color.replace('#', '')}`);
    if (s.fill) styleOptions.push(`fill=${s.fill.replace('#', '')}`);
    if (s.lineWidth !== 0.8) styleOptions.push(`line width=${s.lineWidth}mm`);
    if (s.opacity !== 100) styleOptions.push(`opacity=${s.opacity/100}`);
    if (s.lineStyle !== 'solid') styleOptions.push(s.lineStyle);
    if (s.arrowHead !== 'none') styleOptions.unshift(s.arrowHead);
    if (type === 'text' && s.color !== '#000000') styleOptions.push(`text=${s.color.replace('#', '')}`);
    if (type === 'plots') {
        // Plot specific styles like color, mark etc can be added here
        // Current impl uses drawing styles for plot line
        if (s.color && s.color !== '#000000') styleOptions.push(`${s.color.replace('#', '')}`); 
    }

    const styleStr = styleOptions.length > 0 ? `[${styleOptions.join(', ')}]` : '';

    if (type === 'shapes') {
        const st = p.shapeType;
        if (st === 'circle') return `\\draw${styleStr} (${p.x},${p.y}) circle (${p.radius}cm);`;
        if (st === 'ellipse') return `\\draw${styleStr} (${p.x},${p.y}) ellipse (${p.rx}cm and ${p.ry}cm);`;
        if (st === 'arc') return `\\draw${styleStr} (${p.x},${p.y}) arc (${p.startAngle}:${p.endAngle}:${p.radius}cm);`;
        if (st === 'rectangle') return `\\draw${styleStr} (${p.x},${p.y}) rectangle ++(${p.width},${p.height});`;
        if (st === 'line') return `\\draw${styleStr} (${p.x},${p.y}) -- (${p.x2},${p.y2});`;
        if (st === 'grid') return `\\draw[step=1cm,gray,very thin] (${p.x},${p.y}) grid (${p.x2},${p.y2});`;
    } 
    else if (type === 'text') {
        return `\\node${styleStr} at (${p.x},${p.y}) {${p.textContent}};`;
    } 
    else if (type === 'coordinates') {
        return `\\coordinate (${p.coordName}) at (${p.x},${p.y});`;
    }
    else if (type === 'plots') {
        return `\\addplot${styleStr} {${p.functionStr}};`;
    }
    return '';
  };

  // --- Code Assembly (Elements -> Text) ---
  useEffect(() => {
    if (shouldSkipUpdate.current) {
        shouldSkipUpdate.current = false;
        return;
    }
    if (activeTab === 'templates') return;

    const plotElements = elements.filter(e => e.type === 'plots');
    const otherElements = elements.filter(e => e.type !== 'plots');

    let code = '\\begin{tikzpicture}\n';
    
    // Draw non-plots first (or mix? usually plots are separate env)
    // Actually, Pgfplots usually needs 'axis' environment. 
    // If we have multiple plots, do we put them in one axis or multiple?
    // Current design: Single Axis for all plots (simplistic).
    // We will use the params of the FIRST plot to define the axis (limited).
    
    if (plotElements.length > 0) {
        const p = plotElements[0].params; 
        const axisOptions = [];
        axisOptions.push(`axis lines = ${p.showAxis ? 'middle' : 'none'}`);
        if(p.xlabel) axisOptions.push(`xlabel = {${p.xlabel}}`);
        if(p.ylabel) axisOptions.push(`ylabel = {${p.ylabel}}`);
        if(p.title) axisOptions.push(`title = {${p.title}}`);
        if(p.grid && p.grid !== 'none') axisOptions.push(`grid = ${p.grid}`);
        axisOptions.push(`domain=${p.xMin}:${p.xMax}`);
        axisOptions.push(`samples=${p.samples}`);

        code += `  \\begin{axis}[\n    ${axisOptions.join(',\n    ')}\n  ]\n`;
        plotElements.forEach(el => {
            code += `    ${generateCommand(el)}\n`;
        });
        code += `  \\end{axis}\n`;
    }

    otherElements.forEach(el => {
        code += `  ${generateCommand(el)}\n`;
    });

    if (elements.length === 0 && !codeValue.includes('tikzpicture')) {
       code += '\\end{tikzpicture}';
    } else if (elements.length === 0 && codeValue.includes('tikzpicture')) {
       // Keep existing shell
       return; 
    } else {
       code += '\\end{tikzpicture}';
    }
    
    setCodeValue(code);
  }, [elements, activeTab]); 

  // --- PARSER (Text -> Elements) ---
  const parseCode = useCallback((code: string) => {
    const newElements: SceneElement[] = [];
    const lines = code.split('\n');

    let currentAxisParams: any = {};

    lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('%')) return;

        if (trimmed.startsWith('\\begin{axis}')) {
            // Try to parse axis options roughly
            // const opts = trimmed.match(/\\begin{axis}\[(.*?)\]/s); // Multiline check needed? Usually passed one line here
            // Just basic checks for now
            if (trimmed.includes('title=')) {
                const m = trimmed.match(/title\s*=\s*{(.*?)}/);
                if (m) currentAxisParams.title = m[1];
            }
            if (trimmed.includes('xlabel=')) {
                const m = trimmed.match(/xlabel\s*=\s*{(.*?)}/);
                if (m) currentAxisParams.xlabel = m[1];
            }
            if (trimmed.includes('ylabel=')) {
                const m = trimmed.match(/ylabel\s*=\s*{(.*?)}/);
                if (m) currentAxisParams.ylabel = m[1];
            }
            if (trimmed.includes('grid=')) {
                const m = trimmed.match(/grid\s*=\s*(\w+)/);
                if (m) currentAxisParams.grid = m[1];
            }
            return;
        }
        if (trimmed.startsWith('\\end{axis}')) {
             currentAxisParams = {};
             return;
        }

        const getStyle = (styleStr: string | undefined) => {
            const style = { color: '#000000', fill: '', lineWidth: 0.8, opacity: 100, lineStyle: 'solid' as LineStyle, arrowHead: 'none' as ArrowType };
            if (!styleStr) return style;
            
            if (styleStr.includes('->')) style.arrowHead = '->';
            else if (styleStr.includes('<-')) style.arrowHead = '<-';
            
            if (styleStr.includes('dashed')) style.lineStyle = 'dashed';
            else if (styleStr.includes('dotted')) style.lineStyle = 'dotted';

            const drawMatch = styleStr.match(/draw=([0-9a-fA-F]+)/);
            if (drawMatch) style.color = '#' + drawMatch[1];
            
            const fillMatch = styleStr.match(/fill=([0-9a-fA-F]+)/);
            if (fillMatch) style.fill = '#' + fillMatch[1];

            const lwMatch = styleStr.match(/line width=([\d.]+)mm/);
            if (lwMatch) style.lineWidth = parseFloat(lwMatch[1]);

            const opMatch = styleStr.match(/opacity=([\d.]+)/);
            if (opMatch) style.opacity = parseFloat(opMatch[1]) * 100;
            return style;
        };

        const circleMatch = trimmed.match(/\\draw(?:\[(.*?)\])?\s*\(([\d.-]+),([\d.-]+)\)\s*circle\s*\(([\d.-]+)cm\);/);
        if (circleMatch) {
            newElements.push({
                id: Math.random().toString(36).substr(2, 9), type: 'shapes',
                style: getStyle(circleMatch[1]),
                params: { shapeType: 'circle', x: parseFloat(circleMatch[2]), y: parseFloat(circleMatch[3]), radius: parseFloat(circleMatch[4]) }
            });
            return;
        }
        
        // ... (Other parsers can be enhanced similarly, keeping basic for brevity)
        const nodeMatch = trimmed.match(/\\node(?:\[(.*?)\])?\s*at\s*\(([\d.-]+),([\d.-]+)\)\s*\{(.*?)\};/);
        if (nodeMatch) {
            newElements.push({
                id: Math.random().toString(36).substr(2, 9), type: 'text',
                style: getStyle(nodeMatch[1]),
                params: { x: parseFloat(nodeMatch[2]), y: parseFloat(nodeMatch[3]), textContent: nodeMatch[4] }
            });
            return;
        }

        const plotMatch = trimmed.match(/\\addplot(?:\[(.*?)\])?\s*\{(.*?)\};/);
        if (plotMatch) {
            // Merge axis params
            newElements.push({
                id: Math.random().toString(36).substr(2, 9), type: 'plots',
                style: getStyle(plotMatch[1]),
                params: { 
                    functionStr: plotMatch[2], xMin: -5, xMax: 5, samples: 100, showAxis: true,
                    ...currentAxisParams 
                }
            });
            return;
        }
    });

    if (newElements.length > 0) {
        setElements(newElements);
    }
  }, []);

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.currentTarget.value;
    shouldSkipUpdate.current = true; 
    setCodeValue(val);
    parseCode(val); 
  };

  const handleAddElement = () => {
    const newEl: SceneElement = {
        id: Date.now().toString(),
        type: activeTab as Mode,
        params: { 
           x, y, radius, width, height, x2, y2, rx, ry, startAngle, endAngle, 
           functionStr, xMin, xMax, samples, showAxis, 
           title: plotTitle, xlabel: xLabel, ylabel: yLabel, grid,
           textContent, shapeType, coordName 
        },
        style: { color, fill, lineWidth, opacity, lineStyle, arrowHead }
    };
    shouldSkipUpdate.current = false; 
    setElements([...elements, newEl]);
    // Auto Select Newly Added
    setSelectedId(newEl.id);
  };

  const handleRemoveElement = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    shouldSkipUpdate.current = false;
    setElements(elements.filter(e => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const renderSvgElement = (el: SceneElement | null, isDraft: boolean) => {
    const type = el ? el.type : (activeTab as Mode);
    // If draft, use form state. If element, use element state.
    const p = el ? el.params : { 
        x, y, radius, width, height, x2, y2, rx, ry, startAngle, endAngle, 
        functionStr, xMin, xMax, samples, showAxis, 
        textContent, shapeType, coordName, title: plotTitle 
    };
    const s = el ? el.style : { color, fill, lineWidth, opacity, lineStyle, arrowHead };

    const stroke = s.color;
    const fillVal = s.fill || 'none';
    const op = isDraft ? 0.5 : (s.opacity / 100);
    const sw = s.lineWidth * 2; // SVG scale
    let dashArray = 'none';
    if (s.lineStyle === 'dashed') dashArray = '10, 5';
    if (s.lineStyle === 'dotted') dashArray = '2, 4';
    
    // Highlight selection
    const isSelected = el && selectedId === el.id;
    const selectionFilter = isSelected ? "drop-shadow(0px 0px 4px rgba(51, 154, 240, 0.8))" : undefined;

    const commonProps = {
        stroke, strokeWidth: sw, fill: fillVal, opacity: op, strokeDasharray: dashArray,
        style: { filter: selectionFilter, cursor: 'grab' },
        onMouseDown: (e: React.MouseEvent<SVGElement>) => el && handleSvgMouseDown(e, el.id)
    };

    if (type === 'shapes') {
        const st = p.shapeType;
        if (st === 'circle') return <circle cx={toSvgX(p.x)} cy={toSvgY(p.y)} r={p.radius * 20} {...commonProps} />;
        if (st === 'ellipse') return <ellipse cx={toSvgX(p.x)} cy={toSvgY(p.y)} rx={p.rx * 20} ry={p.ry * 20} {...commonProps} />;
        if (st === 'rectangle') return <rect x={toSvgX(p.x)} y={toSvgY(p.y + p.height)} width={p.width * 20} height={p.height * 20} {...commonProps} />;
        if (st === 'line') return <line x1={toSvgX(p.x)} y1={toSvgY(p.y)} x2={toSvgX(p.x2)} y2={toSvgY(p.y2)} {...commonProps} />;
    } else if (type === 'text') {
        return <text x={toSvgX(p.x)} y={toSvgY(p.y)} fill={s.color} fontSize={16} textAnchor="middle" alignmentBaseline="middle" opacity={op} style={{ cursor: 'grab', userSelect: 'none', filter: selectionFilter }} onMouseDown={(e) => el && handleSvgMouseDown(e, el.id)}>{p.textContent}</text>;
    } else if (type === 'plots') {
        // ... (Plot rendering logic similar to before, maybe improved)
        try {
            const points = [];
            const min = p.xMin ?? -5;
            const max = p.xMax ?? 5;
            const step = (max - min) / 40; 
            for (let i = min; i <= max; i += step) {
                const jsFunc = p.functionStr.replace(/sin/g, 'Math.sin').replace(/cos/g, 'Math.cos').replace(/\^/g, '**').replace(/exp/g, 'Math.exp'); 
                // eslint-disable-next-line no-new-func
                const f = new Function('x', `return ${jsFunc}`);
                const val = f(i);
                if (!isNaN(val) && Math.abs(val) < 15) points.push(`${toSvgX(i)},${toSvgY(val)}`);
            }
            // Add a title text for preview if present
            return (
                <g onClick={(e) => el && handleSelect(el.id, e)}>
                    <polyline points={points.join(' ')} fill="none" stroke={stroke} strokeWidth={sw} opacity={op} strokeDasharray={dashArray} />
                    {p.title && <text x="150" y="20" textAnchor="middle" fill="white" fontSize="12">{p.title}</text>}
                </g>
            );
        } catch { return null; }
    }
    return null;
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
      
      {/* --- COLUMN 1: CONTROLS --- */}
      <Box style={{ width: `${leftColWidth}%`, borderRight: '1px solid var(--mantine-color-dark-4)', display: 'flex', flexDirection: 'column', height: '100%', minWidth: 200 }}>
        <Tabs value={activeTab} onChange={(v) => v && setActiveTab(v)} variant="pills" radius="sm" p="xs">
            <Tabs.List grow>
                <Tabs.Tab value="shapes" leftSection={<FontAwesomeIcon icon={faSquare} style={{ width: 14, height: 14 }} />}>Shapes</Tabs.Tab>
                <Tabs.Tab value="text" leftSection={<FontAwesomeIcon icon={faFont} style={{ width: 14, height: 14 }} />}>Text</Tabs.Tab>
                <Tabs.Tab value="plots" leftSection={<FontAwesomeIcon icon={faChartLine} style={{ width: 14, height: 14 }} />}>Plots</Tabs.Tab>
                <Tabs.Tab value="templates" leftSection={<FontAwesomeIcon icon={faColumns} style={{ width: 14, height: 14 }} />}>Templates</Tabs.Tab>
            </Tabs.List>
        </Tabs>

        <ScrollArea style={{ flex: 1 }} type="auto" offsetScrollbars>
            {activeTab === 'templates' ? (
                 <Stack gap="xs" p="xs">
                    {TIKZ_TEMPLATES.map((tmpl, idx) => (
                        <Paper key={idx} p="xs" withBorder bg="dark.7" style={{ cursor: 'pointer', transition: '0.2s' }} onClick={() => { shouldSkipUpdate.current = true; setCodeValue(tmpl.code); }}>
                            <Group justify="space-between" mb={4}>
                                <Text size="sm" fw={700}>{tmpl.label}</Text>
                                <FontAwesomeIcon icon={faArrowRight} style={{ width: 14, height: 14, color: "gray" }} />
                            </Group>
                            <Text size="xs" c="dimmed" lineClamp={2}>{tmpl.description}</Text>
                        </Paper>
                    ))}
                 </Stack>
            ) : (
                <Stack gap="xs" p="xs">
                    
                    {selectedId && (
                        <Paper p="xs" bg="blue.9" style={{ border: '1px solid var(--mantine-color-blue-7)' }}>
                            <Group justify="space-between">
                                <Text size="xs" fw={700} c="white">EDITING SELECTION</Text>
                                <ActionIcon color="red" size="xs" onClick={() => handleRemoveElement(selectedId)}><FontAwesomeIcon icon={faTrash} /></ActionIcon>
                            </Group>
                        </Paper>
                    )}

                    {activeTab !== 'coordinates' && (
                    <>
                        <Divider label="Styling" labelPosition="center" color="dark.4" />
                        <Group grow>
                            <ColorInput label="Color" value={color} onChange={(v) => updateStateAndElement(setColor, 'color', v, true)} size="xs" />
                            <Select label="Style" value={lineStyle} onChange={(v) => updateStateAndElement(setLineStyle, 'lineStyle', v, true)} data={['solid', 'dashed', 'dotted']} size="xs" />
                        </Group>
                        <Group grow>
                            <NumberInput label="Width (mm)" value={lineWidth} onChange={(v) => updateStateAndElement(setLineWidth, 'lineWidth', Number(v), true)} step={0.1} min={0} size="xs" />
                            <Select label="Arrow" value={arrowHead} onChange={(v) => updateStateAndElement(setArrowHead, 'arrowHead', v, true)} data={['none', '->', '<-', '<->']} size="xs" />
                        </Group>
                        <Stack gap={0}>
                            <Text size="xs" fw={500}>Opacity</Text>
                            <Slider value={opacity} onChange={(v) => updateStateAndElement(setOpacity, 'opacity', v, true)} size="sm" />
                        </Stack>
                        {activeTab === 'shapes' && <ColorInput label="Fill" value={fill} onChange={(v) => updateStateAndElement(setFill, 'fill', v, true)} size="xs" placeholder="None" />}
                    </>
                    )}

                    <Divider label="Parameters" labelPosition="center" color="dark.4" />

                    {activeTab === 'shapes' && (
                        <>
                        <Select label="Type" value={shapeType} onChange={(v) => updateStateAndElement(setShapeType, 'shapeType', v)} data={['circle', 'ellipse', 'arc', 'rectangle', 'line', 'grid']} size="xs" />
                        <Group grow>
                            <NumberInput label="X" value={x} onChange={(v) => updateStateAndElement(setX, 'x', Number(v))} size="xs" />
                            <NumberInput label="Y" value={y} onChange={(v) => updateStateAndElement(setY, 'y', Number(v))} size="xs" />
                        </Group>
                        {shapeType === 'circle' && <NumberInput label="Radius" value={radius} onChange={(v) => updateStateAndElement(setRadius, 'radius', Number(v))} size="xs" />}
                        {shapeType === 'rectangle' && <Group grow><NumberInput label="W" value={width} onChange={(v) => updateStateAndElement(setWidth, 'width', Number(v))} size="xs" /><NumberInput label="H" value={height} onChange={(v) => updateStateAndElement(setHeight, 'height', Number(v))} size="xs" /></Group>}
                        {(shapeType === 'line' || shapeType === 'grid') && <Group grow><NumberInput label="End X" value={x2} onChange={(v) => updateStateAndElement(setX2, 'x2', Number(v))} size="xs" /><NumberInput label="End Y" value={y2} onChange={(v) => updateStateAndElement(setY2, 'y2', Number(v))} size="xs" /></Group>}
                        </>
                    )}
                    
                    {activeTab === 'text' && (
                        <>
                        <TextInput label="Label" value={textContent} onChange={(e) => updateStateAndElement(setTextContent, 'textContent', e.currentTarget.value)} size="xs" />
                        <Group grow>
                            <NumberInput label="X" value={x} onChange={(v) => updateStateAndElement(setX, 'x', Number(v))} size="xs" />
                            <NumberInput label="Y" value={y} onChange={(v) => updateStateAndElement(setY, 'y', Number(v))} size="xs" />
                        </Group>
                        </>
                    )}

                    {activeTab === 'plots' && (
                        <>
                        <TextInput label="f(x)" value={functionStr} onChange={(e) => updateStateAndElement(setFunctionStr, 'functionStr', e.currentTarget.value)} size="xs" />
                        <Group grow>
                            <NumberInput label="Min" value={xMin} onChange={(v) => updateStateAndElement(setXMin, 'xMin', Number(v))} size="xs" />
                            <NumberInput label="Max" value={xMax} onChange={(v) => updateStateAndElement(setXMax, 'xMax', Number(v))} size="xs" />
                        </Group>
                        <TextInput label="Title" value={plotTitle} onChange={(e) => updateStateAndElement(setPlotTitle, 'title', e.currentTarget.value)} size="xs" />
                        <Group grow>
                             <TextInput label="X Label" value={xLabel} onChange={(e) => updateStateAndElement(setXLabel, 'xlabel', e.currentTarget.value)} size="xs" />
                             <TextInput label="Y Label" value={yLabel} onChange={(e) => updateStateAndElement(setYLabel, 'ylabel', e.currentTarget.value)} size="xs" />
                        </Group>
                        <Select label="Grid" value={grid} onChange={(v) => updateStateAndElement(setGrid, 'grid', v)} data={['none', 'major', 'minor', 'both']} size="xs" />
                        </>
                    )}
                </Stack>
            )}
        </ScrollArea>

        {activeTab !== 'templates' && !selectedId && (
            <Box p="xs" style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}>
                <Button fullWidth leftSection={<FontAwesomeIcon icon={faPlus} style={{ width: 16, height: 16 }} />} onClick={handleAddElement} color="teal" variant="light">
                    Add to Scene
                </Button>
            </Box>
        )}
      </Box>

      {/* --- HORIZONTAL RESIZER --- */}
      <Box 
        onMouseDown={startResizingHoriz}
        style={{ 
            width: 6, 
            backgroundColor: isResizingHoriz ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-dark-7)', 
            cursor: 'col-resize', 
            flexShrink: 0,
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center'
        }}
      >
        <FontAwesomeIcon icon={faGripLinesVertical} style={{ width: 12, height: 12, opacity: 0.5, color: "gray" }} />
      </Box>

      {/* --- COLUMN 2: PREVIEW & CODE --- */}
      <Box 
        ref={rightColRef}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--mantine-color-dark-8)', minWidth: 200 }}
      >
        <Box h={topSectionHeight} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box style={{ flex: 1, position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
                <Box style={{ position: 'absolute', top: 8, left: 8, zIndex: 10 }}>
                    <Badge color={selectedId ? "blue" : "gray"} variant="filled">{selectedId ? 'Editing Mode' : 'Draft Mode'}</Badge>
                </Box>
                <svg width="100%" height="100%" viewBox="0 0 300 300" onClick={handlePreviewClick} onMouseMove={handleSvgMouseMove} style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}>
                    <defs>
                        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#333" strokeWidth="0.5"/>
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                    <line x1="0" y1="150" x2="300" y2="150" stroke="#555" strokeWidth="1" pointerEvents="none" />
                    <line x1="150" y1="0" x2="150" y2="300" stroke="#555" strokeWidth="1" pointerEvents="none" />
                    {elements.map(el => (<g key={el.id}>{renderSvgElement(el, false)}</g>))}
                    {activeTab !== 'templates' && !selectedId && renderSvgElement(null, true)}
                </svg>
            </Box>
            {activeTab !== 'templates' && elements.length > 0 && (
                <Box h={80} style={{ flexShrink: 0, borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
                    <Group justify="space-between" px="xs" py={2} bg="dark.9" h={24}>
                        <Text size="xs" fw={700}>Layers</Text>
                        <FontAwesomeIcon icon={faLayerGroup} style={{ width: 12, height: 12 }} />
                    </Group>
                    <ScrollArea h={56}>
                        <Stack gap={2} p={2}>
                            {elements.map((el, i) => (
                                <Group 
                                    key={el.id} 
                                    justify="space-between" 
                                    bg={selectedId === el.id ? "blue.8" : "dark.7"} 
                                    px="xs" py={2} 
                                    style={{borderRadius: 4, cursor: 'pointer', border: selectedId === el.id ? '1px solid white' : 'none'}}
                                    onClick={() => handleSelect(el.id)}
                                >
                                    <Text size="xs">{i+1}. {el.type} {el.type==='shapes'?`(${el.params.shapeType})`:''}</Text>
                                    <ActionIcon size="xs" color="red" variant="subtle" onClick={(e) => handleRemoveElement(el.id, e)}><FontAwesomeIcon icon={faTrash} style={{ width: 10, height: 10 }} /></ActionIcon>
                                </Group>
                            ))}
                        </Stack>
                    </ScrollArea>
                </Box>
            )}
        </Box>

        <Box 
            onMouseDown={startResizingVert}
            style={{ 
                height: 6, 
                backgroundColor: isResizingVert ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-dark-6)', 
                cursor: 'row-resize', 
                flexShrink: 0,
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
            }}
        >
            <FontAwesomeIcon icon={faGripLines} style={{ width: 12, height: 12, opacity: 0.5, color: "gray" }} />
        </Box>

        <Box className="tikz-code-editor" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
             {/* Toolbar kept detailed */}
            <Group gap={4} p={4} bg="dark.7" style={{ borderBottom: '1px solid var(--mantine-color-dark-6)', flexShrink: 0 }}>
                <Menu shadow="md" width={200}>
                    <Menu.Target><Button size="compact-xs" variant="default" rightSection={<FontAwesomeIcon icon={faChevronDown} style={{ width: 10, height: 10 }} />}>Commands</Button></Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Label>Drawing</Menu.Label>
                        <Menu.Item leftSection={<FontAwesomeIcon icon={faPencilAlt} style={{ width: 14, height: 14 }} />} onClick={() => insertSnippet('\\draw (0,0) -- (1,1);')}>Line</Menu.Item>
                        <Menu.Item leftSection={<FontAwesomeIcon icon={faSquare} style={{ width: 14, height: 14 }} />} onClick={() => insertSnippet('\\draw (0,0) rectangle (2,2);')}>Rectangle</Menu.Item>
                        <Menu.Item leftSection={<FontAwesomeIcon icon={faFont} style={{ width: 14, height: 14 }} />} onClick={() => insertSnippet('\\node at (0,0) {Label};')}>Node</Menu.Item>
                    </Menu.Dropdown>
                </Menu>
                <Divider orientation="vertical" />
                 <Popover position="bottom" withArrow shadow="md">
                    <Popover.Target><ActionIcon size="sm" variant="default" aria-label="Color"><FontAwesomeIcon icon={faPalette} style={{ width: 14, height: 14, color: quickColor }} /></ActionIcon></Popover.Target>
                    <Popover.Dropdown>
                        <Stack gap="xs">
                            <Text size="xs" fw={700}>Select Color</Text>
                            <ColorPicker size="xs" value={quickColor} onChange={setQuickColor} format="hex" />
                            <Button size="xs" fullWidth onClick={() => insertSnippet(quickColor.replace('#', ''))}>Insert Hex</Button>
                        </Stack>
                    </Popover.Dropdown>
                </Popover>
            </Group>

            <Textarea 
                className="tikz-code-editor"
                value={codeValue}
                onChange={handleCodeChange}
                style={{ flex: 1 }} 
                styles={{ 
                    root: { display: 'flex', flexDirection: 'column', flex: 1 }, 
                    wrapper: { display: 'flex', flexDirection: 'column', flex: 1 }, 
                    input: { 
                        fontFamily: 'monospace', 
                        fontSize: 12, 
                        backgroundColor: 'var(--mantine-color-dark-9)',
                        color: '#d4d4d4',
                        border: 0,
                        borderRadius: 0,
                        height: '100%'
                    } 
                }}
                placeholder="\begin{tikzpicture}..."
            />
            
            <Group justify="space-between" p="xs" bg="dark.7" style={{ borderTop: '1px solid var(--mantine-color-dark-6)', flexShrink: 0 }}>
                <Text size="xs" c="dimmed">Characters: {codeValue.length}</Text>
                <Button size="compact-xs" leftSection={<FontAwesomeIcon icon={faPlus} style={{ width: 12, height: 12 }} />} onClick={() => onInsert(codeValue)}>
                    Insert Code
                </Button>
            </Group>
        </Box>
      </Box>
    </div>
  );
}
