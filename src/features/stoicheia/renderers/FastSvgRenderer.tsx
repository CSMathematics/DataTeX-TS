import { createContext, Fragment, memo, ReactNode, useContext, useEffect, useMemo } from 'react';
import { AstNode, PointDef, useEditorStore } from '../store';
import {
  add,
  extendSegment,
  GeoPoint,
  internalAngleBisectorDirection,
  length,
  midpoint,
  normalize,
  perpendicular,
  projectPointOnLine,
  scale,
  subtract,
  triangleFeet,
  triangleOrthocenter,
} from '../geometry/math';
import { worldToSvg, WORLD_SCALE } from '../geometry/fastViewport';
import { logPerformance, nowMs } from '../performanceMetrics';
import { FastArrowTip, FastPathArrow, FastStyle, parseFastStyle, resolveTikzColor, splitTikzOptions } from '../tikz/options';
import { buildTikzCommandIndex, readTikzCommandOptions, type TikzCommandTarget } from '../editor/commandOptions';

export interface FastRenderScene {
  nodes: AstNode[];
  viewBox: string;
  resolvedPoints: ReadonlyMap<string, GeoPoint>;
  source?: string;
  pointAppearances?: ReadonlyMap<string, InstantPointAppearance>;
  pathLabels?: readonly FastPathLabelSpec[];
  definedLineOptions?: ReadonlyMap<number, string | null>;
  optionItemsByText?: ReadonlyMap<string, readonly string[]>;
  stylesByText?: ReadonlyMap<string, FastStyle>;
  clipData?: FastClipData;
}

type FastSvgRendererProps = FastRenderScene | {
  scene: FastRenderScene;
};

type InstantClip = { id: string; rect?: { x: number; y: number; width: number; height: number }; points?: string; circle?: { cx: number; cy: number; r: number }; path?: string; out?: boolean };

interface FastClipData {
  clipDefinitions: InstantClip[];
  clipChains: ReadonlyMap<number, readonly InstantClip[]>;
  outsideRectPath: string;
}

const RENDERER_METRIC_MIN_INTERVAL_MS = 250;
const RENDERER_METRIC_MIN_DELTA_MS = 4;
let lastRendererMetric: { rendererMs: number; reportedAt: number } | null = null;

export const resetRendererMetricSampler = () => {
  lastRendererMetric = null;
};

export const shouldPublishRendererMetric = (rendererMs: number, measuredAt: number) => {
  if (
    !lastRendererMetric ||
    measuredAt - lastRendererMetric.reportedAt >= RENDERER_METRIC_MIN_INTERVAL_MS ||
    Math.abs(rendererMs - lastRendererMetric.rendererMs) >= RENDERER_METRIC_MIN_DELTA_MS
  ) {
    lastRendererMetric = { rendererMs, reportedAt: measuredAt };
    return true;
  }
  return false;
};

const arrowMarkerId = (tip: FastArrowTip, placement: 'start' | 'end') => {
  if (tip === 'default') return `instant-arrow-${placement}`;
  return `instant-arrow-${tip.toLowerCase()}-${placement}`;
};

const arrowMarkerShapes: { tip: FastArrowTip; path: string; filled: boolean }[] = [
  { tip: 'default', path: 'M0,0 L8,4 L0,8 z', filled: true },
  { tip: 'Triangle', path: 'M0,0 L8,4 L0,8 z', filled: true },
  { tip: 'Latex', path: 'M0,0 L8,4 L0,8 L2.2,4 z', filled: true },
  { tip: 'Stealth', path: 'M0,0 L9,4 L0,8 L2.4,4 z', filled: true },
  { tip: 'To', path: 'M1,0 L8,4 L1,8', filled: false },
];

const ArrowMarkerDefinitions = () => (
  <>
    {arrowMarkerShapes.flatMap(shape => (['end', 'start'] as const).map(placement => {
      const isStart = placement === 'start';
      const id = arrowMarkerId(shape.tip, placement);
      return (
        <marker key={id} id={id} markerWidth="9" markerHeight="8" refX={isStart ? 1 : 8} refY="4" orient={isStart ? 'auto-start-reverse' : 'auto'} markerUnits="strokeWidth">
          <path d={shape.path} fill={shape.filled ? 'context-stroke' : 'none'} stroke={shape.filled ? 'none' : 'context-stroke'} strokeWidth={shape.filled ? undefined : 1.4} strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      );
    }))}
  </>
);

const svgStyle = (style: FastStyle) => ({
  stroke: style.stroke,
  fill: style.fill,
  strokeWidth: style.strokeWidth,
  strokeDasharray: style.dashArray,
  opacity: style.opacity,
  markerStart: style.arrowStart ? `url(#${arrowMarkerId(style.arrowStartTip, 'start')})` : undefined,
  markerEnd: style.arrowEnd ? `url(#${arrowMarkerId(style.arrowEndTip, 'end')})` : undefined,
});

const batchStyleKey = (style: FastStyle) => JSON.stringify({
  stroke: style.stroke,
  fill: style.fill,
  strokeWidth: style.strokeWidth,
  opacity: style.opacity,
  dashArray: style.dashArray,
});

const fillColor = (options: string | undefined, style: FastStyle, optionItems?: readonly string[]) => {
  if (style.fill !== 'transparent') return style.fill;
  const bareColor = (optionItems ?? splitTikzOptions(options ?? '')).find(option => !option.includes('=') && !['R', 'R with nodes', 'rotate', 'towards'].includes(option));
  return bareColor ? resolveTikzColor(bareColor, style.stroke) : style.stroke;
};

interface FastRendererCache {
  options: (input?: string | null) => readonly string[];
  style: (input?: string | null) => FastStyle;
  commandOptions: (target: TikzCommandTarget) => string | null;
}

const createFastRendererCache = (
  source?: string,
  precomputedOptions?: ReadonlyMap<string, readonly string[]>,
  precomputedStyles?: ReadonlyMap<string, FastStyle>,
): FastRendererCache => {
  const optionCache = new Map<string, readonly string[]>(precomputedOptions);
  const styleCache = new Map<string, FastStyle>(precomputedStyles);
  const commandOptionCache = new Map<string, string | null>();
  let commandIndex: ReturnType<typeof buildTikzCommandIndex> | null = null;
  const keyFor = (input?: string | null) => input ?? '';

  const options = (input?: string | null) => {
    const key = keyFor(input);
    const cached = optionCache.get(key);
    if (cached) return cached;
    const parsed = splitTikzOptions(key);
    optionCache.set(key, parsed);
    return parsed;
  };

  const style = (input?: string | null) => {
    const key = keyFor(input);
    const cached = styleCache.get(key);
    if (cached) return cached;
    const parsed = parseFastStyle(input ?? undefined);
    styleCache.set(key, parsed);
    return parsed;
  };

  const commandOptions = (target: TikzCommandTarget) => {
    if (!source) return null;
    commandIndex ??= buildTikzCommandIndex(source);
    const key = `${target.command}\u0000${target.arguments ?? ''}\u0000${target.followedBy ?? ''}`;
    if (!commandOptionCache.has(key)) commandOptionCache.set(key, readTikzCommandOptions(commandIndex, target));
    return commandOptionCache.get(key) ?? null;
  };

  return { options, style, commandOptions };
};

export interface InstantPointAppearance {
  fill?: string;
  draw?: string;
  opacity?: number;
  radius?: number;
  shape?: 'circle' | 'cross' | 'cross out';
  labelColor?: string;
  labelDx?: number;
  labelDy?: number;
  labelText?: string;
}

export type FastPathLabelSpec =
  | { kind: 'path'; command: string; options: string; p1: string; p2: string; text: string }
  | { kind: 'angle'; command: string; options: string; p1: string; vertex: string; p2: string; text: string }
  | { kind: 'circle'; command: 'tkzLabelCircle'; options: string; center: string; radiusPoint: string; angle: number; text: string }
  | { kind: 'arc'; command: 'tkzLabelArc'; options: string; center: string; start: string; end: string; text: string };

const parseFastPathLabels = (source?: string): FastPathLabelSpec[] => {
  const labels: FastPathLabelSpec[] = [];
  if (!source?.includes('\\tkzLabel')) return labels;
  const singlePattern = /\\(tkzLabelSegment|tkzLabelLine)(?:\[([^\]]*)\])?\s*\(([^,()]+),([^()]+)\)\s*\{([^}]*)\}/g;
  for (const match of source.matchAll(singlePattern)) {
    labels.push({ kind: 'path', command: match[1], options: match[2] ?? '', p1: match[3].trim(), p2: match[4].trim(), text: match[5] });
  }
  const multiplePattern = /\\tkzLabelSegments(?:\[([^\]]*)\])?\s*\(([^)]*)\)\s*\{([^}]*)\}/g;
  for (const match of source.matchAll(multiplePattern)) {
    for (const pair of match[2].trim().split(/\s+/)) {
      const [p1, p2] = pair.split(',').map(item => item.trim());
      if (p1 && p2) labels.push({ kind: 'path', command: 'tkzLabelSegments', options: match[1] ?? '', p1, p2, text: match[3] });
    }
  }
  const anglePattern = /\\tkzLabelAngle(?:\[([^\]]*)\])?\s*\(([^,()]+),([^,()]+),([^()]+)\)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g;
  for (const match of source.matchAll(anglePattern)) {
    labels.push({ kind: 'angle', command: 'tkzLabelAngle', options: match[1] ?? '', p1: match[2].trim(), vertex: match[3].trim(), p2: match[4].trim(), text: match[5] });
  }
  const anglesPattern = /\\tkzLabelAngles(?:\[([^\]]*)\])?\s*\(([^)]*)\)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g;
  for (const match of source.matchAll(anglesPattern)) {
    for (const triple of match[2].trim().split(/\s+/)) {
      const [p1, vertex, p2] = triple.split(',').map(item => item.trim());
      if (p1 && vertex && p2) labels.push({ kind: 'angle', command: 'tkzLabelAngles', options: match[1] ?? '', p1, vertex, p2, text: match[3] });
    }
  }
  const circlePattern = /\\tkzLabelCircle(?:\[([^\]]*)\])?\s*\(([^,()]+),([^()]+)\)\s*\(([^)]*)\)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g;
  for (const match of source.matchAll(circlePattern)) {
    labels.push({ kind: 'circle', command: 'tkzLabelCircle', options: match[1] ?? '', center: match[2].trim(), radiusPoint: match[3].trim(), angle: Number(match[4]), text: match[5] });
  }
  const arcPattern = /\\tkzLabelArc(?:\[([^\]]*)\])?\s*\(([^,()]+),([^,()]+),([^()]+)\)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g;
  for (const match of source.matchAll(arcPattern)) {
    labels.push({ kind: 'arc', command: 'tkzLabelArc', options: match[1] ?? '', center: match[2].trim(), start: match[3].trim(), end: match[4].trim(), text: match[5] });
  }
  return labels;
};

type DefinedLineNode = Extract<AstNode, { type: 'DefinedLine' }>;

