import { UnifiedBookCard } from '../../../components/UnifiedBookCard'
import { Trash2 } from 'lucide-react'
import type { LibraryBook } from '../types'

interface LibraryGridViewProps {
  books: LibraryBook[]
  onBookClick: (book: LibraryBook) => void
  onDownload: (book: LibraryBook) => void
  onSendToKindle: (book: LibraryBook) => void
  shouldLoadImage: (bookId: number) => boolean
  markImageLoaded: (bookId: number) => void
  deletingBooks?: Set<number>
  registerBookRef?: (bookId: number, element: HTMLElement | null) => void
}

export function LibraryGridView({
  books,
  onBookClick,
  onDownload,
  onSendToKindle,
  shouldLoadImage,
  markImageLoaded,
  deletingBooks = new Set(),
  registerBookRef
}: LibraryGridViewProps) {
  return (
    <div className="flex flex-wrap gap-4 justify-start transition-all duration-500 ease-out">
      {books.map((book) => {
        const isDeleting = deletingBooks.has(book.id)
        return (
          <div 
            key={book.id}
            data-book-id={book.id}
            ref={(el) => registerBookRef?.(book.id, el)}
            className={`w-[calc(50%-8px)] sm:w-[225px] sm:min-w-[225px] sm:max-w-[225px] transition-all ease-out ${
              isDeleting
                ? 'opacity-0 scale-75 translate-y-4 duration-500'
                : 'opacity-100 scale-100 translate-y-0 hover:scale-[1.02] hover:shadow-lg duration-700'
            }`}
            style={{
              transform: 'translateZ(0)', // Hardware acceleration
              willChange: 'transform, opacity, box-shadow',
              backfaceVisibility: 'hidden', // Prevent flickering
              perspective: '1000px', // Enable 3D transforms
              transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)', // Smooth repositioning
              scrollMarginTop: '155px' // Account for toolbar height when scrolling
            }}
          >
            <div 
              className={`relative w-full h-full transition-transform duration-500 ease-out ${
                isDeleting ? '[transform:rotateY(180deg)]' : ''
              }`}
              style={{ 
                transformStyle: 'preserve-3d',
                backfaceVisibility: 'hidden'
              }}
            >
              {/* Front side - Normal book card */}
              <div 
                className="w-full h-full"
                style={{ backfaceVisibility: 'hidden' }}
              >
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
                    comments: book.comments
                  }}
                  onDetails={() => onBookClick(book)}
                  onDownload={() => onDownload(book)}
                  onSendToKindle={() => onSendToKindle(book)}
                  shouldLoadImage={() => shouldLoadImage(book.id)}
                  onImageLoaded={() => markImageLoaded(book.id)}
                  showDownloadButton={true}
                  showKindleButton={true}
                />
              </div>
              
              {/* Back side - Delete state */}
              <div 
                className="absolute inset-0 w-full h-full bg-red-100 border border-red-200 rounded-lg flex flex-col items-center justify-center p-3"
                style={{ 
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)'
                }}
              >
                <div className="flex flex-col items-center justify-center text-center space-y-2">
                  <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                    <Trash2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-red-800">Deleting Book</p>
                    <p className="text-xs text-red-600 line-clamp-2 leading-tight">{book.title}</p>
                  </div>
                  {/* Simple pulsing dots as progress indicator */}
                  <div className="flex space-x-1 mt-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-red-300 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
