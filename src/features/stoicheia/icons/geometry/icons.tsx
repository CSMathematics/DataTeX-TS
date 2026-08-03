import { GeometryIcon, type GeometryIconProps } from './GeometryIcon';
import { arrow, helperLine, node, openNode, rightAngle, segment, smallCheck } from './primitives';

export function PointToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{helperLine(12, 5, 12, 19)}{helperLine(5, 12, 19, 12)}{node(12, 12, 2.2)}</GeometryIcon>;
}

export function PolarPointToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{node(6, 18)}{segment(6, 18, 18, 8)}{<path d="M 11 18 A 5 5 0 0 0 9.8 14.8" />}{node(18, 8)}{helperLine(6, 18, 18, 18)}</GeometryIcon>;
}

export function RandomPointToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 5 7 h 11 v 9 h -11 z" strokeDasharray="2.4 2.4" opacity={0.58} />}{<circle cx={16} cy={15} r={4} strokeDasharray="2.4 2.4" opacity={0.58} />}{node(11, 12)}{node(18, 15)}{node(8, 8, 1.2)}{node(15, 6, 1.2)}</GeometryIcon>;
}

export function SegmentToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(5, 16, 19, 8)}{node(5, 16)}{node(19, 8)}</GeometryIcon>;
}

export function SegmentsToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(4, 9, 12, 6)}{segment(8, 18, 20, 13)}{node(4, 9)}{node(12, 6)}{node(8, 18)}{node(20, 13)}</GeometryIcon>;
}

export function LineToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(3, 18, 21, 6)}{node(8, 14.7)}{node(16, 9.3)}</GeometryIcon>;
}

export function LinesToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(3, 17, 21, 9)}{segment(4, 8, 20, 16)}{node(8, 14.8)}{node(16, 11.2)}{node(8, 10)}{node(16, 14)}</GeometryIcon>;
}

export function PolysegToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 4 17 L 9 9 L 15 15 L 20 6" />}{node(4, 17)}{node(9, 9)}{node(15, 15)}{node(20, 6)}</GeometryIcon>;
}

export function SemicircleToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 5 16 A 7 7 0 0 1 19 16" />}{segment(5, 16, 19, 16)}{openNode(12, 16)}{node(19, 16)}</GeometryIcon>;
}

export function SemicirclesToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 4 15 A 5 5 0 0 1 14 15" />}{<path d="M 10 19 A 5 5 0 0 1 20 19" />}{segment(4, 15, 14, 15)}{segment(10, 19, 20, 19)}{node(14, 15)}{node(20, 19)}</GeometryIcon>;
}

export function EllipseToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<ellipse cx={12} cy={12} rx={7} ry={4.3} transform="rotate(-18 12 12)" />}{helperLine(6, 14, 18, 10)}{helperLine(10, 8, 14, 16)}{openNode(12, 12)}</GeometryIcon>;
}

export function ArcToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 7 17 A 7 7 0 0 1 18 8" />}{openNode(11, 15)}{node(7, 17)}{node(18, 8)}{helperLine(11, 15, 7, 17)}{helperLine(11, 15, 18, 8)}</GeometryIcon>;
}

export function SectorToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 12 17 L 7 15 A 6 6 0 0 1 18 9 Z" />}{openNode(12, 17)}{node(7, 15)}{node(18, 9)}</GeometryIcon>;
}

export function CircleToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<circle cx={12} cy={12} r={6} />}{openNode(12, 12)}{node(18, 12)}{helperLine(12, 12, 18, 12)}</GeometryIcon>;
}

export function CirclesToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<circle cx={8} cy={13} r={4.5} />}{<circle cx={16} cy={10} r={4.5} />}{openNode(8, 13)}{node(12.5, 13)}{openNode(16, 10)}{node(20.5, 10)}</GeometryIcon>;
}

export function CompassToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 6 17 A 7 7 0 0 1 20 17" />}{openNode(13, 17)}{node(20, 17)}{helperLine(13, 17, 20, 17)}</GeometryIcon>;
}

