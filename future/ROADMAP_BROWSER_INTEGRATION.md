# Roadmap: Browser Integration (IDM-like)

This document outlines the plan to implement browser integration for `pxdl`, allowing for automatic download interception and video stream detection.

## 1. Architecture Overview

The integration follows a four-tier architecture:
1.  **Browser Extension:** Detects downloads/videos and captures session context (Cookies, UA).
2.  **Native Messaging Host (The Bridge):** A local script that bypasses browser sandboxing to talk to the `pxdl` daemon.
3.  **pxdl Daemon:** Receives the forwarded requests and manages the downloads.
4.  **Core Downloader:** Uses captured session headers to impersonate the browser and bypass authentication/anti-leech protections.

## 2. Technical Requirements

### Core & Daemon (Prerequisites)
- [ ] **Header Support:** Update `DownloadTask` and the SQLite schema to store custom HTTP headers.
- [ ] **Impersonation:** Update `src/core/downloader.ts` to inject provided `Cookie`, `User-Agent`, and `Referer` headers into every segment request.
- [ ] **CORS/Private Network Access:** Update `src/daemon/index.ts` to handle `OPTIONS` preflight requests if we allow direct extension-to-daemon communication.

### The Bridge (Native Messaging Host)
- [ ] **Protocol Implementation:** Create `src/bin/bridge.ts` to handle the standard I/O protocol (4-byte length prefix + JSON).
- [ ] **Forwarding Logic:** The bridge should send a POST request to `localhost:8000/add` with the browser's data.

### Browser Extension
- [ ] **Download Interceptor:** Use `chrome.downloads.onCreated` to catch and cancel browser downloads.
- [ ] **Video Sniffer:** Use `chrome.webRequest` or `chrome.declarativeNetRequest` to identify video MIME types (mp4, m4v, webm) and manifests (m3u8, mpd).
- [ ] **UI Injection:** Content script to inject a "Download with pxdl" button near detected video players.

### Distribution & Installer
- [ ] **Global Installer:** A script to move `pxdl`, `pxdl-daemon`, and `pxdl-bridge` to `/usr/local/bin`.
- [ ] **Host Registration:** Automatically register the Native Messaging JSON manifest in the OS-specific directory:
    - macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
    - Linux: `~/.config/google-chrome/NativeMessagingHosts/`

## 3. Next Steps
1.  **Refactor Core:** Add `headers` support to `src/types.ts` and `src/core/db.ts`.
2.  **Update Downloader:** Implement header injection in `src/core/downloader.ts`.
3.  **Prototype Bridge:** Create a minimal working bridge to test communication with Chrome.
