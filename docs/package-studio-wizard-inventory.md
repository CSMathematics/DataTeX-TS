# Package Studio Wizard Inventory

This inventory freezes the current package/wizard surface before the Package
Studio migration. It records what exists today, which packages it touches, where
code is generated, and what needs golden fixtures before generation moves from
React/TypeScript to Rust.

Last updated: 2026-07-20

## Feature Parity Audit - 2026-07-21

This section is the migration checklist for Package Studio. A new builder should
not replace or hide an existing wizard until every relevant item below is either
implemented, deliberately moved to another workbench, or marked obsolete with a
reason.

### `xcolor`

Legacy sources:

- `src/components/wizards/preamble/tabs/ColorsTab.tsx`
- `src/components/wizards/preamble/generators/preambleGenerators.ts`

Legacy user-facing capabilities:

- Package load toggle.
- Option discovery through grouped multi-select:
  - named palettes: `dvipsnames`, `svgnames`, `x11names`;
  - features/target models: `table`, `cmyk`, `monochrome`, `natural`,
    `fixpdftex`;
  - drivers: `pdftex`, `xetex`, `luatex`, `dvips`, `xdvi`, `dvipdfmx`,
    `dvisvgm`.
- Color definition modes:
  - picker mode with target model conversion;
  - manual CMYK sliders;
  - mixer/alias mode using `\colorlet`-style color expressions;
  - usage snippets for `\textcolor`, `\colorbox`, `\fcolorbox`,
    `\pagecolor`, and `\rowcolor`.
- Color models exposed in the UI: `HTML`, `rgb`, `RGB`, `cmy`, `cmyk`, `hsb`,
  `HSB`, `gray`, `Gray`.
- Defined-color list with preview and removal.

Important legacy bug/behavior to improve:

- The old `ColorsTab` stores selected `xcolorOptions` in config, but
  `generatePackages()` ignores them and always emits
  `\usepackage[dvipsnames, table]{xcolor}` when xcolor is needed. Package
  Studio should preserve the richer UI while actually applying the selected
  options through edit plans.

Current Package Studio parity:

- Implemented: package option metadata for every legacy group, atomic
  package/options/setup application, custom `\definecolor` generation, strict
  Rust validation for every legacy color model, picker-to-model conversion,
  accurate previews with readable contrast, simple add/edit/duplicate/delete
  palette management, `\colorlet` mixes/aliases, mutually-exclusive drivers,
  snippets for `\textcolor`, `\colorbox`, `\fcolorbox`, `\pagecolor`, and
  `\rowcolor`, and import of existing unmanaged `\definecolor` declarations and
  common `\colorlet` aliases/mixes into the builder draft.
- The dedicated legacy CMYK slider mode is deliberately replaced by the common
  visual picker plus editable CMYK component values. This preserves easy
  selection and exact numeric control without a second color-creation flow.
- The `rowcolor` flow automatically selects the required `table` option and
  reminds the user to apply the reviewed package configuration.
- Status: current legacy feature parity is complete. Future work is richer
  import for advanced `\colorlet` expressions with more than one mix segment.

### `geometry`

Legacy sources:

- `src/components/wizards/preamble/tabs/LayoutTab.tsx`
- `src/components/wizards/preamble/generators/preambleGenerators.ts`

Legacy capabilities:

- Package load toggle.
- Columns: one/two, `columnsep`.
- Sidedness: `oneside`, `twoside`, `asymmetric`.
- Margins: `top`, `bottom`, `left`, `right`.
- Header/footer dimensions and options: `headheight`, `headsep`, `footskip`,
  `includehead`, `includefoot`.
- Print/offset options: `bindingoffset`, `hoffset`, `voffset`.
- Margin notes: `marginparsep`, `marginparwidth`, `includemp`.

Current Package Studio parity:

- Implemented: Rust generation, live page sketch, safe package requirement edit
  plans, option metadata hints for supported dimensions and flags, import of
  active-document geometry options, shorthand `margin=...`, and explicit
  document-class `oneside`/`twoside` detection. `twoside` is shown in the UI as
  document-class state and is deliberately not emitted as a geometry package
  option; only `asymmetric` becomes a geometry package option.
