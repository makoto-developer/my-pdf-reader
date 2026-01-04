import { useState, useEffect, useCallback } from 'react'
import type { PDFSet, CreatePDFSetParams } from '@/domain/PDFSet'
import { pdfSetApi } from '../api/pdfSetApi'

interface UsePDFSetsReturn {
  sets: PDFSet[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  createSet: (params: CreatePDFSetParams) => Promise<PDFSet>
  deleteSet: (id: string) => Promise<void>
}

export function usePDFSets(): UsePDFSetsReturn {
  const [sets, setSets] = useState<PDFSet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const fetchedSets = await pdfSetApi.list()
      setSets(fetchedSets)
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラーが発生しました'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createSet = useCallback(
    async (params: CreatePDFSetParams): Promise<PDFSet> => {
      try {
        const newSet = await pdfSetApi.create(params)
        setSets((prev) => [...prev, newSet])
        return newSet
      } catch (err) {
        const message = err instanceof Error ? err.message : '不明なエラーが発生しました'
        throw new Error(message)
      }
    },
    []
  )

  const deleteSet = useCallback(async (id: string): Promise<void> => {
    try {
      await pdfSetApi.delete(id)
      setSets((prev) => prev.filter((set) => set.id !== id))
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラーが発生しました'
      throw new Error(message)
    }
  }, [])

  // 初回マウント時にセット一覧を取得
  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    sets,
    isLoading,
    error,
    refresh,
    createSet,
    deleteSet,
  }
}
