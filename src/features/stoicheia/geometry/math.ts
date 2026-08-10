export interface GeoPoint {
  x: number;
  y: number;
}

export const add = (a: GeoPoint, b: GeoPoint): GeoPoint => ({ x: a.x + b.x, y: a.y + b.y });
export const subtract = (a: GeoPoint, b: GeoPoint): GeoPoint => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (point: GeoPoint, factor: number): GeoPoint => ({ x: point.x * factor, y: point.y * factor });
export const length = (point: GeoPoint) => Math.hypot(point.x, point.y);

export const normalize = (point: GeoPoint): GeoPoint | null => {
  const magnitude = length(point);
  return magnitude > 1e-9 ? scale(point, 1 / magnitude) : null;
};

export const midpoint = (a: GeoPoint, b: GeoPoint): GeoPoint => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

export const goldenRatioPoint = (start: GeoPoint, end: GeoPoint): GeoPoint => {
  const inversePhi = 2 / (1 + Math.sqrt(5));
  return add(start, scale(subtract(end, start), inversePhi));
};

export const barycentricPoint = (points: GeoPoint[], weights: number[]): GeoPoint | null => {
  if (points.length < 2 || points.length !== weights.length) return null;
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (Math.abs(totalWeight) < 1e-12) return null;
  return points.reduce(
    (result, point, index) => add(result, scale(point, weights[index] / totalWeight)),
    { x: 0, y: 0 },
  );
};

export const similitudeCenter = (
  kind: 'ext' | 'int',
  center1: GeoPoint,
  radiusPoint1: GeoPoint,
  center2: GeoPoint,
  radiusPoint2: GeoPoint,
): GeoPoint | null => {
  const radius1 = length(subtract(radiusPoint1, center1));
  const radius2 = length(subtract(radiusPoint2, center2));
  const weights = kind === 'int' ? [radius2, radius1] : [-radius2, radius1];
  return barycentricPoint([center1, center2], weights);
};

export const harmonicConjugate = (p1: GeoPoint, p2: GeoPoint, known: GeoPoint): GeoPoint | null => {
  const direction = subtract(p2, p1);
  const denominator = direction.x ** 2 + direction.y ** 2;
  if (denominator < 1e-12) return null;
  const relative = subtract(known, p1);
  const t = (relative.x * direction.x + relative.y * direction.y) / denominator;
  const harmonicDenominator = 2 * t - 1;
  if (Math.abs(harmonicDenominator) < 1e-12) return null;
  return add(p1, scale(direction, t / harmonicDenominator));
};

export const harmonicPair = (p1: GeoPoint, p2: GeoPoint, ratio: number): [GeoPoint, GeoPoint] | null => {
  const first = barycentricPoint([p1, p2], [1, ratio]);
  const second = barycentricPoint([p1, p2], [1, -ratio]);
  return first && second ? [first, second] : null;
};

export const perpendicular = (direction: GeoPoint): GeoPoint => ({ x: -direction.y, y: direction.x });

export const projectPointOnLine = (point: GeoPoint, lineA: GeoPoint, lineB: GeoPoint): GeoPoint | null => {
  const direction = subtract(lineB, lineA);
  const denominator = direction.x ** 2 + direction.y ** 2;
  if (denominator < 1e-12) return null;
  const relative = subtract(point, lineA);
  const t = (relative.x * direction.x + relative.y * direction.y) / denominator;
  return add(lineA, scale(direction, t));
};

export const equidistantLinePoints = (
  p1: GeoPoint,
  p2: GeoPoint,
  from: GeoPoint,
  distance: number,
): [GeoPoint, GeoPoint] | null => {
  const foot = projectPointOnLine(from, p1, p2);
  if (!foot) return null;
  const direction = normalize(subtract(p1, foot)) ?? normalize(subtract(p1, p2));
  if (!direction) return null;
  return [add(foot, scale(direction, distance)), add(foot, scale(direction, -distance))];
};

export const pointOnLine = (p1: GeoPoint, p2: GeoPoint, position: number): GeoPoint =>
  add(p1, scale(subtract(p2, p1), position));

