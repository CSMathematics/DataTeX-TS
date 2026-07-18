use crate::diagnostics;
use directories::ProjectDirs;
use image::codecs::jpeg::JpegEncoder;
use image::ExtendedColorType;
use pdfium_render::prelude::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::fs::File;
use std::io::BufWriter;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const MIN_DEVICE_PIXEL_RATIO: f32 = 1.5;
const MAX_DEVICE_PIXEL_RATIO: f32 = 2.0;
const MAX_RENDER_PIXELS: f32 = 10_000_000.0;
const MIN_SCALE: f32 = 0.1;
const MAX_SCALE: f32 = 4.0;
const RENDER_JPEG_QUALITY: u8 = 92;
const PDF_MIN_STABLE_AGE: Duration = Duration::from_millis(120);
const PDF_STABILITY_RETRY_DELAYS_MS: [u64; 5] = [0, 40, 80, 160, 240];
const PDF_HEADER_SCAN_BYTES: usize = 1_024;
const PDF_EOF_SCAN_BYTES: usize = 16 * 1_024;
const MAX_OUTLINE_ITEMS: usize = 5_000;
const MAX_OUTLINE_DEPTH: usize = 64;
const PDFIUM_RESOURCE_BUNDLE_DIR: &str = "pdfium";

static PDFIUM_RESOURCE_DIR: OnceLock<PathBuf> = OnceLock::new();

pub type PdfRendererState = Arc<Mutex<PdfRenderer>>;

pub fn configure_resource_dir(resource_dir: Option<PathBuf>) {
    if let Some(resource_dir) = resource_dir {
        let _ = PDFIUM_RESOURCE_DIR.set(resource_dir);
    }
}

#[derive(Default)]
pub struct PdfRenderer {
    documents: HashMap<String, CachedPdfDocument>,
}

struct CachedPdfDocument {
    path: String,
    version_key: String,
    cache_dir: PathBuf,
    page_sizes: Vec<PdfiumPageSize>,
    document: PdfDocument<'static>,
}