const definedLineCommandTarget = (node: DefinedLineNode): TikzCommandTarget | null => {
  if (node.mode === 'tangent_from') {
    if (node.results.length < 2 || !node.through) return null;
    return {
      command: 'tkzDrawSegments',
      arguments: `${node.through},${node.results[0]} ${node.through},${node.results[1]}`,
    };
  }
  const result = node.results[0];
  if (!result) return null;
  const reference = ['perpendicular', 'orthogonal', 'parallel', 'tangent_at'].includes(node.mode) ? node.through : node.points[1];
  if (node.results.length !== 2 && !reference) return null;
  const first = node.results.length === 2
    ? node.results.join(',')
    : `${reference},${result}`;
  return {
    command: 'tkzDrawLine',
    arguments: first,
  };
};

const buildDefinedLineOptions = (nodes: readonly AstNode[], source?: string) => {
  if (!source || !nodes.some(node => node.type === 'DefinedLine')) return undefined;
  const commandIndex = buildTikzCommandIndex(source);
  const options = new Map<number, string | null>();
  nodes.forEach((node, index) => {
    if (node.type !== 'DefinedLine') return;
    const target = definedLineCommandTarget(node);
    if (target) options.set(index, readTikzCommandOptions(commandIndex, target));
  });
  return options;
};

const buildFastOptionLookups = (
  nodes: readonly AstNode[],
  pathLabels: readonly FastPathLabelSpec[],
  definedLineOptions?: ReadonlyMap<number, string | null>,
) => {
  const optionTexts = new Set<string>(['']);
  const collect = (options?: string | null) => optionTexts.add(options ?? '');
  nodes.forEach(node => {
    if ('options' in node) collect(node.options);
  });
  pathLabels.forEach(label => collect(label.options));
  definedLineOptions?.forEach(options => collect(options));

  const optionItemsByText = new Map<string, readonly string[]>();
  const stylesByText = new Map<string, FastStyle>();
  optionTexts.forEach(options => {
    optionItemsByText.set(options, splitTikzOptions(options));
    stylesByText.set(options, parseFastStyle(options || undefined));
  });
  return { optionItemsByText, stylesByText };
};

const buildFastClipData = (nodes: readonly AstNode[], pointMap: ReadonlyMap<string, GeoPoint>, viewBox: string): FastClipData => {
  const clipDefinitions: InstantClip[] = [];
  const clipChains = new Map<number, InstantClip[]>();
  let initialized = { xmin: 0, xmax: 10, ymin: 0, ymax: 10 };
  let activeClips: InstantClip[] = [];
  const [viewX, viewY, viewWidth, viewHeight] = viewBox.split(/\s+/).map(Number);
  nodes.forEach((node, index) => {
    if (node.type === 'CanvasInit') initialized = node;
    else if (node.type === 'CanvasClip') {
      const topLeft = worldToSvg({ x: initialized.xmin - node.space, y: initialized.ymax + node.space });
      const bottomRight = worldToSvg({ x: initialized.xmax + node.space, y: initialized.ymin - node.space });
      const clip = { id: `instant-clip-${index}`, rect: { x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y } };
      clipDefinitions.push(clip); activeClips = [...activeClips, clip];
    } else if (node.type === 'ClipBoundingBox') {
      const clip = { id: `instant-clip-${index}`, rect: { x: viewX, y: viewY, width: viewWidth, height: viewHeight } };
      clipDefinitions.push(clip); activeClips = [...activeClips, clip];
    } else if (node.type === 'PolygonClip') {
      const points = node.points.map(name => pointMap.get(name)).filter((point): point is GeoPoint => Boolean(point));
      if (points.length === node.points.length) {
        const clip = { id: `instant-clip-${index}`, points: points.map(worldToSvg).map(point => `${point.x},${point.y}`).join(' '), out: node.out };
        clipDefinitions.push(clip); activeClips = [...activeClips, clip];
      }
    } else if (node.type === 'CircleClip') {
      const center = pointMap.get(node.center); const radiusPoint = pointMap.get(node.radius_point);
      if (center && radiusPoint) {
        const svgCenter = worldToSvg(center);
        const clip = { id: `instant-clip-${index}`, circle: { cx: svgCenter.x, cy: svgCenter.y, r: length(subtract(radiusPoint, center)) * WORLD_SCALE }, out: node.out };
        clipDefinitions.push(clip); activeClips = [...activeClips, clip];
      }
    } else if (node.type === 'SectorClip') {
      const center = pointMap.get(node.center); const firstPoint = pointMap.get(node.first);
      if (center) {
        const radius = node.mode === 'R' ? Number(node.first) : firstPoint ? length(subtract(firstPoint, center)) : 0;
        let startAngle: number; let endAngle: number;
        if (node.mode === 'towards') {
          const direction = pointMap.get(node.second[0]);
          startAngle = firstPoint ? Math.atan2(firstPoint.y - center.y, firstPoint.x - center.x) * 180 / Math.PI : NaN;
          endAngle = direction ? Math.atan2(direction.y - center.y, direction.x - center.x) * 180 / Math.PI : NaN;
        } else if (node.mode === 'rotate') {
          const base = firstPoint ? Math.atan2(firstPoint.y - center.y, firstPoint.x - center.x) * 180 / Math.PI : NaN;
          const rotation = Number(node.second[0]); [startAngle, endAngle] = rotation < 0 ? [base + rotation, base] : [base, base + rotation];
        } else { startAngle = Number(node.second[0]); endAngle = Number(node.second[1]); }
        if (radius > 0 && Number.isFinite(startAngle) && Number.isFinite(endAngle)) {
          const c = worldToSvg(center); const r = radius * WORLD_SCALE;
          const start = { x: c.x + r * Math.cos(startAngle * Math.PI / 180), y: c.y - r * Math.sin(startAngle * Math.PI / 180) };
          const end = { x: c.x + r * Math.cos(endAngle * Math.PI / 180), y: c.y - r * Math.sin(endAngle * Math.PI / 180) };
          const delta = ((endAngle - startAngle) % 360 + 360) % 360;
          const clip = { id: `instant-clip-${index}`, path: `M ${c.x} ${c.y} L ${start.x} ${start.y} A ${r} ${r} 0 ${delta > 180 ? 1 : 0} 0 ${end.x} ${end.y} Z` };
          clipDefinitions.push(clip); activeClips = [...activeClips, clip];
        }
      }
    } else if (activeClips.length) clipChains.set(index, [...activeClips]);
  });
  const outsideRectPath = `M ${viewX} ${viewY} H ${viewX + viewWidth} V ${viewY + viewHeight} H ${viewX} Z`;
  return { clipDefinitions, clipChains, outsideRectPath };
};

export const buildFastRenderScene = ({
  nodes,
  viewBox,
  resolvedPoints,
  source,
}: Pick<FastRenderScene, 'nodes' | 'viewBox' | 'resolvedPoints' | 'source'>): FastRenderScene => {
  const points = resolvedPoints;
  const pathLabels = parseFastPathLabels(source);
  const definedLineOptions = buildDefinedLineOptions(nodes, source);
  const { optionItemsByText, stylesByText } = buildFastOptionLookups(nodes, pathLabels, definedLineOptions);
  const clipData = buildFastClipData(nodes, points, viewBox);
  return {
    nodes,
    viewBox,
    resolvedPoints: points,
    source,
    pointAppearances: source ? instantPointAppearances(source, points) : undefined,
    pathLabels,
    definedLineOptions,
    optionItemsByText,
    stylesByText,
    clipData,
  };
};

const PointAppearanceContext = createContext<ReadonlyMap<string, InstantPointAppearance>>(new Map());

const PointMark = ({ point, name, color = '#ef4444' }: { point: GeoPoint; name?: string; color?: string }) => {
  const svgPoint = worldToSvg(point);
  const appearance = useContext(PointAppearanceContext).get(name ?? '');
  const radius = appearance?.radius ?? 3.4;
  const shape = appearance?.shape ?? 'circle';
  const fill = appearance?.fill ?? color;
  const draw = appearance?.draw ?? 'white';
  const crossColor = appearance?.draw ?? appearance?.fill ?? color;
  const crossSize = radius * 1.25;
  const label = name ? `Point ${name}` : undefined;
  const pointLabel = name && (
    <text x={svgPoint.x + 6 + (appearance?.labelDx ?? 0)} y={svgPoint.y - 7 + (appearance?.labelDy ?? 0)} fill={appearance?.labelColor ?? '#334155'} fontSize={10.5} fontFamily="ui-serif, Georgia, serif">
      {appearance?.labelText ?? name}
    </text>
  );
  if (!appearance) {
    return (
      <>
        <circle aria-label={label} data-point-name={name} data-point-shape="circle" cx={svgPoint.x} cy={svgPoint.y} r={radius} fill={fill} stroke={draw} strokeWidth={1.5} />
        {pointLabel}
      </>
    );
  }
  return (
    <g aria-label={label} data-point-name={name} opacity={appearance.opacity}>
      {shape === 'circle' && <circle data-point-shape="circle" cx={svgPoint.x} cy={svgPoint.y} r={radius} fill={fill} stroke={draw} strokeWidth={1.5} />}
      {shape === 'cross' && <g data-point-shape="cross" stroke={crossColor} strokeWidth={1.6} strokeLinecap="round"><line x1={svgPoint.x - crossSize} y1={svgPoint.y} x2={svgPoint.x + crossSize} y2={svgPoint.y} /><line x1={svgPoint.x} y1={svgPoint.y - crossSize} x2={svgPoint.x} y2={svgPoint.y + crossSize} /></g>}
      {shape === 'cross out' && <g data-point-shape="cross out" stroke={crossColor} strokeWidth={1.6} strokeLinecap="round"><line x1={svgPoint.x - crossSize} y1={svgPoint.y - crossSize} x2={svgPoint.x + crossSize} y2={svgPoint.y + crossSize} /><line x1={svgPoint.x - crossSize} y1={svgPoint.y + crossSize} x2={svgPoint.x + crossSize} y2={svgPoint.y - crossSize} /></g>}
      {pointLabel}
    </g>
  );
};

const angleLabelText = (label?: string) => {
  if (!label) return '';
  const greek: Record<string, string> = {
    '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
    '\\epsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ',
  };
  const raw = label.replace(/\$/g, '').trim();
  const arc = raw.match(/^\\widearc\{([^}]*)\}$/);
  if (arc) return `⌢${arc[1]}`;
  const frown = raw.match(/^\\frown\s*(.*)$/);
  if (frown) return `⌢${frown[1]}`;
  return greek[raw] ?? raw.replace(/^\\/, '');
};

const angleRadius = (options?: string) => {
  const match = options?.match(/(?:^|,)\s*size\s*=\s*(-?[\d.]+)/);
  const parsed = match ? Number.parseFloat(match[1]) : 0.5;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0.5;
};

const picAngleAppearance = (options?: string) => {
  const items = splitTikzOptions(options ?? '');
  const radiusText = items.find(option => option.startsWith('angle radius='))?.slice(13).trim() ?? '5mm';
  const numericRadius = Number.parseFloat(radiusText);
  const radius = !Number.isFinite(numericRadius) ? 0.5 : radiusText.endsWith('mm') ? numericRadius / 10 : radiusText.endsWith('pt') ? numericRadius / 28.45274 : numericRadius;
  const eccentricity = Number(items.find(option => option.startsWith('angle eccentricity='))?.slice(19) ?? 0.6);
  const quoted = items.find(option => /^".*"$/.test(option));
  const text = items.find(option => option.startsWith('pic text='))?.slice(9).trim() ?? quoted?.slice(1, -1);
  return { radius: radius > 0 ? radius : 0.5, eccentricity: Number.isFinite(eccentricity) ? eccentricity : 0.6, text };
};