export function CompassesToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 4 15 A 5 5 0 0 1 14 15" />}{<path d="M 10 19 A 5 5 0 0 1 20 19" />}{openNode(9, 15)}{node(14, 15)}{openNode(15, 19)}{node(20, 19)}</GeometryIcon>;
}

export function PolygonToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 6 17 L 8 8 L 15 5 L 20 12 L 16 19 Z" />}{node(6, 17)}{node(8, 8)}{node(15, 5)}{node(20, 12)}{node(16, 19)}</GeometryIcon>;
}

export function SquareToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 7 7 H 17 V 17 H 7 Z" />}{node(7, 17)}{node(17, 17)}{openNode(7, 7)}{openNode(17, 7)}</GeometryIcon>;
}

export function RectangleToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 5 8 H 20 V 17 H 5 Z" />}{helperLine(5, 17, 20, 8)}{node(5, 17)}{node(20, 8)}{openNode(5, 8)}{openNode(20, 17)}</GeometryIcon>;
}

export function ParallelogramToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 5 17 L 10 7 H 20 L 15 17 Z" />}{helperLine(5, 17, 20, 7)}{node(5, 17)}{node(10, 7)}{node(15, 17)}{openNode(20, 7)}</GeometryIcon>;
}

export function GoldenRectangleToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 5 8 H 20 V 17 H 5 Z" />}{segment(14, 8, 14, 17)}{<path d="M 5 19 H 14 M 14 19 H 20" opacity={0.72} />}{node(5, 17)}{node(14, 17)}{node(20, 17)}</GeometryIcon>;
}

export function RegularPolygonToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 12 4 L 19 8 V 16 L 12 20 L 5 16 V 8 Z" />}{openNode(12, 12)}{node(12, 4)}{node(19, 8)}{node(19, 16)}{node(12, 20)}{node(5, 16)}{node(5, 8)}</GeometryIcon>;
}

export function DefinedTriangleToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 5 18 L 19 18 L 12 6 Z" />}{helperLine(5, 18, 12, 6)}{helperLine(19, 18, 12, 6)}{node(5, 18)}{node(19, 18)}{openNode(12, 6)}</GeometryIcon>;
}

export function AltitudeToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 5 18 L 12 5 L 20 18 Z" />}{helperLine(12, 5, 12, 18)}{rightAngle(12, 18)}{node(12, 5)}{openNode(12, 18)}</GeometryIcon>;
}

export function LineIntersectionToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(4, 18, 20, 7)}{segment(5, 7, 19, 18)}{node(12, 12.8, 2)}{openNode(6.5, 16.3)}{openNode(17.5, 8.7)}</GeometryIcon>;
}

export function FillCircleToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<circle cx={12} cy={12} r={6} fill="currentColor" fillOpacity={0.18} />}{<circle cx={12} cy={12} r={6} />}{openNode(12, 12)}{node(18, 12)}{helperLine(12, 12, 18, 12)}</GeometryIcon>;
}

export function FillPolygonToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 6 17 L 8 8 L 15 5 L 20 12 L 16 19 Z" fill="currentColor" fillOpacity={0.18} />}{<path d="M 6 17 L 8 8 L 15 5 L 20 12 L 16 19 Z" />}{node(6, 17)}{node(8, 8)}{node(15, 5)}{node(20, 12)}</GeometryIcon>;
}

export function FillSectorToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 12 17 L 7 15 A 6 6 0 0 1 18 9 Z" fill="currentColor" fillOpacity={0.18} />}{<path d="M 12 17 L 7 15 A 6 6 0 0 1 18 9 Z" />}{openNode(12, 17)}{node(7, 15)}{node(18, 9)}</GeometryIcon>;
}

export function FillAngleToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 6 18 L 18 18 A 12 12 0 0 0 12 7 Z" fill="currentColor" fillOpacity={0.18} />}{segment(6, 18, 20, 18)}{segment(6, 18, 13, 6)}{node(6, 18)}{node(18, 18)}{node(12, 7)}</GeometryIcon>;
}

