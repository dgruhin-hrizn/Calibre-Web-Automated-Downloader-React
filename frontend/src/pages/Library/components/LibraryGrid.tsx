import React from 'react'
import { UnifiedBookCard } from '../../../components/UnifiedBookCard'
import { Button } from '../../../components/ui/Button'
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
  // Pagination
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
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
  currentPage,
  totalPages,
  onPageChange
}: LibraryGridProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading library...</span>
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
    <div className="space-y-6">
      {/* Books Grid */}
      <div className={
        viewMode === 'grid' 
          ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4"
          : "space-y-4"
      }>
        {books.map((book) => (
          <div key={book.id} onClick={() => onBookClick(book)} className="cursor-pointer">
            <UnifiedBookCard
              book={{
                id: book.id,
                title: book.title,
                authors: book.authors,
                series: book.series,
                series_index: book.series_index,
                rating: book.rating,
                pubdate: book.pubdate,
                timestamp: book.timestamp,
                tags: book.tags,
                languages: book.languages,
                formats: book.formats,
                path: book.path,
                has_cover: book.has_cover,
                comments: book.comments,
                source: 'cwa',
                coverUrl: book.has_cover ? `/api/metadata/books/${book.id}/cover` : undefined,
                shouldLoadImage: shouldLoadImage(book.id),
                onImageLoad: () => markImageLoaded(book.id)
              }}
              onDownload={() => onDownload(book)}
              onSendToKindle={() => onSendToKindle(book)}
              showDownloadButton={true}
              showKindleButton={true}
            />
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            Previous
          </Button>
          
          <div className="flex items-center space-x-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(pageNum)}
                >
                  {pageNum}
                </Button>
              )
            })}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
