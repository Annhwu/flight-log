use std::fs;
use std::path::PathBuf;
use tauri::Manager;
// use tauri::api::dialog::FileDialogBuilder; // removed for Tauri v2 compatibility


pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_file, save_data, load_data, read_installer_lang])
        .run(tauri::generate_context!())
        .expect("Erreur démarrage");
}

fn data_path(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_data_dir()
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
fn read_installer_lang(app: tauri::AppHandle) -> String {
    let path = app.path().app_data_dir()
        .map(|d| d.join("lang.ini"))
        .unwrap_or_default();
    fs::read_to_string(&path).unwrap_or_default()
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

