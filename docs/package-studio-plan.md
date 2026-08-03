# Package Studio Implementation Plan

This document is the implementation roadmap for replacing the current compact
Package Gallery/Package Browser experience with a complete Package Studio inside
DataTeX. It covers package discovery, document dependency management, package
configuration, code generation, previews, diagnostics, presets, and TeX
distribution integration.

The graphics-specific architecture and the migration of the existing Stoicheia
project are tracked separately in
[Graphics Package Studio Plan](graphics-package-studio-plan.md).

Last updated: 2026-07-25

## Current Status

Current implementation checkpoint: Package Studio is now in a working vertical
slice across Phase 1, Phase 2, and Phase 5. The app has a central Package Studio
workspace, Rust-backed package analysis/edit planning, and the first native
builders (`geometry`, `code-highlighting`). Package actions now create a
reviewable pending edit plan with source preview, jump-to-line actions, apply,
dismiss, and stale-source protection. Builder package removal and package-option
changes now use the same Rust edit-plan/review path. The next focus is to harden
diagnostics and improve the diff rendering before expanding the builder catalog.
The first diagnostic hardening slice is in place for duplicate packages, common
conflicts, obsolete packages, and `hyperref`/`cleveref` ordering. Those first
diagnostics now expose reviewable quick fixes where the edit can be planned
safely. The review panel now has a first inline diff view with add/remove
highlighting instead of plain source textareas. The next non-graphics builder,
`xcolor`, now has a Rust-backed palette generator and native Package Studio UI.
`fancyhdr` now has a first Rust-backed header/footer builder with live page
style preview and reviewable setup block. `enumitem` now has a first Rust-backed
list builder with inline package options, global list settings, custom list
creation, existing `\setlist`/`\newlist` import, label preset chips, live code
preview, and reviewable setup block. The builder registry
now starts to carry discoverable option metadata for the current builders so Package Studio
can teach users available package options through direct controls and contextual
tooltips instead of relying only on manual option strings. The option schema now
carries choice lists, default values, units, and mutually-exclusive groups, and
the first generic control renderer can edit flags, choice values, dimensions,
key/value options, colors, and exclusive package options. Non-interactive
metadata cards no longer duplicate the real form fields. The builder header and
document/package status are now consolidated into a compact two-card overview,
with requirements, targets, enabled capabilities, and diagnostics kept in one
side card. The legacy
wizard parity audit has started in `docs/package-studio-wizard-inventory.md` so
new builders preserve existing wizard features before replacing old surfaces.
All current builders now share a document-derived activation bar. Its
switch adds/removes the managed package and generated setup through one atomic
Rust edit plan; option changes, package variants, and setup blocks are reviewed
and applied together. Applying a review keeps Package Studio open for iterative
work. Builder drafts survive navigation between builders, and compact-sidebar
cards now deep-link to the selected builder before closing to recover workspace
width. The `xcolor` builder now covers color creation and palette editing, all
legacy color models with conversion and real previews, strict Rust validation,
`\colorlet` mixes, mutually-exclusive drivers, and body-command snippets.
`fancyhdr` now has the next parity slice: built-in page-style presets, quick
command chips for common header/footer tokens, advanced custom package options,
and a compact visual/code preview switch with preview zoom. It can also import
existing `\pagestyle`, `\fancyhf`, `\fancyhead`, `\fancyfoot`,
`\headrulewidth`, and `\footrulewidth` setup from the active document.
`code-highlighting` now has language-aware body snippet generation backed by
Rust, reusing the legacy language catalog while filtering listings-compatible
languages separately from minted-only languages. It can now also import
existing unmanaged `listings`/`minted` setup from the active document, including
engine selection, line numbering, line wrapping, frame options, and minted style.
`xcolor` can now import existing package options, `\definecolor` declarations,
and `\colorlet` aliases/mixes from the active document into the palette builder.
`geometry` now imports active-document package options and detects
`documentclass` `oneside`/`twoside` state while preserving the correct boundary:
`twoside` is displayed as document-class state and is not emitted as a
`geometry` package option.
`graphicx` now has a first Rust-backed body builder for `\includegraphics` and
optional `figure` wrappers, with package activation handled separately from
cursor snippet insertion. Its first legacy-parity polish slice also restores a
native image/PDF/EPS file picker inside the builder form, and it can import the
first existing `figure`/`\includegraphics` snippet from the active document.
The first tables slice has started with a Rust-backed Table Workbench that
generates standard `tabular`, `booktabs`, and `tabularray` snippets from a
simple editable grid, while keeping `tabularray`/`booktabs` package activation
separate from cursor snippet insertion. The next table-editing slice adds an
active-cell model with per-cell bold, italic, and alignment controls that feed
both the instant sketch preview and Rust LaTeX generation. The next merge slice
adds Shift-click range selection, merge/split controls, cell span state, visual
spans in the editor/preview grids, and Rust generation for `\multicolumn`,
`multirow`, and `tabularray` `r=`/`c=` cell specs. After comparing the legacy
table wizards, the selection model now follows the older spreadsheet-like
workflow: mouse-down on a cell, drag across cells, mouse-up to finish, then
format or merge the selected range. The table editor controls are now
consolidated into a compact in-grid toolbar: mode, row/column count, add/remove
actions, rules, float/centering/placement, active column alignment,
bold/italic, cell alignment, selected-cell text/background color, active
row/column background color, clear styling, active-row/column insert/remove,
merge, and split.

