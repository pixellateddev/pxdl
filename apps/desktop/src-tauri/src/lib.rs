use axum::{extract::State, http::StatusCode, routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProbeResult {
    url: String,
    filename: String,
    size: i64,
    is_resumable: bool,
    content_type: String,
}

#[derive(Clone)]
struct AppState {
    app_handle: tauri::AppHandle,
}

async fn intercept_handler(
    State(state): State<Arc<AppState>>,
    Json(probe): Json<ProbeResult>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let window = state
        .app_handle
        .get_webview_window("main")
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;

    window.show().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    window
        .unminimize()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    window
        .set_focus()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    state
        .app_handle
        .emit("download:intercept", &probe)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

fn spawn_intercept_server(app_handle: tauri::AppHandle) {
    let state = Arc::new(AppState { app_handle });
    let app = Router::new()
        .route("/intercept", post(intercept_handler))
        .with_state(state);

    tauri::async_runtime::spawn(async move {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:18282")
            .await
            .expect("failed to bind port 18282");
        axum::serve(listener, app)
            .await
            .expect("intercept server error");
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Spawn daemon sidecar
            let sidecar_command = app.shell().sidecar("pxdl-daemon").unwrap();
            let (mut _rx, _child) = sidecar_command.spawn().unwrap();

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // System tray
            let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Spawn Axum intercept listener
            spawn_intercept_server(app.handle().clone());

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