struct StablePdfSnapshot {
    bytes: Vec<u8>,
    version_key: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfiumRendererStatus {
    pub available: bool,
    pub message: String,
    pub library_name: String,
    pub cache_dir: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfiumOpenDocumentResponse {
    pub doc_id: String,
    pub path: String,
    pub version_key: String,
    pub num_pages: usize,
    pub page_sizes: Vec<PdfiumPageSize>,
    pub cache_dir: String,
    pub open_time_ms: u128,
    pub cache_hit: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfiumPageSize {
    pub width: f32,
    pub height: f32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfiumRenderPageRequest {
    pub doc_id: String,
    pub page_number: usize,
    pub scale: f32,
    pub rotation: i32,
    pub device_pixel_ratio: f32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfiumRenderPageResponse {
    pub doc_id: String,
    pub page_number: usize,
    pub image_path: String,
    pub width: u32,
    pub height: u32,
    pub css_width: f32,
    pub css_height: f32,
    pub render_time_ms: u128,
    pub page_load_time_ms: u128,
    pub raster_time_ms: u128,
    pub encode_time_ms: u128,
    pub cache_hit: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfiumPageTextResponse {
    pub doc_id: String,
    pub page_number: usize,
    pub text: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfiumOutlineResponse {
    pub doc_id: String,
    pub items: Vec<PdfiumOutlineItem>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfiumOutlineItem {
    pub id: String,
    pub title: String,
    pub page: Option<usize>,
    pub depth: usize,
}

impl PdfRenderer {
    fn open_document(&mut self, path: String) -> Result<PdfiumOpenDocumentResponse, String> {
        let started_at = Instant::now();
        diagnostics::debug_log(
            "PDFIUM",
            "open:start",
            Some(&format!("requested_path={}", path)),
        );
        let path_buf = PathBuf::from(&path);
        let canonical_path = path_buf
            .canonicalize()
            .unwrap_or(path_buf)
            .to_string_lossy()
            .to_string();
        // Pdfium is a native in-process library: a malformed or half-written
        // file can terminate the entire application instead of returning a
        // recoverable Rust error. Always give it an owned, stable snapshot.
        let snapshot = match read_stable_pdf_snapshot(&canonical_path) {
            Ok(snapshot) => snapshot,
            Err(error) => {
                diagnostics::terminal_log(
                    "ERROR",
                    "PDFIUM",
                    "open:snapshot-failed",
                    Some(&format!("path={} error={}", canonical_path, error)),
                );
                return Err(error);
            }
        };
        let version_key = snapshot.version_key;
        let doc_id = document_id(&canonical_path, &version_key);
        diagnostics::debug_log(
            "PDFIUM",
            "open:snapshot-ready",
            Some(&format!(
                "path={} doc_id={} bytes={} version={}",
                canonical_path,
                doc_id,
                snapshot.bytes.len(),
                version_key
            )),
        );

        if let Some(document) = self.documents.get(&doc_id) {
            diagnostics::debug_log(
                "PDFIUM",
                "open:memory-cache-hit",
                Some(&format!(
                    "path={} doc_id={} pages={}",
                    canonical_path,
                    doc_id,
                    document.page_sizes.len()
                )),
            );
            return Ok(PdfiumOpenDocumentResponse {
                doc_id,
                path: canonical_path,
                version_key,
                num_pages: document.page_sizes.len(),
                page_sizes: document.page_sizes.clone(),
                cache_dir: document.cache_dir.to_string_lossy().to_string(),
                open_time_ms: started_at.elapsed().as_millis(),
                cache_hit: true,
            });
        }

        self.documents
            .retain(|_, document| document.path != canonical_path);

        let pdfium = pdfium_instance()?;
        diagnostics::debug_log(
            "PDFIUM",
            "open:pdfium-load-start",
            Some(&format!("path={} doc_id={}", canonical_path, doc_id)),
        );
        let document = pdfium
            .load_pdf_from_byte_vec(snapshot.bytes, None)
            .map_err(|error| format!("Pdfium failed to open '{}': {}", canonical_path, error))?;
        diagnostics::debug_log(
            "PDFIUM",
            "open:pdfium-load-complete",
            Some(&format!("path={} doc_id={}", canonical_path, doc_id)),
        );
        let pages = document.pages();
        let num_pages = usize::try_from(pages.len()).unwrap_or(0);
        if num_pages == 0 {
            return Err(format!("PDF has no pages: {}", canonical_path));
        }

        diagnostics::debug_log(
            "PDFIUM",
            "open:page-sizes-start",
            Some(&format!(
                "path={} doc_id={} pages={}",
                canonical_path, doc_id, num_pages
            )),
        );
        let page_sizes = pages
            .page_sizes()
            .map_err(|error| format!("Pdfium failed to read page sizes: {}", error))?
            .into_iter()
            .map(|rect| PdfiumPageSize {
                width: rect.width().value,
                height: rect.height().value,
            })
            .collect::<Vec<_>>();
        diagnostics::debug_log(
            "PDFIUM",
            "open:page-sizes-complete",
            Some(&format!(
                "path={} doc_id={} pages={}",
                canonical_path,
                doc_id,
                page_sizes.len()
            )),
        );
        let cache_dir = pdf_cache_root()?.join(&doc_id);
        fs::create_dir_all(&cache_dir).map_err(|error| {
            format!(
                "Failed to create PDF render cache '{}': {}",
                cache_dir.display(),
                error
            )
        })?;

        let response = PdfiumOpenDocumentResponse {
            doc_id: doc_id.clone(),
            path: canonical_path.clone(),
            version_key: version_key.clone(),
            num_pages,
            page_sizes: page_sizes.clone(),
            cache_dir: cache_dir.to_string_lossy().to_string(),
            open_time_ms: started_at.elapsed().as_millis(),
            cache_hit: false,
        };

        self.documents.insert(
            doc_id,
            CachedPdfDocument {
                path: canonical_path,
                version_key,
                cache_dir,
                page_sizes,
                document,
            },
        );

        diagnostics::debug_log(
            "PDFIUM",
            "open:complete",
            Some(&format!(
                "path={} doc_id={} pages={} elapsed_ms={}",
                response.path, response.doc_id, response.num_pages, response.open_time_ms
            )),
        );
        Ok(response)
    }

    fn render_page(
        &mut self,
        request: PdfiumRenderPageRequest,
    ) -> Result<PdfiumRenderPageResponse, String> {
        let started_at = Instant::now();
        diagnostics::debug_log(
            "PDFIUM",
            "render:request",
            Some(&format!(
                "doc_id={} page={} scale={:.3} rotation={} dpr={:.2}",
                request.doc_id,
                request.page_number,
                request.scale,
                request.rotation,
                request.device_pixel_ratio
            )),
        );
        let document = self
            .documents
            .get_mut(&request.doc_id)
            .ok_or_else(|| format!("Pdfium document is not open: {}", request.doc_id))?;
        if request.page_number == 0 || request.page_number > document.page_sizes.len() {
            return Err(format!(
                "Page {} is outside document range 1..={}",
                request.page_number,
                document.page_sizes.len()
            ));
        }

        let page_size = &document.page_sizes[request.page_number - 1];
        let normalized_rotation = normalize_rotation(request.rotation);
        let is_quarter_turn = normalized_rotation % 180 != 0;
        let scale = request.scale.clamp(MIN_SCALE, MAX_SCALE);
        let device_pixel_ratio = request
            .device_pixel_ratio
            .clamp(MIN_DEVICE_PIXEL_RATIO, MAX_DEVICE_PIXEL_RATIO);
        let css_width = if is_quarter_turn {
            page_size.height
        } else {
            page_size.width
        } * scale;
        let css_height = if is_quarter_turn {
            page_size.width
        } else {
            page_size.height
        } * scale;
        let (width, height) = raster_dimensions(css_width, css_height, device_pixel_ratio);
        let file_name = format!(
            "p{}-w{}-h{}-r{}-q{}-v{}.jpg",
            request.page_number,
            width,
            height,
            normalized_rotation,
            RENDER_JPEG_QUALITY,
            short_hash(&document.version_key),
        );
        let image_path = document.cache_dir.join(file_name);

        if image_path.exists() {
            diagnostics::debug_log(
                "PDFIUM",
                "render:disk-cache-hit",
                Some(&format!(
                    "path={} doc_id={} page={} image={}",
                    document.path,
                    request.doc_id,
                    request.page_number,
                    image_path.display()
                )),
            );
            return Ok(PdfiumRenderPageResponse {
                doc_id: request.doc_id,
                page_number: request.page_number,
                image_path: image_path.to_string_lossy().to_string(),
                width,
                height,
                css_width,
                css_height,
                render_time_ms: started_at.elapsed().as_millis(),
                page_load_time_ms: 0,
                raster_time_ms: 0,
                encode_time_ms: 0,
                cache_hit: true,
            });
        }

        let page_index = i32::try_from(request.page_number - 1)
            .map_err(|_| format!("Page index is too large: {}", request.page_number))?;
        let page_load_started_at = Instant::now();
        // This is the most important crash breadcrumb. If Pdfium terminates
        // the process in FPDF_LoadPage, this flushed line remains in terminal.
        diagnostics::debug_log(
            "PDFIUM",
            "render:fpdf-load-page-start",
            Some(&format!(
                "path={} doc_id={} page={} page_index={}",
                document.path, request.doc_id, request.page_number, page_index
            )),
        );
        let page = document
            .document
            .pages()
            .get(page_index)
            .map_err(|error| format!("Pdfium failed to load page: {}", error))?;
        let page_load_time_ms = page_load_started_at.elapsed().as_millis();
        diagnostics::debug_log(
            "PDFIUM",
            "render:fpdf-load-page-complete",
            Some(&format!(
                "path={} doc_id={} page={} elapsed_ms={}",
                document.path, request.doc_id, request.page_number, page_load_time_ms
            )),
        );
        let buffer_len = (width as usize)
            .checked_mul(height as usize)
            .and_then(|pixels| pixels.checked_mul(3))
            .ok_or_else(|| "Rendered PDF page buffer is too large".to_string())?;
        let mut bitmap_buffer = vec![0_u8; buffer_len];
        let mut bitmap = PdfBitmap::from_bytes(
            width as Pixels,
            height as Pixels,
            PdfBitmapFormat::BGR,
            &mut bitmap_buffer,
        )
        .map_err(|error| format!("Pdfium failed to allocate page bitmap: {}", error))?;
        let raster_started_at = Instant::now();
        diagnostics::debug_log(
            "PDFIUM",
            "render:raster-start",
            Some(&format!(
                "doc_id={} page={} raster={}x{}",
                request.doc_id, request.page_number, width, height
            )),
        );
        page.render_into_bitmap(
            &mut bitmap,
            width as Pixels,
            height as Pixels,
            rotation_to_pdfium(normalized_rotation),
        )
        .map_err(|error| format!("Pdfium failed to render page: {}", error))?;
        let raster_time_ms = raster_started_at.elapsed().as_millis();
        diagnostics::debug_log(
            "PDFIUM",
            "render:raster-complete",
            Some(&format!(
                "doc_id={} page={} elapsed_ms={}",
                request.doc_id, request.page_number, raster_time_ms
            )),
        );
        drop(bitmap);
        let encode_started_at = Instant::now();
        let output = File::create(&image_path)
            .map(BufWriter::new)
            .map_err(|error| format!("Failed to create rendered page JPEG: {}", error))?;
        JpegEncoder::new_with_quality(output, RENDER_JPEG_QUALITY)
            .encode(&bitmap_buffer, width, height, ExtendedColorType::Rgb8)
            .map_err(|error| format!("Failed to write rendered page JPEG: {}", error))?;
        let encode_time_ms = encode_started_at.elapsed().as_millis();
        diagnostics::debug_log(
            "PDFIUM",
            "render:complete",
            Some(&format!(
                "path={} doc_id={} page={} total_ms={} page_load_ms={} raster_ms={} encode_ms={}",
                document.path,
                request.doc_id,
                request.page_number,
                started_at.elapsed().as_millis(),
                page_load_time_ms,
                raster_time_ms,
                encode_time_ms
            )),
        );

        Ok(PdfiumRenderPageResponse {
            doc_id: request.doc_id,
            page_number: request.page_number,
            image_path: image_path.to_string_lossy().to_string(),
            width,
            height,
            css_width,
            css_height,
            render_time_ms: started_at.elapsed().as_millis(),
            page_load_time_ms,
            raster_time_ms,
            encode_time_ms,
            cache_hit: false,
        })
    }

    fn extract_page_text(
        &mut self,
        doc_id: String,
        page_number: usize,
    ) -> Result<PdfiumPageTextResponse, String> {
        let document = self
            .documents
            .get_mut(&doc_id)
            .ok_or_else(|| format!("Pdfium document is not open: {}", doc_id))?;
        if page_number == 0 || page_number > document.page_sizes.len() {
            return Err(format!(
                "Page {} is outside document range 1..={}",
                page_number,
                document.page_sizes.len()
            ));
        }

        let page_index =
            i32::try_from(page_number - 1).map_err(|_| "Page index is too large".to_string())?;
        diagnostics::debug_log(
            "PDFIUM",
            "text:fpdf-load-page-start",
            Some(&format!(
                "path={} doc_id={} page={}",
                document.path, doc_id, page_number
            )),
        );
        let page = document
            .document
            .pages()
            .get(page_index)
            .map_err(|error| format!("Pdfium failed to load page text: {}", error))?;
        let text = page
            .text()
            .map_err(|error| format!("Pdfium failed to extract page text: {}", error))?
            .all();

        Ok(PdfiumPageTextResponse {
            doc_id,
            page_number,
            text,
        })
    }

    fn extract_outline(&mut self, doc_id: String) -> Result<PdfiumOutlineResponse, String> {
        let document = self
            .documents
            .get_mut(&doc_id)
            .ok_or_else(|| format!("Pdfium document is not open: {}", doc_id))?;

        diagnostics::debug_log(
            "PDFIUM",
            "outline:start",
            Some(&format!("path={} doc_id={}", document.path, doc_id)),
        );

        let mut items = Vec::new();
        if let Some(root) = document.document.bookmarks().root() {
            collect_outline_items(
                root,
                0,
                "outline".to_string(),
                &mut items,
                document.page_sizes.len(),
            );
        }

        diagnostics::debug_log(
            "PDFIUM",
            "outline:complete",
            Some(&format!(
                "path={} doc_id={} items={}",
                document.path,
                doc_id,
                items.len()
            )),
        );

        Ok(PdfiumOutlineResponse { doc_id, items })
    }

    fn close_document(&mut self, doc_id: &str) {
        diagnostics::debug_log(
            "PDFIUM",
            "document:close",
            Some(&format!("doc_id={}", doc_id)),
        );
        self.documents.remove(doc_id);
    }

    fn clear_documents(&mut self) {
        self.documents.clear();
    }
}

fn collect_outline_items(
    bookmark: PdfBookmark<'_>,
    depth: usize,
    prefix: String,
    items: &mut Vec<PdfiumOutlineItem>,
    page_count: usize,
) {
    let mut current = Some(bookmark);
    let mut sibling_index = 0usize;

    while let Some(node) = current {
        if items.len() >= MAX_OUTLINE_ITEMS {
            return;
        }

        let id = format!("{}-{}", prefix, sibling_index);
        let page = bookmark_page_number(&node, page_count);
        items.push(PdfiumOutlineItem {
            id: id.clone(),
            title: node.title().unwrap_or_else(|| "Untitled".to_string()),
            page,
            depth,
        });

        if depth < MAX_OUTLINE_DEPTH {
            if let Some(child) = node.first_child() {
                collect_outline_items(child, depth + 1, id, items, page_count);
            }
        }

        current = node.next_sibling();
        sibling_index += 1;
    }
}

fn bookmark_page_number(bookmark: &PdfBookmark<'_>, page_count: usize) -> Option<usize> {
    let page_index = bookmark
        .destination()
        .and_then(|destination| destination.page_index().ok())
        .or_else(|| {
            bookmark.action().and_then(|action| {
                action
                    .as_local_destination_action()
                    .and_then(|action| action.destination().ok())
                    .and_then(|destination| destination.page_index().ok())
            })
        })?;

    let zero_based_page = usize::try_from(page_index).ok()?;
    if zero_based_page < page_count {
        Some(zero_based_page + 1)
    } else {
        None
    }
}

#[tauri::command]
pub async fn pdfium_renderer_status_cmd() -> PdfiumRendererStatus {
    let cache_dir = pdf_cache_root()
        .ok()
        .map(|path| path.to_string_lossy().to_string());
    let library_name = Pdfium::pdfium_platform_library_name()
        .to_string_lossy()
        .to_string();

    match pdfium_instance() {
        Ok(_) => PdfiumRendererStatus {
            available: true,
            message: "Pdfium is available.".to_string(),
            library_name,
            cache_dir,
        },
        Err(error) => PdfiumRendererStatus {
            available: false,
            message: error,
            library_name,
            cache_dir,
        },
    }
}

#[tauri::command]
pub async fn pdfium_open_document_cmd(
    state: tauri::State<'_, PdfRendererState>,
    path: String,
) -> Result<PdfiumOpenDocumentResponse, String> {
    let renderer = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        renderer
            .lock()
            .map_err(|_| "Pdfium renderer lock poisoned".to_string())?
            .open_document(path)
    })
    .await
    .map_err(|error| format!("Pdfium open task failed: {}", error))?
}

#[tauri::command]
pub async fn pdfium_render_page_cmd(
    state: tauri::State<'_, PdfRendererState>,
    request: PdfiumRenderPageRequest,
) -> Result<PdfiumRenderPageResponse, String> {
    let renderer = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        renderer
            .lock()
            .map_err(|_| "Pdfium renderer lock poisoned".to_string())?
            .render_page(request)
    })
    .await
    .map_err(|error| format!("Pdfium render task failed: {}", error))?
}

#[tauri::command]
pub async fn pdfium_extract_page_text_cmd(
    state: tauri::State<'_, PdfRendererState>,
    doc_id: String,
    page_number: usize,
) -> Result<PdfiumPageTextResponse, String> {
    let renderer = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        renderer
            .lock()
            .map_err(|_| "Pdfium renderer lock poisoned".to_string())?
            .extract_page_text(doc_id, page_number)
    })
    .await
    .map_err(|error| format!("Pdfium text extraction task failed: {}", error))?
}

#[tauri::command]
pub async fn pdfium_extract_outline_cmd(
    state: tauri::State<'_, PdfRendererState>,
    doc_id: String,
) -> Result<PdfiumOutlineResponse, String> {
    let renderer = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        renderer
            .lock()
            .map_err(|_| "Pdfium renderer lock poisoned".to_string())?
            .extract_outline(doc_id)
    })
    .await
    .map_err(|error| format!("Pdfium outline extraction task failed: {}", error))?
}

