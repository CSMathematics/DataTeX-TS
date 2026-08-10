import { create } from 'zustand'
import { type AppLanguage, normalizeLanguage } from './i18n'
import { AppTheme, getInitialTheme } from './theme'
import { splitTikzOptions } from './tikz/options'
import {
  GlobalStyleKind,
  removeCustomStyleFromSource,
  removeGlobalStyleFromSource,
  toggleCustomStyleInSource,
  toggleGlobalStyleInSource,
  upsertCustomStyleInSource,
  upsertGlobalStyleInSource,
} from './tikz/styleCommands'

export interface PointDef {
  type: "Point";
  name: string;
  x: number;
  y: number;
  coordinate_mode?: "cartesian" | "polar";
  angle?: number;
  distance?: number;
}

export interface SegmentDef {
  type: "Segment";
  p1: string;
  p2: string;
  options?: string;
}

export interface LineDef {
  type: "Line";
  p1: string;
  p2: string;
  options?: string;
}

export interface LinesDef {
  type: "Lines";
  pairs: [string, string][];
  options?: string;
}

export interface SegmentsDef {
  type: "Segments";
  pairs: [string, string][];
  options?: string;
}

export interface PolySegDef {
  type: "PolySeg";
  points: string[];
  options?: string;
}

export interface CirclesDef {
  type: "Circles";
  pairs: [string, string][];
  options?: string;
}

export interface SemiCircleDef {
  type: "SemiCircle";
  center: string;
  radius_point: string;
  options?: string;
}

export interface SemiCirclesDef {
  type: "SemiCircles";
  pairs: [string, string][];
  options?: string;
}

export interface PolygonDef {
  type: "Polygon";
  points: string[];
  options?: string;
}

export interface CircleDef {
  type: "Circle";
  center: string;
  radius_point: string;
  options?: string;
}

export interface ArcDef {
  type: "Arc";
  mode: "towards" | "rotate" | "R" | "R_with_nodes" | "angles";
  center: string;
  first: string;
  second: string[];
  options?: string;
}

export interface SectorDef {
  type: "Sector";
  mode: "towards" | "rotate" | "R" | "R_with_nodes";
  center: string;
  first: string;
  second: string[];
  options?: string;
}

export interface FillCircleDef {
  type: "FillCircle";
  mode: "radius" | "R";
  center: string;
  radius: string;
  options?: string;
}

export interface FillPolygonDef {
  type: "FillPolygon";
  points: string[];
  options?: string;
}

export interface FillSectorDef {
  type: "FillSector";
  mode: "towards" | "rotate" | "R" | "R_with_nodes";
  center: string;
  first: string;
  second: string[];
  options?: string;
}

export interface FillAngleDef {
  type: "FillAngle";
  p1: string;
  vertex: string;
  p2: string;
  options?: string;
}

export interface FillAnglesDef {
  type: "FillAngles";
  angles: [string, string, string][];
  options?: string;
}

export interface CanvasInitDef {
  type: "CanvasInit";
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
  xstep: number;
  ystep: number;
  options?: string;
}

export interface CanvasClipDef {
  type: "CanvasClip";
  space: number;
  options?: string;
}

export interface ShowBoundingBoxDef {
  type: "ShowBoundingBox";
  options?: string;
}

export interface StyleSetupDef {
  type: "StyleSetup";
  kind: GlobalStyleKind;
  command: string;
  options?: string;
}

export interface CustomStyleDef {
  type: "CustomStyle";
  name: string;
  options?: string;
}

export interface CompassDef {
  type: "Compass";
  center: string;
  through: string;
  options?: string;
}

export interface CompassesDef {
  type: "Compasses";
  pairs: [string, string][];
  options?: string;
}

export type ShowLineMode = "mediator" | "perpendicular" | "orthogonal" | "parallel" | "bisector";

export interface ShowLineDef {
  type: "ShowLine";
  mode: ShowLineMode;
  points: string[];
  through?: string;
  options?: string;
}

export interface ShowLineInput {
  mode: ShowLineMode;
  points: string[];
  through?: string;
  length?: number;
  ratio?: number;
  gap?: number;
  size?: number;
  factor?: number;
  options?: string;
}

export type ShowTransformationMode = "translation" | "reflection" | "symmetry" | "projection";

export interface ShowTransformationDef {
  type: "ShowTransformation";
  mode: ShowTransformationMode;
  source: string;
  references: string[];
  options?: string;
}

export interface ShowTransformationInput {
  mode: ShowTransformationMode;
  source: string;
  references: string[];
  length?: number;
  ratio?: number;
  gap?: number;
  size?: number;
  factor?: number;
  options?: string;
}

export interface ProtractorDef {
  type: "Protractor";
  origin: string;
  direction: string;
  options?: string;
}

export interface ClipBoundingBoxDef {
  type: "ClipBoundingBox";
}

export interface PolygonClipDef {
  type: "PolygonClip";
  points: string[];
  out: boolean;
  options?: string;
}

export interface CircleClipDef {
  type: "CircleClip";
  center: string;
  radius_point: string;
  out: boolean;
  options?: string;
}

export interface SectorClipDef {
  type: "SectorClip";
  mode: "towards" | "rotate" | "R";
  center: string;
  first: string;
  second: string[];
  options?: string;
}

export interface SegmentMarkDef {
  type: "SegmentMark";
  p1: string;
  p2: string;
  options?: string;
}

export interface SegmentsMarkDef {
  type: "SegmentsMark";
  pairs: [string, string][];
  options?: string;
}

export interface ArcMarkDef {
  type: "ArcMark";
  center: string;
  start: string;
  end: string;
  options?: string;
}

export interface EllipseDef {
  type: "Ellipse";
  center: string;
  x_radius: number;
  y_radius: number;
  angle: number;
  options?: string;
}

export interface PerpendicularLineDef {
  type: "PerpendicularLine";
  p1: string;
  p2: string;
  through: string;
  helper: string;
  options?: string;
}

export interface ProjectionLineDef {
  type: "ProjectionLine";
  p1: string;
  p2: string;
  from: string;
  foot: string;
  options?: string;
}

export interface PerpendicularBisectorDef {
  type: "PerpendicularBisector";
  p1: string;
  p2: string;
  helper1: string;
  helper2: string;
  options?: string;
}

export interface AngleBisectorDef {
  type: "AngleBisector";
  p1: string;
  vertex: string;
  p2: string;
  helper: string;
  options?: string;
}

export interface TriangleAltitudeDef {
  type: "TriangleAltitude";
  side1: string;
  vertex: string;
  side2: string;
  foot: string;
  options?: string;
}

export interface AllAltitudesDef {
  type: "AllAltitudes";
  p1: string;
  p2: string;
  p3: string;
  foot1: string;
  foot2: string;
  foot3: string;
  orthocenter: string;
  options?: string;
}

export type TriangleCenterOption = "ortho" | "orthic" | "centroid" | "median" | "circum" | "in" | "ex" | "euler" | "gergonne" | "symmedian" | "lemoine" | "grebe" | "spieker" | "nagel" | "mittenpunkt" | "feuerbach";

export interface TriangleCenterDef {
  type: "TriangleCenter";
  option: TriangleCenterOption;
  p1: string;
  p2: string;
  p3: string;
  name: string;
}

export interface AngleMarkDef {
  type: "AngleMark";
  p1: string;
  vertex: string;
  p2: string;
  options?: string;
  label?: string;
}

export interface AnglesMarkDef {
  type: "AnglesMark";
  angles: [string, string, string][];
  options?: string;
}

export interface RightAngleMarkDef {
  type: "RightAngleMark";
  p1: string;
  vertex: string;
  p2: string;
  options?: string;
}

export interface RightAnglesMarkDef {
  type: "RightAnglesMark";
  angles: [string, string, string][];
  options?: string;
}

export interface PicAngleDef {
  type: "PicAngle";
  p1: string;
  vertex: string;
  p2: string;
  options?: string;
}

export interface PicRightAngleDef {
  type: "PicRightAngle";
  p1: string;
  vertex: string;
  p2: string;
  options?: string;
}

export interface LabelPointDef {
  type: "LabelPoint";
  point: string;
  text: string;
  options?: string;
}

export interface LabelPointsDef {
  type: "LabelPoints";
  points: string[];
  options?: string;
}

export interface AutoLabelPointsDef {
  type: "AutoLabelPoints";
  points: string[];
  center?: string;
  distance?: number;
  options?: string;
}

export interface LabelSegmentDef {
  type: "LabelSegment";
  p1: string;
  p2: string;
  text: string;
  options?: string;
}

export interface LabelSegmentsDef {
  type: "LabelSegments";
  pairs: [string, string][];
  text: string;
  options?: string;
}

export interface LabelLineDef {
  type: "LabelLine";
  p1: string;
  p2: string;
  text: string;
  options?: string;
}

export interface LabelAngleDef {
  type: "LabelAngle";
  p1: string;
  vertex: string;
  p2: string;
  text: string;
  options?: string;
}

export interface LabelAnglesDef {
  type: "LabelAngles";
  angles: [string, string, string][];
  text: string;
  options?: string;
}

export interface LabelCircleDef {
  type: "LabelCircle";
  center: string;
  radius_point: string;
  angle: string;
  text: string;
  options?: string;
}

export interface LabelArcDef {
  type: "LabelArc";
  center: string;
  start: string;
  end: string;
  text: string;
  options?: string;
}

export interface IntersectionPointDef {
  type: "IntersectionPoint";
  p1: string;
  p2: string;
  p3: string;
  p4: string;
  name: string;
}

export interface MidPointDef {
  type: "MidPoint";
  p1: string;
  p2: string;
  name: string;
}

export interface GoldenRatioPointDef {
  type: "GoldenRatioPoint";
  p1: string;
  p2: string;
  name: string;
}

export interface BarycentricPointDef {
  type: "BarycentricPoint";
  points: string[];
  weights: number[];
  name: string;
}

export interface SimilitudeCenterDef {
  type: "SimilitudeCenter";
  kind: "ext" | "int";
  center1: string;
  radius1: string;
  center2: string;
  radius2: string;
  name: string;
}

export interface HarmonicPointDef {
  type: "HarmonicPoint";
  mode: "ext" | "int";
  p1: string;
  p2: string;
  known: string;
  name: string;
}

export interface HarmonicPairDef {
  type: "HarmonicPair";
  p1: string;
  p2: string;
  ratio: number;
  name1: string;
  name2: string;
}

export interface EquiPointsDef {
  type: "EquiPoints";
  p1: string;
  p2: string;
  from: string;
  distance: number;
  show: boolean;
  name1: string;
  name2: string;
}

export interface MidArcPointDef {
  type: "MidArcPoint";
  center: string;
  start: string;
  end: string;
  name: string;
}

export interface PointOnLineDef {
  type: "PointOnLine";
  p1: string;
  p2: string;
  position: number;
  name: string;
}

export interface PointOnCircleDef {
  type: "PointOnCircle";
  mode: "through" | "R";
  center: string;
  angle: number;
  through?: string;
  radius?: number;
  name: string;
}

export type PointTransformationMode = "translation" | "homothety" | "reflection" | "symmetry" | "projection" | "rotation" | "rotation_in_rad" | "rotation_with_nodes" | "inversion" | "inversion_negative";

export interface PointTransformationDef {
  type: "PointTransformation";
  mode: PointTransformationMode;
  source: string;
  references: string[];
  value?: string;
  name: string;
}

export interface PointTransformationInput {
  mode: PointTransformationMode;
  source: string;
  references: string[];
  value?: string;
}

export interface PointsTransformationDef {
  type: "PointsTransformation";
  mode: PointTransformationMode;
  sources: string[];
  references: string[];
  value?: string;
  names: string[];
}

export interface PointsTransformationInput {
  mode: PointTransformationMode;
  sources: string[];
  references: string[];
  value?: string;
  primeNames?: boolean;
}

export type VectorPointMode = "orthogonal" | "orthogonal_normed" | "linear" | "linear_normed" | "colinear" | "colinear_normed";

export interface VectorPointDef {
  type: "VectorPoint";
  mode: VectorPointMode;
  p1: string;
  p2: string;
  anchor?: string;
  factor: number;
  name: string;
}

export interface VectorPointInput {
  mode: VectorPointMode;
  p1: string;
  p2: string;
  anchor?: string;
  factor: number;
}

export interface VectorCoordinatesDef {
  type: "VectorCoordinates";
  p1: string;
  p2: string;
  macro: string;
}

export interface PointCoordinatesDef {
  type: "PointCoordinates";
  point: string;
  macro: string;
}

export interface SwapPointsDef {
  type: "SwapPoints";
  p1: string;
  p2: string;
}

export interface DuplicateSegmentDef {
  type: "DuplicateSegment";
  rayStart: string;
  rayThrough: string;
  segmentStart: string;
  segmentEnd: string;
  name: string;
}

export interface DuplicateSegmentInput {
  rayStart: string;
  rayThrough: string;
  segmentStart: string;
  segmentEnd: string;
}

export interface RadicalAxisDef {
  type: "RadicalAxis";
  circle1: [string, string];
  circle2: [string, string];
  results: string[];
}

