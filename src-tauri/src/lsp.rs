#![allow(dead_code)]

use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};

/// LSP Request structure
#[derive(Debug, Clone)]
pub struct LspRequest {
    pub id: i64,
    pub method: String,
    pub params: Value,
}

/// LSP Response structure
#[derive(Debug, Clone)]
pub struct LspResponse {
    pub id: Option<i64>,
    pub result: Option<Value>,
    pub error: Option<Value>,
}

/// Manager για το texlab LSP server process
pub struct TexlabManager {
    process: Option<Child>,
    request_id: i64,
}

impl TexlabManager {
    pub fn new() -> Self {
        Self {
            process: None,
            request_id: 0,
        }
    }

    /// Ξεκινάει το texlab server
    pub async fn start(&mut self) -> Result<(), String> {
        if self.process.is_some() {
            return Err("Texlab server is already running".to_string());
        }

        // Ensure texlab is available (download if needed)
        let texlab_path = crate::texlab_downloader::ensure_texlab().await?;

        // Δημιουργία child process για το texlab
        let child = Command::new(&texlab_path)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start texlab at {:?}: {}", texlab_path, e))?;

        self.process = Some(child);
        Ok(())
    }

    /// Σταματάει το texlab server
    pub async fn stop(&mut self) -> Result<(), String> {
        if let Some(mut child) = self.process.take() {
            // Προσπάθεια graceful shutdown με LSP shutdown request
            let _ = self.send_shutdown_request().await;

            child
                .kill()
                .await
                .map_err(|e| format!("Failed to kill texlab: {}", e))?;
            Ok(())
        } else {
            Err("Texlab server is not running".to_string())
        }
    }

    /// Δημιουργεί το επόμενο request ID
    fn next_request_id(&mut self) -> i64 {
        self.request_id += 1;
        self.request_id
    }

    /// Στέλνει LSP request στο texlab
    pub async fn send_request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        if self.process.is_none() {
            return Err("Texlab server is not running".to_string());
        }

        let id = self.next_request_id();

