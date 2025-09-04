import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, Upload } from 'lucide-react'
import * as Tabs from '@radix-ui/react-tabs'
import { SearchResultModal } from '../../components/SearchResultModal'
import { useSearchBooks, useSearchCache } from '../../hooks/useSearchCache'
import { useDownloadBook, useDownloadStatus, type Book } from '../../hooks/useDownloads'
import { useDownloadStore } from '../../stores/downloadStore'
import { useToast } from '../../hooks/useToast'
import { BookUpload } from './components/BookUpload'
import { SearchForm } from './components/SearchForm'
import { SearchResults } from './components/SearchResults'
import { UploadHistory } from './components/UploadHistory'

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [author, setAuthor] = useState('')
  const [language, setLanguage] = useState('')
  const [format, setFormat] = useState('')
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Add Books</h1>
        <p className="text-muted-foreground">
          Search online for books or upload your own files to add to your library
        </p>
      </div>

      <Tabs.Root defaultValue="search" className="w-full">
        <Tabs.List className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full sm:w-auto">
          <Tabs.Trigger
            value="search"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex-1 sm:flex-initial"
          >
            <SearchIcon className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Search Online</span>
            <span className="sm:hidden">Search</span>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="upload"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex-1 sm:flex-initial"
          >
            <Upload className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Upload Books</span>
            <span className="sm:hidden">Upload</span>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="upload" className="mt-6 space-y-4">
          <BookUpload 
            onHistoryUpdate={() => setRefreshHistoryTrigger(prev => prev + 1)}
          />
          <UploadHistory key={refreshHistoryTrigger} />
        </Tabs.Content>

        <Tabs.Content value="search" className="mt-6 space-y-4">
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
          />
        </Tabs.Content>
      </Tabs.Root>

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
