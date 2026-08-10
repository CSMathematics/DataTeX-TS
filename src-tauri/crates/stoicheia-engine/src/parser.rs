use crate::geometry::{resolve_geometry, GeoPoint, GeometryDiagnostic, ResolvedViewport};
use nom::{
    branch::alt,
    bytes::complete::{tag, take_until},
    character::complete::{alphanumeric1, char, multispace0},
    multi::separated_list1,
    sequence::{delimited, separated_pair},
    IResult,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::time::Instant;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type")]
pub enum AstNode {
    Point {
        name: String,
        x: f64,
        y: f64,
        coordinate_mode: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        angle: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        distance: Option<f64>,
    },
    Segment {
        p1: String,
        p2: String,
        options: Option<String>,
    },
    Line {
        p1: String,
        p2: String,
        options: Option<String>,
    },
    Lines {
        pairs: Vec<[String; 2]>,
        options: Option<String>,
    },
    Segments {
        pairs: Vec<[String; 2]>,
        options: Option<String>,
    },
    PolySeg {
        points: Vec<String>,
        options: Option<String>,
    },
    Circles {
        pairs: Vec<[String; 2]>,
        options: Option<String>,
    },
    SemiCircle {
        center: String,
        radius_point: String,
        options: Option<String>,
    },
    SemiCircles {
        pairs: Vec<[String; 2]>,
        options: Option<String>,
    },
    Polygon {
        points: Vec<String>,
        options: Option<String>,
    },
    Circle {
        center: String,
        radius_point: String,
        options: Option<String>,
    },
    Arc {
        mode: String,
        center: String,
        first: String,
        second: Vec<String>,
        options: Option<String>,
    },
    Sector {
        mode: String,
        center: String,
        first: String,
        second: Vec<String>,
        options: Option<String>,
    },
    FillCircle {
        mode: String,
        center: String,
        radius: String,
        options: Option<String>,
    },
    FillPolygon {
        points: Vec<String>,
        options: Option<String>,
    },
    FillSector {
        mode: String,
        center: String,
        first: String,
        second: Vec<String>,
        options: Option<String>,
    },
    FillAngle {
        p1: String,
        vertex: String,
        p2: String,
        options: Option<String>,
    },
    FillAngles {
        angles: Vec<[String; 3]>,
        options: Option<String>,
    },
    CanvasInit {
        xmin: f64,
        xmax: f64,
        ymin: f64,
        ymax: f64,
        xstep: f64,
        ystep: f64,
        options: Option<String>,
    },
    CanvasClip {
        space: f64,
        options: Option<String>,
    },
    ShowBoundingBox {
        options: Option<String>,
    },
    StyleSetup {
        kind: String,
        command: String,
        options: Option<String>,
    },
    CustomStyle {
        name: String,
        options: Option<String>,
    },
    Compass {
        center: String,
        through: String,
        options: Option<String>,
    },
    Compasses {
        pairs: Vec<[String; 2]>,
        options: Option<String>,
    },
    ShowLine {
        mode: String,
        points: Vec<String>,
        through: Option<String>,
        options: Option<String>,
    },
    ShowTransformation {
        mode: String,
        source: String,
        references: Vec<String>,
        options: Option<String>,
    },
    Protractor {
        origin: String,
        direction: String,
        options: Option<String>,
    },
    ClipBoundingBox,
    PolygonClip {
        points: Vec<String>,
        out: bool,
        options: Option<String>,
    },
    CircleClip {
        center: String,
        radius_point: String,
        out: bool,
        options: Option<String>,
    },
    SectorClip {
        mode: String,
        center: String,
        first: String,
        second: Vec<String>,
        options: Option<String>,
    },
    SegmentMark {
        p1: String,
        p2: String,
        options: Option<String>,
    },
    SegmentsMark {
        pairs: Vec<[String; 2]>,
        options: Option<String>,
    },
    ArcMark {
        center: String,
        start: String,
        end: String,
        options: Option<String>,
    },
    Ellipse {
        center: String,
        x_radius: f64,
        y_radius: f64,
        angle: f64,
        options: Option<String>,
    },
    PerpendicularLine {
        p1: String,
        p2: String,
        through: String,
        helper: String,
        options: Option<String>,
    },
    ProjectionLine {
        p1: String,
        p2: String,
        from: String,
        foot: String,
        options: Option<String>,
    },
    PerpendicularBisector {
        p1: String,
        p2: String,
        helper1: String,
        helper2: String,
        options: Option<String>,
    },
    AngleBisector {
        p1: String,
        vertex: String,
        p2: String,
        helper: String,
        options: Option<String>,
    },
    TriangleAltitude {
        side1: String,
        vertex: String,
        side2: String,
        foot: String,
        options: Option<String>,
    },
    AllAltitudes {
        p1: String,
        p2: String,
        p3: String,
        foot1: String,
        foot2: String,
        foot3: String,
        orthocenter: String,
        options: Option<String>,
    },
    TriangleCenter {
        option: String,
        p1: String,
        p2: String,
        p3: String,
        name: String,
    },
    AngleMark {
        p1: String,
        vertex: String,
        p2: String,
        options: Option<String>,
        label: Option<String>,
    },
    AnglesMark {
        angles: Vec<[String; 3]>,
        options: Option<String>,
    },
    RightAngleMark {
        p1: String,
        vertex: String,
        p2: String,
        options: Option<String>,
    },
    RightAnglesMark {
        angles: Vec<[String; 3]>,
        options: Option<String>,
    },
    PicAngle {
        p1: String,
        vertex: String,
        p2: String,
        options: Option<String>,
    },
    PicRightAngle {
        p1: String,
        vertex: String,
        p2: String,
        options: Option<String>,
    },
    LabelPoint {
        point: String,
        text: String,
        options: Option<String>,
    },
    LabelPoints {
        points: Vec<String>,
        options: Option<String>,
    },
    AutoLabelPoints {
        points: Vec<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        center: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        distance: Option<f64>,
        options: Option<String>,
    },
    LabelSegment {
        p1: String,
        p2: String,
        text: String,
        options: Option<String>,
    },
    LabelSegments {
        pairs: Vec<[String; 2]>,
        text: String,
        options: Option<String>,
    },
    LabelLine {
        p1: String,
        p2: String,
        text: String,
        options: Option<String>,
    },
    LabelAngle {
        p1: String,
        vertex: String,
        p2: String,
        text: String,
        options: Option<String>,
    },
    LabelAngles {
        angles: Vec<[String; 3]>,
        text: String,
        options: Option<String>,
    },
    LabelCircle {
        center: String,
        radius_point: String,
        angle: String,
        text: String,
        options: Option<String>,
    },
    LabelArc {
        center: String,
        start: String,
        end: String,
        text: String,
        options: Option<String>,
    },
    IntersectionPoint {
        p1: String,
        p2: String,
        p3: String,
        p4: String,
        name: String,
    },
    MidPoint {
        p1: String,
        p2: String,
        name: String,
    },
    GoldenRatioPoint {
        p1: String,
        p2: String,
        name: String,
    },
    BarycentricPoint {
        points: Vec<String>,
        weights: Vec<f64>,
        name: String,
    },
    SimilitudeCenter {
        kind: String,
        center1: String,
        radius1: String,
        center2: String,
        radius2: String,
        name: String,
    },
    HarmonicPoint {
        mode: String,
        p1: String,
        p2: String,
        known: String,
        name: String,
    },
    HarmonicPair {
        p1: String,
        p2: String,
        ratio: f64,
        name1: String,
        name2: String,
    },
    EquiPoints {
        p1: String,
        p2: String,
        from: String,
        distance: f64,
        show: bool,
        name1: String,
        name2: String,
    },
    MidArcPoint {
        center: String,
        start: String,
        end: String,
        name: String,
    },
    PointOnLine {
        p1: String,
        p2: String,
        position: f64,
        name: String,
    },
    PointOnCircle {
        mode: String,
        center: String,
        angle: f64,
        through: Option<String>,
        radius: Option<f64>,
        name: String,
    },
    PointTransformation {
        mode: String,
        source: String,
        references: Vec<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        value: Option<String>,
        name: String,
    },
    PointsTransformation {
        mode: String,
        sources: Vec<String>,
        references: Vec<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        value: Option<String>,
        names: Vec<String>,
    },
    VectorPoint {
        mode: String,
        p1: String,
        p2: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        anchor: Option<String>,
        factor: f64,
        name: String,
    },
    VectorCoordinates {
        p1: String,
        p2: String,
        #[serde(rename = "macro")]
        macro_name: String,
    },
    PointCoordinates {
        point: String,
        #[serde(rename = "macro")]
        macro_name: String,
    },
    SwapPoints {
        p1: String,
        p2: String,
    },
    DuplicateSegment {
        #[serde(rename = "rayStart")]
        ray_start: String,
        #[serde(rename = "rayThrough")]
        ray_through: String,
        #[serde(rename = "segmentStart")]
        segment_start: String,
        #[serde(rename = "segmentEnd")]
        segment_end: String,
        name: String,
    },
    RadicalAxis {
        circle1: Vec<String>,
        circle2: Vec<String>,
        results: Vec<String>,
    },
    DefinedLine {
        mode: String,
        points: Vec<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        through: Option<String>,
        factor: f64,
        normed: bool,
        results: Vec<String>,
    },
    DefinedTriangle {
        mode: String,
        p1: String,
        p2: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        angle1: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        angle2: Option<f64>,
        swap: bool,
        name: String,
    },
    AssociatedTriangle {
        mode: String,
        p1: String,
        p2: String,
        p3: String,
        #[serde(rename = "namePrefix", skip_serializing_if = "Option::is_none")]
        name_prefix: Option<String>,
        results: Vec<String>,
    },
    PolygonConstruction {
        mode: String,
        points: Vec<String>,
        results: Vec<String>,
        #[serde(rename = "regularMode", skip_serializing_if = "Option::is_none")]
        regular_mode: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        sides: Option<usize>,
        #[serde(rename = "namePrefix", skip_serializing_if = "Option::is_none")]
        name_prefix: Option<String>,
    },
    DefinedCircle {
        mode: String,
        points: Vec<String>,
        references: Vec<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        value: Option<f64>,
        results: Vec<String>,
        center: String,
        #[serde(rename = "radiusPoint")]
        radius_point: String,
    },
    ProjectedExcenters {
        p1: String,
        p2: String,
        p3: String,
        #[serde(rename = "namePrefix")]
        name_prefix: String,
        #[serde(rename = "excenterSuffixes")]
        excenter_suffixes: Vec<String>,
        #[serde(rename = "projectionPrefixes")]
        projection_prefixes: Vec<String>,
        results: Vec<String>,
    },
    CircleTransformation {
        mode: String,
        center: String,
        #[serde(rename = "radiusPoint")]
        radius_point: String,
        references: Vec<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        value: Option<String>,
        results: Vec<String>,
    },
    LineCircleIntersection {
        mode: String,
        line: Vec<String>,
        circle: Vec<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        radius: Option<f64>,
        near: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        common: Option<String>,
        results: Vec<String>,
    },
    LineCircleTest {
        line: Vec<String>,
        circle: Vec<String>,
    },
    CircleCircleIntersection {
        mode: String,
        circles: Vec<Vec<String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        radii: Option<Vec<f64>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        common: Option<String>,
        results: Vec<String>,
    },
    CircleCircleTest {
        circles: Vec<Vec<String>>,
    },
    LinearityTest {
        points: Vec<String>,
    },
    OrthogonalityTest {
        points: Vec<String>,
    },
    AngleCalculation {
        mode: String,
        points: Vec<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        #[serde(rename = "macro")]
        macro_name: Option<String>,
    },
    AngleRetrieval {
        #[serde(rename = "macro")]
        macro_name: String,
    },
    LengthCalculation {
        p1: String,
        p2: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        #[serde(rename = "macro")]
        macro_name: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        options: Option<String>,
    },
    UnitConversion {
        mode: String,
        value: String,
        #[serde(rename = "macro")]
        macro_name: String,
    },
    DotProduct {
        p1: String,
        p2: String,
        p3: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        #[serde(rename = "macro")]
        macro_name: Option<String>,
    },
    PowerCircle {
        point: String,
        center: String,
        #[serde(rename = "radiusPoint")]
        radius_point: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        #[serde(rename = "macro")]
        macro_name: Option<String>,
    },
    RandomPoint {
        mode: String,
        references: Vec<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        radius: Option<f64>,
        name: String,
    },
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ParseResult {
    pub nodes: Vec<AstNode>,
    #[allow(dead_code)]
    #[serde(default, skip_serializing)]
    pub resolved_points: BTreeMap<String, GeoPoint>,
    pub geometry_complete: bool,
    pub viewport: Option<ResolvedViewport>,
    #[serde(rename = "renderScene")]
    pub render_scene: RenderScenePayload,
    pub timings: ParseTimings,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RenderScenePayload {
    pub points: BTreeMap<String, GeoPoint>,
    #[serde(rename = "viewBox", skip_serializing_if = "Option::is_none")]
    pub view_box: Option<String>,
    pub geometry_complete: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub diagnostics: Vec<GeometryDiagnostic>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ParseTimings {
    pub parse_ms: f64,
    pub geometry_ms: f64,
    pub viewport_ms: f64,
    pub total_ms: f64,
    pub node_count: usize,
    pub resolved_point_count: usize,
}

use nom::combinator::{map, opt};

fn parse_optional_args(input: &str) -> IResult<&str, Option<String>> {
    let (input, _) = multispace0(input)?;
    if !input.starts_with('[') {
        return Ok((input, None));
    }

    let mut depth = 0usize;
    let mut escaped = false;
    for (index, character) in input.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }

        if character == '\\' {
            escaped = true;
            continue;
        }

        if character == '[' {
            depth += 1;
        } else if character == ']' {
            depth = depth.saturating_sub(1);
            if depth == 0 {
                return Ok((&input[index + 1..], Some(input[1..index].to_string())));
            }
        }
    }

    Err(nom::Err::Error(nom::error::Error::new(
        input,
        nom::error::ErrorKind::TakeUntil,
    )))
}

fn parse_braced_text(input: &str) -> IResult<&str, String> {
    let (input, _) = multispace0(input)?;
    if !input.starts_with('{') {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Char,
        )));
    }

    let mut depth = 0usize;
    for (index, character) in input.char_indices() {
        if character == '{' {
            depth += 1;
        } else if character == '}' {
            depth = depth.saturating_sub(1);
            if depth == 0 {
                return Ok((&input[index + 1..], input[1..index].to_string()));
            }
        }
    }

    Err(nom::Err::Error(nom::error::Error::new(
        input,
        nom::error::ErrorKind::TakeUntil,
    )))
}

fn parse_point_names(specification: &str) -> Vec<String> {
    specification
        .split(',')
        .map(str::trim)
        .filter(|point| !point.is_empty())
        .map(str::to_string)
        .collect()
}

fn option_value(options: Option<&str>, key: &str) -> Option<String> {
    options.and_then(|options| {
        options.split(',').map(str::trim).find_map(|option| {
            option
                .strip_prefix(&format!("{key}="))
                .map(str::trim)
                .map(str::to_string)
        })
    })
}

fn parse_tkz_def_point(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefPoint")(input)?;
    let (input, _) = multispace0(input)?;
    let (input, coordinates) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let parsed_cartesian = coordinates
        .split_once(',')
        .and_then(|(x, y)| Some((x.trim().parse::<f64>().ok()?, y.trim().parse::<f64>().ok()?)));
    let parsed_polar = coordinates.split_once(':').and_then(|(angle, distance)| {
        Some((
            angle.trim().parse::<f64>().ok()?,
            distance.trim().parse::<f64>().ok()?,
        ))
    });
    let (x, y, coordinate_mode, angle, distance) = if let Some((x, y)) = parsed_cartesian {
        (x, y, "cartesian".to_string(), None, None)
    } else if let Some((angle, distance)) = parsed_polar {
        let radians = angle.to_radians();
        let x = distance * radians.cos();
        let y = distance * radians.sin();
        (
            if x.abs() < 1e-12 { 0.0 } else { x },
            if y.abs() < 1e-12 { 0.0 } else { y },
            "polar".to_string(),
            Some(angle),
            Some(distance),
        )
    } else {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Float,
        )));
    };
    let (input, _) = multispace0(input)?;
    let (input, name) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    Ok((
        input,
        AstNode::Point {
            name: name.to_string(),
            x,
            y,
            coordinate_mode,
            angle,
            distance,
        },
    ))
}

fn parse_tkz_draw_segment(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDrawSegment")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, (p1, p2)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;
    Ok((
        input,
        AstNode::Segment {
            p1: p1.to_string(),
            p2: p2.to_string(),
            options,
        },
    ))
}

fn parse_pair_list(specification: &str) -> Option<Vec<[String; 2]>> {
    let pairs: Option<Vec<[String; 2]>> = specification
        .split_whitespace()
        .map(|pair| {
            let (first, second) = pair.split_once(',')?;
            let first = first.trim();
            let second = second.trim();
            if first.is_empty() || second.is_empty() || first == second || second.contains(',') {
                return None;
            }
            Some([first.to_string(), second.to_string()])
        })
        .collect();
    pairs.filter(|items| !items.is_empty())
}

fn parse_tkz_draw_line(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDrawLine")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, specification) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let pairs = parse_pair_list(specification).ok_or_else(|| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Count))
    })?;
    if pairs.len() != 1 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let [p1, p2] = pairs.into_iter().next().unwrap();
    Ok((input, AstNode::Line { p1, p2, options }))
}

fn parse_tkz_draw_lines(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDrawLines")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, specification) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let pairs = parse_pair_list(specification).ok_or_else(|| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Count))
    })?;
    Ok((input, AstNode::Lines { pairs, options }))
}

fn parse_tkz_draw_segments(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDrawSegments")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, specification) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let pairs = parse_pair_list(specification).ok_or_else(|| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Count))
    })?;
    Ok((input, AstNode::Segments { pairs, options }))
}

fn parse_tkz_draw_polyseg(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDrawPolySeg")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, specification) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points: Vec<String> = specification
        .split(',')
        .map(str::trim)
        .filter(|point| !point.is_empty())
        .map(str::to_string)
        .collect();
    if points.len() < 2 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((input, AstNode::PolySeg { points, options }))
}

fn parse_tkz_draw_circles(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDrawCircles")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, specification) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let pairs = parse_pair_list(specification).ok_or_else(|| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Count))
    })?;
    Ok((input, AstNode::Circles { pairs, options }))
}

fn parse_tkz_draw_semicircle(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDrawSemiCircle")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, specification) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let pairs = parse_pair_list(specification).ok_or_else(|| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Count))
    })?;
    if pairs.len() != 1 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let [center, radius_point] = pairs.into_iter().next().unwrap();
    Ok((
        input,
        AstNode::SemiCircle {
            center,
            radius_point,
            options,
        },
    ))
}

fn parse_tkz_draw_semicircles(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDrawSemiCircles")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, specification) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let pairs = parse_pair_list(specification).ok_or_else(|| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Count))
    })?;
    Ok((input, AstNode::SemiCircles { pairs, options }))
}

fn parse_tkz_draw_polygon(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDrawPolygon")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, points) = delimited(
        char('('),
        separated_list1(char(','), alphanumeric1),
        char(')'),
    )(input)?;
    Ok((
        input,
        AstNode::Polygon {
            points: points.into_iter().map(String::from).collect(),
            options,
        },
    ))
}

fn parse_tkz_draw_circle(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDrawCircle")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, (p1, p2)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;
    Ok((
        input,
        AstNode::Circle {
            center: p1.to_string(),
            radius_point: p2.to_string(),
            options,
        },
    ))
}

fn parse_tkz_draw_arc(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDrawArc")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, first_group) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let (center, first) = first_group.split_once(',').ok_or_else(|| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Count))
    })?;
    let (input, _) = multispace0(input)?;
    let (input, second_group) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let second: Vec<String> = second_group
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect();
    let option_items: Vec<&str> = options
        .as_deref()
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .collect();
    let mode = if option_items.contains(&"rotate") {
        "rotate"
    } else if option_items.contains(&"R with nodes") {
        "R_with_nodes"
    } else if option_items.contains(&"R") {
        "R"
    } else if option_items.contains(&"angles") {
        "angles"
    } else {
        "towards"
    };
    let valid = match mode {
        "towards" => second.len() == 1,
        "rotate" => second.len() == 1 && second[0].parse::<f64>().is_ok(),
        "R" => {
            first.trim().parse::<f64>().is_ok()
                && second.len() == 2
                && second.iter().all(|value| value.parse::<f64>().is_ok())
        }
        "R_with_nodes" => first.trim().parse::<f64>().is_ok() && second.len() == 2,
        "angles" => second.len() == 2 && second.iter().all(|value| value.parse::<f64>().is_ok()),
        _ => false,
    };
    if center.trim().is_empty() || first.trim().is_empty() || !valid {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }
    Ok((
        input,
        AstNode::Arc {
            mode: mode.to_string(),
            center: center.trim().to_string(),
            first: first.trim().to_string(),
            second,
            options,
        },
    ))
}

