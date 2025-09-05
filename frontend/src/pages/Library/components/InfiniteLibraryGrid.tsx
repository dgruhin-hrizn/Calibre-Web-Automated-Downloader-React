import { LibraryGridView } from './LibraryGridView'
import { LibraryListView } from './LibraryListView'
import { Button } from '../../../components/ui/Button'
import { Loader2 } from 'lucide-react'
import type { LibraryBook, ViewMode } from '../types'

interface InfiniteLibraryGridProps {
  books: LibraryBook[]
  viewMode: ViewMode
  loading: boolean
  isLoadingMore: boolean
  hasNextPage: boolean
  onBookClick: (book: LibraryBook) => void
  onDownload: (book: LibraryBook) => void
  onSendToKindle: (book: LibraryBook) => void
  shouldLoadImage: (bookId: number) => boolean
  markImageLoaded: (bookId: number) => void
  onLoadMore: () => void
  // Animation state
  deletingBooks?: Set<number>
  // Infinite scroll
  loadMoreRef: React.RefObject<HTMLDivElement | null>
  // Book tracking
  registerBookRef?: (bookId: number, element: HTMLElement | null) => void
  registerPageRef?: (page: number, element: HTMLElement | null) => void
}

export function InfiniteLibraryGrid({
  books,
  viewMode,
  loading,
  isLoadingMore,
  hasNextPage,
  onBookClick,
  onDownload,
  onSendToKindle,
  shouldLoadImage,
  markImageLoaded,
  onLoadMore,
  deletingBooks = new Set(),
  loadMoreRef,
  registerBookRef,
  registerPageRef
}: InfiniteLibraryGridProps) {
  if (loading && books.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-muted-foreground">Loading library...</span>
      </div>
    )
  }

  if (books.length === 0 && !loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No books found in your library.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Books Display */}
      <div className="block md:hidden">
        {/* Mobile: Always show grid view */}
        <LibraryGridView
          books={books}
          onBookClick={onBookClick}
          onDownload={onDownload}
          onSendToKindle={onSendToKindle}
          shouldLoadImage={shouldLoadImage}
          markImageLoaded={markImageLoaded}
          deletingBooks={deletingBooks}
          registerBookRef={registerBookRef}
          registerPageRef={registerPageRef}
        />
      </div>
      <div className="hidden md:block">
        {/* Desktop: Respect viewMode setting */}
        {viewMode === 'grid' ? (
          <LibraryGridView
            books={books}
            onBookClick={onBookClick}
            onDownload={onDownload}
            onSendToKindle={onSendToKindle}
            shouldLoadImage={shouldLoadImage}
            markImageLoaded={markImageLoaded}
            deletingBooks={deletingBooks}
            registerBookRef={registerBookRef}
            registerPageRef={registerPageRef}
          />
        ) : (
          <LibraryListView
            books={books}
            onBookClick={onBookClick}
            onSendToKindle={onSendToKindle}
            deletingBooks={deletingBooks}
            registerBookRef={registerBookRef}
          />
        )}
      </div>

      {/* Infinite Scroll Loading Area */}
      <div className="flex flex-col items-center space-y-4 py-8 mt-6">
        {/* Intersection Observer Target */}
        <div ref={loadMoreRef} className="h-4" />
        
        {/* Loading More Indicator */}
        {isLoadingMore && (
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading more books...</span>
          </div>
        )}
        
        {/* Manual Load More Button (fallback) */}
        {hasNextPage && !isLoadingMore && (
          <Button
            onClick={onLoadMore}
            variant="outline"
            className="min-w-32"
          >
            Load More Books
          </Button>
        )}
        
        {/* End of Results */}
        {!hasNextPage && books.length > 0 && (
          <div className="text-center text-muted-foreground py-4">
            <p className="text-sm">You've reached the end of your library</p>
            <p className="text-xs mt-1">{books.length} books loaded</p>
          </div>
        )}
      </div>
    </div>
  )
}