- [x] Audit the current Package Browser, Package Gallery, wizard registry, and app routing.
- [x] Audit the existing Rust CTAN catalog and compilation infrastructure.
- [x] Establish the single-window product model.
- [x] Establish the Rust-first ownership boundaries.
- [x] Audit the local Stoicheia project before planning graphics integration.
- [ ] Phase 0 (partial): baseline contracts and regression coverage. Core Rust contracts,
  analyzer tests, edit-plan tests, builder inventory, and first fixtures are in
  place. Remaining: UI tests, generated DTO pipeline, naming-boundary doc, and
  performance baselines.
- [ ] Phase 1 (partial): Package Studio shell, navigation, and state. Activity-bar entry,
  central workspace shell, compact sidebar panel, mutually-exclusive sidebar
  behavior, functional builder deep-links, draft preservation while switching
  builders, registry-driven builder overview, and explicit main-content
  scrollbar are in place. Remaining: persistent cross-session layout state,
  focus/split modes, and shortcut cleanup.
- [ ] Phase 2 (partial): Rust document-package analysis and safe edit plans. Add-package
  plans, generated setup block plans, frontend edit application, active-document
  package status, detected packages, diagnostics, editor jump actions, and a
  first review-before-apply panel are in place. Atomic builder-configuration
  plans now synchronize package variants/options and generated blocks in one
  review. Remaining: richer package
  diagnostics for more package families, improved diff rendering, and more
  malformed-source test coverage.
- [ ] Phase 3: unified catalog and document dependency workspace.
- [ ] Phase 4: generic package builder platform.
- [ ] Phase 5 (partial): non-graphics package builders and live previews. `geometry` and
  `code-highlighting` have first native React control surfaces backed by Rust
  code generation, instant visual sketches, generated-code previews, warnings,
  package activation, and generated setup insertion/removal. `xcolor` now has a
  complete first migration for option discovery, `\definecolor`, `\colorlet`,
  model conversion/validation, palette management, previews, and usage snippets.
  `fancyhdr` now has a first page style builder for headers, footers, rule
  widths, presets, quick command insertion, custom package options, and compact
  preview/code modes, plus active-document import for common fancyhdr setup
  declarations. `code-highlighting` now adds language selection and generated
  `lstlisting`/`minted` body snippets that can be inserted at the editor cursor,
  plus active-document import for common `\lstdefinestyle`, `\lstset`,
  `\usemintedstyle`, and `\setminted` declarations. `xcolor` now imports
  active-document `\definecolor` declarations and common `\colorlet` aliases.
  `geometry` now imports existing margin/layout options and makes `twoside`
  document-class semantics explicit in the UI. `graphicx` now has a first
  Package Studio body-snippet builder for `\includegraphics` and `figure`
  environments while using the same reviewed package requirement flow for
  `graphicx`, plus native image/PDF/EPS file selection and active-document
  import for common `\includegraphics`/`figure` snippets. Tables now have a
  first Rust-backed body-snippet workbench for standard `tabular`, `booktabs`,
  and `tabularray`, with row/column sizing, cell editing, alignment, float
  caption/label controls, instant sketch preview, generated-code preview, and
  reviewed package requirements for `booktabs`/`tabularray`. The workbench now
  also supports active-cell styling with bold, italic, and per-cell alignment
  emitted through Rust-generated LaTeX, plus a first merge/split workflow with
  spreadsheet-style drag selection, visual merged cells, `\multicolumn`,
  `\multirow` requirements, and `tabularray` span specs. Table controls have
  been consolidated into the editor toolbar to reduce vertical space and make
  the workbench feel closer to the legacy spreadsheet-style table wizard. The
  legacy table color workflow is now restored in compact form: selected cells
  can receive background/text colors, active rows or columns can receive a
  background color, the instant sketch reflects the styling, and Rust generation
  adds the required `xcolor[table]` dependency plus `\cellcolor`/`\textcolor`
  or `tabularray` color cell specs. Row/column structural edits now operate at
  the active cell instead of only appending/removing at the end, with safe span
  reset when a merged grid is structurally changed. A compact spreadsheet import
  card now accepts pasted CSV, semicolon CSV, or tab-separated data and replaces
  the grid with normalized cells while resetting style/span metadata. The first
  richer `tabularray` cell-property slice adds selected-cell vertical alignment
  (`valign=t/m/b`) to the compact toolbar, preview, and Rust-generated
  `cell{r}{c}` specs. Bold/italic styling in `tabularray` mode now uses native
  cell font specs (`font={\bfseries ...}`) instead of wrapping cell content,
  keeping generated table source cleaner and closer to the legacy
  `TabularrayWizard`. `tabularray` `X`/`Q` columns now also support optional
  per-column weight/width specs such as `X[2]` or `Q[1.5cm]` from the compact
  active-column toolbar. `longtblr` now reports builder warnings for label
  without caption and for ignored floating/placement/centering controls, so
  multi-page table edge cases are visible before insertion. `siunitx` now has a
  first Rust-backed body/setup builder for `\num`, `\unit`, `\qty`,
  `\qtylist`, `\qtyrange`, and `\sisetup`, with unit presets, prefix/unit/power
  controls, number-format controls, generated-code preview, body insertion, and
  reviewable package/setup synchronization for `siunitx`. It also imports
  existing document `\sisetup` plus common `\num`, `\unit`, `\qty`,
  `\qtylist`, and `\qtyrange` snippets so the UI can hydrate from the active
  file instead of starting from defaults. The unit picker now has a broader
  searchable SI catalog covering full decimal prefixes, base units, common
  derived units, accepted non-SI units, information units, and practical
  compound presets. The first `siunitx` diagnostics are now emitted from Rust
  for empty numbers, short quantity lists, incomplete ranges, ignored
  uncertainty precision, suspicious prefixes on special/non-SI units, legacy
  v2-style commands such as `\SI`/`\si`, and version-sensitive options such as
  `binary-units` or `separate-uncertainty`. The `siunitx` panel now includes a
  lightweight live preview card for numbers, quantities, lists, ranges,
  compound units, setup options, active number-format chips, warning counts, and
  a compact running-app status strip without invoking a TeX compile.
