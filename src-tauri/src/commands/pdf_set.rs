use crate::models::PDFSet;
use std::fs;
use std::path::Path;
use std::env;

#[tauri::command]
pub async fn create_pdf_set(
    name: String,
    original_path: String,
    translated_path: String,
) -> Result<PDFSet, String> {
    let pdf_set = PDFSet::new(name);
    let set_dir = format!("pdfs/{}", pdf_set.id);

    // ディレクトリ作成
    fs::create_dir_all(&set_dir)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    // PDFファイルをコピー
    let original_dest = format!("{}/original.pdf", set_dir);
    let translated_dest = format!("{}/translated.pdf", set_dir);

    fs::copy(&original_path, &original_dest)
        .map_err(|e| format!("Failed to copy original PDF: {}", e))?;

    fs::copy(&translated_path, &translated_dest)
        .map_err(|e| format!("Failed to copy translated PDF: {}", e))?;

    // 絶対パスを取得
    let current_dir = env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;

    let mut result_set = pdf_set;
    result_set.original_pdf_path = current_dir
        .join(&original_dest)
        .to_string_lossy()
        .to_string();
    result_set.translated_pdf_path = current_dir
        .join(&translated_dest)
        .to_string_lossy()
        .to_string();

    // メタデータをJSONファイルとして保存
    let metadata_path = format!("{}/metadata.json", set_dir);
    let json = serde_json::to_string_pretty(&result_set)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
    fs::write(&metadata_path, json)
        .map_err(|e| format!("Failed to write metadata: {}", e))?;

    Ok(result_set)
}

#[tauri::command]
pub async fn list_pdf_sets() -> Result<Vec<PDFSet>, String> {
    let pdfs_dir = Path::new("pdfs");

    if !pdfs_dir.exists() {
        return Ok(Vec::new());
    }

    let mut sets = Vec::new();

    // 絶対パスを取得
    let current_dir = env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;

    let entries = fs::read_dir(pdfs_dir)
        .map_err(|e| format!("Failed to read pdfs directory: {}", e))?;

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

                let mut set: PDFSet = serde_json::from_str(&json)
                    .map_err(|e| format!("Failed to parse metadata: {}", e))?;

                // パスを絶対パスに更新（相対パスで保存されている可能性があるため）
                let id = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .ok_or_else(|| "Invalid directory name".to_string())?;

                let original_pdf_rel = format!("pdfs/{}/original.pdf", id);
                let translated_pdf_rel = format!("pdfs/{}/translated.pdf", id);

                set.original_pdf_path = current_dir
                    .join(&original_pdf_rel)
                    .to_string_lossy()
                    .to_string();
                set.translated_pdf_path = current_dir
                    .join(&translated_pdf_rel)
                    .to_string_lossy()
                    .to_string();

                sets.push(set);
            }
        }
    }

    Ok(sets)
}

#[tauri::command]
pub async fn delete_pdf_set(id: String) -> Result<(), String> {
    let set_dir = format!("pdfs/{}", id);

    fs::remove_dir_all(&set_dir)
        .map_err(|e| format!("Failed to delete set: {}", e))?;

    Ok(())
}
