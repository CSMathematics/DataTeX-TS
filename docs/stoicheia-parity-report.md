# Stoicheia Parity Report

Status: Phase 7 source/UI, generated-LaTeX, shared
parser/geometry/semantic-SVG parity, deterministic local performance, and the
Linux production Tauri/WebView capture complete on 2026-08-10.

This report compares the imported Stoicheia 1.2.2 baseline with the embedded
DataTeX Graphics Studio. The permanent gate uses the immutable source manifest,
so it does not depend on the ignored helper directory being present in builds.

Run:

```bash
pnpm run test:stoicheia:parity
```

The gate is also part of `prebuild` and therefore runs before production Vite
and Tauri frontend builds.

## Verified inventory

| Surface | Standalone baseline | Embedded result | Enforcement |
|---|---:|---:|---|
| Toolbar groups | 14 | 14 | Immutable `Toolbar.tsx` hash and structural extraction |
| Toolbar sections | 19 | 19 | Structural extraction |
| Toolbar tools | 100 unique | 100 unique | Exact ordered ID set |
| `ToolType` values | 102 | 102 | 100 tools plus `cursor` and `pan` |
| Geometry icons | 100 | 100 | Exact tool/icon ID set |
| Command Palette actions | 112 | 112 | 100 generated tool actions plus 12 static actions |
| Lazy dialogs | 24 | 24 | Exact import and render-registration set |
| Generated-LaTeX goldens | 10 | 10 | Exact UTF-8 string comparison; no normalization |
| Shared parser/render scenes | 4 | 4 | One canonical Rust result consumed by the production frontend pipeline |

No missing, extra, or duplicate tool, icon, command, or dialog registration was
found. The 24 dialog adaptations normalize exactly back to their immutable
source hashes after removing the scoped-portal import and restoring
`document.body`. Their fields, validation, callbacks, and command-generation
code are unchanged.

## Generated LaTeX output parity

The embedded generator/store, its 63 regression tests, TikZ option helpers, and
their tests remain byte-identical to the standalone baseline. A separate
versioned fixture now freezes 10 complete generated sources and compares them
with `toBe`, without trimming, EOL conversion, or Unicode normalization. It
covers:

1. first-picture insertion in a document with multiple pictures;
2. CRLF/Unicode insertion before `end{document}`;
3. insertion without a document shell;
4. composite constructions and generated-name reservation;
5. transformations and intersections;
6. nested style options and Unicode labels;
7. cartesian and polar coordinate edits;
8. inspector option edits and reference swapping;
9. construction deletion with unrelated-byte preservation;
10. the previously uncovered direct polygon action.

The CRLF case intentionally records the inherited mixed-EOL result. This is a
parity baseline, not an implicit behavior fix; any future EOL correction must
be an explicit migration with an approved golden update.

The fixture records Stoicheia 1.2.2 provenance for the immutable source
manifest and all five exercised generator/helper files. The Node gate verifies
those hashes, the scenario inventory, unique IDs, and every expected UTF-8
SHA-256. Its companion Vitest suite executes the typed actions and performs the
actual byte-exact behavioral comparison. `pnpm run test:stoicheia:parity` runs
both and remains part of `prebuild`.

DataTeX's host planner additionally has exact whole-output assertions for a
focused second-picture edit, the deterministic scratch template, and a CRLF
insertion containing package options, TikZ libraries, a figure wrapper, and
Unicode. These protect the integration layer outside the copied generator.

The Toolbar test suite also normalizes exactly to its baseline after reversing
its single container-relative height assertion.

Deletion/cleanup helpers and their LaTeX expectations remain byte-identical as
part of the wider 71-verbatim/39-adapter copy gate.

## Parser, geometry, and renderer provenance

- `FastSvgRenderer`, its tests, and the fast-viewport implementation/tests are
  byte-identical frontend copies.
- Rust parser and geometry retain their immutable original hashes. DataTeX's
  Rust 2021 formatter changed line wrapping only; formatting standalone copies
  with the same formatter produces the current files byte-for-byte. Original
  and canonical/current hashes are both recorded in the engine manifest.
