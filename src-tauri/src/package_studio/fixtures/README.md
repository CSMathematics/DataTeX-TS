# Package Studio Golden Fixtures

These fixtures freeze representative output from the current TypeScript package
and preamble generators before the migration to Rust generators.

They are intentionally plain `.tex` snippets so Rust tests, frontend tests, and
manual review can all reuse the same expected output.

## Scope

- `preamble-default-article.tex`: default `PreambleWizard` full-document output.
- `geometry-default.tex`: default `generateGeometry` output.
- `geometry-advanced-layout.tex`: non-default geometry output with two columns,
  margin notes, offsets, header/footer inclusion, and asymmetric layout.
- `code-listings-default.tex`: default `generateCodeHighlighting("listings")`
  output.
- `code-minted-default.tex`: default `generateCodeHighlighting("minted")`
  output.

## Migration Rule

When a Rust generator replaces one of the current TypeScript generators, add a
test that compares the Rust output against the relevant fixture before changing
the fixture. A fixture change should be treated as a deliberate behavior change.
