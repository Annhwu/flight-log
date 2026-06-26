use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, Manager};

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
fn get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
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
        .invoke_handler(tauri::generate_handler![
            save_file,
            save_data,
            load_data,
            check_update,
            download_and_install,
            dismiss_update,
            force_close,
            get_app_version,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let state = window.app_handle().state::<UpdateState>();
                let is_dismissed = *state.dismissed.lock().unwrap();
                if is_dismissed {
                    return;
                }
                let info = state.info.lock().unwrap().clone();
                if let Some(upd) = info {
                    // Auto-dismiss so a second close attempt goes through cleanly
                    *state.dismissed.lock().unwrap() = true;
                    api.prevent_close();
                    let _ = window.emit("update-check-on-close", upd);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("Erreur démarrage");
}
