import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { convertFileSrc } from '@tauri-apps/api/core'

// PDF.js workerの設定（CDNから読み込み - 安定版）
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs'

interface PDFPanelProps {
  pdfPath: string
  title: string
  scrollTop: number
  onScroll: (scrollTop: number) => void
  align: 'left' | 'right' | 'center'
}

export function PDFPanel({ pdfPath, title, scrollTop, onScroll, align }: PDFPanelProps): React.ReactElement {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [pdfDocument, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const isScrollingProgrammatically = useRef(false)
  const renderedPagesRef = useRef<Set<number>>(new Set())

  // PDFを読み込む
  useEffect(() => {
    const loadPDF = async (): Promise<void> => {
      setIsLoading(true)
      setError(null)
      renderedPagesRef.current.clear() // レンダリング済みページをクリア

      try {
        // Convert Tauri filesystem path to asset URL
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

  // スクロール位置を同期
  useEffect(() => {
    if (!scrollContainerRef.current) return

    // プログラムによるスクロールフラグを立てる
    isScrollingProgrammatically.current = true
    scrollContainerRef.current.scrollTop = scrollTop

    // 少し遅延させてフラグを戻す
    const timer = setTimeout(() => {
      isScrollingProgrammatically.current = false
    }, 50)

    return () => clearTimeout(timer)
  }, [scrollTop])

  // スクロールイベントハンドラ
  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    // プログラムによるスクロールの場合は同期しない
    if (isScrollingProgrammatically.current) return

    const target = e.currentTarget
    onScroll(target.scrollTop)
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
            console.log('Page already rendered, skipping:', pageNum)
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
            console.log('Page rendered:', pageNum)
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

    renderAllPages()

    // クリーンアップ: すべてのレンダリングタスクをキャンセル
    return () => {
      isCancelled = true
      renderTasks.forEach((task) => {
        task.cancel()
      })
    }
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