- [ ] Phase 6: graphics workbench integration.
- [ ] Phase 7: presets, templates, and custom `.sty` resources.
- [ ] Phase 8: TeX distribution diagnostics and optional package installation.
- [ ] Phase 9: legacy cleanup, migration, and release hardening.

## Decisions That Must Not Regress

### One application window

- Package Studio always opens inside the existing DataTeX window.
- No native secondary windows, detachable panels, pop-out editors, or wizard
  windows are introduced.
- A complete workflow must not depend on a modal dialog. Package details,
  configuration forms, code diffs, preview results, and diagnostics live in the
  Package Studio route and its panes.
- Small UI controls such as select menus, tooltips, and color pickers may render
  as normal in-app overlays, but they do not become separate workflows or
  operating-system windows.

### Rust first, TypeScript second

- Package discovery, parsing, dependency analysis, validation, edit planning,
  code generation, persistence, and long-running jobs belong in Rust.
- TypeScript/React owns presentation, accessibility, keyboard interaction,
  viewport interaction, and short-lived form state.
- React must not parse an entire LaTeX document, rebuild package dependency
  graphs, or generate final source on every render.
- Domain types exposed to TypeScript are generated or validated from versioned
  Rust DTOs; the project must not maintain two large hand-written copies of the
  same AST.

### Performance is a product requirement

- Editor typing and pointer movement never wait for package analysis or preview
  compilation.
- Background responses carry document/session revisions, and stale responses are
  discarded.
- Catalog lists are paginated or virtualized.
- Exact LaTeX previews are cancellable and cached.
- Instant visual previews update locally where appropriate, then synchronize a
  structured action to Rust.

### Package Studio is larger than a sidebar

- The sidebar is a contextual launcher and compact status surface.
- The full tool is a central workspace comparable to the Bibliography workspace.
- A user can deliberately show the editor beside a builder when useful, but a
  package builder is never forced into the narrow PDF/metadata sidebar.

## Existing Baseline

The current implementation already contains useful foundations:

- `src-tauri/src/commands/ctan.rs` embeds the CTAN catalog in the Rust binary,
  initializes it once, precomputes a lowercase search index, and returns
  paginated lightweight rows.
- `src/services/packageService.ts` provides a frontend adapter over the Rust
  commands.
- `src/components/tools/PackageBrowser.tsx` supports catalog search, topics,
  pagination, package details, multi-selection, and insertion.
- `src/components/wizards/preamble/wizardRegistry.ts` maps a small set of
  packages to dedicated or embedded wizards.
- Existing wizards cover layout, math, tables, colors, graphics, code listings,
  and headers to different degrees.
- `src-tauri/src/compiler.rs` already has a `CompilationManager` with tracked
  jobs, cancellation, timeout handling, and process-tree termination.
- `src/App.tsx` and `src/components/layout/Sidebar.tsx` already demonstrate the
  activity-bar/full-workspace pattern through the Bibliography manager.

The baseline also exposes the reasons for the redesign:

- Package catalog, local wizard metadata, and package configuration are separate
  concepts with overlapping UIs.
- Package Browser and the wizards are routed through a growing conditional block
  in `App.tsx`.
- The current Package Browser is rendered in the right-side tool area, leaving
  too little room for complex builders and live previews.
- The legacy sidebar reads the small synchronous `PACKAGES_DB`, while the main
  browser reads the Rust CTAN catalog.
- Final LaTeX generation is spread across large TSX components and TypeScript
  generator files.
- The richer `CTANPackage` interface in `src/services/packageService.ts` does not
  exactly match the smaller Rust DTO in `src-tauri/src/types/ctan.rs`.
- Direct string insertion does not provide a structured diff, conflict
  detection, duplicate handling, or a reliable insertion target.
- Wizard state, current-document package state, and reusable presets do not share
  one persistence model.
- Package navigation and the `Ctrl+Shift+P` shortcut are partly hard-coded even
  though the settings store already contains configurable shortcut data.
- Compiler selection is split between settings, toolbar state, compile-hook
  local storage, and resource metadata. BibTeX/Biber can appear beside primary
  LaTeX engines even though they are bibliography processors, not primary
  engines.

## Goals

- Give package discovery, current-document dependencies, interactive builders,
  and diagnostics one coherent workspace.
- Let users configure and generate package code visually while always being able
  to inspect the resulting LaTeX.
- Apply package/body edits safely to unsaved Monaco models with one-step undo.
- Keep broad CTAN metadata separate from curated, tested builder definitions.
- Treat tracked custom `.sty` files as first-class resources without confusing
  them with catalog or installed packages.
- Reuse the existing Bibliography, compiler, resource, and database domains
  through explicit contracts rather than duplicating them.

## Non-Goals

- Installing or updating system TeX packages in the MVP.
- Treating every CTAN package as if DataTeX has a tested visual builder for it.
- Replacing the TeX distribution's own dependency resolver.
- Parsing or rewriting arbitrary LaTeX through fragile regular expressions.
- Writing the active editor file directly from a Rust Tauri command.
- Owning bibliography entries, sources, or citation state inside Package Studio.
- Opening builders or catalog workflows in a second application window.

## Product Scope

Package Studio consists of seven related capabilities that share infrastructure
without being collapsed into one screen.

### 1. Catalog

- Search and browse the CTAN-derived catalog.
- Filter by topic, installed status, wizard availability, favorites, recent use,
  compatibility, or current-document relevance.
- Show package purpose, current catalog version, links, dependencies,
  conflicts, required engine, and available builders.
