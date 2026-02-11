use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            open_side_browser,
            close_side_browser
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
