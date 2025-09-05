import { UnifiedBookCard } from '../../../components/UnifiedBookCard'
import { Trash2 } from 'lucide-react'
import type { LibraryBook } from '../types'
import { BOOKS_PER_PAGE } from '../constants/pagination'

interface LibraryGridViewProps {
  books: LibraryBook[]
  onBookClick: (book: LibraryBook) => void
  onDownload: (book: LibraryBook) => void
  onSendToKindle: (book: LibraryBook) => void
  shouldLoadImage: (bookId: number) => boolean
  markImageLoaded: (bookId: number) => void
  deletingBooks?: Set<number>
  registerBookRef?: (bookId: number, element: HTMLElement | null) => void
  registerPageRef?: (page: number, element: HTMLElement | null) => void
}

export function LibraryGridView({
  books,
  onBookClick,
  onDownload,
  onSendToKindle,
  shouldLoadImage,
  markImageLoaded,
  deletingBooks = new Set(),
  registerBookRef,
  registerPageRef
}: LibraryGridViewProps) {
  return (
    <div className="relative pt-10 sm:pt-0">
      <div className="grid gap-x-4 gap-y-0 sm:gap-y-4 transition-all duration-500 ease-out grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 max-w-[1200px] mx-auto">
        {books.map((book, index) => {
          const pageNumber = Math.floor(index / BOOKS_PER_PAGE) + 1
          const isFirstBookOfPage = index % BOOKS_PER_PAGE === 0
          const isDeleting = deletingBooks.has(book.id)

          return (
            <div key={book.id} className="relative -mt-12 sm:mt-0">
              {/* Simple page marker - only on first book of each page */}
              {isFirstBookOfPage && registerPageRef && (
                <div
                  ref={(el) => registerPageRef(pageNumber, el)}
                  data-page-number={pageNumber}
                  className="absolute -top-20 left-0 h-1 w-full"
                  style={{
                    backgroundColor: 'transparent', // Invisible but functional
                    opacity: 1,
                    zIndex: 10
                  }}
                />
              )}

              {/* Book card */}
              <div 
                data-book-id={book.id}
                ref={(el) => registerBookRef?.(book.id, el)}
                className={`w-full h-[475px] transition-all ease-out ${
                  isDeleting
                    ? 'opacity-0 scale-75 translate-y-4 duration-500'
                    : 'opacity-100 scale-100 translate-y-0 hover:scale-[1.02] hover:shadow-lg duration-700'
                }`}
                style={{
                  transform: 'translateZ(0)',
                  willChange: 'transform, opacity, box-shadow',
                  backfaceVisibility: 'hidden',
                  perspective: '1000px',
                  transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  scrollMarginTop: '255px'
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
                      book={book}
                      onDetails={() => onBookClick(book)}
                      onDownload={() => onDownload(book)}
                      onSendToKindle={() => onSendToKindle(book)}
                      shouldLoadImage={() => shouldLoadImage(book.id)}
                      onImageLoaded={() => markImageLoaded(book.id)}
                      showDownloadButton={true}
                      showKindleButton={true}
                      showReadStatus={true}
                    />
                  </div>
                  
                  {/* Back side - Delete state */}
                  <div 
                    className="absolute inset-0 w-full h-full bg-red-50 border-2 border-red-200 rounded-lg flex items-center justify-center [transform:rotateY(180deg)]"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <div className="flex flex-col items-center justify-center text-center space-y-2">
                      <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                        <Trash2 className="w-5 h-5 text-white" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-red-800">Deleting Book</p>
                        <p className="text-xs text-red-600 line-clamp-2 leading-tight">{book.title}</p>
                      </div>
                      <div className="flex space-x-1 mt-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-red-300 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}