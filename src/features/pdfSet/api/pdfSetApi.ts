import { invoke } from '@tauri-apps/api/core'
import type { PDFSet, CreatePDFSetParams } from '@/domain/PDFSet'

export const pdfSetApi = {
  async list(): Promise<PDFSet[]> {
    try {
      const sets = await invoke<PDFSet[]>('list_pdf_sets')
      return sets
    } catch (error) {
      console.error('Failed to list PDF sets:', error)
      throw new Error('PDFセット一覧の取得に失敗しました')
    }
  },

  async create(params: CreatePDFSetParams): Promise<PDFSet> {
    try {
      const set = await invoke<PDFSet>('create_pdf_set', {
        name: params.name,
        originalPath: params.originalPath,
        translatedPath: params.translatedPath,
      })
      return set
    } catch (error) {
      console.error('Failed to create PDF set:', error)
      throw new Error('PDFセットの作成に失敗しました')
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await invoke<void>('delete_pdf_set', { id })
    } catch (error) {
      console.error('Failed to delete PDF set:', error)
      throw new Error('PDFセットの削除に失敗しました')
    }
  },
}
