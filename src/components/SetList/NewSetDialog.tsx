import { useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import type { CreatePDFSetParams } from '@/domain/PDFSet'
import { Button } from '../common/Button'

interface NewSetDialogProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (params: CreatePDFSetParams) => Promise<void>
}

export function NewSetDialog({ isOpen, onClose, onCreate }: NewSetDialogProps): React.ReactElement | null {
  const [name, setName] = useState('')
  const [originalPath, setOriginalPath] = useState('')
  const [translatedPath, setTranslatedPath] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSelectOriginal = async (): Promise<void> => {
    try {
      console.log('Opening file dialog for original PDF...')
      const selected = await open({
        multiple: false,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })
      console.log('Selected file:', selected)
      if (selected && typeof selected === 'string') {
        setOriginalPath(selected)
      }
    } catch (err) {
      console.error('Error opening file dialog:', err)
      setError(`ファイル選択エラー: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleSelectTranslated = async (): Promise<void> => {
    try {
      console.log('Opening file dialog for translated PDF...')
      const selected = await open({
        multiple: false,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })
      console.log('Selected file:', selected)
      if (selected && typeof selected === 'string') {
        setTranslatedPath(selected)
      }
    } catch (err) {
      console.error('Error opening file dialog:', err)
      setError(`ファイル選択エラー: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('セット名を入力してください')
      return
    }
    if (!originalPath) {
      setError('原文PDFを選択してください')
      return
    }
    if (!translatedPath) {
      setError('翻訳PDFを選択してください')
      return
    }

    setIsSubmitting(true)
    try {
      await onCreate({ name: name.trim(), originalPath, translatedPath })
      // リセット
      setName('')
      setOriginalPath('')
      setTranslatedPath('')
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラーが発生しました'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = (): void => {
    setName('')
    setOriginalPath('')
    setTranslatedPath('')
    setError(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">新しいセットを追加</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="setName" className="block text-sm font-medium text-gray-700 mb-1">
              セット名
            </label>
            <input
              type="text"
              id="setName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              placeholder="例: 論文-GPT-4-2024"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              原文PDF
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={originalPath}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                placeholder="ファイルを選択..."
              />
              <Button type="button" onClick={handleSelectOriginal} variant="secondary" size="sm">
                選択
              </Button>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              翻訳PDF
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={translatedPath}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                placeholder="ファイルを選択..."
              />
              <Button type="button" onClick={handleSelectTranslated} variant="secondary" size="sm">
                選択
              </Button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" onClick={handleCancel} variant="secondary" disabled={isSubmitting}>
              キャンセル
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? '作成中...' : '作成'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