fn parse_tkz_draw_sector(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDrawSector")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, first_group) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let (center, first) = first_group.split_once(',').ok_or_else(|| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Count))
    })?;
    let (input, _) = multispace0(input)?;
    let (input, second_group) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let second: Vec<String> = second_group
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect();
    let option_items: Vec<&str> = options
        .as_deref()
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .collect();
    let mode = if option_items.contains(&"rotate") {
        "rotate"
    } else if option_items.contains(&"R with nodes") {
        "R_with_nodes"
    } else if option_items.contains(&"R") {
        "R"
    } else {
        "towards"
    };
    let valid = match mode {
        "towards" => second.len() == 1,
        "rotate" => second.len() == 1 && second[0].parse::<f64>().is_ok(),
        "R" => {
            first.trim().parse::<f64>().is_ok()
                && second.len() == 2
                && second.iter().all(|value| value.parse::<f64>().is_ok())
        }
        "R_with_nodes" => first.trim().parse::<f64>().is_ok() && second.len() == 2,
        _ => false,
    };
    if center.trim().is_empty() || first.trim().is_empty() || !valid {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }
    Ok((
        input,
        AstNode::Sector {
            mode: mode.to_string(),
            center: center.trim().to_string(),
            first: first.trim().to_string(),
            second,
            options,
        },
    ))
}

fn parse_tkz_fill_circle(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzFillCircle")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let (center, radius) = args.split_once(',').ok_or_else(|| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Count))
    })?;
    let option_items: Vec<&str> = options
        .as_deref()
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .collect();
    let mode = if option_items.contains(&"R") {
        "R"
    } else {
        "radius"
    };
    if center.trim().is_empty()
        || radius.trim().is_empty()
        || (mode == "R" && radius.trim().parse::<f64>().is_err())
    {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }
    Ok((
        input,
        AstNode::FillCircle {
            mode: mode.to_string(),
            center: center.trim().to_string(),
            radius: radius.trim().to_string(),
            options,
        },
    ))
}

fn parse_tkz_fill_polygon(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzFillPolygon")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points: Vec<String> = args
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect();
    if points.len() < 3 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((input, AstNode::FillPolygon { points, options }))
}

fn parse_tkz_fill_sector(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzFillSector")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, first_group) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let (center, first) = first_group.split_once(',').ok_or_else(|| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Count))
    })?;
    let (input, _) = multispace0(input)?;
    let (input, second_group) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let second: Vec<String> = second_group
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect();
    let option_items: Vec<&str> = options
        .as_deref()
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .collect();
    let mode = if option_items.contains(&"rotate") {
        "rotate"
    } else if option_items.contains(&"R with nodes") {
        "R_with_nodes"
    } else if option_items.contains(&"R") {
        "R"
    } else {
        "towards"
    };
    let valid = match mode {
        "towards" => second.len() == 1,
        "rotate" => second.len() == 1 && second[0].parse::<f64>().is_ok(),
        "R" => {
            first.trim().parse::<f64>().is_ok()
                && second.len() == 2
                && second.iter().all(|value| value.parse::<f64>().is_ok())
        }
        "R_with_nodes" => first.trim().parse::<f64>().is_ok() && second.len() == 2,
        _ => false,
    };
    if center.trim().is_empty() || first.trim().is_empty() || !valid {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }
    Ok((
        input,
        AstNode::FillSector {
            mode: mode.to_string(),
            center: center.trim().to_string(),
            first: first.trim().to_string(),
            second,
            options,
        },
    ))
}

fn parse_tkz_fill_angle(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzFillAngle")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points: Vec<&str> = args
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect();
    if points.len() != 3 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((
        input,
        AstNode::FillAngle {
            p1: points[0].to_string(),
            vertex: points[1].to_string(),
            p2: points[2].to_string(),
            options,
        },
    ))
}

fn parse_tkz_fill_angles(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzFillAngles")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let tokens: Vec<&str> = args.split_whitespace().collect();
    let mut angles = Vec::new();
    for token in tokens {
        let points: Vec<&str> = token
            .split(',')
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .collect();
        if points.len() != 3 {
            return Err(nom::Err::Error(nom::error::Error::new(
                input,
                nom::error::ErrorKind::Count,
            )));
        }
        angles.push([
            points[0].to_string(),
            points[1].to_string(),
            points[2].to_string(),
        ]);
    }
    if angles.is_empty() {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((input, AstNode::FillAngles { angles, options }))
}

fn option_number(options: &Option<String>, key: &str, fallback: f64) -> f64 {
    options
        .as_deref()
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .find_map(|option| {
            option
                .strip_prefix(&format!("{key}="))
                .and_then(|value| value.trim().parse::<f64>().ok())
        })
        .unwrap_or(fallback)
}

fn parse_tkz_init(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzInit")(input)?;
    let (input, options) = parse_optional_args(input)?;
    Ok((
        input,
        AstNode::CanvasInit {
            xmin: option_number(&options, "xmin", 0.0),
            xmax: option_number(&options, "xmax", 10.0),
            ymin: option_number(&options, "ymin", 0.0),
            ymax: option_number(&options, "ymax", 10.0),
            xstep: option_number(&options, "xstep", 1.0),
            ystep: option_number(&options, "ystep", 1.0),
            options,
        },
    ))
}

fn parse_tkz_clip_bb(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzClipBB")(input)?;
    Ok((input, AstNode::ClipBoundingBox))
}

fn parse_tkz_clip(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzClip")(input)?;
    let (input, options) = parse_optional_args(input)?;
    Ok((
        input,
        AstNode::CanvasClip {
            space: option_number(&options, "space", 0.0),
            options,
        },
    ))
}

fn parse_tkz_show_bb(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzShowBB")(input)?;
    let (input, options) = parse_optional_args(input)?;
    Ok((input, AstNode::ShowBoundingBox { options }))
}

fn style_kind_for_command(command: &str) -> Option<&'static str> {
    match command {
        "tkzSetUpPoint" => Some("point"),
        "tkzSetUpLine" => Some("line"),
        "tkzSetUpArc" => Some("arc"),
        "tkzSetUpCompass" => Some("compass"),
        "tkzSetUpLabel" => Some("label"),
        "tkzSetUpColors" => Some("colors"),
        _ => None,
    }
}

fn parse_tkz_style_setup(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzSetUp")(input)?;
    let suffix = input
        .split(|character: char| !character.is_ascii_alphanumeric())
        .next()
        .unwrap_or_default();
    let command = format!("tkzSetUp{suffix}");
    let Some(kind) = style_kind_for_command(&command) else {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Tag,
        )));
    };
    let (input, _) = tag(suffix)(input)?;
    let (input, options) = parse_optional_args(input)?;
    Ok((
        input,
        AstNode::StyleSetup {
            kind: kind.to_string(),
            command,
            options,
        },
    ))
}

fn parse_tkz_custom_style(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzSetUpStyle")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, name) = parse_braced_text(input)?;
    if name.trim().is_empty() {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Alpha,
        )));
    }
    Ok((
        input,
        AstNode::CustomStyle {
            name: name.trim().to_string(),
            options,
        },
    ))
}

fn parse_tkz_compass(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzCompass")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points: Vec<&str> = args
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect();
    if points.len() != 2 || points[0] == points[1] {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((
        input,
        AstNode::Compass {
            center: points[0].to_string(),
            through: points[1].to_string(),
            options,
        },
    ))
}

fn parse_tkz_compasses(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzCompasss")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let mut pairs = Vec::new();
    for token in args.split_whitespace() {
        let points: Vec<&str> = token
            .split(',')
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .collect();
        if points.len() != 2 || points[0] == points[1] {
            return Err(nom::Err::Error(nom::error::Error::new(
                input,
                nom::error::ErrorKind::Count,
            )));
        }
        pairs.push([points[0].to_string(), points[1].to_string()]);
    }
    if pairs.is_empty() {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((input, AstNode::Compasses { pairs, options }))
}

fn parse_tkz_show_line(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzShowLine")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let option_items: Vec<&str> = options
        .as_deref()
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .collect();
    let mut mode = "mediator";
    let mut through = None;
    for option in &option_items {
        let compact = option.replace(' ', "");
        if *option == "bisector" {
            mode = "bisector";
        } else if *option == "mediator" {
            mode = "mediator";
        } else {
            for candidate in ["perpendicular", "orthogonal", "parallel"] {
                let prefix = format!("{}=through", candidate);
                if compact.starts_with(&prefix) {
                    mode = candidate;
                    through = Some(compact[prefix.len()..].to_string());
                }
            }
        }
    }
    let (input, _) = multispace0(input)?;
    let (input, args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points: Vec<String> = args
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect();
    let valid = if mode == "bisector" {
        points.len() == 3
    } else {
        points.len() == 2
    };
    if !valid
        || (["perpendicular", "orthogonal", "parallel"].contains(&mode)
            && through.as_deref().unwrap_or_default().is_empty())
    {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }
    Ok((
        input,
        AstNode::ShowLine {
            mode: mode.to_string(),
            points,
            through,
            options,
        },
    ))
}

fn decode_show_transformation_options(options: &str) -> Option<(String, Vec<String>)> {
    for option in options
        .split(',')
        .map(str::trim)
        .filter(|part| !part.is_empty())
    {
        let Some((mode, references, _)) = decode_point_transformation_options(option) else {
            continue;
        };
        if ["translation", "reflection", "symmetry", "projection"].contains(&mode.as_str()) {
            return Some((mode, references));
        }
    }
    None
}

fn parse_tkz_show_transformation(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzShowTransformation")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (mode, references) = decode_show_transformation_options(
        options.as_deref().unwrap_or_default(),
    )
    .ok_or_else(|| nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Verify)))?;
    let (input, _) = multispace0(input)?;
    let (input, args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points = parse_point_names(args);
    if points.len() != 1 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((
        input,
        AstNode::ShowTransformation {
            mode,
            source: points[0].clone(),
            references,
            options,
        },
    ))
}

fn parse_tkz_protractor(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzProtractor")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points = parse_point_names(args);
    if points.len() != 2 || points[0] == points[1] {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((
        input,
        AstNode::Protractor {
            origin: points[0].clone(),
            direction: points[1].clone(),
            options,
        },
    ))
}

fn parse_tkz_clip_polygon(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzClipPolygon")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points: Vec<String> = args
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect();
    if points.len() < 3 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let out = options
        .as_deref()
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .any(|option| option == "out");
    Ok((
        input,
        AstNode::PolygonClip {
            points,
            out,
            options,
        },
    ))
}

fn parse_tkz_clip_circle(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzClipCircle")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let (center, radius_point) = args.split_once(',').ok_or_else(|| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Count))
    })?;
    if center.trim().is_empty() || radius_point.trim().is_empty() {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }
    let out = options
        .as_deref()
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .any(|option| option == "out");
    Ok((
        input,
        AstNode::CircleClip {
            center: center.trim().to_string(),
            radius_point: radius_point.trim().to_string(),
            out,
            options,
        },
    ))
}

fn parse_tkz_clip_sector(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzClipSector")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, first_group) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let (center, first) = first_group.split_once(',').ok_or_else(|| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Count))
    })?;
    let (input, _) = multispace0(input)?;
    let (input, second_group) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let second: Vec<String> = second_group
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect();
    let option_items: Vec<&str> = options
        .as_deref()
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .collect();
    let mode = if option_items.contains(&"rotate") {
        "rotate"
    } else if option_items.contains(&"R") {
        "R"
    } else {
        "towards"
    };
    let valid = match mode {
        "towards" => second.len() == 1,
        "rotate" => second.len() == 1 && second[0].parse::<f64>().is_ok(),
        "R" => {
            first.trim().parse::<f64>().is_ok()
                && second.len() == 2
                && second.iter().all(|value| value.parse::<f64>().is_ok())
        }
        _ => false,
    };
    if center.trim().is_empty() || first.trim().is_empty() || !valid {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }
    Ok((
        input,
        AstNode::SectorClip {
            mode: mode.to_string(),
            center: center.trim().to_string(),
            first: first.trim().to_string(),
            second,
            options,
        },
    ))
}

fn parse_tkz_mark_segment(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzMarkSegment")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points: Vec<&str> = args
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect();
    if points.len() != 2 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((
        input,
        AstNode::SegmentMark {
            p1: points[0].to_string(),
            p2: points[1].to_string(),
            options,
        },
    ))
}

fn parse_tkz_mark_segments(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzMarkSegments")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let mut pairs = Vec::new();
    for token in args.split_whitespace() {
        let points: Vec<&str> = token
            .split(',')
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .collect();
        if points.len() != 2 {
            return Err(nom::Err::Error(nom::error::Error::new(
                input,
                nom::error::ErrorKind::Count,
            )));
        }
        pairs.push([points[0].to_string(), points[1].to_string()]);
    }
    if pairs.is_empty() {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((input, AstNode::SegmentsMark { pairs, options }))
}

fn parse_tkz_mark_arc(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzMarkArc")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points: Vec<&str> = args
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect();
    if points.len() != 3 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((
        input,
        AstNode::ArcMark {
            center: points[0].to_string(),
            start: points[1].to_string(),
            end: points[2].to_string(),
            options,
        },
    ))
}

fn parse_tkz_draw_ellipse(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDrawEllipse")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, arguments) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let parts: Vec<&str> = arguments.split(',').map(str::trim).collect();
    if parts.len() != 4 || parts[0].is_empty() {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let x_radius = parts[1].parse::<f64>().map_err(|_| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Float))
    })?;
    let y_radius = parts[2].parse::<f64>().map_err(|_| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Float))
    })?;
    let angle = parts[3].parse::<f64>().map_err(|_| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Float))
    })?;
    if x_radius <= 0.0 || y_radius <= 0.0 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }
    Ok((
        input,
        AstNode::Ellipse {
            center: parts[0].to_string(),
            x_radius,
            y_radius,
            angle,
            options,
        },
    ))
}

fn parse_tkz_perpendicular_line(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefLine")(input)?;
    let (input, through) = delimited(tag("[orthogonal=through "), alphanumeric1, char(']'))(input)?;
    let (input, _) = multispace0(input)?;
    let (input, (p1, p2)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoint")(input)?;
    let (input, helper) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzDrawLine")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, (draw_from, draw_to)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;

    if draw_from != through || draw_to != helper {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }

    Ok((
        input,
        AstNode::PerpendicularLine {
            p1: p1.to_string(),
            p2: p2.to_string(),
            through: through.to_string(),
            helper: helper.to_string(),
            options,
        },
    ))
}

fn parse_tkz_projection_line(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefPointBy[projection=onto ")(input)?;
    let (input, p1) = alphanumeric1(input)?;
    let (input, _) = tag("--")(input)?;
    let (input, p2) = alphanumeric1(input)?;
    let (input, _) = char(']')(input)?;
    let (input, from) = delimited(char('('), alphanumeric1, char(')'))(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoint")(input)?;
    let (input, foot) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzDrawLine")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, (draw_from, draw_to)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;

    if draw_from != from || draw_to != foot {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }

    Ok((
        input,
        AstNode::ProjectionLine {
            p1: p1.to_string(),
            p2: p2.to_string(),
            from: from.to_string(),
            foot: foot.to_string(),
            options,
        },
    ))
}

fn parse_tkz_perpendicular_bisector(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefLine[mediator]")(input)?;
    let (input, _) = multispace0(input)?;
    let (input, (p1, p2)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoints")(input)?;
    let (input, helper1) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    let (input, helper2) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzDrawLine")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, (draw_from, draw_to)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;

    if draw_from != helper1 || draw_to != helper2 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }

    Ok((
        input,
        AstNode::PerpendicularBisector {
            p1: p1.to_string(),
            p2: p2.to_string(),
            helper1: helper1.to_string(),
            helper2: helper2.to_string(),
            options,
        },
    ))
}

fn parse_tkz_angle_bisector(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefLine[bisector]")(input)?;
    let (input, _) = multispace0(input)?;
    let (input, points) = delimited(
        char('('),
        separated_list1(char(','), alphanumeric1),
        char(')'),
    )(input)?;
    if points.len() != 3 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoint")(input)?;
    let (input, helper) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzDrawLine")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, (draw_from, draw_to)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;

    let p1 = points[0];
    let vertex = points[1];
    let p2 = points[2];
    if draw_from != vertex || draw_to != helper {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }

    Ok((
        input,
        AstNode::AngleBisector {
            p1: p1.to_string(),
            vertex: vertex.to_string(),
            p2: p2.to_string(),
            helper: helper.to_string(),
            options,
        },
    ))
}

fn parse_tkz_triangle_altitude(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefLine[altitude]")(input)?;
    let (input, _) = multispace0(input)?;
    let (input, points) = delimited(
        char('('),
        separated_list1(char(','), alphanumeric1),
        char(')'),
    )(input)?;
    if points.len() != 3 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoint")(input)?;
    let (input, foot) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzDrawSegment")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, (draw_from, draw_to)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;

    let side1 = points[0];
    let vertex = points[1];
    let side2 = points[2];
    if draw_from != vertex || draw_to != foot {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }

    Ok((
        input,
        AstNode::TriangleAltitude {
            side1: side1.to_string(),
            vertex: vertex.to_string(),
            side2: side2.to_string(),
            foot: foot.to_string(),
            options,
        },
    ))
}

fn parse_tkz_all_altitudes(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefSpcTriangle[ortho]")(input)?;
    let (input, _) = multispace0(input)?;
    let (input, points) = delimited(
        char('('),
        separated_list1(char(','), alphanumeric1),
        char(')'),
    )(input)?;
    let (input, feet) = delimited(
        char('{'),
        separated_list1(char(','), alphanumeric1),
        char('}'),
    )(input)?;
    if points.len() != 3 || feet.len() != 3 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }

    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzDefTriangleCenter[ortho]")(input)?;
    let (input, _) = multispace0(input)?;
    let (input, center_points) = delimited(
        char('('),
        separated_list1(char(','), alphanumeric1),
        char(')'),
    )(input)?;
    if center_points != points {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }

    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoint")(input)?;
    let (input, orthocenter) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzDrawSegments")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, draw_spec) = delimited(char('('), take_until(")"), char(')'))(input)?;

    let expected_draw_spec = format!(
        "{},{} {},{} {},{}",
        points[0], feet[0], points[1], feet[1], points[2], feet[2]
    );
    if draw_spec.trim() != expected_draw_spec {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }

    Ok((
        input,
        AstNode::AllAltitudes {
            p1: points[0].to_string(),
            p2: points[1].to_string(),
            p3: points[2].to_string(),
            foot1: feet[0].to_string(),
            foot2: feet[1].to_string(),
            foot3: feet[2].to_string(),
            orthocenter: orthocenter.to_string(),
            options,
        },
    ))
}

fn parse_tkz_triangle_center(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefTriangleCenter")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let option = options.unwrap_or_else(|| "circum".to_string());
    let supported = [
        "ortho",
        "orthic",
        "centroid",
        "median",
        "circum",
        "in",
        "ex",
        "euler",
        "gergonne",
        "symmedian",
        "lemoine",
        "grebe",
        "spieker",
        "nagel",
        "mittenpunkt",
        "feuerbach",
    ];
    if !supported.contains(&option.trim()) {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }
    let (input, _) = multispace0(input)?;
    let (input, points) = delimited(
        char('('),
        separated_list1(char(','), alphanumeric1),
        char(')'),
    )(input)?;
    if points.len() != 3 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoint")(input)?;
    let (input, name) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    Ok((
        input,
        AstNode::TriangleCenter {
            option: option.trim().to_string(),
            p1: points[0].to_string(),
            p2: points[1].to_string(),
            p3: points[2].to_string(),
            name: name.to_string(),
        },
    ))
}

fn parse_tkz_label_point(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzLabelPoint")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, point) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let (input, text) = parse_braced_text(input)?;
    let point = point.trim();
    if point.is_empty() {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((
        input,
        AstNode::LabelPoint {
            point: point.to_string(),
            text,
            options,
        },
    ))
}

fn parse_tkz_label_points(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzLabelPoints")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, specification) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points = parse_point_names(specification);
    if points.is_empty() {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((input, AstNode::LabelPoints { points, options }))
}

fn parse_tkz_auto_label_points(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzAutoLabelPoints")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, specification) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points = parse_point_names(specification);
    if points.is_empty() {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let center = option_value(options.as_deref(), "center");
    let distance =
        option_value(options.as_deref(), "dist").and_then(|value| value.parse::<f64>().ok());
    Ok((
        input,
        AstNode::AutoLabelPoints {
            points,
            center,
            distance,
            options,
        },
    ))
}

fn parse_tkz_label_segment(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzLabelSegment")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, (p1, p2)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;
    let (input, text) = parse_braced_text(input)?;
    Ok((
        input,
        AstNode::LabelSegment {
            p1: p1.to_string(),
            p2: p2.to_string(),
            text,
            options,
        },
    ))
}

fn parse_tkz_label_segments(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzLabelSegments")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, specification) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let pairs = parse_pair_list(specification).ok_or_else(|| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Count))
    })?;
    let (input, text) = parse_braced_text(input)?;
    Ok((
        input,
        AstNode::LabelSegments {
            pairs,
            text,
            options,
        },
    ))
}

fn parse_tkz_label_line(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzLabelLine")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, (p1, p2)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;
    let (input, text) = parse_braced_text(input)?;
    Ok((
        input,
        AstNode::LabelLine {
            p1: p1.to_string(),
            p2: p2.to_string(),
            text,
            options,
        },
    ))
}

fn parse_tkz_label_angle_parts(
    input: &str,
) -> IResult<&str, (Vec<String>, Option<String>, String)> {
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzLabelAngle")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, specification) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points = parse_point_names(specification);
    let (input, label) = parse_braced_text(input)?;
    Ok((input, (points, options, label)))
}

fn parse_tkz_label_angle(input: &str) -> IResult<&str, AstNode> {
    let (input, (points, options, text)) = parse_tkz_label_angle_parts(input)?;
    if points.len() != 3 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((
        input,
        AstNode::LabelAngle {
            p1: points[0].clone(),
            vertex: points[1].clone(),
            p2: points[2].clone(),
            text,
            options,
        },
    ))
}

fn parse_tkz_label_angles(input: &str) -> IResult<&str, AstNode> {
    let (input, (angles, options)) = parse_angle_triples(input, "\\tkzLabelAngles")?;
    let (input, text) = parse_braced_text(input)?;
    Ok((
        input,
        AstNode::LabelAngles {
            angles,
            text,
            options,
        },
    ))
}

fn parse_tkz_label_circle(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzLabelCircle")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, (center, radius_point)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;
    let (input, _) = multispace0(input)?;
    let (input, angle) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let (input, text) = parse_braced_text(input)?;
    Ok((
        input,
        AstNode::LabelCircle {
            center: center.to_string(),
            radius_point: radius_point.to_string(),
            angle: angle.trim().to_string(),
            text,
            options,
        },
    ))
}

fn parse_tkz_label_arc(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzLabelArc")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, points) = delimited(
        char('('),
        separated_list1(char(','), alphanumeric1),
        char(')'),
    )(input)?;
    if points.len() != 3 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (input, text) = parse_braced_text(input)?;
    Ok((
        input,
        AstNode::LabelArc {
            center: points[0].to_string(),
            start: points[1].to_string(),
            end: points[2].to_string(),
            text,
            options,
        },
    ))
}

fn parse_tkz_mark_angle(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzMarkAngle")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, points) = delimited(
        char('('),
        separated_list1(char(','), alphanumeric1),
        char(')'),
    )(input)?;
    if points.len() != 3 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }

    let points: Vec<String> = points.into_iter().map(String::from).collect();
    let mut rest = input;
    let mut label = None;
    if let Ok((label_rest, (label_points, _label_options, parsed_label))) =
        parse_tkz_label_angle_parts(input)
    {
        if label_points == points {
            rest = label_rest;
            label = Some(parsed_label);
        }
    }

    Ok((
        rest,
        AstNode::AngleMark {
            p1: points[0].clone(),
            vertex: points[1].clone(),
            p2: points[2].clone(),
            options,
            label,
        },
    ))
}

