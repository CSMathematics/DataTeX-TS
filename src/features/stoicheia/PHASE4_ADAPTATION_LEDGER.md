# Stoicheia Phase 4 Adaptation Ledger

This is the auditable exception list for the copy-first frontend baseline.
Every path below maps from:

```text
Stoicheia project/src/<path>
```

to:

```text
src/features/stoicheia/<path>
```

The SHA-256 values are the immutable source hashes recorded in
`SOURCE_MANIFEST.sha256`. `pnpm run check:stoicheia:copy` verifies that these
are the only baseline files allowed to differ and that the other 73 files
remain byte-identical.

## Embedded application boundary

| Path | Source SHA-256 | Adaptation and reason | Regression coverage | Lifetime |
|---|---|---|---|---|
| `App.tsx` | `9268cc6f30dc3efae948f92c7c7a28f929d1fbb766335563d0f55298b3f6efe2` | Embedded host contract; container measurements; scoped shortcuts/theme/language; host compiler and `dvisvgm` settings; duplicate autosave suppression; document Apply/Save/Save As/exact-SVG callbacks; drag/listener cleanup. | `App.test.tsx`, resize tests, pipeline/autosave tests, Package Studio integration test. | Permanent host and document-action boundary. |
| `components/AppHeader.tsx` | `63cd67071354c7fb9b6a820b3866c96c4aaa4f9159b7311673ada1510033f945` | Preserve standalone menus while replacing native file ownership in embedded mode with host Apply/Save/Save As/exact-SVG callbacks; scope shortcuts; require a fresh exact render for export; use local logo. | `components/AppHeader.test.tsx` | Permanent host file/action boundary. |
| `components/AppHeader.test.tsx` | `271fb30e5daf16389ba06a8555c0e5a940708014a1000888293a3b785210461d` | Adds embedded-host, shortcut-scope, latest-source Save/Save As, and fresh exact-SVG callback regressions without removing standalone coverage. | Self | Permanent migration regression. |
| `components/Preview.tsx` | `64a5e5f2fbd338ffa58c692dd7f27ce7565a875d5bce914f640b03dcad541ba5` | Scope canvas keyboard handling and guarantee pointer, cursor, animation-frame, and window-listener cleanup. | `components/Preview.test.tsx` | Permanent single-window interaction boundary. |
| `components/Preview.test.tsx` | `a8c8c912f475a5670f7529298e9a6f0bfcabf4cdbc57ea0fdf4f67b18a6864e1` | Adds focused/unfocused shortcut and drag/unmount cleanup regressions. | Self | Permanent migration regression. |
| `components/SettingsPage.tsx` | `afda85fae4313700c08b3ede88c5a5a956f106997797ea730e6fc1069839c3f2` | Delegate host-owned theme, language, TeX engine, and autosave controls to DataTeX while retaining Stoicheia-local canvas/editor/export settings. | `components/SettingsPage.test.tsx` | Permanent ownership boundary. |
| `components/SettingsPage.test.tsx` | `97bbacc72bf3056480aa0794027727a04b772a724cf5ac15e2bf2d35e8d03c07` | Adds embedded ownership/reset regressions while retaining standalone tests. | Self | Permanent migration regression. |
| `components/ToolGroup.tsx` | `5f05c3a61a4c8bc0d6b2132d1ee2dc8f2ef22b3b1f9485e318c4cff7866c208a` | Constrain fixed tool menus to the nearest embedded `.stoicheia-scope`, observe workspace resizing, and retain a standalone viewport fallback. | `components/ToolGroup.test.tsx` | Permanent embedded layout boundary. |
| `components/Toolbar.test.tsx` | `de67e9df0e9a64e05dacf79eac43814bc47f84daa91f145f90dba1bd78b51b5c` | Replace the obsolete `100vh` menu assertion with a regression that rejects viewport-unit sizing. | Self, `components/ToolGroup.test.tsx` | Permanent migration regression. |

