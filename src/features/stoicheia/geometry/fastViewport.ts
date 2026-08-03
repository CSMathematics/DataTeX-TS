import { AstNode } from '../store';
import { GeoPoint, length, subtract } from './math';

export const WORLD_SCALE = 28.3464567;

export const worldToSvg = (point: GeoPoint): GeoPoint => ({
  x: point.x * WORLD_SCALE,
  y: -point.y * WORLD_SCALE,
});

export interface FastViewport {
  viewBox: string;
  points: ReadonlyMap<string, GeoPoint>;
  transform: {
    originX: number;
    originY: number;
    scaleX: number;
    scaleY: number;
  };
}

const defaultTransform = { originX: 0, originY: 0, scaleX: WORLD_SCALE, scaleY: WORLD_SCALE };

const pushCircularBounds = (bounds: GeoPoint[], center: GeoPoint, radius: number) => {
  if (!Number.isFinite(radius) || radius <= 0) return;
  bounds.push(
    { x: center.x - radius, y: center.y - radius },
    { x: center.x + radius, y: center.y + radius },
  );
};

export const buildCoordinatePointMap = (nodes: AstNode[]): Map<string, GeoPoint> => {
  const pointMap = new Map<string, GeoPoint>();
  nodes.forEach(node => {
    if (node.type === 'Point') pointMap.set(node.name, { x: node.x, y: node.y });
  });
  return pointMap;
};

export const buildFastViewport = (nodes: AstNode[], resolvedPoints?: Record<string, GeoPoint> | null, resolvedViewBox?: string | null): FastViewport => {
  const pointMap = resolvedPoints ? new Map<string, GeoPoint>(Object.entries(resolvedPoints)) : buildCoordinatePointMap(nodes);
  if (resolvedPoints && resolvedViewBox) {
    return {
      viewBox: resolvedViewBox,
      points: pointMap,
      transform: defaultTransform,
    };
  }

  const bounds: GeoPoint[] = [...pointMap.values()];
  nodes.forEach(node => {
    if (node.type === 'Circle' || node.type === 'Arc' || node.type === 'Sector' || node.type === 'FillCircle' || node.type === 'FillSector') {
      const centerName = node.center;
      const radiusName = node.type === 'Circle' ? node.radius_point : node.type === 'FillCircle' ? node.radius : node.first;
      const center = pointMap.get(centerName);
      const radiusPoint = pointMap.get(radiusName);
      if (!center) return;
      const radius = node.type === 'FillCircle' && node.mode === 'R' ? Number(node.radius) : (node.type === 'Arc' || node.type === 'Sector' || node.type === 'FillSector') && (node.mode === 'R' || node.mode === 'R_with_nodes') ? Number(node.first) : radiusPoint ? length(subtract(radiusPoint, center)) : 0;
      pushCircularBounds(bounds, center, radius);
    }
    if (node.type === 'Ellipse') {
      const center = pointMap.get(node.center);
      if (!center) return;
      pushCircularBounds(bounds, center, Math.max(node.x_radius, node.y_radius));
    }
    if (node.type === 'CanvasInit') {
      bounds.push({ x: node.xmin, y: node.ymin }, { x: node.xmax, y: node.ymax });
    }
  });

  if (bounds.length === 0) {
    return {
      viewBox: `${-5 * WORLD_SCALE} ${-5 * WORLD_SCALE} ${10 * WORLD_SCALE} ${10 * WORLD_SCALE}`,
      points: pointMap,
      transform: defaultTransform,
    };
  }

  const xs = bounds.map(point => point.x);
  const ys = bounds.map(point => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY, 2);
  const padding = Math.max(1.5, span * 0.45);
  const svgMinX = (minX - padding) * WORLD_SCALE;
  const svgMinY = -(maxY + padding) * WORLD_SCALE;
  const width = (maxX - minX + padding * 2) * WORLD_SCALE;
  const height = (maxY - minY + padding * 2) * WORLD_SCALE;

  return {
    viewBox: `${svgMinX} ${svgMinY} ${width} ${height}`,
    points: pointMap,
    transform: defaultTransform,
  };
};
