import { useState, useCallback } from 'react'
import { CachedImage } from '../../ui/CachedImage'
import { ReadingStatusOverlay } from './ReadingStatusOverlay'
import { type UnifiedBook } from '../types'
import { type ReadStatus } from '../../ReadStatusDropdown'
import { type ReadStatus as HookReadStatus } from '../../../hooks/useReadStatus'
import { getBlurEffectClass, isToday } from '../utils'

interface BookCoverProps {
  book: UnifiedBook
  cardType: 'search' | 'library'
  aspectClass: string
  coverUrl?: string | null
  canLoadImage: boolean
  bookReadStatus?: ReadStatus
  hookReadStatus?: HookReadStatus
  onImageLoaded?: (bookId: string | number) => void
  onDetails?: (book: UnifiedBook) => void
}

export function BookCover({
  book,
  cardType,
  aspectClass,
  coverUrl,
  canLoadImage,
  bookReadStatus,
  hookReadStatus,
  onImageLoaded,
  onDetails
}: BookCoverProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  
  // Check if this book was added today
  const isNewBook = cardType === 'library' && isToday(book.timestamp)

  // Handle image loading for library books
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true)
    if (onImageLoaded) {
      onImageLoaded(book.id)
    }
  }, [book.id, onImageLoaded])
  
  const handleImageError = useCallback((_e: any) => {
    setImageError(true)
    if (onImageLoaded) {
      onImageLoaded(book.id) // Still mark as "processed" to move to next image
    }
  }, [book.id, onImageLoaded])

  const coverContent = () => {
    if (!coverUrl) {
      return (
        <div className={`${aspectClass} bg-muted overflow-hidden flex flex-col items-center justify-center relative p-4 text-center`}>
          <img 
            src="/droplet.png" 
            alt="No cover available" 
            className="w-12 h-12 mb-2 opacity-60"
          />
          <span className="text-xs text-muted-foreground font-medium">
            No Available Cover
          </span>
          {isNewBook && (
            <div className="absolute top-2 right-2 bg-teal-700 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-md">
              NEW
            </div>
          )}
        </div>
      )
    }
    
    if (cardType === 'search') {
      return (
        <div className={`${aspectClass} relative`}>
          <img
            src={coverUrl}
            alt={book.title}
            className={`w-full h-full object-cover ${getBlurEffectClass(bookReadStatus, hookReadStatus)}`}
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI2NyIgdmlld0JveD0iMCAwIDIwMCAyNjciIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjY3IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMDAgMTMzLjVMMTAwIDEzMy41WiIgc3Ryb2tlPSIjOUNBM0FGIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K'
            }}
          />
          {/* Reading Status Overlay */}
          <ReadingStatusOverlay bookReadStatus={bookReadStatus} hookReadStatus={hookReadStatus} />
        </div>
      )
    } else {
      // Library book with cached image loading
      return (
        <div className={`${aspectClass} bg-muted overflow-hidden relative`}>
          {canLoadImage ? (
            <>
              {!imageLoaded && !imageError && (
                <div className="w-full h-full relative">
                  <div className="animate-pulse bg-muted-foreground/20 w-full h-full" />
                  {/* Centered spinner */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                </div>
              )}
              <CachedImage 
                src={coverUrl} 
                alt={book.title}
                className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'} ${getBlurEffectClass(bookReadStatus, hookReadStatus)}`}
                style={{ display: imageError ? 'none' : 'block' }}
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
              {/* Reading Status Overlay */}
              <ReadingStatusOverlay bookReadStatus={bookReadStatus} hookReadStatus={hookReadStatus} />
              {imageError && (
                <>
                  <div className={`w-full h-full flex flex-col items-center justify-center p-4 text-center ${getBlurEffectClass(bookReadStatus, hookReadStatus)}`}>
                    <img 
                      src="/droplet.png" 
                      alt="No cover available" 
                      className="w-12 h-12 mb-2 opacity-60"
                    />
                    <span className="text-xs text-muted-foreground font-medium">
                      No Available Cover
                    </span>
                  </div>
                  {/* Reading Status Overlay for error state */}
                  <ReadingStatusOverlay bookReadStatus={bookReadStatus} hookReadStatus={hookReadStatus} />
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full relative">
              <div className={`animate-pulse bg-muted-foreground/20 w-full h-full ${getBlurEffectClass(bookReadStatus, hookReadStatus)}`} />
              {/* Centered spinner */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
              {/* Reading Status Overlay for loading state */}
              <ReadingStatusOverlay bookReadStatus={bookReadStatus} hookReadStatus={hookReadStatus} />
            </div>
          )}
          {isNewBook && (
            <div className="absolute top-2 right-2 bg-teal-700 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-md">
              NEW
            </div>
          )}
        </div>
      )
    }
  }

  // Make cover clickable if onDetails is available
  if (onDetails) {
    return (
      <div 
        className="cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => onDetails(book)}
      >
        {coverContent()}
      </div>
    )
  }

  return coverContent()
}
