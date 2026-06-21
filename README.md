# ✈ DCS Flight Log

Journal de vol personnel pour **DCS World** — enregistrez vos sessions de vol, éditez-les, et exportez vos données au format JSON.

Construit avec **Tauri v2** (Rust) + **Vite** + **TypeScript**.

---

## 📋 Prérequis

Avant de commencer, assure-toi d'avoir installé :

| Outil | Version minimale | Lien |
|---|---|---|
| [Node.js](https://nodejs.org/) | 18+ | https://nodejs.org |
| [Rust](https://rustup.rs/) | stable | https://rustup.rs |
| [Tauri CLI v2](https://tauri.app) | 2.x | via npm |

> **Windows** : installe aussi les [Build Tools pour Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (composant C++ requis par Rust).

---

## 🚀 Installation

```bash
# Cloner le repo
git clone https://github.com/Annhwu/flight-log.git
cd flight-log

# Installer les dépendances npm (Vite, TypeScript, Tauri CLI)
npm install
```

---

## 🛠️ Développement

Lance l'app en mode dev (hot-reload) :

```bash
npm run tauri dev
```

> Cela démarre Vite sur `http://localhost:1420` **et** la fenêtre native Tauri simultanément.

---

## 🏗️ Compilation (production)

Pour générer l'installeur Windows (`.exe` / `.msi`) :

```bash
npm run tauri build
```

Les artefacts seront dans :
```
src-tauri/target/release/bundle/
```

---

## 🗂️ Structure du projet

```
flight-log/
├── index.html              # Point d'entrée HTML (Vite)
├── vite.config.ts          # Config Vite
├── tsconfig.json           # Config TypeScript
├── package.json            # Dépendances npm & scripts
│
├── src/
│   ├── main.ts             # Logique principale (TypeScript)
│   └── styles.css          # Styles (CSS variables, mono font)
│
└── src-tauri/
    ├── tauri.conf.json     # Config Tauri (fenêtre, bundle, sécurité)
    ├── Cargo.toml          # Dépendances Rust
    └── src/
        ├── main.rs         # Point d'entrée Rust
        └── lib.rs          # Commandes Tauri (save_file, save_data, load_data)
```

---

## ⚙️ Commandes disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Lance Vite seul (front-end uniquement) |
| `npm run build` | Compile le TypeScript + bundle Vite vers `dist/` |
| `npm run tauri dev` | Lance l'app complète en mode développement |
| `npm run tauri build` | Génère l'installeur production |

---

## 💾 Données persistantes

Les données (sessions, heures Steam) sont sauvegardées automatiquement dans :

```
%APPDATA%\com.flight.log\dcs_flight_log.json
```

---

## 📦 Technologies

- **[Tauri v2](https://tauri.app)** — Framework Rust pour apps desktop natives
- **[Vite](https://vitejs.dev)** — Bundler ultra-rapide
- **[TypeScript](https://www.typescriptlang.org)** — Typage statique
- **[tauri-plugin-dialog](https://github.com/tauri-apps/plugins-workspace)** — Dialogs natifs Windows (save/open)
- **Share Tech Mono** — Police Google Fonts (style HUD militaire)
