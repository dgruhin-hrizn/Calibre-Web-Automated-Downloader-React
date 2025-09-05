import * as Dialog from '@radix-ui/react-dialog'
import { Button } from './ui/Button'
import { UnifiedBookCard } from './UnifiedBookCard'
import { AlertTriangle, Search, X } from 'lucide-react'

interface LibraryBook {
  id: number
  title: string
  authors: string[]
  series?: string
  series_index?: number
  formats: string[]
  has_cover: boolean
  rating?: number
  read_status?: string
  timestamp?: string
  path?: string
  tags?: string[]
  comments?: string
  pubdate?: string
}

interface ExistingBooksModalProps {
  isOpen: boolean
  onClose: () => void
  onProceedWithSearch: () => void
  existingBooks: LibraryBook[]
  searchQuery: string
  searchAuthor?: string
  searchTitle?: string
  isLoading?: boolean
}

export function ExistingBooksModal({
  isOpen,
  onClose,
  onProceedWithSearch,
  existingBooks,
  searchQuery,
  searchAuthor,
  searchTitle,
  isLoading = false
}: ExistingBooksModalProps) {

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
          <Dialog.Content className="bg-background border-0 sm:border border-border rounded-none sm:rounded-lg shadow-lg max-w-[1000px] lg:max-w-[1100px] xl:max-w-[1015px] w-full h-full sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                <Dialog.Title className="text-lg font-semibold line-clamp-1">
                  Similar Books Found in Library
                </Dialog.Title>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </Dialog.Close>
            </div>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              We found {existingBooks.length} book{existingBooks.length !== 1 ? 's' : ''} in your library that might match your search{' '}
              {searchTitle && searchAuthor ? (
                <>for "<strong>{searchTitle}</strong>" by <strong>{searchAuthor}</strong></>
              ) : searchTitle ? (
                <>for "<strong>{searchTitle}</strong>"</>
              ) : searchAuthor ? (
                <>by <strong>{searchAuthor}</strong></>
              ) : (
                <>for "<strong>{searchQuery}</strong>"</>
              )}. 
              Would you like to search online anyway?
            </Dialog.Description>
          </div>

          {/* Books List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 justify-items-center">
              {existingBooks.map((book) => (
                <div 
                  key={book.id}
                  className="w-full max-w-[225px]"
                >
                  <UnifiedBookCard
                    book={{
                      id: book.id,
                      title: book.title,
                      authors: book.authors,
                      series: book.series,
                      series_index: book.series_index,
                      formats: book.formats,
                      rating: book.rating,
                      read_status: book.read_status as any, // Cast to avoid type issues
                      // Add any other required fields with defaults
                      timestamp: book.timestamp || '',
                      path: book.path || '',
                      size: '0',
                      pubdate: book.pubdate || '',
                      tags: book.tags || [],
                      comments: book.comments || '',
                      // Use the has_cover field from the API response
                      has_cover: book.has_cover,
                      // Don't set preview URL - let UnifiedBookCard construct the proper API URL
                    }}
                    cardType="library"
                    viewMode="grid"
                    showReadStatus={true}
                    shouldLoadImage={() => true}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 sm:p-6 border-t border-border flex-shrink-0">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex items-center gap-2"
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
                Cancel Search
              </Button>
              
              <Button
                onClick={onProceedWithSearch}
                className="flex items-center gap-2"
                disabled={isLoading}
              >
                <Search className="h-4 w-4" />
                {isLoading ? 'Searching...' : 'Search Online Anyway'}
              </Button>
            </div>

            {/* Help Text */}
            <div className="mt-4 text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
              <strong>Tip:</strong> If none of these books are what you're looking for, click "Search Online Anyway" to find more options from external sources.
            </div>
          </div>
        </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