fn parse_angle_triples<'a>(
    input: &'a str,
    command: &str,
) -> IResult<&'a str, (Vec<[String; 3]>, Option<String>)> {
    let (input, _) = tag(command)(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let mut angles = Vec::new();
    for token in args.split_whitespace() {
        let points: Vec<&str> = token
            .split(',')
            .map(str::trim)
            .filter(|point| !point.is_empty())
            .collect();
        if points.len() != 3 {
            return Err(nom::Err::Error(nom::error::Error::new(
                input,
                nom::error::ErrorKind::Count,
            )));
        }
        angles.push([
            points[0].to_string(),
            points[1].to_string(),
            points[2].to_string(),
        ]);
    }
    if angles.is_empty() {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((input, (angles, options)))
}

fn parse_tkz_mark_angles(input: &str) -> IResult<&str, AstNode> {
    let (input, (angles, options)) = parse_angle_triples(input, "\\tkzMarkAngles")?;
    Ok((input, AstNode::AnglesMark { angles, options }))
}

fn parse_tkz_mark_right_angle(input: &str) -> IResult<&str, AstNode> {
    let (input, (angles, options)) = parse_angle_triples(input, "\\tkzMarkRightAngle")?;
    if angles.len() != 1 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let [p1, vertex, p2] = angles.into_iter().next().unwrap();
    Ok((
        input,
        AstNode::RightAngleMark {
            p1,
            vertex,
            p2,
            options,
        },
    ))
}

fn parse_tkz_mark_right_angles(input: &str) -> IResult<&str, AstNode> {
    let (input, (angles, options)) = parse_angle_triples(input, "\\tkzMarkRightAngles")?;
    Ok((input, AstNode::RightAnglesMark { angles, options }))
}

fn parse_tkz_pic_angle(input: &str) -> IResult<&str, AstNode> {
    let (input, (angles, options)) = parse_angle_triples(input, "\\tkzPicAngle")?;
    if angles.len() != 1 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let [p1, vertex, p2] = angles.into_iter().next().unwrap();
    Ok((
        input,
        AstNode::PicAngle {
            p1,
            vertex,
            p2,
            options,
        },
    ))
}

fn parse_tkz_pic_right_angle(input: &str) -> IResult<&str, AstNode> {
    let (input, (angles, options)) = parse_angle_triples(input, "\\tkzPicRightAngle")?;
    if angles.len() != 1 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let [p1, vertex, p2] = angles.into_iter().next().unwrap();
    Ok((
        input,
        AstNode::PicRightAngle {
            p1,
            vertex,
            p2,
            options,
        },
    ))
}

fn parse_tkz_intersection(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzInterLL")(input)?;
    let (input, (p1, p2)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;
    let (input, (p3, p4)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoint")(input)?;
    let (input, name) = delimited(char('{'), alphanumeric1, char('}'))(input)?;

    Ok((
        input,
        AstNode::IntersectionPoint {
            p1: p1.to_string(),
            p2: p2.to_string(),
            p3: p3.to_string(),
            p4: p4.to_string(),
            name: name.to_string(),
        },
    ))
}

fn parse_tkz_midpoint(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefMidPoint")(input)?;
    let (input, _) = multispace0(input)?;
    let (input, (p1, p2)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoint")(input)?;
    let (input, name) = delimited(char('{'), alphanumeric1, char('}'))(input)?;

    Ok((
        input,
        AstNode::MidPoint {
            p1: p1.to_string(),
            p2: p2.to_string(),
            name: name.to_string(),
        },
    ))
}

fn parse_tkz_golden_ratio(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefGoldenRatio")(input)?;
    let (input, _) = multispace0(input)?;
    let (input, (p1, p2)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoint")(input)?;
    let (input, name) = delimited(char('{'), alphanumeric1, char('}'))(input)?;

    Ok((
        input,
        AstNode::GoldenRatioPoint {
            p1: p1.to_string(),
            p2: p2.to_string(),
            name: name.to_string(),
        },
    ))
}

fn parse_tkz_barycentric_point(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefBarycentricPoint")(input)?;
    let (input, _) = multispace0(input)?;
    let (input, specification) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let terms: Option<Vec<(String, f64)>> = specification
        .split(',')
        .map(|term| {
            let (point, weight) = term.split_once('=')?;
            Some((point.trim().to_string(), weight.trim().parse::<f64>().ok()?))
        })
        .collect();
    let terms = terms.filter(|terms| terms.len() >= 2).ok_or_else(|| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Count))
    })?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoint")(input)?;
    let (input, name) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    let (points, weights) = terms.into_iter().unzip();

    Ok((
        input,
        AstNode::BarycentricPoint {
            points,
            weights,
            name: name.to_string(),
        },
    ))
}

fn parse_tkz_similitude_center(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefSimilitudeCenter")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let kind = if options
        .as_deref()
        .is_some_and(|value| value.trim() == "int")
    {
        "int"
    } else {
        "ext"
    };
    let (input, _) = multispace0(input)?;
    let (input, (center1, radius1)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;
    let (input, (center2, radius2)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoint")(input)?;
    let (input, name) = delimited(char('{'), alphanumeric1, char('}'))(input)?;

    Ok((
        input,
        AstNode::SimilitudeCenter {
            kind: kind.to_string(),
            center1: center1.to_string(),
            radius1: radius1.to_string(),
            center2: center2.to_string(),
            radius2: radius2.to_string(),
            name: name.to_string(),
        },
    ))
}

fn parse_tkz_harmonic(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefHarmonic")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let mode = options.as_deref().unwrap_or("both").trim();
    let (input, _) = multispace0(input)?;
    let (input, specification) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let parts: Vec<&str> = specification.split(',').map(str::trim).collect();
    if parts.len() != 3 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (input, _) = multispace0(input)?;

    if mode == "both" {
        let ratio = parts[2]
            .trim_matches(['{', '}'])
            .parse::<f64>()
            .map_err(|_| {
                nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Float))
            })?;
        let (input, _) = tag("\\tkzGetPoints")(input)?;
        let (input, name1) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
        let (input, name2) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
        Ok((
            input,
            AstNode::HarmonicPair {
                p1: parts[0].to_string(),
                p2: parts[1].to_string(),
                ratio,
                name1: name1.to_string(),
                name2: name2.to_string(),
            },
        ))
    } else {
        let (input, _) = tag("\\tkzGetPoint")(input)?;
        let (input, name) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
        Ok((
            input,
            AstNode::HarmonicPoint {
                mode: mode.to_string(),
                p1: parts[0].to_string(),
                p2: parts[1].to_string(),
                known: parts[2].to_string(),
                name: name.to_string(),
            },
        ))
    }
}

fn parse_tkz_equi_points(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefEquiPoints")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let options = options.unwrap_or_default();
    let from = options
        .split(',')
        .find_map(|option| option.trim().strip_prefix("from=").map(str::trim))
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Tag))
        })?;
    let distance = options
        .split(',')
        .find_map(|option| option.trim().strip_prefix("dist=").map(str::trim))
        .and_then(|value| value.parse::<f64>().ok())
        .unwrap_or(2.0);
    let show = options.split(',').any(|option| option.trim() == "show");
    let (input, _) = multispace0(input)?;
    let (input, (p1, p2)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoints")(input)?;
    let (input, name1) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    let (input, name2) = delimited(char('{'), alphanumeric1, char('}'))(input)?;

    Ok((
        input,
        AstNode::EquiPoints {
            p1: p1.to_string(),
            p2: p2.to_string(),
            from: from.to_string(),
            distance,
            show,
            name1: name1.to_string(),
            name2: name2.to_string(),
        },
    ))
}

fn parse_tkz_mid_arc(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefMidArc")(input)?;
    let (input, _) = multispace0(input)?;
    let (input, points) = delimited(
        char('('),
        separated_list1(char(','), alphanumeric1),
        char(')'),
    )(input)?;
    if points.len() != 3 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoint")(input)?;
    let (input, name) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    Ok((
        input,
        AstNode::MidArcPoint {
            center: points[0].to_string(),
            start: points[1].to_string(),
            end: points[2].to_string(),
            name: name.to_string(),
        },
    ))
}

fn parse_tkz_point_on_line(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefPointOnLine")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let position = options
        .as_deref()
        .and_then(|value| value.trim().strip_prefix("pos="))
        .and_then(|value| value.trim().parse::<f64>().ok())
        .ok_or_else(|| {
            nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Float))
        })?;
    let (input, _) = multispace0(input)?;
    let (input, (p1, p2)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoint")(input)?;
    let (input, name) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    Ok((
        input,
        AstNode::PointOnLine {
            p1: p1.to_string(),
            p2: p2.to_string(),
            position,
            name: name.to_string(),
        },
    ))
}

fn parse_tkz_point_on_circle(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefPointOnCircle")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let options = options.unwrap_or_default();
    let (mode, definition) = options.split_once('=').ok_or_else(|| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Tag))
    })?;
    let tokens: Vec<&str> = definition.split_whitespace().collect();
    if tokens.len() != 6 || tokens[0] != "center" || tokens[2] != "angle" {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }
    let angle = tokens[3].parse::<f64>().map_err(|_| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Float))
    })?;
    let (through, radius) = if mode.trim() == "through" && tokens[4] == "point" {
        (Some(tokens[5].to_string()), None)
    } else if mode.trim() == "R" && tokens[4] == "radius" {
        let radius = tokens[5].parse::<f64>().map_err(|_| {
            nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Float))
        })?;
        (None, Some(radius))
    } else {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    };
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoint")(input)?;
    let (input, name) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    Ok((
        input,
        AstNode::PointOnCircle {
            mode: mode.trim().to_string(),
            center: tokens[1].to_string(),
            angle,
            through,
            radius,
            name: name.to_string(),
        },
    ))
}

fn decode_point_transformation_options(
    options: &str,
) -> Option<(String, Vec<String>, Option<String>)> {
    let (option_name, definition) = options.split_once('=')?;
    let mode = option_name.trim().replace(' ', "_");
    let tokens: Vec<&str> = definition.split_whitespace().collect();
    let (references, value) = match mode.as_str() {
        "translation" if tokens.len() == 4 && tokens[0] == "from" && tokens[2] == "to" => {
            (vec![tokens[1].to_string(), tokens[3].to_string()], None)
        }
        "homothety" if tokens.len() == 4 && tokens[0] == "center" && tokens[2] == "ratio" => {
            (vec![tokens[1].to_string()], Some(tokens[3].to_string()))
        }
        "symmetry" if tokens.len() == 2 && tokens[0] == "center" => {
            (vec![tokens[1].to_string()], None)
        }
        "rotation" | "rotation_in_rad"
            if tokens.len() == 4 && tokens[0] == "center" && tokens[2] == "angle" =>
        {
            (vec![tokens[1].to_string()], Some(tokens[3].to_string()))
        }
        "rotation_with_nodes"
            if tokens.len() == 6
                && tokens[0] == "center"
                && tokens[2] == "from"
                && tokens[4] == "to" =>
        {
            (
                vec![
                    tokens[1].to_string(),
                    tokens[3].to_string(),
                    tokens[5].to_string(),
                ],
                None,
            )
        }
        "inversion" | "inversion_negative"
            if tokens.len() == 4 && tokens[0] == "center" && tokens[2] == "through" =>
        {
            (vec![tokens[1].to_string(), tokens[3].to_string()], None)
        }
        "reflection" if definition.trim().starts_with("over ") => {
            let (p1, p2) = definition.trim()[5..].split_once("--")?;
            (vec![p1.trim().to_string(), p2.trim().to_string()], None)
        }
        "projection" if definition.trim().starts_with("onto ") => {
            let (p1, p2) = definition.trim()[5..].split_once("--")?;
            (vec![p1.trim().to_string(), p2.trim().to_string()], None)
        }
        _ => return None,
    };
    Some((mode, references, value))
}

fn parse_tkz_point_transformation(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefPointBy")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (mode, references, value) = decode_point_transformation_options(
        options.as_deref().unwrap_or_default(),
    )
    .ok_or_else(|| nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Verify)))?;

    let (input, _) = multispace0(input)?;
    let (input, source) = delimited(char('('), alphanumeric1, char(')'))(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoint")(input)?;
    let (input, name) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    Ok((
        input,
        AstNode::PointTransformation {
            mode,
            source: source.to_string(),
            references,
            value,
            name: name.to_string(),
        },
    ))
}

