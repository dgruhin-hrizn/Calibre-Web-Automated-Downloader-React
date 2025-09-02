import { useCallback } from 'react'
import type { LibraryBook } from '../types'

export function useBookActions() {
  // Since we have formats in the book object already, no need to fetch them separately
  const getBookFormats = useCallback((book: LibraryBook): string[] => {
    return book.formats || []
  }, [])

  // Download book from library
  const downloadBook = useCallback(async (book: LibraryBook, _format?: string) => {
    try {
      const availableFormats = getBookFormats(book)
      
      if (availableFormats.length === 0) {
        console.error('No formats available for download')
        return
      }
      
      const formatPriority = ['EPUB', 'PDF', 'MOBI', 'AZW3', 'TXT']
      const downloadFormat = formatPriority.find(format => 
        availableFormats.some(f => f.toUpperCase() === format)
      ) || availableFormats[0]
      
      const response = await fetch(`/api/cwa/library/books/${book.id}/download/${downloadFormat}`, {
        credentials: 'include'
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${book.title}.${downloadFormat.toLowerCase()}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        console.error('Failed to download from CWA library')
      }
    } catch (error) {
      console.error('Error downloading from CWA library:', error)
    }
  }, [getBookFormats])

  // Send book to Kindle
  const sendToKindle = useCallback(async (book: LibraryBook, _format?: string): Promise<{ success: boolean; message: string }> => {
    try {
      const availableFormats = getBookFormats(book)
      
      if (availableFormats.length === 0) {
        return { success: false, message: 'No formats available for Kindle' }
      }
      
      const kindleFormatPriority = ['MOBI', 'AZW3', 'EPUB', 'PDF']
      const kindleFormat = kindleFormatPriority.find(format => 
        availableFormats.some(f => f.toUpperCase() === format)
      ) || availableFormats[0]
      
      const response = await fetch(`/api/cwa/library/books/${book.id}/send-to-kindle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          format: kindleFormat
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          return { success: true, message: result.message || 'Book sent to Kindle successfully' }
        } else {
          return { success: false, message: result.error || 'Failed to send book to Kindle' }
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        return { success: false, message: errorData.error || `Failed to send book (${response.status})` }
      }
    } catch (error) {
      console.error('Error sending book to Kindle:', error)
      return { success: false, message: error instanceof Error ? error.message : 'Network error occurred' }
    }
  }, [getBookFormats])

  return {
    downloadBook,
    sendToKindle
  }
}
