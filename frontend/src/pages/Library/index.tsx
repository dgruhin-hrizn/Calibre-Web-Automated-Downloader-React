import React, { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/card'
import { DuplicateManagerModal } from '../../components/DuplicateManagerModal'
import { useToast } from '../../hooks/useToast'

import {
  LibraryStats,
  LibraryControls,
  LibraryGrid,
  LibraryHeader
} from './components'
import { EnhancedBookDetailsModal } from './components/EnhancedBookDetailsModal'

import {
  useLibraryData,
  useAdminStatus,
  useImageLoading,
  useBookActions
} from './hooks'

import type { LibraryBook, ViewMode, SortParam } from './types'

export function Library() {
  const { showToast, ToastContainer } = useToast()
  const { isAdmin } = useAdminStatus()
  const { books, stats, loading, error, currentPage, totalPages, loadBooks } = useLibraryData()
  const { downloadBook, sendToKindle } = useBookActions()
  const { shouldLoadImage, markImageLoaded } = useImageLoading(books)

  // Local state
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortParam, setSortParam] = useState<SortParam>('new')
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)

  // Handlers
  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    loadBooks(1, query, sortParam)
  }

  const handleSortChange = (sort: SortParam) => {
    setSortParam(sort)
    loadBooks(currentPage, searchQuery, sort)
  }

  const handlePageChange = (page: number) => {
    loadBooks(page, searchQuery, sortParam)
  }

  const handleBookClick = (book: LibraryBook) => {
    setSelectedBook(book)
  }

  const handleDownload = async (book: LibraryBook) => {
    try {
      await downloadBook(book)
      showToast('Download started successfully', 'success')
    } catch (error) {
      showToast('Download failed', 'error')
    }
  }

  const handleSendToKindle = async (book: LibraryBook) => {
    try {
      const result = await sendToKindle(book)
      if (result.success) {
        showToast(result.message || 'Book sent to Kindle successfully', 'success')
      } else {
        showToast(result.message || 'Failed to send to Kindle', 'error')
      }
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send to Kindle'
      showToast(errorMessage, 'error')
      return { success: false, message: errorMessage }
    }
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-8">
        <LibraryHeader 
          isAdmin={isAdmin} 
          onManageDuplicates={() => setShowDuplicateModal(true)} 
        />
        
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <p className="font-medium">Connection Error</p>
              <p className="text-sm mt-1">{error}</p>
              <Button 
                onClick={() => loadBooks()} 
                className="mt-4"
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <LibraryHeader 
        isAdmin={isAdmin} 
        onManageDuplicates={() => setShowDuplicateModal(true)} 
      />

      {/* Stats Cards */}
      {stats && <LibraryStats stats={stats} />}

      {/* Controls */}
      <LibraryControls
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortParam={sortParam}
        onSortChange={handleSortChange}
        totalBooks={stats?.total_books || 0}
        loading={loading}
      />

      {/* Books Grid */}
      <LibraryGrid
        books={books}
        viewMode={viewMode}
        loading={loading}
        onBookClick={handleBookClick}
        onDownload={handleDownload}
        onSendToKindle={handleSendToKindle}
        shouldLoadImage={shouldLoadImage}
        markImageLoaded={markImageLoaded}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />

      {/* Enhanced Book Details Modal */}
      {selectedBook && (
        <EnhancedBookDetailsModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onSendToKindle={handleSendToKindle}
          onBookDeleted={() => {
            // Refresh library data when a book is deleted
            loadBooks(currentPage, searchQuery, sortParam)
          }}
        />
      )}
      
      {/* Duplicate Manager Modal */}
      <DuplicateManagerModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        onBooksDeleted={() => {
          // Refresh library data when books are deleted from duplicate manager
          loadBooks(currentPage, searchQuery, sortParam)
        }}
      />
      
      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  )
}

export default Library
