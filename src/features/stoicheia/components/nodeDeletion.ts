import type { AstNode } from '../store';

const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const labelTextPattern = String.raw`(?:[^{}]|\{[^{}]*\})*`;

const generatedLabelNames = (node: AstNode): string[] => {
  switch (node.type) {
    case 'Point': return [node.name];
    case 'ProjectionLine':
    case 'TriangleAltitude': return [node.foot];
    case 'AllAltitudes': return [node.foot1, node.foot2, node.foot3, node.orthocenter];
    case 'IntersectionPoint':
    case 'MidPoint':
    case 'GoldenRatioPoint':
    case 'BarycentricPoint':
    case 'SimilitudeCenter':
    case 'HarmonicPoint':
    case 'MidArcPoint':
    case 'PointOnLine':
    case 'PointOnCircle':
    case 'TriangleCenter':
    case 'PointTransformation':
    case 'VectorPoint':
    case 'DefinedTriangle':
    case 'DuplicateSegment':
    case 'RandomPoint': return [node.name];
    case 'HarmonicPair':
    case 'EquiPoints': return [node.name1, node.name2];
    case 'PointsTransformation': return node.names;
    case 'AssociatedTriangle':
    case 'PolygonConstruction':
    case 'DefinedCircle':
    case 'ProjectedExcenters':
    case 'RadicalAxis':
    case 'CircleTransformation':
    case 'LineCircleIntersection':
    case 'CircleCircleIntersection': return node.results;
    default: return [];
  }
};

const removeGeneratedLabelPoints = (source: string, names: string[]) => names.reduce((updated, name) => {
  const pattern = new RegExp(`(^|\\n)\\s*\\\\tkzLabelPoint(?:\\[.*?\\])?\\s*\\(${escaped(name)}\\)\\s*\\{${labelTextPattern}\\}\\s*(?:\\n|$)`, 'g');
  return updated.replace(pattern, '$1');
}, source);