- Compare closely related packages.
- Add one or multiple packages to the active document through a reviewed edit
  plan.

### 2. Current document

- Detect `\usepackage`, `\RequirePackage`, document class options, TikZ
  libraries, PGFPlots compatibility settings, and other package setup commands.
- Preserve source order, comments, conditional blocks, and custom formatting.
- Show duplicates, conflicting options, missing requirements, deprecated
  packages, engine constraints, and unused declarations.
- Merge options safely or let the user choose a conflict resolution.
- Navigate from a package row to its declaration in Monaco.
- Remove or change a package through a previewable edit plan.

### 3. Builders

- Configure supported packages with forms, presets, and live previews.
- Clearly separate preamble code from body code.
- Show generated code and package requirements before insertion.
- Insert at the preamble, cursor, current environment, selected range, or a new
  file depending on the builder contract.
- Keep structured builder state so a generated object can be reopened and
  edited.

### 4. Presets and templates

- Save package option sets and builder outputs as reusable presets.
- Support app, collection, project, and document scopes.
- Allow clone, rename, tag, import, export, and version migration.
- Ship curated built-in presets without mixing them with user data.

### 5. Diagnostics

- Detect packages referenced by commands but not loaded.
- Detect missing TeX packages, engine mismatches, incompatible options, and
  common order-sensitive combinations.
- Explain each diagnostic and offer a safe fix as an edit plan.
- Surface compile diagnostics in the relevant builder without blocking the
  editor.

### 6. TeX distribution integration

- Read installed-package state through approved platform adapters.
- Detect TeX Live, MiKTeX, and MacTeX capabilities.
- Show version drift between the embedded catalog and the local distribution.
- Keep package installation/update as an explicit later capability with a clear
  command preview and user confirmation.
- Never execute arbitrary catalog text as a shell command.

### 7. Custom package resources

- Distinguish a CTAN catalog entry, a package installed in the local TeX
  distribution, and a tracked DataTeX `.sty` resource.
- Create, import, edit, tag, and search custom `.sty` files through the existing
  resource/database model.
- Detect packages/commands required by a custom package without claiming complete
  TeX macro expansion.
- Link custom package resources to documents and surface missing/moved-file
  diagnostics.
- Reindex on file changes and preserve resource history.
- Never repurpose the existing `resource_packages` schema for CTAN catalog state;
  new catalog types/tables use explicit `package_catalog` naming.

## Single-Window UI/UX

### Activity bar behavior

The existing package/gallery activity becomes a first-class **Packages** item:

- Clicking a different activity opens its sidebar section.
- Clicking Packages while another activity is active switches to Packages.
- Clicking Packages a second time closes the left sidebar, matching Database and
  Bibliography.
- Entering the full Package Studio keeps the Packages activity selected.
- Returning to the editor restores the user's previous view and editor/database
  layout; it must not be hard-coded to return to Database.
- Package, Database, Bibliography, file tree, and other sidebar sections are
  mutually exclusive; their content must not remain stacked behind one another.

### Compact Packages sidebar

The sidebar is intentionally limited to high-value context:

- Current document package count and diagnostic summary.
- Search field with quick package add.
- Recently used and favorite builders.
- Missing-package and option-conflict warnings.
- “Open Package Studio” primary action.
- Progress for a running preview or distribution check.

It must not contain the complete catalog, a large configuration wizard, or an
interactive graphics canvas.

The editor's document action row may expose a contextual Packages action for the
active `.tex` resource. It opens the same Package Studio route; it is not a
second implementation.

### Full Package Studio workspace

The workspace uses the central application area and has its own internal
navigation:

1. **Overview** — current-document health, recent builders, presets, and tasks.
2. **Document** — loaded packages, options, dependencies, diagnostics, and edit
   plans.
3. **Catalog** — searchable/virtualized package catalog and details inspector.
4. **Builders** — package-oriented configuration tools.
5. **Graphics** — entry point to the dedicated graphics workbench.
6. **Presets** — saved configurations and generated objects.
7. **Distribution** — installed-package and engine diagnostics.
8. **Custom packages** — tracked `.sty` resources and their document links.

Recommended desktop layout:

```text
┌──────────────── Package Studio toolbar / breadcrumbs ────────────────┐
│ Library/navigation │ Main catalog or builder │ Details/preview       │
│                    │                         │ inspector              │
│                    │                         │                        │
├────────────────────┴─────────────────────────┴────────────────────────┤
│ Collapsible diagnostics / edit-plan diff / task output               │
└───────────────────────────────────────────────────────────────────────┘
```

All panes use the existing smooth `ResizerHandle` behavior. Resize interaction
updates cheap CSS dimensions per animation frame; expensive preview/layout work
is deferred until pointer-up when possible.

### Workspace modes

- **Focus mode** is the default: Package Studio receives the full central area.
- **Editor split mode** embeds Monaco and the active builder in the same central
  route. The split is user-controlled and remembered.
- **Compact mode** replaces the details inspector with an in-route tab on narrow
  widths.
- None of these modes creates another application window.

### Builder UX contract

Every builder follows the same predictable structure:

- Header: package/family, status, preset selector, reset, and documentation.
- Left: categorized controls with search and sensible defaults.
- Center: live visual or semantic preview.
- Right: requirements, generated code tabs, source target, and warnings.
- Bottom: structured diff and one explicit Apply/Insert action.

Changes remain a draft until the user applies them. Repeated Apply actions are
idempotent or clearly describe what will be duplicated.

## Rust-First Architecture

### Proposed backend layout

Initially place the Tauri-facing module under
`src-tauri/src/package_studio/`. Extract the domain into an internal crate once
the boundaries stabilize so it can be tested without Tauri.

