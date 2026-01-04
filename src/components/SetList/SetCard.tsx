import { useState } from 'react'
import type { PDFSet } from '@/domain/PDFSet'
import { Button } from '../common/Button'
import { confirm } from '@tauri-apps/plugin-dialog'

interface SetCardProps {
  set: PDFSet
  onOpen: (set: PDFSet) => void
  onUpdate: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => void
}

export function SetCard({ set, onOpen, onUpdate, onDelete }: SetCardProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(set.name)
  const [isSaving, setIsSaving] = useState(false)

  const handleDelete = async (): Promise<void> => {
    const confirmed = await confirm(`「${set.name}」を削除してもよろしいですか？`, {
      title: '削除の確認',
      kind: 'warning',
      okLabel: '削除',
      cancelLabel: 'キャンセル',
    })

    if (confirmed) {
      onDelete(set.id)
    }
  }

  const handleSave = async (): Promise<void> => {
    if (editedName.trim() === '') {
      alert('タイトルを入力してください')
      return
    }

    setIsSaving(true)
    try {
      await onUpdate(set.id, editedName.trim())
      setIsEditing(false)
    } catch (error) {
      alert('タイトルの更新に失敗しました')
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = (): void => {
    setEditedName(set.name)
    setIsEditing(false)
  }

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '未読'
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          {isEditing ? (
            <div className="mb-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="w-full text-lg font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSaving}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSave()
                  } else if (e.key === 'Escape') {
                    handleCancel()
                  }
                }}
              />
            </div>
          ) : (
            <h3
              className="text-lg font-semibold text-gray-900 mb-2 cursor-pointer hover:text-blue-600"
              onClick={() => setIsEditing(true)}
              title="クリックして編集"
            >
              {set.name}
            </h3>
          )}
          <p className="text-sm text-gray-500">
            作成日: {formatDate(set.createdAt)}
          </p>
          {set.lastOpenedAt && (
            <p className="text-sm text-gray-500">
              最終アクセス: {formatDate(set.lastOpenedAt)}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        {isEditing ? (
          <>
            <Button onClick={handleSave} variant="primary" size="sm" disabled={isSaving}>
              {isSaving ? '保存中...' : '保存'}
            </Button>
            <Button onClick={handleCancel} variant="secondary" size="sm" disabled={isSaving}>
              キャンセル
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => onOpen(set)} variant="primary" size="sm">
              開く
            </Button>
            <Button onClick={() => setIsEditing(true)} variant="secondary" size="sm">
              編集
            </Button>
            <Button onClick={handleDelete} variant="danger" size="sm">
              削除
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