export interface RadicalAxisInput {
  circle1: [string, string];
  circle2: [string, string];
}

export type LineDefinitionMode = "mediator" | "perpendicular" | "orthogonal" | "parallel" | "bisector" | "bisector_out" | "symmedian" | "altitude" | "euler" | "tangent_at" | "tangent_from";

export interface DefinedLineDef {
  type: "DefinedLine";
  mode: LineDefinitionMode;
  points: string[];
  through?: string;
  factor: number;
  normed: boolean;
  results: string[];
}

export interface DefinedLineInput {
  mode: LineDefinitionMode;
  points: string[];
  through?: string;
  factor?: number;
  normed?: boolean;
}

export type TriangleDefinitionMode = "two_angles" | "equilateral" | "half" | "isosceles_right" | "pythagore" | "pythagoras" | "egyptian" | "school" | "gold" | "euclid" | "golden" | "sublime" | "cheops";

export interface DefinedTriangleDef {
  type: "DefinedTriangle";
  mode: TriangleDefinitionMode;
  p1: string;
  p2: string;
  angle1?: number;
  angle2?: number;
  swap: boolean;
  name: string;
}

export interface DefinedTriangleInput {
  mode: TriangleDefinitionMode;
  p1: string;
  p2: string;
  angle1?: number;
  angle2?: number;
  swap?: boolean;
}

export type AssociatedTriangleMode = "orthic" | "centroid" | "medial" | "in" | "incentral" | "ex" | "excentral" | "extouch" | "intouch" | "contact" | "euler" | "symmedial" | "tangential" | "feuerbach";

export interface AssociatedTriangleDef {
  type: "AssociatedTriangle";
  mode: AssociatedTriangleMode;
  p1: string;
  p2: string;
  p3: string;
  namePrefix?: string;
  results: string[];
}

export interface AssociatedTriangleInput {
  mode: AssociatedTriangleMode;
  p1: string;
  p2: string;
  p3: string;
  namePrefix?: string;
}

export type PolygonConstructionMode = "permute" | "square" | "rectangle" | "parallelogram" | "golden_rectangle" | "regular_polygon";

export interface PolygonConstructionDef {
  type: "PolygonConstruction";
  mode: PolygonConstructionMode;
  points: string[];
  results: string[];
  regularMode?: "center" | "side";
  sides?: number;
  namePrefix?: string;
}

export interface PolygonConstructionInput {
  mode: PolygonConstructionMode;
  points: string[];
  regularMode?: "center" | "side";
  sides?: number;
  namePrefix?: string;
}

export type DefinedCircleMode = "R" | "diameter" | "circum" | "in" | "ex" | "euler" | "nine" | "spieker" | "apollonius" | "orthogonal_from" | "orthogonal_through";

export interface DefinedCircleDef {
  type: "DefinedCircle";
  mode: DefinedCircleMode;
  points: string[];
  references: string[];
  value?: number;
  results: string[];
  center: string;
  radiusPoint: string;
}

export interface DefinedCircleInput {
  mode: DefinedCircleMode;
  points: string[];
  references?: string[];
  value?: number;
}

export interface ProjectedExcentersDef {
  type: "ProjectedExcenters";
  p1: string;
  p2: string;
  p3: string;
  namePrefix: string;
  excenterSuffixes: string[];
  projectionPrefixes: string[];
  results: string[];
}

export interface ProjectedExcentersInput {
  p1: string;
  p2: string;
  p3: string;
  namePrefix: string;
  excenterSuffixes: string[];
  projectionPrefixes: string[];
  createExcenters?: boolean;
}

export type CircleTransformationMode = "translation" | "homothety" | "reflection" | "symmetry" | "projection" | "rotation" | "inversion";

export interface CircleTransformationDef {
  type: "CircleTransformation";
  mode: CircleTransformationMode;
  center: string;
  radiusPoint: string;
  references: string[];
  value?: string;
  results: string[];
}

export interface CircleTransformationInput {
  mode: CircleTransformationMode;
  center: string;
  radiusPoint: string;
  references: string[];
  value?: string;
}

export type LineCircleMode = "N" | "R" | "with_nodes";

export interface LineCircleIntersectionDef {
  type: "LineCircleIntersection";
  mode: LineCircleMode;
  line: string[];
  circle: string[];
  radius?: number;
  near: boolean;
  common?: string;
  results: string[];
}

export interface LineCircleIntersectionInput {
  mode: LineCircleMode;
  line: string[];
  circle: string[];
  radius?: number;
  near?: boolean;
  common?: string;
}

export interface LineCircleTestDef {
  type: "LineCircleTest";
  line: string[];
  circle: string[];
}

export type CircleCircleMode = "N" | "R" | "with_nodes";

export interface CircleCircleIntersectionDef {
  type: "CircleCircleIntersection";
  mode: CircleCircleMode;
  circles: [string[], string[]];
  radii?: [number, number];
  common?: string;
  results: string[];
}

export interface CircleCircleIntersectionInput {
  mode: CircleCircleMode;
  circles: [string[], string[]];
  radii?: [number, number];
  common?: string;
}

export interface CircleCircleTestDef {
  type: "CircleCircleTest";
  circles: [string[], string[]];
}

export interface LinearityTestDef {
  type: "LinearityTest";
  points: [string, string, string];
}

export interface OrthogonalityTestDef {
  type: "OrthogonalityTest";
  points: [string, string, string];
}

export type AngleCalculationMode = "angle" | "slope";

export interface AngleCalculationDef {
  type: "AngleCalculation";
  mode: AngleCalculationMode;
  points: string[];
  macro?: string;
}

export interface AngleRetrievalDef {
  type: "AngleRetrieval";
  macro: string;
}

export interface LengthCalculationDef {
  type: "LengthCalculation";
  p1: string;
  p2: string;
  macro?: string;
  options?: string;
}

export type UnitConversionMode = "pt_to_cm" | "cm_to_pt";

export interface UnitConversionDef {
  type: "UnitConversion";
  mode: UnitConversionMode;
  value: string;
  macro: string;
}

export interface DotProductDef {
  type: "DotProduct";
  p1: string;
  p2: string;
  p3: string;
  macro?: string;
}

export interface PowerCircleDef {
  type: "PowerCircle";
  point: string;
  center: string;
  radiusPoint: string;
  macro?: string;
}

export type RandomPointMode = "rectangle" | "segment" | "line" | "circle" | "circle_through" | "disk_through";

export interface RandomPointDef {
  type: "RandomPoint";
  mode: RandomPointMode;
  references: string[];
  radius?: number;
  name: string;
}

export interface RandomPointInput {
  mode: RandomPointMode;
  references: string[];
  radius?: number;
}

export type AstNode = PointDef | SegmentDef | LineDef | LinesDef | SegmentsDef | PolySegDef | CirclesDef | SemiCircleDef | SemiCirclesDef | PolygonDef | CircleDef | ArcDef | SectorDef | FillCircleDef | FillPolygonDef | FillSectorDef | FillAngleDef | FillAnglesDef | CanvasInitDef | CanvasClipDef | ShowBoundingBoxDef | StyleSetupDef | CustomStyleDef | CompassDef | CompassesDef | ShowLineDef | ShowTransformationDef | ProtractorDef | ClipBoundingBoxDef | PolygonClipDef | CircleClipDef | SectorClipDef | SegmentMarkDef | SegmentsMarkDef | ArcMarkDef | EllipseDef | PerpendicularLineDef | ProjectionLineDef | PerpendicularBisectorDef | AngleBisectorDef | TriangleAltitudeDef | AllAltitudesDef | TriangleCenterDef | AngleMarkDef | AnglesMarkDef | RightAngleMarkDef | RightAnglesMarkDef | PicAngleDef | PicRightAngleDef | LabelPointDef | LabelPointsDef | AutoLabelPointsDef | LabelSegmentDef | LabelSegmentsDef | LabelLineDef | LabelAngleDef | LabelAnglesDef | LabelCircleDef | LabelArcDef | IntersectionPointDef | MidPointDef | GoldenRatioPointDef | BarycentricPointDef | SimilitudeCenterDef | HarmonicPointDef | HarmonicPairDef | EquiPointsDef | MidArcPointDef | PointOnLineDef | PointOnCircleDef | PointTransformationDef | PointsTransformationDef | VectorPointDef | VectorCoordinatesDef | PointCoordinatesDef | SwapPointsDef | DuplicateSegmentDef | RadicalAxisDef | DefinedLineDef | DefinedTriangleDef | AssociatedTriangleDef | PolygonConstructionDef | DefinedCircleDef | ProjectedExcentersDef | CircleTransformationDef | LineCircleIntersectionDef | LineCircleTestDef | CircleCircleIntersectionDef | CircleCircleTestDef | LinearityTestDef | OrthogonalityTestDef | AngleCalculationDef | AngleRetrievalDef | LengthCalculationDef | UnitConversionDef | DotProductDef | PowerCircleDef | RandomPointDef;

export type ToolType = "cursor" | "pan" | "canvas_init" | "canvas_clip" | "show_bounding_box" | "clip_bounding_box" | "mark_segment" | "mark_segments" | "mark_arc" | "mark_angles" | "mark_right_angle" | "mark_right_angles" | "pic_angle" | "pic_right_angle" | "label_point" | "label_points" | "auto_label_points" | "label_segment" | "label_segments" | "label_line" | "label_angle" | "label_angles" | "label_circle" | "label_arc" | "add_compass" | "add_compasses" | "show_line_construction" | "show_transformation" | "add_protractor" | "add_duplicate_segment" | "add_radical_axis" | "get_point_coordinates" | "swap_points" | "dot_product" | "power_circle" | "is_linear" | "is_ortho" | "add_point" | "add_point_polar" | "add_midpoint" | "add_golden_ratio" | "add_barycentric" | "add_similitude_center" | "add_harmonic" | "add_equi_points" | "add_mid_arc" | "add_point_on_line" | "add_point_on_circle" | "add_random_point" | "add_point_transformation" | "add_points_transformation" | "add_circle_transformation" | "add_vector_point" | "get_vector_coordinates" | "find_angle" | "find_slope_angle" | "get_angle" | "calc_length" | "pt_to_cm" | "cm_to_pt" | "add_defined_line" | "add_defined_triangle" | "add_associated_triangle" | "add_projected_excenters" | "add_permute" | "add_square" | "add_rectangle" | "add_parallelogram" | "add_golden_rectangle" | "add_regular_polygon" | "add_defined_circle" | "add_line_circle_intersection" | "test_line_circle_intersection" | "add_circle_circle_intersection" | "test_circle_circle_intersection" | "add_triangle_center" | "add_segment" | "add_segments" | "add_polyseg" | "add_line" | "add_lines" | "add_circle" | "add_circles" | "add_semicircle" | "add_semicircles" | "add_ellipse" | "add_arc" | "add_sector" | "fill_circle" | "fill_polygon" | "fill_sector" | "fill_angle" | "fill_angles" | "add_perpendicular" | "add_projection" | "add_perpendicular_bisector" | "add_angle_bisector" | "add_altitude" | "add_all_altitudes" | "add_polygon" | "add_angle" | "add_intersection";
export type PreviewMode = "instant" | "latex";
export type LatexCompiler = "lualatex" | "pdflatex" | "xelatex";
export type LatexEnginePaths = Record<LatexCompiler, string>;
export type AutoLabelShape = "segments" | "lines" | "angles" | "circles" | "arcs";
export type AutoLabelShapes = Record<AutoLabelShape, boolean>;

export const DEFAULT_AUTO_LABEL_SHAPES: AutoLabelShapes = {
  segments: false,
  lines: false,
  angles: true,
  circles: false,
  arcs: false,
};

export interface AppSettings {
  theme: AppTheme;
  language: AppLanguage;
  defaultZoom: number;
  editorWidthRatio: number;
  showEditorMinimap: boolean;
  editorFontSize: number;
  editorWordWrap: boolean;
  editorLineNumbers: boolean;
  autoSaveDraft: boolean;
  previewMode: PreviewMode;
  latexCompiler: LatexCompiler;
  latexEnginePaths: LatexEnginePaths;
  showGrid: boolean;
  showAxes: boolean;
  showAxisTicks: boolean;
  showAxisLabels: boolean;
  axisLineWidth: number;
  axisTickSize: number;
  axisLabelFontSize: number;
  axisLabelSpacing: number;
  showMeasurements: boolean;
  snapToGrid: boolean;
  canvasGridStep: number;
  snapStep: number;
  exportSvgFilename: string;
}

const DEFAULT_LATEX_ENGINE_PATHS: LatexEnginePaths = {
  lualatex: '',
  pdflatex: '',
  xelatex: '',
};
const DEFAULT_EXPORT_SVG_FILENAME = 'stoicheia.svg';