export const pointOnCircle = (center: GeoPoint, radius: number, angleDegrees: number): GeoPoint => {
  const angle = angleDegrees * Math.PI / 180;
  return add(center, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
};

export const duplicateSegmentPoint = (
  rayStart: GeoPoint,
  rayThrough: GeoPoint,
  segmentStart: GeoPoint,
  segmentEnd: GeoPoint,
): GeoPoint | null => {
  const direction = normalize(subtract(rayThrough, rayStart));
  if (!direction) return null;
  return add(rayStart, scale(direction, length(subtract(segmentEnd, segmentStart))));
};

export const radicalAxisPoints = (
  center1: GeoPoint,
  radiusPoint1: GeoPoint,
  center2: GeoPoint,
  radiusPoint2: GeoPoint,
): [GeoPoint, GeoPoint] | null => {
  const centers = subtract(center2, center1);
  const distance = length(centers);
  const direction = normalize(centers);
  if (!direction || distance < 1e-12) return null;
  const radius1 = length(subtract(radiusPoint1, center1));
  const radius2 = length(subtract(radiusPoint2, center2));
  const position = (radius1 ** 2 - radius2 ** 2 + distance ** 2) / (2 * distance);
  const foot = add(center1, scale(direction, position));
  const normal = perpendicular(direction);
  return [subtract(foot, scale(normal, 2)), add(foot, scale(normal, 2))];
};

const stableRandom = (key: string, offset = 0): number => {
  let hash = 2166136261 ^ offset;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
};

export const randomPoint = (
  mode: string,
  references: GeoPoint[],
  radius: number | undefined,
  key: string,
): GeoPoint | null => {
  const first = references[0];
  const second = references[1];
  const u = stableRandom(key);
  const v = stableRandom(key, 0x9e3779b9);
  if (!first) return null;
  if (mode === 'rectangle' && second) return { x: first.x + (second.x - first.x) * u, y: first.y + (second.y - first.y) * v };
  if (mode === 'segment' && second) return pointOnLine(first, second, u);
  if (mode === 'line' && second) return pointOnLine(first, second, u * 4 - 1.5);
  const circleRadius = mode === 'circle' ? radius : second ? length(subtract(second, first)) : undefined;
  if (circleRadius === undefined || circleRadius <= 0) return null;
  const boundary = pointOnCircle(first, circleRadius, u * 360);
  return mode === 'disk_through' ? pointOnLine(first, boundary, v) : boundary;
};

const parseRadians = (value?: string): number | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/\\pi/g, 'pi').replace(/π/g, 'pi').replace(/\s+/g, '');
  const direct = Number(normalized);
  if (Number.isFinite(direct)) return direct;
  const match = normalized.match(/^(-?(?:\d+(?:\.\d*)?|\.\d+)?)\*?pi(?:\/(-?(?:\d+(?:\.\d*)?|\.\d+)))?$/);
  if (!match) return null;
  const numerator = match[1] === '' || match[1] === undefined ? 1 : match[1] === '-' ? -1 : Number(match[1]);
  const denominator = match[2] ? Number(match[2]) : 1;
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0 ? numerator * Math.PI / denominator : null;
};

const rotateAround = (point: GeoPoint, center: GeoPoint, angle: number): GeoPoint => {
  const relative = subtract(point, center);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return add(center, {
    x: relative.x * cosine - relative.y * sine,
    y: relative.x * sine + relative.y * cosine,
  });
};

export const pointTransformation = (
  mode: string,
  source: GeoPoint,
  references: GeoPoint[],
  value?: string,
  angleOrientation = 1,
): GeoPoint | null => {
  if (mode === 'translation' && references[0] && references[1]) return add(source, subtract(references[1], references[0]));
  if (mode === 'homothety' && references[0]) {
    const ratio = Number(value);
    return Number.isFinite(ratio) ? add(references[0], scale(subtract(source, references[0]), ratio)) : null;
  }
  if ((mode === 'reflection' || mode === 'projection') && references[0] && references[1]) {
    const foot = projectPointOnLine(source, references[0], references[1]);
    if (!foot) return null;
    return mode === 'projection' ? foot : subtract(scale(foot, 2), source);
  }
  if (mode === 'symmetry' && references[0]) return subtract(scale(references[0], 2), source);
  if ((mode === 'rotation' || mode === 'rotation_in_rad') && references[0]) {
    const angle = mode === 'rotation' ? Number(value) * Math.PI / 180 : parseRadians(value);
    return angle !== null && Number.isFinite(angle) ? rotateAround(source, references[0], angle * angleOrientation) : null;
  }
  if (mode === 'rotation_with_nodes' && references[0] && references[1] && references[2]) {
    const from = subtract(references[1], references[0]);
    const to = subtract(references[2], references[0]);
    if (length(from) < 1e-12 || length(to) < 1e-12) return null;
    return rotateAround(source, references[0], Math.atan2(to.y, to.x) - Math.atan2(from.y, from.x));
  }
  if ((mode === 'inversion' || mode === 'inversion_negative') && references[0] && references[1]) {
    const direction = subtract(source, references[0]);
    const distanceSquared = direction.x ** 2 + direction.y ** 2;
    const radius = length(subtract(references[1], references[0]));
    if (distanceSquared < 1e-12 || radius < 1e-12) return null;
    const factor = (mode === 'inversion_negative' ? -1 : 1) * radius ** 2 / distanceSquared;
    return add(references[0], scale(direction, factor));
  }
  return null;
};

