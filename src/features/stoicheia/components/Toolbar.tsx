import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PolygonConstructionMode, useEditorStore, ToolType } from '../store';
import { useShallow } from 'zustand/react/shallow';
import {
  Asterisk,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  Circle,
  CircleDashed,
  CircleDot,
  Compass,
  CornerUpRight,
  GitFork,
  Hexagon,
  MapPin,
  BetweenHorizontalEnd,
  Minus,
  MousePointer2,
  MoveDown,
  Shapes,
  Sparkles,
  Scale,
  Slash,
  TriangleRight,
  Triangle,
  X,
  Crosshair,
  Divide,
  MoveHorizontal,
  LocateFixed,
  Layers3,
  RefreshCw,
  RotateCcw,
  CopyPlus,
  MoveUpRight,
  Braces,
  Ruler,
  Network,
  RectangleHorizontal,
  Repeat2,
  Square,
  Pentagon,
  ScanLine,
  FlaskConical,
  Dice5,
  Palette,
  Construction,
} from 'lucide-react';
import { ToolGroup, ToolItem, ToolSection } from './ToolGroup';
import { geometryToolIcons } from '../icons/geometry';
import type { AdvancedPointRequest, AdvancedPointTool } from './AdvancedPointDialog';
import type { AngleValueTool } from './AngleValueDialog';
import type { MeasurementTool } from './MeasurementDialog';
import { getUiTranslation, type AppLanguage } from '../i18n';

const BarycentricPointDialog = lazy(() => import('./BarycentricPointDialog').then(module => ({ default: module.BarycentricPointDialog })));
const AdvancedPointDialog = lazy(() => import('./AdvancedPointDialog').then(module => ({ default: module.AdvancedPointDialog })));
const TriangleCenterDialog = lazy(() => import('./TriangleCenterDialog').then(module => ({ default: module.TriangleCenterDialog })));
const PointTransformationDialog = lazy(() => import('./PointTransformationDialog').then(module => ({ default: module.PointTransformationDialog })));
const PointsTransformationDialog = lazy(() => import('./PointsTransformationDialog').then(module => ({ default: module.PointsTransformationDialog })));
const VectorPointDialog = lazy(() => import('./VectorPointDialog').then(module => ({ default: module.VectorPointDialog })));
const VectorCoordinatesDialog = lazy(() => import('./VectorCoordinatesDialog').then(module => ({ default: module.VectorCoordinatesDialog })));
const DefinedLineDialog = lazy(() => import('./DefinedLineDialog').then(module => ({ default: module.DefinedLineDialog })));
const DefinedTriangleDialog = lazy(() => import('./DefinedTriangleDialog').then(module => ({ default: module.DefinedTriangleDialog })));
const AssociatedTriangleDialog = lazy(() => import('./AssociatedTriangleDialog').then(module => ({ default: module.AssociatedTriangleDialog })));
const PolygonConstructionDialog = lazy(() => import('./PolygonConstructionDialog').then(module => ({ default: module.PolygonConstructionDialog })));
const DefinedCircleDialog = lazy(() => import('./DefinedCircleDialog').then(module => ({ default: module.DefinedCircleDialog })));
const ProjectedExcentersDialog = lazy(() => import('./ProjectedExcentersDialog').then(module => ({ default: module.ProjectedExcentersDialog })));
const CircleTransformationDialog = lazy(() => import('./CircleTransformationDialog').then(module => ({ default: module.CircleTransformationDialog })));
const LineCircleDialog = lazy(() => import('./LineCircleDialog').then(module => ({ default: module.LineCircleDialog })));
const CircleCircleDialog = lazy(() => import('./CircleCircleDialog').then(module => ({ default: module.CircleCircleDialog })));
const AngleValueDialog = lazy(() => import('./AngleValueDialog').then(module => ({ default: module.AngleValueDialog })));
const RandomPointDialog = lazy(() => import('./RandomPointDialog').then(module => ({ default: module.RandomPointDialog })));
const EllipseDialog = lazy(() => import('./EllipseDialog').then(module => ({ default: module.EllipseDialog })));
const ShowLineDialog = lazy(() => import('./ShowLineDialog').then(module => ({ default: module.ShowLineDialog })));
const ShowTransformationDialog = lazy(() => import('./ShowTransformationDialog').then(module => ({ default: module.ShowTransformationDialog })));
const DuplicateSegmentDialog = lazy(() => import('./DuplicateSegmentDialog').then(module => ({ default: module.DuplicateSegmentDialog })));
const MeasurementDialog = lazy(() => import('./MeasurementDialog').then(module => ({ default: module.MeasurementDialog })));
const RadicalAxisDialog = lazy(() => import('./RadicalAxisDialog').then(module => ({ default: module.RadicalAxisDialog })));

export interface ToolbarGroup {
  id: string;
  label: string;
  tools: ToolItem[];
  sections?: ToolSection[];
}

const defineToolbarGroup = ({ id, label, tools, sections }: {
  id: string;
  label: string;
  tools?: ToolItem[];
  sections?: ToolSection[];
}): ToolbarGroup => ({
  id,
  label,
  tools: tools ?? sections?.flatMap(section => section.tools) ?? [],
  ...(sections ? { sections } : {}),
});

export const RECENT_TOOLS_STORAGE_KEY = 'stoicheia-recent-tools';
const RECENT_TOOLS_LIMIT = 6;

