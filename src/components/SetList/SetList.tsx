import { useState } from 'react'
import type { PDFSet, CreatePDFSetParams } from '@/domain/PDFSet'
import { usePDFSets } from '@/features/pdfSet/hooks/usePDFSets'
import { Button } from '../common/Button'
import { SetCard } from './SetCard'
import { NewSetDialog } from './NewSetDialog'

interface SetListProps {
  onOpenSet: (set: PDFSet) => void
}

export function SetList({ onOpenSet }: SetListProps): React.ReactElement {
  const { sets, isLoading, error, createSet, deleteSet } = usePDFSets()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleCreateSet = async (params: CreatePDFSetParams): Promise<void> => {
    await createSet(params)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 mb-2">エラーが発生しました</p>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">My PDF Reader</h1>
          <Button onClick={() => setIsDialogOpen(true)} variant="primary">
            + 新しいセット
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {sets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-4">セットがありません</p>
            <p className="text-gray-400 text-sm">
              「+ 新しいセット」ボタンからPDFセットを追加してください
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sets.map((set) => (
              <SetCard
                key={set.id}
                set={set}
                onOpen={onOpenSet}
                onDelete={deleteSet}
              />
            ))}
          </div>
        )}
      </main>

      <NewSetDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onCreate={handleCreateSet}
      />
    </div>
  )
}
