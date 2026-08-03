import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AstNode } from '../store';
import { resolvePointMap } from '../geometry/pointResolver.testUtils';
import { buildFastRenderScene, FastSvgRenderer, resetRendererMetricSampler, shouldPublishRendererMetric } from './FastSvgRenderer';

const renderBenchmarkEnabled = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.STOICHEIA_RENDER_BENCHMARK === '1';

const points: AstNode[] = [
  { type: 'Point', name: 'A', x: 0, y: 0 },
  { type: 'Point', name: 'B', x: 4, y: 0 },
  { type: 'Point', name: 'C', x: 1, y: 3 },
  { type: 'Point', name: 'D', x: 1, y: -1 },
];

const resolvedPointMapFor = (nodes: AstNode[]) => resolvePointMap(nodes);

const fastSvgElement = (nodes: AstNode[], viewBox: string, source?: string) => (
  <FastSvgRenderer
    nodes={nodes}
    viewBox={viewBox}
    resolvedPoints={resolvedPointMapFor(nodes)}
    source={source}
  />
);

const renderFastSvg = (nodes: AstNode[], viewBox: string, source?: string) => render(fastSvgElement(nodes, viewBox, source));

const buildTestScene = (nodes: AstNode[], viewBox: string, source?: string) => buildFastRenderScene({
  nodes,
  viewBox,
  source,
  resolvedPoints: resolvedPointMapFor(nodes),
});

