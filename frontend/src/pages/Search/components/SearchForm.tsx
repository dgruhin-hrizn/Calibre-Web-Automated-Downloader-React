import { useState } from 'react'
import { Search as SearchIcon, Loader2, ChevronDown, User, Globe, FileText, X } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

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
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const handleDropdownChange = (dropdownName: string, isOpen: boolean) => {
    setOpenDropdown(isOpen ? dropdownName : null)
  }

  return (
    <div className="space-y-4">
      {/* Main Search Bar */}
      <div className="space-y-4">
        {/* Search Input Row - Mobile */}
        <div className="flex gap-2 sm:hidden">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search for books, authors, ISBN..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              className="search-page-input w-full pl-10 pr-4 py-3 text-base bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button
            onClick={onSearch}
            disabled={!query.trim() || isLoading}
            className="flex-shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-3 h-auto"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <SearchIcon className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Desktop Layout - Search Input and Controls in same row */}
        <div className="hidden sm:flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search for books, authors, ISBN..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              className="search-page-input w-full pl-10 pr-4 py-3 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          
          {/* Author Filter Dropdown */}
          <DropdownMenu.Root 
            open={openDropdown === 'author'} 
            onOpenChange={(open) => handleDropdownChange('author', open)}
          >
            <DropdownMenu.Trigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className={`flex items-center gap-2 ${author ? 'bg-primary/10 border-primary/30' : ''}`}
                title={author || 'Filter by author'}
              >
                <User className="h-4 w-4" />
                <span>{author || 'Author'}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content 
                className="min-w-[200px] bg-background border border-border rounded-md shadow-lg z-50"
                align="end"
                sideOffset={4}
              >
                <div className="p-2">
                  <label className="block text-sm font-medium mb-2">Filter by Author</label>
                  <input
                    type="text"
                    placeholder="Author name..."
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                  />
                  {author && (
                    <Button
                      onClick={() => setAuthor('')}
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 justify-start"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear Author Filter
                    </Button>
                  )}
                </div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Language Filter Dropdown */}
          <DropdownMenu.Root 
            open={openDropdown === 'language'} 
            onOpenChange={(open) => handleDropdownChange('language', open)}
          >
            <DropdownMenu.Trigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className={`flex items-center gap-2 ${language ? 'bg-primary/10 border-primary/30' : ''}`}
                title={language ? `Language: ${language}` : 'Filter by language'}
              >
                <Globe className="h-4 w-4" />
                <span>{language ? language.toUpperCase() : 'Language'}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content 
                className="min-w-[160px] bg-background border border-border rounded-md shadow-lg p-1 z-50"
                align="end"
                sideOffset={4}
              >
                <DropdownMenu.Item
                  className="flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  onSelect={() => setLanguage('')}
                >
                  <span className="flex-1">All Languages</span>
                  {!language && <div className="w-2 h-2 bg-primary rounded-full" />}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  onSelect={() => setLanguage('en')}
                >
                  <span className="flex-1">English</span>
                  {language === 'en' && <div className="w-2 h-2 bg-primary rounded-full" />}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  onSelect={() => setLanguage('es')}
                >
                  <span className="flex-1">Spanish</span>
                  {language === 'es' && <div className="w-2 h-2 bg-primary rounded-full" />}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  onSelect={() => setLanguage('fr')}
                >
                  <span className="flex-1">French</span>
                  {language === 'fr' && <div className="w-2 h-2 bg-primary rounded-full" />}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  onSelect={() => setLanguage('de')}
                >
                  <span className="flex-1">German</span>
                  {language === 'de' && <div className="w-2 h-2 bg-primary rounded-full" />}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Format Filter Dropdown */}
          <DropdownMenu.Root 
            open={openDropdown === 'format'} 
            onOpenChange={(open) => handleDropdownChange('format', open)}
          >
            <DropdownMenu.Trigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className={`flex items-center gap-2 ${format ? 'bg-primary/10 border-primary/30' : ''}`}
                title={format ? `Format: ${format.toUpperCase()}` : 'Filter by format'}
              >
                <FileText className="h-4 w-4" />
                <span>{format ? format.toUpperCase() : 'Format'}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content 
                className="min-w-[140px] bg-background border border-border rounded-md shadow-lg p-1 z-50"
                align="end"
                sideOffset={4}
              >
                <DropdownMenu.Item
                  className="flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  onSelect={() => setFormat('')}
                >
                  <span className="flex-1">All Formats</span>
                  {!format && <div className="w-2 h-2 bg-primary rounded-full" />}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  onSelect={() => setFormat('epub')}
                >
                  <span className="flex-1">EPUB</span>
                  {format === 'epub' && <div className="w-2 h-2 bg-primary rounded-full" />}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  onSelect={() => setFormat('pdf')}
                >
                  <span className="flex-1">PDF</span>
                  {format === 'pdf' && <div className="w-2 h-2 bg-primary rounded-full" />}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  onSelect={() => setFormat('mobi')}
                >
                  <span className="flex-1">MOBI</span>
                  {format === 'mobi' && <div className="w-2 h-2 bg-primary rounded-full" />}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          
          {/* Search Button */}
          <Button onClick={onSearch} disabled={!query.trim() || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <SearchIcon className="w-4 h-4 mr-2" />
                <span>Search</span>
              </>
            )}
          </Button>
        </div>
        
        {/* Mobile Filters Row */}
        <div className="sm:hidden">
          <div className="flex gap-2 w-full">
            {/* Author Filter Dropdown */}
            <DropdownMenu.Root 
              open={openDropdown === 'author'} 
              onOpenChange={(open) => handleDropdownChange('author', open)}
            >
              <DropdownMenu.Trigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className={`flex items-center justify-center gap-2 flex-1 ${author ? 'bg-primary/10 border-primary/30' : ''}`}
                  title={author || 'Filter by author'}
                >
                  <User className="h-4 w-4" />
                  <span className="text-xs">{author || 'Author'}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content 
                  className="min-w-[200px] bg-background border border-border rounded-md shadow-lg z-50"
                  align="end"
                  sideOffset={4}
                >
                  <div className="p-2">
                    <label className="block text-sm font-medium mb-2">Filter by Author</label>
                    <input
                      type="text"
                      placeholder="Author name..."
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      autoFocus
                    />
                    {author && (
                      <Button
                        onClick={() => setAuthor('')}
                        variant="ghost"
                        size="sm"
                        className="w-full mt-2 justify-start"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Clear Author Filter
                      </Button>
                    )}
                  </div>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Language Filter Dropdown */}
            <DropdownMenu.Root 
              open={openDropdown === 'language'} 
              onOpenChange={(open) => handleDropdownChange('language', open)}
            >
              <DropdownMenu.Trigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className={`flex items-center justify-center gap-2 flex-1 ${language ? 'bg-primary/10 border-primary/30' : ''}`}
                  title={language ? `Language: ${language}` : 'Filter by language'}
                >
                  <Globe className="h-4 w-4" />
                  <span className="text-xs">{language ? language.toUpperCase() : 'Language'}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content 
                  className="min-w-[160px] bg-background border border-border rounded-md shadow-lg p-1 z-50"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenu.Item
                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    onSelect={() => setLanguage('')}
                  >
                    <span className="flex-1">All Languages</span>
                    {!language && <div className="w-2 h-2 bg-primary rounded-full" />}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    onSelect={() => setLanguage('en')}
                  >
                    <span className="flex-1">English</span>
                    {language === 'en' && <div className="w-2 h-2 bg-primary rounded-full" />}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    onSelect={() => setLanguage('es')}
                  >
                    <span className="flex-1">Spanish</span>
                    {language === 'es' && <div className="w-2 h-2 bg-primary rounded-full" />}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    onSelect={() => setLanguage('fr')}
                  >
                    <span className="flex-1">French</span>
                    {language === 'fr' && <div className="w-2 h-2 bg-primary rounded-full" />}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    onSelect={() => setLanguage('de')}
                  >
                    <span className="flex-1">German</span>
                    {language === 'de' && <div className="w-2 h-2 bg-primary rounded-full" />}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Format Filter Dropdown */}
            <DropdownMenu.Root 
              open={openDropdown === 'format'} 
              onOpenChange={(open) => handleDropdownChange('format', open)}
            >
              <DropdownMenu.Trigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className={`flex items-center justify-center gap-2 flex-1 ${format ? 'bg-primary/10 border-primary/30' : ''}`}
                  title={format ? `Format: ${format.toUpperCase()}` : 'Filter by format'}
                >
                  <FileText className="h-4 w-4" />
                  <span className="text-xs">{format ? format.toUpperCase() : 'Format'}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content 
                  className="min-w-[140px] bg-background border border-border rounded-md shadow-lg p-1 z-50"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenu.Item
                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    onSelect={() => setFormat('')}
                  >
                    <span className="flex-1">All Formats</span>
                    {!format && <div className="w-2 h-2 bg-primary rounded-full" />}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    onSelect={() => setFormat('epub')}
                  >
                    <span className="flex-1">EPUB</span>
                    {format === 'epub' && <div className="w-2 h-2 bg-primary rounded-full" />}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    onSelect={() => setFormat('pdf')}
                  >
                    <span className="flex-1">PDF</span>
                    {format === 'pdf' && <div className="w-2 h-2 bg-primary rounded-full" />}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    onSelect={() => setFormat('mobi')}
                  >
                    <span className="flex-1">MOBI</span>
                    {format === 'mobi' && <div className="w-2 h-2 bg-primary rounded-full" />}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      </div>
    </div>
  )
}