# Roadmap: Tauri Native Desktop Application

This document outlines the plan to transform `pxdl` into a lightweight, high-performance native desktop application using **Tauri**.

## 1. Architecture: The "Sidecar" Pattern

Unlike Electron, we will use Tauri to wrap our existing high-performance Bun logic.

*   **Frontend (UI):** Built with React + TypeScript + Vanilla CSS. This will be the modern version of the Ink dashboard.
*   **Backend (Tauri/Rust):** Handles OS-level integrations (System Tray, File Dialogs, Native Menus).
*   **Sidecar (Bun Daemon):** The existing `pxdl-daemon` will be bundled as a "sidecar" binary. Tauri will manage its lifecycle (starting/stopping it with the app).
*   **Communication:** The Frontend will talk to the Bun Daemon via the existing HTTP API (`localhost:8000`).

## 2. Key Native Features

### System Tray Integration
- [ ] Real-time download speed displayed in the menu bar/tray.
- [ ] "Minimize to Tray" behavior (daemon keeps running when the window is closed).
- [ ] Quick actions: Pause All, Resume All, Quit.

### OS Deep Integration
- [ ] **Native File Picker:** Use OS-native dialogs to select download directories.
- [ ] **Show in Finder/Explorer:** Open the containing folder for completed downloads.
- [ ] **Drag and Drop:** Drag URLs or files into the window to start downloads.
- [ ] **Auto-Start:** Option to launch `pxdl` on system login.

## 3. Implementation Phases

### Phase 1: The Web UI
- [ ] Create a responsive React dashboard that mirrors the functionality of the CLI version.
- [ ] Implement theme support (Light/Dark mode).
- [ ] Optimize the UI for real-time updates from the `/status` endpoint.

### Phase 2: Tauri Setup
- [ ] Initialize Tauri in the project.
- [ ] Configure the Bun daemon as a sidecar binary for macOS, Linux, and Windows.
- [ ] Implement Rust-side logic to ensure the daemon is killed when the app is fully exited.

### Phase 3: Native Polish
- [ ] Add the System Tray icon and context menu.
- [ ] Implement native notifications for completed/failed tasks.
- [ ] Build the release pipeline (DMG for macOS, AppImage/Deb for Linux, MSI for Windows).

## 4. Why Tauri over Electron?
1.  **Memory Usage:** ~30-50MB RAM vs 150MB+ for Electron.
2.  **Binary Size:** ~10MB vs 100MB+ for Electron.
3.  **Security:** Rust-based backend with fine-grained API permissions.
4.  **Native Feel:** Uses the system's actual webview engine.
