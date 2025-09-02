import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/card'
import { DuplicateManagerModal } from '../../components/DuplicateManagerModal'
import { useToast } from '../../hooks/useToast'

import {
  LibraryStats,
  LibraryGrid
} from './components'
import { LibraryToolbar } from './components/LibraryToolbar'
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
  const { books, stats, loading, error, currentPage, totalPages, loadBooks, removeBookLocally } = useLibraryData()
  const { downloadBook, sendToKindle } = useBookActions()
  const { shouldLoadImage, markImageLoaded } = useImageLoading(books)

  // Local state
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortParam, setSortParam] = useState<SortParam>('new')
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [deletingBooks, setDeletingBooks] = useState<Set<number>>(new Set())

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
      showToast({ type: 'success', title: 'Download started successfully' })
    } catch (error) {
      showToast({ type: 'error', title: 'Download failed' })
    }
  }

  const handleSendToKindle = async (book: LibraryBook) => {
    try {
      const result = await sendToKindle(book)
      if (result.success) {
        showToast({ type: 'success', title: result.message || 'Book sent to Kindle successfully' })
      } else {
        showToast({ type: 'error', title: result.message || 'Failed to send to Kindle' })
      }
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send to Kindle'
      showToast({ type: 'error', title: errorMessage })
      return { success: false, message: errorMessage }
    }
  }

  const handleBookDeleted = (deletedBookId: number) => {
    // Add book to deleting set for animation
    setDeletingBooks(prev => new Set([...prev, deletedBookId]))
    
    // Remove book from local state immediately after flip completes so grid can reposition
    setTimeout(() => {
      removeBookLocally(deletedBookId)
    }, 500) // Remove from grid right after flip completes
    
    // Clean up deleting state after full animation
    setTimeout(() => {
      setDeletingBooks(prev => {
        const newSet = new Set(prev)
        newSet.delete(deletedBookId)
        return newSet
      })
    }, 1700) // Clean up after full animation completes (500ms delay + 700ms fade + buffer)
  }

  // Error state
  if (error) {
    return (
      <>
        {/* Fixed Toolbar - Outside any containers */}
        <LibraryToolbar
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sortParam={sortParam}
          onSortChange={handleSortChange}
          totalBooks={stats?.total_books || 0}
          loading={loading}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          isAdmin={isAdmin}
          onManageDuplicates={() => setShowDuplicateModal(true)}
        />
        
        {/* Content */}
        <div className="min-h-screen">
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
      </>
    )
  }

  return (
    <>
      {/* Fixed Toolbar - Outside any containers */}
      <LibraryToolbar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortParam={sortParam}
        onSortChange={handleSortChange}
        totalBooks={stats?.total_books || 0}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        isAdmin={isAdmin}
        onManageDuplicates={() => setShowDuplicateModal(true)}
      />

      {/* Content */}
      <div className="space-y-6">
        {/* Stats Cards */}
        {stats && <LibraryStats stats={stats} />}

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
          deletingBooks={deletingBooks}
        />
      </div>

      {/* Enhanced Book Details Modal */}
      {selectedBook && (
        <EnhancedBookDetailsModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onSendToKindle={handleSendToKindle}
          onBookDeleted={() => {
            handleBookDeleted(selectedBook.id)
            setSelectedBook(null) // Close modal to show delete animation
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
    </>
  )
}

export default Library
