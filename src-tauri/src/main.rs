// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;

use commands::{
    create_pdf_set, delete_pdf_set, list_pdf_sets, update_pdf_set,
    get_config, update_config, select_directory,
};
use simplelog::*;
use std::fs;

fn setup_logger() -> Result<(), Box<dyn std::error::Error>> {
    // ログディレクトリを作成
    let log_dir = std::path::Path::new("logs");
    if !log_dir.exists() {
        fs::create_dir_all(log_dir)?;
    }

    // 現在の日時でログファイル名を生成
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let log_file_path = log_dir.join(format!("app_{}.log", timestamp));
    let log_file = fs::File::create(&log_file_path)?;

    // ログ設定を初期化（ファイルとコンソールの両方に出力）
    CombinedLogger::init(vec![
        TermLogger::new(
            LevelFilter::Info,
            Config::default(),
            TerminalMode::Mixed,
            ColorChoice::Auto,
        ),
        WriteLogger::new(LevelFilter::Debug, Config::default(), log_file),
    ])?;

    log::info!("Logger initialized. Log file: {:?}", log_file_path);
    Ok(())
}

fn main() {
    // ログを初期化
    if let Err(e) = setup_logger() {
        eprintln!("Failed to initialize logger: {}", e);
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            create_pdf_set,
            list_pdf_sets,
            update_pdf_set,
            delete_pdf_set,
            get_config,
            update_config,
            select_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