export function FillAnglesToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 5 18 L 13 18 A 8 8 0 0 0 9 10 Z" fill="currentColor" fillOpacity={0.18} />}{<path d="M 12 15 L 20 15 A 8 8 0 0 0 16 7 Z" fill="currentColor" fillOpacity={0.18} />}{segment(5, 18, 14, 18)}{segment(5, 18, 10, 9)}{segment(12, 15, 21, 15)}{segment(12, 15, 17, 6)}{node(5, 18)}{node(12, 15)}</GeometryIcon>;
}

export function MarkSegmentToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(5, 16, 19, 9)}{node(5, 16)}{node(19, 9)}{<path d="M 11 11 l 2 4 M 14 9.5 l 2 4" />}</GeometryIcon>;
}

export function MarkSegmentsToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(4, 9, 12, 6)}{segment(8, 18, 20, 13)}{node(4, 9)}{node(12, 6)}{node(8, 18)}{node(20, 13)}{<path d="M 8 6.5 l 1 3 M 14 14.5 l 1.2 3" />}</GeometryIcon>;
}

export function MarkArcToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 6 17 A 7 7 0 0 1 18 9" />}{<path d="M 11 13 l 2 2 M 13 10 l 2 2" />}{openNode(11, 16)}{node(6, 17)}{node(18, 9)}</GeometryIcon>;
}

export function AngleMarkToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(6, 18, 20, 18)}{segment(6, 18, 14, 7)}{<path d="M 11 18 A 5 5 0 0 0 9 14" />}{<path d="M 13 17 l 1.8 2 M 10.2 14 l 2 1.8" />}{node(6, 18)}</GeometryIcon>;
}

export function AngleMarksToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(4, 18, 12, 18)}{segment(4, 18, 9, 10)}{<path d="M 8 18 A 4 4 0 0 0 6.5 14.5" />}{segment(12, 15, 21, 15)}{segment(12, 15, 17, 7)}{<path d="M 16 15 A 4 4 0 0 0 14.5 11.5" />}{<path d="M 9 17 l 1.5 1.8 M 17 14 l 1.5 1.8" />}</GeometryIcon>;
}

export function RightAngleMarkToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(5, 18, 20, 18)}{segment(8, 21, 8, 6)}{rightAngle(8, 18)}{node(8, 18)}{node(19, 18)}{node(8, 7)}</GeometryIcon>;
}

export function RightAngleMarksToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(4, 18, 13, 18)}{segment(6, 21, 6, 10)}{rightAngle(6, 18, 2.8)}{segment(12, 14, 21, 14)}{segment(15, 17, 15, 6)}{rightAngle(15, 14, 2.8)}{node(6, 18)}{node(15, 14)}</GeometryIcon>;
}

export function PicAngleToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(6, 18, 20, 18)}{segment(6, 18, 14, 7)}{<path d="M 11 18 A 5 5 0 0 0 9 14" />}{<path d="M 13 18 A 7 7 0 0 0 10 12" opacity={0.58} strokeDasharray="2.4 2.4" />}{node(6, 18)}{node(18, 18)}{node(13, 8)}</GeometryIcon>;
}

export function PicRightAngleToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(5, 18, 20, 18)}{segment(8, 21, 8, 6)}{rightAngle(8, 18)}{<path d="M 12 15 h 4 v 3 h -4 z" opacity={0.58} strokeDasharray="2.4 2.4" />}{node(8, 18)}</GeometryIcon>;
}

export function LabelPointToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{node(8, 15)}{<path d="M 11 7 h 8 v 5 h -8 z" />}{segment(12, 9.5, 18, 9.5)}{helperLine(8, 15, 11, 12)}</GeometryIcon>;
}

export function LabelPointsToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{node(5, 16)}{node(12, 9)}{node(19, 15)}{<path d="M 7 5 h 5 v 4 h -5 z M 14 17 h 6 v 4 h -6 z M 2 8 h 5 v 4 h -5 z" />}</GeometryIcon>;
}

export function AutoLabelPointsToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{openNode(12, 12)}{node(12, 5)}{node(19, 12)}{node(12, 19)}{node(5, 12)}{helperLine(12, 12, 12, 5)}{helperLine(12, 12, 19, 12)}{helperLine(12, 12, 12, 19)}{helperLine(12, 12, 5, 12)}{<path d="M 14 3 h 5 v 4 h -5 z M 18 15 h 5 v 4 h -5 z M 4 17 h 5 v 4 h -5 z M 1 5 h 5 v 4 h -5 z" />}</GeometryIcon>;
}

