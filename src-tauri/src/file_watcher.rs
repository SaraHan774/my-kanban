use notify_debouncer_full::{
    new_debouncer,
    notify::{RecommendedWatcher, RecursiveMode, Watcher},
    DebounceEventResult, Debouncer, FileIdMap,
};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub struct FileWatcherManager {
    watchers: Arc<Mutex<HashMap<String, Debouncer<RecommendedWatcher, FileIdMap>>>>,
}

impl FileWatcherManager {
    pub fn new() -> Self {
        Self {
            watchers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn watch_file(&self, app: AppHandle, file_path: String) -> Result<(), String> {
        let path = PathBuf::from(&file_path);

        // Check if already watching
        let mut watchers = self.watchers.lock().unwrap();
        if watchers.contains_key(&file_path) {
            return Ok(()); // Already watching
        }

        let app_clone = app.clone();
        let file_path_clone = file_path.clone();
        let path_buf = path.clone();

        // Create debounced watcher (waits 100ms after last event)
        let mut debouncer = new_debouncer(
            Duration::from_millis(100),
            None,
            move |result: DebounceEventResult| {
                match result {
                    Ok(events) => {
                        for event in events {
                            // Check if any of the event paths match our watched file
                            for event_path in &event.paths {
                                let canonical_event = event_path.canonicalize().unwrap_or(event_path.clone());
                                let canonical_watched = path_buf.canonicalize().unwrap_or(path_buf.clone());

                                // Compare canonical paths to handle symlinks and relative paths
                                if canonical_event == canonical_watched {
                                    let _ = app_clone.emit("file-changed", file_path_clone.clone());
                                    break;
                                }
                            }
                        }
                    }
                    Err(errors) => {
                        eprintln!("File watcher error: {:?}", errors);
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to create file watcher: {}", e))?;

        // Watch the file
        debouncer
            .watcher()
            .watch(&path, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to watch file: {}", e))?;

        // Store the debouncer (which contains the watcher)
        // We need to keep it alive
        watchers.insert(file_path, debouncer);

        Ok(())
    }

    pub fn watch_workspace(&self, app: AppHandle, workspace_path: String) -> Result<(), String> {
        let path = PathBuf::from(&workspace_path);

        // Check if already watching
        let mut watchers = self.watchers.lock().unwrap();
        let watch_key = format!("workspace:{}", workspace_path);
        if watchers.contains_key(&watch_key) {
            return Ok(()); // Already watching
        }

        let app_clone = app.clone();

        // Create debounced watcher (waits 200ms after last event for workspace)
        let mut debouncer = new_debouncer(
            Duration::from_millis(200),
            None,
            move |result: DebounceEventResult| {
                match result {
                    Ok(events) => {
                        let mut has_changes = false;
                        for event in events {
                            // Check for any .md file changes (create, remove, modify)
                            for path in &event.paths {
                                if let Some(ext) = path.extension() {
                                    if ext == "md" {
                                        has_changes = true;
                                        break;
                                    }
                                }
                            }
                            if has_changes {
                                break;
                            }
                        }

                        if has_changes {
                            // Emit workspace-changed event to frontend
                            let _ = app_clone.emit("workspace-changed", ());
                        }
                    }
                    Err(errors) => {
                        eprintln!("Workspace watcher error: {:?}", errors);
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to create workspace watcher: {}", e))?;

        // Watch the workspace directory (non-recursive, only top level)
        debouncer
            .watcher()
            .watch(&path, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to watch workspace: {}", e))?;

        // Store the debouncer
        watchers.insert(watch_key, debouncer);

        Ok(())
    }

    pub fn unwatch_file(&self, file_path: String) -> Result<(), String> {
        let mut watchers = self.watchers.lock().unwrap();

        if watchers.remove(&file_path).is_some() {
            Ok(())
        } else {
            Err("File was not being watched".to_string())
        }
    }

    pub fn unwatch_all(&self) {
        let mut watchers = self.watchers.lock().unwrap();
        watchers.clear();
    }
}

#[tauri::command]
pub async fn watch_file(
    app: AppHandle,
    file_watcher: tauri::State<'_, FileWatcherManager>,
    file_path: String,
) -> Result<(), String> {
    file_watcher.watch_file(app, file_path)
}

#[tauri::command]
pub async fn unwatch_file(
    file_watcher: tauri::State<'_, FileWatcherManager>,
    file_path: String,
) -> Result<(), String> {
    file_watcher.unwatch_file(file_path)
}

#[tauri::command]
pub async fn watch_workspace(
    app: AppHandle,
    file_watcher: tauri::State<'_, FileWatcherManager>,
    workspace_path: String,
) -> Result<(), String> {
    file_watcher.watch_workspace(app, workspace_path)
}