export const vectorPoint = (
  mode: string,
  p1: GeoPoint,
  p2: GeoPoint,
  factor = 1,
  anchor?: GeoPoint,
  perpendicularOrientation = 1,
): GeoPoint | null => {
  const vector = subtract(p2, p1);
  if (length(vector) < 1e-12 || !Number.isFinite(factor)) return null;
  const isNormed = mode.endsWith('_normed');
  const direction = isNormed ? normalize(vector) : vector;
  if (!direction) return null;
  if (mode.startsWith('orthogonal')) return add(p1, scale(perpendicular(direction), factor * perpendicularOrientation));
  if (mode.startsWith('linear')) return add(p1, scale(direction, factor));
  if (mode.startsWith('colinear') && anchor) return add(anchor, scale(direction, factor));
  return null;
};

export const definedLinePoints = (
  mode: string,
  points: GeoPoint[],
  through?: GeoPoint,
  factor = 1,
  normed = false,
  perpendicularOrientation = 1,
): GeoPoint[] | null => {
  const direction = points[0] && points[1] ? subtract(points[1], points[0]) : null;
  const scaledDirection = direction ? (normed ? normalize(direction) : direction) : null;
  if (mode === 'mediator' && scaledDirection) {
    const center = midpoint(points[0], points[1]);
    const offset = scale(perpendicular(scaledDirection), factor * perpendicularOrientation);
    return [subtract(center, offset), add(center, offset)];
  }
  if ((mode === 'perpendicular' || mode === 'orthogonal') && scaledDirection && through) return [add(through, scale(perpendicular(scaledDirection), factor * perpendicularOrientation))];
  if (mode === 'parallel' && scaledDirection && through) return [add(through, scale(scaledDirection, factor))];
  if ((mode === 'bisector' || mode === 'bisector_out') && points.length === 3) {
    const first = normalize(subtract(points[0], points[1]));
    const second = normalize(subtract(points[2], points[1]));
    if (!first || !second) return null;
    const bisector = normalize(mode === 'bisector' ? add(first, second) : subtract(first, second));
    return bisector ? [add(points[1], scale(bisector, factor))] : null;
  }
  if (mode === 'symmedian' && points.length === 3) {
    const sideToFirst = length(subtract(points[0], points[1]));
    const sideToThird = length(subtract(points[2], points[1]));
    const target = barycentricPoint([points[0], points[2]], [sideToThird ** 2, sideToFirst ** 2]);
    return target ? [target] : null;
  }
  if (mode === 'altitude' && points.length === 3) {
    const foot = projectPointOnLine(points[1], points[0], points[2]);
    return foot ? [foot] : null;
  }
  if (mode === 'euler' && points.length === 3) {
    const orthocenter = triangleOrthocenter(points[0], points[1], points[2]);
    const centroid = barycentricPoint(points, [1, 1, 1]);
    return orthocenter && centroid ? [orthocenter, centroid] : null;
  }
  if (mode === 'tangent_at' && points[0] && through) {
    const radius = subtract(through, points[0]);
    return length(radius) > 1e-12 ? [add(through, scale(perpendicular(normed ? normalize(radius)! : radius), factor * perpendicularOrientation))] : null;
  }
  if (mode === 'tangent_from' && points[0] && points[1] && through) {
    const center = points[0];
    const radius = length(subtract(points[1], center));
    const externalVector = subtract(through, center);
    const distance = length(externalVector);
    if (radius < 1e-12 || distance <= radius) return null;
    const base = add(center, scale(externalVector, radius ** 2 / distance ** 2));
    const unit = normalize(externalVector)!;
    const offset = scale(perpendicular(unit), radius * Math.sqrt(distance ** 2 - radius ** 2) / distance);
    return [add(base, offset), subtract(base, offset)];
  }
  return null;
};

