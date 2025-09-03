import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/card'
import { DuplicateManagerModal } from '../../components/DuplicateManagerModal'
import MetadataEditModal from '../../components/MetadataEditModal'
import { useToast } from '../../hooks/useToast'

import {
  LibraryStats
} from './components'
import { LibraryToolbar } from './components/LibraryToolbar'
import { InfiniteLibraryGrid } from './components/InfiniteLibraryGrid'
import { LibraryBookModal } from './components/LibraryBookModal'

import {
  useInfiniteLibraryState,
  useAdminStatus,
  useImageLoading,
  useBookActions,
  useLibraryCache
} from './hooks'

import type { LibraryBook } from './types'

export function Library() {
  const { showToast, ToastContainer } = useToast()
  const { isAdmin } = useAdminStatus()
  
  // Metadata edit modal state
  const [editingBookId, setEditingBookId] = useState<number | null>(null)
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false)
  const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false)
  
  // Infinite scroll state management
  const {
    books,
    stats,
    totalPages,
    totalBooks,
    hasNextPage,
    currentPage,
    searchQuery,
    sortParam,
    viewMode,
    selectedBook,
    showDuplicateModal,
    setShowDuplicateModal,
    deletingBooks,
    isLoading,
    isLoadingMore,
    isError,
    error,
    handleSearchChange,
    handleSortChange,
    handlePageChange,
    handleViewModeChange,
    handleBookClick,
    handleBookDeleted,
    closeBookModal,
    updateSelectedBook,
    handleLoadMore,
    loadMoreRef,
    registerBookRef,
    scrollToTop
  } = useInfiniteLibraryState()
  
  const { refetchBook, updateBookInCache, invalidateLibraryBooks } = useLibraryCache()
  
  const { downloadBook, sendToKindle } = useBookActions()
  const { shouldLoadImage, markImageLoaded } = useImageLoading(books)

  // Additional handlers for book actions
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

  const handleEditMetadata = (bookId: number) => {
    setEditingBookId(bookId)
    setIsMetadataModalOpen(true)
  }

  const handleMetadataModalClose = () => {
    setIsMetadataModalOpen(false)
    setEditingBookId(null)
    setIsRefreshingMetadata(false)
  }

  const handleMetadataSave = async () => {
    if (!editingBookId) return
    
    // Start the refreshing state (this will show "Updating Display..." in the save button)
    setIsRefreshingMetadata(true)
    
    try {
      // Give the metadata database a moment to update after CWA processes the change
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Refetch the updated book data
      const updatedBook = await refetchBook(editingBookId)
      
      if (updatedBook) {
        // Update the selectedBook if it's the one we just edited
        if (selectedBook && selectedBook.id === editingBookId) {
          updateSelectedBook(updatedBook)
        }
        
        // Update all caches with the new book data
        updateBookInCache(editingBookId, updatedBook)
        
        showToast({ type: 'success', title: 'Metadata updated successfully' })
      } else {
        // Try a fallback approach - invalidate caches to force refresh on next access
        invalidateLibraryBooks()
        
        showToast({ type: 'warning', title: 'Metadata updated, display will refresh when you navigate back' })
      }
    } catch (error) {
      console.error('[Library] Error refetching book after metadata update:', error)
      
      // Fallback: invalidate caches so data refreshes on next navigation
      console.log('[Library] Using fallback: invalidating caches')
      invalidateLibraryBooks()
      showToast({ type: 'warning', title: 'Metadata updated, display will refresh when you navigate back' })
    } finally {
      // Close the modal and reset the refreshing state
      handleMetadataModalClose()
    }
  }

  // Error state
  if (isError) {
    return (
      <>
        {/* Fixed Toolbar - Outside any containers */}
        <LibraryToolbar
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          sortParam={sortParam}
          onSortChange={handleSortChange}
          totalBooks={totalBooks}
          loading={isLoading}
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
                  onClick={() => window.location.reload()} 
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
        onViewModeChange={handleViewModeChange}
        sortParam={sortParam}
        onSortChange={handleSortChange}
        totalBooks={totalBooks}
        loading={isLoading}
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

        {/* Infinite Scroll Books Grid */}
        <InfiniteLibraryGrid
          books={books}
          viewMode={viewMode}
          loading={isLoading}
          isLoadingMore={isLoadingMore}
          hasNextPage={hasNextPage}
          onBookClick={handleBookClick}
          onDownload={handleDownload}
          onSendToKindle={handleSendToKindle}
          shouldLoadImage={shouldLoadImage}
          markImageLoaded={markImageLoaded}
          onLoadMore={handleLoadMore}
          deletingBooks={deletingBooks}
          loadMoreRef={loadMoreRef}
          registerBookRef={registerBookRef}
        />
        
        {/* Scroll to Top Button */}
        {books.length > 18 && (
          <div className="fixed bottom-6 right-6 z-50">
            <Button
              onClick={scrollToTop}
              variant="outline"
              size="sm"
              className="rounded-full h-12 w-12 p-0 shadow-lg bg-background/80 backdrop-blur-sm border-2"
              title="Scroll to top"
            >
              ↑
            </Button>
          </div>
        )}
      </div>

      {/* Library Book Details Modal */}
      {selectedBook && (
        <LibraryBookModal
          book={selectedBook}
          onClose={closeBookModal}
          onSendToKindle={handleSendToKindle}
          onBookDeleted={() => {
            handleBookDeleted(selectedBook.id)
            closeBookModal() // Close modal to show delete animation
          }}
          onEditMetadata={handleEditMetadata}
        />
      )}
      
      {/* Duplicate Manager Modal */}
      <DuplicateManagerModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        onBooksDeleted={() => {
          // React Query will automatically refetch when cache is invalidated
          setShowDuplicateModal(false)
        }}
      />
      
      {/* Metadata Edit Modal */}
      {editingBookId && (
        <MetadataEditModal
          bookId={editingBookId}
          isOpen={isMetadataModalOpen}
          onClose={handleMetadataModalClose}
          onSave={handleMetadataSave}
          isRefreshing={isRefreshingMetadata}
        />
      )}
      
      {/* Toast Notifications */}
      <ToastContainer />
    </>
  )
}

export default Library