export const nodeDeletionRegex = (node: AstNode): RegExp | null => {
  if (node.type === 'Point') {
    return new RegExp(`\\\\tkzDefPoint\\([^)]+\\)\\{${node.name}\\}.*?\\n?|\\\\tkzDrawPoints\\([^)]*${node.name}[^)]*\\).*?\\n?|\\\\tkzLabelPoints\\[?[^\\]]*\\]?\\([^)]*${node.name}[^)]*\\).*?\\n?`, 'g');
  } else if (node.type === 'Segment') {
    return new RegExp(`\\\\tkzDrawSegment(?:\\[.*?\\])?\\s*\\(${node.p1},${node.p2}\\).*?\\n?`, 'g');
  } else if (node.type === 'Line') {
    return new RegExp(`\\\\tkzDrawLine(?:\\[.*?\\])?\\s*\\(${node.p1},${node.p2}\\).*?\\n?`, 'g');
  } else if (node.type === 'Lines' || node.type === 'Segments') {
    const command = node.type === 'Lines' ? 'tkzDrawLines' : 'tkzDrawSegments';
    const pairs = node.pairs.map(pair => pair.join(',')).join(' ');
    return new RegExp(`\\\\${command}(?:\\[.*?\\])?\\s*\\(${pairs}\\).*?\\n?`, 'g');
  } else if (node.type === 'PolySeg') {
    return new RegExp(`\\\\tkzDrawPolySeg(?:\\[.*?\\])?\\s*\\(${node.points.join(',')}\\).*?\\n?`, 'g');
  } else if (node.type === 'Circles' || node.type === 'SemiCircles') {
    const command = node.type === 'Circles' ? 'tkzDrawCircles' : 'tkzDrawSemiCircles';
    const pairs = node.pairs.map(pair => pair.join(',')).join(' ');
    return new RegExp(`\\\\${command}(?:\\[.*?\\])?\\s*\\(${pairs}\\).*?\\n?`, 'g');
  } else if (node.type === 'SemiCircle') {
    return new RegExp(`\\\\tkzDrawSemiCircle(?:\\[.*?\\])?\\s*\\(${node.center},${node.radius_point}\\).*?\\n?`, 'g');
  } else if (node.type === 'Circle') {
    return new RegExp(`\\\\tkzDrawCircle(?:\\[.*?\\])?\\s*\\(${node.center},${node.radius_point}\\).*?\\n?`, 'g');
  } else if (node.type === 'Arc') {
    return new RegExp(`\\\\tkzDrawArc(?:\\[.*?\\])?\\s*\\(${node.center},${node.first}\\)\\s*\\(${node.second.join(',')}\\).*?\\n?`, 'g');
  } else if (node.type === 'Sector') {
    return new RegExp(`\\\\tkzDrawSector(?:\\[.*?\\])?\\s*\\(${node.center},${node.first}\\)\\s*\\(${node.second.join(',')}\\).*?\\n?`, 'g');
  } else if (node.type === 'FillCircle') {
    return new RegExp(`\\\\tkzFillCircle(?:\\[.*?\\])?\\s*\\(${node.center},${node.radius}\\).*?\\n?`, 'g');
  } else if (node.type === 'FillPolygon') {
    return new RegExp(`\\\\tkzFillPolygon(?:\\[.*?\\])?\\s*\\(${node.points.join(',')}\\).*?\\n?`, 'g');
  } else if (node.type === 'FillSector') {
    return new RegExp(`\\\\tkzFillSector(?:\\[.*?\\])?\\s*\\(${node.center},${node.first}\\)\\s*\\(${node.second.join(',')}\\).*?\\n?`, 'g');
  } else if (node.type === 'FillAngle') {
    return new RegExp(`\\\\tkzFillAngle(?:\\[.*?\\])?\\s*\\(${node.p1},${node.vertex},${node.p2}\\).*?\\n?`, 'g');
  } else if (node.type === 'FillAngles') {
    return new RegExp(`\\\\tkzFillAngles(?:\\[.*?\\])?\\s*\\(${node.angles.map(angle => angle.join(',')).join(' ')}\\).*?\\n?`, 'g');
  } else if (node.type === 'CanvasInit') {
    return /\\tkzInit(?:\[.*?\])?.*?\n?/g;
  } else if (node.type === 'CanvasClip') {
    return /\\tkzClip(?!BB)(?:\[.*?\])?.*?\n?/g;
  } else if (node.type === 'ShowBoundingBox') {
    return /\\tkzShowBB(?:\[.*?\])?.*?\n?/g;
  } else if (node.type === 'StyleSetup') {
    return new RegExp(`\\\\${escaped(node.command)}[ \\t]*(?:\\[.*?\\])?[ \\t]*\\n?`, 'g');
  } else if (node.type === 'CustomStyle') {
    return new RegExp(`\\\\tkzSetUpStyle[ \\t]*(?:\\[.*?\\])?[ \\t]*\\{${escaped(node.name)}\\}[ \\t]*\\n?`, 'g');
  } else if (node.type === 'Compass') {
    return new RegExp(`\\\\tkzCompass(?:\\[.*?\\])?\\s*\\(${escaped(`${node.center},${node.through}`)}\\).*?\\n?`, 'g');
  } else if (node.type === 'Compasses') {
    return new RegExp(`\\\\tkzCompasss(?:\\[.*?\\])?\\s*\\(${escaped(node.pairs.map(pair => pair.join(',')).join(' '))}\\).*?\\n?`, 'g');
  } else if (node.type === 'ShowLine') {
    return new RegExp(`\\\\tkzShowLine(?:\\[.*?\\])?\\s*\\(${escaped(node.points.join(','))}\\).*?\\n?`, 'g');
  } else if (node.type === 'ShowTransformation') {
    return new RegExp(`\\\\tkzShowTransformation(?:\\[.*?\\])?\\s*\\(${escaped(node.source)}\\).*?\\n?`, 'g');
  } else if (node.type === 'Protractor') {
    return new RegExp(`\\\\tkzProtractor(?:\\[.*?\\])?\\s*\\(${escaped(`${node.origin},${node.direction}`)}\\).*?\\n?`, 'g');
  } else if (node.type === 'ClipBoundingBox') {
    return /\\tkzClipBB.*?\n?/g;
  } else if (node.type === 'PolygonClip') {
    return new RegExp(`\\\\tkzClipPolygon(?:\\[.*?\\])?\\s*\\(${node.points.join(',')}\\).*?\\n?`, 'g');
  } else if (node.type === 'CircleClip') {
    return new RegExp(`\\\\tkzClipCircle(?:\\[.*?\\])?\\s*\\(${node.center},${node.radius_point}\\).*?\\n?`, 'g');
  } else if (node.type === 'SectorClip') {
    return new RegExp(`\\\\tkzClipSector(?:\\[.*?\\])?\\s*\\(${node.center},${node.first}\\)\\s*\\(${node.second.join(',')}\\).*?\\n?`, 'g');
  } else if (node.type === 'SegmentMark') {
    return new RegExp(`\\\\tkzMarkSegment(?:\\[.*?\\])?\\s*\\(${node.p1},${node.p2}\\).*?\\n?`, 'g');
  } else if (node.type === 'SegmentsMark') {
    return new RegExp(`\\\\tkzMarkSegments(?:\\[.*?\\])?\\s*\\(${node.pairs.map(pair => pair.join(',')).join(' ')}\\).*?\\n?`, 'g');
  } else if (node.type === 'ArcMark') {
    return new RegExp(`\\\\tkzMarkArc(?:\\[.*?\\])?\\s*\\(${node.center},${node.start},${node.end}\\).*?\\n?`, 'g');
  } else if (node.type === 'Ellipse') {
    return new RegExp(`\\\\tkzDrawEllipse(?:\\[.*?\\])?\\s*\\(${node.center},${node.x_radius},${node.y_radius},${node.angle}\\).*?\\n?`, 'g');
  } else if (node.type === 'PerpendicularLine') {
    return new RegExp(`\\\\tkzDefLine\\[orthogonal=through\\s+${node.through}\\]\\s*\\(${node.p1},${node.p2}\\)\\s*\\\\tkzGetPoint\\{${node.helper}\\}\\s*\\\\tkzDrawLine(?:\\[.*?\\])?\\s*\\(${node.through},${node.helper}\\).*?\\n?`, 'g');
  } else if (node.type === 'ProjectionLine') {
    return new RegExp(`\\\\tkzDefPointBy\\[projection=onto\\s+${node.p1}--${node.p2}\\]\\s*\\(${node.from}\\)\\s*\\\\tkzGetPoint\\{${node.foot}\\}\\s*\\\\tkzDrawLine(?:\\[.*?\\])?\\s*\\(${node.from},${node.foot}\\)(?:\\s*\\\\tkzMarkRightAngle\\(${node.from},${node.foot},${node.p1}\\))?(?:\\s*\\\\tkzDrawPoints\\(${node.foot}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'PerpendicularBisector') {
    return new RegExp(`\\\\tkzDefLine\\[mediator\\]\\s*\\(${node.p1},${node.p2}\\)\\s*\\\\tkzGetPoints\\{${node.helper1}\\}\\{${node.helper2}\\}\\s*\\\\tkzDrawLine(?:\\[.*?\\])?\\s*\\(${node.helper1},${node.helper2}\\).*?\\n?`, 'g');
  } else if (node.type === 'AngleBisector') {
    return new RegExp(`\\\\tkzDefLine\\[bisector\\]\\s*\\(${node.p1},${node.vertex},${node.p2}\\)\\s*\\\\tkzGetPoint\\{${node.helper}\\}\\s*\\\\tkzDrawLine(?:\\[.*?\\])?\\s*\\(${node.vertex},${node.helper}\\).*?\\n?`, 'g');
  } else if (node.type === 'TriangleAltitude') {
    return new RegExp(`\\\\tkzDefLine\\[altitude\\]\\s*\\(${node.side1},${node.vertex},${node.side2}\\)\\s*\\\\tkzGetPoint\\{${node.foot}\\}\\s*\\\\tkzDrawSegment(?:\\[.*?\\])?\\s*\\(${node.vertex},${node.foot}\\)(?:\\s*\\\\tkzDrawPoints\\(${node.foot}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.foot}\\))?(?:\\s*\\\\tkzMarkRightAngle(?:\\[.*?\\])?\\(${node.vertex},${node.foot},${node.side1}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'AllAltitudes') {
    return new RegExp(`\\\\tkzDefSpcTriangle\\[ortho\\]\\s*\\(${node.p1},${node.p2},${node.p3}\\)\\s*\\{${node.foot1},${node.foot2},${node.foot3}\\}\\s*\\\\tkzDefTriangleCenter\\[ortho\\]\\s*\\(${node.p1},${node.p2},${node.p3}\\)\\s*\\\\tkzGetPoint\\{${node.orthocenter}\\}\\s*\\\\tkzDrawSegments(?:\\[.*?\\])?\\s*\\(${node.p1},${node.foot1}\\s+${node.p2},${node.foot2}\\s+${node.p3},${node.foot3}\\)(?:\\s*\\\\tkzDrawPoints\\(${node.foot1},${node.foot2},${node.foot3},${node.orthocenter}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.foot1},${node.foot2},${node.foot3},${node.orthocenter}\\))?(?:\\s*\\\\tkzMarkRightAngles(?:\\[.*?\\])?\\([^)]*\\))?.*?\\n?`, 'g');
  } else if (node.type === 'Polygon') {
    const pts = node.points.join(',');
    return new RegExp(`\\\\tkzDrawPolygon(?:\\[.*?\\])?\\s*\\(${pts}\\).*?\\n?`, 'g');
  } else if (node.type === 'AngleMark') {
    return new RegExp(`\\\\tkzMarkAngle(?:\\[.*?\\])?\\s*\\(${node.p1},${node.vertex},${node.p2}\\)(?:\\s*\\\\tkzLabelAngle(?:\\[.*?\\])?\\s*\\(${node.p1},${node.vertex},${node.p2}\\)\\{[^}]*\\})?.*?\\n?`, 'g');
  } else if (node.type === 'AnglesMark' || node.type === 'RightAnglesMark') {
    const command = node.type === 'AnglesMark' ? 'tkzMarkAngles' : 'tkzMarkRightAngles';
    return new RegExp(`\\\\${command}(?:\\[.*?\\])?\\s*\\(${node.angles.map(angle => angle.join(',')).join(' ')}\\).*?\\n?`, 'g');
  } else if (node.type === 'RightAngleMark') {
    return new RegExp(`\\\\tkzMarkRightAngle(?:\\[.*?\\])?\\s*\\(${node.p1},${node.vertex},${node.p2}\\).*?\\n?`, 'g');
  } else if (node.type === 'PicAngle' || node.type === 'PicRightAngle') {
    const command = node.type === 'PicAngle' ? 'tkzPicAngle' : 'tkzPicRightAngle';
    return new RegExp(`\\\\${command}(?:\\[.*?\\])?\\s*\\(${node.p1},${node.vertex},${node.p2}\\).*?\\n?`, 'g');
  } else if (node.type === 'LabelPoint') {
    return new RegExp(`\\\\tkzLabelPoint(?:\\[.*?\\])?\\s*\\(${escaped(node.point)}\\)\\s*\\{${labelTextPattern}\\}.*?\\n?`, 'g');
  } else if (node.type === 'LabelPoints') {
    return new RegExp(`\\\\tkzLabelPoints(?:\\[.*?\\])?\\s*\\(${escaped(node.points.join(','))}\\).*?\\n?`, 'g');
  } else if (node.type === 'AutoLabelPoints') {
    return new RegExp(`\\\\tkzAutoLabelPoints(?:\\[.*?\\])?\\s*\\(${escaped(node.points.join(','))}\\).*?\\n?`, 'g');
  } else if (node.type === 'LabelSegment') {
    return new RegExp(`\\\\tkzLabelSegment(?:\\[.*?\\])?\\s*\\(${escaped(`${node.p1},${node.p2}`)}\\)\\s*\\{${labelTextPattern}\\}.*?\\n?`, 'g');
  } else if (node.type === 'LabelSegments') {
    return new RegExp(`\\\\tkzLabelSegments(?:\\[.*?\\])?\\s*\\(${escaped(node.pairs.map(pair => pair.join(',')).join(' '))}\\)\\s*\\{${labelTextPattern}\\}.*?\\n?`, 'g');
  } else if (node.type === 'LabelLine') {
    return new RegExp(`\\\\tkzLabelLine(?:\\[.*?\\])?\\s*\\(${escaped(`${node.p1},${node.p2}`)}\\)\\s*\\{${labelTextPattern}\\}.*?\\n?`, 'g');
  } else if (node.type === 'LabelAngle') {
    return new RegExp(`\\\\tkzLabelAngle(?:\\[.*?\\])?\\s*\\(${escaped(`${node.p1},${node.vertex},${node.p2}`)}\\)\\s*\\{${labelTextPattern}\\}.*?\\n?`, 'g');
  } else if (node.type === 'LabelAngles') {
    return new RegExp(`\\\\tkzLabelAngles(?:\\[.*?\\])?\\s*\\(${escaped(node.angles.map(angle => angle.join(',')).join(' '))}\\)\\s*\\{${labelTextPattern}\\}.*?\\n?`, 'g');
  } else if (node.type === 'LabelCircle') {
    return new RegExp(`\\\\tkzLabelCircle(?:\\[.*?\\])?\\s*\\(${escaped(`${node.center},${node.radius_point}`)}\\)\\s*\\(${escaped(node.angle)}\\)\\s*\\{${labelTextPattern}\\}.*?\\n?`, 'g');
  } else if (node.type === 'LabelArc') {
    return new RegExp(`\\\\tkzLabelArc(?:\\[.*?\\])?\\s*\\(${escaped(`${node.center},${node.start},${node.end}`)}\\)\\s*\\{${labelTextPattern}\\}.*?\\n?`, 'g');
  } else if (node.type === 'IntersectionPoint') {
    return new RegExp(`\\\\tkzInterLL\\(${node.p1},${node.p2}\\)\\(${node.p3},${node.p4}\\)\\s*\\\\tkzGetPoint\\{${node.name}\\}(?:\\s*\\\\tkzDrawPoints\\(${node.name}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.name}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'MidPoint') {
    return new RegExp(`\\\\tkzDefMidPoint\\(${node.p1},${node.p2}\\)\\s*\\\\tkzGetPoint\\{${node.name}\\}(?:\\s*\\\\tkzDrawPoints\\(${node.name}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.name}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'GoldenRatioPoint') {
    return new RegExp(`\\\\tkzDefGoldenRatio\\(${node.p1},${node.p2}\\)\\s*\\\\tkzGetPoint\\{${node.name}\\}(?:\\s*\\\\tkzDrawPoints\\(${node.name}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.name}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'BarycentricPoint') {
    const specification = node.points.map((point, index) => `${point}\\s*=\\s*${node.weights[index]}`).join('\\s*,\\s*');
    return new RegExp(`\\\\tkzDefBarycentricPoint\\(${specification}\\)\\s*\\\\tkzGetPoint\\{${node.name}\\}(?:\\s*\\\\tkzDrawPoints\\(${node.name}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.name}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'SimilitudeCenter') {
    return new RegExp(`\\\\tkzDefSimilitudeCenter\\[${node.kind}\\]\\(${node.center1},${node.radius1}\\)\\(${node.center2},${node.radius2}\\)\\s*\\\\tkzGetPoint\\{${node.name}\\}(?:\\s*\\\\tkzDrawPoints\\(${node.name}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.name}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'HarmonicPoint') {
    return new RegExp(`\\\\tkzDefHarmonic\\[${node.mode}\\]\\(${node.p1},${node.p2},${node.known}\\)\\s*\\\\tkzGetPoint\\{${node.name}\\}(?:\\s*\\\\tkzDrawPoints\\(${node.name}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.name}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'HarmonicPair') {
    return new RegExp(`\\\\tkzDefHarmonic\\[both\\]\\(${node.p1},${node.p2},${node.ratio}\\)\\s*\\\\tkzGetPoints\\{${node.name1}\\}\\{${node.name2}\\}(?:\\s*\\\\tkzDrawPoints\\(${node.name1},${node.name2}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.name1},${node.name2}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'EquiPoints') {
    return new RegExp(`\\\\tkzDefEquiPoints\\[from=${node.from},dist=${node.distance}${node.show ? ',show' : ''}\\]\\(${node.p1},${node.p2}\\)\\s*\\\\tkzGetPoints\\{${node.name1}\\}\\{${node.name2}\\}(?:\\s*\\\\tkzDrawPoints\\(${node.name1},${node.name2}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.name1},${node.name2}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'MidArcPoint') {
    return new RegExp(`\\\\tkzDefMidArc\\(${node.center},${node.start},${node.end}\\)\\s*\\\\tkzGetPoint\\{${node.name}\\}(?:\\s*\\\\tkzDrawPoints\\(${node.name}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.name}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'PointOnLine') {
    return new RegExp(`\\\\tkzDefPointOnLine\\[pos=${node.position}\\]\\(${node.p1},${node.p2}\\)\\s*\\\\tkzGetPoint\\{${node.name}\\}(?:\\s*\\\\tkzDrawPoints\\(${node.name}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.name}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'PointOnCircle') {
    const definition = node.mode === 'through' ? `through=center ${node.center} angle ${node.angle} point ${node.through}` : `R=center ${node.center} angle ${node.angle} radius ${node.radius}`;
    return new RegExp(`\\\\tkzDefPointOnCircle\\[${definition}\\]\\s*\\\\tkzGetPoint\\{${node.name}\\}(?:\\s*\\\\tkzDrawPoints\\(${node.name}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.name}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'TriangleCenter') {
    return new RegExp(`\\\\tkzDefTriangleCenter\\[${node.option}\\]\\(${node.p1},${node.p2},${node.p3}\\)\\s*\\\\tkzGetPoint\\{${node.name}\\}(?:\\s*\\\\tkzDrawPoints\\(${node.name}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.name}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'PointTransformation') {
    return new RegExp(`\\\\tkzDefPointBy\\[[^\\]]+\\]\\(${node.source}\\)\\s*\\\\tkzGetPoint\\{${node.name}\\}(?:\\s*\\\\tkzDrawPoints\\(${node.name}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.name}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'PointsTransformation') {
    const names = node.names.join(',');
    return new RegExp(`\\\\tkzDefPointsBy\\[[^\\]]+\\]\\(${node.sources.join(',')}\\)\\{${names}\\}(?:\\s*\\\\tkzDrawPoints\\(${names}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${names}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'VectorPoint') {
    return new RegExp(`\\\\tkzDefPointWith\\[[^\\]]+\\]\\(${node.p1},${node.p2}\\)\\s*\\\\tkzGetPoint\\{${node.name}\\}(?:\\s*\\\\tkzDrawPoints\\(${node.name}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.name}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'VectorCoordinates') {
    return new RegExp(`\\\\tkzGetVectxy\\(${node.p1},${node.p2}\\)\\{${node.macro}\\}.*?\\n?`, 'g');
  } else if (node.type === 'PointCoordinates') {
    return new RegExp(`\\\\tkzGetPointCoord\\(${escaped(node.point)}\\)\\{${escaped(node.macro)}\\}.*?\\n?`, 'g');
  } else if (node.type === 'SwapPoints') {
    return new RegExp(`\\\\tkzSwapPoints\\(${escaped(`${node.p1},${node.p2}`)}\\).*?\\n?`, 'g');
  } else if (node.type === 'DuplicateSegment') {
    return new RegExp(`\\\\tkzDuplicate(?:Segment|Length|Len)\\s*\\(${escaped(`${node.rayStart},${node.rayThrough}`)}\\)\\s*\\(${escaped(`${node.segmentStart},${node.segmentEnd}`)}\\)\\s*(?:\\{${escaped(node.name)}\\}|\\\\tkzGetPoint\\{${escaped(node.name)}\\})(?:\\s*\\\\tkzDrawSegment(?:\\[.*?\\])?\\s*\\(${escaped(`${node.rayStart},${node.name}`)}\\))?(?:\\s*\\\\tkzDrawPoints\\(${escaped(node.name)}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${escaped(node.name)}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'DefinedLine') {
    const getter = node.results.length === 2 ? `\\\\tkzGetPoints\\{${node.results[0]}\\}\\{${node.results[1]}\\}` : `\\\\tkzGetPoint\\{${node.results[0]}\\}`;
    return new RegExp(`\\\\tkzDefLine\\[[^\\]]+\\]\\(${node.points.join(',')}\\)\\s*${getter}(?:\\s*\\\\tkzDraw(?:Line|Segments)\\([^\\n]*\\))?.*?\\n?`, 'g');
  } else if (node.type === 'RadicalAxis') {
    return new RegExp(`\\\\tkzDefRadicalAxis\\s*\\(${escaped(node.circle1.join(','))}\\)\\s*\\(${escaped(node.circle2.join(','))}\\)\\s*\\\\tkzGetPoints\\{${escaped(node.results[0])}\\}\\{${escaped(node.results[1])}\\}(?:\\s*\\\\tkzDrawLine(?:\\[.*?\\])?\\(${escaped(node.results.join(','))}\\))?(?:\\s*\\\\tkzDrawPoints\\(${escaped(node.results.join(','))}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${escaped(node.results.join(','))}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'DefinedTriangle') {
    return new RegExp(`\\\\tkzDefTriangle\\[[^\\]]+\\]\\(${node.p1},${node.p2}\\)\\s*\\\\tkzGetPoint\\{${node.name}\\}(?:\\s*\\\\tkzDrawPolygon\\(${node.p1},${node.p2},${node.name}\\))?(?:\\s*\\\\tkzDrawPoints\\(${node.name}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.name}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'AssociatedTriangle') {
    const results = node.results.join(',');
    return new RegExp(`\\\\tkzDefSpcTriangle\\[[^\\]]+\\]\\(${node.p1},${node.p2},${node.p3}\\)\\{[^}]+\\}(?:\\s*\\\\tkzDrawPolygon\\(${results}\\))?(?:\\s*\\\\tkzDrawPoints\\(${results}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${results}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'PolygonConstruction') {
    const points = node.points.join(',');
    if (node.mode === 'permute') {
      return new RegExp(`\\\\tkzPermute\\(${points}\\)(?:\\s*\\\\tkzDrawPolygon\\(${points}\\))?(?:\\s*\\\\tkzDrawPoints\\(${points}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${points}\\))?.*?\\n?`, 'g');
    } else if (node.mode === 'regular_polygon') {
      const results = node.results.join(',');
      return new RegExp(`\\\\tkzDefRegPolygon(?:\\[[^\\]]*\\])?\\(${points}\\)(?:\\s*\\\\tkzDrawPolygon\\(${results}\\))?(?:\\s*\\\\tkzDrawPoints\\(${results}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${results}\\))?.*?\\n?`, 'g');
    } else {
      const macro = node.mode === 'square' ? 'tkzDefSquare' : node.mode === 'rectangle' ? 'tkzDefRectangle' : node.mode === 'golden_rectangle' ? 'tkzDefGoldenRectangle' : 'tkzDefParallelogram';
      const getter = node.results.length === 2 ? `\\\\tkzGetPoints\\{${node.results[0]}\\}\\{${node.results[1]}\\}` : `\\\\tkzGetPoint\\{${node.results[0]}\\}`;
      return new RegExp(`\\\\${macro}\\(${points}\\)\\s*${getter}(?:\\s*\\\\tkzDrawPolygon\\([^)]*\\))?(?:\\s*\\\\tkzDrawPoints\\(${node.results.join(',')}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.results.join(',')}\\))?.*?\\n?`, 'g');
    }
  } else if (node.type === 'DefinedCircle') {
    const getter = node.results.length === 1 ? `\\\\tkzGetPoint\\{${node.results[0]}\\}` : `\\\\tkzGetPoints\\{${node.results[0]}\\}\\{${node.results[1]}\\}`;
    return new RegExp(`\\\\tkzDefCircle\\[[^\\]]+\\]\\([^)]*\\)\\s*${getter}(?:\\s*\\\\tkzDrawCircle\\(${node.center},${node.radiusPoint}\\))?(?:\\s*\\\\tkzDrawPoints\\(${node.results.join(',')}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.results.join(',')}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'ProjectedExcenters') {
    return new RegExp(`\\\\tkzDefProjExcenter(?:\\[[^\\]]*\\])?\\(${node.p1},${node.p2},${node.p3}\\)\\([^)]*\\)\\{[^}]*\\}(?:\\s*\\\\tkzDrawSegments\\([^)]*\\))?(?:\\s*\\\\tkzDrawPoints\\(${node.results.join(',')}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.results.join(',')}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'CircleTransformation') {
    return new RegExp(`\\\\tkzDefCircleBy\\[[^\\]]+\\]\\(${node.center},${node.radiusPoint}\\)\\s*\\\\tkzGetPoints\\{${node.results[0]}\\}\\{${node.results[1]}\\}(?:\\s*\\\\tkzDrawCircle\\(${node.results[0]},${node.results[1]}\\))?(?:\\s*\\\\tkzDrawPoints\\(${node.results.join(',')}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.results.join(',')}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'LineCircleIntersection') {
    return new RegExp(`\\\\tkzInterLC(?:\\[[^\\]]*\\])?\\(${node.line.join(',')}\\)\\([^)]*\\)\\s*\\\\tkzGetPoints\\{${node.results[0]}\\}\\{${node.results[1]}\\}(?:\\s*\\\\tkzDrawPoints\\(${node.results.join(',')}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.results.join(',')}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'LineCircleTest') {
    return new RegExp(`\\\\tkzTestInterLC\\(${node.line.join(',')}\\)\\(${node.circle.join(',')}\\)(?:\\s*\\\\iftkzFlagLC[\\s\\S]*?\\\\fi)?\\s*`, 'g');
  } else if (node.type === 'CircleCircleIntersection') {
    return new RegExp(`\\\\tkzInterCC(?:\\[[^\\]]*\\])?\\([^)]*\\)\\([^)]*\\)\\s*\\\\tkzGetPoints\\{${node.results[0]}\\}\\{${node.results[1]}\\}(?:\\s*\\\\tkzDrawPoints\\(${node.results.join(',')}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.results.join(',')}\\))?.*?\\n?`, 'g');
  } else if (node.type === 'CircleCircleTest') {
    return new RegExp(`\\\\tkzTestInterCC\\(${node.circles[0].join(',')}\\)\\(${node.circles[1].join(',')}\\)(?:\\s*\\\\iftkzFlagCC[\\s\\S]*?\\\\fi)?\\s*`, 'g');
  } else if (node.type === 'LinearityTest') {
    return new RegExp(`\\\\tkzIsLinear\\(${escaped(node.points.join(','))}\\)(?:\\s*\\\\iftkzLinear[\\s\\S]*?\\\\fi)?\\s*`, 'g');
  } else if (node.type === 'OrthogonalityTest') {
    return new RegExp(`\\\\tkzIsOrtho\\(${escaped(node.points.join(','))}\\)(?:\\s*\\\\iftkzOrtho[\\s\\S]*?\\\\fi)?\\s*`, 'g');
  } else if (node.type === 'AngleCalculation') {
    const command = node.mode === 'angle' ? 'tkzFindAngle' : 'tkzFindSlopeAngle';
    return new RegExp(`\\\\${command}\\(${node.points.join(',')}\\)(?:\\s*\\\\tkzGetAngle\\{${node.macro ?? ''}\\})?\\s*`, 'g');
  } else if (node.type === 'AngleRetrieval') {
    return new RegExp(`\\\\tkzGetAngle\\{${node.macro}\\}\\s*`, 'g');
  } else if (node.type === 'LengthCalculation') {
    const getLength = node.macro ? `(?:\\s*\\\\tkzGetLength\\{${escaped(node.macro)}\\})?` : '';
    return new RegExp(`\\\\tkzCalcLength(?:\\[.*?\\])?\\s*\\(${escaped(`${node.p1},${node.p2}`)}\\)${getLength}\\s*`, 'g');
  } else if (node.type === 'UnitConversion') {
    const command = node.mode === 'pt_to_cm' ? 'tkzpttocm' : 'tkzcmtopt';
    return new RegExp(`\\\\${command}\\s*\\(${escaped(node.value)}\\)\\{${escaped(node.macro)}\\}\\s*`, 'g');
  } else if (node.type === 'DotProduct') {
    const getResult = node.macro ? `(?:\\s*\\\\tkzGetResult\\{${escaped(node.macro)}\\})?` : '';
    return new RegExp(`\\\\tkzDotProduct\\s*\\(${escaped(`${node.p1},${node.p2},${node.p3}`)}\\)${getResult}\\s*`, 'g');
  } else if (node.type === 'PowerCircle') {
    const getResult = node.macro ? `(?:\\s*\\\\tkzGetResult\\{${escaped(node.macro)}\\})?` : '';
    return new RegExp(`\\\\tkzPowerCircle\\s*\\(${escaped(node.point)}\\)\\s*\\(${escaped(`${node.center},${node.radiusPoint}`)}\\)${getResult}\\s*`, 'g');
  } else if (node.type === 'RandomPoint') {
    return new RegExp(`\\\\tkzDefRandPointOn\\[[^\\]]*\\]\\s*\\\\tkzGetPoint\\{${node.name}\\}(?:\\s*\\\\tkzDrawPoints\\(${node.name}\\))?(?:\\s*\\\\tkzLabelPoints(?:\\[.*?\\])?\\(${node.name}\\))?\\s*`, 'g');
  }

  return null;
};

export const deleteNodeFromSource = (source: string, node: AstNode): string => {
  const regex = nodeDeletionRegex(node);
  const withoutNode = regex ? source.replace(regex, '') : source;
  return removeGeneratedLabelPoints(withoutNode, generatedLabelNames(node));
};