export function LabelSegmentToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(5, 16, 19, 9)}{node(5, 16)}{node(19, 9)}{<path d="M 8 6 h 8 v 5 h -8 z" />}{segment(9, 8.5, 15, 8.5)}</GeometryIcon>;
}

export function LabelSegmentsToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(4, 9, 12, 6)}{segment(8, 18, 20, 13)}{node(4, 9)}{node(12, 6)}{node(8, 18)}{node(20, 13)}{<path d="M 13 3 h 6 v 4 h -6 z M 2 13 h 6 v 4 h -6 z" />}</GeometryIcon>;
}

export function LabelLineToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(3, 18, 21, 7)}{node(8, 15)}{node(17, 10)}{<path d="M 10 5 h 8 v 5 h -8 z" />}{segment(11, 7.5, 17, 7.5)}</GeometryIcon>;
}

export function LabelAngleToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(6, 18, 20, 18)}{segment(6, 18, 14, 7)}{<path d="M 11 18 A 5 5 0 0 0 9 14" />}{<path d="M 13 9 h 7 v 5 h -7 z" />}{node(6, 18)}</GeometryIcon>;
}

export function LabelAnglesToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(4, 18, 12, 18)}{segment(4, 18, 9, 10)}{<path d="M 8 18 A 4 4 0 0 0 6.5 14.5" />}{segment(12, 15, 21, 15)}{segment(12, 15, 17, 7)}{<path d="M 16 15 A 4 4 0 0 0 14.5 11.5" />}{<path d="M 2 6 h 5 v 4 h -5 z M 17 17 h 5 v 4 h -5 z" />}</GeometryIcon>;
}

export function LabelCircleToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<circle cx={11} cy={13} r={5.8} />}{openNode(11, 13)}{node(16, 10)}{<path d="M 14 3 h 7 v 5 h -7 z" />}{helperLine(16, 10, 16, 8)}</GeometryIcon>;
}

export function LabelArcToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 6 17 A 7 7 0 0 1 18 9" />}{openNode(11, 16)}{node(6, 17)}{node(18, 9)}{<path d="M 13 3 h 7 v 5 h -7 z" />}{helperLine(15, 8, 15, 10.5)}</GeometryIcon>;
}

export function FindAngleToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(6, 18, 20, 18)}{segment(6, 18, 14, 7)}{<path d="M 12 18 A 6 6 0 0 0 10 13 m 0 0 l 3 1 m -3 -1 l 1 3" />}{node(6, 18)}{node(18, 18)}{node(13, 8)}</GeometryIcon>;
}

export function FindSlopeAngleToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(4, 18, 20, 18)}{segment(5, 17, 19, 8)}{<path d="M 10 18 A 6 6 0 0 0 9 14" />}{node(5, 17)}{node(18, 9)}{helperLine(5, 17, 5, 20)}</GeometryIcon>;
}

export function GetAngleResultToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(5, 18, 18, 18)}{segment(5, 18, 13, 7)}{<path d="M 10 18 A 5 5 0 0 0 8 14" />}{<path d="M 14 7 h 7 v 5 h -7 z" />}{segment(15, 9.5, 20, 9.5)}{node(5, 18)}</GeometryIcon>;
}

export function MidpointToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(4, 14, 20, 14)}{node(4, 14)}{node(12, 14)}{node(20, 14)}</GeometryIcon>;
}

export function GoldenRatioPointToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(4, 15, 20, 15)}{node(4, 15)}{node(14, 15)}{node(20, 15)}{<path d="M 4 19 H 14 M 14 19 H 20 M 14 11 v 8" opacity={0.72} />}</GeometryIcon>;
}

export function BarycentricPointToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 5 18 L 12 5 L 20 18 Z" />}{helperLine(5, 18, 12, 13)}{helperLine(12, 5, 12, 13)}{helperLine(20, 18, 12, 13)}{node(5, 18)}{node(12, 5)}{node(20, 18)}{node(12, 13)}</GeometryIcon>;
}