const triangleFromAngles = (a: GeoPoint, b: GeoPoint, angleA: number, angleB: number, orientation = 1): GeoPoint | null => {
  const base = subtract(b, a);
  const baseLength = length(base);
  const direction = normalize(base);
  const angleC = 180 - angleA - angleB;
  if (!direction || angleA <= 0 || angleB <= 0 || angleC <= 0) return null;
  const sideAC = baseLength * Math.sin(angleB * Math.PI / 180) / Math.sin(angleC * Math.PI / 180);
  const radians = angleA * Math.PI / 180;
  const rotated = add(scale(direction, Math.cos(radians)), scale(perpendicular(direction), Math.sin(radians) * orientation));
  return add(a, scale(rotated, sideAC));
};

export const definedTrianglePoint = (
  mode: string,
  a: GeoPoint,
  b: GeoPoint,
  angle1?: number,
  angle2?: number,
  swap = false,
  orientation = 1,
): GeoPoint | null => {
  const base = subtract(b, a);
  const baseLength = length(base);
  const direction = normalize(base);
  if (!direction || baseLength < 1e-12) return null;
  const normal = scale(perpendicular(direction), orientation);
  let result: GeoPoint | null = null;
  if (mode === 'two_angles' && angle1 !== undefined && angle2 !== undefined) result = triangleFromAngles(a, b, angle1, angle2, orientation);
  else if (mode === 'equilateral') result = triangleFromAngles(a, b, 60, 60, orientation);
  else if (mode === 'half') result = add(b, scale(normal, -baseLength / 2));
  else if (mode === 'isosceles_right') result = triangleFromAngles(a, b, 45, 45, orientation);
  else if (mode === 'pythagore' || mode === 'pythagoras' || mode === 'egyptian') result = add(b, scale(normal, -baseLength * 3 / 4));
  else if (mode === 'school') result = add(b, scale(normal, baseLength / Math.sqrt(3)));
  else if (mode === 'gold') result = add(b, scale(normal, -baseLength / ((1 + Math.sqrt(5)) / 2)));
  else if (mode === 'euclid') {
    const positive = triangleFromAngles(a, b, 36, 72, orientation);
    const foot = positive ? projectPointOnLine(positive, a, b) : null;
    result = positive && foot ? subtract(scale(foot, 2), positive) : null;
  }
  else if (mode === 'golden' || mode === 'sublime') result = triangleFromAngles(a, b, 72, 72, orientation);
  else if (mode === 'cheops') result = add(midpoint(a, b), scale(normal, baseLength * Math.sqrt((1 + Math.sqrt(5)) / 2) / 2));
  if (!result || !swap) return result;
  const foot = projectPointOnLine(result, a, b);
  return foot ? subtract(scale(foot, 2), result) : null;
};

