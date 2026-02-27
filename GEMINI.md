# GEMINI.md - pxdl Context

## Project Overview
`pxdl` is a high-performance, segmented download manager built with **Bun** and **TypeScript**. It follows a client-server architecture where a background daemon manages the download queue and multi-threaded (segmented) downloads, while a CLI provides a user-friendly interface and a real-time dashboard.

### Core Technologies
- **Runtime:** [Bun](https://bun.sh) (v1.x)
- **Language:** TypeScript
- **Database:** SQLite (via `bun:sqlite`) for task persistence.
- **CLI UI:** [Ink](https://github.com/vadimdemedes/ink) (React in the terminal) for the dashboard.
- **Tooling:** [Biome](https://biomejs.dev/) for linting and formatting.

## Architecture
- **CLI (`src/cli/`):** Handles user input, probes URLs, and communicates with the daemon via a local HTTP API (port 8000).
- **Daemon (`src/daemon/`):** A background process that orchestrates the download queue, manages segments, and handles file I/O.
- **Core (`src/core/`):** Contains shared logic for database operations (`db.ts`), the segmented downloading engine (`downloader.ts`), and URL probing (`probe.ts`).
- **Data Persistence:** Stores configuration and the SQLite database in `~/.pxdl/`.

## Getting Started

### Installation
```bash
bun install
```

### Development
- **Run CLI:** `bun run dev <url>` or `bun run dev dash`
- **Run Daemon (Foreground):** `bun run src/daemon/index.ts`
- **Linting/Formatting:** `bun x @biomejs/biome check --write .`

### Building and Deployment
- **Build All:** `bun run build:all` (Produces binaries in `bin/`)
- **Global Install:** `bun run install:global` (Requires sudo to move binaries to `/usr/local/bin`)

## CLI Usage
- `pxdl`: Open the interactive Ink-based dashboard (default).
- `pxdl add <url>`: Add a new download to the queue.
- `pxdl list`: Display a quick summary table of downloads.
- `pxdl pause <id|all>`: Pause tasks.
- `pxdl resume <id|all>`: Resume tasks.
- `pxdl remove <id> [--clean]`: Remove task and optionally delete the file.
- `pxdl start`: Start the download daemon in the background.
- `pxdl stop`: Stop the background daemon.
- `pxdl status`: Check if the daemon is running.

## Development Conventions
- **Coding Style:** Always use **arrow functions** (`const fn = () => ...`) instead of the `function` keyword for consistency.
- **Formatting:** Strictly adhere to Biome configurations (`biome.json`). Run `biome check --write` before committing.
- **Type Safety:** Ensure all new features are fully typed in `src/types.ts`.
- **Error Handling:** CLI should fail gracefully with user-friendly messages. Daemon should log detailed errors to `~/.pxdl/daemon.log`.
- **Database:** Use `src/core/db.ts` for all SQLite interactions. Always update both `downloads` and `segments` tables correctly during the download lifecycle.