export function HarmonicPointToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(3, 15, 21, 9)}{node(5, 14.3)}{openNode(10, 12.7)}{node(15, 11)}{openNode(20, 9.3)}{helperLine(10, 18, 15, 6)}</GeometryIcon>;
}

export function EquidistantPointsToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(4, 17, 20, 17)}{node(12, 8)}{openNode(7, 17)}{openNode(17, 17)}{helperLine(12, 8, 7, 17)}{helperLine(12, 8, 17, 17)}{<path d="M 7 20 H 17" opacity={0.72} />}</GeometryIcon>;
}

export function MidArcPointToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 5 16 A 7 7 0 0 1 19 16" />}{node(12, 9)}{node(5, 16)}{node(19, 16)}{openNode(12, 16)}{helperLine(12, 16, 12, 9)}</GeometryIcon>;
}

export function PointOnLineToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(4, 18, 20, 7)}{node(5.8, 16.8)}{openNode(12, 12.5)}{node(18.2, 8.2)}{helperLine(12, 5, 12, 12.5)}</GeometryIcon>;
}

export function PointOnCircleToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<circle cx={12} cy={12} r={6} />}{openNode(12, 12)}{node(17, 8.7)}{helperLine(12, 12, 17, 8.7)}</GeometryIcon>;
}

export function SimilitudeCenterToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<circle cx={8} cy={14} r={4} />}{<circle cx={17} cy={10} r={3} />}{node(4, 18)}{helperLine(4, 18, 8, 14)}{helperLine(4, 18, 17, 10)}{openNode(8, 14)}{openNode(17, 10)}</GeometryIcon>;
}

export function VectorPointToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{node(5, 18)}{arrow(5, 18, 13, 10)}{node(13, 10)}{openNode(10, 18)}{arrow(10, 18, 18, 10)}{node(18, 10)}{helperLine(13, 10, 18, 10)}</GeometryIcon>;
}

export function ProjectionToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(4, 18, 20, 18)}{helperLine(12, 5, 12, 18)}{node(12, 5)}{openNode(12, 18)}{rightAngle(12, 18)}</GeometryIcon>;
}

export function PerpendicularToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(4, 17, 20, 17)}{segment(12, 5, 12, 21)}{node(12, 8)}{rightAngle(12, 17)}</GeometryIcon>;
}

export function PerpendicularBisectorToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(5, 15, 19, 15)}{segment(12, 5, 12, 21)}{node(5, 15)}{node(19, 15)}{openNode(12, 15)}{rightAngle(12, 15)}</GeometryIcon>;
}

export function AngleBisectorToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(6, 18, 18, 18)}{segment(6, 18, 16, 7)}{segment(6, 18, 18, 11)}{helperLine(6, 18, 18, 14)}{node(6, 18)}</GeometryIcon>;
}

export function LineCircleIntersectionToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<circle cx={12} cy={12} r={6} />}{segment(4, 17, 20, 7)}{node(8, 14.5)}{node(16, 9.5)}</GeometryIcon>;
}

export function CircleCircleIntersectionToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<circle cx={9} cy={12} r={5.5} />}{<circle cx={15} cy={12} r={5.5} />}{node(12, 7.5)}{node(12, 16.5)}</GeometryIcon>;
}

export function RadicalAxisToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<circle cx={8} cy={12} r={5} />}{<circle cx={16} cy={12} r={5} />}{helperLine(12, 4, 12, 20)}{node(12, 8)}{node(12, 16)}</GeometryIcon>;
}

export function PointTransformationToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{node(6, 15)}{node(18, 9)}{arrow(8, 14, 16, 10)}{helperLine(6, 15, 18, 9)}</GeometryIcon>;
}

export function PointsTransformationToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{node(5, 15)}{node(5, 9)}{node(15, 15)}{node(15, 9)}{arrow(7, 15, 13, 15)}{arrow(7, 9, 13, 9)}</GeometryIcon>;
}

