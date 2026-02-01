use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use log::{info, error, debug};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub pdfs_directory: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        // デフォルトは ~/my_pdf_reader_book
        let home = std::env::var("HOME").unwrap_or_else(|_| String::from("/tmp"));
        let default_dir = PathBuf::from(home).join("my_pdf_reader_book");
        
        Self {
            pdfs_directory: default_dir.to_string_lossy().to_string(),
        }
    }
}

impl AppConfig {
    /// 設定ファイルのパスを取得
    fn config_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
        let app_data_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data directory: {}", e))?;
        
        // ディレクトリが存在しない場合は作成
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;
        
        Ok(app_data_dir.join("config.json"))
    }

    /// 設定を読み込む（存在しない場合はデフォルト設定を保存）
    pub fn load(app_handle: &AppHandle) -> Result<Self, String> {
        let config_path = Self::config_path(app_handle)?;
        debug!("Loading config from: {:?}", config_path);
        
        if config_path.exists() {
            let json = fs::read_to_string(&config_path)
                .map_err(|e| {
                    let msg = format!("Failed to read config: {}", e);
                    error!("{}", msg);
                    msg
                })?;
            
            let config: AppConfig = serde_json::from_str(&json)
                .map_err(|e| {
                    let msg = format!("Failed to parse config: {}", e);
                    error!("{}", msg);
                    msg
                })?;
            
            info!("Config loaded successfully from {:?}", config_path);
            Ok(config)
        } else {
            info!("Config file not found, creating default config");
            // デフォルト設定を作成して保存
            let config = AppConfig::default();
            config.save(app_handle)?;
            info!("Default config created and saved");
            Ok(config)
        }
    }

    /// 設定を保存
    pub fn save(&self, app_handle: &AppHandle) -> Result<(), String> {
        let config_path = Self::config_path(app_handle)?;
        
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        
        fs::write(&config_path, json)
            .map_err(|e| format!("Failed to write config: {}", e))?;
        
        Ok(())
    }

    /// PDFディレクトリを取得（存在しない場合は作成）
    pub fn get_pdfs_directory(&self) -> Result<PathBuf, String> {
        let dir = PathBuf::from(&self.pdfs_directory);
        debug!("Checking PDFs directory: {:?}", dir);
        
        if !dir.exists() {
            info!("PDFs directory does not exist, creating: {:?}", dir);
            fs::create_dir_all(&dir)
                .map_err(|e| {
                    let msg = format!("Failed to create pdfs directory: {}", e);
                    error!("{}", msg);
                    msg
                })?;
            info!("PDFs directory created successfully");
        }
        
        Ok(dir)
    }
}
