# Stoicheia Performance Baseline

Status: deterministic local baseline and the corrected Linux production
Tauri/WebView capture completed on 2026-08-10. The remaining release work is
the native correctness/build matrix on the other supported operating systems;
runtime timing comparisons remain profile-matched and advisory.

This baseline protects the embedded Graphics Studio without turning
machine-dependent timings into flaky correctness gates. Structural, lazy-load,
DOM-shape, and bundle limits are hard gates. Runtime timings are advisory and
may only be compared when the machine and toolchain profile match.

## Commands

Run the complete suite and write a machine-readable report to the operating
system temporary directory:

```bash
pnpm run perf:stoicheia
```

The default report is
`$TMPDIR/datatex-stoicheia-performance-report.json`. Override it with
`STOICHEIA_PERF_OUTPUT`; set `STOICHEIA_PERF_REUSE_BUILD=1` only when the
current `dist/.vite/manifest.json` was produced from the same source tree.

Focused cross-platform commands are also available:

```bash
pnpm run perf:stoicheia:native
pnpm run perf:stoicheia:render
pnpm run test:stoicheia:lazy
```

### Production Tauri/WebView capture

Build the Linux production binary with the diagnostics-only recorder enabled:

```bash
VITE_STOICHEIA_PERF_CAPTURE=1 pnpm run tauri:build:linux
```

During one cold application session, leave Graphics Studio closed until the
first DataTeX paint, then open a representative LaTeX drawing, drag a point,
pan with the Pan tool, Space-drag, or the middle mouse button, zoom, and compile
the unchanged source twice successfully in exact-preview mode. Press
the stopwatch control that appears only in the instrumented DataTeX status bar
to finish the capture and copy its JSON. The recorder performs no work unless
the build flag is enabled. It stores the latest partial report under
`datatex-stoicheia-runtime-performance-v1` and exposes a temporary diagnostics
API as a fallback:

```js
await window.__DATATEX_STOICHEIA_PERF__.copy()
```

Save the copied JSON, then validate and merge it into the complete benchmark
report:

```bash
STOICHEIA_TAURI_PERF_INPUT=/path/to/runtime-capture.json pnpm run perf:stoicheia
```

Development captures are deliberately stamped as development and cannot close
the production gate.

The stopwatch now refuses to finish an incomplete capture and its tooltip
lists the missing metrics. The first-canvas milestone is the first committed,
usable canvas surface; it no longer waits for a non-empty drawing and therefore
cannot include user think time.

The versioned policy is
[`benchmarks/stoicheia/performance-policy.v1.json`](../benchmarks/stoicheia/performance-policy.v1.json).
It records sample counts, hardware-independent limits, comparison rules, and
the metrics required from the later production Tauri capture.

## Reference profile

| Item | Value |
|---|---|
| OS | Manjaro Linux x64, kernel 7.1.4-1-MANJARO |
| CPU | AMD Ryzen 9 7845HX, 24 logical CPUs |
| Memory | 15.92 GB |
| Node | 26.4.0 |
| Rust | 1.91.1 |
| Package tools | pnpm 11.3.0, Vite 7.3.0, Vitest 4.1.10, jsdom 29.1.1 |
| Native samples | 5 warmups, 15 measured, release build |
| Renderer samples | 1 process warmup, 5 measured Vitest/jsdom processes |

The worktree was intentionally dirty while the integration slice was being
implemented. These values establish a development baseline, not a release
claim for other machines.

## Native parser and geometry baseline

All workloads validate the expected node count, resolved-point count,
diagnostics, and geometry-completeness contract before their timings are
accepted. Payload size is the observed median serialized `ParseResult` wire
size; its small range comes from timing values inside the payload. With 15
samples, nearest-rank p95 equals the observed maximum, so the median is the
primary comparison value.

