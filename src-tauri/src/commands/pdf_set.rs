use crate::models::PDFSet;
use std::fs;
use std::path::PathBuf;
use std::env;
use tauri::{AppHandle, Manager};

fn get_pdfs_base_dir() -> Result<PathBuf, String> {
    // 開発環境では固定パス、本番環境ではホームディレクトリからの相対パスを使用
    #[cfg(debug_assertions)]
    {
        Ok(PathBuf::from("/Users/user/work/repositories/github.com/makoto-developer/my-pdf-reader/pdfs"))
    }

    #[cfg(not(debug_assertions))]
    {
        let home = env::var("HOME")
            .map_err(|_| "Failed to get HOME environment variable".to_string())?;
        Ok(PathBuf::from(home).join("work/repositories/github.com/makoto-developer/my-pdf-reader/pdfs"))
    }
}

#[tauri::command]
pub async fn create_pdf_set(
    app_handle: AppHandle,
    name: String,
    original_path: String,
    translated_path: String,
) -> Result<PDFSet, String> {
    let pdf_set = PDFSet::new(name);

    let pdfs_dir = get_pdfs_base_dir()?;
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
    let pdfs_dir = get_pdfs_base_dir()?;

    if !pdfs_dir.exists() {
        return Ok(Vec::new());
    }

    let mut sets = Vec::new();

    let entries = fs::read_dir(&pdfs_dir)
        .map_err(|e| format!("Failed to read pdfs directory {}: {}", pdfs_dir.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            // メタデータファイルを読み込む
            let metadata_path = path.join("metadata.json");

            if metadata_path.exists() {
                // metadata.jsonから読み込み
                let json = fs::read_to_string(&metadata_path)
                    .map_err(|e| format!("Failed to read metadata: {}", e))?;

                let set: PDFSet = serde_json::from_str(&json)
                    .map_err(|e| format!("Failed to parse metadata: {}", e))?;

                sets.push(set);
            }
        }
    }

    Ok(sets)
}

#[tauri::command]
pub async fn delete_pdf_set(app_handle: AppHandle, id: String) -> Result<(), String> {
    let pdfs_dir = get_pdfs_base_dir()?;
    let set_dir = pdfs_dir.join(&id);

    fs::remove_dir_all(&set_dir)
        .map_err(|e| format!("Failed to delete set {}: {}", set_dir.display(), e))?;

    Ok(())
}