const RightAngleMark = ({ vertex, foot, side, options }: { vertex: GeoPoint; foot: GeoPoint; side: GeoPoint; options?: string }) => {
  const altitudeDirection = normalize(subtract(vertex, foot));
  const sideDirection = normalize(subtract(side, foot));
  if (!altitudeDirection || !sideDirection) return null;
  const optionItems = splitTikzOptions(options ?? '');
  const sizeValue = optionItems.find(option => option.startsWith('size='))?.slice(5);
  const size = Number.isFinite(Number(sizeValue)) && Number(sizeValue) > 0 ? Number(sizeValue) : 0.25;
  const style = parseFastStyle(options);
  if (optionItems.includes('german')) {
    const firstAngle = Math.atan2(altitudeDirection.y, altitudeDirection.x);
    let secondAngle = Math.atan2(sideDirection.y, sideDirection.x);
    while (secondAngle < firstAngle) secondAngle += Math.PI * 2;
    if (secondAngle - firstAngle > Math.PI) secondAngle -= Math.PI * 2;
    const start = worldToSvg(add(foot, scale(altitudeDirection, size)));
    const end = worldToSvg(add(foot, scale(sideDirection, size)));
    const path = `M ${start.x} ${start.y} A ${size * WORLD_SCALE} ${size * WORLD_SCALE} 0 0 ${secondAngle > firstAngle ? 0 : 1} ${end.x} ${end.y}`;
    const middleAngle = (firstAngle + secondAngle) / 2;
    const dot = worldToSvg(add(foot, { x: Math.cos(middleAngle) * size / 2, y: Math.sin(middleAngle) * size / 2 }));
    const dotSize = Number.parseFloat(optionItems.find(option => option.startsWith('dotsize='))?.slice(8) ?? '3') || 3;
    return <g><path d={path} {...svgStyle(style)} fill="none" /><circle cx={dot.x} cy={dot.y} r={dotSize / 2} fill={style.fill === 'transparent' ? style.stroke : style.fill} /></g>;
  }
  const first = add(foot, scale(altitudeDirection, size));
  const corner = add(first, scale(sideDirection, size));
  const second = add(foot, scale(sideDirection, size));
  const points = [foot, first, corner, second].map(worldToSvg).map(point => `${point.x},${point.y}`).join(' ');
  return <polygon points={points} {...svgStyle(style)} fill={style.fill} />;
};

const instantPointAppearances = (source?: string, points?: ReadonlyMap<string, GeoPoint>) => {
  const appearances = new Map<string, InstantPointAppearance>();
  if (!source) return appearances;
  if (!source.includes('\\tkzDrawPoint') && !source.includes('\\tkzLabelPoint') && !source.includes('\\tkzAutoLabelPoints')) return appearances;
  const collect = (command: 'tkzDrawPoint' | 'tkzDrawPoints' | 'tkzLabelPoints' | 'tkzAutoLabelPoints', options: string, names: string) => {
    const style = parseFastStyle(options);
    const optionList = splitTikzOptions(options);
    const size = options.match(/(?:^|,)\s*size\s*=\s*([\d.]+)/)?.[1];
    const positions: Record<string, [number, number]> = { above: [0, -7], below: [0, 14], left: [-14, 7], right: [4, 7], 'above left': [-14, -7], 'above right': [4, -7], 'below left': [-14, 14], 'below right': [4, 14] };
    const position = Object.keys(positions).find(item => new RegExp(`(?:^|,)\\s*${item.replace(' ', '\\s+')}\\s*(?:,|$)`).test(options));
    for (const rawName of names.split(',')) {
      const name = rawName.trim();
      if (!name) continue;
      const current = appearances.get(name) ?? {};
      if (command !== 'tkzLabelPoints' && command !== 'tkzAutoLabelPoints') {
        const rawShape = optionList.find(option => option.startsWith('shape='))?.slice(6).trim();
        const shape = rawShape === 'cross' || rawShape === 'cross out' ? rawShape : 'circle';
        const hasFill = optionList.some(option => option.startsWith('fill='));
        appearances.set(name, {
          ...current,
          fill: hasFill ? style.fill : style.stroke,
          draw: style.stroke,
          opacity: style.opacity,
          radius: size ? Number(size) * 1.13 : undefined,
          shape,
        });
      } else {
        const centerName = optionList.find(option => option.startsWith('center='))?.slice(7).trim();
        const center = centerName ? points?.get(centerName) : undefined;
        const point = points?.get(name);
        const autoDistance = Number(optionList.find(option => option.startsWith('dist='))?.slice(5) ?? 0.15);
        const direction = center && point ? normalize(subtract(point, center)) : null;
        const radialOffset = 6 + (Number.isFinite(autoDistance) ? autoDistance : 0.15) * WORLD_SCALE;
        appearances.set(name, {
          ...current,
          labelColor: style.stroke,
          labelDx: command === 'tkzAutoLabelPoints' && direction ? direction.x * radialOffset : position ? positions[position][0] : undefined,
          labelDy: command === 'tkzAutoLabelPoints' && direction ? -direction.y * radialOffset : position ? positions[position][1] : undefined,
        });
      }
    }
  };
  const pattern = /\\(tkzDrawPoint|tkzDrawPoints|tkzLabelPoints|tkzAutoLabelPoints)(?:\[([^\]]*)\])?\s*\(([^)]*)\)/g;
  for (const match of source.matchAll(pattern)) collect(match[1] as 'tkzDrawPoint' | 'tkzDrawPoints' | 'tkzLabelPoints' | 'tkzAutoLabelPoints', match[2] ?? '', match[3]);
  const singularPattern = /\\tkzLabelPoint(?:\[([^\]]*)\])?\s*\(([^)]*)\)\s*\{([^}]*)\}/g;
  for (const match of source.matchAll(singularPattern)) {
    const name = match[2].trim(); const style = parseFastStyle(match[1] ?? ''); const optionList = splitTikzOptions(match[1] ?? '');
    const positions: Record<string, [number, number]> = { above: [0, -7], below: [0, 14], left: [-14, 7], right: [4, 7], 'above left': [-14, -7], 'above right': [4, -7], 'below left': [-14, 14], 'below right': [4, 14] };
    const position = Object.keys(positions).find(item => optionList.includes(item)); const current = appearances.get(name) ?? {};
    appearances.set(name, { ...current, labelText: angleLabelText(match[3]), labelColor: style.stroke, labelDx: position ? positions[position][0] : current.labelDx, labelDy: position ? positions[position][1] : current.labelDy });
  }
  return appearances;
};

const markAppearance = (options?: string) => {
  const items = splitTikzOptions(options ?? '');
  const optionValue = (key: string, fallback: string) => items.find(option => option.startsWith(`${key}=`))?.slice(key.length + 1).trim() ?? fallback;
  const rawPosition = Number(optionValue('pos', '.5'));
  const rawSize = Number.parseFloat(optionValue('size', '4pt'));
  return {
    mark: optionValue('mark', 'none'),
    position: Number.isFinite(rawPosition) ? Math.max(0, Math.min(1, rawPosition)) : 0.5,
    size: Number.isFinite(rawSize) && rawSize > 0 ? rawSize * 1.75 : 7,
    color: resolveTikzColor(optionValue('color', 'black'), '#111827'),
  };
};

const MarkGlyph = ({ point, angle, options, nodeType, itemKey }: { point: GeoPoint; angle: number; options?: string; nodeType: string; itemKey: string }) => {
  const appearance = markAppearance(options);
  if (appearance.mark === 'none') return null;
  const svgPoint = worldToSvg(point);
  const glyphs: Record<string, string> = { '|': '|', '||': '||', '|||': '|||', s: '/', 's|': '/|', 's||': '/||', z: 'Z', x: '×', o: '○', oo: '○○' };
  return <text key={itemKey} data-node-type={nodeType} data-mark={appearance.mark} x={svgPoint.x} y={svgPoint.y} fill={appearance.color} fontSize={appearance.size} fontFamily="ui-monospace, monospace" fontWeight={700} textAnchor="middle" dominantBaseline="central" transform={`rotate(${-angle} ${svgPoint.x} ${svgPoint.y})`}>{glyphs[appearance.mark] ?? appearance.mark}</text>;
};

interface SvgPoint {
  x: number;
  y: number;
}

const pathArrowForStyle = (style: FastStyle) => style.arrowEach ?? style.arrowMiddle;
const arrowPlacement = (arrow: FastPathArrow) => arrow.each ? 'each' : 'middle';
const clampedPosition = (position: number) => Number.isFinite(position) ? Math.min(Math.max(position, 0), 1) : 0.5;

const renderSvgSegmentArrow = (key: string, start: SvgPoint, end: SvgPoint, style: FastStyle, arrow: FastPathArrow) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return null;
  const position = clampedPosition(arrow.position);
  const tip = { x: start.x + dx * position, y: start.y + dy * position };
  const arrowLength = Math.min(16, Math.max(7, distance * 0.3)) * arrow.scale;
  const tail = { x: tip.x - dx / distance * arrowLength, y: tip.y - dy / distance * arrowLength };
  return (
    <line
      key={key}
      data-arrow-placement={arrowPlacement(arrow)}
      x1={tail.x}
      y1={tail.y}
      x2={tip.x}
      y2={tip.y}
      stroke={style.stroke}
      strokeWidth={style.strokeWidth}
      opacity={style.opacity}
      fill="none"
      strokeLinecap="round"
      markerEnd={`url(#${arrowMarkerId(arrow.tip, 'end')})`}
    />
  );
};

const renderPolylinePathArrows = (key: string, points: SvgPoint[], style: FastStyle, closed = false) => {
  const arrow = pathArrowForStyle(style);
  if (!arrow || points.length < 2) return null;
  const segments = points.slice(0, -1).map((point, index) => [point, points[index + 1]] as const);
  if (closed) segments.push([points[points.length - 1], points[0]]);
  if (arrow.each) {
    return segments.map(([start, end], index) => renderSvgSegmentArrow(`${key}-arrow-${index}`, start, end, style, arrow));
  }

  const lengths = segments.map(([start, end]) => Math.hypot(end.x - start.x, end.y - start.y));
  const total = lengths.reduce((sum, item) => sum + item, 0);
  if (total < 1) return null;
  let remaining = total * clampedPosition(arrow.position);
  for (let index = 0; index < segments.length; index++) {
    if (remaining <= lengths[index] || index === segments.length - 1) {
      const [start, end] = segments[index];
      return renderSvgSegmentArrow(`${key}-arrow`, start, end, style, { ...arrow, position: lengths[index] > 0 ? remaining / lengths[index] : 0.5 });
    }
    remaining -= lengths[index];
  }
  return null;
};

const resolveRendererScene = (props: FastSvgRendererProps): FastRenderScene => 'scene' in props ? props.scene : props;

