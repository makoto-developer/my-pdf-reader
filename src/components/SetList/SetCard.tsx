import type { PDFSet } from '@/domain/PDFSet'
import { Button } from '../common/Button'
import { confirm } from '@tauri-apps/plugin-dialog'

interface SetCardProps {
  set: PDFSet
  onOpen: (set: PDFSet) => void
  onDelete: (id: string) => void
}

export function SetCard({ set, onOpen, onDelete }: SetCardProps): React.ReactElement {
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{set.name}</h3>
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
        <Button onClick={() => onOpen(set)} variant="primary" size="sm">
          開く
        </Button>
        <Button onClick={handleDelete} variant="danger" size="sm">
          削除
        </Button>
      </div>
    </div>
  )
}
