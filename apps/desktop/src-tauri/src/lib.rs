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

fn register_native_messaging_host() {
    let current_exe = match std::env::current_exe() {
        Ok(p) => p,
        Err(e) => {
            log::warn!("native messaging host: could not resolve current exe: {}", e);
            return;
        }
    };

    let bin_dir = match current_exe.parent() {
        Some(p) => p.to_path_buf(),
        None => {
            log::warn!("native messaging host: could not get binary directory");
            return;
        }
    };

    let bridge_bin = bin_dir.join(if cfg!(windows) {
        "pxdl-bridge.exe"
    } else {
        "pxdl-bridge"
    });

    let bridge_path_str = bridge_bin.to_string_lossy().replace('\\', "\\\\");

    let host_json = format!(
        r#"{{
  "name": "dev.pxdl.bridge",
  "description": "pxdl Native Messaging Bridge",
  "path": "{}",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://lfglfmoihoioaclajdfflcjkfdjgkdjl/"
  ]
}}"#,
        bridge_path_str
    );

    #[cfg(target_os = "macos")]
    {
        let home = match std::env::var("HOME") {
            Ok(h) => std::path::PathBuf::from(h),
            Err(e) => {
                log::warn!("native messaging host: HOME not set: {}", e);
                return;
            }
        };

        let browsers = [
            home.join("Library/Application Support/Google/Chrome/NativeMessagingHosts"),
            home.join("Library/Application Support/Chromium/NativeMessagingHosts"),
            home.join("Library/Application Support/Microsoft Edge/NativeMessagingHosts"),
        ];

        for dir in &browsers {
            if let Err(e) = std::fs::create_dir_all(dir) {
                log::warn!("native messaging host: could not create dir {:?}: {}", dir, e);
                continue;
            }
            let dest = dir.join("dev.pxdl.bridge.json");
            if let Err(e) = std::fs::write(&dest, &host_json) {
                log::warn!("native messaging host: could not write {:?}: {}", dest, e);
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        use winreg::enums::{HKEY_CURRENT_USER, KEY_SET_VALUE};
        use winreg::RegKey;

        let appdata = match std::env::var("APPDATA") {
            Ok(v) => std::path::PathBuf::from(v),
            Err(e) => {
                log::warn!("native messaging host: APPDATA not set: {}", e);
                return;
            }
        };

        let browsers = [
            appdata.join("Google\\Chrome\\User Data\\NativeMessagingHosts"),
            appdata.join("Chromium\\User Data\\NativeMessagingHosts"),
            appdata.join("Microsoft\\Edge\\User Data\\NativeMessagingHosts"),
        ];

        let reg_paths = [
            "Software\\Google\\Chrome\\NativeMessagingHosts\\dev.pxdl.bridge",
            "Software\\Chromium\\NativeMessagingHosts\\dev.pxdl.bridge",
            "Software\\Microsoft\\Edge\\NativeMessagingHosts\\dev.pxdl.bridge",
        ];

        for (dir, reg_path) in browsers.iter().zip(reg_paths.iter()) {
            if let Err(e) = std::fs::create_dir_all(dir) {
                log::warn!("native messaging host: could not create dir {:?}: {}", dir, e);
                continue;
            }
            let dest = dir.join("dev.pxdl.bridge.json");
            if let Err(e) = std::fs::write(&dest, &host_json) {
                log::warn!("native messaging host: could not write {:?}: {}", dest, e);
                continue;
            }
            let hkcu = RegKey::predef(HKEY_CURRENT_USER);
            match hkcu.create_subkey_with_flags(reg_path, KEY_SET_VALUE) {
                Ok((key, _)) => {
                    if let Err(e) = key.set_value("", &dest.to_string_lossy().as_ref()) {
                        log::warn!("native messaging host: registry write failed for {}: {}", reg_path, e);
                    }
                }
                Err(e) => {
                    log::warn!("native messaging host: could not open registry key {}: {}", reg_path, e);
                }
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
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

            // Register native messaging host so the browser extension can find the bridge
            register_native_messaging_host();

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