const toolbarGroupsWithDefaultIcons: ToolbarGroup[] = [
  {
    id: 'points',
    label: 'Points',
    tools: [
      { id: 'add_point', icon: <MapPin size={18} />, label: 'Cartesian point', description: 'Click the canvas to define (x,y).' },
      { id: 'add_point_polar', icon: <Compass size={18} />, label: 'Polar point', description: 'Click to define (α:d) from the origin.' },
      { id: 'add_random_point', icon: <Dice5 size={18} />, label: 'Random point', description: 'Rectangle, segment, line, circle or disk.' },
    ],
  },
  defineToolbarGroup({
    id: 'point-constructions',
    label: 'Point constructions',
    sections: [
      {
        id: 'division',
        label: 'Division & combinations',
        tools: [
          { id: 'add_midpoint', icon: <BetweenHorizontalEnd size={18} />, label: 'Midpoint', description: 'Select two points to construct their midpoint.' },
          { id: 'add_golden_ratio', icon: <Sparkles size={18} />, label: 'Golden ratio point', description: 'Select two points to divide their segment by φ.' },
          { id: 'add_barycentric', icon: <Scale size={18} />, label: 'Barycentric point', description: 'Choose points and assign a weight to each.' },
          { id: 'add_harmonic', icon: <Divide size={18} />, label: 'Harmonic division', description: 'Construct one conjugate or both harmonic points.' },
        ],
      },
      {
        id: 'loci',
        label: 'On objects',
        tools: [
          { id: 'add_equi_points', icon: <MoveHorizontal size={18} />, label: 'Equidistant points', description: 'Two line points equidistant from a reference.' },
          { id: 'add_mid_arc', icon: <CircleDashed size={18} />, label: 'Middle of arc', description: 'Center, start and end of a directed arc.' },
          { id: 'add_point_on_line', icon: <Slash size={18} />, label: 'Point on line', description: 'Position a point using parameter t.' },
          { id: 'add_point_on_circle', icon: <Circle size={18} />, label: 'Point on circle', description: 'Use an angle and a point or numeric radius.' },
        ],
      },
      {
        id: 'circle-vector',
        label: 'Circle & vector conditions',
        tools: [
          { id: 'add_similitude_center', icon: <Crosshair size={18} />, label: 'Similitude center', description: 'Internal or external center of two circles.' },
          { id: 'add_vector_point', icon: <MoveUpRight size={18} />, label: 'Vector-defined point', description: 'Orthogonal, linear or copied vector conditions.' },
        ],
      },
    ],
  }),
  {
    id: 'transformations',
    label: 'Transformations',
    tools: [
      { id: 'add_point_transformation', icon: <RefreshCw size={18} />, label: 'Transform point', description: 'Translation, rotation, reflection, inversion and more.' },
      { id: 'add_points_transformation', icon: <CopyPlus size={18} />, label: 'Transform multiple points', description: 'Apply one transformation to a selected list of points.' },
      { id: 'add_circle_transformation', icon: <CircleDot size={18} />, label: 'Transform circle', description: 'Translation, homothety, reflection, projection, rotation or inversion.' },
      { id: 'show_transformation', icon: <RefreshCw size={18} />, label: 'Show transformation', description: 'tkzShowTransformation: show translation, reflection, symmetry or projection construction traces.' },
      { id: 'get_vector_coordinates', icon: <Braces size={18} />, label: 'Vector coordinates', description: 'Store vector components in generated LaTeX macros.' },
    ],
  },
  {
    id: 'lines-segments',
    label: 'Lines & segments',
    tools: [
      { id: 'add_segment', icon: <Slash size={18} />, label: 'Segment', description: 'Select its two endpoints.' },
      { id: 'add_segments', icon: <Network size={18} />, label: 'Multiple segments', description: 'Draw point pairs with shared options.' },
      { id: 'add_polyseg', icon: <MoveUpRight size={18} />, label: 'Polygonal chain', description: 'Select an open sequence of connected points.' },
      { id: 'add_line', icon: <Slash size={18} />, label: 'Draw line', description: 'Draw a straight line through two points.' },
      { id: 'add_lines', icon: <Network size={18} />, label: 'Draw multiple lines', description: 'Draw point pairs with shared line options.' },
    ],
  },
  {
    id: 'circles-curves',
    label: 'Circles & curves',
    tools: [
      { id: 'add_circle', icon: <Circle size={18} />, label: 'Circle', description: 'Select center and radius point.' },
      { id: 'add_circles', icon: <CircleDot size={18} />, label: 'Multiple circles', description: 'Select center–radius point pairs.' },
      { id: 'add_semicircle', icon: <CircleDashed size={18} />, label: 'Semicircle', description: 'Select its center and one radius endpoint.' },
      { id: 'add_semicircles', icon: <Network size={18} />, label: 'Multiple semicircles', description: 'Select center–radius point pairs.' },
      { id: 'add_ellipse', icon: <CircleDashed size={18} />, label: 'Ellipse', description: 'Choose a center, two radii and rotation.' },
      { id: 'add_arc', icon: <CircleDashed size={18} />, label: 'Arc', description: 'Select center, start and end direction.' },
      { id: 'add_sector', icon: <CircleDot size={18} />, label: 'Sector', description: 'Select center, start and end direction.' },
    ],
  },
  {
    id: 'polygons',
    label: 'Polygons',
    tools: [
      { id: 'add_polygon', icon: <Hexagon size={18} />, label: 'Polygon', description: 'Select vertices and close at the first.' },
      { id: 'add_square', icon: <Square size={18} />, label: 'Define square', description: 'Construct two vertices from an ordered side.' },
      { id: 'add_rectangle', icon: <RectangleHorizontal size={18} />, label: 'Define rectangle', description: 'Construct an axis-aligned rectangle from its diagonal.' },
      { id: 'add_parallelogram', icon: <Shapes size={18} />, label: 'Define parallelogram', description: 'Complete three consecutive vertices.' },
      { id: 'add_golden_rectangle', icon: <Sparkles size={18} />, label: 'Golden rectangle', description: 'Construct a rectangle with side ratio φ.' },
      { id: 'add_regular_polygon', icon: <Pentagon size={18} />, label: 'Regular polygon', description: 'Use a center and vertex or one side, with configurable vertex count.' },
    ],
  },
  defineToolbarGroup({
    id: 'geometric-constructions',
    label: 'Geometric constructions',
    sections: [
      {
        id: 'definitions',
        label: 'Definition commands',
        tools: [
          { id: 'add_defined_line', icon: <Ruler size={18} />, label: 'Define straight line', description: 'Mediator, parallel, bisectors, Euler line and tangents.' },
          { id: 'add_defined_circle', icon: <CircleDot size={18} />, label: 'Define circle', description: 'Circumcircle, incircle, Euler, Apollonius and orthogonal circles.' },
        ],
      },
      {
        id: 'line-relatives',
        label: 'Perpendiculars & bisectors',
        tools: [
          { id: 'add_perpendicular', icon: <BetweenHorizontalStart size={18} />, label: 'Perpendicular line', description: 'Base line and a point it passes through.' },
          { id: 'add_projection', icon: <MoveDown size={18} />, label: 'Perpendicular projection', description: 'Drop a perpendicular to a line.' },
          { id: 'add_perpendicular_bisector', icon: <BetweenVerticalEnd size={18} />, label: 'Perpendicular bisector', description: 'Construct from two endpoints.' },
          { id: 'add_angle_bisector', icon: <GitFork size={18} />, label: 'Angle bisector', description: 'Select side, vertex and second side.' },
        ],
      },
      {
        id: 'construction-aids',
        label: 'Construction aids',
        tools: [
          { id: 'add_duplicate_segment', icon: <CopyPlus size={18} />, label: 'Duplicate segment', description: 'tkzDuplicateSegment: copy a segment length onto a target ray.' },
          { id: 'add_compass', icon: <Compass size={18} />, label: 'Compass trace', description: 'tkzCompass: select the center and a point on the arc.' },
          { id: 'add_compasses', icon: <Network size={18} />, label: 'Multiple compass traces', description: 'tkzCompasss: collect center–point pairs.' },
          { id: 'show_line_construction', icon: <Construction size={18} />, label: 'Show line construction', description: 'tkzShowLine: mediator, perpendicular, parallel or bisector steps.' },
          { id: 'add_protractor', icon: <Ruler size={18} />, label: 'Protractor', description: 'tkzProtractor: select the origin and ray direction.' },
        ],
      },
    ],
  }),
  defineToolbarGroup({
    id: 'intersections-relations',
    label: 'Intersections & relations',
    sections: [
      {
        id: 'construct',
        label: 'Construct intersections',
        tools: [
          { id: 'add_intersection', icon: <X size={18} />, label: 'Line intersection', description: 'Select two lines or four points.' },
          { id: 'add_line_circle_intersection', icon: <Crosshair size={18} />, label: 'Line–circle intersection', description: 'N, R or node-defined circle with near/common ordering.' },
          { id: 'add_circle_circle_intersection', icon: <CircleDot size={18} />, label: 'Circle–circle intersection', description: 'Intersect N, R or node-defined circles.' },
          { id: 'add_radical_axis', icon: <CircleDot size={18} />, label: 'Radical axis', description: 'tkzDefRadicalAxis: construct the radical axis of two circles.' },
        ],
      },
      {
        id: 'tests',
        label: 'Boolean tests',
        tools: [
          { id: 'test_line_circle_intersection', icon: <CircleDot size={18} />, label: 'Test line–circle intersection', description: 'Set tkzFlagLC without creating points.' },
          { id: 'test_circle_circle_intersection', icon: <FlaskConical size={18} />, label: 'Test circle–circle intersection', description: 'Set tkzFlagCC without creating points.' },
          { id: 'is_linear', icon: <FlaskConical size={18} />, label: 'Test linearity', description: 'tkzIsLinear: set \\iftkzLinear for three selected points.' },
          { id: 'is_ortho', icon: <FlaskConical size={18} />, label: 'Test orthogonality', description: 'tkzIsOrtho: set \\iftkzOrtho for two lines sharing a vertex.' },
        ],
      },
    ],
  }),
  defineToolbarGroup({
    id: 'triangle',
    label: 'Triangle constructions',
    sections: [
      {
        id: 'families',
        label: 'Triangle families',
        tools: [
          { id: 'add_defined_triangle', icon: <Triangle size={18} />, label: 'Define triangle', description: 'Construct a third vertex using one of 13 triangle families.' },
          { id: 'add_associated_triangle', icon: <Network size={18} />, label: 'Associated triangle', description: 'Orthic, medial, contact, Euler and other related triangles.' },
          { id: 'add_permute', icon: <Repeat2 size={18} />, label: 'Permute triangle', description: 'Exchange the positions of B and C while keeping A and its angle.' },
        ],
      },
      {
        id: 'centers-lines',
        label: 'Centers & altitudes',
        tools: [
          { id: 'add_altitude', icon: <TriangleRight size={18} />, label: 'One altitude', description: 'Select side, vertex and other side.' },
          { id: 'add_all_altitudes', icon: <Asterisk size={18} />, label: 'All altitudes', description: 'Construct all feet and the orthocenter.' },
          { id: 'add_triangle_center', icon: <LocateFixed size={18} />, label: 'Triangle center', description: 'Choose among 16 tkz-euclide center options.' },
          { id: 'add_projected_excenters', icon: <ScanLine size={18} />, label: 'Project excenters', description: 'Construct all nine projections of the three excenters.' },
        ],
      },
    ],
  }),
  {
    id: 'fills',
    label: 'Fills',
    tools: [
      { id: 'fill_circle', icon: <CircleDot size={18} />, label: 'Fill circle', description: 'Select center and radius point.' },
      { id: 'fill_polygon', icon: <Hexagon size={18} />, label: 'Fill polygon', description: 'Select vertices and finish by clicking the first.' },
      { id: 'fill_sector', icon: <Palette size={18} />, label: 'Fill sector', description: 'Select center, start and end direction.' },
      { id: 'fill_angle', icon: <CornerUpRight size={18} />, label: 'Fill angle', description: 'Select side point, vertex and second side.' },
      { id: 'fill_angles', icon: <Network size={18} />, label: 'Fill multiple angles', description: 'Select triples of side–vertex–side points.' },
    ],
  },
  defineToolbarGroup({
    id: 'marks',
    label: 'Marks',
    sections: [
      {
        id: 'segments-arcs',
        label: 'Segments & arcs',
        tools: [
          { id: 'mark_segment', icon: <Minus size={18} />, label: 'Mark segment', description: 'Select two endpoints and add an equality mark.' },
          { id: 'mark_segments', icon: <Network size={18} />, label: 'Mark multiple segments', description: 'Select endpoint pairs with shared marking options.' },
          { id: 'mark_arc', icon: <CircleDashed size={18} />, label: 'Mark arc', description: 'Select center, start and end points.' },
        ],
      },
      {
        id: 'angles',
        label: 'Angles',
        tools: [
          { id: 'add_angle', icon: <CornerUpRight size={18} />, label: 'Mark angle', description: 'tkzMarkAngle: select side, vertex and second side.' },
          { id: 'mark_angles', icon: <Layers3 size={18} />, label: 'Mark multiple angles', description: 'tkzMarkAngles: collect side–vertex–side triples.' },
          { id: 'mark_right_angle', icon: <Asterisk size={18} />, label: 'Mark right angle', description: 'tkzMarkRightAngle: select side, vertex and second side.' },
          { id: 'mark_right_angles', icon: <BetweenVerticalEnd size={18} />, label: 'Mark multiple right angles', description: 'tkzMarkRightAngles with shared options.' },
        ],
      },
      {
        id: 'tikz-pics',
        label: 'TikZ pics',
        tools: [
          { id: 'pic_angle', icon: <Compass size={18} />, label: 'TikZ pic angle', description: 'tkzPicAngle using options from the TikZ angles library.' },
          { id: 'pic_right_angle', icon: <Square size={18} />, label: 'TikZ pic right angle', description: 'tkzPicRightAngle using TikZ pic styling.' },
        ],
      },
    ],
  }),
  defineToolbarGroup({
    id: 'labels',
    label: 'Labels',
    sections: [
      {
        id: 'points',
        label: 'Points',
        tools: [
          { id: 'label_point', icon: <Braces size={18} />, label: 'Custom point label', description: 'tkzLabelPoint: select one point, then edit its text and style.' },
          { id: 'label_points', icon: <CopyPlus size={18} />, label: 'Label multiple points', description: 'tkzLabelPoints: collect existing points with shared options.' },
          { id: 'auto_label_points', icon: <LocateFixed size={18} />, label: 'Auto-label points', description: 'Select the center first, then the points to label radially.' },
        ],
      },
      {
        id: 'linear',
        label: 'Segments & lines',
        tools: [
          { id: 'label_segment', icon: <Minus size={18} />, label: 'Label segment', description: 'tkzLabelSegment: select two endpoints and edit the text afterward.' },
          { id: 'label_segments', icon: <Layers3 size={18} />, label: 'Label multiple segments', description: 'tkzLabelSegments: collect endpoint pairs with one shared label.' },
          { id: 'label_line', icon: <Ruler size={18} />, label: 'Label line', description: 'tkzLabelLine: select two points defining the line.' },
        ],
      },
      {
        id: 'curved',
        label: 'Angles & curves',
        tools: [
          { id: 'label_angle', icon: <CornerUpRight size={18} />, label: 'Label angle', description: 'tkzLabelAngle: select side, vertex and second side.' },
          { id: 'label_angles', icon: <Layers3 size={18} />, label: 'Label multiple angles', description: 'tkzLabelAngles: collect angle triples with shared text.' },
          { id: 'label_circle', icon: <CircleDot size={18} />, label: 'Label circle', description: 'tkzLabelCircle: select center and a point on the circle.' },
          { id: 'label_arc', icon: <CircleDashed size={18} />, label: 'Label arc', description: 'tkzLabelArc: select center, start and end points.' },
        ],
      },
    ],
  }),
  defineToolbarGroup({
    id: 'measurements',
    label: 'Measurements & calculations',
    sections: [
      {
        id: 'angles-lengths',
        label: 'Angles & lengths',
        tools: [
          { id: 'find_angle', icon: <RotateCcw size={18} />, label: 'Find directed angle', description: 'Measure the directed angle formed by three points.' },
          { id: 'find_slope_angle', icon: <Ruler size={18} />, label: 'Find slope angle', description: 'Measure a line direction from the horizontal axis.' },
          { id: 'get_angle', icon: <Braces size={18} />, label: 'Get angle result', description: 'Store tkzAngleResult in a named macro.' },
          { id: 'calc_length', icon: <Ruler size={18} />, label: 'Calculate length', description: 'tkzCalcLength: measure a segment and store it with tkzGetLength.' },
        ],
      },
      {
        id: 'macros-conversions',
        label: 'Macros & conversions',
        tools: [
          { id: 'pt_to_cm', icon: <Braces size={18} />, label: 'pt to cm', description: 'tkzpttocm: convert a TeX point value into centimeters.' },
          { id: 'cm_to_pt', icon: <Braces size={18} />, label: 'cm to pt', description: 'tkzcmtopt: convert centimeters into TeX points.' },
          { id: 'get_point_coordinates', icon: <Braces size={18} />, label: 'Point coordinates', description: 'tkzGetPointCoord: store a point x/y coordinate pair as macros.' },
          { id: 'swap_points', icon: <Repeat2 size={18} />, label: 'Swap points', description: 'tkzSwapPoints: exchange coordinates of two existing point labels.' },
        ],
      },
      {
        id: 'products-powers',
        label: 'Products & powers',
        tools: [
          { id: 'dot_product', icon: <Divide size={18} />, label: 'Dot product', description: 'tkzDotProduct: compute AB · AC and store it with tkzGetResult.' },
          { id: 'power_circle', icon: <CircleDot size={18} />, label: 'Power circle', description: 'tkzPowerCircle: compute point power with respect to a circle.' },
        ],
      },
    ],
  }),
  {
    id: 'canvas',
    label: 'Canvas & clipping',
    tools: [
      { id: 'canvas_init', icon: <Ruler size={18} />, label: 'Initialize bounds', description: 'Insert tkzInit with editable coordinate limits.' },
      { id: 'canvas_clip', icon: <ScanLine size={18} />, label: 'Clip to initialized bounds', description: 'Hide subsequent drawing outside tkzInit bounds.' },
      { id: 'show_bounding_box', icon: <Square size={18} />, label: 'Show bounding box', description: 'Draw the current TikZ bounding box.' },
      { id: 'clip_bounding_box', icon: <Crosshair size={18} />, label: 'Clip to bounding box', description: 'Restrict subsequent drawing to the current bounding box.' },
    ],
  },
];