```text
src-tauri/src/package_studio/
├── mod.rs
├── catalog.rs
├── document/
│   ├── analyzer.rs
│   ├── declarations.rs
│   ├── dependencies.rs
│   └── diagnostics.rs
├── edits/
│   ├── plan.rs
│   ├── apply.rs
│   └── targets.rs
├── builders/
│   ├── registry.rs
│   ├── schema.rs
│   ├── generator.rs
│   └── preview.rs
├── presets/
│   ├── model.rs
│   ├── repository.rs
│   └── migrations.rs
├── distribution/
│   ├── detect.rs
│   ├── texlive.rs
│   ├── miktex.rs
│   └── diagnostics.rs
├── custom_packages/
│   ├── analyzer.rs
│   ├── links.rs
│   └── diagnostics.rs
└── commands.rs
```

Graphics domain modules are defined in the separate graphics plan and should be
consumed through a stable Package Studio builder interface.

### Core Rust models

`PackageDescriptor`

- Stable package/family ID.
- Catalog metadata and installed status.
- Supported engines and platforms.
- Known dependencies, conflicts, and order constraints.
- Builder capabilities and documentation references.

The broad catalog is the merge of:

- A CTAN snapshot for searchable fallback metadata.
- Curated, versioned Rust-side manifests for tested options, dependencies,
  conflicts, load order, engines, recipes, examples, and builders.
- Local availability obtained from the detected TeX distribution.
- Tracked custom `.sty` resources obtained from the existing resource database.

The UI labels these sources explicitly. “In catalog”, “installed”, “tracked
custom package”, and “builder available” are not interchangeable states.

`DocumentPackageModel`

- Document revision and normalized path.
- Package declarations with source spans and original text.
- Effective options and declaration origin.
- Requirements inferred from known commands/environments.
- Dependency graph and diagnostics.

`BuilderDefinition`

- Versioned builder ID and package family.
- Input schema, defaults, validation rules, preview modes, and output targets.
- Required packages/libraries/engine.
- Generator version used to migrate saved presets.

`PackageEditPlan`

- Base document revision/hash.
- Ordered edits with exact source ranges.
- Human-readable summary and warnings.
- Required preconditions.
- Before/after snippets or unified diff.
- Stable idempotency key.
- Byte ranges plus exact Monaco-compatible UTF-16 line/column positions computed
  against the base content.

`PreviewJob`

- Job/session/revision IDs.
- Fast or exact preview kind.
- Cancellation token and cache key.
- Result assets and structured diagnostics.

### Command boundary

Prefer coarse, revisioned commands over per-control IPC:

- `package_studio_query_catalog`
- `package_studio_get_package`
- `package_studio_analyze_document`
- `package_studio_create_edit_plan`
- `package_studio_validate_edit_plan`
- `package_studio_list_builders`
- `package_studio_validate_builder`
- `package_studio_generate_builder_output`
- `package_studio_start_preview`
- `package_studio_cancel_preview`
- `package_studio_list_presets`
- `package_studio_save_preset`
- `package_studio_detect_distribution`

Builder forms update locally. Validation/generation is debounced or explicitly
requested, not invoked for every React render.

Rust creates and validates edit plans but does not write the active editor file.
The frontend verifies the Monaco model revision and applies the returned edits
with `executeEdits`, so dirty state, selection, and undo/redo remain correct.

### Generated frontend contracts

Before the domain expands:

- Select a Rust-to-TypeScript binding approach such as Specta or `ts-rs` through
  a small spike.
- Check generated DTOs into a deterministic location or generate them in CI.
- Add a test that fails when Rust serialization and frontend contracts diverge.
- Version scene, builder, preset, and edit-plan payloads independently.

### Persistence

Use SQLite for searchable and relational state:

- Package favorites and recent use.
- Builder/preset metadata and version.
- Project/document package snapshots.
- Diagnostic suppression with scope and reason.
- Installed-distribution scan cache.

Large preview artifacts remain in the application cache with size/age eviction.
Portable user presets export as versioned JSON. Package declarations always stay
in the `.tex` source as the authoritative document state.

Existing `resource_packages` data remains owned by custom `.sty` resource
metadata. Package Catalog persistence must use names such as
`package_catalog_*`, `package_recipe_*`, and `package_preset_*`.

## Safe Source Editing

Direct string concatenation is replaced by Rust edit plans:

1. Analyze the active document and record its revision/hash.
2. Resolve the intended target: preamble, cursor, selection, environment, or
   auxiliary file.
3. Detect an existing declaration and merge compatible options.
4. Preserve comments and user formatting whenever the edit does not require a
   rewrite.
5. Return a diff and diagnostics without changing the document.
6. Validate that the base revision still matches the current Monaco model.
7. Apply the edits in the frontend with `executeEdits` as one undo operation.
8. Save only through the existing editor/save workflow.

If the document changed, Rust returns a stale-plan result and the UI regenerates
the diff. It must never silently apply a range computed against old content.
Rust never bypasses an unsaved Monaco model by writing directly to disk.

## Build Profile And Bibliography Boundaries

Package recipes can require compiler capabilities, but they do not own the
compiler or bibliography domains.

Define one effective `BuildProfile`:

- Primary LaTeX engine.
- Bibliography processor: automatic, none, BibTeX, or Biber.
- Shell-escape policy.
- SyncTeX and relevant output settings.
- Source and precedence of each value.

Precedence should be explicit: one-shot toolbar override, resource/document
metadata, then global defaults. BibTeX and Biber are never offered as primary
LaTeX engines.

Examples:

- A `minted` recipe reports that shell escape may be required and deep-links to
  the relevant setting; it does not enable it silently.
