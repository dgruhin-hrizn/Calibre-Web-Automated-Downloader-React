import { Button } from '../../../components/ui/Button'
import { Card, CardContent } from '../../../components/ui/card'
import { CachedImage } from '../../../components/ui/CachedImage'
import { Badge } from '../../../components/ui/badge'
import { Star, Send, Eye, Book } from 'lucide-react'
import { AuthorFormatter } from '../../../utils/authorFormatter'
import { formatDate } from '../../../lib/utils'
import type { LibraryBook } from '../types'

interface LibraryListViewProps {
  books: LibraryBook[]
  onBookClick: (book: LibraryBook) => void
  onSendToKindle: (book: LibraryBook) => void
  deletingBooks?: Set<number>
  registerBookRef?: (bookId: number, element: HTMLElement | null) => void
}

export function LibraryListView({
  books,
  onBookClick,
  onSendToKindle,
  deletingBooks = new Set(),
  registerBookRef
}: LibraryListViewProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 w-16">
                  Cover
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                  Title & Author
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                  Series
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                  Rating
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                  Formats
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                  Date Added
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {books.map((book) => {
                const isDeleting = deletingBooks.has(book.id)
                return (
                  <tr 
                    key={book.id}
                    data-book-id={book.id}
                    ref={(el) => registerBookRef?.(book.id, el)}
                    className={`border-b border-border transition-all duration-300 hover:bg-muted/30 ${
                      isDeleting 
                        ? 'opacity-50 bg-red-50' 
                        : 'opacity-100'
                    }`}
                    style={{
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      scrollMarginTop: '200px' // Account for toolbar height when scrolling
                    }}
                  >
                    {/* Cover */}
                    <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                      <div className="w-12 h-16 rounded-md overflow-hidden bg-muted flex items-center justify-center relative">
                        {book.has_cover && (
                          <CachedImage
                            src={`/api/metadata/books/${book.id}/cover`}
                            alt={book.title}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <Book className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </td>

                    {/* Title & Author */}
                    <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                      <div className="space-y-1">
                        <button
                          onClick={() => onBookClick(book)}
                          className="font-medium hover:underline text-left line-clamp-2 leading-tight"
                        >
                          {book.title}
                        </button>
                        {book.authors && book.authors.length > 0 && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {AuthorFormatter.formatForDisplay(book.authors.join(', '))}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Series */}
                    <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                      {book.series && (
                        <div className="text-sm">
                          <p className="font-medium line-clamp-1">{book.series}</p>
                          {book.series_index && (
                            <p className="text-xs text-muted-foreground">
                              Book {book.series_index}
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Rating */}
                    <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((starIndex) => {
                          const rating = book.rating ? book.rating / 2 : 0 // Convert from 0-10 to 0-5 scale
                          const isFilled = rating >= starIndex
                          const isHalfFilled = rating >= starIndex - 0.5 && rating < starIndex
                          
                          return (
                            <Star
                              key={starIndex}
                              className={`w-3 h-3 ${
                                isFilled
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : isHalfFilled
                                  ? 'fill-yellow-200 text-yellow-400'
                                  : 'fill-gray-200 text-gray-200'
                              }`}
                            />
                          )
                        })}
                      </div>
                    </td>

                    {/* Formats */}
                    <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                      <div className="flex flex-wrap gap-1">
                        {book.formats?.slice(0, 3).map((format) => (
                          <Badge key={format} variant="secondary" className="text-xs">
                            {format}
                          </Badge>
                        ))}
                        {book.formats && book.formats.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{book.formats.length - 3}
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Date Added */}
                    <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                      {book.timestamp && (
                        <div className="text-sm text-muted-foreground">
                          {formatDate(book.timestamp)}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onBookClick(book)}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSendToKindle(book)}
                          className="h-8 w-8 p-0"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
