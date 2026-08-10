import { useMemo, useState, type MouseEvent } from 'react';
import { useEditorStore, AstNode } from '../store';
import { MousePointer2, Circle, CircleDashed, CircleDot, Triangle, Minus, Trash2, BetweenHorizontalStart, BetweenHorizontalEnd, MoveDown, BetweenVerticalEnd, GitFork, TriangleRight, Asterisk, Layers3, CornerUpRight, Crosshair, FlaskConical, Sparkles, Scale, LocateFixed, RefreshCw, CopyPlus, MoveUpRight, Braces, Ruler, Network, ScanLine, Square, Dice5, Compass, ChevronDown, ChevronRight, Tags, Palette } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { getNodeId } from './nodeIdentity';
import { deleteNodeFromSource } from './nodeDeletion';

type SceneGroupId = 'setup' | 'points' | 'lines' | 'circles' | 'polygons' | 'angles' | 'labels' | 'marks' | 'fills' | 'calculations' | 'other';

interface SceneGroupConfig {
  id: SceneGroupId;
  title: string;
  description: string;
}

const sceneGroupConfigs: SceneGroupConfig[] = [
  { id: 'setup', title: 'Canvas & setup', description: 'Bounds, clips and scene helpers' },
  { id: 'points', title: 'Points', description: 'Defined and constructed points' },
  { id: 'lines', title: 'Lines & segments', description: 'Segments, lines and line constructions' },
  { id: 'circles', title: 'Circles & arcs', description: 'Circles, arcs, sectors and ellipses' },
  { id: 'polygons', title: 'Polygons & triangles', description: 'Polygons, triangles and related constructions' },
  { id: 'angles', title: 'Angles', description: 'Angle marks and angle constructions' },
  { id: 'labels', title: 'Labels', description: 'Point, path, circle and arc labels' },
  { id: 'marks', title: 'Marks & helpers', description: 'Marks, compass traces and construction hints' },
  { id: 'fills', title: 'Fills & clips', description: 'Filled regions and clipping commands' },
  { id: 'calculations', title: 'Intersections & calculations', description: 'Tests, intersections and stored values' },
  { id: 'other', title: 'Other', description: 'Additional parsed commands' },
];

const sceneGroupOrder = sceneGroupConfigs.map(group => group.id);
const sceneGroupMeta = Object.fromEntries(sceneGroupConfigs.map(group => [group.id, group])) as Record<SceneGroupId, SceneGroupConfig>;

