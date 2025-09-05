import { Star } from 'lucide-react'
import { Badge } from '../../ui/badge'
import { AuthorFormatter } from '../../../utils/authorFormatter'
import { type UnifiedBook } from '../types'

interface BookInfoProps {
  book: UnifiedBook
  cardType: 'search' | 'library'
  viewMode?: 'grid' | 'list'
}

export function BookInfo({ book, cardType, viewMode = 'grid' }: BookInfoProps) {
  // Get author display string with proper formatting
  const getAuthorDisplay = () => {
    let authorString = ''
    
    if (cardType === 'search') {
      authorString = book.author || 'Unknown Author'
    } else {
      // Handle both array and string formats for authors
      if (Array.isArray(book.authors)) {
        authorString = book.authors.join(', ') || 'Unknown Author'
      } else if (typeof book.authors === 'string') {
        authorString = book.authors || 'Unknown Author'
      } else {
        authorString = 'Unknown Author'
      }
    }
    
    // Apply author formatting fixes (handles pipe characters, "Last, First" format, etc.)
    return authorString === 'Unknown Author' ? authorString : AuthorFormatter.formatForDisplay(authorString)
  }

  if (viewMode === 'list' && cardType === 'library') {
    return (
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
    )
  }

  // Grid view info
  return (
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
      {cardType === 'library' && (
        <div className="flex items-center gap-0.5 mb-2">
          {[1, 2, 3, 4, 5].map((starIndex) => {
            const rating = book.rating ? book.rating / 2 : 0 // Convert from 0-10 to 0-5 scale
            const isFilled = rating >= starIndex
            const isHalfFilled = rating >= starIndex - 0.5 && rating < starIndex
            
            return (
              <Star
                key={starIndex}
                className={`w-3 h-3 ${
                  isFilled
                    ? 'fill-yellow-400 text-yellow-400'
                    : isHalfFilled
                    ? 'fill-yellow-200 text-yellow-400'
                    : 'fill-muted-foreground text-muted-foreground'
                }`}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
