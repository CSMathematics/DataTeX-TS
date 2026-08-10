import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../store';
import { PropertiesPanel } from './PropertiesPanel';

describe('PropertiesPanel editing', () => {
  beforeEach(() => {
    useEditorStore.setState({
      source: '\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\tkzDrawPoints(A)\n\\tkzLabelPoints(A)\n\\end{tikzpicture}',
      parsedNodes: [{ type: 'Point', name: 'A', x: 0, y: 0, coordinate_mode: 'cartesian' }],
      selectedNode: 'point_A',
    });
  });

  it('edits point coordinates directly from the sidebar', () => {
    render(<PropertiesPanel />);
    fireEvent.change(screen.getByLabelText('Point X'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Point Y'), { target: { value: '2' } });
    expect(useEditorStore.getState().source).toContain('\\tkzDefPoint(3,2){A}');
  });

  it('edits point and label appearance from the point inspector', () => {
    render(<PropertiesPanel />);
    fireEvent.change(screen.getByLabelText('Point appearance color'), { target: { value: 'orange' } });
    fireEvent.change(screen.getByLabelText('Point appearance fill'), { target: { value: 'blue!30' } });
    fireEvent.change(screen.getByLabelText('Point appearance shape'), { target: { value: 'cross out' } });
    fireEvent.click(screen.getByLabelText('Apply Point appearance options'));
    expect(useEditorStore.getState().source).toContain('\\tkzDrawPoints[color=orange, fill=blue!30, shape=cross out](A)');
  });

  it('also edits a singular tkzDrawPoint command', () => {
    useEditorStore.setState({ source: '\\tkzDefPoint(0,0){A}\n\\tkzDrawPoint(A)\n\\tkzLabelPoints(A)' });
    render(<PropertiesPanel />);
    fireEvent.change(screen.getByLabelText('Point appearance shape'), { target: { value: 'cross' } });
    fireEvent.click(screen.getByLabelText('Apply Point appearance options'));
    expect(useEditorStore.getState().source).toContain('\\tkzDrawPoint[shape=cross](A)');
  });

  it('edits custom tkzLabelPoint text and appearance', () => {
    useEditorStore.setState({ source: '\\tkzDefPoint(0,0){A}\n\\tkzDrawPoint(A)\n\\tkzLabelPoint[above](A){$P$}' });
    render(<PropertiesPanel />);
    fireEvent.change(screen.getByLabelText('Custom point label text'), { target: { value: '$A_1$' } });
    fireEvent.click(screen.getByLabelText('Apply custom point label text'));
    expect(useEditorStore.getState().source).toContain('\\tkzLabelPoint[above](A){$A_1$}');
  });

  it('edits tkzAutoLabelPoints center and radial distance', () => {
    useEditorStore.setState({ source: '\\tkzDefPoint(0,0){A}\n\\tkzDrawPoint(A)\n\\tkzAutoLabelPoints[center=O,dist=.15](A,B)' });
    render(<PropertiesPanel />);
    fireEvent.change(screen.getByLabelText('Label appearance center'), { target: { value: 'C' } });
    fireEvent.change(screen.getByLabelText('Label appearance distance'), { target: { value: '0.3' } });
    fireEvent.click(screen.getByLabelText('Apply Label appearance options'));
    expect(useEditorStore.getState().source).toContain('\\tkzAutoLabelPoints[center=C, dist=0.3](A,B)');
  });

  it('uses the unified construction inspector for derived objects', () => {
    useEditorStore.setState({
      source: '\\tkzDefMidPoint(A,B)\n\\tkzGetPoint{C}\n\\tkzDrawPoints(C)\n\\tkzLabelPoints(C)',
      parsedNodes: [{ type: 'MidPoint', p1: 'A', p2: 'B', name: 'C' }],
      selectedNode: 'midpoint_C',
    });
    render(<PropertiesPanel />);
    expect(screen.getByLabelText('Generated points color')).toBeInTheDocument();
    expect(screen.getByLabelText('Point labels position')).toBeInTheDocument();
  });

  it('uses the same inspector for primitive shapes', () => {
    useEditorStore.setState({
      source: '\\tkzDefPoint(0,0){A}\n\\tkzDefPoint(2,0){B}\n\\tkzDrawSegment(A,B)',
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0, coordinate_mode: 'cartesian' },
        { type: 'Point', name: 'B', x: 2, y: 0, coordinate_mode: 'cartesian' },
        { type: 'Segment', p1: 'A', p2: 'B' },
      ],
      selectedNode: 'segment_A_B',
    });
    render(<PropertiesPanel />);
    expect(screen.getByLabelText('Segment color')).toBeInTheDocument();
    expect(screen.getByLabelText('Reference A')).toBeInTheDocument();
  });

  it('opens properties for a standalone segment label node', () => {
    useEditorStore.setState({
      source: '\\tkzLabelSegment[auto](A,B){$c$}',
      parsedNodes: [{ type: 'LabelSegment', p1: 'A', p2: 'B', text: '$c$', options: 'auto' }],
      selectedNode: 'labelsegment_A_B',
    });
    render(<PropertiesPanel />);
    fireEvent.change(screen.getByLabelText('Segment label text'), { target: { value: '$d$' } });
    fireEvent.click(screen.getByLabelText('Apply Segment label'));
    expect(useEditorStore.getState().source).toContain('\\tkzLabelSegment[auto](A,B){$d$}');
  });

  it('opens properties for a standalone angle retrieval node', () => {
    useEditorStore.setState({
      source: '\\tkzGetAngle{angleAOB}',
      parsedNodes: [{ type: 'AngleRetrieval', macro: 'angleAOB' }],
      selectedNode: 'angleretrieval_angleAOB',
    });
    render(<PropertiesPanel />);
    fireEvent.change(screen.getByLabelText('Angle retrieval macro'), { target: { value: 'alpha' } });
    fireEvent.click(screen.getByLabelText('Apply angle retrieval macro'));
    expect(useEditorStore.getState().source).toBe('\\tkzGetAngle{alpha}');
  });

  it('adds and edits the dim option of tkzDrawSegment', () => {
    useEditorStore.setState({
      source: '\\tkzDefPoint(0,0){A}\n\\tkzDefPoint(2,0){B}\n\\tkzDrawSegment(A,B)',
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0, coordinate_mode: 'cartesian' },
        { type: 'Point', name: 'B', x: 2, y: 0, coordinate_mode: 'cartesian' },
        { type: 'Segment', p1: 'A', p2: 'B' },
      ],
      selectedNode: 'segment_A_B',
    });
    render(<PropertiesPanel />);
    fireEvent.click(screen.getByLabelText('Segment dimension enabled'));
    fireEvent.change(screen.getByLabelText('Segment dimension text'), { target: { value: '$AB$' } });
    fireEvent.click(screen.getByLabelText('Apply Segment options'));
    expect(useEditorStore.getState().source).toContain('\\tkzDrawSegment[dim={$AB$,10pt,midway}](A,B)');
  });

  it('changes an arc mode and its mode-specific arguments', () => {
    useEditorStore.setState({
      source: '\\tkzDefPoint(0,0){O}\n\\tkzDefPoint(2,0){A}\n\\tkzDefPoint(0,2){B}\n\\tkzDrawArc[color=blue](O,A)(B)',
      parsedNodes: [
        { type: 'Point', name: 'O', x: 0, y: 0 }, { type: 'Point', name: 'A', x: 2, y: 0 }, { type: 'Point', name: 'B', x: 0, y: 2 },
        { type: 'Arc', mode: 'towards', center: 'O', first: 'A', second: ['B'], options: 'color=blue' },
      ],
      selectedNode: 'arc_O_A_B',
    });
    render(<PropertiesPanel />);
    fireEvent.change(screen.getByLabelText('Arc mode'), { target: { value: 'R' } });
    fireEvent.change(screen.getByLabelText('Arc radius'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Arc start angle'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Arc end angle'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Arc delta'), { target: { value: '5' } });
    fireEvent.click(screen.getByLabelText('Arc reverse'));
    fireEvent.click(screen.getByLabelText('Apply arc geometry'));
    expect(useEditorStore.getState().source).toContain('\\tkzDrawArc[color=blue, R, delta=5, reverse](O,3)(30,120)');
  });

  it('changes a sector to radius-and-angles mode while preserving its styles', () => {
    useEditorStore.setState({
      source: '\\tkzDefPoint(0,0){O}\n\\tkzDefPoint(2,0){A}\n\\tkzDefPoint(0,2){B}\n\\tkzDrawSector[color=blue,fill=blue!20](O,A)(B)',
      parsedNodes: [
        { type: 'Point', name: 'O', x: 0, y: 0 }, { type: 'Point', name: 'A', x: 2, y: 0 }, { type: 'Point', name: 'B', x: 0, y: 2 },
        { type: 'Sector', mode: 'towards', center: 'O', first: 'A', second: ['B'], options: 'color=blue,fill=blue!20' },
      ],
      selectedNode: 'sector_O_A_B',
    });
    render(<PropertiesPanel />);
    fireEvent.change(screen.getByLabelText('Sector mode'), { target: { value: 'R' } });
    fireEvent.change(screen.getByLabelText('Sector radius'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Sector start angle'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Sector end angle'), { target: { value: '120' } });
    fireEvent.click(screen.getByLabelText('Apply sector geometry'));
    expect(useEditorStore.getState().source).toContain('\\tkzDrawSector[color=blue, fill=blue!20, R](O,3)(30,120)');
  });

  it('edits fill geometry and preserves fill options', () => {
    useEditorStore.setState({
      source: '\\tkzDefPoint(0,0){O}\n\\tkzDefPoint(2,0){A}\n\\tkzDefPoint(0,2){B}\n\\tkzFillSector[fill=blue!20](O,A)(B)',
      parsedNodes: [
        { type: 'Point', name: 'O', x: 0, y: 0 }, { type: 'Point', name: 'A', x: 2, y: 0 }, { type: 'Point', name: 'B', x: 0, y: 2 },
        { type: 'FillSector', mode: 'towards', center: 'O', first: 'A', second: ['B'], options: 'fill=blue!20' },
      ],
      selectedNode: 'fillsector_O_A_B',
    });
    render(<PropertiesPanel />);
    fireEvent.change(screen.getByLabelText('Sector mode'), { target: { value: 'rotate' } });
    fireEvent.change(screen.getByLabelText('Sector rotation angle'), { target: { value: '60' } });
    fireEvent.click(screen.getByLabelText('Apply sector geometry'));
    expect(useEditorStore.getState().source).toContain('\\tkzFillSector[fill=blue!20, rotate](O,A)(60)');
  });

  it('edits the fill-angle size option', () => {
    useEditorStore.setState({
      source: '\\tkzFillAngle[fill=gray!20](A,O,B)',
      parsedNodes: [{ type: 'FillAngle', p1: 'A', vertex: 'O', p2: 'B', options: 'fill=gray!20' }],
      selectedNode: 'fillangle_A_O_B',
    });
    render(<PropertiesPanel />);
    fireEvent.change(screen.getByLabelText('Angle fill size'), { target: { value: '2' } });
    fireEvent.click(screen.getByLabelText('Apply Angle fill options'));
    expect(useEditorStore.getState().source).toContain('\\tkzFillAngle[fill=gray!20, size=2](A,O,B)');
  });

  it('edits tkzInit bounds and tkzClip spacing', () => {
    useEditorStore.setState({
      source: '\\tkzInit[xmin=-5,xmax=5,ymin=-5,ymax=5]',
      parsedNodes: [{ type: 'CanvasInit', xmin: -5, xmax: 5, ymin: -5, ymax: 5, xstep: 1, ystep: 1, options: 'xmin=-5,xmax=5,ymin=-5,ymax=5' }],
      selectedNode: 'canvasinit_-5_5_-5_5',
    });
    const view = render(<PropertiesPanel />);
    fireEvent.change(screen.getByLabelText('Canvas xmax'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Canvas ystep'), { target: { value: '0.5' } });
    fireEvent.click(screen.getByLabelText('Apply construction options'));
    expect(useEditorStore.getState().source).toContain('xmax=8');
    expect(useEditorStore.getState().source).toContain('ystep=0.5');
    view.unmount();

    useEditorStore.setState({ source: '\\tkzClip', parsedNodes: [{ type: 'CanvasClip', space: 0 }], selectedNode: 'canvasclip_0' });
    render(<PropertiesPanel />);
    fireEvent.change(screen.getByLabelText('Canvas clip space'), { target: { value: '1' } });
    fireEvent.click(screen.getByLabelText('Apply construction options'));
    expect(useEditorStore.getState().source).toBe('\\tkzClip[space=1]');
  });

  it('turns an existing polygon into an inside or outside clipping mask', () => {
    useEditorStore.setState({
      source: '\\tkzDrawPolygon(A,B,C)\n\\tkzDrawLine(D,E)',
      parsedNodes: [{ type: 'Polygon', points: ['A', 'B', 'C'] }],
      selectedNode: 'polygon_A_B_C',
    });
    render(<PropertiesPanel />);
    fireEvent.click(screen.getByLabelText('Polygon clipping enabled'));
    expect(useEditorStore.getState().source).toBe('\\tkzDrawPolygon(A,B,C)\n\\tkzClipPolygon(A,B,C)\n\\tkzDrawLine(D,E)');
    fireEvent.change(screen.getByLabelText('Polygon clipping region'), { target: { value: 'outside' } });
    expect(useEditorStore.getState().source).toContain('\\tkzClipPolygon[out](A,B,C)');
    fireEvent.click(screen.getByLabelText('Polygon clipping enabled'));
    expect(useEditorStore.getState().source).not.toContain('\\tkzClipPolygon');
  });

  it('turns a circle into an inside or outside clipping mask', () => {
    useEditorStore.setState({
      source: '\\tkzDrawCircle(O,A)\n\\tkzDrawLine(B,C)',
      parsedNodes: [{ type: 'Circle', center: 'O', radius_point: 'A' }],
      selectedNode: 'circle_O_A',
    });
    render(<PropertiesPanel />);
    fireEvent.click(screen.getByLabelText('Circle clipping enabled'));
    expect(useEditorStore.getState().source).toContain('\\tkzDrawCircle(O,A)\n\\tkzClipCircle(O,A)');
    fireEvent.change(screen.getByLabelText('Circle clipping region'), { target: { value: 'outside' } });
    expect(useEditorStore.getState().source).toContain('\\tkzClipCircle[out](O,A)');
  });

  it('uses a compatible sector as a clipping mask and rejects R with nodes', () => {
    useEditorStore.setState({
      source: '\\tkzDrawSector[rotate](O,A)(60)\n\\tkzDrawLine(B,C)',
      parsedNodes: [{ type: 'Sector', mode: 'rotate', center: 'O', first: 'A', second: ['60'], options: 'rotate' }],
      selectedNode: 'sector_O_A_60',
    });
    const view = render(<PropertiesPanel />);
    fireEvent.click(screen.getByLabelText('Sector clipping enabled'));
    expect(useEditorStore.getState().source).toContain('\\tkzDrawSector[rotate](O,A)(60)\n\\tkzClipSector[rotate](O,A)(60)');
    view.unmount();

    useEditorStore.setState({
      source: '\\tkzDrawSector[R with nodes](O,2)(A,B)',
      parsedNodes: [{ type: 'Sector', mode: 'R_with_nodes', center: 'O', first: '2', second: ['A', 'B'], options: 'R with nodes' }],
      selectedNode: 'sector_O_2_A_B',
    });
    render(<PropertiesPanel />);
    expect(screen.getByLabelText('Sector clipping enabled')).toBeDisabled();
    expect(screen.getByText(/does not support `R with nodes`/)).toBeInTheDocument();
  });

  it('edits all mode-specific sector clip arguments', () => {
    useEditorStore.setState({
      source: '\\tkzDefPoint(0,0){O}\n\\tkzDefPoint(2,0){A}\n\\tkzDefPoint(0,2){B}\n\\tkzClipSector(O,A)(B)',
      parsedNodes: [
        { type: 'Point', name: 'O', x: 0, y: 0 }, { type: 'Point', name: 'A', x: 2, y: 0 }, { type: 'Point', name: 'B', x: 0, y: 2 },
        { type: 'SectorClip', mode: 'towards', center: 'O', first: 'A', second: ['B'] },
      ],
      selectedNode: 'sectorclip_O_A_B',
    });
    render(<PropertiesPanel />);
    fireEvent.change(screen.getByLabelText('Clip sector mode'), { target: { value: 'R' } });
    fireEvent.change(screen.getByLabelText('Clip sector radius'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Clip sector start angle'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Clip sector end angle'), { target: { value: '120' } });
    fireEvent.click(screen.getByLabelText('Apply sector clip geometry'));
    expect(useEditorStore.getState().source).toContain('\\tkzClipSector[R](O,3)(30,120)');
  });

  it('edits ellipse radii and rotation after creation', () => {
    useEditorStore.setState({
      source: '\\tkzDefPoint(0,0){O}\n\\tkzDrawEllipse[red](O,4,2,0)',
      parsedNodes: [{ type: 'Point', name: 'O', x: 0, y: 0 }, { type: 'Ellipse', center: 'O', x_radius: 4, y_radius: 2, angle: 0, options: 'red' }],
      selectedNode: 'ellipse_O_4_2_0',
    });
    render(<PropertiesPanel />);
    fireEvent.change(screen.getByLabelText('Ellipse x radius'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Ellipse angle'), { target: { value: '30' } });
    fireEvent.click(screen.getByLabelText('Apply ellipse geometry'));
    expect(useEditorStore.getState().source).toContain('\\tkzDrawEllipse[red](O,5,2,30)');
  });
});