export const associatedTrianglePoints = (mode: string, aPoint: GeoPoint, bPoint: GeoPoint, cPoint: GeoPoint): GeoPoint[] | null => {
  const normalized = mode === 'medial' ? 'centroid'
    : mode === 'incentral' ? 'in'
      : mode === 'excentral' ? 'ex'
        : mode === 'contact' ? 'intouch'
          : mode === 'ortho' ? 'orthic'
            : mode;
  const a = length(subtract(bPoint, cPoint));
  const b = length(subtract(cPoint, aPoint));
  const c = length(subtract(aPoint, bPoint));
  const semiperimeter = (a + b + c) / 2;
  const area = Math.abs(subtract(bPoint, aPoint).x * subtract(cPoint, aPoint).y - subtract(bPoint, aPoint).y * subtract(cPoint, aPoint).x) / 2;
  if (area < 1e-12 || a < 1e-12 || b < 1e-12 || c < 1e-12) return null;
  if (normalized === 'centroid') return [midpoint(bPoint, cPoint), midpoint(cPoint, aPoint), midpoint(aPoint, bPoint)];
  if (normalized === 'in') return [
    pointOnLine(bPoint, cPoint, c / (b + c)),
    pointOnLine(cPoint, aPoint, a / (c + a)),
    pointOnLine(aPoint, bPoint, b / (a + b)),
  ];
  if (normalized === 'ex') {
    const exA = barycentricPoint([aPoint, bPoint, cPoint], [-a, b, c]);
    const exB = barycentricPoint([aPoint, bPoint, cPoint], [a, -b, c]);
    const exC = barycentricPoint([aPoint, bPoint, cPoint], [a, b, -c]);
    return exA && exB && exC ? [exA, exB, exC] : null;
  }
  if (normalized === 'intouch') return [
    pointOnLine(bPoint, cPoint, (semiperimeter - b) / a),
    pointOnLine(cPoint, aPoint, (semiperimeter - c) / b),
    pointOnLine(aPoint, bPoint, (semiperimeter - a) / c),
  ];
  if (normalized === 'extouch') return [
    pointOnLine(bPoint, cPoint, (semiperimeter - c) / a),
    pointOnLine(cPoint, aPoint, (semiperimeter - a) / b),
    pointOnLine(aPoint, bPoint, (semiperimeter - b) / c),
  ];
  if (normalized === 'orthic') {
    const feet = triangleFeet(aPoint, bPoint, cPoint);
    return feet.footA && feet.footB && feet.footC ? [feet.footA, feet.footB, feet.footC] : null;
  }
  if (normalized === 'euler') {
    const orthocenter = triangleOrthocenter(aPoint, bPoint, cPoint);
    return orthocenter ? [midpoint(aPoint, orthocenter), midpoint(bPoint, orthocenter), midpoint(cPoint, orthocenter)] : null;
  }
  if (normalized === 'symmedial') return [
    pointOnLine(bPoint, cPoint, c ** 2 / (b ** 2 + c ** 2)),
    pointOnLine(cPoint, aPoint, a ** 2 / (c ** 2 + a ** 2)),
    pointOnLine(aPoint, bPoint, b ** 2 / (a ** 2 + b ** 2)),
  ];
  const circumcenter = triangleCircumcenter(aPoint, bPoint, cPoint);
  if (normalized === 'tangential' && circumcenter) {
    const tangent = (point: GeoPoint) => ({ point, direction: perpendicular(subtract(point, circumcenter)) });
    const atA = tangent(aPoint); const atB = tangent(bPoint); const atC = tangent(cPoint);
    const ta = lineIntersection(atB.point, add(atB.point, atB.direction), atC.point, add(atC.point, atC.direction));
    const tb = lineIntersection(atC.point, add(atC.point, atC.direction), atA.point, add(atA.point, atA.direction));
    const tc = lineIntersection(atA.point, add(atA.point, atA.direction), atB.point, add(atB.point, atB.direction));
    return ta && tb && tc ? [ta, tb, tc] : null;
  }
  if (normalized === 'feuerbach') {
    const excenters = associatedTrianglePoints('ex', aPoint, bPoint, cPoint);
    if (!excenters) return null;
    const vertices = [aPoint, bPoint, cPoint];
    const exradii = [area / (semiperimeter - a), area / (semiperimeter - b), area / (semiperimeter - c)];
    return excenters.map((excenter, index) => {
      const direction = normalize(subtract(excenter, vertices[index]));
      return direction ? subtract(excenter, scale(direction, exradii[index])) : excenter;
    });
  }
  return null;
};

export const polygonConstructionPoints = (mode: string, points: GeoPoint[], regularMode: 'center' | 'side' = 'center', sides = 5): GeoPoint[] | null => {
  if (mode === 'square' && points.length === 2) {
    const [a, b] = points;
    const side = subtract(b, a);
    if (length(side) < 1e-12) return null;
    const offset = perpendicular(side);
    return [add(b, offset), add(a, offset)];
  }
  if (mode === 'rectangle' && points.length === 2) {
    const [a, c] = points;
    if (Math.abs(a.x - c.x) < 1e-12 || Math.abs(a.y - c.y) < 1e-12) return null;
    return [{ x: c.x, y: a.y }, { x: a.x, y: c.y }];
  }
  if (mode === 'golden_rectangle' && points.length === 2) {
    const [a, b] = points;
    const side = subtract(b, a);
    if (length(side) < 1e-12) return null;
    const offset = scale(perpendicular(side), 2 / (1 + Math.sqrt(5)));
    return [add(b, offset), add(a, offset)];
  }
  if (mode === 'regular_polygon' && points.length === 2 && Number.isInteger(sides) && sides >= 3) {
    const [first, second] = points;
    if (length(subtract(second, first)) < 1e-12) return null;
    let center = first;
    let vertex = second;
    if (regularMode === 'side') {
      const middle = midpoint(first, second);
      const direction = normalize(subtract(second, first));
      if (!direction) return null;
      const apothem = length(subtract(second, first)) / 2 / Math.tan(Math.PI / sides);
      center = add(middle, scale(perpendicular(direction), apothem));
      vertex = first;
    }
    const radius = subtract(vertex, center);
    return Array.from({ length: sides }, (_, index) => {
      const angle = 2 * Math.PI * index / sides;
      return add(center, {
        x: radius.x * Math.cos(angle) - radius.y * Math.sin(angle),
        y: radius.x * Math.sin(angle) + radius.y * Math.cos(angle),
      });
    });
  }
  if (mode === 'parallelogram' && points.length === 3) {
    const [a, b, c] = points;
    if (Math.abs(subtract(b, a).x * subtract(c, b).y - subtract(b, a).y * subtract(c, b).x) < 1e-12) return null;
    return [add(a, subtract(c, b))];
  }
  if (mode === 'permute' && points.length === 3) {
    const [a, b, c] = points;
    const ab = subtract(b, a);
    const ac = subtract(c, a);
    const abDirection = normalize(ab);
    const acDirection = normalize(ac);
    if (!abDirection || !acDirection) return null;
    return [add(a, scale(acDirection, length(ab))), add(a, scale(abDirection, length(ac)))];
  }
  return null;
};