#[tauri::command]
pub async fn pdfium_close_document_cmd(
    state: tauri::State<'_, PdfRendererState>,
    doc_id: String,
) -> Result<(), String> {
    let mut renderer = state
        .lock()
        .map_err(|_| "Pdfium renderer lock poisoned".to_string())?;
    renderer.close_document(&doc_id);
    Ok(())
}

#[tauri::command]
pub async fn pdfium_clear_documents_cmd(
    state: tauri::State<'_, PdfRendererState>,
) -> Result<(), String> {
    let mut renderer = state
        .lock()
        .map_err(|_| "Pdfium renderer lock poisoned".to_string())?;
    renderer.clear_documents();
    Ok(())
}

fn pdfium_instance() -> Result<&'static Pdfium, String> {
    static PDFIUM: OnceLock<Result<Pdfium, String>> = OnceLock::new();

    match PDFIUM.get_or_init(initialize_pdfium) {
        Ok(pdfium) => Ok(pdfium),
        Err(error) => Err(error.clone()),
    }
}

fn initialize_pdfium() -> Result<Pdfium, String> {
    // Pdfium::new() initializes process-global native state and the crate's
    // own global bindings. It must run exactly once. The outer OnceLock's
    // get_or_init() serializes status/open requests that arrive together.
    diagnostics::debug_log("PDFIUM", "library:init-start", None);
    let bindings = if let Ok(path) = std::env::var("DATATEX_PDFIUM_LIBRARY_PATH")
        .or_else(|_| std::env::var("PDFIUM_LIBRARY_PATH"))
    {
        Pdfium::bind_to_library(path).map_err(|error| error.to_string())
    } else {
        let candidates = candidate_pdfium_paths();
        let searched_paths = candidates
            .iter()
            .map(|path| path.display().to_string())
            .collect::<Vec<_>>();

        candidates
            .into_iter()
            .find_map(|candidate| {
                if !candidate.exists() {
                    return None;
                }

                match Pdfium::bind_to_library(&candidate) {
                    Ok(bindings) => Some(Ok(bindings)),
                    Err(error) => {
                        eprintln!(
                            "Failed to bind Pdfium candidate '{}': {}",
                            candidate.display(),
                            error
                        );
                        None
                    }
                }
            })
            .unwrap_or_else(|| {
                Pdfium::bind_to_system_library().map_err(|system_error| {
                    format!(
                        "{} Searched bundled candidates: {}",
                        system_error,
                        if searched_paths.is_empty() {
                            "(none)".to_string()
                        } else {
                            searched_paths.join(", ")
                        }
                    )
                })
            })
    }
    .map_err(|error| {
        format!(
            "Pdfium library is not available. Install {} or set DATATEX_PDFIUM_LIBRARY_PATH. {}",
            Pdfium::pdfium_platform_library_name().to_string_lossy(),
            error
        )
    })?;

    let pdfium = Pdfium::new(bindings);
    diagnostics::debug_log("PDFIUM", "library:init-complete", None);
    Ok(pdfium)
}