- Remaining: richer import for non-centimeter units and page-size options.

### `listings` / `minted`

Legacy sources:

- `src/components/wizards/preamble/tabs/CodeHighlightingTab.tsx`
- `src/components/wizards/preamble/generators/preambleGenerators.ts`
- `src/components/wizards/preamble/LanguageDb.ts`

Legacy capabilities:

- Engine selection: none/listings/minted.
- Language selection with compatibility filtering:
  - listings languages;
  - minted-only languages.
- Common options: line numbers, frame/border, break lines.
- Listings colors: keyword, string, comment, background.
- Minted style list: `default`, `friendly`, `colorful`, `autumn`, `murphy`,
  `manni`, `monokai`, `perldoc`, `pastie`, `borland`, `trac`, `native`,
  `fruity`, `bw`, `vim`, `vs`, `tango`.
- Minted shell-escape warning.

Current Package Studio parity:

- Implemented: Rust generation for listings/minted, common options, listings
  colors, minted styles, shell-escape warning, option metadata cards,
  language-selection UI, listings-compatible filtering, minted-only languages,
  Rust-backed language-aware `lstlisting`/`minted` body snippet insertion, and
  import of existing unmanaged `\lstdefinestyle`, `\lstset`,
  `\usemintedstyle`, and `\setminted` declarations into the builder draft.
- Remaining: import of listings color definitions and custom style names beyond
  the common boolean/style options.

### `fancyhdr`

Legacy source: `src/components/wizards/FancyhdrWizard.tsx`

Legacy capabilities:

- Presets: Book Standard, Thesis Style, Article Simple, Report Format.
- Document type: one-sided/two-sided.
- Package options: `headtopline`, `footbotline`, custom options.
- Header/footer rule widths.
- Odd/even header/footer fields for two-sided documents and single set for
  one-sided documents.
- Quick-copy commands: `\thepage`, `\leftmark`, `\rightmark`, `\today`,
  `\@author`, `\@title`.
- Code/visual preview with zoom.

Current Package Studio parity:

- Implemented: Rust generation, visual preview, one/two-sided fields, rule
  widths, `headtopline`/`footbotline`/`nocheck` option metadata, built-in
  presets, quick insert command chips, code/visual preview switch, preview zoom,
  custom package options as an explicit advanced section, and import of existing
  unmanaged `\pagestyle`, `\fancyhf`, `\fancyhead`, `\fancyfoot`, and
  rule-width declarations from the active document.
- Remaining: richer import for less common legacy syntaxes such as
  `\renewcommand\headrulewidth{...}` without braces around the command name.

### `enumitem`

Legacy sources:

- `src/components/wizards/preamble/tabs/ListsTab.tsx`
- `src/components/wizards/preamble/generators/preambleGenerators.ts`

Legacy capabilities:

- Package load toggle and `[inline]` option.
- Global itemize/enumerate settings.
- Custom list creator with base type `enumerate`, `itemize`, `description`,
  plus inline `enumerate*`/`itemize*`.
- Label presets and custom labels.
- Layout/spacing options: `nosep`, `noitemsep`, `wide=0pt`, `leftmargin=*`.
- Label styling: bold, italic, align left/parleft/default.
- Enumerate logic: resume numbering, start value.
- Live code preview and active custom-list list with removal.

Migration note: this is the strongest next non-graphics candidate after the
current builders because it is option-heavy and demonstrates reusable
checkbox/select metadata well.

Current Package Studio parity:

- Implemented: Rust generation, package activation with `[inline]`, global
  spacing, global itemize/enumerate label settings, custom list creation for
  `enumerate`, `itemize`, `description`, inline `enumerate*`/`itemize*`, label
  patterns, spacing/layout options, bold/italic label styling, alignment,
  resume/start numbering, import of existing unmanaged `\setlist` and
  `\newlist` declarations from the active document, label preset chips, live
  draft preview, active custom-list removal, and reviewable setup block.
