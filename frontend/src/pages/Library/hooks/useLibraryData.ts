import { useState, useEffect, useCallback } from 'react'
import { apiRequest } from '../../../lib/utils'
import type { LibraryBook, LibraryStats, CWALibraryResponse, SortParam } from '../types'

export function useLibraryData() {
  const [books, setBooks] = useState<LibraryBook[]>([])
  const [stats, setStats] = useState<LibraryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const perPage = 18

  // Helper to handle both arrays and comma-separated strings
  const ensureArray = (value: any) => {
    if (!value) return []
    if (Array.isArray(value)) return value
    if (typeof value === 'string') {
      return value.split(',').map(s => s.trim()).filter(Boolean)
    }
    return []
  }

  // Test CWA connection
  const testCWAConnection = async () => {
    try {
      const response = await apiRequest('/api/cwa/health')
      return response.status === 'ok'
    } catch (error) {
      console.error('CWA health check failed:', error)
      try {
        const proxyResponse = await apiRequest('/api/cwa/health-proxy')
        return proxyResponse.status === 'ok'
      } catch (proxyError) {
        console.error('CWA proxy health check also failed:', proxyError)
        return false
      }
    }
  }

  // Load library statistics
  const loadStats = async () => {
    try {
      // Use the dedicated stats endpoint for accurate counts
      const statsResponse = await apiRequest('/api/metadata/stats')
      setStats(statsResponse)
    } catch (error) {
      console.error('Failed to load stats:', error)
      // Fallback to basic stats using books endpoint
      try {
        const basicResponse = await apiRequest('/api/metadata/books?offset=0&limit=1&sort=timestamp&order=')
        setStats({
          total_books: basicResponse.total || 0,
          total_authors: 0,
          total_series: 0,
          total_tags: 0
        })
      } catch (fallbackError) {
        console.error('Failed to load basic stats:', fallbackError)
      }
    }
  }

  // Load books
  const loadBooks = useCallback(async (page = 1, search = '', sort: SortParam = 'new') => {
    try {
      setError(null)
      const offset = (page - 1) * perPage
      
      const cacheBuster = Date.now()
      const url = `/api/metadata/books?offset=${offset}&limit=${perPage}&sort=${sort}&order=${search ? `&search=${encodeURIComponent(search)}` : ''}&_t=${cacheBuster}`
      console.log(`Calling API: ${url}`)
      const response: CWALibraryResponse = await apiRequest(url)

      const transformedBooks: LibraryBook[] = (response.books || []).map((book: any) => ({
        id: book?.id || 0,
        title: book?.title || 'Unknown Title',
        authors: ensureArray(book?.authors),
        series: book?.series || undefined,
        series_index: book?.series_index ? parseFloat(book.series_index) : undefined,
        rating: book?.rating || undefined,
        pubdate: book?.pubdate || undefined,
        timestamp: book?.timestamp || undefined,
        tags: ensureArray(book?.tags),
        languages: ensureArray(book?.languages),
        formats: ensureArray(book?.formats),
        path: book?.path || '',
        has_cover: book?.has_cover === true || book?.has_cover === 1,
        comments: book?.comments || undefined
      }))

      console.log(`Loading page ${page}, got ${transformedBooks.length} books`)
      console.log('First book title:', transformedBooks[0]?.title)
      setBooks(transformedBooks)
      setCurrentPage(page)
      setTotalPages(response.pages || 1)
      
    } catch (error) {
      console.error('Failed to load library books:', error)
      setError('Failed to load library books. Make sure your CWA instance is running.')
    }
  }, [perPage])

  // Initialize
  useEffect(() => {
    const initialize = async () => {
      setLoading(true)
      
      const isHealthy = await testCWAConnection()
      
      if (!isHealthy) {
        setError('CWA health check failed. Please ensure your CWA instance is running and accessible.')
        setLoading(false)
        return
      }

      await Promise.all([
        loadStats(),
        loadBooks()
      ])
      
      setLoading(false)
    }

    initialize()
  }, [loadBooks])

  return {
    books,
    stats,
    loading,
    error,
    currentPage,
    totalPages,
    loadBooks,
    setCurrentPage
  }
}
