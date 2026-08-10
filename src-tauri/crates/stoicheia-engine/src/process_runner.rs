//! External-process boundary for exact LaTeX previews.
//!
//! Standalone Stoicheia keeps its original Tokio runner. DataTeX can inject a
//! tracked runner without making this engine depend on the host application or
//! introducing a second compilation manager.

use std::{future::Future, io, pin::Pin, process::Output, time::Duration};

use tokio::{process::Command, time::timeout};

pub type ProcessRunFuture<'a> =
    Pin<Box<dyn Future<Output = Result<Output, ProcessRunError>> + Send + 'a>>;

#[derive(Debug)]
pub enum ProcessRunError {
    Io(io::Error),
    TimedOut,
    Interrupted(String),
}

/// Narrow host seam for launching the LaTeX and `dvisvgm` stages.
///
/// Implementations must not return until the child has exited and its output
/// pipes have closed. This guarantees that the temporary workspace can be
/// removed safely after a timeout or cancellation.
pub trait ExternalProcessRunner: Send + Sync {
    fn ensure_active(&self) -> Result<(), String> {
        Ok(())
    }

    fn run<'a>(&'a self, command: Command, timeout_duration: Duration) -> ProcessRunFuture<'a>;
}

#[derive(Debug, Default, Clone, Copy)]
pub struct DirectProcessRunner;

impl ExternalProcessRunner for DirectProcessRunner {
    fn run<'a>(&'a self, mut command: Command, timeout_duration: Duration) -> ProcessRunFuture<'a> {
        Box::pin(async move {
            command.kill_on_drop(true);
            match timeout(timeout_duration, command.output()).await {
                Ok(result) => result.map_err(ProcessRunError::Io),
                Err(_) => Err(ProcessRunError::TimedOut),
            }
        })
    }
}