- First smoke coverage: `pnpm run test:package-studio` checks Package Studio
  builder switching, single sidebar-owned navigation, enumitem Rust/Tauri/TS/UI
  wiring, active-source import, and label preset wiring.
- Remaining: running-app polish and richer interaction tests if/when a UI test
  runner is added.

### `graphicx`

Legacy source: `src/components/wizards/GraphicxWizard.tsx`

Legacy capabilities:

- File picker for `png`, `jpg`, `jpeg`, `pdf`, `eps`.
- `\includegraphics` options: width, height, keepaspectratio, scale, angle.
- Units: `\textwidth`, `\linewidth`, `cm`, `mm`, `in`, `pt`,
  `\textheight`.
- Optional `figure` wrapper with centering, caption, label, placement
  (`h`, `t`, `b`, `p`, `ht`, `!ht`).
- Path quoting for spaces.

Migration note: split into package requirement (`graphicx`) plus body snippet
builder for `\includegraphics`/`figure`.

Current Package Studio parity:

- Implemented: Rust generation, package requirement for `graphicx`, body snippet
  insertion at the editor cursor, native image/PDF/EPS/SVG file picker,
  file-path entry with space quoting, width/height units, `keepaspectratio`,
  `scale`, `angle`, optional `figure` wrapper, centering, caption, label,
  placement, generated-code preview, lightweight visual sketch, and
  active-document import for the first existing `figure`/`\includegraphics`
  snippet.
- Remaining: source-range-aware replacement of the imported snippet instead of
  inserting a new snippet at the cursor.

### Tables: `tabularray`, standard `tabular`, `booktabs`

Legacy sources:

- `src/components/wizards/UnifiedTableWizard.tsx`
- `src/components/wizards/TableWizard.tsx`
- `src/components/wizards/TabularrayWizard.tsx`

Legacy capabilities:

- Grid editor with row/column add/delete, active cell, drag selection.
- Merge/split cells with row/column span.
- Cell text, bold, italic, horizontal alignment.
- Tabularray-specific foreground/background colors.
- Modes: `tabularray`, standard LaTeX, `booktabs`.
- Tabularray options: `tblr`/`longtblr`, caption, label, `hlines`, `vlines`,
  `colspec`, `cell{r}{c}` properties, `X`/`Q` columns.
- Standard/booktabs options: center table, vertical/horizontal rules,
  `\multicolumn`, `\multirow`, `\toprule`, `\midrule`, `\bottomrule`.

Migration note: too stateful for the generic option-card surface alone; should
be a dedicated table workbench backed by Rust generation and structured package
requirements (`tabularray`, `booktabs`, `multirow`, `xcolor`, `caption` or
`capt-of`).

Current Package Studio parity:

- Implemented: first Rust-backed Table Workbench, registry/Tauri/TS/UI wiring,
  `standard`, `booktabs`, and `tabularray` modes, editable row/column grid,
  row/column count controls, column alignment controls, horizontal/vertical
  rule switches, optional `table` float, centering, placement, caption, label,
  generated-code preview, instant sketch preview, cursor insertion, reviewed
  package requirements for `booktabs`/`tabularray`, active-cell tracking, and
  per-cell bold/italic/alignment controls backed by Rust code generation,
  spreadsheet-style mouse drag range selection, merge/split cells,
  editor/preview grid spans, standard/booktabs `\multicolumn`, `multirow`
  package requirements, `tabularray` span specs, and a consolidated in-grid
  toolbar for mode, sizing, add/remove, rules, float placement, column
  alignment, cell formatting, selected-cell text/background colors, active
  row/column background colors, clear styling, merge, and split controls. Color
  output is backed by Rust generation with an `xcolor[table]` requirement,
  `\cellcolor`/`\textcolor` for standard/booktabs tables, and named
  `tabularray` `bg`/`fg` cell specs. Row/column insert/remove now targets the
  active cell position instead of the table end, and structural edits reset span
  metadata when needed to keep merged-cell grids valid. CSV/TSV paste import is
  now available directly inside the workbench, including tab-separated
  spreadsheet data and semicolon-delimited CSV. The first richer `tabularray`
  cell-property slice adds selected-cell vertical alignment (`valign=t/m/b`) to
  the toolbar, preview, and Rust `cell{r}{c}` specs. Bold/italic styling now
  emits native `tabularray` cell `font={...}` specs instead of content wrappers.
  Weighted `X`/`Q` columns are now supported from the active-column toolbar and
  generate `X[...]`/`Q[...]` colspec entries. `longtblr` edge cases now surface
  warnings for label-without-caption and ignored floating/placement/centering
  controls.
