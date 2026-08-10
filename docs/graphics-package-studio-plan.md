# Graphics Package Studio Implementation Plan

> **Direction update — 2026-07-28:** the initial Stoicheia migration now follows
> the [Stoicheia Copy-First Integration Plan](stoicheia-copy-first-integration-plan.md).
> That plan supersedes the rewrite-first parts of the Executive Decision and
> phase order below until functional and visual parity has been reached. This
> document remains the long-term multi-package graphics roadmap.

This document defines the dedicated visual-authoring architecture for LaTeX
graphics inside DataTeX. It covers TikZ/PGF, tkz-euclide, tkz-elements, PGFPlots,
PSTricks and its major subpackages, image/figure composition, and future graphics
adapters.

The workbench is part of the main DataTeX window and integrates with the common
package, preset, diagnostics, preview, and safe source-editing services defined
in [Package Studio Implementation Plan](package-studio-plan.md).

Last updated: 2026-08-03

## Current Status

- [x] Copy-first parity track Phases 1–3: Rust engine, Tauri adapter, mechanical
  frontend transplant, copied tests, and conditional lazy boundary.
- [x] Copy-first parity track Phase 4: scoped CSS, portal boundary, embedded
  shell, and full-bleed Package Studio mount.
- [x] Copy-first Phase 5 slice 1: active-document hydration, immutable session
  baseline, and complete graphics-state isolation on file/workspace changes.
- [x] Copy-first Phase 5 slice 2: Rust full-document plan, SHA-256 and exact
  stale-source guards, in-window diff/review, and confirmed baseline advance.
- [x] Copy-first Phase 5 slice 3: Rust-owned `tikzpicture` discovery/focus,
  cursor-aware target selection, single-range review, and byte-preserving
  Apply.
- [x] Copy-first Phase 5 slice 4: isolated New Drawing scratch session,
  inline/figure insertion options, Rust-owned dependency and insertion plans,
  and reviewed insertion into an open or empty DataTeX document.
- [x] Copy-first Phase 5 slice 5: host-owned explicit Save from embedded/global
  UI, ordered review → Apply → bridge commit → persistence, exact draft/path
  validation, and per-file write serialization.
- [x] Copy-first Phase 5 slice 6: host-owned Save As and exact SVG export,
  destination-before-review flow, atomic post-write tab retarget, sanitized
  render revisions, and post-dialog/post-commit race guards.