export const definedCirclePoints = (mode: string, points: GeoPoint[], references: GeoPoint[] = [], value?: number): GeoPoint[] | null => {
  if (mode === 'R' && points[0] && value !== undefined && value > 0) return [add(points[0], { x: value, y: 0 })];
  if (mode === 'diameter' && points.length === 2) return [midpoint(points[0], points[1]), points[1]];
  if (['circum', 'in', 'ex', 'euler', 'nine', 'spieker'].includes(mode) && points.length === 3) {
    const [aPoint, bPoint, cPoint] = points;
    if (mode === 'circum') {
      const center = triangleCircumcenter(aPoint, bPoint, cPoint);
      return center ? [center, aPoint] : null;
    }
    if (mode === 'euler' || mode === 'nine') {
      const circumcenter = triangleCircumcenter(aPoint, bPoint, cPoint);
      const orthocenter = triangleOrthocenter(aPoint, bPoint, cPoint);
      return circumcenter && orthocenter ? [midpoint(circumcenter, orthocenter), midpoint(aPoint, bPoint)] : null;
    }
    const a = length(subtract(bPoint, cPoint));
    const b = length(subtract(cPoint, aPoint));
    const c = length(subtract(aPoint, bPoint));
    const area = Math.abs(subtract(bPoint, aPoint).x * subtract(cPoint, aPoint).y - subtract(bPoint, aPoint).y * subtract(cPoint, aPoint).x) / 2;
    if (area < 1e-12) return null;
    const center = mode === 'in' ? barycentricPoint(points, [a, b, c])
      : mode === 'ex' ? barycentricPoint(points, [a, -b, c])
        : barycentricPoint(points, [b + c, c + a, a + b]);
    if (!center) return null;
    if (mode === 'spieker') {
      const radius = area / (a + b + c);
      return [center, add(center, { x: radius, y: 0 })];
    }
    const radiusPoint = projectPointOnLine(center, aPoint, cPoint);
    return radiusPoint ? [center, radiusPoint] : null;
  }
  if (mode === 'apollonius' && points.length === 2 && value !== undefined && value > 0 && Math.abs(value - 1) > 1e-12) {
    const internal = barycentricPoint(points, [1, value]);
    const external = barycentricPoint(points, [1, -value]);
    return internal && external ? [midpoint(internal, external), internal] : null;
  }
  if (mode === 'orthogonal_from' && points.length === 2 && references[0]) {
    return definedLinePoints('tangent_from', points, references[0]);
  }
  if (mode === 'orthogonal_through' && points.length === 2 && references.length === 2) {
    const [baseCenter] = points;
    const [first, second] = references;
    const distance = length(subtract(first, baseCenter));
    const direction = normalize(subtract(first, baseCenter));
    if (!direction || distance < 1e-12) return null;
    const inverse = add(baseCenter, scale(direction, 1 / distance));
    const center = triangleCircumcenter(inverse, first, second);
    return center ? [center, first] : null;
  }
  return null;
};

export const projectedExcenterPoints = (a: GeoPoint, b: GeoPoint, c: GeoPoint): GeoPoint[] | null => {
  const excenters = associatedTrianglePoints('ex', a, b, c);
  if (!excenters) return null;
  const sidePairs: Array<[GeoPoint, GeoPoint]> = [[b, c], [a, c], [b, a]];
  const results = sidePairs.flatMap(([sideA, sideB]) => excenters.map(excenter => projectPointOnLine(excenter, sideA, sideB)));
  return results.every((point): point is GeoPoint => Boolean(point)) ? results : null;
};