- Remaining: additional `tabularray` styling properties beyond
  alignment/color/font/weighted columns, import/edit of existing table source
  ranges, and exact compile/PDF preview.

### Math: `amsmath` / `mathtools`

Legacy source: `src/components/wizards/MathWizard.tsx`

Legacy capabilities:

- Environments: `equation`, `align`, `gather`, `gathered`, `lgathered`,
  `rgathered`, `multline`, `flalign`, `cases`, `dcases`, `rcases`.
- Starred environment variants and optional labels.
- Matrices: `pmatrix`, `bmatrix`, `Bmatrix`, `vmatrix`, `Vmatrix`, `matrix`,
  `smallmatrix`; starred matrix variants with column alignment.
- Mathtools arrows: `xrightarrow`, `xleftarrow`, `xleftrightarrow`,
  `xRightarrow`, `xLeftarrow`, `xLeftrightarrow`, `xmapsto`,
  `xhookleftarrow`, `xhookrightarrow`.
- Brackets/braces: `underbracket`, `overbracket`, `underbrace`, `overbrace`
  with optional thickness/height.
- Misc: `\prescript`, `\splitfrac`, `\splitdfrac`,
  `\DeclarePairedDelimiter`.
- Tags: `\newtagform`, `\usetagform`, `\refeq`, `\noeqref`.

Migration note: package setup belongs to Package Studio, but most of this is a
body-snippet/math workbench. Generated snippets must return package
requirements (`amsmath`, `mathtools`) alongside body code.

Current Package Studio parity:

- First Rust-backed builder registered as `math`.
- Body insertion snippets for common `amsmath` environments including
  `equation`, `align`, `gather`, `multline`, `flalign`, and cases-style
  environments.
- Matrix builder for `matrix`, `pmatrix`, `bmatrix`, `Bmatrix`, `vmatrix`,
  `Vmatrix`, and `smallmatrix`, including first starred matrix alignment
  support through `mathtools`.
- First `mathtools` snippets for extensible arrows, brackets/braces,
  `\splitfrac`/`\splitdfrac`, `\prescript`, and
  `\DeclarePairedDelimiter`.
- Tag-form snippets for `\newtagform`, `\usetagform`, `\refeq`, and
  `\noeqref`.
- Rust-owned package requirements choose `amsmath` for standard snippets and
  `mathtools` when enhanced environments/tools are used.
- First diagnostics cover labels ignored by starred environments and incomplete
  paired-delimiter declarations, plus empty tag-form names/references.
- Active-document import now hydrates the first supported math environment,
  matrix, paired delimiter, arrow, bracket/brace, split fraction, prescript, or
  tag-form snippet into the builder draft.
- Imported snippets keep their source range, so the user can review and replace
  the original snippet through the shared Package Studio diff/apply panel
  instead of inserting a duplicate at the cursor.
- The Math panel now lists multiple detected math snippets from the active
  document with kind, line, label, and compact preview, letting the user choose
  which one hydrates the builder draft.
- A first KaTeX-backed live preview renders environments, matrices, arrows,
  brackets/braces, split fractions, prescripts, delimiter usage samples, and tag
  samples instantly, with normalized previews for constructs that are semantic
  or not directly visual.
- Delimited math snippets are now first-class: `\( ... \)`, `\[ ... \]`,
  `$ ... $`, and `$$ ... $$` are detected from the active document, imported
  with source ranges, editable in the Math panel, and regenerated with the same
  inline/display delimiter family instead of being forced into an environment.
