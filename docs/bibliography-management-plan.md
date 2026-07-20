# Bibliography Management Plan

This document tracks the implementation plan for a full bibliography system inside DataTex. The goal is to support `.bib` files as first-class resources, link bibliography sources and individual citations to LaTeX files/documents, and gradually evolve toward a Zotero/KBibTeX-style workflow without compromising editor or PDF performance.

## Current Status

- [~] Phase 0: parser/schema spike
- [x] Phase 1: bibliography core storage and import
- [x] Phase 2: ResourceInspector, editor integration, and compilation pipeline
- [x] Phase 3: full Bibliography workspace
- [x] Phase 4: interoperability and online metadata
- [~] Phase 5: advanced research features

## Design Principles

- `.bib` files stay visible and portable. SQLite stores an indexed, structured mirror for search, linking, validation, and fast UI.
- Entry identity uses stable UUIDs. Citation keys are editable names, not permanent identity.
- BibLaTeX + Biber is the preferred modern path. BibTeX remains supported for legacy projects.
- CSL is useful for UI previews and exports, but LaTeX output should preserve BibTeX/BibLaTeX semantics.
- Parsing, indexing, validation, and import/export run in Rust/background tasks, not on the editor render path.
- UI must be dense, clean, and professional: fast lists, virtualized tables, contextual side panels, no noisy workflow interruptions.

## Target User Workflows

1. Add one or more `.bib` files to a collection.
2. Parse and index all entries from each `.bib` file.
3. See bibliography for the currently open resource inside `ResourceInspector`.
4. Link bibliography sources or specific entries to a LaTeX file, fragment, exercise, or full document.
5. Insert citations from the editor with autocomplete and filtering.
6. Rename citation keys safely and update affected LaTeX references.
7. Compile documents with Biber/BibTeX pipeline support.
8. Search all bibliography entries globally by author, title, year, tag, collection, source file, DOI, ISBN, URL, or citation key.
9. Edit entries through a structured form while preserving raw BibLaTeX fields.
10. Export selected entries, source files, documents, or whole collections back to `.bib`.

## Data Model

The current project has overlapping bibliography concepts that should be replaced gradually:

- Legacy citation-key table in `init.sql`
- One-entry-per-resource metadata in `resource_bibliographies`
- File/document bibliography junctions tied directly to citation keys

The new model should be append-only at first and coexist with legacy data until migration is verified.

### Proposed Core Tables

`bib_sources`

- Stable source id
- Resource id when the source comes from a tracked `.bib` file
- Path/content hash
- Source kind: file, imported, generated, remote
- Last parsed timestamp
- Parse status and diagnostics

`bib_entries`

- Stable entry UUID
- Source id
- Entry type: article, book, inproceedings, online, thesis, misc, etc.
- Current citation key
- Title, year, date, abstract, doi, isbn, issn, url
- Raw BibLaTeX body
- Normalized JSON representation for fields that do not fit fixed columns
- Created/updated timestamps

`bib_entry_names`

- Structured creators: author, editor, translator, organization, etc.
- Ordered name parts: family, given, prefix, suffix
- Search-normalized value

`bib_entry_aliases`

- Old citation keys
- Rename history
- Collision handling
- Optional compatibility aliases for imported projects

`resource_bib_sources`

- Links a resource/document/file to one or more bibliography source files.
- Supports both fragments and full documents.

`resource_citations`

- Links a resource/document/file to specific bibliography entries.
- Used for curated citation sets, not just source file inclusion.

`citation_occurrences`

- Detected citations in LaTeX content.
- Stores command name, citation key, range, resource id, document id, and parser diagnostics.

`bib_entry_fts`

- SQLite FTS5 search index for author/title/year/key/abstract/tags/notes.

`bib_history`

- Optional audit log for edits, imports, source sync, rename operations, and conflict resolution.

## Parser Strategy

The first technical decision is the parser. The implementation should be validated with a corpus before committing the full UI.

Candidates:

- `biblatex`/BibTeX parser crate if available and healthy enough for round-trip needs.
- Hayagriva for structured bibliography representation and CSL-style rendering experiments.
- A small Rust parser wrapper only if existing libraries cannot preserve enough BibLaTeX fidelity.

Required parser behavior:

- Multi-entry `.bib` files.
- BibLaTeX entry types and fields.
- Comments, preambles, string macros, escaped braces, nested braces, and LaTeX commands inside fields.
- Useful diagnostics with source ranges.
- Preservation of unknown/custom fields.
- Round-trip export that does not destroy user data.

## ResourceInspector Integration

The existing bibliography tab should become contextual:

- For a `.tex` file: show linked bibliography sources, detected citations, missing keys, unused linked entries, and quick insert/search actions.
- For a `.bib` file: show all parsed entries, parse status, diagnostics, and edit/import/export controls.
- For a complete document: show merged bibliography from direct document links plus included fragments.

Expected controls:

- Add/link `.bib` source
- Link selected entries
- Unlink source/entry
- Open entry editor
- Insert citation into editor
- Rename citation key
- Refresh/reparse source
- Export linked bibliography

## Dedicated Bibliography Workspace

After the contextual tab works, add a full workspace with a three-pane layout:

- Left: collections, source files, tags, smart filters
- Center: virtualized entry table/list
- Right: structured entry editor, preview, diagnostics, notes

Useful views:

- All entries
- By source file
- By collection
- Missing metadata
- Duplicate candidates
- Broken links
- Recently edited
- Used in current document
- Unused in current document