- A `biblatex` recipe produces only reviewed TeX edits and a post-save effect.
  After the existing save succeeds, DataTeX invokes the existing bibliography
  declaration detection/auto-link/scan flow exactly once.
- Package Studio never stores or mutates bibliography sources, entries, tags,
  notes, or workspace filters.

Global Package Studio preferences may receive their own Settings category
(default insertion target, preview-before-apply, validation level). Per-document
builder drafts remain in the workspace/document state, not global settings.

## Builder Platform

Package-specific tools share a common host but can supply custom controls and
preview adapters.

### Declarative builders

Use a Rust schema for packages whose behavior is primarily options and short code
templates:

- `geometry`
- `fancyhdr`
- `xcolor`
- `enumitem`
- `siunitx`
- `listings`
- `minted`
- `hyperref`
- common math package groups

The schema defines fields, validation, conditional visibility, required
packages, target location, and generation templates. React renders the standard
controls.

### Specialized builders

Complex domains can register a custom workbench while preserving the same
session, edit-plan, preset, diagnostics, and preview contracts:

- Tables and `tabularray`
- Page/document layout
- Graphics families
- Future chemical notation, music, diagrams, or domain-specific packages

Graphics packages are not implemented as many unrelated giant wizards. They use
the shared graphics scene and package adapters described in the graphics plan.

## Preview Strategy

Use the least expensive preview that answers the user's action:

1. **Semantic preview** — pure structured representation for dependency changes.
2. **Instant preview** — local HTML/SVG/CSS rendering for responsive controls.
3. **Exact preview** — Rust-managed LaTeX compilation for final fidelity.

Exact previews reuse the existing DataTeX `CompilationManager` behavior:

- One active job per preview session.
- Cancel superseded jobs and their process trees.
- Ignore stale revisions.
- Cache by source, engine, builder version, package requirements, and relevant
  settings.
- Return diagnostics separately from preview assets.

The graphics instant/exact preview split is detailed in the graphics plan.

## Performance Budgets

Budgets are measured on a representative release build and documented test
machine:

- Warm Package Studio route activation: target under 100 ms to first useful UI.
- Catalog query: target under 50 ms in Rust and under 100 ms through UI at p95.
- Sidebar open/close and pane resize: target 60 FPS with no compilation or
  document parse on the pointer path.
- Builder control-to-instant-preview latency: target under 100 ms for ordinary
  declarative builders.
- Document package analysis: debounced, cancellable, and never on the editor
  keystroke call stack.
- Catalog and preset tables: stable scrolling at 60 FPS with virtualization when
  the row count requires it.
- Exact preview: no fixed compile-time promise, but visible progress, immediate
  cancellation, cache hits, and no UI blocking are required.

Add instrumentation for route activation, Rust command duration, IPC payload
size, React commit time, preview latency, cancellation, and cache hit rate.

## Implementation Roadmap

### Phase 0: Baseline Contracts

- [x] Add regression tests for current CTAN search, topics, pagination, and
  package lookup.
- [ ] Add UI tests for existing Package Browser selection and insertion.
- [x] Inventory every existing wizard, generator, input, output target, and
  package requirement.
- [ ] Freeze representative generated-code fixtures before moving generation to
  Rust. In progress: first preamble, geometry, and code-highlighting fixtures
  are captured under `src-tauri/src/package_studio/fixtures/`.
- [x] Define versioned `PackageEditPlan` and package diagnostics DTOs.
- [x] Add a minimal Rust document-package analyzer with regression tests.
- [x] Add a first safe add-package edit plan command that returns source ranges
  without mutating the active editor file.
- [ ] Define builder DTOs. In progress: shared structured builder output DTOs
  are implemented for `geometry` and `code-highlighting`; a Rust builder
  registry now exposes descriptors for available builders.
- [ ] Select and test Rust-to-TypeScript type generation.
- [ ] Define the naming boundary among catalog packages, installed packages, and
  tracked custom `.sty` resources.
- [ ] Define one build-profile precedence model and keep BibTeX/Biber separate
  from primary LaTeX engines.
- [ ] Introduce focused frontend tests or an equivalent testable pure adapter
  layer, because the main app currently lacks Stoicheia's Vitest coverage.
- [ ] Record navigation and render performance baselines.

Done when: existing behavior is measurable and future refactors can prove that
they did not lose supported workflows.

### Phase 1: Workspace Shell And Navigation

- [ ] Rename the package/gallery activity to Packages without breaking saved
  shortcuts.
- [x] Match Database/Bibliography toggle behavior exactly.
- [x] Add lazy-loaded `PackageStudioWorkspace`.
- [x] Add compact Packages sidebar and remove the legacy package list from it.
- [ ] Add internal workspace navigation and persistent layout state.
- [ ] Implement focus, editor split, and compact in-route modes.
- [x] Ensure Database, Bibliography, Packages, and file-tree sidebar content are
  mutually exclusive.
- [ ] Add error boundary and lightweight loading skeletons per workspace pane.
- [ ] Route Header, Start Page, sidebar, shortcut, and editor contextual actions
  through one navigation action.
- [ ] Consume the configured Packages shortcut instead of a hard-coded key
  listener.

Done when: the user can enter, leave, toggle, resize, and restore Package Studio
without losing editor state or opening another window.

### Phase 2: Rust Document Analysis And Edit Plans

- [x] Implement tolerant preamble/package declaration analysis with source spans.
- [x] Detect package options, duplicate declarations, TikZ libraries, and
  PGFPlots compatibility settings.
- [ ] Add package requirement/conflict/order diagnostics.
- [x] Implement previewable, revision-safe edit plans.
- [x] Apply an edit as one Monaco undo operation.
- [x] Keep Rust commands read/plan/validate only; apply to the unsaved Monaco
  model in the frontend.