export function CircleTransformationToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<circle cx={8} cy={13} r={4} />}{<circle cx={17} cy={10} r={4} />}{arrow(11, 12, 14, 11)}</GeometryIcon>;
}

export function ShowTransformationToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{node(5, 17)}{node(9, 8)}{node(16, 15)}{node(20, 6)}{arrow(7, 16, 14, 15)}{helperLine(5, 17, 9, 8)}{helperLine(16, 15, 20, 6)}</GeometryIcon>;
}

export function DuplicateSegmentToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(4, 8, 12, 8)}{node(4, 8)}{node(12, 8)}{segment(7, 17, 20, 17)}{node(7, 17)}{openNode(15, 17)}{helperLine(4, 8, 15, 17)}</GeometryIcon>;
}

export function ProtractorToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 4 17 A 8 8 0 0 1 20 17" />}{segment(4, 17, 20, 17)}{segment(12, 17, 18, 11)}{node(12, 17)}</GeometryIcon>;
}

export function AllAltitudesToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 5 19 L 12 5 L 20 18 Z" />}{helperLine(12, 5, 12, 18)}{helperLine(5, 19, 16.3, 11.6)}{helperLine(20, 18, 8.2, 12.6)}{node(12, 13)}</GeometryIcon>;
}

export function TriangleCenterToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 5 18 L 12 5 L 20 18 Z" />}{helperLine(12, 5, 12.3, 18)}{helperLine(5, 18, 16, 11.5)}{helperLine(20, 18, 8.5, 11.5)}{node(12, 13)}</GeometryIcon>;
}

export function ProjectedExcentersToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 6 17 L 12 7 L 19 17 Z" />}{node(12, 3)}{node(3, 20)}{node(22, 20)}{helperLine(12, 3, 12, 17)}{helperLine(3, 20, 8, 14)}{helperLine(22, 20, 17, 14)}</GeometryIcon>;
}

export function LinearityTestToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(4, 16, 20, 8)}{node(6, 15)}{node(12, 12)}{node(18, 9)}{smallCheck()}</GeometryIcon>;
}

export function OrthogonalityTestToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(5, 17, 19, 17)}{segment(12, 7, 12, 21)}{rightAngle(12, 17)}{smallCheck(18, 6)}</GeometryIcon>;
}

export function DotProductToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{node(6, 18)}{arrow(6, 18, 17, 18)}{arrow(6, 18, 14, 8)}{<circle cx={17.5} cy={8.5} r={1.2} fill="currentColor" stroke="none" />}</GeometryIcon>;
}

export function PowerCircleToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<circle cx={14} cy={12} r={5.5} />}{node(5, 18)}{segment(5, 18, 20, 8)}{helperLine(5, 18, 19, 18)}{node(10, 15)}{node(18, 9.3)}</GeometryIcon>;
}

export function PointCoordinatesToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{node(8, 16)}{helperLine(8, 16, 8, 7)}{helperLine(8, 16, 18, 16)}{<path d="M 13 8 h 6 v 5 h -6 z" />}{segment(14, 10.5, 18, 10.5)}</GeometryIcon>;
}

export function VectorCoordinatesToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{node(5, 18)}{arrow(5, 18, 16, 8)}{<path d="M 13 14 h 7 v 5 h -7 z" />}{segment(14, 16.5, 19, 16.5)}</GeometryIcon>;
}

export function LineCircleIntersectionTestToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<circle cx={11} cy={12} r={5.7} />}{segment(4, 17, 18, 8)}{node(8, 14.4)}{node(14.5, 10.2)}{smallCheck(19, 6)}</GeometryIcon>;
}

export function CircleCircleIntersectionTestToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<circle cx={9} cy={12} r={5.4} />}{<circle cx={15} cy={12} r={5.4} />}{node(12, 7.8)}{node(12, 16.2)}{smallCheck(19, 6)}</GeometryIcon>;
}

export function ShowLineConstructionToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(4, 17, 20, 17)}{helperLine(5, 7, 19, 17)}{helperLine(5, 17, 19, 7)}{<path d="M 6 17 A 6 6 0 0 1 12 11" opacity={0.58} strokeDasharray="2.4 2.4" />}{<path d="M 18 17 A 6 6 0 0 0 12 11" opacity={0.58} strokeDasharray="2.4 2.4" />}{node(5, 17)}{node(19, 17)}</GeometryIcon>;
}

