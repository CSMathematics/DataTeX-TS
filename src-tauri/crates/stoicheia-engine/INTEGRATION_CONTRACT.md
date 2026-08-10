# Stoicheia Engine Integration Contract

This contract records the verified parser-to-renderer path that the DataTeX
adapter must preserve.

## Runtime path

```text
Stoicheia App
  -> useDocumentPipeline()
  -> invoke("parse_tikz", { source })
  -> parser::parse_tikz()
  -> parser::parse_tikz_code()
  -> geometry::resolve_geometry()
  -> serialized ParseResult.renderScene
  -> useEditorStore.setParsedDocument()
  -> Preview.buildFastViewport()/buildFastRenderScene()
  -> FastSvgRenderer
```

`parse_tikz_code()` calls `resolve_geometry(&nodes)` directly. There is no
direct Rust-to-React renderer call; the normalized serialized scene is the
boundary.

## Tauri command

```text
name: parse_tikz
arguments: { source: string }
```

The parity adapter initially keeps this command name so the copied
`useDocumentPipeline.ts` can remain unchanged.

## Exact preview process contract

The post-parity embedded exact-preview path is:

```text
useDocumentPipeline()
  -> invoke("compile_latex", { source, compiler, enginePaths, compilationId })
  -> DataTeX CompilationManager::begin(compilationId)
  -> stoicheia_engine::compiler::compile_latex_with_runner()
  -> resolve configured compiler and dvisvgm identities
  -> tracked LaTeX process group
  -> tracked dvisvgm process group
  -> CompileResult
```

Runtime requirements:

- Every actual exact render uses a never-reused `compilationId`.
- `stop_compile` is the one cancellation command for normal document and
  Stoicheia exact compilation; there is no second process manager.
- The host runner checks cancellation before cache access and between stages,
  registers each PID with a generation token, and does not return until the
  direct child is reaped and inherited output pipes are closed.
- Supersede, exact-to-instant mode changes, and embedded workspace unmount stop
  the active job. A debounce that never spawned has no job to stop.
- Cancellation and timeout do not produce an SVG/cache result, and temporary
  files are dropped only after the external process tree has terminated.
- DataTeX supplies the optional `dvisvgm` override from its central TeX Engine
  settings. An empty/default value discovers it through the runtime PATH plus
  standard TeX locations. The exact resolved path is the path that executes.
- The exact-preview cache identity includes the selected compiler and
  `dvisvgm` canonical paths, file lengths, modification timestamps, first
  `--version` lines, and a schema version. Replacing either executable therefore
  cannot reuse an SVG produced by the old toolchain.
- Version probes use the injected tracked runner, are bounded to five seconds,
  and remain cancelable. Results are memoized by executable file identity so
  normal preview updates do not launch an extra probe per frame or render.
- The original `compile_latex()` and direct runner remain available for the
  standalone engine contract; DataTeX always injects its tracked runner.
- `pnpm run test:stoicheia:native` is the release-OS smoke contract. Its first
  test uses native copied Rust executables to exercise exact-preview discovery,
  rendering, cache reuse, and cleanup. The helper can deliberately hold the
  external compiler open; the regression proves the instant Rust parser still
  completes within its 250 ms budget while that exact process is pending. Its
  second test self-spawns a parent and descendant to exercise the host OS
  process-tree timeout and manual-stop path.

## Serialized result

```text
{
  nodes,
  geometry_complete,
  viewport: { viewBox } | null,
  renderScene: {
    points: { [name]: { x, y } },
    viewBox?: string,
    geometryComplete: boolean,
    diagnostics?: [{
      severity,
      message,
      nodeIndex,
      nodeType,
      targets?
    }]
  },
  timings: {
    parseMs,
    geometryMs,
    viewportMs,
    totalMs,
    nodeCount,
    resolvedPointCount
  }
}
```

Compatibility requirements:

- Top-level `geometry_complete` remains snake_case.
- `renderScene`, its fields, diagnostics, and timings remain camelCase.
- Internal Rust `resolved_points` intentionally uses `skip_serializing`; the
  TypeScript field is only a legacy fallback.
- `renderScene` is the canonical geometry payload.
- Incomplete geometry returns partial points and diagnostics without a Rust
  viewport. The frontend then calculates its fallback viewport.
- AST nodes retain `#[serde(tag = "type")]` and their existing variant names,
  including names such as `Point` and `MidPoint`.
- Resolved points remain a `BTreeMap` so serialized key ordering is
  deterministic.
- Parser and geometry remain sibling modules named `parser` and `geometry`.

## Shared parser-to-SVG parity contract

The versioned fixture at `tests/fixtures/parser-render.v1.json` freezes four
canonical Rust results: a basic triangle, a chained construction,
styles/labels/clipping, and incomplete geometry with diagnostics. Rust compares
the complete serialized `ParseResult` after removing only top-level `timings`;
all nodes, completeness flags, viewports, points, and diagnostics remain exact.

The frontend test imports that same Rust-owned fixture, delivers each result
through the actual `useDocumentPipeline`/store boundary, and then uses
`buildFastViewport`, `buildFastRenderScene`, and `FastSvgRenderer`. It verifies
the complete versioned semantic SVG tree rather than fragile serialized React
markup. The projector preserves element/child order, non-empty text, and all
explicit SVG, `data-*`, and `aria-*` attributes except CSS classes. IDs and
their references are canonicalized by retained definition order, so generated
clip/marker names cannot cause platform or render-run drift. Each committed
semantic snapshot has a canonical-JSON SHA-256 checked by the Node gate.
The original `source` remains in every scenario because the production scene
builder still uses source text for render options and labels.

The permanent cross-language gate is:

```bash
pnpm run test:stoicheia:parser-render
```

## Performance report contract

`examples/performance_report.rs` is a DataTeX-owned measurement adapter around
the unchanged parser/geometry API. It emits schema-v1 JSON and never introduces
a wall-clock pass/fail limit. The report covers the four shared canonical
scenes, flat 50/250/1,000/5,000-node scenes, and a dependency-heavy 5,000-node
scene. Every measured sample must retain its explicit expected node, resolved
point, diagnostic, and completeness counts.

The native-call interval includes parsing, geometry, viewport calculation, and
result construction. Serialization is measured separately; inbound Tauri
deserialization, IPC, WebView work, and exact LaTeX are outside this boundary.
Payload bytes are observed serialized wire sizes and can vary slightly because
the payload includes timing values.

Run the native report alone with:

```bash
pnpm run perf:stoicheia:native
```

The repository-level `pnpm run perf:stoicheia` command additionally executes
the policy-driven 5,000-node DOM gate, mixed-style jsdom samples, lazy/bundle
gates, and manifest-closure accounting. Its runtime numbers are advisory and
comparable only when the recorded machine, toolchain, input hashes, and build
profile match.

## Graph audit correction

The graph audit correctly identified the parser/geometry relationship but
misclassified it as inferred. Source inspection confirmed a direct call.

Connections based on common names such as `Vec::new()`, `BTreeMap::new()`,
`Iterator::collect()`, or frontend `replace()` are not runtime dependencies and
must not drive the adapter design.
