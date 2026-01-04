use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PDFSet {
    pub id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub last_opened_at: Option<DateTime<Utc>>,
    pub original_pdf_path: String,
    pub translated_pdf_path: String,
    pub bookmark: Option<Bookmark>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bookmark {
    pub page: u32,
    pub zoom: f32,
}

impl PDFSet {
    pub fn new(name: String) -> Self {
        let id = Uuid::new_v4().to_string();
        let created_at = Utc::now();

        Self {
            id: id.clone(),
            name,
            created_at,
            last_opened_at: None,
            original_pdf_path: format!("pdfs/{}/original.pdf", id),
            translated_pdf_path: format!("pdfs/{}/translated.pdf", id),
            bookmark: None,
        }
    }
}
