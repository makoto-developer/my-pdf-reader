import { useState } from 'react'
import type { PDFSet } from '@/domain/PDFSet'
import { PDFPanel } from './PDFPanel'
import { Button } from '../common/Button'

interface PDFViewerProps {
  pdfSet: PDFSet
  onBack: () => void
}

export function PDFViewer({ pdfSet, onBack }: PDFViewerProps): React.ReactElement {
  const [scrollTop, setScrollTop] = useState(0)
  const [centerAlign, setCenterAlign] = useState(true)

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-white shadow">
        <div className="max-w-full mx-auto py-4 px-4 flex items-center gap-4">
          <Button onClick={onBack} variant="secondary" size="sm">
            ← 戻る
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">{pdfSet.name}</h1>
          <div className="ml-auto">
            <Button
              onClick={() => setCenterAlign(!centerAlign)}
              variant={centerAlign ? 'primary' : 'secondary'}
              size="sm"
            >
              {centerAlign ? '中央寄せ: ON' : '中央寄せ: OFF'}
            </Button>
          </div>
        </div>
      </header>

      {/* PDF表示エリア（左右分割） */}
      <main className="flex-1 flex overflow-hidden">
        <div className="w-1/2 border-r-2 border-gray-400">
          <PDFPanel
            pdfPath={pdfSet.originalPdfPath}
            title="原文"
            scrollTop={scrollTop}
            onScroll={setScrollTop}
            align={centerAlign ? 'right' : 'center'}
          />
        </div>
        <div className="w-1/2">
          <PDFPanel
            pdfPath={pdfSet.translatedPdfPath}
            title="翻訳"
            scrollTop={scrollTop}
            onScroll={setScrollTop}
            align={centerAlign ? 'left' : 'center'}
          />
        </div>
      </main>
    </div>
  )
}