export const SETTINGS_STORAGE_KEY = 'stoicheia-settings';
export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'en',
  defaultZoom: 1.75,
  editorWidthRatio: 0.45,
  showEditorMinimap: false,
  editorFontSize: 13,
  editorWordWrap: true,
  editorLineNumbers: true,
  autoSaveDraft: true,
  previewMode: 'instant',
  latexCompiler: 'lualatex',
  latexEnginePaths: { ...DEFAULT_LATEX_ENGINE_PATHS },
  showGrid: true,
  showAxes: true,
  showAxisTicks: true,
  showAxisLabels: true,
  axisLineWidth: 1.25,
  axisTickSize: 5,
  axisLabelFontSize: 13,
  axisLabelSpacing: 56,
  showMeasurements: true,
  snapToGrid: true,
  canvasGridStep: 1,
  snapStep: 1,
  exportSvgFilename: DEFAULT_EXPORT_SVG_FILENAME,
};

const clampSetting = (value: unknown, fallback: number, min: number, max: number): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.min(Math.max(numeric, min), max) : fallback;
};

const normalizeLatexEnginePaths = (paths: Partial<LatexEnginePaths> = {}): LatexEnginePaths => ({
  lualatex: typeof paths.lualatex === 'string' ? paths.lualatex : DEFAULT_LATEX_ENGINE_PATHS.lualatex,
  pdflatex: typeof paths.pdflatex === 'string' ? paths.pdflatex : DEFAULT_LATEX_ENGINE_PATHS.pdflatex,
  xelatex: typeof paths.xelatex === 'string' ? paths.xelatex : DEFAULT_LATEX_ENGINE_PATHS.xelatex,
});

const normalizeAppSettings = (settings: Partial<AppSettings> = {}, themeFallback: AppTheme = getInitialTheme()): AppSettings => ({
  theme: settings.theme === 'light' || settings.theme === 'dark' ? settings.theme : themeFallback,
  language: normalizeLanguage(settings.language),
  defaultZoom: clampSetting(settings.defaultZoom, DEFAULT_APP_SETTINGS.defaultZoom, 0.1, 5),
  editorWidthRatio: clampSetting(settings.editorWidthRatio, DEFAULT_APP_SETTINGS.editorWidthRatio, 0.3, 0.75),
  showEditorMinimap: typeof settings.showEditorMinimap === 'boolean' ? settings.showEditorMinimap : DEFAULT_APP_SETTINGS.showEditorMinimap,
  editorFontSize: clampSetting(settings.editorFontSize, DEFAULT_APP_SETTINGS.editorFontSize, 10, 22),
  editorWordWrap: typeof settings.editorWordWrap === 'boolean' ? settings.editorWordWrap : DEFAULT_APP_SETTINGS.editorWordWrap,
  editorLineNumbers: typeof settings.editorLineNumbers === 'boolean' ? settings.editorLineNumbers : DEFAULT_APP_SETTINGS.editorLineNumbers,
  autoSaveDraft: typeof settings.autoSaveDraft === 'boolean' ? settings.autoSaveDraft : DEFAULT_APP_SETTINGS.autoSaveDraft,
  previewMode: settings.previewMode === 'latex' || settings.previewMode === 'instant' ? settings.previewMode : DEFAULT_APP_SETTINGS.previewMode,
  latexCompiler: settings.latexCompiler === 'lualatex' || settings.latexCompiler === 'pdflatex' || settings.latexCompiler === 'xelatex' ? settings.latexCompiler : DEFAULT_APP_SETTINGS.latexCompiler,
  latexEnginePaths: normalizeLatexEnginePaths(settings.latexEnginePaths),
  showGrid: typeof settings.showGrid === 'boolean' ? settings.showGrid : DEFAULT_APP_SETTINGS.showGrid,
  showAxes: typeof settings.showAxes === 'boolean' ? settings.showAxes : DEFAULT_APP_SETTINGS.showAxes,
  showAxisTicks: typeof settings.showAxisTicks === 'boolean' ? settings.showAxisTicks : DEFAULT_APP_SETTINGS.showAxisTicks,
  showAxisLabels: typeof settings.showAxisLabels === 'boolean' ? settings.showAxisLabels : DEFAULT_APP_SETTINGS.showAxisLabels,
  axisLineWidth: clampSetting(settings.axisLineWidth, DEFAULT_APP_SETTINGS.axisLineWidth, 0.5, 4),
  axisTickSize: clampSetting(settings.axisTickSize, DEFAULT_APP_SETTINGS.axisTickSize, 2, 12),
  axisLabelFontSize: clampSetting(settings.axisLabelFontSize, DEFAULT_APP_SETTINGS.axisLabelFontSize, 9, 24),
  axisLabelSpacing: clampSetting(settings.axisLabelSpacing, DEFAULT_APP_SETTINGS.axisLabelSpacing, 32, 160),
  showMeasurements: typeof settings.showMeasurements === 'boolean' ? settings.showMeasurements : DEFAULT_APP_SETTINGS.showMeasurements,
  snapToGrid: typeof settings.snapToGrid === 'boolean' ? settings.snapToGrid : DEFAULT_APP_SETTINGS.snapToGrid,
  canvasGridStep: clampSetting(settings.canvasGridStep, DEFAULT_APP_SETTINGS.canvasGridStep, 0.25, 5),
  snapStep: clampSetting(settings.snapStep, DEFAULT_APP_SETTINGS.snapStep, 0.25, 5),
  exportSvgFilename: typeof settings.exportSvgFilename === 'string' ? settings.exportSvgFilename : DEFAULT_APP_SETTINGS.exportSvgFilename,
});

const loadAppSettings = (): AppSettings => {
  const fallback = getInitialTheme();
  if (typeof window === 'undefined') return normalizeAppSettings(undefined, fallback);
  try {
    const saved = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    return normalizeAppSettings(saved ? JSON.parse(saved) as Partial<AppSettings> : undefined, fallback);
  } catch {
    return normalizeAppSettings(undefined, fallback);
  }
};

const persistAppSettings = (settings: AppSettings) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Settings still work for the current session when storage is unavailable.
  }
};


export interface ResolvedViewport {
  viewBox: string;
}

export interface GeometryDiagnostic {
  severity: 'warning' | 'error';
  message: string;
  nodeIndex: number;
  nodeType: string;
  targets?: string[];
}

export interface PerformanceMetrics {
  parseMs?: number;
  geometryMs?: number;
  viewportMs?: number;
  rustTotalMs?: number;
  parseRoundTripMs?: number;
  compileRoundTripMs?: number;
  viewportBuildMs?: number;
  rendererMs?: number;
  nodeCount?: number;
  resolvedPointCount?: number;
  geometryComplete?: boolean;
  updatedAt?: number;
}

interface EditorState {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  showEditorMinimap: boolean;
  setShowEditorMinimap: (show: boolean) => void;
  documentFilename: string;
  setDocumentFilename: (filename: string) => void;
  source: string;
  sourceHistory: string[];
  sourceRedoStack: string[];
  setSource: (source: string) => void;
  undoSource: () => void;
  redoSource: () => void;
  svgOutput: string | null;
  setSvgOutput: (svg: string | null) => void;
  previewMode: PreviewMode;
  setPreviewMode: (mode: PreviewMode) => void;
  compiledSource: string | null;
  setCompiledSource: (source: string | null) => void;
  isCompiling: boolean;
  setIsCompiling: (compiling: boolean) => void;
  errorLog: string | null;
  setErrorLog: (error: string | null) => void;
  autosaveError: string | null;
  setAutosaveError: (error: string | null) => void;
  parsedNodes: AstNode[];
  setParsedNodes: (nodes: AstNode[]) => void;
  parsedSource: string;
  resolvedPoints: Record<string, { x: number; y: number }> | null;
  resolvedViewport: ResolvedViewport | null;
  geometryDiagnostics: GeometryDiagnostic[];
  setParsedDocument: (nodes: AstNode[], resolvedPoints: Record<string, { x: number; y: number }> | null, resolvedViewport?: ResolvedViewport | null, parsedSource?: string, geometryDiagnostics?: GeometryDiagnostic[]) => void;
  performanceMetrics: PerformanceMetrics | null;
  setPerformanceMetrics: (metrics: Partial<PerformanceMetrics>) => void;
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  selectedPoints: string[];
  setSelectedPoints: (pts: string[]) => void;
  hoveredNode: string | null;
  setHoveredNode: (nodeId: string | null) => void;
  selectedNode: string | null;
  setSelectedNode: (nodeId: string | null) => void;
  showHandles: boolean;
  setShowHandles: (show: boolean) => void;
  zoomLevel: number;
  setZoomLevel: (zoom: number | ((z: number) => number)) => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  showAxes: boolean;
  setShowAxes: (show: boolean) => void;
  showMeasurements: boolean;
  setShowMeasurements: (show: boolean) => void;
  snapToGrid: boolean;
  setSnapToGrid: (snap: boolean) => void;
  autoLabelShapes: AutoLabelShapes;
  setAutoLabelShape: (shape: AutoLabelShape, enabled: boolean) => void;
  pan: { x: number, y: number };
  setPan: (pan: { x: number, y: number } | ((p: { x: number, y: number }) => { x: number, y: number })) => void;
  setCanvasView: (view: { zoomLevel: number; pan: { x: number; y: number } }) => void;
  fitViewRequest: number;
  requestFitView: () => void;
  insertTikzCommand: (cmd: string) => void;
  upsertStyleSetup: (kind: GlobalStyleKind, options: string, enabled?: boolean) => void;
  toggleStyleSetup: (kind: GlobalStyleKind, enabled: boolean) => void;
  removeStyleSetup: (kind: GlobalStyleKind) => void;
  upsertCustomStyle: (name: string, options: string, enabled?: boolean) => boolean;
  toggleCustomStyle: (name: string, enabled: boolean) => void;
  removeCustomStyle: (name: string) => void;
  addPoint: (x: number, y: number) => string;
  addPolarPoint: (angle: number, distance: number) => string;
  addMidPoint: (p1: string, p2: string) => string;
  addGoldenRatioPoint: (p1: string, p2: string) => string;
  addBarycentricPoint: (terms: { point: string; weight: number }[]) => string | null;
  addSimilitudeCenter: (kind: "ext" | "int", center1: string, radius1: string, center2: string, radius2: string) => string;
  addHarmonicPoint: (mode: "ext" | "int", p1: string, p2: string, known: string) => string;
  addHarmonicPair: (p1: string, p2: string, ratio: number) => [string, string] | null;
  addEquiPoints: (p1: string, p2: string, from: string, distance: number, show: boolean) => [string, string] | null;
  addMidArcPoint: (center: string, start: string, end: string) => string;
  addPointOnLine: (p1: string, p2: string, position: number) => string | null;
  addPointOnCircle: (mode: "through" | "R", center: string, angle: number, value: string | number) => string | null;
  addPointTransformation: (input: PointTransformationInput) => string | null;
  addPointsTransformation: (input: PointsTransformationInput) => string[] | null;
  addVectorPoint: (input: VectorPointInput) => string | null;
  addVectorCoordinates: (p1: string, p2: string, macro: string) => boolean;
  addPointCoordinates: (point: string, macro: string) => boolean;
  addSwapPoints: (p1: string, p2: string) => boolean;
  addDuplicateSegment: (input: DuplicateSegmentInput) => string | null;
  addRadicalAxis: (input: RadicalAxisInput) => string[] | null;
  addDefinedLine: (input: DefinedLineInput) => string[] | null;
  addDefinedTriangle: (input: DefinedTriangleInput) => string | null;
  addAssociatedTriangle: (input: AssociatedTriangleInput) => string[] | null;
  addPolygonConstruction: (input: PolygonConstructionInput) => string[] | null;
  addDefinedCircle: (input: DefinedCircleInput) => string[] | null;
  addProjectedExcenters: (input: ProjectedExcentersInput) => string[] | null;
  addCircleTransformation: (input: CircleTransformationInput) => string[] | null;
  addLineCircleIntersection: (input: LineCircleIntersectionInput) => string[] | null;
  addLineCircleTest: (line: string[], circle: string[]) => boolean;
  addCircleCircleIntersection: (input: CircleCircleIntersectionInput) => string[] | null;
  addCircleCircleTest: (circles: [string[], string[]]) => boolean;
  addLinearityTest: (points: [string, string, string]) => boolean;
  addOrthogonalityTest: (points: [string, string, string]) => boolean;
  addAngleCalculation: (mode: AngleCalculationMode, points: string[], macro?: string) => boolean;
  addAngleRetrieval: (macro: string) => boolean;
  addLengthCalculation: (p1: string, p2: string, macro: string, options?: string) => boolean;
  addUnitConversion: (mode: UnitConversionMode, value: string, macro: string) => boolean;
  addDotProduct: (p1: string, p2: string, p3: string, macro?: string) => boolean;
  addPowerCircle: (point: string, center: string, radiusPoint: string, macro?: string) => boolean;
  addRandomPoint: (input: RandomPointInput) => string | null;
  addSegment: (p1: string, p2: string, options?: string) => void;
  addSegments: (pairs: [string, string][], options?: string) => boolean;
  addLine: (p1: string, p2: string, options?: string) => void;
  addLines: (pairs: [string, string][], options?: string) => boolean;
  addPolySeg: (points: string[], options?: string) => boolean;
  addPolygon: (pts: string[]) => void;
  addCircle: (center: string, radiusPt: string) => void;
  addCircles: (pairs: [string, string][], options?: string) => boolean;
  addSemiCircle: (center: string, radiusPt: string, options?: string) => void;
  addSemiCircles: (pairs: [string, string][], options?: string) => boolean;
  addEllipse: (center: string, xRadius: number, yRadius: number, angle: number, options?: string) => boolean;
  addArc: (center: string, startPt: string, endPt: string) => void;
  addSector: (center: string, startPt: string, endPt: string) => void;
  fillCircle: (center: string, radiusPt: string, options?: string) => void;
  fillPolygon: (points: string[], options?: string) => boolean;
  fillSector: (center: string, startPt: string, endPt: string, options?: string) => void;
  fillAngle: (p1: string, vertex: string, p2: string, options?: string) => void;
  fillAngles: (angles: [string, string, string][], options?: string) => boolean;
  addCanvasInit: (options?: string) => void;
  addCanvasClip: (space?: number) => void;
  addShowBoundingBox: (options?: string) => void;
  addCompass: (center: string, through: string, options?: string) => void;
  addCompasses: (pairs: [string, string][], options?: string) => boolean;
  addShowLine: (input: ShowLineInput) => boolean;
  addShowTransformation: (input: ShowTransformationInput) => boolean;
  addProtractor: (origin: string, direction: string, options?: string) => boolean;
  addClipBoundingBox: () => void;
  addSegmentMark: (p1: string, p2: string, options?: string) => void;
  addSegmentsMark: (pairs: [string, string][], options?: string) => boolean;
  addArcMark: (center: string, start: string, end: string, options?: string) => void;
  addAnglesMark: (angles: [string, string, string][], options?: string) => boolean;
  addRightAngleMark: (p1: string, vertex: string, p2: string, options?: string) => void;
  addRightAnglesMark: (angles: [string, string, string][], options?: string) => boolean;
  addPicAngle: (p1: string, vertex: string, p2: string, options?: string) => void;
  addPicRightAngle: (p1: string, vertex: string, p2: string, options?: string) => void;
  addPointLabel: (point: string, text?: string, options?: string) => void;
  addPointLabels: (points: string[], options?: string) => boolean;
  addAutoPointLabels: (center: string, points: string[], distance?: number, options?: string) => boolean;
  addSegmentLabel: (p1: string, p2: string, text?: string, options?: string) => void;
  addSegmentLabels: (pairs: [string, string][], text?: string, options?: string) => boolean;
  addLineLabel: (p1: string, p2: string, text?: string, options?: string) => void;
  addAngleLabel: (p1: string, vertex: string, p2: string, text?: string, options?: string) => void;
  addAngleLabels: (angles: [string, string, string][], text?: string, options?: string) => boolean;
  addCircleLabel: (center: string, radiusPoint: string, angle?: number, text?: string, options?: string) => void;
  addArcLabel: (center: string, start: string, end: string, text?: string, options?: string) => void;
  addPerpendicularLine: (p1: string, p2: string, through: string) => void;
  addProjectionLine: (p1: string, p2: string, from: string) => void;
  addPerpendicularBisector: (p1: string, p2: string) => void;
  addAngleBisector: (p1: string, vertex: string, p2: string) => void;
  addTriangleAltitude: (side1: string, vertex: string, side2: string) => void;
  addAllAltitudes: (p1: string, p2: string, p3: string) => void;
  addTriangleCenter: (option: TriangleCenterOption, p1: string, p2: string, p3: string) => string;
  addAngle: (p1: string, vertex: string, p2: string) => void;
  addIntersection: (p1: string, p2: string, p3: string, p4: string) => void;
  updatePointCoords: (name: string, x: number, y: number) => void;
}