fn parse_tkz_points_transformation(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefPointsBy")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (mode, references, value) = decode_point_transformation_options(
        options.as_deref().unwrap_or_default(),
    )
    .ok_or_else(|| nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Verify)))?;
    let (input, _) = multispace0(input)?;
    let (input, source_list) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let sources: Vec<String> = source_list
        .split(',')
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(str::to_string)
        .collect();
    if sources.is_empty() {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (input, _) = multispace0(input)?;
    let (input, image_list) = delimited(char('{'), take_until("}"), char('}'))(input)?;
    let names: Vec<String> = if image_list.trim().is_empty() {
        sources.iter().map(|source| format!("{source}'")).collect()
    } else {
        image_list
            .split(',')
            .map(str::trim)
            .filter(|name| !name.is_empty())
            .map(str::to_string)
            .collect()
    };
    if names.len() != sources.len() {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((
        input,
        AstNode::PointsTransformation {
            mode,
            sources,
            references,
            value,
            names,
        },
    ))
}

fn parse_tkz_vector_point(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefPointWith")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let options = options.unwrap_or_default();
    let parts: Vec<&str> = options
        .split(',')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .collect();
    let condition = parts.first().copied().unwrap_or_default();
    let factor = parts
        .iter()
        .skip(1)
        .find_map(|part| {
            part.strip_prefix("K=")
                .or_else(|| part.strip_prefix("k="))
                .and_then(|value| value.trim().parse::<f64>().ok())
        })
        .unwrap_or(1.0);
    let (mode, anchor) = if condition == "orthogonal" {
        ("orthogonal".to_string(), None)
    } else if condition == "orthogonal normed" {
        ("orthogonal_normed".to_string(), None)
    } else if condition == "linear" {
        ("linear".to_string(), None)
    } else if condition == "linear normed" {
        ("linear_normed".to_string(), None)
    } else if let Some(value) = condition.strip_prefix("colinear normed=") {
        let anchor = value
            .trim()
            .strip_prefix("at ")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        ("colinear_normed".to_string(), anchor.map(str::to_string))
    } else if let Some(value) = condition.strip_prefix("colinear=") {
        let anchor = value
            .trim()
            .strip_prefix("at ")
            .map(str::trim)
            .filter(|value| !value.is_empty());
        ("colinear".to_string(), anchor.map(str::to_string))
    } else {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    };
    if mode.starts_with("colinear") && anchor.is_none() {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }
    let (input, _) = multispace0(input)?;
    let (input, (p1, p2)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoint")(input)?;
    let (input, name) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    Ok((
        input,
        AstNode::VectorPoint {
            mode,
            p1: p1.to_string(),
            p2: p2.to_string(),
            anchor,
            factor,
            name: name.to_string(),
        },
    ))
}

fn parse_tkz_vector_coordinates(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzGetVectxy")(input)?;
    let (input, _) = multispace0(input)?;
    let (input, (p1, p2)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;
    let (input, _) = multispace0(input)?;
    let (input, macro_name) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    Ok((
        input,
        AstNode::VectorCoordinates {
            p1: p1.to_string(),
            p2: p2.to_string(),
            macro_name: macro_name.to_string(),
        },
    ))
}

fn parse_tkz_point_coordinates(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzGetPointCoord")(input)?;
    let (input, _) = multispace0(input)?;
    let (input, point) = delimited(char('('), alphanumeric1, char(')'))(input)?;
    let (input, _) = multispace0(input)?;
    let (input, macro_name) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    Ok((
        input,
        AstNode::PointCoordinates {
            point: point.to_string(),
            macro_name: macro_name.to_string(),
        },
    ))
}

fn parse_tkz_swap_points(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzSwapPoints")(input)?;
    let (input, _) = multispace0(input)?;
    let (input, args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points = parse_point_names(args);
    if points.len() != 2 || points[0] == points[1] {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((
        input,
        AstNode::SwapPoints {
            p1: points[0].clone(),
            p2: points[1].clone(),
        },
    ))
}

fn parse_duplicate_segment_get_point(input: &str) -> IResult<&str, String> {
    let (input, _) = multispace0(input)?;
    if input.starts_with('{') {
        let (input, name) = delimited(char('{'), take_until("}"), char('}'))(input)?;
        return Ok((input, name.trim().to_string()));
    }
    let (input, _) = tag("\\tkzGetPoint")(input)?;
    let (input, name) = delimited(char('{'), take_until("}"), char('}'))(input)?;
    Ok((input, name.trim().to_string()))
}

fn parse_tkz_duplicate_segment(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = alt((
        tag("\\tkzDuplicateSegment"),
        tag("\\tkzDuplicateLength"),
        tag("\\tkzDuplicateLen"),
    ))(input)?;
    let (input, _) = multispace0(input)?;
    let (input, ray_args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let ray_points = parse_point_names(ray_args);
    let (input, _) = multispace0(input)?;
    let (input, segment_args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let segment_points = parse_point_names(segment_args);
    if ray_points.len() != 2
        || segment_points.len() != 2
        || ray_points[0] == ray_points[1]
        || segment_points[0] == segment_points[1]
    {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (input, name) = parse_duplicate_segment_get_point(input)?;
    if name.is_empty() {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }
    Ok((
        input,
        AstNode::DuplicateSegment {
            ray_start: ray_points[0].clone(),
            ray_through: ray_points[1].clone(),
            segment_start: segment_points[0].clone(),
            segment_end: segment_points[1].clone(),
            name,
        },
    ))
}

fn parse_tkz_radical_axis(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefRadicalAxis")(input)?;
    let (input, _) = multispace0(input)?;
    let (input, first_args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let circle1 = parse_point_names(first_args);
    let (input, _) = multispace0(input)?;
    let (input, second_args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let circle2 = parse_point_names(second_args);
    if circle1.len() != 2
        || circle2.len() != 2
        || circle1[0] == circle1[1]
        || circle2[0] == circle2[1]
        || circle1[0] == circle2[0]
    {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (input, _) = multispace0(input)?;
    let (input, (first, second)) = preceded_get_points(input)?;
    Ok((
        input,
        AstNode::RadicalAxis {
            circle1,
            circle2,
            results: vec![first.to_string(), second.to_string()],
        },
    ))
}

fn parse_tkz_defined_line(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefLine")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let options = options.unwrap_or_default();
    let parts: Vec<&str> = options
        .split(',')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .collect();
    let definition = parts.first().copied().unwrap_or("mediator");
    let factor = parts
        .iter()
        .skip(1)
        .find_map(|part| {
            part.strip_prefix("K=")
                .and_then(|value| value.trim().parse::<f64>().ok())
        })
        .unwrap_or(1.0);
    let normed = parts.contains(&"normed");
    let (mode, through) = if definition == "mediator" {
        ("mediator".to_string(), None)
    } else if ["bisector", "bisector out", "symmedian", "altitude", "euler"].contains(&definition) {
        (definition.replace(' ', "_"), None)
    } else {
        let (name, value) = definition.split_once('=').ok_or_else(|| {
            nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Verify))
        })?;
        let name = name.trim();
        let value = value.trim();
        if ["perpendicular", "orthogonal", "parallel"].contains(&name) {
            let point = value
                .strip_prefix("through ")
                .map(str::trim)
                .filter(|point| !point.is_empty());
            (name.to_string(), point.map(str::to_string))
        } else if name == "tangent at" || name == "tangent from" {
            (name.replace(' ', "_"), Some(value.to_string()))
        } else {
            return Err(nom::Err::Error(nom::error::Error::new(
                input,
                nom::error::ErrorKind::Verify,
            )));
        }
    };
    if [
        "perpendicular",
        "orthogonal",
        "parallel",
        "tangent_at",
        "tangent_from",
    ]
    .contains(&mode.as_str())
        && through.is_none()
    {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }
    let (input, _) = multispace0(input)?;
    let (input, point_list) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points: Vec<String> = point_list
        .split(',')
        .map(str::trim)
        .filter(|point| !point.is_empty())
        .map(str::to_string)
        .collect();
    let expected_points = if mode == "tangent_at" {
        1
    } else if [
        "mediator",
        "perpendicular",
        "orthogonal",
        "parallel",
        "tangent_from",
    ]
    .contains(&mode.as_str())
    {
        2
    } else {
        3
    };
    if points.len() != expected_points {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (input, _) = multispace0(input)?;
    let get_two = map(preceded_get_points, |(first, second)| {
        vec![first.to_string(), second.to_string()]
    });
    let get_one = map(preceded_get_point, |name| vec![name.to_string()]);
    let (input, results) = alt((get_two, get_one))(input)?;
    let expected_results = if ["mediator", "euler", "tangent_from"].contains(&mode.as_str()) {
        2
    } else {
        1
    };
    if results.len() != expected_results {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((
        input,
        AstNode::DefinedLine {
            mode,
            points,
            through,
            factor,
            normed,
            results,
        },
    ))
}

fn preceded_get_point(input: &str) -> IResult<&str, &str> {
    let (input, _) = tag("\\tkzGetPoint")(input)?;
    delimited(char('{'), alphanumeric1, char('}'))(input)
}

fn preceded_get_points(input: &str) -> IResult<&str, (&str, &str)> {
    let (input, _) = tag("\\tkzGetPoints")(input)?;
    let (input, first) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    let (input, second) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    Ok((input, (first, second)))
}

fn parse_tkz_defined_triangle(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefTriangle")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let options = options.unwrap_or_else(|| "equilateral".to_string());
    let parts: Vec<&str> = options
        .split(',')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .collect();
    let definition = parts.first().copied().unwrap_or("equilateral");
    let swap = parts.contains(&"swap");
    let (mode, angle1, angle2) = if let Some(value) = definition.strip_prefix("two angles") {
        let values = value
            .trim()
            .strip_prefix('=')
            .map(str::trim)
            .and_then(|angles| angles.split_once(" and "));
        let (first, second) = values.ok_or_else(|| {
            nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Verify))
        })?;
        let first = first.trim().parse::<f64>().map_err(|_| {
            nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Float))
        })?;
        let second = second.trim().parse::<f64>().map_err(|_| {
            nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Float))
        })?;
        if first <= 0.0 || second <= 0.0 || first + second >= 180.0 {
            return Err(nom::Err::Error(nom::error::Error::new(
                input,
                nom::error::ErrorKind::Verify,
            )));
        }
        ("two_angles".to_string(), Some(first), Some(second))
    } else {
        let mode = definition.replace(' ', "_");
        let supported = [
            "equilateral",
            "half",
            "isosceles_right",
            "pythagore",
            "pythagoras",
            "egyptian",
            "school",
            "gold",
            "euclid",
            "golden",
            "sublime",
            "cheops",
        ];
        if !supported.contains(&mode.as_str()) {
            return Err(nom::Err::Error(nom::error::Error::new(
                input,
                nom::error::ErrorKind::Verify,
            )));
        }
        (mode, None, None)
    };
    let (input, _) = multispace0(input)?;
    let (input, (p1, p2)) = delimited(
        char('('),
        separated_pair(alphanumeric1, char(','), alphanumeric1),
        char(')'),
    )(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoint")(input)?;
    let (input, name) = delimited(char('{'), alphanumeric1, char('}'))(input)?;
    Ok((
        input,
        AstNode::DefinedTriangle {
            mode,
            p1: p1.to_string(),
            p2: p2.to_string(),
            angle1,
            angle2,
            swap,
            name: name.to_string(),
        },
    ))
}

fn parse_tkz_associated_triangle(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefSpcTriangle")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let options = options.unwrap_or_else(|| "centroid".to_string());
    let parts: Vec<&str> = options
        .split(',')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .collect();
    let mode = parts.first().copied().unwrap_or("centroid");
    let supported = [
        "orthic",
        "ortho",
        "centroid",
        "medial",
        "in",
        "incentral",
        "ex",
        "excentral",
        "extouch",
        "intouch",
        "contact",
        "euler",
        "symmedial",
        "tangential",
        "feuerbach",
    ];
    if !supported.contains(&mode) {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }
    let name_prefix = parts
        .iter()
        .skip(1)
        .find_map(|part| part.strip_prefix("name=").map(str::trim))
        .filter(|prefix| !prefix.is_empty())
        .map(str::to_string);
    let (input, _) = multispace0(input)?;
    let (input, point_list) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points: Vec<String> = point_list
        .split(',')
        .map(str::trim)
        .filter(|point| !point.is_empty())
        .map(str::to_string)
        .collect();
    if points.len() != 3 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (input, _) = multispace0(input)?;
    let (input, suffix_list) = delimited(char('{'), take_until("}"), char('}'))(input)?;
    let suffixes: Vec<String> = suffix_list
        .split(',')
        .map(str::trim)
        .filter(|suffix| !suffix.is_empty())
        .map(str::to_string)
        .collect();
    if suffixes.len() != 3 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let results = suffixes
        .iter()
        .map(|suffix| format!("{}{}", name_prefix.as_deref().unwrap_or(""), suffix))
        .collect();
    Ok((
        input,
        AstNode::AssociatedTriangle {
            mode: mode.to_string(),
            p1: points[0].clone(),
            p2: points[1].clone(),
            p3: points[2].clone(),
            name_prefix,
            results,
        },
    ))
}

fn parse_tkz_polygon_construction(input: &str) -> IResult<&str, AstNode> {
    if let Some(input) = input.strip_prefix("\\tkzPermute") {
        let (input, point_list) = delimited(char('('), take_until(")"), char(')'))(input)?;
        let points: Vec<String> = point_list
            .split(',')
            .map(str::trim)
            .filter(|point| !point.is_empty())
            .map(str::to_string)
            .collect();
        if points.len() != 3 {
            return Err(nom::Err::Error(nom::error::Error::new(
                input,
                nom::error::ErrorKind::Count,
            )));
        }
        return Ok((
            input,
            AstNode::PolygonConstruction {
                mode: "permute".to_string(),
                results: vec![points[1].clone(), points[2].clone()],
                points,
                regular_mode: None,
                sides: None,
                name_prefix: None,
            },
        ));
    }

    if let Some(input) = input.strip_prefix("\\tkzDefRegPolygon") {
        let (input, options) = parse_optional_args(input)?;
        let options: Vec<&str> = options
            .as_deref()
            .unwrap_or("")
            .split(',')
            .map(str::trim)
            .filter(|option| !option.is_empty())
            .collect();
        let regular_mode = if options.contains(&"side") {
            "side"
        } else {
            "center"
        };
        let sides = options
            .iter()
            .find_map(|option| {
                option
                    .strip_prefix("sides=")
                    .and_then(|value| value.trim().parse::<usize>().ok())
            })
            .unwrap_or(5);
        if sides < 3 {
            return Err(nom::Err::Error(nom::error::Error::new(
                input,
                nom::error::ErrorKind::Verify,
            )));
        }
        let name_prefix = options
            .iter()
            .find_map(|option| option.strip_prefix("name=").map(str::trim))
            .filter(|value| !value.is_empty())
            .unwrap_or("P")
            .to_string();
        let (input, point_list) = delimited(char('('), take_until(")"), char(')'))(input)?;
        let points: Vec<String> = point_list
            .split(',')
            .map(str::trim)
            .filter(|point| !point.is_empty())
            .map(str::to_string)
            .collect();
        if points.len() != 2 {
            return Err(nom::Err::Error(nom::error::Error::new(
                input,
                nom::error::ErrorKind::Count,
            )));
        }
        let results = (1..=sides)
            .map(|index| format!("{name_prefix}{index}"))
            .collect();
        return Ok((
            input,
            AstNode::PolygonConstruction {
                mode: "regular_polygon".to_string(),
                points,
                results,
                regular_mode: Some(regular_mode.to_string()),
                sides: Some(sides),
                name_prefix: Some(name_prefix),
            },
        ));
    }

    let (input, mode, result_count) = if let Some(rest) = input.strip_prefix("\\tkzDefSquare") {
        (rest, "square", 2)
    } else if let Some(rest) = input.strip_prefix("\\tkzDefRectangle") {
        (rest, "rectangle", 2)
    } else if let Some(rest) = input.strip_prefix("\\tkzDefGoldenRectangle") {
        (rest, "golden_rectangle", 2)
    } else if let Some(rest) = input.strip_prefix("\\tkzDefGoldRectangle") {
        (rest, "golden_rectangle", 2)
    } else if let Some(rest) = input.strip_prefix("\\tkzDefParallelogram") {
        (rest, "parallelogram", 1)
    } else {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Tag,
        )));
    };
    let (input, point_list) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points: Vec<String> = point_list
        .split(',')
        .map(str::trim)
        .filter(|point| !point.is_empty())
        .map(str::to_string)
        .collect();
    let expected_points = if mode == "parallelogram" { 3 } else { 2 };
    if points.len() != expected_points {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (input, _) = multispace0(input)?;
    let (input, results) = if result_count == 2 {
        let (input, _) = tag("\\tkzGetPoints")(input)?;
        let (input, first) = delimited(char('{'), take_until("}"), char('}'))(input)?;
        let (input, second) = delimited(char('{'), take_until("}"), char('}'))(input)?;
        (
            input,
            vec![first.trim().to_string(), second.trim().to_string()],
        )
    } else {
        let (input, _) = tag("\\tkzGetPoint")(input)?;
        let (input, result) = delimited(char('{'), take_until("}"), char('}'))(input)?;
        (input, vec![result.trim().to_string()])
    };
    Ok((
        input,
        AstNode::PolygonConstruction {
            mode: mode.to_string(),
            points,
            results,
            regular_mode: None,
            sides: None,
            name_prefix: None,
        },
    ))
}

fn parse_tkz_defined_circle(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefCircle")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let option_parts: Vec<&str> = options
        .as_deref()
        .unwrap_or("circum")
        .split(',')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .collect();
    let raw_mode = option_parts.first().copied().unwrap_or("circum");
    let (mode, references) = if let Some(reference) = raw_mode.strip_prefix("orthogonal from=") {
        ("orthogonal_from", vec![reference.trim().to_string()])
    } else if let Some(reference_list) = raw_mode.strip_prefix("orthogonal through=") {
        let references: Vec<String> = reference_list
            .split(" and ")
            .map(str::trim)
            .map(str::to_string)
            .collect();
        if references.len() != 2 {
            return Err(nom::Err::Error(nom::error::Error::new(
                input,
                nom::error::ErrorKind::Count,
            )));
        }
        ("orthogonal_through", references)
    } else {
        (raw_mode, Vec::new())
    };
    let supported = [
        "R",
        "diameter",
        "circum",
        "in",
        "ex",
        "euler",
        "nine",
        "spieker",
        "apollonius",
        "orthogonal_from",
        "orthogonal_through",
    ];
    if !supported.contains(&mode) {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }
    let (input, argument_list) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let arguments: Vec<String> = argument_list
        .split(',')
        .map(str::trim)
        .filter(|argument| !argument.is_empty())
        .map(str::to_string)
        .collect();
    let value = if mode == "R" {
        arguments
            .get(1)
            .and_then(|argument| argument.parse::<f64>().ok())
    } else if mode == "apollonius" {
        option_parts
            .iter()
            .find_map(|part| {
                part.strip_prefix("K=")
                    .and_then(|number| number.trim().parse::<f64>().ok())
            })
            .or(Some(1.0))
    } else {
        None
    };
    let points = if mode == "R" {
        arguments.iter().take(1).cloned().collect()
    } else {
        arguments
    };
    let expected_points = if mode == "R" {
        1
    } else if [
        "diameter",
        "apollonius",
        "orthogonal_from",
        "orthogonal_through",
    ]
    .contains(&mode)
    {
        2
    } else {
        3
    };
    if points.len() != expected_points {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (after_space, _) = multispace0(input)?;
    let (input, results) = if let Some(rest) = after_space.strip_prefix("\\tkzGetPoints") {
        let (rest, first) = delimited(char('{'), take_until("}"), char('}'))(rest)?;
        let (rest, second) = delimited(char('{'), take_until("}"), char('}'))(rest)?;
        (
            rest,
            vec![first.trim().to_string(), second.trim().to_string()],
        )
    } else if let Some(rest) = after_space.strip_prefix("\\tkzGetPoint") {
        let (rest, result) = delimited(char('{'), take_until("}"), char('}'))(rest)?;
        (rest, vec![result.trim().to_string()])
    } else {
        (
            input,
            if mode == "R" {
                vec!["tkzPointResult".to_string()]
            } else {
                vec![
                    "tkzFirstPointResult".to_string(),
                    "tkzSecondPointResult".to_string(),
                ]
            },
        )
    };
    let center = if mode == "R" {
        points[0].clone()
    } else if mode == "orthogonal_from" {
        references[0].clone()
    } else {
        results[0].clone()
    };
    let radius_point = if mode == "R" {
        results[0].clone()
    } else if results.len() > 1 {
        results[1].clone()
    } else if mode == "diameter" {
        points[1].clone()
    } else {
        "tkzSecondPointResult".to_string()
    };
    Ok((
        input,
        AstNode::DefinedCircle {
            mode: mode.to_string(),
            points,
            references,
            value,
            results,
            center,
            radius_point,
        },
    ))
}

fn parse_tkz_projected_excenters(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefProjExcenter")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let name_prefix = options
        .as_deref()
        .unwrap_or("")
        .split(',')
        .map(str::trim)
        .find_map(|option| option.strip_prefix("name=").map(str::trim))
        .unwrap_or("")
        .to_string();
    let (input, triangle_list) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let triangle: Vec<String> = triangle_list
        .split(',')
        .map(str::trim)
        .map(str::to_string)
        .collect();
    if triangle.len() != 3 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (input, suffix_list) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let excenter_suffixes: Vec<String> = suffix_list
        .split(',')
        .map(str::trim)
        .map(str::to_string)
        .collect();
    let (input, projection_list) = delimited(char('{'), take_until("}"), char('}'))(input)?;
    let projection_prefixes: Vec<String> = projection_list
        .split(',')
        .map(str::trim)
        .map(str::to_string)
        .collect();
    if excenter_suffixes.len() != 3 || projection_prefixes.len() != 3 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let results = projection_prefixes
        .iter()
        .flat_map(|projection| {
            excenter_suffixes
                .iter()
                .map(move |suffix| format!("{projection}{suffix}"))
        })
        .collect();
    Ok((
        input,
        AstNode::ProjectedExcenters {
            p1: triangle[0].clone(),
            p2: triangle[1].clone(),
            p3: triangle[2].clone(),
            name_prefix,
            excenter_suffixes,
            projection_prefixes,
            results,
        },
    ))
}

fn parse_tkz_circle_transformation(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefCircleBy")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (mode, references, value) = decode_point_transformation_options(
        options.as_deref().unwrap_or_default(),
    )
    .ok_or_else(|| nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Verify)))?;
    if ![
        "translation",
        "homothety",
        "reflection",
        "symmetry",
        "projection",
        "rotation",
        "inversion",
    ]
    .contains(&mode.as_str())
    {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }
    let (input, pair) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points: Vec<String> = pair.split(',').map(str::trim).map(str::to_string).collect();
    if points.len() != 2 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoints")(input)?;
    let (input, first) = delimited(char('{'), take_until("}"), char('}'))(input)?;
    let (input, second) = delimited(char('{'), take_until("}"), char('}'))(input)?;
    Ok((
        input,
        AstNode::CircleTransformation {
            mode,
            center: points[0].clone(),
            radius_point: points[1].clone(),
            references,
            value,
            results: vec![first.trim().to_string(), second.trim().to_string()],
        },
    ))
}

fn parse_tkz_inter_lc(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzInterLC")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let options: Vec<&str> = options
        .as_deref()
        .unwrap_or("")
        .split(',')
        .map(str::trim)
        .filter(|option| !option.is_empty())
        .collect();
    let mode = if options.contains(&"R") {
        "R"
    } else if options.contains(&"with nodes") {
        "with_nodes"
    } else {
        "N"
    };
    let near = options.contains(&"near");
    let common = options
        .iter()
        .find_map(|option| option.strip_prefix("common=").map(str::trim))
        .filter(|point| !point.is_empty())
        .map(str::to_string);
    let (input, line_list) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let line: Vec<String> = line_list
        .split(',')
        .map(str::trim)
        .map(str::to_string)
        .collect();
    let (input, circle_list) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let arguments: Vec<String> = circle_list
        .split(',')
        .map(str::trim)
        .map(str::to_string)
        .collect();
    if line.len() != 2 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (circle, radius) = if mode == "R" {
        if arguments.len() != 2 {
            return Err(nom::Err::Error(nom::error::Error::new(
                input,
                nom::error::ErrorKind::Count,
            )));
        }
        let radius = arguments[1].parse::<f64>().map_err(|_| {
            nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Float))
        })?;
        (vec![arguments[0].clone()], Some(radius))
    } else {
        let expected = if mode == "with_nodes" { 3 } else { 2 };
        if arguments.len() != expected {
            return Err(nom::Err::Error(nom::error::Error::new(
                input,
                nom::error::ErrorKind::Count,
            )));
        }
        (arguments, None)
    };
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoints")(input)?;
    let (input, first) = delimited(char('{'), take_until("}"), char('}'))(input)?;
    let (input, second) = delimited(char('{'), take_until("}"), char('}'))(input)?;
    Ok((
        input,
        AstNode::LineCircleIntersection {
            mode: mode.to_string(),
            line,
            circle,
            radius,
            near,
            common,
            results: vec![first.trim().to_string(), second.trim().to_string()],
        },
    ))
}

fn parse_tkz_test_inter_lc(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzTestInterLC")(input)?;
    let (input, line_list) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let (input, circle_list) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let line: Vec<String> = line_list
        .split(',')
        .map(str::trim)
        .map(str::to_string)
        .collect();
    let circle: Vec<String> = circle_list
        .split(',')
        .map(str::trim)
        .map(str::to_string)
        .collect();
    if line.len() != 2 || circle.len() != 2 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((input, AstNode::LineCircleTest { line, circle }))
}

fn parse_tkz_inter_cc(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzInterCC")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let options: Vec<&str> = options
        .as_deref()
        .unwrap_or("")
        .split(',')
        .map(str::trim)
        .filter(|option| !option.is_empty())
        .collect();
    let mode = if options.contains(&"R") {
        "R"
    } else if options.contains(&"with nodes") {
        "with_nodes"
    } else {
        "N"
    };
    let common = options
        .iter()
        .find_map(|option| option.strip_prefix("common=").map(str::trim))
        .filter(|point| !point.is_empty())
        .map(str::to_string);
    let (input, first_list) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let (input, second_list) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let arguments: Vec<Vec<String>> = [first_list, second_list]
        .iter()
        .map(|list| list.split(',').map(str::trim).map(str::to_string).collect())
        .collect();
    let (circles, radii) = if mode == "R" {
        if arguments.iter().any(|circle| circle.len() != 2) {
            return Err(nom::Err::Error(nom::error::Error::new(
                input,
                nom::error::ErrorKind::Count,
            )));
        }
        let radii = arguments
            .iter()
            .map(|circle| circle[1].parse::<f64>())
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| {
                nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Float))
            })?;
        (
            arguments
                .iter()
                .map(|circle| vec![circle[0].clone()])
                .collect(),
            Some(radii),
        )
    } else {
        let expected = if mode == "with_nodes" { 3 } else { 2 };
        if arguments.iter().any(|circle| circle.len() != expected) {
            return Err(nom::Err::Error(nom::error::Error::new(
                input,
                nom::error::ErrorKind::Count,
            )));
        }
        (arguments, None)
    };
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoints")(input)?;
    let (input, first) = delimited(char('{'), take_until("}"), char('}'))(input)?;
    let (input, second) = delimited(char('{'), take_until("}"), char('}'))(input)?;
    Ok((
        input,
        AstNode::CircleCircleIntersection {
            mode: mode.to_string(),
            circles,
            radii,
            common,
            results: vec![first.trim().to_string(), second.trim().to_string()],
        },
    ))
}

