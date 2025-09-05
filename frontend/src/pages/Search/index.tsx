import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, Upload } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { SearchResultModal } from '../../components/SearchResultModal'
import { useSearchBooks, useSearchCache } from '../../hooks/useSearchCache'
import { useDownloadBook, useDownloadStatus, type Book } from '../../hooks/useDownloads'
import { useDownloadStore } from '../../stores/downloadStore'
import { useToast } from '../../hooks/useToast'
import { BookUpload } from './components/BookUpload'
import { SearchForm } from './components/SearchForm'
import { SearchResults } from './components/SearchResults'
import { UploadHistory } from './components/UploadHistory'
import { type SearchSortParam } from './components/SearchSortDropdown'

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [author, setAuthor] = useState('')
  const [language, setLanguage] = useState('')
  const [format, setFormat] = useState('')
  const [sortParam, setSortParam] = useState<SearchSortParam>('year-asc')
  const [currentMode, setCurrentMode] = useState<'search' | 'upload'>('search')
  const [pendingDownloads, setPendingDownloads] = useState<Set<string>>(new Set())
  const [selectedBook, setSelectedBook] = useState<any | null>(null)
  const isUpdatingFromUrl = useRef(false)
  const { ToastContainer } = useToast()
  const [refreshHistoryTrigger, setRefreshHistoryTrigger] = useState(0)
  
  // Create search params object for executed searches only
  const [executedSearchParams, setExecutedSearchParams] = useState<any>(null)

  // Use React Query for search with built-in caching (only for executed searches)
  const searchBooks = useSearchBooks(executedSearchParams)
  const cachedResults = useSearchCache(executedSearchParams)
  
  const downloadBook = useDownloadBook()
  const downloads = useDownloadStore((state) => state.downloads)
  
  // Ensure download status is being polled
  useDownloadStatus()

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

  const handleSortChange = (newSort: SearchSortParam) => {
    setSortParam(newSort)
  }

  return (
    <div className="space-y-6">
      {/* Header with Toggle Group */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Add Books</h1>
          <p className="text-muted-foreground">
            Search online for books or upload your own files to add to your library
          </p>
        </div>
        
        {/* Search/Upload Toggle - Styled like Library View Toggle */}
        <div className="flex items-center border rounded-md flex-shrink-0 self-end sm:self-center ml-auto sm:ml-0">
          <Button
            variant={currentMode === 'search' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentMode('search')}
            className="rounded-r-none flex items-center gap-1.5"
            title="Search Online"
          >
            <SearchIcon className="h-4 w-4" />
            <span className="text-xs sm:hidden">Search</span>
            <span className="hidden sm:inline sr-only">Search</span>
          </Button>
          <Button
            variant={currentMode === 'upload' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentMode('upload')}
            className="rounded-l-none flex items-center gap-1.5"
            title="Upload Books"
          >
            <Upload className="h-4 w-4" />
            <span className="text-xs sm:hidden">Upload</span>
            <span className="hidden sm:inline sr-only">Upload</span>
          </Button>
        </div>
      </div>

      {/* Content based on current mode */}
      <div className="relative min-h-[400px]">
        {/* Search Content */}
        <div 
          className={`space-y-6 sm:space-y-8 transition-all duration-300 ease-in-out ${
            currentMode === 'search' 
              ? 'opacity-100 translate-x-0 pointer-events-auto' 
              : 'opacity-0 -translate-x-4 pointer-events-none absolute inset-0'
          }`}
        >
          <SearchForm
            query={query}
            setQuery={setQuery}
            author={author}
            setAuthor={setAuthor}
            language={language}
            setLanguage={setLanguage}
            format={format}
            setFormat={setFormat}
            onSearch={handleSearch}
            isLoading={searchBooks.isPending && !!executedSearchParams}
            onKeyDown={handleKeyDown}
          />

          <SearchResults
            isLoading={searchBooks.isPending}
            isError={searchBooks.isError}
            hasExecutedSearch={!!executedSearchParams}
            results={searchBooks.data}
            cachedResults={cachedResults}
            downloads={downloads}
            pendingDownloads={pendingDownloads}
            onDownload={handleDownload}
            onDetails={setSelectedBook}
            dataUpdatedAt={searchBooks.dataUpdatedAt}
            sortParam={sortParam}
            onSortChange={handleSortChange}
          />
        </div>

        {/* Upload Content */}
        <div 
          className={`space-y-4 transition-all duration-300 ease-in-out ${
            currentMode === 'upload' 
              ? 'opacity-100 translate-x-0 pointer-events-auto' 
              : 'opacity-0 translate-x-4 pointer-events-none absolute inset-0'
          }`}
        >
          <BookUpload 
            onHistoryUpdate={() => setRefreshHistoryTrigger(prev => prev + 1)}
          />
          <UploadHistory key={refreshHistoryTrigger} />
        </div>
      </div>

      {/* Search Result Details Modal */}
      <SearchResultModal 
        book={selectedBook} 
        onClose={() => setSelectedBook(null)} 
      />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  )
}
