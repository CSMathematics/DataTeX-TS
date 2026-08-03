# Stoicheia Engine Source Manifest

This crate is the copy-first Rust baseline for integrating the locally owned
Stoicheia project into DataTeX.

Migration baseline:

- DataTeX source commit: `f6849bd04dff2920900265a1eb4cba7c4f2ca255`.
- Stoicheia version: `1.2.2`.
- Imported on: `2026-07-28`.
- Reuse authorization: the project owner approved incorporating the Stoicheia
  source under the existing DataTeX license.

## Verbatim files

The parser and geometry sources remain byte-for-byte identical to the imported
baseline:

| Destination | Original path | SHA-256 |
|---|---|---|
| `src/parser.rs` | `Stoicheia project/src-tauri/src/parser.rs` | `707b0d70c95cbd334b94cb1a142c03d52ead1aba64573032ea24ed8dce72a0b7` |
| `src/geometry.rs` | `Stoicheia project/src-tauri/src/geometry.rs` | `80a808cac88cc05cf56f8dcd5e64cf1c1d29f3cf6ad90989973d22d5f65d06b6` |

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
- `tests/native_exact_preview.rs`
- `SOURCE_MANIFEST.md`

The DataTeX job registry, process-group lifecycle, timeout escalation,
settings conversion, and diagnostics remain host-owned. The engine adaptation
is only the dependency-inversion seam needed to inject that host runner; it
does not add another compilation manager.

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
