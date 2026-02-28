use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, State};

mod terminal;
use terminal::TerminalManager;

mod git_shell;

#[derive(serde::Serialize, serde::Deserialize)]
struct WindowBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[tauri::command]
async fn open_side_browser(
    app: tauri::AppHandle,
    url: String,
    main_bounds: WindowBounds,
) -> Result<(), String> {
    // Close existing side browser if it exists
    if let Some(window) = app.get_webview_window("side-browser") {
        let _ = window.close();
    }

    // Calculate position for right half of the screen
    let x = main_bounds.x + (main_bounds.width / 2.0);
    let y = main_bounds.y;
    let width = main_bounds.width / 2.0;
    let height = main_bounds.height;

    // Create a new webview window for the browser
    WebviewWindowBuilder::new(
        &app,
        "side-browser",
        WebviewUrl::External(url.parse().map_err(|e| format!("Invalid URL: {}", e))?)
    )
    .title("Browser")
    .position(x, y)
    .inner_size(width, height)
    .resizable(false)
    .decorations(true)
    .always_on_top(false)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn close_side_browser(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("side-browser") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn spawn_terminal(
    app: tauri::AppHandle,
    terminal_manager: State<'_, TerminalManager>,
    working_dir: String,
) -> Result<String, String> {
    terminal_manager.spawn_terminal(app, working_dir)
}

#[tauri::command]
async fn write_terminal(
    terminal_manager: State<'_, TerminalManager>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    terminal_manager.write_terminal(session_id, data)
}

#[tauri::command]
async fn resize_terminal(
    terminal_manager: State<'_, TerminalManager>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    terminal_manager.resize_terminal(session_id, cols, rows)
}

#[tauri::command]
async fn close_terminal(
    terminal_manager: State<'_, TerminalManager>,
    session_id: String,
) -> Result<(), String> {
    terminal_manager.close_terminal(session_id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(TerminalManager::new())
        .invoke_handler(tauri::generate_handler![
            open_side_browser,
            close_side_browser,
            spawn_terminal,
            write_terminal,
            resize_terminal,
            close_terminal,
            git_shell::git_get_status,
            git_shell::git_commit,
            git_shell::git_push,
            git_shell::git_pull,
            git_shell::git_sync,
            git_shell::git_is_repository,
            git_shell::git_initialize,
            git_shell::git_lfs_available,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