const withGeometryIcon = (tool: ToolItem): ToolItem => {
  const GeometryIcon = geometryToolIcons[tool.id];
  return GeometryIcon ? { ...tool, icon: <GeometryIcon size={18} /> } : tool;
};

const withGeometryIcons = (group: ToolbarGroup): ToolbarGroup => ({
  ...group,
  tools: group.tools.map(withGeometryIcon),
  ...(group.sections
    ? {
        sections: group.sections.map(section => ({
          ...section,
          tools: section.tools.map(withGeometryIcon),
        })),
      }
    : {}),
});

export const toolbarGroups: ToolbarGroup[] = toolbarGroupsWithDefaultIcons.map(withGeometryIcons);

const translateToolbarTool = (tool: ToolItem, language: AppLanguage): ToolItem => {
  const translation = getUiTranslation(language).toolbar.tools[tool.id];
  return translation ? { ...tool, ...translation } : tool;
};

const translateToolbarGroup = (group: ToolbarGroup, language: AppLanguage): ToolbarGroup => {
  const toolbar = getUiTranslation(language).toolbar;
  return {
    ...group,
    label: toolbar.groups[group.id] ?? group.label,
    tools: group.tools.map(tool => translateToolbarTool(tool, language)),
    ...(group.sections
      ? {
          sections: group.sections.map(section => ({
            ...section,
            label: toolbar.sections[section.id] ?? section.label,
            tools: section.tools.map(tool => translateToolbarTool(tool, language)),
          })),
        }
      : {}),
  };
};