fn candidate_pdfium_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let library_name = PathBuf::from(Pdfium::pdfium_platform_library_name());
    let target_dir = pdfium_resource_target_dir();

    if let Some(resource_dir) = PDFIUM_RESOURCE_DIR.get() {
        push_pdfium_library_candidates(
            &mut paths,
            &resource_dir.join(PDFIUM_RESOURCE_BUNDLE_DIR),
            target_dir,
            &library_name,
        );
        push_pdfium_library_candidates(&mut paths, resource_dir, target_dir, &library_name);
    }

    if let Ok(executable) = std::env::current_exe() {
        if let Some(executable_dir) = executable.parent() {
            paths.push(executable_dir.join(&library_name));
            push_pdfium_library_candidates(
                &mut paths,
                &executable_dir.join(PDFIUM_RESOURCE_BUNDLE_DIR),
                target_dir,
                &library_name,
            );
        }
    }

    #[cfg(debug_assertions)]
    {
        push_pdfium_library_candidates(
            &mut paths,
            &PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("resources")
                .join(PDFIUM_RESOURCE_BUNDLE_DIR),
            target_dir,
            &library_name,
        );
    }

    paths
}

fn push_pdfium_library_candidates(
    paths: &mut Vec<PathBuf>,
    base_dir: &Path,
    target_dir: &str,
    library_name: &Path,
) {
    paths.push(base_dir.join("lib").join(library_name));
    paths.push(base_dir.join(library_name));
    paths.push(base_dir.join(target_dir).join("lib").join(library_name));
    paths.push(base_dir.join(target_dir).join(library_name));
}

