import { useEffect, useMemo, useState } from 'react';
import { Check, Palette, Settings2, X } from 'lucide-react';
import { AstNode, useEditorStore } from '../store';
import { FastArrowTip, isArrowOption, parseFastStyle, splitTikzOptions } from '../tikz/options';
import { buildTikzCommandIndex, findTikzCommandRange, readTikzCommandOptions, TikzCommandIndex, TikzCommandTarget, updateTikzBlockReferences, updateTikzCommandOptions } from '../editor/commandOptions';
import { TikzColorField } from './TikzColorField';

type AppearanceKind = 'shape' | 'points' | 'labels';

interface AppearanceTarget {
  label: string;
  kind: AppearanceKind;
  target: TikzCommandTarget;
}

export interface ConstructionAppearanceConfig {
  title: string;
  subtitle: string;
  construction?: TikzCommandTarget;
  locator?: TikzCommandTarget;
  appearance: AppearanceTarget[];
}

const argsTarget = (command: string, args: string): TikzCommandTarget => ({ command, arguments: args });
const lookaheadTarget = (command: string, pattern: string): TikzCommandTarget => ({ command, followedBy: pattern });
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const labelTextPattern = String.raw`(?:[^{}]|\{[^{}]*\})*`;

const labelNodeTypes = new Set([
  'LabelPoint',
  'LabelPoints',
  'AutoLabelPoints',
  'LabelSegment',
  'LabelSegments',
  'LabelLine',
  'LabelAngle',
  'LabelAngles',
  'LabelCircle',
  'LabelArc',
]);

type LabelNode = Extract<AstNode, {
  type:
    | 'LabelPoint'
    | 'LabelPoints'
    | 'AutoLabelPoints'
    | 'LabelSegment'
    | 'LabelSegments'
    | 'LabelLine'
    | 'LabelAngle'
    | 'LabelAngles'
    | 'LabelCircle'
    | 'LabelArc'
}>;

const isLabelNode = (node: AstNode): node is LabelNode => labelNodeTypes.has(node.type);

interface LabelCommandSpec {
  command: string;
  args: string;
  text?: string;
  angle?: string;
}

const labelCommandSpec = (node: LabelNode): LabelCommandSpec => {
  switch (node.type) {
    case 'LabelPoint': return { command: 'tkzLabelPoint', args: node.point, text: node.text };
    case 'LabelPoints': return { command: 'tkzLabelPoints', args: node.points.join(',') };
    case 'AutoLabelPoints': return { command: 'tkzAutoLabelPoints', args: node.points.join(',') };
    case 'LabelSegment': return { command: 'tkzLabelSegment', args: `${node.p1},${node.p2}`, text: node.text };
    case 'LabelSegments': return { command: 'tkzLabelSegments', args: node.pairs.map(pair => pair.join(',')).join(' '), text: node.text };
    case 'LabelLine': return { command: 'tkzLabelLine', args: `${node.p1},${node.p2}`, text: node.text };
    case 'LabelAngle': return { command: 'tkzLabelAngle', args: `${node.p1},${node.vertex},${node.p2}`, text: node.text };
    case 'LabelAngles': return { command: 'tkzLabelAngles', args: node.angles.map(angle => angle.join(',')).join(' '), text: node.text };
    case 'LabelCircle': return { command: 'tkzLabelCircle', args: `${node.center},${node.radius_point}`, angle: node.angle, text: node.text };
    case 'LabelArc': return { command: 'tkzLabelArc', args: `${node.center},${node.start},${node.end}`, text: node.text };
  }
};

const labelNodeReferences = (node: LabelNode): string[] => {
  switch (node.type) {
    case 'LabelPoint': return [node.point];
    case 'LabelPoints': case 'AutoLabelPoints': return node.points;
    case 'LabelSegment': case 'LabelLine': return [node.p1, node.p2];
    case 'LabelSegments': return node.pairs.flat();
    case 'LabelAngle': return [node.p1, node.vertex, node.p2];
    case 'LabelAngles': return node.angles.flat();
    case 'LabelCircle': return [node.center, node.radius_point];
    case 'LabelArc': return [node.center, node.start, node.end];
  }
};

const labelCommandPattern = (node: LabelNode) => {
  const spec = labelCommandSpec(node);
  const options = String.raw`(?:\[[^\]]*\])?`;
  if (node.type === 'LabelCircle') return new RegExp(`\\\\${spec.command}${options}\\s*\\(${escaped(spec.args)}\\)\\s*\\(${escaped(spec.angle ?? '')}\\)\\s*\\{${labelTextPattern}\\}`);
  if (spec.text !== undefined) return new RegExp(`\\\\${spec.command}${options}\\s*\\(${escaped(spec.args)}\\)\\s*\\{${labelTextPattern}\\}`);
  return new RegExp(`\\\\${spec.command}${options}\\s*\\(${escaped(spec.args)}\\)`);
};

const outputNames = (node: any): string[] => {
  if (node.type === 'HarmonicPair' || node.type === 'EquiPoints') return [node.name1, node.name2];
  if (node.type === 'PointsTransformation') return node.names;
  if (['DefinedLine', 'AssociatedTriangle', 'PolygonConstruction', 'DefinedCircle', 'ProjectedExcenters', 'RadicalAxis', 'CircleTransformation', 'LineCircleIntersection', 'CircleCircleIntersection'].includes(node.type)) return node.results;
  if (node.type === 'ProjectionLine' || node.type === 'TriangleAltitude') return [node.foot];
  if (node.type === 'AllAltitudes') return [node.foot1, node.foot2, node.foot3, node.orthocenter];
  if (['IntersectionPoint', 'MidPoint', 'GoldenRatioPoint', 'BarycentricPoint', 'SimilitudeCenter', 'HarmonicPoint', 'MidArcPoint', 'PointOnLine', 'PointOnCircle', 'TriangleCenter', 'PointTransformation', 'VectorPoint', 'DuplicateSegment', 'DefinedTriangle', 'RandomPoint'].includes(node.type)) return [node.name];
  return [];
};

const locatorTarget = (node: any): TikzCommandTarget | undefined => {
  switch (node.type) {
    case 'Segment': return argsTarget('tkzDrawSegment', `${node.p1},${node.p2}`);
    case 'Line': return argsTarget('tkzDrawLine', `${node.p1},${node.p2}`);
    case 'Lines': return argsTarget('tkzDrawLines', node.pairs.map((pair: string[]) => pair.join(',')).join(' '));
    case 'Segments': return argsTarget('tkzDrawSegments', node.pairs.map((pair: string[]) => pair.join(',')).join(' '));
    case 'PolySeg': return argsTarget('tkzDrawPolySeg', node.points.join(','));
    case 'Circles': return argsTarget('tkzDrawCircles', node.pairs.map((pair: string[]) => pair.join(',')).join(' '));
    case 'SemiCircle': return argsTarget('tkzDrawSemiCircle', `${node.center},${node.radius_point}`);
    case 'SemiCircles': return argsTarget('tkzDrawSemiCircles', node.pairs.map((pair: string[]) => pair.join(',')).join(' '));
    case 'Circle': return argsTarget('tkzDrawCircle', `${node.center},${node.radius_point}`);
    case 'Arc': return lookaheadTarget('tkzDrawArc', `\\s*\\(${escaped(`${node.center},${node.first}`)}\\)\\s*\\(${escaped(node.second.join(','))}\\)`);
    case 'Sector': return lookaheadTarget('tkzDrawSector', `\\s*\\(${escaped(`${node.center},${node.first}`)}\\)\\s*\\(${escaped(node.second.join(','))}\\)`);
    case 'FillCircle': return argsTarget('tkzFillCircle', `${node.center},${node.radius}`);
    case 'FillPolygon': return argsTarget('tkzFillPolygon', node.points.join(','));
    case 'FillSector': return lookaheadTarget('tkzFillSector', `\\s*\\(${escaped(`${node.center},${node.first}`)}\\)\\s*\\(${escaped(node.second.join(','))}\\)`);
    case 'FillAngle': return argsTarget('tkzFillAngle', `${node.p1},${node.vertex},${node.p2}`);
    case 'FillAngles': return argsTarget('tkzFillAngles', node.angles.map((angle: string[]) => angle.join(',')).join(' '));
    case 'CanvasInit': return { command: 'tkzInit' };
    case 'CanvasClip': return { command: 'tkzClip' };
    case 'ShowBoundingBox': return { command: 'tkzShowBB' };
    case 'StyleSetup': return { command: node.command };
    case 'CustomStyle': return lookaheadTarget('tkzSetUpStyle', `\\s*\\{${escaped(node.name)}\\}`);
    case 'Compass': return argsTarget('tkzCompass', `${node.center},${node.through}`);
    case 'Compasses': return argsTarget('tkzCompasss', node.pairs.map((pair: string[]) => pair.join(',')).join(' '));
    case 'ShowLine': return argsTarget('tkzShowLine', node.points.join(','));
    case 'ShowTransformation': return argsTarget('tkzShowTransformation', node.source);
    case 'Protractor': return argsTarget('tkzProtractor', `${node.origin},${node.direction}`);
    case 'ClipBoundingBox': return { command: 'tkzClipBB' };
    case 'PolygonClip': return argsTarget('tkzClipPolygon', node.points.join(','));
    case 'CircleClip': return argsTarget('tkzClipCircle', `${node.center},${node.radius_point}`);
    case 'SectorClip': return lookaheadTarget('tkzClipSector', `\\s*\\(${escaped(`${node.center},${node.first}`)}\\)\\s*\\(${escaped(node.second.join(','))}\\)`);
    case 'SegmentMark': return argsTarget('tkzMarkSegment', `${node.p1},${node.p2}`);
    case 'SegmentsMark': return argsTarget('tkzMarkSegments', node.pairs.map((pair: string[]) => pair.join(',')).join(' '));
    case 'ArcMark': return argsTarget('tkzMarkArc', `${node.center},${node.start},${node.end}`);
    case 'Ellipse': return lookaheadTarget('tkzDrawEllipse', `\\s*\\(${escaped(node.center)}\\s*,[^)]*\\)`);
    case 'Polygon': return argsTarget('tkzDrawPolygon', node.points.join(','));
    case 'PerpendicularLine': return argsTarget('tkzDefLine', `${node.p1},${node.p2}`);
    case 'ProjectionLine': return argsTarget('tkzDefPointBy', node.from);
    case 'PerpendicularBisector': return argsTarget('tkzDefLine', `${node.p1},${node.p2}`);
    case 'AngleBisector': return argsTarget('tkzDefLine', `${node.p1},${node.vertex},${node.p2}`);
    case 'TriangleAltitude': return argsTarget('tkzDefLine', `${node.side1},${node.vertex},${node.side2}`);
    case 'AllAltitudes': return argsTarget('tkzDefSpcTriangle', `${node.p1},${node.p2},${node.p3}`);
    case 'AngleMark': return argsTarget('tkzMarkAngle', `${node.p1},${node.vertex},${node.p2}`);
    case 'AnglesMark': return argsTarget('tkzMarkAngles', node.angles.map((angle: string[]) => angle.join(',')).join(' '));
    case 'RightAngleMark': return argsTarget('tkzMarkRightAngle', `${node.p1},${node.vertex},${node.p2}`);
    case 'RightAnglesMark': return argsTarget('tkzMarkRightAngles', node.angles.map((angle: string[]) => angle.join(',')).join(' '));
    case 'PicAngle': return argsTarget('tkzPicAngle', `${node.p1},${node.vertex},${node.p2}`);
    case 'PicRightAngle': return argsTarget('tkzPicRightAngle', `${node.p1},${node.vertex},${node.p2}`);
    case 'IntersectionPoint': return lookaheadTarget('tkzInterLL', `\\s*\\(${escaped(`${node.p1},${node.p2}`)}\\)\\(${escaped(`${node.p3},${node.p4}`)}\\)`);
    case 'MidPoint': return argsTarget('tkzDefMidPoint', `${node.p1},${node.p2}`);
    case 'GoldenRatioPoint': return argsTarget('tkzDefGoldenRatio', `${node.p1},${node.p2}`);
    case 'BarycentricPoint': return argsTarget('tkzDefBarycentricPoint', node.points.map((point: string, index: number) => `${point}=${node.weights[index]}`).join(','));
    case 'SimilitudeCenter': return lookaheadTarget('tkzDefSimilitudeCenter', `\\s*\\(${escaped(`${node.center1},${node.radius1}`)}\\)\\(${escaped(`${node.center2},${node.radius2}`)}\\)`);
    case 'HarmonicPoint': return argsTarget('tkzDefHarmonic', `${node.p1},${node.p2},${node.known}`);
    case 'HarmonicPair': return argsTarget('tkzDefHarmonic', `${node.p1},${node.p2},${node.ratio}`);
    case 'EquiPoints': return argsTarget('tkzDefEquiPoints', `${node.p1},${node.p2}`);
    case 'MidArcPoint': return argsTarget('tkzDefMidArc', `${node.center},${node.start},${node.end}`);
    case 'PointOnLine': return argsTarget('tkzDefPointOnLine', `${node.p1},${node.p2}`);
    case 'PointOnCircle': return lookaheadTarget('tkzDefPointOnCircle', `\\s*\\\\tkzGetPoint\\{${escaped(node.name)}\\}`);
    case 'TriangleCenter': return argsTarget('tkzDefTriangleCenter', `${node.p1},${node.p2},${node.p3}`);
    case 'PointTransformation': return argsTarget('tkzDefPointBy', node.source);
    case 'PointsTransformation': return argsTarget('tkzDefPointsBy', node.sources.join(','));
    case 'VectorPoint': return argsTarget('tkzDefPointWith', `${node.p1},${node.p2}`);
    case 'DuplicateSegment': return lookaheadTarget('tkzDuplicateSegment', `\\s*\\(${escaped(`${node.rayStart},${node.rayThrough}`)}\\)\\s*\\(${escaped(`${node.segmentStart},${node.segmentEnd}`)}\\)`);
    case 'DefinedLine': return argsTarget('tkzDefLine', node.points.join(','));
    case 'RadicalAxis': return lookaheadTarget('tkzDefRadicalAxis', `\\s*\\(${escaped(node.circle1.join(','))}\\)\\s*\\(${escaped(node.circle2.join(','))}\\)`);
    case 'DefinedTriangle': return argsTarget('tkzDefTriangle', `${node.p1},${node.p2}`);
    case 'AssociatedTriangle': return argsTarget('tkzDefSpcTriangle', `${node.p1},${node.p2},${node.p3}`);
    case 'PolygonConstruction': {
      const macro = node.mode === 'regular_polygon' ? 'tkzDefRegPolygon' : node.mode === 'permute' ? 'tkzPermute' : node.mode === 'square' ? 'tkzDefSquare' : node.mode === 'rectangle' ? 'tkzDefRectangle' : node.mode === 'golden_rectangle' ? 'tkzDefGoldenRectangle' : 'tkzDefParallelogram';
      return argsTarget(macro, node.points.join(','));
    }
    case 'DefinedCircle': return argsTarget('tkzDefCircle', node.mode === 'R' ? `${node.points[0]},${node.value}` : node.points.join(','));
    case 'ProjectedExcenters': return lookaheadTarget('tkzDefProjExcenter', `\\s*\\(${escaped(`${node.p1},${node.p2},${node.p3}`)}\\)`);
    case 'CircleTransformation': return argsTarget('tkzDefCircleBy', `${node.center},${node.radiusPoint}`);
    case 'LineCircleIntersection': {
      const circle = node.mode === 'R' ? `${node.circle[0]},${node.radius}` : node.circle.join(',');
      return lookaheadTarget('tkzInterLC', `\\s*\\(${escaped(node.line.join(','))}\\)\\(${escaped(circle)}\\)`);
    }
    case 'LineCircleTest': return lookaheadTarget('tkzTestInterLC', `\\s*\\(${escaped(node.line.join(','))}\\)\\(${escaped(node.circle.join(','))}\\)`);
    case 'CircleCircleIntersection': {
      const first = node.mode === 'R' ? `${node.circles[0][0]},${node.radii[0]}` : node.circles[0].join(',');
      const second = node.mode === 'R' ? `${node.circles[1][0]},${node.radii[1]}` : node.circles[1].join(',');
      return lookaheadTarget('tkzInterCC', `\\s*\\(${escaped(first)}\\)\\(${escaped(second)}\\)`);
    }
    case 'CircleCircleTest': return lookaheadTarget('tkzTestInterCC', `\\s*\\(${escaped(node.circles[0].join(','))}\\)\\(${escaped(node.circles[1].join(','))}\\)`);
    case 'LinearityTest': return argsTarget('tkzIsLinear', node.points.join(','));
    case 'OrthogonalityTest': return argsTarget('tkzIsOrtho', node.points.join(','));
    case 'AngleCalculation': return argsTarget(node.mode === 'angle' ? 'tkzFindAngle' : 'tkzFindSlopeAngle', node.points.join(','));
    case 'VectorCoordinates': return argsTarget('tkzGetVectxy', `${node.p1},${node.p2}`);
    case 'PointCoordinates': return lookaheadTarget('tkzGetPointCoord', `\\s*\\(${escaped(node.point)}\\)\\{${escaped(node.macro)}\\}`);
    case 'SwapPoints': return argsTarget('tkzSwapPoints', `${node.p1},${node.p2}`);
    case 'LengthCalculation': return argsTarget('tkzCalcLength', `${node.p1},${node.p2}`);
    case 'UnitConversion': return lookaheadTarget(node.mode === 'pt_to_cm' ? 'tkzpttocm' : 'tkzcmtopt', `\\s*\\(${escaped(node.value)}\\)\\{${escaped(node.macro)}\\}`);
    case 'DotProduct': return argsTarget('tkzDotProduct', `${node.p1},${node.p2},${node.p3}`);
    case 'PowerCircle': return lookaheadTarget('tkzPowerCircle', `\\s*\\(${escaped(node.point)}\\)\\s*\\(${escaped(`${node.center},${node.radiusPoint}`)}\\)`);
    case 'RandomPoint': return lookaheadTarget('tkzDefRandPointOn', `\\s*\\\\tkzGetPoint\\{${escaped(node.name)}\\}`);
    default: return undefined;
  }
};

