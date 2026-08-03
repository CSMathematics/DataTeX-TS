import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_SETTINGS, useEditorStore } from '../store';
import { useDocumentPipeline } from './useDocumentPipeline';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

function PipelineHarness() {
  useDocumentPipeline();
  return null;
}

function OverridePipelineHarness({ dvisvgmPath }: { dvisvgmPath: string }) {
  useDocumentPipeline({ dvisvgmPath });
  return null;
}

describe('useDocumentPipeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    invokeMock.mockReset();
    useEditorStore.setState({
      source: 'source A',
      settings: { ...DEFAULT_APP_SETTINGS },
      previewMode: DEFAULT_APP_SETTINGS.previewMode,
      parsedNodes: [],
      parsedSource: '',
      resolvedPoints: null,
      resolvedViewport: null,
      geometryDiagnostics: [],
      performanceMetrics: null,
      svgOutput: null,
      compiledSource: null,
      errorLog: null,
      isCompiling: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses quickly and compiles the same source after the longer debounce', async () => {
    useEditorStore.setState({ previewMode: 'latex' });
    invokeMock.mockImplementation((command: string) => {
      if (command === 'parse_tikz') {
        return Promise.resolve({
          nodes: [{ type: 'Point', name: 'A', x: 1, y: 2 }],
          resolved_points: { A: { x: 1, y: 2 } },
          geometry_complete: true,
          viewport: { viewBox: '0 0 10 10' },
          timings: {
            parseMs: 0.2,
            geometryMs: 0.3,
            viewportMs: 0.1,
            totalMs: 0.7,
            nodeCount: 1,
            resolvedPointCount: 1,
          },
        });
      }
      return Promise.resolve({ success: true, svg: '<svg viewBox="0 0 10 10"></svg>' });
    });

    render(<PipelineHarness />);

    await act(async () => vi.advanceTimersByTimeAsync(50));
    expect(useEditorStore.getState().parsedNodes).toEqual([{ type: 'Point', name: 'A', x: 1, y: 2 }]);
    expect(useEditorStore.getState().parsedSource).toBe('source A');
    expect(useEditorStore.getState().resolvedPoints).toEqual({ A: { x: 1, y: 2 } });
    expect(useEditorStore.getState().resolvedViewport).toEqual({ viewBox: '0 0 10 10' });
    expect(useEditorStore.getState().performanceMetrics).toMatchObject({
      parseMs: 0.2,
      geometryMs: 0.3,
      viewportMs: 0.1,
      rustTotalMs: 0.7,
      nodeCount: 1,
      resolvedPointCount: 1,
      geometryComplete: true,
    });
    expect(useEditorStore.getState().performanceMetrics?.parseRoundTripMs).toBeGreaterThanOrEqual(0);
    expect(invokeMock).toHaveBeenCalledWith('parse_tikz', { source: 'source A' });

    await act(async () => vi.advanceTimersByTimeAsync(1450));
    expect(invokeMock).toHaveBeenCalledWith('compile_latex', {
      source: 'source A',
      compiler: 'lualatex',
      enginePaths: {
        ...DEFAULT_APP_SETTINGS.latexEnginePaths,
        dvisvgm: '',
      },
      compilationId: expect.stringMatching(/^stoicheia-exact-preview-/),
    });
    expect(useEditorStore.getState().compiledSource).toBe('source A');
    expect(useEditorStore.getState().svgOutput).toContain('<svg');
    expect(useEditorStore.getState().isCompiling).toBe(false);
    expect(useEditorStore.getState().performanceMetrics?.compileRoundTripMs).toBeGreaterThanOrEqual(0);
  });

  it('skips LaTeX compilation while instant preview is active', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'parse_tikz') {
        return Promise.resolve({ nodes: [], geometry_complete: true });
      }
      return Promise.resolve({ success: true, svg: '<svg />' });
    });

    render(<PipelineHarness />);

    await act(async () => vi.advanceTimersByTimeAsync(50));
    await act(async () => vi.advanceTimersByTimeAsync(1500));

    expect(invokeMock).toHaveBeenCalledWith('parse_tikz', { source: 'source A' });
    expect(invokeMock).not.toHaveBeenCalledWith('compile_latex', expect.anything());
    expect(useEditorStore.getState().compiledSource).toBeNull();
    expect(useEditorStore.getState().isCompiling).toBe(false);
  });

  it('prefers the Rust renderScene payload over legacy geometry fields', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'parse_tikz') {
        return Promise.resolve({
          nodes: [{ type: 'Point', name: 'A', x: 1, y: 2 }],
          resolved_points: { stale: { x: 0, y: 0 } },
          geometry_complete: false,
          viewport: { viewBox: 'stale' },
          renderScene: {
            points: { A: { x: 1, y: 2 } },
            viewBox: '0 0 10 10',
            geometryComplete: true,
          },
        });
      }
      return Promise.resolve({ success: true, svg: '<svg />' });
    });

    render(<PipelineHarness />);
    await act(async () => vi.advanceTimersByTimeAsync(50));

    expect(useEditorStore.getState().resolvedPoints).toEqual({ A: { x: 1, y: 2 } });
    expect(useEditorStore.getState().resolvedViewport).toEqual({ viewBox: '0 0 10 10' });
    expect(useEditorStore.getState().performanceMetrics).toMatchObject({ geometryComplete: true });
  });

  it('keeps partial Rust points and diagnostics when geometry is incomplete', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'parse_tikz') {
        return Promise.resolve({
          nodes: [
            { type: 'Point', name: 'A', x: 1, y: 2 },
            { type: 'MidPoint', p1: 'A', p2: 'B', name: 'M' },
          ],
          renderScene: {
            points: { A: { x: 1, y: 2 } },
            geometryComplete: false,
            diagnostics: [{
              severity: 'warning',
              message: 'Could not resolve target M for MidPoint',
              nodeIndex: 1,
              nodeType: 'MidPoint',
              targets: ['M'],
            }],
          },
        });
      }
      return Promise.resolve({ success: true, svg: '<svg />' });
    });

    render(<PipelineHarness />);
    await act(async () => vi.advanceTimersByTimeAsync(50));

    expect(useEditorStore.getState().resolvedPoints).toEqual({ A: { x: 1, y: 2 } });
    expect(useEditorStore.getState().resolvedViewport).toBeNull();
    expect(useEditorStore.getState().geometryDiagnostics).toEqual([expect.objectContaining({
      nodeType: 'MidPoint',
      targets: ['M'],
    })]);
    expect(useEditorStore.getState().performanceMetrics).toMatchObject({
      geometryComplete: false,
      resolvedPointCount: 1,
    });
  });

  it('ignores an in-flight compile result after switching back to instant preview', async () => {
    useEditorStore.setState({ previewMode: 'latex' });
    let resolveCompile: ((value: unknown) => void) | undefined;
    invokeMock.mockImplementation((command: string) => {
      if (command === 'parse_tikz') return Promise.resolve({ nodes: [], geometry_complete: true });
      if (command === 'stop_compile') return Promise.resolve();
      return new Promise(resolve => { resolveCompile = resolve; });
    });

    render(<PipelineHarness />);

    await act(async () => vi.advanceTimersByTimeAsync(1550));
    expect(useEditorStore.getState().isCompiling).toBe(true);

    act(() => useEditorStore.getState().setPreviewMode('instant'));
    expect(useEditorStore.getState().isCompiling).toBe(false);
    const compilePayload = invokeMock.mock.calls.find(([command]) => command === 'compile_latex')?.[1];
    expect(invokeMock).toHaveBeenCalledWith('stop_compile', {
      compilationId: compilePayload.compilationId,
    });

    await act(async () => resolveCompile?.({ success: true, svg: '<svg>stale</svg>' }));

    expect(useEditorStore.getState().compiledSource).toBeNull();
    expect(useEditorStore.getState().svgOutput).toBeNull();
    expect(useEditorStore.getState().isCompiling).toBe(false);
  });

  it('ignores an older parse response after the source changes', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined;
    invokeMock.mockImplementation((command: string, payload: { source: string }) => {
      if (command !== 'parse_tikz') return Promise.resolve({ success: true, svg: '<svg />' });
      if (payload.source === 'source A') {
        return new Promise(resolve => { resolveFirst = resolve; });
      }
      return Promise.resolve({ nodes: [{ type: 'Point', name: 'B', x: 3, y: 4 }] });
    });

    render(<PipelineHarness />);
    await act(async () => vi.advanceTimersByTimeAsync(50));

    act(() => useEditorStore.getState().setSource('source B'));
    await act(async () => vi.advanceTimersByTimeAsync(50));
    expect(useEditorStore.getState().parsedNodes[0]).toMatchObject({ name: 'B' });

    await act(async () => resolveFirst?.({ nodes: [{ type: 'Point', name: 'A', x: 1, y: 2 }] }));
    expect(useEditorStore.getState().parsedNodes[0]).toMatchObject({ name: 'B' });
  });

  it('ignores an in-flight parse response after the workspace unmounts', async () => {
    let resolveParse: ((value: unknown) => void) | undefined;
    invokeMock.mockImplementation((command: string) => {
      if (command !== 'parse_tikz') {
        return Promise.resolve({ success: true, svg: '<svg />' });
      }
      return new Promise(resolve => {
        resolveParse = resolve;
      });
    });

    const view = render(<PipelineHarness />);
    await act(async () => vi.advanceTimersByTimeAsync(50));
    view.unmount();

    await act(async () => {
      resolveParse?.({
        nodes: [{ type: 'Point', name: 'late', x: 1, y: 2 }],
        geometry_complete: true,
      });
    });

    expect(useEditorStore.getState().parsedNodes).toEqual([]);
    expect(useEditorStore.getState().parsedSource).toBe('');
  });

  it('ignores an in-flight compile response and clears compiling after unmount', async () => {
    useEditorStore.setState({ previewMode: 'latex' });
    let resolveCompile: ((value: unknown) => void) | undefined;
    invokeMock.mockImplementation((command: string) => {
      if (command === 'parse_tikz') {
        return Promise.resolve({ nodes: [], geometry_complete: true });
      }
      if (command === 'stop_compile') return Promise.resolve();
      return new Promise(resolve => {
        resolveCompile = resolve;
      });
    });

    const view = render(<PipelineHarness />);
    await act(async () => vi.advanceTimersByTimeAsync(1550));
    expect(useEditorStore.getState().isCompiling).toBe(true);

    view.unmount();
    expect(useEditorStore.getState().isCompiling).toBe(false);
    const compilePayload = invokeMock.mock.calls.find(([command]) => command === 'compile_latex')?.[1];
    expect(invokeMock).toHaveBeenCalledWith('stop_compile', {
      compilationId: compilePayload.compilationId,
    });
    expect(invokeMock.mock.calls.filter(([command]) => command === 'stop_compile')).toHaveLength(1);

    await act(async () => {
      resolveCompile?.({ success: true, svg: '<svg>late</svg>' });
    });
    expect(useEditorStore.getState().svgOutput).toBeNull();
    expect(useEditorStore.getState().compiledSource).toBeNull();
    expect(useEditorStore.getState().isCompiling).toBe(false);
  });

  it('does not issue a native stop when a debounced compile never started', async () => {
    useEditorStore.setState({ previewMode: 'latex' });
    invokeMock.mockImplementation((command: string) => {
      if (command === 'parse_tikz') return Promise.resolve({ nodes: [], geometry_complete: true });
      return Promise.resolve({ success: true, svg: '<svg />' });
    });

    render(<PipelineHarness />);
    await act(async () => vi.advanceTimersByTimeAsync(500));
    act(() => useEditorStore.getState().setSource('source B'));
    await act(async () => vi.advanceTimersByTimeAsync(500));

    expect(invokeMock.mock.calls.filter(([command]) => command === 'compile_latex')).toHaveLength(0);
    expect(invokeMock.mock.calls.filter(([command]) => command === 'stop_compile')).toHaveLength(0);
  });

  it('stops a superseded compile once and keeps the newer job in control of the store', async () => {
    useEditorStore.setState({ previewMode: 'latex' });
    const pendingCompiles = new Map<string, (value: { success: boolean; svg?: string }) => void>();
    invokeMock.mockImplementation((command: string, payload: { compilationId?: string }) => {
      if (command === 'parse_tikz') return Promise.resolve({ nodes: [], geometry_complete: true });
      if (command === 'stop_compile') return Promise.resolve();
      return new Promise(resolve => {
        pendingCompiles.set(payload.compilationId!, resolve);
      });
    });

    render(<PipelineHarness />);
    await act(async () => vi.advanceTimersByTimeAsync(1550));
    const firstCompilePayload = invokeMock.mock.calls.find(([command]) => command === 'compile_latex')?.[1];
    expect(firstCompilePayload.compilationId).toEqual(expect.any(String));

    act(() => useEditorStore.getState().setSource('source B'));
    expect(invokeMock).toHaveBeenCalledWith('stop_compile', {
      compilationId: firstCompilePayload.compilationId,
    });
    expect(invokeMock.mock.calls.filter(([command]) => command === 'stop_compile')).toHaveLength(1);
    expect(useEditorStore.getState().isCompiling).toBe(false);

    await act(async () => vi.advanceTimersByTimeAsync(1550));
    const compileCalls = invokeMock.mock.calls.filter(([command]) => command === 'compile_latex');
    expect(compileCalls).toHaveLength(2);
    const secondCompilePayload = compileCalls[1][1];
    expect(secondCompilePayload.compilationId).not.toBe(firstCompilePayload.compilationId);
    expect(secondCompilePayload.source).toBe('source B');
    expect(useEditorStore.getState().isCompiling).toBe(true);

    await act(async () => {
      pendingCompiles.get(firstCompilePayload.compilationId)?.({ success: true, svg: '<svg>stale</svg>' });
    });
    expect(useEditorStore.getState().svgOutput).toBeNull();
    expect(useEditorStore.getState().compiledSource).toBeNull();
    expect(useEditorStore.getState().isCompiling).toBe(true);

    await act(async () => {
      pendingCompiles.get(secondCompilePayload.compilationId)?.({ success: true, svg: '<svg>current</svg>' });
    });
    expect(useEditorStore.getState().svgOutput).toBe('<svg>current</svg>');
    expect(useEditorStore.getState().compiledSource).toBe('source B');
    expect(useEditorStore.getState().isCompiling).toBe(false);
  });

  it('cancels and recompiles when the configured dvisvgm executable changes', async () => {
    useEditorStore.setState({ previewMode: 'latex' });
    const pendingCompiles = new Map<string, (value: { success: boolean; svg?: string }) => void>();
    invokeMock.mockImplementation((command: string, payload: { compilationId?: string }) => {
      if (command === 'parse_tikz') return Promise.resolve({ nodes: [], geometry_complete: true });
      if (command === 'stop_compile') return Promise.resolve();
      return new Promise(resolve => pendingCompiles.set(payload.compilationId!, resolve));
    });

    const view = render(<OverridePipelineHarness dvisvgmPath="/tex/bin/dvisvgm-v1" />);
    await act(async () => vi.advanceTimersByTimeAsync(1550));
    const firstCompile = invokeMock.mock.calls.find(([command]) => command === 'compile_latex');
    expect(firstCompile?.[1].enginePaths.dvisvgm).toBe('/tex/bin/dvisvgm-v1');

    view.rerender(<OverridePipelineHarness dvisvgmPath="/tex/bin/dvisvgm-v2" />);
    expect(invokeMock).toHaveBeenCalledWith('stop_compile', {
      compilationId: firstCompile?.[1].compilationId,
    });
    await act(async () => vi.advanceTimersByTimeAsync(1550));

    const compileCalls = invokeMock.mock.calls.filter(([command]) => command === 'compile_latex');
    expect(compileCalls).toHaveLength(2);
    expect(compileCalls[1][1].enginePaths.dvisvgm).toBe('/tex/bin/dvisvgm-v2');
    expect(compileCalls[1][1].compilationId).not.toBe(firstCompile?.[1].compilationId);

    await act(async () => {
      pendingCompiles.get(compileCalls[1][1].compilationId)?.({
        success: true,
        svg: '<svg>v2</svg>',
      });
    });
    expect(useEditorStore.getState().svgOutput).toBe('<svg>v2</svg>');
  });

  it('keeps existing diagnostics when best-effort stop fails and cancellation rejects', async () => {
    useEditorStore.setState({ previewMode: 'latex', errorLog: 'existing diagnostic' });
    let rejectCompile: ((reason: unknown) => void) | undefined;
    invokeMock.mockImplementation((command: string) => {
      if (command === 'parse_tikz') return Promise.resolve({ nodes: [], geometry_complete: true });
      if (command === 'stop_compile') return Promise.reject(new Error('process already exited'));
      return new Promise((_resolve, reject) => {
        rejectCompile = reject;
      });
    });

    render(<PipelineHarness />);
    await act(async () => vi.advanceTimersByTimeAsync(1550));
    act(() => useEditorStore.getState().setPreviewMode('instant'));
    await act(async () => {
      rejectCompile?.(new Error('Compilation cancelled'));
    });

    expect(useEditorStore.getState().errorLog).toBe('existing diagnostic');
    expect(useEditorStore.getState().isCompiling).toBe(false);
    expect(invokeMock.mock.calls.filter(([command]) => command === 'stop_compile')).toHaveLength(1);
  });
});
