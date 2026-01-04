import { useState, useEffect } from 'react'
import { configApi, type AppConfig } from '@/features/config/api/configApi'

interface SettingsProps {
  onBack: () => void
}

export function Settings({ onBack }: SettingsProps): React.ReactElement {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async (): Promise<void> => {
    try {
      setIsLoading(true)
      setError(null)
      const loadedConfig = await configApi.getConfig()
      setConfig(loadedConfig)
    } catch (err) {
      setError(`設定の読み込みに失敗しました: ${err}`)
      console.error('Failed to load config:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectDirectory = async (): Promise<void> => {
    try {
      setError(null)
      const selectedPath = await configApi.selectDirectory()
      
      if (selectedPath && config) {
        setConfig({ ...config, pdfs_directory: selectedPath })
      }
    } catch (err) {
      setError(`ディレクトリの選択に失敗しました: ${err}`)
      console.error('Failed to select directory:', err)
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!config) {
      return
    }

    try {
      setIsSaving(true)
      setError(null)
      setSuccessMessage(null)
      
      const updatedConfig = await configApi.updateConfig(config.pdfs_directory)
      setConfig(updatedConfig)
      setSuccessMessage('設定を保存しました')
      
      // 3秒後にメッセージを消す
      setTimeout(() => {
        setSuccessMessage(null)
      }, 3000)
    } catch (err) {
      setError(`設定の保存に失敗しました: ${err}`)
      console.error('Failed to save config:', err)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">設定</h1>
          <button
            onClick={onBack}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
          >
            戻る
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-800 text-sm">{successMessage}</p>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PDFファイル保存ディレクトリ
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={config?.pdfs_directory ?? ''}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700"
              />
              <button
                onClick={handleSelectDirectory}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                選択
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              PDFファイルが保存されるディレクトリを指定します。デフォルトは ~/my_pdf_reader_book です。
            </p>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`w-full px-4 py-3 text-white rounded-md transition-colors ${
                isSaving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {isSaving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