fn pdfium_resource_target_dir() -> &'static str {
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        "linux-x86_64"
    }
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    {
        "linux-aarch64"
    }
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        "windows-x86_64"
    }
    #[cfg(all(target_os = "windows", target_arch = "aarch64"))]
    {
        "windows-aarch64"
    }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        "macos-x86_64"
    }
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        "macos-aarch64"
    }
    #[cfg(not(any(
        all(target_os = "linux", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "aarch64"),
        all(target_os = "windows", target_arch = "x86_64"),
        all(target_os = "windows", target_arch = "aarch64"),
        all(target_os = "macos", target_arch = "x86_64"),
        all(target_os = "macos", target_arch = "aarch64"),
    )))]
    {
        "unknown"
    }
}

fn pdf_cache_root() -> Result<PathBuf, String> {
    ProjectDirs::from("", "", "datatex")
        .map(|dirs| dirs.cache_dir().join("pdfium-render-cache"))
        .ok_or_else(|| "Could not determine DataTeX cache directory".to_string())
}

fn read_stable_pdf_snapshot(path: &str) -> Result<StablePdfSnapshot, String> {
    let mut last_error = String::new();

    for delay_ms in PDF_STABILITY_RETRY_DELAYS_MS {
        if delay_ms > 0 {
            thread::sleep(Duration::from_millis(delay_ms));
        }

        match read_pdf_snapshot_once(path) {
            Ok(snapshot) => return Ok(snapshot),
            Err(error) => {
                diagnostics::debug_log(
                    "PDFIUM",
                    "snapshot:retry",
                    Some(&format!(
                        "path={} delay_ms={} reason={}",
                        path, delay_ms, error
                    )),
                );
                last_error = error;
            }
        }
    }

    Err(format!(
        "PDF is incomplete or still being generated: {}. {}",
        path, last_error
    ))
}

