import { LibraryGridView } from './LibraryGridView'
import { LibraryListView } from './LibraryListView'
import type { LibraryBook, ViewMode } from '../types'

interface LibraryGridProps {
  books: LibraryBook[]
  viewMode: ViewMode
  loading: boolean
  onBookClick: (book: LibraryBook) => void
  onDownload: (book: LibraryBook) => void
  onSendToKindle: (book: LibraryBook) => void
  shouldLoadImage: (bookId: number) => boolean
  markImageLoaded: (bookId: number) => void
  // Animation state
  deletingBooks?: Set<number>
}

export function LibraryGrid({
  books,
  viewMode,
  loading,
  onBookClick,
  onDownload,
  onSendToKindle,
  shouldLoadImage,
  markImageLoaded,
  deletingBooks = new Set()
}: LibraryGridProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-muted-foreground">Loading library...</span>
      </div>
    )
  }

  if (books.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No books found in your library.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Books Display */}
      {viewMode === 'grid' ? (
        <LibraryGridView
          books={books}
          onBookClick={onBookClick}
          onDownload={onDownload}
          onSendToKindle={onSendToKindle}
          shouldLoadImage={shouldLoadImage}
          markImageLoaded={markImageLoaded}
          deletingBooks={deletingBooks}
        />
      ) : (
        <LibraryListView
          books={books}
          onBookClick={onBookClick}
          onSendToKindle={onSendToKindle}
          deletingBooks={deletingBooks}
        />
      )}
    </div>
  )
}