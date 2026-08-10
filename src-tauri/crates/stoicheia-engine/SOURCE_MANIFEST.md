# Stoicheia Engine Source Manifest

This crate is the copy-first Rust baseline for integrating the locally owned
Stoicheia project into DataTeX.

Migration baseline:

- DataTeX source commit: `f6849bd04dff2920900265a1eb4cba7c4f2ca255`.
- Stoicheia version: `1.2.2`.
- Imported on: `2026-07-28`.
- Reuse authorization: the project owner approved incorporating the Stoicheia
  source under the existing DataTeX license.

## Parser and geometry provenance

The immutable original hashes remain recorded below. DataTeX's workspace-wide
Rust formatter normalized line wrapping after import. Running Rust 2021
`rustfmt` on temporary copies of the standalone files produces byte-identical
DataTeX files, confirming that the parser/geometry diffs are canonical
formatting only. The current hashes make this narrow adaptation auditable
without rewriting the original provenance.

| Destination | Original path | Original SHA-256 | Current SHA-256 | Adaptation |
|---|---|---|---|---|
| `src/parser.rs` | `Stoicheia project/src-tauri/src/parser.rs` | `707b0d70c95cbd334b94cb1a142c03d52ead1aba64573032ea24ed8dce72a0b7` | `baa08fde7c850b9335c0218920529d7daf7f0f935629f4ebfdefb59d37b7187a` | Workspace `rustfmt` line wrapping only; parser behavior remains covered by the copied parity suite. |
| `src/geometry.rs` | `Stoicheia project/src-tauri/src/geometry.rs` | `80a808cac88cc05cf56f8dcd5e64cf1c1d29f3cf6ad90989973d22d5f65d06b6` | `11e40603cc6940cd924fb9e2d379ea4c8c2df1fe229a7825f6ec1e67eda01cb3` | Workspace `rustfmt` line wrapping only; geometry behavior remains covered by the copied parity suite. |

## Post-parity compiler adaptation

Phase 6 adapts the compiler only at the external-process seam after the
original parity suite passed. The original source hash remains immutable
provenance; it is not replaced by the adapted hash.

| Destination | Original path | Original SHA-256 | Current SHA-256 | Adaptation |
|---|---|---|---|---|
| `src/compiler.rs` | `Stoicheia project/src-tauri/src/compiler.rs` | `db266700bb9cd8797ff04c1cd0817e7519e0c9f3b48a3d41ee3b296ee96ff3d9` | `e01598030a8ec9e3679342b39da347e51b1c4b59261be32d8877a6235aa6650c` | Inject the narrow `ExternalProcessRunner`; check cancellation at cache/stage/result boundaries; resolve compiler and `dvisvgm` executables once; key exact-preview cache entries by canonical path, file metadata, and reported version; preserve the direct standalone runner; and Unix-gate the shell-only timeout test. |

## Golden fixture

`tests/fixtures/tkz-triangle.tex` is copied from
`Stoicheia project/src-tauri/source.tex`.

SHA-256:

```text
e677be396d21e45b6cba4541656493064493de612322ab1bbac0cc7b3101c91a
```

The original `source.tex` and `source (1).tex` have the same hash, so only one
copy is retained.

## Integration-owned files

These files are new DataTeX integration files and are not expected to match a
Stoicheia source hash:

- `Cargo.toml`
- `.gitignore`
- `INTEGRATION_CONTRACT.md`
- `src/lib.rs`
- `src/process_runner.rs`
- `src/bin/stoicheia-tool-smoke.rs`
- `examples/performance_report.rs`
- `tests/native_exact_preview.rs`
- `tests/parser_render_parity.rs`
- `tests/fixtures/parser-render.v1.json`
- `SOURCE_MANIFEST.md`

The DataTeX job registry, process-group lifecycle, timeout escalation,
settings conversion, and diagnostics remain host-owned. The engine adaptation
is only the dependency-inversion seam needed to inject that host runner; it
does not add another compilation manager.

The integration-owned native smoke helper also supports a test-only delayed
compiler mode. It verifies that instant Rust parsing remains available while
an exact external process is pending; no delay path is part of production
runtime code.

## Parity gate

Run:

```bash
cargo test --manifest-path src-tauri/crates/stoicheia-engine/Cargo.toml --lib
```

Expected baseline:

```text
86 passed
0 failed
1 ignored benchmark
```

Verified on 2026-07-28:

```text
running 87 tests
test result: ok. 86 passed; 0 failed; 1 ignored
```

The standalone Stoicheia frontend baseline was also re-run:

```text
Test Files  29 passed (29)
Tests       358 passed | 1 skipped (359)
```

The frontend run retains pre-existing React test warnings about a few updates
not wrapped in `act(...)` and missing list keys. They are not test failures but
should be tracked when the frontend is copied.

## Shared parser/render parity gate

`tests/fixtures/parser-render.v1.json` is the versioned cross-language contract
for four representative scenes: a basic triangle, a chained construction,
styles/labels/clipping, and incomplete geometry with diagnostics. The Rust
integration test executes the real parser and geometry resolver and compares
the complete serialized `ParseResult` after removing only nondeterministic
top-level `timings`.

The same JSON payload is consumed by the frontend integration test through the
real `useDocumentPipeline` store path and production fast viewport, scene, and
SVG renderer. The fixture freezes a complete semantic tree for each scene;
element/child order, text, geometry, presentation, `data-*`, and `aria-*`
attributes remain exact, while CSS classes and computed styles stay excluded.
Generated SVG IDs and references are canonicalized by retained definition
order, and each semantic tree carries a canonical-JSON SHA-256. Targeted
assertions additionally identify failures in points, paths, styles, labels,
clipping, diagnostics, and fallback behavior.

The suite also includes deterministic 1,000-node and policy-driven 5,000-node
DOM-shape cases. The large case requires one segment batch and a bounded SVG
descendant count without a timing threshold.

Run the native half directly with:

```bash
cargo test --manifest-path src-tauri/crates/stoicheia-engine/Cargo.toml \
  --test parser_render_parity
```

## Native performance report

`examples/performance_report.rs` is integration-owned and reads the same shared
fixture without changing copied parser or geometry sources. It validates fixed
result counts and emits raw samples plus median, nearest-rank p95, mean,
variance, serialization, source-size, and observed payload-size summaries for
canonical and 50/250/1,000/5,000-node synthetic workloads.

Run:

```bash
pnpm run perf:stoicheia:native
```

Use `STOICHEIA_PERF_WARMUPS` and `STOICHEIA_PERF_SAMPLES` to override the
default 5/15 release measurements. Timing is advisory; result-contract drift is
the only hard failure in this native example.

## Native exact-preview smoke gate

Run on each release OS:

```bash
cargo test --manifest-path src-tauri/crates/stoicheia-engine/Cargo.toml \
  --test native_exact_preview -- --nocapture
```

The integration test copies a small Rust helper under native compiler and
`dvisvgm` executable names. It verifies explicit compiler resolution,
PATH/PATHEXT `dvisvgm` discovery, version probes, DVI-to-SVG execution, cache
reuse, and temporary-directory cleanup without requiring TeX on the CI image.