fn read_pdf_snapshot_once(path: &str) -> Result<StablePdfSnapshot, String> {
    let before =
        fs::metadata(path).map_err(|error| format!("Failed to stat PDF '{}': {}", path, error))?;
    if !before.is_file() {
        return Err(format!("PDF path is not a regular file: {}", path));
    }
    if before.len() == 0 {
        return Err(format!("PDF file is empty: {}", path));
    }

    if let Ok(modified) = before.modified() {
        let age = SystemTime::now()
            .duration_since(modified)
            .unwrap_or_default();
        if age < PDF_MIN_STABLE_AGE {
            return Err(format!("PDF was modified {} ms ago", age.as_millis()));
        }
    }

    let bytes =
        fs::read(path).map_err(|error| format!("Failed to read PDF '{}': {}", path, error))?;
    let after = fs::metadata(path)
        .map_err(|error| format!("Failed to restat PDF '{}': {}", path, error))?;
    let before_modified = before.modified().ok();
    let after_modified = after.modified().ok();

    if before.len() != after.len()
        || before_modified != after_modified
        || after.len() != bytes.len() as u64
    {
        return Err(format!("PDF changed while it was being read: {}", path));
    }

    validate_pdf_bytes(&bytes)?;

    Ok(StablePdfSnapshot {
        bytes,
        version_key: pdf_version_key_from_metadata(&after),
    })
}

