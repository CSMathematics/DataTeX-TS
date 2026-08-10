import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import performancePolicy from '../../../../benchmarks/stoicheia/performance-policy.v1.json';
import fixture from '../../../../src-tauri/crates/stoicheia-engine/tests/fixtures/parser-render.v1.json';
import { buildFastViewport, WORLD_SCALE } from '../geometry/fastViewport';
import { useDocumentPipeline } from '../hooks/useDocumentPipeline';
import { buildFastRenderScene, FastSvgRenderer } from '../renderers/FastSvgRenderer';
import { projectSemanticSvg, type SemanticSvgSnapshot } from './semanticSvg';
import {
  DEFAULT_APP_SETTINGS,
  useEditorStore,
  type AstNode,
  type GeometryDiagnostic,
} from '../store';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

interface CanonicalParseResult {
  nodes: AstNode[];
  geometry_complete: boolean;
  viewport: { viewBox: string } | null;
  renderScene: {
    points: Record<string, { x: number; y: number }>;
    viewBox?: string;
    geometryComplete: boolean;
    diagnostics?: GeometryDiagnostic[];
  };
}

function PipelineHarness() {
  useDocumentPipeline();
  return null;
}

const pointShape = (container: HTMLElement, name: string) => {
  const point = container.querySelector(`[data-point-name="${name}"]`);
  return point?.matches('[data-point-shape]')
    ? point
    : point?.querySelector('[data-point-shape]') ?? null;
};

const expectPointAt = (
  container: HTMLElement,
  name: string,
  x: number,
  y: number,
) => {
  const point = pointShape(container, name);
  expect(point, `missing SVG point ${name}`).toBeInTheDocument();
  expect(Number(point?.getAttribute('cx'))).toBeCloseTo(x * WORLD_SCALE, 6);
  expect(Number(point?.getAttribute('cy'))).toBeCloseTo(-y * WORLD_SCALE, 6);
};

const runSharedScenario = async (scenario: (typeof fixture.scenarios)[number]) => {
  const parseResult = scenario.expectedParseResult as unknown as CanonicalParseResult;
  useEditorStore.setState(useEditorStore.getInitialState(), true);
  useEditorStore.setState({
    source: scenario.source,
    settings: { ...DEFAULT_APP_SETTINGS },
    previewMode: 'instant',
    parsedNodes: [],
    parsedSource: '',
    resolvedPoints: null,
    resolvedViewport: null,
    geometryDiagnostics: [],
    performanceMetrics: null,
  });
  invokeMock.mockResolvedValue(parseResult);

  const pipeline = render(<PipelineHarness />);
  await act(async () => vi.advanceTimersByTimeAsync(50));
  pipeline.unmount();

  expect(invokeMock).toHaveBeenCalledWith('parse_tikz', { source: scenario.source });
  const state = useEditorStore.getState();
  expect(state.parsedSource).toBe(scenario.source);
  expect(state.parsedNodes).toEqual(parseResult.nodes);
  expect(state.resolvedPoints).toEqual(parseResult.renderScene.points);
  expect(state.resolvedViewport).toEqual(
    parseResult.renderScene.geometryComplete && parseResult.renderScene.viewBox
      ? { viewBox: parseResult.renderScene.viewBox }
      : null,
  );
  expect(state.geometryDiagnostics).toEqual(parseResult.renderScene.diagnostics ?? []);

  const viewport = buildFastViewport(
    state.parsedNodes,
    state.resolvedPoints,
    state.resolvedViewport?.viewBox,
  );
  const scene = buildFastRenderScene({
    nodes: state.parsedNodes,
    viewBox: viewport.viewBox,
    resolvedPoints: viewport.points,
    source: state.parsedSource,
  });
  const rendered = render(<FastSvgRenderer scene={scene} />);
  const svg = rendered.container.querySelector('svg');
  expect(svg).toHaveAttribute('viewBox', viewport.viewBox);
  return {
    ...rendered,
    parseResult,
    semanticSvg: projectSemanticSvg(svg as SVGSVGElement),
    state,
  };
};

