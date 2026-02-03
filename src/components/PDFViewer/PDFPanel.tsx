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

// ページ番号からスクロール位置を計算する関数（改善2: 実際のページ高さを使用）
// DOM要素のgap/paddingを考慮して正確な位置を計算
// 注: 現在は使用されていないが、将来的にページベースの同期を再実装する際に使用
function calculateScrollTopFromPage(
  pageNumber: number,
  container: HTMLDivElement,
  totalPages: number,
  pageHeights: number[] = []
): number {
  if (totalPages === 0) return 0

  // Tailwind CSS の gap-4 = 16px, py-4 = 16px (上) + 16px (下)
  const GAP_SIZE = 16 // gap-4
  const PADDING_TOP = 16 // py-4 の上側

  const maxScroll = container.scrollHeight - container.clientHeight

  // 実際のページ高さが記録されている場合は累積高さを使用
  if (pageHeights.length > 0 && pageHeights[0] !== undefined) {
    let cumulativeHeight = PADDING_TOP

    // 目標ページまでの累積高さを計算
    for (let i = 0; i < pageNumber && i < pageHeights.length; i++) {
      const height = pageHeights[i] || pageHeights[0]
      cumulativeHeight += height + GAP_SIZE
    }

    // 記録されていないページは最初のページの高さで推定
    if (pageNumber >= pageHeights.length) {
      const estimatedHeight = pageHeights[0]
      const remainingPages = pageNumber - pageHeights.length
      cumulativeHeight += remainingPages * (estimatedHeight + GAP_SIZE)
    }

    return Math.min(Math.max(0, cumulativeHeight), maxScroll)
  }

  // フォールバック: 平均ページ高さを使用（従来の方法）
  const scrollableHeight = maxScroll
  const gapTotal = GAP_SIZE * (totalPages - 1)
  const pageHeight = Math.max(0, (scrollableHeight - gapTotal - PADDING_TOP) / totalPages)
  const targetScrollTop = PADDING_TOP + (pageHeight * pageNumber) + (GAP_SIZE * pageNumber)

  return Math.min(Math.max(0, targetScrollTop), maxScroll)
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
  const [scale, setScale] = useState<number | undefined>(undefined) // PDFの表示スケール（自動計算）
  const isScrollingProgrammatically = useRef(false)
  const renderedPagesRef = useRef<Set<number>>(new Set())
  const lastUserScrollRatioRef = useRef<number>(-1) // -1で初期化（0と区別するため）
  const lastUserScrollTopRef = useRef<number>(0) // ピクセル単位の最後のスクロール位置
  const scrollDebounceTimerRef = useRef<number | null>(null)
  const hasInitialSyncRef = useRef(false) // 初回同期フラグ
  const PIXEL_THRESHOLD = 50 // ピクセル単位の閾値（50px以上移動で送信）

  // 仮想スクロール用の状態
  const [visiblePages, setVisiblePages] = useState<{ start: number; end: number }>({ start: 0, end: 10 })
  const pageHeightsRef = useRef<number[]>([]) // 各ページの高さを記録
  const RENDER_BUFFER = 5 // 表示範囲の前後にレンダリングするページ数

  // 改善3: 動的閾値（ページ数に応じて調整）
  // より小さい閾値にしてページ内のスクロールも検出できるようにする
  const SCROLL_THRESHOLD = totalPages > 0 ? Math.max(0.0001, 0.2 / totalPages) : 0.0005

  // 例: 900ページの場合
  // 0.2 / 900 = 0.00022 (0.022% = 約1/5ページ分)
  // これならページ内でも検出される

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

        // 最初のページの幅を取得してスケールを計算
        const firstPage = await pdf.getPage(1)
        const initialViewport = firstPage.getViewport({ scale: 1.0 })

        // isLoadingをfalseにしてDOMをレンダリング
        setIsLoading(false)

        // DOMが完全にレンダリングされるまで待つ
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

        // コンテナの幅を取得
        const container = scrollContainerRef.current
        if (!container) {
          logger.warn(title, 'コンテナが見つかりません。スケール計算をスキップします。')
          // デフォルトスケールを設定
          setScale(1.0)
          return
        }

        // 実際に使用可能な幅を計算
        // alignに応じてパディングを計算
        // - align='right': pr-4 (右側のみ 16px)
        // - align='left': pl-4 (左側のみ 16px)
        // - align='center': px-4 (両側 32px)
        const PADDING = align === 'center' ? 32 : 16
        const containerWidth = container.clientWidth
        const availableWidth = containerWidth - PADDING

        // PDFの幅に合わせてスケールを計算
        const calculatedScale = availableWidth / initialViewport.width

        // スケールを設定（最小0.3、最大2.5）
        const finalScale = Math.max(0.3, Math.min(2.5, calculatedScale))
        setScale(finalScale)

        logger.info(title, '🔍 スケール自動計算完了', {
          containerWidth,
          PADDING,
          availableWidth,
          pdfWidth: initialViewport.width,
          calculatedScale: calculatedScale.toFixed(3),
          finalScale: finalScale.toFixed(3),
          PDFがコンテナに収まる: finalScale === calculatedScale,
        })

        // 計算したスケールでビューポートを再取得
        const viewport = firstPage.getViewport({ scale: finalScale })
        pageHeightsRef.current[0] = viewport.height

        // 初期表示範囲を設定
        setVisiblePages({
          start: 0,
          end: Math.min(RENDER_BUFFER, pdf.numPages - 1),
        })

        console.log('PDF loaded successfully:', pdf.numPages, 'pages')

        // 動的閾値を計算してログ
        const dynamicThreshold = Math.max(0.001, 1.0 / pdf.numPages)
        logger.info(title, 'PDF読み込み完了（仮想スクロール + 改善版）', {
          totalPages: pdf.numPages,
          estimatedPageHeight: viewport.height,
          dynamicThreshold: dynamicThreshold.toFixed(4),
          thresholdPercentage: (dynamicThreshold * 100).toFixed(2) + '%',
          initialVisibleRange: `${0} - ${Math.min(RENDER_BUFFER, pdf.numPages - 1)}`,
        })
      } catch (err) {
        console.error('Error loading PDF:', err)
        setError(`PDFの読み込みに失敗しました: ${err instanceof Error ? err.message : String(err)}`)
        setIsLoading(false)
      }
    }

    loadPDF()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfPath])

  // スクロール比率を同期
  useEffect(() => {
    logger.info(title, '=== スクロール同期 useEffect 開始 ===', {
      scrollRatio,
      totalPages,
    })

    if (!scrollContainerRef.current) {
      logger.info(title, '❌ コンテナ未準備')
      return
    }

    const container = scrollContainerRef.current
    const maxScroll = container.scrollHeight - container.clientHeight

    logger.info(title, 'コンテナ情報', {
      scrollHeight: container.scrollHeight,
      clientHeight: container.clientHeight,
      maxScroll,
      現在のscrollTop: container.scrollTop,
    })

    if (maxScroll <= 0) {
      logger.info(title, '❌ maxScroll <= 0 (スクロール不可)')
      return
    }

    const diff = Math.abs(scrollRatio - lastUserScrollRatioRef.current)
    const isInitialSync = !hasInitialSyncRef.current && scrollRatio === 0

    logger.info(title, '差分チェック', {
      受信比率: scrollRatio,
      前回比率: lastUserScrollRatioRef.current,
      差分: diff,
      閾値: SCROLL_THRESHOLD,
      初回同期: isInitialSync,
      スキップ判定: !isInitialSync && diff < SCROLL_THRESHOLD,
    })

    // 初回同期ではない場合、差分チェック
    // 親から受け取ったスクロール比率が、自分が最後に送信した比率と同じ場合はスキップ
    // （無限ループ防止）
    if (!isInitialSync && diff < SCROLL_THRESHOLD) {
      logger.info(title, '⏭️ スキップ（差分が閾値未満）', {
        差分: diff.toFixed(4),
        閾値: SCROLL_THRESHOLD.toFixed(4),
      })
      return
    }

    if (isInitialSync) {
      logger.info(title, '✅ 初回同期を実行')
      hasInitialSyncRef.current = true
    }

    // プログラムによるスクロールフラグを立てる
    isScrollingProgrammatically.current = true
    logger.info(title, '🚩 プログラムスクロールフラグ: true')

    // 比率ベースの同期：scrollRatioを直接使用してスクロール位置を計算
    const targetScrollTop = scrollRatio * maxScroll
    const beforeScrollTop = container.scrollTop

    logger.info(title, '📊 スクロール位置計算（改善版 - 比率直接使用）', {
      受信比率: scrollRatio,
      maxScroll,
      targetScrollTop,
      beforeScrollTop,
      差分: targetScrollTop - beforeScrollTop,
    })

    logger.info(title, 'スクロール同期実行（比率ベース）', {
      受信比率: scrollRatio.toFixed(4),
      maxScroll,
      scrollHeight: container.scrollHeight,
      targetScrollTop: targetScrollTop.toFixed(2),
      beforeScrollTop: beforeScrollTop.toFixed(2),
    })

    // 同期的にスクロール位置を更新
    container.scrollTop = targetScrollTop

    // 表示ページ範囲を更新（仮想スクロール）
    updateVisiblePages(targetScrollTop)

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
          ratio: scrollRatio.toFixed(4),
          target: targetScrollTop.toFixed(2),
          actual: actualScrollTop.toFixed(2),
        })
      }
    })

    // 最後に受信した比率を更新
    lastUserScrollRatioRef.current = scrollRatio

    // 改善4: RAF完全同期（タイムアウトではなくフレーム完了時にリセット）
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isScrollingProgrammatically.current = false
        logger.debug(title, 'プログラムスクロールフラグリセット')
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRatio, totalPages])

  // スクロール位置から表示すべきページ範囲を計算
  const updateVisiblePages = (scrollTop: number): void => {
    if (totalPages === 0 || !scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const currentPage = calculatePageNumber(scrollTop, container.scrollHeight, totalPages)

    // 現在のページ ± RENDER_BUFFER ページを表示
    const start = Math.max(0, currentPage - RENDER_BUFFER)
    const end = Math.min(totalPages - 1, currentPage + RENDER_BUFFER)

    // 範囲が変わった場合のみ更新
    if (start !== visiblePages.start || end !== visiblePages.end) {
      setVisiblePages({ start, end })
      logger.debug(title, '表示ページ範囲更新', {
        currentPage,
        start,
        end,
        totalVisible: end - start + 1,
      })
    }
  }

  // スクロールイベントハンドラ
  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const target = e.currentTarget

    logger.info(title, '🖱️ handleScroll イベント発火', {
      scrollTop: target.scrollTop,
      プログラムスクロール: isScrollingProgrammatically.current,
    })

    // 表示ページ範囲を更新（仮想スクロール）
    updateVisiblePages(target.scrollTop)

    // プログラムによるスクロールの場合は同期しない
    if (isScrollingProgrammatically.current) {
      logger.info(title, '⏭️ プログラムスクロールのため無視')
      return
    }

    const maxScroll = target.scrollHeight - target.clientHeight

    if (maxScroll <= 0) {
      logger.info(title, '❌ maxScroll <= 0')
      return
    }

    // スクロール比率を計算（0-1の範囲）
    const ratio = target.scrollTop / maxScroll
    logger.info(title, '📐 比率計算', { ratio: ratio.toFixed(4) })

    // デバウンス処理：既存のタイマーをクリア
    if (scrollDebounceTimerRef.current !== null) {
      clearTimeout(scrollDebounceTimerRef.current)
    }

    // 50ms後にスクロール比率を送信
    scrollDebounceTimerRef.current = window.setTimeout(() => {
      const diff = Math.abs(ratio - lastUserScrollRatioRef.current)
      const pixelDiff = Math.abs(target.scrollTop - lastUserScrollTopRef.current)

      // 比率ベースまたはピクセルベースのいずれかで閾値を超えていれば送信
      const shouldSend = diff >= SCROLL_THRESHOLD || pixelDiff >= PIXEL_THRESHOLD

      logger.info(title, '⏱️ デバウンス完了', {
        比率: ratio,
        前回比率: lastUserScrollRatioRef.current,
        比率差分: diff,
        比率閾値: SCROLL_THRESHOLD,
        scrollTop: target.scrollTop,
        前回scrollTop: lastUserScrollTopRef.current,
        ピクセル差分: pixelDiff,
        ピクセル閾値: PIXEL_THRESHOLD,
        送信判定: shouldSend,
      })

      // 差分が閾値以上の場合のみ送信
      if (shouldSend) {
        const currentPage = calculatePageNumber(target.scrollTop, target.scrollHeight, totalPages)

        logger.info(title, '📤 親に送信！', {
          比率: ratio,
          ページ: currentPage,
        })

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

        // 最後に送信した比率とスクロール位置を記録
        lastUserScrollRatioRef.current = ratio
        lastUserScrollTopRef.current = target.scrollTop

        // 親に通知
        onScroll(ratio)
      } else {
        logger.info(title, '⏭️ 送信スキップ（差分が閾値未満）')
      }

      scrollDebounceTimerRef.current = null
    }, 50)
  }

  // トラックパッドでのピンチズーム対応
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>): void => {
    // Ctrl + ホイール = ピンチズーム
    if (e.ctrlKey) {
      e.preventDefault()

      if (!scale) return

      // deltaYが負の値 = 拡大、正の値 = 縮小
      const zoomDelta = -e.deltaY * 0.01
      const newScale = Math.max(0.3, Math.min(2.5, scale + zoomDelta))

      setScale(newScale)

      logger.info(title, '🔍 ピンチズーム', {
        deltaY: e.deltaY,
        zoomDelta: zoomDelta.toFixed(3),
        oldScale: scale.toFixed(3),
        newScale: newScale.toFixed(3),
      })
    }
  }

  // スケールが変更された時はレンダリング済みフラグをクリア
  useEffect(() => {
    renderedPagesRef.current.clear()
  }, [scale])

  // 表示範囲のページをレンダリング（仮想スクロール）
  useEffect(() => {
    if (!pdfDocument || totalPages === 0) return
    // スケールが未定義の場合はレンダリングしない（スケール計算中）
    if (scale === undefined) return

    let isCancelled = false
    const renderTasks: pdfjsLib.RenderTask[] = []

    const renderVisiblePages = async (): Promise<void> => {
      try {
        // 表示範囲のページのみレンダリング
        for (let pageNum = visiblePages.start + 1; pageNum <= visiblePages.end + 1; pageNum++) {
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

          // 自動計算されたスケールを使用
          const viewport = page.getViewport({ scale })
          canvas.height = viewport.height
          canvas.width = viewport.width

          // ページ高さを記録（仮想スクロール用）
          pageHeightsRef.current[pageNum - 1] = viewport.height

          const renderTask = page.render({
            canvasContext: context,
            viewport,
          } as any)

          renderTasks.push(renderTask)

          try {
            await renderTask.promise
            renderedPagesRef.current.add(pageNum)
            logger.debug(title, 'ページレンダリング完了（改善版）', {
              pageNum,
              height: viewport.height,
              totalRecorded: pageHeightsRef.current.filter((h) => h !== undefined).length,
            })
          } catch (err) {
            // キャンセルエラーは無視
            if (err instanceof Error && err.name === 'RenderingCancelledException') {
              console.log('Rendering cancelled:', pageNum)
            } else {
              throw err
            }
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Error rendering pages:', err)
          setError(`ページのレンダリングに失敗しました: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }

    renderVisiblePages()

    return () => {
      isCancelled = true
      renderTasks.forEach((task) => {
        task.cancel()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDocument, totalPages, visiblePages, scale])

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
          {scale && (
            <span className="text-xs text-gray-500">
              • {Math.round(scale * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* PDF表示エリア */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onWheel={handleWheel}
        className="flex-1 overflow-auto"
      >
        <div className={`flex flex-col gap-4 py-4 ${
          align === 'right' ? 'items-end pr-4' :
          align === 'left' ? 'items-start pl-4' :
          'items-center px-4'
        }`}>
          {/* 上部スペーサー（表示範囲外の上部） */}
          {visiblePages.start > 0 && (
            <div
              style={{
                height: `${(() => {
                  const GAP_SIZE = 16
                  let totalHeight = 0
                  const estimatedHeight = pageHeightsRef.current[0] || 800

                  // 実際のページ高さを累積
                  for (let i = 0; i < visiblePages.start; i++) {
                    totalHeight += (pageHeightsRef.current[i] || estimatedHeight) + GAP_SIZE
                  }

                  return totalHeight
                })()}px`,
              }}
            />
          )}

          {/* 表示範囲のページをレンダリング */}
          {Array.from(
            { length: visiblePages.end - visiblePages.start + 1 },
            (_, i) => visiblePages.start + i
          ).map((index) => (
            <canvas
              key={index}
              ref={(el) => {
                canvasRefs.current[index] = el
              }}
              className="shadow-lg"
            />
          ))}

          {/* 下部スペーサー（表示範囲外の下部） */}
          {visiblePages.end < totalPages - 1 && (
            <div
              style={{
                height: `${(() => {
                  const GAP_SIZE = 16
                  let totalHeight = 0
                  const estimatedHeight = pageHeightsRef.current[0] || 800

                  // 実際のページ高さを累積
                  for (let i = visiblePages.end + 1; i < totalPages; i++) {
                    totalHeight += (pageHeightsRef.current[i] || estimatedHeight) + GAP_SIZE
                  }

                  return totalHeight
                })()}px`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
