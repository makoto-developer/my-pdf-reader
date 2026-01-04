import { useState } from 'react'
import type { PDFSet } from './domain/PDFSet'
import { SetList } from './components/SetList/SetList'
import { PDFViewer } from './components/PDFViewer/PDFViewer'

function App(): React.ReactElement {
  const [currentSet, setCurrentSet] = useState<PDFSet | null>(null)

  const handleOpenSet = (set: PDFSet): void => {
    setCurrentSet(set)
    console.log('Opening set:', set)
  }

  const handleBack = (): void => {
    setCurrentSet(null)
  }

  // PDFセットが選択されている場合はPDFViewer、そうでなければSetListを表示
  if (currentSet) {
    return <PDFViewer pdfSet={currentSet} onBack={handleBack} />
  }

  return <SetList onOpenSet={handleOpenSet} />
}

export default App