const buildBatchFriendlyScene = (targetNodes: number) => {
  const pointCount = Math.floor(targetNodes / 2);
  const segmentCount = targetNodes - pointCount;
  const nodes: AstNode[] = [];
  const resolvedPoints = new Map<string, { x: number; y: number }>();
  for (let index = 0; index < pointCount; index += 1) {
    const name = `P${index}`;
    const point = { x: index % 100, y: Math.floor(index / 100) };
    nodes.push({ type: 'Point', name, ...point });
    resolvedPoints.set(name, point);
  }
  for (let index = 0; index < segmentCount; index += 1) {
    nodes.push({
      type: 'Segment',
      p1: `P${index % pointCount}`,
      p2: `P${(index + 1) % pointCount}`,
    });
  }
  return { nodes, pointCount, resolvedPoints, segmentCount };
};

const largeSceneGates = performancePolicy.hardwareIndependentGates;

describe('Rust parser → geometry → semantic SVG parity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    invokeMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    useEditorStore.setState(useEditorStore.getInitialState(), true);
  });

  it('keeps the four shared scenario IDs and categories stable', () => {
    expect(fixture.scenarios.map(({ id, category }) => [id, category])).toEqual([
      ['basic-triangle', 'basic'],
      ['chained-construction', 'construction'],
      ['styles-labels-clipping', 'style-and-clip'],
      ['incomplete-geometry-diagnostics', 'diagnostics'],
    ]);
  });

  it('canonicalizes generated SVG IDs and references by document order', () => {
    const renderFixture = (id: string) => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `<svg viewBox="0 0 10 10"><defs><clipPath id="${id}"><rect x="0" y="0" width="5" height="5" /></clipPath></defs><g clip-path="url(#${id})"><circle data-node-type="Point" cx="1" cy="2" r="1" /></g></svg>`;
      return projectSemanticSvg(wrapper.querySelector('svg') as unknown as SVGSVGElement);
    };

    expect(renderFixture('instant-clip-7')).toEqual(renderFixture('generated-42'));
  });

  it.each(fixture.scenarios)('$id reaches the expected semantic SVG', async (scenario) => {
    const { container, parseResult, semanticSvg, state } = await runSharedScenario(scenario);
    // The Rust-owned fixture freezes a canonical semantic tree rather than
    // serializer-specific outerHTML or platform-dependent computed CSS.
    expect(semanticSvg).toEqual((scenario as typeof scenario & {
      expectedSemanticSvg: SemanticSvgSnapshot;
    }).expectedSemanticSvg);

    if (scenario.id === 'basic-triangle') {
      expect(parseResult.geometry_complete).toBe(true);
      expect(container.querySelectorAll('[data-point-name]')).toHaveLength(3);
      expect(container.querySelectorAll('[data-node-type="Polygon"]')).toHaveLength(1);
      expectPointAt(container, 'A', 0, 0);
      expectPointAt(container, 'B', 4, 0);
      expectPointAt(container, 'C', 2, 3);
      return;
    }

    if (scenario.id === 'chained-construction') {
      expect(parseResult.renderScene.points).toMatchObject({
        M: { x: 2, y: 0 },
        N: { x: 1, y: 2 },
      });
      expect(container.querySelectorAll('[data-node-type="MidPoint"]')).toHaveLength(2);
      const segmentLines = container.querySelectorAll('[data-node-type="Segments"] line');
      expect(segmentLines).toHaveLength(3);
      segmentLines.forEach((line) => {
        expect(line).toHaveAttribute('stroke', '#2563eb');
        expect(line).toHaveAttribute('stroke-width', '1.35');
      });
      expectPointAt(container, 'M', 2, 0);
      expectPointAt(container, 'N', 1, 2);
      return;
    }

    if (scenario.id === 'styles-labels-clipping') {
      const polygon = container.querySelector('[data-node-type="Polygon"]');
      expect(polygon).toHaveAttribute('stroke', '#0d9488');
      expect(polygon).toHaveAttribute('fill', '#0891b2');
      expect(polygon).toHaveAttribute('stroke-dasharray', '7 5');
      expect(polygon).toHaveAttribute('stroke-width', '1.5996');

      const cPoint = pointShape(container, 'C');
      expect(cPoint).toHaveAttribute('fill', '#ea580c');
      expect(cPoint).toHaveAttribute('stroke', '#0f172a');
      expect(cPoint).toHaveAttribute('r', '4.52');
      const pointLabel = container.querySelector('[data-point-name="C"] text');
      expect(pointLabel).toHaveTextContent('Κορυφή Γ');
      expect(pointLabel).toHaveAttribute('fill', '#9333ea');

      const pathLabel = container.querySelector('[data-label-command="tkzLabelSegment"]');
      expect(pathLabel).toHaveTextContent('βάση');
      expect(pathLabel).toHaveAttribute('fill', '#2563eb');

      const fillCircle = container.querySelector('[data-node-type="FillCircle"]');
      expect(fillCircle).toHaveAttribute('fill', '#dc2626');
      const clippedGroup = fillCircle?.closest('g[clip-path]');
      const clipId = clippedGroup?.getAttribute('clip-path')?.match(/^url\(#(.+)\)$/)?.[1];
      expect(clipId).toBeTruthy();
      expect(container.querySelector(`clipPath[id="${clipId}"] polygon`)).toBeInTheDocument();
      return;
    }

    expect(scenario.id).toBe('incomplete-geometry-diagnostics');
    expect(parseResult.geometry_complete).toBe(false);
    expect(state.resolvedViewport).toBeNull();
    expect(state.geometryDiagnostics).toEqual([
      {
        message: 'Could not resolve target M for MidPoint',
        nodeIndex: 1,
        nodeType: 'MidPoint',
        severity: 'warning',
        targets: ['M'],
      },
    ]);
    expectPointAt(container, 'A', 1, 2);
    expect(pointShape(container, 'M')).not.toBeInTheDocument();
    expect(container.querySelector('[data-node-type="MidPoint"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-node-type="Segment"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-node-type="SegmentBatch"]')).not.toBeInTheDocument();
  });

  it('keeps a deterministic 1,000-node scene within the bounded SVG DOM budget', () => {
    const { nodes, pointCount, resolvedPoints, segmentCount } = buildBatchFriendlyScene(1_000);

    const scene = buildFastRenderScene({
      nodes,
      viewBox: '-100 -400 1600 800',
      resolvedPoints,
    });
    const { container } = render(<FastSvgRenderer scene={scene} />);
    expect(container.querySelectorAll('[data-point-name]')).toHaveLength(pointCount);
    const segmentBatches = container.querySelectorAll('[data-node-type="SegmentBatch"]');
    expect(segmentBatches).toHaveLength(1);
    const segmentBatch = segmentBatches.item(0);
    expect(segmentBatch).toBeInTheDocument();
    expect(segmentBatch?.getAttribute('d')?.match(/(?:^| )M /g)).toHaveLength(segmentCount);
    expect(container.querySelectorAll('svg *').length).toBeLessThanOrEqual(1_100);
  });

  it('keeps the policy-sized large scene batched without a timing threshold', () => {
    const { nodes, pointCount, resolvedPoints, segmentCount } = buildBatchFriendlyScene(
      largeSceneGates.largeSceneNodeCount,
    );
    const scene = buildFastRenderScene({
      nodes,
      viewBox: '-100 -800 3200 1600',
      resolvedPoints,
    });
    const { container } = render(<FastSvgRenderer scene={scene} />);

    expect(container.querySelectorAll('[data-point-name]')).toHaveLength(pointCount);
    const segmentBatches = container.querySelectorAll('[data-node-type="SegmentBatch"]');
    expect(segmentBatches).toHaveLength(largeSceneGates.largeSceneSegmentBatchCount);
    expect(segmentBatches.item(0).getAttribute('d')?.match(/(?:^| )M /g)).toHaveLength(segmentCount);
    expect(container.querySelectorAll('svg *').length).toBeLessThanOrEqual(
      largeSceneGates.largeSceneSvgElementMax,
    );
  });
});