## Embedded lifecycle exceptions

These four source/test files were originally classified as verbatim copies.
Phase 4 found that an embedded app must be able to disable its independent
autosave and ignore late asynchronous results after unmount, so they are now
explicit adapter exceptions.

| Path | Source SHA-256 | Adaptation and reason | Regression coverage | Lifetime |
|---|---|---|---|---|
| `hooks/useAutosaveDraft.ts` | `ee7c7702288d9a9339dffcc78a9fd622b33ba9b1b99174729b111d3ccd554b27` | Add an `enabled` boundary so DataTeX remains the only embedded autosave owner. | `hooks/useAutosaveDraft.test.tsx` | Permanent reusable hook contract. |
| `hooks/useAutosaveDraft.test.tsx` | `05bea50913272f33a057f76a873cc0416d8b8a9e4be6b1519842cba9df6f35fb` | Proves disabled mode neither restores nor subscribes/writes. | Self | Permanent migration regression. |
| `hooks/useDocumentPipeline.ts` | `5b1d81e458f7d49f0226f978e14893cf13d5157674181ea8cdd19f96e52b59bd` | Accept host compiler/engine/`dvisvgm` overrides, attach a unique DataTeX compilation ID to each exact render, cancel the active native process on supersede/mode/tool change/unmount, and retain stale-result ownership guards. | `hooks/useDocumentPipeline.test.tsx`, Rust tracked-runner tests | Permanent host/runtime and process-cancellation boundary. |
| `hooks/useDocumentPipeline.test.tsx` | `13690381283e14f7848c3b33739ca6e36be09d8b16e00312781118be74da1626` | Proves compiler and `dvisvgm` forwarding, unique job IDs, stop-on-supersede/tool-change/unmount, debounce-without-stop, stop-error isolation, and rejection of late parse/compile results. | Self | Permanent migration regression. |

## Scoped portal destinations

For every dialog below, the only production change is importing
`getScopedPortalTarget()` and replacing the `document.body` portal destination.
JSX, validation, callbacks, and tool behavior remain copied. The shared target
is created and removed by `StoicheiaPackageStudioAdapter`; its lifecycle and
fallback are covered by `bridge/scopedPortal.test.ts` and
`bridge/StoicheiaPackageStudioAdapter.test.tsx`. These are permanent
single-window CSS/focus boundary changes.