- First running-app UI polish groups the Math form into clear builder controls,
  import discovery, live preview, and source/action cards, with explicit draft
  vs imported state and an empty import state for files without supported math
  snippets.
- Small hardening pass imports `aligned` and `split` environments, recognizes
  `\eqref`, exposes additional mathtools harpoon/long-equality arrows, and
  normalizes unsupported mathtools preview expressions into KaTeX-safe samples
  while preserving the generated source.

Remaining migration work:

- Running-app polish after testing larger representative math documents.
- Optional future MathJax/TeX-compile fallback if exact preview compatibility
  becomes more important than instant feedback for niche macros.

### `siunitx`

Legacy source: `src/components/wizards/SiunitxWizard.tsx`

Legacy capabilities:

- Snippets for `\num`, `\unit`, `\qty`, `\qtylist`, `\qtyrange`.
- Number options: exponent mode (`scientific`, `engineering`, `fixed`) and
  rounding (`places`, `figures`, `uncertainty`) with precision.
- Unit builder with prefixes, units, powers, and `\per`.
- Setup generation through `\sisetup`:
  - `per-mode`;
  - `inter-unit-product`;
  - `range-phrase`.

Migration note: needs both a preamble setup builder and body snippet builders.

Current Package Studio parity:

- First Rust-backed builder registered as `siunitx`.
- Reviewable `siunitx` package requirement and `\sisetup` generated setup block.
- Body insertion snippets for `\num`, `\unit`, `\qty`, `\qtylist`, and
  `\qtyrange`.
- UI controls for snippet mode, exponent mode, rounding mode/precision,
  `per-mode`, unit product, range phrase, prefixes, units, powers, and `\per`.
- Searchable prefix/unit catalog covering full SI decimal prefixes, SI base
  units, common derived units, accepted non-SI units, information units, and
  labels with symbols/categories for discovery.
- Preset unit chips for common SI/math-document quantities and practical
  compound quantities such as electric field, concentration, and data rate.
- Active-document import for existing `\sisetup`, `\num`, `\unit`, `\qty`,
  `\qtylist`, and `\qtyrange` commands, including compound units such as
  `\kilo\meter\per\second\squared`.
- First Rust diagnostics for empty number snippets, quantity lists with fewer
  than two values, incomplete ranges, ignored uncertainty precision, and
  suspicious prefixes on special/non-SI units.
- Compatibility warnings from active-document import for legacy v2-style
  commands such as `\SI`, `\si`, `\SIlist`, `\SIrange`, and version-sensitive
  options such as `binary-units`, `detect-all`, and `separate-uncertainty`.
- Lightweight live preview for numbers, quantities, ranges, lists, setup
  options, compound units, active number-format options, and warning counts.
- Running-app polish adds a compact status strip, clearer snippet/setup target,
  diagnostic count, and a less ambiguous "New siunitx snippet" reset action.

Remaining migration work:

- Manual validation with larger representative siunitx-heavy documents.

### `pstricks`

Legacy source: `src/components/wizards/PstricksWizard.tsx`

Legacy capabilities:

- Package options: `noxcolor`, `plain`, custom package options.
- Global `\psset`: `unit`, `linewidth`, `linecolor`, `fillstyle`,
  `fillcolor`, custom `\psset` additions.
- Snippet buttons for common PSTricks commands.

Migration note: belongs to the separate graphics Package Studio plan/workbench.

### `tikz` / `pgfplots`

Legacy sources:

- `src/components/wizards/TikzWizard.tsx`
- `src/components/wizards/TikzPgfPlotsWizard.tsx`
- `src/components/wizards/tikzTemplates.ts`
- Local Stoicheia project audit in `docs/graphics-package-studio-plan.md`.

Legacy capabilities:

- Interactive scene editing, selection, style controls, shape/plot parameters,
  generated TikZ/PGFPlots code, templates, and preview-like SVG surfaces.

Migration note: this must not be squeezed into the generic package option UI.
It needs the dedicated graphics workbench architecture, Rust scene IR, and a
careful Stoicheia feature audit.

## Registry Snapshot

Source: `src/components/wizards/preamble/wizardRegistry.ts`