fn parse_tkz_test_inter_cc(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzTestInterCC")(input)?;
    let (input, first_list) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let (input, second_list) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let circles: Vec<Vec<String>> = [first_list, second_list]
        .iter()
        .map(|list| list.split(',').map(str::trim).map(str::to_string).collect())
        .collect();
    if circles.iter().any(|circle| circle.len() != 2) {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((input, AstNode::CircleCircleTest { circles }))
}

fn parse_tkz_linearity_test(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzIsLinear")(input)?;
    let (input, args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points = parse_point_names(args);
    if points.len() != 3
        || points
            .iter()
            .collect::<std::collections::BTreeSet<_>>()
            .len()
            != 3
    {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((input, AstNode::LinearityTest { points }))
}

fn parse_tkz_orthogonality_test(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzIsOrtho")(input)?;
    let (input, args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points = parse_point_names(args);
    if points.len() != 3 || points[0] == points[1] || points[0] == points[2] {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    Ok((input, AstNode::OrthogonalityTest { points }))
}

fn parse_get_angle_value(input: &str) -> IResult<&str, String> {
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetAngle")(input)?;
    let (input, macro_name) = delimited(char('{'), take_until("}"), char('}'))(input)?;
    Ok((input, macro_name.trim().to_string()))
}

fn parse_optional_get_angle(input: &str) -> IResult<&str, Option<String>> {
    opt(parse_get_angle_value)(input)
}

fn parse_get_length_value(input: &str) -> IResult<&str, String> {
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetLength")(input)?;
    let (input, macro_name) = delimited(char('{'), take_until("}"), char('}'))(input)?;
    Ok((input, macro_name.trim().to_string()))
}

fn parse_get_result_value(input: &str) -> IResult<&str, String> {
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetResult")(input)?;
    let (input, macro_name) = delimited(char('{'), take_until("}"), char('}'))(input)?;
    Ok((input, macro_name.trim().to_string()))
}

fn parse_tkz_calc_length(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzCalcLength")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let (input, _) = multispace0(input)?;
    let (input, args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points = parse_point_names(args);
    if points.len() != 2 || points[0] == points[1] {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (input, macro_name) = opt(parse_get_length_value)(input)?;
    Ok((
        input,
        AstNode::LengthCalculation {
            p1: points[0].clone(),
            p2: points[1].clone(),
            macro_name,
            options,
        },
    ))
}

fn parse_tkz_dot_product(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDotProduct")(input)?;
    let (input, _) = multispace0(input)?;
    let (input, args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points = parse_point_names(args);
    if points.len() != 3 || points[0] == points[1] || points[0] == points[2] {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (input, macro_name) = opt(parse_get_result_value)(input)?;
    Ok((
        input,
        AstNode::DotProduct {
            p1: points[0].clone(),
            p2: points[1].clone(),
            p3: points[2].clone(),
            macro_name,
        },
    ))
}

fn parse_tkz_power_circle(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzPowerCircle")(input)?;
    let (input, _) = multispace0(input)?;
    let (input, point) = delimited(char('('), alphanumeric1, char(')'))(input)?;
    let (input, _) = multispace0(input)?;
    let (input, circle_args) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let circle = parse_point_names(circle_args);
    if circle.len() != 2 || circle[0] == circle[1] {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (input, macro_name) = opt(parse_get_result_value)(input)?;
    Ok((
        input,
        AstNode::PowerCircle {
            point: point.to_string(),
            center: circle[0].clone(),
            radius_point: circle[1].clone(),
            macro_name,
        },
    ))
}

fn parse_tkz_unit_conversion(input: &str) -> IResult<&str, AstNode> {
    let (input, command) = alt((tag("\\tkzpttocm"), tag("\\tkzcmtopt")))(input)?;
    let mode = if command == "\\tkzpttocm" {
        "pt_to_cm"
    } else {
        "cm_to_pt"
    };
    let (input, _) = multispace0(input)?;
    let (input, value) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let (input, _) = multispace0(input)?;
    let (input, macro_name) = delimited(char('{'), take_until("}"), char('}'))(input)?;
    if value.trim().is_empty() || macro_name.trim().is_empty() {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Verify,
        )));
    }
    Ok((
        input,
        AstNode::UnitConversion {
            mode: mode.to_string(),
            value: value.trim().to_string(),
            macro_name: macro_name.trim().to_string(),
        },
    ))
}

fn parse_tkz_find_angle(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzFindAngle")(input)?;
    let (input, point_list) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points: Vec<String> = point_list
        .split(',')
        .map(str::trim)
        .map(str::to_string)
        .collect();
    if points.len() != 3 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (input, macro_name) = parse_optional_get_angle(input)?;
    Ok((
        input,
        AstNode::AngleCalculation {
            mode: "angle".to_string(),
            points,
            macro_name,
        },
    ))
}

fn parse_tkz_find_slope_angle(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzFindSlopeAngle")(input)?;
    let (input, point_list) = delimited(char('('), take_until(")"), char(')'))(input)?;
    let points: Vec<String> = point_list
        .split(',')
        .map(str::trim)
        .map(str::to_string)
        .collect();
    if points.len() != 2 {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (input, macro_name) = parse_optional_get_angle(input)?;
    Ok((
        input,
        AstNode::AngleCalculation {
            mode: "slope".to_string(),
            points,
            macro_name,
        },
    ))
}

fn parse_tkz_get_angle(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzGetAngle")(input)?;
    let (input, macro_name) = delimited(char('{'), take_until("}"), char('}'))(input)?;
    Ok((
        input,
        AstNode::AngleRetrieval {
            macro_name: macro_name.trim().to_string(),
        },
    ))
}

fn parse_tkz_random_point(input: &str) -> IResult<&str, AstNode> {
    let (input, _) = tag("\\tkzDefRandPointOn")(input)?;
    let (input, options) = parse_optional_args(input)?;
    let option = options.as_deref().unwrap_or("").trim();
    let normalized = option.replace(" =", "=").replace("= ", "=");
    let option = normalized.as_str();
    let (mode, references, radius) = if let Some(value) = option.strip_prefix("rectangle=") {
        let points: Vec<String> = value
            .split(" and ")
            .map(str::trim)
            .map(str::to_string)
            .collect();
        ("rectangle", points, None)
    } else if let Some(value) = option.strip_prefix("segment=") {
        let points: Vec<String> = value
            .split("--")
            .map(str::trim)
            .map(str::to_string)
            .collect();
        ("segment", points, None)
    } else if let Some(value) = option.strip_prefix("line=") {
        let points: Vec<String> = value
            .split("--")
            .map(str::trim)
            .map(str::to_string)
            .collect();
        ("line", points, None)
    } else if let Some(value) = option.strip_prefix("circle through=") {
        let value = value.trim().strip_prefix("center ").unwrap_or(value.trim());
        let points: Vec<String> = value
            .split(" through ")
            .map(str::trim)
            .map(str::to_string)
            .collect();
        ("circle_through", points, None)
    } else if let Some(value) = option.strip_prefix("disk through=") {
        let value = value.trim().strip_prefix("center ").unwrap_or(value.trim());
        let points: Vec<String> = value
            .split(" through ")
            .map(str::trim)
            .map(str::to_string)
            .collect();
        ("disk_through", points, None)
    } else if let Some(value) = option.strip_prefix("circle=") {
        let value = value.trim().strip_prefix("center ").unwrap_or(value.trim());
        let parts: Vec<&str> = value.split(" radius ").map(str::trim).collect();
        if parts.len() != 2 {
            return Err(nom::Err::Error(nom::error::Error::new(
                input,
                nom::error::ErrorKind::Count,
            )));
        }
        let radius = parts[1].parse::<f64>().map_err(|_| {
            nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Float))
        })?;
        ("circle", vec![parts[0].to_string()], Some(radius))
    } else {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Tag,
        )));
    };
    let expected = if mode == "circle" { 1 } else { 2 };
    if references.len() != expected || references.iter().any(String::is_empty) {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Count,
        )));
    }
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("\\tkzGetPoint")(input)?;
    let (input, name) = delimited(char('{'), take_until("}"), char('}'))(input)?;
    Ok((
        input,
        AstNode::RandomPoint {
            mode: mode.to_string(),
            references,
            radius,
            name: name.trim().to_string(),
        },
    ))
}

fn parse_any_node(input: &str) -> IResult<&str, AstNode> {
    let command = input
        .strip_prefix('\\')
        .and_then(|rest| {
            rest.split(|character: char| !character.is_ascii_alphanumeric())
                .next()
        })
        .unwrap_or_default();

    match command {
        "tkzDefPoint" => parse_tkz_def_point(input),
        "tkzDrawLines" => parse_tkz_draw_lines(input),
        "tkzDrawLine" => parse_tkz_draw_line(input),
        "tkzDrawSegments" => parse_tkz_draw_segments(input),
        "tkzDrawSegment" => parse_tkz_draw_segment(input),
        "tkzDrawPolySeg" => parse_tkz_draw_polyseg(input),
        "tkzDrawSemiCircles" => parse_tkz_draw_semicircles(input),
        "tkzDrawSemiCircle" => parse_tkz_draw_semicircle(input),
        "tkzDrawCircles" => parse_tkz_draw_circles(input),
        "tkzDrawPolygon" => parse_tkz_draw_polygon(input),
        "tkzDrawCircle" => parse_tkz_draw_circle(input),
        "tkzDrawEllipse" => parse_tkz_draw_ellipse(input),
        "tkzDrawArc" => parse_tkz_draw_arc(input),
        "tkzDrawSector" => parse_tkz_draw_sector(input),
        "tkzDefLine" => alt((
            parse_tkz_perpendicular_line,
            parse_tkz_perpendicular_bisector,
            parse_tkz_angle_bisector,
            parse_tkz_triangle_altitude,
            parse_tkz_defined_line,
        ))(input),
        "tkzDefPointBy" => alt((parse_tkz_projection_line, parse_tkz_point_transformation))(input),
        "tkzDefSpcTriangle" => alt((parse_tkz_all_altitudes, parse_tkz_associated_triangle))(input),
        "tkzDefTriangleCenter" => parse_tkz_triangle_center(input),
        "tkzPicRightAngle" => parse_tkz_pic_right_angle(input),
        "tkzPicAngle" => parse_tkz_pic_angle(input),
        "tkzLabelPoint" => parse_tkz_label_point(input),
        "tkzLabelPoints" => parse_tkz_label_points(input),
        "tkzAutoLabelPoints" => parse_tkz_auto_label_points(input),
        "tkzLabelSegment" => parse_tkz_label_segment(input),
        "tkzLabelSegments" => parse_tkz_label_segments(input),
        "tkzLabelLine" => parse_tkz_label_line(input),
        "tkzLabelAngle" => parse_tkz_label_angle(input),
        "tkzLabelAngles" => parse_tkz_label_angles(input),
        "tkzLabelCircle" => parse_tkz_label_circle(input),
        "tkzLabelArc" => parse_tkz_label_arc(input),
        "tkzMarkRightAngles" => parse_tkz_mark_right_angles(input),
        "tkzMarkRightAngle" => parse_tkz_mark_right_angle(input),
        "tkzMarkAngles" => parse_tkz_mark_angles(input),
        "tkzMarkAngle" => parse_tkz_mark_angle(input),
        "tkzInterLL" => parse_tkz_intersection(input),
        "tkzDefMidPoint" => parse_tkz_midpoint(input),
        "tkzDefGoldenRatio" => parse_tkz_golden_ratio(input),
        "tkzDefBarycentricPoint" => parse_tkz_barycentric_point(input),
        "tkzDefSimilitudeCenter" => parse_tkz_similitude_center(input),
        "tkzDefHarmonic" => parse_tkz_harmonic(input),
        "tkzDefEquiPoints" => parse_tkz_equi_points(input),
        "tkzDefMidArc" => parse_tkz_mid_arc(input),
        "tkzDefPointOnLine" => parse_tkz_point_on_line(input),
        "tkzDefPointOnCircle" => parse_tkz_point_on_circle(input),
        "tkzDefPointsBy" => parse_tkz_points_transformation(input),
        "tkzDefPointWith" => parse_tkz_vector_point(input),
        "tkzGetVectxy" => parse_tkz_vector_coordinates(input),
        "tkzGetPointCoord" => parse_tkz_point_coordinates(input),
        "tkzSwapPoints" => parse_tkz_swap_points(input),
        "tkzDuplicateSegment" | "tkzDuplicateLength" | "tkzDuplicateLen" => {
            parse_tkz_duplicate_segment(input)
        }
        "tkzDefRadicalAxis" => parse_tkz_radical_axis(input),
        "tkzDefTriangle" => parse_tkz_defined_triangle(input),
        "tkzPermute"
        | "tkzDefRegPolygon"
        | "tkzDefSquare"
        | "tkzDefRectangle"
        | "tkzDefGoldenRectangle"
        | "tkzDefGoldRectangle"
        | "tkzDefParallelogram" => parse_tkz_polygon_construction(input),
        "tkzDefCircle" => parse_tkz_defined_circle(input),
        "tkzDefProjExcenter" => parse_tkz_projected_excenters(input),
        "tkzDefCircleBy" => parse_tkz_circle_transformation(input),
        "tkzInterLC" => parse_tkz_inter_lc(input),
        "tkzTestInterLC" => parse_tkz_test_inter_lc(input),
        "tkzInterCC" => parse_tkz_inter_cc(input),
        "tkzTestInterCC" => parse_tkz_test_inter_cc(input),
        "tkzIsLinear" => parse_tkz_linearity_test(input),
        "tkzIsOrtho" => parse_tkz_orthogonality_test(input),
        "tkzFindAngle" => parse_tkz_find_angle(input),
        "tkzFindSlopeAngle" => parse_tkz_find_slope_angle(input),
        "tkzGetAngle" => parse_tkz_get_angle(input),
        "tkzCalcLength" => parse_tkz_calc_length(input),
        "tkzpttocm" | "tkzcmtopt" => parse_tkz_unit_conversion(input),
        "tkzDotProduct" => parse_tkz_dot_product(input),
        "tkzPowerCircle" => parse_tkz_power_circle(input),
        "tkzDefRandPointOn" => parse_tkz_random_point(input),
        "tkzFillCircle" => parse_tkz_fill_circle(input),
        "tkzFillPolygon" => parse_tkz_fill_polygon(input),
        "tkzFillSector" => parse_tkz_fill_sector(input),
        "tkzFillAngles" => parse_tkz_fill_angles(input),
        "tkzFillAngle" => parse_tkz_fill_angle(input),
        "tkzInit" => parse_tkz_init(input),
        "tkzClipBB" => parse_tkz_clip_bb(input),
        "tkzClipPolygon" => parse_tkz_clip_polygon(input),
        "tkzClipCircle" => parse_tkz_clip_circle(input),
        "tkzClipSector" => parse_tkz_clip_sector(input),
        "tkzClip" => parse_tkz_clip(input),
        "tkzShowBB" => parse_tkz_show_bb(input),
        "tkzSetUpStyle" => parse_tkz_custom_style(input),
        "tkzSetUpPoint" | "tkzSetUpLine" | "tkzSetUpArc" | "tkzSetUpCompass" | "tkzSetUpLabel"
        | "tkzSetUpColors" => parse_tkz_style_setup(input),
        "tkzCompasss" => parse_tkz_compasses(input),
        "tkzCompass" => parse_tkz_compass(input),
        "tkzShowLine" => parse_tkz_show_line(input),
        "tkzShowTransformation" => parse_tkz_show_transformation(input),
        "tkzProtractor" => parse_tkz_protractor(input),
        "tkzMarkSegments" => parse_tkz_mark_segments(input),
        "tkzMarkSegment" => parse_tkz_mark_segment(input),
        "tkzMarkArc" => parse_tkz_mark_arc(input),
        _ if command.starts_with("tkz") => parse_any_node_fallback(input),
        _ => Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Tag,
        ))),
    }
}

fn parse_any_node_fallback(input: &str) -> IResult<&str, AstNode> {
    alt((
        alt((
            parse_tkz_def_point,
            parse_tkz_draw_lines,
            parse_tkz_draw_line,
            parse_tkz_draw_segments,
            parse_tkz_draw_segment,
            parse_tkz_draw_polyseg,
            parse_tkz_draw_semicircles,
            parse_tkz_draw_semicircle,
            parse_tkz_draw_circles,
            parse_tkz_draw_polygon,
            parse_tkz_draw_circle,
            parse_tkz_draw_ellipse,
            parse_tkz_draw_arc,
            parse_tkz_draw_sector,
            parse_tkz_perpendicular_line,
            parse_tkz_projection_line,
            parse_tkz_perpendicular_bisector,
            parse_tkz_angle_bisector,
            parse_tkz_triangle_altitude,
            parse_tkz_all_altitudes,
            parse_tkz_triangle_center,
        )),
        alt((
            alt((
                parse_tkz_pic_right_angle,
                parse_tkz_pic_angle,
                parse_tkz_label_point,
                parse_tkz_label_points,
                parse_tkz_auto_label_points,
                parse_tkz_label_segment,
                parse_tkz_label_segments,
                parse_tkz_label_line,
                parse_tkz_label_angle,
                parse_tkz_label_angles,
                parse_tkz_label_circle,
                parse_tkz_label_arc,
                parse_tkz_mark_right_angles,
                parse_tkz_mark_right_angle,
                parse_tkz_mark_angles,
                parse_tkz_mark_angle,
            )),
            alt((
                parse_tkz_intersection,
                parse_tkz_midpoint,
                parse_tkz_golden_ratio,
                parse_tkz_barycentric_point,
                parse_tkz_similitude_center,
                parse_tkz_harmonic,
                parse_tkz_equi_points,
                parse_tkz_mid_arc,
                parse_tkz_point_on_line,
                parse_tkz_point_on_circle,
                parse_tkz_point_transformation,
            )),
            alt((
                parse_tkz_points_transformation,
                parse_tkz_vector_point,
                parse_tkz_vector_coordinates,
                parse_tkz_point_coordinates,
                parse_tkz_swap_points,
                parse_tkz_duplicate_segment,
                parse_tkz_radical_axis,
                parse_tkz_defined_line,
                parse_tkz_defined_triangle,
                parse_tkz_associated_triangle,
                parse_tkz_polygon_construction,
                parse_tkz_defined_circle,
            )),
        )),
        alt((
            alt((
                parse_tkz_projected_excenters,
                parse_tkz_circle_transformation,
                parse_tkz_inter_lc,
                parse_tkz_test_inter_lc,
                parse_tkz_inter_cc,
                parse_tkz_test_inter_cc,
                parse_tkz_linearity_test,
                parse_tkz_orthogonality_test,
            )),
            alt((
                alt((
                    parse_tkz_find_angle,
                    parse_tkz_find_slope_angle,
                    parse_tkz_get_angle,
                    parse_tkz_calc_length,
                    parse_tkz_unit_conversion,
                    parse_tkz_dot_product,
                    parse_tkz_power_circle,
                    parse_tkz_random_point,
                    parse_tkz_fill_circle,
                    parse_tkz_fill_polygon,
                    parse_tkz_fill_sector,
                    parse_tkz_fill_angles,
                    parse_tkz_fill_angle,
                )),
                alt((
                    parse_tkz_init,
                    parse_tkz_clip_bb,
                    parse_tkz_clip_polygon,
                    parse_tkz_clip_circle,
                    parse_tkz_clip_sector,
                    parse_tkz_mark_segments,
                    parse_tkz_mark_segment,
                    parse_tkz_mark_arc,
                )),
                alt((
                    parse_tkz_custom_style,
                    parse_tkz_style_setup,
                    parse_tkz_compasses,
                    parse_tkz_compass,
                    parse_tkz_show_line,
                )),
                parse_tkz_clip,
                parse_tkz_show_bb,
            )),
        )),
    ))(input)
}

fn elapsed_ms(start: Instant) -> f64 {
    start.elapsed().as_secs_f64() * 1000.0
}

pub fn parse_tikz_code(source: &str) -> ParseResult {
    let total_start = Instant::now();
    let parse_start = Instant::now();
    let mut nodes: Vec<AstNode> = Vec::new();
    let mut current = source;

    while !current.is_empty() {
        if let Ok((rest, node)) = parse_any_node(current) {
            let generated_right_angle = match (&node, nodes.last()) {
                (
                    AstNode::RightAngleMark { p1, vertex, p2, .. },
                    Some(AstNode::ProjectionLine {
                        from,
                        foot,
                        p1: base,
                        ..
                    }),
                ) => p1 == from && vertex == foot && p2 == base,
                (
                    AstNode::RightAngleMark { p1, vertex, p2, .. },
                    Some(AstNode::TriangleAltitude {
                        vertex: altitude_vertex,
                        foot,
                        side1,
                        ..
                    }),
                ) => p1 == altitude_vertex && vertex == foot && p2 == side1,
                (
                    AstNode::RightAnglesMark { angles, .. },
                    Some(AstNode::AllAltitudes {
                        p1,
                        p2,
                        p3,
                        foot1,
                        foot2,
                        foot3,
                        ..
                    }),
                ) => {
                    angles
                        == &vec![
                            [p1.clone(), foot1.clone(), p3.clone()],
                            [p2.clone(), foot2.clone(), p1.clone()],
                            [p3.clone(), foot3.clone(), p1.clone()],
                        ]
                }
                _ => false,
            };
            if !generated_right_angle {
                nodes.push(node);
            }
            current = rest;
        } else if let Some(idx) = current.find('\\') {
            if idx > 0 {
                current = &current[idx..];
            } else {
                current = &current[1..];
            }
        } else {
            break;
        }
    }

    let parse_ms = elapsed_ms(parse_start);
    let geometry = resolve_geometry(&nodes);
    let resolved_point_count = geometry.points.len();
    let render_scene = RenderScenePayload {
        points: geometry.points.clone(),
        view_box: geometry
            .viewport
            .as_ref()
            .map(|viewport| viewport.view_box.clone()),
        geometry_complete: geometry.complete,
        diagnostics: geometry.diagnostics.clone(),
    };
    let timings = ParseTimings {
        parse_ms,
        geometry_ms: geometry.timings.resolve_ms,
        viewport_ms: geometry.timings.viewport_ms,
        total_ms: elapsed_ms(total_start),
        node_count: nodes.len(),
        resolved_point_count,
    };
    ParseResult {
        nodes,
        resolved_points: geometry.points,
        geometry_complete: geometry.complete,
        viewport: geometry.viewport,
        render_scene,
        timings,
    }
}

