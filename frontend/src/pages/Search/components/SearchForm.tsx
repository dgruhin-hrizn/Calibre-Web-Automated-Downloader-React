import { useState } from 'react'
import { Search as SearchIcon, Filter, Loader2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'

interface SearchFormProps {
  query: string
  setQuery: (query: string) => void
  author: string
  setAuthor: (author: string) => void
  language: string
  setLanguage: (language: string) => void
  format: string
  setFormat: (format: string) => void
  onSearch: (e?: React.FormEvent) => void
  isLoading: boolean
  onKeyDown: (e: React.KeyboardEvent) => void
}

export function SearchForm({
  query,
  setQuery,
  author,
  setAuthor,
  language,
  setLanguage,
  format,
  setFormat,
  onSearch,
  isLoading,
  onKeyDown
}: SearchFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search for books, authors, ISBN..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            className="search-page-input w-full pl-10 pr-4 py-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button onClick={() => setShowAdvanced(!showAdvanced)} variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
        <Button onClick={onSearch} disabled={!query.trim() || isLoading}>
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
  )
}
