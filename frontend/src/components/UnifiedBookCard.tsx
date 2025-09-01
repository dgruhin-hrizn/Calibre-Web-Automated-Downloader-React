import { useState, useCallback } from 'react'
import { Download, Book, Eye, Star, Send } from 'lucide-react'
import { Button } from './ui/Button'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { CachedImage } from './ui/CachedImage'
import { CircularProgress } from './ui/CircularProgress'

// Common book interface that works for both search and library books
export interface UnifiedBook {
  id: string | number
  title: string
  author?: string  // Search books have single author string
  authors?: string[]  // Library books have authors array
  preview?: string  // Search book cover URL
  has_cover?: boolean  // Library book cover flag
  format?: string  // Search book format
  formats?: string[]  // Library book formats array
  size?: string  // Search book size
  rating?: number  // Library book rating
  tags?: string[]  // Library book tags
  series?: string  // Library book series
  series_index?: number  // Library book series index
  // Additional library book properties
  languages?: string[]
  path?: string
  pubdate?: string
  timestamp?: string
  comments?: string
}

export interface DownloadStatus {
  progress: number
  status: 'idle' | 'downloading' | 'completed' | 'error' | 'processing' | 'waiting'
}

export interface UnifiedBookCardProps {
  book: UnifiedBook
  cardType?: 'search' | 'library'  // Make optional for backward compatibility
  viewMode?: 'grid' | 'list'  // Only used for library cards
  
  // Search-specific props
  downloadStatus?: DownloadStatus
  isPending?: boolean
  onDownload?: (book: UnifiedBook) => void
  
  // Library-specific props  
  shouldLoadImage?: (bookId: string | number) => boolean
  onImageLoaded?: (bookId: string | number) => void
  onDetails?: (book: UnifiedBook) => void
  onSendToKindle?: (book: UnifiedBook) => void
  
  // Button visibility controls
  showDownloadButton?: boolean
  showKindleButton?: boolean
}

