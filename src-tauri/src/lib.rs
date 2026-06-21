use std::fs;
use std::path::PathBuf;
use tauri::Manager;

fn data_path(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_data_dir()
        .expect("Impossible de trouver le dossier AppData")
        .join("dcs_flight_log.json")
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

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![save_data, load_data])
        .run(tauri::generate_context!())
        .expect("Erreur démarrage");
}