| Path | Source SHA-256 |
|---|---|
| `components/AdvancedPointDialog.tsx` | `377654f96d52c4669fbe1bc3da885be0d8ece562c391eab94550075140f90a4a` |
| `components/AngleValueDialog.tsx` | `29aaf4655c79f4c5199772a684b0e69d20aff4abadbf1b77d508e8154b062c0e` |
| `components/AssociatedTriangleDialog.tsx` | `0da86fba54b776896f68fb7891494187ce88ad963855510082b4e26e9bc2b879` |
| `components/BarycentricPointDialog.tsx` | `57bd6f97814088363fba3597af8b8908d2451138c279c263fc6aeac011bc9e62` |
| `components/CircleCircleDialog.tsx` | `4deb6e2f8da29413d457ebfdcf8fc35b3de585776ae9dfe836b8bbc853212d27` |
| `components/CircleTransformationDialog.tsx` | `282b8187f24e55e193a7cc6986f1b0ae5032bf5e5f42cf4eb0465476aa0dfa18` |
| `components/DefinedCircleDialog.tsx` | `c2ef2d94c4f9b697139d3466564b3c7deeeb8d194ca947d3e0293542ef1f7f3a` |
| `components/DefinedLineDialog.tsx` | `f20ec459bb90af570139289a0e8199e77fefca71f610514505426d1fda3979d4` |
| `components/DefinedTriangleDialog.tsx` | `fb511ff76001562cbd325f13a6ebdc0c2961cecc78cd536b1198a86bfea914f7` |
| `components/DuplicateSegmentDialog.tsx` | `9b1ff31fb72be927b19c055cd928a05dc5b6f32545257aa2733334321462b677` |
| `components/EllipseDialog.tsx` | `1769f2c2c0f2dbed218992535f8c5654272ceccae6ef0442209f1a7bcd8d4515` |
| `components/LineCircleDialog.tsx` | `1fabb74aa7fa8f2b3e28e79d268b6a12c28749d2a81ab34f2f6c73300007f4b1` |
| `components/MeasurementDialog.tsx` | `e11b79eec0aa0b2ae80efd53deba3aab0b264fae96970d05deb021a2cb1053d7` |
| `components/PointTransformationDialog.tsx` | `6680a12f4daac80c4ce0a786ce01cb1955a1ce4a6870aab5165395cd16d32064` |
| `components/PointsTransformationDialog.tsx` | `3ee30c3d9f9ca87b80a52753cbf3008db81ca63ef9559128f121cadec1c12437` |
| `components/PolygonConstructionDialog.tsx` | `b18751a7fca388f79aa365b0999c868acb9a5655a82d2f7ea42c3a2fd4598a47` |
| `components/ProjectedExcentersDialog.tsx` | `82aa8948943d1a1e6ea6d1773b2664cb15d4629356b8cd5b5f5bed90a0e296d1` |
| `components/RadicalAxisDialog.tsx` | `514b44cf096c5985336cb6160bf87adbf2a76e43797305a7e987f0e012531552` |
| `components/RandomPointDialog.tsx` | `b43f26c710a053fed85b6dd474f9332ff29bc1837690f38eb7a81c35d84314c2` |
| `components/ShowLineDialog.tsx` | `81b3e7ddfa991d983e6218d38db7b81297d007f4640a10e90a531c553be8c079` |
| `components/ShowTransformationDialog.tsx` | `16e4b3941026ca0a364980ef80815004cbf5dbb197c8ef6f8927e4a78937770f` |
| `components/TriangleCenterDialog.tsx` | `d02035fe334efb7ea6d7de5dde774e35d57ee1af42a70e31aee907cf926c67a7` |
| `components/VectorCoordinatesDialog.tsx` | `6ea7a156ca2b0d47990c6cf28ac7276849de13747f65453a72c10a32bbadbc6f` |
| `components/VectorPointDialog.tsx` | `393310c36fae4ed4eab70117aaf1e67bb4d1b926ed912a194f52b823fb16403f` |

## New DataTeX-owned Phase 4 files

These files have no Stoicheia source hash because they are thin host/build
adapters rather than altered copies:

- `bridge/StoicheiaPackageStudioAdapter.tsx` and its test
- `bridge/documentBridge.ts` and its test
- `bridge/useTabsStore.test.ts` (host atomic Save As retarget regression)
- `bridge/loadFrontend.ts` and its test
- `bridge/loadCodeEditor.ts` and its test
- `bridge/monacoLoaderIntegration.test.ts`
- `bridge/StoicheiaErrorBoundary.tsx` and its test
- `bridge/scopedPortal.ts` and its test
- `bridge/scopedPortalFocus.ts` and its test
- `bridge/scopedDialogIntegration.test.tsx`
- `bridge/focusScope.ts` and its test
- `bridge/sanitizeExactSvg.ts` and its test
- `bridge/stoicheia-adapter.css`
- `App.test.tsx`
- `components/ToolGroup.test.tsx`
- `styles/stoicheia.embedded.css` (deterministically generated, never hand-edited)
- `scripts/build-stoicheia-css.mjs`
- `scripts/lib/scope-stoicheia-css.mjs`
- `scripts/scope-stoicheia-css.mjs`
- `scripts/scope-stoicheia-css.test.mjs`
- `scripts/check-stoicheia-copy-baseline.mjs`
- `scripts/check-stoicheia-lazy-build.mjs`