## Editor Features

- Citation autocomplete for `\cite`, `\parencite`, `\textcite`, `\autocite`, `\nocite`, and related BibLaTeX commands.
- Multi-citation insertion.
- Hover preview for citation keys.
- Go to bibliography entry.
- Diagnostics for missing citation keys and unused linked sources.
- Safe citation-key rename across selected scope.
- Optional code actions: create missing entry, link source, replace key, open entry.

## Compilation Pipeline

The compile system should support:

- LaTeX -> Biber -> LaTeX -> LaTeX
- LaTeX -> BibTeX -> LaTeX -> LaTeX
- Prefer `latexmk` where available.
- Manual compiler selection in settings.
- Per-document bibliography engine setting.
- Diagnostics surfaced back into the editor/resource inspector.

## Import And Export

Phase 1 import/export:

- `.bib` / BibLaTeX
- `.bib` / legacy BibTeX

Later:

- RIS
- CSL JSON
- EndNote XML
- PubMed/Medline
- DOI lookup through Crossref/DataCite
- ORCID lookup
- Zotero import/export or API sync

## Performance Requirements

- Parse/index work must run outside React render loops.
- Large entry lists must be virtualized and paginated.
- Search should use SQLite FTS5.
- Editor autocomplete should query a compact indexed cache.
- File watching should debounce reparses.
- Writes should be transactional and atomic.
- UI should avoid per-keystroke Tauri IPC for structured entry forms.

## Migration Plan

1. Add new tables in a new migration, for example `016_bibliography_core.sql`.
2. Keep legacy tables readable during transition.
3. Backfill existing one-entry `.bib` metadata into `bib_sources` and `bib_entries`.
4. Build read APIs that prefer new tables and fall back to legacy data.
5. After UI and tests are stable, remove old write paths.
6. Remove old tables only after a backup/export path exists.

## Implementation Roadmap

### Phase 0: Parser And Schema Spike

- [x] Start with an internal Rust parser spike that preserves raw entries and reports diagnostics.
- [x] Add a read-only Tauri preview command for parsing `.bib` content.
- [x] Add parser tests covering BibTeX, BibLaTeX, nested braces, math, comments, strings, Unicode, and invalid input.
- [x] Add append-only core schema migration for sources, entries, names, aliases, links, and citation occurrences.
- [ ] Add round-trip export tests.
- [ ] Add source-range diagnostics for individual malformed fields.
- [ ] Decide whether to keep improving the internal parser or replace it with a dedicated bibliography crate after corpus testing.

Done when: a multi-entry `.bib` file can be parsed into structured entries with diagnostics and exported without losing important fields.

### Phase 1: Core Storage

- [x] Add `bib_sources`, `bib_entries`, names, aliases, links, and occurrence tables.
- [x] Add Rust service and commands for reparsing a `.bib` resource into core tables.
- [x] Add Rust service and command for listing parsed entries for a `.bib` resource.
- [x] Add search, update, and export commands.
- [x] Add FTS and history tables after confirming SQLite feature support and UI requirements.
- [x] Add file watcher/debounced reparse for tracked `.bib` resources.
- [x] Backfill existing bibliography metadata.

Done when: `.bib` files in collections become searchable structured bibliography sources.

### Phase 2: ResourceInspector And Editor

- [x] Replace placeholder bibliography tab with contextual bibliography UI.
- [x] Show linked sources and detected citations for current resource.
- [x] Scan LaTeX resource citations and store resolved/missing/ambiguous occurrences.
- [x] Resolve citation keys through linked `.bib` sources when links exist.
- [x] Detect `\bibliography{...}` / `\addbibresource{...}` declarations and auto-link unambiguous `.bib` sources.
- [x] Show parsed entry list for `.bib` resources.
- [x] Add citation autocomplete and hover preview.
- [x] Add missing-key diagnostics.
- [x] Add compile pipeline support for Biber/BibTeX.

Done when: a user can link `.bib` sources to a document, insert citations, compile, close/reopen, and see the same bibliography state restored.

### Phase 3: Bibliography Workspace

- [x] Add global bibliography workspace.
- [x] Add advanced filters, tags, smart views, and duplicate detection.
- [x] Add structured editor with raw BibLaTeX fallback.
- [x] Add batch edit and batch export.

Done when: DataTex can manage bibliography libraries comfortably without leaving the app.

### Phase 4: Interoperability

- [x] Add RIS/CSL JSON/EndNote/PubMed import.
- [x] Add Crossref/DataCite DOI lookup.
- [x] Add Zotero import/export or optional API sync.
- [x] Add citation style preview through CSL.

Done when: common external bibliography workflows can move in and out of DataTex cleanly.

### Phase 5: Advanced Research Layer

- [x] Notes per bibliography entry.
- [x] Attach PDFs to entries.
- [x] Link PDF annotations to bibliography entries.
- [x] Citation graph and "used by" views.
- [x] Team/federated collection strategy.
- [ ] Optional AI-assisted metadata cleanup.

Done when: the bibliography system becomes a research-management layer, not only a citation database.

## Immediate Next Step

Start with Phase 0 in branch `Bibliography_manager`:

1. Inspect available Rust bibliography parser crates and choose one for the spike.
2. Add fixture files and parser tests.
3. Add the first internal Rust module for parsing `.bib` content.
4. Validate parser behavior before wiring the UI.
