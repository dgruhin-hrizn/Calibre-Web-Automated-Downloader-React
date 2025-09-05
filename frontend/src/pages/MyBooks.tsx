import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as Accordion from '@radix-ui/react-accordion'
import { ChevronDown, BookOpen, Clock, Heart, BookCheck } from 'lucide-react'
import { cn } from '../lib/utils'
import { apiRequest } from '../lib/utils'
import { UnifiedBookCard, type UnifiedBook } from '../components/UnifiedBookCard'
import { LibraryBookModal } from './Library/components/LibraryBookModal'
import type { LibraryBook } from './Library/types'
import { useBookActions } from './Library/hooks/useBookActions'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../hooks/useToast'

interface MyBooksResponse {
  books: UnifiedBook[]
  total: number
  status: string
}

interface BooksByStatus {
  reading: UnifiedBook[]
  want_to_read: UnifiedBook[]
  read: UnifiedBook[]
}

const STATUS_CONFIG = {
  reading: {
    icon: Clock,
    label: 'Currently Reading',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  want_to_read: {
    icon: Heart,
    label: 'Want to Read',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200'
  },
  read: {
    icon: BookCheck,
    label: 'Read',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  }
} as const

export default function MyBooks() {
  const { user } = useAuth()
  const { showToast, ToastContainer } = useToast()
  const { sendToKindle } = useBookActions()
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null)

  // Fetch books by each status
  const { data: readingBooks, isLoading: loadingReading } = useQuery({
    queryKey: ['myBooks', 'in_progress'],
    queryFn: async (): Promise<MyBooksResponse> => {
      return await apiRequest('/api/user/books/in_progress?limit=100')
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const { data: wantToReadBooks, isLoading: loadingWantToRead } = useQuery({
    queryKey: ['myBooks', 'want_to_read'],
    queryFn: async (): Promise<MyBooksResponse> => {
      return await apiRequest('/api/user/books/want_to_read?limit=100')
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  const { data: readBooks, isLoading: loadingRead } = useQuery({
    queryKey: ['myBooks', 'read'],
    queryFn: async (): Promise<MyBooksResponse> => {
      return await apiRequest('/api/user/books/read?limit=100')
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  const isLoading = loadingReading || loadingWantToRead || loadingRead

  // Organize books by status
  const booksByStatus: BooksByStatus = {
    reading: readingBooks?.books || [],
    want_to_read: wantToReadBooks?.books || [],
    read: readBooks?.books || []
  }

  // Handle book details modal
  const handleBookDetails = useCallback((book: UnifiedBook) => {
    // Cast to LibraryBook since books from our API should have all required properties
    setSelectedBook(book as LibraryBook)
  }, [])

  const handleCloseModal = useCallback(() => {
    setSelectedBook(null)
  }, [])

  // Handle send to Kindle
  const handleSendToKindle = useCallback(async (book: LibraryBook) => {
    try {
      const result = await sendToKindle(book)
      if (result.success) {
        showToast({ type: 'success', title: result.message || 'Book sent to Kindle successfully' })
      } else {
        showToast({ type: 'error', title: result.message || 'Failed to send book to Kindle' })
      }
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send book to Kindle'
      showToast({ type: 'error', title: message })
      return { success: false, message }
    }
  }, [sendToKindle, showToast])

  // Render books grid for a status
  const renderBooksGrid = (books: UnifiedBook[], status: keyof BooksByStatus) => {
    if (books.length === 0) {
      const config = STATUS_CONFIG[status]
      const Icon = config.icon
      
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className={cn("p-4 rounded-full mb-4", config.bgColor)}>
            <Icon className={cn("h-8 w-8", config.color)} />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No {config.label.toLowerCase()} books yet
          </h3>
          <p className="text-sm text-gray-500 max-w-sm">
            {status === 'reading' && "Books you're currently reading will appear here."}
            {status === 'want_to_read' && "Books you want to read will appear here."}
            {status === 'read' && "Books you've finished reading will appear here."}
          </p>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {books.map((book) => (
          <UnifiedBookCard
            key={book.id}
            book={book}
            cardType="library"
            viewMode="grid"
            onDetails={handleBookDetails}
            showReadStatus={true}
          />
        ))}
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Please log in to view your books
          </h3>
          <p className="text-sm text-gray-500">
            You need to be logged in to see your reading progress.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Books</h1>
        <p className="text-gray-600">
          Track your reading progress and organize your personal library
        </p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading your books...</span>
        </div>
      )}

      {/* Books Accordion */}
      {!isLoading && (
        <Accordion.Root
          type="multiple"
          defaultValue={['reading', 'want_to_read']}
          className="space-y-4"
        >
          {/* Currently Reading */}
          <Accordion.Item
            value="reading"
            className={cn(
              "border rounded-lg overflow-hidden",
              STATUS_CONFIG.reading.borderColor,
              STATUS_CONFIG.reading.bgColor
            )}
          >
            <Accordion.Header>
              <Accordion.Trigger className="flex items-center justify-between w-full px-6 py-4 text-left hover:bg-blue-100 transition-colors group">
                <div className="flex items-center space-x-3">
                  <Clock className={cn("h-5 w-5", STATUS_CONFIG.reading.color)} />
                  <span className="text-lg font-semibold text-gray-900">
                    Currently Reading
                  </span>
                  <span className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    "bg-blue-100 text-blue-800"
                  )}>
                    {booksByStatus.reading.length}
                  </span>
                </div>
                <ChevronDown className="h-5 w-5 text-gray-500 transition-transform group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="px-6 pb-6 bg-white">
              {renderBooksGrid(booksByStatus.reading, 'reading')}
            </Accordion.Content>
          </Accordion.Item>

          {/* Want to Read */}
          <Accordion.Item
            value="want_to_read"
            className={cn(
              "border rounded-lg overflow-hidden",
              STATUS_CONFIG.want_to_read.borderColor,
              STATUS_CONFIG.want_to_read.bgColor
            )}
          >
            <Accordion.Header>
              <Accordion.Trigger className="flex items-center justify-between w-full px-6 py-4 text-left hover:bg-pink-100 transition-colors group">
                <div className="flex items-center space-x-3">
                  <Heart className={cn("h-5 w-5", STATUS_CONFIG.want_to_read.color)} />
                  <span className="text-lg font-semibold text-gray-900">
                    Want to Read
                  </span>
                  <span className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    "bg-pink-100 text-pink-800"
                  )}>
                    {booksByStatus.want_to_read.length}
                  </span>
                </div>
                <ChevronDown className="h-5 w-5 text-gray-500 transition-transform group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="px-6 pb-6 bg-white">
              {renderBooksGrid(booksByStatus.want_to_read, 'want_to_read')}
            </Accordion.Content>
          </Accordion.Item>

          {/* Read */}
          <Accordion.Item
            value="read"
            className={cn(
              "border rounded-lg overflow-hidden",
              STATUS_CONFIG.read.borderColor,
              STATUS_CONFIG.read.bgColor
            )}
          >
            <Accordion.Header>
              <Accordion.Trigger className="flex items-center justify-between w-full px-6 py-4 text-left hover:bg-green-100 transition-colors group">
                <div className="flex items-center space-x-3">
                  <BookCheck className={cn("h-5 w-5", STATUS_CONFIG.read.color)} />
                  <span className="text-lg font-semibold text-gray-900">
                    Read
                  </span>
                  <span className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    "bg-green-100 text-green-800"
                  )}>
                    {booksByStatus.read.length}
                  </span>
                </div>
                <ChevronDown className="h-5 w-5 text-gray-500 transition-transform group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="px-6 pb-6 bg-white">
              {renderBooksGrid(booksByStatus.read, 'read')}
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      )}

      {/* Book Details Modal */}
      {selectedBook && (
        <LibraryBookModal
          book={selectedBook}
          onClose={handleCloseModal}
          onSendToKindle={handleSendToKindle}
        />
      )}
      
      {/* Toast Container */}
      <ToastContainer />
    </div>
  )
}