| Workload | Source | Payload median | Parse median | Geometry median | Native call median / observed max | Serialization median |
|---|---:|---:|---:|---:|---:|---:|
| Flat 50 nodes | 1,223 B | 4,304 B | 0.0052 ms | 0.0015 ms | 0.0079 / 0.0085 ms | 0.0059 ms |
| Flat 250 nodes | 6,188 B | 20,195 B | 0.0238 ms | 0.0086 ms | 0.0356 / 0.0390 ms | 0.0273 ms |
| Flat 1,000 nodes | 25,658 B | 80,877 B | 0.1209 ms | 0.0583 ms | 0.1923 / 0.3455 ms | 0.1445 ms |
| Flat 5,000 nodes | 135,458 B | 413,485 B | 0.4770 ms | 0.2654 ms | 0.8090 / 0.9533 ms | 0.5922 ms |
| Chained 5,000 nodes | 189,443 B | 398,574 B | 0.4575 ms | 0.5883 ms | 1.0926 / 1.1282 ms | 0.3890 ms |

The flat case measures throughput for 2,500 points plus 2,500 segments. The
chained case resolves 2,498 dependent midpoints before rendering 2,500
segments, so it exercises a substantially heavier geometry path.

## Frontend renderer baseline

This benchmark measures React reconciliation and SVG DOM creation in jsdom. It
does **not** measure browser layout, paint, GPU work, Tauri IPC, or FPS.

| AST nodes | SVG elements | Render median / observed max | Coefficient of variation |
|---:|---:|---:|---:|
| 50 | 94 | 23.01 / 28.43 ms | 10.7% |
| 250 | 360 | 18.36 / 29.69 ms | 24.0% |
| 1,000 | 1,360 | 65.82 / 99.75 ms | 23.5% |
| 5,000 mixed-style | 6,694 | 247.59 / 367.05 ms | 18.6% |

The 250-, 1,000-, and 5,000-node results exceed the policy's 15% variability
warning. They are retained transparently but are inconclusive for timing
regression comparison. With five isolated processes, nearest-rank p95 is also
the observed maximum. The deterministic batch-friendly 5,000-node test is the
hard DOM-shape gate: one segment batch and at most 5,200 SVG descendants. The
separate mixed-style hard shape gate permits at most 6,800 descendants because
834 arrow segments intentionally cannot be batched; the measured shape is
6,694.

Point dragging now copies only primitive pointer data in the raw mouse event
and performs geometry, snapping, and optimistic React state at most once per
animation frame. Mouse-up synchronously flushes the latest pending pointer and
commits one source/history edit. A burst regression test covers this contract.

## Lazy loading and bundle closures

| Closure | Files | Raw | Gzip | Brotli |
|---|---:|---:|---:|---:|
| Initial application | 5 | 1,684,887 B | 474,583 B | 393,370 B |
| Package Studio incremental | 63 | 1,558,168 B | 998,677 B | 957,083 B |
| Graphics Studio increment after Package Studio | 3 | 927,657 B | 214,943 B | 177,439 B |
| Graphics editor entry, Monaco already warm | 2 | 23,279 B | 8,075 B | 7,110 B |
| Monaco core, cold | 3 | 4,038,531 B | 1,051,257 B | 827,087 B |
| Monaco editor worker, first use | 1 | 251,684 B | 75,417 B | 62,145 B |
| Graphics editor total, Monaco cold | 6 | 4,313,494 B | 1,134,749 B | 896,342 B |
| All Stoicheia-owned assets | 29 | 1,090,690 B | 272,393 B | 228,238 B |

Hard-gate results:

- Graphics/Stoicheia assets in the initial application closure: **0**.
- Adapter JavaScript: 813,175 / 921,600 bytes.
- Scoped stylesheet: 113,828 / 131,072 bytes.
- Stoicheia-owned lazy JavaScript: 976,862 / 1,228,800 bytes across 28 chunks.
- The Monaco editor remains a separate dynamic import and is not paid on the
  first Graphics Studio open. Opening the code editor pays only 23,279 raw
  bytes if DataTeX's shared Monaco is already warm; a genuinely cold Monaco
  path additionally loads its core and editor worker.

The report is a collector, not an automatic historical comparator. Its JSON
contains the production-manifest hash, benchmark/fixture/lockfile hashes, build
reuse flag, Git state, and tool versions. A future bundle comparison remains
disabled until an explicit approved baseline file is supplied.

## Production Tauri/WebView capture

The opt-in recorder and report validator are now implemented. They collect the
required inventory in the real WebView, including long-task entries when the
platform supports `PerformanceObserver`'s `longtask` type, and keep per-frame
capture to an in-memory timestamp append. Storage and terminal output occur
after interactions rather than on their hot path.

