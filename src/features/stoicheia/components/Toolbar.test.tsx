import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RECENT_TOOLS_STORAGE_KEY, Toolbar, toolbarGroups } from './Toolbar';
import { useEditorStore, type ToolType } from '../store';
import { geometryToolIcons } from '../icons/geometry';
import storeSource from '../store.ts?raw';

const getToolTypeIds = () => {
  const toolTypeMatch = storeSource.match(/export type ToolType = ([\s\S]*?);/);
  expect(toolTypeMatch).not.toBeNull();
  return Array.from(toolTypeMatch![1].matchAll(/"([^"]+)"/g), match => match[1])
    .filter(tool => tool !== 'cursor' && tool !== 'pan')
    .sort();
};

describe('Toolbar groups', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
        clear: () => values.clear(),
      },
    });
    window.localStorage.removeItem(RECENT_TOOLS_STORAGE_KEY);
    useEditorStore.setState({
      activeTool: 'cursor',
      settings: { ...useEditorStore.getState().settings, language: 'en' },
      selectedPoints: [],
      source: `\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\tkzDefPoint(2,0){B}\n\\tkzDefPoint(8,0){C}\n\\tkzDefPoint(9,0){D}\n\\tkzDrawCircle(A,B)\n\\tkzDrawCircle(C,D)\n\\end{tikzpicture}`,
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
        { type: 'Point', name: 'C', x: 8, y: 0 },
        { type: 'Point', name: 'D', x: 9, y: 0 },
        { type: 'Circle', center: 'A', radius_point: 'B' },
        { type: 'Circle', center: 'C', radius_point: 'D' },
      ],
    });
  });

  it('keeps every grouped tool id unique', async () => {
    const ids = toolbarGroups.flatMap(group => group.tools.map(tool => tool.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers every non-navigation ToolType in the toolbar', async () => {
    const groupedIds = toolbarGroups.flatMap(group => group.tools.map(tool => tool.id)).sort();
    expect(groupedIds).toEqual(getToolTypeIds());
  });

  it('keeps sectioned groups aligned with their flat tool list', async () => {
    for (const group of toolbarGroups.filter(group => group.sections?.length)) {
      expect(group.tools.map(tool => tool.id)).toEqual(group.sections!.flatMap(section => section.tools.map(tool => tool.id)));
    }
  });

  it('uses custom geometry icons when they are registered', async () => {
    const toolsById = new Map(toolbarGroups.flatMap(group => group.tools.map(tool => [tool.id, tool])));

    for (const [toolId, Icon] of Object.entries(geometryToolIcons)) {
      expect(toolsById.get(toolId as ToolType)?.icon).toEqual(expect.objectContaining({ type: Icon }));
    }
  });

  it('has a custom geometry icon for every toolbar tool', async () => {
    for (const tool of toolbarGroups.flatMap(group => group.tools)) {
      expect(geometryToolIcons[tool.id], tool.id).toBeDefined();
    }
  });

  it('opens a group and selects a tool variant', async () => {
    render(<Toolbar />);

    fireEvent.click(screen.getByRole('button', { name: 'Points tools' }));
    expect(screen.getByRole('menu', { name: 'Points' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitemradio', { name: /Polar point/ }));
    expect(useEditorStore.getState().activeTool).toBe('add_point_polar');
    expect(screen.queryByRole('menu', { name: 'Points' })).not.toBeInTheDocument();
  });

  it('localizes toolbar groups and tool labels in Greek', async () => {
    useEditorStore.setState({ settings: { ...useEditorStore.getState().settings, language: 'el' } });
    render(<Toolbar />);

    fireEvent.click(screen.getByRole('button', { name: 'Εργαλεία: Σημεία' }));

    expect(screen.getByRole('menu', { name: 'Σημεία' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Καρτεσιανό σημείο/ })).toBeInTheDocument();
  });

  it('localizes toolbar groups and tool labels in French', async () => {
    useEditorStore.setState({ settings: { ...useEditorStore.getState().settings, language: 'fr' } });
    render(<Toolbar />);

    fireEvent.click(screen.getByRole('button', { name: 'Outils : Points' }));

    expect(screen.getByRole('menu', { name: 'Points' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Point cartésien/ })).toBeInTheDocument();
  });

  it('localizes toolbar groups and tool labels in Italian', async () => {
    useEditorStore.setState({ settings: { ...useEditorStore.getState().settings, language: 'it' } });
    render(<Toolbar />);

    fireEvent.click(screen.getByRole('button', { name: 'Strumenti: Punti' }));

    expect(screen.getByRole('menu', { name: 'Punti' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Punto cartesiano/ })).toBeInTheDocument();
  });

  it('localizes toolbar groups and tool labels in German', async () => {
    useEditorStore.setState({ settings: { ...useEditorStore.getState().settings, language: 'de' } });
    render(<Toolbar />);

    fireEvent.click(screen.getByRole('button', { name: 'Werkzeuge: Punkte' }));

    expect(screen.getByRole('menu', { name: 'Punkte' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Kartesischer Punkt/ })).toBeInTheDocument();
  });

  it('localizes toolbar groups and tool labels in Spanish', async () => {
    useEditorStore.setState({ settings: { ...useEditorStore.getState().settings, language: 'es' } });
    render(<Toolbar />);

    fireEvent.click(screen.getByRole('button', { name: 'Herramientas: Puntos' }));

    expect(screen.getByRole('menu', { name: 'Puntos' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Punto cartesiano/ })).toBeInTheDocument();
  });

  it('localizes toolbar groups and tool labels in Russian', async () => {
    useEditorStore.setState({ settings: { ...useEditorStore.getState().settings, language: 'ru' } });
    render(<Toolbar />);

    fireEvent.click(screen.getByRole('button', { name: 'Инструменты: Точки' }));

    expect(screen.getByRole('menu', { name: 'Точки' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Декартова точка/ })).toBeInTheDocument();
  });

  it('localizes toolbar groups and tool labels in Portuguese', async () => {
    useEditorStore.setState({ settings: { ...useEditorStore.getState().settings, language: 'pt' } });
    render(<Toolbar />);

    fireEvent.click(screen.getByRole('button', { name: 'Ferramentas: Pontos' }));

    expect(screen.getByRole('menu', { name: 'Pontos' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Ponto cartesiano/ })).toBeInTheDocument();
  });

  it('localizes toolbar groups and tool labels in Polish', async () => {
    useEditorStore.setState({ settings: { ...useEditorStore.getState().settings, language: 'pl' } });
    render(<Toolbar />);

    fireEvent.click(screen.getByRole('button', { name: 'Narzędzia: Punkty' }));

    expect(screen.getByRole('menu', { name: 'Punkty' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Punkt kartezjański/ })).toBeInTheDocument();
  });

  it('localizes toolbar groups and tool labels in Turkish', async () => {
    useEditorStore.setState({ settings: { ...useEditorStore.getState().settings, language: 'tr' } });
    render(<Toolbar />);

    fireEvent.click(screen.getByRole('button', { name: 'Araçlar: Noktalar' }));

    expect(screen.getByRole('menu', { name: 'Noktalar' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Kartezyen nokta/ })).toBeInTheDocument();
  });

  it('localizes toolbar groups and tool labels in Dutch', async () => {
    useEditorStore.setState({ settings: { ...useEditorStore.getState().settings, language: 'nl' } });
    render(<Toolbar />);

    fireEvent.click(screen.getByRole('button', { name: 'Gereedschap: Punten' }));

    expect(screen.getByRole('menu', { name: 'Punten' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Cartesiaans punt/ })).toBeInTheDocument();
  });

  it('localizes toolbar groups and tool labels in Simplified Chinese', async () => {
    useEditorStore.setState({ settings: { ...useEditorStore.getState().settings, language: 'zh' } });
    render(<Toolbar />);

    fireEvent.click(screen.getByRole('button', { name: '工具：点' }));

    expect(screen.getByRole('menu', { name: '点' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /笛卡尔点/ })).toBeInTheDocument();
  });

  it('localizes toolbar groups and tool labels in Japanese', async () => {
    useEditorStore.setState({ settings: { ...useEditorStore.getState().settings, language: 'ja' } });
    render(<Toolbar />);

    fireEvent.click(screen.getByRole('button', { name: 'ツール: 点' }));

    expect(screen.getByRole('menu', { name: '点' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /直交座標点/ })).toBeInTheDocument();
  });

  it('localizes toolbar groups and tool labels in Arabic', async () => {
    useEditorStore.setState({ settings: { ...useEditorStore.getState().settings, language: 'ar' } });
    render(<Toolbar />);

    fireEvent.click(screen.getByRole('button', { name: 'الأدوات: النقاط' }));

    expect(screen.getByRole('menu', { name: 'النقاط' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /نقطة ديكارتية/ })).toBeInTheDocument();
  });

  it('shows a persisted recent tools group after selecting tools', async () => {
    render(<Toolbar />);

    fireEvent.click(screen.getByRole('button', { name: 'Lines & segments tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Segment/ }));

    expect(JSON.parse(window.localStorage.getItem(RECENT_TOOLS_STORAGE_KEY) ?? '[]')).toEqual(['add_segment']);
    expect(screen.getByRole('button', { name: 'Recent tools' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Recent tools' }));
    expect(screen.getByRole('menu', { name: 'Recent' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Segment/ }));
    expect(useEditorStore.getState().activeTool).toBe('add_segment');
  });

  it('keeps recent tools ordered, unique and capped', async () => {
    const selectFromGroup = (group: string, tool: RegExp) => {
      fireEvent.click(screen.getByRole('button', { name: `${group} tools` }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: tool }));
    };
    render(<Toolbar />);

    selectFromGroup('Points', /^Cartesian point/);
    selectFromGroup('Points', /^Polar point/);
    selectFromGroup('Lines & segments', /^Segment/);
    selectFromGroup('Lines & segments', /^Draw line/);
    selectFromGroup('Circles & curves', /^Circle/);
    selectFromGroup('Polygons', /^Polygon/);
    selectFromGroup('Fills', /^Fill circle/);
    selectFromGroup('Lines & segments', /^Segment/);

    expect(JSON.parse(window.localStorage.getItem(RECENT_TOOLS_STORAGE_KEY) ?? '[]')).toEqual([
      'add_segment',
      'fill_circle',
      'add_polygon',
      'add_circle',
      'add_line',
      'add_point_polar',
    ]);
  });

  it('loads valid recent tools from storage', async () => {
    window.localStorage.setItem(RECENT_TOOLS_STORAGE_KEY, JSON.stringify(['add_circle', 'missing_tool', 'add_segment']));
    render(<Toolbar />);

    fireEvent.click(screen.getByRole('button', { name: 'Recent tools' }));
    expect(screen.getByRole('menuitemradio', { name: /^Circle/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /^Segment/ })).toBeInTheDocument();
    expect(screen.queryByText('missing_tool')).not.toBeInTheDocument();
  });

  it('closes an open group with Escape', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Lines & segments tools' }));
    const menu = screen.getByRole('menu', { name: 'Lines & segments' });
    expect(menu).toBeInTheDocument();
    expect(menu).toHaveClass('fixed', 'overflow-y-auto');
    expect(menu.querySelector('.tool-menu-sections')).toBeInTheDocument();
    expect(menu.querySelector('.tool-menu-grid')).toHaveClass('grid', 'min-[520px]:grid-cols-2');
    expect(menu.style.maxHeight).not.toContain('vh');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: 'Lines & segments' })).not.toBeInTheDocument();
  });

  it('shows section headers inside larger tool groups', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Geometric constructions tools' }));

    expect(screen.getByText('Definition commands')).toBeInTheDocument();
    expect(screen.getByText('Perpendiculars & bisectors')).toBeInTheDocument();
    expect(screen.getByText('Construction aids')).toBeInTheDocument();
  });

  it('offers midpoint inside the points group', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Point constructions tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Midpoint/ }));

    expect(useEditorStore.getState().activeTool).toBe('add_midpoint');
  });

  it('creates a barycentric point through its weight dialog', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Point constructions tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Barycentric point/ }));

    expect(await screen.findByRole('dialog', { name: 'Barycentric point' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Weight for B' }), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create point' }));

    expect(useEditorStore.getState().source).toContain('\\tkzDefBarycentricPoint(A=1,B=2)');
    expect(useEditorStore.getState().activeTool).toBe('cursor');
  });

  it('creates a similitude center from the advanced group', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Point constructions tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Similitude center/ }));
    expect(await screen.findByRole('dialog', { name: 'Similitude center' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Create' }));

    expect(useEditorStore.getState().source).toContain('\\tkzDefSimilitudeCenter[ext](A,B)(C,D)');
  });

  it('creates harmonic and equidistant constructions through their dialogs', async () => {
    const { unmount } = render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Point constructions tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Harmonic division/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create' }));
    expect(useEditorStore.getState().source).toContain('\\tkzDefHarmonic[ext](A,B,C)');
    unmount();

    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Point constructions tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Equidistant points/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(useEditorStore.getState().source).toContain('\\tkzDefEquiPoints[from=C,dist=2](A,B)');
  });

  it('creates mid-arc, point-on-line and point-on-circle constructions', async () => {
    const openTool = async (name: RegExp) => {
      fireEvent.click(screen.getByRole('button', { name: 'Point constructions tools' }));
      fireEvent.click(screen.getByRole('menuitemradio', { name }));
      fireEvent.click(await screen.findByRole('button', { name: 'Create' }));
    };

    const first = render(<Toolbar />);
    await openTool(/Middle of arc/);
    expect(useEditorStore.getState().source).toContain('\\tkzDefMidArc(A,B,C)');
    first.unmount();

    const second = render(<Toolbar />);
    await openTool(/Point on line/);
    expect(useEditorStore.getState().source).toContain('\\tkzDefPointOnLine[pos=0.5](A,B)');
    second.unmount();

    render(<Toolbar />);
    await openTool(/Point on circle/);
    expect(useEditorStore.getState().source).toContain('\\tkzDefPointOnCircle[through=center A angle 30 point B]');
  });

  it('offers every triangle center option and creates the selected one', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Triangle constructions tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Triangle center/ }));

    const centerSelect = await screen.findByLabelText('Center type');
    expect(centerSelect.querySelectorAll('option')).toHaveLength(16);
    fireEvent.change(centerSelect, { target: { value: 'feuerbach' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create center' }));

    expect(useEditorStore.getState().source).toContain('\\tkzDefTriangleCenter[feuerbach](A,B,C)');
    expect(useEditorStore.getState().activeTool).toBe('cursor');
  });

  it('creates a point transformation from its own group', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Transformations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Transform point/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Transform point' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText('Transformation').querySelectorAll('option')).toHaveLength(10);
    await waitFor(() => expect(screen.getByLabelText('Vector from')).toHaveValue('B'));
    await waitFor(() => expect(screen.getByLabelText('Vector to')).toHaveValue('C'));
    fireEvent.click(screen.getByRole('button', { name: 'Create image' }));

    await waitFor(() => expect(useEditorStore.getState().source).toContain('\\tkzDefPointBy[translation=from B to C](A)'));
    expect(useEditorStore.getState().activeTool).toBe('cursor');
  });

  it('creates images for multiple selected points', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Transformations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Transform multiple points/ }));

    expect(await screen.findByRole('dialog', { name: 'Transform multiple points' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Transform point A')).toBeChecked());
    await waitFor(() => expect(screen.getByLabelText('Transform point B')).toBeChecked());
    fireEvent.click(screen.getByRole('button', { name: 'Create images' }));

    await waitFor(() => expect(useEditorStore.getState().source).toContain('\\tkzDefPointsBy[translation=from A to B](A,B){E,F}'));
    expect(useEditorStore.getState().activeTool).toBe('cursor');
  });

  it('inserts a shown transformation construction from its dialog', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Transformations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Show transformation/ }));

    expect(await screen.findByRole('dialog', { name: 'Show transformation' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Show transformation mode'), { target: { value: 'projection' } });
    fireEvent.change(screen.getByLabelText('Show transformation gap'), { target: { value: '-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Insert construction' }));

    expect(useEditorStore.getState().source).toContain('\\tkzShowTransformation[projection=onto B--C,gap=-2](A)');
    expect(useEditorStore.getState().activeTool).toBe('cursor');
  });

  it('creates a point from a vector condition', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Point constructions tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Vector-defined point/ }));
    expect(await screen.findByRole('dialog', { name: 'Vector-defined point' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Multiplier K'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create point' }));
    expect(useEditorStore.getState().source).toContain('\\tkzDefPointWith[orthogonal,K=2](A,B)');
  });

  it('inserts vector component macros', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Transformations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Vector coordinates/ }));
    expect(await screen.findByRole('dialog', { name: 'Get vector coordinates' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Macro prefix'), { target: { value: 'Delta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Insert command' }));
    expect(useEditorStore.getState().source).toContain('\\tkzGetVectxy(A,B){Delta}');
  });

  it('offers every straight-line definition and creates a mediator', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Geometric constructions tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Define straight line/ }));

    expect(await screen.findByRole('dialog', { name: 'Define straight line' })).toBeInTheDocument();
    expect(screen.getByLabelText('Line type').querySelectorAll('option')).toHaveLength(11);
    const createLine = screen.getByRole('button', { name: 'Create line' });
    await waitFor(() => expect(createLine).toBeEnabled());
    fireEvent.click(createLine);

    await waitFor(() => expect(useEditorStore.getState().source).toContain('\\tkzDefLine[mediator](A,B)'));
    expect(useEditorStore.getState().source).toContain('\\tkzGetPoints{E}{F}');
  });

  it('activates direct draw-line tools without opening a dialog', async () => {
    const first = render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Lines & segments tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Draw line/ }));
    expect(useEditorStore.getState().activeTool).toBe('add_line');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    first.unmount();

    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Lines & segments tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Draw multiple lines/ }));
    expect(useEditorStore.getState().activeTool).toBe('add_lines');
  });

  it('activates the protractor tool without opening a dialog', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Geometric constructions tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Protractor/ }));

    expect(useEditorStore.getState().activeTool).toBe('add_protractor');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('creates a duplicated segment from its dialog', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Geometric constructions tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Duplicate segment/ }));

    expect(await screen.findByRole('dialog', { name: 'Duplicate segment' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Ray through'), { target: { value: 'B' } });
    fireEvent.change(screen.getByLabelText('Segment start'), { target: { value: 'C' } });
    fireEvent.change(screen.getByLabelText('Segment end'), { target: { value: 'D' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create point' }));

    expect(useEditorStore.getState().source).toContain('\\tkzDuplicateSegment(A,B)(C,D)');
    expect(useEditorStore.getState().source).toContain('\\tkzGetPoint{E}');
    expect(useEditorStore.getState().activeTool).toBe('cursor');
  });

  it('creates a radical axis from its dialog', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Intersections & relations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Radical axis/ }));

    expect(await screen.findByRole('dialog', { name: 'Radical axis' })).toBeInTheDocument();
    const createAxis = screen.getByRole('button', { name: 'Create axis' });
    await waitFor(() => expect(createAxis).toBeEnabled());
    fireEvent.click(createAxis);

    await waitFor(() => expect(useEditorStore.getState().source).toContain('\\tkzDefRadicalAxis(A,B)(C,D)'));
    expect(useEditorStore.getState().source).toContain('\\tkzGetPoints{E}{F}');
    expect(useEditorStore.getState().activeTool).toBe('cursor');
  });

  it('activates direct segment tools without opening a dialog', async () => {
    const first = render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Lines & segments tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Segment/ }));
    expect(useEditorStore.getState().activeTool).toBe('add_segment');
    first.unmount();

    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Lines & segments tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Multiple segments/ }));
    expect(useEditorStore.getState().activeTool).toBe('add_segments');
  });

  it('offers direct polyseg, circles and semicircle tools', async () => {
    const tools: Array<[RegExp, string]> = [
      [/Polygonal chain/, 'add_polyseg'],
      [/Multiple circles/, 'add_circles'],
      [/^Semicircle/, 'add_semicircle'],
      [/Multiple semicircles/, 'add_semicircles'],
      [/^Sector/, 'add_sector'],
    ];
    for (const [name, expected] of tools) {
      const view = render(<Toolbar />);
      fireEvent.click(screen.getByRole('button', { name: expected === 'add_polyseg' ? 'Lines & segments tools' : 'Circles & curves tools' }));
      fireEvent.click(screen.getByRole('menuitemradio', { name }));
      expect(useEditorStore.getState().activeTool).toBe(expected);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it('creates an ellipse through its required numeric-parameter dialog', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Circles & curves tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Ellipse/ }));
    expect(await screen.findByRole('dialog', { name: 'Draw ellipse' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('New ellipse angle'), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Draw ellipse' }));
    expect(useEditorStore.getState().source).toContain('\\tkzDrawEllipse(A,4,2,45)');
  });

  it('offers all fill tools without opening a dialog', async () => {
    for (const [name, tool] of [['Fill circle', 'fill_circle'], ['Fill polygon', 'fill_polygon'], ['Fill sector', 'fill_sector'], ['Fill angle', 'fill_angle'], ['Fill multiple angles', 'fill_angles']] as const) {
      const view = render(<Toolbar />);
      fireEvent.click(screen.getByRole('button', { name: 'Fills tools' }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: new RegExp(`^${name}`) }));
      expect(useEditorStore.getState().activeTool).toBe(tool);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it('inserts canvas and clipping commands immediately', async () => {
    const expectations = [
      ['Initialize bounds', '\\tkzInit[xmin=-5,xmax=5,ymin=-5,ymax=5]'],
      ['Clip to initialized bounds', '\\tkzClip'],
      ['Show bounding box', '\\tkzShowBB'],
      ['Clip to bounding box', '\\tkzClipBB'],
    ] as const;
    for (const [name, command] of expectations) {
      const view = render(<Toolbar />);
      fireEvent.click(screen.getByRole('button', { name: 'Canvas & clipping tools' }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: new RegExp(`^${name}`) }));
      expect(useEditorStore.getState().source).toContain(command);
      expect(useEditorStore.getState().activeTool).toBe('cursor');
      view.unmount();
    }
  });

  it('offers every triangle family and creates a swapped two-angle triangle', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Triangle constructions tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Define triangle/ }));

    expect(await screen.findByRole('dialog', { name: 'Define triangle' })).toBeInTheDocument();
    const type = screen.getByLabelText('Triangle type');
    expect(type.querySelectorAll('option')).toHaveLength(13);
    fireEvent.change(type, { target: { value: 'two_angles' } });
    fireEvent.change(screen.getByLabelText('Angle at A'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Angle at B'), { target: { value: '60' } });
    fireEvent.click(screen.getByLabelText(/Reflect the new vertex/));
    fireEvent.click(screen.getByRole('button', { name: 'Create triangle' }));

    expect(useEditorStore.getState().source).toContain('\\tkzDefTriangle[two angles=40 and 60,swap](A,B)');
  });

  it('offers every associated-triangle mode and applies the name option', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Triangle constructions tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Associated triangle/ }));

    expect(await screen.findByRole('dialog', { name: 'Associated triangle' })).toBeInTheDocument();
    const type = screen.getByLabelText('Associated triangle type');
    expect(type.querySelectorAll('option')).toHaveLength(14);
    fireEvent.change(type, { target: { value: 'feuerbach' } });
    fireEvent.click(screen.getByLabelText('Use the `name` option'));
    fireEvent.change(screen.getByLabelText('Vertex prefix'), { target: { value: 'F' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create associated triangle' }));

    expect(useEditorStore.getState().source).toContain('\\tkzDefSpcTriangle[feuerbach,name=F](A,B,C){a,b,c}');
    expect(useEditorStore.getState().activeTool).toBe('cursor');
  });

  it('creates a permutation and all three quadrilateral constructions', async () => {
    const openAndCreate = async (group: string, tool: RegExp, action: string, expected: string) => {
      const view = render(<Toolbar />);
      fireEvent.click(screen.getByRole('button', { name: `${group} tools` }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: tool }));
      expect(await screen.findByRole('dialog', { name: tool })).toBeInTheDocument();
      fireEvent.click(await screen.findByRole('button', { name: action }));
      await waitFor(() => expect(useEditorStore.getState().source).toContain(expected));
      view.unmount();
    };
    await openAndCreate('Triangle constructions', /Permute triangle/, 'Permute triangle', '\\tkzPermute(A,B,C)');
    await openAndCreate('Polygons', /Define square/, 'Create square', '\\tkzDefSquare(A,B)');
    await openAndCreate('Polygons', /Define rectangle/, 'Create rectangle', '\\tkzDefRectangle(A,B)');
    await openAndCreate('Polygons', /Define parallelogram/, 'Create parallelogram', '\\tkzDefParallelogram(A,B,C)');

    const source = useEditorStore.getState().source;
    expect(source).toContain('\\tkzPermute(A,B,C)');
    expect(source).toContain('\\tkzDefSquare(A,B)');
    expect(source).toContain('\\tkzDefRectangle(A,B)');
    expect(source).toContain('\\tkzDefParallelogram(A,B,C)');
  });

  it('creates a golden rectangle and configures every regular-polygon option', async () => {
    const goldenView = render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Polygons tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Golden rectangle/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create golden rectangle' }));
    goldenView.unmount();

    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Polygons tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Regular polygon/ }));
    fireEvent.change(await screen.findByLabelText('Regular polygon definition'), { target: { value: 'side' } });
    fireEvent.change(screen.getByLabelText('Number of sides'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Vertex name prefix'), { target: { value: 'R' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create regular polygon' }));

    expect(useEditorStore.getState().source).toContain('\\tkzDefGoldenRectangle(A,B)');
    expect(useEditorStore.getState().source).toContain('\\tkzDefRegPolygon[side,sides=7,name=R](A,B)');
  });

  it('offers every tkzDefCircle mode and creates an orthogonal circle', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Geometric constructions tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Define circle/ }));
    const definition = await screen.findByLabelText('Circle definition');
    expect(definition.querySelectorAll('option')).toHaveLength(11);
    fireEvent.change(definition, { target: { value: 'orthogonal_through' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create circle' }));
    expect(useEditorStore.getState().source).toContain('\\tkzDefCircle[orthogonal through=C and D](A,B)');
    expect(useEditorStore.getState().activeTool).toBe('cursor');
  });

  it('creates projected excenters with configurable names', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Triangle constructions tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Project excenters/ }));
    fireEvent.change(await screen.findByLabelText('Projection prefix 1'), { target: { value: 'P' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create projections' }));
    expect(useEditorStore.getState().source).toContain('\\tkzDefProjExcenter[name=J](A,B,C)(a,b,c){P,Y,Z}');
  });

  it('offers all documented tkzDefCircleBy transformations', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Transformations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Transform circle/ }));
    const transformation = await screen.findByLabelText('Circle transformation');
    expect(transformation.querySelectorAll('option')).toHaveLength(7);
    fireEvent.change(transformation, { target: { value: 'homothety' } });
    fireEvent.change(screen.getByLabelText('Circle homothety ratio'), { target: { value: '0.75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Transform circle' }));
    expect(useEditorStore.getState().source).toContain('\\tkzDefCircleBy[homothety=center C ratio 0.75](A,B)');
  });

  it('configures tkzInterLC and inserts tkzTestInterLC', async () => {
    const intersectionView = render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Intersections & relations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Line–circle intersection/ }));
    expect((await screen.findByLabelText('Line-circle mode')).querySelectorAll('option')).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('Line-circle mode'), { target: { value: 'R' } });
    fireEvent.change(screen.getByLabelText('Intersection ordering'), { target: { value: 'near' } });
    fireEvent.change(screen.getByLabelText('Intersection circle radius'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create intersections' }));
    expect(useEditorStore.getState().source).toContain('\\tkzInterLC[R,near](A,B)(C,3)');
    intersectionView.unmount();

    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Intersections & relations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Test line–circle intersection/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Insert test' }));
    expect(useEditorStore.getState().source).toContain('\\tkzTestInterLC(A,B)(C,D)');
  });

  it('configures tkzInterCC and inserts tkzTestInterCC', async () => {
    const intersectionView = render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Intersections & relations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Circle–circle intersection/ }));
    expect((await screen.findByLabelText('Circle-circle mode')).querySelectorAll('option')).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('Circle-circle mode'), { target: { value: 'R' } });
    fireEvent.change(await screen.findByLabelText('Circle 1 Center'), { target: { value: 'A' } });
    fireEvent.change(screen.getByLabelText('Circle 2 Center'), { target: { value: 'C' } });
    fireEvent.change(screen.getByLabelText('Circle 1 radius'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Circle 2 radius'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create intersections' }));
    expect(useEditorStore.getState().source).toContain('\\tkzInterCC[R](A,2)(C,3)');
    intersectionView.unmount();

    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Intersections & relations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Test circle–circle intersection/ }));
    fireEvent.change(screen.getByLabelText('Circle 1 Center'), { target: { value: 'A' } });
    fireEvent.change(screen.getByLabelText('Circle 1 Point on circle'), { target: { value: 'B' } });
    fireEvent.change(screen.getByLabelText('Circle 2 Center'), { target: { value: 'C' } });
    fireEvent.change(screen.getByLabelText('Circle 2 Point on circle'), { target: { value: 'D' } });
    fireEvent.click(screen.getByRole('button', { name: 'Insert test' }));
    expect(useEditorStore.getState().source).toContain('\\tkzTestInterCC(A,B)(C,D)');
  });

  it('inserts angle calculation and retrieval commands', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Measurements & calculations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Find directed angle/ }));
    expect(await screen.findByRole('dialog', { name: 'Find directed angle' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Angle macro name'), { target: { value: 'angleABC' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Insert command' }));
    expect(useEditorStore.getState().source).toContain('\\tkzFindAngle(A,B,C)\n\\tkzGetAngle{angleABC}');

    fireEvent.click(screen.getByRole('button', { name: 'Measurements & calculations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Find slope angle/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Insert command' }));
    expect(useEditorStore.getState().source).toContain('\\tkzFindSlopeAngle(A,B)\n\\tkzGetAngle{slopeAB}');

    fireEvent.click(screen.getByRole('button', { name: 'Measurements & calculations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Get angle result/ }));
    fireEvent.change(screen.getByLabelText('Angle macro name'), { target: { value: 'savedAngle' } });
    fireEvent.click(screen.getByRole('button', { name: 'Insert command' }));
    expect(useEditorStore.getState().source).toContain('\\tkzGetAngle{savedAngle}');
  });

  it('inserts length calculation and unit conversion commands', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Measurements & calculations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Calculate length/ }));
    expect(await screen.findByRole('dialog', { name: 'Calculate length' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Measurement macro name'), { target: { value: 'dAB' } });
    fireEvent.click(screen.getByRole('button', { name: 'Insert command' }));
    expect(useEditorStore.getState().source).toContain('\\tkzCalcLength(A,B)\n\\tkzGetLength{dAB}');

    fireEvent.click(screen.getByRole('button', { name: 'Measurements & calculations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^pt to cm/ }));
    fireEvent.change(screen.getByLabelText('Conversion value'), { target: { value: '28.45274' } });
    fireEvent.change(screen.getByLabelText('Measurement macro name'), { target: { value: 'oneCm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Insert command' }));
    expect(useEditorStore.getState().source).toContain('\\tkzpttocm(28.45274){oneCm}');

    fireEvent.click(screen.getByRole('button', { name: 'Measurements & calculations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^cm to pt/ }));
    fireEvent.change(screen.getByLabelText('Conversion value'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Measurement macro name'), { target: { value: 'onePt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Insert command' }));
    expect(useEditorStore.getState().source).toContain('\\tkzcmtopt(1){onePt}');

    fireEvent.click(screen.getByRole('button', { name: 'Measurements & calculations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Point coordinates/ }));
    fireEvent.change(screen.getByLabelText('Measurement macro name'), { target: { value: 'coordA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Insert command' }));
    expect(useEditorStore.getState().source).toContain('\\tkzGetPointCoord(A){coordA}');

    fireEvent.click(screen.getByRole('button', { name: 'Measurements & calculations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Swap points/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Insert command' }));
    expect(useEditorStore.getState().source).toContain('\\tkzSwapPoints(A,B)');

    fireEvent.click(screen.getByRole('button', { name: 'Measurements & calculations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Dot product/ }));
    fireEvent.change(screen.getByLabelText('Measurement macro name'), { target: { value: 'dotABC' } });
    fireEvent.click(screen.getByRole('button', { name: 'Insert command' }));
    expect(useEditorStore.getState().source).toContain('\\tkzDotProduct(A,B,C)\n\\tkzGetResult{dotABC}');

    fireEvent.click(screen.getByRole('button', { name: 'Measurements & calculations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Power circle/ }));
    fireEvent.change(screen.getByLabelText('Measurement macro name'), { target: { value: 'powerA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Insert command' }));
    expect(useEditorStore.getState().source).toContain('\\tkzPowerCircle(A)(B,C)\n\\tkzGetResult{powerA}');

    fireEvent.click(screen.getByRole('button', { name: 'Intersections & relations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Test linearity/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Insert command' }));
    expect(useEditorStore.getState().source).toContain('\\tkzIsLinear(A,B,C)\n\\iftkzLinear');

    fireEvent.click(screen.getByRole('button', { name: 'Intersections & relations tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Test orthogonality/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Insert command' }));
    expect(useEditorStore.getState().source).toContain('\\tkzIsOrtho(A,B,C)\n\\iftkzOrtho');
  });

  it('configures a random point for every region family', async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Points tools' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Random point/ }));
    expect((await screen.findByLabelText('Random point mode')).querySelectorAll('option')).toHaveLength(6);
    fireEvent.change(screen.getByLabelText('Random point mode'), { target: { value: 'circle' } });
    fireEvent.change(screen.getByLabelText('Random circle radius'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create random point' }));
    expect(useEditorStore.getState().source).toContain('\\tkzDefRandPointOn[circle=center A radius 3]');
  });
});