const optionBearingTypes = new Set(['CanvasInit', 'CanvasClip', 'StyleSetup', 'CustomStyle', 'PolygonClip', 'CircleClip', 'PerpendicularLine', 'ProjectionLine', 'PerpendicularBisector', 'AngleBisector', 'TriangleAltitude', 'AllAltitudes', 'SimilitudeCenter', 'HarmonicPoint', 'HarmonicPair', 'EquiPoints', 'PointOnLine', 'PointOnCircle', 'TriangleCenter', 'PointTransformation', 'PointsTransformation', 'VectorPoint', 'DefinedLine', 'DefinedTriangle', 'AssociatedTriangle', 'DefinedCircle', 'ProjectedExcenters', 'CircleTransformation', 'LineCircleIntersection', 'CircleCircleIntersection', 'LengthCalculation', 'RandomPoint', 'ShowTransformation', 'Protractor']);

export const constructionReferenceNames = (node: AstNode): string[] => {
  if (isLabelNode(node)) return Array.from(new Set(labelNodeReferences(node).filter(Boolean)));

  const item = node as any;
  let names: string[] = [];
  switch (item.type) {
    case 'Segment': case 'Line': names = [item.p1, item.p2]; break;
    case 'Lines': case 'Segments': names = item.pairs.flat(); break;
    case 'PolySeg': names = item.points; break;
    case 'Circles': case 'SemiCircles': names = item.pairs.flat(); break;
    case 'SemiCircle': names = [item.center, item.radius_point]; break;
    case 'Circle': names = [item.center, item.radius_point]; break;
    case 'Arc': names = item.mode === 'towards' ? [item.center, item.first, ...item.second] : item.mode === 'rotate' || item.mode === 'angles' ? [item.center, item.first] : item.mode === 'R_with_nodes' ? [item.center, ...item.second] : [item.center]; break;
    case 'Sector': names = item.mode === 'towards' ? [item.center, item.first, ...item.second] : item.mode === 'rotate' ? [item.center, item.first] : item.mode === 'R_with_nodes' ? [item.center, ...item.second] : [item.center]; break;
    case 'FillCircle': names = item.mode === 'radius' ? [item.center, item.radius] : [item.center]; break;
    case 'FillPolygon': names = item.points; break;
    case 'PolygonClip': names = item.points; break;
    case 'CircleClip': names = [item.center, item.radius_point]; break;
    case 'SectorClip': names = item.mode === 'towards' ? [item.center, item.first, ...item.second] : item.mode === 'rotate' ? [item.center, item.first] : [item.center]; break;
    case 'SegmentMark': names = [item.p1, item.p2]; break;
    case 'SegmentsMark': names = item.pairs.flat(); break;
    case 'ArcMark': names = [item.center, item.start, item.end]; break;
    case 'FillSector': names = item.mode === 'towards' ? [item.center, item.first, ...item.second] : item.mode === 'rotate' ? [item.center, item.first] : item.mode === 'R_with_nodes' ? [item.center, ...item.second] : [item.center]; break;
    case 'FillAngle': names = [item.p1, item.vertex, item.p2]; break;
    case 'FillAngles': names = item.angles.flat(); break;
    case 'Ellipse': names = [item.center]; break;
    case 'Polygon': names = item.points; break;
    case 'PerpendicularLine': names = [item.p1, item.p2, item.through]; break;
    case 'ProjectionLine': names = [item.p1, item.p2, item.from]; break;
    case 'PerpendicularBisector': names = [item.p1, item.p2]; break;
    case 'AngleBisector': names = [item.p1, item.vertex, item.p2]; break;
    case 'TriangleAltitude': names = [item.side1, item.vertex, item.side2]; break;
    case 'AllAltitudes': names = [item.p1, item.p2, item.p3]; break;
    case 'AngleMark': names = [item.p1, item.vertex, item.p2]; break;
    case 'AnglesMark': case 'RightAnglesMark': names = item.angles.flat(); break;
    case 'RightAngleMark': names = [item.p1, item.vertex, item.p2]; break;
    case 'PicAngle': case 'PicRightAngle': names = [item.p1, item.vertex, item.p2]; break;
    case 'IntersectionPoint': names = [item.p1, item.p2, item.p3, item.p4]; break;
    case 'MidPoint': case 'GoldenRatioPoint': case 'PointOnLine': case 'VectorCoordinates': case 'SwapPoints': names = [item.p1, item.p2]; break;
    case 'PointCoordinates': names = [item.point]; break;
    case 'BarycentricPoint': names = item.points; break;
    case 'SimilitudeCenter': names = [item.center1, item.radius1, item.center2, item.radius2]; break;
    case 'HarmonicPoint': names = [item.p1, item.p2, item.known]; break;
    case 'HarmonicPair': names = [item.p1, item.p2]; break;
    case 'EquiPoints': names = [item.p1, item.p2, item.from]; break;
    case 'MidArcPoint': names = [item.center, item.start, item.end]; break;
    case 'PointOnCircle': names = [item.center, item.through].filter(Boolean); break;
    case 'TriangleCenter': names = [item.p1, item.p2, item.p3]; break;
    case 'PointTransformation': names = [item.source, ...item.references]; break;
    case 'PointsTransformation': names = [...item.sources, ...item.references]; break;
    case 'VectorPoint': names = [item.p1, item.p2, item.anchor].filter(Boolean); break;
    case 'DuplicateSegment': names = [item.rayStart, item.rayThrough, item.segmentStart, item.segmentEnd]; break;
    case 'DefinedLine': names = [...item.points, item.through].filter(Boolean); break;
    case 'RadicalAxis': names = [...item.circle1, ...item.circle2]; break;
    case 'DefinedTriangle': names = [item.p1, item.p2]; break;
    case 'AssociatedTriangle': names = [item.p1, item.p2, item.p3]; break;
    case 'PolygonConstruction': names = item.points; break;
    case 'DefinedCircle': names = [...item.points, ...item.references]; break;
    case 'ProjectedExcenters': names = [item.p1, item.p2, item.p3]; break;
    case 'CircleTransformation': names = [item.center, item.radiusPoint, ...item.references]; break;
    case 'LineCircleIntersection': case 'LineCircleTest': names = [...item.line, ...item.circle, item.common].filter(Boolean); break;
    case 'CircleCircleIntersection': names = [...item.circles.flat(), item.common].filter(Boolean); break;
    case 'CircleCircleTest': names = item.circles.flat(); break;
    case 'LinearityTest': case 'OrthogonalityTest': names = item.points; break;
    case 'AngleCalculation': names = item.points; break;
    case 'LengthCalculation': names = [item.p1, item.p2]; break;
    case 'DotProduct': names = [item.p1, item.p2, item.p3]; break;
    case 'PowerCircle': names = [item.point, item.center, item.radiusPoint]; break;
    case 'RandomPoint': names = item.references; break;
    case 'Compass': names = [item.center, item.through]; break;
    case 'Compasses': names = item.pairs.flat(); break;
    case 'ShowLine': names = [...item.points, item.through].filter(Boolean); break;
    case 'ShowTransformation': names = [item.source, ...item.references]; break;
    case 'Protractor': names = [item.origin, item.direction]; break;
    case 'StyleSetup': case 'CustomStyle': names = []; break;
  }
  return Array.from(new Set(names.filter(Boolean)));
};

const shapeTarget = (node: any): AppearanceTarget | null => {
  if (node.type === 'Segment') return { label: 'Segment', kind: 'shape', target: argsTarget('tkzDrawSegment', `${node.p1},${node.p2}`) };
  if (node.type === 'Line') return { label: 'Line', kind: 'shape', target: argsTarget('tkzDrawLine', `${node.p1},${node.p2}`) };
  if (node.type === 'Lines') return { label: 'Lines', kind: 'shape', target: argsTarget('tkzDrawLines', node.pairs.map((pair: string[]) => pair.join(',')).join(' ')) };
  if (node.type === 'Segments') return { label: 'Segments', kind: 'shape', target: argsTarget('tkzDrawSegments', node.pairs.map((pair: string[]) => pair.join(',')).join(' ')) };
  if (node.type === 'PolySeg') return { label: 'Polygonal chain', kind: 'shape', target: argsTarget('tkzDrawPolySeg', node.points.join(',')) };
  if (node.type === 'Circles') return { label: 'Circles', kind: 'shape', target: argsTarget('tkzDrawCircles', node.pairs.map((pair: string[]) => pair.join(',')).join(' ')) };
  if (node.type === 'SemiCircle') return { label: 'Semicircle', kind: 'shape', target: argsTarget('tkzDrawSemiCircle', `${node.center},${node.radius_point}`) };
  if (node.type === 'SemiCircles') return { label: 'Semicircles', kind: 'shape', target: argsTarget('tkzDrawSemiCircles', node.pairs.map((pair: string[]) => pair.join(',')).join(' ')) };
  if (node.type === 'Circle') return { label: 'Circle', kind: 'shape', target: argsTarget('tkzDrawCircle', `${node.center},${node.radius_point}`) };
  if (node.type === 'Arc') return { label: 'Arc', kind: 'shape', target: lookaheadTarget('tkzDrawArc', `\\s*\\(${escaped(`${node.center},${node.first}`)}\\)\\s*\\(${escaped(node.second.join(','))}\\)`) };
  if (node.type === 'Sector') return { label: 'Sector', kind: 'shape', target: lookaheadTarget('tkzDrawSector', `\\s*\\(${escaped(`${node.center},${node.first}`)}\\)\\s*\\(${escaped(node.second.join(','))}\\)`) };
  if (node.type === 'FillCircle') return { label: 'Circle fill', kind: 'shape', target: argsTarget('tkzFillCircle', `${node.center},${node.radius}`) };
  if (node.type === 'FillPolygon') return { label: 'Polygon fill', kind: 'shape', target: argsTarget('tkzFillPolygon', node.points.join(',')) };
  if (node.type === 'FillSector') return { label: 'Sector fill', kind: 'shape', target: lookaheadTarget('tkzFillSector', `\\s*\\(${escaped(`${node.center},${node.first}`)}\\)\\s*\\(${escaped(node.second.join(','))}\\)`) };
  if (node.type === 'FillAngle') return { label: 'Angle fill', kind: 'shape', target: argsTarget('tkzFillAngle', `${node.p1},${node.vertex},${node.p2}`) };
  if (node.type === 'FillAngles') return { label: 'Angle fills', kind: 'shape', target: argsTarget('tkzFillAngles', node.angles.map((angle: string[]) => angle.join(',')).join(' ')) };
  if (node.type === 'ShowBoundingBox') return { label: 'Bounding box', kind: 'shape', target: { command: 'tkzShowBB' } };
  if (node.type === 'Compass') return { label: 'Compass trace', kind: 'shape', target: argsTarget('tkzCompass', `${node.center},${node.through}`) };
  if (node.type === 'Compasses') return { label: 'Compass traces', kind: 'shape', target: argsTarget('tkzCompasss', node.pairs.map((pair: string[]) => pair.join(',')).join(' ')) };
  if (node.type === 'ShowLine') return { label: 'Line construction', kind: 'shape', target: argsTarget('tkzShowLine', node.points.join(',')) };
  if (node.type === 'ShowTransformation') return { label: 'Transformation construction', kind: 'shape', target: argsTarget('tkzShowTransformation', node.source) };
  if (node.type === 'Protractor') return { label: 'Protractor', kind: 'shape', target: argsTarget('tkzProtractor', `${node.origin},${node.direction}`) };
  if (node.type === 'Ellipse') return { label: 'Ellipse', kind: 'shape', target: lookaheadTarget('tkzDrawEllipse', `\\s*\\(${escaped(node.center)}\\s*,[^)]*\\)`) };
  if (node.type === 'Polygon') return { label: 'Polygon', kind: 'shape', target: argsTarget('tkzDrawPolygon', node.points.join(',')) };
  if (node.type === 'PerpendicularLine') return { label: 'Perpendicular line', kind: 'shape', target: argsTarget('tkzDrawLine', `${node.through},${node.helper}`) };
  if (node.type === 'ProjectionLine') return { label: 'Projection line', kind: 'shape', target: argsTarget('tkzDrawLine', `${node.from},${node.foot}`) };
  if (node.type === 'PerpendicularBisector') return { label: 'Perpendicular bisector', kind: 'shape', target: argsTarget('tkzDrawLine', `${node.helper1},${node.helper2}`) };
  if (node.type === 'AngleBisector') return { label: 'Angle bisector', kind: 'shape', target: argsTarget('tkzDrawLine', `${node.vertex},${node.helper}`) };
  if (node.type === 'TriangleAltitude') return { label: 'Altitude', kind: 'shape', target: argsTarget('tkzDrawSegment', `${node.vertex},${node.foot}`) };
  if (node.type === 'AllAltitudes') return { label: 'Altitudes', kind: 'shape', target: argsTarget('tkzDrawSegments', `${node.p1},${node.foot1} ${node.p2},${node.foot2} ${node.p3},${node.foot3}`) };
  if (node.type === 'AngleMark') return { label: 'Angle mark', kind: 'shape', target: argsTarget('tkzMarkAngle', `${node.p1},${node.vertex},${node.p2}`) };
  if (node.type === 'AnglesMark') return { label: 'Angle marks', kind: 'shape', target: argsTarget('tkzMarkAngles', node.angles.map((angle: string[]) => angle.join(',')).join(' ')) };
  if (node.type === 'RightAngleMark') return { label: 'Right-angle mark', kind: 'shape', target: argsTarget('tkzMarkRightAngle', `${node.p1},${node.vertex},${node.p2}`) };
  if (node.type === 'RightAnglesMark') return { label: 'Right-angle marks', kind: 'shape', target: argsTarget('tkzMarkRightAngles', node.angles.map((angle: string[]) => angle.join(',')).join(' ')) };
  if (node.type === 'PicAngle') return { label: 'TikZ pic angle', kind: 'shape', target: argsTarget('tkzPicAngle', `${node.p1},${node.vertex},${node.p2}`) };
  if (node.type === 'PicRightAngle') return { label: 'TikZ pic right angle', kind: 'shape', target: argsTarget('tkzPicRightAngle', `${node.p1},${node.vertex},${node.p2}`) };
  if (node.type === 'DefinedTriangle') return { label: 'Triangle outline', kind: 'shape', target: argsTarget('tkzDrawPolygon', `${node.p1},${node.p2},${node.name}`) };
  if (node.type === 'DuplicateSegment') return { label: 'Duplicated segment', kind: 'shape', target: argsTarget('tkzDrawSegment', `${node.rayStart},${node.name}`) };
  if (node.type === 'AssociatedTriangle') return { label: 'Triangle outline', kind: 'shape', target: argsTarget('tkzDrawPolygon', node.results.join(',')) };
  if (node.type === 'PolygonConstruction') {
    const points = node.mode === 'permute' ? node.points
      : node.mode === 'regular_polygon' ? node.results
        : node.mode === 'rectangle' ? [node.points[0], node.results[0], node.points[1], node.results[1]]
          : [...node.points, ...node.results];
    return { label: 'Polygon outline', kind: 'shape', target: argsTarget('tkzDrawPolygon', points.join(',')) };
  }
  if (node.type === 'DefinedCircle') return { label: 'Circle', kind: 'shape', target: argsTarget('tkzDrawCircle', `${node.center},${node.radiusPoint}`) };
  if (node.type === 'CircleTransformation') return { label: 'Image circle', kind: 'shape', target: argsTarget('tkzDrawCircle', node.results.join(',')) };
  if (node.type === 'DefinedLine') {
    if (node.mode === 'tangent_from') return { label: 'Tangent segments', kind: 'shape', target: argsTarget('tkzDrawSegments', `${node.through},${node.results[0]} ${node.through},${node.results[1]}`) };
    const start = node.results.length === 2 ? node.results[0] : ['perpendicular', 'orthogonal', 'parallel', 'tangent_at'].includes(node.mode) ? node.through : node.points[1];
    const end = node.results.length === 2 ? node.results[1] : node.results[0];
    return { label: 'Constructed line', kind: 'shape', target: argsTarget('tkzDrawLine', `${start},${end}`) };
  }
  if (node.type === 'RadicalAxis') return { label: 'Radical axis', kind: 'shape', target: argsTarget('tkzDrawLine', node.results.join(',')) };
  if (node.type === 'ProjectedExcenters') {
    const segments = node.excenterSuffixes.flatMap((suffix: string) => node.projectionPrefixes.map((prefix: string) => `${node.namePrefix}${suffix},${prefix}${suffix}`));
    return { label: 'Projection segments', kind: 'shape', target: argsTarget('tkzDrawSegments', segments.join(' ')) };
  }
  return null;
};

const titleFor = (node: any) => {
  const name = node.name ?? node.names?.join(', ') ?? node.results?.join(', ');
  return `${node.type.replace(/([a-z])([A-Z])/g, '$1 $2')}${name ? ` · ${name}` : ''}`;
};

