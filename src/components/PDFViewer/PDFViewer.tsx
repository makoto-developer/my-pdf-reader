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
  const [centerAlign, setCenterAlign] = useState(false)
  const [scrollRatio, setScrollRatio] = useState(0)
  const [scale, setScale] = useState<number | undefined>(undefined)
  const [autoResize, setAutoResize] = useState(false)
  
  // 余白設定
  const [isMarginEditMode, setIsMarginEditMode] = useState(false)
  const [leftOuterMargin, setLeftOuterMargin] = useState(0) // 左ペイン外側
  const [leftInnerMargin, setLeftInnerMargin] = useState(0) // 左ペイン内側
  const [rightInnerMargin, setRightInnerMargin] = useState(0) // 右ペイン内側
  const [rightOuterMargin, setRightOuterMargin] = useState(0) // 右ペイン外側
  const [tempLeftOuterMargin, setTempLeftOuterMargin] = useState(0)
  const [tempLeftInnerMargin, setTempLeftInnerMargin] = useState(0)
  const [tempRightInnerMargin, setTempRightInnerMargin] = useState(0)
  const [tempRightOuterMargin, setTempRightOuterMargin] = useState(0)
  
  const rafIdRef = useRef<number | null>(null)
  const scrollSourceRef = useRef<string>('')
  const mainContainerRef = useRef<HTMLDivElement>(null)

  // 赤線のドラッグ用
  const isDraggingLeftOuterRef = useRef(false)
  const isDraggingLeftInnerRef = useRef(false)
  const isDraggingRightInnerRef = useRef(false)
  const isDraggingRightOuterRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartLeftOuterRef = useRef(0)
  const dragStartLeftInnerRef = useRef(0)
  const dragStartRightInnerRef = useRef(0)
  const dragStartRightOuterRef = useRef(0)

  // mainContainerの位置情報
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)

  // mainContainerの位置を更新
  useEffect(() => {
    const updateContainerRect = (): void => {
      if (mainContainerRef.current) {
        setContainerRect(mainContainerRef.current.getBoundingClientRect())
      }
    }

    // 初回実行
    updateContainerRect()

    // ウィンドウリサイズ時に更新
    window.addEventListener('resize', updateContainerRect)

    return () => {
      window.removeEventListener('resize', updateContainerRect)
    }
  }, [])

  // 余白編集モード開始時にもcontainerRectを更新
  useEffect(() => {
    if (isMarginEditMode && mainContainerRef.current) {
      setContainerRect(mainContainerRef.current.getBoundingClientRect())
    }
  }, [isMarginEditMode])

  // 余白設定をlocalStorageから読み込み
  useEffect(() => {
    const keys = {
      leftOuter: `pdf-margin-left-outer-${pdfSet.id}`,
      leftInner: `pdf-margin-left-inner-${pdfSet.id}`,
      rightInner: `pdf-margin-right-inner-${pdfSet.id}`,
      rightOuter: `pdf-margin-right-outer-${pdfSet.id}`,
    }
    
    const savedLeftOuter = localStorage.getItem(keys.leftOuter)
    const savedLeftInner = localStorage.getItem(keys.leftInner)
    const savedRightInner = localStorage.getItem(keys.rightInner)
    const savedRightOuter = localStorage.getItem(keys.rightOuter)
    
    if (savedLeftOuter) setLeftOuterMargin(parseInt(savedLeftOuter, 10))
    if (savedLeftInner) setLeftInnerMargin(parseInt(savedLeftInner, 10))
    if (savedRightInner) setRightInnerMargin(parseInt(savedRightInner, 10))
    if (savedRightOuter) setRightOuterMargin(parseInt(savedRightOuter, 10))
    
    logger.info('PDFViewer', '余白設定を読み込み', {
      leftOuter: savedLeftOuter || 0,
      leftInner: savedLeftInner || 0,
      rightInner: savedRightInner || 0,
      rightOuter: savedRightOuter || 0,
    })
  }, [pdfSet.id])

  // 余白設定をlocalStorageに保存
  const saveMarginValues = (leftOuter: number, leftInner: number, rightInner: number, rightOuter: number): void => {
    const keys = {
      leftOuter: `pdf-margin-left-outer-${pdfSet.id}`,
      leftInner: `pdf-margin-left-inner-${pdfSet.id}`,
      rightInner: `pdf-margin-right-inner-${pdfSet.id}`,
      rightOuter: `pdf-margin-right-outer-${pdfSet.id}`,
    }
    localStorage.setItem(keys.leftOuter, leftOuter.toString())
    localStorage.setItem(keys.leftInner, leftInner.toString())
    localStorage.setItem(keys.rightInner, rightInner.toString())
    localStorage.setItem(keys.rightOuter, rightOuter.toString())
    logger.info('PDFViewer', '余白設定を保存', { leftOuter, leftInner, rightInner, rightOuter })
  }

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

  // centerAlignの変更を監視（デバッグ用）
  useEffect(() => {
    logger.info('PDFViewer', '🎯 centerAlign変更', {
      centerAlign,
      スタックトレース: new Error().stack,
    })
  }, [centerAlign])

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

      // パディング計算
      // 中央寄せON: 外側16pxのみ（中央側は0）
      // 中央寄せOFF: 左右それぞれ16px = 32px
      let totalPadding: number
      if (centerAlign) {
        // 中央寄せ時は、外側のpaddingのみ（16px）
        totalPadding = 16
      } else {
        totalPadding = 32
      }
      const availableWidth = panelWidth - totalPadding - 10 // 境界線とマージンを考慮

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
  }, [autoResize, centerAlign, leftInnerMargin, rightInnerMargin])

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

  // 余白編集モードを開始
  const handleStartMarginEdit = (): void => {
    setTempLeftOuterMargin(leftOuterMargin)
    setTempLeftInnerMargin(leftInnerMargin)
    setTempRightInnerMargin(rightInnerMargin)
    setTempRightOuterMargin(rightOuterMargin)
    setIsMarginEditMode(true)
    logger.info('PDFViewer', '余白編集モード開始', { leftOuterMargin, leftInnerMargin, rightInnerMargin, rightOuterMargin })
  }

  // 余白設定を確定
  const handleConfirmMargin = (): void => {
    setLeftOuterMargin(tempLeftOuterMargin)
    setLeftInnerMargin(tempLeftInnerMargin)
    setRightInnerMargin(tempRightInnerMargin)
    setRightOuterMargin(tempRightOuterMargin)
    saveMarginValues(tempLeftOuterMargin, tempLeftInnerMargin, tempRightInnerMargin, tempRightOuterMargin)
    setIsMarginEditMode(false)
    logger.info('PDFViewer', '余白設定を確定', { 
      leftOuter: tempLeftOuterMargin, 
      leftInner: tempLeftInnerMargin, 
      rightInner: tempRightInnerMargin, 
      rightOuter: tempRightOuterMargin 
    })
  }

  // 余白編集をキャンセル
  const handleCancelMarginEdit = (): void => {
    setTempLeftOuterMargin(leftOuterMargin)
    setTempLeftInnerMargin(leftInnerMargin)
    setTempRightInnerMargin(rightInnerMargin)
    setTempRightOuterMargin(rightOuterMargin)
    setIsMarginEditMode(false)
    logger.info('PDFViewer', '余白編集をキャンセル')
  }

  // 余白をリセット
  const handleResetMargin = (): void => {
    setTempLeftOuterMargin(0)
    setTempLeftInnerMargin(0)
    setTempRightInnerMargin(0)
    setTempRightOuterMargin(0)
    logger.info('PDFViewer', '余白をリセット')
  }

  // 左ペインの左外側の赤線のドラッグ開始
  const handleLeftOuterMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault()
    isDraggingLeftOuterRef.current = true
    dragStartXRef.current = e.clientX
    dragStartLeftOuterRef.current = tempLeftOuterMargin
  }

  // 左ペインの右内側の赤線のドラッグ開始
  const handleLeftInnerMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault()
    isDraggingLeftInnerRef.current = true
    dragStartXRef.current = e.clientX
    dragStartLeftInnerRef.current = tempLeftInnerMargin
  }

  // 右ペインの左内側の赤線のドラッグ開始
  const handleRightInnerMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault()
    isDraggingRightInnerRef.current = true
    dragStartXRef.current = e.clientX
    dragStartRightInnerRef.current = tempRightInnerMargin
  }

  // 右ペインの右外側の赤線のドラッグ開始
  const handleRightOuterMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault()
    isDraggingRightOuterRef.current = true
    dragStartXRef.current = e.clientX
    dragStartRightOuterRef.current = tempRightOuterMargin
  }

  // ドラッグ中
  const handleMarginMouseMove = useCallback((e: MouseEvent): void => {
    const deltaX = e.clientX - dragStartXRef.current

    if (isDraggingLeftOuterRef.current) {
      const newMargin = Math.max(0, dragStartLeftOuterRef.current - deltaX)
      setTempLeftOuterMargin(newMargin)
    } else if (isDraggingLeftInnerRef.current) {
      const newMargin = Math.max(0, dragStartLeftInnerRef.current - deltaX)
      setTempLeftInnerMargin(newMargin)
    } else if (isDraggingRightInnerRef.current) {
      const newMargin = Math.max(0, dragStartRightInnerRef.current + deltaX)
      setTempRightInnerMargin(newMargin)
    } else if (isDraggingRightOuterRef.current) {
      const newMargin = Math.max(0, dragStartRightOuterRef.current - deltaX)
      setTempRightOuterMargin(newMargin)
    }
  }, [])

  // ドラッグ終了
  const handleMarginMouseUp = useCallback((): void => {
    if (isDraggingLeftOuterRef.current || isDraggingLeftInnerRef.current || 
        isDraggingRightInnerRef.current || isDraggingRightOuterRef.current) {
      isDraggingLeftOuterRef.current = false
      isDraggingLeftInnerRef.current = false
      isDraggingRightInnerRef.current = false
      isDraggingRightOuterRef.current = false
    }
  }, [])

  // ドラッグイベントを登録
  useEffect(() => {
    if (!isMarginEditMode) return

    document.addEventListener('mousemove', handleMarginMouseMove)
    document.addEventListener('mouseup', handleMarginMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMarginMouseMove)
      document.removeEventListener('mouseup', handleMarginMouseUp)
    }
  }, [isMarginEditMode, handleMarginMouseMove, handleMarginMouseUp])

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
            {!isMarginEditMode ? (
              <>
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
                  onClick={() => {
                    const newCenterAlign = !centerAlign
                    setCenterAlign(newCenterAlign)
                    
                    // 中央寄せON時、自動的にscaleを調整
                    if (newCenterAlign && !autoResize) {
                      const mainContainer = mainContainerRef.current
                      if (mainContainer) {
                        const PDF_BASE_WIDTH = 531
                        const panelWidth = mainContainer.clientWidth / 2
                        const totalPadding = 16
                        const availableWidth = panelWidth - totalPadding - 10
                        const newScale = availableWidth / PDF_BASE_WIDTH
                        const finalScale = Math.max(0.3, Math.min(2.5, newScale))
                        setScale(finalScale)
                        logger.info('PDFViewer', '🎯 中央寄せ時のscale自動調整', {
                          panelWidth,
                          availableWidth,
                          finalScale: finalScale.toFixed(3),
                        })
                      }
                    }
                  }}
                  variant={centerAlign ? 'primary' : 'secondary'}
                  size="sm"
                >
                  {centerAlign ? '中央寄せ: ON' : '中央寄せ: OFF'}
                </Button>
                <Button
                  onClick={handleStartMarginEdit}
                  variant="secondary"
                  size="sm"
                >
                  ✂️ 余白を非表示
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleResetMargin}
                  variant="secondary"
                  size="sm"
                >
                  🔄 リセット
                </Button>
                <Button
                  onClick={handleCancelMarginEdit}
                  variant="secondary"
                  size="sm"
                >
                  ❌ キャンセル
                </Button>
                <Button
                  onClick={handleConfirmMargin}
                  variant="primary"
                  size="sm"
                >
                  ✅ 確定
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* PDF表示エリア（左右分割） */}
      <main ref={mainContainerRef} className="flex-1 flex overflow-hidden relative">
        <div className="w-1/2">
          <PDFPanel
            pdfPath={pdfSet.originalPdfPath}
            title="原文"
            scrollRatio={scrollRatio}
            onScroll={handleScrollOriginal}
            align={centerAlign ? 'right' : 'center'}
            scale={scale}
            onScaleChange={setScale}
            marginLeft={leftOuterMargin}
            marginRight={leftInnerMargin}
          />
        </div>
        {/* 中央の境界線 */}
        <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-gray-400 pointer-events-none z-10" style={{ transform: 'translateX(-1px)' }} />
        <div className="w-1/2">
          <PDFPanel
            pdfPath={pdfSet.translatedPdfPath}
            title="翻訳"
            scrollRatio={scrollRatio}
            onScroll={handleScrollTranslated}
            align={centerAlign ? 'left' : 'center'}
            scale={scale}
            onScaleChange={setScale}
            marginLeft={rightInnerMargin}
            marginRight={rightOuterMargin}
          />
        </div>

        {/* 左ペイン外側の半透明オーバーレイ */}
        {isMarginEditMode && tempLeftOuterMargin > 0 && containerRect && (
          <div
            style={{
              position: 'fixed',
              top: `${containerRect.top}px`,
              left: `${containerRect.left}px`,
              width: `${tempLeftOuterMargin}px`,
              height: `${containerRect.height}px`,
              backgroundColor: 'rgba(128, 128, 128, 0.5)',
              pointerEvents: 'none',
              zIndex: 998,
            }}
          />
        )}

        {/* 左ペイン内側の半透明オーバーレイ */}
        {isMarginEditMode && tempLeftInnerMargin > 0 && containerRect && (
          <div
            style={{
              position: 'fixed',
              top: `${containerRect.top}px`,
              left: `${containerRect.left + containerRect.width / 2 - tempLeftInnerMargin}px`,
              width: `${tempLeftInnerMargin}px`,
              height: `${containerRect.height}px`,
              backgroundColor: 'rgba(128, 128, 128, 0.5)',
              pointerEvents: 'none',
              zIndex: 998,
            }}
          />
        )}

        {/* 右ペイン内側の半透明オーバーレイ */}
        {isMarginEditMode && tempRightInnerMargin > 0 && containerRect && (
          <div
            style={{
              position: 'fixed',
              top: `${containerRect.top}px`,
              left: `${containerRect.left + containerRect.width / 2}px`,
              width: `${tempRightInnerMargin}px`,
              height: `${containerRect.height}px`,
              backgroundColor: 'rgba(128, 128, 128, 0.5)',
              pointerEvents: 'none',
              zIndex: 998,
            }}
          />
        )}

        {/* 右ペイン外側の半透明オーバーレイ */}
        {isMarginEditMode && tempRightOuterMargin > 0 && containerRect && (
          <div
            style={{
              position: 'fixed',
              top: `${containerRect.top}px`,
              left: `${containerRect.right - tempRightOuterMargin}px`,
              width: `${tempRightOuterMargin}px`,
              height: `${containerRect.height}px`,
              backgroundColor: 'rgba(128, 128, 128, 0.5)',
              pointerEvents: 'none',
              zIndex: 998,
            }}
          />
        )}

        {/* 左ペイン外側の赤線とドラッグハンドル */}
        {isMarginEditMode && containerRect && (
          <div
            style={{
              position: 'fixed',
              top: `${containerRect.top}px`,
              left: `${containerRect.left + tempLeftOuterMargin}px`,
              width: '2px',
              height: `${containerRect.height}px`,
              backgroundColor: 'red',
              cursor: 'ew-resize',
              zIndex: 1000,
            }}
            onMouseDown={handleLeftOuterMouseDown}
          >
            <div
              style={{
                position: 'absolute',
                top: '50%',
                right: '-15px',
                transform: 'translateY(-50%)',
                width: '30px',
                height: '60px',
                backgroundColor: 'red',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '20px',
                userSelect: 'none',
              }}
            >
              ⇄
            </div>
          </div>
        )}

        {/* 左ペイン内側の赤線とドラッグハンドル */}
        {isMarginEditMode && containerRect && (
          <div
            style={{
              position: 'fixed',
              top: `${containerRect.top}px`,
              left: `${containerRect.left + containerRect.width / 2 - tempLeftInnerMargin}px`,
              width: '2px',
              height: `${containerRect.height}px`,
              backgroundColor: 'red',
              cursor: 'ew-resize',
              zIndex: 1001,
            }}
            onMouseDown={handleLeftInnerMouseDown}
          >
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '-15px',
                transform: 'translateY(-50%)',
                width: '30px',
                height: '60px',
                backgroundColor: 'red',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '20px',
                userSelect: 'none',
              }}
            >
              ⇄
            </div>
          </div>
        )}

        {/* 右ペイン内側の赤線とドラッグハンドル */}
        {isMarginEditMode && containerRect && (
          <div
            style={{
              position: 'fixed',
              top: `${containerRect.top}px`,
              left: `${containerRect.left + containerRect.width / 2 + tempRightInnerMargin}px`,
              width: '2px',
              height: `${containerRect.height}px`,
              backgroundColor: 'red',
              cursor: 'ew-resize',
              zIndex: 1001,
            }}
            onMouseDown={handleRightInnerMouseDown}
          >
            <div
              style={{
                position: 'absolute',
                top: '50%',
                right: '-15px',
                transform: 'translateY(-50%)',
                width: '30px',
                height: '60px',
                backgroundColor: 'red',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '20px',
                userSelect: 'none',
              }}
            >
              ⇄
            </div>
          </div>
        )}

        {/* 右ペイン外側の赤線とドラッグハンドル */}
        {isMarginEditMode && containerRect && (
          <div
            style={{
              position: 'fixed',
              top: `${containerRect.top}px`,
              left: `${containerRect.right - tempRightOuterMargin}px`,
              width: '2px',
              height: `${containerRect.height}px`,
              backgroundColor: 'red',
              cursor: 'ew-resize',
              zIndex: 1000,
            }}
            onMouseDown={handleRightOuterMouseDown}
          >
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '-15px',
                transform: 'translateY(-50%)',
                width: '30px',
                height: '60px',
                backgroundColor: 'red',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '20px',
                userSelect: 'none',
              }}
            >
              ⇄
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
