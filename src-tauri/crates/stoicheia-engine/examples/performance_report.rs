use serde::Serialize;
use serde_json::Value;
use std::{env, time::Instant};
use stoicheia_engine::parser::parse_tikz_code;

const SHARED_FIXTURE: &str = include_str!("../tests/fixtures/parser-render.v1.json");

#[derive(Debug)]
struct Workload {
    id: String,
    category: String,
    source: String,
    expected_nodes: usize,
    expected_resolved_points: usize,
    expected_diagnostics: usize,
    expected_geometry_complete: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MetricSummary {
    samples_ms: Vec<f64>,
    min_ms: f64,
    median_ms: f64,
    p95_ms: f64,
    max_ms: f64,
    mean_ms: f64,
    coefficient_of_variation_percent: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SizeSummary {
    samples_bytes: Vec<usize>,
    min_bytes: usize,
    median_bytes: usize,
    max_bytes: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkloadMetrics {
    parse: MetricSummary,
    geometry: MetricSummary,
    viewport: MetricSummary,
    rust_total: MetricSummary,
    outer_call: MetricSummary,
    serialization: MetricSummary,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkloadReport {
    id: String,
    category: String,
    source_bytes: usize,
    payload_bytes: SizeSummary,
    node_count: usize,
    resolved_point_count: usize,
    diagnostic_count: usize,
    geometry_complete: bool,
    metrics: WorkloadMetrics,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReportConfiguration {
    warmups: usize,
    samples: usize,
    percentile_method: &'static str,
    timing_policy: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReportEnvironment {
    package_version: &'static str,
    build_profile: &'static str,
    target_os: &'static str,
    target_arch: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PerformanceReport {
    schema_version: u32,
    suite: &'static str,
    configuration: ReportConfiguration,
    environment: ReportEnvironment,
    workloads: Vec<WorkloadReport>,
}

#[derive(Default)]
struct RawSamples {
    parse: Vec<f64>,
    geometry: Vec<f64>,
    viewport: Vec<f64>,
    rust_total: Vec<f64>,
    outer_call: Vec<f64>,
    serialization: Vec<f64>,
    payload_bytes: Vec<usize>,
}

fn positive_env_usize(name: &str, fallback: usize) -> usize {
    env::var(name)
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(fallback)
}

fn flat_document(target_nodes: usize) -> String {
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

fn chained_document(target_nodes: usize) -> String {
    assert!(target_nodes >= 4 && target_nodes % 2 == 0);
    let point_count = target_nodes / 2;
    let segment_count = target_nodes - point_count;
    let mut source =
        String::from("\\begin{tikzpicture}\n\\tkzDefPoint(0,0){P0}\n\\tkzDefPoint(2,0){P1}\n");

    for index in 2..point_count {
        source.push_str(&format!(
            "\\tkzDefMidPoint(P{},P{})\n\\tkzGetPoint{{P{index}}}\n",
            index - 2,
            index - 1
        ));
    }
    for index in 0..segment_count {
        source.push_str(&format!(
            "\\tkzDrawSegment(P{},P{})\n",
            index % point_count,
            (index + 1) % point_count
        ));
    }
    source.push_str("\\end{tikzpicture}\n");
    source
}

fn shared_fixture_workloads() -> Vec<Workload> {
    let fixture: Value = serde_json::from_str(SHARED_FIXTURE).expect("parse shared parity fixture");
    fixture["scenarios"]
        .as_array()
        .expect("shared parity scenarios")
        .iter()
        .map(|scenario| {
            let expected = &scenario["expectedParseResult"];
            Workload {
                id: format!(
                    "canonical-{}",
                    scenario["id"].as_str().expect("shared scenario id")
                ),
                category: "canonical".to_string(),
                source: scenario["source"]
                    .as_str()
                    .expect("shared scenario source")
                    .to_string(),
                expected_nodes: expected["nodes"]
                    .as_array()
                    .expect("shared expected nodes")
                    .len(),
                expected_resolved_points: expected["renderScene"]["points"]
                    .as_object()
                    .expect("shared expected points")
                    .len(),
                expected_diagnostics: expected["renderScene"]["diagnostics"]
                    .as_array()
                    .map_or(0, Vec::len),
                expected_geometry_complete: expected["geometry_complete"]
                    .as_bool()
                    .expect("shared completeness"),
            }
        })
        .collect()
}

fn workloads() -> Vec<Workload> {
    let mut workloads = shared_fixture_workloads();
    workloads.extend([50usize, 250, 1_000, 5_000].map(|target_nodes| Workload {
        id: format!("flat-{target_nodes}"),
        category: "flat-throughput".to_string(),
        source: flat_document(target_nodes),
        expected_nodes: target_nodes,
        expected_resolved_points: target_nodes / 2,
        expected_diagnostics: 0,
        expected_geometry_complete: true,
    }));
    workloads.push(Workload {
        id: "chained-5000".to_string(),
        category: "dependency-chain".to_string(),
        source: chained_document(5_000),
        expected_nodes: 5_000,
        expected_resolved_points: 2_500,
        expected_diagnostics: 0,
        expected_geometry_complete: true,
    });
    workloads
}

fn rounded(value: f64) -> f64 {
    (value * 1_000_000.0).round() / 1_000_000.0
}

fn summarize(values: Vec<f64>) -> MetricSummary {
    assert!(!values.is_empty());
    let samples_ms: Vec<f64> = values.into_iter().map(rounded).collect();
    let mut sorted = samples_ms.clone();
    sorted.sort_by(f64::total_cmp);
    let length = sorted.len();
    let median = if length % 2 == 0 {
        (sorted[length / 2 - 1] + sorted[length / 2]) / 2.0
    } else {
        sorted[length / 2]
    };
    let p95_index = ((length as f64 * 0.95).ceil() as usize)
        .saturating_sub(1)
        .min(length - 1);
    let mean = sorted.iter().sum::<f64>() / length as f64;
    let variance = sorted
        .iter()
        .map(|value| {
            let delta = value - mean;
            delta * delta
        })
        .sum::<f64>()
        / length as f64;
    let coefficient_of_variation = if mean > 0.0 {
        variance.sqrt() / mean * 100.0
    } else {
        0.0
    };

    MetricSummary {
        samples_ms,
        min_ms: rounded(sorted[0]),
        median_ms: rounded(median),
        p95_ms: rounded(sorted[p95_index]),
        max_ms: rounded(sorted[length - 1]),
        mean_ms: rounded(mean),
        coefficient_of_variation_percent: rounded(coefficient_of_variation),
    }
}

fn summarize_sizes(values: Vec<usize>) -> SizeSummary {
    assert!(!values.is_empty());
    let mut sorted = values.clone();
    sorted.sort_unstable();
    SizeSummary {
        samples_bytes: values,
        min_bytes: sorted[0],
        median_bytes: sorted[sorted.len() / 2],
        max_bytes: sorted[sorted.len() - 1],
    }
}

fn measure_workload(workload: Workload, warmups: usize, sample_count: usize) -> WorkloadReport {
    for _ in 0..warmups {
        let result = parse_tikz_code(&workload.source);
        let _ = serde_json::to_vec(&result).expect("serialize warmup result");
    }

    let mut samples = RawSamples::default();
    for _ in 0..sample_count {
        let call_started = Instant::now();
        let result = parse_tikz_code(&workload.source);
        let outer_call_ms = call_started.elapsed().as_secs_f64() * 1_000.0;

        assert_eq!(
            result.nodes.len(),
            workload.expected_nodes,
            "{}",
            workload.id
        );
        assert_eq!(
            result.geometry_complete, workload.expected_geometry_complete,
            "{}",
            workload.id
        );
        assert_eq!(
            result.timings.resolved_point_count, workload.expected_resolved_points,
            "{} resolved-point count",
            workload.id
        );
        assert_eq!(
            result.render_scene.diagnostics.len(),
            workload.expected_diagnostics,
            "{} diagnostic count",
            workload.id
        );

        let serialization_started = Instant::now();
        let payload = serde_json::to_vec(&result).expect("serialize measured result");
        let serialization_ms = serialization_started.elapsed().as_secs_f64() * 1_000.0;

        samples.parse.push(result.timings.parse_ms);
        samples.geometry.push(result.timings.geometry_ms);
        samples.viewport.push(result.timings.viewport_ms);
        samples.rust_total.push(result.timings.total_ms);
        samples.outer_call.push(outer_call_ms);
        samples.serialization.push(serialization_ms);
        samples.payload_bytes.push(payload.len());
    }

    WorkloadReport {
        id: workload.id,
        category: workload.category,
        source_bytes: workload.source.len(),
        payload_bytes: summarize_sizes(samples.payload_bytes),
        node_count: workload.expected_nodes,
        resolved_point_count: workload.expected_resolved_points,
        diagnostic_count: workload.expected_diagnostics,
        geometry_complete: workload.expected_geometry_complete,
        metrics: WorkloadMetrics {
            parse: summarize(samples.parse),
            geometry: summarize(samples.geometry),
            viewport: summarize(samples.viewport),
            rust_total: summarize(samples.rust_total),
            outer_call: summarize(samples.outer_call),
            serialization: summarize(samples.serialization),
        },
    }
}

fn main() {
    let warmups = positive_env_usize("STOICHEIA_PERF_WARMUPS", 5);
    let samples = positive_env_usize("STOICHEIA_PERF_SAMPLES", 15);
    let report = PerformanceReport {
        schema_version: 1,
        suite: "stoicheia-native-performance",
        configuration: ReportConfiguration {
            warmups,
            samples,
            percentile_method: "nearest-rank",
            timing_policy: "advisory; compare only matched machine and toolchain profiles",
        },
        environment: ReportEnvironment {
            package_version: env!("CARGO_PKG_VERSION"),
            build_profile: if cfg!(debug_assertions) {
                "debug"
            } else {
                "release"
            },
            target_os: env::consts::OS,
            target_arch: env::consts::ARCH,
        },
        workloads: workloads()
            .into_iter()
            .map(|workload| measure_workload(workload, warmups, samples))
            .collect(),
    };

    println!(
        "{}",
        serde_json::to_string_pretty(&report).expect("serialize performance report")
    );
}