export const transformedCirclePoints = (
  mode: string,
  center: GeoPoint,
  radiusPoint: GeoPoint,
  references: GeoPoint[],
  value?: string,
): GeoPoint[] | null => {
  if (mode !== 'inversion') {
    const transformedCenter = pointTransformation(mode, center, references, value);
    const transformedRadius = pointTransformation(mode, radiusPoint, references, value);
    return transformedCenter && transformedRadius ? [transformedCenter, transformedRadius] : null;
  }
  const inversionCenter = references[0];
  const inversionThrough = references[1];
  if (!inversionCenter || !inversionThrough) return null;
  const circleRadius = length(subtract(radiusPoint, center));
  const inversionRadiusSquared = length(subtract(inversionThrough, inversionCenter)) ** 2;
  const centerVector = subtract(center, inversionCenter);
  const denominator = length(centerVector) ** 2 - circleRadius ** 2;
  if (circleRadius < 1e-12 || inversionRadiusSquared < 1e-12 || Math.abs(denominator) < 1e-12) return null;
  const imageCenter = add(inversionCenter, scale(centerVector, inversionRadiusSquared / denominator));
  const imageRadius = Math.abs(inversionRadiusSquared * circleRadius / denominator);
  const direction = normalize(centerVector) ?? { x: 1, y: 0 };
  return [imageCenter, add(imageCenter, scale(perpendicular(direction), imageRadius))];
};

export const lineCircleIntersections = (
  lineA: GeoPoint,
  lineB: GeoPoint,
  center: GeoPoint,
  radius: number,
  near = false,
  common?: GeoPoint,
): GeoPoint[] | null => {
  const direction = subtract(lineB, lineA);
  const a = direction.x ** 2 + direction.y ** 2;
  if (a < 1e-12 || radius < 0) return null;
  const relative = subtract(lineA, center);
  const b = 2 * (relative.x * direction.x + relative.y * direction.y);
  const c = relative.x ** 2 + relative.y ** 2 - radius ** 2;
  const discriminant = b ** 2 - 4 * a * c;
  if (discriminant < -1e-10) return null;
  const root = Math.sqrt(Math.max(0, discriminant));
  const points = [(-b + root) / (2 * a), (-b - root) / (2 * a)].map(t => add(lineA, scale(direction, t)));
  if (near) points.sort((first, second) => length(subtract(first, lineA)) - length(subtract(second, lineA)));
  else if (common) points.sort((first, second) => length(subtract(second, common)) - length(subtract(first, common)));
  return points;
};

export const circleCircleIntersections = (
  center1: GeoPoint, radius1: number, center2: GeoPoint, radius2: number, common?: GeoPoint,
): GeoPoint[] | null => {
  const centers = subtract(center2, center1);
  const distance = length(centers);
  if (radius1 < 0 || radius2 < 0 || distance < 1e-12
    || distance > radius1 + radius2 + 1e-10
    || distance < Math.abs(radius1 - radius2) - 1e-10) return null;
  const along = (radius1 ** 2 - radius2 ** 2 + distance ** 2) / (2 * distance);
  const heightSquared = radius1 ** 2 - along ** 2;
  if (heightSquared < -1e-10) return null;
  const unit = scale(centers, 1 / distance);
  const base = add(center1, scale(unit, along));
  const offset = scale(perpendicular(unit), Math.sqrt(Math.max(0, heightSquared)));
  const points = [add(base, offset), subtract(base, offset)];
  const crossAt = (point: GeoPoint) => {
    const toFirst = subtract(center1, point);
    const toSecond = subtract(center2, point);
    return toFirst.x * toSecond.y - toFirst.y * toSecond.x;
  };
  points.sort((first, second) => crossAt(first) - crossAt(second));
  if (common) points.sort((first, second) => length(subtract(second, common)) - length(subtract(first, common)));
  return points;
};

export const midArcPoint = (center: GeoPoint, start: GeoPoint, end: GeoPoint): GeoPoint | null => {
  const startVector = subtract(start, center);
  const endVector = subtract(end, center);
  const radius = length(startVector);
  if (radius < 1e-12 || length(endVector) < 1e-12) return null;
  const startAngle = Math.atan2(startVector.y, startVector.x);
  const endAngle = Math.atan2(endVector.y, endVector.x);
  const delta = (endAngle - startAngle + Math.PI * 2) % (Math.PI * 2);
  const middleAngle = startAngle + delta / 2;
  return add(center, { x: radius * Math.cos(middleAngle), y: radius * Math.sin(middleAngle) });
};