        // Δημιουργία JSON-RPC 2.0 request
        let request = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params
        });

        let request_str = serde_json::to_string(&request)
            .map_err(|e| format!("Failed to serialize request: {}", e))?;

        // Υπολογισμός Content-Length
        let content_length = request_str.len();
        let message = format!("Content-Length: {}\r\n\r\n{}", content_length, request_str);

        // Αποστολή του LSP message
        let child = self.process.as_mut().unwrap();

        // Read stderr in background to suppress errors
        if let Some(stderr) = child.stderr.take() {
            tokio::spawn(async move {
                let mut reader = tokio::io::BufReader::new(stderr);
                let mut line = String::new();
                while let Ok(n) =
                    tokio::io::AsyncBufReadExt::read_line(&mut reader, &mut line).await
                {
                    if n == 0 {
                        break;
                    }
                    // Suppress stderr output
                    line.clear();
                }
            });
        }

        let stdin = child
            .stdin
            .as_mut()
            .ok_or("Failed to get stdin".to_string())?;

        stdin
            .write_all(message.as_bytes())
            .await
            .map_err(|e| format!("Failed to write request: {}", e))?;
        stdin
            .flush()
            .await
            .map_err(|e| format!("Failed to flush: {}", e))?;

        // Ανάγνωση απάντησης - LOOP μέχρι να βρούμε το σωστό response
        let stdout = child
            .stdout
            .as_mut()
            .ok_or("Failed to get stdout".to_string())?;

        let mut reader = BufReader::new(stdout);

        // Loop για να διαβάσουμε πολλαπλά μηνύματα μέχρι να βρούμε το response με το σωστό id
        loop {
            let mut header_line = String::new();
            let mut content_length: usize = 0;
            let mut found_header = false;

            // Διάβασμα headers μέχρι να βρούμε κενή γραμμή (end of headers)
            let mut empty_count = 0;
            loop {
                header_line.clear();
                let bytes_read = reader
                    .read_line(&mut header_line)
                    .await
                    .map_err(|e| format!("Failed to read header: {}", e))?;

                // EOF - stream closed
                if bytes_read == 0 {
                    return Err("LSP server closed connection unexpectedly".to_string());
                }

                let trimmed = header_line.trim();

                // Κενή γραμμή σημαίνει τέλος headers (αλλά μόνο αν έχουμε ήδη βρει header)
                if trimmed.is_empty() {
                    if found_header {
                        break; // End of headers section
                    }
                    // Skip leading empty lines (before any header) - but not too many
                    empty_count += 1;
                    if empty_count > 100 {
                        return Err("Too many empty lines from LSP server".to_string());
                    }
                    continue;
                }

                found_header = true;

                // Parse Content-Length header (case-insensitive)
                if trimmed.to_lowercase().starts_with("content-length:") {
                    content_length = trimmed
                        .split(':')
                        .nth(1)
                        .ok_or("Invalid Content-Length format")?
                        .trim()
                        .parse()
                        .map_err(|e| format!("Failed to parse Content-Length: {}", e))?;
                }
                // Αγνοούμε άλλα headers (π.χ. Content-Type)
            }

            if content_length == 0 {
                return Err("No Content-Length header found".to_string());
            }

            // Διάβασμα του JSON message
            let mut buffer = vec![0; content_length];
            tokio::io::AsyncReadExt::read_exact(&mut reader, &mut buffer)
                .await
                .map_err(|e| format!("Failed to read message: {}", e))?;

            let message_str = String::from_utf8(buffer)
                .map_err(|e| format!("Failed to decode message: {}", e))?;

            let message: Value = serde_json::from_str(&message_str)
                .map_err(|e| format!("Failed to parse message: {}", e))?;

            // Έλεγχος αν είναι notification (δεν έχει id)
            if message.get("method").is_some() && message.get("id").is_none() {
                // Συνέχισε να διαβάζεις - αυτό είναι notification, όχι response
                continue;
            }

            // Έλεγχος αν είναι το response που περιμένουμε
            if let Some(msg_id) = message.get("id") {
                if msg_id.as_i64() == Some(id) {
                    // Βρήκαμε το response!

                    // Έλεγχος για errors
                    if let Some(error) = message.get("error") {
                        return Err(format!("LSP Error: {}", error));
                    }

                    // Επιστροφή του result
                    let result = message.get("result").cloned().unwrap_or(Value::Null);
                    return Ok(result);
                } else {
                    continue;
                }
            }

            // Αν φτάσαμε εδώ, κάτι πήγε στραβά
            return Err("Received unexpected message format".to_string());
        }
    }

    /// Στέλνει notification (χωρίς response)
    pub async fn send_notification(&mut self, method: &str, params: Value) -> Result<(), String> {
        if let Some(ref mut child) = self.process {
            // Δημιουργία JSON-RPC 2.0 notification (χωρίς id)
            let notification = json!({
                "jsonrpc": "2.0",
                "method": method,
                "params": params
            });

            let notification_str = serde_json::to_string(&notification)
                .map_err(|e| format!("Failed to serialize notification: {}", e))?;

            // Υπολογισμός Content-Length
            let content_length = notification_str.len();
            let message = format!(
                "Content-Length: {}\r\n\r\n{}",
                content_length, notification_str
            );

            // Αποστολή του LSP message
            let stdin = child
                .stdin
                .as_mut()
                .ok_or("Failed to get stdin".to_string())?;

            stdin
                .write_all(message.as_bytes())
                .await
                .map_err(|e| format!("Failed to write notification: {}", e))?;
            stdin
                .flush()
                .await
                .map_err(|e| format!("Failed to flush: {}", e))?;

            Ok(())
        } else {
            Err("Texlab server is not running".to_string())
        }
    }

    /// Στέλνει shutdown request
    async fn send_shutdown_request(&mut self) -> Result<(), String> {
        let _ = self.send_request("shutdown", Value::Null).await?;
        let _ = self.send_notification("exit", Value::Null).await?;
        Ok(())
    }

    /// Ελέγχει αν το texlab τρέχει
    pub fn is_running(&self) -> bool {
        self.process.is_some()
    }
}

impl Drop for TexlabManager {
    fn drop(&mut self) {
        // Sync drop - just kill the process
        if let Some(child) = self.process.take() {
            let _ = std::process::Command::new("kill")
                .arg("-9")
                .arg(child.id().unwrap().to_string())
                .output();
        }
    }
}