describe('FastSvgRenderer', () => {
  it('throttles renderer metric publishing for similar rapid renders', () => {
    resetRendererMetricSampler();

    expect(shouldPublishRendererMetric(2, 1000)).toBe(true);
    expect(shouldPublishRendererMetric(3, 1100)).toBe(false);
    expect(shouldPublishRendererMetric(3, 1249)).toBe(false);
    expect(shouldPublishRendererMetric(3, 1250)).toBe(true);

    resetRendererMetricSampler();
    expect(shouldPublishRendererMetric(2, 2000)).toBe(true);
    expect(shouldPublishRendererMetric(7, 2050)).toBe(true);
  });

  it('renders basic geometry and TikZ styling as SVG', () => {
    const nodes: AstNode[] = [
      ...points,
      { type: 'Segment', p1: 'A', p2: 'B', options: 'blue, dashed, ->' },
      { type: 'Circle', center: 'A', radius_point: 'C', options: 'red' },
      { type: 'Polygon', points: ['A', 'B', 'C'], options: 'fill=yellow' },
    ];
    const { container } = renderFastSvg(nodes, "-150 -150 300 300");

    expect(screen.getByLabelText('Instant geometry preview')).toBeInTheDocument();
    expect(screen.getByLabelText('Point A')).toBeInTheDocument();
    expect(container.querySelector('line')).toHaveAttribute('stroke', '#2563eb');
    expect(container.querySelector('line')).toHaveAttribute('stroke-dasharray', '7 5');
    expect(container.querySelector('line')).toHaveAttribute('marker-end', 'url(#instant-arrow-end)');
    expect(container.querySelector('polygon')).toHaveAttribute('fill', '#ca8a04');
  });

  it('renders named, middle and repeated tkz arrows', () => {
    const nodes: AstNode[] = [
      ...points,
      { type: 'Segment', p1: 'A', p2: 'B', options: 'Latex-Latex' },
      { type: 'Circle', center: 'A', radius_point: 'C', options: 'tkz arrow={To at .25}' },
      { type: 'Polygon', points: ['A', 'B', 'C'], options: 'tkz arrows' },
    ];
    const { container } = renderFastSvg(nodes, "-150 -150 300 300");

    const segmentLine = container.querySelector('[data-node-type="Segment"] line');
    expect(segmentLine).toHaveAttribute('marker-start', 'url(#instant-arrow-latex-start)');
    expect(segmentLine).toHaveAttribute('marker-end', 'url(#instant-arrow-latex-end)');
    expect(container.querySelector('line[data-arrow-placement="middle"]')).toHaveAttribute('marker-end', 'url(#instant-arrow-to-end)');
    expect(container.querySelectorAll('[data-node-type="Polygon"] line[data-arrow-placement="each"]')).toHaveLength(3);
  });

  it('renders marked angles and derived intersection points', () => {
    const nodes: AstNode[] = [
      ...points,
      { type: 'AngleMark', p1: 'A', vertex: 'B', p2: 'C', options: 'size=0.5, orange', label: '$\\alpha$' },
      { type: 'IntersectionPoint', p1: 'A', p2: 'C', p3: 'B', p4: 'D', name: 'E' },
    ];
    const { container } = renderFastSvg(nodes, "-150 -150 300 300");

    expect(container.querySelector('[data-node-type="AngleMark"] path')).toHaveAttribute('stroke', '#ea580c');
    expect(screen.getByText('α')).toBeInTheDocument();
    expect(container.querySelector('[data-node-type="IntersectionPoint"]')).toBeInTheDocument();
    expect(screen.getByLabelText('Point E')).toBeInTheDocument();
  });

  it('renders altitude feet and the orthocenter', () => {
    const nodes: AstNode[] = [
      ...points,
      {
        type: 'AllAltitudes', p1: 'A', p2: 'B', p3: 'C',
        foot1: 'E', foot2: 'F', foot3: 'G', orthocenter: 'H',
      },
    ];
    renderFastSvg(nodes, "-150 -150 300 300");

    expect(screen.getByLabelText('Point E')).toBeInTheDocument();
    expect(screen.getByLabelText('Point H')).toBeInTheDocument();
  });

  it('renders a midpoint and resolves it for later shapes', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 },
      { type: 'Point', name: 'B', x: 4, y: 2 },
      { type: 'MidPoint', p1: 'A', p2: 'B', name: 'M' },
      { type: 'Segment', p1: 'A', p2: 'M' },
    ];
    const { container } = renderFastSvg(nodes, "-150 -150 300 300");

    expect(container.querySelector('[data-node-type="MidPoint"]')).toBeInTheDocument();
    expect(screen.getByLabelText('Point M')).toBeInTheDocument();
    expect(container.querySelector('line,path')).toBeInTheDocument();
  });

  it('does not synthesize construction points when Rust-resolved points omit them', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 },
      { type: 'Point', name: 'B', x: 4, y: 2 },
      { type: 'MidPoint', p1: 'A', p2: 'B', name: 'M' },
      { type: 'Segment', p1: 'A', p2: 'M' },
    ];
    const resolvedPoints = new Map<string, { x: number; y: number }>([
      ['A', { x: 0, y: 0 }],
      ['B', { x: 4, y: 2 }],
    ]);

    const { container } = render(
      <FastSvgRenderer
        nodes={nodes}
        viewBox="-150 -150 300 300"
        resolvedPoints={resolvedPoints}
      />,
    );

    expect(container.querySelector('[data-node-type="MidPoint"]')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Point M')).not.toBeInTheDocument();
    expect(container.querySelector('[data-node-type="Segment"]')).not.toBeInTheDocument();
  });

  it('renders golden-ratio and barycentric derived points', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 },
      { type: 'Point', name: 'B', x: 6, y: 3 },
      { type: 'GoldenRatioPoint', p1: 'A', p2: 'B', name: 'C' },
      { type: 'BarycentricPoint', points: ['A', 'B'], weights: [1, 2], name: 'G' },
    ];
    const { container } = renderFastSvg(nodes, "-150 -150 300 300");

    expect(container.querySelector('[data-node-type="GoldenRatioPoint"]')).toBeInTheDocument();
    expect(container.querySelector('[data-node-type="BarycentricPoint"]')).toBeInTheDocument();
    expect(screen.getByLabelText('Point C')).toBeInTheDocument();
    expect(screen.getByLabelText('Point G')).toBeInTheDocument();
  });

  it('renders advanced single and paired point constructions', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 },
      { type: 'Point', name: 'B', x: 2, y: 0 },
      { type: 'Point', name: 'C', x: 10, y: 0 },
      { type: 'Point', name: 'D', x: 11, y: 0 },
      { type: 'Point', name: 'E', x: 4, y: 0 },
      { type: 'SimilitudeCenter', kind: 'int', center1: 'A', radius1: 'B', center2: 'C', radius2: 'D', name: 'S' },
      { type: 'HarmonicPoint', mode: 'ext', p1: 'A', p2: 'C', known: 'E', name: 'H' },
      { type: 'HarmonicPair', p1: 'A', p2: 'C', ratio: 0.5, name1: 'I', name2: 'J' },
      { type: 'EquiPoints', p1: 'A', p2: 'C', from: 'E', distance: 1, show: false, name1: 'K', name2: 'L' },
    ];
    const { container } = renderFastSvg(nodes, "-300 -300 600 600");

    for (const type of ['SimilitudeCenter', 'HarmonicPoint', 'HarmonicPair', 'EquiPoints']) {
      expect(container.querySelector(`[data-node-type="${type}"]`)).toBeInTheDocument();
    }
    for (const name of ['S', 'H', 'I', 'J', 'K', 'L']) expect(screen.getByLabelText(`Point ${name}`)).toBeInTheDocument();
  });

  it('renders points constrained to an arc, line and circle', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'O', x: 0, y: 0 },
      { type: 'Point', name: 'A', x: 2, y: 0 },
      { type: 'Point', name: 'B', x: 0, y: 2 },
      { type: 'MidArcPoint', center: 'O', start: 'A', end: 'B', name: 'M' },
      { type: 'PointOnLine', p1: 'O', p2: 'A', position: 1.5, name: 'L' },
      { type: 'PointOnCircle', mode: 'through', center: 'O', angle: 180, through: 'A', name: 'C' },
    ];
    const { container } = renderFastSvg(nodes, "-150 -150 300 300");
    for (const type of ['MidArcPoint', 'PointOnLine', 'PointOnCircle']) expect(container.querySelector(`[data-node-type="${type}"]`)).toBeInTheDocument();
    for (const name of ['M', 'L', 'C']) expect(screen.getByLabelText(`Point ${name}`)).toBeInTheDocument();
  });

  it('renders a selected triangle center as a reusable point', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 },
      { type: 'Point', name: 'B', x: 4, y: 0 },
      { type: 'Point', name: 'C', x: 0, y: 3 },
      { type: 'TriangleCenter', option: 'in', p1: 'A', p2: 'B', p3: 'C', name: 'I' },
      { type: 'Segment', p1: 'A', p2: 'I' },
    ];
    const { container } = renderFastSvg(nodes, "-150 -150 300 300");
    expect(container.querySelector('[data-node-type="TriangleCenter"]')).toBeInTheDocument();
    expect(screen.getByLabelText('Point I')).toBeInTheDocument();
    expect(container.querySelector('line,path')).toBeInTheDocument();
  });

  it('renders a transformed image as a reusable point', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'O', x: 0, y: 0 },
      { type: 'Point', name: 'A', x: 2, y: 0 },
      { type: 'PointTransformation', mode: 'rotation', source: 'A', references: ['O'], value: '90', name: 'B' },
      { type: 'Segment', p1: 'O', p2: 'B' },
    ];
    const { container } = renderFastSvg(nodes, "-150 -150 300 300");
    expect(container.querySelector('[data-node-type="PointTransformation"]')).toBeInTheDocument();
    expect(screen.getByLabelText('Point B')).toBeInTheDocument();
    expect(container.querySelector('line,path')).toBeInTheDocument();
  });

  it('renders all images from a multiple-point transformation', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 },
      { type: 'Point', name: 'B', x: 2, y: 0 },
      { type: 'Point', name: 'C', x: 0, y: 1 },
      { type: 'Point', name: 'D', x: 1, y: 2 },
      { type: 'PointsTransformation', mode: 'translation', sources: ['A', 'B'], references: ['C', 'D'], names: ['E', 'F'] },
    ];
    const { container } = renderFastSvg(nodes, "-150 -150 300 300");
    expect(container.querySelector('[data-node-type="PointsTransformation"]')).toBeInTheDocument();
    expect(screen.getByLabelText('Point E')).toBeInTheDocument();
    expect(screen.getByLabelText('Point F')).toBeInTheDocument();
  });

  it('renders a vector-defined point', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 },
      { type: 'Point', name: 'B', x: 3, y: 0 },
      { type: 'VectorPoint', mode: 'orthogonal_normed', p1: 'A', p2: 'B', factor: 2, name: 'C' },
    ];
    const { container } = renderFastSvg(nodes, "-150 -150 300 300");
    expect(container.querySelector('[data-node-type="VectorPoint"]')).toBeInTheDocument();
    expect(screen.getByLabelText('Point C')).toBeInTheDocument();
  });

  it('renders both tangents from an exterior point', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'O', x: 0, y: 0 },
      { type: 'Point', name: 'A', x: 1, y: 0 },
      { type: 'Point', name: 'P', x: 3, y: 0 },
      { type: 'DefinedLine', mode: 'tangent_from', points: ['O', 'A'], through: 'P', factor: 1, normed: false, results: ['T', 'U'] },
    ];
    const { container } = renderFastSvg(nodes, "-150 -150 300 300");
    expect(container.querySelectorAll('line')).toHaveLength(2);
    expect(screen.getByLabelText('Point T')).toBeInTheDocument();
    expect(screen.getByLabelText('Point U')).toBeInTheDocument();
  });

  it('renders a defined triangle vertex and its polygon', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 },
      { type: 'Point', name: 'B', x: 2, y: 0 },
      { type: 'DefinedTriangle', mode: 'equilateral', p1: 'A', p2: 'B', swap: false, name: 'C' },
      { type: 'Polygon', points: ['A', 'B', 'C'] },
    ];
    const { container } = renderFastSvg(nodes, "-150 -150 300 300");
    expect(container.querySelector('[data-node-type="DefinedTriangle"]')).toBeInTheDocument();
    expect(screen.getByLabelText('Point C')).toBeInTheDocument();
    expect(container.querySelector('polygon')).toBeInTheDocument();
  });

  it('renders all vertices of an associated triangle as reusable points', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 },
      { type: 'Point', name: 'B', x: 4, y: 0 },
      { type: 'Point', name: 'C', x: 1, y: 3 },
      { type: 'AssociatedTriangle', mode: 'centroid', p1: 'A', p2: 'B', p3: 'C', namePrefix: 'M', results: ['Ma', 'Mb', 'Mc'] },
      { type: 'Polygon', points: ['Ma', 'Mb', 'Mc'] },
    ];
    const { container } = renderFastSvg(nodes, "-150 -150 300 300");
    expect(container.querySelector('[data-node-type="AssociatedTriangle"]')).toBeInTheDocument();
    for (const name of ['Ma', 'Mb', 'Mc']) expect(screen.getByLabelText(`Point ${name}`)).toBeInTheDocument();
    expect(container.querySelector('polygon')).toBeInTheDocument();
  });

  it('renders constructed quadrilateral vertices for later polygons', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 },
      { type: 'Point', name: 'B', x: 4, y: 0 },
      { type: 'PolygonConstruction', mode: 'square', points: ['A', 'B'], results: ['C', 'D'] },
      { type: 'Polygon', points: ['A', 'B', 'C', 'D'] },
    ];
    const { container } = renderFastSvg(nodes, "-150 -150 300 300");
    expect(container.querySelector('[data-node-type="PolygonConstruction"]')).toBeInTheDocument();
    expect(screen.getByLabelText('Point C')).toBeInTheDocument();
    expect(screen.getByLabelText('Point D')).toBeInTheDocument();
    expect(container.querySelector('polygon')).toBeInTheDocument();
  });

  it('renders every generated vertex of a regular polygon', () => {
    const names = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'];
    const nodes: AstNode[] = [
      { type: 'Point', name: 'O', x: 0, y: 0 },
      { type: 'Point', name: 'A', x: 2, y: 0 },
      { type: 'PolygonConstruction', mode: 'regular_polygon', points: ['O', 'A'], results: names, regularMode: 'center', sides: 6, namePrefix: 'R' },
      { type: 'Polygon', points: names },
    ];
    const { container } = renderFastSvg(nodes, "-150 -150 300 300");
    for (const name of names) expect(screen.getByLabelText(`Point ${name}`)).toBeInTheDocument();
    expect(container.querySelector('polygon')).toBeInTheDocument();
  });

  it('renders tkzDefCircle result points and the resulting circle', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 },
      { type: 'Point', name: 'B', x: 4, y: 0 },
      { type: 'Point', name: 'C', x: 0, y: 3 },
      { type: 'DefinedCircle', mode: 'circum', points: ['A', 'B', 'C'], references: [], results: ['O', 'R'], center: 'O', radiusPoint: 'R' },
      { type: 'Circle', center: 'O', radius_point: 'R' },
    ];
    const { container } = renderFastSvg(nodes, "-150 -150 300 300");
    expect(container.querySelector('[data-node-type="DefinedCircle"]')).toBeInTheDocument();
    expect(screen.getByLabelText('Point O')).toBeInTheDocument();
    expect(screen.getByLabelText('Point R')).toBeInTheDocument();
    expect(container.querySelectorAll('circle')).toHaveLength(6);
  });

  it('renders projected excenters and a transformed circle as reusable points', () => {
    const projectionNames = ['Xa', 'Xb', 'Xc', 'Ya', 'Yb', 'Yc', 'Za', 'Zb', 'Zc'];
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 }, { type: 'Point', name: 'B', x: 4, y: 0 },
      { type: 'Point', name: 'C', x: 0, y: 3 }, { type: 'Point', name: 'D', x: 1, y: 1 },
      { type: 'ProjectedExcenters', p1: 'A', p2: 'B', p3: 'C', namePrefix: 'J', excenterSuffixes: ['a', 'b', 'c'], projectionPrefixes: ['X', 'Y', 'Z'], results: projectionNames },
      { type: 'CircleTransformation', mode: 'translation', center: 'A', radiusPoint: 'B', references: ['C', 'D'], results: ['O', 'M'] },
      { type: 'Circle', center: 'O', radius_point: 'M' },
    ];
    const { container } = renderFastSvg(nodes, "-200 -200 400 400");
    expect(container.querySelector('[data-node-type="ProjectedExcenters"]')).toBeInTheDocument();
    expect(container.querySelector('[data-node-type="CircleTransformation"]')).toBeInTheDocument();
    for (const name of [...projectionNames, 'O', 'M']) expect(screen.getByLabelText(`Point ${name}`)).toBeInTheDocument();
  });

  it('renders both line-circle intersection points', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: -3, y: 0 }, { type: 'Point', name: 'B', x: 3, y: 0 },
      { type: 'Point', name: 'O', x: 0, y: 0 }, { type: 'Point', name: 'C', x: 2, y: 0 },
      { type: 'LineCircleIntersection', mode: 'N', line: ['A', 'B'], circle: ['O', 'C'], near: false, results: ['I', 'J'] },
    ];
    const { container } = renderFastSvg(nodes, "-150 -150 300 300");
    expect(container.querySelector('[data-node-type="LineCircleIntersection"]')).toBeInTheDocument();
    expect(screen.getByLabelText('Point I')).toBeInTheDocument();
    expect(screen.getByLabelText('Point J')).toBeInTheDocument();
  });

  it('renders both circle-circle intersection points', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'O', x: 0, y: 0 }, { type: 'Point', name: 'A', x: 2, y: 0 },
      { type: 'Point', name: 'P', x: 3, y: 0 }, { type: 'Point', name: 'B', x: 1, y: 0 },
      { type: 'CircleCircleIntersection', mode: 'N', circles: [['O', 'A'], ['P', 'B']], results: ['I', 'J'] },
    ];
    const { container } = renderFastSvg(nodes, "-150 -150 300 300");
    expect(container.querySelector('[data-node-type="CircleCircleIntersection"]')).toBeInTheDocument();
    expect(screen.getByLabelText('Point I')).toBeInTheDocument();
    expect(screen.getByLabelText('Point J')).toBeInTheDocument();
  });

  it('renders a stable random point', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 }, { type: 'Point', name: 'B', x: 4, y: 3 },
      { type: 'RandomPoint', mode: 'rectangle', references: ['A', 'B'], name: 'P' },
    ];
    const { container } = renderFastSvg(nodes, "-150 -150 300 300");
    expect(container.querySelector('[data-node-type="RandomPoint"]')).toBeInTheDocument();
    expect(screen.getByLabelText('Point P')).toBeInTheDocument();
  });

  it('reflects sidebar point styles from source in instant preview', () => {
    const nodes: AstNode[] = [{ type: 'Point', name: 'A', x: 0, y: 0, coordinate_mode: 'cartesian' }];
    const { container } = renderFastSvg(nodes, "-50 -50 100 100", "\\tkzDrawPoints[color=orange,fill=blue,size=5,shape=cross out](A)\\tkzLabelPoints[above,color=green](A)");
    const point = container.querySelector('[data-point-name="A"]');
    expect(point?.querySelector('[data-point-shape="cross out"]')).toHaveAttribute('stroke', '#ea580c');
    expect(point?.querySelector('text')).toHaveAttribute('fill', '#16a34a');
    expect(point?.querySelector('text')).toHaveAttribute('y', '-14');
  });

  it('renders precomputed scene point appearances and path labels', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 },
      { type: 'Point', name: 'B', x: 2, y: 0 },
      { type: 'Segment', p1: 'A', p2: 'B' },
    ];
    const scene = buildTestScene(
      nodes,
      '-100 -100 200 200',
      '\\tkzDrawPoints[color=orange](A)\\tkzLabelSegment[color=blue](A,B){$c$}',
    );
    expect(scene.stylesByText?.get('color=blue')?.stroke).toBe('#2563eb');
    expect(scene.optionItemsByText?.get('color=blue')).toContain('color=blue');

    const { container } = render(<FastSvgRenderer scene={scene} />);

    expect(container.querySelector('[data-point-name="A"] circle')).toHaveAttribute('fill', '#ea580c');
    expect(container.querySelector('[data-label-command="tkzLabelSegment"]')).toHaveAttribute('fill', '#2563eb');
  });

  it('renders custom and radial automatic point labels', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'O', x: 0, y: 0 },
      { type: 'Point', name: 'A', x: 2, y: 0 },
      { type: 'Point', name: 'B', x: 0, y: 2 },
    ];
    const { container, rerender } = renderFastSvg(nodes, "-100 -100 200 200", "\\tkzLabelPoint[above,color=red](A){$P$}");
    const custom = container.querySelector('[aria-label="Point A"] text');
    expect(custom).toHaveTextContent('P');
    expect(custom).toHaveAttribute('fill', '#dc2626');

    rerender(fastSvgElement(nodes, "-100 -100 200 200", "\\tkzAutoLabelPoints[center=O,dist=.2,color=blue](A,B)"));
    const autoA = container.querySelector('[aria-label="Point A"] text');
    const autoB = container.querySelector('[aria-label="Point B"] text');
    expect(autoA).toHaveAttribute('fill', '#2563eb');
    expect(Number(autoA?.getAttribute('x'))).toBeGreaterThan(Number(autoB?.getAttribute('x')));
    expect(Number(autoB?.getAttribute('y'))).toBeLessThan(Number(autoA?.getAttribute('y')));
  });

  it('renders segment collection and extended line labels', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 }, { type: 'Point', name: 'B', x: 2, y: 0 },
      { type: 'Point', name: 'C', x: 2, y: 2 }, { type: 'Segment', p1: 'A', p2: 'B' }, { type: 'Line', p1: 'B', p2: 'C' },
    ];
    const source = '\\tkzLabelSegment[above,color=red,pos=.25](A,B){$c$}\n\\tkzLabelSegments[below,sloped](A,B B,C){$a$}\n\\tkzLabelLine[pos=1.25,color=blue](B,C){$(d)$}';
    const { container } = renderFastSvg(nodes, "-100 -100 200 200", source);
    expect(container.querySelector('[data-label-command="tkzLabelSegment"]')).toHaveTextContent('c');
    expect(container.querySelector('[data-label-command="tkzLabelSegment"]')).toHaveAttribute('fill', '#dc2626');
    expect(container.querySelectorAll('[data-label-command="tkzLabelSegments"]')).toHaveLength(2);
    expect(container.querySelector('[data-label-command="tkzLabelLine"]')).toHaveAttribute('fill', '#2563eb');
  });

  it('renders single and grouped angle labels and a rotated circle label', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'O', x: 0, y: 0 }, { type: 'Point', name: 'A', x: 2, y: 0 },
      { type: 'Point', name: 'B', x: 0, y: 2 }, { type: 'Point', name: 'C', x: -2, y: 0 }, { type: 'Circle', center: 'O', radius_point: 'A' },
    ];
    const source = '\\tkzLabelAngle[pos=1.5,color=red](A,O,B){$60^\\circ$}\n\\tkzLabelAngles[pos=1,color=green](A,O,B B,O,C){$\\alpha$}\n\\tkzLabelCircle[color=blue](O,A)(90){$\\mathcal{C}$}';
    const { container } = renderFastSvg(nodes, "-100 -100 200 200", source);
    expect(container.querySelector('[data-label-command="tkzLabelAngle"]')).toHaveAttribute('fill', '#dc2626');
    expect(container.querySelectorAll('[data-label-command="tkzLabelAngles"]')).toHaveLength(2);
    expect(container.querySelector('[data-label-command="tkzLabelCircle"]')).toHaveAttribute('fill', '#2563eb');
  });

  it('renders an arc label at the requested path position', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'O', x: 0, y: 0 }, { type: 'Point', name: 'A', x: 2, y: 0 },
      { type: 'Point', name: 'B', x: 0, y: 2 }, { type: 'Arc', mode: 'towards', center: 'O', first: 'A', second: ['B'] },
    ];
    const { container } = renderFastSvg(nodes, "-100 -100 200 200", '\\tkzLabelArc[pos=.5,color=red](O,A,B){$\\widearc{AB}$}');
    const label = container.querySelector('[data-label-command="tkzLabelArc"]');
    expect(label).toHaveTextContent('⌢AB');
    expect(label).toHaveAttribute('fill', '#dc2626');
  });

  it('renders compass traces and line construction helpers', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 }, { type: 'Point', name: 'B', x: 3, y: 0 }, { type: 'Point', name: 'C', x: 1, y: 2 },
      { type: 'Compass', center: 'A', through: 'B', options: 'delta=20,color=red' },
      { type: 'Compasses', pairs: [['A', 'C'], ['B', 'C']], options: 'length=1' },
      { type: 'ShowLine', mode: 'parallel', points: ['A', 'B'], through: 'C', options: 'parallel=through C,color=blue' },
    ];
    const { container } = renderFastSvg(nodes, "-100 -100 200 200");
    expect(container.querySelector('[data-node-type="Compass"] path')).toHaveAttribute('stroke', '#dc2626');
    expect(container.querySelectorAll('[data-node-type="Compasses"] path')).toHaveLength(2);
    expect(container.querySelectorAll('[data-node-type="ShowLine"] path')).toHaveLength(3);
  });

  it('reflects tkzDrawLine options for defined lines in instant preview', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0, coordinate_mode: 'cartesian' },
      { type: 'Point', name: 'B', x: 2, y: 0, coordinate_mode: 'cartesian' },
      { type: 'Point', name: 'C', x: 0, y: 1, coordinate_mode: 'cartesian' },
      { type: 'DefinedLine', mode: 'parallel', points: ['A', 'B'], through: 'C', factor: 1, normed: false, results: ['D'] },
    ];
    const { container } = renderFastSvg(nodes, "-100 -100 200 200", "\\tkzDrawLine[color=red,dashed](C,D)");
    expect(container.querySelector('line')).toHaveAttribute('stroke', '#dc2626');
    expect(container.querySelector('line')).toHaveAttribute('stroke-dasharray');
  });

  it('renders precomputed scene options for defined lines', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0, coordinate_mode: 'cartesian' },
      { type: 'Point', name: 'B', x: 2, y: 0, coordinate_mode: 'cartesian' },
      { type: 'Point', name: 'C', x: 0, y: 1, coordinate_mode: 'cartesian' },
      { type: 'DefinedLine', mode: 'parallel', points: ['A', 'B'], through: 'C', factor: 1, normed: false, results: ['D'] },
    ];
    const scene = buildTestScene(
      nodes,
      '-100 -100 200 200',
      '\\tkzDrawLine[color=red,dashed](C,D)',
    );
    const { container } = render(<FastSvgRenderer scene={scene} />);

    expect(container.querySelector('line')).toHaveAttribute('stroke', '#dc2626');
    expect(container.querySelector('line')).toHaveAttribute('stroke-dasharray');
  });

  it('renders standalone lines, line collections, segment collections and dimensions', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 }, { type: 'Point', name: 'B', x: 2, y: 0 },
      { type: 'Point', name: 'C', x: 0, y: 2 }, { type: 'Point', name: 'D', x: 2, y: 2 },
      { type: 'Line', p1: 'A', p2: 'B', options: 'add=1 and 1' },
      { type: 'Lines', pairs: [['A', 'C'], ['B', 'D']], options: 'dashed' },
      { type: 'Segments', pairs: [['A', 'D'], ['B', 'C']], options: 'blue' },
      { type: 'Segment', p1: 'C', p2: 'D', options: 'dim={$2$,10pt,midway}' },
    ];
    const { container } = renderFastSvg(nodes, "-100 -100 200 200");
    expect(container.querySelector('[data-node-type="Line"]')).toBeInTheDocument();
    expect(container.querySelector('[data-node-type="Lines"]')?.querySelectorAll('line')).toHaveLength(2);
    expect(container.querySelector('[data-node-type="Segments"]')?.querySelectorAll('line')).toHaveLength(2);
    expect(container.querySelector('[data-node-type="Segment"] text')).toHaveTextContent('2');
  });

  it('renders polygonal chains, circle collections and semicircles', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: 0, y: 0 }, { type: 'Point', name: 'B', x: 2, y: 0 },
      { type: 'Point', name: 'C', x: 0, y: 2 }, { type: 'Point', name: 'D', x: 2, y: 2 },
      { type: 'PolySeg', points: ['A', 'B', 'C'], options: 'dashed' },
      { type: 'Circles', pairs: [['A', 'B'], ['C', 'D']], options: 'blue' },
      { type: 'SemiCircle', center: 'A', radius_point: 'C', options: 'swap' },
      { type: 'SemiCircles', pairs: [['A', 'B'], ['C', 'D']], options: 'fill=red' },
    ];
    const { container } = renderFastSvg(nodes, "-100 -100 200 200");
    expect(container.querySelector('[data-node-type="PolySeg"]')).toHaveAttribute('stroke-dasharray');
    expect(container.querySelector('[data-node-type="Circles"]')?.querySelectorAll('circle')).toHaveLength(2);
    expect(container.querySelector('[data-node-type="SemiCircle"] path')).toBeInTheDocument();
    expect(container.querySelector('[data-node-type="SemiCircles"]')?.querySelectorAll('path')).toHaveLength(2);
  });

  it('renders every arc geometry mode and a rotated ellipse', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'O', x: 0, y: 0 }, { type: 'Point', name: 'A', x: 2, y: 0 }, { type: 'Point', name: 'B', x: 0, y: 2 },
      { type: 'Arc', mode: 'towards', center: 'O', first: 'A', second: ['B'] },
      { type: 'Arc', mode: 'rotate', center: 'O', first: 'A', second: ['90'], options: 'rotate,delta=5' },
      { type: 'Arc', mode: 'R', center: 'O', first: '3', second: ['30', '120'], options: 'R' },
      { type: 'Arc', mode: 'R_with_nodes', center: 'O', first: '2', second: ['A', 'B'], options: 'R with nodes,reverse' },
      { type: 'Arc', mode: 'angles', center: 'O', first: 'A', second: ['0', '180'], options: 'angles' },
      { type: 'Ellipse', center: 'O', x_radius: 4, y_radius: 2, angle: 45, options: 'blue' },
    ];
    const { container } = renderFastSvg(nodes, "-200 -200 400 400");
    expect(container.querySelectorAll('[data-node-type="Arc"]')).toHaveLength(5);
    const ellipse = container.querySelector('[data-node-type="Ellipse"]');
    expect(ellipse).toHaveAttribute('rx', '113.3858268');
    expect(ellipse).toHaveAttribute('ry', '56.6929134');
    expect(ellipse).toHaveAttribute('transform', 'rotate(-45 0 0)');
  });

  it('renders segment collections and arc markings with their shared appearance', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'O', x: 0, y: 0 }, { type: 'Point', name: 'A', x: 2, y: 0 },
      { type: 'Point', name: 'B', x: 0, y: 2 }, { type: 'Point', name: 'C', x: -2, y: 0 },
      { type: 'SegmentMark', p1: 'O', p2: 'A', options: 'mark=|,color=red,pos=.25,size=6pt' },
      { type: 'SegmentsMark', pairs: [['O', 'B'], ['O', 'C']], options: 'mark=||,color=blue' },
      { type: 'ArcMark', center: 'O', start: 'A', end: 'B', options: 'mark=x,color=green' },
    ];
    const { container } = renderFastSvg(nodes, "-100 -100 200 200");
    const segmentMark = container.querySelector('[data-node-type="SegmentMark"][data-mark="|"]');
    expect(segmentMark).toHaveAttribute('fill', '#dc2626');
    expect(container.querySelectorAll('[data-node-type="SegmentsMark"] [data-mark="||"]')).toHaveLength(2);
    expect(container.querySelector('[data-node-type="ArcMark"]')).toHaveAttribute('data-mark', 'x');
  });

  it('renders multiple angle arcs, equality symbols and both right-angle styles', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'O', x: 0, y: 0 }, { type: 'Point', name: 'A', x: 2, y: 0 },
      { type: 'Point', name: 'B', x: 0, y: 2 }, { type: 'Point', name: 'C', x: -2, y: 0 },
      { type: 'AnglesMark', angles: [['A', 'O', 'B'], ['B', 'O', 'C']], options: 'arc=ll,mark=|,mkcolor=red' },
      { type: 'RightAngleMark', p1: 'A', vertex: 'O', p2: 'B', options: 'size=.4,fill=blue!20' },
      { type: 'RightAnglesMark', angles: [['B', 'O', 'C']], options: 'german,dotsize=4pt,color=green' },
    ];
    const { container } = renderFastSvg(nodes, "-100 -100 200 200");
    expect(container.querySelectorAll('[data-node-type="AnglesMark"] [data-node-type="AngleMark"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-node-type="AnglesMark"] path')).toHaveLength(4);
    expect(container.querySelector('[data-node-type="AngleEqualityMark"]')).toHaveAttribute('fill', '#dc2626');
    expect(container.querySelector('[data-node-type="RightAngleMark"] polygon')).toBeInTheDocument();
    expect(container.querySelector('[data-node-type="RightAnglesMark"] circle')).toBeInTheDocument();
  });

  it('renders TikZ pic angles with radius, text and fill styling', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'O', x: 0, y: 0 }, { type: 'Point', name: 'A', x: 2, y: 0 }, { type: 'Point', name: 'B', x: 0, y: 2 },
      { type: 'PicAngle', p1: 'A', vertex: 'O', p2: 'B', options: 'draw=orange,angle radius=1cm,angle eccentricity=1,pic text=$\\alpha$' },
      { type: 'PicRightAngle', p1: 'A', vertex: 'O', p2: 'B', options: 'draw=red,fill=blue!20,angle radius=8mm,pic text=.' },
    ];
    const { container } = renderFastSvg(nodes, "-100 -100 200 200");
    expect(container.querySelector('[data-node-type="PicAngle"] path')).toHaveAttribute('stroke', '#ea580c');
    expect(container.querySelector('[data-node-type="PicAngle"] text')).toHaveTextContent('α');
    expect(container.querySelector('[data-node-type="PicRightAngle"] polygon')).toHaveAttribute('fill', '#2563eb');
    expect(container.querySelector('[data-node-type="PicRightAngle"] text')).toHaveTextContent('.');
  });

  it('renders every sector mode as a closed path and supports fill', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'O', x: 0, y: 0 }, { type: 'Point', name: 'A', x: 2, y: 0 }, { type: 'Point', name: 'B', x: 0, y: 2 },
      { type: 'Sector', mode: 'towards', center: 'O', first: 'A', second: ['B'], options: 'fill=red' },
      { type: 'Sector', mode: 'rotate', center: 'O', first: 'A', second: ['-90'], options: 'rotate' },
      { type: 'Sector', mode: 'R', center: 'O', first: '3', second: ['30', '120'], options: 'R' },
      { type: 'Sector', mode: 'R_with_nodes', center: 'O', first: '2', second: ['A', 'B'], options: 'R with nodes' },
    ];
    const { container } = renderFastSvg(nodes, "-200 -200 400 400");
    const sectors = container.querySelectorAll('[data-node-type="Sector"]');
    expect(sectors).toHaveLength(4);
    expect(sectors[0]).toHaveAttribute('fill', '#dc2626');
    sectors.forEach(sector => expect(sector.getAttribute('d')).toMatch(/^M .* L .* A .* Z$/));
  });

  it('renders circle, polygon, sector and angle fill commands', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'O', x: 0, y: 0 }, { type: 'Point', name: 'A', x: 2, y: 0 }, { type: 'Point', name: 'B', x: 0, y: 2 }, { type: 'Point', name: 'C', x: -1, y: 0 },
      { type: 'FillCircle', mode: 'radius', center: 'O', radius: 'A', options: 'fill=red!20,opacity=.5' },
      { type: 'FillPolygon', points: ['A', 'B', 'C'], options: 'fill=teal!20' },
      { type: 'FillSector', mode: 'R', center: 'O', first: '2', second: ['30', '120'], options: 'R,fill=blue!20' },
      { type: 'FillAngle', p1: 'A', vertex: 'O', p2: 'B', options: 'size=1.5,fill=purple!20' },
    ];
    const { container } = renderFastSvg(nodes, "-200 -200 400 400");
    expect(container.querySelector('[data-node-type="FillCircle"]')).toHaveAttribute('opacity', '0.5');
    expect(container.querySelector('[data-node-type="FillPolygon"]')).toBeInTheDocument();
    expect(container.querySelector('[data-node-type="FillSector"]')?.getAttribute('d')).toMatch(/ Z$/);
    expect(container.querySelector('[data-node-type="FillAngle"] path')?.getAttribute('d')).toMatch(/ Z$/);
  });

  it('renders multiple filled angles with shared options', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'O', x: 0, y: 0 }, { type: 'Point', name: 'A', x: 2, y: 0 }, { type: 'Point', name: 'B', x: 0, y: 2 }, { type: 'Point', name: 'C', x: -2, y: 0 },
      { type: 'FillAngles', angles: [['A', 'O', 'B'], ['B', 'O', 'C']], options: 'size=1.5,fill=red!20,opacity=.4' },
    ];
    const { container } = renderFastSvg(nodes, "-100 -100 200 200");
    const group = container.querySelector('[data-node-type="FillAngles"]');
    expect(group?.querySelectorAll('path')).toHaveLength(2);
    expect(group?.querySelector('path')).toHaveAttribute('opacity', '0.4');
  });

  it('shows initialized bounds and clips only subsequent geometry', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: -4, y: 0 }, { type: 'Point', name: 'B', x: 4, y: 0 },
      { type: 'Line', p1: 'A', p2: 'B', options: 'red' },
      { type: 'CanvasInit', xmin: -2, xmax: 2, ymin: -1, ymax: 1, xstep: 1, ystep: 1, options: 'xmin=-2,xmax=2,ymin=-1,ymax=1' },
      { type: 'CanvasClip', space: 0, options: undefined },
      { type: 'Line', p1: 'A', p2: 'B', options: 'blue' },
      { type: 'ShowBoundingBox', options: 'dashed' },
    ];
    const { container } = renderFastSvg(nodes, "-150 -100 300 200");
    expect(container.querySelectorAll('g[clip-path]')).toHaveLength(2);
    expect(container.querySelector('[data-node-type="ShowBoundingBox"]')).toHaveAttribute('stroke-dasharray');
    expect(container.querySelectorAll('defs rect')).toHaveLength(1);

    const scene = buildTestScene(nodes, '-150 -100 300 200');
    expect(scene.clipData?.clipDefinitions).toHaveLength(1);
    const sceneRender = render(<FastSvgRenderer scene={scene} />);
    expect(sceneRender.container.querySelectorAll('g[clip-path]')).toHaveLength(2);
    sceneRender.unmount();
  });

  it('composes polygon clipping with earlier clipping and supports out', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'A', x: -2, y: -2 }, { type: 'Point', name: 'B', x: 2, y: -2 }, { type: 'Point', name: 'C', x: 0, y: 2 },
      { type: 'CanvasInit', xmin: -3, xmax: 3, ymin: -3, ymax: 3, xstep: 1, ystep: 1 },
      { type: 'CanvasClip', space: 0 },
      { type: 'PolygonClip', points: ['A', 'B', 'C'], out: true, options: 'out' },
      { type: 'FillCircle', mode: 'radius', center: 'A', radius: 'B', options: 'fill=blue' },
    ];
    const { container } = renderFastSvg(nodes, "-100 -100 200 200");
    expect(container.querySelectorAll('[id^="instant-clip-"]')).toHaveLength(2);
    expect(container.querySelector('path[clip-rule]')).toHaveAttribute('clip-rule', 'evenodd');
    expect(container.querySelectorAll('g[clip-path]')).toHaveLength(2);
  });

  it('renders outside-circle and radius-angle sector clips compositionally', () => {
    const nodes: AstNode[] = [
      { type: 'Point', name: 'O', x: 0, y: 0 }, { type: 'Point', name: 'A', x: 2, y: 0 }, { type: 'Point', name: 'B', x: 0, y: 2 },
      { type: 'CircleClip', center: 'O', radius_point: 'A', out: true, options: 'out' },
      { type: 'SectorClip', mode: 'R', center: 'O', first: '2', second: ['30', '120'], options: 'R' },
      { type: 'FillCircle', mode: 'radius', center: 'O', radius: 'B', options: 'fill=blue' },
    ];
    const { container } = renderFastSvg(nodes, "-100 -100 200 200");
    expect(container.querySelectorAll('[id^="instant-clip-"]')).toHaveLength(2);
    expect(container.querySelector('path[clip-rule]')).toBeInTheDocument();
    expect(container.querySelectorAll('g[clip-path]')).toHaveLength(2);
  });

  const benchmarkScene = (targetNodes: number) => {
    const pointCount = Math.floor(targetNodes / 2);
    const segmentCount = targetNodes - pointCount;
    const nodes: AstNode[] = [];
    const resolvedPoints = new Map<string, { x: number; y: number }>();
    const sourceLines = ['\\begin{tikzpicture}'];

    for (let index = 0; index < pointCount; index += 1) {
      const x = index % 100;
      const y = Math.floor(index / 100);
      const name = `P${index}`;
      const point = { x, y };
      nodes.push({ type: 'Point', name, ...point });
      resolvedPoints.set(name, point);
      sourceLines.push(`\\tkzDefPoint(${x},${y}){${name}}`);
    }

    for (let index = 0; index < segmentCount; index += 1) {
      const p1 = `P${index % pointCount}`;
      const p2 = `P${(index + 1) % pointCount}`;
      const options = index % 3 === 0 ? 'blue,->' : index % 3 === 1 ? 'dashed,thin' : undefined;
      nodes.push({ type: 'Segment', p1, p2, options });
      sourceLines.push(`\\tkzDrawSegment${options ? `[${options}]` : ''}(${p1},${p2})`);
    }

    sourceLines.push('\\end{tikzpicture}');
    return { nodes, resolvedPoints, source: sourceLines.join('\n') };
  };

  it.runIf(renderBenchmarkEnabled)('benchmarks large instant renderer scenes', () => {
    console.log('nodes,render_ms,dom_elements,svg_elements');

    for (const targetNodes of [50, 250, 1000, 5000]) {
      const { nodes, resolvedPoints, source } = benchmarkScene(targetNodes);
      const startedAt = performance.now();
      const { container, unmount } = render(
        <FastSvgRenderer
          nodes={nodes}
          viewBox="-100 -100 12000 12000"
          resolvedPoints={resolvedPoints}
          source={source}
        />,
      );
      const renderMs = performance.now() - startedAt;
      console.log(
        `${targetNodes},${renderMs.toFixed(3)},${container.querySelectorAll('*').length},${container.querySelectorAll('svg *').length}`,
      );
      expect(container.querySelectorAll('svg *').length).toBeGreaterThan(0);
      unmount();
    }
  });
});