export const getConstructionAppearanceConfig = (node: AstNode): ConstructionAppearanceConfig => {
  const anyNode = node as any;
  const appearance: AppearanceTarget[] = [];
  const shape = shapeTarget(anyNode);
  if (shape) appearance.push(shape);
  if (anyNode.type === 'ProjectionLine') appearance.push({ label: 'Right-angle mark', kind: 'shape', target: argsTarget('tkzMarkRightAngle', `${anyNode.from},${anyNode.foot},${anyNode.p1}`) });
  if (anyNode.type === 'TriangleAltitude') appearance.push({ label: 'Right-angle mark', kind: 'shape', target: argsTarget('tkzMarkRightAngle', `${anyNode.vertex},${anyNode.foot},${anyNode.side1}`) });
  if (anyNode.type === 'AllAltitudes') appearance.push({ label: 'Right-angle marks', kind: 'shape', target: argsTarget('tkzMarkRightAngles', `${anyNode.p1},${anyNode.foot1},${anyNode.p3} ${anyNode.p2},${anyNode.foot2},${anyNode.p1} ${anyNode.p3},${anyNode.foot3},${anyNode.p1}`) });
  if (anyNode.type === 'AngleMark') appearance.push({ label: 'Angle label', kind: 'labels', target: argsTarget('tkzLabelAngle', `${anyNode.p1},${anyNode.vertex},${anyNode.p2}`) });
  const outputs = outputNames(anyNode);
  const pointNames = anyNode.type === 'PolygonConstruction' && anyNode.mode === 'permute' ? anyNode.points : outputs;
  if (pointNames.length) {
    const args = pointNames.join(',');
    appearance.push({ label: 'Generated points', kind: 'points', target: argsTarget('tkzDrawPoints', args) });
    appearance.push({ label: 'Point labels', kind: 'labels', target: argsTarget('tkzLabelPoints', args) });
  }
  const locator = locatorTarget(anyNode);
  return { title: titleFor(anyNode), subtitle: anyNode.type, locator, construction: optionBearingTypes.has(anyNode.type) ? locator : undefined, appearance };
};

const displayValue = (value: unknown) => {
  if (Array.isArray(value)) return value.map(item => Array.isArray(item) ? `(${item.join(', ')})` : String(item)).join(', ');
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (value === undefined || value === null || value === '') return '—';
  return String(value);
};

type ArrowMode = 'none' | 'end' | 'start' | 'both' | 'middle' | 'each';

const arrowCapableCommands = new Set([
  'tkzDrawSegment',
  'tkzDrawSegments',
  'tkzDrawLine',
  'tkzDrawLines',
  'tkzDrawPolySeg',
  'tkzDrawPolygon',
  'tkzDrawCircle',
  'tkzDrawCircles',
  'tkzDrawSemiCircle',
  'tkzDrawSemiCircles',
  'tkzDrawArc',
]);

const repeatedPathArrowCommands = new Set(['tkzDrawSegments', 'tkzDrawLines', 'tkzDrawPolySeg', 'tkzDrawPolygon']);
const arrowTips: { value: FastArrowTip; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'Latex', label: 'Latex' },
  { value: 'Stealth', label: 'Stealth' },
  { value: 'Triangle', label: 'Triangle' },
  { value: 'To', label: 'To' },
];

const compactNumber = (value: number) => {
  const rounded = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
  return rounded.startsWith('0.') ? rounded.slice(1) : rounded;
};

const formatArrowTip = (tip: FastArrowTip, scale: number, forceNamed = false) => {
  const resolvedTip = tip === 'default' ? (forceNamed ? 'Latex' : '') : tip;
  if (!resolvedTip) return '';
  const cleanScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return cleanScale !== 1 ? `{${resolvedTip}[scale=${compactNumber(cleanScale)}]}` : resolvedTip;
};

const formatArrowOption = (mode: ArrowMode, tip: FastArrowTip, scale: number, position: number) => {
  if (mode === 'none') return undefined;
  const cleanPosition = Number.isFinite(position) ? Math.min(Math.max(position, 0), 1) : 0.5;
  if ((mode === 'end' || mode === 'start' || mode === 'both') && tip === 'default' && scale === 1) {
    if (mode === 'end') return '->';
    if (mode === 'start') return '<-';
    return '<->';
  }
  if (mode === 'end') return `-${formatArrowTip(tip, scale, true)}`;
  if (mode === 'start') return `${formatArrowTip(tip, scale, true)}-`;
  if (mode === 'both') {
    const tipText = formatArrowTip(tip, scale, true);
    return `${tipText}-${tipText}`;
  }
  if (mode === 'each') return 'tkz arrows';
  if (tip === 'default' && scale === 1 && cleanPosition === 0.5) return 'tkz arrow';
  const tipText = formatArrowTip(tip, scale, true);
  return `tkz arrow={${tipText}${cleanPosition !== 0.5 ? ` at ${compactNumber(cleanPosition)}` : ''}}`;
};

