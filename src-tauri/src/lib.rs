use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};

const GITHUB_REPO: &str = "Annhwu/flight-log";

// ─── Update types ────────────────────────────────────────────────────────────

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct UpdateAsset {
    pub name: String,
    pub size: u64,
    pub size_fmt: String,
    pub download_url: String,
    pub sha256: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct UpdateInfo {
    pub current_version: String,
    pub new_version: String,
    pub body: String,
    pub is_prerelease: bool,
    pub asset: UpdateAsset,
}

pub struct UpdateState {
    pub info: Mutex<Option<UpdateInfo>>,
    pub dismissed: Mutex<bool>,
}

struct TrayItems {
    session: Mutex<MenuItem<tauri::Wry>>,
    quit:    Mutex<MenuItem<tauri::Wry>>,
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

fn version_gt(new: &str, current: &str) -> bool {
    let parse = |s: &str| -> (u64, u64, u64) {
        let mut it = s.split('.');
        let a = it.next().and_then(|x| x.parse().ok()).unwrap_or(0);
        let b = it.next().and_then(|x| x.parse().ok()).unwrap_or(0);
        let c = it.next().and_then(|x| x.parse().ok()).unwrap_or(0);
        (a, b, c)
    };
    parse(new) > parse(current)
}

fn fmt_size(bytes: u64) -> String {
    if bytes >= 1_000_000 {
        format!("{:.1} MB", bytes as f64 / 1_000_000.0)
    } else if bytes >= 1_000 {
        format!("{:.0} KB", bytes as f64 / 1_000.0)
    } else {
        format!("{} B", bytes)
    }
}

fn pick_asset(assets: &[serde_json::Value]) -> Option<UpdateAsset> {
    for ext in [".msi", ".exe"] {
        for a in assets {
            let name = a["name"].as_str().unwrap_or("");
            if !name.to_ascii_lowercase().ends_with(ext) {
                continue;
            }
            let url = a["browser_download_url"].as_str().unwrap_or("").to_string();
            if url.is_empty() {
                continue;
            }
            let size = a["size"].as_u64().unwrap_or(0);
            let sha256 = a["digest"]
                .as_str()
                .and_then(|d| d.strip_prefix("sha256:"))
                .unwrap_or("")
                .to_string();
            return Some(UpdateAsset {
                name: name.to_string(),
                size,
                size_fmt: fmt_size(size),
                download_url: url,
                sha256,
            });
        }
    }
    None
}

async fn fetch_update(current: &str, include_prerelease: bool) -> Result<Option<UpdateInfo>, String> {
    let client = reqwest::Client::builder()
        .user_agent(format!("flight-log/{}", current))
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let release: serde_json::Value;
    let is_prerelease: bool;

    if include_prerelease {
        let url = format!(
            "https://api.github.com/repos/{}/releases?per_page=10",
            GITHUB_REPO
        );
        let resp = client
            .get(&url)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
            .await
            .map_err(|e| format!("Réseau : {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("GitHub API : {}", resp.status()));
        }

        let releases: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;
        match releases.into_iter().find(|r| !r["draft"].as_bool().unwrap_or(false)) {
            Some(r) => {
                is_prerelease = r["prerelease"].as_bool().unwrap_or(false);
                release = r;
            }
            None => return Ok(None),
        }
    } else {
        let url = format!(
            "https://api.github.com/repos/{}/releases/latest",
            GITHUB_REPO
        );
        let resp = client
            .get(&url)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
            .await
            .map_err(|e| format!("Réseau : {}", e))?;

        if resp.status().as_u16() == 404 {
            return Ok(None);
        }
        if !resp.status().is_success() {
            return Err(format!("GitHub API : {}", resp.status()));
        }

        is_prerelease = false;
        release = resp.json().await.map_err(|e| e.to_string())?;
    }

    let tag = release["tag_name"]
        .as_str()
        .unwrap_or("")
        .trim_start_matches('v');
    if tag.is_empty() || !version_gt(tag, current) {
        return Ok(None);
    }

    let empty = vec![];
    let assets = release["assets"].as_array().unwrap_or(&empty);
    let asset = match pick_asset(assets) {
        Some(a) => a,
        None => return Ok(None),
    };

    Ok(Some(UpdateInfo {
        current_version: current.to_string(),
        new_version: tag.to_string(),
        body: release["body"].as_str().unwrap_or("").to_string(),
        is_prerelease,
        asset,
    }))
}

// ─── Tauri commands ───────────────────────────────────────────────────────────

#[tauri::command]
async fn check_update(
    app: tauri::AppHandle,
    include_prerelease: bool,
) -> Result<Option<UpdateInfo>, String> {
    let current = app.package_info().version.to_string();
    let info = fetch_update(&current, include_prerelease).await?;
    *app.state::<UpdateState>().info.lock().unwrap() = info.clone();
    Ok(info)
}

#[tauri::command]
async fn download_and_install(
    app: tauri::AppHandle,
    download_url: String,
    expected_sha256: String,
    file_name: String,
) -> Result<(), String> {
    use sha2::Digest as _;

    let current = app.package_info().version.to_string();
    let client = reqwest::Client::builder()
        .user_agent(format!("flight-log/{}", current))
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Téléchargement échoué : {}", resp.status()));
    }

    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;

    if !expected_sha256.is_empty() {
        let mut h = sha2::Sha256::new();
        h.update(&bytes);
        let got = hex::encode(h.finalize());
        if got != expected_sha256.to_ascii_lowercase() {
            return Err(format!(
                "SHA-256 invalide.\nAttendu : {}\nObtenu  : {}",
                expected_sha256, got
            ));
        }
    }

    let dest = std::env::temp_dir().join(&file_name);
    fs::write(&dest, &bytes).map_err(|e| e.to_string())?;

    let path = dest.to_string_lossy().to_string();
    if file_name.to_ascii_lowercase().ends_with(".msi") {
        std::process::Command::new("msiexec")
            .args(["/i", &path, "/passive", "/norestart"])
            .spawn()
            .map_err(|e| format!("msiexec : {}", e))?;
    } else {
        std::process::Command::new(&path)
            .spawn()
            .map_err(|e| format!("installeur : {}", e))?;
    }

    std::thread::sleep(std::time::Duration::from_millis(800));
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn dismiss_update(app: tauri::AppHandle) {
    *app.state::<UpdateState>().dismissed.lock().unwrap() = true;
}

#[tauri::command]
fn force_close(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn minimize_to_tray(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[tauri::command]
fn get_pending_update(app: tauri::AppHandle) -> Option<UpdateInfo> {
    let state = app.state::<UpdateState>();
    let dismissed = *state.dismissed.lock().unwrap();
    if dismissed { None } else { state.info.lock().unwrap().clone() }
}

#[tauri::command]
fn get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
fn set_tray_labels(state: tauri::State<'_, TrayItems>, session: String, quit: String) {
    if let Ok(item) = state.session.lock() { let _ = item.set_text(&session); }
    if let Ok(item) = state.quit.lock()    { let _ = item.set_text(&quit);    }
}

// ─── DCS hook commands ───────────────────────────────────────────────────────

const LUA_HOOK: &str = include_str!("../FlightLogHook.lua");

#[derive(serde::Serialize)]
struct DcsDiagFile {
    name: String,
    raw: String,
    parses: bool,
    done: bool,
    duration_min: i64,
}

#[derive(serde::Serialize)]
struct DcsDiag {
    hook_installed: bool,
    hook_path: String,
    dir_exists: bool,
    total_files: usize,
    importable: usize,
    files: Vec<DcsDiagFile>,
}

#[tauri::command]
fn dcs_diagnose(saved_games_path: String) -> DcsDiag {
    let hook_path = PathBuf::from(&saved_games_path)
        .join("Scripts").join("Hooks").join("FlightLogHook.lua");
    let dir = PathBuf::from(&saved_games_path);
    let dir_exists = dir.is_dir();
    let mut files: Vec<DcsDiagFile> = Vec::new();
    let mut importable = 0usize;
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with("FlightLogSession_") && name.ends_with(".json") {
                let raw = fs::read_to_string(entry.path()).unwrap_or_default();
                let parsed = parse_session_file(&raw);
                let (parses, done, duration_min) = match &parsed {
                    Some(s) => {
                        let dur = if s.end > s.start && s.start > 0 { (s.end - s.start) / 60 } else { 0 };
                        if s.done && dur >= 1 { importable += 1; }
                        (true, s.done, dur)
                    }
                    None => (false, false, 0),
                };
                files.push(DcsDiagFile {
                    name,
                    raw: raw.chars().take(200).collect(),
                    parses,
                    done,
                    duration_min,
                });
            }
        }
    }
    files.sort_by(|a, b| b.name.cmp(&a.name));
    let total_files = files.len();
    files.truncate(5);
    DcsDiag {
        hook_installed: hook_path.exists(),
        hook_path: hook_path.to_string_lossy().to_string(),
        dir_exists,
        total_files,
        importable,
        files,
    }
}

#[tauri::command]
fn detect_dcs_path() -> Option<String> {
    let user_profile = std::env::var("USERPROFILE").ok()?;
    let base = PathBuf::from(&user_profile).join("Saved Games");
    for candidate in ["DCS", "DCS.openbeta"] {
        let path = base.join(candidate);
        if path.exists() {
            return Some(path.to_string_lossy().to_string());
        }
    }
    None
}

#[tauri::command]
fn install_dcs_hook(saved_games_path: String) -> Result<(), String> {
    let hooks_dir = PathBuf::from(&saved_games_path).join("Scripts").join("Hooks");
    fs::create_dir_all(&hooks_dir).map_err(|e| e.to_string())?;
    let dest = hooks_dir.join("FlightLogHook.lua");
    fs::write(&dest, LUA_HOOK).map_err(|e| e.to_string())
}

struct SessionFileContent {
    start: i64,
    end: i64,
    map: String,
    aircraft: Vec<String>,
    done: bool,
}

// Lenient parser: tolerates aircraft as a string (old format) or array (new format),
// and missing fields. Returns None only for genuinely unreadable JSON.
fn parse_session_file(raw: &str) -> Option<SessionFileContent> {
    let v: serde_json::Value = serde_json::from_str(raw).ok()?;
    let aircraft = match v.get("aircraft") {
        Some(serde_json::Value::Array(a)) =>
            a.iter().filter_map(|x| x.as_str().map(String::from)).collect(),
        Some(serde_json::Value::String(s)) if !s.is_empty() => vec![s.clone()],
        _ => vec![],
    };
    Some(SessionFileContent {
        start: v.get("start").and_then(|x| x.as_i64()).unwrap_or(0),
        end: v.get("end").and_then(|x| x.as_i64()).unwrap_or(0),
        map: v.get("map").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        aircraft,
        done: v.get("done").and_then(|x| x.as_bool()).unwrap_or(false),
    })
}

#[derive(serde::Serialize)]
struct DcsSession {
    path: String,
    file: String,
    #[serde(rename = "startTs")]
    start_ts: i64,
    #[serde(rename = "endTs")]
    end_ts: i64,
    #[serde(rename = "durationMin")]
    duration_min: i64,
    pub map: String,
    pub aircraft: Vec<String>,
}

#[tauri::command]
fn read_dcs_sessions(saved_games_path: String) -> Result<Vec<DcsSession>, String> {
    let dir = PathBuf::from(&saved_games_path);
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    let mut sessions: Vec<DcsSession> = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            let name = path.file_name()?.to_string_lossy().into_owned();
            if !name.starts_with("FlightLogSession_") || !name.ends_with(".json") {
                return None;
            }
            let content = parse_session_file(&fs::read_to_string(&path).ok()?)?;
            if !content.done || content.start <= 0 || content.end <= 0 {
                return None;
            }
            let start_ts = content.start * 1000;
            let end_ts = content.end * 1000;
            let duration_min = (content.end - content.start) / 60;
            if duration_min < 1 { return None; }
            Some(DcsSession {
                path: path.to_string_lossy().into_owned(),
                file: name,
                start_ts,
                end_ts,
                duration_min,
                map: content.map,
                aircraft: content.aircraft,
            })
        })
        .collect();
    sessions.sort_by_key(|s| s.start_ts);
    Ok(sessions)
}

#[tauri::command]
fn delete_dcs_sessions(file_paths: Vec<String>) -> Result<(), String> {
    for p in file_paths {
        fs::remove_file(&p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ─── Data commands ────────────────────────────────────────────────────────────

fn data_path(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("Impossible de trouver le dossier AppData")
        .join("dcs_flight_log.json")
}

#[tauri::command]
fn save_file(path: String, content: String) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_data(app: tauri::AppHandle, content: String) -> Result<(), String> {
    let path = data_path(&app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_data(app: tauri::AppHandle) -> Result<String, String> {
    let path = data_path(&app);
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Err("Aucun fichier".to_string())
    }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .manage(UpdateState {
            info: Mutex::new(None),
            dismissed: Mutex::new(false),
        })
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let session_item = MenuItem::with_id(app, "toggle_session", "Démarrer le vol", true, None::<&str>)?;
            let sep          = PredefinedMenuItem::separator(app)?;
            let quit_item    = MenuItem::with_id(app, "quit", "Fermer", true, None::<&str>)?;
            let tray_menu    = Menu::with_items(app, &[&session_item, &sep, &quit_item])?;
            app.manage(TrayItems {
                session: Mutex::new(session_item),
                quit:    Mutex::new(quit_item),
            });

            let handle = app.handle().clone();
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Flight Log")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id().0.as_str() {
                        "toggle_session" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.unminimize();
                                let _ = w.set_focus();
                                let _ = w.eval("if(window.toggleSession)window.toggleSession()");
                            }
                        }
                        "quit" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                                let _ = w.eval("if(window.tbClose)window.tbClose()");
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(move |_tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                        if let Some(window) = handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_file,
            save_data,
            load_data,
            check_update,
            download_and_install,
            dismiss_update,
            force_close,
            minimize_to_tray,
            get_pending_update,
            get_app_version,
            set_tray_labels,
            dcs_diagnose,
            detect_dcs_path,
            install_dcs_hook,
            read_dcs_sessions,
            delete_dcs_sessions,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Only intercept when a pending update must be shown
                let state = window.app_handle().state::<UpdateState>();
                let dismissed = *state.dismissed.lock().unwrap();
                if !dismissed {
                    if let Some(upd) = state.info.lock().unwrap().clone() {
                        *state.dismissed.lock().unwrap() = true;
                        api.prevent_close();
                        let _ = window.app_handle().emit("update-check-on-close", upd);
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("Erreur démarrage");
}
