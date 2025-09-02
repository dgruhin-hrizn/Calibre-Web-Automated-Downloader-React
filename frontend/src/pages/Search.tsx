import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, Filter, Download, Eye, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { CircularProgress } from '../components/ui/CircularProgress'
import { SkeletonGrid } from '../components/ui/SkeletonCard'
import { BookDetailsModal } from '../components/BookDetailsModal'
import { useSearchBooks, useSearchCache } from '../hooks/useSearchCache'
import { useDownloadBook, useDownloadStatus, type Book } from '../hooks/useDownloads'
import { useDownloadStore } from '../stores/downloadStore'
import { AuthorFormatter } from '../utils/authorFormatter'


export function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [author, setAuthor] = useState('')
  const [language, setLanguage] = useState('')
  const [format, setFormat] = useState('')
  const [pendingDownloads, setPendingDownloads] = useState<Set<string>>(new Set())
  const [selectedBook, setSelectedBook] = useState<any | null>(null)
  const isUpdatingFromUrl = useRef(false)
  
  // Create search params object for executed searches only
  const [executedSearchParams, setExecutedSearchParams] = useState<any>(null)

  // Use React Query for search with built-in caching (only for executed searches)
  const searchBooks = useSearchBooks(executedSearchParams)
  const cachedResults = useSearchCache(executedSearchParams)
  
  const downloadBook = useDownloadBook()
  const downloads = useDownloadStore((state) => state.downloads)
  
  // Ensure download status is being polled
  useDownloadStatus()
  
  // Library checking removed - using CWA proxy approach instead

  // Clear pending downloads when queue status updates
  useEffect(() => {
    setPendingDownloads(prev => {
      const updated = new Set(prev)
      let hasChanges = false
      
      // Remove any pending downloads that now have queue status
      prev.forEach(bookId => {
        if (downloads[bookId] && downloads[bookId].status !== 'idle') {
          updated.delete(bookId)
          hasChanges = true
        }
      })
      
      return hasChanges ? updated : prev
    })
  }, [downloads])


  // Handle URL query parameter (one-way sync: URL → State)
  useEffect(() => {
    const urlQuery = searchParams.get('q') || ''
    const isFreshSearch = searchParams.get('fresh') === 'true'
    
    if (isFreshSearch && urlQuery) {
      // Fresh search from header - clear all filters and set query
      isUpdatingFromUrl.current = true
      setQuery(urlQuery)
      setAuthor('')
      setLanguage('')
      setFormat('')
      
      // Execute the search immediately for fresh searches from header
      const searchParamsObj = {
        query: urlQuery.trim(),
        author: undefined,
        language: undefined,
        format: undefined,
      }
      setExecutedSearchParams(searchParamsObj)
      
      // Remove fresh flag from URL
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.delete('fresh')
      setSearchParams(newSearchParams, { replace: true })
      
      // Reset flag after state updates
      setTimeout(() => {
        isUpdatingFromUrl.current = false
      }, 0)
    } else if (urlQuery !== query && !isUpdatingFromUrl.current) {
      // Sync URL to state (but don't create a loop)
      isUpdatingFromUrl.current = true
      setQuery(urlQuery)
      
      // If there's a URL query on load, execute the search
      if (urlQuery && !executedSearchParams) {
        const searchParamsObj = {
          query: urlQuery.trim(),
          author: author.trim() || undefined,
          language: language || undefined,
          format: format || undefined,
        }
        setExecutedSearchParams(searchParamsObj)
      }
      
      setTimeout(() => {
        isUpdatingFromUrl.current = false
      }, 0)
    }
  }, [searchParams.get('q'), searchParams.get('fresh')]) // Only depend on the specific params we care about
  
  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim() || isUpdatingFromUrl.current) return
    
    // Create search params object
    const searchParamsObj = {
      query: query.trim(),
      author: author.trim() || undefined,
      language: language || undefined,
      format: format || undefined,
    }
    
    // Execute the search by updating the executed search params
    setExecutedSearchParams(searchParamsObj)
    
    // Update URL to reflect current search (only if not updating from URL)
    const currentUrlQuery = searchParams.get('q')
    if (query.trim() !== currentUrlQuery) {
      setSearchParams({ q: query.trim() }, { replace: true })
    }
  }
  
  const handleDownload = async (book: Book) => {
    // Add to pending downloads immediately
    setPendingDownloads(prev => new Set([...prev, book.id]))
    
    try {
      await downloadBook.mutateAsync({
        id: book.id,
        title: book.title,
        author: book.author,
        coverUrl: book.preview,
      })
    } finally {
      // Remove from pending downloads after request completes
      setPendingDownloads(prev => {
        const newSet = new Set(prev)
        newSet.delete(book.id)
        return newSet
      })
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Search Books</h1>
        <p className="text-muted-foreground">
          Find and download books from multiple sources
        </p>
      </div>

      {/* Search Form */}
      <div className="space-y-4">
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search for books, authors, ISBN..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="search-page-input w-full pl-10 pr-4 py-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button onClick={() => setShowAdvanced(!showAdvanced)} variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Button onClick={handleSearch} disabled={!query.trim() || (searchBooks.isPending && !!executedSearchParams)}>
            {searchBooks.isPending && !!executedSearchParams ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <SearchIcon className="w-4 h-4 mr-2" />
                Search
              </>
            )}
          </Button>
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-border rounded-lg bg-card">
            <div>
              <label className="block text-sm font-medium mb-2">Author</label>
              <input
                type="text"
                placeholder="Author name"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Language</label>
              <select 
                value={language} 
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Any language</option>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Format</label>
              <select 
                value={format} 
                onChange={(e) => setFormat(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Any format</option>
                <option value="epub">EPUB</option>
                <option value="pdf">PDF</option>
                <option value="mobi">MOBI</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Search Results */}
      {searchBooks.isPending && !!executedSearchParams && <SkeletonGrid count={18} />}
      
      {searchBooks.isError && !!executedSearchParams && (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <p className="text-destructive">Failed to search books. Please try again.</p>
        </div>
      )}
      
      {(() => {
        // Get results from cache or current query
        const results = searchBooks.data || cachedResults
        // const isLoading = searchBooks.isPending
        // const isError = searchBooks.isError
        
        if (results && results.length === 0) {
          return (
            <div className="text-center py-12 text-muted-foreground">
              <SearchIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No books found. Try different search terms.</p>
            </div>
          )
        }
        
        if (results && results.length > 0) {
          return (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">
                Search Results ({results.length})
                {cachedResults && !searchBooks.data && (
                  <span className="text-sm text-muted-foreground ml-2">(cached)</span>
                )}
                {searchBooks.dataUpdatedAt && (
                  <span className="text-xs text-muted-foreground ml-2">
                    Updated {new Date(searchBooks.dataUpdatedAt).toLocaleTimeString()}
                  </span>
                )}
              </h2>
              <div className="grid gap-4 grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {results.map((book: Book) => (
                  <BookCard 
                    key={book.id} 
                    book={book} 
                    downloads={downloads}
                    pendingDownloads={pendingDownloads}
                    onDownload={handleDownload}
                    onDetails={() => setSelectedBook(book)}
                  />
                ))}
              </div>
            </div>
          )
        }
        
        return null
      })()}
      
      {!cachedResults && !searchBooks.data && !searchBooks.isError && (
        <div className="text-center py-12 text-muted-foreground">
          <SearchIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Enter a search query to find books</p>
        </div>
      )}

      {/* Book Details Modal */}
      <BookDetailsModal 
        book={selectedBook} 
        onClose={() => setSelectedBook(null)} 
      />
    </div>
  )
}