export const lineIntersection = (a1: GeoPoint, a2: GeoPoint, b1: GeoPoint, b2: GeoPoint): GeoPoint | null => {
  const a = subtract(a2, a1);
  const b = subtract(b2, b1);
  const determinant = a.x * b.y - a.y * b.x;
  if (Math.abs(determinant) < 1e-12) return null;
  const delta = subtract(b1, a1);
  const t = (delta.x * b.y - delta.y * b.x) / determinant;
  return add(a1, scale(a, t));
};

export const internalAngleBisectorDirection = (side1: GeoPoint, vertex: GeoPoint, side2: GeoPoint): GeoPoint | null => {
  const first = normalize(subtract(side1, vertex));
  const second = normalize(subtract(side2, vertex));
  return first && second ? normalize(add(first, second)) : null;
};

export const extendSegment = (start: GeoPoint, end: GeoPoint, before: number, after: number) => {
  const direction = subtract(end, start);
  return {
    start: subtract(start, scale(direction, before)),
    end: add(end, scale(direction, after)),
  };
};

export const triangleFeet = (a: GeoPoint, b: GeoPoint, c: GeoPoint) => ({
  footA: projectPointOnLine(a, b, c),
  footB: projectPointOnLine(b, a, c),
  footC: projectPointOnLine(c, a, b),
});

export const triangleOrthocenter = (a: GeoPoint, b: GeoPoint, c: GeoPoint): GeoPoint | null => {
  const { footA, footB } = triangleFeet(a, b, c);
  return footA && footB ? lineIntersection(a, footA, b, footB) : null;
};

export const triangleCircumcenter = (a: GeoPoint, b: GeoPoint, c: GeoPoint): GeoPoint | null => {
  const denominator = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(denominator) < 1e-12) return null;
  const a2 = a.x ** 2 + a.y ** 2;
  const b2 = b.x ** 2 + b.y ** 2;
  const c2 = c.x ** 2 + c.y ** 2;
  return {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / denominator,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / denominator,
  };
};

export const triangleCenter = (option: string, aPoint: GeoPoint, bPoint: GeoPoint, cPoint: GeoPoint): GeoPoint | null => {
  const a = length(subtract(bPoint, cPoint));
  const b = length(subtract(cPoint, aPoint));
  const c = length(subtract(aPoint, bPoint));
  const semiperimeter = (a + b + c) / 2;
  const area = Math.abs(subtract(bPoint, aPoint).x * subtract(cPoint, aPoint).y - subtract(bPoint, aPoint).y * subtract(cPoint, aPoint).x) / 2;
  if (area < 1e-12) return null;
  const weighted = (weights: number[]) => barycentricPoint([aPoint, bPoint, cPoint], weights);
  const normalized = option === 'orthic' ? 'ortho'
    : option === 'median' ? 'centroid'
      : option === 'lemoine' || option === 'grebe' ? 'symmedian'
        : option;

  if (normalized === 'ortho') return triangleOrthocenter(aPoint, bPoint, cPoint);
  if (normalized === 'centroid') return weighted([1, 1, 1]);
  if (normalized === 'circum') return triangleCircumcenter(aPoint, bPoint, cPoint);
  if (normalized === 'in') return weighted([a, b, c]);
  if (normalized === 'ex') return weighted([a, -b, c]);
  if (normalized === 'symmedian') return weighted([a ** 2, b ** 2, c ** 2]);
  if (normalized === 'spieker') return weighted([b + c, c + a, a + b]);
  if (normalized === 'gergonne') return weighted([1 / (semiperimeter - a), 1 / (semiperimeter - b), 1 / (semiperimeter - c)]);
  if (normalized === 'nagel') return weighted([semiperimeter - a, semiperimeter - b, semiperimeter - c]);
  if (normalized === 'mittenpunkt') return weighted([a * (semiperimeter - a), b * (semiperimeter - b), c * (semiperimeter - c)]);

  const circumcenter = triangleCircumcenter(aPoint, bPoint, cPoint);
  const orthocenter = triangleOrthocenter(aPoint, bPoint, cPoint);
  if (normalized === 'euler') return circumcenter && orthocenter ? midpoint(circumcenter, orthocenter) : null;
  if (normalized === 'feuerbach') {
    const incenter = weighted([a, b, c]);
    const eulerCenter = circumcenter && orthocenter ? midpoint(circumcenter, orthocenter) : null;
    if (!incenter || !eulerCenter) return null;
    const direction = normalize(subtract(incenter, eulerCenter));
    const inradius = area / semiperimeter;
    return direction ? add(incenter, scale(direction, inradius)) : null;
  }
  return null;
};
