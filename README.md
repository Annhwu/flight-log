# Flight Log

> A clean, offline desktop app to track your DCS World flight sessions.

Built with **Tauri v2** · **TypeScript** · **Vite** — Windows

---

## What it does

- **Live timer** — start/stop a session from the navbar, fill in the debrief when you land
- **Manual entry** — log any past flight with precise start/end times
- **Profile** — configure your owned modules and maps; pickers in all forms are built from your collection
- **Mission types** — 8 presets + fully custom types
- **History** — search, edit, and browse all your sessions in one place
- **Import / Export** — back up your log as JSON, restore modules and maps independently from your profile
- **Steam integration** — add your Steam hours to the total displayed in the navbar

## Customization

- 🌕 Light theme (parchment) · 🌑 Dark Brown theme
- 🇬🇧 English · 🇫🇷 Français · 🇷🇺 Русский

## Installation

Download the latest installer from the [Releases](../../releases) page.  
No setup required — all data is stored locally on your machine.

## Build from source

```bash
npm install
npm run tauri build
```

Requires [Node.js ≥ 18](https://nodejs.org/) and [Rust](https://www.rust-lang.org/tools/install).

---

→ **[Full user guide](GUIDE.md)**

> All data is stored locally. No account, no telemetry, no cloud.