- [x] Add active-document status and jump-to-source actions for package
  declarations and diagnostics.
- [x] Consolidate document status, requirements, output targets, enabled
  capabilities, and diagnostics into a compact builder-side summary.
- [x] Add a first review-before-apply surface for `PackageEditPlan`, including
  source snippets, apply/dismiss actions, jump-to-edit actions, and stale-source
  protection.
- [x] Add a first remove-package edit plan and route it through the same review
  path, preserving other packages in multi-package declarations.
- [x] Add a first change-options flow for detected builder packages, routed
  through the same review path and existing Rust update planner.
- [x] Add first package relationship diagnostics for `color`/`xcolor`,
  `subfigure`/`subcaption`, obsolete `epsfig`, `hyperref` late-loading, and
  `cleveref` ordering.
- [x] Add first actionable diagnostic fixes: remove obsolete/conflicting package
  declarations and move `hyperref`/`cleveref` with reviewable edit plans.
- [x] Replace plain review source snippets with a first inline diff view that
  highlights added and removed lines.
- [ ] Add tests for comments, conditionals, unusual formatting, duplicate
  options, stale plans, and malformed documents.

Done when: package declarations can be added, changed, merged, or removed safely
without raw string concatenation.

### Phase 3: Catalog And Document Workspace

- [ ] Move the existing CTAN catalog into the Package Studio Catalog section.
- [ ] Preserve Rust indexing and lightweight pagination.
- [ ] Add virtualized rows, installed/favorite/wizard filters, and package
  comparison.
- [ ] Add the current-document package/dependency view.
- [ ] Connect catalog actions to Rust edit plans.
- [ ] Add document navigation and actionable diagnostics.
- [ ] Label catalog, installed, tracked custom, and builder-available states
  independently.

Done when: catalog discovery and current-document dependency management feel
like one coherent workflow.

### Phase 4: Generic Builder Platform

- [ ] Implement the Rust builder registry and schema.
- [x] Add first option metadata catalog in the Rust builder registry. Flag
  options render as compact switches; dimension, color, and choice metadata is
  attached as contextual help to the real form controls instead of duplicated
  information cards.
- [x] Add a first schema-driven control renderer for reusable package options:
  flags, choices, dimensions, key/value values, color values, and exclusive
  groups now share one compact UI path. `xcolor` driver options use the
  exclusive-group schema, `geometry` dimensions carry unit/default metadata, and
  `minted` style exposes schema choices.
- [ ] Implement shared form, validation, code, diff, preview, and apply panes.
  The shared activation bar and atomic apply/remove lifecycle are complete;
  builder-wide generated forms and validation-summary panes remain. A first
  Package Studio smoke test now protects sidebar builder switching, single
  builder-navigation ownership, enumitem command wiring, active-source import,
  and enumitem label presets.
- [ ] Implement preset serialization and builder-version migrations.
- [ ] Migrate final generation from TypeScript into Rust one builder at a time.
- [ ] Keep visual-only form calculations local when they do not define final
  output.

Done when: a new declarative builder can be added primarily through a Rust
definition and focused tests.

### Phase 5: Non-Graphics Builders

- [x] Migrate `geometry` and document layout first.
- [x] Migrate `fancyhdr`.
- [x] Migrate `xcolor` and color profiles.
- [ ] Migrate `enumitem` (partial). First Rust-backed builder, package
  activation, inline option, global spacing/label settings, custom list
  creation, import of existing unmanaged `\setlist`/`\newlist` declarations,
  richer preset chips, preview, and generated setup block are in place.
  First smoke tests are in place. Remaining: running-app polish and richer
  interaction tests if/when a UI test runner is added.
- [ ] Migrate `siunitx` (partial). First Rust-backed builder, package
  activation, body snippets for `\num`, `\unit`, `\qty`, `\qtylist`, and
  `\qtyrange`, setup generation for `\sisetup`, number-format controls, unit
  component controls, presets, generated-code preview, and active-document
  import for existing setup/body snippets are in place. A broader searchable
  unit catalog, more practical compound presets, and first builder diagnostics
  are also in place. The active-document importer now flags legacy v2-style
  commands and version-sensitive options, and the panel has a lightweight live
  preview plus compact running-app status for common body/setup snippets.
  Remaining: manual validation with larger representative siunitx-heavy
  documents.
- [x] Migrate `listings` and `minted`.
- [ ] Consolidate table builders without losing supported output.
- [ ] Migrate math-package configuration (partial). `amsmath`/`mathtools` now
  have a first Rust-backed Math builder for body snippets: environments,
  matrices, starred matrix alignment, extensible arrows, brackets/braces,
  split fractions, prescripts, paired-delimiter declarations, and equation
  tag-form snippets (`\newtagform`, `\usetagform`, `\refeq`, `\noeqref`), plus
  first active-document import for supported environments, matrices, mathtools
  tools, and tag snippets. Imported math snippets now keep source ranges and can
  be replaced through the shared review/diff panel. The Math panel also lists
  multiple detected snippets from the active document so the user can choose
  which one to edit. A first KaTeX-backed instant preview now renders common
  math environments, matrices, mathtools snippets, delimiter usage samples, and
  tag samples without invoking a TeX compile. Delimited math snippets
  (`\( ... \)`, `\[ ... \]`, `$ ... $`, `$$ ... $$`) are now detected,
  source-range tracked, editable, and regenerated without forcing them into
  environments. The Math panel has a first polish pass with grouped controls,
  explicit draft/import status, import empty state, and a cleaner preview/source
  action rail. A follow-up hardening slice adds `aligned`/`split` import
  coverage, `\eqref`, more mathtools harpoon/long-equality arrows, and
  KaTeX-safe preview normalization for mathtools commands that KaTeX does not
  render exactly. Remaining: larger-document running-app validation.

