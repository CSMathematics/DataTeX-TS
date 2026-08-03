# Stoicheia Frontend Source Manifest

This directory is the copy-first frontend baseline for embedding the locally
owned Stoicheia project in DataTeX.

Migration baseline:

- DataTeX branch: `stoicheia-copy-first`.
- Stoicheia version: `1.2.2`.
- Imported on: `2026-07-28`.
- Source root: `Stoicheia project/src`.
- Reuse authorization: the project owner approved incorporating Stoicheia
  under the existing DataTeX license.

## Imported baseline

- 109 TypeScript, TSX, and CSS files retain their original relative paths.
- `assets/stoicheia-logo.svg` is copied from
  `Stoicheia project/public/stoicheia-logo.svg`.
- 77 source files formed the original Phase 3 byte-for-byte core.
- 32 source files were identified as copy-first host boundaries for Phase 4.
- The logo becomes a feature-local import when the embedded header is adapted.

The immutable SHA-256 baseline for all 110 copied files remains stored in
`SOURCE_MANIFEST.sha256`. It records provenance; it is not rewritten after host
adaptation.

Phase 4 adapted the original 31 runtime/test boundary files (the scoped CSS is
generated without changing `App.css`) plus four lifecycle hook/test files
needed to suppress embedded autosave and invalidate in-flight work on unmount,
plus `components/ToolGroup.tsx` so floating tool menus stay within the embedded
workspace, with the matching assertion in `components/Toolbar.test.tsx`
updated for the container-relative limit. The remaining 73 baseline files are
still byte-for-byte copies.

The per-file source hash, destination mapping, changed-hunk rationale, related
test, and temporary/permanent status are recorded in
[`PHASE4_ADAPTATION_LEDGER.md`](PHASE4_ADAPTATION_LEDGER.md).

Verify both the explicit adaptation allowlist and every unchanged file with:

```bash
pnpm run check:stoicheia:copy
```

## Intentionally omitted

- `.Rhistory`
- `main.tsx`
- `vite-env.d.ts`
- `assets/react.svg`
- `assets/pgfplots.pdf`
- `assets/tkz-elements.pdf`
- `assets/tkz-euclide.pdf`

`main.tsx` is omitted because DataTeX owns the single React root. The PDF
manuals and template asset are not runtime dependencies.

## Mounting boundary

`App.css` remains the copied Tailwind source and is never imported globally.
The build script compiles and scopes it into
`styles/stoicheia.embedded.css`, which is imported only by the lazy
`bridge/StoicheiaPackageStudioAdapter.tsx`. The adapted app shell and its
temporary portal root both carry `.stoicheia-scope`.
