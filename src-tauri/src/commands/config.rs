use crate::models::AppConfig;
use tauri::AppHandle;

#[tauri::command]
pub async fn get_config(app_handle: AppHandle) -> Result<AppConfig, String> {
    AppConfig::load(&app_handle)
}

#[tauri::command]
pub async fn update_config(
    app_handle: AppHandle,
    pdfs_directory: String,
) -> Result<AppConfig, String> {
    let mut config = AppConfig::load(&app_handle)?;
    config.pdfs_directory = pdfs_directory;
    config.save(&app_handle)?;
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
