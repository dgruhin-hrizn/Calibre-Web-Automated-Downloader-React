import { Search as SearchIcon, AlertCircle } from 'lucide-react'
import { SkeletonGrid } from '../../../components/ui/SkeletonCard'
import { BookCard } from './BookCard'
import { type Book } from '../../../hooks/useDownloads'

interface SearchResultsProps {
  isLoading: boolean
  isError: boolean
  hasExecutedSearch: boolean
  results: Book[] | undefined
  cachedResults: Book[] | undefined
  downloads: any
  pendingDownloads: Set<string>
  onDownload: (book: Book) => void
  onDetails: (book: Book) => void
  dataUpdatedAt?: number
}

export function SearchResults({
  isLoading,
  isError,
  hasExecutedSearch,
  results,
  cachedResults,
  downloads,
  pendingDownloads,
  onDownload,
  onDetails,
  dataUpdatedAt
}: SearchResultsProps) {
  // Show loading skeleton
  if (isLoading && hasExecutedSearch) {
    return <SkeletonGrid count={18} />
  }
  
  // Show error state
  if (isError && hasExecutedSearch) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
        <p className="text-destructive">Failed to search books. Please try again.</p>
      </div>
    )
  }
  
  // Get results from cache or current query
  const displayResults = results || cachedResults
  
  // Show no results found
  if (displayResults && displayResults.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <SearchIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No books found. Try different search terms.</p>
      </div>
    )
  }
  
  // Show search results
  if (displayResults && displayResults.length > 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          Search Results ({displayResults.length})
          {cachedResults && !results && (
            <span className="text-sm text-muted-foreground ml-2">(cached)</span>
          )}
          {dataUpdatedAt && (
            <span className="text-xs text-muted-foreground ml-2">
              Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
        </h2>
        <div className="flex flex-wrap gap-4 justify-start">
          {displayResults.map((book: Book) => (
            <div 
              key={book.id}
              className="w-[calc(50%-8px)] sm:w-[225px] sm:min-w-[225px] sm:max-w-[225px]"
            >
              <BookCard 
                book={book} 
                downloads={downloads}
                pendingDownloads={pendingDownloads}
                onDownload={onDownload}
                onDetails={onDetails}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }
  
  // Show default state
  if (!cachedResults && !results && !isError) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <SearchIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Enter a search query to find books</p>
      </div>
    )
  }
  
  return null
}