#[tauri::command]
pub fn parse_tikz(source: String) -> Result<ParseResult, String> {
    Ok(parse_tikz_code(&source))
}

#[cfg(test)]
mod tests {
    use super::{parse_tikz_code, AstNode};
    use std::env;

    #[test]
    fn returns_parse_performance_timings() {
        let result = parse_tikz_code(
            r"\tkzDefPoint(0,0){A}\tkzDefPoint(2,0){B}\tkzDefMidPoint(A,B)\tkzGetPoint{M}",
        );
        assert_eq!(result.timings.node_count, result.nodes.len());
        assert_eq!(
            result.timings.resolved_point_count,
            result.resolved_points.len()
        );
        assert!(result.timings.total_ms >= result.timings.parse_ms);
        assert!(result.timings.geometry_ms >= 0.0);
        assert!(result.timings.viewport_ms >= 0.0);
    }

    #[test]
    fn serializes_render_scene_without_duplicate_top_level_points() {
        let result = parse_tikz_code(r"\tkzDefPoint(1,2){A}");
        let serialized = serde_json::to_value(&result).expect("parse result should serialize");
        assert!(serialized.get("resolved_points").is_none());
        assert_eq!(
            serialized["renderScene"]["points"]["A"]["x"]
                .as_f64()
                .expect("point x should serialize"),
            1.0
        );
        assert!(serialized["renderScene"]["geometryComplete"]
            .as_bool()
            .unwrap_or(false));
    }

    #[test]
    fn serializes_partial_render_scene_diagnostics() {
        let result = parse_tikz_code(r"\tkzDefPoint(1,2){A}\tkzDefMidPoint(A,B)\tkzGetPoint{M}");
        let serialized = serde_json::to_value(&result).expect("parse result should serialize");

        assert!(!serialized["renderScene"]["geometryComplete"]
            .as_bool()
            .unwrap_or(true));
        assert_eq!(
            serialized["renderScene"]["points"]["A"]["x"]
                .as_f64()
                .expect("partial point should serialize"),
            1.0
        );
        assert_eq!(
            serialized["renderScene"]["diagnostics"][0]["nodeType"],
            "MidPoint"
        );
        assert_eq!(
            serialized["renderScene"]["diagnostics"][0]["targets"][0],
            "M"
        );
    }

    #[test]
    fn parses_single_and_multiple_draw_lines_and_segments() {
        let source = r"\tkzDrawLine[add=1 and 2](A,B)
\tkzDrawLines[dashed](A,C B,D)
\tkzDrawSegment[dim={$5$,10pt,midway}](A,D)
\tkzDrawSegments[red](A,B C,D)";
        let result = parse_tikz_code(source);
        assert!(matches!(&result.nodes[0], AstNode::Line { p1, p2, .. } if p1 == "A" && p2 == "B"));
        assert!(matches!(&result.nodes[1], AstNode::Lines { pairs, .. } if pairs.len() == 2));
        assert!(
            matches!(&result.nodes[2], AstNode::Segment { options: Some(options), .. } if options.contains("dim="))
        );
        assert!(
            matches!(&result.nodes[3], AstNode::Segments { pairs, .. } if pairs == &vec![["A".to_string(), "B".to_string()], ["C".to_string(), "D".to_string()]])
        );
    }

    #[test]
    fn parses_nested_square_brackets_in_options() {
        let source = r"\tkzDrawSegment[-{Stealth[scale=2]},tkz arrow={To[scale=1.2] at .4}](A,B)
\tkzDrawLine[postaction={decorate,decoration={markings,mark=at position .5 with {\arrow{Stealth[scale=1.4]}}}}](C,D)";
        let result = parse_tikz_code(source);
        assert_eq!(result.nodes.len(), 2);
        assert!(
            matches!(&result.nodes[0], AstNode::Segment { p1, p2, options: Some(options) } if p1 == "A" && p2 == "B" && options.contains("Stealth[scale=2]") && options.contains("To[scale=1.2]"))
        );
        assert!(
            matches!(&result.nodes[1], AstNode::Line { p1, p2, options: Some(options) } if p1 == "C" && p2 == "D" && options.contains("Stealth[scale=1.4]"))
        );
    }

    #[test]
    fn parses_polyseg_circles_and_semicircles() {
        let source = r"\tkzDrawPolySeg[dashed](A,B,C)
\tkzDrawCircles[blue](A,B C,D)
\tkzDrawSemiCircle[swap](A,B)
\tkzDrawSemiCircles[fill=red](A,C B,D)";
        let result = parse_tikz_code(source);
        assert!(
            matches!(&result.nodes[0], AstNode::PolySeg { points, .. } if points == &["A", "B", "C"])
        );
        assert!(matches!(&result.nodes[1], AstNode::Circles { pairs, .. } if pairs.len() == 2));
        assert!(
            matches!(&result.nodes[2], AstNode::SemiCircle { center, radius_point, .. } if center == "A" && radius_point == "B")
        );
        assert!(matches!(&result.nodes[3], AstNode::SemiCircles { pairs, .. } if pairs.len() == 2));
    }

