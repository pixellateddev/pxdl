# Roadmap: CLI Refactor & Command Simplification

This document outlines the planned changes to the `pxdl` CLI to prioritize the interactive dashboard and simplify commands.

## 1. Primary Entry Point
- `pxdl` (no arguments) -> Launches the **Interactive Dashboard** (formerly `pxdl dash`). This is now the default behavior.

## 2. Adding Downloads
- `pxdl add <url> [options]` -> The explicit command to add a download.
- (Optional) We may remove the implicit `pxdl <url>` to prevent collision with future subcommands.

## 3. Daemon Management (Top-level)
- `pxdl start`  -> Starts the background daemon.
- `pxdl stop`   -> Stops the background daemon.
- `pxdl status` -> Checks daemon health.

## 4. One-shot Task Management (Non-interactive)
- `pxdl list` -> Display a quick summary table of downloads.
- `pxdl pause <id|all>` -> Pause tasks.
- `pxdl resume <id|all>` -> Resume tasks.
- `pxdl remove <id> [--clean]` -> Remove task.

## 5. Intelligent Daemon Auto-start
- **Global Middleware Behavior:** For any command that requires the daemon (e.g., dashboard, `add`, `list`, `pause`, `resume`, `remove`), the CLI will:
    1. Detect if the daemon is offline.
    2. Automatically launch the daemon in the background.
    3. Wait for the daemon to become responsive before executing the intended command.
    4. Provide a subtle "Daemon offline, starting..." status message.
- This ensures the user never has to manually run `pxdl start` unless they want to specifically ensure it's running beforehand.

## 6. Implementation Strategy
1. **Default Action:** Update the CLI entry point to check if any arguments are provided. If not, trigger `startDashboard()`.
2. **Subcommand Routing:** Refactor the `switch/case` logic to handle the new top-level commands.