| Package | Category | Current surface | Notes |
| --- | --- | --- | --- |
| `xcolor` | colors | Embedded `PackageGallery` | Generates `\usepackage[...]{xcolor}`, `\definecolor`, `\colorlet`. |
| `geometry` | layout | `PreambleWizard` | Full document/preamble generator includes page layout preview. |
| `fancyhdr` | layout | `FancyhdrWizard` | Dedicated header/footer builder with visual preview. |
| `enumitem` | layout | Embedded `PackageGallery`, `PreambleWizard` | Generates package declaration, global list settings, custom lists. |
| `tikz` | graphics | `TikzWizard`, embedded `TikzPgfPlotsWizard` | Large visual authoring surface; belongs to Graphics workbench. |
| `pstricks` | graphics | `PstricksWizard`, embedded `PackageGallery` | Snippet-oriented now; belongs to Graphics workbench later. |
| `graphicx` | graphics | `GraphicxWizard` | Generates `\includegraphics` and optional figure wrapper. |
| `tabularray` | tables | `TabularrayWizard`, embedded `PackageGallery` | Generates `tblr`/`longtblr` with cell specs. |
| `listings` | code | `PreambleWizard`, gallery code card | Generates preamble config through code-highlighting generator. |
| `minted` | code | `PreambleWizard`, gallery code card | Requires shell-escape/build-profile diagnostics. |
| `amsmath` | math | `MathWizard`, `PreambleWizard` | Body math snippets and preamble package groups. |
| `mathtools` | math | `MathWizard` | Body math snippets; should include package requirement handling. |
| `siunitx` | math | `SiunitxWizard`, embedded `PackageGallery` | Generates `\num`, `\unit`, `\qty`, lists, ranges. |

## Current Generators

| File | Generator / behavior | Output target today | Package requirements |
| --- | --- | --- | --- |
| `preamble/generators/preambleGenerators.ts` | `generateFullPreamble` | Whole document with preamble/body skeleton | Many, including `inputenc`, `fontenc`, `babel`, `geometry`, `amsmath`, `graphicx`, `xcolor`, table packages, `tikz`, `pgfplots`, `fancyhdr`, `listings`, `minted`, `natbib`, `biblatex`, `hyperref`, `cleveref`. |
| `preamble/generators/preambleGenerators.ts` | `generateGeometry` | Preamble package declaration | `geometry`. |
| `preamble/generators/preambleGenerators.ts` | `generatePackages` | Preamble package block | Core package toggles and custom colors. |
| `preamble/generators/preambleGenerators.ts` | `generateLists` | Preamble setup block | `enumitem`. |
| `preamble/generators/preambleGenerators.ts` | `generateCodeHighlighting` | Preamble setup block | `listings`/`minted`, `xcolor` for listings. |
| `preamble/generators/preambleGenerators.ts` | `generateBibliography` | Preamble + bibliography commands | `natbib` or `biblatex`; must delegate data/linking to Bibliography manager. |
| `GraphicxWizard.tsx` | local `generateCode` | Body snippet | `graphicx`; optional `figure` environment. |
| `FancyhdrWizard.tsx` | effect-generated code | Preamble/page-style block | `fancyhdr`. |
| `TableWizard.tsx` | local `generateCode` | Body table environment | `xcolor`, `multirow`, optional `booktabs`. |
| `TabularrayWizard.tsx` | local `generateCode` | Body table environment | `tabularray`, optional color support. |
| `UnifiedTableWizard.tsx` | `generateTabularrayCode`, `generateStandardCode` | Body table environment | `tabularray`, `booktabs`, `multirow`, `caption`/`capt-of` assumptions. |
| `TikzWizard.tsx` | local scene-to-code | Body TikZ/PGFPlots snippet | `tikz`, `pgfplots` depending mode. |
| `TikzPgfPlotsWizard.tsx` | local scene-to-code | Body TikZ/PGFPlots snippet | `tikz`, `pgfplots`. |
| `PstricksWizard.tsx` | package setup + snippet buttons | Preamble setup or body snippets | `pstricks` and common PSTricks commands. |
| `SiunitxWizard.tsx` | option/unit builders | Body math/unit snippets | `siunitx`. |
| `MathWizard.tsx` | math environment/snippet builders | Body math snippets | `amsmath`, `mathtools` depending snippet. |
| `PackageBrowser.tsx` | selected package insertion | Preamble package declarations | Raw `\usepackage{...}` lines. |
| `PackageGallery.tsx` | selected package insertion and embedded generators | Mixed preamble/body | Registry packages plus embedded special cases. |