- The engine parity suite currently provides 59 parser and 21 geometry tests.

## Shared parser-to-SVG behavioral parity

The versioned `parser-render.v1.json` fixture closes the gap between isolated
Rust and frontend tests. It covers:

1. a basic triangle;
2. a chained geometric construction;
3. styles, labels, and clipping;
4. incomplete geometry and diagnostics.

The Rust integration test runs the real parser and geometry resolver and
compares the complete serialized `ParseResult` after removing only top-level
timings. The frontend imports the same results, passes them through the actual
`useDocumentPipeline` store boundary, and uses the production viewport, scene,
and SVG renderer. Each scenario is compared with a committed canonical semantic
SVG tree and SHA-256. The deterministic projector preserves child order, text,
geometry, presentation, `data-*`, and `aria-*` attributes, removes CSS classes
and computed-style concerns, and canonicalizes generated IDs together with
their references by retained definition order. Targeted assertions additionally
pin coordinates, construction nodes, styles, Unicode labels, clipping,
diagnostics, and incomplete-scene fallback.

A deterministic 1,000-node correctness/DOM-count smoke test and a 5,000-node
stress case protect batching without adding a flaky wall-clock threshold to
normal builds. The 5,000-node case retains one segment batch and no more than
5,200 SVG descendants. The permanent
Node gate verifies fixture provenance, raw UTF-8 source hashes, canonical parse
hashes, semantic-tree schema/reference integrity, and semantic hashes, while
`.gitattributes` fixes the contract files to LF on every release OS.

## Deterministic local performance gate

`pnpm run perf:stoicheia` now produces one machine-readable JSON report for:

- release Rust canonical, flat 50/250/1,000/5,000-node, and dependency-heavy
  5,000-node workloads;
- parse, geometry, viewport, native-call, serialization, and payload-size
  measurements with warmups, samples, median, p95, and variability;
- jsdom renderer samples for 50/250/1,000/5,000-node mixed-style scenes;
- production-manifest closures for initial application, Package Studio,
  Graphics Studio first open, and the separately lazy code editor;
- operating-system, CPU, memory, Node, Rust, and Git identity.

The 2026-08-10 Linux reference run recorded a 0.809 ms median native call for
the flat 5,000-node scene and 1.093 ms for the chained 5,000-node scene. Zero
Stoicheia assets occur in the initial application closure; Graphics Studio's
increment after the Package Studio shell is 927,657 raw / 214,943 gzip bytes.
Its code-editor entry is a later 23,279-byte raw increment with Monaco warm;
the report separately accounts for the 4,313,494-byte cold Monaco path.

Point dragging is now animation-frame coalesced. Raw pointer bursts trigger at
most one geometry/snapping/optimistic-state update per frame, while mouse-up
flushes the latest pointer and commits exactly one source/history edit.

Runtime timings remain advisory and profile-matched. Hard gates are limited to
correctness, workload inventory, lazy boundaries, DOM shape/batching, and
versioned bundle limits. Full methodology and values are recorded in the
[performance baseline](stoicheia-performance-baseline.md).

The accepted real Linux WebView capture measured 155 ms cold startup, 48 ms
Graphics module load, 313 ms to the first usable canvas, 1 ms median parser
round trip including IPC, 1.5 ms median renderer work, and 793/2 ms cold/warm
exact compile. The collector accepted every required interaction metric, all
hardware-independent gates passed, and no warning or WebKit long task was
reported. The raw and merged reports are versioned under
`benchmarks/stoicheia/`.

## Remaining release work

The deterministic local bridge and Linux production capture are complete. The
native Windows x64, Linux x64, Intel Mac, and Apple Silicon matrix remains the
final cross-platform gate. The exact matrix/config/target contract is now
executed within every build and draft-release job, current GitHub macOS runner
labels have been reverified, and the Linux native command is green. The
remaining evidence requires the committed branch to execute on the hosted
Windows and two macOS architectures. Cross-machine runtime timing comparison
is not a release gate unless the machine and toolchain profile match.