    #[test]
    fn parses_cartesian_and_polar_points() {
        let result = parse_tikz_code(r"\tkzDefPoint(1,2){A}\tkzDefPoint(90:3){B}");

        match result.nodes.as_slice() {
            [AstNode::Point {
                name: first_name,
                x: first_x,
                y: first_y,
                coordinate_mode: first_mode,
                ..
            }, AstNode::Point {
                name: second_name,
                x: second_x,
                y: second_y,
                coordinate_mode: second_mode,
                angle,
                distance,
            }] => {
                assert_eq!((first_name.as_str(), *first_x, *first_y), ("A", 1.0, 2.0));
                assert_eq!(first_mode, "cartesian");
                assert_eq!(second_name, "B");
                assert!(second_x.abs() < 1e-12);
                assert!((*second_y - 3.0).abs() < 1e-12);
                assert_eq!(second_mode, "polar");
                assert_eq!(*angle, Some(90.0));
                assert_eq!(*distance, Some(3.0));
            }
            nodes => panic!("expected cartesian and polar point nodes, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_midpoint_construction() {
        let source = r"\tkzDefMidPoint(A,B)
\tkzGetPoint{M}
\tkzDrawPoints(M)";
        let result = parse_tikz_code(source);

        match result.nodes.as_slice() {
            [AstNode::MidPoint { p1, p2, name }] => {
                assert_eq!((p1.as_str(), p2.as_str(), name.as_str()), ("A", "B", "M"));
            }
            nodes => panic!("expected one midpoint node, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_golden_ratio_point() {
        let result = parse_tikz_code(r"\tkzDefGoldenRatio(A,B)\tkzGetPoint{C}");
        match result.nodes.as_slice() {
            [AstNode::GoldenRatioPoint { p1, p2, name }] => {
                assert_eq!((p1.as_str(), p2.as_str(), name.as_str()), ("A", "B", "C"));
            }
            nodes => panic!("expected one golden-ratio node, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_barycentric_point() {
        let result = parse_tikz_code(r"\tkzDefBarycentricPoint(A=1,B=2,C=-0.5)\tkzGetPoint{G}");
        match result.nodes.as_slice() {
            [AstNode::BarycentricPoint {
                points,
                weights,
                name,
            }] => {
                assert_eq!(points, &["A", "B", "C"]);
                assert_eq!(weights, &[1.0, 2.0, -0.5]);
                assert_eq!(name, "G");
            }
            nodes => panic!("expected one barycentric node, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_similitude_center() {
        let result = parse_tikz_code(r"\tkzDefSimilitudeCenter[int](O,A)(P,B)\tkzGetPoint{S}");
        match result.nodes.as_slice() {
            [AstNode::SimilitudeCenter {
                kind,
                center1,
                radius1,
                center2,
                radius2,
                name,
            }] => {
                assert_eq!(
                    (
                        kind.as_str(),
                        center1.as_str(),
                        radius1.as_str(),
                        center2.as_str(),
                        radius2.as_str(),
                        name.as_str()
                    ),
                    ("int", "O", "A", "P", "B", "S")
                );
            }
            nodes => panic!("expected one similitude-center node, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_harmonic_single_and_pair() {
        let result = parse_tikz_code(
            r"\tkzDefHarmonic[ext](A,B,C)\tkzGetPoint{D}\tkzDefHarmonic[both](A,B,0.5)\tkzGetPoints{I}{J}",
        );
        match result.nodes.as_slice() {
            [AstNode::HarmonicPoint {
                mode,
                p1,
                p2,
                known,
                name,
            }, AstNode::HarmonicPair {
                ratio,
                name1,
                name2,
                ..
            }] => {
                assert_eq!(
                    (
                        mode.as_str(),
                        p1.as_str(),
                        p2.as_str(),
                        known.as_str(),
                        name.as_str()
                    ),
                    ("ext", "A", "B", "C", "D")
                );
                assert_eq!((*ratio, name1.as_str(), name2.as_str()), (0.5, "I", "J"));
            }
            nodes => panic!("expected harmonic point and pair nodes, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_equidistant_points() {
        let result =
            parse_tikz_code(r"\tkzDefEquiPoints[from=C,dist=1.5,show](A,B)\tkzGetPoints{E}{H}");
        match result.nodes.as_slice() {
            [AstNode::EquiPoints {
                p1,
                p2,
                from,
                distance,
                show,
                name1,
                name2,
            }] => {
                assert_eq!((p1.as_str(), p2.as_str(), from.as_str()), ("A", "B", "C"));
                assert_eq!(*distance, 1.5);
                assert!(*show);
                assert_eq!((name1.as_str(), name2.as_str()), ("E", "H"));
            }
            nodes => panic!("expected equidistant-points node, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_mid_arc_point() {
        let result = parse_tikz_code(r"\tkzDefMidArc(O,A,B)\tkzGetPoint{M}");
        match result.nodes.as_slice() {
            [AstNode::MidArcPoint {
                center,
                start,
                end,
                name,
            }] => assert_eq!(
                (center.as_str(), start.as_str(), end.as_str(), name.as_str()),
                ("O", "A", "B", "M")
            ),
            nodes => panic!("expected one mid-arc node, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_point_on_line() {
        let result = parse_tikz_code(r"\tkzDefPointOnLine[pos=1.2](A,B)\tkzGetPoint{P}");
        match result.nodes.as_slice() {
            [AstNode::PointOnLine {
                p1,
                p2,
                position,
                name,
            }] => {
                assert_eq!((p1.as_str(), p2.as_str(), name.as_str()), ("A", "B", "P"));
                assert_eq!(*position, 1.2);
            }
            nodes => panic!("expected one point-on-line node, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_both_point_on_circle_modes() {
        let result = parse_tikz_code(
            r"\tkzDefPointOnCircle[through=center O angle 30 point A]\tkzGetPoint{P}\tkzDefPointOnCircle[R=center O angle 90 radius 2]\tkzGetPoint{Q}",
        );
        match result.nodes.as_slice() {
            [AstNode::PointOnCircle {
                mode: first_mode,
                center,
                angle,
                through,
                ..
            }, AstNode::PointOnCircle {
                mode: second_mode,
                radius,
                name,
                ..
            }] => {
                assert_eq!(
                    (
                        first_mode.as_str(),
                        center.as_str(),
                        *angle,
                        through.as_deref()
                    ),
                    ("through", "O", 30.0, Some("A"))
                );
                assert_eq!(
                    (second_mode.as_str(), *radius, name.as_str()),
                    ("R", Some(2.0), "Q")
                );
            }
            nodes => panic!("expected two point-on-circle nodes, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_triangle_center_option() {
        let result = parse_tikz_code(r"\tkzDefTriangleCenter[mittenpunkt](A,B,C)\tkzGetPoint{M}");
        match result.nodes.as_slice() {
            [AstNode::TriangleCenter {
                option,
                p1,
                p2,
                p3,
                name,
            }] => {
                assert_eq!(
                    (
                        option.as_str(),
                        p1.as_str(),
                        p2.as_str(),
                        p3.as_str(),
                        name.as_str()
                    ),
                    ("mittenpunkt", "A", "B", "C", "M")
                );
            }
            nodes => panic!("expected one triangle-center node, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_arc_with_options() {
        let result = parse_tikz_code(r"\tkzDrawArc[color=blue, thick] (O,A) (B)");

        match result.nodes.as_slice() {
            [AstNode::Arc {
                mode,
                center,
                first,
                second,
                options,
            }] => {
                assert_eq!(mode, "towards");
                assert_eq!(center, "O");
                assert_eq!(first, "A");
                assert_eq!(second, &["B"]);
                assert_eq!(options.as_deref(), Some("color=blue, thick"));
            }
            nodes => panic!("expected one arc node, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_every_sector_mode() {
        let result = parse_tikz_code(
            r"\tkzDrawSector(O,A)(B)
\tkzDrawSector[rotate,color=red](O,A)(90)
\tkzDrawSector[R](O,2)(30,120)
\tkzDrawSector[R with nodes,fill=blue!20](O,3)(A,B)",
        );
        let sectors: Vec<_> = result
            .nodes
            .iter()
            .filter_map(|node| match node {
                AstNode::Sector {
                    mode,
                    center,
                    first,
                    second,
                    ..
                } => Some((mode.as_str(), center.as_str(), first.as_str(), second.len())),
                _ => None,
            })
            .collect();
        assert_eq!(
            sectors,
            vec![
                ("towards", "O", "A", 1),
                ("rotate", "O", "A", 1),
                ("R", "O", "2", 2),
                ("R_with_nodes", "O", "3", 2),
            ]
        );
    }

    #[test]
    fn parses_fill_commands_and_their_geometry_modes() {
        let result = parse_tikz_code(
            r"\tkzFillCircle[fill=red!20](O,A)
\tkzFillCircle[R,fill=blue!20](O,2)
\tkzFillPolygon[teal!20](A,B,C)
\tkzFillSector[rotate,fill=purple!20](O,A)(90)
\tkzFillSector[R with nodes](O,2)(A,B)
\tkzFillAngle[size=2,fill=gray!10](A,O,B)",
        );
        assert!(
            matches!(&result.nodes[0], AstNode::FillCircle { mode, radius, .. } if mode == "radius" && radius == "A")
        );
        assert!(
            matches!(&result.nodes[1], AstNode::FillCircle { mode, radius, .. } if mode == "R" && radius == "2")
        );
        assert!(
            matches!(&result.nodes[2], AstNode::FillPolygon { points, .. } if points.len() == 3)
        );
        assert!(
            matches!(&result.nodes[3], AstNode::FillSector { mode, second, .. } if mode == "rotate" && second == &["90"])
        );
        assert!(
            matches!(&result.nodes[4], AstNode::FillSector { mode, second, .. } if mode == "R_with_nodes" && second == &["A", "B"])
        );
        assert!(
            matches!(&result.nodes[5], AstNode::FillAngle { p1, vertex, p2, .. } if p1 == "A" && vertex == "O" && p2 == "B")
        );
    }

    #[test]
    fn parses_multiple_filled_angles() {
        let result =
            parse_tikz_code(r"\tkzFillAngles[size=2,fill=red!20,opacity=.2](A,O,B B,O,C C,O,A)");
        assert!(
            matches!(&result.nodes[0], AstNode::FillAngles { angles, options } if angles.len() == 3 && angles[1] == ["B", "O", "C"] && options.as_deref().unwrap_or_default().contains("opacity=.2"))
        );
    }

    #[test]
    fn parses_canvas_and_bounding_box_commands() {
        let result = parse_tikz_code(
            r"\tkzInit[xmin=-3,xmax=6,ymin=-1,ymax=5,xstep=.5,ystep=2]
\tkzClip[space=.25]
\tkzShowBB[color=red,dashed]
\tkzClipBB",
        );
        assert!(
            matches!(&result.nodes[0], AstNode::CanvasInit { xmin, xmax, ymin, ymax, xstep, ystep, .. } if (*xmin, *xmax, *ymin, *ymax, *xstep, *ystep) == (-3.0, 6.0, -1.0, 5.0, 0.5, 2.0))
        );
        assert!(matches!(&result.nodes[1], AstNode::CanvasClip { space, .. } if *space == 0.25));
        assert!(
            matches!(&result.nodes[2], AstNode::ShowBoundingBox { options } if options.as_deref().unwrap_or_default().contains("dashed"))
        );
        assert!(matches!(&result.nodes[3], AstNode::ClipBoundingBox));
    }

    #[test]
    fn parses_global_and_custom_style_setup_commands() {
        let result = parse_tikz_code(
            r"\tkzSetUpPoint[size=3,color=red,fill=red!20]
\tkzSetUpLine[line width=.4pt,color=teal]
\tkzSetUpArc[color=gray,line width=.4pt]
\tkzSetUpCompass[color=orange,delta=10]
\tkzSetUpLabel[font=\scriptsize,color=teal]
\tkzSetUpColors[background=white,text=black]
\tkzSetUpStyle[color=blue!20!black,fill=blue!20]{mystyle}",
        );
        assert!(
            matches!(&result.nodes[0], AstNode::StyleSetup { kind, command, options: Some(options) } if kind == "point" && command == "tkzSetUpPoint" && options.contains("size=3"))
        );
        assert!(
            matches!(&result.nodes[1], AstNode::StyleSetup { kind, command, options: Some(options) } if kind == "line" && command == "tkzSetUpLine" && options.contains("line width=.4pt"))
        );
        assert!(matches!(&result.nodes[2], AstNode::StyleSetup { kind, .. } if kind == "arc"));
        assert!(matches!(&result.nodes[3], AstNode::StyleSetup { kind, .. } if kind == "compass"));
        assert!(matches!(&result.nodes[4], AstNode::StyleSetup { kind, .. } if kind == "label"));
        assert!(matches!(&result.nodes[5], AstNode::StyleSetup { kind, .. } if kind == "colors"));
        assert!(
            matches!(&result.nodes[6], AstNode::CustomStyle { name, options: Some(options) } if name == "mystyle" && options.contains("blue!20"))
        );
    }

    #[test]
    fn parses_compass_traces_and_shown_line_constructions() {
        let result = parse_tikz_code(
            r"\tkzCompass[delta=20,color=red](A,B)
\tkzCompasss[length=1.5](A,C B,C)
\tkzShowLine[parallel=through C,gap=3](A,B)
\tkzShowLine[bisector,size=2](B,A,C)
\tkzShowTransformation[projection=onto A--B,color=red,size=3,gap=-3](I)
\tkzProtractor[scale=1,return](A,B)",
        );
        assert!(
            matches!(&result.nodes[0], AstNode::Compass { center, through, .. } if center == "A" && through == "B")
        );
        assert!(matches!(&result.nodes[1], AstNode::Compasses { pairs, .. } if pairs.len() == 2));
        assert!(
            matches!(&result.nodes[2], AstNode::ShowLine { mode, through, points, .. } if mode == "parallel" && through.as_deref() == Some("C") && points == &["A", "B"])
        );
        assert!(
            matches!(&result.nodes[3], AstNode::ShowLine { mode, points, .. } if mode == "bisector" && points.len() == 3)
        );
        assert!(
            matches!(&result.nodes[4], AstNode::ShowTransformation { mode, source, references, .. } if mode == "projection" && source == "I" && references == &["A", "B"])
        );
        assert!(
            matches!(&result.nodes[5], AstNode::Protractor { origin, direction, options } if origin == "A" && direction == "B" && options.as_deref().unwrap_or_default().contains("return"))
        );
    }

    #[test]
    fn parses_inside_and_outside_polygon_clips() {
        let result = parse_tikz_code(
            r"\tkzClipPolygon(A,B,C)
\tkzClipPolygon[out](P1,P2,P3,P4)",
        );
        assert!(
            matches!(&result.nodes[0], AstNode::PolygonClip { points, out, .. } if points == &["A", "B", "C"] && !out)
        );
        assert!(
            matches!(&result.nodes[1], AstNode::PolygonClip { points, out, .. } if points.len() == 4 && *out)
        );
    }

    #[test]
    fn parses_circle_and_all_sector_clip_modes() {
        let result = parse_tikz_code(
            r"\tkzClipCircle(O,A)
\tkzClipCircle[out](P,B)
\tkzClipSector(O,A)(B)
\tkzClipSector[rotate](O,A)(-60)
\tkzClipSector[R](O,2)(30,120)",
        );
        assert!(
            matches!(&result.nodes[0], AstNode::CircleClip { center, radius_point, out, .. } if center == "O" && radius_point == "A" && !out)
        );
        assert!(matches!(&result.nodes[1], AstNode::CircleClip { out, .. } if *out));
        assert!(
            matches!(&result.nodes[2], AstNode::SectorClip { mode, second, .. } if mode == "towards" && second == &["B"])
        );
        assert!(
            matches!(&result.nodes[3], AstNode::SectorClip { mode, second, .. } if mode == "rotate" && second == &["-60"])
        );
        assert!(
            matches!(&result.nodes[4], AstNode::SectorClip { mode, first, second, .. } if mode == "R" && first == "2" && second == &["30", "120"])
        );
    }

    #[test]
    fn parses_every_arc_mode_and_ellipse() {
        let source = r"\tkzDrawArc[rotate,delta=5](O,A)(90)
\tkzDrawArc[R](O,2)(30,120)
\tkzDrawArc[R with nodes,reverse](O,3)(A,B)
\tkzDrawArc[angles](O,A)(0,180)
\tkzDrawEllipse[blue](O,4,2,45)";
        let result = parse_tikz_code(source);
        assert!(
            matches!(&result.nodes[0], AstNode::Arc { mode, second, .. } if mode == "rotate" && second == &["90"])
        );
        assert!(
            matches!(&result.nodes[1], AstNode::Arc { mode, first, second, .. } if mode == "R" && first == "2" && second.len() == 2)
        );
        assert!(
            matches!(&result.nodes[2], AstNode::Arc { mode, second, .. } if mode == "R_with_nodes" && second == &["A", "B"])
        );
        assert!(matches!(&result.nodes[3], AstNode::Arc { mode, .. } if mode == "angles"));
        assert!(
            matches!(&result.nodes[4], AstNode::Ellipse { center, x_radius, y_radius, angle, .. } if center == "O" && *x_radius == 4.0 && *y_radius == 2.0 && *angle == 45.0)
        );
    }

    #[test]
    fn parses_perpendicular_line_construction() {
        let source = r"\tkzDefLine[orthogonal=through C](A,B)
\tkzGetPoint{D}
\tkzDrawLine[add=2 and 2, blue](C,D)";
        let result = parse_tikz_code(source);

        match result.nodes.as_slice() {
            [AstNode::PerpendicularLine {
                p1,
                p2,
                through,
                helper,
                options,
            }] => {
                assert_eq!(p1, "A");
                assert_eq!(p2, "B");
                assert_eq!(through, "C");
                assert_eq!(helper, "D");
                assert_eq!(options.as_deref(), Some("add=2 and 2, blue"));
            }
            nodes => panic!("expected one perpendicular line node, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_projection_line_construction() {
        let source = r"\tkzDefPointBy[projection=onto A--B](P)
\tkzGetPoint{H}
\tkzDrawLine[add=2 and 2, dashed](P,H)
\tkzMarkRightAngle(P,H,A)";
        let result = parse_tikz_code(source);

        match result.nodes.as_slice() {
            [AstNode::ProjectionLine {
                p1,
                p2,
                from,
                foot,
                options,
            }] => {
                assert_eq!(p1, "A");
                assert_eq!(p2, "B");
                assert_eq!(from, "P");
                assert_eq!(foot, "H");
                assert_eq!(options.as_deref(), Some("add=2 and 2, dashed"));
            }
            nodes => panic!("expected one projection line node, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_perpendicular_bisector_construction() {
        let source = r"\tkzDefLine[mediator](A,B)
\tkzGetPoints{C}{D}
\tkzDrawLine[add=.5 and .5](C,D)";
        let result = parse_tikz_code(source);

        match result.nodes.as_slice() {
            [AstNode::PerpendicularBisector {
                p1,
                p2,
                helper1,
                helper2,
                options,
            }] => {
                assert_eq!(p1, "A");
                assert_eq!(p2, "B");
                assert_eq!(helper1, "C");
                assert_eq!(helper2, "D");
                assert_eq!(options.as_deref(), Some("add=.5 and .5"));
            }
            nodes => panic!("expected one perpendicular bisector node, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_angle_bisector_construction() {
        let source = r"\tkzDefLine[bisector](A,B,C)
\tkzGetPoint{D}
\tkzDrawLine[add=0 and 1, orange](B,D)";
        let result = parse_tikz_code(source);

        match result.nodes.as_slice() {
            [AstNode::AngleBisector {
                p1,
                vertex,
                p2,
                helper,
                options,
            }] => {
                assert_eq!(p1, "A");
                assert_eq!(vertex, "B");
                assert_eq!(p2, "C");
                assert_eq!(helper, "D");
                assert_eq!(options.as_deref(), Some("add=0 and 1, orange"));
            }
            nodes => panic!("expected one angle bisector node, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_triangle_altitude_construction() {
        let source = r"\tkzDefLine[altitude](A,B,C)
\tkzGetPoint{D}
\tkzDrawSegment[blue, dashed](B,D)
\tkzDrawPoints(D)
\tkzMarkRightAngle(B,D,A)";
        let result = parse_tikz_code(source);

        match result.nodes.as_slice() {
            [AstNode::TriangleAltitude {
                side1,
                vertex,
                side2,
                foot,
                options,
            }] => {
                assert_eq!(side1, "A");
                assert_eq!(vertex, "B");
                assert_eq!(side2, "C");
                assert_eq!(foot, "D");
                assert_eq!(options.as_deref(), Some("blue, dashed"));
            }
            nodes => panic!("expected one triangle altitude node, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_all_altitudes_and_orthocenter_construction() {
        let source = r"\tkzDefSpcTriangle[ortho](A,B,C){D,E,F}
\tkzDefTriangleCenter[ortho](A,B,C)
\tkzGetPoint{G}
\tkzDrawSegments[red, thick](A,D B,E C,F)
\tkzDrawPoints(D,E,F,G)
\tkzMarkRightAngles(A,D,C B,E,A C,F,A)";
        let result = parse_tikz_code(source);

        match result.nodes.as_slice() {
            [AstNode::AllAltitudes {
                p1,
                p2,
                p3,
                foot1,
                foot2,
                foot3,
                orthocenter,
                options,
            }] => {
                assert_eq!(p1, "A");
                assert_eq!(p2, "B");
                assert_eq!(p3, "C");
                assert_eq!(foot1, "D");
                assert_eq!(foot2, "E");
                assert_eq!(foot3, "F");
                assert_eq!(orthocenter, "G");
                assert_eq!(options.as_deref(), Some("red, thick"));
            }
            nodes => panic!("expected all altitudes node, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_marked_angle_with_label() {
        let source = r"\tkzMarkAngle[size=0.5, blue](A,B,C)
\tkzLabelAngle[pos=0.7](A,B,C){$\alpha$}";
        let result = parse_tikz_code(source);

        match result.nodes.as_slice() {
            [AstNode::AngleMark {
                p1,
                vertex,
                p2,
                options,
                label,
            }] => {
                assert_eq!(p1, "A");
                assert_eq!(vertex, "B");
                assert_eq!(p2, "C");
                assert_eq!(options.as_deref(), Some("size=0.5, blue"));
                assert_eq!(label.as_deref(), Some("$\\alpha$"));
            }
            nodes => panic!("expected one marked angle node, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_standalone_label_commands() {
        let source = r"\tkzLabelPoint[above](A){$P$}
\tkzLabelPoints[below](A,B)
\tkzAutoLabelPoints[center=O,dist=.2,color=blue](A,B)
\tkzLabelSegment[auto](A,B){$c$}
\tkzLabelSegments[below,sloped](A,B B,C){$a$}
\tkzLabelLine[pos=1.25](B,C){$(d)$}
\tkzLabelAngle[pos=1](A,O,B){$\alpha$}
\tkzLabelAngles[pos=1](A,O,B B,O,C){$\beta$}
\tkzLabelCircle[above](O,A)(90){$\mathcal{C}$}
\tkzLabelArc[pos=.5](O,A,B){$\widearc{AB}$}";
        let result = parse_tikz_code(source);

        assert_eq!(result.nodes.len(), 10);
        match &result.nodes[0] {
            AstNode::LabelPoint {
                point,
                text,
                options,
            } => {
                assert_eq!(point, "A");
                assert_eq!(text, "$P$");
                assert_eq!(options.as_deref(), Some("above"));
            }
            node => panic!("expected LabelPoint, got {node:?}"),
        }
        match &result.nodes[2] {
            AstNode::AutoLabelPoints {
                points,
                center,
                distance,
                options,
            } => {
                assert_eq!(points, &vec!["A".to_string(), "B".to_string()]);
                assert_eq!(center.as_deref(), Some("O"));
                assert_eq!(*distance, Some(0.2));
                assert_eq!(options.as_deref(), Some("center=O,dist=.2,color=blue"));
            }
            node => panic!("expected AutoLabelPoints, got {node:?}"),
        }
        match &result.nodes[3] {
            AstNode::LabelSegment {
                p1,
                p2,
                text,
                options,
            } => {
                assert_eq!((p1.as_str(), p2.as_str()), ("A", "B"));
                assert_eq!(text, "$c$");
                assert_eq!(options.as_deref(), Some("auto"));
            }
            node => panic!("expected LabelSegment, got {node:?}"),
        }
        match &result.nodes[4] {
            AstNode::LabelSegments { pairs, text, .. } => {
                assert_eq!(
                    pairs,
                    &vec![
                        ["A".to_string(), "B".to_string()],
                        ["B".to_string(), "C".to_string()]
                    ]
                );
                assert_eq!(text, "$a$");
            }
            node => panic!("expected LabelSegments, got {node:?}"),
        }
        match &result.nodes[8] {
            AstNode::LabelCircle {
                center,
                radius_point,
                angle,
                text,
                ..
            } => {
                assert_eq!(
                    (center.as_str(), radius_point.as_str(), angle.as_str()),
                    ("O", "A", "90")
                );
                assert_eq!(text, "$\\mathcal{C}$");
            }
            node => panic!("expected LabelCircle, got {node:?}"),
        }
        match &result.nodes[9] {
            AstNode::LabelArc {
                center,
                start,
                end,
                text,
                ..
            } => {
                assert_eq!(
                    (center.as_str(), start.as_str(), end.as_str()),
                    ("O", "A", "B")
                );
                assert_eq!(text, "$\\widearc{AB}$");
            }
            node => panic!("expected LabelArc, got {node:?}"),
        }
    }

    #[test]
    fn parses_line_intersection_point() {
        let source = r"\tkzInterLL(A,B)(C,D)
\tkzGetPoint{E}
\tkzDrawPoints(E)";
        let result = parse_tikz_code(source);

        match result.nodes.as_slice() {
            [AstNode::IntersectionPoint {
                p1,
                p2,
                p3,
                p4,
                name,
            }] => {
                assert_eq!((p1.as_str(), p2.as_str()), ("A", "B"));
                assert_eq!((p3.as_str(), p4.as_str()), ("C", "D"));
                assert_eq!(name, "E");
            }
            nodes => panic!("expected one intersection point node, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_point_transformations() {
        let source = r"\tkzDefPointBy[translation=from A to B](E)\tkzGetPoint{T}
\tkzDefPointBy[homothety=center A ratio .5](E)\tkzGetPoint{H}
\tkzDefPointBy[reflection=over A--B](E)\tkzGetPoint{F}
\tkzDefPointBy[symmetry=center A](E)\tkzGetPoint{S}
\tkzDefPointBy[projection=onto A--B](E)\tkzGetPoint{P}
\tkzDefPointBy[rotation=center O angle 30](E)\tkzGetPoint{R}
\tkzDefPointBy[rotation in rad=center O angle pi/3](E)\tkzGetPoint{Q}
\tkzDefPointBy[rotation with nodes=center O from A to B](E)\tkzGetPoint{N}
\tkzDefPointBy[inversion=center O through A](E)\tkzGetPoint{I}
\tkzDefPointBy[inversion negative=center O through A](E)\tkzGetPoint{J}";
        let result = parse_tikz_code(source);
        let modes: Vec<&str> = result
            .nodes
            .iter()
            .filter_map(|node| match node {
                AstNode::PointTransformation { mode, .. } => Some(mode.as_str()),
                _ => None,
            })
            .collect();
        assert_eq!(
            modes,
            vec![
                "translation",
                "homothety",
                "reflection",
                "symmetry",
                "projection",
                "rotation",
                "rotation_in_rad",
                "rotation_with_nodes",
                "inversion",
                "inversion_negative"
            ]
        );
        match &result.nodes[6] {
            AstNode::PointTransformation {
                source,
                references,
                value,
                name,
                ..
            } => {
                assert_eq!(source, "E");
                assert_eq!(references, &vec!["O".to_string()]);
                assert_eq!(value.as_deref(), Some("pi/3"));
                assert_eq!(name, "Q");
            }
            node => panic!("expected radians transformation, got {node:?}"),
        }
    }

    #[test]
    fn parses_multiple_point_transformations_and_prime_defaults() {
        let source = r"\tkzDefPointsBy[translation=from A to B](C,D){E,F}
\tkzDefPointsBy[symmetry=center O](A,B){}";
        let result = parse_tikz_code(source);
        match result.nodes.as_slice() {
            [AstNode::PointsTransformation {
                mode,
                sources,
                references,
                names,
                ..
            }, AstNode::PointsTransformation {
                mode: second_mode,
                names: prime_names,
                ..
            }] => {
                assert_eq!(mode, "translation");
                assert_eq!(sources, &vec!["C".to_string(), "D".to_string()]);
                assert_eq!(references, &vec!["A".to_string(), "B".to_string()]);
                assert_eq!(names, &vec!["E".to_string(), "F".to_string()]);
                assert_eq!(second_mode, "symmetry");
                assert_eq!(prime_names, &vec!["A'".to_string(), "B'".to_string()]);
            }
            nodes => panic!("expected two multiple transformations, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_vector_defined_points() {
        let source = r"\tkzDefPointWith[orthogonal](A,B)\tkzGetPoint{C}
\tkzDefPointWith[orthogonal normed,K=2](A,B)\tkzGetPoint{D}
\tkzDefPointWith[linear,K=.5](A,B)\tkzGetPoint{E}
\tkzDefPointWith[linear normed](A,B)\tkzGetPoint{F}
\tkzDefPointWith[colinear=at C,K=-1](A,B)\tkzGetPoint{G}
\tkzDefPointWith[colinear normed= at D](A,B)\tkzGetPoint{H}";
        let result = parse_tikz_code(source);
        let modes: Vec<&str> = result
            .nodes
            .iter()
            .filter_map(|node| match node {
                AstNode::VectorPoint { mode, .. } => Some(mode.as_str()),
                _ => None,
            })
            .collect();
        assert_eq!(
            modes,
            vec![
                "orthogonal",
                "orthogonal_normed",
                "linear",
                "linear_normed",
                "colinear",
                "colinear_normed"
            ]
        );
        match &result.nodes[4] {
            AstNode::VectorPoint {
                anchor,
                factor,
                name,
                ..
            } => {
                assert_eq!(anchor.as_deref(), Some("C"));
                assert_eq!(*factor, -1.0);
                assert_eq!(name, "G");
            }
            node => panic!("expected colinear vector point, got {node:?}"),
        }
    }

    #[test]
    fn parses_vector_coordinate_macros() {
        let result = parse_tikz_code(r"\tkzGetVectxy(A,B){V}");
        match result.nodes.as_slice() {
            [AstNode::VectorCoordinates { p1, p2, macro_name }] => {
                assert_eq!(p1, "A");
                assert_eq!(p2, "B");
                assert_eq!(macro_name, "V");
            }
            nodes => panic!("expected vector coordinates node, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_duplicate_segment_length_and_unit_conversions() {
        let duplicate = parse_tikz_code(
            r"\tkzDuplicateSegment(A,B)(C,D)
\tkzGetPoint{E}
\tkzDuplicateLen(A,C)(B,D){F}",
        );
        match duplicate.nodes.as_slice() {
            [AstNode::DuplicateSegment {
                ray_start,
                ray_through,
                segment_start,
                segment_end,
                name,
            }, AstNode::DuplicateSegment {
                name: alias_name, ..
            }] => {
                assert_eq!((ray_start.as_str(), ray_through.as_str()), ("A", "B"));
                assert_eq!((segment_start.as_str(), segment_end.as_str()), ("C", "D"));
                assert_eq!(name, "E");
                assert_eq!(alias_name, "F");
            }
            nodes => panic!("expected duplicate segment nodes, got {nodes:?}"),
        }

        let length = parse_tikz_code(r"\tkzCalcLength[cm](A,B)\tkzGetLength{dAB}");
        assert!(
            matches!(length.nodes.as_slice(), [AstNode::LengthCalculation { p1, p2, macro_name: Some(name), options: Some(options) }] if p1 == "A" && p2 == "B" && name == "dAB" && options == "cm")
        );
        let conversions = parse_tikz_code(r"\tkzpttocm(28.45274){oneCm}\tkzcmtopt(1){onePt}");
        assert!(
            matches!(conversions.nodes.as_slice(), [AstNode::UnitConversion { mode, value, macro_name }, AstNode::UnitConversion { mode: second_mode, value: second_value, macro_name: second_macro }] if mode == "pt_to_cm" && value == "28.45274" && macro_name == "oneCm" && second_mode == "cm_to_pt" && second_value == "1" && second_macro == "onePt")
        );
    }

    #[test]
    fn parses_coordinate_swap_dot_product_and_power_circle_tools() {
        let result = parse_tikz_code(
            r"\tkzGetPointCoord(A){coordA}
\tkzSwapPoints(A,B)
\tkzDotProduct(A,B,B)\tkzGetResult{dotABB}
\tkzPowerCircle(A)(B,C)\tkzGetResult{powerA}",
        );
        match result.nodes.as_slice() {
            [AstNode::PointCoordinates { point, macro_name }, AstNode::SwapPoints { p1, p2 }, AstNode::DotProduct {
                p1: dot_p1,
                p2: dot_p2,
                p3: dot_p3,
                macro_name: Some(dot_macro),
            }, AstNode::PowerCircle {
                point: power_point,
                center,
                radius_point,
                macro_name: Some(power_macro),
            }] => {
                assert_eq!((point.as_str(), macro_name.as_str()), ("A", "coordA"));
                assert_eq!((p1.as_str(), p2.as_str()), ("A", "B"));
                assert_eq!(
                    (
                        dot_p1.as_str(),
                        dot_p2.as_str(),
                        dot_p3.as_str(),
                        dot_macro.as_str()
                    ),
                    ("A", "B", "B", "dotABB")
                );
                assert_eq!(
                    (
                        power_point.as_str(),
                        center.as_str(),
                        radius_point.as_str(),
                        power_macro.as_str()
                    ),
                    ("A", "B", "C", "powerA")
                );
            }
            nodes => panic!("expected miscellaneous calculation nodes, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_radical_axis_and_boolean_geometry_tests() {
        let result = parse_tikz_code(
            r"\tkzDefRadicalAxis(A,B)(C,D)
\tkzGetPoints{E}{F}
\tkzIsLinear(A,B,C)
\tkzIsOrtho(A,B,C)",
        );
        match result.nodes.as_slice() {
            [AstNode::RadicalAxis {
                circle1,
                circle2,
                results,
            }, AstNode::LinearityTest { points: linear }, AstNode::OrthogonalityTest { points: ortho }] =>
            {
                assert_eq!(circle1, &vec!["A".to_string(), "B".to_string()]);
                assert_eq!(circle2, &vec!["C".to_string(), "D".to_string()]);
                assert_eq!(results, &vec!["E".to_string(), "F".to_string()]);
                assert_eq!(
                    linear,
                    &vec!["A".to_string(), "B".to_string(), "C".to_string()]
                );
                assert_eq!(
                    ortho,
                    &vec!["A".to_string(), "B".to_string(), "C".to_string()]
                );
            }
            nodes => panic!("expected radical axis and boolean test nodes, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_all_defined_line_modes() {
        let source = r"\tkzDefLine[mediator](A,B)\tkzGetPoints{E}{F}
\tkzDefLine[perpendicular=through C,K=-1,normed](A,B)\tkzGetPoint{G}
\tkzDefLine[orthogonal=through C](A,B)\tkzGetPoint{H}
\tkzDefLine[parallel=through C](A,B)\tkzGetPoint{I}
\tkzDefLine[bisector](A,B,C)\tkzGetPoint{J}
\tkzDefLine[bisector out](A,B,C)\tkzGetPoint{K}
\tkzDefLine[symmedian](A,B,C)\tkzGetPoint{L}
\tkzDefLine[altitude](A,B,C)\tkzGetPoint{M}
\tkzDefLine[euler](A,B,C)\tkzGetPoints{N}{O}
\tkzDefLine[tangent at=B](A)\tkzGetPoint{P}
\tkzDefLine[tangent from=D](A,B)\tkzGetPoints{Q}{R}";
        let result = parse_tikz_code(source);
        let modes: Vec<&str> = result
            .nodes
            .iter()
            .filter_map(|node| match node {
                AstNode::DefinedLine { mode, .. } => Some(mode.as_str()),
                _ => None,
            })
            .collect();
        assert_eq!(
            modes,
            vec![
                "mediator",
                "perpendicular",
                "orthogonal",
                "parallel",
                "bisector",
                "bisector_out",
                "symmedian",
                "altitude",
                "euler",
                "tangent_at",
                "tangent_from"
            ]
        );
        match &result.nodes[1] {
            AstNode::DefinedLine {
                through,
                factor,
                normed,
                results,
                ..
            } => {
                assert_eq!(through.as_deref(), Some("C"));
                assert_eq!(*factor, -1.0);
                assert!(*normed);
                assert_eq!(results, &vec!["G".to_string()]);
            }
            node => panic!("expected perpendicular line, got {node:?}"),
        }
    }

    #[test]
    fn parses_all_defined_triangle_modes() {
        let source = r"\tkzDefTriangle[two angles=50 and 70,swap](A,B)\tkzGetPoint{C}
\tkzDefTriangle[equilateral](A,B)\tkzGetPoint{D}
\tkzDefTriangle[half](A,B)\tkzGetPoint{E}
\tkzDefTriangle[isosceles right](A,B)\tkzGetPoint{F}
\tkzDefTriangle[pythagore](A,B)\tkzGetPoint{G}
\tkzDefTriangle[pythagoras](A,B)\tkzGetPoint{H}
\tkzDefTriangle[egyptian](A,B)\tkzGetPoint{I}
\tkzDefTriangle[school](A,B)\tkzGetPoint{J}
\tkzDefTriangle[gold](A,B)\tkzGetPoint{K}
\tkzDefTriangle[euclid](A,B)\tkzGetPoint{L}
\tkzDefTriangle[golden](A,B)\tkzGetPoint{M}
\tkzDefTriangle[sublime](A,B)\tkzGetPoint{N}
\tkzDefTriangle[cheops](A,B)\tkzGetPoint{O}";
        let result = parse_tikz_code(source);
        let modes: Vec<&str> = result
            .nodes
            .iter()
            .filter_map(|node| match node {
                AstNode::DefinedTriangle { mode, .. } => Some(mode.as_str()),
                _ => None,
            })
            .collect();
        assert_eq!(
            modes,
            vec![
                "two_angles",
                "equilateral",
                "half",
                "isosceles_right",
                "pythagore",
                "pythagoras",
                "egyptian",
                "school",
                "gold",
                "euclid",
                "golden",
                "sublime",
                "cheops"
            ]
        );
        match &result.nodes[0] {
            AstNode::DefinedTriangle {
                angle1,
                angle2,
                swap,
                name,
                ..
            } => {
                assert_eq!(*angle1, Some(50.0));
                assert_eq!(*angle2, Some(70.0));
                assert!(*swap);
                assert_eq!(name, "C");
            }
            node => panic!("expected two-angle triangle, got {node:?}"),
        }
    }

    #[test]
    fn parses_all_associated_triangle_modes_and_name_prefix() {
        let modes = [
            "orthic",
            "centroid",
            "medial",
            "in",
            "incentral",
            "ex",
            "excentral",
            "extouch",
            "intouch",
            "contact",
            "euler",
            "symmedial",
            "tangential",
            "feuerbach",
        ];
        for mode in modes {
            let source = format!("\\tkzDefSpcTriangle[{mode}](A,B,C){{X,Y,Z}}");
            let result = parse_tikz_code(&source);
            match result.nodes.as_slice() {
                [AstNode::AssociatedTriangle {
                    mode: parsed_mode,
                    p1,
                    p2,
                    p3,
                    results,
                    ..
                }] => {
                    assert_eq!(parsed_mode, mode);
                    assert_eq!((p1.as_str(), p2.as_str(), p3.as_str()), ("A", "B", "C"));
                    assert_eq!(results, &["X", "Y", "Z"]);
                }
                nodes => panic!("expected associated triangle for {mode}, got {nodes:?}"),
            }
        }

        let result = parse_tikz_code(r"\tkzDefSpcTriangle[feuerbach,name=F](A,B,C){a,b,c}");
        match result.nodes.as_slice() {
            [AstNode::AssociatedTriangle {
                name_prefix,
                results,
                ..
            }] => {
                assert_eq!(name_prefix.as_deref(), Some("F"));
                assert_eq!(results, &["Fa", "Fb", "Fc"]);
            }
            nodes => panic!("expected prefixed associated triangle, got {nodes:?}"),
        }
    }

    #[test]
    fn parses_polygon_constructions_and_permutation() {
        let source = r"\tkzDefSquare(A,B)\tkzGetPoints{C}{D}
\tkzDefRectangle(A,C)\tkzGetPoints{B}{D}
\tkzDefParallelogram(A,B,C)\tkzGetPoint{D}
\tkzPermute(A,B,C)";
        let result = parse_tikz_code(source);
        let constructions: Vec<(&str, Vec<&str>, Vec<&str>)> = result
            .nodes
            .iter()
            .filter_map(|node| match node {
                AstNode::PolygonConstruction {
                    mode,
                    points,
                    results,
                    ..
                } => Some((
                    mode.as_str(),
                    points.iter().map(String::as_str).collect(),
                    results.iter().map(String::as_str).collect(),
                )),
                _ => None,
            })
            .collect();
        assert_eq!(
            constructions,
            vec![
                ("square", vec!["A", "B"], vec!["C", "D"]),
                ("rectangle", vec!["A", "C"], vec!["B", "D"]),
                ("parallelogram", vec!["A", "B", "C"], vec!["D"]),
                ("permute", vec!["A", "B", "C"], vec!["B", "C"]),
            ]
        );
    }

    #[test]
    fn parses_golden_rectangle_aliases_and_all_regular_polygon_options() {
        for macro_name in ["tkzDefGoldenRectangle", "tkzDefGoldRectangle"] {
            let source = format!("\\{macro_name}(A,B)\\tkzGetPoints{{C}}{{D}}");
            let result = parse_tikz_code(&source);
            assert!(
                matches!(result.nodes.as_slice(), [AstNode::PolygonConstruction { mode, results, .. }] if mode == "golden_rectangle" && results == &["C", "D"])
            );
        }

        let result = parse_tikz_code(r"\tkzDefRegPolygon[side,sides=7,name=R](A,B)");
        match result.nodes.as_slice() {
            [AstNode::PolygonConstruction {
                mode,
                points,
                results,
                regular_mode,
                sides,
                name_prefix,
            }] => {
                assert_eq!(mode, "regular_polygon");
                assert_eq!(points, &["A", "B"]);
                assert_eq!(results, &["R1", "R2", "R3", "R4", "R5", "R6", "R7"]);
                assert_eq!(regular_mode.as_deref(), Some("side"));
                assert_eq!(*sides, Some(7));
                assert_eq!(name_prefix.as_deref(), Some("R"));
            }
            nodes => panic!("expected regular polygon, got {nodes:?}"),
        }

        let defaults = parse_tikz_code(r"\tkzDefRegPolygon(O,A)");
        assert!(
            matches!(defaults.nodes.as_slice(), [AstNode::PolygonConstruction { regular_mode: Some(mode), sides: Some(5), name_prefix: Some(name), .. }] if mode == "center" && name == "P")
        );
    }

    #[test]
    fn parses_every_defined_circle_mode() {
        let cases = [
            (r"\tkzDefCircle[R](A,2)\tkzGetPoint{X}", "R"),
            (
                r"\tkzDefCircle[diameter](A,B)\tkzGetPoints{O}{R}",
                "diameter",
            ),
            (r"\tkzDefCircle[circum](A,B,C)\tkzGetPoints{O}{R}", "circum"),
            (r"\tkzDefCircle[in](A,B,C)\tkzGetPoints{O}{R}", "in"),
            (r"\tkzDefCircle[ex](A,B,C)\tkzGetPoints{O}{R}", "ex"),
            (r"\tkzDefCircle[euler](A,B,C)\tkzGetPoints{O}{R}", "euler"),
            (r"\tkzDefCircle[nine](A,B,C)\tkzGetPoints{O}{R}", "nine"),
            (
                r"\tkzDefCircle[spieker](A,B,C)\tkzGetPoints{O}{R}",
                "spieker",
            ),
            (
                r"\tkzDefCircle[apollonius,K=2](A,B)\tkzGetPoints{O}{R}",
                "apollonius",
            ),
            (
                r"\tkzDefCircle[orthogonal from=P](O,M)\tkzGetPoints{X}{Y}",
                "orthogonal_from",
            ),
            (
                r"\tkzDefCircle[orthogonal through=X and Y](O,M)\tkzGetPoints{C}{R}",
                "orthogonal_through",
            ),
        ];
        for (source, expected_mode) in cases {
            let result = parse_tikz_code(source);
            match result.nodes.as_slice() {
                [AstNode::DefinedCircle { mode, .. }] => assert_eq!(mode, expected_mode),
                nodes => panic!("expected {expected_mode} circle, got {nodes:?}"),
            }
        }
        let radius = parse_tikz_code(r"\tkzDefCircle[R](A,2.5)\tkzGetPoint{X}");
        assert!(
            matches!(radius.nodes.as_slice(), [AstNode::DefinedCircle { value: Some(value), center, radius_point, .. }] if (*value - 2.5).abs() < 1e-12 && center == "A" && radius_point == "X")
        );
    }

    #[test]
    fn parses_projected_excenters_and_circle_transformations() {
        let projected = parse_tikz_code(r"\tkzDefProjExcenter[name=J](A,B,C)(a,b,c){X,Y,Z}");
        match projected.nodes.as_slice() {
            [AstNode::ProjectedExcenters {
                name_prefix,
                excenter_suffixes,
                projection_prefixes,
                results,
                ..
            }] => {
                assert_eq!(name_prefix, "J");
                assert_eq!(excenter_suffixes, &["a", "b", "c"]);
                assert_eq!(projection_prefixes, &["X", "Y", "Z"]);
                assert_eq!(results.len(), 9);
            }
            nodes => panic!("expected projected excenters, got {nodes:?}"),
        }
        let cases = [
            (
                r"\tkzDefCircleBy[translation=from A to B](O,M)\tkzGetPoints{P}{Q}",
                "translation",
            ),
            (
                r"\tkzDefCircleBy[homothety=center A ratio .5](O,M)\tkzGetPoints{P}{Q}",
                "homothety",
            ),
            (
                r"\tkzDefCircleBy[reflection=over A--B](O,M)\tkzGetPoints{P}{Q}",
                "reflection",
            ),
            (
                r"\tkzDefCircleBy[symmetry=center A](O,M)\tkzGetPoints{P}{Q}",
                "symmetry",
            ),
            (
                r"\tkzDefCircleBy[projection=onto A--B](O,M)\tkzGetPoints{P}{Q}",
                "projection",
            ),
            (
                r"\tkzDefCircleBy[rotation=center A angle 30](O,M)\tkzGetPoints{P}{Q}",
                "rotation",
            ),
            (
                r"\tkzDefCircleBy[inversion=center A through B](O,M)\tkzGetPoints{P}{Q}",
                "inversion",
            ),
        ];
        for (source, expected) in cases {
            let parsed = parse_tikz_code(source);
            assert!(
                matches!(parsed.nodes.as_slice(), [AstNode::CircleTransformation { mode, results, .. }] if mode == expected && results == &["P", "Q"])
            );
        }
    }

    #[test]
    fn parses_all_line_circle_intersection_forms_and_test() {
        let cases = [
            (
                r"\tkzInterLC[near](A,B)(O,C)\tkzGetPoints{I}{J}",
                "N",
                true,
                None,
            ),
            (
                r"\tkzInterLC[R](A,B)(O,2)\tkzGetPoints{I}{J}",
                "R",
                false,
                None,
            ),
            (
                r"\tkzInterLC[with nodes,common=C](A,B)(O,C,D)\tkzGetPoints{I}{J}",
                "with_nodes",
                false,
                Some("C"),
            ),
        ];
        for (source, expected_mode, expected_near, expected_common) in cases {
            let parsed = parse_tikz_code(source);
            match parsed.nodes.as_slice() {
                [AstNode::LineCircleIntersection {
                    mode,
                    near,
                    common,
                    results,
                    ..
                }] => {
                    assert_eq!(mode, expected_mode);
                    assert_eq!(*near, expected_near);
                    assert_eq!(common.as_deref(), expected_common);
                    assert_eq!(results, &["I", "J"]);
                }
                nodes => panic!("expected line-circle intersection, got {nodes:?}"),
            }
        }
        let test = parse_tikz_code(r"\tkzTestInterLC(A,B)(O,C)");
        assert!(
            matches!(test.nodes.as_slice(), [AstNode::LineCircleTest { line, circle }] if line == &["A", "B"] && circle == &["O", "C"])
        );
    }

    #[test]
    fn parses_all_circle_circle_intersection_forms_and_test() {
        let cases = [
            (
                r"\tkzInterCC[common=A](O,A)(P,B)\tkzGetPoints{I}{J}",
                "N",
                Some("A"),
            ),
            (r"\tkzInterCC[R](O,2)(P,3)\tkzGetPoints{I}{J}", "R", None),
            (
                r"\tkzInterCC[with nodes](O,A,B)(P,C,D)\tkzGetPoints{I}{J}",
                "with_nodes",
                None,
            ),
        ];
        for (source, expected_mode, expected_common) in cases {
            let parsed = parse_tikz_code(source);
            match parsed.nodes.as_slice() {
                [AstNode::CircleCircleIntersection {
                    mode,
                    common,
                    results,
                    ..
                }] => {
                    assert_eq!(mode, expected_mode);
                    assert_eq!(common.as_deref(), expected_common);
                    assert_eq!(results, &["I", "J"]);
                }
                nodes => panic!("expected circle-circle intersection, got {nodes:?}"),
            }
        }
        let test = parse_tikz_code(r"\tkzTestInterCC(O,A)(P,B)");
        assert!(
            matches!(test.nodes.as_slice(), [AstNode::CircleCircleTest { circles }] if circles == &[vec!["O".to_string(), "A".to_string()], vec!["P".to_string(), "B".to_string()]])
        );
    }

    #[test]
    fn parses_angle_calculation_and_retrieval_commands() {
        let angle = parse_tikz_code(r"\tkzFindAngle(A,O,B)\tkzGetAngle{angleAOB}");
        assert!(
            matches!(angle.nodes.as_slice(), [AstNode::AngleCalculation { mode, points, macro_name: Some(name) }] if mode == "angle" && points == &["A", "O", "B"] && name == "angleAOB")
        );
        let slope = parse_tikz_code(r"\tkzFindSlopeAngle(A,B)");
        assert!(
            matches!(slope.nodes.as_slice(), [AstNode::AngleCalculation { mode, points, macro_name: None }] if mode == "slope" && points == &["A", "B"])
        );
        let get = parse_tikz_code(r"\tkzGetAngle{slopeAB}");
        assert!(
            matches!(get.nodes.as_slice(), [AstNode::AngleRetrieval { macro_name }] if macro_name == "slopeAB")
        );
    }

    #[test]
    fn parses_all_random_point_regions() {
        let cases = [
            (
                r"\tkzDefRandPointOn[rectangle = A and B]\tkzGetPoint{P}",
                "rectangle",
                2,
                None,
            ),
            (
                r"\tkzDefRandPointOn[segment=A--B]\tkzGetPoint{P}",
                "segment",
                2,
                None,
            ),
            (
                r"\tkzDefRandPointOn[line=A--B]\tkzGetPoint{P}",
                "line",
                2,
                None,
            ),
            (
                r"\tkzDefRandPointOn[circle = center A radius 2]\tkzGetPoint{P}",
                "circle",
                1,
                Some(2.0),
            ),
            (
                r"\tkzDefRandPointOn[circle through= center A through B]\tkzGetPoint{P}",
                "circle_through",
                2,
                None,
            ),
            (
                r"\tkzDefRandPointOn[disk through=center A through B]\tkzGetPoint{P}",
                "disk_through",
                2,
                None,
            ),
        ];
        for (source, expected_mode, reference_count, expected_radius) in cases {
            let parsed = parse_tikz_code(source);
            match parsed.nodes.as_slice() {
                [AstNode::RandomPoint {
                    mode,
                    references,
                    radius,
                    name,
                }] => {
                    assert_eq!(mode, expected_mode);
                    assert_eq!(references.len(), reference_count);
                    assert_eq!(*radius, expected_radius);
                    assert_eq!(name, "P");
                }
                nodes => panic!("expected random point, got {nodes:?}"),
            }
        }
    }

    #[test]
    fn parses_segment_and_arc_markings() {
        let parsed = parse_tikz_code(
            r"\tkzMarkSegment[mark=|,color=red](A,B)
\tkzMarkSegments[mark=||,pos=.4](A,B C,D)
\tkzMarkArc[mark=x,size=5pt](O,A,B)",
        );
        assert_eq!(parsed.nodes.len(), 3);
        assert!(
            matches!(&parsed.nodes[0], AstNode::SegmentMark { p1, p2, options: Some(options) } if p1 == "A" && p2 == "B" && options.contains("color=red"))
        );
        assert!(
            matches!(&parsed.nodes[1], AstNode::SegmentsMark { pairs, options: Some(options) } if pairs == &[["A".to_string(), "B".to_string()], ["C".to_string(), "D".to_string()]] && options.contains("mark=||"))
        );
        assert!(
            matches!(&parsed.nodes[2], AstNode::ArcMark { center, start, end, options: Some(options) } if center == "O" && start == "A" && end == "B" && options.contains("size=5pt"))
        );
    }

    #[test]
    fn parses_single_multiple_and_right_angle_marks() {
        let parsed = parse_tikz_code(
            r"\tkzMarkAngle[arc=ll,mark=|](A,O,B)
\tkzMarkAngles[size=2](A,O,B B,O,C)
\tkzMarkRightAngle[fill=blue!20,size=.4](A,H,B)
\tkzMarkRightAngles[german,dotsize=4pt](A,H,B C,K,D)",
        );
        assert_eq!(parsed.nodes.len(), 4);
        assert!(
            matches!(&parsed.nodes[0], AstNode::AngleMark { p1, vertex, p2, options: Some(options), .. } if p1 == "A" && vertex == "O" && p2 == "B" && options.contains("arc=ll"))
        );
        assert!(
            matches!(&parsed.nodes[1], AstNode::AnglesMark { angles, options: Some(options) } if angles.len() == 2 && options == "size=2")
        );
        assert!(
            matches!(&parsed.nodes[2], AstNode::RightAngleMark { vertex, options: Some(options), .. } if vertex == "H" && options.contains("fill=blue!20"))
        );
        assert!(
            matches!(&parsed.nodes[3], AstNode::RightAnglesMark { angles, options: Some(options) } if angles.len() == 2 && options.contains("german"))
        );
    }

    #[test]
    fn parses_tikz_pic_angle_annotations() {
        let parsed = parse_tikz_code(
            r#"\tkzPicAngle["$\alpha$",draw=orange,angle radius=1cm](A,O,B)
\tkzPicRightAngle[draw,red,angle eccentricity=.5,pic text=.](C,H,A)"#,
        );
        assert_eq!(parsed.nodes.len(), 2);
        assert!(
            matches!(&parsed.nodes[0], AstNode::PicAngle { p1, vertex, p2, options: Some(options) } if p1 == "A" && vertex == "O" && p2 == "B" && options.contains("angle radius=1cm"))
        );
        assert!(
            matches!(&parsed.nodes[1], AstNode::PicRightAngle { vertex, options: Some(options), .. } if vertex == "H" && options.contains("pic text=."))
        );
    }

    #[test]
    fn fast_dispatch_skips_regular_latex_commands() {
        let parsed = parse_tikz_code(
            r"\documentclass{standalone}
\usepackage{tkz-euclide}
\begin{document}
\tkzDefPoint(0,0){A}
\unknownCommand{ignored}
\tkzDefPoint(2,1){B}
\end{document}",
        );

        assert_eq!(parsed.nodes.len(), 2);
        assert!(matches!(&parsed.nodes[0], AstNode::Point { name, .. } if name == "A"));
        assert!(matches!(&parsed.nodes[1], AstNode::Point { name, .. } if name == "B"));
    }

    fn benchmark_document(target_nodes: usize) -> String {
        let point_count = target_nodes / 2;
        let segment_count = target_nodes - point_count;
        let mut source = String::from("\\begin{tikzpicture}\n");

        for index in 0..point_count {
            let x = index % 100;
            let y = index / 100;
            source.push_str(&format!("\\tkzDefPoint({x},{y}){{P{index}}}\n"));
        }

        for index in 0..segment_count {
            let p1 = index % point_count;
            let p2 = (index + 1) % point_count;
            source.push_str(&format!("\\tkzDrawSegment(P{p1},P{p2})\n"));
        }

        source.push_str("\\end{tikzpicture}\n");
        source
    }

    #[test]
    #[ignore = "run with npm run perf:parse to collect parser benchmark baselines"]
    fn benchmarks_large_documents() {
        let iterations = env::var("STOICHEIA_PERF_ITERATIONS")
            .ok()
            .and_then(|value| value.parse::<usize>().ok())
            .filter(|value| *value > 0)
            .unwrap_or(3);

        println!("nodes,iteration,parse_ms,geometry_ms,viewport_ms,total_ms,resolved_points");

        for target_nodes in [50usize, 250, 1000, 5000] {
            let source = benchmark_document(target_nodes);
            for iteration in 1..=iterations {
                let result = parse_tikz_code(&source);
                assert_eq!(result.timings.node_count, target_nodes);
                assert!(result.geometry_complete);
                println!(
                    "{},{},{:.3},{:.3},{:.3},{:.3},{}",
                    target_nodes,
                    iteration,
                    result.timings.parse_ms,
                    result.timings.geometry_ms,
                    result.timings.viewport_ms,
                    result.timings.total_ms,
                    result.timings.resolved_point_count
                );
            }
        }
    }
}