export function DefinedLineToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{helperLine(4, 18, 20, 10)}{segment(5, 8, 19, 15)}{node(6, 17)}{node(18, 11)}{openNode(9, 10)}{openNode(16, 13.5)}</GeometryIcon>;
}

export function DefinedCircleToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<circle cx={12} cy={12} r={6.2} />}{<path d="M 7 16 L 12 6 L 18 16 Z" />}{node(7, 16)}{node(12, 6)}{node(18, 16)}{openNode(12, 12)}</GeometryIcon>;
}

export function AssociatedTriangleToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 5 18 L 12 5 L 20 18 Z" />}{<path d="M 8 16 L 12 9 L 17 16 Z" opacity={0.58} strokeDasharray="2.4 2.4" />}{node(5, 18)}{node(12, 5)}{node(20, 18)}{openNode(8, 16)}{openNode(12, 9)}{openNode(17, 16)}</GeometryIcon>;
}

export function PermuteTriangleToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 6 18 L 12 6 L 19 18 Z" />}{node(6, 18)}{node(12, 6)}{node(19, 18)}{arrow(8, 20, 16, 20)}{arrow(17, 16, 9, 16)}</GeometryIcon>;
}

export function LengthCalculationToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{segment(5, 10, 19, 10)}{node(5, 10)}{node(19, 10)}{<path d="M 5 15 v 3 M 19 15 v 3 M 5 16.5 H 19" />}{<path d="M 10 19 h 4" />}</GeometryIcon>;
}

export function PtToCmConversionToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<text x={4} y={10} fontSize={5.2} fill="currentColor" stroke="none" fontFamily="monospace">pt</text>}{arrow(7, 15, 17, 15)}{<text x={13} y={10} fontSize={5.2} fill="currentColor" stroke="none" fontFamily="monospace">cm</text>}</GeometryIcon>;
}

export function CmToPtConversionToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<text x={3} y={10} fontSize={5.2} fill="currentColor" stroke="none" fontFamily="monospace">cm</text>}{arrow(7, 15, 17, 15)}{<text x={15} y={10} fontSize={5.2} fill="currentColor" stroke="none" fontFamily="monospace">pt</text>}</GeometryIcon>;
}

export function SwapPointsToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{node(6, 16)}{node(18, 8)}{arrow(8, 15, 15, 10)}{arrow(16, 9, 9, 14)}{helperLine(6, 16, 18, 8)}</GeometryIcon>;
}

export function CanvasInitToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 5 6 h 14 v 12 h -14 z" />}{segment(5, 18, 20, 18)}{segment(5, 18, 5, 4)}{<path d="M 8 18 v 2 M 12 18 v 2 M 16 18 v 2 M 5 14 h -2 M 5 10 h -2" opacity={0.72} />}</GeometryIcon>;
}

export function CanvasClipToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 6 7 h 12 v 10 h -12 z" />}{<path d="M 4 5 l 16 14" />}{<path d="M 8 9 h 8 v 6 h -8 z" fill="currentColor" fillOpacity={0.14} />}</GeometryIcon>;
}

export function BoundingBoxToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 5 6 h 14 v 12 h -14 z" strokeDasharray="2.4 2.4" opacity={0.72} />}{node(5, 6, 1.1)}{node(19, 6, 1.1)}{node(5, 18, 1.1)}{node(19, 18, 1.1)}{<path d="M 9 10 h 6 v 4 h -6 z" />}</GeometryIcon>;
}

export function ClipBoundingBoxToolIcon(props: GeometryIconProps) {
  return <GeometryIcon {...props}>{<path d="M 5 6 h 14 v 12 h -14 z" />}{<path d="M 8 9 h 8 v 6 h -8 z" fill="currentColor" fillOpacity={0.14} />}{<path d="M 4 19 L 20 5" />}{node(5, 18, 1.1)}{node(19, 6, 1.1)}</GeometryIcon>;
}