export const getTranslatedToolbarGroups = (language: AppLanguage): ToolbarGroup[] => (
  toolbarGroups.map(group => translateToolbarGroup(group, language))
);

const toolbarTools = toolbarGroups.flatMap(group => group.tools);
const toolbarToolById = new Map<ToolType, ToolItem>(toolbarTools.map(tool => [tool.id, tool]));
const toolbarToolIds = new Set<ToolType>(toolbarTools.map(tool => tool.id));

const loadRecentToolIds = (): ToolType[] => {
  try {
    const stored = window.localStorage.getItem(RECENT_TOOLS_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed)
      ? parsed.filter((tool): tool is ToolType => typeof tool === 'string' && toolbarToolIds.has(tool as ToolType)).slice(0, RECENT_TOOLS_LIMIT)
      : [];
  } catch {
    return [];
  }
};

const persistRecentToolIds = (tools: ToolType[]) => {
  try {
    window.localStorage.setItem(RECENT_TOOLS_STORAGE_KEY, JSON.stringify(tools));
  } catch {
    // Recent tools are a convenience; the toolbar remains fully usable without storage.
  }
};

export function Toolbar() {
  const { activeTool, setActiveTool, parsedNodes, language } = useEditorStore(useShallow(state => ({
    activeTool: state.activeTool,
    setActiveTool: state.setActiveTool,
    parsedNodes: state.parsedNodes,
    language: state.settings.language,
  })));
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [showBarycentricDialog, setShowBarycentricDialog] = useState(false);
  const [advancedDialog, setAdvancedDialog] = useState<AdvancedPointTool | null>(null);
  const [showTriangleCenterDialog, setShowTriangleCenterDialog] = useState(false);
  const [showTransformationDialog, setShowTransformationDialog] = useState(false);
  const [showMultipleTransformationDialog, setShowMultipleTransformationDialog] = useState(false);
  const [showTransformationConstructionDialog, setShowTransformationConstructionDialog] = useState(false);
  const [showVectorPointDialog, setShowVectorPointDialog] = useState(false);
  const [showVectorCoordinatesDialog, setShowVectorCoordinatesDialog] = useState(false);
  const [showDefinedLineDialog, setShowDefinedLineDialog] = useState(false);
  const [showLineDialog, setShowLineDialog] = useState(false);
  const [showDefinedTriangleDialog, setShowDefinedTriangleDialog] = useState(false);
  const [showAssociatedTriangleDialog, setShowAssociatedTriangleDialog] = useState(false);
  const [polygonConstructionMode, setPolygonConstructionMode] = useState<PolygonConstructionMode | null>(null);
  const [showDefinedCircleDialog, setShowDefinedCircleDialog] = useState(false);
  const [showProjectedExcentersDialog, setShowProjectedExcentersDialog] = useState(false);
  const [showCircleTransformationDialog, setShowCircleTransformationDialog] = useState(false);
  const [lineCircleDialog, setLineCircleDialog] = useState<'intersect' | 'test' | null>(null);
  const [circleCircleDialog, setCircleCircleDialog] = useState<'intersect' | 'test' | null>(null);
  const [angleValueDialog, setAngleValueDialog] = useState<AngleValueTool | null>(null);
  const [measurementDialog, setMeasurementDialog] = useState<MeasurementTool | null>(null);
  const [showRandomPointDialog, setShowRandomPointDialog] = useState(false);
  const [showEllipseDialog, setShowEllipseDialog] = useState(false);
  const [showDuplicateSegmentDialog, setShowDuplicateSegmentDialog] = useState(false);
  const [showRadicalAxisDialog, setShowRadicalAxisDialog] = useState(false);
  const [recentToolIds, setRecentToolIds] = useState<ToolType[]>(loadRecentToolIds);
  const toolbarRef = useRef<HTMLElement>(null);
  const t = getUiTranslation(language).toolbar;
  const translatedToolbarGroups = useMemo(() => getTranslatedToolbarGroups(language), [language]);
  const translatedToolById = useMemo(() => new Map<ToolType, ToolItem>(
    translatedToolbarGroups.flatMap(group => group.tools).map(tool => [tool.id, tool]),
  ), [translatedToolbarGroups]);
  const recentTools = recentToolIds
    .map(tool => translatedToolById.get(tool) ?? toolbarToolById.get(tool))
    .filter((tool): tool is ToolItem => Boolean(tool));

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node)) setOpenGroup(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenGroup(null);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const selectTool = useCallback((tool: ToolType) => {
    useEditorStore.getState().setSelectedPoints([]);
    setActiveTool(tool);
    setOpenGroup(null);
    if (toolbarToolIds.has(tool)) {
      setRecentToolIds(current => {
        const next = [tool, ...current.filter(item => item !== tool)].slice(0, RECENT_TOOLS_LIMIT);
        persistRecentToolIds(next);
        return next;
      });
    }
    if (tool === 'canvas_init') { useEditorStore.getState().addCanvasInit(); setActiveTool('cursor'); return; }
    if (tool === 'canvas_clip') { useEditorStore.getState().addCanvasClip(); setActiveTool('cursor'); return; }
    if (tool === 'show_bounding_box') { useEditorStore.getState().addShowBoundingBox(); setActiveTool('cursor'); return; }
    if (tool === 'clip_bounding_box') { useEditorStore.getState().addClipBoundingBox(); setActiveTool('cursor'); return; }
    if (tool === 'add_barycentric') setShowBarycentricDialog(true);
    if (tool === 'add_similitude_center') setAdvancedDialog('similitude');
    if (tool === 'add_harmonic') setAdvancedDialog('harmonic');
    if (tool === 'add_equi_points') setAdvancedDialog('equi');
    if (tool === 'add_mid_arc') setAdvancedDialog('midarc');
    if (tool === 'add_point_on_line') setAdvancedDialog('on-line');
    if (tool === 'add_point_on_circle') setAdvancedDialog('on-circle');
    if (tool === 'add_random_point') setShowRandomPointDialog(true);
    if (tool === 'add_point_transformation') setShowTransformationDialog(true);
    if (tool === 'add_points_transformation') setShowMultipleTransformationDialog(true);
    if (tool === 'show_transformation') setShowTransformationConstructionDialog(true);
    if (tool === 'add_vector_point') setShowVectorPointDialog(true);
    if (tool === 'get_vector_coordinates') setShowVectorCoordinatesDialog(true);
    if (tool === 'add_defined_line') setShowDefinedLineDialog(true);
    if (tool === 'show_line_construction') setShowLineDialog(true);
    if (tool === 'add_defined_triangle') setShowDefinedTriangleDialog(true);
    if (tool === 'add_associated_triangle') setShowAssociatedTriangleDialog(true);
    if (tool === 'add_permute') setPolygonConstructionMode('permute');
    if (tool === 'add_square') setPolygonConstructionMode('square');
    if (tool === 'add_rectangle') setPolygonConstructionMode('rectangle');
    if (tool === 'add_parallelogram') setPolygonConstructionMode('parallelogram');
    if (tool === 'add_golden_rectangle') setPolygonConstructionMode('golden_rectangle');
    if (tool === 'add_regular_polygon') setPolygonConstructionMode('regular_polygon');
    if (tool === 'add_defined_circle') setShowDefinedCircleDialog(true);
    if (tool === 'add_projected_excenters') setShowProjectedExcentersDialog(true);
    if (tool === 'add_circle_transformation') setShowCircleTransformationDialog(true);
    if (tool === 'add_line_circle_intersection') setLineCircleDialog('intersect');
    if (tool === 'test_line_circle_intersection') setLineCircleDialog('test');
    if (tool === 'add_circle_circle_intersection') setCircleCircleDialog('intersect');
    if (tool === 'test_circle_circle_intersection') setCircleCircleDialog('test');
    if (tool === 'add_radical_axis') setShowRadicalAxisDialog(true);
    if (tool === 'find_angle') setAngleValueDialog('angle');
    if (tool === 'find_slope_angle') setAngleValueDialog('slope');
    if (tool === 'get_angle') setAngleValueDialog('get');
    if (tool === 'calc_length') setMeasurementDialog('length');
    if (tool === 'pt_to_cm') setMeasurementDialog('pt_to_cm');
    if (tool === 'cm_to_pt') setMeasurementDialog('cm_to_pt');
    if (tool === 'get_point_coordinates') setMeasurementDialog('point_coordinates');
    if (tool === 'swap_points') setMeasurementDialog('swap_points');
    if (tool === 'dot_product') setMeasurementDialog('dot_product');
    if (tool === 'power_circle') setMeasurementDialog('power_circle');
    if (tool === 'is_linear') setMeasurementDialog('is_linear');
    if (tool === 'is_ortho') setMeasurementDialog('is_ortho');
    if (tool === 'add_triangle_center') setShowTriangleCenterDialog(true);
    if (tool === 'add_ellipse') setShowEllipseDialog(true);
    if (tool === 'add_duplicate_segment') setShowDuplicateSegmentDialog(true);
  }, [setActiveTool]);

  useEffect(() => {
    const selectFromCommandPalette = (event: Event) => {
      const tool = (event as CustomEvent<{ tool?: ToolType }>).detail?.tool;
      if (tool) selectTool(tool);
    };
    window.addEventListener('stoicheia:select-tool', selectFromCommandPalette);
    return () => window.removeEventListener('stoicheia:select-tool', selectFromCommandPalette);
  }, [selectTool]);

  const pointNames = useMemo(() => Array.from(new Set(parsedNodes.flatMap(node => {
    if (node.type === 'Point' || node.type === 'MidPoint' || node.type === 'IntersectionPoint' || node.type === 'GoldenRatioPoint' || node.type === 'BarycentricPoint' || node.type === 'SimilitudeCenter' || node.type === 'HarmonicPoint' || node.type === 'MidArcPoint' || node.type === 'PointOnLine' || node.type === 'PointOnCircle' || node.type === 'RandomPoint' || node.type === 'PointTransformation' || node.type === 'VectorPoint' || node.type === 'DuplicateSegment' || node.type === 'DefinedTriangle' || node.type === 'TriangleCenter') {
      return [node.name];
    }
    if (node.type === 'HarmonicPair' || node.type === 'EquiPoints') return [node.name1, node.name2];
    if (node.type === 'PointsTransformation') return node.names;
    if (node.type === 'DefinedLine') return node.results;
    if (node.type === 'AssociatedTriangle') return node.results;
    if (node.type === 'PolygonConstruction') return node.results;
    if (node.type === 'DefinedCircle') return node.results;
    if (node.type === 'ProjectedExcenters' || node.type === 'CircleTransformation') return node.results;
    if (node.type === 'RadicalAxis') return node.results;
    if (node.type === 'LineCircleIntersection') return node.results;
    if (node.type === 'CircleCircleIntersection') return node.results;
    if (node.type === 'PerpendicularLine' || node.type === 'AngleBisector') return [node.helper];
    if (node.type === 'ProjectionLine' || node.type === 'TriangleAltitude') return [node.foot];
    if (node.type === 'PerpendicularBisector') return [node.helper1, node.helper2];
    if (node.type === 'AllAltitudes') return [node.foot1, node.foot2, node.foot3, node.orthocenter];
    return [];
  }))), [parsedNodes]);
  const circles = useMemo(() => parsedNodes
    .filter(node => node.type === 'Circle')
    .map(node => ({ center: node.center, radiusPoint: node.radius_point })), [parsedNodes]);

  const createAdvancedPoint = (request: AdvancedPointRequest) => {
    const store = useEditorStore.getState();
    if (request.tool === 'similitude') {
      store.addSimilitudeCenter(request.kind, request.circle1.center, request.circle1.radiusPoint, request.circle2.center, request.circle2.radiusPoint);
    } else if (request.tool === 'harmonic') {
      store.addHarmonicPoint(request.mode, request.p1, request.p2, request.known);
    } else if (request.tool === 'harmonic-pair') {
      store.addHarmonicPair(request.p1, request.p2, request.ratio);
    } else if (request.tool === 'equi') {
      store.addEquiPoints(request.p1, request.p2, request.from, request.distance, request.show);
    } else if (request.tool === 'midarc') {
      store.addMidArcPoint(request.center, request.start, request.end);
    } else if (request.tool === 'on-line') {
      store.addPointOnLine(request.p1, request.p2, request.position);
    } else {
      store.addPointOnCircle(request.mode, request.center, request.angle, request.value);
    }
    setAdvancedDialog(null);
    setActiveTool('cursor');
  };

  return (
    <nav ref={toolbarRef} aria-label={t.drawingTools} className="theme-navigation activity-bar relative border-r flex flex-col items-center z-30 shrink-0">
      <button
        type="button"
        title={t.tools.cursor?.label ?? 'Select & Move (V)'}
        aria-label={t.tools.cursor?.label ?? 'Select & Move (V)'}
        aria-pressed={activeTool === 'cursor'}
        onClick={() => selectTool('cursor')}
        className={`activity-button ${activeTool === 'cursor' ? 'activity-button-active' : ''}`}
      >
        {activeTool === 'cursor' && <span className="activity-rail-indicator" />}
        <MousePointer2 size={19} />
      </button>

      <div className="theme-divider w-7 h-px my-2" />
      <div className="flex flex-col items-center gap-1.5">
        {recentTools.length > 0 && (
          <>
            <ToolGroup
              key="recent"
              label={t.recent}
              tools={recentTools}
              activeTool={activeTool}
              open={openGroup === 'recent'}
              onToggle={() => setOpenGroup(current => current === 'recent' ? null : 'recent')}
              onSelect={selectTool}
              groupToolsLabel={t.groupTools}
            />
            <div className="theme-divider w-7 h-px my-1" />
          </>
        )}
        {translatedToolbarGroups.map(group => (
          <ToolGroup
            key={group.id}
            label={group.label}
            tools={group.tools}
            sections={group.sections}
            activeTool={activeTool}
            open={openGroup === group.id}
            onToggle={() => setOpenGroup(current => current === group.id ? null : group.id)}
            onSelect={selectTool}
            groupToolsLabel={t.groupTools}
          />
        ))}
      </div>

      <div className="activity-footer-icon" title={t.groupedGeometryTools}>
        <Shapes size={15} />
      </div>

      <Suspense fallback={null}>
        {showBarycentricDialog && (
          <BarycentricPointDialog
            open
            pointNames={pointNames}
            onCancel={() => {
              setShowBarycentricDialog(false);
              setActiveTool('cursor');
            }}
            onCreate={terms => {
              useEditorStore.getState().addBarycentricPoint(terms);
              setShowBarycentricDialog(false);
              setActiveTool('cursor');
            }}
          />
        )}
        {advancedDialog && (
          <AdvancedPointDialog
            tool={advancedDialog}
            pointNames={pointNames}
            circles={circles}
            onCancel={() => {
              setAdvancedDialog(null);
              setActiveTool('cursor');
            }}
            onCreate={createAdvancedPoint}
          />
        )}
        {showTriangleCenterDialog && (
          <TriangleCenterDialog
            open
            pointNames={pointNames}
            onCancel={() => {
              setShowTriangleCenterDialog(false);
              setActiveTool('cursor');
            }}
            onCreate={(option, p1, p2, p3) => {
              useEditorStore.getState().addTriangleCenter(option, p1, p2, p3);
              setShowTriangleCenterDialog(false);
              setActiveTool('cursor');
            }}
          />
        )}
        {showTransformationDialog && (
          <PointTransformationDialog
            open
            pointNames={pointNames}
            onCancel={() => {
              setShowTransformationDialog(false);
              setActiveTool('cursor');
            }}
            onCreate={input => {
              useEditorStore.getState().addPointTransformation(input);
              setShowTransformationDialog(false);
              setActiveTool('cursor');
            }}
          />
        )}
        {showMultipleTransformationDialog && (
          <PointsTransformationDialog
            open
            pointNames={pointNames}
            onCancel={() => {
              setShowMultipleTransformationDialog(false);
              setActiveTool('cursor');
            }}
            onCreate={input => {
              useEditorStore.getState().addPointsTransformation(input);
              setShowMultipleTransformationDialog(false);
              setActiveTool('cursor');
            }}
          />
        )}
        {showTransformationConstructionDialog && (
          <ShowTransformationDialog
            open
            pointNames={pointNames}
            onCancel={() => {
              setShowTransformationConstructionDialog(false);
              setActiveTool('cursor');
            }}
            onCreate={input => {
              useEditorStore.getState().addShowTransformation(input);
              setShowTransformationConstructionDialog(false);
              setActiveTool('cursor');
            }}
          />
        )}
        {showVectorPointDialog && (
          <VectorPointDialog
            open
            pointNames={pointNames}
            onCancel={() => {
              setShowVectorPointDialog(false);
              setActiveTool('cursor');
            }}
            onCreate={input => {
              useEditorStore.getState().addVectorPoint(input);
              setShowVectorPointDialog(false);
              setActiveTool('cursor');
            }}
          />
        )}
        {showVectorCoordinatesDialog && (
          <VectorCoordinatesDialog
            open
            pointNames={pointNames}
            onCancel={() => {
              setShowVectorCoordinatesDialog(false);
              setActiveTool('cursor');
            }}
            onCreate={(p1, p2, macro) => {
              useEditorStore.getState().addVectorCoordinates(p1, p2, macro);
              setShowVectorCoordinatesDialog(false);
              setActiveTool('cursor');
            }}
          />
        )}
        {showDefinedLineDialog && (
          <DefinedLineDialog
            open
            pointNames={pointNames}
            onCancel={() => {
              setShowDefinedLineDialog(false);
              setActiveTool('cursor');
            }}
            onCreate={input => {
              useEditorStore.getState().addDefinedLine(input);
              setShowDefinedLineDialog(false);
              setActiveTool('cursor');
            }}
          />
        )}
        {showDefinedTriangleDialog && (
          <DefinedTriangleDialog
            open
            pointNames={pointNames}
            onCancel={() => {
              setShowDefinedTriangleDialog(false);
              setActiveTool('cursor');
            }}
            onCreate={input => {
              useEditorStore.getState().addDefinedTriangle(input);
              setShowDefinedTriangleDialog(false);
              setActiveTool('cursor');
            }}
          />
        )}
        {showAssociatedTriangleDialog && (
          <AssociatedTriangleDialog
            open
            pointNames={pointNames}
            onCancel={() => {
              setShowAssociatedTriangleDialog(false);
              setActiveTool('cursor');
            }}
            onCreate={input => {
              useEditorStore.getState().addAssociatedTriangle(input);
              setShowAssociatedTriangleDialog(false);
              setActiveTool('cursor');
            }}
          />
        )}
        {polygonConstructionMode && (
          <PolygonConstructionDialog
            open
            mode={polygonConstructionMode}
            pointNames={pointNames}
            onCancel={() => {
              setPolygonConstructionMode(null);
              setActiveTool('cursor');
            }}
            onCreate={input => {
              useEditorStore.getState().addPolygonConstruction(input);
              setPolygonConstructionMode(null);
              setActiveTool('cursor');
            }}
          />
        )}
        {showDefinedCircleDialog && (
          <DefinedCircleDialog
            open
            pointNames={pointNames}
            onCancel={() => {
              setShowDefinedCircleDialog(false);
              setActiveTool('cursor');
            }}
            onCreate={input => {
              useEditorStore.getState().addDefinedCircle(input);
              setShowDefinedCircleDialog(false);
              setActiveTool('cursor');
            }}
          />
        )}
        {showProjectedExcentersDialog && (
          <ProjectedExcentersDialog
            open
            pointNames={pointNames}
            onCancel={() => { setShowProjectedExcentersDialog(false); setActiveTool('cursor'); }}
            onCreate={input => { useEditorStore.getState().addProjectedExcenters(input); setShowProjectedExcentersDialog(false); setActiveTool('cursor'); }}
          />
        )}
        {showCircleTransformationDialog && (
          <CircleTransformationDialog
            open
            pointNames={pointNames}
            onCancel={() => { setShowCircleTransformationDialog(false); setActiveTool('cursor'); }}
            onCreate={input => { useEditorStore.getState().addCircleTransformation(input); setShowCircleTransformationDialog(false); setActiveTool('cursor'); }}
          />
        )}
        {lineCircleDialog && (
          <LineCircleDialog
            open
            kind={lineCircleDialog}
            pointNames={pointNames}
            onCancel={() => { setLineCircleDialog(null); setActiveTool('cursor'); }}
            onIntersect={input => { useEditorStore.getState().addLineCircleIntersection(input); setLineCircleDialog(null); setActiveTool('cursor'); }}
            onTest={(line, circle) => { useEditorStore.getState().addLineCircleTest(line, circle); setLineCircleDialog(null); setActiveTool('cursor'); }}
          />
        )}
        {circleCircleDialog && (
          <CircleCircleDialog
            open
            kind={circleCircleDialog}
            pointNames={pointNames}
            onCancel={() => { setCircleCircleDialog(null); setActiveTool('cursor'); }}
            onIntersect={input => { useEditorStore.getState().addCircleCircleIntersection(input); setCircleCircleDialog(null); setActiveTool('cursor'); }}
            onTest={circles => { useEditorStore.getState().addCircleCircleTest(circles); setCircleCircleDialog(null); setActiveTool('cursor'); }}
          />
        )}
        {angleValueDialog && (
          <AngleValueDialog
            tool={angleValueDialog}
            pointNames={pointNames}
            onCancel={() => { setAngleValueDialog(null); setActiveTool('cursor'); }}
            onCalculate={(mode, points, macro) => { useEditorStore.getState().addAngleCalculation(mode, points, macro); setAngleValueDialog(null); setActiveTool('cursor'); }}
            onGet={macro => { useEditorStore.getState().addAngleRetrieval(macro); setAngleValueDialog(null); setActiveTool('cursor'); }}
          />
        )}
        {measurementDialog && (
          <MeasurementDialog
            tool={measurementDialog}
            pointNames={pointNames}
            onCancel={() => { setMeasurementDialog(null); setActiveTool('cursor'); }}
            onLength={(p1, p2, macro, options) => { useEditorStore.getState().addLengthCalculation(p1, p2, macro, options); setMeasurementDialog(null); setActiveTool('cursor'); }}
            onConvert={(mode, value, macro) => { useEditorStore.getState().addUnitConversion(mode, value, macro); setMeasurementDialog(null); setActiveTool('cursor'); }}
            onPointCoordinates={(point, macro) => { useEditorStore.getState().addPointCoordinates(point, macro); setMeasurementDialog(null); setActiveTool('cursor'); }}
            onSwapPoints={(p1, p2) => { useEditorStore.getState().addSwapPoints(p1, p2); setMeasurementDialog(null); setActiveTool('cursor'); }}
            onDotProduct={(p1, p2, p3, macro) => { useEditorStore.getState().addDotProduct(p1, p2, p3, macro); setMeasurementDialog(null); setActiveTool('cursor'); }}
            onPowerCircle={(point, center, radiusPoint, macro) => { useEditorStore.getState().addPowerCircle(point, center, radiusPoint, macro); setMeasurementDialog(null); setActiveTool('cursor'); }}
            onLinearityTest={points => { useEditorStore.getState().addLinearityTest(points); setMeasurementDialog(null); setActiveTool('cursor'); }}
            onOrthogonalityTest={points => { useEditorStore.getState().addOrthogonalityTest(points); setMeasurementDialog(null); setActiveTool('cursor'); }}
          />
        )}
        {showRandomPointDialog && (
          <RandomPointDialog
            open
            pointNames={pointNames}
            onCancel={() => { setShowRandomPointDialog(false); setActiveTool('cursor'); }}
            onCreate={input => { useEditorStore.getState().addRandomPoint(input); setShowRandomPointDialog(false); setActiveTool('cursor'); }}
          />
        )}
        {showEllipseDialog && (
          <EllipseDialog
            open
            pointNames={pointNames}
            onCancel={() => { setShowEllipseDialog(false); setActiveTool('cursor'); }}
            onCreate={(center, xRadius, yRadius, angle) => { useEditorStore.getState().addEllipse(center, xRadius, yRadius, angle); setShowEllipseDialog(false); setActiveTool('cursor'); }}
          />
        )}
        {showLineDialog && (
          <ShowLineDialog
            open
            pointNames={pointNames}
            onCancel={() => { setShowLineDialog(false); setActiveTool('cursor'); }}
            onCreate={input => { useEditorStore.getState().addShowLine(input); setShowLineDialog(false); setActiveTool('cursor'); }}
          />
        )}
        {showDuplicateSegmentDialog && (
          <DuplicateSegmentDialog
            open
            pointNames={pointNames}
            onCancel={() => { setShowDuplicateSegmentDialog(false); setActiveTool('cursor'); }}
            onCreate={input => { useEditorStore.getState().addDuplicateSegment(input); setShowDuplicateSegmentDialog(false); setActiveTool('cursor'); }}
          />
        )}
        {showRadicalAxisDialog && (
          <RadicalAxisDialog
            open
            pointNames={pointNames}
            onCancel={() => { setShowRadicalAxisDialog(false); setActiveTool('cursor'); }}
            onCreate={input => { useEditorStore.getState().addRadicalAxis(input); setShowRadicalAxisDialog(false); setActiveTool('cursor'); }}
          />
        )}
      </Suspense>
    </nav>
  );
}
