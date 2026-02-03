import { useState, useRef, useCallback, useEffect } from 'react'
import type { PDFSet } from '@/domain/PDFSet'
import { PDFPanel } from './PDFPanel'
import { Button } from '../common/Button'
import { logger } from '@/utils/logger'
import { getCurrentWindow, currentMonitor } from '@tauri-apps/api/window'
import { LogicalSize } from '@tauri-apps/api/dpi'

interface PDFViewerProps {
  pdfSet: PDFSet
  onBack: () => void
}

export function PDFViewer({ pdfSet, onBack }: PDFViewerProps): React.ReactElement {
  const [centerAlign, setCenterAlign] = useState(true)
  const [scrollRatio, setScrollRatio] = useState(0)
  const [scale, setScale] = useState<number | undefined>(undefined)
  const [autoResize, setAutoResize] = useState(false)
  const rafIdRef = useRef<number | null>(null)
  const scrollSourceRef = useRef<string>('')
  const mainContainerRef = useRef<HTMLDivElement>(null)

  // scrollRatioの変更を監視
  useEffect(() => {
    logger.info('PDFViewer', 'scrollRatio更新', {
      比率: scrollRatio.toFixed(4),
      更新元: scrollSourceRef.current,
    })
  }, [scrollRatio])

  // scaleの変更を監視
  useEffect(() => {
    if (scale !== undefined) {
      logger.info('PDFViewer', 'scale更新', {
        スケール: scale.toFixed(3),
        パーセント: `${Math.round(scale * 100)}%`,
      })
    }
  }, [scale])

  // ウィンドウリサイズを監視して自動リサイズ
  useEffect(() => {
    if (!autoResize) return

    const handleResize = (): void => {
      // PDFの基本幅
      const PDF_BASE_WIDTH = 531

      // メインコンテナの幅を取得
      const mainContainer = mainContainerRef.current
      if (!mainContainer) {
        logger.warn('PDFViewer', 'メインコンテナが見つかりません')
        return
      }

      // 左右のパネル幅 (mainコンテナの幅の半分)
      const panelWidth = mainContainer.clientWidth / 2

      // パディング (align='right'または'left'の場合は16px)
      const PADDING = centerAlign ? 16 : 32
      const availableWidth = panelWidth - PADDING - 10 // 境界線とマージンを考慮

      // 新しいスケールを計算
      const newScale = availableWidth / PDF_BASE_WIDTH
      const finalScale = Math.max(0.3, Math.min(2.5, newScale))

      logger.info('PDFViewer', '🔄 自動リサイズ', {
        panelWidth,
        availableWidth,
        calculatedScale: newScale.toFixed(3),
        finalScale: finalScale.toFixed(3),
      })

      setScale(finalScale)
    }

    // リサイズイベントを監視
    window.addEventListener('resize', handleResize)

    // 初回実行
    handleResize()

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [autoResize, centerAlign])

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

  // PDFの横幅に合わせてウィンドウサイズを調整
  const handleFitToContent = async (): Promise<void> => {
    if (!scale) {
      logger.warn('PDFViewer', 'スケールが未設定のため、ウィンドウサイズ調整をスキップ')
      return
    }

    try {
      const window = getCurrentWindow()
      const monitor = await currentMonitor()

      if (!monitor) {
        logger.error('PDFViewer', 'モニター情報の取得に失敗')
        return
      }

      // PDFの基本幅 (PDF.jsで取得した幅)
      const PDF_BASE_WIDTH = 531

      // 必要な幅を計算
      // - PDF幅 * scale * 2 (左右のパネル)
      // - + パディング (左右16px * 2 = 32px * 2パネル = 64px)
      // - + 中央の境界線 (2px)
      // - + ヘッダー/その他のマージン (約40px)
      const pdfWidth = PDF_BASE_WIDTH * scale
      const totalPadding = 64 // 左右のパディング
      const border = 2 // 中央の境界線
      const margin = 40 // その他のマージン
      const requiredWidth = Math.ceil(pdfWidth * 2 + totalPadding + border + margin)

      // モニターの作業領域を取得 (タスクバー等を除いた領域)
      const maxWidth = monitor.size.width
      const maxHeight = monitor.size.height

      // ディスプレイをはみ出さないように調整
      const finalWidth = Math.min(requiredWidth, maxWidth - 20) // 左右10pxずつマージン
      
      // 高さは現在の高さを維持 (または最大高さに制限)
      const currentSize = await window.outerSize()
      const finalHeight = Math.min(currentSize.height, maxHeight - 40) // 上下20pxずつマージン

      logger.info('PDFViewer', 'ウィンドウサイズ調整', {
        scale: scale.toFixed(3),
        pdfWidth: pdfWidth.toFixed(0),
        requiredWidth,
        maxWidth,
        finalWidth,
        currentHeight: currentSize.height,
        finalHeight,
      })

      // ウィンドウサイズを設定
      await window.setSize(new LogicalSize(finalWidth, finalHeight))

      logger.info('PDFViewer', 'ウィンドウサイズ調整完了')
    } catch (error) {
      logger.error('PDFViewer', 'ウィンドウサイズ調整エラー', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-white shadow">
        <div className="max-w-full mx-auto py-4 px-4 flex items-center gap-4">
          <Button onClick={onBack} variant="secondary" size="sm">
            ← 戻る
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">{pdfSet.name}</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button
              onClick={handleFitToContent}
              variant="secondary"
              size="sm"
              disabled={!scale}
            >
              📐 ウィンドウを調整
            </Button>
            <Button
              onClick={() => setAutoResize(!autoResize)}
              variant={autoResize ? 'primary' : 'secondary'}
              size="sm"
            >
              {autoResize ? '🔄 自動リサイズ: ON' : '🔄 自動リサイズ: OFF'}
            </Button>
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
      <main ref={mainContainerRef} className="flex-1 flex overflow-hidden">
        <div className="w-1/2 border-r-2 border-gray-400">
          <PDFPanel
            pdfPath={pdfSet.originalPdfPath}
            title="原文"
            scrollRatio={scrollRatio}
            onScroll={handleScrollOriginal}
            align={centerAlign ? 'right' : 'center'}
            scale={scale}
            onScaleChange={setScale}
          />
        </div>
        <div className="w-1/2">
          <PDFPanel
            pdfPath={pdfSet.translatedPdfPath}
            title="翻訳"
            scrollRatio={scrollRatio}
            onScroll={handleScrollTranslated}
            align={centerAlign ? 'left' : 'center'}
            scale={scale}
            onScaleChange={setScale}
          />
        </div>
      </main>
    </div>
  )
}
