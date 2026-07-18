# Pdfium runtime resources

DataTeX uses the native Rust/Pdfium PDF viewer. Release builds bundle the
Pdfium dynamic library for the target OS/architecture.

Current bundled version: `151.0.7881.0`.

The binaries come from the bblanchon PDFium binary distribution:

- Linux x64: `pdfium-linux-x64.tgz`
- Windows x64: NuGet package `bblanchon.PDFium.Win32` version `151.0.7881`
- macOS x64/arm64: NuGet package `bblanchon.PDFium.macOS` version `151.0.7881`

Expected per-target layout:

```text
src-tauri/resources/pdfium/
  linux-x86_64/
    lib/libpdfium.so
    LICENSE
    VERSION
    licenses/...
  windows-x86_64/
    lib/pdfium.dll
    LICENSE
    VERSION
    licenses/...
  macos-x86_64/
    lib/libpdfium.dylib
    LICENSE
    VERSION
    licenses/...
  macos-aarch64/
    lib/libpdfium.dylib
    LICENSE
    VERSION
    licenses/...
```

The Tauri config overlays copy the selected target folder into the app bundle as
`pdfium/`. At runtime the loader checks:

- `pdfium/lib/<platform-library-name>`
- `pdfium/<platform-library-name>`
- `pdfium/<target>/lib/<platform-library-name>`
- `pdfium/<target>/<platform-library-name>`

This keeps per-OS builds small while still allowing an all-target resource bundle
if needed later.

Build scripts:

```bash
pnpm run tauri:build:linux
pnpm run tauri:build:windows
pnpm run tauri:build:macos:x64
pnpm run tauri:build:macos:arm64
```

For development or emergency overrides, set `DATATEX_PDFIUM_LIBRARY_PATH` to the
absolute path of the Pdfium dynamic library.