// BookCard component with Calibre library checking
interface BookCardProps {
  book: Book
  downloads: any
  pendingDownloads: Set<string>
  onDownload: (book: Book) => void
  onDetails: () => void
}

function BookCard({ book, downloads, pendingDownloads, onDownload, onDetails }: BookCardProps) {
  // Library checking removed - using CWA proxy approach instead
  const downloadStatus = downloads[book.id]
  const isThisBookPending = pendingDownloads.has(book.id)

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden hover:shadow-lg transition-shadow">
      <div className="flex flex-col h-full">
        {/* Book Cover - Fixed aspect ratio for book covers (2:3 ratio) */}
        <div className="relative aspect-[2/3] bg-muted">
          {book.preview ? (
            <img 
              src={book.preview} 
              alt={`${book.title} cover`}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <div class="absolute inset-0 flex items-center justify-center">
                      <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                      </svg>
                    </div>

                  `;
                }
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
              </svg>
            </div>
          )}
          
          {/* Library indicator removed - using CWA proxy approach instead */}
        </div>
        
        {/* Book Info */}
        <div className="p-3 flex-1 flex flex-col">
          <div className="flex-1 space-y-2">
            <h3 className="font-medium text-sm leading-tight line-clamp-2 text-foreground" title={book.title}>
              {book.title}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-1" title={AuthorFormatter.formatForDisplay(book.author) || 'Unknown Author'}>
              by {AuthorFormatter.formatForDisplay(book.author) || 'Unknown Author'}
            </p>
            
            {/* Metadata */}
            <div className="flex flex-wrap gap-1">
              {book.format && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded font-medium">
                  {book.format.toUpperCase()}
                </span>
              )}
              {book.language && (
                <span className="px-1.5 py-0.5 bg-secondary text-secondary-foreground text-xs rounded">
                  {book.language.toUpperCase()}
                </span>
              )}
              {book.year && (
                <span className="px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded">
                  {book.year}
                </span>
              )}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex flex-col gap-1.5 mt-3">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs h-7"
              onClick={onDetails}
            >
              <Eye className="w-3 h-3 mr-1" />
              Details
            </Button>
            
            {/* Download Button with Queue State Sync */}
            {(() => {
              // Determine if we have meaningful progress or backend is actually working
              const hasRealProgress = downloadStatus && (
                downloadStatus.progress > 0 || // Has actual progress
                downloadStatus.status === 'completed' || // Completed
                downloadStatus.status === 'error' || // Failed
                downloadStatus.status === 'processing' || // Backend processing
                downloadStatus.status === 'waiting' // Backend waiting
              )
              
              // Show pending if locally pending OR if we have 0% downloading (which is really pending)
              const isPending = isThisBookPending || (
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
              if (isPending) {
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
                    <span className="text-xs font-medium text-primary ml-2">Queuing...</span>
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
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