fn validate_pdf_bytes(bytes: &[u8]) -> Result<(), String> {
    let header_end = bytes.len().min(PDF_HEADER_SCAN_BYTES);
    if !bytes[..header_end]
        .windows(b"%PDF-".len())
        .any(|window| window == b"%PDF-")
    {
        return Err("PDF header is missing".to_string());
    }

    let eof_start = bytes.len().saturating_sub(PDF_EOF_SCAN_BYTES);
    if !bytes[eof_start..]
        .windows(b"%%EOF".len())
        .any(|window| window == b"%%EOF")
    {
        return Err("PDF end marker is missing".to_string());
    }

    Ok(())
}

fn pdf_version_key_from_metadata(metadata: &fs::Metadata) -> String {
    let modified = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);
    let duration = modified.duration_since(UNIX_EPOCH).unwrap_or_default();
    format!(
        "{}:{}:{}",
        metadata.len(),
        duration.as_secs(),
        duration.subsec_nanos()
    )
}

fn document_id(path: &str, version_key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.as_bytes());
    hasher.update(b":");
    hasher.update(version_key.as_bytes());
    hex_prefix(hasher.finalize().as_slice(), 20)
}

fn short_hash(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    hex_prefix(hasher.finalize().as_slice(), 8)
}

fn hex_prefix(bytes: &[u8], chars: usize) -> String {
    bytes
        .iter()
        .flat_map(|byte| {
            let high = byte >> 4;
            let low = byte & 0x0f;
            [hex_char(high), hex_char(low)]
        })
        .take(chars)
        .collect()
}

fn hex_char(value: u8) -> char {
    match value {
        0..=9 => (b'0' + value) as char,
        _ => (b'a' + (value - 10)) as char,
    }
}

fn normalize_rotation(rotation: i32) -> i32 {
    rotation.rem_euclid(360)
}

fn rotation_to_pdfium(rotation: i32) -> Option<PdfPageRenderRotation> {
    match normalize_rotation(rotation) {
        90 => Some(PdfPageRenderRotation::Degrees90),
        180 => Some(PdfPageRenderRotation::Degrees180),
        270 => Some(PdfPageRenderRotation::Degrees270),
        _ => None,
    }
}

fn raster_dimensions(css_width: f32, css_height: f32, device_pixel_ratio: f32) -> (u32, u32) {
    let mut width = (css_width * device_pixel_ratio).ceil().max(1.0);
    let mut height = (css_height * device_pixel_ratio).ceil().max(1.0);
    let pixels = width * height;
    if pixels > MAX_RENDER_PIXELS {
        let factor = (MAX_RENDER_PIXELS / pixels).sqrt();
        width = (width * factor).ceil().max(1.0);
        height = (height * factor).ceil().max(1.0);
    }

    let width = width as u32;
    let aligned_width = width.saturating_add(3) & !3;

    (aligned_width.max(4), height as u32)
}

