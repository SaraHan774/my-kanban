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
use unicode_normalization::UnicodeNormalization;

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

        // Get parent directory to watch (for vi/vim compatibility)
        let parent_dir = path.parent()
            .ok_or_else(|| "File has no parent directory".to_string())?
            .to_path_buf();

        let file_name = path.file_name()
            .ok_or_else(|| "Invalid file path".to_string())?
            .to_string_lossy()
            .to_string();

        // Check if already watching
        let mut watchers = self.watchers.lock().unwrap();
        if watchers.contains_key(&file_path) {
            return Ok(()); // Already watching
        }

        let app_clone = app.clone();
        let file_path_clone = file_path.clone();
        let file_name_clone = file_name.clone();

        // Create debounced watcher (waits 300ms after last event for better editor compatibility)
        let mut debouncer = new_debouncer(
            Duration::from_millis(300),
            None,
            move |result: DebounceEventResult| {
                match result {
                    Ok(events) => {
                        let mut should_emit = false;

                        for event in events {
                            // For VSCode/TextEdit atomic saves, we need to check if ANY event
                            // in this batch affects our target file. This includes:
                            // 1. Direct modifications (vi/vim style)
                            // 2. Rename events where destination is our file (VSCode/TextEdit style)
                            // 3. Create events for our file

                            for event_path in &event.paths {
                                // Get the full path as string for comparison
                                let event_path_str = event_path.to_string_lossy();

                                // Normalize both strings to NFC form for comparison (handles macOS NFD filenames)
                                let normalized_path: String = event_path_str.nfc().collect();
                                let normalized_target: String = file_name_clone.nfc().collect();

                                // Check if the event path ends with our target filename
                                // This catches both direct edits and atomic save renames
                                if normalized_path.ends_with(&normalized_target) {
                                    should_emit = true;
                                    break;
                                }

                                // Also check just the filename for safety
                                if let Some(name) = event_path.file_name() {
                                    let event_filename = name.to_string_lossy();
                                    let normalized_event: String = event_filename.nfc().collect();
                                    if normalized_event == normalized_target {
                                        should_emit = true;
                                        break;
                                    }
                                }
                            }

                            if should_emit {
                                break;
                            }
                        }

                        if should_emit {
                            let _ = app_clone.emit("file-changed", file_path_clone.clone());
                        }
                    }
                    Err(_) => {}
                }
            },
        )
        .map_err(|e| format!("Failed to create file watcher: {}", e))?;

        // Watch the parent directory (not the file itself - for vi/vim compatibility)
        debouncer
            .watcher()
            .watch(&parent_dir, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to watch directory: {}", e))?;

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
                            let _ = app_clone.emit("workspace-changed", ());
                        }
                    }
                    Err(_) => {}
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