- [x] Audit the local `Stoicheia project/`.
- [x] Compare the local project with the public
  [CSMathematics/Stoicheia](https://github.com/CSMathematics/Stoicheia)
  repository.
- [x] Identify reusable Rust parser, geometry, scene, and test assets.
- [x] Identify frontend interaction patterns that must remain local for speed.
- [x] Identify components and architecture that should not be copied directly.
- [x] Verify the local Stoicheia baseline: 358 frontend tests pass, 1 is skipped;
  85 Rust tests pass, 1 benchmark is ignored by default.
- [x] Define the Rust-first ownership boundary and package-family adapter model.
- [ ] Phase 0: provenance, capability matrix, fixtures, and architecture contracts.
- [ ] Phase 1: extract and modularize the Rust graphics core.
- [ ] Phase 2: versioned scene IR, generated DTOs, and edit plans.
- [ ] Phase 3: single-window Graphics workbench and high-performance canvas.
- [ ] Phase 4: tkz-euclide parity migration from Stoicheia.
- [ ] Phase 5: shared TikZ/PGF authoring adapter.
- [ ] Phase 6: PGFPlots and data-driven plots.
- [ ] Phase 7: tkz-elements and Lua geometry workflows.
- [ ] Phase 8: PSTricks adapter families.
- [ ] Phase 9: exact preview, persistence, and editor/database integration.
- [ ] Phase 10: specialist adapters, hardening, and legacy cleanup.

Copy-first Phase 4 verification:

- The original 110-file frontend baseline remains auditable: 73 files are
  byte-identical and 37 host-boundary adaptations are recorded with their
  source hashes.
- The full workbench is a conditional, full-bleed Package Studio route rather
  than a narrow editor-side panel.
- Scoped CSS has zero selector/root/global-namespace leaks; all 24 copied
  dialogs share a focus-managed portal.
- Host-owned settings and file/autosave ownership remain with DataTeX.
- Container-relative menus/resizers, exact-SVG sanitization, cleanup
  regressions, and a local error boundary complete the embedded-shell gate.
- Full-document, selected-`tikzpicture`, and New Drawing Apply/Save use
  DataTeX's reviewed edit path. The copied frontend has no direct document
  write path.
- A new drawing starts from a deterministic compile-ready scratch document and
  can be inserted at a captured selection, a safe body cursor, or immediately
  before `\end{document}`. The host never writes around the Rust edit planner.

## Executive Decision

Stoicheia should be integrated as a tested source of domain knowledge, not
embedded as a second application.

Reuse and improve:

- Rust parsing coverage for tkz-euclide/TikZ commands.
- Rust geometry resolution and diagnostics.
- Normalized render-scene concept and timing metrics.
- The extensive Rust and frontend regression corpus.
- Interaction behavior: local drag preview, snapping, viewport culling,
  animation-frame batching, selection synchronization, and one source commit per
  completed drag.
- UX concepts: dominant canvas, tool palette, scene/history/properties
  inspectors, fast vs exact preview.

Do not copy as the final architecture:

- The 6,000+ line parser or 3,000+ line geometry file as new monoliths.
- The 2,400-line Zustand store that duplicates Rust AST types and implements
  final LaTeX command generation in TypeScript.
- The 2,400-line canvas component or 1,400-line renderer without first splitting
  them into focused layers.
- Stoicheia's compilation service, because DataTeX already has a more complete
  cancellable process manager.
- Embedded package manuals/assets without an explicit provenance and licensing
  decision.

The target is one DataTeX graphics engine, one Graphics workbench, and multiple
package adapters.

## Stoicheia Audit

### Repository state

- The local project identifies itself as version `1.2.2`.
- At the audit date, the public GitHub repository displayed release `1.1.0`.
- The local copy is therefore the functional integration baseline; the public
  repository is the provenance/history reference.
- No root `LICENSE` or `COPYING` file was found in the local project. The public
  repository page also did not expose a repository license during the audit.
  Ownership and reuse terms must be recorded before files are transplanted.
- The local folder is ignored by the DataTeX repository and contains no nested
  Git metadata, so its exact source commit cannot be inferred from the copy
  alone.

### Rust core

`Stoicheia project/src-tauri/src/parser.rs`

- Defines a broad `AstNode` enum beginning at line 16.
- Returns nodes, resolved points, geometry completeness, viewport, a normalized
  render-scene payload, diagnostics, and timings through `ParseResult` around
  lines 637-669.
- Dispatches many tkz/TikZ command families and parses a complete source through
  `parse_tikz_code` around line 4658.
- Contains a large command and regression corpus through the remainder of the
  file.

`Stoicheia project/src-tauri/src/geometry.rs`

- Defines resolved points, diagnostics, viewport, and timing models at the top of
  the file.
- Implements line/circle intersections, projections, transformations, triangle
  centers, constructions, and shape extents.
- Resolves the parsed dependency sequence through `resolve_geometry` around line
  1245.
- Includes end-to-end construction and parity tests.

`Stoicheia project/src-tauri/src/compiler.rs`

- Compiles temporary LaTeX source and converts output to SVG.
- Provides useful source-anchor injection and cache tests.
- Does not provide DataTeX's complete process-tree cancellation model and must
  not become a parallel application compiler.

### Frontend pipeline

`Stoicheia project/src/hooks/useDocumentPipeline.ts`

- Debounces Rust parsing and exact compilation.
- Uses monotonically increasing request IDs to ignore stale results.
- Demonstrates the correct fast-render/exact-render product split.

`Stoicheia project/src/components/Preview.tsx`

- Keeps drag previews local and commits final source once at pointer-up.
- Coalesces wheel events with `requestAnimationFrame`.
- Implements layered selection, diagnostics, handles, grid/axes, construction
  previews, and hit targets.

`Stoicheia project/src/renderers/FastSvgRenderer.tsx`

- Demonstrates how a normalized scene can produce a fast SVG preview.
- Still performs too much option/style/source interpretation in TypeScript; the
  new Rust scene should make the renderer more mechanical.

`Stoicheia project/src/store.ts`

- Contains a broad interaction/tool model and useful output fixtures.
- Also manually mirrors the Rust AST and owns a large volume of final LaTeX
  generation. These responsibilities must move behind Rust action/generator
  APIs instead of being copied into DataTeX.

### Gaps that require redesign

- Diagnostics identify a failing node primarily by sequence index; the parser
  does not provide stable semantic IDs or source spans.
- Several frontend source update/delete paths depend on broad regular
  expressions. They are not safe enough for lossless import and round-trip.
- Geometry resolution is a sequential full pass rather than an explicit
  dependency graph with incremental downstream recomputation.
- An unresolved construction can make the overall viewport incomplete even when
  a useful partial scene exists.
- The current Rust render payload is mostly points, view box, completeness, and
  diagnostics. The frontend still reparses labels, styles, and options and also
  carries overlapping geometry logic.
- Unknown ordinary LaTeX commands are often skipped rather than preserved as
  lossless raw nodes.
- Existing numerical tests are a strong baseline but are not yet differential
  tests against real tkz-euclide/TikZ output.
- Exact compiled SVG is injected by the standalone frontend. DataTeX must use a
  sanitizer/allowlist or a safer render path before accepting imported or
  compiled SVG content.

### Performance conclusions

Stoicheia's own performance audit reached the correct boundary:

- Zoom, pan, visible-node selection, pointer feedback, and browser paint remain
  in the frontend.
- Rust owns heavy geometry, dependency resolution, intersections/projections,
  optional spatial indexing, parsing, and normalized scene generation.
- Moving viewport interaction through Tauri IPC would add serialization latency
  without reducing React/SVG paint cost.

This boundary is mandatory for the DataTeX implementation.

## Goals

- Provide a professional, direct-manipulation graphics environment without
  leaving DataTeX.
- Make common geometry, drawing, plotting, and figure-composition tasks possible
  without memorizing package syntax.
- Generate deterministic, readable LaTeX source rather than hiding a binary
  graphics format.
- Import and edit a clearly documented supported subset of existing source.
- Preserve unsupported source without destroying it.
- Support fast approximate preview and exact LaTeX preview.
- Share one scene, session, undo, preset, diagnostics, and insertion architecture
  across package families.
- Keep the canvas smooth for large scenes and during pane resize.

## Non-Goals

- A complete parser for every command ever provided by TikZ or PSTricks in the
  first release.
- Perfect conversion between TikZ, PSTricks, PGFPlots, and every specialist
  package.
- Exact LaTeX compilation on every pointer move.
- Replacing Monaco as the authoritative editor for arbitrary source.
- Hiding unsupported source or rewriting it destructively.
- Loading the whole graphics workbench when the user only opens the package
  sidebar.
- A second application or pop-out graphics window.

## Package Families And Support Levels

Every adapter declares one of four support levels per capability:

1. **Native editable** — structured import, visual edit, deterministic export,
   diagnostics, and exact preview.
2. **Generated** — visual creation and export are supported; importing arbitrary
   existing source is limited.
3. **Assisted source** — templates/forms/code completion with exact preview, but
   no full scene round-trip.
4. **Preview only** — source remains user-owned; DataTeX compiles and displays
   it with diagnostics.

The UI must show the support level explicitly. It must never imply that an
unsupported command can be round-tripped safely.

### Priority capability matrix

| Family | Initial capability | Target support | Priority |
| --- | --- | --- | --- |
| tkz-euclide | Euclidean constructions, points, lines, circles, labels, marks | Native editable supported subset | P0 |
| TikZ/PGF | Common paths, shapes, nodes, styles, transforms, libraries | Native/generated hybrid | P0 |
| PGFPlots | 2D functions/data, axes, legends, styles | Generated, then partial import | P0 |
| `graphicx`/figure | Image asset, crop, scale, rotate, figure/caption/label | Native editable | P1 |
| tkz-elements | Lua geometric objects and calculations feeding drawings | Generated/assisted | P1 |
| PSTricks base | Common paths, nodes, shapes, styles | Generated, then partial import | P1 |
| `pst-eucl` | Euclidean construction adapter | Generated/native subset | P1 |
| `pst-plot` | Function/data plots and axes | Generated/assisted | P1 |
| `pst-node`/trees | Nodes, connectors, trees, diagrams | Generated/assisted | P2 |
| `pstricks-add` | Frequently used extensions | Capability-driven extensions | P2 |
| `pst-3dplot`/`pst-solides3d` | 3D scenes and solids | Assisted/generated | P3 |
| `circuitikz`, `forest`, `chemfig` and similar | Specialist editors | Separate future adapters | P3 |

P0/P1 means architectural priority, not that every command in the package is
promised.

## Single-Window Graphics UX

Graphics opens as a route inside Package Studio and uses the full central area.
No wizard or canvas is opened in another window.

Recommended desktop layout:

```text
┌──────────── Graphics toolbar / backend / preview mode ───────────────┐
│ Tools and objects │ Interactive canvas       │ Properties / layers   │
│                  │                          │ history / diagnostics │
│                  │                          │ requirements          │
├──────────────────┴──────────────────────────┴─────────────────────────┤
│ Generated source / diff / exact-preview log                         │
└──────────────────────────────────────────────────────────────────────┘
```

### Primary regions

- **Tool rail** — selection, points, constructions, paths, shapes, plots, text,
  measures, assets, and package-specific tools.
- **Canvas** — dominant viewport with fast scene rendering.
- **Inspector** — properties, object tree/layers, construction history,
  dependencies, source mapping, and diagnostics.
- **Source tray** — generated preamble/body code, diff, raw nodes, and exact
  compile output.

The inspector and source tray are collapsible. Pane sizes are remembered per
workspace mode. Resize uses compositor-friendly CSS updates and does not trigger
parsing or exact preview per frame.

### Editor integration modes

- **Graphics focus** — maximum canvas area.
- **Source split** — Monaco and canvas share the central route.
- **Exact preview split** — fast canvas and exact LaTeX output are compared.
- **Compact** — inspector sections become in-route tabs on narrower layouts.

All modes remain in the same DataTeX window and preserve the active graphics
session.

## Source Of Truth And Round-Trip Policy

The source of truth depends on how a graphics object entered DataTeX:

### Studio-created graphics

- The versioned scene model is authoritative while the draft session is open.
- Rust generates deterministic LaTeX through the chosen package adapter.
- Apply writes code through a revision-safe Package Studio edit plan.
- Saving as a reusable DataTeX graphics resource persists both the portable
  source and structured scene metadata.

### Existing LaTeX graphics

- Rust parses the adapter's supported subset and records source spans.
- Supported nodes become editable scene nodes.
- Unsupported content becomes `RawSource` nodes with original text and spans.
- Applying changes rewrites the smallest safe range and preserves raw nodes.
- If safe preservation cannot be proven, the workbench switches that block to
  assisted-source mode and explains why.

### Manual edits during a session

- Every session tracks base document revision and block hash.
- Manual Monaco edits mark the visual draft as diverged.
- The user can reparse, compare, replace the visual draft, or keep the source.
- No silent “last writer wins” policy is allowed.

## Versioned Graphics Scene IR

The common intermediate representation is independent of TikZ or PSTricks
syntax. Adapters translate between package source and this IR.

### Document

`GraphicsDocument`

- Schema version, document/session ID, revision, and target backend.
- Canvas/view-box and unit system.
- Ordered layers and root node IDs.
- Styles, symbols/components, variables, data sources, and asset references.
- Required packages/libraries/engine.
- Diagnostics and unsupported/raw source fragments.

### Common node metadata

Every node has:

- Stable UUID.
- Kind and adapter capability.
- Layer, z-order, visibility, lock state, and name.
- Optional source span and original source hash.
- Dependency and dependent IDs.
- Style reference plus local overrides.
- Transform and clipping metadata.
- Structured diagnostics.

### Node families

- `Point` — free, coordinate-derived, or generated.
- `Construction` — midpoint, projection, intersection, transformation, centers,
  loci, and constraints.
- `Path` — segment, line, ray, polyline, curve, arc, and custom path.
- `Shape` — circle, ellipse, polygon, rectangle, sector, marker, and filled area.
- `Text` — node, label, math annotation, legend, title, and caption.
- `Measurement` — length, angle, area, coordinate, and derived value.
- `AxisSystem` — 2D/3D axes, ticks, grid, scale, and coordinate transforms.
- `Plot` — function, parametric, polar, table/data series, scatter, bar, area,
  mesh, contour, and surface.
- `Image` — asset reference, crop, transform, and figure placement.
- `Group` — nested transforms, styles, clipping, and reusable components.
- `RawSource` — preserved adapter-specific source outside native coverage.

### Constraints and parameters

- Typed scalar/string/color/coordinate parameters.
- Expressions and references to other parameters.
- Geometry constraints and construction dependencies.
- Future sliders/animations without coupling them to React component state.
- Deterministic evaluation order and cycle diagnostics in Rust.

## Rust-First Module Architecture

The graphics domain should become an internal Rust crate with no Tauri or React
dependency. Tauri commands are a thin adapter in the main app.

```text
src-tauri/crates/graphics-engine/
├── src/
│   ├── lib.rs
│   ├── scene/
│   │   ├── model.rs
│   │   ├── ids.rs
│   │   ├── spans.rs
│   │   ├── styles.rs
│   │   ├── parameters.rs
│   │   └── delta.rs
│   ├── geometry/
│   │   ├── primitives.rs
│   │   ├── constructions.rs
│   │   ├── intersections.rs
│   │   ├── transforms.rs
│   │   ├── constraints.rs
│   │   └── spatial_index.rs
│   ├── actions/
│   │   ├── command.rs
│   │   ├── apply.rs
│   │   ├── history.rs
│   │   └── validation.rs
│   ├── adapters/
│   │   ├── mod.rs
│   │   ├── tikz/
│   │   ├── tkz_euclide/
│   │   ├── pgfplots/
│   │   ├── tkz_elements/
│   │   └── pstricks/
│   ├── generator/
│   │   ├── formatting.rs
│   │   ├── requirements.rs
│   │   └── source_map.rs
│   ├── diagnostics/
│   └── fixtures/
└── Cargo.toml

src-tauri/src/package_studio/graphics/
├── commands.rs
├── sessions.rs
├── preview.rs
├── persistence.rs
└── assets.rs
```

### Adapter contract

Each backend/family adapter provides:

- Capability descriptor and support levels.
- Tolerant import to scene plus raw nodes and diagnostics.
- Validation of supported node combinations.
- Required package/library/engine calculation.
- Deterministic source generation and source map.
- Optional adapter-specific tools/properties schema.
- Exact-preview wrapper and compile requirements.
- Migration for adapter-owned saved data.

Package adapters do not implement a separate preamble manager. They report
requirements to Package Studio, which creates the final edit plan.

### Graphics actions

Frontend tools send typed intents rather than LaTeX strings:

- Create point/shape/plot/construction.
- Update property or style.
- Move a free point.
- Reorder/group/delete nodes.
- Change parameter/data source.
- Change backend-specific option.

Rust validates the action, updates the authoritative draft scene, resolves
affected dependencies, and returns a revisioned scene delta plus diagnostics.
Final package source is generated in Rust.

## Frontend Ownership

React/TypeScript owns:

- Workbench panes and routing.
- Accessible tools, forms, shortcuts, focus, and selection UI.
- Canvas zoom, pan, viewport culling, pointer capture, and hover state.
- `requestAnimationFrame` batching.
- Temporary drag/construction preview derived from the latest Rust scene.
- Mechanical SVG/canvas rendering of normalized nodes.
- Virtualized object/history/diagnostics views.

React/TypeScript does not own:

- Final LaTeX command templates.
- Package requirement calculation.
- Full-document parsing.
- Geometry dependency resolution after a committed action.
- Cross-document edit ranges.
- Exact preview process management.

### Drag contract

1. Pointer-down captures a scene node and the current scene revision.
2. Pointer-move updates a transient local overlay each animation frame.
3. Optional snap queries use a local compact index or coarse Rust-prepared snap
   data.
4. Pointer-up sends one typed move/action to Rust.
5. Rust resolves dependents and returns one scene delta.
6. Source generation/edit application occurs once, not per frame.

This preserves Stoicheia's strongest interaction behavior while moving final
domain work to Rust.

## Session And IPC Model

Commands are coarse and revisioned:

- `graphics_open_session`
- `graphics_close_session`
- `graphics_import_source`
- `graphics_get_scene`
- `graphics_apply_action`
- `graphics_apply_actions`
- `graphics_undo`
- `graphics_redo`
- `graphics_generate_output`
- `graphics_create_document_edit_plan`
- `graphics_start_exact_preview`
- `graphics_cancel_exact_preview`
- `graphics_save_resource`
- `graphics_load_resource`

Every response includes session and scene revision. Large scene updates use
deltas after the initial snapshot. Stale responses cannot overwrite a newer
scene.

Do not invoke Rust for:

- Every wheel event.
- Every drag frame.
- Inspector render.
- Pure viewport visibility changes.
- Repeated reads of unchanged catalog/capability metadata.

## Preview Pipeline

### Fast preview

- Render the normalized scene directly as SVG or Canvas.
- Use memoized layers, viewport culling, adaptive grid density, and bounded hit
  targets.
- Rust pre-resolves options/styles/labels that otherwise require source regexes.
- Render only visible or interaction-relevant nodes.
- Provide a clear “fast preview” indicator for features whose LaTeX appearance
  is approximate.

### Exact preview

- Reuse DataTeX's existing `CompilationManager` for cancellation, timeout,
  process tracking, and process-tree termination.
- Compile an isolated, minimal document through the configured engine.
- For PDF output, reuse the PDFium rendering/cache path at device-appropriate
  resolution.
- Retain an optional SVG conversion adapter only when vector output is needed and
  the required toolchain is available.
- Cache by generated source, engine, packages, adapter version, fonts/assets, and
  preview dimensions.
- Map compiler diagnostics back through generated source maps.
- Never compile during pan, zoom, resize, or every drag frame.

### Toolchain differences

- TikZ/tkz-euclide/PGFPlots normally use a PDF-capable LaTeX engine.
- tkz-elements workflows require LuaLaTeX and must show that requirement before
  Apply.
- PSTricks may require a DVI/PostScript-aware pipeline or a compatible modern
  route; the adapter detects the available toolchain and reports limitations.
- Exact preview availability is a capability, not an assumption.

## Package-Specific Strategy

### tkz-euclide first

This is the migration/reference adapter because Stoicheia already contains:

- Broad command parsing.
- Geometry resolution and diagnostics.
- Interactive tools, construction previews, snapping, measurements, and history.
- Fast and exact preview paths.
- Large test coverage.

Migration must preserve test behavior while introducing source spans, stable
scene IDs, smaller modules, generated DTOs, and Rust-owned action/generation
services.

### TikZ/PGF shared foundation

- Implement common coordinates, paths, shapes, nodes, styles, transforms,
  layers/scopes, clips, arrows, patterns, and selected libraries.
- Use capability packs for libraries rather than a single ever-growing switch.
- Preserve unknown styles/keys in adapter-specific option maps or raw nodes.
- Let tkz-euclide and PGFPlots reuse TikZ styles, coordinates, labels, and
  generation utilities.

### PGFPlots

Initial focus:

- 2D Cartesian axes.
- Function, coordinate, and table-based series.
- Line/scatter/bar/area plots.
- Legends, labels, ticks, domains, samples, colors, markers, and common styles.
- `compat` setting and required library calculation.
- CSV/table asset handling with portable paths.

Later:

- Parametric/polar plots.
- Group plots.
- Error bars and statistics.
- Mesh, contour, and 3D surface plots.
- Large dataset downsampling for fast preview while exact source remains intact.

Data transforms and validation run in Rust/background work; viewport interaction
stays local.

### tkz-elements

- Treat Lua objects/calculations as a typed geometry-computation adapter.
- Map supported objects to the common scene when possible.
- Generate LuaLaTeX/tkz-euclide drawing output deterministically.
- Keep unsupported Lua source as raw/assisted source.
- Never execute arbitrary Lua outside the controlled LaTeX preview process.

### PSTricks

Do not implement all PSTricks packages in one component. Build capability packs:

1. Base primitives/styles/coordinates.
2. `pst-node` and connector/tree capabilities.
3. `pst-plot` data/functions/axes.
4. `pst-eucl` Euclidean constructions.
5. `pstricks-add` common extensions.
6. 3D and specialist packages only after core adapters stabilize.

PSTricks generation can reuse common scene nodes, but package-specific options,
toolchain rules, and raw source remain in its adapter.

### Images and figures

- Use validated asset references, not arbitrary unescaped path strings.
- Support relative path strategy, crop, scale, rotate, placement, caption, label,
  alt text, and required packages.
- Integrate with tracked DataTeX resources and collection paths.
- Preview missing/moved assets with actionable diagnostics.

## Persistence And Database Integration

A reusable graphics resource stores:

- Stable resource ID and collection.
- Versioned scene JSON.
- Generated portable LaTeX source.
- Chosen adapter/backend and version.
- Required package/library/engine manifest.
- Asset references with normalized relative paths.
- Preview thumbnail/cache key.
- Source document links and insertion occurrences.
- Created/updated timestamps and optional tags/notes.

The `.tex` source remains portable and usable outside DataTeX. Structured scene
metadata enhances editing but must not make compilation depend on the database.

## Performance Requirements

- Pointer drag, pan, zoom, and resize target 60 FPS on the reference machine.
- Pointer work should normally stay below one 16.7 ms frame budget.
- One source/domain commit per completed drag.
- No exact compilation on viewport-only changes.
- Rust parse/geometry work runs off the UI thread and is cancellable or
  revision-discardable.
- Scene snapshots are compact; subsequent changes use deltas.
- Large plot datasets use Rust preprocessing and preview-level downsampling.
- SVG layers use viewport culling and adaptive detail.
- Hidden tabs/workspaces suspend animation and unnecessary rendering.
- Opening the package sidebar does not load the canvas or graphics adapter code.

Instrumentation must record:

- Pointer-to-paint latency and dropped frames.
- React commit duration/render count.
- Rust parse, geometry, generation, and serialization duration.
- IPC payload size.
- Fast-preview latency.
- Exact-preview queue, compile, render, cancellation, and cache-hit timings.

Budgets should be finalized from Phase 0 fixtures. Regressions then fail CI or a
dedicated performance check when they exceed the agreed tolerance.

## Reliability And Safety

- Escape/validate labels, URLs, colors, package options, and asset paths.
- Treat imported LaTeX, Lua, data files, and PSTricks content as untrusted text.
- Do not enable shell escape by default.
- Restrict preview commands to configured LaTeX/toolchain executables.
- Use isolated temporary directories and guaranteed cleanup.
- Preserve raw unsupported source instead of “fixing” it silently.
- Crash or timeout of exact preview must not lose the scene draft.
- Autosave recovery is keyed by stable session/resource ID and schema version.
- Apply operations are revision-safe and enter Monaco as one undoable change.

## Provenance And Licensing Gate

Before copying or extracting Stoicheia source:

- [ ] Confirm and document repository ownership and permission to reuse the local
  1.2.2 code.
- [ ] Add or identify the correct Stoicheia repository license.
- [ ] Record the origin commit/version for every transplanted module or fixture.
- [ ] Separate original DataTeX code, Stoicheia-derived code, and third-party
  package examples/assets.
- [ ] Review licenses for embedded manuals and examples.
- [ ] Prefer linking to official documentation over bundling complete manuals
  unless redistribution is explicitly allowed and necessary.
- [ ] Preserve required copyright/license notices.

This is a release gate, not a reason to discard the architectural audit.

## Implementation Roadmap

### Phase 0: Contracts, Provenance, And Fixtures

- [ ] Complete the provenance/licensing gate.
- [ ] Inventory Stoicheia features by parser command, geometry resolver, tool,
  renderer node, inspector, and exact-preview behavior.
- [ ] Create a package capability matrix with explicit support levels.
- [ ] Preserve representative parse/scene/generation/render fixtures.
- [ ] Keep all 358 frontend and 85 Rust passing tests as the initial migration
  baseline.
- [ ] Add exact-compile fixtures for supported engines when toolchains exist.
- [ ] Measure small, medium, large, and pathological scene performance.
- [ ] Define versioned scene/action/delta/diagnostic/adapter contracts.

Done when: reuse is legally documented, supported behavior is measurable, and
the new core contracts can be reviewed before code moves.

### Phase 1: Extract The Rust Core

- [ ] Create the Tauri-independent `graphics-engine` crate.
- [ ] Split primitive types, geometry, parser adapters, diagnostics, and tests
  into focused modules.
- [ ] Move tkz-euclide parser/geometry behavior incrementally with tests green.
- [ ] Remove assumptions about a standalone Stoicheia application.
- [ ] Add structured errors rather than panics for imported source.
- [ ] Add parser/geometry fuzz targets for nested and malformed options.

Done when: the existing tkz geometry core runs through a small public Rust API
without Tauri or React.

### Phase 2: Scene IR, Types, And Edit Plans

- [ ] Implement stable node IDs, source spans, dependencies, styles, raw nodes,
  and diagnostics.
- [ ] Add versioned scene snapshots and deltas.
- [ ] Select and implement generated Rust-to-TypeScript DTOs.
- [ ] Define typed graphics actions and Rust history.
- [ ] Implement deterministic generation with source maps.
- [ ] Connect generated output to Package Studio requirement and edit-plan APIs.

Done when: one supported source block can import to scene, change through a typed
action, generate deterministic code, and produce a safe document diff.

### Phase 3: DataTeX Graphics Workbench

- [ ] Add the lazy-loaded, single-window Graphics route.
- [ ] Build modular tool rail, canvas, inspector, object tree, history,
  diagnostics, and source tray.
- [ ] Implement local viewport, selection, hover, drag preview, and
  `requestAnimationFrame` batching.
- [ ] Implement viewport culling, adaptive grid, and bounded hit testing.
- [ ] Implement focus/source split/exact split/compact modes.
- [ ] Add keyboard and accessible non-pointer alternatives.
- [ ] Add resize/render-count regression tests.

Done when: a test scene can be manipulated smoothly without compilation or IPC
on pointer frames.

### Phase 4: tkz-euclide Parity

- [ ] Port the existing Stoicheia tool families in capability-based increments.
- [ ] Preserve free/generated point behavior.
- [ ] Preserve snapping priority and construction ghost previews.
- [ ] Preserve measurements, construction history, object tree, and properties.
- [ ] Move final TS command generation to Rust actions/generators.
- [ ] Add unsupported-source/raw-node behavior.
- [ ] Reach agreed parser/geometry/tool fixture parity before removing duplicate
  code.

Done when: the supported Stoicheia workflow operates natively inside DataTeX and
passes the migration corpus.

### Phase 5: TikZ/PGF Adapter

- [ ] Implement common coordinates, paths, shapes, nodes, transforms, styles,
  scopes, layers, and clips.
- [ ] Add selected high-value library capability packs.
- [ ] Share style/label/path generation with tkz-euclide.
- [ ] Add deterministic import/generation fixtures.
- [ ] Add requirement calculation for TikZ libraries.
- [ ] Preserve unknown keys/source safely.

Done when: common TikZ drawings can be created and a documented subset can be
reopened for visual editing.

### Phase 6: PGFPlots

- [ ] Add axis and series scene nodes.
- [ ] Add function, coordinate, and table/CSV data sources.
- [ ] Add common 2D plot types, legends, ticks, labels, styles, and templates.
- [ ] Add Rust validation, sampling, and preview downsampling.
- [ ] Add `compat`, package, and library requirements.
- [ ] Add exact-output comparison fixtures.
- [ ] Extend to advanced/3D plots only after 2D stability.

Done when: a user can build, preview, insert, save, and reopen representative 2D
plots without hand-writing PGFPlots code.

### Phase 7: tkz-elements

- [ ] Define supported Lua object and calculation capabilities.
- [ ] Map supported results to common geometry nodes.
- [ ] Generate controlled LuaLaTeX/tkz-euclide source.
- [ ] Add engine diagnostics and exact-preview checks.
- [ ] Preserve unsupported Lua as assisted/raw source.

Done when: selected tkz-elements calculations can drive editable drawings with
clear LuaLaTeX requirements.

### Phase 8: PSTricks Families

- [ ] Implement PSTricks base primitives and styles.
- [ ] Add `pst-eucl` geometry mappings.
- [ ] Add `pst-plot` plot mappings.
- [ ] Add `pst-node` connector/tree mappings.
- [ ] Add high-value `pstricks-add` capabilities.
- [ ] Detect and explain compatible preview toolchains.
- [ ] Defer 3D/specialist packs until base performance and generation are stable.

Done when: the core PSTricks families share the workbench safely without
pretending to support the entire ecosystem.

### Phase 9: Exact Preview, Persistence, And Integration

- [ ] Connect exact preview to DataTeX's `CompilationManager`.
- [ ] Add PDFium rendering and optional SVG output capability.
- [ ] Add cache, cleanup, cancellation, timeout, and stale-result tests.
- [ ] Persist reusable graphics resources and portable asset references.
- [ ] Link graphics resources to documents/collections.
- [ ] Add source/canvas selection synchronization with Monaco.
- [ ] Add recovery and schema migrations.

Done when: a graphics draft survives reopen, compiles exactly, and can be applied
or updated in a document safely.

### Phase 10: Specialist Adapters And Hardening

- [ ] Prioritize future adapters from real usage data.
- [ ] Add 3D/specialist PSTricks and PGFPlots capabilities incrementally.
- [ ] Evaluate `circuitikz`, `forest`, `chemfig`, and other dedicated domains as
  separate adapters.
- [ ] Add large-scene and large-dataset stress tests.
- [ ] Complete accessibility, localization, recovery, and cross-platform tests.
- [ ] Remove legacy DataTeX TikZ/PGFPlots/PSTricks wizards only after parity.
- [ ] Remove copied Stoicheia standalone UI/compiler code after migration.
- [ ] Publish capability/support documentation.

Done when: one documented graphics architecture serves all supported adapters and
legacy implementations are no longer loaded.

## Verification Matrix

### Rust unit and integration tests

- Parser fixtures and source spans.
- Geometry construction/intersection parity.
- Scene action, dependency, undo/redo, and delta behavior.
- Deterministic source generation and requirement calculation.
- Raw-node preservation and stale edit plans.
- Preview cancellation/cache/process cleanup.

### Frontend tests

- One render/interaction update per intended frame.
- One committed action per completed drag.
- Selection synchronization across canvas/tree/history/inspector/source.
- Pane resize without parse/compile work.
- Canvas suspension while hidden.
- Keyboard and accessible tool alternatives.

### Golden and compile tests

- Generated source text.
- Imported scene snapshots.
- Fast-preview SVG structure.
- Exact LaTeX compile success and diagnostic mapping.
- Representative visual comparisons with controlled tolerance.

### End-to-end workflows

- Create a tkz-euclide construction, edit it visually, insert it, undo, reopen,
  and continue editing.
- Import a partially supported TikZ block and preserve unsupported commands.
- Build a PGFPlots chart from data and move the project without breaking paths.
- Open a PSTricks source on a machine without the required toolchain and receive
  actionable diagnostics without data loss.
- Switch rapidly between graphics sessions while parse and exact-preview jobs
  are running.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Universal-parser scope explosion | Capability levels, adapters, raw nodes, incremental families |
| Monolithic migration | Extract modules behind tests, not files wholesale |
| Rust/TS model drift | Generated versioned DTOs and CI contract checks |
| Canvas latency from IPC | Local transient interaction and revisioned commit actions |
| Expensive exact preview | Cancellation, cache, progress, and explicit scheduling |
| User source corruption | Source spans, raw preservation, revision-safe diff |
| Package/toolchain differences | Adapter capability probes and explicit diagnostics |
| Large plots/scenes | Rust preprocessing, deltas, culling, LOD/downsampling |
| Licensing uncertainty | Provenance gate before source/assets are copied |
| Duplicate compilers/viewers | Reuse DataTeX CompilationManager and PDFium services |

## Official Ecosystem References

- [Stoicheia public repository](https://github.com/CSMathematics/Stoicheia)
- [PGF/TikZ on CTAN](https://ctan.org/pkg/pgf?lang=en)
- [tkz-euclide on CTAN](https://ctan.org/pkg/tkz-euclide?lang=en)
- [tkz-euclide distribution directory](https://ctan.org/tex-archive/macros/latex2e/contrib/tkz/tkz-euclide?lang=en)
- [tkz-elements on CTAN](https://ctan.org/pkg/tkz-elements?lang=en)
- [PGFPlots on CTAN](https://ctan.org/pkg/pgfplots?lang=en)
- [PSTricks project and documentation](https://tug.org/PSTricks/main.cgi/)
- [PSTricks package directory](https://tug.org/PSTricks/main.cgi?file=packages)
- [pst-eucl on CTAN](https://ctan.org/pkg/pst-eucl?lang=en)
- [pst-node on CTAN](https://ctan.org/pkg/pst-node?lang=en)

## Immediate Next Implementation Step

Follow Phase 5 of the
[copy-first integration plan](stoicheia-copy-first-integration-plan.md):

1. **Done:** seed a document-scoped graphics session from the active DataTeX
   tab.
2. **Done:** capture an immutable exact source baseline plus a diagnostic
   fingerprint, and reset all local scene state when the file or Package Studio
   lifetime changes.
3. **Done:** identify a selected/current `tikzpicture` without dropping or
   rewriting source outside its exact range.
4. **Done:** produce typed Rust full/range edit plans and show them in DataTeX's
   existing in-window diff/review UI.
5. **Done:** apply only after SHA-256, exact source, session, and target
   validation; reject stale plans before review and immediately before Apply.
6. **Done:** create a drawing from scratch, configure inline/figure wrapping
   and destination, add the required package/library declarations once, and
   insert it through the same reviewed edit path.
7. **Done:** route explicit Save through DataTeX only after the reviewed edit
   has been accepted and the full host baseline has committed; serialize
   per-file writes and retain newer editor changes as dirty.
8. **Done:** add narrow host-owned SVG Export and Save As contracts without
   restoring the copied standalone New/Open/file system.
9. **Done:** connect exact-SVG jobs to the existing DataTeX process-tree
   manager, cancel superseded/unmounted frontend jobs, reap LaTeX and
   `dvisvgm` after stop/timeout, and cover Linux descendants/temp cleanup.
10. **Done:** add explicit `dvisvgm` discovery/configuration and include its
    canonical path, file metadata, reported version, and schema in the
    exact-preview cache key.
11. **In progress:** portable native process-tree/exact-preview smoke tests are
    implemented and pass again on Linux. The build/release workflow contract
    now runs inside every job before those tests and freezes exactly the
    Windows x64, Linux x64, Intel Mac, and Apple Silicon config/target pairs.
    The current official labels (`macos-15-intel` x64 and `macos-15` arm64)
    were reverified on 2026-08-10. Close the gate after all four hosted jobs are
    green.
12. **Done locally:** keep instant preview and pan/zoom responsive while an
    exact render is active. A diagnostics-only 250 ms event-loop probe adds no
    normal-mode timer/render work, the frontend regression keeps UI updates
    live during a pending exact job, and the native regression parses within
    250 ms while a delayed compiler is still running.
13. **Open release gate:** run the committed native matrix on Windows x64,
    Linux x64, Intel Mac, and Apple Silicon. Local Linux execution and the
    workflow contract are green; the hosted jobs remain required for release.
14. **Done locally:** Phase 7 source/UI parity inventory. An immutable-manifest
    gate now covers 100 toolbar tools, 100 icons, 112 Command Palette actions,
    24 dialogs, and source integrity for the copied LaTeX generator/tests.
15. **Done locally:** freeze 10 versioned byte-exact generated-LaTeX scenarios,
    execute them from the permanent prebuild parity gate, and add exact host
    outputs for focused edits, scratch templates, and CRLF figure insertion.
16. **Done locally:** freeze four canonical Rust parser/geometry results and
    consume the same payloads through the real frontend pipeline for complete
    canonical semantic-SVG snapshots with ID/reference normalization and
    per-scenario hashes. Cover chained geometry, styles, Unicode labels,
    clipping, incomplete diagnostics, and deterministic 1,000-node batching.
17. **Done locally:** add deterministic flat and dependency-heavy 5,000-node
    native reports, policy-driven batch-friendly and mixed-style renderer
    checks, animation-frame-coalesced point dragging, and production-manifest
    closure reports with zero Graphics assets in initial startup.
18. **Done locally:** add the opt-in production WebView recorder for real cold
    startup, Graphics first paint, IPC-inclusive parse, drag/pan/zoom frame
    intervals, long tasks, and cold/warm exact compile. It persists a
    machine-readable report and the main performance collector validates the
    complete required inventory before merging it.
19. **Done locally:** the first cold Linux production capture is retained as a
    partial diagnostic report, and the corrected rerun closed the local gate.
    It measured 155 ms startup, 48 ms module load, 313 ms first usable canvas,
    1 ms median parser round trip, 1.5 ms median renderer, and 793/2 ms
    cold/warm exact compile. The complete raw capture and collector-validated
    merged report are linked from
    [the performance baseline](stoicheia-performance-baseline.md).

Full-document, selected/current `tikzpicture`, and New Drawing Apply/Save now
pass stale-source, target-switching, file-switching, duplicate-insertion, and
concurrent-write guards. Save As and exact SVG export now share the same
host-owned lifecycle without restoring a second file system. Phase 5 is
complete. The Linux cancellation/process-cleanup and explicit `dvisvgm`
discovery/cache-identity slices are complete. Portable native smoke coverage
is implemented and verified on Linux. Concurrent instant/exact responsiveness
is also verified locally without changing the copied core. The next copy-first
gate is the green Windows/Linux/Intel-Mac/Apple-Silicon build matrix.
