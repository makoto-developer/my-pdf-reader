use crate::models::{PDFSet, AppConfig};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

fn get_pdfs_base_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let config = AppConfig::load(app_handle)?;
    config.get_pdfs_directory()
}

#[tauri::command]
pub async fn create_pdf_set(
    app_handle: AppHandle,
    name: String,
    original_path: String,
    translated_path: String,
) -> Result<PDFSet, String> {
    let pdf_set = PDFSet::new(name);

    let pdfs_dir = get_pdfs_base_dir(&app_handle)?;
    let set_dir = pdfs_dir.join(&pdf_set.id);

    println!("PDFs will be saved to: {}", set_dir.display());

    // ディレクトリ作成
    fs::create_dir_all(&set_dir)
        .map_err(|e| format!("Failed to create directory {}: {}", set_dir.display(), e))?;

    // PDFファイルをコピー
    let original_dest = set_dir.join("original.pdf");
    let translated_dest = set_dir.join("translated.pdf");

    fs::copy(&original_path, &original_dest)
        .map_err(|e| format!("Failed to copy original PDF from {} to {}: {}", original_path, original_dest.display(), e))?;

    fs::copy(&translated_path, &translated_dest)
        .map_err(|e| format!("Failed to copy translated PDF from {} to {}: {}", translated_path, translated_dest.display(), e))?;

    let mut result_set = pdf_set;
    result_set.original_pdf_path = original_dest.to_string_lossy().to_string();
    result_set.translated_pdf_path = translated_dest.to_string_lossy().to_string();

    // メタデータをJSONファイルとして保存
    let metadata_path = set_dir.join("metadata.json");
    let json = serde_json::to_string_pretty(&result_set)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
    fs::write(&metadata_path, json)
        .map_err(|e| format!("Failed to write metadata: {}", e))?;

    Ok(result_set)
}

#[tauri::command]
pub async fn list_pdf_sets(app_handle: AppHandle) -> Result<Vec<PDFSet>, String> {
    let pdfs_dir = get_pdfs_base_dir(&app_handle)?;
    println!("PDFs directory: {}", pdfs_dir.display());

    if !pdfs_dir.exists() {
        println!("PDFs directory does not exist, returning empty list");
        return Ok(Vec::new());
    }

    let mut sets = Vec::new();

    let entries = fs::read_dir(&pdfs_dir)
        .map_err(|e| {
            let msg = format!("Failed to read pdfs directory {}: {}", pdfs_dir.display(), e);
            eprintln!("{}", msg);
            msg
        })?;

    for entry in entries {
        let entry = entry.map_err(|e| {
            let msg = format!("Failed to read entry: {}", e);
            eprintln!("{}", msg);
            msg
        })?;
        let path = entry.path();

        // 隠しファイル（.DS_Storeなど）をスキップ
        if let Some(file_name) = path.file_name() {
            if file_name.to_string_lossy().starts_with('.') {
                println!("Skipping hidden file: {}", path.display());
                continue;
            }
        }

        println!("Processing entry: {}", path.display());

        if path.is_dir() {
            // メタデータファイルを読み込む
            let metadata_path = path.join("metadata.json");
            println!("Looking for metadata at: {}", metadata_path.display());

            if metadata_path.exists() {
                // metadata.jsonから読み込み
                let json = fs::read_to_string(&metadata_path)
                    .map_err(|e| {
                        let msg = format!("Failed to read metadata at {}: {}", metadata_path.display(), e);
                        eprintln!("{}", msg);
                        msg
                    })?;

                println!("Metadata JSON: {}", json);

                let set: PDFSet = serde_json::from_str(&json)
                    .map_err(|e| {
                        let msg = format!("Failed to parse metadata at {}: {}", metadata_path.display(), e);
                        eprintln!("{}", msg);
                        msg
                    })?;

                println!("Successfully parsed PDFSet: {} ({})", set.name, set.id);
                sets.push(set);
            } else {
                println!("Metadata file does not exist at: {}", metadata_path.display());
            }
        }
    }

    println!("Returning {} PDF sets", sets.len());
    Ok(sets)
}

#[tauri::command]
pub async fn update_pdf_set(app_handle: AppHandle, id: String, name: String) -> Result<PDFSet, String> {
    let pdfs_dir = get_pdfs_base_dir(&app_handle)?;
    let set_dir = pdfs_dir.join(&id);
    let metadata_path = set_dir.join("metadata.json");

    if !metadata_path.exists() {
        return Err(format!("PDF set not found: {}", id));
    }

    // 既存のメタデータを読み込み
    let json = fs::read_to_string(&metadata_path)
        .map_err(|e| format!("Failed to read metadata: {}", e))?;

    let mut set: PDFSet = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse metadata: {}", e))?;

    // 名前を更新
    set.name = name;

    // メタデータを保存
    let updated_json = serde_json::to_string_pretty(&set)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
    fs::write(&metadata_path, updated_json)
        .map_err(|e| format!("Failed to write metadata: {}", e))?;

    println!("Updated PDF set: {} ({})", set.name, set.id);
    Ok(set)
}

#[tauri::command]
pub async fn delete_pdf_set(app_handle: AppHandle, id: String) -> Result<(), String> {
    let pdfs_dir = get_pdfs_base_dir(&app_handle)?;
    let set_dir = pdfs_dir.join(&id);

    fs::remove_dir_all(&set_dir)
        .map_err(|e| format!("Failed to delete set {}: {}", set_dir.display(), e))?;

    Ok(())
}