const DEFAULT_SOURCE = `\\documentclass{article}
\\usepackage{tikz,amsmath}
\\usepackage{tkz-euclide}
\\pagestyle{empty}
\\begin{document}
\\begin{tikzpicture}
  \\tkzDefPoint(0,0){A}
  \\tkzDefPoint(4,0){B}
  \\tkzDefPoint(2,3){C}
  \\tkzDrawPolygon(A,B,C)
  \\tkzDrawPoints(A,B,C)
  \\tkzLabelPoint(A){A}
  \\tkzLabelPoint(B){B}
  \\tkzLabelPoint[above](C){C}
\\end{tikzpicture}
\\end{document}`;

const SOURCE_HISTORY_LIMIT = 100;

const recordSourceChange = (state: Pick<EditorState, 'source' | 'sourceHistory'>, source: string) => {
  if (source === state.source) return { source: state.source };
  return {
    source,
    sourceHistory: [...state.sourceHistory, state.source].slice(-SOURCE_HISTORY_LIMIT),
    sourceRedoStack: [],
  };
};

const getNextPointName = (parsedNodes: AstNode[], source: string): string => {
  const existingNames = new Set(parsedNodes
    .filter((node): node is PointDef => node.type === 'Point')
    .map(node => node.name));

  // Include both coordinate-defined and construction-generated points. This
  // also keeps names unique before the asynchronous parser catches up.
  for (const match of source.matchAll(/\\tkzDefPoint\s*\([^)]*\)\s*\{([^}]+)\}/g)) {
    existingNames.add(match[1]);
  }
  for (const match of source.matchAll(/\\tkzGet(?:First|Second)?Point\s*\{([^}]+)\}/g)) {
    existingNames.add(match[1]);
  }
  for (const match of source.matchAll(/\\tkzGetPoints\s*\{([^}]+)\}\s*\{([^}]+)\}/g)) {
    existingNames.add(match[1]);
    existingNames.add(match[2]);
  }
  for (const match of source.matchAll(/\\tkzDefPointsBy(?:\[[^\]]*\])?\s*\([^)]*\)\s*\{([^}]*)\}/g)) {
    match[1].split(',').map(name => name.trim()).filter(Boolean).forEach(name => existingNames.add(name));
  }
  for (const match of source.matchAll(/\\tkzDefSpcTriangle(?:\[([^\]]*)\])?\s*\([^)]*\)\s*\{([^}]*)\}/g)) {
    const prefix = match[1]?.split(',').map(option => option.trim()).find(option => option.startsWith('name='))?.slice(5).trim() ?? '';
    match[2].split(',').map(name => name.trim()).filter(Boolean).forEach(name => existingNames.add(`${prefix}${name}`));
  }
  for (const match of source.matchAll(/\\tkzDefRegPolygon(?:\[([^\]]*)\])?\s*\([^)]*\)/g)) {
    const options = match[1]?.split(',').map(option => option.trim()) ?? [];
    const prefix = options.find(option => option.startsWith('name='))?.slice(5).trim() || 'P';
    const sides = Number(options.find(option => option.startsWith('sides='))?.slice(6) || 5);
    if (Number.isInteger(sides) && sides >= 3) Array.from({ length: sides }, (_, index) => existingNames.add(`${prefix}${index + 1}`));
  }

  for (let i = 65; i <= 90; i++) {
    const name = String.fromCharCode(i);
    if (!existingNames.has(name)) return name;
  }

  let index = 1;
  while (existingNames.has(`P${index}`)) index++;
  return `P${index}`;
};

const labelPointCommand = (name: string) => `\\tkzLabelPoint(${name}){$${name}$}`;
const labelPointCommands = (names: string[]) => names.map(labelPointCommand).join('\n');

const initialSettings = loadAppSettings();

const buildPointTransformationOption = ({ mode, references, value }: Pick<PointTransformationInput, 'mode' | 'references' | 'value'>): string | null => {
  if (mode === 'translation' && references.length >= 2) return `translation=from ${references[0]} to ${references[1]}`;
  if (mode === 'homothety' && references[0] && value) return `homothety=center ${references[0]} ratio ${value}`;
  if (mode === 'reflection' && references.length >= 2) return `reflection=over ${references[0]}--${references[1]}`;
  if (mode === 'symmetry' && references[0]) return `symmetry=center ${references[0]}`;
  if (mode === 'projection' && references.length >= 2) return `projection=onto ${references[0]}--${references[1]}`;
  if (mode === 'rotation' && references[0] && value) return `rotation=center ${references[0]} angle ${value}`;
  if (mode === 'rotation_in_rad' && references[0] && value) return `rotation in rad=center ${references[0]} angle ${value}`;
  if (mode === 'rotation_with_nodes' && references.length >= 3) return `rotation with nodes=center ${references[0]} from ${references[1]} to ${references[2]}`;
  if (mode === 'inversion' && references.length >= 2) return `inversion=center ${references[0]} through ${references[1]}`;
  if (mode === 'inversion_negative' && references.length >= 2) return `inversion negative=center ${references[0]} through ${references[1]}`;
  return null;
};