## Migration Classification

| Group | Move first? | Rust responsibility | Frontend responsibility |
| --- | --- | --- | --- |
| Package add/search/catalog | Yes | Analyze declarations, produce edit plans, validate duplicates/options. | Apply Monaco edits, present diff/status. |
| Geometry/preamble options | Yes | Generate validated preamble blocks and package requirements. | Page preview controls and draft state. |
| Code highlighting | Yes | Generate `listings`/`minted` setup and build-profile diagnostics. | Color/style controls. |
| Bibliography package setup | Yes, but carefully | Generate TeX edits only. | Trigger existing bibliography scan after save. |
| Graphicx/figure | Medium | Generate figure/includegraphics output and requirements. | File picker, dimension controls, preview. |
| Tables | Medium | Generate table source and requirements from structured grid state. | Grid editing, selection, resize, keyboard UX. |
| Math snippets | Medium | Generate selected snippet from a schema. | Symbol/category UX and inline preview. |
| TikZ/PGFPlots/PSTricks | Separate graphics plan | Scene IR, validation, package adapters, source generation. | Smooth canvas, pan/zoom/drag, local preview. |

## Golden Fixture Needs

Create fixture cases before migrating each generator:

| Fixture family | Required cases |
| --- | --- |
| Preamble full document | default article, Greek language, two-column/twoside, non-default fonts, hyperref colors, bibliography BibTeX, bibliography Biber. |
| Geometry | simple margins, two-column column separation, margin notes, header/footer inclusion, offsets, binding offset. |
| Package toggles | math bundle, table bundle, graphics bundle, custom colors, `pgfplots` compat. |
| Lists | enumitem inline, global spacing, itemize label variants, enumerate variants, custom lists. |
| Code highlighting | listings colors/options, minted style/options, no engine. |
| Graphicx | plain includegraphics, width/height/scale/angle, quoted path, figure with caption/label. |
| Fancyhdr | one-sided header/footer, two-sided header/footer, custom package options, rule toggles. |
| Tables | standard table, booktabs, colored cells, multirow/multicolumn, tabularray `tblr`, tabularray `longtblr`. |
| Math | equation/align/gather, matrices, arrows, brackets, split fractions, tags. |
| Siunitx | `\num`, `\unit`, `\qty`, lists, ranges, uncertainty, rounding modes. |
| Graphics | handled in `graphics-package-studio-plan.md`; fixtures should be shared with Stoicheia after provenance is recorded. |

## Known Risks To Preserve

- `PackageBrowser` and `PackageGallery` currently insert raw text directly; the
  Package Studio replacement must use edit plans and one Monaco undo step.
- `PreambleWizard` can generate an entire document, not just a package block.
  The new system must distinguish whole-document templates from package edits.
- `minted` requires shell-escape diagnostics and must not silently change compile
  settings.
- BibTeX/Biber configuration is not a primary LaTeX engine. The Package Studio
  builder can generate TeX declarations but must not own bibliography entries or
  sources.
- Table generators currently infer package requirements in comments or UI state.
  The Rust builder output should return structured requirements instead.
- Graphics wizards are too large for the generic builder migration and should
  enter through the separate Graphics workbench architecture.
- Several current generators are inside React components; extract golden outputs
  before changing them so UI refactors cannot alter source generation unnoticed.

## Next Fixture Step

Create `src-tauri/src/package_studio/fixtures/` or a dedicated Rust test module
with representative expected outputs for the non-graphics generators. Start with
the preamble/geometry/code-highlighting families because they are the first
builders likely to move from TypeScript generation to Rust.
