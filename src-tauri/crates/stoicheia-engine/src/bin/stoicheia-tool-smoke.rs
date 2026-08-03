//! Native fake TeX tool used only by the cross-platform integration smoke test.
//!
//! The test copies this executable under compiler and `dvisvgm` names. That
//! exercises the production executable discovery and process-spawn path on the
//! host OS without requiring a complete TeX distribution on CI runners.

use std::{env, fs, path::Path};

fn increment_counter(name: &str) -> Result<(), String> {
    let Some(directory) = env::var_os("STOICHEIA_SMOKE_COUNTER_DIR") else {
        return Ok(());
    };
    let path = Path::new(&directory).join(name);
    let current = fs::read_to_string(&path)
        .ok()
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or_default();
    fs::write(path, (current + 1).to_string()).map_err(|error| error.to_string())
}

fn main() -> Result<(), String> {
    let executable = env::current_exe().map_err(|error| error.to_string())?;
    let executable_name = executable
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let is_dvisvgm = executable_name.contains("dvisvgm");
    let version_requested = env::args().skip(1).any(|argument| argument == "--version");

    if version_requested {
        println!(
            "{}",
            if is_dvisvgm {
                "dvisvgm DataTeX native smoke 1.0"
            } else {
                "lualatex DataTeX native smoke 1.0"
            }
        );
        return Ok(());
    }

    if is_dvisvgm {
        increment_counter("dvisvgm-renders")?;
        fs::write(
            "document.svg",
            r#"<svg xmlns="http://www.w3.org/2000/svg" data-datatex-native-smoke="ok"><rect width="1" height="1"/></svg>"#,
        )
        .map_err(|error| error.to_string())?;
    } else {
        increment_counter("latex-renders")?;
        fs::write("document.dvi", b"DataTeX native exact-preview smoke")
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}
