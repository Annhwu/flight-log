# Flight Log

> A clean, offline desktop app to track your DCS World flight sessions.

Built with **Tauri v2** · **TypeScript** · **Vite** — Windows

---

## What it does

- **Live timer** — start/stop a session from the navbar, fill in the debrief when you land
- **Manual entry** — log any past flight with precise start/end times
- **DCS auto-tracking (beta)** — a hook installed in your Saved Games folder records your flights automatically (real start/end times, map, aircraft flown), with manual or automatic import
- **Profile** — configure your owned modules and maps; pickers in all forms are built from your collection
- **Mission types** — 8 presets + fully custom types
- **Tags** — every flight is tagged by mission type, map and aircraft, with customizable colors
- **History** — search, edit, and browse all your sessions in one place
- **Import / Export** — back up your log as JSON, restore modules, maps and tag colors independently from your profile
- **Steam integration** — add your Steam hours to the total displayed in the navbar
- **System tray** — keep recording in the background; never lose a session on close
- **Auto-updater** — one-click updates from GitHub, with SHA-256 verification

> ⚠️ **Auto-tracking is experimental.** Its file format may change between versions, so auto-recorded flights can become unreadable after a future update. For reliable, long-term records, prefer the **Live timer**.

## Customization

- 🌕 Light theme (parchment) · 🟤 Dark Brown theme
- 🇬🇧 English · 🇫🇷 Français · 🇷🇺 Русский

## Installation

Download the latest installer from the [Releases](../../releases) page.  
No setup required — all data is stored locally on your machine.

The Windows desktop app is and will always remain free.  
Future web and mobile versions may be offered under a paid plan.

## Build from source

```bash
npm install
npm run tauri build
```

Requires [Node.js ≥ 18](https://nodejs.org/) and [Rust](https://www.rust-lang.org/tools/install).

---

→ **[Full user guide](GUIDE.md)**

> All data is stored locally. No account, no telemetry, no cloud.
