# macOS & Windows Packaging

## Context

The app currently has no release packaging. Builds are manual, only target `aarch64-apple-darwin`, and the bridge binary is installed by a developer-only script (`install:global`). The goal is to produce distributable installers for macOS (`.dmg`, universal binary) and Windows (NSIS `.exe` / `.msi`), with automated CI/CD via GitHub Actions, and have the app automatically register the native messaging bridge on first launch instead of requiring a manual install step.

Distributed via GitHub Releases — no Apple Developer account or notarization. macOS users will see a Gatekeeper warning and can bypass it with `xattr -cr /Applications/Pixel\ Downloader.app`. Windows users will see a SmartScreen "unknown publisher" warning and can click "More info → Run anyway". Signing can be added later once the project gains traction.

---

## Part 1 — Fix App Identifier

**File:** `apps/desktop/src-tauri/tauri.conf.json`

- Change `"identifier"` from `"com.tauri.dev"` to `"dev.pxdl.app"`
- Add `"macOS"` bundle config (minimum system version `"10.15"`)
- Add `"windows"` bundle config (NSIS + MSI targets)

---

## Part 2 — Cross-Platform Daemon Sidecar Scripts

**File:** `apps/daemon/package.json`

Add build scripts using Bun's cross-compilation (`--target=bun-<os>-<arch>`):

```
build:sidecar:darwin-arm64   → bun-darwin-arm64   → bin/pxdl-daemon-aarch64-apple-darwin
build:sidecar:darwin-x64     → bun-darwin-x64     → bin/pxdl-daemon-x86_64-apple-darwin
build:sidecar:windows-x64    → bun-windows-x64    → bin/pxdl-daemon-x86_64-pc-windows-msvc.exe
```

Existing `build:sidecar` becomes an alias for `darwin-arm64` (dev convenience).

All three sidecars must exist in `apps/desktop/src-tauri/bin/` before Tauri's universal macOS build runs.

---

## Part 3 — Bundle Bridge Binary + Auto-Register Native Messaging Host

**Problem:** The bridge is currently installed manually via `install:global` and the native messaging host JSON has a hardcoded path `/usr/local/bin/pxdl-bridge`. Distributed users won't run that script.

**Solution:** Bundle the bridge inside the Tauri app as a second sidecar. On first launch, `lib.rs` writes the native messaging host JSON pointing to the bundled binary's actual path.

### 3a — Cross-Platform Bridge Build Scripts

**File:** `apps/bridge/package.json` — add the same three cross-target scripts as daemon:
```
build:sidecar:darwin-arm64   → pxdl-bridge-aarch64-apple-darwin
build:sidecar:darwin-x64     → pxdl-bridge-x86_64-apple-darwin
build:sidecar:windows-x64    → pxdl-bridge-x86_64-pc-windows-msvc.exe
```
Output directory: `../desktop/src-tauri/bin/`

### 3b — Add Bridge to Tauri Bundle

**File:** `apps/desktop/src-tauri/tauri.conf.json`
- Add `"bin/pxdl-bridge"` to `bundle.externalBin` (alongside the existing `bin/pxdl-daemon`)

**File:** `apps/desktop/src-tauri/capabilities/default.json`
- Add a second `shell:allow-execute` entry for `bin/pxdl-bridge` sidecar

### 3c — Auto-Register Native Messaging Host in lib.rs

**File:** `apps/desktop/src-tauri/src/lib.rs`

In `setup()`, after spawning the daemon, add a `register_native_messaging_host()` call that:

1. Resolves the bridge binary path from `std::env::current_exe().parent()`:
   - macOS: `.../Contents/MacOS/pxdl-bridge`
   - Windows: `...\pxdl-bridge.exe`

2. Builds the host JSON string with the resolved path and the hardcoded extension origin.

3. Writes it to the correct OS location:
   - **macOS Chrome:** `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/dev.pxdl.bridge.json`
   - **macOS Chromium:** `~/Library/Application Support/Chromium/NativeMessagingHosts/dev.pxdl.bridge.json`
   - **Windows Chrome:** `%APPDATA%\Google\Chrome\User Data\NativeMessagingHosts\dev.pxdl.bridge.json`
     + registry key `HKCU\Software\Google\Chrome\NativeMessagingHosts\dev.pxdl.bridge` → path to that JSON

4. Failures are logged but not fatal (app still runs without the extension working).

**File:** `apps/desktop/src-tauri/Cargo.toml`
- Add `winreg = "0.52"` as a Windows-only dependency:
  ```toml
  [target.'cfg(target_os = "windows")'.dependencies]
  winreg = "0.52"
  ```

---

## Part 4 — GitHub Actions Release Workflow

**New file:** `.github/workflows/release.yml`

### Triggers
- `workflow_dispatch` (manual trigger for testing)
- `push` to tags matching `v*`

### Jobs

#### `build-macos` (runs on `macos-latest`, arm64)
1. Checkout, setup Bun, install Rust + `x86_64-apple-darwin` target
2. `bun install`
3. Build daemon sidecars for both macOS architectures
4. Build bridge sidecars for both macOS architectures
5. Build UI: `bun run --filter pxdl-ui build`
6. Build Tauri universal app: `bunx tauri build --target universal-apple-darwin`
7. Upload `*.dmg` as release artifact

#### `build-windows` (runs on `windows-latest`)
1. Checkout, setup Bun, install Rust (x64)
2. `bun install`
3. Build daemon sidecar for Windows x64
4. Build bridge sidecar for Windows x64
5. Build UI: `bun run --filter pxdl-ui build`
6. Build Tauri: `bunx tauri build`
7. Upload `*.exe` (NSIS) + `*.msi` as release artifacts

### Code signing
Not included — distributing unsigned via GitHub Releases. Can be added later with:
- macOS: `APPLE_CERTIFICATE`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`
- Windows: `WINDOWS_CERTIFICATE`, `TAURI_PRIVATE_KEY`

---

## Part 5 — Turbo Task Updates

**File:** `turbo.json`

- Add `build:sidecar:darwin-arm64`, `build:sidecar:darwin-x64`, `build:sidecar:windows-x64` tasks with output `../desktop/src-tauri/bin/**`

---

## Critical Files Summary

| File | Change |
|------|--------|
| `apps/desktop/src-tauri/tauri.conf.json` | Fix identifier, add bridge to externalBin, bundle settings |
| `apps/desktop/src-tauri/capabilities/default.json` | Add bridge sidecar permission |
| `apps/desktop/src-tauri/Cargo.toml` | Add winreg (Windows-only dep) |
| `apps/desktop/src-tauri/src/lib.rs` | Auto-register native messaging host on startup |
| `apps/daemon/package.json` | Add 3 cross-platform build:sidecar scripts |
| `apps/bridge/package.json` | Add 3 cross-platform build:sidecar scripts |
| `turbo.json` | Add new sidecar build tasks |
| `.github/workflows/release.yml` | New — CI/CD release workflow |

---

## Verification

1. **Local macOS arm64 test:** Build daemon + bridge sidecars for darwin-arm64, run `bunx tauri build` in `apps/desktop`, open the `.app`, verify Chrome extension connects without any manual install step.

2. **Universal macOS (CI):** Trigger `workflow_dispatch`; confirm DMG contains a fat binary (`lipo -info Pixel\ Downloader`).

3. **Windows (CI):** Install the NSIS `.exe`, launch the app, verify registry key `HKCU\Software\Google\Chrome\NativeMessagingHosts\dev.pxdl.bridge` is written.

4. **Native messaging host:** After first launch on any platform, confirm `dev.pxdl.bridge.json` is written at the correct path with the real bridge binary location.
