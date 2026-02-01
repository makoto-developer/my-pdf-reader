use crate::models::AppConfig;
use tauri::AppHandle;
use log::{info, error};

#[tauri::command]
pub async fn get_config(app_handle: AppHandle) -> Result<AppConfig, String> {
    info!("Getting application config");
    match AppConfig::load(&app_handle) {
        Ok(config) => {
            info!("Config loaded successfully: pdfs_directory={}", config.pdfs_directory);
            Ok(config)
        }
        Err(e) => {
            error!("Failed to load config: {}", e);
            Err(e)
        }
    }
}

#[tauri::command]
pub async fn update_config(
    app_handle: AppHandle,
    pdfs_directory: String,
) -> Result<AppConfig, String> {
    info!("Updating config: pdfs_directory={}", pdfs_directory);
    let mut config = AppConfig::load(&app_handle)?;
    config.pdfs_directory = pdfs_directory.clone();
    config.save(&app_handle)?;
    info!("Config updated successfully");
    Ok(config)
}

#[tauri::command]
pub async fn select_directory(app_handle: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    
    // ディレクトリ選択ダイアログを表示
    let result = app_handle
        .dialog()
        .file()
        .blocking_pick_folder();
    
    Ok(result.map(|path| path.to_string()))
}