### First Linux production attempt (partial, not a baseline)

The raw report is retained at
[`benchmarks/stoicheia/runtime-linux-2026-08-10-partial.json`](../benchmarks/stoicheia/runtime-linux-2026-08-10-partial.json)
so the observed data and failure evidence are not lost. It cannot be supplied
to `STOICHEIA_TAURI_PERF_INPUT`: pan and a successful unchanged-source warm
compile are absent, and the original first-canvas definition included time
spent before the first non-empty scene.

| Metric | Observation |
|---|---:|
| Cold DataTeX startup to second animation frame | 302 ms |
| Graphics lazy module load | 47 ms |
| Parser round trip, 53 samples | median 1 ms, p95 2 ms, max 4 ms |
| Renderer, 10 samples | median 1 ms, p95/max 10 ms |
| Point-drag intervals, 36 samples | median 19 ms, p95 48 ms, max 199 ms |
| Zoom intervals, 74 samples | median 33 ms, p95 51 ms, max 126 ms |
| First successful exact compile | 472 ms |
| Failed exact compile, 6 samples | median 252 ms, max 680 ms |
| Long tasks reported by WebKit | 0 |

The captured `firstCanvasCommitMs=23241` is intentionally rejected because it
included user time before a drawing existed. No pan samples were recorded
because an ordinary cursor-background drag is not a pan gesture. The process
also printed `free(): corrupted unsorted chunks` when the production app
terminated after the repeated compile attempts. This is recorded as a native
shutdown/crash diagnostic and must be reproduced separately before assigning
it to the Stoicheia, WebKitGTK, PDFium, or host shutdown path.

The capture exposed and fixed two recorder defects: canvas timing now commits
when the usable canvas surface mounts, and the stopwatch no longer copies or
finishes while any required metric is missing. TypeScript and the 36 focused
recorder/Preview tests pass after the correction.

### Accepted Linux production capture

The corrected capture is stored at
[`benchmarks/stoicheia/runtime-linux-reference-2026-08-10.json`](../benchmarks/stoicheia/runtime-linux-reference-2026-08-10.json).
The collector validated and merged it into
[`benchmarks/stoicheia/performance-linux-reference-2026-08-10.json`](../benchmarks/stoicheia/performance-linux-reference-2026-08-10.json).
All hardware-independent gates passed and the collector emitted no warning.

| Metric | Accepted observation |
|---|---:|
| Cold DataTeX startup to second animation frame | 155 ms |
| Graphics lazy module load | 48 ms |
| First usable canvas from lazy-load start | 313 ms |
| Parser round trip, 66 samples | median 1 ms, p95 1 ms, max 36 ms |
| Renderer, 4 samples | median 1.5 ms, p95/max 5 ms |
| Point-drag intervals, 56 samples | median 31 ms, p95 34 ms, max 151 ms |
| Pan intervals, 48 samples | median 16 ms, p95 33 ms, max 48 ms |
| Wheel-zoom update intervals, 87 samples | median 32 ms, p95 161 ms, max 210 ms |
| Exact compile | cold 793 ms, unchanged-source warm/cache hit 2 ms |
| Failed exact compile | 432 ms |
| WebKit long tasks | 0 |

At an assumed 60 Hz reference period, 92.9% of drag and 95.8% of pan update
intervals were at most two frame periods. Zoom's corresponding value was 60.9%,
but this metric includes pauses between discrete physical wheel events: its
p95 is an input-cadence observation, not a claim that the renderer ran at six
frames per second. The zero-long-task result and 1.5 ms renderer median provide
the relevant counter-evidence. A future automated continuous-input benchmark
may separate compositor/render cadence from physical-device event cadence.

The accepted production capture records:

- cold startup to first paint with Graphics Studio unused;
- Graphics module load and first canvas commit;
- parser round trip including IPC;
- drag, pan, and zoom frame intervals plus long tasks;
- cold and warm exact LaTeX compilation.

These measurements came from the real WebView, compositor, GPU, filesystem,
and TeX toolchain; none were inferred from jsdom. After Linux capture, the same
correctness/lazy gates run on Windows x64, Linux x64, Intel macOS, and Apple
Silicon; timing comparisons remain profile-matched and advisory.
