import { describe, expect, it } from 'vitest';
import {
  associatedTrianglePoints,
  barycentricPoint,
  circleCircleIntersections,
  definedLinePoints,
  definedCirclePoints,
  definedTrianglePoint,
  duplicateSegmentPoint,
  equidistantLinePoints,
  goldenRatioPoint,
  harmonicConjugate,
  harmonicPair,
  internalAngleBisectorDirection,
  lineIntersection,
  lineCircleIntersections,
  midArcPoint,
  pointOnCircle,
  pointOnLine,
  pointTransformation,
  polygonConstructionPoints,
  projectedExcenterPoints,
  randomPoint,
  projectPointOnLine,
  radicalAxisPoints,
  similitudeCenter,
  triangleFeet,
  triangleCenter,
  triangleOrthocenter,
  transformedCirclePoints,
  vectorPoint,
} from './math';

describe('geometry math', () => {
  it('projects a point on an infinite line', () => {
    expect(projectPointOnLine({ x: 2, y: 3 }, { x: 0, y: 0 }, { x: 4, y: 0 }))
      .toEqual({ x: 2, y: 0 });
  });

  it('finds a line intersection and rejects parallel lines', () => {
    expect(lineIntersection({ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 4, y: 0 }))
      .toEqual({ x: 2, y: 2 });
    expect(lineIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }))
      .toBeNull();
  });

  it('computes the internal bisector direction of a right angle', () => {
    const direction = internalAngleBisectorDirection({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 });
    expect(direction?.x).toBeCloseTo(Math.SQRT1_2);
    expect(direction?.y).toBeCloseTo(Math.SQRT1_2);
  });

  it('computes triangle feet and orthocenter', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 4, y: 0 };
    const c = { x: 1, y: 3 };
    const feet = triangleFeet(a, b, c);
    const orthocenter = triangleOrthocenter(a, b, c);

    expect(feet.footC).toEqual({ x: 1, y: 0 });
    expect(orthocenter?.x).toBeCloseTo(1);
    expect(orthocenter?.y).toBeCloseTo(1);
  });

  it('divides a segment using the inverse golden ratio', () => {
    const point = goldenRatioPoint({ x: 0, y: 0 }, { x: 10, y: 0 });
    expect(point.x).toBeCloseTo(6.1803398875);
    expect(point.y).toBe(0);
  });

  it('computes weighted barycentric coordinates', () => {
    expect(barycentricPoint([{ x: 0, y: 0 }, { x: 6, y: 3 }], [1, 2]))
      .toEqual({ x: 4, y: 2 });
    expect(barycentricPoint([{ x: 0, y: 0 }, { x: 1, y: 1 }], [1, -1]))
      .toBeNull();
  });

  it('computes internal and external similitude centers', () => {
    const center1 = { x: 0, y: 0 };
    const radius1 = { x: 2, y: 0 };
    const center2 = { x: 10, y: 0 };
    const radius2 = { x: 11, y: 0 };
    expect(similitudeCenter('int', center1, radius1, center2, radius2)?.x).toBeCloseTo(20 / 3);
    expect(similitudeCenter('ext', center1, radius1, center2, radius2)).toEqual({ x: 20, y: 0 });
  });

  it('computes harmonic conjugates and pairs', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 6, y: 0 };
    const conjugate = harmonicConjugate(a, b, { x: 4, y: 0 });
    expect(conjugate?.x).toBeCloseTo(12);
    expect(conjugate?.y).toBe(0);
    expect(harmonicPair(a, b, 0.5)).toEqual([{ x: 2, y: 0 }, { x: -6, y: 0 }]);
  });

  it('computes two equidistant points around a line projection', () => {
    expect(equidistantLinePoints({ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 4 }, 1))
      .toEqual([{ x: 2, y: 0 }, { x: 4, y: 0 }]);
  });

  it('computes arc midpoint and parameterized line/circle points', () => {
    const arcMiddle = midArcPoint({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 });
    expect(arcMiddle?.x).toBeCloseTo(Math.SQRT2);
    expect(arcMiddle?.y).toBeCloseTo(Math.SQRT2);
    expect(pointOnLine({ x: 0, y: 0 }, { x: 4, y: 2 }, 1.5)).toEqual({ x: 6, y: 3 });
    const circlePoint = pointOnCircle({ x: 1, y: 1 }, 2, 90);
    expect(circlePoint.x).toBeCloseTo(1);
    expect(circlePoint.y).toBeCloseTo(3);
  });

  it('computes tkzDefPointBy transformations', () => {
    const source = { x: 2, y: 1 };
    expect(pointTransformation('translation', source, [{ x: 0, y: 0 }, { x: 3, y: 2 }])).toEqual({ x: 5, y: 3 });
    expect(pointTransformation('homothety', source, [{ x: 0, y: 0 }], '2')).toEqual({ x: 4, y: 2 });
    expect(pointTransformation('reflection', source, [{ x: 0, y: 0 }, { x: 4, y: 0 }])).toEqual({ x: 2, y: -1 });
    expect(pointTransformation('symmetry', source, [{ x: 1, y: 1 }])).toEqual({ x: 0, y: 1 });
    expect(pointTransformation('projection', source, [{ x: 0, y: 0 }, { x: 4, y: 0 }])).toEqual({ x: 2, y: 0 });
    const rotation = pointTransformation('rotation', { x: 1, y: 0 }, [{ x: 0, y: 0 }], '90');
    expect(rotation?.x).toBeCloseTo(0);
    expect(rotation?.y).toBeCloseTo(1);
    const radians = pointTransformation('rotation_in_rad', { x: 1, y: 0 }, [{ x: 0, y: 0 }], 'pi/2');
    expect(radians?.y).toBeCloseTo(1);
    expect(pointTransformation('rotation_with_nodes', { x: 2, y: 0 }, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }])?.y).toBeCloseTo(2);
    expect(pointTransformation('inversion', { x: 4, y: 0 }, [{ x: 0, y: 0 }, { x: 2, y: 0 }])).toEqual({ x: 1, y: 0 });
    expect(pointTransformation('inversion_negative', { x: 4, y: 0 }, [{ x: 0, y: 0 }, { x: 2, y: 0 }])).toEqual({ x: -1, y: 0 });
  });

  it('computes tkzDefPointWith vector conditions', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 3, y: 4 };
    expect(vectorPoint('orthogonal', a, b, 1)).toEqual({ x: -4, y: 3 });
    const orthogonalNormed = vectorPoint('orthogonal_normed', a, b, 2);
    expect(orthogonalNormed?.x).toBeCloseTo(-1.6);
    expect(orthogonalNormed?.y).toBeCloseTo(1.2);
    expect(vectorPoint('linear', a, b, 0.5)).toEqual({ x: 1.5, y: 2 });
    const linearNormed = vectorPoint('linear_normed', a, b, 2);
    expect(linearNormed?.x).toBeCloseTo(1.2);
    expect(linearNormed?.y).toBeCloseTo(1.6);
    expect(vectorPoint('colinear', a, b, 1, { x: 10, y: 1 })).toEqual({ x: 13, y: 5 });
    expect(vectorPoint('colinear_normed', a, b, 5, { x: 10, y: 1 })).toEqual({ x: 13, y: 5 });
  });

  it('duplicates a segment length on a target ray', () => {
    const point = duplicateSegmentPoint(
      { x: 0, y: 0 },
      { x: 3, y: 4 },
      { x: 1, y: 1 },
      { x: 4, y: 1 },
    );

    expect(point?.x).toBeCloseTo(1.8);
    expect(point?.y).toBeCloseTo(2.4);
    expect(duplicateSegmentPoint({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 4, y: 1 })).toBeNull();
  });

  it('computes two preview points on a radical axis', () => {
    const axis = radicalAxisPoints(
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 5, y: 0 },
      { x: 6, y: 0 },
    );

    expect(axis?.[0].x).toBeCloseTo(2.8);
    expect(axis?.[1].x).toBeCloseTo(2.8);
    expect(axis?.[0].y).toBeCloseTo(-2);
    expect(axis?.[1].y).toBeCloseTo(2);
    expect(radicalAxisPoints({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeNull();
  });

  it('computes the supported tkzDefLine constructions', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 2, y: 0 };
    expect(definedLinePoints('mediator', [a, b])).toEqual([{ x: 1, y: -2 }, { x: 1, y: 2 }]);
    expect(definedLinePoints('perpendicular', [a, b], { x: 0, y: 1 })).toEqual([{ x: 0, y: 3 }]);
    expect(definedLinePoints('parallel', [a, b], { x: 0, y: 1 })).toEqual([{ x: 2, y: 1 }]);
    const bisector = definedLinePoints('bisector', [{ x: 1, y: 0 }, a, { x: 0, y: 1 }])?.[0];
    expect(bisector?.x).toBeCloseTo(Math.SQRT1_2);
    expect(bisector?.y).toBeCloseTo(Math.SQRT1_2);
    const exterior = definedLinePoints('bisector_out', [{ x: 1, y: 0 }, a, { x: 0, y: 1 }])?.[0];
    expect(exterior?.x).toBeCloseTo(Math.SQRT1_2);
    expect(exterior?.y).toBeCloseTo(-Math.SQRT1_2);
    expect(definedLinePoints('altitude', [a, { x: 1, y: 2 }, b])).toEqual([{ x: 1, y: 0 }]);
    expect(definedLinePoints('symmedian', [a, { x: 1, y: 2 }, b])?.[0].x).toBeCloseTo(1);
    expect(definedLinePoints('euler', [a, b, { x: 0, y: 2 }])).toHaveLength(2);
    expect(definedLinePoints('tangent_at', [a], { x: 2, y: 0 })).toEqual([{ x: 2, y: 2 }]);
    const tangencies = definedLinePoints('tangent_from', [a, { x: 1, y: 0 }], { x: 2, y: 0 });
    expect(tangencies?.[0].x).toBeCloseTo(0.5);
    expect(tangencies?.[0].y).toBeCloseTo(Math.sqrt(3) / 2);
    expect(tangencies?.[1].y).toBeCloseTo(-Math.sqrt(3) / 2);
  });

  it('computes every tkzDefTriangle family and swap', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 2, y: 0 };
    const equilateral = definedTrianglePoint('equilateral', a, b)!;
    expect(equilateral.x).toBeCloseTo(1);
    expect(equilateral.y).toBeCloseTo(Math.sqrt(3));
    expect(definedTrianglePoint('equilateral', a, b, undefined, undefined, true)?.y).toBeCloseTo(-Math.sqrt(3));
    const twoAngles = definedTrianglePoint('two_angles', a, b, 45, 45);
    expect(twoAngles?.x).toBeCloseTo(1);
    expect(twoAngles?.y).toBeCloseTo(1);
    expect(definedTrianglePoint('half', a, b)).toEqual({ x: 2, y: -1 });
    const isoscelesRight = definedTrianglePoint('isosceles_right', a, b);
    expect(isoscelesRight?.x).toBeCloseTo(1);
    expect(isoscelesRight?.y).toBeCloseTo(1);
    expect(definedTrianglePoint('pythagore', a, b)).toEqual({ x: 2, y: -1.5 });
    expect(definedTrianglePoint('pythagoras', a, b)).toEqual(definedTrianglePoint('pythagore', a, b));
    expect(definedTrianglePoint('egyptian', a, b)).toEqual(definedTrianglePoint('pythagore', a, b));
    expect(definedTrianglePoint('school', a, b)?.y).toBeCloseTo(2 / Math.sqrt(3));
    expect(definedTrianglePoint('gold', a, b)?.y).toBeCloseTo(-2 / ((1 + Math.sqrt(5)) / 2));
    expect(definedTrianglePoint('euclid', a, b)?.x).toBeCloseTo((1 + Math.sqrt(5)) / 2);
    expect(definedTrianglePoint('euclid', a, b)?.y).toBeLessThan(0);
    expect(definedTrianglePoint('golden', a, b)).toEqual(definedTrianglePoint('sublime', a, b));
    expect(definedTrianglePoint('cheops', a, b)?.x).toBeCloseTo(1);
  });

  it('matches tkzDefSpcTriangle constructions and their aliases', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 4, y: 0 };
    const c = { x: 1, y: 3 };
    const expected: Record<string, Array<[number, number]>> = {
      orthic: [[2, 2], [0.4, 1.2], [1, 0]],
      centroid: [[2.5, 1.5], [0.5, 1.5], [2, 0]],
      in: [[2.32456, 1.67544], [0.48528, 1.45585], [1.7082, 0]],
      ex: [[5.70246, 4.1101], [-1.70246, 2.36204], [2.54018, -3.52431]],
      extouch: [[2.79618, 1.20382], [0.53838, 1.61514], [2.54018, 0]],
      intouch: [[2.20382, 1.79618], [0.46162, 1.38486], [1.45982, 0]],
      euler: [[0.5, 0.5], [2.5, 0.5], [1, 2]],
      symmedial: [[2.15385, 1.84615], [0.47059, 1.41176], [1.42857, 0]],
      tangential: [[7, 6], [-1, 2], [2, -4]],
      feuerbach: [[2.36817, 1.70688], [0.47978, 1.45812], [1.73046, -0.09428]],
    };
    for (const [mode, points] of Object.entries(expected)) {
      const actual = associatedTrianglePoints(mode, a, b, c);
      expect(actual, mode).toHaveLength(3);
      points.forEach(([x, y], index) => {
        expect(actual?.[index].x, `${mode}[${index}].x`).toBeCloseTo(x, 4);
        expect(actual?.[index].y, `${mode}[${index}].y`).toBeCloseTo(y, 4);
      });
    }
    for (const [alias, canonical] of Object.entries({ ortho: 'orthic', medial: 'centroid', incentral: 'in', excentral: 'ex', contact: 'intouch' })) {
      expect(associatedTrianglePoints(alias, a, b, c)).toEqual(associatedTrianglePoints(canonical, a, b, c));
    }
    expect(associatedTrianglePoints('orthic', a, b, { x: 8, y: 0 })).toBeNull();
  });

  it('computes square, rectangle, parallelogram and triangle permutation points', () => {
    expect(polygonConstructionPoints('square', [{ x: 0, y: 0 }, { x: 4, y: 0 }]))
      .toEqual([{ x: 4, y: 4 }, { x: 0, y: 4 }]);
    expect(polygonConstructionPoints('rectangle', [{ x: 0, y: 0 }, { x: 5, y: 2 }]))
      .toEqual([{ x: 5, y: 0 }, { x: 0, y: 2 }]);
    expect(polygonConstructionPoints('parallelogram', [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 2 }]))
      .toEqual([{ x: 1, y: 2 }]);
    const permuted = polygonConstructionPoints('permute', [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 1, y: 3 }]);
    expect(permuted?.[0].x).toBeCloseTo(4 / Math.sqrt(10));
    expect(permuted?.[0].y).toBeCloseTo(12 / Math.sqrt(10));
    expect(permuted?.[1]).toEqual({ x: Math.sqrt(10), y: 0 });
    expect(polygonConstructionPoints('rectangle', [{ x: 0, y: 0 }, { x: 5, y: 0 }])).toBeNull();
  });

  it('computes golden rectangles and both regular-polygon definitions', () => {
    const golden = polygonConstructionPoints('golden_rectangle', [{ x: 0, y: 0 }, { x: 4, y: 0 }]);
    expect(golden?.[0].x).toBe(4);
    expect(golden?.[0].y).toBeCloseTo(8 / (1 + Math.sqrt(5)));
    expect(golden?.[1].x).toBe(0);

    const centered = polygonConstructionPoints('regular_polygon', [{ x: 0, y: 0 }, { x: 2, y: 0 }], 'center', 4)!;
    expect(centered).toHaveLength(4);
    expect(centered[1].x).toBeCloseTo(0);
    expect(centered[1].y).toBeCloseTo(2);
    expect(centered[2].x).toBeCloseTo(-2);

    const fromSide = polygonConstructionPoints('regular_polygon', [{ x: 0, y: 0 }, { x: 2, y: 0 }], 'side', 4)!;
    expect(fromSide).toHaveLength(4);
    expect(fromSide[0]).toEqual({ x: 0, y: 0 });
    expect(fromSide[1].x).toBeCloseTo(2);
    expect(fromSide[1].y).toBeCloseTo(0);
    expect(fromSide[2].x).toBeCloseTo(2);
    expect(fromSide[2].y).toBeCloseTo(2);
  });

  it('computes every tkzDefCircle construction family', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 4, y: 0 };
    const c = { x: 0, y: 3 };
    expect(definedCirclePoints('R', [a], [], 2)).toEqual([{ x: 2, y: 0 }]);
    expect(definedCirclePoints('diameter', [a, b])).toEqual([{ x: 2, y: 0 }, b]);
    expect(definedCirclePoints('circum', [a, b, c])).toEqual([{ x: 2, y: 1.5 }, a]);
    expect(definedCirclePoints('in', [a, b, c])).toEqual([{ x: 1, y: 1 }, { x: 0, y: 1 }]);
    expect(definedCirclePoints('ex', [a, b, c])).toEqual([{ x: -2, y: 2 }, { x: 0, y: 2 }]);
    expect(definedCirclePoints('euler', [a, b, c])).toEqual([{ x: 1, y: 0.75 }, { x: 2, y: 0 }]);
    expect(definedCirclePoints('nine', [a, b, c])).toEqual(definedCirclePoints('euler', [a, b, c]));
    expect(definedCirclePoints('spieker', [a, b, c])).toEqual([{ x: 1.5, y: 1 }, { x: 2, y: 1 }]);
    const apollonius = definedCirclePoints('apollonius', [a, b], [], 2)!;
    expect(apollonius[0].x).toBeCloseTo(16 / 3);
    expect(apollonius[1].x).toBeCloseTo(8 / 3);
    const tangentPoints = definedCirclePoints('orthogonal_from', [a, { x: 1, y: 0 }], [{ x: 3, y: 0 }])!;
    expect(tangentPoints).toHaveLength(2);
    tangentPoints.forEach(point => expect(Math.hypot(point.x, point.y)).toBeCloseTo(1));
    const through = definedCirclePoints('orthogonal_through', [a, { x: 1, y: 0 }], [{ x: -1.5, y: -1.5 }, { x: 1.5, y: -1.25 }])!;
    expect(through).toHaveLength(2);
    expect(through[1]).toEqual({ x: -1.5, y: -1.5 });
  });

  it('projects all three excenters onto every triangle side', () => {
    const points = projectedExcenterPoints({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 })!;
    expect(points).toHaveLength(9);
    points.slice(3, 6).forEach(point => expect(point.x).toBeCloseTo(0));
    points.slice(6, 9).forEach(point => expect(point.y).toBeCloseTo(0));
    points.slice(0, 3).forEach(point => expect(3 * point.x + 4 * point.y).toBeCloseTo(12));
  });

  it('transforms circle pairs and computes the true inversion image circle', () => {
    expect(transformedCirclePoints('translation', { x: 1, y: 1 }, { x: 2, y: 1 }, [{ x: 0, y: 0 }, { x: 3, y: 2 }]))
      .toEqual([{ x: 4, y: 3 }, { x: 5, y: 3 }]);
    const inverted = transformedCirclePoints('inversion', { x: 5, y: 0 }, { x: 6, y: 0 }, [{ x: 0, y: 0 }, { x: 2, y: 0 }])!;
    expect(inverted[0].x).toBeCloseTo(5 / 6);
    expect(inverted[0].y).toBeCloseTo(0);
    expect(Math.hypot(inverted[1].x - inverted[0].x, inverted[1].y - inverted[0].y)).toBeCloseTo(1 / 6);
  });

  it('intersects an infinite line with a circle and orders the results', () => {
    const lineA = { x: -3, y: 0 }; const lineB = { x: 3, y: 0 }; const center = { x: 0, y: 0 };
    expect(lineCircleIntersections(lineA, lineB, center, 2)).toEqual([{ x: 2, y: 0 }, { x: -2, y: 0 }]);
    expect(lineCircleIntersections(lineA, lineB, center, 2, true)).toEqual([{ x: -2, y: 0 }, { x: 2, y: 0 }]);
    expect(lineCircleIntersections(lineA, lineB, center, 2, false, { x: 2, y: 0 })).toEqual([{ x: -2, y: 0 }, { x: 2, y: 0 }]);
    expect(lineCircleIntersections({ x: -3, y: 2 }, { x: 3, y: 2 }, center, 2)?.[0]).toEqual({ x: 0, y: 2 });
    expect(lineCircleIntersections({ x: -3, y: 3 }, { x: 3, y: 3 }, center, 2)).toBeNull();
  });

  it('intersects two circles, handles tangency and common-point ordering', () => {
    const first = { x: 0, y: 0 }; const second = { x: 3, y: 0 };
    const intersections = circleCircleIntersections(first, 2, second, 2)!;
    expect(intersections[0].x).toBeCloseTo(1.5); expect(intersections[0].y).toBeLessThan(0);
    expect(intersections[1].y).toBeGreaterThan(0);
    expect(circleCircleIntersections(first, 2, second, 2, intersections[0])).toEqual([intersections[1], intersections[0]]);
    expect(circleCircleIntersections(first, 1, { x: 2, y: 0 }, 1)).toEqual([{ x: 1, y: 0 }, { x: 1, y: 0 }]);
    expect(circleCircleIntersections(first, 1, { x: 3, y: 0 }, 1)).toBeNull();
  });

  it('creates stable representative random points in every supported region', () => {
    const a = { x: 0, y: 0 }; const b = { x: 4, y: 3 };
    const rectangle = randomPoint('rectangle', [a, b], undefined, 'R')!;
    expect(rectangle.x).toBeGreaterThanOrEqual(0); expect(rectangle.x).toBeLessThanOrEqual(4);
    expect(rectangle.y).toBeGreaterThanOrEqual(0); expect(rectangle.y).toBeLessThanOrEqual(3);
    const segment = randomPoint('segment', [a, b], undefined, 'S')!;
    expect(segment.y).toBeCloseTo(segment.x * 0.75);
    const circle = randomPoint('circle', [a], 2, 'C')!;
    expect(Math.hypot(circle.x, circle.y)).toBeCloseTo(2);
    const through = randomPoint('circle_through', [a, b], undefined, 'T')!;
    expect(Math.hypot(through.x, through.y)).toBeCloseTo(5);
    const disk = randomPoint('disk_through', [a, b], undefined, 'D')!;
    expect(Math.hypot(disk.x, disk.y)).toBeLessThanOrEqual(5);
    expect(randomPoint('segment', [a, b], undefined, 'S')).toEqual(segment);
  });

  it('computes the supported triangle-center families and aliases', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 4, y: 0 };
    const c = { x: 0, y: 3 };
    const expected: Record<string, { x: number; y: number }> = {
      ortho: { x: 0, y: 0 }, centroid: { x: 4 / 3, y: 1 }, circum: { x: 2, y: 1.5 },
      in: { x: 1, y: 1 }, ex: { x: -2, y: 2 }, euler: { x: 1, y: 0.75 },
      symmedian: { x: 0.72, y: 0.96 }, spieker: { x: 1.5, y: 1 },
      gergonne: { x: 8 / 11, y: 9 / 11 }, nagel: { x: 2, y: 1 },
      mittenpunkt: { x: 18 / 11, y: 12 / 11 }, feuerbach: { x: 1, y: 2 },
    };
    for (const [option, point] of Object.entries(expected)) {
      expect(triangleCenter(option, a, b, c)?.x, option).toBeCloseTo(point.x);
      expect(triangleCenter(option, a, b, c)?.y, option).toBeCloseTo(point.y);
    }
    expect(triangleCenter('orthic', a, b, c)).toEqual(triangleCenter('ortho', a, b, c));
    expect(triangleCenter('median', a, b, c)).toEqual(triangleCenter('centroid', a, b, c));
    expect(triangleCenter('lemoine', a, b, c)).toEqual(triangleCenter('symmedian', a, b, c));
    expect(triangleCenter('grebe', a, b, c)).toEqual(triangleCenter('symmedian', a, b, c));
  });
});