export function UnifiedBookCard({
  book,
  cardType = 'library',
  viewMode = 'grid',
  downloadStatus,
  isPending = false,
  onDownload,
  shouldLoadImage,
  onImageLoaded,
  onDetails,
  onSendToKindle,
  showDownloadButton = true,
  showKindleButton = true,
}: UnifiedBookCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  
  // Determine cover URL based on book type
  const getCoverUrl = () => {
    if (cardType === 'search') {
      return book.preview
    } else {
      // For library books, use preview URL if available (e.g., from OPDS), otherwise construct URL
      if (book.preview) {
        return book.preview
      }
      return book.has_cover ? `/api/metadata/books/${book.id}/cover` : null
    }
  }
  
  const coverUrl = getCoverUrl()
  const canLoadImage = cardType === 'search' || !shouldLoadImage || shouldLoadImage(book.id)
  
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
  
  // Get author display string
  const getAuthorDisplay = () => {
    if (cardType === 'search') {
      return book.author || 'Unknown Author'
    } else {
      return book.authors?.join(', ') || 'Unknown Author'
    }
  }
  
  // Render search book action buttons
  const renderSearchActions = () => {
    if (!onDownload) return null
    
    // Determine if we have meaningful progress or backend is actually working
    const hasRealProgress = downloadStatus && (
      downloadStatus.progress > 0 || // Has actual progress
      downloadStatus.status === 'completed' || // Completed
      downloadStatus.status === 'error' || // Failed
      downloadStatus.status === 'processing' || // Backend processing
      downloadStatus.status === 'waiting' // Backend waiting
    )
    
    // Show pending if locally pending OR if we have 0% downloading (which is really pending)
    const showPending = isPending || (
      downloadStatus && 
      downloadStatus.status === 'downloading' && 
      (downloadStatus.progress || 0) === 0
    )
    
    if (hasRealProgress) {
      // Show actual queue status with progress
      return (
        <div className="flex items-center justify-center h-7 px-3 text-xs border border-border rounded-md bg-background">
          <CircularProgress
            progress={downloadStatus.progress}
            status={downloadStatus.status}
            size={16}
            showPercentage={downloadStatus.status === 'downloading' && downloadStatus.progress > 0}
            showText={true}
          />
        </div>
      )
    }
    
    // Show download button or pending state
    if (showPending) {
      return (
        <div className="flex items-center justify-center h-7 px-3 text-xs border border-border rounded-md bg-background">
          <div className="relative" style={{ width: 16, height: 16 }}>
            <svg
              className="animate-spin text-primary"
              width={16}
              height={16}
              viewBox="0 0 16 16"
            >
              <circle
                cx={8}
                cy={8}
                r={6}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="opacity-25"
              />
              <circle
                cx={8}
                cy={8}
                r={6}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeDasharray={37.7}
                strokeDashoffset={28.3}
              />
            </svg>
          </div>
          <span className="text-xs font-medium text-primary ml-2">Adding to queue...</span>
        </div>
      )
    }
    
    return (
      <Button
        size="sm"
        className="text-xs h-7"
        onClick={() => onDownload(book)}
        disabled={false}
      >
        <Download className="w-3 h-3 mr-1" />
        Download
      </Button>
    )
  }
  
  // Render library book action buttons
  const renderLibraryActions = () => {
    if (viewMode === 'list') {
      return (
        <div className="flex flex-col gap-2">
          {onDetails && (
            <Button size="sm" variant="outline" onClick={() => onDetails(book)}>
              <Eye className="h-3 w-3" />
            </Button>
          )}
          {showDownloadButton && onDownload && book.formats && book.formats.length > 0 && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onDownload(book)}
            >
              <Download className="h-3 w-3" />
            </Button>
          )}
          {showKindleButton && onSendToKindle && book.formats && book.formats.length > 0 && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onSendToKindle(book)}
            >
              <Send className="h-3 w-3" />
            </Button>
          )}
        </div>
      )
    } else {
      return (
        <div className="flex gap-1">
          {onDetails && (
            <Button size="sm" variant="outline" onClick={() => onDetails(book)} className="flex-1">
              <Eye className="h-3 w-3" />
            </Button>
          )}
          {showDownloadButton && onDownload && book.formats && book.formats.length > 0 && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onDownload(book)}
              className="flex-1"
            >
              <Download className="h-3 w-3" />
            </Button>
          )}
          {showKindleButton && onSendToKindle && book.formats && book.formats.length > 0 && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onSendToKindle(book)}
              className="flex-1"
            >
              <Send className="h-3 w-3" />
            </Button>
          )}
        </div>
      )
    }
  }
  
  // Render cover image
  const renderCover = (aspectClass: string, iconSize: string) => {
    if (!coverUrl) {
      return (
        <div className={`${aspectClass} bg-muted overflow-hidden flex items-center justify-center`}>
          <Book className={`${iconSize} text-muted-foreground`} />
        </div>
      )
    }
    
    if (cardType === 'search') {
      return (
        <div className={aspectClass}>
          <img
            src={coverUrl}
            alt={book.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI2NyIgdmlld0JveD0iMCAwIDIwMCAyNjciIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjY3IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMDAgMTMzLjVMMTAwIDEzMy41WiIgc3Ryb2tlPSIjOUNBM0FGIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K'
            }}
          />
        </div>
      )
    } else {
      // Library book with cached image loading
      return (
        <div className={`${aspectClass} bg-muted overflow-hidden`}>
          {canLoadImage ? (
            <>
              {!imageLoaded && !imageError && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="animate-pulse bg-muted-foreground/20 w-full h-full" />
                </div>
              )}
              <CachedImage 
                src={coverUrl} 
                alt={book.title}
                className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={handleImageLoad}
                onError={handleImageError}
                style={{ display: imageError ? 'none' : 'block' }}
              />
              {imageError && (
                <div className="w-full h-full flex items-center justify-center">
                  <Book className={`${iconSize} text-muted-foreground`} />
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Book className={`${iconSize} text-muted-foreground`} />
            </div>
          )}
        </div>
      )
    }
  }
  
  // Render for library list view
  if (cardType === 'library' && viewMode === 'list') {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex gap-4">
            {/* Cover */}
            <div className="w-16 h-24 flex-shrink-0">
              {renderCover('w-full h-full rounded', 'h-6 w-6')}
            </div>
            
            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{book.title}</h3>
              <p className="text-sm text-muted-foreground truncate">
                {getAuthorDisplay()}
              </p>
              {book.series && (
                <p className="text-xs text-muted-foreground">
                  {book.series} #{book.series_index}
                </p>
              )}
              
              {/* Tags */}
              {book.tags && book.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {book.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {book.tags.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{book.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            
            {/* Actions */}
            {renderLibraryActions()}
          </div>
        </CardContent>
      </Card>
    )
  }
  
  // Render for grid view (both search and library)
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-0">
        {/* Cover */}
        {renderCover('aspect-[2/3] rounded-t-lg', 'h-12 w-12')}
        
        {/* Info */}
        <div className="p-3 space-y-2">
          <div className="space-y-1">
            <h3 className={`font-medium text-sm mb-1 ${cardType === 'search' ? 'line-clamp-2 leading-tight' : 'truncate'}`}>
              {book.title}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {cardType === 'search' ? `by ${getAuthorDisplay()}` : getAuthorDisplay()}
            </p>
          </div>
          
          {/* Search-specific info */}
          {cardType === 'search' && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{book.format?.toUpperCase()}</span>
              <span>{book.size}</span>
            </div>
          )}
          
          {/* Library-specific info */}
          {cardType === 'library' && book.rating && (
            <div className="flex items-center gap-1 mb-2">
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${
                    i < Math.floor(book.rating! / 2) 
                      ? 'text-yellow-400 fill-current' 
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
          )}
          
          {/* Actions */}
          <div className="flex gap-1">
            {cardType === 'search' ? renderSearchActions() : renderLibraryActions()}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
