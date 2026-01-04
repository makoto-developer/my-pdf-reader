// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;

use commands::{
    create_pdf_set, delete_pdf_set, list_pdf_sets, update_pdf_set,
    get_config, update_config, select_directory,
};

fn main() {
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
