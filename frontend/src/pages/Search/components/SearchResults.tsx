import { Search as SearchIcon, AlertCircle } from 'lucide-react'
import { SkeletonGrid } from '../../../components/ui/SkeletonCard'
import { BookCard } from './BookCard'
import { SearchSortDropdown, type SearchSortParam } from './SearchSortDropdown'
import { sortSearchResults } from '../utils/sortUtils'
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
  sortParam: SearchSortParam
  onSortChange: (sort: SearchSortParam) => void
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
  dataUpdatedAt,
  sortParam,
  onSortChange
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
  
  // Get results from cache or current query and apply sorting
  const rawResults = results || cachedResults
  const displayResults = rawResults ? sortSearchResults(rawResults, sortParam) : rawResults
  
  // Show no results found
  if (displayResults && displayResults.length === 0) {
    return (
      <div className="text-center py-16 mt-8">
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-12 max-w-2xl mx-auto">
          <div>
            <div className="flex items-center justify-center mb-6">
              <div className="bg-destructive/10 p-4 rounded-full">
                <SearchIcon className="w-8 h-8 text-destructive" />
              </div>
            </div>
            
            <h3 className="text-2xl font-bold text-foreground mb-3">
              No Books Found
            </h3>
            
            <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
              We couldn't find any books matching your search criteria. Try adjusting your search terms or filters.
            </p>
            
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              <div className="bg-background/50 border border-destructive/20 rounded-full px-4 py-2 text-muted-foreground">
                🔍 Try different keywords
              </div>
              <div className="bg-background/50 border border-destructive/20 rounded-full px-4 py-2 text-muted-foreground">
                📖 Check spelling
              </div>
              <div className="bg-background/50 border border-destructive/20 rounded-full px-4 py-2 text-muted-foreground">
                🎯 Remove filters
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  // Show search results
  if (displayResults && displayResults.length > 0) {
    return (
      <div className="space-y-6">
        {/* Themed Results Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Mobile Layout */}
          <div className="flex sm:hidden items-center gap-2">
            {/* Results Info Box - Mobile Half Width */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg px-3 py-3 flex-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-sm font-semibold text-foreground truncate">
                    {displayResults.length} {displayResults.length === 1 ? 'Book' : 'Books'} Found
                  </h2>
                  {cachedResults && !results && (
                    <span className="text-xs text-primary/80 font-medium whitespace-nowrap">(cached)</span>
                  )}
                  {dataUpdatedAt && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(dataUpdatedAt).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Sort Controls - Mobile */}
            <div className="flex items-center">
              <SearchSortDropdown
                sortParam={sortParam}
                onSortChange={onSortChange}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:flex sm:items-center sm:justify-between sm:w-full sm:gap-4">
            {/* Results Info Box - Desktop */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-foreground">
                    {displayResults.length} {displayResults.length === 1 ? 'Book' : 'Books'} Found
                  </h2>
                  {cachedResults && !results && (
                    <span className="text-sm text-primary/80 font-medium">(cached results)</span>
                  )}
                  {dataUpdatedAt && (
                    <span className="text-sm text-muted-foreground">
                      Updated {new Date(dataUpdatedAt).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Sort Controls - Desktop */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <SearchSortDropdown
                sortParam={sortParam}
                onSortChange={onSortChange}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>
        
        {/* Results Grid */}
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
      <div className="text-center py-16 mt-8">
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-12 max-w-2xl mx-auto">
          <div>
              <div className="flex items-center justify-center mb-6">
                <div className="bg-primary/10 p-4 rounded-full">
                  <SearchIcon className="w-8 h-8 text-primary" />
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-foreground mb-3">
                Discover Your Next Great Read
              </h3>
              
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                Search books by title, author, or ISBN to find exactly what you're looking for.
              </p>
              
              <div className="flex flex-wrap justify-center gap-3 text-sm">
                <div className="bg-background/50 border border-primary/20 rounded-full px-4 py-2 text-muted-foreground">
                  📚 Millions of books
                </div>
                <div className="bg-background/50 border border-primary/20 rounded-full px-4 py-2 text-muted-foreground">
                  🔍 Smart search
                </div>
                <div className="bg-background/50 border border-primary/20 rounded-full px-4 py-2 text-muted-foreground">
                  ⚡ Instant results
                </div>
              </div>
            </div>
        </div>
      </div>
    )
  }
  
  return null
}