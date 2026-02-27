use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Clone)]
pub struct TerminalSession {
    #[allow(dead_code)]
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
}

pub struct TerminalManager {
    sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn spawn_terminal(
        &self,
        app_handle: AppHandle,
        working_dir: String,
    ) -> Result<String, String> {
        let session_id = Uuid::new_v4().to_string();

        // Create PTY system
        let pty_system = native_pty_system();

        // Create PTY with initial size
        let pair = pty_system
            .openpty(PtySize {
                rows: 30,
                cols: 120,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        // Get reader and writer
        let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

        // Detect shell: Try $SHELL env var first, then fallback to common shells
        let shell = std::env::var("SHELL")
            .ok()
            .and_then(|s| {
                if !s.is_empty() && std::path::Path::new(&s).exists() {
                    Some(s)
                } else {
                    None
                }
            })
            .or_else(|| {
                // Fallback order: zsh, bash, sh
                for shell in &["zsh", "bash", "sh"] {
                    if which::which(shell).is_ok() {
                        return Some(shell.to_string());
                    }
                }
                None
            })
            .ok_or_else(|| "No suitable shell found (tried: $SHELL, zsh, bash, sh)".to_string())?;

        // Build command - spawn detected shell
        let mut cmd = CommandBuilder::new(&shell);
        cmd.cwd(&working_dir);

        // Spawn child process
        let _child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell ({}): {}", shell, e))?;

        // Store session
        let session = TerminalSession {
            writer: Arc::new(Mutex::new(writer)),
        };

        self.sessions
            .lock()
            .unwrap()
            .insert(session_id.clone(), session);

        // Spawn thread to read output
        let output_session_id = session_id.clone();
        let app_handle_clone = app_handle.clone();
        std::thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let data = &buf[..n];
                        // Try to convert to UTF-8, replacing invalid sequences
                        let output = String::from_utf8_lossy(data).to_string();
                        let event_name = format!("terminal-output-{}", output_session_id);
                        let _ = app_handle_clone.emit(&event_name, output);
                    }
                    Err(_) => break,
                }
            }
        });

        Ok(session_id)
    }

    pub fn write_terminal(&self, session_id: String, data: String) -> Result<(), String> {
        let sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get(&session_id)
            .ok_or_else(|| "Session not found".to_string())?;

        let mut writer = session.writer.lock().unwrap();
        writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn resize_terminal(
        &self,
        _session_id: String,
        _cols: u16,
        _rows: u16,
    ) -> Result<(), String> {
        // PTY resizing would require keeping reference to the master PTY
        // For now, we'll skip this as it's not critical
        Ok(())
    }

    pub fn close_terminal(&self, session_id: String) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        sessions.remove(&session_id);
        Ok(())
    }
}
