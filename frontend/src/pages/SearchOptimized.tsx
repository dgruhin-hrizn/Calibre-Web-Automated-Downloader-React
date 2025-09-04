import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, Filter, AlertCircle, Loader2, Upload, FileText } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { SkeletonGrid } from '../components/ui/SkeletonCard'
import { UnifiedBookCard, type UnifiedBook } from '../components/UnifiedBookCard'
import { useSearchBooks, useSearchCache } from '../hooks/useSearchCache'
import { useDownloadBook, useDownloadStatus, type Book } from '../hooks/useDownloads'
import { useDownloadStore } from '../stores/downloadStore'

export function SearchOptimized() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [author, setAuthor] = useState('')
  const [language, setLanguage] = useState('')
  const [format, setFormat] = useState('')
  const [pendingDownloads, setPendingDownloads] = useState<Set<string>>(new Set())
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Create search params object
  const searchParamsObj = query.trim() ? {
    query: query.trim(),
    author: author.trim() || undefined,
    language: language || undefined,
    format: format || undefined,
  } : null

  // Use React Query for search with built-in caching
  const searchBooks = useSearchBooks(searchParamsObj)
  const cachedResults = useSearchCache(searchParamsObj)
  
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

  // Handle URL query parameter
  useEffect(() => {
    const urlQuery = searchParams.get('q')
    if (urlQuery && urlQuery !== query) {
      setQuery(urlQuery)
    }
  }, [searchParams])

  // Update URL when query changes
  useEffect(() => {
    if (query && query !== searchParams.get('q')) {
      setSearchParams({ q: query })
    } else if (!query && searchParams.get('q')) {
      setSearchParams({})
    }
  }, [query, searchParams, setSearchParams])
  
  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return
    
    // React Query will automatically handle caching
    // Just trigger a refetch if we have stale data
    if (searchBooks.isStale) {
      searchBooks.refetch()
    }
  }
  
  const handleDownload = async (book: Book) => {
    setPendingDownloads(prev => new Set([...prev, book.id]))
    
    try {
      await downloadBook.mutateAsync({
        id: book.id,
        title: book.title,
        author: book.author,
        coverUrl: book.preview,
      })
    } finally {
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

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const bookFiles = files.filter(file => 
      file.name.toLowerCase().endsWith('.epub') ||
      file.name.toLowerCase().endsWith('.pdf') ||
      file.name.toLowerCase().endsWith('.mobi') ||
      file.name.toLowerCase().endsWith('.azw') ||
      file.name.toLowerCase().endsWith('.azw3')
    )
    
    if (bookFiles.length === 0) {
      alert('Please drop valid book files (.epub, .pdf, .mobi, .azw, .azw3)')
      return
    }
    
    await uploadBooks(bookFiles)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      uploadBooks(files)
    }
  }

  const uploadBooks = async (files: File[]) => {
    const fileNames = files.map(f => f.name)
    setUploadingFiles(fileNames)
    
    try {
      const formData = new FormData()
      files.forEach(file => {
        formData.append('books', file)
      })
      
      const response = await fetch('/api/ingest/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      })
      
      if (response.ok) {
        await response.json()
        alert(`Successfully uploaded ${files.length} book(s) to ingest directory`)
      } else {
        throw new Error('Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload books. Please try again.')
    } finally {
      setUploadingFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Get results from cache or current query
  const results = searchBooks.data || cachedResults
  const isLoading = searchBooks.isPending
  const isError = searchBooks.isError

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add Books</h1>
        <p className="text-muted-foreground">
          Upload your own books or search online to add to your library
        </p>
      </div>

      {/* Drag and Drop Upload Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Add Books</h2>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".epub,.pdf,.mobi,.azw,.azw3"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {uploadingFiles.length > 0 ? (
            <div className="space-y-2">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
              <p className="text-lg font-medium">Uploading books...</p>
              <div className="space-y-1">
                {uploadingFiles.map((fileName, index) => (
                  <p key={index} className="text-sm text-muted-foreground">
                    <FileText className="w-4 h-4 inline mr-2" />
                    {fileName}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
              <div>
                <p className="text-lg font-medium">
                  Drag and drop book files here
                </p>
                <p className="text-muted-foreground">
                  Supports EPUB, PDF, MOBI, AZW, and AZW3 formats
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose Files
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Search Form */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Search for Books Online</h2>
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search for books..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button type="submit" disabled={isLoading || !query.trim()}>
            {isLoading ? (
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
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </form>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-border rounded-md bg-muted/50">
            <div>
              <label className="block text-sm font-medium mb-2">Author</label>
              <input
                type="text"
                placeholder="Author name"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Any language</option>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Any format</option>
                <option value="epub">EPUB</option>
                <option value="pdf">PDF</option>
                <option value="mobi">MOBI</option>
                <option value="azw3">AZW3</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Search Results */}
      {isLoading && <SkeletonGrid count={18} />}
      
      {isError && (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <p className="text-destructive">Failed to search books. Please try again.</p>
        </div>
      )}
      
      {results && results.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <SearchIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No books found. Try different search terms.</p>
        </div>
      )}
      
      {results && results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">
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
            {results.map((book: Book) => {
              const downloadStatus = downloads[book.id]
              const isThisBookPending = pendingDownloads.has(book.id)
              
              return (
                <UnifiedBookCard
                  key={book.id}
                  book={book as UnifiedBook}
                  cardType="search"
                  downloadStatus={downloadStatus}
                  isPending={isThisBookPending}
                  onDownload={(_unifiedBook) => handleDownload(book)}
                />
              )
            })}
          </div>
        </div>
      )}
      
      {!results && !isError && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <SearchIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Enter a search query to find books</p>
        </div>
      )}
    </div>
  )
}
