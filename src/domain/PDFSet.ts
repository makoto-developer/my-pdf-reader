export interface PDFSet {
  id: string
  name: string
  createdAt: string // ISO 8601 datetime string
  lastOpenedAt: string | null // ISO 8601 datetime string
  originalPdfPath: string
  translatedPdfPath: string
  bookmark: Bookmark | null
}

export interface Bookmark {
  page: number
  zoom: number
}

export interface CreatePDFSetParams {
  name: string
  originalPath: string
  translatedPath: string
}
