import { Book, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../ui/Button'
import { useState, useRef, useEffect } from 'react'

interface AuthorBook {
  volumeInfo?: {
    title?: string
    imageLinks?: {
      thumbnail?: string
    }
  }
}

interface MoreByAuthorProps {
  authorName?: string
  books: AuthorBook[]
  isLoading: boolean
  onSearchByTitle: (title: string) => void
}

export function MoreByAuthor({ authorName, books, isLoading, onSearchByTitle }: MoreByAuthorProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  const itemsPerView = 6 // Show 6 books at a time
  const totalPages = Math.ceil(books.length / itemsPerView)

  useEffect(() => {
    updateScrollButtons()
  }, [currentIndex, books.length])

  // Reset to first page when books change
  useEffect(() => {
    console.log('MoreByAuthor: Books changed, length:', books.length, 'totalPages:', Math.ceil(books.length / itemsPerView))
    setCurrentIndex(0)
  }, [books.length])

  const updateScrollButtons = () => {
    setCanScrollLeft(currentIndex > 0)
    setCanScrollRight(currentIndex < totalPages - 1)
  }

  const scrollLeft = () => {
    if (canScrollLeft) {
      setCurrentIndex(prev => prev - 1)
    }
  }

  const scrollRight = () => {
    if (canScrollRight) {
      setCurrentIndex(prev => prev + 1)
    }
  }

  const visibleBooks = books.slice(
    currentIndex * itemsPerView,
    (currentIndex + 1) * itemsPerView
  )

  if (!authorName || (books.length === 0 && !isLoading)) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-foreground">
          More by {authorName}
        </h3>
        
        {books.length > itemsPerView && (
          <div className="flex items-center gap-2">
            <button
              onClick={scrollLeft}
              disabled={!canScrollLeft}
              className={`w-8 h-8 rounded-full border border-border flex items-center justify-center transition-colors ${
                canScrollLeft
                  ? 'hover:bg-accent hover:text-accent-foreground cursor-pointer'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} of {totalPages}
            </span>
            
            <button
              onClick={scrollRight}
              disabled={!canScrollRight}
              className={`w-8 h-8 rounded-full border border-border flex items-center justify-center transition-colors ${
                canScrollRight
                  ? 'hover:bg-accent hover:text-accent-foreground cursor-pointer'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading more books...</div>
        </div>
      ) : (
        <div className="relative">
          <div 
            ref={scrollContainerRef}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 transition-all duration-300"
          >
            {visibleBooks.map((authorBook, index) => (
              <div key={currentIndex * itemsPerView + index} className="space-y-3">
                <div className="aspect-[2/3] bg-muted rounded-lg overflow-hidden shadow-sm">
                  {authorBook.volumeInfo?.imageLinks?.thumbnail ? (
                    <img
                      src={authorBook.volumeInfo.imageLinks.thumbnail.replace('http:', 'https:')}
                      alt={authorBook.volumeInfo?.title || 'Book cover'}
                      className="w-full h-full object-contain bg-white"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <Book className="w-10 h-10 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground truncate leading-tight" title={authorBook.volumeInfo?.title || 'Untitled'}>
                    {authorBook.volumeInfo?.title || 'Untitled'}
                  </h4>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs"
                    onClick={() => onSearchByTitle(authorBook.volumeInfo?.title || '')}
                  >
                    <Search className="w-3 h-3 mr-1" />
                    Search
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          {books.length > itemsPerView && (
            <div className="flex justify-center mt-4">
              <div className="flex gap-1">
                {Array.from({ length: totalPages }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentIndex
                        ? 'bg-primary'
                        : 'bg-muted-foreground/30 hover:bg-muted-foreground/60'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
