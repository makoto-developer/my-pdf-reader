import { useState, useRef, useCallback, useEffect } from 'react'
import type { PDFSet } from '@/domain/PDFSet'
import { PDFPanel } from './PDFPanel'
import { Button } from '../common/Button'
import { logger } from '@/utils/logger'

interface PDFViewerProps {
  pdfSet: PDFSet
  onBack: () => void
}

export function PDFViewer({ pdfSet, onBack }: PDFViewerProps): React.ReactElement {
  const [centerAlign, setCenterAlign] = useState(true)
  const [scrollRatio, setScrollRatio] = useState(0)
  const rafIdRef = useRef<number | null>(null)
  const scrollSourceRef = useRef<string>('')

  // scrollRatioの変更を監視
  useEffect(() => {
    logger.info('PDFViewer', 'scrollRatio更新', {
      比率: scrollRatio.toFixed(4),
      更新元: scrollSourceRef.current,
    })
  }, [scrollRatio])

  const handleScrollOriginal = useCallback((ratio: number) => {
    const sourceLabel = '原文'

    logger.info('PDFViewer', `📥 ${sourceLabel}から受信`, {
      受信比率: ratio,
      現在比率: scrollRatio,
      差分: Math.abs(ratio - scrollRatio),
    })

    logger.debug('PDFViewer', 'handleScroll呼び出し', {
      送信元: sourceLabel,
      受信比率: ratio.toFixed(4),
      現在比率: scrollRatio.toFixed(4),
      差分: Math.abs(ratio - scrollRatio).toFixed(4),
      RAF保留中: rafIdRef.current !== null,
    })

    // 既存のrequestAnimationFrameをキャンセル
    if (rafIdRef.current !== null) {
      logger.info('PDFViewer', '❌ 保留中のRAFをキャンセル')
      cancelAnimationFrame(rafIdRef.current)
    }

    // requestAnimationFrameを使ってスムーズに更新
    rafIdRef.current = requestAnimationFrame(() => {
      logger.info('PDFViewer', '🎬 RAF実行', {
        scrollRatio: ratio,
        送信元: sourceLabel,
      })
      scrollSourceRef.current = sourceLabel
      setScrollRatio(ratio)
      rafIdRef.current = null
    })
  }, [scrollRatio])

  const handleScrollTranslated = useCallback((ratio: number) => {
    const sourceLabel = '翻訳'

    logger.info('PDFViewer', `📥 ${sourceLabel}から受信`, {
      受信比率: ratio,
      現在比率: scrollRatio,
      差分: Math.abs(ratio - scrollRatio),
    })

    logger.debug('PDFViewer', 'handleScroll呼び出し', {
      送信元: sourceLabel,
      受信比率: ratio.toFixed(4),
      現在比率: scrollRatio.toFixed(4),
      差分: Math.abs(ratio - scrollRatio).toFixed(4),
      RAF保留中: rafIdRef.current !== null,
    })

    // 既存のrequestAnimationFrameをキャンセル
    if (rafIdRef.current !== null) {
      logger.info('PDFViewer', '❌ 保留中のRAFをキャンセル')
      cancelAnimationFrame(rafIdRef.current)
    }

    // requestAnimationFrameを使ってスムーズに更新
    rafIdRef.current = requestAnimationFrame(() => {
      logger.info('PDFViewer', '🎬 RAF実行', {
        scrollRatio: ratio,
        送信元: sourceLabel,
      })
      scrollSourceRef.current = sourceLabel
      setScrollRatio(ratio)
      rafIdRef.current = null
    })
  }, [scrollRatio])

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
            scrollRatio={scrollRatio}
            onScroll={handleScrollOriginal}
            align={centerAlign ? 'right' : 'center'}
          />
        </div>
        <div className="w-1/2">
          <PDFPanel
            pdfPath={pdfSet.translatedPdfPath}
            title="翻訳"
            scrollRatio={scrollRatio}
            onScroll={handleScrollTranslated}
            align={centerAlign ? 'left' : 'center'}
          />
        </div>
      </main>
    </div>
  )
}