export const useEditorStore = create<EditorState>((set) => ({
  settings: initialSettings,
  updateSettings: (updates) => set((state) => {
    const settings = normalizeAppSettings({ ...state.settings, ...updates }, state.theme);
    const latexCompileSettingsChanged = updates.latexCompiler !== undefined || updates.latexEnginePaths !== undefined;
    persistAppSettings(settings);
    return {
      settings,
      theme: settings.theme,
      showEditorMinimap: settings.showEditorMinimap,
      previewMode: settings.previewMode,
      showGrid: settings.showGrid,
      showAxes: settings.showAxes,
      showMeasurements: settings.showMeasurements,
      snapToGrid: settings.snapToGrid,
      compiledSource: latexCompileSettingsChanged ? null : state.compiledSource,
      zoomLevel: updates.defaultZoom === undefined ? state.zoomLevel : settings.defaultZoom,
    };
  }),
  resetSettings: () => set(() => {
    const settings = normalizeAppSettings(DEFAULT_APP_SETTINGS, getInitialTheme());
    persistAppSettings(settings);
    return {
      settings,
      theme: settings.theme,
      showEditorMinimap: settings.showEditorMinimap,
      previewMode: settings.previewMode,
      showGrid: settings.showGrid,
      showAxes: settings.showAxes,
      showMeasurements: settings.showMeasurements,
      snapToGrid: settings.snapToGrid,
      zoomLevel: settings.defaultZoom,
    };
  }),
  theme: initialSettings.theme,
  setTheme: (theme) => set((state) => {
    const settings = normalizeAppSettings({ ...state.settings, theme }, theme);
    persistAppSettings(settings);
    return { theme, settings };
  }),
  showEditorMinimap: initialSettings.showEditorMinimap,
  setShowEditorMinimap: (showEditorMinimap) => set((state) => {
    const settings = normalizeAppSettings({ ...state.settings, showEditorMinimap }, state.theme);
    persistAppSettings(settings);
    return { showEditorMinimap, settings };
  }),
  documentFilename: 'source.tex',
  setDocumentFilename: (documentFilename) => set({ documentFilename: documentFilename.trim() || 'source.tex' }),
  source: DEFAULT_SOURCE,
  sourceHistory: [],
  sourceRedoStack: [],
  setSource: (source) => set((state) => recordSourceChange(state, source)),
  undoSource: () => set((state) => {
    const previous = state.sourceHistory[state.sourceHistory.length - 1];
    if (previous === undefined) return {};
    return {
      source: previous,
      sourceHistory: state.sourceHistory.slice(0, -1),
      sourceRedoStack: [state.source, ...state.sourceRedoStack].slice(0, SOURCE_HISTORY_LIMIT),
    };
  }),
  redoSource: () => set((state) => {
    const next = state.sourceRedoStack[0];
    if (next === undefined) return {};
    return {
      source: next,
      sourceHistory: [...state.sourceHistory, state.source].slice(-SOURCE_HISTORY_LIMIT),
      sourceRedoStack: state.sourceRedoStack.slice(1),
    };
  }),
  svgOutput: null,
  setSvgOutput: (svgOutput) => set({ svgOutput }),
  previewMode: initialSettings.previewMode,
  setPreviewMode: (previewMode) => set((state) => {
    const settings = normalizeAppSettings({ ...state.settings, previewMode }, state.theme);
    persistAppSettings(settings);
    return { previewMode, settings };
  }),
  compiledSource: null,
  setCompiledSource: (compiledSource) => set({ compiledSource }),
  isCompiling: false,
  setIsCompiling: (isCompiling) => set({ isCompiling }),
  errorLog: null,
  setErrorLog: (errorLog) => set({ errorLog }),
  autosaveError: null,
  setAutosaveError: (autosaveError) => set({ autosaveError }),
  parsedNodes: [],
  setParsedNodes: (parsedNodes) => set(state => ({ parsedNodes, parsedSource: state.source, resolvedPoints: null, resolvedViewport: null, geometryDiagnostics: [] })),
  parsedSource: '',
  resolvedPoints: null,
  resolvedViewport: null,
  geometryDiagnostics: [],
  setParsedDocument: (parsedNodes, resolvedPoints, resolvedViewport = null, parsedSource, geometryDiagnostics = []) => set(state => ({
    parsedNodes,
    parsedSource: parsedSource ?? state.source,
    resolvedPoints,
    resolvedViewport,
    geometryDiagnostics,
  })),
  performanceMetrics: null,
  setPerformanceMetrics: (performanceMetrics) => set(state => ({
    performanceMetrics: {
      ...(state.performanceMetrics ?? {}),
      ...performanceMetrics,
      updatedAt: Date.now(),
    },
  })),
  activeTool: "cursor",
  setActiveTool: (activeTool) => set({ activeTool, selectedPoints: [] }),
  selectedPoints: [],
  setSelectedPoints: (selectedPoints) => set({ selectedPoints }),
  hoveredNode: null,
  setHoveredNode: (hoveredNode) => set({ hoveredNode }),
  selectedNode: null,
  setSelectedNode: (selectedNode) => set({ selectedNode }),
  showHandles: true,
  setShowHandles: (showHandles) => set({ showHandles }),
  zoomLevel: initialSettings.defaultZoom,
  setZoomLevel: (zoomLevel) => set((state) => ({ 
    zoomLevel: typeof zoomLevel === 'function' ? zoomLevel(state.zoomLevel) : zoomLevel 
  })),
  showGrid: initialSettings.showGrid,
  setShowGrid: (showGrid) => set((state) => {
    const settings = normalizeAppSettings({ ...state.settings, showGrid }, state.theme);
    persistAppSettings(settings);
    return { showGrid, settings };
  }),
  showAxes: initialSettings.showAxes,
  setShowAxes: (showAxes) => set((state) => {
    const settings = normalizeAppSettings({ ...state.settings, showAxes }, state.theme);
    persistAppSettings(settings);
    return { showAxes, settings };
  }),
  showMeasurements: initialSettings.showMeasurements,
  setShowMeasurements: (showMeasurements) => set((state) => {
    const settings = normalizeAppSettings({ ...state.settings, showMeasurements }, state.theme);
    persistAppSettings(settings);
    return { showMeasurements, settings };
  }),
  snapToGrid: initialSettings.snapToGrid,
  setSnapToGrid: (snapToGrid) => set((state) => {
    const settings = normalizeAppSettings({ ...state.settings, snapToGrid }, state.theme);
    persistAppSettings(settings);
    return { snapToGrid, settings };
  }),
  autoLabelShapes: DEFAULT_AUTO_LABEL_SHAPES,
  setAutoLabelShape: (shape, enabled) => set(state => ({
    autoLabelShapes: { ...state.autoLabelShapes, [shape]: enabled },
  })),
  pan: { x: 0, y: 0 },
  setPan: (pan) => set((state) => ({ 
    pan: typeof pan === 'function' ? pan(state.pan) : pan 
  })),
  setCanvasView: ({ zoomLevel, pan }) => set({ zoomLevel, pan }),
  fitViewRequest: 0,
  requestFitView: () => set(state => ({ fitViewRequest: state.fitViewRequest + 1 })),

  insertTikzCommand: (cmd: string) => {
    const { source } = useEditorStore.getState();
    const endTikzIndex = source.indexOf('\\end{tikzpicture}');
    if (endTikzIndex !== -1) {
      const newSource = source.slice(0, endTikzIndex) + cmd + '\n' + source.slice(endTikzIndex);
      set((state) => recordSourceChange(state, newSource));
    } else {
      const endDocIndex = source.indexOf('\\end{document}');
      if (endDocIndex !== -1) {
        const newSource = source.slice(0, endDocIndex) + cmd + '\n' + source.slice(endDocIndex);
        set((state) => recordSourceChange(state, newSource));
      } else {
        set((state) => recordSourceChange(state, source + '\n' + cmd + '\n'));
      }
    }
  },

  upsertStyleSetup: (kind, options, enabled) => set((state) => recordSourceChange(state, upsertGlobalStyleInSource(state.source, kind, options, enabled))),

  toggleStyleSetup: (kind, enabled) => set((state) => recordSourceChange(state, toggleGlobalStyleInSource(state.source, kind, enabled))),

  removeStyleSetup: (kind) => set((state) => recordSourceChange(state, removeGlobalStyleFromSource(state.source, kind))),

  upsertCustomStyle: (name, options, enabled) => {
    const cleanName = name.trim();
    if (!/^[A-Za-z][\w-]*$/.test(cleanName)) return false;
    set((state) => recordSourceChange(state, upsertCustomStyleInSource(state.source, cleanName, options, enabled)));
    return true;
  },

  toggleCustomStyle: (name, enabled) => set((state) => recordSourceChange(state, toggleCustomStyleInSource(state.source, name, enabled))),

  removeCustomStyle: (name) => set((state) => recordSourceChange(state, removeCustomStyleFromSource(state.source, name))),

  addPoint: (x: number, y: number): string => {
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const newName = getNextPointName(parsedNodes, source);

    insertTikzCommand(`\\tkzDefPoint(${x},${y}){${newName}}\n\\tkzDrawPoints(${newName})\n${labelPointCommand(newName)}`);
    return newName;
  },

  addPolarPoint: (angle: number, distance: number): string => {
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const newName = getNextPointName(parsedNodes, source);
    const cleanAngle = Math.round(angle * 100) / 100;
    const cleanDistance = Math.round(distance * 100) / 100;

    insertTikzCommand(`\\tkzDefPoint(${cleanAngle}:${cleanDistance}){${newName}}\n\\tkzDrawPoints(${newName})\n${labelPointCommand(newName)}`);
    return newName;
  },

  addMidPoint: (p1: string, p2: string): string => {
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const newName = getNextPointName(parsedNodes, source);
    insertTikzCommand(`\\tkzDefMidPoint(${p1},${p2})\n\\tkzGetPoint{${newName}}\n\\tkzDrawPoints(${newName})\n${labelPointCommand(newName)}`);
    return newName;
  },

  addGoldenRatioPoint: (p1: string, p2: string): string => {
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const newName = getNextPointName(parsedNodes, source);
    insertTikzCommand(`\\tkzDefGoldenRatio(${p1},${p2})\n\\tkzGetPoint{${newName}}\n\\tkzDrawPoints(${newName})\n${labelPointCommand(newName)}`);
    return newName;
  },

  addBarycentricPoint: (terms: { point: string; weight: number }[]): string | null => {
    const validTerms = terms.filter(term => term.point && Number.isFinite(term.weight));
    const totalWeight = validTerms.reduce((sum, term) => sum + term.weight, 0);
    if (validTerms.length < 2 || Math.abs(totalWeight) < 1e-12) return null;

    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const newName = getNextPointName(parsedNodes, source);
    const specification = validTerms.map(term => `${term.point}=${term.weight}`).join(',');
    insertTikzCommand(`\\tkzDefBarycentricPoint(${specification})\n\\tkzGetPoint{${newName}}\n\\tkzDrawPoints(${newName})\n${labelPointCommand(newName)}`);
    return newName;
  },

  addSimilitudeCenter: (kind, center1, radius1, center2, radius2) => {
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const name = getNextPointName(parsedNodes, source);
    insertTikzCommand(`\\tkzDefSimilitudeCenter[${kind}](${center1},${radius1})(${center2},${radius2})\n\\tkzGetPoint{${name}}\n\\tkzDrawPoints(${name})\n${labelPointCommand(name)}`);
    return name;
  },

  addHarmonicPoint: (mode, p1, p2, known) => {
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const name = getNextPointName(parsedNodes, source);
    insertTikzCommand(`\\tkzDefHarmonic[${mode}](${p1},${p2},${known})\n\\tkzGetPoint{${name}}\n\\tkzDrawPoints(${name})\n${labelPointCommand(name)}`);
    return name;
  },

  addHarmonicPair: (p1, p2, ratio) => {
    if (!Number.isFinite(ratio) || Math.abs(Math.abs(ratio) - 1) < 1e-12) return null;
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const name1 = getNextPointName(parsedNodes, source);
    const name2 = getNextPointName(parsedNodes, `${source}\n\\tkzGetPoint{${name1}}`);
    insertTikzCommand(`\\tkzDefHarmonic[both](${p1},${p2},${ratio})\n\\tkzGetPoints{${name1}}{${name2}}\n\\tkzDrawPoints(${name1},${name2})\n${labelPointCommands([name1, name2])}`);
    return [name1, name2];
  },

  addEquiPoints: (p1, p2, from, distance, show) => {
    if (!Number.isFinite(distance) || distance <= 0) return null;
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const name1 = getNextPointName(parsedNodes, source);
    const name2 = getNextPointName(parsedNodes, `${source}\n\\tkzGetPoint{${name1}}`);
    const options = `from=${from},dist=${distance}${show ? ',show' : ''}`;
    insertTikzCommand(`\\tkzDefEquiPoints[${options}](${p1},${p2})\n\\tkzGetPoints{${name1}}{${name2}}\n\\tkzDrawPoints(${name1},${name2})\n${labelPointCommands([name1, name2])}`);
    return [name1, name2];
  },

  addMidArcPoint: (center, start, end) => {
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const name = getNextPointName(parsedNodes, source);
    insertTikzCommand(`\\tkzDefMidArc(${center},${start},${end})\n\\tkzGetPoint{${name}}\n\\tkzDrawPoints(${name})\n${labelPointCommand(name)}`);
    return name;
  },

  addPointOnLine: (p1, p2, position) => {
    if (!Number.isFinite(position)) return null;
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const name = getNextPointName(parsedNodes, source);
    insertTikzCommand(`\\tkzDefPointOnLine[pos=${position}](${p1},${p2})\n\\tkzGetPoint{${name}}\n\\tkzDrawPoints(${name})\n${labelPointCommand(name)}`);
    return name;
  },

  addPointOnCircle: (mode, center, angle, value) => {
    if (!Number.isFinite(angle)) return null;
    if (mode === 'R' && (!Number.isFinite(Number(value)) || Number(value) <= 0)) return null;
    if (mode === 'through' && typeof value !== 'string') return null;
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const name = getNextPointName(parsedNodes, source);
    const definition = mode === 'through'
      ? `through=center ${center} angle ${angle} point ${value}`
      : `R=center ${center} angle ${angle} radius ${Number(value)}`;
    insertTikzCommand(`\\tkzDefPointOnCircle[${definition}]\n\\tkzGetPoint{${name}}\n\\tkzDrawPoints(${name})\n${labelPointCommand(name)}`);
    return name;
  },

  addRandomPoint: ({ mode, references, radius }) => {
    const expected = mode === 'circle' ? 1 : 2;
    if (references.length !== expected || references.some(point => !point)
      || (expected === 2 && references[0] === references[1])
      || (mode === 'circle' && (!Number.isFinite(radius) || radius! <= 0))) return null;
    const option = mode === 'rectangle' ? `rectangle=${references[0]} and ${references[1]}`
      : mode === 'segment' ? `segment=${references[0]}--${references[1]}`
        : mode === 'line' ? `line=${references[0]}--${references[1]}`
          : mode === 'circle' ? `circle=center ${references[0]} radius ${radius}`
            : mode === 'circle_through' ? `circle through=center ${references[0]} through ${references[1]}`
              : `disk through=center ${references[0]} through ${references[1]}`;
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const name = getNextPointName(parsedNodes, source);
    insertTikzCommand(`\\tkzDefRandPointOn[${option}]\n\\tkzGetPoint{${name}}\n\\tkzDrawPoints(${name})\n${labelPointCommand(name)}`);
    return name;
  },

  addPointTransformation: ({ mode, source: sourcePoint, references, value }) => {
    const option = buildPointTransformationOption({ mode, references, value });
    if (!sourcePoint || !option) return null;

    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const name = getNextPointName(parsedNodes, source);
    insertTikzCommand(`\\tkzDefPointBy[${option}](${sourcePoint})\n\\tkzGetPoint{${name}}\n\\tkzDrawPoints(${name})\n${labelPointCommand(name)}`);
    return name;
  },

  addPointsTransformation: ({ mode, sources, references, value, primeNames }) => {
    const uniqueSources = Array.from(new Set(sources.filter(Boolean)));
    const option = buildPointTransformationOption({ mode, references, value });
    if (uniqueSources.length === 0 || !option) return null;

    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    let reservedSource = source;
    const names = primeNames ? uniqueSources.map(name => `${name}'`) : uniqueSources.map(() => {
      const name = getNextPointName(parsedNodes, reservedSource);
      reservedSource += `\n\\tkzGetPoint{${name}}`;
      return name;
    });
    const imageList = primeNames ? '' : names.join(',');
    insertTikzCommand(`\\tkzDefPointsBy[${option}](${uniqueSources.join(',')}){${imageList}}\n\\tkzDrawPoints(${names.join(',')})\n${labelPointCommands(names)}`);
    return names;
  },

  addVectorPoint: ({ mode, p1, p2, anchor, factor }) => {
    if (!p1 || !p2 || p1 === p2 || !Number.isFinite(factor)) return null;
    const isColinear = mode === 'colinear' || mode === 'colinear_normed';
    if (isColinear && !anchor) return null;
    const optionName = mode.replace('_', ' ');
    const baseOption = isColinear ? `${optionName}=at ${anchor}` : optionName;
    const options = factor === 1 ? baseOption : `${baseOption},K=${factor}`;
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const name = getNextPointName(parsedNodes, source);
    insertTikzCommand(`\\tkzDefPointWith[${options}](${p1},${p2})\n\\tkzGetPoint{${name}}\n\\tkzDrawPoints(${name})\n${labelPointCommand(name)}`);
    return name;
  },

  addVectorCoordinates: (p1, p2, macro) => {
    const cleanMacro = macro.trim();
    if (!p1 || !p2 || p1 === p2 || !/^[A-Za-z]+$/.test(cleanMacro)) return false;
    useEditorStore.getState().insertTikzCommand(`\\tkzGetVectxy(${p1},${p2}){${cleanMacro}}`);
    return true;
  },

  addPointCoordinates: (point, macro) => {
    const cleanMacro = macro.trim();
    if (!point || !/^[A-Za-z]+$/.test(cleanMacro)) return false;
    useEditorStore.getState().insertTikzCommand(`\\tkzGetPointCoord(${point}){${cleanMacro}}`);
    return true;
  },

  addSwapPoints: (p1, p2) => {
    if (!p1 || !p2 || p1 === p2) return false;
    useEditorStore.getState().insertTikzCommand(`\\tkzSwapPoints(${p1},${p2})`);
    return true;
  },

  addDuplicateSegment: ({ rayStart, rayThrough, segmentStart, segmentEnd }) => {
    if (!rayStart || !rayThrough || !segmentStart || !segmentEnd || rayStart === rayThrough || segmentStart === segmentEnd) return null;
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const name = getNextPointName(parsedNodes, source);
    insertTikzCommand(`\\tkzDuplicateSegment(${rayStart},${rayThrough})(${segmentStart},${segmentEnd})\n\\tkzGetPoint{${name}}\n\\tkzDrawSegment(${rayStart},${name})\n\\tkzDrawPoints(${name})\n${labelPointCommand(name)}`);
    return name;
  },

  addRadicalAxis: ({ circle1, circle2 }) => {
    if (circle1.some(point => !point) || circle2.some(point => !point) || circle1[0] === circle1[1] || circle2[0] === circle2[1] || circle1[0] === circle2[0]) return null;
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const first = getNextPointName(parsedNodes, source);
    const second = getNextPointName(parsedNodes, `${source}\n\\tkzGetPoint{${first}}`);
    insertTikzCommand(`\\tkzDefRadicalAxis(${circle1.join(',')})(${circle2.join(',')})\n\\tkzGetPoints{${first}}{${second}}\n\\tkzDrawLine[add=1 and 1](${first},${second})\n\\tkzDrawPoints(${first},${second})\n${labelPointCommands([first, second])}`);
    return [first, second];
  },

  addAngleCalculation: (mode, points, macro) => {
    const expected = mode === 'angle' ? 3 : 2;
    const cleanMacro = macro?.trim();
    if (points.length !== expected || points.some(point => !point) || new Set(points).size !== expected
      || (cleanMacro !== undefined && !/^[A-Za-z]+$/.test(cleanMacro))) return false;
    const command = mode === 'angle' ? `\\tkzFindAngle(${points.join(',')})` : `\\tkzFindSlopeAngle(${points.join(',')})`;
    useEditorStore.getState().insertTikzCommand(`${command}${cleanMacro ? `\n\\tkzGetAngle{${cleanMacro}}` : ''}`);
    return true;
  },

  addAngleRetrieval: (macro) => {
    const cleanMacro = macro.trim();
    if (!/^[A-Za-z]+$/.test(cleanMacro)) return false;
    useEditorStore.getState().insertTikzCommand(`\\tkzGetAngle{${cleanMacro}}`);
    return true;
  },

  addLengthCalculation: (p1, p2, macro, options = '') => {
    const cleanMacro = macro.trim();
    if (!p1 || !p2 || p1 === p2 || !/^[A-Za-z]+$/.test(cleanMacro)) return false;
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzCalcLength${optionBlock}(${p1},${p2})\n\\tkzGetLength{${cleanMacro}}`);
    return true;
  },

  addUnitConversion: (mode, value, macro) => {
    const cleanValue = value.trim();
    const cleanMacro = macro.trim();
    if (!cleanValue || !/^[A-Za-z]+$/.test(cleanMacro)) return false;
    const command = mode === 'pt_to_cm' ? 'tkzpttocm' : 'tkzcmtopt';
    useEditorStore.getState().insertTikzCommand(`\\${command}(${cleanValue}){${cleanMacro}}`);
    return true;
  },

  addDotProduct: (p1, p2, p3, macro) => {
    const cleanMacro = macro?.trim();
    if (!p1 || !p2 || !p3 || p1 === p2 || p1 === p3
      || (cleanMacro !== undefined && !/^[A-Za-z]+$/.test(cleanMacro))) return false;
    useEditorStore.getState().insertTikzCommand(`\\tkzDotProduct(${p1},${p2},${p3})${cleanMacro ? `\n\\tkzGetResult{${cleanMacro}}` : ''}`);
    return true;
  },

  addPowerCircle: (point, center, radiusPoint, macro) => {
    const cleanMacro = macro?.trim();
    if (!point || !center || !radiusPoint || center === radiusPoint
      || (cleanMacro !== undefined && !/^[A-Za-z]+$/.test(cleanMacro))) return false;
    useEditorStore.getState().insertTikzCommand(`\\tkzPowerCircle(${point})(${center},${radiusPoint})${cleanMacro ? `\n\\tkzGetResult{${cleanMacro}}` : ''}`);
    return true;
  },

  addDefinedLine: ({ mode, points, through, factor = 1, normed = false }) => {
    const expectedPoints = mode === 'tangent_at' ? 1 : ['mediator', 'perpendicular', 'orthogonal', 'parallel', 'tangent_from'].includes(mode) ? 2 : 3;
    if (points.length !== expectedPoints || points.some(point => !point) || new Set(points).size !== points.length || !Number.isFinite(factor)) return null;
    if (['perpendicular', 'orthogonal', 'parallel', 'tangent_at', 'tangent_from'].includes(mode) && !through) return null;

    const optionName = mode.replace('_', ' ');
    let option = ['perpendicular', 'orthogonal', 'parallel'].includes(mode) ? `${optionName}=through ${through}`
      : mode === 'tangent_at' ? `tangent at=${through}`
        : mode === 'tangent_from' ? `tangent from=${through}`
          : optionName;
    if (factor !== 1) option += `,K=${factor}`;
    if (normed) option += ',normed';

    const outputCount = ['mediator', 'euler', 'tangent_from'].includes(mode) ? 2 : 1;
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    let reservedSource = source;
    const results = Array.from({ length: outputCount }, () => {
      const name = getNextPointName(parsedNodes, reservedSource);
      reservedSource += `\n\\tkzGetPoint{${name}}`;
      return name;
    });
    const getter = outputCount === 2 ? `\\tkzGetPoints{${results[0]}}{${results[1]}}` : `\\tkzGetPoint{${results[0]}}`;
    const draw = mode === 'tangent_from'
      ? `\\tkzDrawSegments(${through},${results[0]} ${through},${results[1]})`
      : outputCount === 2
        ? `\\tkzDrawLine(${results[0]},${results[1]})`
        : `\\tkzDrawLine(${['perpendicular', 'orthogonal', 'parallel', 'tangent_at'].includes(mode) ? through : points[1]},${results[0]})`;
    insertTikzCommand(`\\tkzDefLine[${option}](${points.join(',')})\n${getter}\n${draw}`);
    return results;
  },

  addDefinedTriangle: ({ mode, p1, p2, angle1, angle2, swap = false }) => {
    if (!p1 || !p2 || p1 === p2) return null;
    if (mode === 'two_angles' && (!Number.isFinite(angle1) || !Number.isFinite(angle2) || angle1! <= 0 || angle2! <= 0 || angle1! + angle2! >= 180)) return null;
    const option = mode === 'two_angles' ? `two angles=${angle1} and ${angle2}` : mode.replace('_', ' ');
    const options = swap ? `${option},swap` : option;
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const name = getNextPointName(parsedNodes, source);
    insertTikzCommand(`\\tkzDefTriangle[${options}](${p1},${p2})\n\\tkzGetPoint{${name}}\n\\tkzDrawPolygon(${p1},${p2},${name})\n\\tkzDrawPoints(${name})\n${labelPointCommand(name)}`);
    return name;
  },

  addAssociatedTriangle: ({ mode, p1, p2, p3, namePrefix }) => {
    if (!p1 || !p2 || !p3 || new Set([p1, p2, p3]).size !== 3) return null;
    const prefix = namePrefix?.trim() ?? '';
    if (prefix && !/^[A-Za-z][A-Za-z0-9]*$/.test(prefix)) return null;
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    let suffixes: string[];
    let results: string[];
    if (prefix) {
      suffixes = ['a', 'b', 'c'];
      results = suffixes.map(suffix => `${prefix}${suffix}`);
    } else {
      let reservedSource = source;
      results = Array.from({ length: 3 }, () => {
        const name = getNextPointName(parsedNodes, reservedSource);
        reservedSource += `\n\\tkzGetPoint{${name}}`;
        return name;
      });
      suffixes = results;
    }
    const options = prefix ? `${mode},name=${prefix}` : mode;
    insertTikzCommand(`\\tkzDefSpcTriangle[${options}](${p1},${p2},${p3}){${suffixes.join(',')}}\n\\tkzDrawPolygon(${results.join(',')})\n\\tkzDrawPoints(${results.join(',')})\n${labelPointCommands(results)}`);
    return results;
  },

  addPolygonConstruction: ({ mode, points, regularMode = 'center', sides = 5, namePrefix = 'P' }) => {
    const required = mode === 'permute' || mode === 'parallelogram' ? 3 : 2;
    if (points.length !== required || points.some(point => !point) || new Set(points).size !== required) return null;
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    if (mode === 'permute') {
      insertTikzCommand(`\\tkzPermute(${points.join(',')})\n\\tkzDrawPolygon(${points.join(',')})\n\\tkzDrawPoints(${points.join(',')})\n${labelPointCommands(points)}`);
      return [points[1], points[2]];
    }
    if (mode === 'regular_polygon') {
      const prefix = namePrefix.trim();
      if (!Number.isInteger(sides) || sides < 3 || sides > 100 || !/^[A-Za-z][A-Za-z0-9_]*$/.test(prefix)) return null;
      const results = Array.from({ length: sides }, (_, index) => `${prefix}${index + 1}`);
      insertTikzCommand(`\\tkzDefRegPolygon[${regularMode},sides=${sides},name=${prefix}](${points.join(',')})\n\\tkzDrawPolygon(${results.join(',')})\n\\tkzDrawPoints(${results.join(',')})\n${labelPointCommands(results)}`);
      return results;
    }
    let reservedSource = source;
    const resultCount = mode === 'parallelogram' ? 1 : 2;
    const results = Array.from({ length: resultCount }, () => {
      const name = getNextPointName(parsedNodes, reservedSource);
      reservedSource += `\n\\tkzGetPoint{${name}}`;
      return name;
    });
    const macro = mode === 'square' ? 'tkzDefSquare' : mode === 'rectangle' ? 'tkzDefRectangle' : mode === 'golden_rectangle' ? 'tkzDefGoldenRectangle' : 'tkzDefParallelogram';
    const getter = resultCount === 2 ? `\\tkzGetPoints{${results[0]}}{${results[1]}}` : `\\tkzGetPoint{${results[0]}}`;
    const polygon = mode === 'rectangle'
      ? [points[0], results[0], points[1], results[1]]
      : [...points, ...results];
    insertTikzCommand(`\\${macro}(${points.join(',')})\n${getter}\n\\tkzDrawPolygon(${polygon.join(',')})\n\\tkzDrawPoints(${results.join(',')})\n${labelPointCommands(results)}`);
    return results;
  },

  addDefinedCircle: ({ mode, points, references = [], value }) => {
    const pointCount = mode === 'R' ? 1 : ['diameter', 'apollonius', 'orthogonal_from', 'orthogonal_through'].includes(mode) ? 2 : 3;
    const referenceCount = mode === 'orthogonal_from' ? 1 : mode === 'orthogonal_through' ? 2 : 0;
    if (points.length !== pointCount || references.length !== referenceCount || [...points, ...references].some(point => !point)) return null;
    if (mode === 'R' && (!Number.isFinite(value) || value! <= 0)) return null;
    if (mode === 'apollonius' && (!Number.isFinite(value) || value! <= 0 || Math.abs(value! - 1) < 1e-12)) return null;
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    let reservedSource = source;
    const resultCount = mode === 'R' ? 1 : 2;
    const results = Array.from({ length: resultCount }, () => {
      const name = getNextPointName(parsedNodes, reservedSource);
      reservedSource += `\n\\tkzGetPoint{${name}}`;
      return name;
    });
    const option = mode === 'orthogonal_from' ? `orthogonal from=${references[0]}`
      : mode === 'orthogonal_through' ? `orthogonal through=${references[0]} and ${references[1]}`
        : mode === 'apollonius' ? `apollonius,K=${value}` : mode;
    const argumentsList = mode === 'R' ? `${points[0]},${value}` : points.join(',');
    const getter = resultCount === 1 ? `\\tkzGetPoint{${results[0]}}` : `\\tkzGetPoints{${results[0]}}{${results[1]}}`;
    const center = mode === 'R' ? points[0] : mode === 'orthogonal_from' ? references[0] : results[0];
    const radiusPoint = results[resultCount === 1 ? 0 : 1];
    insertTikzCommand(`\\tkzDefCircle[${option}](${argumentsList})\n${getter}\n\\tkzDrawCircle(${center},${radiusPoint})\n\\tkzDrawPoints(${results.join(',')})\n${labelPointCommands(results)}`);
    return results;
  },

  addProjectedExcenters: ({ p1, p2, p3, namePrefix, excenterSuffixes, projectionPrefixes, createExcenters = true }) => {
    const prefix = namePrefix.trim();
    const cleanSuffixes = excenterSuffixes.map(value => value.trim());
    const cleanProjections = projectionPrefixes.map(value => value.trim());
    if (new Set([p1, p2, p3]).size !== 3 || !/^[A-Za-z][A-Za-z0-9_]*$/.test(prefix)
      || cleanSuffixes.length !== 3 || cleanProjections.length !== 3
      || [...cleanSuffixes, ...cleanProjections].some(value => !/^[A-Za-z][A-Za-z0-9_]*$/.test(value))) return null;
    const results = cleanProjections.flatMap(projection => cleanSuffixes.map(suffix => `${projection}${suffix}`));
    const excenterCommand = createExcenters ? `\\tkzDefSpcTriangle[excentral,name=${prefix}](${p1},${p2},${p3}){${cleanSuffixes.join(',')}}\n` : '';
    const segments = cleanSuffixes.flatMap(suffix => cleanProjections.map(projection => `${prefix}${suffix},${projection}${suffix}`));
    useEditorStore.getState().insertTikzCommand(`${excenterCommand}\\tkzDefProjExcenter[name=${prefix}](${p1},${p2},${p3})(${cleanSuffixes.join(',')}){${cleanProjections.join(',')}}\n\\tkzDrawSegments(${segments.join(' ')})\n\\tkzDrawPoints(${results.join(',')})\n${labelPointCommands(results)}`);
    return results;
  },

  addCircleTransformation: ({ mode, center, radiusPoint, references, value }) => {
    const option = buildPointTransformationOption({ mode, references, value });
    if (!center || !radiusPoint || center === radiusPoint || !option) return null;
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const first = getNextPointName(parsedNodes, source);
    const second = getNextPointName(parsedNodes, `${source}\n\\tkzGetPoint{${first}}`);
    insertTikzCommand(`\\tkzDefCircleBy[${option}](${center},${radiusPoint})\n\\tkzGetPoints{${first}}{${second}}\n\\tkzDrawCircle(${first},${second})\n\\tkzDrawPoints(${first},${second})\n${labelPointCommands([first, second])}`);
    return [first, second];
  },

  addLineCircleIntersection: ({ mode, line, circle, radius, near = false, common }) => {
    const circleCount = mode === 'with_nodes' ? 3 : mode === 'N' ? 2 : 1;
    if (line.length !== 2 || new Set(line).size !== 2 || circle.length !== circleCount || circle.some(point => !point)) return null;
    if (mode === 'R' && (!Number.isFinite(radius) || radius! <= 0)) return null;
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const first = getNextPointName(parsedNodes, source);
    const second = getNextPointName(parsedNodes, `${source}\n\\tkzGetPoint{${first}}`);
    const options = [mode === 'R' ? 'R' : mode === 'with_nodes' ? 'with nodes' : '', common ? `common=${common}` : '', near ? 'near' : ''].filter(Boolean);
    const optionBlock = options.length ? `[${options.join(',')}]` : '';
    const circleArguments = mode === 'R' ? `${circle[0]},${radius}` : circle.join(',');
    insertTikzCommand(`\\tkzInterLC${optionBlock}(${line.join(',')})(${circleArguments})\n\\tkzGetPoints{${first}}{${second}}\n\\tkzDrawPoints(${first},${second})\n${labelPointCommands([first, second])}`);
    return [first, second];
  },

  addLineCircleTest: (line, circle) => {
    if (line.length !== 2 || circle.length !== 2 || new Set(line).size !== 2 || new Set(circle).size !== 2) return false;
    useEditorStore.getState().insertTikzCommand(`\\tkzTestInterLC(${line.join(',')})(${circle.join(',')})\n\\iftkzFlagLC\n  % The line intersects the circle.\n\\else\n  % The line does not intersect the circle.\n\\fi`);
    return true;
  },

  addCircleCircleIntersection: ({ mode, circles, radii, common }) => {
    const circleCount = mode === 'with_nodes' ? 3 : mode === 'N' ? 2 : 1;
    if (circles.some(circle => circle.length !== circleCount || circle.some(point => !point))) return null;
    if (circles[0][0] === circles[1][0]) return null;
    if (mode === 'R' && (!radii || radii.some(radius => !Number.isFinite(radius) || radius <= 0))) return null;
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const first = getNextPointName(parsedNodes, source);
    const second = getNextPointName(parsedNodes, `${source}\n\\tkzGetPoint{${first}}`);
    const options = [mode === 'R' ? 'R' : mode === 'with_nodes' ? 'with nodes' : '', common ? `common=${common}` : ''].filter(Boolean);
    const optionBlock = options.length ? `[${options.join(',')}]` : '';
    const args = mode === 'R'
      ? [`${circles[0][0]},${radii![0]}`, `${circles[1][0]},${radii![1]}`]
      : circles.map(circle => circle.join(','));
    insertTikzCommand(`\\tkzInterCC${optionBlock}(${args[0]})(${args[1]})\n\\tkzGetPoints{${first}}{${second}}\n\\tkzDrawPoints(${first},${second})\n${labelPointCommands([first, second])}`);
    return [first, second];
  },

  addCircleCircleTest: (circles) => {
    if (circles.some(circle => circle.length !== 2 || new Set(circle).size !== 2) || circles[0][0] === circles[1][0]) return false;
    useEditorStore.getState().insertTikzCommand(`\\tkzTestInterCC(${circles[0].join(',')})(${circles[1].join(',')})\n\\iftkzFlagCC\n  % The circles intersect.\n\\else\n  % The circles do not intersect.\n\\fi`);
    return true;
  },

  addLinearityTest: (points) => {
    if (points.some(point => !point) || new Set(points).size !== 3) return false;
    useEditorStore.getState().insertTikzCommand(`\\tkzIsLinear(${points.join(',')})\n\\iftkzLinear\n  % The points are aligned.\n\\else\n  % The points are not aligned.\n\\fi`);
    return true;
  },

  addOrthogonalityTest: (points) => {
    if (points.some(point => !point) || points[0] === points[1] || points[0] === points[2]) return false;
    useEditorStore.getState().insertTikzCommand(`\\tkzIsOrtho(${points.join(',')})\n\\iftkzOrtho\n  % The lines are orthogonal.\n\\else\n  % The lines are not orthogonal.\n\\fi`);
    return true;
  },

  addSegment: (p1: string, p2: string, options = '') => {
    const { autoLabelShapes, insertTikzCommand } = useEditorStore.getState();
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    const labelCommand = autoLabelShapes.segments ? `\n\\tkzLabelSegment[auto](${p1},${p2}){$${p1}${p2}$}` : '';
    insertTikzCommand(`\\tkzDrawSegment${optionBlock}(${p1},${p2})${labelCommand}`);
  },

  addSegments: (pairs, options = '') => {
    if (!pairs.length || pairs.some(([p1, p2]) => !p1 || !p2 || p1 === p2)) return false;
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzDrawSegments${optionBlock}(${pairs.map(pair => pair.join(',')).join(' ')})`);
    return true;
  },

  addLine: (p1, p2, options = '') => {
    const { autoLabelShapes, insertTikzCommand } = useEditorStore.getState();
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    const labelCommand = autoLabelShapes.lines ? `\n\\tkzLabelLine[pos=.5](${p1},${p2}){$(${p1}${p2})$}` : '';
    insertTikzCommand(`\\tkzDrawLine${optionBlock}(${p1},${p2})${labelCommand}`);
  },

  addLines: (pairs, options = '') => {
    if (!pairs.length || pairs.some(([p1, p2]) => !p1 || !p2 || p1 === p2)) return false;
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzDrawLines${optionBlock}(${pairs.map(pair => pair.join(',')).join(' ')})`);
    return true;
  },

  addPolySeg: (points, options = '') => {
    if (points.length < 2 || points.some(point => !point)) return false;
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzDrawPolySeg${optionBlock}(${points.join(',')})`);
    return true;
  },

  addPolygon: (pts: string[]) => {
    useEditorStore.getState().insertTikzCommand(`\\tkzDrawPolygon(${pts.join(',')})`);
  },

  addCircle: (center: string, radiusPt: string) => {
    const { autoLabelShapes, insertTikzCommand } = useEditorStore.getState();
    const labelCommand = autoLabelShapes.circles ? `\n\\tkzLabelCircle[above](${center},${radiusPt})(45){$\\mathcal{C}$}` : '';
    insertTikzCommand(`\\tkzDrawCircle(${center},${radiusPt})${labelCommand}`);
  },

  addCircles: (pairs, options = '') => {
    if (!pairs.length || pairs.some(([center, radiusPoint]) => !center || !radiusPoint || center === radiusPoint)) return false;
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzDrawCircles${optionBlock}(${pairs.map(pair => pair.join(',')).join(' ')})`);
    return true;
  },

  addSemiCircle: (center, radiusPt, options = '') => {
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzDrawSemiCircle${optionBlock}(${center},${radiusPt})`);
  },

  addSemiCircles: (pairs, options = '') => {
    if (!pairs.length || pairs.some(([center, radiusPoint]) => !center || !radiusPoint || center === radiusPoint)) return false;
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzDrawSemiCircles${optionBlock}(${pairs.map(pair => pair.join(',')).join(' ')})`);
    return true;
  },

  addEllipse: (center, xRadius, yRadius, angle, options = '') => {
    if (!center || !Number.isFinite(xRadius) || !Number.isFinite(yRadius) || xRadius <= 0 || yRadius <= 0 || !Number.isFinite(angle)) return false;
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzDrawEllipse${optionBlock}(${center},${xRadius},${yRadius},${angle})`);
    return true;
  },

  addArc: (center: string, startPt: string, endPt: string) => {
    const { autoLabelShapes, insertTikzCommand } = useEditorStore.getState();
    const labelCommand = autoLabelShapes.arcs ? `\n\\tkzLabelArc[pos=.5](${center},${startPt},${endPt}){$\\frown ${startPt}${endPt}$}` : '';
    insertTikzCommand(`\\tkzDrawArc(${center},${startPt})(${endPt})${labelCommand}`);
  },

  addSector: (center: string, startPt: string, endPt: string) => {
    useEditorStore.getState().insertTikzCommand(`\\tkzDrawSector(${center},${startPt})(${endPt})`);
  },

  fillCircle: (center, radiusPt, options = 'fill=blue!20') => {
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzFillCircle${optionBlock}(${center},${radiusPt})`);
  },

  fillPolygon: (points, options = 'fill=blue!20') => {
    if (points.length < 3 || points.some(point => !point)) return false;
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzFillPolygon${optionBlock}(${points.join(',')})`);
    return true;
  },

  fillSector: (center, startPt, endPt, options = 'fill=blue!20') => {
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzFillSector${optionBlock}(${center},${startPt})(${endPt})`);
  },

  fillAngle: (p1, vertex, p2, options = 'size=1, fill=blue!20') => {
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzFillAngle${optionBlock}(${p1},${vertex},${p2})`);
  },

  fillAngles: (angles, options = 'size=1, fill=blue!20') => {
    if (!angles.length || angles.some(angle => angle.length !== 3 || new Set(angle).size < 3)) return false;
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzFillAngles${optionBlock}(${angles.map(angle => angle.join(',')).join(' ')})`);
    return true;
  },

  addCanvasInit: (options = 'xmin=-5,xmax=5,ymin=-5,ymax=5') => {
    useEditorStore.getState().insertTikzCommand(`\\tkzInit${options.trim() ? `[${options.trim()}]` : ''}`);
  },

  addCanvasClip: (space = 0) => {
    useEditorStore.getState().insertTikzCommand(`\\tkzClip${space !== 0 ? `[space=${space}]` : ''}`);
  },

  addShowBoundingBox: (options = '') => {
    useEditorStore.getState().insertTikzCommand(`\\tkzShowBB${options.trim() ? `[${options.trim()}]` : ''}`);
  },

  addCompass: (center, through, options = 'delta=10') => {
    if (!center || !through || center === through) return;
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzCompass${optionBlock}(${center},${through})`);
  },

  addCompasses: (pairs, options = 'delta=10') => {
    if (!pairs.length || pairs.some(([center, through]) => !center || !through || center === through)) return false;
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzCompasss${optionBlock}(${pairs.map(pair => pair.join(',')).join(' ')})`);
    return true;
  },

  addShowLine: input => {
    const required = input.mode === 'bisector' ? 3 : 2;
    if (input.points.length !== required || input.points.some(point => !point) || new Set(input.points).size !== input.points.length) return false;
    if (['perpendicular', 'orthogonal', 'parallel'].includes(input.mode) && !input.through) return false;
    const modeOption = ['perpendicular', 'orthogonal', 'parallel'].includes(input.mode) ? `${input.mode}=through ${input.through}` : input.mode;
    const options = [modeOption];
    if (input.factor !== undefined && input.factor !== 1) options.push(`K=${input.factor}`);
    if (input.length !== undefined && input.length !== 1) options.push(`length=${input.length}`);
    if (input.ratio !== undefined && input.ratio !== .5) options.push(`ratio=${input.ratio}`);
    if (input.gap !== undefined && input.gap !== 2) options.push(`gap=${input.gap}`);
    if (input.size !== undefined && input.size !== 1) options.push(`size=${input.size}`);
    if (input.options?.trim()) options.push(...splitTikzOptions(input.options));
    useEditorStore.getState().insertTikzCommand(`\\tkzShowLine[${options.join(',')}](${input.points.join(',')})`);
    return true;
  },

  addShowTransformation: input => {
    const required = input.mode === 'symmetry' ? 1 : 2;
    if (!input.source || input.references.length !== required || input.references.some(point => !point)) return false;
    if (['translation', 'reflection', 'projection'].includes(input.mode) && input.references[0] === input.references[1]) return false;
    const modeOption = input.mode === 'translation' ? `translation=from ${input.references[0]} to ${input.references[1]}`
      : input.mode === 'reflection' ? `reflection=over ${input.references[0]}--${input.references[1]}`
        : input.mode === 'projection' ? `projection=onto ${input.references[0]}--${input.references[1]}`
          : `symmetry=center ${input.references[0]}`;
    const options = [modeOption];
    if (input.factor !== undefined && input.factor !== 1) options.push(`K=${input.factor}`);
    if (input.length !== undefined && input.length !== 1) options.push(`length=${input.length}`);
    if (input.ratio !== undefined && input.ratio !== .5) options.push(`ratio=${input.ratio}`);
    if (input.gap !== undefined && input.gap !== 2) options.push(`gap=${input.gap}`);
    if (input.size !== undefined && input.size !== 1) options.push(`size=${input.size}`);
    if (input.options?.trim()) options.push(...splitTikzOptions(input.options));
    useEditorStore.getState().insertTikzCommand(`\\tkzShowTransformation[${options.join(',')}](${input.source})`);
    return true;
  },

  addProtractor: (origin, direction, options = 'scale=1') => {
    if (!origin || !direction || origin === direction) return false;
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzProtractor${optionBlock}(${origin},${direction})`);
    return true;
  },

  addClipBoundingBox: () => {
    useEditorStore.getState().insertTikzCommand('\\tkzClipBB');
  },

  addSegmentMark: (p1, p2, options = 'mark=|,size=4pt,pos=.5') => {
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzMarkSegment${optionBlock}(${p1},${p2})`);
  },

  addSegmentsMark: (pairs, options = 'mark=|,size=4pt,pos=.5') => {
    if (!pairs.length || pairs.some(([p1, p2]) => !p1 || !p2 || p1 === p2)) return false;
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzMarkSegments${optionBlock}(${pairs.map(pair => pair.join(',')).join(' ')})`);
    return true;
  },

  addArcMark: (center, start, end, options = 'mark=|,size=4pt,pos=.5') => {
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzMarkArc${optionBlock}(${center},${start},${end})`);
  },

  addAnglesMark: (angles, options = 'size=1') => {
    if (!angles.length || angles.some(angle => angle.some(point => !point) || new Set(angle).size < 3)) return false;
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzMarkAngles${optionBlock}(${angles.map(angle => angle.join(',')).join(' ')})`);
    return true;
  },

  addRightAngleMark: (p1, vertex, p2, options = 'size=.25') => {
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzMarkRightAngle${optionBlock}(${p1},${vertex},${p2})`);
  },

  addRightAnglesMark: (angles, options = 'size=.25') => {
    if (!angles.length || angles.some(angle => angle.some(point => !point) || new Set(angle).size < 3)) return false;
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzMarkRightAngles${optionBlock}(${angles.map(angle => angle.join(',')).join(' ')})`);
    return true;
  },

  addPicAngle: (p1, vertex, p2, options = 'draw,angle radius=5mm') => {
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzPicAngle${optionBlock}(${p1},${vertex},${p2})`);
  },

  addPicRightAngle: (p1, vertex, p2, options = 'draw,angle radius=5mm') => {
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzPicRightAngle${optionBlock}(${p1},${vertex},${p2})`);
  },

  addPointLabel: (point, text = `$${point}$`, options = '') => {
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzLabelPoint${optionBlock}(${point}){${text}}`);
  },

  addPointLabels: (points, options = '') => {
    const unique = Array.from(new Set(points.filter(Boolean)));
    if (!unique.length) return false;
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzLabelPoints${optionBlock}(${unique.join(',')})`);
    return true;
  },

  addAutoPointLabels: (center, points, distance = 0.15, options = '') => {
    const unique = Array.from(new Set(points.filter(point => point && point !== center)));
    if (!center || !unique.length || !Number.isFinite(distance) || distance < 0) return false;
    const localOptions = [`center=${center}`, `dist=${distance}`, ...splitTikzOptions(options).filter(option => !option.startsWith('center=') && !option.startsWith('dist='))];
    useEditorStore.getState().insertTikzCommand(`\\tkzAutoLabelPoints[${localOptions.join(',')}](${unique.join(',')})`);
    return true;
  },

  addSegmentLabel: (p1, p2, text = `$${p1}${p2}$`, options = 'auto') => {
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzLabelSegment${optionBlock}(${p1},${p2}){${text}}`);
  },

  addSegmentLabels: (pairs, text = '$a$', options = 'auto') => {
    if (!pairs.length || pairs.some(([p1, p2]) => !p1 || !p2 || p1 === p2)) return false;
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzLabelSegments${optionBlock}(${pairs.map(pair => pair.join(',')).join(' ')}){${text}}`);
    return true;
  },

  addLineLabel: (p1, p2, text = `$(${p1}${p2})$`, options = 'pos=.5') => {
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzLabelLine${optionBlock}(${p1},${p2}){${text}}`);
  },

  addAngleLabel: (p1, vertex, p2, text = '$\\alpha$', options = 'pos=1') => {
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzLabelAngle${optionBlock}(${p1},${vertex},${p2}){${text}}`);
  },

  addAngleLabels: (angles, text = '$\\alpha$', options = 'pos=1') => {
    if (!angles.length || angles.some(angle => angle.some(point => !point) || new Set(angle).size < 3)) return false;
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzLabelAngles${optionBlock}(${angles.map(angle => angle.join(',')).join(' ')}){${text}}`);
    return true;
  },

  addCircleLabel: (center, radiusPoint, angle = 45, text = '$\\mathcal{C}$', options = 'above') => {
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzLabelCircle${optionBlock}(${center},${radiusPoint})(${angle}){${text}}`);
  },

  addArcLabel: (center, start, end, text = `$\\frown ${start}${end}$`, options = 'pos=.5') => {
    const optionBlock = options.trim() ? `[${options.trim()}]` : '';
    useEditorStore.getState().insertTikzCommand(`\\tkzLabelArc${optionBlock}(${center},${start},${end}){${text}}`);
  },

  addPerpendicularLine: (p1: string, p2: string, through: string) => {
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const helper = getNextPointName(parsedNodes, source);
    insertTikzCommand(`\\tkzDefLine[orthogonal=through ${through}](${p1},${p2})\n\\tkzGetPoint{${helper}}\n\\tkzDrawLine[add=2 and 2](${through},${helper})`);
  },

  addProjectionLine: (p1: string, p2: string, from: string) => {
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const foot = getNextPointName(parsedNodes, source);
    insertTikzCommand(`\\tkzDefPointBy[projection=onto ${p1}--${p2}](${from})\n\\tkzGetPoint{${foot}}\n\\tkzDrawLine[add=2 and 2](${from},${foot})\n\\tkzMarkRightAngle(${from},${foot},${p1})\n\\tkzDrawPoints(${foot})`);
  },

  addPerpendicularBisector: (p1: string, p2: string) => {
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const helper1 = getNextPointName(parsedNodes, source);
    const helper2 = getNextPointName(parsedNodes, `${source}\n\\tkzGetPoint{${helper1}}`);
    insertTikzCommand(`\\tkzDefLine[mediator](${p1},${p2})\n\\tkzGetPoints{${helper1}}{${helper2}}\n\\tkzDrawLine[add=.5 and .5](${helper1},${helper2})`);
  },

  addAngleBisector: (p1: string, vertex: string, p2: string) => {
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const helper = getNextPointName(parsedNodes, source);
    insertTikzCommand(`\\tkzDefLine[bisector](${p1},${vertex},${p2})\n\\tkzGetPoint{${helper}}\n\\tkzDrawLine[add=0 and 1](${vertex},${helper})`);
  },

  addTriangleAltitude: (side1: string, vertex: string, side2: string) => {
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const foot = getNextPointName(parsedNodes, source);
    insertTikzCommand(`\\tkzDefLine[altitude](${side1},${vertex},${side2})\n\\tkzGetPoint{${foot}}\n\\tkzDrawSegment(${vertex},${foot})\n\\tkzDrawPoints(${foot})\n\\tkzMarkRightAngle(${vertex},${foot},${side1})\n${labelPointCommand(foot)}`);
  },

  addAllAltitudes: (p1: string, p2: string, p3: string) => {
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    let reservedSource = source;
    const reservePointName = () => {
      const name = getNextPointName(parsedNodes, reservedSource);
      reservedSource += `\n\\tkzGetPoint{${name}}`;
      return name;
    };
    const foot1 = reservePointName();
    const foot2 = reservePointName();
    const foot3 = reservePointName();
    const orthocenter = reservePointName();

    insertTikzCommand(`\\tkzDefSpcTriangle[ortho](${p1},${p2},${p3}){${foot1},${foot2},${foot3}}\n\\tkzDefTriangleCenter[ortho](${p1},${p2},${p3})\n\\tkzGetPoint{${orthocenter}}\n\\tkzDrawSegments(${p1},${foot1} ${p2},${foot2} ${p3},${foot3})\n\\tkzDrawPoints(${foot1},${foot2},${foot3},${orthocenter})\n\\tkzMarkRightAngles(${p1},${foot1},${p3} ${p2},${foot2},${p1} ${p3},${foot3},${p1})\n${labelPointCommands([foot1, foot2, foot3, orthocenter])}`);
  },

  addTriangleCenter: (option, p1, p2, p3) => {
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const name = getNextPointName(parsedNodes, source);
    insertTikzCommand(`\\tkzDefTriangleCenter[${option}](${p1},${p2},${p3})\n\\tkzGetPoint{${name}}\n\\tkzDrawPoints(${name})\n${labelPointCommand(name)}`);
    return name;
  },

  addAngle: (p1: string, vertex: string, p2: string) => {
    // Generate an angle label (alpha, beta, gamma, delta, epsilon, zeta, eta, theta)
    const { autoLabelShapes, source, insertTikzCommand } = useEditorStore.getState();
    const existingAngles = source.match(/\\tkzMarkAngle/g)?.length ?? 0;
    const labels = ['\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\zeta', '\\eta', '\\theta'];
    const label = labels[existingAngles % labels.length];
    const labelCommand = autoLabelShapes.angles ? `\n\\tkzLabelAngle[pos=0.7](${p1},${vertex},${p2}){$${label}$}` : '';

    insertTikzCommand(`\\tkzMarkAngle[size=0.5](${p1},${vertex},${p2})${labelCommand}`);
  },

  addIntersection: (p1: string, p2: string, p3: string, p4: string) => {
    const { parsedNodes, source, insertTikzCommand } = useEditorStore.getState();
    const newName = getNextPointName(parsedNodes, source);
    insertTikzCommand(`\\tkzInterLL(${p1},${p2})(${p3},${p4})\n\\tkzGetPoint{${newName}}\n\\tkzDrawPoints(${newName})\n${labelPointCommand(newName)}`);
  },

  updatePointCoords: (name: string, x: number, y: number) => {
    const { source, parsedNodes, resolvedPoints } = useEditorStore.getState();
    const point = parsedNodes.find(node => node.type === 'Point' && node.name === name);
    const isPolar = point?.type === 'Point' && point.coordinate_mode === 'polar';
    const angle = Math.round((((Math.atan2(y, x) * 180 / Math.PI) % 360) + 360) % 360 * 100) / 100;
    const distance = Math.round(Math.hypot(x, y) * 100) / 100;
    const regex = isPolar
      ? new RegExp(`(\\\\tkzDefPoint\\()\\s*[\\d.\\-]+\\s*:\\s*[\\d.\\-]+\\s*(\\)\\s*\\{${name}\\})`, 'g')
      : new RegExp(`(\\\\tkzDefPoint\\()\\s*[\\d.\\-]+\\s*,\\s*[\\d.\\-]+\\s*(\\)\\s*\\{${name}\\})`, 'g');
    const coordinates = isPolar ? `${angle}:${distance}` : `${x},${y}`;
    const newSource = source.replace(regex, `$1${coordinates}$2`);
    if (newSource !== source) {
      set((state) => ({
        ...recordSourceChange(state, newSource),
        resolvedPoints: resolvedPoints ? { ...resolvedPoints, [name]: { x, y } } : resolvedPoints,
        parsedNodes: parsedNodes.map(node =>
          node.type === 'Point' && node.name === name
            ? { ...node, x, y, ...(isPolar ? { angle, distance } : {}) }
            : node
        ),
      }));
    }
  },
}))
