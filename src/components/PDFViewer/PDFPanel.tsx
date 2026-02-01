import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { convertFileSrc } from '@tauri-apps/api/core'
import { logger } from '@/utils/logger'

// PDF.js workerの設定（CDNから読み込み - 安定版）
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs'

interface PDFPanelProps {
  pdfPath: string
  title: string
  scrollRatio: number
  onScroll: (ratio: number) => void
  align: 'left' | 'right' | 'center'
}

// ページ番号を計算する関数
function calculatePageNumber(scrollTop: number, scrollHeight: number, totalPages: number): number {
  if (scrollHeight === 0 || totalPages === 0) return 0
  // スクロール位置の比率からページ番号を推定（0-1の範囲 → 0からtotalPages-1）
  const ratio = scrollTop / scrollHeight
  return Math.floor(ratio * totalPages)
}

// ページ番号からスクロール位置を計算する関数
function calculateScrollTopFromPage(pageNumber: number, scrollHeight: number, totalPages: number): number {
  if (totalPages === 0) return 0
  const ratio = pageNumber / totalPages
  return ratio * scrollHeight
}

export function PDFPanel({
  pdfPath,
  title,
  scrollRatio,
  onScroll,
  align,
}: PDFPanelProps): React.ReactElement {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [pdfDocument, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const isScrollingProgrammatically = useRef(false)
  const renderedPagesRef = useRef<Set<number>>(new Set())
  const lastUserScrollRatioRef = useRef<number>(0)
  const scrollDebounceTimerRef = useRef<number | null>(null)
  const SCROLL_THRESHOLD = 0.005 // スクロール差分の閾値（0.5%）

  // PDFを読み込む
  useEffect(() => {
    const loadPDF = async (): Promise<void> => {
      setIsLoading(true)
      setError(null)
      renderedPagesRef.current.clear()

      try {
        const assetUrl = convertFileSrc(pdfPath)
        console.log('Loading PDF from:', pdfPath, '→', assetUrl)
        const loadingTask = pdfjsLib.getDocument(assetUrl)
        const pdf = await loadingTask.promise
        setPdfDocument(pdf)
        setTotalPages(pdf.numPages)
        setIsLoading(false)
        console.log('PDF loaded successfully:', pdf.numPages, 'pages')
      } catch (err) {
        console.error('Error loading PDF:', err)
        setError(`PDFの読み込みに失敗しました: ${err instanceof Error ? err.message : String(err)}`)
        setIsLoading(false)
      }
    }

    loadPDF()
  }, [pdfPath])

  // スクロール比率を同期
  useEffect(() => {
    if (!scrollContainerRef.current) {
      logger.debug(title, 'スクロール同期: コンテナ未準備')
      return
    }

    const container = scrollContainerRef.current
    const maxScroll = container.scrollHeight - container.clientHeight

    // スクロールコンテナの詳細情報をログ
    logger.debug(title, 'スクロールコンテナ情報', {
      scrollHeight: container.scrollHeight,
      clientHeight: container.clientHeight,
      maxScroll,
      現在のscrollTop: container.scrollTop,
    })

    if (maxScroll <= 0) {
      logger.debug(title, 'スクロール同期: maxScroll <= 0')
      return
    }

    const diff = Math.abs(scrollRatio - lastUserScrollRatioRef.current)

    // 親から受け取ったスクロール比率が、自分が最後に送信した比率と同じ場合はスキップ
    // （無限ループ防止）
    if (diff < SCROLL_THRESHOLD) {
      logger.debug(title, 'スクロール同期: スキップ（差分小）', {
        差分: diff.toFixed(4),
        閾値: SCROLL_THRESHOLD.toFixed(4),
      })
      return
    }

    // プログラムによるスクロールフラグを立てる
    isScrollingProgrammatically.current = true

    // ページ番号ベースの同期：比率からページ番号を推定
    const estimatedPage = Math.floor(scrollRatio * totalPages)

    // 自分のPDFの高さに合わせてスクロール位置を計算
    const targetScrollTop = calculateScrollTopFromPage(estimatedPage, container.scrollHeight, totalPages)
    const beforeScrollTop = container.scrollTop

    logger.info(title, 'スクロール同期実行（ページベース）', {
      受信比率: scrollRatio.toFixed(4),
      推定ページ: estimatedPage,
      totalPages,
      scrollHeight: container.scrollHeight,
      targetScrollTop: targetScrollTop.toFixed(2),
      beforeScrollTop: beforeScrollTop.toFixed(2),
    })

    // 同期的にスクロール位置を更新
    container.scrollTop = targetScrollTop

    // 実際に設定された位置を確認（次のフレームで）
    requestAnimationFrame(() => {
      const actualScrollTop = container.scrollTop
      const scrollDiff = Math.abs(actualScrollTop - targetScrollTop)

      if (scrollDiff > 1) {
        logger.warn(title, 'スクロール位置にズレ検出', {
          target: targetScrollTop.toFixed(2),
          actual: actualScrollTop.toFixed(2),
          ズレ: scrollDiff.toFixed(2),
        })
      } else {
        logger.debug(title, 'スクロール同期完了', {
          page: estimatedPage,
          target: targetScrollTop.toFixed(2),
          actual: actualScrollTop.toFixed(2),
        })
      }
    })

    // 最後に受信した比率を更新
    lastUserScrollRatioRef.current = scrollRatio

    // フラグを戻す（100ms後に確実にリセット）
    setTimeout(() => {
      isScrollingProgrammatically.current = false
    }, 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRatio, totalPages])

  // スクロールイベントハンドラ
  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const target = e.currentTarget

    // プログラムによるスクロールの場合は同期しない
    if (isScrollingProgrammatically.current) {
      return
    }

    const maxScroll = target.scrollHeight - target.clientHeight

    if (maxScroll <= 0) {
      return
    }

    // スクロール比率を計算（0-1の範囲）
    const ratio = target.scrollTop / maxScroll

    // デバウンス処理：既存のタイマーをクリア
    if (scrollDebounceTimerRef.current !== null) {
      clearTimeout(scrollDebounceTimerRef.current)
    }

    // 50ms後にスクロール比率を送信
    scrollDebounceTimerRef.current = window.setTimeout(() => {
      const diff = Math.abs(ratio - lastUserScrollRatioRef.current)

      // 差分が閾値以上の場合のみ送信
      if (diff >= SCROLL_THRESHOLD) {
        const currentPage = calculatePageNumber(target.scrollTop, target.scrollHeight, totalPages)

        logger.info(title, 'ユーザースクロール送信', {
          scrollTop: target.scrollTop.toFixed(2),
          scrollHeight: target.scrollHeight,
          clientHeight: target.clientHeight,
          maxScroll,
          currentPage,
          totalPages,
          比率: ratio.toFixed(4),
          前回比率: lastUserScrollRatioRef.current.toFixed(4),
          差分: diff.toFixed(4),
        })

        // 最後に送信した比率を記録
        lastUserScrollRatioRef.current = ratio

        // 親に通知
        onScroll(ratio)
      }

      scrollDebounceTimerRef.current = null
    }, 50)
  }

  // すべてのページをレンダリング
  useEffect(() => {
    if (!pdfDocument || totalPages === 0) return

    let isCancelled = false
    const renderTasks: pdfjsLib.RenderTask[] = []

    const renderAllPages = async (): Promise<void> => {
      try {
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          if (isCancelled) break

          // 既にレンダリング済みのページはスキップ
          if (renderedPagesRef.current.has(pageNum)) {
            continue
          }

          const page = await pdfDocument.getPage(pageNum)
          const canvas = canvasRefs.current[pageNum - 1]
          if (!canvas) continue

          const context = canvas.getContext('2d')
          if (!context) continue

          const viewport = page.getViewport({ scale: 1.5 })
          canvas.height = viewport.height
          canvas.width = viewport.width

          const renderTask = page.render({
            canvasContext: context,
            viewport,
          } as any)

          renderTasks.push(renderTask)

          try {
            await renderTask.promise
            renderedPagesRef.current.add(pageNum)
          } catch (err) {
            // キャンセルエラーは無視
            if (err instanceof Error && err.name === 'RenderingCancelledException') {
              console.log('Rendering cancelled:', pageNum)
            } else {
              throw err
            }
          }
        }

        // 全ページレンダリング完了後、スクロール位置を確認してリセット
        if (scrollContainerRef.current) {
          const container = scrollContainerRef.current

          logger.info(title, 'レンダリング完了時のスクロール情報（リセット前）', {
            scrollTop: container.scrollTop,
            scrollHeight: container.scrollHeight,
            clientHeight: container.clientHeight,
            maxScroll: container.scrollHeight - container.clientHeight,
          })

          // スクロール位置を強制的に0にリセット
          if (container.scrollTop !== 0) {
            logger.warn(title, 'スクロール位置が0でないためリセット', {
              before: container.scrollTop,
            })
            container.scrollTop = 0
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Error rendering pages:', err)
          setError(`ページのレンダリングに失敗しました: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }

    renderAllPages()

    return () => {
      isCancelled = true
      renderTasks.forEach((task) => {
        task.cancel()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDocument, totalPages])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-2">エラー</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b px-4 py-2">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm text-gray-600">
            {totalPages} ページ
          </span>
        </div>
      </div>

      {/* PDF表示エリア */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto"
      >
        <div className={`flex flex-col gap-4 py-4 ${
          align === 'right' ? 'items-end pr-4' :
          align === 'left' ? 'items-start pl-4' :
          'items-center px-4'
        }`}>
          {Array.from({ length: totalPages }, (_, index) => (
            <canvas
              key={index}
              ref={(el) => {
                canvasRefs.current[index] = el
              }}
              className="shadow-lg"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