#[allow(dead_code)]
fn _is_pdf(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("pdf"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_a_complete_pdf_snapshot() {
        let bytes = b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\nstartxref\n9\n%%EOF\n";
        assert!(validate_pdf_bytes(bytes).is_ok());
    }

    #[test]
    fn rejects_a_pdf_without_an_end_marker() {
        let bytes = b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n";
        assert_eq!(
            validate_pdf_bytes(bytes),
            Err("PDF end marker is missing".to_string())
        );
    }

    #[test]
    fn rejects_data_without_a_pdf_header() {
        let bytes = b"not a pdf\n%%EOF\n";
        assert_eq!(
            validate_pdf_bytes(bytes),
            Err("PDF header is missing".to_string())
        );
    }

    #[test]
    fn retries_until_a_fresh_pdf_snapshot_is_stable() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "datatex-pdf-snapshot-{}-{}.pdf",
            std::process::id(),
            unique
        ));
        let bytes = b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\nstartxref\n9\n%%EOF\n";
        fs::write(&path, bytes).expect("test PDF should be written");

        let snapshot = read_stable_pdf_snapshot(path.to_string_lossy().as_ref())
            .expect("fresh PDF should become stable within the bounded retries");

        assert_eq!(snapshot.bytes, bytes);
        let _ = fs::remove_file(path);
    }

    #[test]
    fn concurrent_pdfium_requests_share_one_initialization() {
        const REQUEST_COUNT: usize = 8;
        let barrier = Arc::new(std::sync::Barrier::new(REQUEST_COUNT));
        let handles = (0..REQUEST_COUNT)
            .map(|_| {
                let barrier = barrier.clone();
                thread::spawn(move || {
                    barrier.wait();
                    pdfium_instance().map(|pdfium| pdfium as *const Pdfium as usize)
                })
            })
            .collect::<Vec<_>>();
        let results = handles
            .into_iter()
            .map(|handle| {
                handle
                    .join()
                    .expect("concurrent Pdfium initialization must never panic")
            })
            .collect::<Vec<_>>();

        let initialized = results[0].is_ok();
        assert!(
            results.iter().all(|result| result.is_ok() == initialized),
            "all callers must observe the same cached initialization result"
        );
        if let Ok(first_pointer) = results[0] {
            assert!(
                results
                    .iter()
                    .all(|result| result.as_ref() == Ok(&first_pointer)),
                "all callers must receive the same Pdfium instance"
            );
        }
    }

    #[test]
    fn benchmark_pdfium_document_when_configured() {
        let path = match std::env::var("DATATEX_PDF_BENCH_PATH") {
            Ok(path) => path,
            Err(_) => return,
        };
        let page_number = std::env::var("DATATEX_PDF_BENCH_PAGE")
            .ok()
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(1);
        let scale = std::env::var("DATATEX_PDF_BENCH_SCALE")
            .ok()
            .and_then(|value| value.parse::<f32>().ok())
            .unwrap_or(1.25);
        let device_pixel_ratio = std::env::var("DATATEX_PDF_BENCH_DPR")
            .ok()
            .and_then(|value| value.parse::<f32>().ok())
            .unwrap_or(MIN_DEVICE_PIXEL_RATIO);
        let mut renderer = PdfRenderer::default();
        let document = renderer
            .open_document(path)
            .expect("benchmark PDF should open");
        let request = PdfiumRenderPageRequest {
            doc_id: document.doc_id.clone(),
            page_number,
            scale,
            rotation: 0,
            device_pixel_ratio,
        };

        let initial = renderer
            .render_page(request.clone())
            .expect("initial benchmark page should render");
        let cold = if initial.cache_hit {
            fs::remove_file(&initial.image_path)
                .expect("existing benchmark cache entry should be removable");
            renderer
                .render_page(request.clone())
                .expect("cold benchmark page should render")
        } else {
            initial
        };
        let warm = renderer
            .render_page(request)
            .expect("warm benchmark page should render");

        assert!(!cold.cache_hit);
        assert!(warm.cache_hit);
        eprintln!(
            "PDFIUM_BENCH pages={} open_ms={} page={} scale={} dpr={} raster={}x{} cold_ms={} page_load_ms={} pdfium_ms={} encode_ms={} warm_ms={}",
            document.num_pages,
            document.open_time_ms,
            page_number,
            scale,
            device_pixel_ratio,
            cold.width,
            cold.height,
            cold.render_time_ms,
            cold.page_load_time_ms,
            cold.raster_time_ms,
            cold.encode_time_ms,
            warm.render_time_ms,
        );
    }
}
