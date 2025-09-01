import React from 'react'
import { Download, Book, Send, Star } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Badge } from '../../../components/ui/badge'
import { formatDate } from '../../../lib/utils'
import type { LibraryBook } from '../types'

interface BookDetailsModalProps {
  book: LibraryBook
  onClose: () => void
  onDownload: (book: LibraryBook, format?: string) => void
  onSendToKindle: (book: LibraryBook) => void
}

export function BookDetailsModal({ book, onClose, onDownload, onSendToKindle }: BookDetailsModalProps) {
  const coverUrl = book.has_cover ? `/api/cwa/library/books/${book.id}/cover` : null
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="text-xl">{book.title}</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="flex gap-6">
            {/* Cover */}
            <div className="w-32 h-48 bg-muted rounded overflow-hidden flex-shrink-0">
              {coverUrl ? (
                <img 
                  src={coverUrl} 
                  alt={book.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Book className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
            </div>
            
            {/* Details */}
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="font-medium text-lg">{book.title}</h3>
                <p className="text-muted-foreground">{book.authors.join(', ')}</p>
              </div>
              
              {book.series && (
                <div>
                  <span className="text-sm font-medium">Series: </span>
                  <span className="text-sm">{book.series} #{book.series_index}</span>
                </div>
              )}
              
              {book.pubdate && (
                <div>
                  <span className="text-sm font-medium">Published: </span>
                  <span className="text-sm">{formatDate(book.pubdate)}</span>
                </div>
              )}
              
              {book.rating && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Rating: </span>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < Math.floor(book.rating! / 2) 
                            ? 'text-yellow-400 fill-current' 
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Tags */}
              {book.tags.length > 0 && (
                <div>
                  <span className="text-sm font-medium">Tags: </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {book.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Download and Send Actions */}
              {book.formats.length > 0 ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-sm font-medium">Download: </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDownload(book)}
                      className="ml-2"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Best Format
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      Automatically selects the best available format
                    </p>
                  </div>
                  
                  <div>
                    <Button
                      onClick={() => onSendToKindle(book)}
                      className="w-full sm:w-auto"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send to Kindle
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      Automatically converts to best Kindle format and emails to your device
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Loading available formats...</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Description */}
          {book.comments && (
            <div>
              <h4 className="font-medium mb-2">Description</h4>
              <div 
                className="text-sm text-muted-foreground prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: book.comments }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