Done when: the most useful existing non-graphics wizards run inside the common
host and generate validated Rust-owned output.

### Phase 6: Graphics Workbench

- [ ] Follow the milestones in
  [Graphics Package Studio Plan](graphics-package-studio-plan.md).
- [ ] Register graphics families through the common builder/session interface.
- [ ] Share Package Studio navigation, presets, diagnostics, and safe insertion.
- [ ] Keep the graphics canvas implementation modular and lazy-loaded.

Current graphics integration progress: the copy-first workbench and host-owned
document/file bridge are in place. Exact previews now reuse DataTeX's single
`CompilationManager`; unique frontend jobs cancel on supersede/unmount and the
verified Linux runner reaps LaTeX/`dvisvgm` process groups on stop or timeout.
DataTeX now centrally configures/discovers `dvisvgm`, executes the canonical
resolved binary, and invalidates exact-preview cache entries when either tool
identity changes. Native release-OS process-tree/exact-preview smoke tests and
concurrent instant-preview responsiveness are the next hardening gate. The
portable smoke harness passes on Linux and now runs before each native
Windows/Linux/Intel-Mac/Apple-Silicon build and draft-release upload. The
release workflow conflict is resolved with the matching `tauri-action@v0`
contract; the cross-OS gate closes when all four jobs are green.

Done when: graphics tools feel native to Package Studio while retaining their
own high-performance workbench.

### Phase 7: Presets, Templates, And Custom Packages

- [ ] Add built-in, user, collection, project, and document scopes.
- [ ] Add search, tags, clone, rename, import, and export.
- [ ] Add preset previews and required-package summaries.
- [ ] Add deterministic migration and recovery for older preset versions.
- [ ] Allow a document template to compose multiple package presets.
- [ ] Add create/import/edit/search workflows for tracked `.sty` resources.
- [ ] Add file-watch reindexing, history, document links, and missing-path
  diagnostics for custom packages.
- [ ] Keep existing typed metadata and `resource_packages` migration-compatible.

Done when: users can build and reuse consistent package systems, and custom
`.sty` resources remain linked, searchable, and portable without copying source
manually.

### Phase 8: Distribution Integration

- [ ] Detect TeX Live/MacTeX/MiKTeX and relevant executables.
- [ ] Query installed packages and versions in cancellable Rust background jobs.
- [ ] Cache scans and provide a manual refresh.
- [ ] Add missing-package and engine diagnostics.
- [ ] Design an explicit, reviewed package-install/update workflow.
- [ ] Validate Windows, Linux, Intel macOS, and Apple Silicon behavior.

Done when: DataTeX can explain whether a document's required packages are
available on the current machine and guide the user safely.

Actual install/update actions remain a separately approved enhancement after the
read-only diagnostics layer is proven on every supported platform.

### Phase 9: Cleanup And Release Hardening

- [ ] Remove legacy right-panel Package Browser routing.
- [ ] Remove obsolete `PACKAGES_DB` reads after all consumers use the unified
  registry.
- [ ] Remove migrated TypeScript generators and duplicated types.
- [ ] Remove mismatched hand-written CTAN DTOs after generated contracts are in
  use.
- [ ] Add recovery, migration, accessibility, keyboard, and localization tests.
- [ ] Add large-catalog, large-document, preview cancellation, and resize
  benchmarks.
- [ ] Run packaging tests on every supported OS/architecture.
- [ ] Update user and developer documentation.

Done when: there is one supported Package Studio architecture and no second
hidden manager is loaded alongside it.

## Testing Strategy

### Rust

- Unit tests for catalog indexing, tolerant parsing, dependency graphs,
  diagnostics, schemas, generation, and edit application.
- Golden tests for existing wizard output.
- Property/fuzz tests for malformed option lists and source edits.
- Revision/cancellation/cache tests for background jobs.
- Cross-platform distribution command construction tests.

### Frontend

- Activity/sidebar toggle and route restoration tests.
- Builder keyboard/accessibility tests.
- Render-count and resize interaction tests.
- Virtualized list selection and focus tests.
- Stale response and error-boundary tests.
- One editor undo step per applied edit-plan test.

### End to end

- Open document, detect packages, change an option, review diff, apply, undo,
  compile, close, and reopen.
- Add a catalog package that already exists with different options.
- Recover from a compile error without losing builder state.
- Switch rapidly between documents/builders while analysis and preview jobs run.
- Run representative workflows on Windows, Linux, Intel macOS, and Apple
  Silicon.
- Add a `biblatex` recipe, save, and verify the existing bibliography auto-link
  and citation scan execute once without resetting bibliography workspace state.
- Link a tracked `.sty` resource and verify catalog/search state does not overwrite
  its typed metadata.

## Release Gates

- No new native or detachable window.
- No package/preview work on the editor or resize hot path.
- No final source mutation without a revision-safe edit plan.
- No Rust command writes through an unsaved Monaco model.
- No second compilation process manager.
- No hand-maintained large duplicate Rust/TypeScript domain model.
- No removal of a legacy wizard before its fixtures and critical workflows pass.
- No graphics source/assets copied from Stoicheia until provenance and licensing
  are documented.
- No reuse of bibliography tables or `resource_packages` for catalog persistence.
- All supported platforms pass the package, compile, and migration smoke tests.

## Immediate Next Implementation Step

Current next slice before broad builder expansion:

1. Extend diagnostics to builder-specific missing requirements and more package
   families.
2. Harden the first `siunitx` slice in the running app, then continue with its
   active-document import and richer unit/option catalog before moving to the
   next math-package configuration builder.
