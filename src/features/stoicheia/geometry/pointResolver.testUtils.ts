// Runtime geometry resolution is owned by Rust; this helper only builds synthetic renderer test scenes.
import { AstNode } from '../store';
import {
  associatedTrianglePoints,
  barycentricPoint,
  circleCircleIntersections,
  definedCirclePoints,
  definedLinePoints,
  definedTrianglePoint,
  duplicateSegmentPoint,
  equidistantLinePoints,
  GeoPoint,
  goldenRatioPoint,
  harmonicConjugate,
  harmonicPair,
  length,
  lineCircleIntersections,
  lineIntersection,
  midArcPoint,
  midpoint,
  pointOnCircle,
  pointOnLine,
  pointTransformation,
  polygonConstructionPoints,
  projectedExcenterPoints,
  radicalAxisPoints,
  randomPoint,
  similitudeCenter,
  subtract,
  transformedCirclePoints,
  triangleCenter,
  vectorPoint,
} from './math';

export const resolvePointMap = (nodes: AstNode[], initialPoints?: Iterable<[string, GeoPoint]>): Map<string, GeoPoint> => {
  const pointMap = new Map<string, GeoPoint>(initialPoints);

  nodes.forEach(node => {
    if (node.type === 'Point') pointMap.set(node.name, { x: node.x, y: node.y });
  });

  nodes.forEach(node => {
    if (node.type === 'IntersectionPoint') {
      const p1 = pointMap.get(node.p1);
      const p2 = pointMap.get(node.p2);
      const p3 = pointMap.get(node.p3);
      const p4 = pointMap.get(node.p4);
      const point = p1 && p2 && p3 && p4 ? lineIntersection(p1, p2, p3, p4) : null;
      if (point) pointMap.set(node.name, point);
    } else if (node.type === 'MidPoint') {
      const p1 = pointMap.get(node.p1);
      const p2 = pointMap.get(node.p2);
      if (p1 && p2) pointMap.set(node.name, midpoint(p1, p2));
    } else if (node.type === 'GoldenRatioPoint') {
      const p1 = pointMap.get(node.p1);
      const p2 = pointMap.get(node.p2);
      if (p1 && p2) pointMap.set(node.name, goldenRatioPoint(p1, p2));
    } else if (node.type === 'BarycentricPoint') {
      const points = node.points.map(point => pointMap.get(point));
      if (points.every((point): point is GeoPoint => Boolean(point))) {
        const result = barycentricPoint(points, node.weights);
        if (result) pointMap.set(node.name, result);
      }
    } else if (node.type === 'SimilitudeCenter') {
      const center1 = pointMap.get(node.center1);
      const radius1 = pointMap.get(node.radius1);
      const center2 = pointMap.get(node.center2);
      const radius2 = pointMap.get(node.radius2);
      const result = center1 && radius1 && center2 && radius2 ? similitudeCenter(node.kind, center1, radius1, center2, radius2) : null;
      if (result) pointMap.set(node.name, result);
    } else if (node.type === 'HarmonicPoint') {
      const p1 = pointMap.get(node.p1);
      const p2 = pointMap.get(node.p2);
      const known = pointMap.get(node.known);
      const result = p1 && p2 && known ? harmonicConjugate(p1, p2, known) : null;
      if (result) pointMap.set(node.name, result);
    } else if (node.type === 'HarmonicPair') {
      const p1 = pointMap.get(node.p1);
      const p2 = pointMap.get(node.p2);
      const result = p1 && p2 ? harmonicPair(p1, p2, node.ratio) : null;
      if (result) {
        pointMap.set(node.name1, result[0]);
        pointMap.set(node.name2, result[1]);
      }
    } else if (node.type === 'EquiPoints') {
      const p1 = pointMap.get(node.p1);
      const p2 = pointMap.get(node.p2);
      const from = pointMap.get(node.from);
      const result = p1 && p2 && from ? equidistantLinePoints(p1, p2, from, node.distance) : null;
      if (result) {
        pointMap.set(node.name1, result[0]);
        pointMap.set(node.name2, result[1]);
      }
    } else if (node.type === 'MidArcPoint') {
      const center = pointMap.get(node.center);
      const start = pointMap.get(node.start);
      const end = pointMap.get(node.end);
      const result = center && start && end ? midArcPoint(center, start, end) : null;
      if (result) pointMap.set(node.name, result);
    } else if (node.type === 'PointOnLine') {
      const p1 = pointMap.get(node.p1);
      const p2 = pointMap.get(node.p2);
      if (p1 && p2) pointMap.set(node.name, pointOnLine(p1, p2, node.position));
    } else if (node.type === 'PointOnCircle') {
      const center = pointMap.get(node.center);
      const through = node.through ? pointMap.get(node.through) : null;
      const radius = node.mode === 'through' && center && through ? length(subtract(through, center)) : node.radius;
      if (center && radius !== undefined) pointMap.set(node.name, pointOnCircle(center, radius, node.angle));
    } else if (node.type === 'RandomPoint') {
      const references = node.references.map(reference => pointMap.get(reference));
      const result = references.every((point): point is GeoPoint => Boolean(point)) ? randomPoint(node.mode, references, node.radius, `${node.name}:${node.references.join(':')}`) : null;
      if (result) pointMap.set(node.name, result);
    } else if (node.type === 'TriangleCenter') {
      const p1 = pointMap.get(node.p1);
      const p2 = pointMap.get(node.p2);
      const p3 = pointMap.get(node.p3);
      const result = p1 && p2 && p3 ? triangleCenter(node.option, p1, p2, p3) : null;
      if (result) pointMap.set(node.name, result);
    } else if (node.type === 'PointTransformation') {
      const source = pointMap.get(node.source);
      const references = node.references.map(reference => pointMap.get(reference));
      const result = source && references.every((point): point is GeoPoint => Boolean(point)) ? pointTransformation(node.mode, source, references, node.value) : null;
      if (result) pointMap.set(node.name, result);
    } else if (node.type === 'PointsTransformation') {
      const references = node.references.map(reference => pointMap.get(reference));
      if (references.every((point): point is GeoPoint => Boolean(point))) {
        node.sources.forEach((sourceName, index) => {
          const source = pointMap.get(sourceName);
          const result = source ? pointTransformation(node.mode, source, references, node.value) : null;
          if (result) pointMap.set(node.names[index], result);
        });
      }
    } else if (node.type === 'VectorPoint') {
      const p1 = pointMap.get(node.p1);
      const p2 = pointMap.get(node.p2);
      const anchor = node.anchor ? pointMap.get(node.anchor) : undefined;
      const result = p1 && p2 ? vectorPoint(node.mode, p1, p2, node.factor, anchor) : null;
      if (result) pointMap.set(node.name, result);
    } else if (node.type === 'DuplicateSegment') {
      const rayStart = pointMap.get(node.rayStart);
      const rayThrough = pointMap.get(node.rayThrough);
      const segmentStart = pointMap.get(node.segmentStart);
      const segmentEnd = pointMap.get(node.segmentEnd);
      const result = rayStart && rayThrough && segmentStart && segmentEnd ? duplicateSegmentPoint(rayStart, rayThrough, segmentStart, segmentEnd) : null;
      if (result) pointMap.set(node.name, result);
    } else if (node.type === 'RadicalAxis') {
      const center1 = pointMap.get(node.circle1[0]);
      const radiusPoint1 = pointMap.get(node.circle1[1]);
      const center2 = pointMap.get(node.circle2[0]);
      const radiusPoint2 = pointMap.get(node.circle2[1]);
      const results = center1 && radiusPoint1 && center2 && radiusPoint2 ? radicalAxisPoints(center1, radiusPoint1, center2, radiusPoint2) : null;
      results?.forEach((point, index) => pointMap.set(node.results[index], point));
    } else if (node.type === 'SwapPoints') {
      const first = pointMap.get(node.p1);
      const second = pointMap.get(node.p2);
      if (first && second) {
        pointMap.set(node.p1, second);
        pointMap.set(node.p2, first);
      }
    } else if (node.type === 'DefinedLine') {
      const points = node.points.map(point => pointMap.get(point));
      const through = node.through ? pointMap.get(node.through) : undefined;
      const results = points.every((point): point is GeoPoint => Boolean(point)) ? definedLinePoints(node.mode, points, through, node.factor, node.normed) : null;
      results?.forEach((point, index) => pointMap.set(node.results[index], point));
    } else if (node.type === 'DefinedTriangle') {
      const p1 = pointMap.get(node.p1);
      const p2 = pointMap.get(node.p2);
      const result = p1 && p2 ? definedTrianglePoint(node.mode, p1, p2, node.angle1, node.angle2, node.swap) : null;
      if (result) pointMap.set(node.name, result);
    } else if (node.type === 'AssociatedTriangle') {
      const p1 = pointMap.get(node.p1);
      const p2 = pointMap.get(node.p2);
      const p3 = pointMap.get(node.p3);
      const results = p1 && p2 && p3 ? associatedTrianglePoints(node.mode, p1, p2, p3) : null;
      results?.forEach((point, index) => pointMap.set(node.results[index], point));
    } else if (node.type === 'PolygonConstruction') {
      const inputs = node.points.map(point => pointMap.get(point));
      const results = inputs.every((point): point is GeoPoint => Boolean(point)) ? polygonConstructionPoints(node.mode, inputs, node.regularMode, node.sides) : null;
      if (results && node.mode === 'permute') {
        pointMap.set(node.points[1], results[0]);
        pointMap.set(node.points[2], results[1]);
      } else {
        results?.forEach((point, index) => pointMap.set(node.results[index], point));
      }
    } else if (node.type === 'DefinedCircle') {
      const points = node.points.map(point => pointMap.get(point));
      const references = node.references.map(point => pointMap.get(point));
      const results = points.every((point): point is GeoPoint => Boolean(point)) && references.every((point): point is GeoPoint => Boolean(point))
        ? definedCirclePoints(node.mode, points, references, node.value) : null;
      results?.forEach((point, index) => { if (node.results[index]) pointMap.set(node.results[index], point); });
    } else if (node.type === 'ProjectedExcenters') {
      const p1 = pointMap.get(node.p1);
      const p2 = pointMap.get(node.p2);
      const p3 = pointMap.get(node.p3);
      const results = p1 && p2 && p3 ? projectedExcenterPoints(p1, p2, p3) : null;
      results?.forEach((point, index) => pointMap.set(node.results[index], point));
    } else if (node.type === 'CircleTransformation') {
      const center = pointMap.get(node.center);
      const radius = pointMap.get(node.radiusPoint);
      const references = node.references.map(reference => pointMap.get(reference));
      const results = center && radius && references.every((point): point is GeoPoint => Boolean(point)) ? transformedCirclePoints(node.mode, center, radius, references, node.value) : null;
      results?.forEach((point, index) => pointMap.set(node.results[index], point));
    } else if (node.type === 'LineCircleIntersection') {
      const line = node.line.map(point => pointMap.get(point));
      const circle = node.circle.map(point => pointMap.get(point));
      const radius = node.mode === 'R' ? node.radius : node.mode === 'with_nodes' && circle[1] && circle[2] ? length(subtract(circle[1], circle[2])) : circle[0] && circle[1] ? length(subtract(circle[1], circle[0])) : undefined;
      const common = node.common ? pointMap.get(node.common) : undefined;
      const results = line[0] && line[1] && circle[0] && radius !== undefined ? lineCircleIntersections(line[0], line[1], circle[0], radius, node.near, common) : null;
      results?.forEach((point, index) => pointMap.set(node.results[index], point));
    } else if (node.type === 'CircleCircleIntersection') {
      const circles = node.circles.map(circle => circle.map(point => pointMap.get(point)));
      const radii = node.mode === 'R' ? node.radii : circles.map(circle => node.mode === 'with_nodes' && circle[1] && circle[2] ? length(subtract(circle[1], circle[2])) : circle[0] && circle[1] ? length(subtract(circle[1], circle[0])) : undefined);
      const results = circles[0][0] && circles[1][0] && radii?.[0] !== undefined && radii[1] !== undefined ? circleCircleIntersections(circles[0][0], radii[0], circles[1][0], radii[1], node.common ? pointMap.get(node.common) : undefined) : null;
      results?.forEach((point, index) => pointMap.set(node.results[index], point));
    }
  });

  return pointMap;
};
