use crate::parser::AstNode;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::time::Instant;

const EPSILON: f64 = 1e-12;
const WORLD_SCALE: f64 = 28.3464567;

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
pub struct GeoPoint {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug)]
pub struct GeometryResolution {
    pub points: BTreeMap<String, GeoPoint>,
    pub complete: bool,
    pub viewport: Option<ResolvedViewport>,
    pub diagnostics: Vec<GeometryDiagnostic>,
    pub timings: GeometryTimings,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeometryDiagnostic {
    pub severity: String,
    pub message: String,
    pub node_index: usize,
    pub node_type: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub targets: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ResolvedViewport {
    #[serde(rename = "viewBox")]
    pub view_box: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeometryTimings {
    pub resolve_ms: f64,
    pub viewport_ms: f64,
    pub total_ms: f64,
}

fn elapsed_ms(start: Instant) -> f64 {
    start.elapsed().as_secs_f64() * 1000.0
}

fn add(a: GeoPoint, b: GeoPoint) -> GeoPoint {
    GeoPoint {
        x: a.x + b.x,
        y: a.y + b.y,
    }
}

fn subtract(a: GeoPoint, b: GeoPoint) -> GeoPoint {
    GeoPoint {
        x: a.x - b.x,
        y: a.y - b.y,
    }
}

fn scale(point: GeoPoint, factor: f64) -> GeoPoint {
    GeoPoint {
        x: point.x * factor,
        y: point.y * factor,
    }
}

fn length(point: GeoPoint) -> f64 {
    point.x.hypot(point.y)
}

fn normalize(point: GeoPoint) -> Option<GeoPoint> {
    let magnitude = length(point);
    (magnitude > 1e-9).then(|| scale(point, 1.0 / magnitude))
}

fn midpoint(a: GeoPoint, b: GeoPoint) -> GeoPoint {
    scale(add(a, b), 0.5)
}

fn point_on_line(a: GeoPoint, b: GeoPoint, position: f64) -> GeoPoint {
    add(a, scale(subtract(b, a), position))
}

fn point_on_circle(center: GeoPoint, radius: f64, angle_degrees: f64) -> GeoPoint {
    let angle = angle_degrees.to_radians();
    add(
        center,
        GeoPoint {
            x: radius * angle.cos(),
            y: radius * angle.sin(),
        },
    )
}

fn duplicate_segment_point(
    ray_start: GeoPoint,
    ray_through: GeoPoint,
    segment_start: GeoPoint,
    segment_end: GeoPoint,
) -> Option<GeoPoint> {
    normalize(subtract(ray_through, ray_start)).map(|direction| {
        add(
            ray_start,
            scale(direction, length(subtract(segment_end, segment_start))),
        )
    })
}

fn radical_axis_points(
    center1: GeoPoint,
    radius_point1: GeoPoint,
    center2: GeoPoint,
    radius_point2: GeoPoint,
) -> Option<Vec<GeoPoint>> {
    let centers = subtract(center2, center1);
    let distance = length(centers);
    let direction = normalize(centers)?;
    if distance < EPSILON {
        return None;
    }
    let radius1 = length(subtract(radius_point1, center1));
    let radius2 = length(subtract(radius_point2, center2));
    let position = (radius1 * radius1 - radius2 * radius2 + distance * distance) / (2.0 * distance);
    let foot = add(center1, scale(direction, position));
    let normal = perpendicular(direction);
    Some(vec![
        subtract(foot, scale(normal, 2.0)),
        add(foot, scale(normal, 2.0)),
    ])
}

fn barycentric(points: &[GeoPoint], weights: &[f64]) -> Option<GeoPoint> {
    if points.len() < 2 || points.len() != weights.len() {
        return None;
    }
    let total: f64 = weights.iter().sum();
    if total.abs() < EPSILON {
        return None;
    }
    Some(
        points
            .iter()
            .zip(weights)
            .fold(GeoPoint { x: 0.0, y: 0.0 }, |result, (point, weight)| {
                add(result, scale(*point, weight / total))
            }),
    )
}

fn project_on_line(point: GeoPoint, line_a: GeoPoint, line_b: GeoPoint) -> Option<GeoPoint> {
    let direction = subtract(line_b, line_a);
    let denominator = direction.x * direction.x + direction.y * direction.y;
    if denominator < EPSILON {
        return None;
    }
    let relative = subtract(point, line_a);
    let position = (relative.x * direction.x + relative.y * direction.y) / denominator;
    Some(add(line_a, scale(direction, position)))
}

fn perpendicular(direction: GeoPoint) -> GeoPoint {
    GeoPoint {
        x: -direction.y,
        y: direction.x,
    }
}

fn parse_radians(value: Option<&str>) -> Option<f64> {
    let normalized: String = value?
        .trim()
        .to_lowercase()
        .replace("\\pi", "pi")
        .replace('π', "pi")
        .chars()
        .filter(|character| !character.is_whitespace())
        .collect();
    if let Ok(direct) = normalized.parse::<f64>() {
        return direct.is_finite().then_some(direct);
    }

    let (raw_numerator, raw_denominator) = normalized.split_once("pi")?;
    let numerator_text = raw_numerator.strip_suffix('*').unwrap_or(raw_numerator);
    let numerator = match numerator_text {
        "" => 1.0,
        "-" => -1.0,
        value => value.parse::<f64>().ok()?,
    };
    let denominator = if raw_denominator.is_empty() {
        1.0
    } else {
        raw_denominator.strip_prefix('/')?.parse::<f64>().ok()?
    };
    (numerator.is_finite() && denominator.is_finite() && denominator != 0.0)
        .then_some(numerator * std::f64::consts::PI / denominator)
}

fn rotate_around(point: GeoPoint, center: GeoPoint, angle: f64) -> GeoPoint {
    let relative = subtract(point, center);
    let (sine, cosine) = angle.sin_cos();
    add(
        center,
        GeoPoint {
            x: relative.x * cosine - relative.y * sine,
            y: relative.x * sine + relative.y * cosine,
        },
    )
}

fn stable_random(key: &str, offset: u32) -> f64 {
    let mut hash = 2_166_136_261_u32 ^ offset;
    for unit in key.encode_utf16() {
        hash ^= u32::from(unit);
        hash = hash.wrapping_mul(16_777_619);
    }
    f64::from(hash) / 4_294_967_296.0
}

fn random_point(
    mode: &str,
    references: &[GeoPoint],
    radius: Option<f64>,
    key: &str,
) -> Option<GeoPoint> {
    let first = *references.first()?;
    let second = references.get(1).copied();
    let u = stable_random(key, 0);
    let v = stable_random(key, 0x9e37_79b9);

    match mode {
        "rectangle" => second.map(|second| GeoPoint {
            x: first.x + (second.x - first.x) * u,
            y: first.y + (second.y - first.y) * v,
        }),
        "segment" => second.map(|second| point_on_line(first, second, u)),
        "line" => second.map(|second| point_on_line(first, second, u * 4.0 - 1.5)),
        "circle" | "circle_through" | "disk_through" => {
            let circle_radius = if mode == "circle" {
                radius
            } else {
                second.map(|second| length(subtract(second, first)))
            }?;
            if circle_radius <= 0.0 {
                return None;
            }
            let boundary = point_on_circle(first, circle_radius, u * 360.0);
            Some(if mode == "disk_through" {
                point_on_line(first, boundary, v)
            } else {
                boundary
            })
        }
        _ => None,
    }
}

fn transform_point(
    mode: &str,
    source: GeoPoint,
    references: &[GeoPoint],
    value: Option<&str>,
) -> Option<GeoPoint> {
    match mode {
        "translation" if references.len() >= 2 => {
            Some(add(source, subtract(references[1], references[0])))
        }
        "homothety" if !references.is_empty() => {
            let ratio = value?.parse::<f64>().ok()?;
            ratio
                .is_finite()
                .then(|| add(references[0], scale(subtract(source, references[0]), ratio)))
        }
        "reflection" | "projection" if references.len() >= 2 => {
            let foot = project_on_line(source, references[0], references[1])?;
            Some(if mode == "projection" {
                foot
            } else {
                subtract(scale(foot, 2.0), source)
            })
        }
        "symmetry" if !references.is_empty() => Some(subtract(scale(references[0], 2.0), source)),
        "rotation" if !references.is_empty() => {
            let angle = value?.parse::<f64>().ok()?.to_radians();
            angle
                .is_finite()
                .then(|| rotate_around(source, references[0], angle))
        }
        "rotation_in_rad" if !references.is_empty() => {
            parse_radians(value).map(|angle| rotate_around(source, references[0], angle))
        }
        "rotation_with_nodes" if references.len() >= 3 => {
            let from = subtract(references[1], references[0]);
            let to = subtract(references[2], references[0]);
            if length(from) < EPSILON || length(to) < EPSILON {
                return None;
            }
            Some(rotate_around(
                source,
                references[0],
                to.y.atan2(to.x) - from.y.atan2(from.x),
            ))
        }
        "inversion" | "inversion_negative" if references.len() >= 2 => {
            let direction = subtract(source, references[0]);
            let distance_squared = direction.x * direction.x + direction.y * direction.y;
            let radius = length(subtract(references[1], references[0]));
            if distance_squared < EPSILON || radius < EPSILON {
                return None;
            }
            let sign = if mode == "inversion_negative" {
                -1.0
            } else {
                1.0
            };
            Some(add(
                references[0],
                scale(direction, sign * radius * radius / distance_squared),
            ))
        }
        _ => None,
    }
}

fn vector_point(
    mode: &str,
    p1: GeoPoint,
    p2: GeoPoint,
    factor: f64,
    anchor: Option<GeoPoint>,
) -> Option<GeoPoint> {
    let vector = subtract(p2, p1);
    if length(vector) < EPSILON || !factor.is_finite() {
        return None;
    }
    let direction = if mode.ends_with("_normed") {
        normalize(vector)?
    } else {
        vector
    };
    if mode.starts_with("orthogonal") {
        Some(add(p1, scale(perpendicular(direction), factor)))
    } else if mode.starts_with("linear") {
        Some(add(p1, scale(direction, factor)))
    } else if mode.starts_with("colinear") {
        Some(add(anchor?, scale(direction, factor)))
    } else {
        None
    }
}

fn triangle_orthocenter(a: GeoPoint, b: GeoPoint, c: GeoPoint) -> Option<GeoPoint> {
    let foot_a = project_on_line(a, b, c)?;
    let foot_b = project_on_line(b, a, c)?;
    line_intersection(a, foot_a, b, foot_b)
}

fn triangle_circumcenter(a: GeoPoint, b: GeoPoint, c: GeoPoint) -> Option<GeoPoint> {
    let denominator = 2.0 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if denominator.abs() < EPSILON {
        return None;
    }
    let a2 = a.x * a.x + a.y * a.y;
    let b2 = b.x * b.x + b.y * b.y;
    let c2 = c.x * c.x + c.y * c.y;
    Some(GeoPoint {
        x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / denominator,
        y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / denominator,
    })
}

fn triangle_center(
    option: &str,
    a_point: GeoPoint,
    b_point: GeoPoint,
    c_point: GeoPoint,
) -> Option<GeoPoint> {
    let a = length(subtract(b_point, c_point));
    let b = length(subtract(c_point, a_point));
    let c = length(subtract(a_point, b_point));
    let semiperimeter = (a + b + c) / 2.0;
    let ab = subtract(b_point, a_point);
    let ac = subtract(c_point, a_point);
    let area = (ab.x * ac.y - ab.y * ac.x).abs() / 2.0;
    if area < EPSILON {
        return None;
    }
    let vertices = [a_point, b_point, c_point];
    let weighted = |weights: [f64; 3]| barycentric(&vertices, &weights);
    let normalized = match option {
        "orthic" => "ortho",
        "median" => "centroid",
        "lemoine" | "grebe" => "symmedian",
        other => other,
    };

    match normalized {
        "ortho" => triangle_orthocenter(a_point, b_point, c_point),
        "centroid" => weighted([1.0, 1.0, 1.0]),
        "circum" => triangle_circumcenter(a_point, b_point, c_point),
        "in" => weighted([a, b, c]),
        "ex" => weighted([a, -b, c]),
        "symmedian" => weighted([a * a, b * b, c * c]),
        "spieker" => weighted([b + c, c + a, a + b]),
        "gergonne" => weighted([
            1.0 / (semiperimeter - a),
            1.0 / (semiperimeter - b),
            1.0 / (semiperimeter - c),
        ]),
        "nagel" => weighted([semiperimeter - a, semiperimeter - b, semiperimeter - c]),
        "mittenpunkt" => weighted([
            a * (semiperimeter - a),
            b * (semiperimeter - b),
            c * (semiperimeter - c),
        ]),
        "euler" => triangle_circumcenter(a_point, b_point, c_point)
            .zip(triangle_orthocenter(a_point, b_point, c_point))
            .map(|(circumcenter, orthocenter)| midpoint(circumcenter, orthocenter)),
        "feuerbach" => {
            let incenter = weighted([a, b, c])?;
            let euler_center = triangle_circumcenter(a_point, b_point, c_point)
                .zip(triangle_orthocenter(a_point, b_point, c_point))
                .map(|(circumcenter, orthocenter)| midpoint(circumcenter, orthocenter))?;
            let direction = normalize(subtract(incenter, euler_center))?;
            Some(add(incenter, scale(direction, area / semiperimeter)))
        }
        _ => None,
    }
}

fn defined_line_points(
    mode: &str,
    points: &[GeoPoint],
    through: Option<GeoPoint>,
    factor: f64,
    normed: bool,
) -> Option<Vec<GeoPoint>> {
    let direction = points
        .get(0)
        .zip(points.get(1))
        .map(|(first, second)| subtract(*second, *first));
    let scaled_direction = direction.and_then(|direction| {
        if normed {
            normalize(direction)
        } else {
            Some(direction)
        }
    });
    match mode {
        "mediator" => {
            let direction = scaled_direction?;
            let center = midpoint(points[0], points[1]);
            let offset = scale(perpendicular(direction), factor);
            Some(vec![subtract(center, offset), add(center, offset)])
        }
        "perpendicular" | "orthogonal" => Some(vec![add(
            through?,
            scale(perpendicular(scaled_direction?), factor),
        )]),
        "parallel" => Some(vec![add(through?, scale(scaled_direction?, factor))]),
        "bisector" | "bisector_out" if points.len() == 3 => {
            let first = normalize(subtract(points[0], points[1]))?;
            let second = normalize(subtract(points[2], points[1]))?;
            let direction = if mode == "bisector" {
                add(first, second)
            } else {
                subtract(first, second)
            };
            Some(vec![add(points[1], scale(normalize(direction)?, factor))])
        }
        "symmedian" if points.len() == 3 => {
            let first_length = length(subtract(points[0], points[1]));
            let third_length = length(subtract(points[2], points[1]));
            barycentric(
                &[points[0], points[2]],
                &[third_length * third_length, first_length * first_length],
            )
            .map(|point| vec![point])
        }
        "altitude" if points.len() == 3 => {
            project_on_line(points[1], points[0], points[2]).map(|point| vec![point])
        }
        "euler" if points.len() == 3 => triangle_orthocenter(points[0], points[1], points[2])
            .zip(barycentric(points, &[1.0, 1.0, 1.0]))
            .map(|(orthocenter, centroid)| vec![orthocenter, centroid]),
        "tangent_at" if !points.is_empty() => {
            let through = through?;
            let radius = subtract(through, points[0]);
            if length(radius) < EPSILON {
                None
            } else {
                let radius = if normed { normalize(radius)? } else { radius };
                Some(vec![add(through, scale(perpendicular(radius), factor))])
            }
        }
        "tangent_from" if points.len() >= 2 => {
            let center = points[0];
            let radius = length(subtract(points[1], center));
            let external_vector = subtract(through?, center);
            let distance = length(external_vector);
            if radius < EPSILON || distance <= radius {
                return None;
            }
            let base = add(
                center,
                scale(external_vector, radius * radius / (distance * distance)),
            );
            let offset = scale(
                perpendicular(normalize(external_vector)?),
                radius * (distance * distance - radius * radius).sqrt() / distance,
            );
            Some(vec![add(base, offset), subtract(base, offset)])
        }
        _ => None,
    }
}

fn triangle_from_angles(a: GeoPoint, b: GeoPoint, angle_a: f64, angle_b: f64) -> Option<GeoPoint> {
    let base = subtract(b, a);
    let base_length = length(base);
    let direction = normalize(base)?;
    let angle_c = 180.0 - angle_a - angle_b;
    if angle_a <= 0.0 || angle_b <= 0.0 || angle_c <= 0.0 {
        return None;
    }
    let side_ac = base_length * angle_b.to_radians().sin() / angle_c.to_radians().sin();
    let radians = angle_a.to_radians();
    let rotated = add(
        scale(direction, radians.cos()),
        scale(perpendicular(direction), radians.sin()),
    );
    Some(add(a, scale(rotated, side_ac)))
}

fn defined_triangle_point(
    mode: &str,
    a: GeoPoint,
    b: GeoPoint,
    angle1: Option<f64>,
    angle2: Option<f64>,
    swap: bool,
) -> Option<GeoPoint> {
    let base = subtract(b, a);
    let base_length = length(base);
    let direction = normalize(base)?;
    if base_length < EPSILON {
        return None;
    }
    let normal = perpendicular(direction);
    let result = match mode {
        "two_angles" => triangle_from_angles(a, b, angle1?, angle2?),
        "equilateral" => triangle_from_angles(a, b, 60.0, 60.0),
        "half" => Some(add(b, scale(normal, -base_length / 2.0))),
        "isosceles_right" => triangle_from_angles(a, b, 45.0, 45.0),
        "pythagore" | "pythagoras" | "egyptian" => {
            Some(add(b, scale(normal, -base_length * 3.0 / 4.0)))
        }
        "school" => Some(add(b, scale(normal, base_length / 3.0_f64.sqrt()))),
        "gold" => Some(add(
            b,
            scale(normal, -base_length / ((1.0 + 5.0_f64.sqrt()) / 2.0)),
        )),
        "euclid" => triangle_from_angles(a, b, 36.0, 72.0).and_then(|positive| {
            project_on_line(positive, a, b).map(|foot| subtract(scale(foot, 2.0), positive))
        }),
        "golden" | "sublime" => triangle_from_angles(a, b, 72.0, 72.0),
        "cheops" => Some(add(
            midpoint(a, b),
            scale(
                normal,
                base_length * ((1.0 + 5.0_f64.sqrt()) / 2.0).sqrt() / 2.0,
            ),
        )),
        _ => None,
    }?;
    if !swap {
        return Some(result);
    }
    project_on_line(result, a, b).map(|foot| subtract(scale(foot, 2.0), result))
}

fn associated_triangle_points(
    mode: &str,
    a_point: GeoPoint,
    b_point: GeoPoint,
    c_point: GeoPoint,
) -> Option<Vec<GeoPoint>> {
    let normalized = match mode {
        "medial" => "centroid",
        "incentral" => "in",
        "excentral" => "ex",
        "contact" => "intouch",
        "ortho" => "orthic",
        other => other,
    };
    let a = length(subtract(b_point, c_point));
    let b = length(subtract(c_point, a_point));
    let c = length(subtract(a_point, b_point));
    let semiperimeter = (a + b + c) / 2.0;
    let ab = subtract(b_point, a_point);
    let ac = subtract(c_point, a_point);
    let area = (ab.x * ac.y - ab.y * ac.x).abs() / 2.0;
    if area < EPSILON || a < EPSILON || b < EPSILON || c < EPSILON {
        return None;
    }

    match normalized {
        "centroid" => Some(vec![
            midpoint(b_point, c_point),
            midpoint(c_point, a_point),
            midpoint(a_point, b_point),
        ]),
        "in" => Some(vec![
            point_on_line(b_point, c_point, c / (b + c)),
            point_on_line(c_point, a_point, a / (c + a)),
            point_on_line(a_point, b_point, b / (a + b)),
        ]),
        "ex" => {
            let ex_a = barycentric(&[a_point, b_point, c_point], &[-a, b, c])?;
            let ex_b = barycentric(&[a_point, b_point, c_point], &[a, -b, c])?;
            let ex_c = barycentric(&[a_point, b_point, c_point], &[a, b, -c])?;
            Some(vec![ex_a, ex_b, ex_c])
        }
        "intouch" => Some(vec![
            point_on_line(b_point, c_point, (semiperimeter - b) / a),
            point_on_line(c_point, a_point, (semiperimeter - c) / b),
            point_on_line(a_point, b_point, (semiperimeter - a) / c),
        ]),
        "extouch" => Some(vec![
            point_on_line(b_point, c_point, (semiperimeter - c) / a),
            point_on_line(c_point, a_point, (semiperimeter - a) / b),
            point_on_line(a_point, b_point, (semiperimeter - b) / c),
        ]),
        "orthic" => Some(vec![
            project_on_line(a_point, b_point, c_point)?,
            project_on_line(b_point, a_point, c_point)?,
            project_on_line(c_point, a_point, b_point)?,
        ]),
        "euler" => {
            let orthocenter = triangle_orthocenter(a_point, b_point, c_point)?;
            Some(vec![
                midpoint(a_point, orthocenter),
                midpoint(b_point, orthocenter),
                midpoint(c_point, orthocenter),
            ])
        }
        "symmedial" => Some(vec![
            point_on_line(b_point, c_point, c * c / (b * b + c * c)),
            point_on_line(c_point, a_point, a * a / (c * c + a * a)),
            point_on_line(a_point, b_point, b * b / (a * a + b * b)),
        ]),
        "tangential" => {
            let circumcenter = triangle_circumcenter(a_point, b_point, c_point)?;
            let dir_a = perpendicular(subtract(a_point, circumcenter));
            let dir_b = perpendicular(subtract(b_point, circumcenter));
            let dir_c = perpendicular(subtract(c_point, circumcenter));
            let ta = line_intersection(b_point, add(b_point, dir_b), c_point, add(c_point, dir_c))?;
            let tb = line_intersection(c_point, add(c_point, dir_c), a_point, add(a_point, dir_a))?;
            let tc = line_intersection(a_point, add(a_point, dir_a), b_point, add(b_point, dir_b))?;
            Some(vec![ta, tb, tc])
        }
        "feuerbach" => {
            let excenters = associated_triangle_points("ex", a_point, b_point, c_point)?;
            let vertices = [a_point, b_point, c_point];
            let exradii = [
                area / (semiperimeter - a),
                area / (semiperimeter - b),
                area / (semiperimeter - c),
            ];
            Some(
                excenters
                    .iter()
                    .enumerate()
                    .map(|(index, excenter)| {
                        normalize(subtract(*excenter, vertices[index]))
                            .map(|direction| subtract(*excenter, scale(direction, exradii[index])))
                            .unwrap_or(*excenter)
                    })
                    .collect(),
            )
        }
        _ => None,
    }
}

fn polygon_construction_points(
    mode: &str,
    points: &[GeoPoint],
    regular_mode: Option<&str>,
    sides: Option<usize>,
) -> Option<Vec<GeoPoint>> {
    match mode {
        "square" if points.len() == 2 => {
            let side = subtract(points[1], points[0]);
            if length(side) < EPSILON {
                return None;
            }
            let offset = perpendicular(side);
            Some(vec![add(points[1], offset), add(points[0], offset)])
        }
        "rectangle" if points.len() == 2 => {
            let a = points[0];
            let c = points[1];
            if (a.x - c.x).abs() < EPSILON || (a.y - c.y).abs() < EPSILON {
                return None;
            }
            Some(vec![
                GeoPoint { x: c.x, y: a.y },
                GeoPoint { x: a.x, y: c.y },
            ])
        }
        "golden_rectangle" if points.len() == 2 => {
            let side = subtract(points[1], points[0]);
            if length(side) < EPSILON {
                return None;
            }
            let offset = scale(perpendicular(side), 2.0 / (1.0 + 5.0_f64.sqrt()));
            Some(vec![add(points[1], offset), add(points[0], offset)])
        }
        "regular_polygon" if points.len() == 2 => {
            let side = subtract(points[1], points[0]);
            if length(side) < EPSILON {
                return None;
            }
            let sides = sides.unwrap_or(5);
            if sides < 3 {
                return None;
            }
            let mut center = points[0];
            let mut vertex = points[1];
            if regular_mode == Some("side") {
                let middle = midpoint(points[0], points[1]);
                let direction = normalize(side)?;
                let apothem = length(side) / 2.0 / (std::f64::consts::PI / sides as f64).tan();
                center = add(middle, scale(perpendicular(direction), apothem));
                vertex = points[0];
            }
            let radius = subtract(vertex, center);
            Some(
                (0..sides)
                    .map(|index| {
                        let angle = std::f64::consts::TAU * index as f64 / sides as f64;
                        let (sine, cosine) = angle.sin_cos();
                        add(
                            center,
                            GeoPoint {
                                x: radius.x * cosine - radius.y * sine,
                                y: radius.x * sine + radius.y * cosine,
                            },
                        )
                    })
                    .collect(),
            )
        }
        "parallelogram" if points.len() == 3 => {
            let ab = subtract(points[1], points[0]);
            let bc = subtract(points[2], points[1]);
            if (ab.x * bc.y - ab.y * bc.x).abs() < EPSILON {
                return None;
            }
            Some(vec![add(points[0], subtract(points[2], points[1]))])
        }
        "permute" if points.len() == 3 => {
            let ab = subtract(points[1], points[0]);
            let ac = subtract(points[2], points[0]);
            let ab_direction = normalize(ab)?;
            let ac_direction = normalize(ac)?;
            Some(vec![
                add(points[0], scale(ac_direction, length(ab))),
                add(points[0], scale(ab_direction, length(ac))),
            ])
        }
        _ => None,
    }
}

fn defined_circle_points(
    mode: &str,
    points: &[GeoPoint],
    references: &[GeoPoint],
    value: Option<f64>,
) -> Option<Vec<GeoPoint>> {
    match mode {
        "R" if !points.is_empty() && value.is_some_and(|radius| radius > 0.0) => {
            Some(vec![add(points[0], GeoPoint { x: value?, y: 0.0 })])
        }
        "diameter" if points.len() == 2 => Some(vec![midpoint(points[0], points[1]), points[1]]),
        "circum" if points.len() == 3 => triangle_circumcenter(points[0], points[1], points[2])
            .map(|center| vec![center, points[0]]),
        "euler" | "nine" if points.len() == 3 => {
            triangle_circumcenter(points[0], points[1], points[2])
                .zip(triangle_orthocenter(points[0], points[1], points[2]))
                .map(|(circumcenter, orthocenter)| {
                    vec![
                        midpoint(circumcenter, orthocenter),
                        midpoint(points[0], points[1]),
                    ]
                })
        }
        "in" | "ex" | "spieker" if points.len() == 3 => {
            let a = length(subtract(points[1], points[2]));
            let b = length(subtract(points[2], points[0]));
            let c = length(subtract(points[0], points[1]));
            let ab = subtract(points[1], points[0]);
            let ac = subtract(points[2], points[0]);
            let area = (ab.x * ac.y - ab.y * ac.x).abs() / 2.0;
            if area < EPSILON {
                return None;
            }
            let center = match mode {
                "in" => barycentric(points, &[a, b, c]),
                "ex" => barycentric(points, &[a, -b, c]),
                _ => barycentric(points, &[b + c, c + a, a + b]),
            }?;
            if mode == "spieker" {
                let radius = area / (a + b + c);
                Some(vec![center, add(center, GeoPoint { x: radius, y: 0.0 })])
            } else {
                project_on_line(center, points[0], points[2])
                    .map(|radius_point| vec![center, radius_point])
            }
        }
        "apollonius"
            if points.len() == 2
                && value.is_some_and(|ratio| ratio > 0.0 && (ratio - 1.0).abs() > EPSILON) =>
        {
            let ratio = value?;
            barycentric(points, &[1.0, ratio])
                .zip(barycentric(points, &[1.0, -ratio]))
                .map(|(internal, external)| vec![midpoint(internal, external), internal])
        }
        "orthogonal_from" if points.len() == 2 && !references.is_empty() => {
            defined_line_points("tangent_from", points, Some(references[0]), 1.0, false)
        }
        "orthogonal_through" if points.len() == 2 && references.len() == 2 => {
            let base_center = points[0];
            let first = references[0];
            let second = references[1];
            let distance = length(subtract(first, base_center));
            let direction = normalize(subtract(first, base_center))?;
            if distance < EPSILON {
                return None;
            }
            let inverse = add(base_center, scale(direction, 1.0 / distance));
            triangle_circumcenter(inverse, first, second).map(|center| vec![center, first])
        }
        _ => None,
    }
}

fn projected_excenter_points(a: GeoPoint, b: GeoPoint, c: GeoPoint) -> Option<Vec<GeoPoint>> {
    let excenters = associated_triangle_points("ex", a, b, c)?;
    let side_pairs = [(b, c), (a, c), (b, a)];
    side_pairs
        .iter()
        .flat_map(|(side_a, side_b)| {
            excenters
                .iter()
                .map(|excenter| project_on_line(*excenter, *side_a, *side_b))
        })
        .collect()
}

fn transformed_circle_points(
    mode: &str,
    center: GeoPoint,
    radius_point: GeoPoint,
    references: &[GeoPoint],
    value: Option<&str>,
) -> Option<Vec<GeoPoint>> {
    if mode != "inversion" {
        let transformed_center = transform_point(mode, center, references, value)?;
        let transformed_radius = transform_point(mode, radius_point, references, value)?;
        return Some(vec![transformed_center, transformed_radius]);
    }

    let inversion_center = *references.first()?;
    let inversion_through = *references.get(1)?;
    let circle_radius = length(subtract(radius_point, center));
    let inversion_radius_squared = length(subtract(inversion_through, inversion_center)).powi(2);
    let center_vector = subtract(center, inversion_center);
    let denominator = length(center_vector).powi(2) - circle_radius.powi(2);
    if circle_radius < EPSILON || inversion_radius_squared < EPSILON || denominator.abs() < EPSILON
    {
        return None;
    }
    let image_center = add(
        inversion_center,
        scale(center_vector, inversion_radius_squared / denominator),
    );
    let image_radius = (inversion_radius_squared * circle_radius / denominator).abs();
    let direction = normalize(center_vector).unwrap_or(GeoPoint { x: 1.0, y: 0.0 });
    Some(vec![
        image_center,
        add(image_center, scale(perpendicular(direction), image_radius)),
    ])
}

fn line_circle_intersections(
    line_a: GeoPoint,
    line_b: GeoPoint,
    center: GeoPoint,
    radius: f64,
    near: bool,
    common: Option<GeoPoint>,
) -> Option<Vec<GeoPoint>> {
    let direction = subtract(line_b, line_a);
    let a = direction.x * direction.x + direction.y * direction.y;
    if a < EPSILON || radius < 0.0 {
        return None;
    }
    let relative = subtract(line_a, center);
    let b = 2.0 * (relative.x * direction.x + relative.y * direction.y);
    let c = relative.x * relative.x + relative.y * relative.y - radius * radius;
    let discriminant = b * b - 4.0 * a * c;
    if discriminant < -1e-10 {
        return None;
    }
    let root = discriminant.max(0.0).sqrt();
    let mut points: Vec<_> = [(-b + root) / (2.0 * a), (-b - root) / (2.0 * a)]
        .into_iter()
        .map(|position| add(line_a, scale(direction, position)))
        .collect();
    if near {
        points.sort_by(|first, second| {
            length(subtract(*first, line_a)).total_cmp(&length(subtract(*second, line_a)))
        });
    } else if let Some(common) = common {
        points.sort_by(|first, second| {
            length(subtract(*second, common)).total_cmp(&length(subtract(*first, common)))
        });
    }
    Some(points)
}

fn circle_circle_intersections(
    center1: GeoPoint,
    radius1: f64,
    center2: GeoPoint,
    radius2: f64,
    common: Option<GeoPoint>,
) -> Option<Vec<GeoPoint>> {
    let centers = subtract(center2, center1);
    let distance = length(centers);
    if radius1 < 0.0
        || radius2 < 0.0
        || distance < EPSILON
        || distance > radius1 + radius2 + 1e-10
        || distance < (radius1 - radius2).abs() - 1e-10
    {
        return None;
    }
    let along = (radius1 * radius1 - radius2 * radius2 + distance * distance) / (2.0 * distance);
    let height_squared = radius1 * radius1 - along * along;
    if height_squared < -1e-10 {
        return None;
    }
    let unit = scale(centers, 1.0 / distance);
    let base = add(center1, scale(unit, along));
    let offset = scale(perpendicular(unit), height_squared.max(0.0).sqrt());
    let mut points = vec![add(base, offset), subtract(base, offset)];
    let cross_at = |point: GeoPoint| {
        let to_first = subtract(center1, point);
        let to_second = subtract(center2, point);
        to_first.x * to_second.y - to_first.y * to_second.x
    };
    points.sort_by(|first, second| cross_at(*first).total_cmp(&cross_at(*second)));
    if let Some(common) = common {
        points.sort_by(|first, second| {
            length(subtract(*second, common)).total_cmp(&length(subtract(*first, common)))
        });
    }
    Some(points)
}

fn line_intersection(a1: GeoPoint, a2: GeoPoint, b1: GeoPoint, b2: GeoPoint) -> Option<GeoPoint> {
    let a = subtract(a2, a1);
    let b = subtract(b2, b1);
    let determinant = a.x * b.y - a.y * b.x;
    if determinant.abs() < EPSILON {
        return None;
    }
    let delta = subtract(b1, a1);
    let position = (delta.x * b.y - delta.y * b.x) / determinant;
    Some(add(a1, scale(a, position)))
}

fn get(points: &BTreeMap<String, GeoPoint>, name: &str) -> Option<GeoPoint> {
    points.get(name).copied()
}

fn push_circular_bounds(bounds: &mut Vec<GeoPoint>, center: GeoPoint, radius: f64) {
    if !radius.is_finite() || radius <= 0.0 {
        return;
    }
    bounds.push(GeoPoint {
        x: center.x - radius,
        y: center.y - radius,
    });
    bounds.push(GeoPoint {
        x: center.x + radius,
        y: center.y + radius,
    });
}

fn radius_from_arc_like(
    mode: &str,
    first: &str,
    center: GeoPoint,
    points: &BTreeMap<String, GeoPoint>,
) -> Option<f64> {
    if mode == "R" || mode == "R_with_nodes" {
        first.parse::<f64>().ok()
    } else {
        get(points, first).map(|radius_point| length(subtract(radius_point, center)))
    }
}

fn calculate_viewport(nodes: &[AstNode], points: &BTreeMap<String, GeoPoint>) -> ResolvedViewport {
    let mut bounds: Vec<GeoPoint> = points.values().copied().collect();

    for node in nodes {
        match node {
            AstNode::Circle {
                center,
                radius_point,
                ..
            } => {
                if let Some((center, radius_point)) =
                    get(points, center).zip(get(points, radius_point))
                {
                    push_circular_bounds(
                        &mut bounds,
                        center,
                        length(subtract(radius_point, center)),
                    );
                }
            }
            AstNode::Arc {
                mode,
                center,
                first,
                ..
            }
            | AstNode::Sector {
                mode,
                center,
                first,
                ..
            }
            | AstNode::FillSector {
                mode,
                center,
                first,
                ..
            } => {
                if let Some(center) = get(points, center) {
                    if let Some(radius) = radius_from_arc_like(mode, first, center, points) {
                        push_circular_bounds(&mut bounds, center, radius);
                    }
                }
            }
            AstNode::FillCircle {
                mode,
                center,
                radius,
                ..
            } => {
                if let Some(center) = get(points, center) {
                    let resolved_radius = if mode == "R" {
                        radius.parse::<f64>().ok()
                    } else {
                        get(points, radius)
                            .map(|radius_point| length(subtract(radius_point, center)))
                    };
                    if let Some(radius) = resolved_radius {
                        push_circular_bounds(&mut bounds, center, radius);
                    }
                }
            }
            AstNode::Ellipse {
                center,
                x_radius,
                y_radius,
                ..
            } => {
                if let Some(center) = get(points, center) {
                    push_circular_bounds(&mut bounds, center, (*x_radius).max(*y_radius));
                }
            }
            AstNode::CanvasInit {
                xmin,
                xmax,
                ymin,
                ymax,
                ..
            } => {
                bounds.push(GeoPoint { x: *xmin, y: *ymin });
                bounds.push(GeoPoint { x: *xmax, y: *ymax });
            }
            _ => {}
        }
    }

    if bounds.is_empty() {
        return ResolvedViewport {
            view_box: format!(
                "{} {} {} {}",
                -5.0 * WORLD_SCALE,
                -5.0 * WORLD_SCALE,
                10.0 * WORLD_SCALE,
                10.0 * WORLD_SCALE
            ),
        };
    }

    let min_x = bounds
        .iter()
        .map(|point| point.x)
        .fold(f64::INFINITY, f64::min);
    let max_x = bounds
        .iter()
        .map(|point| point.x)
        .fold(f64::NEG_INFINITY, f64::max);
    let min_y = bounds
        .iter()
        .map(|point| point.y)
        .fold(f64::INFINITY, f64::min);
    let max_y = bounds
        .iter()
        .map(|point| point.y)
        .fold(f64::NEG_INFINITY, f64::max);
    let span = (max_x - min_x).max(max_y - min_y).max(2.0);
    let padding = 1.5_f64.max(span * 0.45);
    let svg_min_x = (min_x - padding) * WORLD_SCALE;
    let svg_min_y = -(max_y + padding) * WORLD_SCALE;
    let width = (max_x - min_x + padding * 2.0) * WORLD_SCALE;
    let height = (max_y - min_y + padding * 2.0) * WORLD_SCALE;

    ResolvedViewport {
        view_box: format!("{svg_min_x} {svg_min_y} {width} {height}"),
    }
}

fn geometry_node_type(node: &AstNode) -> &'static str {
    match node {
        AstNode::Point { .. } => "Point",
        AstNode::IntersectionPoint { .. } => "IntersectionPoint",
        AstNode::MidPoint { .. } => "MidPoint",
        AstNode::GoldenRatioPoint { .. } => "GoldenRatioPoint",
        AstNode::BarycentricPoint { .. } => "BarycentricPoint",
        AstNode::SimilitudeCenter { .. } => "SimilitudeCenter",
        AstNode::HarmonicPoint { .. } => "HarmonicPoint",
        AstNode::HarmonicPair { .. } => "HarmonicPair",
        AstNode::EquiPoints { .. } => "EquiPoints",
        AstNode::MidArcPoint { .. } => "MidArcPoint",
        AstNode::PointOnLine { .. } => "PointOnLine",
        AstNode::PointOnCircle { .. } => "PointOnCircle",
        AstNode::RandomPoint { .. } => "RandomPoint",
        AstNode::PointTransformation { .. } => "PointTransformation",
        AstNode::PointsTransformation { .. } => "PointsTransformation",
        AstNode::VectorPoint { .. } => "VectorPoint",
        AstNode::DuplicateSegment { .. } => "DuplicateSegment",
        AstNode::RadicalAxis { .. } => "RadicalAxis",
        AstNode::SwapPoints { .. } => "SwapPoints",
        AstNode::DefinedLine { .. } => "DefinedLine",
        AstNode::DefinedTriangle { .. } => "DefinedTriangle",
        AstNode::TriangleCenter { .. } => "TriangleCenter",
        AstNode::AssociatedTriangle { .. } => "AssociatedTriangle",
        AstNode::PolygonConstruction { .. } => "PolygonConstruction",
        AstNode::DefinedCircle { .. } => "DefinedCircle",
        AstNode::ProjectedExcenters { .. } => "ProjectedExcenters",
        AstNode::CircleTransformation { .. } => "CircleTransformation",
        AstNode::LineCircleIntersection { .. } => "LineCircleIntersection",
        AstNode::CircleCircleIntersection { .. } => "CircleCircleIntersection",
        _ => "Geometry",
    }
}

fn geometry_output_names(node: &AstNode) -> Vec<String> {
    match node {
        AstNode::Point { name, .. }
        | AstNode::IntersectionPoint { name, .. }
        | AstNode::MidPoint { name, .. }
        | AstNode::GoldenRatioPoint { name, .. }
        | AstNode::BarycentricPoint { name, .. }
        | AstNode::SimilitudeCenter { name, .. }
        | AstNode::HarmonicPoint { name, .. }
        | AstNode::MidArcPoint { name, .. }
        | AstNode::PointOnLine { name, .. }
        | AstNode::PointOnCircle { name, .. }
        | AstNode::RandomPoint { name, .. }
        | AstNode::PointTransformation { name, .. }
        | AstNode::VectorPoint { name, .. }
        | AstNode::DuplicateSegment { name, .. }
        | AstNode::DefinedTriangle { name, .. }
        | AstNode::TriangleCenter { name, .. } => vec![name.clone()],
        AstNode::HarmonicPair { name1, name2, .. } | AstNode::EquiPoints { name1, name2, .. } => {
            vec![name1.clone(), name2.clone()]
        }
        AstNode::PointsTransformation { names, .. } => names.clone(),
        AstNode::RadicalAxis { results, .. }
        | AstNode::DefinedLine { results, .. }
        | AstNode::AssociatedTriangle { results, .. }
        | AstNode::PolygonConstruction { results, .. }
        | AstNode::DefinedCircle { results, .. }
        | AstNode::ProjectedExcenters { results, .. }
        | AstNode::CircleTransformation { results, .. }
        | AstNode::LineCircleIntersection { results, .. }
        | AstNode::CircleCircleIntersection { results, .. } => results.clone(),
        AstNode::SwapPoints { p1, p2 } => vec![p1.clone(), p2.clone()],
        _ => Vec::new(),
    }
}

fn unresolved_geometry_diagnostic(
    node_index: usize,
    node: &AstNode,
    points: &BTreeMap<String, GeoPoint>,
) -> GeometryDiagnostic {
    let targets = geometry_output_names(node)
        .into_iter()
        .filter(|name| !points.contains_key(name))
        .collect::<Vec<_>>();
    let node_type = geometry_node_type(node).to_string();
    let target_text = if targets.is_empty() {
        "geometry node".to_string()
    } else {
        format!("target {}", targets.join(", "))
    };

    GeometryDiagnostic {
        severity: "warning".to_string(),
        message: format!("Could not resolve {target_text} for {node_type}"),
        node_index,
        node_type,
        targets,
    }
}

pub fn resolve_geometry(nodes: &[AstNode]) -> GeometryResolution {
    let total_start = Instant::now();
    let mut points = BTreeMap::new();
    let mut complete = true;
    let mut diagnostics = Vec::new();

    for (node_index, node) in nodes.iter().enumerate() {
        let resolved: Option<Vec<(String, GeoPoint)>> = match node {
            AstNode::Point { name, x, y, .. } => {
                Some(vec![(name.clone(), GeoPoint { x: *x, y: *y })])
            }
            AstNode::IntersectionPoint {
                p1,
                p2,
                p3,
                p4,
                name,
            } => {
                let result = get(&points, p1)
                    .zip(get(&points, p2))
                    .zip(get(&points, p3).zip(get(&points, p4)))
                    .and_then(|((a1, a2), (b1, b2))| line_intersection(a1, a2, b1, b2));
                result.map(|point| vec![(name.clone(), point)])
            }
            AstNode::MidPoint { p1, p2, name } => get(&points, p1)
                .zip(get(&points, p2))
                .map(|(first, second)| vec![(name.clone(), midpoint(first, second))]),
            AstNode::GoldenRatioPoint { p1, p2, name } => get(&points, p1)
                .zip(get(&points, p2))
                .map(|(first, second)| {
                    let inverse_phi = 2.0 / (1.0 + 5.0_f64.sqrt());
                    vec![(
                        name.clone(),
                        add(first, scale(subtract(second, first), inverse_phi)),
                    )]
                }),
            AstNode::BarycentricPoint {
                points: names,
                weights,
                name,
            } => {
                let inputs: Option<Vec<_>> =
                    names.iter().map(|point| get(&points, point)).collect();
                inputs
                    .and_then(|inputs| barycentric(&inputs, weights))
                    .map(|point| vec![(name.clone(), point)])
            }
            AstNode::SimilitudeCenter {
                kind,
                center1,
                radius1,
                center2,
                radius2,
                name,
            } => get(&points, center1)
                .zip(get(&points, radius1))
                .zip(get(&points, center2).zip(get(&points, radius2)))
                .and_then(|((first, first_radius), (second, second_radius))| {
                    let r1 = length(subtract(first_radius, first));
                    let r2 = length(subtract(second_radius, second));
                    let weights = if kind == "int" { [r2, r1] } else { [-r2, r1] };
                    barycentric(&[first, second], &weights)
                })
                .map(|point| vec![(name.clone(), point)]),
            AstNode::HarmonicPoint {
                p1,
                p2,
                known,
                name,
                ..
            } => get(&points, p1)
                .zip(get(&points, p2))
                .zip(get(&points, known))
                .and_then(|((first, second), known)| {
                    let direction = subtract(second, first);
                    let denominator = direction.x * direction.x + direction.y * direction.y;
                    if denominator < EPSILON {
                        return None;
                    }
                    let relative = subtract(known, first);
                    let position =
                        (relative.x * direction.x + relative.y * direction.y) / denominator;
                    let harmonic_denominator = 2.0 * position - 1.0;
                    (harmonic_denominator.abs() >= EPSILON)
                        .then(|| add(first, scale(direction, position / harmonic_denominator)))
                })
                .map(|point| vec![(name.clone(), point)]),
            AstNode::HarmonicPair {
                p1,
                p2,
                ratio,
                name1,
                name2,
            } => get(&points, p1)
                .zip(get(&points, p2))
                .and_then(|(first, second)| {
                    barycentric(&[first, second], &[1.0, *ratio])
                        .zip(barycentric(&[first, second], &[1.0, -*ratio]))
                })
                .map(|(first, second)| vec![(name1.clone(), first), (name2.clone(), second)]),
            AstNode::EquiPoints {
                p1,
                p2,
                from,
                distance,
                name1,
                name2,
                ..
            } => get(&points, p1)
                .zip(get(&points, p2))
                .zip(get(&points, from))
                .and_then(|((first, second), from)| {
                    let foot = project_on_line(from, first, second)?;
                    let direction = normalize(subtract(first, foot))
                        .or_else(|| normalize(subtract(first, second)))?;
                    Some((
                        add(foot, scale(direction, *distance)),
                        add(foot, scale(direction, -*distance)),
                    ))
                })
                .map(|(first, second)| vec![(name1.clone(), first), (name2.clone(), second)]),
            AstNode::MidArcPoint {
                center,
                start,
                end,
                name,
            } => get(&points, center)
                .zip(get(&points, start))
                .zip(get(&points, end))
                .and_then(|((center, start), end)| {
                    let start_vector = subtract(start, center);
                    let end_vector = subtract(end, center);
                    let radius = length(start_vector);
                    if radius < EPSILON || length(end_vector) < EPSILON {
                        return None;
                    }
                    let start_angle = start_vector.y.atan2(start_vector.x);
                    let end_angle = end_vector.y.atan2(end_vector.x);
                    let delta = (end_angle - start_angle).rem_euclid(std::f64::consts::TAU);
                    let middle = start_angle + delta / 2.0;
                    Some(add(
                        center,
                        GeoPoint {
                            x: radius * middle.cos(),
                            y: radius * middle.sin(),
                        },
                    ))
                })
                .map(|point| vec![(name.clone(), point)]),
            AstNode::PointOnLine {
                p1,
                p2,
                position,
                name,
            } => get(&points, p1)
                .zip(get(&points, p2))
                .map(|(first, second)| {
                    vec![(name.clone(), point_on_line(first, second, *position))]
                }),
            AstNode::PointOnCircle {
                mode,
                center,
                angle,
                through,
                radius,
                name,
            } => get(&points, center).and_then(|center| {
                let radius = if mode == "through" {
                    through
                        .as_deref()
                        .and_then(|through| get(&points, through))
                        .map(|through| length(subtract(through, center)))
                } else {
                    *radius
                }?;
                Some(vec![(
                    name.clone(),
                    point_on_circle(center, radius, *angle),
                )])
            }),
            AstNode::RandomPoint {
                mode,
                references,
                radius,
                name,
            } => {
                let key = format!("{}:{}", name, references.join(":"));
                let inputs: Option<Vec<_>> = references
                    .iter()
                    .map(|reference| get(&points, reference))
                    .collect();
                inputs
                    .and_then(|inputs| random_point(mode, &inputs, *radius, &key))
                    .map(|point| vec![(name.clone(), point)])
            }
            AstNode::PointTransformation {
                mode,
                source,
                references,
                value,
                name,
            } => {
                let source = get(&points, source);
                let references: Option<Vec<_>> = references
                    .iter()
                    .map(|reference| get(&points, reference))
                    .collect();
                source
                    .zip(references)
                    .and_then(|(source, references)| {
                        transform_point(mode, source, &references, value.as_deref())
                    })
                    .map(|point| vec![(name.clone(), point)])
            }
            AstNode::PointsTransformation {
                mode,
                sources,
                references,
                value,
                names,
            } => {
                let references: Option<Vec<_>> = references
                    .iter()
                    .map(|reference| get(&points, reference))
                    .collect();
                references.and_then(|references| {
                    sources
                        .iter()
                        .zip(names)
                        .map(|(source, name)| {
                            let source = get(&points, source)?;
                            let point =
                                transform_point(mode, source, &references, value.as_deref())?;
                            Some((name.clone(), point))
                        })
                        .collect()
                })
            }
            AstNode::VectorPoint {
                mode,
                p1,
                p2,
                anchor,
                factor,
                name,
            } => get(&points, p1)
                .zip(get(&points, p2))
                .and_then(|(first, second)| {
                    vector_point(
                        mode,
                        first,
                        second,
                        *factor,
                        anchor.as_deref().and_then(|anchor| get(&points, anchor)),
                    )
                })
                .map(|point| vec![(name.clone(), point)]),
            AstNode::DuplicateSegment {
                ray_start,
                ray_through,
                segment_start,
                segment_end,
                name,
            } => get(&points, ray_start)
                .zip(get(&points, ray_through))
                .zip(get(&points, segment_start).zip(get(&points, segment_end)))
                .and_then(|((ray_start, ray_through), (segment_start, segment_end))| {
                    duplicate_segment_point(ray_start, ray_through, segment_start, segment_end)
                })
                .map(|point| vec![(name.clone(), point)]),
            AstNode::RadicalAxis {
                circle1,
                circle2,
                results,
            } => get(&points, &circle1[0])
                .zip(get(&points, &circle1[1]))
                .zip(get(&points, &circle2[0]).zip(get(&points, &circle2[1])))
                .and_then(|((center1, radius_point1), (center2, radius_point2))| {
                    radical_axis_points(center1, radius_point1, center2, radius_point2)
                })
                .map(|resolved| results.iter().cloned().zip(resolved).collect()),
            AstNode::SwapPoints { p1, p2 } => get(&points, p1)
                .zip(get(&points, p2))
                .map(|(first, second)| vec![(p1.clone(), second), (p2.clone(), first)]),
            AstNode::DefinedLine {
                mode,
                points: names,
                through,
                factor,
                normed,
                results,
            } => {
                let inputs: Option<Vec<_>> =
                    names.iter().map(|point| get(&points, point)).collect();
                inputs
                    .and_then(|inputs| {
                        defined_line_points(
                            mode,
                            &inputs,
                            through.as_deref().and_then(|point| get(&points, point)),
                            *factor,
                            *normed,
                        )
                    })
                    .map(|resolved| results.iter().cloned().zip(resolved).collect())
            }
            AstNode::DefinedTriangle {
                mode,
                p1,
                p2,
                angle1,
                angle2,
                swap,
                name,
            } => get(&points, p1)
                .zip(get(&points, p2))
                .and_then(|(first, second)| {
                    defined_triangle_point(mode, first, second, *angle1, *angle2, *swap)
                })
                .map(|point| vec![(name.clone(), point)]),
            AstNode::TriangleCenter {
                option,
                p1,
                p2,
                p3,
                name,
            } => get(&points, p1)
                .zip(get(&points, p2))
                .zip(get(&points, p3))
                .and_then(|((first, second), third)| triangle_center(option, first, second, third))
                .map(|point| vec![(name.clone(), point)]),
            AstNode::AssociatedTriangle {
                mode,
                p1,
                p2,
                p3,
                results,
                ..
            } => get(&points, p1)
                .zip(get(&points, p2))
                .zip(get(&points, p3))
                .and_then(|((first, second), third)| {
                    associated_triangle_points(mode, first, second, third)
                })
                .map(|resolved| results.iter().cloned().zip(resolved).collect()),
            AstNode::PolygonConstruction {
                mode,
                points: names,
                regular_mode,
                sides,
                results,
                ..
            } => {
                let inputs: Option<Vec<_>> =
                    names.iter().map(|point| get(&points, point)).collect();
                inputs
                    .and_then(|inputs| {
                        polygon_construction_points(mode, &inputs, regular_mode.as_deref(), *sides)
                    })
                    .map(|resolved| results.iter().cloned().zip(resolved).collect())
            }
            AstNode::DefinedCircle {
                mode,
                points: names,
                references,
                value,
                results,
                ..
            } => {
                let inputs: Option<Vec<_>> =
                    names.iter().map(|point| get(&points, point)).collect();
                let references: Option<Vec<_>> =
                    references.iter().map(|point| get(&points, point)).collect();
                inputs
                    .zip(references)
                    .and_then(|(inputs, references)| {
                        defined_circle_points(mode, &inputs, &references, *value)
                    })
                    .map(|resolved| results.iter().cloned().zip(resolved).collect())
            }
            AstNode::ProjectedExcenters {
                p1,
                p2,
                p3,
                results,
                ..
            } => get(&points, p1)
                .zip(get(&points, p2))
                .zip(get(&points, p3))
                .and_then(|((first, second), third)| {
                    projected_excenter_points(first, second, third)
                })
                .map(|resolved| results.iter().cloned().zip(resolved).collect()),
            AstNode::CircleTransformation {
                mode,
                center,
                radius_point,
                references,
                value,
                results,
            } => {
                let references: Option<Vec<_>> =
                    references.iter().map(|point| get(&points, point)).collect();
                get(&points, center)
                    .zip(get(&points, radius_point))
                    .zip(references)
                    .and_then(|((center, radius_point), references)| {
                        transformed_circle_points(
                            mode,
                            center,
                            radius_point,
                            &references,
                            value.as_deref(),
                        )
                    })
                    .map(|resolved| results.iter().cloned().zip(resolved).collect())
            }
            AstNode::LineCircleIntersection {
                mode,
                line,
                circle,
                radius,
                near,
                common,
                results,
            } => {
                let line: Option<Vec<_>> = line.iter().map(|point| get(&points, point)).collect();
                let circle: Option<Vec<_>> =
                    circle.iter().map(|point| get(&points, point)).collect();
                line.zip(circle)
                    .and_then(|(line, circle)| {
                        let radius = if mode == "R" {
                            *radius
                        } else if mode == "with_nodes" {
                            circle
                                .get(1)
                                .zip(circle.get(2))
                                .map(|(first, second)| length(subtract(*first, *second)))
                        } else {
                            circle
                                .first()
                                .zip(circle.get(1))
                                .map(|(center, point)| length(subtract(*point, *center)))
                        }?;
                        line.first().zip(line.get(1)).zip(circle.first()).and_then(
                            |((first, second), center)| {
                                line_circle_intersections(
                                    *first,
                                    *second,
                                    *center,
                                    radius,
                                    *near,
                                    common.as_deref().and_then(|point| get(&points, point)),
                                )
                            },
                        )
                    })
                    .map(|resolved| results.iter().cloned().zip(resolved).collect())
            }
            AstNode::CircleCircleIntersection {
                mode,
                circles,
                radii,
                common,
                results,
            } => {
                let circles: Option<Vec<Vec<GeoPoint>>> = circles
                    .iter()
                    .map(|circle| circle.iter().map(|point| get(&points, point)).collect())
                    .collect();
                circles
                    .and_then(|circles| {
                        let resolved_radii = if mode == "R" {
                            radii.clone()
                        } else {
                            circles
                                .iter()
                                .map(|circle| {
                                    if mode == "with_nodes" {
                                        circle.get(1).zip(circle.get(2)).map(|(first, second)| {
                                            length(subtract(*first, *second))
                                        })
                                    } else {
                                        circle.first().zip(circle.get(1)).map(|(center, point)| {
                                            length(subtract(*point, *center))
                                        })
                                    }
                                })
                                .collect()
                        }?;
                        circles
                            .first()
                            .and_then(|first| circles.get(1).map(|second| (first, second)))
                            .and_then(|(first, second)| {
                                first
                                    .first()
                                    .zip(second.first())
                                    .zip(resolved_radii.first().zip(resolved_radii.get(1)))
                                    .and_then(|((center1, center2), (radius1, radius2))| {
                                        circle_circle_intersections(
                                            *center1,
                                            *radius1,
                                            *center2,
                                            *radius2,
                                            common.as_deref().and_then(|point| get(&points, point)),
                                        )
                                    })
                            })
                    })
                    .map(|resolved| results.iter().cloned().zip(resolved).collect())
            }
            _ => continue,
        };

        if let Some(resolved) = resolved {
            points.extend(resolved);
        } else {
            complete = false;
            diagnostics.push(unresolved_geometry_diagnostic(node_index, node, &points));
        }
    }

    let resolve_ms = elapsed_ms(total_start);
    let viewport_start = Instant::now();
    let viewport = if complete {
        Some(calculate_viewport(nodes, &points))
    } else {
        None
    };
    let viewport_ms = if complete {
        elapsed_ms(viewport_start)
    } else {
        0.0
    };
    let total_ms = elapsed_ms(total_start);
    GeometryResolution {
        points,
        complete,
        viewport,
        diagnostics,
        timings: GeometryTimings {
            resolve_ms,
            viewport_ms,
            total_ms,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_point(point: Option<GeoPoint>, x: f64, y: f64) {
        let point = point.expect("expected a resolved point");
        assert!((point.x - x).abs() < 1e-10, "x: {} != {}", point.x, x);
        assert!((point.y - y).abs() < 1e-10, "y: {} != {}", point.y, y);
    }

    fn assert_point_approx(point: Option<GeoPoint>, x: f64, y: f64, tolerance: f64) {
        let point = point.expect("expected a resolved point");
        assert!((point.x - x).abs() < tolerance, "x: {} != {}", point.x, x);
        assert!((point.y - y).abs() < tolerance, "y: {} != {}", point.y, y);
    }

    #[test]
    fn resolves_a_chain_of_basic_constructions() {
        let nodes = vec![
            AstNode::Point {
                name: "A".into(),
                x: 0.0,
                y: 0.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::Point {
                name: "B".into(),
                x: 4.0,
                y: 0.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::MidPoint {
                p1: "A".into(),
                p2: "B".into(),
                name: "M".into(),
            },
            AstNode::PointOnCircle {
                mode: "R".into(),
                center: "M".into(),
                angle: 90.0,
                through: None,
                radius: Some(2.0),
                name: "C".into(),
            },
        ];
        let result = resolve_geometry(&nodes);
        assert!(result.complete);
        assert!((result.points["M"].x - 2.0).abs() < EPSILON);
        assert!((result.points["C"].y - 2.0).abs() < EPSILON);
    }

    #[test]
    fn keeps_partial_points_and_reports_unresolved_constructions() {
        let nodes = vec![
            AstNode::Point {
                name: "A".into(),
                x: 1.0,
                y: 2.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::MidPoint {
                p1: "A".into(),
                p2: "B".into(),
                name: "M".into(),
            },
        ];

        let result = resolve_geometry(&nodes);

        assert!(!result.complete);
        assert_point(result.points.get("A").copied(), 1.0, 2.0);
        assert!(!result.points.contains_key("M"));
        assert_eq!(result.diagnostics.len(), 1);
        assert_eq!(result.diagnostics[0].severity, "warning");
        assert_eq!(result.diagnostics[0].node_index, 1);
        assert_eq!(result.diagnostics[0].node_type, "MidPoint");
        assert_eq!(result.diagnostics[0].targets, vec!["M"]);
    }

    #[test]
    fn resolves_duplicate_segment_points() {
        let nodes = vec![
            AstNode::Point {
                name: "A".into(),
                x: 0.0,
                y: 0.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::Point {
                name: "B".into(),
                x: 3.0,
                y: 4.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::Point {
                name: "C".into(),
                x: 1.0,
                y: 1.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::Point {
                name: "D".into(),
                x: 4.0,
                y: 1.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::DuplicateSegment {
                ray_start: "A".into(),
                ray_through: "B".into(),
                segment_start: "C".into(),
                segment_end: "D".into(),
                name: "E".into(),
            },
        ];
        let result = resolve_geometry(&nodes);
        assert!(result.complete);
        assert!((result.points["E"].x - 1.8).abs() < EPSILON);
        assert!((result.points["E"].y - 2.4).abs() < EPSILON);
    }

    #[test]
    fn resolves_radical_axis_points() {
        let nodes = vec![
            AstNode::Point {
                name: "A".into(),
                x: 0.0,
                y: 0.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::Point {
                name: "B".into(),
                x: 2.0,
                y: 0.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::Point {
                name: "C".into(),
                x: 5.0,
                y: 0.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::Point {
                name: "D".into(),
                x: 6.0,
                y: 0.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::RadicalAxis {
                circle1: vec!["A".into(), "B".into()],
                circle2: vec!["C".into(), "D".into()],
                results: vec!["E".into(), "F".into()],
            },
        ];
        let result = resolve_geometry(&nodes);
        assert!(result.complete);
        assert!((result.points["E"].x - 2.8).abs() < EPSILON);
        assert!((result.points["F"].x - 2.8).abs() < EPSILON);
        assert!((result.points["E"].y + 2.0).abs() < EPSILON);
        assert!((result.points["F"].y - 2.0).abs() < EPSILON);
    }

    #[test]
    fn swaps_point_coordinates_in_resolution_order() {
        let nodes = vec![
            AstNode::Point {
                name: "A".into(),
                x: 0.0,
                y: 0.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::Point {
                name: "B".into(),
                x: 4.0,
                y: 2.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::SwapPoints {
                p1: "A".into(),
                p2: "B".into(),
            },
            AstNode::MidPoint {
                p1: "A".into(),
                p2: "B".into(),
                name: "M".into(),
            },
        ];
        let result = resolve_geometry(&nodes);
        assert!(result.complete);
        assert!((result.points["A"].x - 4.0).abs() < EPSILON);
        assert!((result.points["A"].y - 2.0).abs() < EPSILON);
        assert!((result.points["B"].x - 0.0).abs() < EPSILON);
        assert!((result.points["B"].y - 0.0).abs() < EPSILON);
        assert!((result.points["M"].x - 2.0).abs() < EPSILON);
        assert!((result.points["M"].y - 1.0).abs() < EPSILON);
    }

    #[test]
    fn computes_viewport_with_shape_extents_in_rust() {
        let nodes = vec![
            AstNode::Point {
                name: "O".into(),
                x: 0.0,
                y: 0.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::Point {
                name: "A".into(),
                x: 4.0,
                y: 0.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::Circle {
                center: "O".into(),
                radius_point: "A".into(),
                options: None,
            },
        ];
        let result = resolve_geometry(&nodes);
        assert!(result.complete);
        let viewport = result.viewport.expect("expected viewport");
        let values: Vec<f64> = viewport
            .view_box
            .split_whitespace()
            .map(|value| value.parse::<f64>().unwrap())
            .collect();
        assert!(values[0] < -4.0 * WORLD_SCALE);
        assert!(values[0] + values[2] > 4.0 * WORLD_SCALE);
    }

    #[test]
    fn marks_unresolved_constructions_incomplete() {
        let nodes = vec![AstNode::AssociatedTriangle {
            mode: "orthic".into(),
            p1: "A".into(),
            p2: "B".into(),
            p3: "C".into(),
            name_prefix: None,
            results: vec!["X".into(), "Y".into(), "Z".into()],
        }];
        let result = resolve_geometry(&nodes);
        assert!(!result.complete);
        assert!(result.viewport.is_none());
    }

    #[test]
    fn resolves_defined_lines_triangles_and_centers_end_to_end() {
        let nodes = vec![
            AstNode::Point {
                name: "A".into(),
                x: 0.0,
                y: 0.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::Point {
                name: "B".into(),
                x: 4.0,
                y: 0.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::Point {
                name: "C".into(),
                x: 0.0,
                y: 3.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::DefinedLine {
                mode: "mediator".into(),
                points: vec!["A".into(), "B".into()],
                through: None,
                factor: 1.0,
                normed: false,
                results: vec!["L1".into(), "L2".into()],
            },
            AstNode::DefinedTriangle {
                mode: "equilateral".into(),
                p1: "A".into(),
                p2: "B".into(),
                angle1: None,
                angle2: None,
                swap: false,
                name: "D".into(),
            },
            AstNode::TriangleCenter {
                option: "centroid".into(),
                p1: "A".into(),
                p2: "B".into(),
                p3: "C".into(),
                name: "G".into(),
            },
        ];
        let result = resolve_geometry(&nodes);
        assert!(result.complete);
        assert_point(result.points.get("G").copied(), 4.0 / 3.0, 1.0);
        assert!(result.points.contains_key("L1"));
        assert!(result.points.contains_key("D"));
    }

    #[test]
    fn resolves_transformations_and_vector_points() {
        let nodes = vec![
            AstNode::Point {
                name: "O".into(),
                x: 0.0,
                y: 0.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::Point {
                name: "A".into(),
                x: 2.0,
                y: 0.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::Point {
                name: "B".into(),
                x: 0.0,
                y: 2.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::PointTransformation {
                mode: "rotation_in_rad".into(),
                source: "A".into(),
                references: vec!["O".into()],
                value: Some("pi/2".into()),
                name: "R".into(),
            },
            AstNode::PointsTransformation {
                mode: "translation".into(),
                sources: vec!["A".into(), "B".into()],
                references: vec!["O".into(), "A".into()],
                value: None,
                names: vec!["AT".into(), "BT".into()],
            },
            AstNode::VectorPoint {
                mode: "orthogonal_normed".into(),
                p1: "O".into(),
                p2: "A".into(),
                anchor: None,
                factor: 3.0,
                name: "V".into(),
            },
        ];

        let result = resolve_geometry(&nodes);
        assert!(result.complete);
        assert!(result.points["R"].x.abs() < 1e-10);
        assert!((result.points["R"].y - 2.0).abs() < 1e-10);
        assert!((result.points["BT"].x - 2.0).abs() < EPSILON);
        assert!((result.points["V"].y - 3.0).abs() < EPSILON);
    }

    #[test]
    fn matches_all_typescript_transformation_modes() {
        let source = GeoPoint { x: 2.0, y: 1.0 };
        let origin = GeoPoint { x: 0.0, y: 0.0 };
        assert_point(
            transform_point(
                "translation",
                source,
                &[origin, GeoPoint { x: 3.0, y: 2.0 }],
                None,
            ),
            5.0,
            3.0,
        );
        assert_point(
            transform_point("homothety", source, &[origin], Some("2")),
            4.0,
            2.0,
        );
        assert_point(
            transform_point(
                "reflection",
                source,
                &[origin, GeoPoint { x: 4.0, y: 0.0 }],
                None,
            ),
            2.0,
            -1.0,
        );
        assert_point(
            transform_point(
                "projection",
                source,
                &[origin, GeoPoint { x: 4.0, y: 0.0 }],
                None,
            ),
            2.0,
            0.0,
        );
        assert_point(
            transform_point("symmetry", source, &[GeoPoint { x: 1.0, y: 1.0 }], None),
            0.0,
            1.0,
        );
        assert_point(
            transform_point(
                "rotation",
                GeoPoint { x: 1.0, y: 0.0 },
                &[origin],
                Some("90"),
            ),
            0.0,
            1.0,
        );
        assert_point(
            transform_point(
                "rotation_in_rad",
                GeoPoint { x: 1.0, y: 0.0 },
                &[origin],
                Some("\\pi / 2"),
            ),
            0.0,
            1.0,
        );
        assert_point(
            transform_point(
                "rotation_with_nodes",
                GeoPoint { x: 2.0, y: 0.0 },
                &[
                    origin,
                    GeoPoint { x: 1.0, y: 0.0 },
                    GeoPoint { x: 0.0, y: 1.0 },
                ],
                None,
            ),
            0.0,
            2.0,
        );
        assert_point(
            transform_point(
                "inversion",
                GeoPoint { x: 4.0, y: 0.0 },
                &[origin, GeoPoint { x: 2.0, y: 0.0 }],
                None,
            ),
            1.0,
            0.0,
        );
        assert_point(
            transform_point(
                "inversion_negative",
                GeoPoint { x: 4.0, y: 0.0 },
                &[origin, GeoPoint { x: 2.0, y: 0.0 }],
                None,
            ),
            -1.0,
            0.0,
        );

        let a = GeoPoint { x: 0.0, y: 0.0 };
        let b = GeoPoint { x: 3.0, y: 4.0 };
        assert_point(vector_point("orthogonal", a, b, 1.0, None), -4.0, 3.0);
        assert_point(
            vector_point("orthogonal_normed", a, b, 2.0, None),
            -1.6,
            1.2,
        );
        assert_point(vector_point("linear", a, b, 0.5, None), 1.5, 2.0);
        assert_point(vector_point("linear_normed", a, b, 5.0, None), 3.0, 4.0);
        assert_point(
            vector_point("colinear", a, b, 1.0, Some(GeoPoint { x: 10.0, y: 1.0 })),
            13.0,
            5.0,
        );
    }

    #[test]
    fn matches_all_defined_line_modes() {
        let a = GeoPoint { x: 0.0, y: 0.0 };
        let b = GeoPoint { x: 2.0, y: 0.0 };
        let mediator = defined_line_points("mediator", &[a, b], None, 1.0, false).unwrap();
        assert_point(mediator.first().copied(), 1.0, -2.0);
        assert_point(mediator.get(1).copied(), 1.0, 2.0);
        assert_point(
            defined_line_points(
                "perpendicular",
                &[a, b],
                Some(GeoPoint { x: 0.0, y: 1.0 }),
                1.0,
                false,
            )
            .unwrap()
            .first()
            .copied(),
            0.0,
            3.0,
        );
        assert_point(
            defined_line_points(
                "parallel",
                &[a, b],
                Some(GeoPoint { x: 0.0, y: 1.0 }),
                1.0,
                false,
            )
            .unwrap()
            .first()
            .copied(),
            2.0,
            1.0,
        );

        let angle = [GeoPoint { x: 1.0, y: 0.0 }, a, GeoPoint { x: 0.0, y: 1.0 }];
        assert_point(
            defined_line_points("bisector", &angle, None, 1.0, false)
                .unwrap()
                .first()
                .copied(),
            std::f64::consts::FRAC_1_SQRT_2,
            std::f64::consts::FRAC_1_SQRT_2,
        );
        assert_point(
            defined_line_points("bisector_out", &angle, None, 1.0, false)
                .unwrap()
                .first()
                .copied(),
            std::f64::consts::FRAC_1_SQRT_2,
            -std::f64::consts::FRAC_1_SQRT_2,
        );
        assert_point(
            defined_line_points(
                "altitude",
                &[a, GeoPoint { x: 1.0, y: 2.0 }, b],
                None,
                1.0,
                false,
            )
            .unwrap()
            .first()
            .copied(),
            1.0,
            0.0,
        );
        assert_eq!(
            defined_line_points(
                "euler",
                &[a, b, GeoPoint { x: 0.0, y: 2.0 }],
                None,
                1.0,
                false
            )
            .unwrap()
            .len(),
            2
        );
        assert_point(
            defined_line_points("tangent_at", &[a], Some(b), 1.0, false)
                .unwrap()
                .first()
                .copied(),
            2.0,
            2.0,
        );
        let tangencies = defined_line_points(
            "tangent_from",
            &[a, GeoPoint { x: 1.0, y: 0.0 }],
            Some(b),
            1.0,
            false,
        )
        .unwrap();
        assert_point(tangencies.first().copied(), 0.5, 3.0_f64.sqrt() / 2.0);
        assert_point(tangencies.get(1).copied(), 0.5, -3.0_f64.sqrt() / 2.0);
    }

    #[test]
    fn matches_all_defined_triangle_modes() {
        let a = GeoPoint { x: 0.0, y: 0.0 };
        let b = GeoPoint { x: 2.0, y: 0.0 };
        assert_point(
            defined_triangle_point("equilateral", a, b, None, None, false),
            1.0,
            3.0_f64.sqrt(),
        );
        assert_point(
            defined_triangle_point("equilateral", a, b, None, None, true),
            1.0,
            -3.0_f64.sqrt(),
        );
        assert_point(
            defined_triangle_point("two_angles", a, b, Some(45.0), Some(45.0), false),
            1.0,
            1.0,
        );
        assert_point(
            defined_triangle_point("half", a, b, None, None, false),
            2.0,
            -1.0,
        );
        assert_point(
            defined_triangle_point("isosceles_right", a, b, None, None, false),
            1.0,
            1.0,
        );
        for mode in ["pythagore", "pythagoras", "egyptian"] {
            assert_point(
                defined_triangle_point(mode, a, b, None, None, false),
                2.0,
                -1.5,
            );
        }
        assert_point(
            defined_triangle_point("school", a, b, None, None, false),
            2.0,
            2.0 / 3.0_f64.sqrt(),
        );
        assert!(
            (defined_triangle_point("gold", a, b, None, None, false)
                .unwrap()
                .y
                + 2.0 / ((1.0 + 5.0_f64.sqrt()) / 2.0))
                .abs()
                < 1e-10
        );
        assert!(
            defined_triangle_point("euclid", a, b, None, None, false)
                .unwrap()
                .y
                < 0.0
        );
        assert_point(
            defined_triangle_point("golden", a, b, None, None, false),
            defined_triangle_point("sublime", a, b, None, None, false)
                .unwrap()
                .x,
            defined_triangle_point("sublime", a, b, None, None, false)
                .unwrap()
                .y,
        );
        assert!(
            (defined_triangle_point("cheops", a, b, None, None, false)
                .unwrap()
                .x
                - 1.0)
                .abs()
                < EPSILON
        );
    }

    #[test]
    fn matches_triangle_center_families_and_aliases() {
        let a = GeoPoint { x: 0.0, y: 0.0 };
        let b = GeoPoint { x: 4.0, y: 0.0 };
        let c = GeoPoint { x: 0.0, y: 3.0 };
        assert_point(triangle_center("ortho", a, b, c), 0.0, 0.0);
        assert_point(triangle_center("orthic", a, b, c), 0.0, 0.0);
        assert_point(triangle_center("centroid", a, b, c), 4.0 / 3.0, 1.0);
        assert_point(triangle_center("median", a, b, c), 4.0 / 3.0, 1.0);
        assert_point(triangle_center("circum", a, b, c), 2.0, 1.5);
        assert_point(triangle_center("in", a, b, c), 1.0, 1.0);
        assert_point(triangle_center("ex", a, b, c), -2.0, 2.0);
        assert_point(triangle_center("euler", a, b, c), 1.0, 0.75);
        assert_point(triangle_center("symmedian", a, b, c), 0.72, 0.96);
        assert_point(triangle_center("lemoine", a, b, c), 0.72, 0.96);
        assert_point(triangle_center("spieker", a, b, c), 1.5, 1.0);
        for mode in ["gergonne", "nagel", "mittenpunkt", "feuerbach"] {
            assert!(triangle_center(mode, a, b, c).is_some(), "missing {mode}");
        }
    }

    #[test]
    fn matches_associated_triangle_families_and_aliases() {
        let a = GeoPoint { x: 0.0, y: 0.0 };
        let b = GeoPoint { x: 4.0, y: 0.0 };
        let c = GeoPoint { x: 1.0, y: 3.0 };
        let expected = [
            ("orthic", [(2.0, 2.0), (0.4, 1.2), (1.0, 0.0)]),
            ("centroid", [(2.5, 1.5), (0.5, 1.5), (2.0, 0.0)]),
            (
                "in",
                [(2.32456, 1.67544), (0.48528, 1.45585), (1.70820, 0.0)],
            ),
            (
                "ex",
                [(5.70246, 4.11010), (-1.70246, 2.36204), (2.54018, -3.52431)],
            ),
            (
                "extouch",
                [(2.79618, 1.20382), (0.53838, 1.61514), (2.54018, 0.0)],
            ),
            (
                "intouch",
                [(2.20382, 1.79618), (0.46162, 1.38486), (1.45982, 0.0)],
            ),
            ("euler", [(0.5, 0.5), (2.5, 0.5), (1.0, 2.0)]),
            (
                "symmedial",
                [(2.15385, 1.84615), (0.47059, 1.41176), (1.42857, 0.0)],
            ),
            ("tangential", [(7.0, 6.0), (-1.0, 2.0), (2.0, -4.0)]),
            (
                "feuerbach",
                [(2.36817, 1.70688), (0.47978, 1.45812), (1.73046, -0.09428)],
            ),
        ];

        for (mode, points) in expected {
            let actual = associated_triangle_points(mode, a, b, c).unwrap();
            assert_eq!(actual.len(), 3, "{mode}");
            for (index, (x, y)) in points.into_iter().enumerate() {
                assert_point_approx(actual.get(index).copied(), x, y, 1e-4);
            }
        }

        for (alias, canonical) in [
            ("ortho", "orthic"),
            ("medial", "centroid"),
            ("incentral", "in"),
            ("excentral", "ex"),
            ("contact", "intouch"),
        ] {
            let alias_points = associated_triangle_points(alias, a, b, c).unwrap();
            let canonical_points = associated_triangle_points(canonical, a, b, c).unwrap();
            for (alias_point, canonical_point) in alias_points.iter().zip(canonical_points) {
                assert_point(Some(*alias_point), canonical_point.x, canonical_point.y);
            }
        }

        assert!(associated_triangle_points("orthic", a, b, GeoPoint { x: 8.0, y: 0.0 }).is_none());
    }

    #[test]
    fn matches_polygon_construction_families() {
        let square = polygon_construction_points(
            "square",
            &[GeoPoint { x: 0.0, y: 0.0 }, GeoPoint { x: 4.0, y: 0.0 }],
            None,
            None,
        )
        .unwrap();
        assert_point(square.first().copied(), 4.0, 4.0);
        assert_point(square.get(1).copied(), 0.0, 4.0);

        let rectangle = polygon_construction_points(
            "rectangle",
            &[GeoPoint { x: 0.0, y: 0.0 }, GeoPoint { x: 5.0, y: 2.0 }],
            None,
            None,
        )
        .unwrap();
        assert_point(rectangle.first().copied(), 5.0, 0.0);
        assert_point(rectangle.get(1).copied(), 0.0, 2.0);

        let parallelogram = polygon_construction_points(
            "parallelogram",
            &[
                GeoPoint { x: 0.0, y: 0.0 },
                GeoPoint { x: 3.0, y: 0.0 },
                GeoPoint { x: 4.0, y: 2.0 },
            ],
            None,
            None,
        )
        .unwrap();
        assert_point(parallelogram.first().copied(), 1.0, 2.0);

        let permuted = polygon_construction_points(
            "permute",
            &[
                GeoPoint { x: 0.0, y: 0.0 },
                GeoPoint { x: 4.0, y: 0.0 },
                GeoPoint { x: 1.0, y: 3.0 },
            ],
            None,
            None,
        )
        .unwrap();
        assert_point(
            permuted.first().copied(),
            4.0 / 10.0_f64.sqrt(),
            12.0 / 10.0_f64.sqrt(),
        );
        assert_point(permuted.get(1).copied(), 10.0_f64.sqrt(), 0.0);

        let golden = polygon_construction_points(
            "golden_rectangle",
            &[GeoPoint { x: 0.0, y: 0.0 }, GeoPoint { x: 4.0, y: 0.0 }],
            None,
            None,
        )
        .unwrap();
        assert_point(golden.first().copied(), 4.0, 8.0 / (1.0 + 5.0_f64.sqrt()));

        let centered = polygon_construction_points(
            "regular_polygon",
            &[GeoPoint { x: 0.0, y: 0.0 }, GeoPoint { x: 2.0, y: 0.0 }],
            Some("center"),
            Some(4),
        )
        .unwrap();
        assert_eq!(centered.len(), 4);
        assert_point_approx(centered.get(1).copied(), 0.0, 2.0, 1e-10);
        assert_point_approx(centered.get(2).copied(), -2.0, 0.0, 1e-10);
        assert_eq!(
            polygon_construction_points(
                "regular_polygon",
                &[GeoPoint { x: 0.0, y: 0.0 }, GeoPoint { x: 2.0, y: 0.0 }],
                None,
                None
            )
            .unwrap()
            .len(),
            5
        );

        let from_side = polygon_construction_points(
            "regular_polygon",
            &[GeoPoint { x: 0.0, y: 0.0 }, GeoPoint { x: 2.0, y: 0.0 }],
            Some("side"),
            Some(4),
        )
        .unwrap();
        assert_eq!(from_side.len(), 4);
        assert_point(from_side.first().copied(), 0.0, 0.0);
        assert_point_approx(from_side.get(1).copied(), 2.0, 0.0, 1e-10);
        assert_point_approx(from_side.get(2).copied(), 2.0, 2.0, 1e-10);

        assert!(polygon_construction_points(
            "rectangle",
            &[GeoPoint { x: 0.0, y: 0.0 }, GeoPoint { x: 5.0, y: 0.0 }],
            None,
            None
        )
        .is_none());
    }

    #[test]
    fn matches_all_defined_circle_families() {
        let a = GeoPoint { x: 0.0, y: 0.0 };
        let b = GeoPoint { x: 4.0, y: 0.0 };
        let c = GeoPoint { x: 0.0, y: 3.0 };
        assert_point(
            defined_circle_points("R", &[a], &[], Some(2.0))
                .unwrap()
                .first()
                .copied(),
            2.0,
            0.0,
        );
        let diameter = defined_circle_points("diameter", &[a, b], &[], None).unwrap();
        assert_point(diameter.first().copied(), 2.0, 0.0);
        let circum = defined_circle_points("circum", &[a, b, c], &[], None).unwrap();
        assert_point(circum.first().copied(), 2.0, 1.5);
        let incircle = defined_circle_points("in", &[a, b, c], &[], None).unwrap();
        assert_point(incircle.first().copied(), 1.0, 1.0);
        let excircle = defined_circle_points("ex", &[a, b, c], &[], None).unwrap();
        assert_point(excircle.first().copied(), -2.0, 2.0);
        for mode in ["euler", "nine"] {
            assert_point(
                defined_circle_points(mode, &[a, b, c], &[], None)
                    .unwrap()
                    .first()
                    .copied(),
                1.0,
                0.75,
            );
        }
        assert_point(
            defined_circle_points("spieker", &[a, b, c], &[], None)
                .unwrap()
                .first()
                .copied(),
            1.5,
            1.0,
        );
        let apollonius = defined_circle_points("apollonius", &[a, b], &[], Some(2.0)).unwrap();
        assert!((apollonius[0].x - 16.0 / 3.0).abs() < 1e-10);
        let tangencies = defined_circle_points(
            "orthogonal_from",
            &[a, GeoPoint { x: 1.0, y: 0.0 }],
            &[GeoPoint { x: 3.0, y: 0.0 }],
            None,
        )
        .unwrap();
        assert_eq!(tangencies.len(), 2);
        let through = defined_circle_points(
            "orthogonal_through",
            &[a, GeoPoint { x: 1.0, y: 0.0 }],
            &[GeoPoint { x: -1.5, y: -1.5 }, GeoPoint { x: 1.5, y: -1.25 }],
            None,
        )
        .unwrap();
        assert_eq!(through.len(), 2);
    }

    #[test]
    fn matches_projected_excenters_circle_transformations_and_random_points() {
        let a = GeoPoint { x: 0.0, y: 0.0 };
        let b = GeoPoint { x: 4.0, y: 0.0 };
        let c = GeoPoint { x: 0.0, y: 3.0 };

        let projections = projected_excenter_points(a, b, c).unwrap();
        assert_eq!(projections.len(), 9);
        for point in projections.iter().take(3) {
            assert!((3.0 * point.x + 4.0 * point.y - 12.0).abs() < 1e-10);
        }
        for point in projections.iter().skip(3).take(3) {
            assert!(point.x.abs() < 1e-10);
        }
        for point in projections.iter().skip(6).take(3) {
            assert!(point.y.abs() < 1e-10);
        }

        let translated = transformed_circle_points(
            "translation",
            GeoPoint { x: 1.0, y: 1.0 },
            GeoPoint { x: 2.0, y: 1.0 },
            &[GeoPoint { x: 0.0, y: 0.0 }, GeoPoint { x: 3.0, y: 2.0 }],
            None,
        )
        .unwrap();
        assert_point(translated.first().copied(), 4.0, 3.0);
        assert_point(translated.get(1).copied(), 5.0, 3.0);

        let inverted = transformed_circle_points(
            "inversion",
            GeoPoint { x: 5.0, y: 0.0 },
            GeoPoint { x: 6.0, y: 0.0 },
            &[GeoPoint { x: 0.0, y: 0.0 }, GeoPoint { x: 2.0, y: 0.0 }],
            None,
        )
        .unwrap();
        assert_point_approx(inverted.first().copied(), 5.0 / 6.0, 0.0, 1e-10);
        assert!((length(subtract(inverted[1], inverted[0])) - 1.0 / 6.0).abs() < 1e-10);

        let rectangle =
            random_point("rectangle", &[a, GeoPoint { x: 4.0, y: 3.0 }], None, "R").unwrap();
        assert!((0.0..=4.0).contains(&rectangle.x));
        assert!((0.0..=3.0).contains(&rectangle.y));
        let segment =
            random_point("segment", &[a, GeoPoint { x: 4.0, y: 3.0 }], None, "S").unwrap();
        assert!((segment.y - segment.x * 0.75).abs() < 1e-10);
        let repeated =
            random_point("segment", &[a, GeoPoint { x: 4.0, y: 3.0 }], None, "S").unwrap();
        assert_point(Some(repeated), segment.x, segment.y);
        let circle = random_point("circle", &[a], Some(2.0), "C").unwrap();
        assert!((length(circle) - 2.0).abs() < 1e-10);
        let through = random_point(
            "circle_through",
            &[a, GeoPoint { x: 4.0, y: 3.0 }],
            None,
            "T",
        )
        .unwrap();
        assert!((length(through) - 5.0).abs() < 1e-10);
        let disk =
            random_point("disk_through", &[a, GeoPoint { x: 4.0, y: 3.0 }], None, "D").unwrap();
        assert!(length(disk) <= 5.0);
    }

    #[test]
    fn matches_line_circle_intersections_and_ordering() {
        let line_a = GeoPoint { x: -3.0, y: 0.0 };
        let line_b = GeoPoint { x: 3.0, y: 0.0 };
        let center = GeoPoint { x: 0.0, y: 0.0 };
        let default = line_circle_intersections(line_a, line_b, center, 2.0, false, None).unwrap();
        assert_point(default.first().copied(), 2.0, 0.0);
        assert_point(default.get(1).copied(), -2.0, 0.0);
        let near = line_circle_intersections(line_a, line_b, center, 2.0, true, None).unwrap();
        assert_point(near.first().copied(), -2.0, 0.0);
        let common = line_circle_intersections(
            line_a,
            line_b,
            center,
            2.0,
            false,
            Some(GeoPoint { x: 2.0, y: 0.0 }),
        )
        .unwrap();
        assert_point(common.first().copied(), -2.0, 0.0);
        assert_point(
            line_circle_intersections(
                GeoPoint { x: -3.0, y: 2.0 },
                GeoPoint { x: 3.0, y: 2.0 },
                center,
                2.0,
                false,
                None,
            )
            .unwrap()
            .first()
            .copied(),
            0.0,
            2.0,
        );
        assert!(line_circle_intersections(
            GeoPoint { x: -3.0, y: 3.0 },
            GeoPoint { x: 3.0, y: 3.0 },
            center,
            2.0,
            false,
            None
        )
        .is_none());
    }

    #[test]
    fn matches_circle_circle_intersections_tangency_and_ordering() {
        let first = GeoPoint { x: 0.0, y: 0.0 };
        let second = GeoPoint { x: 3.0, y: 0.0 };
        let intersections = circle_circle_intersections(first, 2.0, second, 2.0, None).unwrap();
        assert!((intersections[0].x - 1.5).abs() < 1e-10 && intersections[0].y < 0.0);
        assert!(intersections[1].y > 0.0);
        let reordered =
            circle_circle_intersections(first, 2.0, second, 2.0, Some(intersections[0])).unwrap();
        assert_point(
            reordered.first().copied(),
            intersections[1].x,
            intersections[1].y,
        );
        let tangent =
            circle_circle_intersections(first, 1.0, GeoPoint { x: 2.0, y: 0.0 }, 1.0, None)
                .unwrap();
        assert_point(tangent.first().copied(), 1.0, 0.0);
        assert_point(tangent.get(1).copied(), 1.0, 0.0);
        assert!(circle_circle_intersections(first, 1.0, second, 1.0, None).is_none());
    }

    #[test]
    fn resolves_circles_and_intersections_end_to_end() {
        let nodes = vec![
            AstNode::Point {
                name: "A".into(),
                x: 0.0,
                y: 0.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::Point {
                name: "B".into(),
                x: 4.0,
                y: 0.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::Point {
                name: "C".into(),
                x: 0.0,
                y: 3.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::DefinedCircle {
                mode: "circum".into(),
                points: vec!["A".into(), "B".into(), "C".into()],
                references: vec![],
                value: None,
                results: vec!["O".into(), "R".into()],
                center: "O".into(),
                radius_point: "R".into(),
            },
            AstNode::LineCircleIntersection {
                mode: "N".into(),
                line: vec!["A".into(), "B".into()],
                circle: vec!["O".into(), "R".into()],
                radius: None,
                near: false,
                common: None,
                results: vec!["L1".into(), "L2".into()],
            },
            AstNode::CircleCircleIntersection {
                mode: "N".into(),
                circles: vec![vec!["O".into(), "R".into()], vec!["A".into(), "C".into()]],
                radii: None,
                common: None,
                results: vec!["X".into(), "Y".into()],
            },
        ];
        let result = resolve_geometry(&nodes);
        assert!(result.complete);
        for name in ["O", "R", "L1", "L2", "X", "Y"] {
            assert!(result.points.contains_key(name), "missing {name}");
        }
    }

    #[test]
    fn resolves_stage_four_constructions_end_to_end() {
        let nodes = vec![
            AstNode::Point {
                name: "A".into(),
                x: 0.0,
                y: 0.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::Point {
                name: "B".into(),
                x: 4.0,
                y: 0.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::Point {
                name: "C".into(),
                x: 1.0,
                y: 3.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::Point {
                name: "D".into(),
                x: 3.0,
                y: 2.0,
                coordinate_mode: "cartesian".into(),
                angle: None,
                distance: None,
            },
            AstNode::AssociatedTriangle {
                mode: "orthic".into(),
                p1: "A".into(),
                p2: "B".into(),
                p3: "C".into(),
                name_prefix: None,
                results: vec!["Ha".into(), "Hb".into(), "Hc".into()],
            },
            AstNode::PolygonConstruction {
                mode: "square".into(),
                points: vec!["A".into(), "B".into()],
                results: vec!["Sq1".into(), "Sq2".into()],
                regular_mode: None,
                sides: None,
                name_prefix: None,
            },
            AstNode::ProjectedExcenters {
                p1: "A".into(),
                p2: "B".into(),
                p3: "C".into(),
                name_prefix: "J".into(),
                excenter_suffixes: vec!["a".into(), "b".into(), "c".into()],
                projection_prefixes: vec!["X".into(), "Y".into(), "Z".into()],
                results: vec![
                    "Xa".into(),
                    "Xb".into(),
                    "Xc".into(),
                    "Ya".into(),
                    "Yb".into(),
                    "Yc".into(),
                    "Za".into(),
                    "Zb".into(),
                    "Zc".into(),
                ],
            },
            AstNode::CircleTransformation {
                mode: "translation".into(),
                center: "A".into(),
                radius_point: "B".into(),
                references: vec!["A".into(), "D".into()],
                value: None,
                results: vec!["CO".into(), "CR".into()],
            },
            AstNode::RandomPoint {
                mode: "segment".into(),
                references: vec!["A".into(), "B".into()],
                radius: None,
                name: "R".into(),
            },
        ];
        let result = resolve_geometry(&nodes);
        assert!(result.complete);
        for name in [
            "Ha", "Hb", "Hc", "Sq1", "Sq2", "Xa", "Xb", "Xc", "Ya", "Yb", "Yc", "Za", "Zb", "Zc",
            "CO", "CR", "R",
        ] {
            assert!(result.points.contains_key(name), "missing {name}");
        }
    }
}