const groupForNodeType = (type: AstNode['type']): SceneGroupId => {
  switch (type) {
    case 'CanvasInit':
    case 'ShowBoundingBox':
    case 'StyleSetup':
    case 'CustomStyle':
      return 'setup';

    case 'Point':
    case 'IntersectionPoint':
    case 'MidPoint':
    case 'GoldenRatioPoint':
    case 'BarycentricPoint':
    case 'SimilitudeCenter':
    case 'HarmonicPoint':
    case 'HarmonicPair':
    case 'EquiPoints':
    case 'MidArcPoint':
    case 'PointOnLine':
    case 'PointOnCircle':
    case 'TriangleCenter':
    case 'PointTransformation':
    case 'PointsTransformation':
    case 'VectorPoint':
    case 'DuplicateSegment':
    case 'RandomPoint':
      return 'points';

    case 'Segment':
    case 'Segments':
    case 'PolySeg':
    case 'Line':
    case 'Lines':
    case 'DefinedLine':
    case 'PerpendicularLine':
    case 'ProjectionLine':
    case 'PerpendicularBisector':
    case 'AngleBisector':
      return 'lines';

    case 'Circle':
    case 'Circles':
    case 'SemiCircle':
    case 'SemiCircles':
    case 'Arc':
    case 'Sector':
    case 'Ellipse':
    case 'DefinedCircle':
    case 'CircleTransformation':
      return 'circles';

    case 'Polygon':
    case 'DefinedTriangle':
    case 'AssociatedTriangle':
    case 'PolygonConstruction':
    case 'ProjectedExcenters':
    case 'TriangleAltitude':
    case 'AllAltitudes':
      return 'polygons';

    case 'AngleMark':
    case 'AnglesMark':
    case 'RightAngleMark':
    case 'RightAnglesMark':
    case 'PicAngle':
    case 'PicRightAngle':
    case 'AngleCalculation':
    case 'AngleRetrieval':
      return 'angles';

    case 'LabelPoint':
    case 'LabelPoints':
    case 'AutoLabelPoints':
    case 'LabelSegment':
    case 'LabelSegments':
    case 'LabelLine':
    case 'LabelAngle':
    case 'LabelAngles':
    case 'LabelCircle':
    case 'LabelArc':
      return 'labels';

    case 'SegmentMark':
    case 'SegmentsMark':
    case 'ArcMark':
    case 'Compass':
    case 'Compasses':
    case 'ShowLine':
    case 'ShowTransformation':
    case 'Protractor':
      return 'marks';

    case 'FillCircle':
    case 'FillPolygon':
    case 'FillSector':
    case 'FillAngle':
    case 'FillAngles':
    case 'CanvasClip':
    case 'ClipBoundingBox':
    case 'PolygonClip':
    case 'CircleClip':
    case 'SectorClip':
      return 'fills';

    case 'VectorCoordinates':
    case 'RadicalAxis':
    case 'LineCircleIntersection':
    case 'LineCircleTest':
    case 'CircleCircleIntersection':
    case 'CircleCircleTest':
    case 'LengthCalculation':
    case 'UnitConversion':
    case 'PointCoordinates':
    case 'SwapPoints':
    case 'DotProduct':
    case 'PowerCircle':
    case 'LinearityTest':
    case 'OrthogonalityTest':
      return 'calculations';

    default:
      return 'other';
  }
};

const getGroupIcon = (group: SceneGroupId) => {
  switch (group) {
    case 'setup': return <Ruler className="h-3.5 w-3.5 text-cyan-600" />;
    case 'points': return <MousePointer2 className="h-3.5 w-3.5 text-blue-600" />;
    case 'lines': return <Minus className="h-3.5 w-3.5 text-green-600" />;
    case 'circles': return <Circle className="h-3.5 w-3.5 text-red-500" />;
    case 'polygons': return <Triangle className="h-3.5 w-3.5 text-purple-600" />;
    case 'angles': return <CornerUpRight className="h-3.5 w-3.5 text-amber-600" />;
    case 'labels': return <Tags className="h-3.5 w-3.5 text-slate-600" />;
    case 'marks': return <Asterisk className="h-3.5 w-3.5 text-orange-600" />;
    case 'fills': return <Sparkles className="h-3.5 w-3.5 text-indigo-600" />;
    case 'calculations': return <FlaskConical className="h-3.5 w-3.5 text-teal-600" />;
    default: return <Layers3 className="h-3.5 w-3.5 text-slate-600" />;
  }
};

