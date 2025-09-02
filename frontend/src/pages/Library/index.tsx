import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/card'
import { DuplicateManagerModal } from '../../components/DuplicateManagerModal'
import { useToast } from '../../hooks/useToast'

import {
  LibraryStats
} from './components'
import { LibraryToolbar } from './components/LibraryToolbar'
import { InfiniteLibraryGrid } from './components/InfiniteLibraryGrid'
import { EnhancedBookDetailsModal } from './components/EnhancedBookDetailsModal'

import {
  useInfiniteLibraryState,
  useAdminStatus,
  useImageLoading,
  useBookActions
} from './hooks'

import type { LibraryBook } from './types'

export function Library() {
  const { showToast, ToastContainer } = useToast()
  const { isAdmin } = useAdminStatus()
  
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
    handleLoadMore,
    loadMoreRef,
    registerBookRef,
    scrollToTop
  } = useInfiniteLibraryState()
  
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

      {/* Enhanced Book Details Modal */}
      {selectedBook && (
        <EnhancedBookDetailsModal
          book={selectedBook}
          onClose={closeBookModal}
          onSendToKindle={handleSendToKindle}
          onBookDeleted={() => {
            handleBookDeleted(selectedBook.id)
            closeBookModal() // Close modal to show delete animation
          }}
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
      
      {/* Toast Notifications */}
      <ToastContainer />
    </>
  )
}

export default Library