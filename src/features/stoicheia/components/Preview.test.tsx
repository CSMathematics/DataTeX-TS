import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { Preview } from './Preview';
import { DEFAULT_APP_SETTINGS, useEditorStore } from '../store';

describe('Preview pan interaction', () => {
  const attachOverlayRect = (container: HTMLElement) => {
    const overlaySvg = container.querySelector('svg.pointer-events-none') as SVGSVGElement;
    const viewBox = overlaySvg.viewBox.baseVal;
    overlaySvg.getBoundingClientRect = () => ({
      left: 0, top: 0, right: viewBox.width, bottom: viewBox.height,
      x: 0, y: 0, width: viewBox.width, height: viewBox.height,
      toJSON: () => undefined,
    });
    return { overlaySvg, viewBox };
  };

  beforeEach(() => {
    useEditorStore.setState({
      activeTool: 'cursor',
      settings: { ...DEFAULT_APP_SETTINGS },
      theme: DEFAULT_APP_SETTINGS.theme,
      showEditorMinimap: DEFAULT_APP_SETTINGS.showEditorMinimap,
      pan: { x: 0, y: 0 },
      svgOutput: null,
      errorLog: null,
      isCompiling: false,
      previewMode: 'instant',
      parsedNodes: [],
      parsedSource: '',
      resolvedPoints: null,
      resolvedViewport: null,
      hoveredNode: null,
      selectedNode: null,
      selectedPoints: [],
      showGrid: false,
      showAxes: true,
      showMeasurements: true,
      showHandles: true,
      zoomLevel: 1,
    });
  });

  it('does not pan with left drag while the cursor tool is active', () => {
    const { container } = render(<Preview />);
    const canvas = container.firstElementChild as HTMLElement;

    expect(canvas).toHaveClass('cursor-default');
    fireEvent.mouseDown(canvas, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.mouseMove(window, { clientX: 40, clientY: 25 });
    fireEvent.mouseUp(window);

    expect(useEditorStore.getState().pan).toEqual({ x: 0, y: 0 });
  });

  it('pans with left drag only after pan mode is enabled', () => {
    const { container } = render(<Preview />);
    const canvas = container.firstElementChild as HTMLElement;

    act(() => useEditorStore.getState().setActiveTool('pan'));
    expect(canvas).toHaveClass('cursor-grab');

    fireEvent.mouseDown(canvas, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.mouseMove(window, { clientX: 35, clientY: 30 });
    fireEvent.mouseUp(window);

    expect(useEditorStore.getState().pan).toEqual({ x: 25, y: 20 });
    expect(canvas).toHaveClass('cursor-grab');
  });

  it('still allows middle-button pan from cursor mode', () => {
    const { container } = render(<Preview />);
    const canvas = container.firstElementChild as HTMLElement;

    fireEvent.mouseDown(canvas, { button: 1, clientX: 5, clientY: 5 });
    fireEvent.mouseMove(window, { clientX: 15, clientY: 20 });
    fireEvent.mouseUp(window);

    expect(useEditorStore.getState().pan).toEqual({ x: 10, y: 15 });
  });

  it('handles embedded keyboard shortcuts only after the canvas receives focus', () => {
    const { container } = render(<Preview shortcutScope="canvas" />);
    const canvas = container.firstElementChild as HTMLElement;
    const initialFitRequest = useEditorStore.getState().fitViewRequest;

    fireEvent.keyDown(window, { code: 'KeyF' });
    expect(useEditorStore.getState().fitViewRequest).toBe(initialFitRequest);

    fireEvent.mouseDown(canvas, { button: 0 });
    expect(canvas).toHaveFocus();
    fireEvent.keyDown(window, { code: 'KeyF' });
    expect(useEditorStore.getState().fitViewRequest).toBe(initialFitRequest + 1);
  });

  it('restores the previous body cursor when an active pan unmounts', () => {
    document.body.style.cursor = 'crosshair';
    useEditorStore.setState({ activeTool: 'pan' });
    const view = render(<Preview shortcutScope="canvas" />);
    const canvas = view.container.firstElementChild as HTMLElement;

    fireEvent.mouseDown(canvas, { button: 0, clientX: 10, clientY: 10 });
    expect(document.body.style.cursor).toBe('grabbing');

    fireEvent.blur(window);
    expect(document.body.style.cursor).toBe('crosshair');
    expect(canvas).toHaveClass('cursor-grab');

    fireEvent.mouseDown(canvas, { button: 0, clientX: 10, clientY: 10 });
    expect(document.body.style.cursor).toBe('grabbing');
    view.unmount();
    expect(document.body.style.cursor).toBe('crosshair');
    document.body.style.cursor = '';
  });

  it('shows parsed geometry immediately without compiled SVG', () => {
    useEditorStore.setState({
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
        { type: 'Segment', p1: 'A', p2: 'B' },
      ],
    });

    const { getByLabelText } = render(<Preview />);
    expect(getByLabelText('Instant geometry preview')).toBeInTheDocument();
    expect(getByLabelText('Point A')).toBeInTheDocument();
  });

  it('renders axes independently from the grid', () => {
    useEditorStore.setState({
      showGrid: false,
      showAxes: true,
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
      ],
    });

    const { container } = render(<Preview />);

    expect(container.querySelector('text[fill="var(--canvas-axis-label)"]')).toHaveTextContent('0');
    expect(container.querySelectorAll('line[stroke="var(--canvas-axis)"]').length).toBeGreaterThan(1);
    expect(container.querySelectorAll('line[stroke="var(--canvas-grid-minor)"]')).toHaveLength(0);
  });

  it('keeps axis, tick and label screen dimensions constant while zooming', () => {
    useEditorStore.setState({
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
      ],
    });

    const { container } = render(<Preview />);
    const screenMetrics = () => {
      const zoom = useEditorStore.getState().zoomLevel;
      const axis = container.querySelector('[data-axis-line="x"]') as SVGLineElement;
      const tick = container.querySelector('[data-axis-tick="x"]') as SVGLineElement;
      const label = container.querySelector('[data-axis-label="x"]') as SVGTextElement;
      return {
        axisWidth: Number(axis.getAttribute('stroke-width')) * zoom,
        tickLength: Math.abs(Number(tick.getAttribute('y2')) - Number(tick.getAttribute('y1'))) * zoom,
        labelSize: Number(label.getAttribute('font-size')) * zoom,
      };
    };

    const initialMetrics = screenMetrics();
    act(() => useEditorStore.getState().setZoomLevel(2.5));

    expect(screenMetrics()).toEqual(initialMetrics);
    expect(initialMetrics).toEqual({ axisWidth: 1.25, tickLength: 10, labelSize: 13 });
  });

  it('reduces axis label density automatically when zooming out', () => {
    useEditorStore.setState({
      zoomLevel: 0.2,
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
      ],
    });

    const { container } = render(<Preview />);
    const zoomedOutCount = container.querySelectorAll('[data-axis-label="x"]').length;

    act(() => useEditorStore.getState().setZoomLevel(2));

    expect(container.querySelectorAll('[data-axis-label="x"]').length).toBeGreaterThan(zoomedOutCount);
  });

  it('culls grid nodes to the visible viewport at dense grid steps', async () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 800, bottom: 600,
      x: 0, y: 0, width: 800, height: 600,
      toJSON: () => undefined,
    });
    useEditorStore.setState({
      settings: { ...DEFAULT_APP_SETTINGS, canvasGridStep: 0.25 },
      showGrid: true,
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
      ],
    });

    const { container } = render(<Preview />);

    await waitFor(() => {
      const gridLines = container.querySelectorAll('line[stroke="var(--canvas-grid-minor)"], line[stroke="var(--canvas-grid-major)"]');
      expect(gridLines.length).toBeGreaterThan(0);
      expect(gridLines.length).toBeLessThan(150);
    });
    rectSpy.mockRestore();
  });

  it('coalesces wheel zoom events into one viewport update per frame', async () => {
    useEditorStore.setState({
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
      ],
    });
    const originalSetCanvasView = useEditorStore.getState().setCanvasView;
    const setCanvasView = vi.fn(originalSetCanvasView);
    useEditorStore.setState({ setCanvasView });

    const { container } = render(<Preview />);
    const canvas = container.firstElementChild as HTMLElement;
    fireEvent.wheel(canvas, { deltaY: -20, clientX: 100, clientY: 100 });
    fireEvent.wheel(canvas, { deltaY: -30, clientX: 100, clientY: 100 });
    fireEvent.wheel(canvas, { deltaY: -40, clientX: 100, clientY: 100 });

    await waitFor(() => expect(setCanvasView).toHaveBeenCalledTimes(1));
    expect(useEditorStore.getState().zoomLevel).toBeGreaterThan(1);
  });

  it('renders inline measurements for the selected segment', () => {
    useEditorStore.setState({
      selectedNode: 'segment_A_B',
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 3, y: 4 },
        { type: 'Segment', p1: 'A', p2: 'B' },
      ],
      resolvedPoints: { A: { x: 0, y: 0 }, B: { x: 3, y: 4 } },
    });

    const { container } = render(<Preview />);

    expect(container.querySelector('[data-measurement-overlay]')).toHaveTextContent('AB = 5');
  });

  it('hides inline measurements when the measurement toggle is off', () => {
    useEditorStore.setState({
      showMeasurements: false,
      selectedNode: 'circle_A_B',
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
        { type: 'Circle', center: 'A', radius_point: 'B' },
      ],
      resolvedPoints: { A: { x: 0, y: 0 }, B: { x: 2, y: 0 } },
    });

    const { container } = render(<Preview />);

    expect(container.querySelector('[data-measurement-overlay]')).not.toBeInTheDocument();
  });

  it('selects a point node from the canvas in cursor mode', () => {
    useEditorStore.setState({
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
      ],
    });

    const { container } = render(<Preview />);
    const handle = container.querySelector('circle.pointer-events-auto') as SVGCircleElement;

    fireEvent.mouseDown(handle, { button: 0 });
    fireEvent.mouseUp(window);

    expect(useEditorStore.getState().selectedNode).toBe('point_A');
  });

  it('syncs canvas point hover with the shared hovered node', () => {
    useEditorStore.setState({
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
      ],
    });

    const { container } = render(<Preview />);
    const handle = container.querySelector('circle.pointer-events-auto') as SVGCircleElement;

    fireEvent.mouseEnter(handle);
    expect(useEditorStore.getState().hoveredNode).toBe('point_A');

    fireEvent.mouseLeave(handle);
    expect(useEditorStore.getState().hoveredNode).toBeNull();
  });

  it('selects generated point handles without starting a drag', () => {
    const source = '\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\tkzDefPoint(2,0){B}\n\\tkzDefMidPoint(A,B)\\tkzGetPoint{M}\n\\end{tikzpicture}';
    useEditorStore.setState({
      source,
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
        { type: 'MidPoint', p1: 'A', p2: 'B', name: 'M' },
      ],
      resolvedPoints: { A: { x: 0, y: 0 }, B: { x: 2, y: 0 }, M: { x: 1, y: 0 } },
      selectedPoints: ['A'],
    });

    const { container } = render(<Preview />);
    const midpointHandle = container.querySelector('circle.fill-cyan-500') as SVGCircleElement;

    fireEvent.mouseDown(midpointHandle, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.mouseMove(window, { clientX: 40, clientY: 40 });
    fireEvent.mouseUp(window);

    expect(useEditorStore.getState().selectedNode).toBe('midpoint_M');
    expect(useEditorStore.getState().selectedPoints).toEqual([]);
    expect(useEditorStore.getState().source).toBe(source);
  });

  it('selects a segment node from the canvas in cursor mode', () => {
    useEditorStore.setState({
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
        { type: 'Segment', p1: 'A', p2: 'B' },
      ],
    });

    const { container } = render(<Preview />);
    const segmentHitArea = container.querySelector('line.stroke-transparent') as SVGLineElement;

    fireEvent.mouseDown(segmentHitArea, { button: 0 });

    expect(useEditorStore.getState().selectedNode).toBe('segment_A_B');
    expect(useEditorStore.getState().selectedPoints).toEqual([]);
  });

  it('syncs canvas segment hover with the shared hovered node', () => {
    useEditorStore.setState({
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
        { type: 'Segment', p1: 'A', p2: 'B' },
      ],
    });

    const { container } = render(<Preview />);
    const segmentHitArea = container.querySelector('line.stroke-transparent') as SVGLineElement;

    fireEvent.mouseEnter(segmentHitArea);
    expect(useEditorStore.getState().hoveredNode).toBe('segment_A_B');

    fireEvent.mouseLeave(segmentHitArea);
    expect(useEditorStore.getState().hoveredNode).toBeNull();
  });

  it('selects line, circle and polygon shapes from canvas hit targets', () => {
    useEditorStore.setState({
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
        { type: 'Point', name: 'C', x: 0, y: 2 },
        { type: 'Line', p1: 'A', p2: 'B' },
        { type: 'Circle', center: 'A', radius_point: 'B' },
        { type: 'Polygon', points: ['A', 'B', 'C'] },
      ],
    });

    const { container } = render(<Preview />);

    fireEvent.mouseDown(container.querySelector('[data-hit-target="line_A_B"]') as SVGLineElement, { button: 0 });
    expect(useEditorStore.getState().selectedNode).toBe('line_A_B');

    fireEvent.mouseDown(container.querySelector('[data-hit-target="circle_A_B"]') as SVGCircleElement, { button: 0 });
    expect(useEditorStore.getState().selectedNode).toBe('circle_A_B');

    fireEvent.mouseDown(container.querySelector('[data-hit-target="polygon_A_B_C"]') as SVGPolygonElement, { button: 0 });
    expect(useEditorStore.getState().selectedNode).toBe('polygon_A_B_C');
  });

  it('syncs shape hover from canvas hit targets', () => {
    useEditorStore.setState({
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
        { type: 'Point', name: 'C', x: 0, y: 2 },
        { type: 'Polygon', points: ['A', 'B', 'C'] },
      ],
    });

    const { container } = render(<Preview />);
    const polygonHitArea = container.querySelector('[data-hit-target="polygon_A_B_C"]') as SVGPolygonElement;

    fireEvent.mouseEnter(polygonHitArea);
    expect(useEditorStore.getState().hoveredNode).toBe('polygon_A_B_C');

    fireEvent.mouseLeave(polygonHitArea);
    expect(useEditorStore.getState().hoveredNode).toBeNull();
  });

  it('renders a ghost segment while a two-point construction is pending', () => {
    useEditorStore.setState({
      activeTool: 'add_segment',
      selectedPoints: ['A'],
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
      ],
    });

    const { container } = render(<Preview />);
    const { viewBox } = attachOverlayRect(container);
    const canvas = container.firstElementChild as HTMLElement;

    fireEvent.mouseMove(canvas, { clientX: 56.69 - viewBox.x, clientY: -28.35 - viewBox.y });

    expect(container.querySelector('[data-construction-preview="segment"]')).toBeInTheDocument();
  });

  it('renders and clears a ghost circle construction preview', () => {
    useEditorStore.setState({
      activeTool: 'add_circle',
      selectedPoints: ['A'],
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
      ],
    });

    const { container } = render(<Preview />);
    const { viewBox } = attachOverlayRect(container);
    const canvas = container.firstElementChild as HTMLElement;

    fireEvent.mouseMove(canvas, { clientX: 56.69 - viewBox.x, clientY: -28.35 - viewBox.y });
    expect(container.querySelector('[data-construction-preview="circle"]')).toBeInTheDocument();

    fireEvent.mouseLeave(canvas);
    expect(container.querySelector('[data-construction-preview="circle"]')).not.toBeInTheDocument();
  });

  it('snaps construction preview to a nearby existing point', () => {
    useEditorStore.setState({
      activeTool: 'add_segment',
      selectedPoints: ['A'],
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2.4, y: 0.35 },
      ],
    });

    const { container } = render(<Preview />);
    const { viewBox } = attachOverlayRect(container);
    const canvas = container.firstElementChild as HTMLElement;
    const handles = container.querySelectorAll('circle.pointer-events-auto');
    const targetHandle = handles[1] as SVGCircleElement;
    const targetX = Number(targetHandle.getAttribute('cx'));
    const targetY = Number(targetHandle.getAttribute('cy'));

    fireEvent.mouseMove(canvas, { clientX: targetX + 5 - viewBox.x, clientY: targetY + 4 - viewBox.y });

    const preview = container.querySelector('[data-construction-preview="segment"]') as SVGLineElement;
    expect(Number(preview.getAttribute('x2'))).toBeCloseTo(targetX, 3);
    expect(Number(preview.getAttribute('y2'))).toBeCloseTo(targetY, 3);
  });

  it('snaps dragged free points to nearby existing points', () => {
    useEditorStore.setState({
      source: '\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\tkzDefPoint(2.4,0.35){B}\n\\end{tikzpicture}',
      parsedNodes: [{ type: 'Point', name: 'A', x: 0, y: 0 }, { type: 'Point', name: 'B', x: 2.4, y: 0.35 }],
      resolvedPoints: { A: { x: 0, y: 0 }, B: { x: 2.4, y: 0.35 } },
      showHandles: true,
    });

    const { container } = render(<Preview />);
    const { viewBox } = attachOverlayRect(container);
    const handles = container.querySelectorAll('circle.pointer-events-auto');
    const sourceHandle = handles[0] as SVGCircleElement;
    const targetHandle = handles[1] as SVGCircleElement;
    const targetX = Number(targetHandle.getAttribute('cx'));
    const targetY = Number(targetHandle.getAttribute('cy'));

    fireEvent.mouseDown(sourceHandle, { button: 0, clientX: -viewBox.x, clientY: -viewBox.y });
    fireEvent.mouseMove(window, { clientX: targetX + 5 - viewBox.x, clientY: targetY + 4 - viewBox.y });
    fireEvent.mouseUp(window);

    expect(useEditorStore.getState().source).toContain('\\tkzDefPoint(2.4,0.35){A}');
  });

  it('snaps construction previews onto nearby segment geometry', () => {
    useEditorStore.setState({
      activeTool: 'add_segment',
      selectedPoints: ['C'],
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0.35 },
        { type: 'Point', name: 'B', x: 3, y: 0.35 },
        { type: 'Point', name: 'C', x: 0, y: 2 },
        { type: 'Segment', p1: 'A', p2: 'B' },
      ],
    });

    const { container } = render(<Preview />);
    const { viewBox } = attachOverlayRect(container);
    const canvas = container.firstElementChild as HTMLElement;
    const handles = container.querySelectorAll('circle.pointer-events-auto');
    const aHandle = handles[0] as SVGCircleElement;
    const bHandle = handles[1] as SVGCircleElement;
    const expectedX = (Number(aHandle.getAttribute('cx')) + Number(bHandle.getAttribute('cx'))) / 2;
    const expectedY = Number(aHandle.getAttribute('cy'));

    fireEvent.mouseMove(canvas, { clientX: expectedX + 5 - viewBox.x, clientY: expectedY + 5 - viewBox.y });

    const preview = container.querySelector('[data-construction-preview="segment"]') as SVGLineElement;
    expect(Number(preview.getAttribute('x2'))).toBeGreaterThan(expectedX);
    expect(Number(preview.getAttribute('y2'))).toBeCloseTo(expectedY, 3);
  });

  it('snaps construction previews to computed line intersections', () => {
    useEditorStore.setState({
      activeTool: 'add_segment',
      selectedPoints: ['E'],
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 3, y: 2 },
        { type: 'Point', name: 'C', x: 0, y: 2 },
        { type: 'Point', name: 'D', x: 3, y: 0 },
        { type: 'Point', name: 'E', x: 0, y: 3 },
        { type: 'Segment', p1: 'A', p2: 'B' },
        { type: 'Segment', p1: 'C', p2: 'D' },
      ],
    });

    const { container } = render(<Preview />);
    const { viewBox } = attachOverlayRect(container);
    const canvas = container.firstElementChild as HTMLElement;
    const handles = container.querySelectorAll('circle.pointer-events-auto');
    const aHandle = handles[0] as SVGCircleElement;
    const bHandle = handles[1] as SVGCircleElement;
    const expectedX = (Number(aHandle.getAttribute('cx')) + Number(bHandle.getAttribute('cx'))) / 2;
    const expectedY = (Number(aHandle.getAttribute('cy')) + Number(bHandle.getAttribute('cy'))) / 2;

    fireEvent.mouseMove(canvas, { clientX: expectedX + 4 - viewBox.x, clientY: expectedY + 5 - viewBox.y });

    const preview = container.querySelector('[data-construction-preview="segment"]') as SVGLineElement;
    expect(Number(preview.getAttribute('x2'))).toBeCloseTo(expectedX, 3);
    expect(Number(preview.getAttribute('y2'))).toBeCloseTo(expectedY, 3);
  });

  it('uses the parsed source snapshot for instant renderer styling', () => {
    useEditorStore.setState({
      source: '\\tkzDrawPoints[color=blue](A)',
      parsedSource: '\\tkzDrawPoints[color=orange](A)',
      parsedNodes: [{ type: 'Point', name: 'A', x: 0, y: 0 }],
      resolvedPoints: { A: { x: 0, y: 0 } },
    });

    const { container } = render(<Preview />);
    const point = container.querySelector('[data-point-name="A"] circle[data-point-shape="circle"]');

    expect(point).toHaveAttribute('fill', '#ea580c');
  });

  it('keeps the configured zoom on initial render instead of auto-fitting', async () => {
    useEditorStore.setState({
      zoomLevel: 1.75,
      fitViewRequest: 0,
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
        { type: 'Segment', p1: 'A', p2: 'B' },
      ],
    });

    render(<Preview />);
    await act(async () => undefined);

    expect(useEditorStore.getState().zoomLevel).toBeCloseTo(1.75);
  });

  it('renders SVG at the final zoomed size instead of compositor scaling it', () => {
    useEditorStore.setState({
      zoomLevel: 1.75,
      pan: { x: 12, y: -8 },
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 },
        { type: 'Point', name: 'B', x: 2, y: 0 },
        { type: 'Segment', p1: 'A', p2: 'B' },
      ],
    });

    const { container } = render(<Preview />);
    const frame = container.querySelector('[data-preview-scene-frame]') as HTMLElement;
    const scene = frame.firstElementChild as HTMLElement;
    const overlay = scene.querySelector('svg.pointer-events-none') as SVGSVGElement;
    const [, , viewBoxWidth, viewBoxHeight] = overlay
      .getAttribute('viewBox')!
      .split(/\s+/)
      .map(Number);

    expect(frame.style.transform).toBe('translate(12px, -8px)');
    expect(frame.style.transform).not.toContain('scale(');
    expect(parseFloat(scene.style.width)).toBeCloseTo(viewBoxWidth * 1.75);
    expect(parseFloat(scene.style.height)).toBeCloseTo(viewBoxHeight * 1.75);
  });

  it('moves the dragged point handle optimistically before the parse pipeline catches up', () => {
    useEditorStore.setState({
      source: '\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\tkzDefPoint(2,0){B}\n\\end{tikzpicture}',
      parsedNodes: [{ type: 'Point', name: 'A', x: 0, y: 0 }, { type: 'Point', name: 'B', x: 2, y: 0 }],
      resolvedPoints: { A: { x: 0, y: 0 }, B: { x: 2, y: 0 } },
      showHandles: true,
    });
    const { container } = render(<Preview />);
    const handle = container.querySelector('circle.pointer-events-auto') as SVGCircleElement;
    const { viewBox } = attachOverlayRect(container);

    const targetSvgX = 28.3464567;
    const targetSvgY = -28.3464567;
    const initialSource = useEditorStore.getState().source;
    const initialHistoryLength = useEditorStore.getState().sourceHistory.length;

    fireEvent.mouseDown(handle, { button: 0, clientX: -viewBox.x, clientY: -viewBox.y });
    fireEvent.mouseMove(window, { clientX: targetSvgX - viewBox.x, clientY: targetSvgY - viewBox.y });

    expect(useEditorStore.getState().source).toBe(initialSource);
    expect(useEditorStore.getState().sourceHistory).toHaveLength(initialHistoryLength);

    const movedHandle = container.querySelector('circle.pointer-events-auto') as SVGCircleElement;
    expect(Number(movedHandle.getAttribute('cx'))).toBeCloseTo(targetSvgX, 2);
    expect(Number(movedHandle.getAttribute('cy'))).toBeCloseTo(targetSvgY, 2);

    fireEvent.mouseMove(window, { clientX: targetSvgX - viewBox.x + 4, clientY: targetSvgY - viewBox.y + 4, altKey: true });
    expect(useEditorStore.getState().source).toBe(initialSource);
    expect(useEditorStore.getState().sourceHistory).toHaveLength(initialHistoryLength);

    fireEvent.mouseUp(window);

    expect(useEditorStore.getState().source).not.toBe(initialSource);
    expect(useEditorStore.getState().source).toContain('\\tkzDefPoint(1.14,0.86){A}');
    expect(useEditorStore.getState().sourceHistory).toHaveLength(initialHistoryLength + 1);
  });

  it('draws a segment and a line directly with two point clicks', () => {
    useEditorStore.setState({
      source: '\\begin{tikzpicture}\n\\tkzDefPoint(0,0){A}\n\\tkzDefPoint(2,0){B}\n\\end{tikzpicture}',
      activeTool: 'add_segment',
      parsedNodes: [{ type: 'Point', name: 'A', x: 0, y: 0 }, { type: 'Point', name: 'B', x: 2, y: 0 }],
    });
    const first = render(<Preview />);
    const handles = first.container.querySelectorAll('circle.pointer-events-auto');
    fireEvent.mouseDown(handles[0], { button: 0 });
    fireEvent.mouseDown(handles[1], { button: 0 });
    expect(useEditorStore.getState().source).toContain('\\tkzDrawSegment(A,B)');
    expect(useEditorStore.getState().activeTool).toBe('cursor');
    first.unmount();

    useEditorStore.setState({ activeTool: 'add_line', selectedPoints: [] });
    const second = render(<Preview />);
    const lineHandles = second.container.querySelectorAll('circle.pointer-events-auto');
    fireEvent.mouseDown(lineHandles[0], { button: 0 });
    fireEvent.mouseDown(lineHandles[1], { button: 0 });
    expect(useEditorStore.getState().source).toContain('\\tkzDrawLine(A,B)');
  });

  it('collects point pairs for multiple lines and finishes with Enter', () => {
    useEditorStore.setState({
      source: '\\begin{tikzpicture}\n\\end{tikzpicture}',
      activeTool: 'add_lines',
      parsedNodes: [
        { type: 'Point', name: 'A', x: 0, y: 0 }, { type: 'Point', name: 'B', x: 2, y: 0 },
        { type: 'Point', name: 'C', x: 0, y: 2 }, { type: 'Point', name: 'D', x: 2, y: 2 },
      ],
    });
    const { container, getByText } = render(<Preview />);
    const handles = container.querySelectorAll('circle.pointer-events-auto');
    handles.forEach(handle => fireEvent.mouseDown(handle, { button: 0 }));
    expect(getByText(/Multiple lines · 2 pairs/)).toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'Enter' });
    expect(useEditorStore.getState().source).toContain('\\tkzDrawLines(A,B C,D)');
    expect(useEditorStore.getState().activeTool).toBe('cursor');
  });

  it('draws a semicircle directly and completes circle pairs with Enter', () => {
    const points = [
      { type: 'Point' as const, name: 'A', x: 0, y: 0 }, { type: 'Point' as const, name: 'B', x: 2, y: 0 },
      { type: 'Point' as const, name: 'C', x: 0, y: 2 }, { type: 'Point' as const, name: 'D', x: 2, y: 2 },
    ];
    useEditorStore.setState({ source: '\\begin{tikzpicture}\n\\end{tikzpicture}', activeTool: 'add_semicircle', parsedNodes: points });
    const first = render(<Preview />);
    const firstHandles = first.container.querySelectorAll('circle.pointer-events-auto');
    fireEvent.mouseDown(firstHandles[0], { button: 0 });
    fireEvent.mouseDown(firstHandles[1], { button: 0 });
    expect(useEditorStore.getState().source).toContain('\\tkzDrawSemiCircle(A,B)');
    first.unmount();

    useEditorStore.setState({ activeTool: 'add_circles', selectedPoints: [] });
    const second = render(<Preview />);
    second.container.querySelectorAll('circle.pointer-events-auto').forEach(handle => fireEvent.mouseDown(handle, { button: 0 }));
    fireEvent.keyDown(window, { code: 'Enter' });
    expect(useEditorStore.getState().source).toContain('\\tkzDrawCircles(A,B C,D)');
  });

  it('collects an ordered polygonal chain without a dialog', () => {
    useEditorStore.setState({
      source: '\\begin{tikzpicture}\n\\end{tikzpicture}', activeTool: 'add_polyseg',
      parsedNodes: [{ type: 'Point', name: 'A', x: 0, y: 0 }, { type: 'Point', name: 'B', x: 2, y: 0 }, { type: 'Point', name: 'C', x: 1, y: 2 }],
    });
    const { container, getByText } = render(<Preview />);
    container.querySelectorAll('circle.pointer-events-auto').forEach(handle => fireEvent.mouseDown(handle, { button: 0 }));
    expect(getByText(/Polygonal chain · 3 points/)).toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'Enter' });
    expect(useEditorStore.getState().source).toContain('\\tkzDrawPolySeg(A,B,C)');
  });

  it('summarizes LaTeX diagnostics above the raw log', () => {
    useEditorStore.setState({
      previewMode: 'latex',
      errorLog: '! Undefined control sequence.\nl.12 \\tkzBadCommand\nEmergency stop.',
      isCompiling: false,
    });

    const { getByText } = render(<Preview />);

    expect(getByText('LaTeX compilation failed')).toBeInTheDocument();
    expect(getByText('Undefined control sequence.')).toBeInTheDocument();
    expect(getByText('l.12 \\tkzBadCommand')).toBeInTheDocument();
  });
});