export function ObjectTree() {
  const [collapsedGroups, setCollapsedGroups] = useState<Partial<Record<SceneGroupId, boolean>>>({});
  const { parsedNodes, setHoveredNode, hoveredNode, setSource, selectedNode, setSelectedNode } = useEditorStore(useShallow(state => ({
    parsedNodes: state.parsedNodes,
    setHoveredNode: state.setHoveredNode,
    hoveredNode: state.hoveredNode,
    setSource: state.setSource,
    selectedNode: state.selectedNode,
    setSelectedNode: state.setSelectedNode,
  })));

  const handleDelete = (node: AstNode, e: MouseEvent) => {
    e.stopPropagation();

    const source = useEditorStore.getState().source;
    const newSource = deleteNodeFromSource(source, node);
    if (newSource === source) {
      return;
    }

    setSource(newSource);
    if (selectedNode === getNodeId(node)) {
      setSelectedNode(null);
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'Point': return <MousePointer2 className="w-4 h-4 text-blue-500" />;
      case 'Segment': return <Minus className="w-4 h-4 text-green-500" />;
      case 'Line': return <Ruler className="w-4 h-4 text-blue-500" />;
      case 'Lines': return <Ruler className="w-4 h-4 text-blue-600" />;
      case 'Segments': return <Layers3 className="w-4 h-4 text-green-600" />;
      case 'PolySeg': return <MoveUpRight className="w-4 h-4 text-emerald-600" />;
      case 'Circles': return <CircleDot className="w-4 h-4 text-red-600" />;
      case 'SemiCircle': case 'SemiCircles': return <CircleDashed className="w-4 h-4 text-orange-600" />;
      case 'Circle': return <Circle className="w-4 h-4 text-red-500" />;
      case 'Arc': return <CircleDashed className="w-4 h-4 text-orange-500" />;
      case 'Sector': return <CircleDot className="w-4 h-4 text-amber-500" />;
      case 'FillCircle': return <CircleDot className="w-4 h-4 text-blue-500" />;
      case 'FillPolygon': return <Sparkles className="w-4 h-4 text-blue-500" />;
      case 'FillSector': return <Sparkles className="w-4 h-4 text-cyan-500" />;
      case 'FillAngle': return <Sparkles className="w-4 h-4 text-violet-500" />;
      case 'FillAngles': return <Layers3 className="w-4 h-4 text-violet-500" />;
      case 'CanvasInit': return <Ruler className="w-4 h-4 text-cyan-600" />;
      case 'CanvasClip': return <ScanLine className="w-4 h-4 text-orange-600" />;
      case 'ShowBoundingBox': return <Square className="w-4 h-4 text-indigo-600" />;
      case 'StyleSetup': return <Palette className="w-4 h-4 text-indigo-600" />;
      case 'CustomStyle': return <Palette className="w-4 h-4 text-amber-600" />;
      case 'Compass': return <Compass className="w-4 h-4 text-cyan-600" />;
      case 'Compasses': return <Network className="w-4 h-4 text-cyan-600" />;
      case 'ShowLine': return <Ruler className="w-4 h-4 text-cyan-700" />;
      case 'ShowTransformation': return <RefreshCw className="w-4 h-4 text-violet-600" />;
      case 'Protractor': return <Ruler className="w-4 h-4 text-amber-600" />;
      case 'ClipBoundingBox': return <Crosshair className="w-4 h-4 text-rose-600" />;
      case 'PolygonClip': return <ScanLine className="w-4 h-4 text-purple-600" />;
      case 'CircleClip': return <CircleDashed className="w-4 h-4 text-cyan-600" />;
      case 'SectorClip': return <ScanLine className="w-4 h-4 text-amber-600" />;
      case 'SegmentMark': return <Asterisk className="w-4 h-4 text-amber-600" />;
      case 'SegmentsMark': return <Layers3 className="w-4 h-4 text-amber-600" />;
      case 'ArcMark': return <CircleDashed className="w-4 h-4 text-amber-600" />;
      case 'Ellipse': return <CircleDashed className="w-4 h-4 text-violet-500" />;
      case 'PerpendicularLine': return <BetweenHorizontalStart className="w-4 h-4 text-cyan-600" />;
      case 'ProjectionLine': return <MoveDown className="w-4 h-4 text-sky-600" />;
      case 'PerpendicularBisector': return <BetweenVerticalEnd className="w-4 h-4 text-indigo-600" />;
      case 'AngleBisector': return <GitFork className="w-4 h-4 text-amber-600" />;
      case 'TriangleAltitude': return <TriangleRight className="w-4 h-4 text-emerald-600" />;
      case 'AllAltitudes': return <Asterisk className="w-4 h-4 text-rose-600" />;
      case 'AngleMark': return <CornerUpRight className="w-4 h-4 text-orange-600" />;
      case 'AnglesMark': return <Layers3 className="w-4 h-4 text-orange-600" />;
      case 'RightAngleMark': return <Asterisk className="w-4 h-4 text-cyan-600" />;
      case 'RightAnglesMark': return <Layers3 className="w-4 h-4 text-cyan-600" />;
      case 'PicAngle': return <Compass className="w-4 h-4 text-violet-600" />;
      case 'PicRightAngle': return <Square className="w-4 h-4 text-violet-600" />;
      case 'LabelPoint': return <Braces className="w-4 h-4 text-slate-600" />;
      case 'LabelPoints': return <CopyPlus className="w-4 h-4 text-slate-600" />;
      case 'AutoLabelPoints': return <LocateFixed className="w-4 h-4 text-slate-600" />;
      case 'LabelSegment': return <Minus className="w-4 h-4 text-slate-600" />;
      case 'LabelSegments': return <Layers3 className="w-4 h-4 text-slate-600" />;
      case 'LabelLine': return <Ruler className="w-4 h-4 text-slate-600" />;
      case 'LabelAngle': return <CornerUpRight className="w-4 h-4 text-slate-600" />;
      case 'LabelAngles': return <Layers3 className="w-4 h-4 text-slate-600" />;
      case 'LabelCircle': return <CircleDot className="w-4 h-4 text-slate-600" />;
      case 'LabelArc': return <CircleDashed className="w-4 h-4 text-slate-600" />;
      case 'IntersectionPoint': return <Crosshair className="w-4 h-4 text-violet-600" />;
      case 'MidPoint': return <BetweenHorizontalEnd className="w-4 h-4 text-cyan-600" />;
      case 'GoldenRatioPoint': return <Sparkles className="w-4 h-4 text-amber-500" />;
      case 'BarycentricPoint': return <Scale className="w-4 h-4 text-purple-600" />;
      case 'SimilitudeCenter': return <Crosshair className="w-4 h-4 text-teal-600" />;
      case 'HarmonicPoint': case 'HarmonicPair': return <GitFork className="w-4 h-4 text-pink-600" />;
      case 'EquiPoints': return <BetweenHorizontalEnd className="w-4 h-4 text-sky-600" />;
      case 'MidArcPoint': return <CircleDashed className="w-4 h-4 text-orange-600" />;
      case 'PointOnLine': return <Minus className="w-4 h-4 text-green-600" />;
      case 'PointOnCircle': return <Circle className="w-4 h-4 text-indigo-600" />;
      case 'TriangleCenter': return <LocateFixed className="w-4 h-4 text-rose-600" />;
      case 'PointTransformation': return <RefreshCw className="w-4 h-4 text-violet-600" />;
      case 'PointsTransformation': return <CopyPlus className="w-4 h-4 text-fuchsia-600" />;
      case 'VectorPoint': return <MoveUpRight className="w-4 h-4 text-sky-600" />;
      case 'DuplicateSegment': return <CopyPlus className="w-4 h-4 text-sky-600" />;
      case 'VectorCoordinates': return <Braces className="w-4 h-4 text-emerald-600" />;
      case 'DefinedLine': return <Ruler className="w-4 h-4 text-blue-600" />;
      case 'RadicalAxis': return <CircleDot className="w-4 h-4 text-purple-700" />;
      case 'DefinedTriangle': return <Triangle className="w-4 h-4 text-rose-600" />;
      case 'AssociatedTriangle': return <Network className="w-4 h-4 text-purple-600" />;
      case 'PolygonConstruction': return <Square className="w-4 h-4 text-emerald-600" />;
      case 'DefinedCircle': return <CircleDot className="w-4 h-4 text-cyan-600" />;
      case 'ProjectedExcenters': return <ScanLine className="w-4 h-4 text-orange-600" />;
      case 'CircleTransformation': return <RefreshCw className="w-4 h-4 text-fuchsia-600" />;
      case 'LineCircleIntersection': return <Crosshair className="w-4 h-4 text-blue-600" />;
      case 'LineCircleTest': return <FlaskConical className="w-4 h-4 text-slate-600" />;
      case 'CircleCircleIntersection': return <CircleDot className="w-4 h-4 text-cyan-600" />;
      case 'CircleCircleTest': return <FlaskConical className="w-4 h-4 text-cyan-700" />;
      case 'AngleCalculation': return <CornerUpRight className="w-4 h-4 text-amber-600" />;
      case 'AngleRetrieval': return <Braces className="w-4 h-4 text-amber-700" />;
      case 'LengthCalculation': return <Ruler className="w-4 h-4 text-teal-600" />;
      case 'UnitConversion': return <Braces className="w-4 h-4 text-teal-700" />;
      case 'PointCoordinates': return <Braces className="w-4 h-4 text-cyan-700" />;
      case 'SwapPoints': return <RefreshCw className="w-4 h-4 text-sky-700" />;
      case 'DotProduct': return <Scale className="w-4 h-4 text-indigo-700" />;
      case 'PowerCircle': return <CircleDot className="w-4 h-4 text-purple-700" />;
      case 'LinearityTest': return <FlaskConical className="w-4 h-4 text-emerald-700" />;
      case 'OrthogonalityTest': return <FlaskConical className="w-4 h-4 text-sky-700" />;
      case 'RandomPoint': return <Dice5 className="w-4 h-4 text-violet-600" />;
      case 'Polygon': return <Triangle className="w-4 h-4 text-purple-500" />;
      default: return null;
    }
  };

  const getNodeLabel = (node: AstNode) => {
    switch (node.type) {
      case 'Point': return `Point ${node.name}`;
      case 'Segment': return `Segment ${node.p1}-${node.p2}`;
      case 'Line': return `Line ${node.p1}-${node.p2}`;
      case 'Lines': return `Lines ${node.pairs.map(pair => pair.join('-')).join(', ')}`;
      case 'Segments': return `Segments ${node.pairs.map(pair => pair.join('-')).join(', ')}`;
      case 'PolySeg': return `Polygonal chain ${node.points.join('–')}`;
      case 'Circles': return `Circles ${node.pairs.map(pair => pair.join('-')).join(', ')}`;
      case 'SemiCircle': return `Semicircle ${node.center}-${node.radius_point}`;
      case 'SemiCircles': return `Semicircles ${node.pairs.map(pair => pair.join('-')).join(', ')}`;
      case 'Circle': return `Circle center ${node.center} to ${node.radius_point}`;
      case 'Arc': return `Arc ${node.mode.replace(/_/g, ' ')} · ${node.center}`;
      case 'Sector': return `Sector ${node.mode.replace(/_/g, ' ')} · ${node.center}`;
      case 'FillCircle': return `Circle fill ${node.center} · ${node.mode}`;
      case 'FillPolygon': return `Polygon fill ${node.points.join('–')}`;
      case 'FillSector': return `Sector fill ${node.mode.replace(/_/g, ' ')} · ${node.center}`;
      case 'FillAngle': return `Angle fill ${node.p1}-${node.vertex}-${node.p2}`;
      case 'FillAngles': return `Angle fills · ${node.angles.length}`;
      case 'CanvasInit': return `Canvas ${node.xmin}…${node.xmax} × ${node.ymin}…${node.ymax}`;
      case 'CanvasClip': return `Clip initialized bounds · space ${node.space}`;
      case 'ShowBoundingBox': return 'Show bounding box';
      case 'StyleSetup': return `${node.kind} style · \\${node.command}`;
      case 'CustomStyle': return `Custom style ${node.name}`;
      case 'Compass': return `Compass trace ${node.center}→${node.through}`;
      case 'Compasses': return `Compass traces ${node.pairs.map(pair => pair.join('→')).join(', ')}`;
      case 'ShowLine': return `Show ${node.mode} construction ${node.points.join('–')}${node.through ? ` through ${node.through}` : ''}`;
      case 'ShowTransformation': return `Show ${node.mode} construction of ${node.source}`;
      case 'Protractor': return `Protractor ${node.origin}→${node.direction}`;
      case 'ClipBoundingBox': return 'Clip to bounding box';
      case 'PolygonClip': return `Polygon clip · ${node.out ? 'outside' : 'inside'}`;
      case 'CircleClip': return `Circle clip · ${node.out ? 'outside' : 'inside'}`;
      case 'SectorClip': return `Sector clip · ${node.mode}`;
      case 'SegmentMark': return `Mark ${node.p1}-${node.p2}`;
      case 'SegmentsMark': return `Mark segments ${node.pairs.map(pair => pair.join('-')).join(', ')}`;
      case 'ArcMark': return `Mark arc ${node.center}-${node.start}-${node.end}`;
      case 'Ellipse': return `Ellipse ${node.center} · ${node.x_radius}×${node.y_radius} @ ${node.angle}°`;
      case 'PerpendicularLine': return `Perpendicular to ${node.p1}-${node.p2} through ${node.through}`;
      case 'ProjectionLine': return `Projection of ${node.from} on ${node.p1}-${node.p2}`;
      case 'PerpendicularBisector': return `Perpendicular bisector ${node.p1}-${node.p2}`;
      case 'AngleBisector': return `Bisector ${node.p1}-${node.vertex}-${node.p2}`;
      case 'TriangleAltitude': return `Altitude from ${node.vertex} to ${node.side1}-${node.side2}`;
      case 'AllAltitudes': return `Altitudes & orthocenter ${node.p1}-${node.p2}-${node.p3}`;
      case 'AngleMark': return `Angle ${node.p1}-${node.vertex}-${node.p2}`;
      case 'AnglesMark': return `Angles · ${node.angles.length}`;
      case 'RightAngleMark': return `Right angle ${node.p1}-${node.vertex}-${node.p2}`;
      case 'RightAnglesMark': return `Right angles · ${node.angles.length}`;
      case 'PicAngle': return `TikZ pic angle ${node.p1}-${node.vertex}-${node.p2}`;
      case 'PicRightAngle': return `TikZ pic right angle ${node.p1}-${node.vertex}-${node.p2}`;
      case 'LabelPoint': return `Point label ${node.point}: ${node.text}`;
      case 'LabelPoints': return `Point labels ${node.points.join(', ')}`;
      case 'AutoLabelPoints': return `Auto point labels ${node.points.join(', ')}`;
      case 'LabelSegment': return `Segment label ${node.p1}-${node.p2}: ${node.text}`;
      case 'LabelSegments': return `Segment labels · ${node.pairs.length}: ${node.text}`;
      case 'LabelLine': return `Line label ${node.p1}-${node.p2}: ${node.text}`;
      case 'LabelAngle': return `Angle label ${node.p1}-${node.vertex}-${node.p2}: ${node.text}`;
      case 'LabelAngles': return `Angle labels · ${node.angles.length}: ${node.text}`;
      case 'LabelCircle': return `Circle label ${node.center}-${node.radius_point}: ${node.text}`;
      case 'LabelArc': return `Arc label ${node.center}-${node.start}-${node.end}: ${node.text}`;
      case 'IntersectionPoint': return `Intersection ${node.name} of ${node.p1}${node.p2} & ${node.p3}${node.p4}`;
      case 'MidPoint': return `Midpoint ${node.name} of ${node.p1}-${node.p2}`;
      case 'GoldenRatioPoint': return `Golden ratio ${node.name} on ${node.p1}-${node.p2}`;
      case 'BarycentricPoint': return `Barycenter ${node.name} of ${node.points.join(', ')}`;
      case 'SimilitudeCenter': return `${node.kind === 'int' ? 'Internal' : 'External'} similitude center ${node.name}`;
      case 'HarmonicPoint': return `Harmonic conjugate ${node.name}`;
      case 'HarmonicPair': return `Harmonic pair ${node.name1}, ${node.name2}`;
      case 'EquiPoints': return `Equidistant points ${node.name1}, ${node.name2}`;
      case 'MidArcPoint': return `Arc midpoint ${node.name}`;
      case 'PointOnLine': return `Point ${node.name} on ${node.p1}-${node.p2}`;
      case 'PointOnCircle': return `Point ${node.name} on circle at ${node.center}`;
      case 'TriangleCenter': return `${node.option} center ${node.name} of ${node.p1}-${node.p2}-${node.p3}`;
      case 'PointTransformation': return `${node.mode.replace(/_/g, ' ')} image ${node.name} of ${node.source}`;
      case 'PointsTransformation': return `${node.mode.replace(/_/g, ' ')} images ${node.names.join(', ')} of ${node.sources.join(', ')}`;
      case 'VectorPoint': return `${node.mode.replace(/_/g, ' ')} vector point ${node.name}`;
      case 'DuplicateSegment': return `Duplicate ${node.segmentStart}-${node.segmentEnd} as ${node.rayStart}-${node.name}`;
      case 'VectorCoordinates': return `Vector ${node.p1}→${node.p2} components \\${node.macro}x, \\${node.macro}y`;
      case 'DefinedLine': return `${node.mode.replace(/_/g, ' ')} line through ${node.points.join(', ')}`;
      case 'RadicalAxis': return `Radical axis ${node.circle1.join('-')} and ${node.circle2.join('-')}`;
      case 'DefinedTriangle': return `${node.mode.replace(/_/g, ' ')} triangle ${node.p1}-${node.p2}-${node.name}`;
      case 'AssociatedTriangle': return `${node.mode} triangle ${node.results.join('-')} of ${node.p1}-${node.p2}-${node.p3}`;
      case 'PolygonConstruction': return node.mode === 'permute' ? `Permute ${node.points.join('-')}` : `${node.mode.replace(/_/g, ' ')} ${node.results.join('-')}`;
      case 'DefinedCircle': return `${node.mode.replace(/_/g, ' ')} circle ${node.center}-${node.radiusPoint}`;
      case 'ProjectedExcenters': return `Excenter projections ${node.results.join(', ')}`;
      case 'CircleTransformation': return `${node.mode} circle ${node.results.join('-')}`;
      case 'LineCircleIntersection': return `Line–circle intersection ${node.results.join(', ')}`;
      case 'LineCircleTest': return `Test ${node.line.join('-')} against circle ${node.circle.join('-')}`;
      case 'CircleCircleIntersection': return `Circle–circle intersection ${node.results.join(', ')}`;
      case 'CircleCircleTest': return `Test circles ${node.circles.map(circle => circle.join('-')).join(' and ')}`;
      case 'AngleCalculation': return `${node.mode === 'angle' ? 'Angle' : 'Slope'} ${node.points.join('–')}${node.macro ? ` → \\${node.macro}` : ''}`;
      case 'AngleRetrieval': return `Get angle → \\${node.macro}`;
      case 'LengthCalculation': return `Length ${node.p1}-${node.p2}${node.macro ? ` → \\${node.macro}` : ''}`;
      case 'UnitConversion': return `${node.mode === 'pt_to_cm' ? 'pt to cm' : 'cm to pt'} ${node.value} → \\${node.macro}`;
      case 'PointCoordinates': return `Coordinates ${node.point} → \\${node.macro}x, \\${node.macro}y`;
      case 'SwapPoints': return `Swap points ${node.p1} ↔ ${node.p2}`;
      case 'DotProduct': return `Dot product ${node.p1}${node.p2} · ${node.p1}${node.p3}${node.macro ? ` → \\${node.macro}` : ''}`;
      case 'PowerCircle': return `Power of ${node.point} wrt circle ${node.center}-${node.radiusPoint}${node.macro ? ` → \\${node.macro}` : ''}`;
      case 'LinearityTest': return `Test linearity ${node.points.join('-')}`;
      case 'OrthogonalityTest': return `Test orthogonality ${node.points.join('-')}`;
      case 'RandomPoint': return `Random point ${node.name} · ${node.mode.replace(/_/g, ' ')}`;
      case 'Polygon': return `Polygon ${node.points.join('-')}`;
      default: return 'Unknown';
    }
  };

  const groupedNodes = useMemo(() => {
    const groups = sceneGroupOrder.map(groupId => ({
      ...sceneGroupMeta[groupId],
      items: [] as Array<{ node: AstNode; index: number; id: string; label: string }>,
    }));
    const groupById = new Map(groups.map(group => [group.id, group]));

    parsedNodes.forEach((node, index) => {
      groupById.get(groupForNodeType(node.type))?.items.push({
        node,
        index,
        id: getNodeId(node),
        label: getNodeLabel(node),
      });
    });

    return groups.filter(group => group.items.length > 0);
  }, [parsedNodes]);

  const toggleGroup = (groupId: SceneGroupId) => {
    setCollapsedGroups(current => ({ ...current, [groupId]: !current[groupId] }));
  };

  return (
    <div className="scene-tree flex flex-col flex-1 min-h-0">
      <div className="scene-tree-header flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="scene-tree-title-icon"><Layers3 size={15} /></span>
          <h2 className="scene-tree-title">Scene</h2>
        </div>
        <span className="scene-count-badge">
          {parsedNodes.length}
        </span>
      </div>
      <div className="scene-scroll flex-1 overflow-y-auto">
        {parsedNodes.length === 0 ? (
          <div className="scene-empty h-full min-h-40 flex flex-col items-center justify-center p-6 text-center">
            <div className="scene-empty-icon mb-3">
              <Layers3 size={20} />
            </div>
            <p className="scene-empty-title">No objects yet</p>
            <p className="scene-empty-text mt-1">Choose a tool and start drawing.</p>
          </div>
        ) : (
          <div className="scene-groups">
            {groupedNodes.map(group => {
              const collapsed = Boolean(collapsedGroups[group.id]);
              const hasSelectedNode = group.items.some(item => item.id === selectedNode);

              return (
                <section
                  key={group.id}
                  data-group={group.id}
                  className={`scene-group-card ${hasSelectedNode ? 'scene-group-card-selected' : ''}`}
                >
                  <button
                    type="button"
                    className="scene-group-header"
                    aria-expanded={!collapsed}
                    onClick={() => toggleGroup(group.id)}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {collapsed ? <ChevronRight className="scene-chevron" /> : <ChevronDown className="scene-chevron" />}
                      <span className="scene-group-icon">
                        {getGroupIcon(group.id)}
                      </span>
                      <span className="min-w-0">
                        <span className="scene-group-title">{group.title}</span>
                        <span className="scene-group-description">{group.description}</span>
                      </span>
                    </div>
                    <span className="scene-group-count">
                      {group.items.length}
                    </span>
                  </button>

                  {!collapsed && (
                    <ul className="scene-group-list">
                      {group.items.map(({ node, id, label, index }) => {
                        const isHovered = hoveredNode === id;

                        return (
                          <li
                            key={`${id}-${index}`}
                            className={`scene-object-row group ${
                              id === selectedNode
                                ? 'scene-object-row-selected'
                                : isHovered
                                  ? 'scene-object-row-hovered'
                                  : ''
                            }`}
                            onMouseEnter={() => setHoveredNode(id)}
                            onMouseLeave={() => setHoveredNode(null)}
                            onClick={() => setSelectedNode(id)}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <div className={`scene-object-icon ${id === selectedNode ? 'scene-object-icon-selected' : ''}`}>
                                {getNodeIcon(node.type)}
                              </div>
                              <span className={`scene-object-label ${id === selectedNode ? 'scene-object-label-selected' : ''}`} title={label}>
                                {label}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleDelete(node, e)}
                              className="scene-delete-button"
                              title="Delete object"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
