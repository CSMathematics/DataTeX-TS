use serde_json::Value;
use stoicheia_engine::parser::parse_tikz_code;

const PARSER_RENDER_FIXTURE: &str = include_str!("fixtures/parser-render.v1.json");
const BASIC_TRIANGLE_SOURCE: &str = include_str!("fixtures/tkz-triangle.tex");

fn canonical_parse_result(source: &str) -> Value {
    let mut value = serde_json::to_value(parse_tikz_code(source)).expect("serialize parse result");
    value
        .as_object_mut()
        .expect("parse result must serialize as an object")
        .remove("timings")
        .expect("timings must be present before canonicalization");
    value
}

#[test]
fn real_parser_and_geometry_match_the_versioned_render_fixtures() {
    let fixture: Value =
        serde_json::from_str(PARSER_RENDER_FIXTURE).expect("parse parser-render fixture");
    assert_eq!(fixture["schemaVersion"], 1);
    assert_eq!(fixture["suite"], "stoicheia-parser-geometry-semantic-svg");
    let scenarios = fixture["scenarios"]
        .as_array()
        .expect("fixture scenarios must be an array");
    assert_eq!(scenarios.len(), 4);
    assert_eq!(
        scenarios
            .iter()
            .map(|scenario| scenario["id"].as_str().expect("scenario id"))
            .collect::<Vec<_>>(),
        [
            "basic-triangle",
            "chained-construction",
            "styles-labels-clipping",
            "incomplete-geometry-diagnostics",
        ]
    );
    assert_eq!(
        scenarios[0]["source"].as_str().expect("triangle source"),
        BASIC_TRIANGLE_SOURCE,
        "the shared basic scenario must reuse the existing Stoicheia source fixture"
    );

    for scenario in scenarios {
        let id = scenario["id"].as_str().expect("scenario id");
        let source = scenario["source"].as_str().expect("scenario source");
        let expected = &scenario["expectedParseResult"];
        assert!(
            expected.get("timings").is_none(),
            "{id}: canonical fixtures must not contain timings"
        );
        assert_eq!(
            canonical_parse_result(source),
            *expected,
            "{id}: parser/geometry payload drifted"
        );
    }
}