function OptionEditor({ label, kind, target, source, commandIndex, onApply }: AppearanceTarget & { source: string; commandIndex: TikzCommandIndex; onApply: (target: TikzCommandTarget, options: string) => void }) {
  const initial = readTikzCommandOptions(commandIndex, target);
  const [optionsText, setOptionsText] = useState(initial ?? '');
  useEffect(() => setOptionsText(initial ?? ''), [initial]);
  const options = splitTikzOptions(optionsText);
  const replaceOption = (matches: (option: string) => boolean, next?: string) => {
    const retained = options.filter(option => !matches(option));
    if (next?.trim()) retained.push(next.trim());
    setOptionsText(retained.join(', '));
  };
  const value = (key: string, fallback: string) => options.find(option => option.startsWith(`${key}=`))?.slice(key.length + 1).trim() ?? fallback;
  const positions = ['above', 'below', 'left', 'right', 'above left', 'above right', 'below left', 'below right'];
  const position = options.find(option => positions.includes(option)) ?? 'default';
  const patterns = ['dashed', 'densely dashed', 'loosely dashed', 'dotted', 'densely dotted', 'loosely dotted'];
  const pattern = options.find(option => patterns.includes(option)) ?? 'solid';
  const arrowStyle = parseFastStyle(optionsText);
  const arrowMode: ArrowMode = arrowStyle.arrowEach ? 'each' : arrowStyle.arrowMiddle ? 'middle' : arrowStyle.arrowStart && arrowStyle.arrowEnd ? 'both' : arrowStyle.arrowStart ? 'start' : arrowStyle.arrowEnd ? 'end' : 'none';
  const arrowTip = arrowStyle.arrowMiddle?.tip ?? arrowStyle.arrowEach?.tip ?? (arrowStyle.arrowEnd ? arrowStyle.arrowEndTip : arrowStyle.arrowStartTip);
  const arrowScale = arrowStyle.arrowMiddle?.scale ?? arrowStyle.arrowEach?.scale ?? (arrowStyle.arrowEnd ? arrowStyle.arrowEndScale : arrowStyle.arrowStartScale);
  const arrowPosition = arrowStyle.arrowMiddle?.position ?? arrowStyle.arrowEach?.position ?? 0.5;
  const supportsArrows = kind === 'shape' && arrowCapableCommands.has(target.command);
  const supportsRepeatedPathArrows = supportsArrows && repeatedPathArrowCommands.has(target.command);
  const updateArrow = (mode: ArrowMode, tip = arrowTip, scale = arrowScale, position = arrowPosition) => {
    replaceOption(isArrowOption, formatArrowOption(mode, tip, scale, position));
  };
  const extent = options.find(option => option.startsWith('add='))?.match(/^add\s*=\s*(-?[\d.]+)\s+and\s+(-?[\d.]+)$/);
  const dimensionOption = options.find(option => option.startsWith('dim='));
  const isAngleMarkCommand = target.command === 'tkzMarkAngle' || target.command === 'tkzMarkAngles';
  const isRightAngleCommand = target.command === 'tkzMarkRightAngle' || target.command === 'tkzMarkRightAngles';
  const isPicAngleCommand = target.command === 'tkzPicAngle' || target.command === 'tkzPicRightAngle';
  const isAutoLabelCommand = target.command === 'tkzAutoLabelPoints';
  const isCompassCommand = target.command === 'tkzCompass' || target.command === 'tkzCompasss';
  const isShowLineCommand = target.command === 'tkzShowLine';
  const isShowTransformationCommand = target.command === 'tkzShowTransformation';
  const isProtractorCommand = target.command === 'tkzProtractor';
  const dimensionParts = dimensionOption ? splitTikzOptions(dimensionOption.slice(4).trim().replace(/^\{|\}$/g, '')) : [];
  const updateDimension = (index: number, next: string) => {
    const parts = dimensionParts.length ? [...dimensionParts] : ['$d$', '10pt', 'midway'];
    parts[index] = next;
    replaceOption(option => option.startsWith('dim='), `dim={${parts.join(',')}}`);
  };
  const polygonPoints = kind === 'shape' && (target.command === 'tkzDrawPolygon' || target.command === 'tkzFillPolygon') ? target.arguments : undefined;
  const polygonClipPattern = polygonPoints ? new RegExp(`\\\\tkzClipPolygon(?:\\[([^\\]]*)\\])?\\s*\\(${escaped(polygonPoints)}\\)`) : null;
  const polygonClipMatch = polygonClipPattern ? source.match(polygonClipPattern) : null;
  const polygonClipEnabled = Boolean(polygonClipMatch);
  const polygonClipOut = splitTikzOptions(polygonClipMatch?.[1] ?? '').includes('out');
  const updatePolygonClip = (enabled: boolean, out = polygonClipOut) => {
    if (!polygonPoints || !polygonClipPattern) return;
    if (!enabled) {
      useEditorStore.getState().setSource(source.replace(polygonClipPattern, ''));
      return;
    }
    const command = `\\tkzClipPolygon${out ? '[out]' : ''}(${polygonPoints})`;
    if (polygonClipEnabled) useEditorStore.getState().setSource(source.replace(polygonClipPattern, command));
    else {
      const range = findTikzCommandRange(commandIndex, target);
      if (range) useEditorStore.getState().setSource(`${source.slice(0, range.end)}\n${command}${source.slice(range.end)}`);
    }
  };
  const circleArgs = kind === 'shape' && (target.command === 'tkzDrawCircle' || target.command === 'tkzFillCircle') ? target.arguments : undefined;
  const circleClipPattern = circleArgs ? new RegExp(`\\\\tkzClipCircle(?:\\[([^\\]]*)\\])?\\s*\\(${escaped(circleArgs)}\\)`) : null;
  const circleClipMatch = circleClipPattern ? source.match(circleClipPattern) : null;
  const circleClipEnabled = Boolean(circleClipMatch);
  const circleClipOut = splitTikzOptions(circleClipMatch?.[1] ?? '').includes('out');
  const updateCircleClip = (enabled: boolean, out = circleClipOut) => {
    if (!circleArgs || !circleClipPattern) return;
    if (!enabled) { useEditorStore.getState().setSource(source.replace(circleClipPattern, '')); return; }
    const command = `\\tkzClipCircle${out ? '[out]' : ''}(${circleArgs})`;
    if (circleClipEnabled) useEditorStore.getState().setSource(source.replace(circleClipPattern, command));
    else {
      const range = findTikzCommandRange(commandIndex, target);
      if (range) useEditorStore.getState().setSource(`${source.slice(0, range.end)}\n${command}${source.slice(range.end)}`);
    }
  };
  const segmentMarkArgs = kind === 'shape' && (target.command === 'tkzDrawSegment' || target.command === 'tkzDrawSegments') ? target.arguments : undefined;
  const segmentMarkCommand = target.command === 'tkzDrawSegments' ? 'tkzMarkSegments' : 'tkzMarkSegment';
  const segmentMarkPattern = segmentMarkArgs ? new RegExp(`\\\\${segmentMarkCommand}(?:\\[([^\\]]*)\\])?\\s*\\(${escaped(segmentMarkArgs)}\\)`) : null;
  const segmentMarkMatch = segmentMarkPattern ? source.match(segmentMarkPattern) : null;
  const segmentMarkEnabled = Boolean(segmentMarkMatch);
  const segmentMarkOptions = splitTikzOptions(segmentMarkMatch?.[1] ?? 'mark=|,size=4pt,pos=.5');
  const segmentMarkValue = (key: string, fallback: string) => segmentMarkOptions.find(option => option.startsWith(`${key}=`))?.slice(key.length + 1).trim() ?? fallback;
  const updateSegmentMark = (enabled: boolean, nextOptions = segmentMarkOptions) => {
    if (!segmentMarkArgs || !segmentMarkPattern) return;
    if (!enabled) { useEditorStore.getState().setSource(source.replace(segmentMarkPattern, '')); return; }
    const optionText = nextOptions.join(',');
    const command = `\\${segmentMarkCommand}${optionText ? `[${optionText}]` : ''}(${segmentMarkArgs})`;
    if (segmentMarkEnabled) useEditorStore.getState().setSource(source.replace(segmentMarkPattern, command));
    else {
      const range = findTikzCommandRange(commandIndex, target);
      if (range) useEditorStore.getState().setSource(`${source.slice(0, range.end)}\n${command}${source.slice(range.end)}`);
    }
  };
  const updateSegmentMarkOption = (key: string, next: string, fallback: string) => {
    const retained = segmentMarkOptions.filter(option => !option.startsWith(`${key}=`));
    if (next !== fallback) retained.push(`${key}=${next}`);
    updateSegmentMark(true, retained);
  };
  if (initial === null) return null;
  return (
    <section className="property-card space-y-2.5">
      <div className="flex items-center justify-between"><span className="property-section-title">{label}</span><Palette size={13} className="text-indigo-400" /></div>
      <div className="grid grid-cols-2 gap-2">
        <TikzColorField label="Color" ariaLabel={`${label} color`} value={value('color', 'black')} onChange={next => replaceOption(option => option.startsWith('color='), next !== 'black' ? `color=${next}` : undefined)} />
        {kind !== 'labels' && <label className="property-field-label">Opacity<input aria-label={`${label} opacity`} type="number" min="0" max="1" step="0.1" className="property-input" value={value('opacity', '1')} onChange={event => replaceOption(option => option.startsWith('opacity='), event.target.value !== '1' ? `opacity=${event.target.value}` : undefined)} /></label>}
        {kind === 'shape' && <><label className="property-field-label">Width (pt)<input aria-label={`${label} width`} type="number" min="0.1" step="0.1" className="property-input" value={value('line width', '0.4').replace('pt', '')} onChange={event => replaceOption(option => option.startsWith('line width='), `line width=${event.target.value}pt`)} /></label><TikzColorField label="Fill" ariaLabel={`${label} fill`} allowNone value={value('fill', 'none')} onChange={next => replaceOption(option => option.startsWith('fill='), next !== 'none' ? `fill=${next}` : undefined)} /><label className="property-field-label">Pattern<select aria-label={`${label} pattern`} className="property-input bg-white" value={pattern} onChange={event => replaceOption(option => patterns.includes(option), event.target.value !== 'solid' ? event.target.value : undefined)}><option value="solid">Solid</option>{patterns.map(item => <option key={item} value={item}>{item}</option>)}</select></label>{supportsArrows && <><label className="property-field-label">Arrow<select aria-label={`${label} arrow mode`} className="property-input bg-white" value={arrowMode} onChange={event => updateArrow(event.target.value as ArrowMode)}><option value="none">None</option><option value="end">End</option><option value="start">Start</option><option value="both">Both ends</option><option value="middle">Middle</option>{supportsRepeatedPathArrows && <option value="each">Each path</option>}</select></label>{arrowMode !== 'none' && arrowMode !== 'each' && <><label className="property-field-label">Arrow tip<select aria-label={`${label} arrow tip`} className="property-input bg-white" value={arrowTip} onChange={event => updateArrow(arrowMode, event.target.value as FastArrowTip)}>{arrowTips.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="property-field-label">Tip scale<input aria-label={`${label} arrow scale`} type="number" min="0.25" step="0.25" className="property-input" value={arrowScale} onChange={event => updateArrow(arrowMode, arrowTip, Number(event.target.value) || 1)} /></label></>}{arrowMode === 'middle' && <label className="property-field-label">Arrow position<input aria-label={`${label} arrow position`} type="number" min="0" max="1" step="0.05" className="property-input" value={arrowPosition} onChange={event => updateArrow('middle', arrowTip, arrowScale, Number(event.target.value))} /></label>}</>}</>}
        {isAngleMarkCommand && <><label className="property-field-label">Arc count<select aria-label={`${label} arc count`} className="property-input" value={value('arc', 'l')} onChange={event => replaceOption(option => option.startsWith('arc='), event.target.value !== 'l' ? `arc=${event.target.value}` : undefined)}><option value="l">Single (l)</option><option value="ll">Double (ll)</option><option value="lll">Triple (lll)</option></select></label><label className="property-field-label">Arc radius<input aria-label={`${label} size`} type="number" min="0.05" step="0.1" className="property-input" value={value('size', '1')} onChange={event => replaceOption(option => option.startsWith('size='), event.target.value !== '1' ? `size=${event.target.value}` : undefined)} /></label><label className="property-field-label">Equality mark<select aria-label={`${label} mark`} className="property-input font-mono" value={value('mark', 'none')} onChange={event => replaceOption(option => option.startsWith('mark='), event.target.value !== 'none' ? `mark=${event.target.value}` : undefined)}><option value="none">none</option>{['|', '||', '|||', 's', 's|', 's||', 'z', 'x', 'o', 'oo'].map(mark => <option key={mark}>{mark}</option>)}</select></label><label className="property-field-label">Mark size<input aria-label={`${label} mark size`} className="property-input" value={value('mksize', '4pt')} onChange={event => replaceOption(option => option.startsWith('mksize='), event.target.value !== '4pt' ? `mksize=${event.target.value}` : undefined)} /></label><TikzColorField label="Mark color" ariaLabel={`${label} mark color`} value={value('mkcolor', 'black')} onChange={next => replaceOption(option => option.startsWith('mkcolor='), next !== 'black' ? `mkcolor=${next}` : undefined)} /><label className="property-field-label">Mark position<input aria-label={`${label} mark position`} type="number" min="0" max="1" step="0.05" className="property-input" value={value('mkpos', '0.5')} onChange={event => replaceOption(option => option.startsWith('mkpos='), event.target.value !== '0.5' ? `mkpos=${event.target.value}` : undefined)} /></label></>}
        {isRightAngleCommand && <><label className="property-field-label">Side size<input aria-label={`${label} size`} type="number" min="0.05" step="0.05" className="property-input" value={value('size', '.25')} onChange={event => replaceOption(option => option.startsWith('size='), event.target.value !== '.25' ? `size=${event.target.value}` : undefined)} /></label><label className="flex items-center gap-2 text-xs font-semibold"><input aria-label={`${label} german`} type="checkbox" checked={options.includes('german')} onChange={event => replaceOption(option => option === 'german', event.target.checked ? 'german' : undefined)} className="h-4 w-4 accent-indigo-500" />German arc style</label>{options.includes('german') && <label className="property-field-label">Dot size<input aria-label={`${label} dot size`} className="property-input" value={value('dotsize', '3pt')} onChange={event => replaceOption(option => option.startsWith('dotsize='), event.target.value !== '3pt' ? `dotsize=${event.target.value}` : undefined)} /></label>}</>}
        {isPicAngleCommand && <><label className="property-field-label">Angle radius<input aria-label={`${label} angle radius`} className="property-input" value={value('angle radius', '5mm')} onChange={event => replaceOption(option => option.startsWith('angle radius='), event.target.value !== '5mm' ? `angle radius=${event.target.value}` : undefined)} /></label><label className="property-field-label">Label eccentricity<input aria-label={`${label} angle eccentricity`} type="number" min="0" step="0.1" className="property-input" value={value('angle eccentricity', '0.6')} onChange={event => replaceOption(option => option.startsWith('angle eccentricity='), event.target.value !== '0.6' ? `angle eccentricity=${event.target.value}` : undefined)} /></label><label className="property-field-label col-span-2">Pic text<input aria-label={`${label} pic text`} className="property-input font-mono" value={value('pic text', '')} placeholder="e.g. $\\alpha$ or ." onChange={event => replaceOption(option => option.startsWith('pic text='), event.target.value ? `pic text=${event.target.value}` : undefined)} /></label></>}
        {kind === 'shape' && (target.command === 'tkzDrawLine' || target.command === 'tkzDrawLines') && <><label className="property-field-label">Extend before<input aria-label={`${label} extend before`} type="number" step="0.5" className="property-input" value={extent?.[1] ?? '0.2'} onChange={event => replaceOption(option => option.startsWith('add='), `add=${event.target.value} and ${extent?.[2] ?? 0.2}`)} /></label><label className="property-field-label">Extend after<input aria-label={`${label} extend after`} type="number" step="0.5" className="property-input" value={extent?.[2] ?? '0.2'} onChange={event => replaceOption(option => option.startsWith('add='), `add=${extent?.[1] ?? 0.2} and ${event.target.value}`)} /></label></>}
        {kind === 'shape' && target.command === 'tkzDrawSegment' && <><label className="col-span-2 flex items-center gap-2 text-xs font-semibold"><input aria-label={`${label} dimension enabled`} type="checkbox" checked={Boolean(dimensionOption)} onChange={event => replaceOption(option => option.startsWith('dim='), event.target.checked ? 'dim={$d$,10pt,midway}' : undefined)} className="h-4 w-4 accent-indigo-500" /> Dimension label (`dim`)</label>{dimensionOption && <><label className="property-field-label">Dimension text<input aria-label={`${label} dimension text`} className="property-input font-mono" value={dimensionParts[0] ?? '$d$'} onChange={event => updateDimension(0, event.target.value)} /></label><label className="property-field-label">Offset<input aria-label={`${label} dimension offset`} className="property-input font-mono" value={dimensionParts[1] ?? '10pt'} onChange={event => updateDimension(1, event.target.value)} /></label><label className="property-field-label">Position<select aria-label={`${label} dimension position`} className="property-input" value={dimensionParts[2] ?? 'midway'} onChange={event => updateDimension(2, event.target.value)}><option value="midway">Midway</option><option value="near start">Near start</option><option value="near end">Near end</option></select></label></>}</>}
        {kind === 'shape' && (target.command === 'tkzDrawSemiCircle' || target.command === 'tkzDrawSemiCircles') && <label className="col-span-2 flex items-center gap-2 text-xs font-semibold"><input aria-label={`${label} swap`} type="checkbox" checked={options.includes('swap')} onChange={event => replaceOption(option => option === 'swap', event.target.checked ? 'swap' : undefined)} className="h-4 w-4 accent-indigo-500" /> Draw the opposite semicircle (`swap`)</label>}
        {kind === 'shape' && (target.command === 'tkzFillAngle' || target.command === 'tkzFillAngles') && <label className="property-field-label">Radius / size<input aria-label={`${label} size`} type="number" min="0.01" step="0.1" className="property-input" value={value('size', '1')} onChange={event => replaceOption(option => option.startsWith('size='), event.target.value !== '1' ? `size=${event.target.value}` : undefined)} /></label>}
        {kind === 'points' && <><TikzColorField label="Fill" ariaLabel={`${label} fill`} allowNone value={value('fill', 'black')} onChange={next => replaceOption(option => option.startsWith('fill='), next !== 'black' ? `fill=${next}` : undefined)} /><label className="property-field-label">Size<input aria-label={`${label} size`} type="number" min="0.5" step="0.5" className="property-input" value={value('size', '3')} onChange={event => replaceOption(option => option.startsWith('size='), event.target.value !== '3' ? `size=${event.target.value}` : undefined)} /></label><label className="property-field-label">Shape<select aria-label={`${label} shape`} className="property-input" value={value('shape', 'circle')} onChange={event => replaceOption(option => option.startsWith('shape='), event.target.value !== 'circle' ? `shape=${event.target.value}` : undefined)}><option value="circle">Circle</option><option value="cross">Cross (+)</option><option value="cross out">Cross out (×)</option></select></label></>}
        {kind === 'labels' && <label className="property-field-label">Position<select aria-label={`${label} position`} className="property-input bg-white" value={position} onChange={event => replaceOption(option => positions.includes(option), event.target.value !== 'default' ? event.target.value : undefined)}><option value="default">Default</option>{positions.map(item => <option key={item} value={item}>{item}</option>)}</select></label>}
        {isAutoLabelCommand && <><label className="property-field-label">Center point<input aria-label={`${label} center`} className="property-input font-mono" value={value('center', '')} onChange={event => replaceOption(option => option.startsWith('center='), event.target.value ? `center=${event.target.value}` : undefined)} /></label><label className="property-field-label">Distance<input aria-label={`${label} distance`} type="number" min="0" step="0.05" className="property-input" value={value('dist', '0.15')} onChange={event => replaceOption(option => option.startsWith('dist='), event.target.value !== '0.15' ? `dist=${event.target.value}` : undefined)} /></label></>}
        {isCompassCommand && <><label className="property-field-label">Arc length (cm)<input aria-label={`${label} length`} type="number" min="0.01" step="0.1" className="property-input" value={value('length', '1')} onChange={event => replaceOption(option => option.startsWith('length='), event.target.value !== '1' ? `length=${event.target.value}` : undefined)} /></label><label className="property-field-label">Delta (degrees)<input aria-label={`${label} delta`} type="number" min="0" max="180" step="1" className="property-input" value={value('delta', '0')} onChange={event => replaceOption(option => option.startsWith('delta='), event.target.value !== '0' ? `delta=${event.target.value}` : undefined)} /></label></>}
        {(isShowLineCommand || isShowTransformationCommand) && <><label className="property-field-label">Arc length<input aria-label={`${label} length`} type="number" min="0.01" step="0.1" className="property-input" value={value('length', '1')} onChange={event => replaceOption(option => option.startsWith('length='), event.target.value !== '1' ? `length=${event.target.value}` : undefined)} /></label><label className="property-field-label">Ratio<input aria-label={`${label} ratio`} type="number" min="0.01" step="0.05" className="property-input" value={value('ratio', '.5')} onChange={event => replaceOption(option => option.startsWith('ratio='), event.target.value !== '.5' ? `ratio=${event.target.value}` : undefined)} /></label><label className="property-field-label">Gap<input aria-label={`${label} gap`} type="number" min="0" step="0.1" className="property-input" value={value('gap', '2')} onChange={event => replaceOption(option => option.startsWith('gap='), event.target.value !== '2' ? `gap=${event.target.value}` : undefined)} /></label><label className="property-field-label">Arc size<input aria-label={`${label} size`} type="number" min="0.01" step="0.1" className="property-input" value={value('size', '1')} onChange={event => replaceOption(option => option.startsWith('size='), event.target.value !== '1' ? `size=${event.target.value}` : undefined)} /></label><label className="property-field-label">Coefficient K<input aria-label={`${label} K`} type="number" step="0.1" className="property-input" value={value('K', '1')} onChange={event => replaceOption(option => option.startsWith('K='), event.target.value !== '1' ? `K=${event.target.value}` : undefined)} /></label></>}
        {isProtractorCommand && <><label className="property-field-label">Scale<input aria-label={`${label} scale`} type="number" min="0.01" step="0.1" className="property-input" value={value('scale', '1')} onChange={event => replaceOption(option => option.startsWith('scale='), event.target.value !== '1' ? `scale=${event.target.value}` : undefined)} /></label><label className="property-field-label">Line width (pt)<input aria-label={`${label} lw`} type="number" min="0.1" step="0.1" className="property-input" value={value('lw', '0.4pt').replace('pt', '')} onChange={event => replaceOption(option => option.startsWith('lw='), event.target.value !== '0.4' ? `lw=${event.target.value}pt` : undefined)} /></label><label className="col-span-2 flex items-center gap-2 text-xs font-semibold"><input aria-label={`${label} return`} type="checkbox" checked={options.includes('return')} onChange={event => replaceOption(option => option === 'return', event.target.checked ? 'return' : undefined)} className="h-4 w-4 accent-indigo-500" />Indirect orientation (`return`)</label></>}
      </div>
      {polygonPoints && <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-2.5 space-y-2"><label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input aria-label={`${label} clipping enabled`} type="checkbox" checked={polygonClipEnabled} onChange={event => updatePolygonClip(event.target.checked)} className="h-4 w-4 accent-indigo-500" />Use this polygon as a clipping mask</label>{polygonClipEnabled && <label className="property-field-label">Visible region<select aria-label={`${label} clipping region`} className="property-input bg-white" value={polygonClipOut ? 'outside' : 'inside'} onChange={event => updatePolygonClip(true, event.target.value === 'outside')}><option value="inside">Inside polygon</option><option value="outside">Outside polygon (`out`)</option></select></label>}<p className="text-[10px] text-slate-500">The mask affects commands that follow it in the source.</p></div>}
      {circleArgs && <div className="rounded-lg border border-cyan-100 bg-cyan-50/60 p-2.5 space-y-2"><label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input aria-label={`${label} clipping enabled`} type="checkbox" checked={circleClipEnabled} onChange={event => updateCircleClip(event.target.checked)} className="h-4 w-4 accent-cyan-600" />Use this circle as a clipping mask</label>{circleClipEnabled && <label className="property-field-label">Visible region<select aria-label={`${label} clipping region`} className="property-input bg-white" value={circleClipOut ? 'outside' : 'inside'} onChange={event => updateCircleClip(true, event.target.value === 'outside')}><option value="inside">Inside circle</option><option value="outside">Outside circle (`out`)</option></select></label>}<p className="text-[10px] text-slate-500">The mask affects commands that follow it in the source.</p></div>}
      {segmentMarkArgs && <div className="space-y-2 rounded-lg border border-amber-100 bg-amber-50/60 p-2.5"><label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input aria-label={`${label} marking enabled`} type="checkbox" checked={segmentMarkEnabled} onChange={event => updateSegmentMark(event.target.checked)} className="h-4 w-4 accent-amber-600" />Add equality marking</label>{segmentMarkEnabled && <div className="grid grid-cols-2 gap-2"><label className="property-field-label">Mark<select aria-label={`${label} mark symbol`} className="property-input font-mono" value={segmentMarkValue('mark', 'none')} onChange={event => updateSegmentMarkOption('mark', event.target.value, 'none')}><option value="none">none</option>{['|', '||', '|||', 's', 's|', 's||', 'z', 'x', 'o', 'oo'].map(mark => <option key={mark} value={mark}>{mark}</option>)}</select></label><label className="property-field-label">Position<input aria-label={`${label} mark position`} type="number" min="0" max="1" step="0.05" className="property-input" value={segmentMarkValue('pos', '.5')} onChange={event => updateSegmentMarkOption('pos', event.target.value, '.5')} /></label><label className="property-field-label">Size (pt)<input aria-label={`${label} mark size`} type="number" min="0.5" step="0.5" className="property-input" value={segmentMarkValue('size', '4pt').replace('pt', '')} onChange={event => updateSegmentMarkOption('size', `${event.target.value}pt`, '4pt')} /></label><TikzColorField label="Color" ariaLabel={`${label} mark color`} value={segmentMarkValue('color', 'black')} onChange={next => updateSegmentMarkOption('color', next, 'black')} /></div>}</div>}
      <div className="flex gap-2"><input aria-label={`${label} advanced options`} className="property-input min-w-0 flex-1" value={optionsText} onChange={event => setOptionsText(event.target.value)} placeholder="Advanced TikZ options" /><button type="button" aria-label={`Apply ${label} options`} onClick={() => onApply(target, optionsText)} className="rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white"><Check size={12} /></button></div>
    </section>
  );
}

const findDrawPointCommand = (source: string, name: string) => {
  for (const command of ['tkzDrawPoint', 'tkzDrawPoints'] as const) {
    const pattern = new RegExp(`\\\\${command}(?:\\[[^\\]]*\\])?\\s*\\(([^)]*)\\)`, 'g');
    for (const match of source.matchAll(pattern)) {
      if (match[1].split(',').map(point => point.trim()).includes(name)) return { command, arguments: match[1] };
    }
  }
  return null;
};

const findPointLabelCommand = (source: string, name: string) => {
  const singular = new RegExp(`\\\\tkzLabelPoint(?:\\[([^\\]]*)\\])?\\s*\\(${escaped(name)}\\)\\s*\\{([^}]*)\\}`, 'g');
  let singularMatch: RegExpExecArray | null; let lastSingular: RegExpExecArray | null = null;
  while ((singularMatch = singular.exec(source))) lastSingular = singularMatch;
  if (lastSingular) return { command: 'tkzLabelPoint' as const, arguments: name, text: lastSingular[2] };
  for (const command of ['tkzAutoLabelPoints', 'tkzLabelPoints'] as const) {
    const pattern = new RegExp(`\\\\${command}(?:\\[[^\\]]*\\])?\\s*\\(([^)]*)\\)`, 'g');
    let match: RegExpExecArray | null; let found: RegExpExecArray | null = null;
    while ((match = pattern.exec(source))) if (match[1].split(',').map(point => point.trim()).includes(name)) found = match;
    if (found) return { command, arguments: found[1] };
  }
  return null;
};

export function PointAndLabelAppearance({ name, source, setSource }: { name: string; source: string; setSource: (source: string) => void }) {
  const commandIndex = useMemo(() => buildTikzCommandIndex(source), [source]);
  const pointCommand = findDrawPointCommand(source, name);
  const labelCommand = findPointLabelCommand(source, name);
  const [customText, setCustomText] = useState(labelCommand?.command === 'tkzLabelPoint' ? labelCommand.text ?? '' : '');
  useEffect(() => setCustomText(labelCommand?.command === 'tkzLabelPoint' ? labelCommand.text ?? '' : ''), [labelCommand?.command, labelCommand?.text]);
  const apply = (target: TikzCommandTarget, options: string) => setSource(updateTikzCommandOptions(source, target, options));
  const applyText = () => {
    if (labelCommand?.command !== 'tkzLabelPoint') return;
    const pattern = new RegExp(`(\\\\tkzLabelPoint(?:\\[[^\\]]*\\])?\\s*\\(${escaped(name)}\\)\\s*)\\{[^}]*\\}`);
    setSource(source.replace(pattern, `$1{${customText}}`));
  };
  return <>{pointCommand && <OptionEditor label="Point appearance" kind="points" target={argsTarget(pointCommand.command, pointCommand.arguments)} source={source} commandIndex={commandIndex} onApply={apply} />}{labelCommand && <><OptionEditor label="Label appearance" kind="labels" target={argsTarget(labelCommand.command, labelCommand.arguments)} source={source} commandIndex={commandIndex} onApply={apply} />{labelCommand.command === 'tkzLabelPoint' && <section className="property-card space-y-2"><span className="property-section-title">Custom label text</span><div className="flex gap-2"><input aria-label="Custom point label text" className="property-input min-w-0 flex-1 font-mono" value={customText} onChange={event => setCustomText(event.target.value)} /><button type="button" aria-label="Apply custom point label text" onClick={applyText} className="rounded-lg bg-indigo-600 px-3 text-white"><Check size={12} /></button></div></section>}</>}</>;
}

function SafeParameterControls({ node, optionsText, setOptionsText }: { node: AstNode; optionsText: string; setOptionsText: (value: string) => void }) {
  const item = node as any;
  const options = splitTikzOptions(optionsText);
  const replace = (matches: (option: string) => boolean, next?: string) => {
    const index = options.findIndex(matches);
    const updated = [...options];
    if (index >= 0) next ? updated.splice(index, 1, next) : updated.splice(index, 1);
    else if (next) updated.push(next);
    setOptionsText(updated.join(','));
  };
  const keyed = (key: string, fallback: string) => options.find(option => option.startsWith(`${key}=`))?.slice(key.length + 1).trim() ?? fallback;
  if (item.type === 'CanvasInit') {
    const fields = [['xmin', item.xmin], ['xmax', item.xmax], ['ymin', item.ymin], ['ymax', item.ymax], ['xstep', item.xstep], ['ystep', item.ystep]] as const;
    return <div className="grid grid-cols-2 gap-2">{fields.map(([key, fallback]) => <label key={key} className="property-field-label">{key}<input aria-label={`Canvas ${key}`} type="number" step="0.5" className="property-input" value={keyed(key, String(fallback))} onChange={event => replace(option => option.startsWith(`${key}=`), `${key}=${event.target.value}`)} /></label>)}</div>;
  }
  if (item.type === 'CanvasClip') return <label className="property-field-label">Extra space<input aria-label="Canvas clip space" type="number" step="0.25" className="property-input" value={keyed('space', String(item.space))} onChange={event => replace(option => option.startsWith('space='), Number(event.target.value) === 0 ? undefined : `space=${event.target.value}`)} /></label>;
  if (item.type === 'PolygonClip') return <label className="flex items-center gap-2 text-xs font-semibold"><input aria-label="Clip outside polygon" type="checkbox" checked={options.includes('out')} onChange={event => replace(option => option === 'out', event.target.checked ? 'out' : undefined)} className="h-4 w-4 accent-indigo-500" />Clip outside the polygon (`out`)</label>;
  if (item.type === 'CircleClip') return <label className="flex items-center gap-2 text-xs font-semibold"><input aria-label="Clip outside circle" type="checkbox" checked={options.includes('out')} onChange={event => replace(option => option === 'out', event.target.checked ? 'out' : undefined)} className="h-4 w-4 accent-indigo-500" />Clip outside the circle (`out`)</label>;
  if (item.type === 'EquiPoints') return <div className="grid grid-cols-2 gap-2"><label className="property-field-label">Distance<input aria-label="Construction distance" type="number" min="0.01" step="0.1" className="property-input" value={keyed('dist', String(item.distance))} onChange={event => replace(option => option.startsWith('dist='), `dist=${event.target.value}`)} /></label><label className="flex items-end gap-2 pb-2 text-xs text-slate-600"><input aria-label="Show construction" type="checkbox" checked={options.includes('show')} onChange={event => replace(option => option === 'show', event.target.checked ? 'show' : undefined)} />Show construction</label></div>;
  if (item.type === 'PointOnLine') return <label className="property-field-label">Position t<input aria-label="Construction position" type="number" step="0.1" className="property-input" value={keyed('pos', String(item.position))} onChange={event => replace(option => option.startsWith('pos='), `pos=${event.target.value}`)} /></label>;
  if (item.type === 'DefinedLine' || item.type === 'VectorPoint') return <div className="grid grid-cols-2 gap-2"><label className="property-field-label">Factor K<input aria-label="Construction factor" type="number" step="0.1" className="property-input" value={keyed('K', String(item.factor))} onChange={event => replace(option => option.startsWith('K='), Number(event.target.value) === 1 ? undefined : `K=${event.target.value}`)} /></label>{item.type === 'DefinedLine' && <label className="flex items-end gap-2 pb-2 text-xs text-slate-600"><input aria-label="Normalize construction" type="checkbox" checked={options.includes('normed')} onChange={event => replace(option => option === 'normed', event.target.checked ? 'normed' : undefined)} />Normalized</label>}</div>;
  if (item.type === 'DefinedTriangle') {
    const angleOption = options.find(option => option.startsWith('two angles='));
    const angles = angleOption?.slice('two angles='.length).split(' and ') ?? [String(item.angle1 ?? 60), String(item.angle2 ?? 60)];
    return <div className="space-y-2">{item.mode === 'two_angles' && <div className="grid grid-cols-2 gap-2"><label className="property-field-label">First angle<input aria-label="First construction angle" type="number" min="0.1" max="179" step="1" className="property-input" value={angles[0]} onChange={event => replace(option => option.startsWith('two angles='), `two angles=${event.target.value} and ${angles[1]}`)} /></label><label className="property-field-label">Second angle<input aria-label="Second construction angle" type="number" min="0.1" max="179" step="1" className="property-input" value={angles[1]} onChange={event => replace(option => option.startsWith('two angles='), `two angles=${angles[0]} and ${event.target.value}`)} /></label></div>}<label className="flex gap-2 text-xs text-slate-600"><input aria-label="Swap construction" type="checkbox" checked={options.includes('swap')} onChange={event => replace(option => option === 'swap', event.target.checked ? 'swap' : undefined)} />Swap orientation</label></div>;
  }
  if (item.type === 'TriangleCenter') {
    const centers = ['ortho', 'centroid', 'circum', 'in', 'ex', 'euler', 'gergonne', 'symmedian', 'lemoine', 'grebe', 'spieker', 'nagel', 'mittenpunkt', 'feuerbach'];
    return <label className="property-field-label">Center type<select aria-label="Triangle center type" className="property-input bg-white" value={options[0] ?? item.option} onChange={event => setOptionsText(event.target.value)}>{centers.map(center => <option key={center} value={center}>{center}</option>)}</select></label>;
  }
  if (item.type === 'DefinedCircle' && item.mode === 'apollonius') return <label className="property-field-label">Coefficient K<input aria-label="Circle coefficient" type="number" min="0.01" step="0.1" className="property-input" value={keyed('K', String(item.value))} onChange={event => replace(option => option.startsWith('K='), `K=${event.target.value}`)} /></label>;
  if (item.type === 'LineCircleIntersection') return <label className="flex gap-2 text-xs text-slate-600"><input aria-label="Near intersection first" type="checkbox" checked={options.includes('near')} onChange={event => replace(option => option === 'near', event.target.checked ? 'near' : undefined)} />Return the point nearest to the first line point first</label>;
  if (item.type === 'RandomPoint' && item.mode === 'circle') {
    const radius = optionsText.match(/radius\s+(-?[\d.]+)/)?.[1] ?? String(item.radius);
    return <label className="property-field-label">Radius<input aria-label="Random point radius" type="number" min="0.01" step="0.1" className="property-input" value={radius} onChange={event => setOptionsText(optionsText.replace(/radius\s+(-?[\d.]+)/, `radius ${event.target.value}`))} /></label>;
  }
  return null;
}

function ArcOptionsEditor({ node: rawNode, source, pointNames, setSource }: { node: AstNode; source: string; pointNames: string[]; setSource: (source: string) => void }) {
  const node = rawNode as Extract<AstNode, { type: 'Arc' }>;
  const [mode, setMode] = useState(node.mode);
  const [center, setCenter] = useState(node.center);
  const [first, setFirst] = useState(node.first);
  const [second, setSecond] = useState(node.second);
  const optionItems = splitTikzOptions(node.options ?? '');
  const [delta, setDelta] = useState(optionItems.find(option => option.startsWith('delta='))?.slice(6) ?? '0');
  const [reverse, setReverse] = useState(optionItems.includes('reverse'));
  useEffect(() => {
    setMode(node.mode); setCenter(node.center); setFirst(node.first); setSecond(node.second);
    const options = splitTikzOptions(node.options ?? '');
    setDelta(options.find(option => option.startsWith('delta='))?.slice(6) ?? '0');
    setReverse(options.includes('reverse'));
  }, [node.mode, node.center, node.first, node.second.join('|'), node.options]);
  const selectPoint = (label: string, value: string, onChange: (value: string) => void) => <label className="property-field-label">{label}<select aria-label={`Arc ${label.toLowerCase()}`} className="property-input" value={value} onChange={event => onChange(event.target.value)}>{pointNames.map(point => <option key={point} value={point}>{point}</option>)}</select></label>;
  const changeMode = (next: typeof mode) => {
    setMode(next);
    const fallback = pointNames.filter(point => point !== center);
    if (next === 'towards') { setFirst(fallback[0] ?? center); setSecond([fallback[1] ?? fallback[0] ?? center]); }
    else if (next === 'rotate') { setFirst(fallback[0] ?? center); setSecond(['90']); }
    else if (next === 'angles') { setFirst(fallback[0] ?? center); setSecond(['0', '90']); }
    else if (next === 'R') { setFirst('2'); setSecond(['0', '90']); }
    else { setFirst('2'); setSecond([fallback[0] ?? center, fallback[1] ?? fallback[0] ?? center]); }
  };
  const apply = () => {
    const target = locatorTarget(node);
    if (!target) return;
    const range = findTikzCommandRange(source, target);
    if (!range) return;
    const retained = splitTikzOptions(node.options ?? '').filter(option => !['towards', 'rotate', 'R', 'R with nodes', 'angles', 'reverse'].includes(option) && !option.startsWith('type=') && !option.startsWith('delta='));
    if (mode !== 'towards') retained.push(mode === 'R_with_nodes' ? 'R with nodes' : mode);
    if (Number(delta) !== 0) retained.push(`delta=${delta}`);
    if (reverse) retained.push('reverse');
    const optionBlock = retained.length ? `[${retained.join(', ')}]` : '';
    const command = `\\tkzDrawArc${optionBlock}(${center},${first})(${second.join(',')})`;
    setSource(`${source.slice(0, range.start)}${command}${source.slice(range.end)}`);
  };
  return <section className="property-card space-y-2.5"><span className="property-section-title">Arc geometry</span><label className="property-field-label">Mode<select aria-label="Arc mode" className="property-input" value={mode} onChange={event => changeMode(event.target.value as typeof mode)}><option value="towards">towards — start and direction point</option><option value="rotate">rotate — start point and sweep angle</option><option value="R">R — radius and two angles</option><option value="R_with_nodes">R with nodes — radius and two points</option><option value="angles">angles — radius point and two angles</option></select></label><div className="grid grid-cols-2 gap-2">{selectPoint('Center', center, setCenter)}{(mode === 'towards' || mode === 'rotate' || mode === 'angles') && selectPoint(mode === 'towards' ? 'Start point' : 'Radius point', first, setFirst)}{(mode === 'R' || mode === 'R_with_nodes') && <label className="property-field-label">Radius (cm)<input aria-label="Arc radius" type="number" min="0.01" step="0.1" className="property-input" value={first} onChange={event => setFirst(event.target.value)} /></label>}{mode === 'towards' && selectPoint('Direction point', second[0] ?? '', value => setSecond([value]))}{mode === 'rotate' && <label className="property-field-label">Rotation angle<input aria-label="Arc rotation angle" type="number" step="1" className="property-input" value={second[0] ?? '90'} onChange={event => setSecond([event.target.value])} /></label>}{(mode === 'R' || mode === 'angles') && <><label className="property-field-label">Start angle<input aria-label="Arc start angle" type="number" step="1" className="property-input" value={second[0] ?? '0'} onChange={event => setSecond([event.target.value, second[1] ?? '90'])} /></label><label className="property-field-label">End angle<input aria-label="Arc end angle" type="number" step="1" className="property-input" value={second[1] ?? '90'} onChange={event => setSecond([second[0] ?? '0', event.target.value])} /></label></>}{mode === 'R_with_nodes' && <>{selectPoint('Start point', second[0] ?? '', value => setSecond([value, second[1] ?? value]))}{selectPoint('End point', second[1] ?? '', value => setSecond([second[0] ?? value, value]))}</>}<label className="property-field-label">Delta<input aria-label="Arc delta" type="number" step="1" className="property-input" value={delta} onChange={event => setDelta(event.target.value)} /></label><label className="flex items-end gap-2 pb-2 text-xs font-semibold"><input aria-label="Arc reverse" type="checkbox" checked={reverse} onChange={event => setReverse(event.target.checked)} className="h-4 w-4 accent-indigo-500" />Reverse path</label></div><button type="button" aria-label="Apply arc geometry" onClick={apply} className="h-8 w-full rounded-lg bg-indigo-600 text-xs font-semibold text-white">Apply arc geometry</button></section>;
}

function SectorOptionsEditor({ node, source, pointNames, setSource }: { node: Extract<AstNode, { type: 'Sector' | 'FillSector' }>; source: string; pointNames: string[]; setSource: (source: string) => void }) {
  const [mode, setMode] = useState(node.mode);
  const [center, setCenter] = useState(node.center);
  const [first, setFirst] = useState(node.first);
  const [second, setSecond] = useState(node.second);
  useEffect(() => {
    setMode(node.mode); setCenter(node.center); setFirst(node.first); setSecond(node.second);
  }, [node.mode, node.center, node.first, node.second.join('|')]);
  const selectPoint = (label: string, value: string, onChange: (value: string) => void) => <label className="property-field-label">{label}<select aria-label={`Sector ${label.toLowerCase()}`} className="property-input" value={value} onChange={event => onChange(event.target.value)}>{pointNames.map(point => <option key={point} value={point}>{point}</option>)}</select></label>;
  const changeMode = (next: typeof mode) => {
    setMode(next);
    const fallback = pointNames.filter(point => point !== center);
    if (next === 'towards') { setFirst(fallback[0] ?? center); setSecond([fallback[1] ?? fallback[0] ?? center]); }
    else if (next === 'rotate') { setFirst(fallback[0] ?? center); setSecond(['90']); }
    else if (next === 'R') { setFirst('2'); setSecond(['0', '90']); }
    else { setFirst('2'); setSecond([fallback[0] ?? center, fallback[1] ?? fallback[0] ?? center]); }
  };
  const numericRadiusMode = mode === 'R' || mode === 'R_with_nodes';
  const valid = Boolean(center && first && second.length)
    && (!numericRadiusMode || Number(first) > 0)
    && (mode !== 'R' || second.length === 2 && second.every(value => Number.isFinite(Number(value))))
    && (mode !== 'R_with_nodes' || second.length === 2 && second.every(Boolean))
    && (mode !== 'rotate' || second.length === 1 && Number.isFinite(Number(second[0])))
    && (mode !== 'towards' || second.length === 1 && Boolean(second[0]));
  const apply = () => {
    const target = locatorTarget(node);
    if (!target || !valid) return;
    const range = findTikzCommandRange(source, target);
    if (!range) return;
    const retained = splitTikzOptions(node.options ?? '').filter(option => !['towards', 'rotate', 'R', 'R with nodes'].includes(option) && !option.startsWith('type='));
    if (mode !== 'towards') retained.push(mode === 'R_with_nodes' ? 'R with nodes' : mode);
    const optionBlock = retained.length ? `[${retained.join(', ')}]` : '';
    const command = `\\${node.type === 'FillSector' ? 'tkzFillSector' : 'tkzDrawSector'}${optionBlock}(${center},${first})(${second.join(',')})`;
    setSource(`${source.slice(0, range.start)}${command}${source.slice(range.end)}`);
  };
  return <section className="property-card space-y-2.5"><span className="property-section-title">Sector geometry</span><label className="property-field-label">Mode<select aria-label="Sector mode" className="property-input" value={mode} onChange={event => changeMode(event.target.value as typeof mode)}><option value="towards">towards — start and direction point</option><option value="rotate">rotate — start point and sweep angle</option><option value="R">R — radius and two angles</option><option value="R_with_nodes">R with nodes — radius and two points</option></select></label><div className="grid grid-cols-2 gap-2">{selectPoint('Center', center, setCenter)}{(mode === 'towards' || mode === 'rotate') && selectPoint('Start point', first, setFirst)}{(mode === 'R' || mode === 'R_with_nodes') && <label className="property-field-label">Radius (cm)<input aria-label="Sector radius" type="number" min="0.01" step="0.1" className="property-input" value={first} onChange={event => setFirst(event.target.value)} /></label>}{mode === 'towards' && selectPoint('Direction point', second[0] ?? '', value => setSecond([value]))}{mode === 'rotate' && <label className="property-field-label">Rotation angle<input aria-label="Sector rotation angle" type="number" step="1" className="property-input" value={second[0] ?? '90'} onChange={event => setSecond([event.target.value])} /></label>}{mode === 'R' && <><label className="property-field-label">Start angle<input aria-label="Sector start angle" type="number" step="1" className="property-input" value={second[0] ?? '0'} onChange={event => setSecond([event.target.value, second[1] ?? '90'])} /></label><label className="property-field-label">End angle<input aria-label="Sector end angle" type="number" step="1" className="property-input" value={second[1] ?? '90'} onChange={event => setSecond([second[0] ?? '0', event.target.value])} /></label></>}{mode === 'R_with_nodes' && <>{selectPoint('Start point', second[0] ?? '', value => setSecond([value, second[1] ?? value]))}{selectPoint('End point', second[1] ?? '', value => setSecond([second[0] ?? value, value]))}</>}</div><button type="button" aria-label="Apply sector geometry" disabled={!valid} onClick={apply} className="h-8 w-full rounded-lg bg-indigo-600 text-xs font-semibold text-white disabled:opacity-40">Apply sector geometry</button></section>;
}

function FillCircleGeometryEditor({ node, source, pointNames, setSource }: { node: Extract<AstNode, { type: 'FillCircle' }>; source: string; pointNames: string[]; setSource: (source: string) => void }) {
  const [center, setCenter] = useState(node.center);
  const [radius, setRadius] = useState(node.mode === 'radius' ? node.radius : pointNames.find(point => point !== node.center) ?? node.center);
  useEffect(() => { setCenter(node.center); setRadius(node.mode === 'radius' ? node.radius : pointNames.find(point => point !== node.center) ?? node.center); }, [node.mode, node.center, node.radius, pointNames.join('|')]);
  const apply = () => {
    const target = locatorTarget(node);
    const range = target ? findTikzCommandRange(source, target) : null;
    if (!range || !center || !radius || center === radius) return;
    const retained = splitTikzOptions(node.options ?? '').filter(option => !['R', 'radius'].includes(option));
    const command = `\\tkzFillCircle${retained.length ? `[${retained.join(', ')}]` : ''}(${center},${radius})`;
    setSource(`${source.slice(0, range.start)}${command}${source.slice(range.end)}`);
  };
  return <section className="property-card space-y-2.5"><span className="property-section-title">Circle fill geometry</span><div className="grid grid-cols-2 gap-2"><label className="property-field-label">Center<select aria-label="Fill circle center" className="property-input" value={center} onChange={event => setCenter(event.target.value)}>{pointNames.map(point => <option key={point} value={point}>{point}</option>)}</select></label><label className="property-field-label">Radius point<select aria-label="Fill circle radius point" className="property-input" value={radius} onChange={event => setRadius(event.target.value)}>{pointNames.map(point => <option key={point} value={point}>{point}</option>)}</select></label></div><p className="text-[10px] text-slate-500">This tkz-euclide version fills circles using a center and an existing radius point.</p><button type="button" aria-label="Apply fill circle geometry" disabled={!center || !radius || center === radius} onClick={apply} className="h-8 w-full rounded-lg bg-indigo-600 text-xs font-semibold text-white disabled:opacity-40">Apply circle geometry</button></section>;
}

function SectorClipProperty({ node, source, setSource }: { node: Extract<AstNode, { type: 'Sector' | 'FillSector' }>; source: string; setSource: (source: string) => void }) {
  const args = `${node.center},${node.first}`;
  const second = node.second.join(',');
  const pattern = new RegExp(`\\\\tkzClipSector(?:\\[[^\\]]*\\])?\\s*\\(${escaped(args)}\\)\\s*\\(${escaped(second)}\\)`);
  const enabled = pattern.test(source);
  const supported = node.mode !== 'R_with_nodes';
  const update = (next: boolean) => {
    if (!next) { setSource(source.replace(pattern, '')); return; }
    if (!supported) return;
    const target = locatorTarget(node);
    const range = target ? findTikzCommandRange(source, target) : null;
    if (!range) return;
    const mode = node.mode === 'towards' ? '' : `[${node.mode}]`;
    setSource(`${source.slice(0, range.end)}\n\\tkzClipSector${mode}(${args})(${second})${source.slice(range.end)}`);
  };
  return <section className="property-card space-y-2"><span className="property-section-title">Sector clipping</span><label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input aria-label="Sector clipping enabled" type="checkbox" checked={enabled} disabled={!supported} onChange={event => update(event.target.checked)} className="h-4 w-4 accent-cyan-600" />Use this sector as a clipping mask</label>{!supported && <p className="text-[10px] text-amber-600">`tkzClipSector` does not support `R with nodes`. Change the sector to towards, rotate or R first.</p>}<p className="text-[10px] text-slate-500">The mask affects commands that follow it in the source.</p></section>;
}

function SectorClipOptionsEditor({ node, source, pointNames, setSource }: { node: Extract<AstNode, { type: 'SectorClip' }>; source: string; pointNames: string[]; setSource: (source: string) => void }) {
  const [mode, setMode] = useState(node.mode);
  const [center, setCenter] = useState(node.center);
  const [first, setFirst] = useState(node.first);
  const [second, setSecond] = useState(node.second);
  useEffect(() => { setMode(node.mode); setCenter(node.center); setFirst(node.first); setSecond(node.second); }, [node.mode, node.center, node.first, node.second.join('|')]);
  const changeMode = (next: typeof mode) => { setMode(next); const fallback = pointNames.filter(point => point !== center); if (next === 'towards') { setFirst(fallback[0] ?? center); setSecond([fallback[1] ?? fallback[0] ?? center]); } else if (next === 'rotate') { setFirst(fallback[0] ?? center); setSecond(['90']); } else { setFirst('2'); setSecond(['0', '90']); } };
  const selectPoint = (label: string, value: string, onChange: (value: string) => void) => <label className="property-field-label">{label}<select aria-label={`Clip sector ${label.toLowerCase()}`} className="property-input" value={value} onChange={event => onChange(event.target.value)}>{pointNames.map(point => <option key={point} value={point}>{point}</option>)}</select></label>;
  const apply = () => { const target = locatorTarget(node); const range = target ? findTikzCommandRange(source, target) : null; if (!range) return; const command = `\\tkzClipSector${mode === 'towards' ? '' : `[${mode}]`}(${center},${first})(${second.join(',')})`; setSource(`${source.slice(0, range.start)}${command}${source.slice(range.end)}`); };
  return <section className="property-card space-y-2.5"><span className="property-section-title">Sector clip geometry</span><label className="property-field-label">Mode<select aria-label="Clip sector mode" className="property-input" value={mode} onChange={event => changeMode(event.target.value as typeof mode)}><option value="towards">towards</option><option value="rotate">rotate</option><option value="R">R — radius and angles</option></select></label><div className="grid grid-cols-2 gap-2">{selectPoint('Center', center, setCenter)}{mode !== 'R' ? selectPoint('Start point', first, setFirst) : <label className="property-field-label">Radius<input aria-label="Clip sector radius" type="number" min="0.01" step="0.1" className="property-input" value={first} onChange={event => setFirst(event.target.value)} /></label>}{mode === 'towards' && selectPoint('Direction point', second[0] ?? '', value => setSecond([value]))}{mode === 'rotate' && <label className="property-field-label">Angle<input aria-label="Clip sector rotation angle" type="number" className="property-input" value={second[0] ?? '90'} onChange={event => setSecond([event.target.value])} /></label>}{mode === 'R' && <><label className="property-field-label">Start angle<input aria-label="Clip sector start angle" type="number" className="property-input" value={second[0] ?? '0'} onChange={event => setSecond([event.target.value, second[1] ?? '90'])} /></label><label className="property-field-label">End angle<input aria-label="Clip sector end angle" type="number" className="property-input" value={second[1] ?? '90'} onChange={event => setSecond([second[0] ?? '0', event.target.value])} /></label></>}</div><button type="button" aria-label="Apply sector clip geometry" onClick={apply} className="h-8 w-full rounded-lg bg-indigo-600 text-xs font-semibold text-white">Apply clip geometry</button></section>;
}

function MarkOptionsEditor({ node, source, setSource }: { node: Extract<AstNode, { type: 'SegmentMark' | 'SegmentsMark' | 'ArcMark' }>; source: string; setSource: (source: string) => void }) {
  const [optionsText, setOptionsText] = useState(node.options ?? '');
  useEffect(() => setOptionsText(node.options ?? ''), [node.options]);
  const options = splitTikzOptions(optionsText);
  const value = (key: string, fallback: string) => options.find(option => option.startsWith(`${key}=`))?.slice(key.length + 1).trim() ?? fallback;
  const replace = (key: string, next: string, fallback: string) => setOptionsText([...options.filter(option => !option.startsWith(`${key}=`)), ...(next !== fallback ? [`${key}=${next}`] : [])].join(', '));
  const apply = () => { const target = locatorTarget(node); if (target) setSource(updateTikzCommandOptions(source, target, optionsText)); };
  return <section className="property-card space-y-2.5"><span className="property-section-title">Mark appearance</span><div className="grid grid-cols-2 gap-2"><label className="property-field-label">Mark<select aria-label="Mark symbol" className="property-input font-mono" value={value('mark', 'none')} onChange={event => replace('mark', event.target.value, 'none')}><option value="none">none</option>{['|', '||', '|||', 's', 's|', 's||', 'z', 'x', 'o', 'oo'].map(mark => <option key={mark} value={mark}>{mark}</option>)}</select></label><label className="property-field-label">Position<input aria-label="Mark position" type="number" min="0" max="1" step="0.05" className="property-input" value={value('pos', '.5')} onChange={event => replace('pos', event.target.value, '.5')} /></label><label className="property-field-label">Size (pt)<input aria-label="Mark size" type="number" min="0.5" step="0.5" className="property-input" value={value('size', '4pt').replace('pt', '')} onChange={event => replace('size', `${event.target.value}pt`, '4pt')} /></label><TikzColorField label="Color" ariaLabel="Mark color" value={value('color', 'black')} onChange={next => replace('color', next, 'black')} /></div><div className="flex gap-2"><input aria-label="Mark advanced options" className="property-input min-w-0 flex-1" value={optionsText} onChange={event => setOptionsText(event.target.value)} /><button type="button" aria-label="Apply mark options" onClick={apply} className="rounded-lg bg-indigo-600 px-3 text-white"><Check size={12} /></button></div></section>;
}

function ArcMarkProperty({ node: rawNode, source, setSource }: { node: AstNode; source: string; setSource: (source: string) => void }) {
  const node = rawNode as Extract<AstNode, { type: 'Arc' }>;
  const supported = node.mode === 'towards';
  const args = supported ? `${node.center},${node.first},${node.second[0]}` : '';
  const pattern = args ? new RegExp(`\\\\tkzMarkArc(?:\\[([^\\]]*)\\])?\\s*\\(${escaped(args)}\\)`) : null;
  const match = pattern ? source.match(pattern) : null;
  const enabled = Boolean(match);
  const options = splitTikzOptions(match?.[1] ?? 'mark=|,size=4pt,pos=.5');
  const value = (key: string, fallback: string) => options.find(option => option.startsWith(`${key}=`))?.slice(key.length + 1).trim() ?? fallback;
  const update = (next: boolean, nextOptions = options) => {
    if (!pattern) return;
    if (!next) { setSource(source.replace(pattern, '')); return; }
    const optionText = nextOptions.join(',');
    const command = `\\tkzMarkArc${optionText ? `[${optionText}]` : ''}(${args})`;
    if (enabled) { setSource(source.replace(pattern, command)); return; }
    const target = locatorTarget(node); const range = target ? findTikzCommandRange(source, target) : null;
    if (range) setSource(`${source.slice(0, range.end)}\n${command}${source.slice(range.end)}`);
  };
  const updateOption = (key: string, next: string, fallback: string) => {
    const retained = options.filter(option => !option.startsWith(`${key}=`));
    if (next !== fallback) retained.push(`${key}=${next}`);
    update(true, retained);
  };
  return <section className="property-card space-y-2"><span className="property-section-title">Arc marking</span><label className="flex items-center gap-2 text-xs font-semibold"><input aria-label="Arc marking enabled" type="checkbox" checked={enabled} disabled={!supported} onChange={event => update(event.target.checked)} className="h-4 w-4 accent-indigo-500" />Add a mark to this arc</label>{enabled && <div className="grid grid-cols-2 gap-2"><label className="property-field-label">Mark<select aria-label="Arc mark symbol" className="property-input font-mono" value={value('mark', 'none')} onChange={event => updateOption('mark', event.target.value, 'none')}><option value="none">none</option>{['|', '||', '|||', 's', 's|', 's||', 'z', 'x', 'o', 'oo'].map(mark => <option key={mark} value={mark}>{mark}</option>)}</select></label><label className="property-field-label">Position<input aria-label="Arc mark position" type="number" min="0" max="1" step="0.05" className="property-input" value={value('pos', '.5')} onChange={event => updateOption('pos', event.target.value, '.5')} /></label><label className="property-field-label">Size (pt)<input aria-label="Arc mark size" type="number" min="0.5" step="0.5" className="property-input" value={value('size', '4pt').replace('pt', '')} onChange={event => updateOption('size', `${event.target.value}pt`, '4pt')} /></label><TikzColorField label="Color" ariaLabel="Arc mark color" value={value('color', 'black')} onChange={next => updateOption('color', next, 'black')} /></div>}{!supported && <p className="text-[10px] text-amber-600">Arc markings require center, start and end point references. Change the arc to `towards` first.</p>}</section>;
}

function ArcLabelProperty({ node: rawNode, source, setSource }: { node: AstNode; source: string; setSource: (source: string) => void }) {
  const node = rawNode as Extract<AstNode, { type: 'Arc' }>;
  const supported = node.mode === 'towards';
  const args = supported ? `${node.center},${node.first},${node.second[0]}` : '';
  const pattern = args ? new RegExp(`\\\\tkzLabelArc(?:\\[([^\\]]*)\\])?\\s*\\(${escaped(args)}\\)\\s*\\{((?:[^{}]|\\{[^{}]*\\})*)\\}`) : null;
  const match = pattern ? source.match(pattern) : null;
  const enabled = Boolean(match);
  const defaultText = supported ? `$\\frown ${node.first}${node.second[0]}$` : '$\\frown AB$';
  const options = splitTikzOptions(match?.[1] ?? 'pos=.5');
  const [text, setText] = useState(match?.[2] ?? defaultText);
  useEffect(() => setText(match?.[2] ?? defaultText), [match?.[2], defaultText]);
  const value = (key: string, fallback: string) => options.find(option => option.startsWith(`${key}=`))?.slice(key.length + 1).trim() ?? fallback;
  const placements = ['above', 'below', 'left', 'right', 'above left', 'above right', 'below left', 'below right'];
  const placement = options.find(option => placements.some(item => option === item || option.startsWith(`${item}=`))) ?? 'default';
  const update = (nextEnabled: boolean, nextOptions = options, nextText = text) => {
    if (!pattern) return;
    if (!nextEnabled) { setSource(source.replace(pattern, '')); return; }
    const optionText = nextOptions.join(',');
    const command = `\\tkzLabelArc${optionText ? `[${optionText}]` : ''}(${args}){${nextText}}`;
    if (enabled) { setSource(source.replace(pattern, command)); return; }
    const target = locatorTarget(node); const range = target ? findTikzCommandRange(source, target) : null;
    if (range) setSource(`${source.slice(0, range.end)}\n${command}${source.slice(range.end)}`);
  };
  const updateOption = (matches: (option: string) => boolean, next?: string) => update(true, [...options.filter(option => !matches(option)), ...(next ? [next] : [])]);
  return <section className="property-card space-y-2.5"><span className="property-section-title">Arc label</span><label className="flex items-center gap-2 text-xs font-semibold"><input aria-label="Arc label enabled" type="checkbox" checked={enabled} disabled={!supported} onChange={event => update(event.target.checked)} className="h-4 w-4 accent-indigo-500" />Add a label to this arc</label>{enabled && <><label className="property-field-label">Text<input aria-label="Arc label text" className="property-input font-mono" value={text} onChange={event => setText(event.target.value)} onBlur={() => update(true, options, text)} /></label><div className="grid grid-cols-2 gap-2"><label className="property-field-label">Position t<input aria-label="Arc label position" type="number" min="0" max="1" step="0.05" className="property-input" value={value('pos', '.5')} onChange={event => updateOption(option => option.startsWith('pos='), event.target.value !== '.5' ? `pos=${event.target.value}` : undefined)} /></label><label className="property-field-label">Placement<select aria-label="Arc label placement" className="property-input" value={placement} onChange={event => updateOption(option => placements.some(item => option === item || option.startsWith(`${item}=`)), event.target.value !== 'default' ? event.target.value : undefined)}><option value="default">Default</option>{placements.map(item => <option key={item}>{item}</option>)}</select></label><TikzColorField label="Color" ariaLabel="Arc label color" value={value('color', 'black')} onChange={next => updateOption(option => option.startsWith('color='), next !== 'black' ? `color=${next}` : undefined)} /></div></>}{!supported && <p className="text-[10px] text-amber-600">Arc labels require center, start and end point references. Change the arc to `towards` first.</p>}</section>;
}

function PathLabelProperty({ node, source, setSource }: { node: Extract<AstNode, { type: 'Segment' | 'Segments' | 'Line' }>; source: string; setSource: (source: string) => void }) {
  const command = node.type === 'Segment' ? 'tkzLabelSegment' : node.type === 'Segments' ? 'tkzLabelSegments' : 'tkzLabelLine';
  const args = node.type === 'Segments' ? node.pairs.map(pair => pair.join(',')).join(' ') : `${node.p1},${node.p2}`;
  const defaultText = node.type === 'Line' ? `$(${node.p1}${node.p2})$` : node.type === 'Segment' ? `$${node.p1}${node.p2}$` : '$a$';
  const pattern = new RegExp(`\\\\${command}(?:\\[([^\\]]*)\\])?\\s*\\(${escaped(args)}\\)\\s*\\{((?:[^{}]|\\{[^{}]*\\})*)\\}`);
  const match = source.match(pattern);
  const enabled = Boolean(match);
  const options = splitTikzOptions(match?.[1] ?? (node.type === 'Line' ? 'pos=.5' : 'auto'));
  const [text, setText] = useState(match?.[2] ?? defaultText);
  useEffect(() => setText(match?.[2] ?? defaultText), [match?.[2], defaultText]);
  const value = (key: string, fallback: string) => options.find(option => option.startsWith(`${key}=`))?.slice(key.length + 1).trim() ?? fallback;
  const placements = ['auto', 'above', 'below', 'left', 'right', 'above left', 'above right', 'below left', 'below right'];
  const placement = options.find(option => placements.includes(option)) ?? 'default';
  const update = (nextEnabled: boolean, nextOptions = options, nextText = text) => {
    if (!nextEnabled) { setSource(source.replace(pattern, '')); return; }
    const optionText = nextOptions.join(',');
    const labelCommand = `\\${command}${optionText ? `[${optionText}]` : ''}(${args}){${nextText}}`;
    if (enabled) { setSource(source.replace(pattern, labelCommand)); return; }
    const target = locatorTarget(node); const range = target ? findTikzCommandRange(source, target) : null;
    if (range) setSource(`${source.slice(0, range.end)}\n${labelCommand}${source.slice(range.end)}`);
  };
  const updateOption = (matches: (option: string) => boolean, next?: string) => update(true, [...options.filter(option => !matches(option)), ...(next ? [next] : [])]);
  return <section className="property-card space-y-2.5"><span className="property-section-title">{node.type === 'Line' ? 'Line label' : 'Segment label'}</span><label className="flex items-center gap-2 text-xs font-semibold"><input aria-label={`${node.type} label enabled`} type="checkbox" checked={enabled} onChange={event => update(event.target.checked)} className="h-4 w-4 accent-indigo-500" />Add a label to this {node.type === 'Line' ? 'line' : 'segment'}</label>{enabled && <><label className="property-field-label">Text<input aria-label={`${node.type} label text`} className="property-input font-mono" value={text} onChange={event => setText(event.target.value)} onBlur={() => update(true, options, text)} /></label><div className="grid grid-cols-2 gap-2"><label className="property-field-label">Position t<input aria-label={`${node.type} label position`} type="number" step="0.1" className="property-input" value={value('pos', '.5')} onChange={event => updateOption(option => option.startsWith('pos='), event.target.value !== '.5' ? `pos=${event.target.value}` : undefined)} /></label><label className="property-field-label">Placement<select aria-label={`${node.type} label placement`} className="property-input" value={placement} onChange={event => updateOption(option => placements.includes(option), event.target.value !== 'default' ? event.target.value : undefined)}><option value="default">Default</option>{placements.map(item => <option key={item}>{item}</option>)}</select></label><TikzColorField label="Color" ariaLabel={`${node.type} label color`} value={value('color', 'black')} onChange={next => updateOption(option => option.startsWith('color='), next !== 'black' ? `color=${next}` : undefined)} /><label className="flex items-center gap-2 text-xs font-semibold"><input aria-label={`${node.type} label swap`} type="checkbox" checked={options.includes('swap')} onChange={event => updateOption(option => option === 'swap', event.target.checked ? 'swap' : undefined)} />Swap side</label><label className="flex items-center gap-2 text-xs font-semibold"><input aria-label={`${node.type} label sloped`} type="checkbox" checked={options.includes('sloped')} onChange={event => updateOption(option => option === 'sloped', event.target.checked ? 'sloped' : undefined)} />Follow slope</label></div></>}</section>;
}

function AngleLabelProperty({ node, source, setSource }: { node: Extract<AstNode, { type: 'AngleMark' | 'AnglesMark' }>; source: string; setSource: (source: string) => void }) {
  const command = node.type === 'AngleMark' ? 'tkzLabelAngle' : 'tkzLabelAngles';
  const args = node.type === 'AngleMark' ? `${node.p1},${node.vertex},${node.p2}` : node.angles.map(angle => angle.join(',')).join(' ');
  const pattern = new RegExp(`\\\\${command}(?:\\[([^\\]]*)\\])?\\s*\\(${escaped(args)}\\)\\s*\\{((?:[^{}]|\\{[^{}]*\\})*)\\}`);
  const match = source.match(pattern); const enabled = Boolean(match);
  const options = splitTikzOptions(match?.[1] ?? 'pos=1');
  const [text, setText] = useState(match?.[2] ?? '$\\alpha$');
  useEffect(() => setText(match?.[2] ?? '$\\alpha$'), [match?.[2]]);
  const value = (key: string, fallback: string) => options.find(option => option.startsWith(`${key}=`))?.slice(key.length + 1).trim() ?? fallback;
  const update = (nextEnabled: boolean, nextOptions = options, nextText = text) => {
    if (!nextEnabled) { setSource(source.replace(pattern, '')); return; }
    const optionText = nextOptions.join(','); const nextCommand = `\\${command}${optionText ? `[${optionText}]` : ''}(${args}){${nextText}}`;
    if (enabled) { setSource(source.replace(pattern, nextCommand)); return; }
    const target = locatorTarget(node); const range = target ? findTikzCommandRange(source, target) : null;
    if (range) setSource(`${source.slice(0, range.end)}\n${nextCommand}${source.slice(range.end)}`);
  };
  const updateOption = (key: string, next: string, fallback: string) => update(true, [...options.filter(option => !option.startsWith(`${key}=`)), ...(next !== fallback ? [`${key}=${next}`] : [])]);
  return <section className="property-card space-y-2"><span className="property-section-title">Angle label</span><label className="flex items-center gap-2 text-xs font-semibold"><input aria-label="Angle label enabled" type="checkbox" checked={enabled} onChange={event => update(event.target.checked)} />Add label</label>{enabled && <><label className="property-field-label">Text<input aria-label="Angle label text" className="property-input font-mono" value={text} onChange={event => setText(event.target.value)} onBlur={() => update(true, options, text)} /></label><div className="grid grid-cols-2 gap-2"><label className="property-field-label">Distance / pos<input aria-label="Angle label position" type="number" step="0.1" className="property-input" value={value('pos', '1')} onChange={event => updateOption('pos', event.target.value, '1')} /></label><TikzColorField label="Color" ariaLabel="Angle label color" value={value('color', 'black')} onChange={next => updateOption('color', next, 'black')} /></div></>}</section>;
}

function CircleLabelProperty({ node, source, setSource }: { node: Extract<AstNode, { type: 'Circle' }>; source: string; setSource: (source: string) => void }) {
  const args = `${node.center},${node.radius_point}`;
  const pattern = new RegExp(`\\\\tkzLabelCircle(?:\\[([^\\]]*)\\])?\\s*\\(${escaped(args)}\\)\\s*\\(([^)]*)\\)\\s*\\{((?:[^{}]|\\{[^{}]*\\})*)\\}`);
  const match = source.match(pattern); const enabled = Boolean(match); const options = splitTikzOptions(match?.[1] ?? 'above');
  const [angle, setAngle] = useState(match?.[2] ?? '45'); const [text, setText] = useState(match?.[3] ?? '$\\mathcal{C}$');
  useEffect(() => { setAngle(match?.[2] ?? '45'); setText(match?.[3] ?? '$\\mathcal{C}$'); }, [match?.[2], match?.[3]]);
  const update = (nextEnabled: boolean, nextOptions = options, nextAngle = angle, nextText = text) => {
    if (!nextEnabled) { setSource(source.replace(pattern, '')); return; }
    const optionText = nextOptions.join(','); const nextCommand = `\\tkzLabelCircle${optionText ? `[${optionText}]` : ''}(${args})(${nextAngle}){${nextText}}`;
    if (enabled) { setSource(source.replace(pattern, nextCommand)); return; }
    const target = locatorTarget(node); const range = target ? findTikzCommandRange(source, target) : null;
    if (range) setSource(`${source.slice(0, range.end)}\n${nextCommand}${source.slice(range.end)}`);
  };
  return <section className="property-card space-y-2"><span className="property-section-title">Circle label</span><label className="flex items-center gap-2 text-xs font-semibold"><input aria-label="Circle label enabled" type="checkbox" checked={enabled} onChange={event => update(event.target.checked)} />Add label</label>{enabled && <div className="grid grid-cols-2 gap-2"><label className="property-field-label col-span-2">Text<input aria-label="Circle label text" className="property-input font-mono" value={text} onChange={event => setText(event.target.value)} onBlur={() => update(true, options, angle, text)} /></label><label className="property-field-label">Angle<input aria-label="Circle label angle" type="number" className="property-input" value={angle} onChange={event => setAngle(event.target.value)} onBlur={() => update(true, options, angle, text)} /></label><TikzColorField label="Color" ariaLabel="Circle label color" value={options.find(option => option.startsWith('color='))?.slice(6) ?? 'black'} onChange={next => update(true, [...options.filter(option => !option.startsWith('color=')), ...(next !== 'black' ? [`color=${next}`] : [])])} /></div>}</section>;
}

const labelTitle = (node: LabelNode) => {
  switch (node.type) {
    case 'LabelPoint': return 'Point label';
    case 'LabelPoints': return 'Point labels';
    case 'AutoLabelPoints': return 'Auto point labels';
    case 'LabelSegment': return 'Segment label';
    case 'LabelSegments': return 'Segment labels';
    case 'LabelLine': return 'Line label';
    case 'LabelAngle': return 'Angle label';
    case 'LabelAngles': return 'Angle labels';
    case 'LabelCircle': return 'Circle label';
    case 'LabelArc': return 'Arc label';
  }
};

const labelReferenceLabels = (node: LabelNode, index: number) => {
  if (node.type === 'LabelCircle') return index === 0 ? 'Center' : 'Radius point';
  if (node.type === 'LabelArc') return ['Center', 'Start', 'End'][index] ?? `Reference ${index + 1}`;
  if (node.type === 'LabelAngle') return ['First side', 'Vertex', 'Second side'][index] ?? `Reference ${index + 1}`;
  if (node.type === 'LabelSegment' || node.type === 'LabelLine') return index === 0 ? 'First point' : 'Second point';
  if (node.type === 'LabelPoint') return 'Point';
  return `Reference ${index + 1}`;
};

function LabelCommandInspector({ node, source, pointNames, setSource, onClose }: { node: LabelNode; source: string; pointNames: string[]; setSource: (source: string) => void; onClose: () => void }) {
  const initialSpec = labelCommandSpec(node);
  const [references, setReferences] = useState(labelNodeReferences(node));
  const [optionsText, setOptionsText] = useState(node.options ?? '');
  const [text, setText] = useState(initialSpec.text ?? '');
  const [angle, setAngle] = useState(initialSpec.angle ?? '45');
  const referenceKey = labelNodeReferences(node).join('|');
  useEffect(() => {
    const spec = labelCommandSpec(node);
    setReferences(labelNodeReferences(node));
    setOptionsText(node.options ?? '');
    setText(spec.text ?? '');
    setAngle(spec.angle ?? '45');
  }, [node, referenceKey]);

  const options = splitTikzOptions(optionsText);
  const value = (key: string, fallback: string) => options.find(option => option.startsWith(`${key}=`))?.slice(key.length + 1).trim() ?? fallback;
  const replaceOption = (matches: (option: string) => boolean, next?: string) => setOptionsText([...options.filter(option => !matches(option)), ...(next ? [next] : [])].join(', '));
  const placements = ['auto', 'above', 'below', 'left', 'right', 'above left', 'above right', 'below left', 'below right'];
  const placement = options.find(option => placements.some(item => option === item || option.startsWith(`${item}=`))) ?? 'default';
  const updateReference = (index: number, next: string) => setReferences(current => current.map((value, itemIndex) => itemIndex === index ? next : value));

  const groupedArgs = (size: number) => {
    const groups: string[] = [];
    for (let index = 0; index < references.length; index += size) {
      groups.push(references.slice(index, index + size).join(','));
    }
    return groups.join(' ');
  };
  const args = () => {
    switch (node.type) {
      case 'LabelPoint': return references[0] ?? '';
      case 'LabelPoints': case 'AutoLabelPoints': return references.join(',');
      case 'LabelSegment': case 'LabelLine': case 'LabelCircle': return references.slice(0, 2).join(',');
      case 'LabelSegments': return groupedArgs(2);
      case 'LabelAngle': case 'LabelArc': return references.slice(0, 3).join(',');
      case 'LabelAngles': return groupedArgs(3);
    }
  };
  const buildCommand = () => {
    const spec = labelCommandSpec(node);
    const optionBlock = optionsText.trim() ? `[${optionsText.trim()}]` : '';
    const commandArgs = args();
    if (node.type === 'LabelCircle') return `\\${spec.command}${optionBlock}(${commandArgs})(${angle}){${text}}`;
    if (spec.text !== undefined) return `\\${spec.command}${optionBlock}(${commandArgs}){${text}}`;
    return `\\${spec.command}${optionBlock}(${commandArgs})`;
  };
  const apply = () => {
    const pattern = labelCommandPattern(node);
    const nextCommand = buildCommand();
    const nextSource = source.replace(pattern, nextCommand);
    setSource(nextSource);
  };
  const choices = Array.from(new Set([...pointNames, ...references])).filter(Boolean);
  const listId = `label-reference-options-${initialSpec.command}-${initialSpec.args.replace(/[^A-Za-z0-9_-]/g, '-')}`;

  return <div className="h-[30rem] border-t border-slate-200 bg-white flex flex-col shrink-0"><header className="h-12 flex items-center justify-between gap-2 px-3 border-b border-slate-200 bg-slate-50/80 shrink-0"><div className="flex items-center gap-2"><Settings2 size={14} className="text-indigo-500" /><div><h2 className="text-xs font-bold uppercase tracking-[0.1em] text-slate-700">{labelTitle(node)}</h2><p className="text-[10px] text-slate-400">Standalone annotation command</p></div></div><button type="button" onClick={onClose} className="inspector-close"><X size={15} /></button></header><div className="inspector-scroll flex-1 space-y-3 overflow-y-auto p-3"><section className="property-card space-y-2"><span className="property-section-title">References</span><datalist id={listId}>{choices.map(choice => <option key={choice} value={choice} />)}</datalist><div className="grid grid-cols-2 gap-2">{references.map((reference, index) => <label className="property-field-label" key={`${reference}-${index}`}>{labelReferenceLabels(node, index)}<input aria-label={`${labelTitle(node)} ${labelReferenceLabels(node, index).toLowerCase()}`} list={listId} className="property-input font-mono" value={reference} onChange={event => updateReference(index, event.target.value)} /></label>)}</div>{node.type === 'AutoLabelPoints' && <div className="grid grid-cols-2 gap-2"><label className="property-field-label">Center point<input aria-label="Auto point labels center" list={listId} className="property-input font-mono" value={value('center', node.center ?? '')} onChange={event => replaceOption(option => option.startsWith('center='), event.target.value ? `center=${event.target.value}` : undefined)} /></label><label className="property-field-label">Distance<input aria-label="Auto point labels distance" type="number" min="0" step="0.05" className="property-input" value={value('dist', node.distance !== undefined ? String(node.distance) : '0.15')} onChange={event => replaceOption(option => option.startsWith('dist='), event.target.value !== '0.15' ? `dist=${event.target.value}` : undefined)} /></label></div>}</section>{initialSpec.text !== undefined && <section className="property-card space-y-2"><span className="property-section-title">Text</span><input aria-label={`${labelTitle(node)} text`} className="property-input font-mono" value={text} onChange={event => setText(event.target.value)} />{node.type === 'LabelCircle' && <label className="property-field-label">Angle<input aria-label="Circle label angle" className="property-input" value={angle} onChange={event => setAngle(event.target.value)} /></label>}</section>}<section className="property-card space-y-2"><span className="property-section-title">Appearance</span><div className="grid grid-cols-2 gap-2"><TikzColorField label="Color" ariaLabel={`${labelTitle(node)} color`} value={value('color', 'black')} onChange={next => replaceOption(option => option.startsWith('color='), next !== 'black' ? `color=${next}` : undefined)} /><label className="property-field-label">Placement<select aria-label={`${labelTitle(node)} placement`} className="property-input" value={placement} onChange={event => replaceOption(option => placements.some(item => option === item || option.startsWith(`${item}=`)), event.target.value !== 'default' ? event.target.value : undefined)}><option value="default">Default</option>{placements.map(item => <option key={item}>{item}</option>)}</select></label><label className="property-field-label">Position t<input aria-label={`${labelTitle(node)} position`} type="number" step="0.05" className="property-input" value={value('pos', '')} onChange={event => replaceOption(option => option.startsWith('pos='), event.target.value ? `pos=${event.target.value}` : undefined)} /></label>{(node.type === 'LabelSegment' || node.type === 'LabelSegments' || node.type === 'LabelLine') && <><label className="flex items-center gap-2 text-xs font-semibold"><input aria-label={`${labelTitle(node)} swap`} type="checkbox" checked={options.includes('swap')} onChange={event => replaceOption(option => option === 'swap', event.target.checked ? 'swap' : undefined)} />Swap side</label><label className="flex items-center gap-2 text-xs font-semibold"><input aria-label={`${labelTitle(node)} sloped`} type="checkbox" checked={options.includes('sloped')} onChange={event => replaceOption(option => option === 'sloped', event.target.checked ? 'sloped' : undefined)} />Follow slope</label></>}</div><div className="flex gap-2"><input aria-label={`${labelTitle(node)} advanced options`} className="property-input min-w-0 flex-1" value={optionsText} onChange={event => setOptionsText(event.target.value)} placeholder="Advanced TikZ options" /><button type="button" aria-label={`Apply ${labelTitle(node)}`} onClick={apply} className="rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white"><Check size={12} /></button></div></section></div></div>;
}

function EllipseGeometryEditor({ node, source, setSource }: { node: Extract<AstNode, { type: 'Ellipse' }>; source: string; setSource: (source: string) => void }) {
  const [xRadius, setXRadius] = useState(String(node.x_radius));
  const [yRadius, setYRadius] = useState(String(node.y_radius));
  const [angle, setAngle] = useState(String(node.angle));
  useEffect(() => { setXRadius(String(node.x_radius)); setYRadius(String(node.y_radius)); setAngle(String(node.angle)); }, [node.x_radius, node.y_radius, node.angle]);
  const valid = Number(xRadius) > 0 && Number(yRadius) > 0 && Number.isFinite(Number(angle));
  const apply = () => {
    const target = locatorTarget(node);
    if (!target || !valid) return;
    const range = findTikzCommandRange(source, target);
    if (!range) return;
    const optionBlock = node.options?.trim() ? `[${node.options}]` : '';
    const command = `\\tkzDrawEllipse${optionBlock}(${node.center},${xRadius},${yRadius},${angle})`;
    setSource(`${source.slice(0, range.start)}${command}${source.slice(range.end)}`);
  };
  return <section className="property-card space-y-2.5"><span className="property-section-title">Ellipse geometry</span><div className="grid grid-cols-3 gap-2"><label className="property-field-label">X radius<input aria-label="Ellipse x radius" type="number" min="0.01" step="0.1" className="property-input" value={xRadius} onChange={event => setXRadius(event.target.value)} /></label><label className="property-field-label">Y radius<input aria-label="Ellipse y radius" type="number" min="0.01" step="0.1" className="property-input" value={yRadius} onChange={event => setYRadius(event.target.value)} /></label><label className="property-field-label">Angle<input aria-label="Ellipse angle" type="number" step="1" className="property-input" value={angle} onChange={event => setAngle(event.target.value)} /></label></div><button type="button" aria-label="Apply ellipse geometry" disabled={!valid} onClick={apply} className="h-8 w-full rounded-lg bg-indigo-600 text-xs font-semibold text-white disabled:opacity-40">Apply ellipse geometry</button></section>;
}

function AngleRetrievalInspector({ node, source, setSource, onClose }: { node: Extract<AstNode, { type: 'AngleRetrieval' }>; source: string; setSource: (source: string) => void; onClose: () => void }) {
  const [macro, setMacro] = useState(node.macro);
  useEffect(() => setMacro(node.macro), [node.macro]);
  const cleanMacro = macro.trim();
  const valid = /^[A-Za-z]+$/.test(cleanMacro);
  const apply = () => {
    if (!valid) return;
    const pattern = new RegExp(`\\\\tkzGetAngle\\s*\\{\\s*${escaped(node.macro)}\\s*\\}`);
    setSource(source.replace(pattern, `\\tkzGetAngle{${cleanMacro}}`));
  };
  return (
    <div className="h-[30rem] border-t border-slate-200 bg-white flex flex-col shrink-0">
      <header className="h-12 flex items-center justify-between gap-2 px-3 border-b border-slate-200 bg-slate-50/80 shrink-0">
        <div className="flex min-w-0 items-center gap-2">
          <Settings2 size={14} className="shrink-0 text-amber-600" />
          <div className="min-w-0">
            <h2 className="truncate text-xs font-bold uppercase tracking-[0.1em] text-slate-700">Angle retrieval</h2>
            <p className="truncate text-[10px] text-slate-400">Stored angle macro</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="inspector-close"><X size={15} /></button>
      </header>
      <div className="inspector-scroll flex-1 space-y-3 overflow-y-auto p-3">
        <section className="property-card space-y-2">
          <span className="property-section-title">Macro</span>
          <label className="property-field-label">
            Macro name
            <input aria-label="Angle retrieval macro" className="property-input font-mono" value={macro} onChange={event => setMacro(event.target.value)} />
          </label>
          <p className="text-[10px] text-slate-500">{'Edits only this standalone \\tkzGetAngle command. Use letters only, without a leading backslash.'}</p>
          {!valid && <p className="text-[10px] font-semibold text-amber-600">Macro names must contain only Latin letters.</p>}
          <button type="button" aria-label="Apply angle retrieval macro" disabled={!valid || cleanMacro === node.macro} onClick={apply} className="h-8 w-full rounded-lg bg-indigo-600 text-xs font-semibold text-white disabled:opacity-40">
            <Check size={12} className="inline-block" /> Apply macro
          </button>
        </section>
        <section className="property-card">
          <span className="property-section-title">Current command</span>
          <code className="mt-2 block rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-700">{`\\tkzGetAngle{${node.macro}}`}</code>
        </section>
      </div>
    </div>
  );
}

export function ConstructionInspector({ node, source, pointNames = [], setSource, onClose }: { node: AstNode; source: string; pointNames?: string[]; setSource: (source: string) => void; onClose: () => void }) {
  const config = useMemo(() => getConstructionAppearanceConfig(node), [node]);
  const commandIndex = useMemo(() => buildTikzCommandIndex(source), [source]);
  const constructionOptions = config.construction ? readTikzCommandOptions(commandIndex, config.construction) : null;
  const [definitionOptions, setDefinitionOptions] = useState(constructionOptions ?? '');
  useEffect(() => setDefinitionOptions(constructionOptions ?? ''), [constructionOptions]);
  const references = useMemo(() => constructionReferenceNames(node), [node]);
  const [referenceValues, setReferenceValues] = useState<Record<string, string>>(() => Object.fromEntries(references.map(name => [name, name])));
  useEffect(() => setReferenceValues(Object.fromEntries(references.map(name => [name, name]))), [references.join('|')]);
  const details = Object.entries(node as unknown as Record<string, unknown>).filter(([key]) => !['type', 'options'].includes(key)).slice(0, 8);
  const apply = (target: TikzCommandTarget, options: string) => setSource(updateTikzCommandOptions(source, target, options));
  const generatedNames = new Set(outputNames(node as any));
  const referenceChoices = Array.from(new Set([...pointNames, ...references])).filter(name => !generatedNames.has(name) || references.includes(name));
  const applyReferences = () => {
    if (!config.locator) return;
    setSource(updateTikzBlockReferences(source, [config.locator, ...config.appearance.map(item => item.target)], referenceValues));
  };
  const renderOptionEditor = (item: AppearanceTarget) => <OptionEditor key={`${item.kind}-${item.label}`} {...item} source={source} commandIndex={commandIndex} onApply={apply} />;

  if (isLabelNode(node)) {
    return <LabelCommandInspector node={node} source={source} pointNames={referenceChoices} setSource={setSource} onClose={onClose} />;
  }

  if (node.type === 'AngleRetrieval') {
    return <AngleRetrievalInspector node={node} source={source} setSource={setSource} onClose={onClose} />;
  }

  if (node.type === 'SegmentMark' || node.type === 'SegmentsMark' || node.type === 'ArcMark') {
    const title = node.type === 'SegmentMark' ? 'Segment mark' : node.type === 'SegmentsMark' ? 'Segment marks' : 'Arc mark';
    return <div className="h-[30rem] border-t border-slate-200 bg-white flex flex-col shrink-0"><header className="h-12 flex items-center justify-between gap-2 px-3 border-b border-slate-200 bg-slate-50/80 shrink-0"><div className="flex items-center gap-2"><Settings2 size={14} className="text-amber-500" /><div><h2 className="text-xs font-bold uppercase tracking-[0.1em] text-slate-700">{title}</h2><p className="text-[10px] text-slate-400">Marking appearance</p></div></div><button type="button" onClick={onClose} className="inspector-close"><X size={15} /></button></header><div className="inspector-scroll flex-1 overflow-y-auto p-3"><MarkOptionsEditor node={node} source={source} setSource={setSource} /></div></div>;
  }

  if (Boolean(node.type === 'Arc')) {
    return <div className="h-[30rem] border-t border-slate-200 bg-white flex flex-col shrink-0"><header className="h-12 flex items-center justify-between gap-2 px-3 border-b border-slate-200 bg-slate-50/80 shrink-0"><div className="flex items-center gap-2"><Settings2 size={14} className="text-indigo-500" /><div><h2 className="text-xs font-bold uppercase tracking-[0.1em] text-slate-700">Arc</h2><p className="text-[10px] text-slate-400">Geometry, annotations & appearance</p></div></div><button type="button" onClick={onClose} className="inspector-close"><X size={15} /></button></header><div className="inspector-scroll flex-1 space-y-3 overflow-y-auto p-3"><section className="property-card"><span className="property-section-title">Construction</span><div className="mt-2 grid grid-cols-2 gap-2">{details.map(([key, value]) => <div key={key}><span className="property-label block">{key}</span><span className="font-mono text-xs font-semibold">{displayValue(value)}</span></div>)}</div></section><ArcOptionsEditor node={node} source={source} pointNames={referenceChoices} setSource={setSource} /><ArcMarkProperty node={node} source={source} setSource={setSource} /><ArcLabelProperty node={node} source={source} setSource={setSource} />{config.appearance.map(renderOptionEditor)}</div></div>;
  }

  if (node.type === 'Segment' || node.type === 'Segments' || node.type === 'Line') {
    return <div className="h-[30rem] border-t border-slate-200 bg-white flex flex-col shrink-0"><header className="h-12 flex items-center justify-between gap-2 px-3 border-b border-slate-200 bg-slate-50/80 shrink-0"><div className="flex items-center gap-2"><Settings2 size={14} className="text-indigo-500" /><div><h2 className="text-xs font-bold uppercase tracking-[0.1em] text-slate-700">{config.title}</h2><p className="text-[10px] text-slate-400">Geometry, label & appearance</p></div></div><button type="button" onClick={onClose} className="inspector-close"><X size={15} /></button></header><div className="inspector-scroll flex-1 space-y-3 overflow-y-auto p-3"><section className="property-card"><span className="property-section-title">Construction</span><div className="mt-2 grid grid-cols-2 gap-2">{details.map(([key, value]) => <div key={key}><span className="property-label block">{key}</span><span className="font-mono text-xs font-semibold">{displayValue(value)}</span></div>)}</div></section>{config.locator && references.length > 0 && <section className="property-card space-y-2"><span className="property-section-title">References</span><div className="grid grid-cols-2 gap-2">{references.map(reference => <label className="property-field-label" key={reference}>Reference {reference}<select aria-label={`Reference ${reference}`} className="property-input" value={referenceValues[reference] ?? reference} onChange={event => setReferenceValues(current => ({ ...current, [reference]: event.target.value }))}>{referenceChoices.map(choice => <option key={choice}>{choice}</option>)}</select></label>)}</div><button type="button" aria-label="Apply construction references" onClick={applyReferences} className="h-8 w-full rounded-lg bg-indigo-600 text-xs font-semibold text-white">Apply references</button></section>}<PathLabelProperty node={node} source={source} setSource={setSource} />{config.appearance.map(renderOptionEditor)}</div></div>;
  }

  if (node.type === 'AngleMark' || node.type === 'AnglesMark' || node.type === 'Circle') {
    return <div className="h-[30rem] border-t border-slate-200 bg-white flex flex-col shrink-0"><header className="h-12 flex items-center justify-between px-3 border-b border-slate-200 bg-slate-50/80"><div className="flex items-center gap-2"><Settings2 size={14} className="text-indigo-500" /><div><h2 className="text-xs font-bold uppercase tracking-[0.1em] text-slate-700">{config.title}</h2><p className="text-[10px] text-slate-400">Label & appearance</p></div></div><button type="button" onClick={onClose} className="inspector-close"><X size={15} /></button></header><div className="inspector-scroll flex-1 space-y-3 overflow-y-auto p-3">{config.locator && references.length > 0 && <section className="property-card space-y-2"><span className="property-section-title">References</span><div className="grid grid-cols-2 gap-2">{references.map(reference => <label className="property-field-label" key={reference}>Reference {reference}<select aria-label={`Reference ${reference}`} className="property-input" value={referenceValues[reference] ?? reference} onChange={event => setReferenceValues(current => ({ ...current, [reference]: event.target.value }))}>{referenceChoices.map(choice => <option key={choice}>{choice}</option>)}</select></label>)}</div><button type="button" aria-label="Apply construction references" onClick={applyReferences} className="h-8 w-full rounded-lg bg-indigo-600 text-xs font-semibold text-white">Apply references</button></section>}{node.type === 'Circle' ? <CircleLabelProperty node={node} source={source} setSource={setSource} /> : <AngleLabelProperty node={node} source={source} setSource={setSource} />}{config.appearance.map(renderOptionEditor)}</div></div>;
  }

  if (node.type === 'SectorClip') {
    return <div className="h-[30rem] border-t border-slate-200 bg-white flex flex-col shrink-0"><header className="h-12 flex items-center justify-between gap-2 px-3 border-b border-slate-200 bg-slate-50/80 shrink-0"><div className="flex items-center gap-2"><Settings2 size={14} className="text-indigo-500" /><div><h2 className="text-xs font-bold uppercase tracking-[0.1em] text-slate-700">Sector clip</h2><p className="text-[10px] text-slate-400">Clipping geometry</p></div></div><button type="button" onClick={onClose} className="inspector-close"><X size={15} /></button></header><div className="inspector-scroll flex-1 overflow-y-auto p-3"><SectorClipOptionsEditor node={node} source={source} pointNames={referenceChoices} setSource={setSource} /></div></div>;
  }

  if (node.type === 'FillCircle') {
    return <div className="h-[30rem] border-t border-slate-200 bg-white flex flex-col shrink-0"><header className="h-12 flex items-center justify-between gap-2 px-3 border-b border-slate-200 bg-slate-50/80 shrink-0"><div className="flex min-w-0 items-center gap-2"><Settings2 size={14} className="shrink-0 text-indigo-500" /><div><h2 className="text-xs font-bold uppercase tracking-[0.1em] text-slate-700">Circle fill</h2><p className="text-[10px] text-slate-400">Geometry & appearance</p></div></div><button type="button" onClick={onClose} className="inspector-close"><X size={15} /></button></header><div className="inspector-scroll flex-1 space-y-3 overflow-y-auto p-3"><FillCircleGeometryEditor node={node} source={source} pointNames={referenceChoices} setSource={setSource} />{config.appearance.map(renderOptionEditor)}</div></div>;
  }

  if (node.type === 'Sector' || node.type === 'FillSector') {
    return <div className="h-[30rem] border-t border-slate-200 bg-white flex flex-col shrink-0"><header className="h-12 flex items-center justify-between gap-2 px-3 border-b border-slate-200 bg-slate-50/80 shrink-0"><div className="flex min-w-0 items-center gap-2"><Settings2 size={14} className="shrink-0 text-indigo-500" /><div className="min-w-0"><h2 className="truncate text-xs font-bold uppercase tracking-[0.1em] text-slate-700">Sector</h2><p className="truncate text-[10px] text-slate-400">Geometry & appearance</p></div></div><button type="button" onClick={onClose} className="inspector-close"><X size={15} /></button></header><div className="inspector-scroll flex-1 space-y-3 overflow-y-auto p-3"><SectorOptionsEditor node={node} source={source} pointNames={referenceChoices} setSource={setSource} /><SectorClipProperty node={node} source={source} setSource={setSource} />{config.appearance.map(renderOptionEditor)}</div></div>;
  }

  return <div className="h-[30rem] border-t border-slate-200 bg-white flex flex-col shrink-0"><header className="h-12 flex items-center justify-between gap-2 px-3 border-b border-slate-200 bg-slate-50/80 shrink-0"><div className="flex min-w-0 items-center gap-2"><Settings2 size={14} className="shrink-0 text-indigo-500" /><div className="min-w-0"><h2 className="truncate text-xs font-bold uppercase tracking-[0.1em] text-slate-700">{config.title}</h2><p className="truncate text-[10px] text-slate-400">Construction & appearance</p></div></div><button type="button" onClick={onClose} className="inspector-close"><X size={15} /></button></header><div className="inspector-scroll flex-1 space-y-3 overflow-y-auto p-3"><section className="property-card"><span className="property-section-title">Construction</span><div className="mt-2 grid grid-cols-2 gap-2">{details.map(([key, value]) => <div key={key} className="min-w-0"><span className="property-label block">{key.replace(/([a-z])([A-Z])/g, '$1 $2')}</span><span className="block truncate font-mono text-xs font-semibold text-slate-700" title={displayValue(value)}>{displayValue(value)}</span></div>)}</div></section>{config.locator && references.length > 0 && referenceChoices.length > 0 && <section className="property-card space-y-2"><span className="property-section-title">References</span><p className="text-[10px] text-slate-500">Replacing a reference updates the complete construction block and keeps generated names intact.</p><div className="grid grid-cols-2 gap-2">{references.map(reference => <label className="property-field-label" key={reference}>Reference {reference}<select aria-label={`Reference ${reference}`} className="property-input bg-white" value={referenceValues[reference] ?? reference} onChange={event => setReferenceValues(current => ({ ...current, [reference]: event.target.value }))}>{referenceChoices.map(choice => <option key={choice} value={choice}>{choice}</option>)}</select></label>)}</div><button type="button" aria-label="Apply construction references" onClick={applyReferences} disabled={references.every(reference => (referenceValues[reference] ?? reference) === reference)} className="h-8 w-full rounded-lg bg-indigo-600 text-xs font-semibold text-white disabled:opacity-40">Apply references</button></section>}{config.construction && constructionOptions !== null && <section className="property-card space-y-2"><span className="property-section-title">Definition options</span><p className="text-[10px] text-amber-600">Changes the local options of the construction command. Keep the same number of generated results.</p><SafeParameterControls node={node} optionsText={definitionOptions} setOptionsText={setDefinitionOptions} /><div className="flex gap-2"><input aria-label="Construction options" className="property-input min-w-0 flex-1" value={definitionOptions} onChange={event => setDefinitionOptions(event.target.value)} /><button type="button" aria-label="Apply construction options" onClick={() => apply(config.construction!, definitionOptions)} className="rounded-lg bg-amber-600 px-3 text-white"><Check size={12} /></button></div></section>}{node.type === 'Arc' && <><ArcOptionsEditor node={node} source={source} pointNames={referenceChoices} setSource={setSource} /><ArcMarkProperty node={node} source={source} setSource={setSource} /></>}{node.type === 'Ellipse' && <EllipseGeometryEditor node={node} source={source} setSource={setSource} />}{config.appearance.map(renderOptionEditor)}{config.appearance.length === 0 && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">This command stores or tests a value and has no associated drawing command to style.</div>}</div></div>;
}