function FastSvgRendererComponent(props: FastSvgRendererProps) {
  const {
    nodes,
    viewBox,
    resolvedPoints,
    source,
    pointAppearances: scenePointAppearances,
    pathLabels: scenePathLabels,
    definedLineOptions: sceneDefinedLineOptions,
    optionItemsByText: sceneOptionItems,
    stylesByText: sceneStyles,
    clipData: sceneClipData,
  } = resolveRendererScene(props);
  const renderStartedAt = nowMs();
  const pointMap = useMemo(
    () => new Map<string, GeoPoint>(resolvedPoints),
    [resolvedPoints],
  );
  const { options: optionsFor, style: styleFor, commandOptions: commandOptionsFor } = useMemo(
    () => createFastRendererCache(source, sceneOptionItems, sceneStyles),
    [source, sceneOptionItems, sceneStyles],
  );
  const pointAppearances = useMemo(
    () => scenePointAppearances ?? instantPointAppearances(source, pointMap),
    [scenePointAppearances, source, pointMap],
  );
  const pathLabelSpecs = useMemo(
    () => scenePathLabels ?? parseFastPathLabels(source),
    [scenePathLabels, source],
  );
  const getPoint = (name: string) => pointMap.get(name);
  const representedAngleLabels = useMemo(
    () => new Set(nodes
      .filter((node): node is Extract<AstNode, { type: 'AngleMark' }> => node.type === 'AngleMark' && Boolean(node.label))
      .map(node => `${node.p1}\u0000${node.vertex}\u0000${node.p2}`)),
    [nodes],
  );

  useEffect(() => {
    const measuredAt = nowMs();
    const rendererMs = measuredAt - renderStartedAt;
    if (shouldPublishRendererMetric(rendererMs, measuredAt)) {
      useEditorStore.getState().setPerformanceMetrics({ rendererMs });
    }
    logPerformance('renderer', {
      rendererMs,
      nodeCount: nodes.length,
      pointCount: pointMap.size,
    });
  });

  const pathLabelNodes = useMemo<ReactNode[]>(() => {
    const labels: ReactNode[] = [];
    const addPathLabel = (command: string, optionsText: string, p1Name: string, p2Name: string, text: string, labelIndex: number) => {
      const p1 = pointMap.get(p1Name); const p2 = pointMap.get(p2Name);
      if (!p1 || !p2) return;
      const options = optionsFor(optionsText);
      const position = Number(options.find(option => option.startsWith('pos='))?.slice(4) ?? 0.5);
      const t = Number.isFinite(position) ? position : 0.5;
      const first = worldToSvg(p1); const second = worldToSvg(p2);
      const dx = second.x - first.x; const dy = second.y - first.y; const magnitude = Math.hypot(dx, dy) || 1;
      let x = first.x + dx * t; let y = first.y + dy * t;
      const offset = 10; const swap = options.includes('swap');
      if (options.some(option => option.startsWith('above'))) y -= offset;
      else if (options.some(option => option.startsWith('below'))) y += offset;
      else if (options.some(option => option.startsWith('left'))) x -= offset;
      else if (options.some(option => option.startsWith('right'))) x += offset;
      else { const sign = swap ? -1 : 1; x += -dy / magnitude * offset * sign; y += dx / magnitude * offset * sign; }
      let rotation = options.includes('sloped') ? Math.atan2(dy, dx) * 180 / Math.PI : 0;
      if (rotation > 90 || rotation < -90) rotation += 180;
      labels.push(<text key={`path-label-${labelIndex}`} data-label-command={command} x={x} y={y} fill={styleFor(optionsText).stroke} fontSize={10.5} textAnchor="middle" dominantBaseline="central" transform={rotation ? `rotate(${rotation} ${x} ${y})` : undefined}>{angleLabelText(text)}</text>);
    };
    let labelIndex = 0;
    const addAngleLabel = (command: string, optionsText: string, p1Name: string, vertexName: string, p2Name: string, text: string) => {
      const p1 = pointMap.get(p1Name); const vertex = pointMap.get(vertexName); const p2 = pointMap.get(p2Name); if (!p1 || !vertex || !p2) return;
      const first = normalize(subtract(p1, vertex)); const second = normalize(subtract(p2, vertex)); if (!first || !second) return;
      let a1 = Math.atan2(first.y, first.x); let a2 = Math.atan2(second.y, second.x); let delta = (a2 - a1 + Math.PI * 2) % (Math.PI * 2);
      if (delta > Math.PI) { a1 = a2; delta = Math.PI * 2 - delta; }
      const options = optionsFor(optionsText); const distance = Number(options.find(option => option.startsWith('pos='))?.slice(4) ?? options.find(option => option.startsWith('dist='))?.slice(5) ?? 1);
      const point = worldToSvg(add(vertex, { x: Math.cos(a1 + delta / 2) * distance, y: Math.sin(a1 + delta / 2) * distance }));
      labels.push(<text key={`angle-label-${labelIndex++}`} data-label-command={command} x={point.x} y={point.y} fill={styleFor(optionsText).stroke} fontSize={10.5} textAnchor="middle" dominantBaseline="central">{angleLabelText(text)}</text>);
    };
    for (const label of pathLabelSpecs) {
      if (label.kind === 'path') {
        addPathLabel(label.command, label.options, label.p1, label.p2, label.text, labelIndex++);
        continue;
      }
      if (label.kind === 'angle') {
        const representedByNode = representedAngleLabels.has(`${label.p1}\u0000${label.vertex}\u0000${label.p2}`);
        if (!representedByNode) addAngleLabel(label.command, label.options, label.p1, label.vertex, label.p2, label.text);
        continue;
      }
      if (label.kind === 'circle') {
        const center = pointMap.get(label.center); const radiusPoint = pointMap.get(label.radiusPoint); const angle = label.angle; if (!center || !radiusPoint || !Number.isFinite(angle)) continue;
        const radiusVector = subtract(radiusPoint, center); const base = Math.atan2(radiusVector.y, radiusVector.x) + angle * Math.PI / 180; const radius = length(radiusVector);
        const point = worldToSvg(add(center, { x: Math.cos(base) * radius, y: Math.sin(base) * radius }));
        labels.push(<text key={`circle-label-${labelIndex++}`} data-label-command="tkzLabelCircle" x={point.x} y={point.y} fill={styleFor(label.options).stroke} fontSize={10.5} textAnchor="middle" dominantBaseline="central">{angleLabelText(label.text)}</text>);
        continue;
      }
      const center = pointMap.get(label.center); const start = pointMap.get(label.start); const end = pointMap.get(label.end);
      if (!center || !start || !end) continue;
      const startVector = subtract(start, center); const endVector = subtract(end, center); const radius = length(startVector);
      let startAngle = Math.atan2(startVector.y, startVector.x); const endAngle = Math.atan2(endVector.y, endVector.x);
      const delta = (endAngle - startAngle + Math.PI * 2) % (Math.PI * 2);
      const optionsText = label.options; const options = optionsFor(optionsText);
      const rawPosition = Number(options.find(option => option.startsWith('pos='))?.slice(4) ?? .5); const position = Number.isFinite(rawPosition) ? rawPosition : .5;
      startAngle += delta * position;
      const svgPoint = worldToSvg(add(center, { x: Math.cos(startAngle) * radius, y: Math.sin(startAngle) * radius }));
      let x = svgPoint.x; let y = svgPoint.y; const offset = 10;
      if (options.some(option => option.startsWith('above'))) y -= offset;
      else if (options.some(option => option.startsWith('below'))) y += offset;
      else if (options.some(option => option.startsWith('left'))) x -= offset;
      else if (options.some(option => option.startsWith('right'))) x += offset;
      else { x += Math.cos(startAngle) * offset; y -= Math.sin(startAngle) * offset; }
      labels.push(<text key={`arc-label-${labelIndex++}`} data-label-command="tkzLabelArc" x={x} y={y} fill={styleFor(optionsText).stroke} fontSize={10.5} textAnchor="middle" dominantBaseline="central">{angleLabelText(label.text)}</text>);
    }
    return labels;
  }, [optionsFor, pathLabelSpecs, pointMap, representedAngleLabels, styleFor]);

  const renderLine = (key: string, start: GeoPoint, end: GeoPoint, style: FastStyle) => {
    const extended = extendSegment(start, end, style.extendBefore, style.extendAfter);
    const svgStart = worldToSvg(extended.start);
    const svgEnd = worldToSvg(extended.end);
    const line = (
      <line
        key={key}
        x1={svgStart.x}
        y1={svgStart.y}
        x2={svgEnd.x}
        y2={svgEnd.y}
        {...svgStyle(style)}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
    const arrow = pathArrowForStyle(style);
    return arrow ? <g key={key}>{line}{renderSvgSegmentArrow(`${key}-path-arrow`, svgStart, svgEnd, style, arrow)}</g> : line;
  };

  const renderDimension = (start: GeoPoint, end: GeoPoint, options?: string) => {
    const dimension = optionsFor(options).find(option => option.startsWith('dim='));
    if (!dimension) return null;
    const parts = optionsFor(dimension.slice(4).trim().replace(/^\{|\}$/g, ''));
    const position = parts.includes('near start') ? 0.25 : parts.includes('near end') ? 0.75 : 0.5;
    const offset = Number.parseFloat(parts[1] ?? '10') || 10;
    const first = worldToSvg(start);
    const second = worldToSvg(end);
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const magnitude = Math.hypot(dx, dy) || 1;
    const x = first.x + dx * position - dy / magnitude * offset;
    const y = first.y + dy * position + dx / magnitude * offset;
    const rotation = parts.find(part => part.startsWith('rotate='))?.slice(7);
    return <text x={x} y={y} fill="#475569" fontSize={10} textAnchor="middle" transform={rotation ? `rotate(${rotation} ${x} ${y})` : undefined}>{(parts[0] ?? 'd').replace(/\$/g, '')}</text>;
  };

  const renderCircle = (key: string, center: GeoPoint, radiusPoint: GeoPoint, style: FastStyle) => {
    const svgCenter = worldToSvg(center);
    const radius = length(subtract(radiusPoint, center)) * WORLD_SCALE;
    if (!pathArrowForStyle(style)) return <circle key={key} cx={svgCenter.x} cy={svgCenter.y} r={radius} {...svgStyle(style)} />;
    const arrow = pathArrowForStyle(style)!;
    const theta = Math.PI * 2 * clampedPosition(arrow.position);
    const tip = { x: svgCenter.x + radius * Math.cos(theta), y: svgCenter.y - radius * Math.sin(theta) };
    const tangent = { x: -Math.sin(theta), y: -Math.cos(theta) };
    const arrowLength = Math.min(18, Math.max(8, radius * 0.16)) * arrow.scale;
    const tail = { x: tip.x - tangent.x * arrowLength, y: tip.y - tangent.y * arrowLength };
    return (
      <g key={key}>
        <circle cx={svgCenter.x} cy={svgCenter.y} r={radius} {...svgStyle(style)} />
        {renderSvgSegmentArrow(`${key}-circle-arrow`, tail, tip, style, { ...arrow, position: 1 })}
      </g>
    );
  };

  const renderSemiCircle = (key: string, center: GeoPoint, radiusPoint: GeoPoint, style: FastStyle, options?: string) => {
    const svgCenter = worldToSvg(center);
    const start = worldToSvg(radiusPoint);
    const opposite = { x: svgCenter.x * 2 - start.x, y: svgCenter.y * 2 - start.y };
    const radius = length(subtract(radiusPoint, center)) * WORLD_SCALE;
    const swapped = optionsFor(options).includes('swap');
    const path = <path key={key} d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 0 ${swapped ? 1 : 0} ${opposite.x} ${opposite.y}`} {...svgStyle(style)} />;
    const arrow = pathArrowForStyle(style);
    if (!arrow) return path;
    const vector = subtract(radiusPoint, center);
    const baseAngle = Math.atan2(vector.y, vector.x);
    const direction = swapped ? -1 : 1;
    const theta = baseAngle + direction * Math.PI * clampedPosition(arrow.position);
    const tip = { x: svgCenter.x + radius * Math.cos(theta), y: svgCenter.y - radius * Math.sin(theta) };
    const tangent = { x: -Math.sin(theta) * direction, y: -Math.cos(theta) * direction };
    const arrowLength = Math.min(18, Math.max(8, radius * 0.2)) * arrow.scale;
    const tail = { x: tip.x - tangent.x * arrowLength, y: tip.y - tangent.y * arrowLength };
    return <g key={key}>{path}{renderSvgSegmentArrow(`${key}-semi-arrow`, tail, tip, style, { ...arrow, position: 1 })}</g>;
  };

  const renderAngleGraphic = (key: string, p1Name: string, vertexName: string, p2Name: string, options?: string, label?: string, labelScale = 1.4) => {
    const first = getPoint(p1Name);
    const vertex = getPoint(vertexName);
    const second = getPoint(p2Name);
    if (!first || !vertex || !second) return null;
    let firstDirection = normalize(subtract(first, vertex));
    let secondDirection = normalize(subtract(second, vertex));
    if (!firstDirection || !secondDirection) return null;
    let firstAngle = Math.atan2(firstDirection.y, firstDirection.x);
    let secondAngle = Math.atan2(secondDirection.y, secondDirection.x);
    let delta = (secondAngle - firstAngle + Math.PI * 2) % (Math.PI * 2);
    if (delta > Math.PI) {
      [firstDirection, secondDirection] = [secondDirection, firstDirection];
      [firstAngle, secondAngle] = [secondAngle, firstAngle];
      delta = Math.PI * 2 - delta;
    }
    const optionItems = optionsFor(options);
    const radius = angleRadius(options);
    const arcMode = optionItems.find(option => option.startsWith('arc='))?.slice(4) ?? 'l';
    const arcCount = arcMode === 'lll' ? 3 : arcMode === 'll' ? 2 : 1;
    const style = styleFor(options);
    const paths = Array.from({ length: arcCount }, (_, index) => {
      const offset = (index - (arcCount - 1) / 2) * 0.08;
      const arcRadius = Math.max(0.02, radius + offset);
      const start = worldToSvg(add(vertex, scale(firstDirection!, arcRadius)));
      const end = worldToSvg(add(vertex, scale(secondDirection!, arcRadius)));
      return <path key={`${key}-arc-${index}`} d={`M ${start.x} ${start.y} A ${arcRadius * WORLD_SCALE} ${arcRadius * WORLD_SCALE} 0 0 0 ${end.x} ${end.y}`} {...svgStyle(style)} fill="none" strokeLinecap="round" />;
    });
    const mark = optionItems.find(option => option.startsWith('mark='))?.slice(5) ?? 'none';
    const markPosition = Number(optionItems.find(option => option.startsWith('mkpos='))?.slice(6) ?? 0.5);
    const markAngle = firstAngle + delta * (Number.isFinite(markPosition) ? Math.max(0, Math.min(1, markPosition)) : 0.5);
    const markPoint = add(vertex, { x: Math.cos(markAngle) * radius, y: Math.sin(markAngle) * radius });
    const markOptions = `mark=${mark},pos=.5,size=${optionItems.find(option => option.startsWith('mksize='))?.slice(7) ?? '4pt'},color=${optionItems.find(option => option.startsWith('mkcolor='))?.slice(8) ?? 'black'}`;
    const labelPoint = worldToSvg(add(vertex, { x: Math.cos(firstAngle + delta / 2) * radius * labelScale, y: Math.sin(firstAngle + delta / 2) * radius * labelScale }));
    return <g key={key} data-node-type="AngleMark">{paths}<MarkGlyph itemKey={`${key}-mark`} nodeType="AngleEqualityMark" point={markPoint} angle={(firstAngle + delta / 2) * 180 / Math.PI + 90} options={markOptions} />{label && <text x={labelPoint.x} y={labelPoint.y} fill={style.stroke} fontSize={10.5} textAnchor="middle">{angleLabelText(label)}</text>}</g>;
  };

  const renderCompassTrace = (key: string, center: GeoPoint, through: GeoPoint, optionsText?: string) => {
    const vector = subtract(through, center); const radius = length(vector); if (radius <= 1e-9) return null;
    const options = optionsFor(optionsText);
    const deltaOption = Number(options.find(option => option.startsWith('delta='))?.slice(6) ?? 0);
    const arcLength = Number(options.find(option => option.startsWith('length='))?.slice(7) ?? 1);
    const halfAngle = Number.isFinite(deltaOption) && deltaOption !== 0 ? Math.abs(deltaOption) : Math.min((Number.isFinite(arcLength) ? arcLength : 1) / radius * 180 / Math.PI, 180) / 2;
    const direction = Math.atan2(vector.y, vector.x); const offset = halfAngle * Math.PI / 180;
    const start = add(center, { x: Math.cos(direction - offset) * radius, y: Math.sin(direction - offset) * radius });
    const end = add(center, { x: Math.cos(direction + offset) * radius, y: Math.sin(direction + offset) * radius });
    const svgStart = worldToSvg(start); const svgEnd = worldToSvg(end); const svgRadius = radius * WORLD_SCALE;
    return <path key={key} d={`M ${svgStart.x} ${svgStart.y} A ${svgRadius} ${svgRadius} 0 0 0 ${svgEnd.x} ${svgEnd.y}`} {...svgStyle(styleFor(optionsText))} fill="none" />;
  };

  const renderNode = (node: AstNode, index: number): ReactNode => {
    const key = `${node.type}-${index}`;
    let style = styleFor('options' in node ? node.options : undefined);
    if (node.type === 'DefinedLine') {
      let optionsText: string | null | undefined;
      if (sceneDefinedLineOptions?.has(index)) optionsText = sceneDefinedLineOptions.get(index) ?? null;
      else if (source) {
        const target = definedLineCommandTarget(node);
        if (target) optionsText = commandOptionsFor(target);
      }
      if (optionsText !== undefined) style = styleFor(optionsText);
    }

    if (node.type === 'Point') return null;

    if (node.type === 'CanvasInit' || node.type === 'CanvasClip' || node.type === 'ClipBoundingBox' || node.type === 'PolygonClip' || node.type === 'CircleClip' || node.type === 'SectorClip') return null;

    if (node.type === 'ShowBoundingBox') {
      const init = [...nodes.slice(0, index)].reverse().find((item): item is Extract<AstNode, { type: 'CanvasInit' }> => item.type === 'CanvasInit');
      const [vx, vy, vw, vh] = viewBox.split(/\s+/).map(Number);
      const topLeft = init ? worldToSvg({ x: init.xmin, y: init.ymax }) : { x: vx, y: vy };
      const bottomRight = init ? worldToSvg({ x: init.xmax, y: init.ymin }) : { x: vx + vw, y: vy + vh };
      return <rect key={key} data-node-type="ShowBoundingBox" x={topLeft.x} y={topLeft.y} width={bottomRight.x - topLeft.x} height={bottomRight.y - topLeft.y} {...svgStyle(style)} />;
    }

    if (node.type === 'Compass') {
      const center = getPoint(node.center); const through = getPoint(node.through);
      return center && through ? <g key={key} data-node-type="Compass">{renderCompassTrace(`${key}-arc`, center, through, node.options)}</g> : null;
    }

    if (node.type === 'Compasses') {
      return <g key={key} data-node-type="Compasses">{node.pairs.map(([centerName, throughName], pairIndex) => {
        const center = getPoint(centerName); const through = getPoint(throughName);
        return center && through ? renderCompassTrace(`${key}-${pairIndex}`, center, through, node.options) : null;
      })}</g>;
    }

    if (node.type === 'ShowLine') {
      const points = node.points.map(getPoint); if (points.some(point => !point)) return null;
      const traces: ReactNode[] = [];
      if (node.mode === 'bisector' && points[0] && points[1] && points[2]) {
        traces.push(renderCompassTrace(`${key}-first`, points[1], points[0], node.options));
        traces.push(renderCompassTrace(`${key}-second`, points[1], points[2], node.options));
      } else if (points[0] && points[1]) {
        traces.push(renderCompassTrace(`${key}-first`, points[0], points[1], node.options));
        traces.push(renderCompassTrace(`${key}-second`, points[1], points[0], node.options));
        const through = node.through ? getPoint(node.through) : undefined;
        if (through) traces.push(renderCompassTrace(`${key}-through`, through, points[0], node.options));
      }
      return <g key={key} data-node-type="ShowLine">{traces}</g>;
    }

    if (node.type === 'Segment' && batchedSegments.indexes.has(index)) return null;

    if (node.type === 'Segment') {
      const start = getPoint(node.p1);
      const end = getPoint(node.p2);
      return start && end ? <g key={key} data-node-type="Segment">{renderLine(`${key}-line`, start, end, style)}{renderDimension(start, end, node.options)}</g> : null;
    }

    if (node.type === 'Line') {
      const start = getPoint(node.p1);
      const end = getPoint(node.p2);
      return start && end ? <g key={key} data-node-type="Line">{renderLine(`${key}-line`, start, end, style)}</g> : null;
    }

    if (node.type === 'Lines' || node.type === 'Segments') {
      return <g key={key} data-node-type={node.type}>{node.pairs.map(([first, second], pairIndex) => {
        const start = getPoint(first);
        const end = getPoint(second);
        return start && end ? renderLine(`${key}-${pairIndex}`, start, end, style) : null;
      })}</g>;
    }

    if (node.type === 'SegmentMark') {
      const start = getPoint(node.p1);
      const end = getPoint(node.p2);
      if (!start || !end) return null;
      const appearance = markAppearance(node.options);
      const point = add(start, scale(subtract(end, start), appearance.position));
      const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
      return <MarkGlyph key={key} itemKey={key} nodeType="SegmentMark" point={point} angle={angle} options={node.options} />;
    }

    if (node.type === 'SegmentsMark') {
      const appearance = markAppearance(node.options);
      return <g key={key} data-node-type="SegmentsMark">{node.pairs.map(([firstName, secondName], pairIndex) => {
        const start = getPoint(firstName);
        const end = getPoint(secondName);
        if (!start || !end) return null;
        const point = add(start, scale(subtract(end, start), appearance.position));
        const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
        return <MarkGlyph key={`${key}-${pairIndex}`} itemKey={`${key}-${pairIndex}`} nodeType="SegmentMark" point={point} angle={angle} options={node.options} />;
      })}</g>;
    }

    if (node.type === 'ArcMark') {
      const center = getPoint(node.center);
      const start = getPoint(node.start);
      const end = getPoint(node.end);
      if (!center || !start || !end) return null;
      const radius = length(subtract(start, center));
      if (radius <= 1e-9) return null;
      const startAngle = Math.atan2(start.y - center.y, start.x - center.x) * 180 / Math.PI;
      const endAngle = Math.atan2(end.y - center.y, end.x - center.x) * 180 / Math.PI;
      const delta = ((endAngle - startAngle) % 360 + 360) % 360;
      const appearance = markAppearance(node.options);
      const markAngle = startAngle + delta * appearance.position;
      const radians = markAngle * Math.PI / 180;
      const point = add(center, { x: radius * Math.cos(radians), y: radius * Math.sin(radians) });
      return <MarkGlyph key={key} itemKey={key} nodeType="ArcMark" point={point} angle={markAngle + 90} options={node.options} />;
    }

    if (node.type === 'PolySeg') {
      const points = node.points.map(getPoint);
      if (points.some(point => !point)) return null;
      const svgPoints = (points as GeoPoint[]).map(worldToSvg);
      const pointsAttr = svgPoints.map(point => `${point.x},${point.y}`).join(' ');
      const polyline = <polyline key={`${key}-path`} points={pointsAttr} {...svgStyle(style)} strokeLinejoin="round" />;
      const arrows = renderPolylinePathArrows(key, svgPoints, style);
      return arrows ? <g key={key} data-node-type="PolySeg">{polyline}{arrows}</g> : <polyline key={key} data-node-type="PolySeg" points={pointsAttr} {...svgStyle(style)} strokeLinejoin="round" />;
    }

    if (node.type === 'Circles') {
      return <g key={key} data-node-type="Circles">{node.pairs.map(([centerName, radiusName], pairIndex) => {
        const center = getPoint(centerName);
        const radiusPoint = getPoint(radiusName);
        return center && radiusPoint ? renderCircle(`${key}-${pairIndex}`, center, radiusPoint, style) : null;
      })}</g>;
    }

    if (node.type === 'SemiCircle') {
      const center = getPoint(node.center);
      const radiusPoint = getPoint(node.radius_point);
      return center && radiusPoint ? <g key={key} data-node-type="SemiCircle">{renderSemiCircle(`${key}-arc`, center, radiusPoint, style, node.options)}</g> : null;
    }

    if (node.type === 'SemiCircles') {
      return <g key={key} data-node-type="SemiCircles">{node.pairs.map(([centerName, radiusName], pairIndex) => {
        const center = getPoint(centerName);
        const radiusPoint = getPoint(radiusName);
        return center && radiusPoint ? renderSemiCircle(`${key}-${pairIndex}`, center, radiusPoint, style, node.options) : null;
      })}</g>;
    }

    if (node.type === 'Polygon') {
      const points = node.points.map(getPoint);
      if (points.some(point => !point)) return null;
      const svgPoints = (points as GeoPoint[]).map(worldToSvg);
      const pointsAttr = svgPoints.map(point => `${point.x},${point.y}`).join(' ');
      const polygon = <polygon key={`${key}-path`} points={pointsAttr} {...svgStyle(style)} strokeLinejoin="round" />;
      const arrows = renderPolylinePathArrows(key, svgPoints, style, true);
      return arrows ? <g key={key} data-node-type="Polygon">{polygon}{arrows}</g> : <polygon key={key} data-node-type="Polygon" points={pointsAttr} {...svgStyle(style)} strokeLinejoin="round" />;
    }

    if (node.type === 'Circle') {
      const center = getPoint(node.center);
      const radiusPoint = getPoint(node.radius_point);
      if (!center || !radiusPoint) return null;
      return renderCircle(key, center, radiusPoint, style);
    }

    if (node.type === 'FillCircle') {
      const center = getPoint(node.center);
      const radiusPoint = node.mode === 'radius' ? getPoint(node.radius) : null;
      const radius = node.mode === 'R' ? Number(node.radius) : center && radiusPoint ? length(subtract(radiusPoint, center)) : 0;
      if (!center || !Number.isFinite(radius) || radius <= 0) return null;
      const svgCenter = worldToSvg(center);
      return <circle key={key} data-node-type="FillCircle" cx={svgCenter.x} cy={svgCenter.y} r={radius * WORLD_SCALE} fill={fillColor(node.options, style, optionsFor(node.options))} opacity={style.opacity} stroke="none" />;
    }

    if (node.type === 'FillPolygon') {
      const points = node.points.map(getPoint);
      if (points.some(point => !point)) return null;
      const pointsAttr = (points as GeoPoint[]).map(worldToSvg).map(point => `${point.x},${point.y}`).join(' ');
      return <polygon key={key} data-node-type="FillPolygon" points={pointsAttr} fill={fillColor(node.options, style, optionsFor(node.options))} opacity={style.opacity} stroke="none" />;
    }

    if (node.type === 'Arc') {
      const center = getPoint(node.center);
      if (!center) return null;
      const firstPoint = getPoint(node.first);
      const optionItems = optionsFor(node.options);
      const delta = Number(optionItems.find(option => option.startsWith('delta='))?.slice(6) ?? 0) || 0;
      const reverse = optionItems.includes('reverse');
      let radius = node.mode === 'R' || node.mode === 'R_with_nodes' ? Number(node.first) : firstPoint ? length(subtract(firstPoint, center)) : 0;
      let startAngle: number;
      let endAngle: number;
      if (node.mode === 'towards') {
        const directionPoint = getPoint(node.second[0]);
        if (!firstPoint || !directionPoint) return null;
        startAngle = Math.atan2(firstPoint.y - center.y, firstPoint.x - center.x) * 180 / Math.PI;
        endAngle = Math.atan2(directionPoint.y - center.y, directionPoint.x - center.x) * 180 / Math.PI;
      } else if (node.mode === 'rotate') {
        if (!firstPoint) return null;
        startAngle = Math.atan2(firstPoint.y - center.y, firstPoint.x - center.x) * 180 / Math.PI;
        endAngle = startAngle + Number(node.second[0]);
      } else if (node.mode === 'R_with_nodes') {
        const startNode = getPoint(node.second[0]);
        const endNode = getPoint(node.second[1]);
        if (!startNode || !endNode) return null;
        startAngle = Math.atan2(startNode.y - center.y, startNode.x - center.x) * 180 / Math.PI;
        endAngle = Math.atan2(endNode.y - center.y, endNode.x - center.x) * 180 / Math.PI;
      } else {
        if (node.mode === 'angles' && !firstPoint) return null;
        startAngle = Number(node.second[0]);
        endAngle = Number(node.second[1]);
      }
      if (!Number.isFinite(radius) || radius <= 0 || !Number.isFinite(startAngle) || !Number.isFinite(endAngle)) return null;
      startAngle -= delta;
      endAngle += delta;
      if (reverse) [startAngle, endAngle] = [endAngle, startAngle];
      const svgCenter = worldToSvg(center);
      const svgStart = { x: svgCenter.x + radius * WORLD_SCALE * Math.cos(startAngle * Math.PI / 180), y: svgCenter.y - radius * WORLD_SCALE * Math.sin(startAngle * Math.PI / 180) };
      const svgEnd = { x: svgCenter.x + radius * WORLD_SCALE * Math.cos(endAngle * Math.PI / 180), y: svgCenter.y - radius * WORLD_SCALE * Math.sin(endAngle * Math.PI / 180) };
      const ccwAngle = ((endAngle - startAngle) % 360 + 360) % 360;
      const largeArc = ccwAngle > 180 ? 1 : 0;
      const path = `M ${svgStart.x} ${svgStart.y} A ${radius * WORLD_SCALE} ${radius * WORLD_SCALE} 0 ${largeArc} 0 ${svgEnd.x} ${svgEnd.y}`;
      const arcPath = <path key={`${key}-path`} d={path} {...svgStyle(style)} fill="none" strokeLinecap="round" />;
      const arrow = pathArrowForStyle(style);
      if (!arrow) return <path key={key} data-node-type="Arc" d={path} {...svgStyle(style)} fill="none" strokeLinecap="round" />;
      const theta = (startAngle + ccwAngle * clampedPosition(arrow.position)) * Math.PI / 180;
      const arrowRadius = radius * WORLD_SCALE;
      const tip = { x: svgCenter.x + arrowRadius * Math.cos(theta), y: svgCenter.y - arrowRadius * Math.sin(theta) };
      const tangent = { x: -Math.sin(theta), y: -Math.cos(theta) };
      const arrowLength = Math.min(18, Math.max(8, arrowRadius * 0.18)) * arrow.scale;
      const tail = { x: tip.x - tangent.x * arrowLength, y: tip.y - tangent.y * arrowLength };
      return <g key={key} data-node-type="Arc">{arcPath}{renderSvgSegmentArrow(`${key}-arc-arrow`, tail, tip, style, { ...arrow, position: 1 })}</g>;
    }

    if (node.type === 'Sector') {
      const center = getPoint(node.center);
      if (!center) return null;
      const firstPoint = getPoint(node.first);
      const radius = node.mode === 'R' || node.mode === 'R_with_nodes'
        ? Number(node.first)
        : firstPoint ? length(subtract(firstPoint, center)) : 0;
      let startAngle: number;
      let endAngle: number;
      if (node.mode === 'towards') {
        const directionPoint = getPoint(node.second[0]);
        if (!firstPoint || !directionPoint) return null;
        startAngle = Math.atan2(firstPoint.y - center.y, firstPoint.x - center.x) * 180 / Math.PI;
        endAngle = Math.atan2(directionPoint.y - center.y, directionPoint.x - center.x) * 180 / Math.PI;
      } else if (node.mode === 'rotate') {
        if (!firstPoint) return null;
        const baseAngle = Math.atan2(firstPoint.y - center.y, firstPoint.x - center.x) * 180 / Math.PI;
        const rotation = Number(node.second[0]);
        [startAngle, endAngle] = rotation < 0 ? [baseAngle + rotation, baseAngle] : [baseAngle, baseAngle + rotation];
      } else if (node.mode === 'R_with_nodes') {
        const startNode = getPoint(node.second[0]);
        const endNode = getPoint(node.second[1]);
        if (!startNode || !endNode) return null;
        startAngle = Math.atan2(startNode.y - center.y, startNode.x - center.x) * 180 / Math.PI;
        endAngle = Math.atan2(endNode.y - center.y, endNode.x - center.x) * 180 / Math.PI;
      } else {
        startAngle = Number(node.second[0]);
        endAngle = Number(node.second[1]);
      }
      if (!Number.isFinite(radius) || radius <= 0 || !Number.isFinite(startAngle) || !Number.isFinite(endAngle)) return null;
      const svgCenter = worldToSvg(center);
      const svgStart = { x: svgCenter.x + radius * WORLD_SCALE * Math.cos(startAngle * Math.PI / 180), y: svgCenter.y - radius * WORLD_SCALE * Math.sin(startAngle * Math.PI / 180) };
      const svgEnd = { x: svgCenter.x + radius * WORLD_SCALE * Math.cos(endAngle * Math.PI / 180), y: svgCenter.y - radius * WORLD_SCALE * Math.sin(endAngle * Math.PI / 180) };
      const ccwAngle = ((endAngle - startAngle) % 360 + 360) % 360;
      const largeArc = ccwAngle > 180 ? 1 : 0;
      const path = `M ${svgCenter.x} ${svgCenter.y} L ${svgStart.x} ${svgStart.y} A ${radius * WORLD_SCALE} ${radius * WORLD_SCALE} 0 ${largeArc} 0 ${svgEnd.x} ${svgEnd.y} Z`;
      return <path key={key} data-node-type="Sector" d={path} {...svgStyle(style)} strokeLinejoin="round" />;
    }

    if (node.type === 'FillSector') {
      const center = getPoint(node.center);
      if (!center) return null;
      const firstPoint = getPoint(node.first);
      const radius = node.mode === 'R' || node.mode === 'R_with_nodes' ? Number(node.first) : firstPoint ? length(subtract(firstPoint, center)) : 0;
      let startAngle: number;
      let endAngle: number;
      if (node.mode === 'towards') {
        const directionPoint = getPoint(node.second[0]);
        if (!firstPoint || !directionPoint) return null;
        startAngle = Math.atan2(firstPoint.y - center.y, firstPoint.x - center.x) * 180 / Math.PI;
        endAngle = Math.atan2(directionPoint.y - center.y, directionPoint.x - center.x) * 180 / Math.PI;
      } else if (node.mode === 'rotate') {
        if (!firstPoint) return null;
        const baseAngle = Math.atan2(firstPoint.y - center.y, firstPoint.x - center.x) * 180 / Math.PI;
        const rotation = Number(node.second[0]);
        [startAngle, endAngle] = rotation < 0 ? [baseAngle + rotation, baseAngle] : [baseAngle, baseAngle + rotation];
      } else if (node.mode === 'R_with_nodes') {
        const startNode = getPoint(node.second[0]);
        const endNode = getPoint(node.second[1]);
        if (!startNode || !endNode) return null;
        startAngle = Math.atan2(startNode.y - center.y, startNode.x - center.x) * 180 / Math.PI;
        endAngle = Math.atan2(endNode.y - center.y, endNode.x - center.x) * 180 / Math.PI;
      } else {
        startAngle = Number(node.second[0]);
        endAngle = Number(node.second[1]);
      }
      if (!Number.isFinite(radius) || radius <= 0 || !Number.isFinite(startAngle) || !Number.isFinite(endAngle)) return null;
      const svgCenter = worldToSvg(center);
      const svgStart = { x: svgCenter.x + radius * WORLD_SCALE * Math.cos(startAngle * Math.PI / 180), y: svgCenter.y - radius * WORLD_SCALE * Math.sin(startAngle * Math.PI / 180) };
      const svgEnd = { x: svgCenter.x + radius * WORLD_SCALE * Math.cos(endAngle * Math.PI / 180), y: svgCenter.y - radius * WORLD_SCALE * Math.sin(endAngle * Math.PI / 180) };
      const ccwAngle = ((endAngle - startAngle) % 360 + 360) % 360;
      const path = `M ${svgCenter.x} ${svgCenter.y} L ${svgStart.x} ${svgStart.y} A ${radius * WORLD_SCALE} ${radius * WORLD_SCALE} 0 ${ccwAngle > 180 ? 1 : 0} 0 ${svgEnd.x} ${svgEnd.y} Z`;
      return <path key={key} data-node-type="FillSector" d={path} fill={fillColor(node.options, style, optionsFor(node.options))} opacity={style.opacity} stroke="none" />;
    }

    if (node.type === 'Ellipse') {
      const center = getPoint(node.center);
      if (!center) return null;
      const svgCenter = worldToSvg(center);
      return <ellipse key={key} data-node-type="Ellipse" cx={svgCenter.x} cy={svgCenter.y} rx={node.x_radius * WORLD_SCALE} ry={node.y_radius * WORLD_SCALE} transform={`rotate(${-node.angle} ${svgCenter.x} ${svgCenter.y})`} {...svgStyle(style)} />;
    }

    if (node.type === 'DefinedLine') {
      const results = node.results.map(getPoint);
      if (results.some(point => !point)) return null;
      const resolved = results as GeoPoint[];
      const through = node.through ? getPoint(node.through) : undefined;
      const start = ['perpendicular', 'orthogonal', 'parallel', 'tangent_at', 'tangent_from'].includes(node.mode) ? through : getPoint(node.points[1]);
      const lines = node.mode === 'tangent_from' && start
        ? [renderLine(`${key}-first`, start, resolved[0], style), renderLine(`${key}-second`, start, resolved[1], style)]
        : node.results.length === 2
          ? [renderLine(`${key}-line`, resolved[0], resolved[1], style)]
          : start ? [renderLine(`${key}-line`, start, resolved[0], style)] : [];
      return <Fragment key={key}>{lines}{resolved.map((point, index) => <PointMark key={node.results[index]} point={point} name={node.results[index]} color="#2563eb" />)}</Fragment>;
    }

    if (node.type === 'PerpendicularLine') {
      const base1 = getPoint(node.p1);
      const base2 = getPoint(node.p2);
      const through = getPoint(node.through);
      const baseDirection = base1 && base2 ? normalize(subtract(base2, base1)) : null;
      if (!baseDirection || !through) return null;
      return renderLine(key, through, add(through, perpendicular(baseDirection)), style);
    }

    if (node.type === 'ProjectionLine') {
      const base1 = getPoint(node.p1);
      const base2 = getPoint(node.p2);
      const from = getPoint(node.from);
      const foot = base1 && base2 && from ? projectPointOnLine(from, base1, base2) : null;
      if (!base1 || !from || !foot) return null;
      const drawableEnd = length(subtract(foot, from)) > 1e-9
        ? foot
        : add(from, perpendicular(normalize(subtract(base2!, base1)) || { x: 1, y: 0 }));
      return (
        <Fragment key={key}>
          {renderLine(`${key}-line`, from, drawableEnd, style)}
          <PointMark point={foot} name={node.foot} color="#0ea5e9" />
          <RightAngleMark vertex={from} foot={foot} side={base1} />
        </Fragment>
      );
    }

    if (node.type === 'PerpendicularBisector') {
      const first = getPoint(node.p1);
      const second = getPoint(node.p2);
      const direction = first && second ? normalize(subtract(second, first)) : null;
      if (!first || !second || !direction) return null;
      const center = midpoint(first, second);
      const perpendicularDirection = perpendicular(direction);
      return renderLine(key, add(center, scale(perpendicularDirection, -1)), add(center, perpendicularDirection), style);
    }

    if (node.type === 'AngleBisector') {
      const side1 = getPoint(node.p1);
      const vertex = getPoint(node.vertex);
      const side2 = getPoint(node.p2);
      const direction = side1 && vertex && side2 ? internalAngleBisectorDirection(side1, vertex, side2) : null;
      return vertex && direction ? renderLine(key, vertex, add(vertex, direction), style) : null;
    }

    if (node.type === 'TriangleAltitude') {
      const side1 = getPoint(node.side1);
      const vertex = getPoint(node.vertex);
      const side2 = getPoint(node.side2);
      const foot = side1 && vertex && side2 ? projectPointOnLine(vertex, side1, side2) : null;
      if (!side1 || !vertex || !foot) return null;
      return (
        <Fragment key={key}>
          {renderLine(`${key}-line`, vertex, foot, style)}
          <PointMark point={foot} name={node.foot} color="#10b981" />
          <RightAngleMark vertex={vertex} foot={foot} side={side1} />
        </Fragment>
      );
    }

    if (node.type === 'AllAltitudes') {
      const a = getPoint(node.p1);
      const b = getPoint(node.p2);
      const c = getPoint(node.p3);
      if (!a || !b || !c) return null;
      const { footA, footB, footC } = triangleFeet(a, b, c);
      const orthocenter = triangleOrthocenter(a, b, c);
      if (!footA || !footB || !footC || !orthocenter) return null;
      return (
        <Fragment key={key}>
          {renderLine(`${key}-a`, a, footA, style)}
          {renderLine(`${key}-b`, b, footB, style)}
          {renderLine(`${key}-c`, c, footC, style)}
          <PointMark point={footA} name={node.foot1} color="#10b981" />
          <PointMark point={footB} name={node.foot2} color="#10b981" />
          <PointMark point={footC} name={node.foot3} color="#10b981" />
          <PointMark point={orthocenter} name={node.orthocenter} color="#f43f5e" />
          <RightAngleMark vertex={a} foot={footA} side={c} />
          <RightAngleMark vertex={b} foot={footB} side={a} />
          <RightAngleMark vertex={c} foot={footC} side={a} />
        </Fragment>
      );
    }

    if (node.type === 'AngleMark') {
      return renderAngleGraphic(key, node.p1, node.vertex, node.p2, node.options, node.label);
    }

    if (node.type === 'AnglesMark') {
      return <g key={key} data-node-type="AnglesMark">{node.angles.map(([p1, vertex, p2], angleIndex) => renderAngleGraphic(`${key}-${angleIndex}`, p1, vertex, p2, node.options))}</g>;
    }

    if (node.type === 'RightAngleMark') {
      const p1 = getPoint(node.p1); const vertex = getPoint(node.vertex); const p2 = getPoint(node.p2);
      return p1 && vertex && p2 ? <g key={key} data-node-type="RightAngleMark"><RightAngleMark vertex={p1} foot={vertex} side={p2} options={node.options} /></g> : null;
    }

    if (node.type === 'RightAnglesMark') {
      return <g key={key} data-node-type="RightAnglesMark">{node.angles.map(([p1Name, vertexName, p2Name], angleIndex) => {
        const p1 = getPoint(p1Name); const vertex = getPoint(vertexName); const p2 = getPoint(p2Name);
        return p1 && vertex && p2 ? <RightAngleMark key={`${key}-${angleIndex}`} vertex={p1} foot={vertex} side={p2} options={node.options} /> : null;
      })}</g>;
    }

    if (node.type === 'PicAngle') {
      const appearance = picAngleAppearance(node.options);
      return <g key={key} data-node-type="PicAngle">{renderAngleGraphic(`${key}-angle`, node.p1, node.vertex, node.p2, `${node.options ?? ''},size=${appearance.radius}`, appearance.text, appearance.eccentricity)}</g>;
    }

    if (node.type === 'PicRightAngle') {
      const p1 = getPoint(node.p1); const vertex = getPoint(node.vertex); const p2 = getPoint(node.p2);
      if (!p1 || !vertex || !p2) return null;
      const appearance = picAngleAppearance(node.options);
      const firstDirection = normalize(subtract(p1, vertex)); const secondDirection = normalize(subtract(p2, vertex));
      const labelDirection = firstDirection && secondDirection ? normalize(add(firstDirection, secondDirection)) : null;
      const labelPoint = labelDirection ? worldToSvg(add(vertex, scale(labelDirection, appearance.radius * appearance.eccentricity))) : null;
      return <g key={key} data-node-type="PicRightAngle"><RightAngleMark vertex={p1} foot={vertex} side={p2} options={`${node.options ?? ''},size=${appearance.radius}`} />{appearance.text && labelPoint && <text x={labelPoint.x} y={labelPoint.y} fill={styleFor(node.options).stroke} fontSize={10.5} textAnchor="middle" dominantBaseline="central">{angleLabelText(appearance.text)}</text>}</g>;
    }

    if (node.type === 'FillAngle' || node.type === 'FillAngles') {
      const sizeOption = optionsFor(node.options).find(option => option.startsWith('size='))?.slice(5);
      const radius = Number(sizeOption ?? 1);
      if (!Number.isFinite(radius) || radius <= 0) return null;
      const angles: [string, string, string][] = node.type === 'FillAngle' ? [[node.p1, node.vertex, node.p2]] : node.angles;
      const paths = angles.map(([p1, vertexName, p2], index) => {
        const first = getPoint(p1); const vertex = getPoint(vertexName); const second = getPoint(p2);
        if (!first || !vertex || !second) return null;
        const firstDirection = normalize(subtract(first, vertex)); const secondDirection = normalize(subtract(second, vertex));
        if (!firstDirection || !secondDirection) return null;
        const firstAngle = Math.atan2(firstDirection.y, firstDirection.x); const secondAngle = Math.atan2(secondDirection.y, secondDirection.x);
        const delta = (secondAngle - firstAngle + Math.PI * 2) % (Math.PI * 2);
        const svgVertex = worldToSvg(vertex); const start = worldToSvg(add(vertex, scale(firstDirection, radius))); const end = worldToSvg(add(vertex, scale(secondDirection, radius)));
        const path = `M ${svgVertex.x} ${svgVertex.y} L ${start.x} ${start.y} A ${radius * WORLD_SCALE} ${radius * WORLD_SCALE} 0 ${delta > Math.PI ? 1 : 0} 0 ${end.x} ${end.y} Z`;
        return <path key={`${key}-${index}`} d={path} fill={fillColor(node.options, style, optionsFor(node.options))} opacity={style.opacity} stroke="none" />;
      });
      return <g key={key} data-node-type={node.type}>{paths}</g>;
    }

    if (node.type === 'IntersectionPoint') {
      const intersection = getPoint(node.name);
      return intersection ? (
        <g key={key} data-node-type="IntersectionPoint">
          <PointMark point={intersection} name={node.name} color="#8b5cf6" />
        </g>
      ) : null;
    }

    if (node.type === 'MidPoint') {
      const point = getPoint(node.name);
      return point ? (
        <g key={key} data-node-type="MidPoint">
          <PointMark point={point} name={node.name} color="#06b6d4" />
        </g>
      ) : null;
    }

    if (node.type === 'GoldenRatioPoint') {
      const point = getPoint(node.name);
      return point ? (
        <g key={key} data-node-type="GoldenRatioPoint">
          <PointMark point={point} name={node.name} color="#f59e0b" />
        </g>
      ) : null;
    }

    if (node.type === 'BarycentricPoint') {
      const point = getPoint(node.name);
      return point ? (
        <g key={key} data-node-type="BarycentricPoint">
          <PointMark point={point} name={node.name} color="#a855f7" />
        </g>
      ) : null;
    }

    if (node.type === 'SimilitudeCenter' || node.type === 'HarmonicPoint') {
      const point = getPoint(node.name);
      return point ? <g key={key} data-node-type={node.type}><PointMark point={point} name={node.name} color={node.type === 'SimilitudeCenter' ? '#14b8a6' : '#ec4899'} /></g> : null;
    }

    if (node.type === 'HarmonicPair' || node.type === 'EquiPoints') {
      const first = getPoint(node.name1);
      const second = getPoint(node.name2);
      if (!first || !second) return null;
      return (
        <g key={key} data-node-type={node.type}>
          <PointMark point={first} name={node.name1} color={node.type === 'HarmonicPair' ? '#ec4899' : '#0ea5e9'} />
          <PointMark point={second} name={node.name2} color={node.type === 'HarmonicPair' ? '#ec4899' : '#0ea5e9'} />
        </g>
      );
    }

    if (node.type === 'MidArcPoint' || node.type === 'PointOnLine' || node.type === 'PointOnCircle' || node.type === 'RandomPoint') {
      const point = getPoint(node.name);
      return point ? <g key={key} data-node-type={node.type}><PointMark point={point} name={node.name} color={node.type === 'MidArcPoint' ? '#f97316' : node.type === 'PointOnLine' ? '#22c55e' : '#6366f1'} /></g> : null;
    }

    if (node.type === 'TriangleCenter') {
      const point = getPoint(node.name);
      return point ? <g key={key} data-node-type="TriangleCenter"><PointMark point={point} name={node.name} color="#e11d48" /></g> : null;
    }

    if (node.type === 'PointTransformation') {
      const point = getPoint(node.name);
      return point ? <g key={key} data-node-type="PointTransformation"><PointMark point={point} name={node.name} color="#8b5cf6" /></g> : null;
    }

    if (node.type === 'PointsTransformation') {
      const points = node.names.map(name => ({ name, point: getPoint(name) })).filter((item): item is { name: string; point: GeoPoint } => Boolean(item.point));
      return points.length > 0 ? <g key={key} data-node-type="PointsTransformation">{points.map(item => <PointMark key={item.name} point={item.point} name={item.name} color="#d946ef" />)}</g> : null;
    }

    if (node.type === 'VectorPoint') {
      const point = getPoint(node.name);
      return point ? <g key={key} data-node-type="VectorPoint"><PointMark point={point} name={node.name} color="#0ea5e9" /></g> : null;
    }

    if (node.type === 'DefinedTriangle') {
      const point = getPoint(node.name);
      return point ? <g key={key} data-node-type="DefinedTriangle"><PointMark point={point} name={node.name} color="#f43f5e" /></g> : null;
    }

    if (node.type === 'AssociatedTriangle') {
      const points = node.results.map(name => ({ name, point: getPoint(name) })).filter((item): item is { name: string; point: GeoPoint } => Boolean(item.point));
      return points.length === 3 ? <g key={key} data-node-type="AssociatedTriangle">{points.map(item => <PointMark key={item.name} point={item.point} name={item.name} color="#9333ea" />)}</g> : null;
    }

    if (node.type === 'PolygonConstruction' && node.mode !== 'permute') {
      const points = node.results.map(name => ({ name, point: getPoint(name) })).filter((item): item is { name: string; point: GeoPoint } => Boolean(item.point));
      return points.length === node.results.length ? <g key={key} data-node-type="PolygonConstruction">{points.map(item => <PointMark key={item.name} point={item.point} name={item.name} color="#059669" />)}</g> : null;
    }

    if (node.type === 'DefinedCircle') {
      const points = node.results.map(name => ({ name, point: getPoint(name) })).filter((item): item is { name: string; point: GeoPoint } => Boolean(item.point));
      return points.length > 0 ? <g key={key} data-node-type="DefinedCircle">{points.map(item => <PointMark key={item.name} point={item.point} name={item.name} color="#0891b2" />)}</g> : null;
    }

    if (node.type === 'ProjectedExcenters' || node.type === 'CircleTransformation') {
      const points = node.results.map(name => ({ name, point: getPoint(name) })).filter((item): item is { name: string; point: GeoPoint } => Boolean(item.point));
      return points.length > 0 ? <g key={key} data-node-type={node.type}>{points.map(item => <PointMark key={item.name} point={item.point} name={item.name} color={node.type === 'ProjectedExcenters' ? '#f97316' : '#c026d3'} />)}</g> : null;
    }

    if (node.type === 'LineCircleIntersection' || node.type === 'CircleCircleIntersection') {
      const points = node.results.map(name => ({ name, point: getPoint(name) })).filter((item): item is { name: string; point: GeoPoint } => Boolean(item.point));
      return points.length > 0 ? <g key={key} data-node-type={node.type}>{points.map(item => <PointMark key={item.name} point={item.point} name={item.name} color={node.type === 'LineCircleIntersection' ? '#2563eb' : '#0891b2'} />)}</g> : null;
    }

    return null;
  };

  const { clipDefinitions, clipChains, outsideRectPath } = useMemo(
    () => sceneClipData ?? buildFastClipData(nodes, pointMap, viewBox),
    [sceneClipData, nodes, pointMap, viewBox],
  );
  const renderClipShape = (clip: InstantClip) => {
    if (clip.rect) return <rect x={clip.rect.x} y={clip.rect.y} width={clip.rect.width} height={clip.rect.height} />;
    if (clip.path) return <path d={clip.path} />;
    if (clip.circle) {
      const { cx, cy, r } = clip.circle;
      if (clip.out) return <path clipRule="evenodd" d={`${outsideRectPath} M ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} Z`} />;
      return <circle cx={cx} cy={cy} r={r} />;
    }
    if (clip.out) return <path clipRule="evenodd" d={`${outsideRectPath} M ${clip.points!.split(' ').join(' L ')} Z`} />;
    return <polygon points={clip.points} />;
  };
  const batchedSegments = useMemo(() => {
    const indexes = new Set<number>();
    const groups = new Map<string, { style: FastStyle; commands: string[] }>();

    nodes.forEach((node, index) => {
      if (node.type !== 'Segment' || clipChains.has(index)) return;
      const optionItems = optionsFor(node.options);
      if (optionItems.some(option => option.startsWith('dim='))) return;

      const style = styleFor(node.options);
      if (
        style.arrowStart ||
        style.arrowEnd ||
        style.arrowMiddle ||
        style.arrowEach ||
        style.extendBefore !== 0 ||
        style.extendAfter !== 0
      ) return;

      const start = pointMap.get(node.p1);
      const end = pointMap.get(node.p2);
      if (!start || !end) return;

      const svgStart = worldToSvg(start);
      const svgEnd = worldToSvg(end);
      const key = batchStyleKey(style);
      const group = groups.get(key) ?? { style, commands: [] };
      group.commands.push(`M ${svgStart.x} ${svgStart.y} L ${svgEnd.x} ${svgEnd.y}`);
      groups.set(key, group);
      indexes.add(index);
    });

    const nodesByStyle = Array.from(groups.entries()).map(([key, group]) => (
      <path
        key={`segment-batch-${key}`}
        data-node-type="SegmentBatch"
        data-batched-node-type="Segment"
        d={group.commands.join(' ')}
        {...svgStyle(group.style)}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ));

    return { indexes, nodes: nodesByStyle };
  }, [clipChains, nodes, optionsFor, pointMap, styleFor]);

  return (
    <PointAppearanceContext.Provider value={pointAppearances}>
    <svg viewBox={viewBox} className="w-full h-full overflow-visible" aria-label="Instant geometry preview">
      <defs>
        <ArrowMarkerDefinitions />
        {clipDefinitions.map(clip => <clipPath key={clip.id} id={clip.id}>{renderClipShape(clip)}</clipPath>)}
      </defs>
      <g>{batchedSegments.nodes}{nodes.map((node, index) => { const rendered = renderNode(node, index); return (clipChains.get(index) ?? []).reduce<ReactNode>((child, clip) => <g key={`${index}-${clip.id}`} clipPath={`url(#${clip.id})`}>{child}</g>, rendered); })}</g>
      <g data-layer="path-labels">{pathLabelNodes}</g>
      <g>
        {nodes.filter((node): node is PointDef => node.type === 'Point').map(point => (
          <PointMark key={`point-${point.name}`} point={pointMap.get(point.name) ?? point} name={point.name} />
        ))}
      </g>
    </svg>
    </PointAppearanceContext.Provider>
  );
}

export const FastSvgRenderer = memo(FastSvgRendererComponent);
