import { useState } from 'react'
import type { PDFSet } from './domain/PDFSet'
import { SetList } from './components/SetList/SetList'
import { PDFViewer } from './components/PDFViewer/PDFViewer'
import { Settings } from './components/Settings/Settings'

type Screen = 'list' | 'viewer' | 'settings'

function App(): React.ReactElement {
  const [currentScreen, setCurrentScreen] = useState<Screen>('list')
  const [currentSet, setCurrentSet] = useState<PDFSet | null>(null)

  const handleOpenSet = (set: PDFSet): void => {
    setCurrentSet(set)
    setCurrentScreen('viewer')
    console.log('Opening set:', set)
  }

  const handleBack = (): void => {
    setCurrentSet(null)
    setCurrentScreen('list')
  }

  const handleOpenSettings = (): void => {
    setCurrentScreen('settings')
  }

  const handleBackToList = (): void => {
    setCurrentScreen('list')
  }

  // 画面遷移
  if (currentScreen === 'viewer' && currentSet) {
    return <PDFViewer pdfSet={currentSet} onBack={handleBack} />
  }

  if (currentScreen === 'settings') {
    return <Settings onBack={handleBackToList} />
  }

  return <SetList onOpenSet={handleOpenSet} onOpenSettings={handleOpenSettings} />
}

export default App
