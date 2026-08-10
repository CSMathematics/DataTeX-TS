use std::io::{self, Write};
use std::panic;
use std::sync::OnceLock;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

static PROCESS_STARTED_AT: OnceLock<Instant> = OnceLock::new();
static DIAGNOSTICS_INITIALIZED: OnceLock<()> = OnceLock::new();
static DEBUG_ENABLED: OnceLock<bool> = OnceLock::new();

pub fn init() {
    DIAGNOSTICS_INITIALIZED.get_or_init(|| {
        PROCESS_STARTED_AT.get_or_init(Instant::now);
        if std::env::var_os("RUST_BACKTRACE").is_none() {
            std::env::set_var("RUST_BACKTRACE", "1");
        }

        let default_hook = panic::take_hook();
        panic::set_hook(Box::new(move |panic_info| {
            let thread = std::thread::current();
            let thread_name = thread.name().unwrap_or("<unnamed>");
            let location = panic_info
                .location()
                .map(|location| {
                    format!(
                        "{}:{}:{}",
                        location.file(),
                        location.line(),
                        location.column()
                    )
                })
                .unwrap_or_else(|| "<unknown>".to_string());
            let payload = panic_info
                .payload()
                .downcast_ref::<&str>()
                .copied()
                .or_else(|| {
                    panic_info
                        .payload()
                        .downcast_ref::<String>()
                        .map(String::as_str)
                })
                .unwrap_or("<non-string panic>");

            terminal_log(
                "FATAL",
                "PANIC",
                "unhandled-rust-panic",
                Some(&format!(
                    "thread={} location={} payload={}",
                    thread_name, location, payload
                )),
            );
            default_hook(panic_info);
        }));
    });
}

pub fn terminal_log(level: &str, scope: &str, event: &str, details: Option<&str>) {
    let elapsed_ms = PROCESS_STARTED_AT
        .get_or_init(Instant::now)
        .elapsed()
        .as_millis();
    let unix_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let thread_id = format!("{:?}", std::thread::current().id());
    let details = details
        .filter(|value| !value.is_empty())
        .map(|value| format!(" | {}", single_line(value, 8_000)))
        .unwrap_or_default();

    eprintln!(
        "[DATATEX][{}][+{}ms][pid={}][{}][{}][{}] {}{}",
        unix_ms,
        elapsed_ms,
        std::process::id(),
        thread_id,
        normalized_label(level, "INFO"),
        normalized_label(scope, "APP"),
        single_line(event, 200),
        details
    );
    let _ = io::stderr().flush();
}

pub fn debug_log(scope: &str, event: &str, details: Option<&str>) {
    let enabled = DEBUG_ENABLED.get_or_init(|| {
        std::env::var("DATATEX_DEBUG")
            .map(|value| !matches!(value.as_str(), "" | "0" | "false" | "off"))
            .unwrap_or(false)
    });
    if *enabled {
        terminal_log("DEBUG", scope, event, details);
    }
}

#[tauri::command]
pub fn frontend_debug_log_cmd(
    level: String,
    scope: String,
    message: String,
    details: Option<String>,
) {
    terminal_log(
        &level,
        &format!("UI:{}", scope),
        &message,
        details.as_deref(),
    );
}

fn normalized_label(value: &str, fallback: &str) -> String {
    let normalized = value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || matches!(character, '_' | '-'))
        .take(32)
        .collect::<String>()
        .to_ascii_uppercase();
    if normalized.is_empty() {
        fallback.to_string()
    } else {
        normalized
    }
}

fn single_line(value: &str, max_chars: usize) -> String {
    value
        .chars()
        .map(|character| match character {
            '\r' | '\n' | '\t' => ' ',
            _ => character,
        })
        .take(max_chars)
        .collect()
}
