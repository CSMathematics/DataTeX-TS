import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CanvasControls } from './CanvasControls';
import { DEFAULT_APP_SETTINGS, DEFAULT_AUTO_LABEL_SHAPES, useEditorStore } from '../store';

describe('CanvasControls', () => {
  beforeEach(() => {
    useEditorStore.setState({
      activeTool: 'cursor',
      settings: { ...DEFAULT_APP_SETTINGS, defaultZoom: 1 },
      theme: DEFAULT_APP_SETTINGS.theme,
      showEditorMinimap: DEFAULT_APP_SETTINGS.showEditorMinimap,
      zoomLevel: 1,
      pan: { x: 10, y: 20 },
      fitViewRequest: 0,
      showHandles: true,
      showGrid: true,
      showAxes: true,
      showMeasurements: true,
      snapToGrid: true,
      previewMode: 'instant',
      source: 'current source',
      compiledSource: null,
      autoLabelShapes: { ...DEFAULT_AUTO_LABEL_SHAPES },
    });
  });

  it('toggles pan mode', () => {
    render(<CanvasControls />);

    fireEvent.click(screen.getByTitle('Pan with left drag (H)'));
    expect(useEditorStore.getState().activeTool).toBe('pan');

    fireEvent.click(screen.getByTitle('Return to selection (V)'));
    expect(useEditorStore.getState().activeTool).toBe('cursor');
  });

  it('zooms around the viewport center', () => {
    render(<CanvasControls />);
    fireEvent.click(screen.getByTitle('Zoom In'));

    expect(useEditorStore.getState().zoomLevel).toBeCloseTo(1.2);
    expect(useEditorStore.getState().pan).toEqual({ x: 12, y: 24 });
  });

  it('requests fit-to-view', () => {
    render(<CanvasControls />);
    fireEvent.click(screen.getByTitle('Fit drawing to view (F)'));

    expect(useEditorStore.getState().fitViewRequest).toBe(1);
  });

  it('switches between instant and configured LaTeX preview', () => {
    render(<CanvasControls />);

    fireEvent.click(screen.getByTitle('Use configured LaTeX engine preview'));
    expect(useEditorStore.getState().previewMode).toBe('latex');

    fireEvent.click(screen.getByTitle('Use fast TypeScript preview'));
    expect(useEditorStore.getState().previewMode).toBe('instant');
  });

  it('shows whether the LaTeX preview matches the current source', () => {
    useEditorStore.setState({ compiledSource: 'current source' });
    const { rerender } = render(<CanvasControls />);

    expect(screen.getByTitle('LaTeX preview is current')).toBeInTheDocument();

    useEditorStore.setState({ source: 'edited source' });
    rerender(<CanvasControls />);

    expect(screen.getByTitle('LaTeX preview is stale')).toBeInTheDocument();
  });

  it('toggles automatic labels for new shapes', () => {
    render(<CanvasControls />);

    fireEvent.click(screen.getByTitle('Configure automatic labels for new shapes'));
    fireEvent.click(screen.getByLabelText('Auto labels: Segments'));

    expect(useEditorStore.getState().autoLabelShapes.segments).toBe(true);
    expect(useEditorStore.getState().autoLabelShapes.angles).toBe(true);
  });

  it('toggles canvas axes independently from the grid', () => {
    render(<CanvasControls />);

    fireEvent.click(screen.getByTitle('Hide axes'));

    expect(useEditorStore.getState().showAxes).toBe(false);
    expect(useEditorStore.getState().showGrid).toBe(true);
  });

  it('toggles inline measurements', () => {
    render(<CanvasControls />);

    fireEvent.click(screen.getByTitle('Hide inline measurements'));

    expect(useEditorStore.getState().showMeasurements).toBe(false);
  });

  it('keeps canvas interaction help in a compact info tooltip', () => {
    render(<CanvasControls />);

    const help = screen.getByRole('button', {
      name: /Wheel: zoom .* Drag background: pan .* Alt: free move/,
    });

    expect(help).toHaveAttribute(
      'title',
      'Wheel: zoom · Drag background: pan · Middle/right drag: pan · Shift: constrain · Alt: free move',
    );
    expect(help.querySelector('svg')).toBeInTheDocument();
  });
});
