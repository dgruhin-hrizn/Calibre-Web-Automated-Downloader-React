import { useState, useEffect } from 'react'
import { Send, Star, Check, X, Loader2, Calendar, FileText, Tag, Trash2, AlertTriangle, Edit } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Card, CardContent } from '../../../components/ui/card'
import { formatDate } from '../../../lib/utils'
import { useAuth } from '../../../contexts/AuthContext'
import { AuthorFormatter } from '../../../utils/authorFormatter'

import type { LibraryBook } from '../types'

// Utility function to check if a date is today
const isToday = (dateString?: string): boolean => {
  if (!dateString) return false
  
  const date = new Date(dateString)
  const today = new Date()
  
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear()
}

interface LibraryBookModalProps {
  book: LibraryBook
  onClose: () => void
  onSendToKindle: (book: LibraryBook) => Promise<{ success: boolean; message: string }>
  onBookDeleted?: () => void
  onEditMetadata?: (bookId: number) => void
}

export function LibraryBookModal({ book, onClose, onSendToKindle, onBookDeleted, onEditMetadata }: LibraryBookModalProps) {
  const coverUrl = book.has_cover ? `/api/metadata/books/${book.id}/cover` : null
  const isNewBook = isToday(book.timestamp)
  const [kindleState, setKindleState] = useState<'idle' | 'sending' | 'success' | 'failed'>('idle')
  const [imageError, setImageError] = useState(false)
  const [deleteState, setDeleteState] = useState<'idle' | 'deleting' | 'success' | 'failed'>('idle')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false)

  
  // Admin status check
  const { isAdmin } = useAuth()
  


  // Animation effects
  useEffect(() => {
    // Trigger entrance animation
    setIsVisible(true)
  }, [])

  // Delete confirmation animation effect
  useEffect(() => {
    if (showDeleteConfirm) {
      setDeleteConfirmVisible(true)
    }
  }, [showDeleteConfirm])

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      onClose()
    }, 200) // Match animation duration
  }

  const handleSendToKindle = async () => {
    if (kindleState !== 'idle') return
    
    setKindleState('sending')
    
    try {
      const result = await onSendToKindle(book)
      setKindleState(result.success ? 'success' : 'failed')
      
      // Reset button state after 3 seconds
      setTimeout(() => setKindleState('idle'), 3000)
    } catch (error) {
      setKindleState('failed')
      // Reset button state after 3 seconds
      setTimeout(() => setKindleState('idle'), 3000)
    }
  }

  const handleDeleteClick = () => {
    if (deleteState !== 'idle' || !isAdmin) return
    setShowDeleteConfirm(true)
  }

  const handleDeleteCancel = () => {
    setDeleteConfirmVisible(false)
    setTimeout(() => {
      setShowDeleteConfirm(false)
    }, 200)
  }

  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false)
    setDeleteState('deleting')
    
    // Close modal immediately to show animation
    handleClose()
    if (onBookDeleted) {
      onBookDeleted()
    }
    
    try {
      const response = await fetch(`/api/admin/books/${book.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (response.ok) {
        setDeleteState('success')
      } else {
        setDeleteState('failed')
        // Note: Modal is already closed, so user won't see this state
        // Could potentially show a toast notification here if needed
      }
    } catch (error) {
      console.error('Failed to delete book:', error)
      setDeleteState('failed')
      // Note: Modal is already closed, so user won't see this state
      // Could potentially show a toast notification here if needed
    }
  }







  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Use only library data (no external API calls needed)
  const data = {
    title: book.title,
    authors: book.authors,
    series: book.series,
    series_index: book.series_index,
    rating: book.rating,
    pubdate: book.pubdate,
    timestamp: book.timestamp,
    tags: book.tags,
    languages: book.languages,
    formats: book.formats,
    comments: book.comments,
    description: book.comments,
    averageRating: book.rating ? book.rating / 2 : 0, // Convert 10-point to 5-point scale
    publishedDate: book.pubdate ? formatDate(book.pubdate) : '',
    publisher: book.publishers?.[0] || '',
    language: book.languages?.[0] || '',
    last_modified: book.last_modified,
    isbn: book.isbn,
    uuid: book.uuid
  }
  
  // Skeleton component for loading states
  const Skeleton = ({ className = "", width = "w-full" }: { className?: string, width?: string }) => (
    <div className={`animate-pulse bg-muted rounded ${width} h-4 ${className}`} />
  )
  
  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black transition-opacity duration-200 ${
        isVisible && !isClosing ? 'bg-opacity-50' : 'bg-opacity-0'
      }`} 
      style={{ margin: 0 }}
      onClick={showDeleteConfirm ? undefined : handleClose}
    >
      <div 
        className={`bg-card border-0 sm:border border-border rounded-none sm:rounded-lg shadow-lg max-w-5xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col transition-all duration-200 ${
          isVisible && !isClosing 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 translate-y-4'
        }`} 
        style={{ margin: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <div className="flex-1 mr-3 min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground line-clamp-2 break-words">
              {data.title}
            </h2>
            {data.authors && data.authors.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                by {AuthorFormatter.formatForDisplay(data.authors.join(', '))}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="p-2 flex-shrink-0 -mt-1"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <div className="space-y-4 sm:space-y-6 min-w-0">
            {/* Main Book Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 min-w-0">
              {/* Cover */}
              <div className="w-full h-auto sm:h-64 lg:h-80 bg-muted rounded overflow-hidden flex-shrink-0 relative mx-auto max-w-full sm:max-w-xs lg:max-w-none">
                {coverUrl && !imageError ? (
                  <img 
                    src={coverUrl} 
                    alt={data.title}
                    className="w-full h-auto sm:h-full sm:object-cover object-contain max-h-[100vh] sm:max-h-none"
                    onError={() => setImageError(true)}
                    onLoad={() => setImageError(false)}
                  />
                ) : (
                  <div className="w-full h-48 sm:h-full flex flex-col items-center justify-center bg-muted p-4 text-center">
                    <img 
                      src="/droplet.png" 
                      alt="No cover available" 
                      className="w-16 h-16 mb-3 opacity-60"
                    />
                    <span className="text-sm text-muted-foreground font-medium">
                      No Available Cover
                    </span>
                  </div>
                )}
                {isNewBook && (
                  <div className="absolute top-3 right-3 bg-teal-700 text-white text-xs font-bold px-2 py-1 rounded shadow-lg">
                    NEW
                  </div>
                )}
              </div>

              {/* Book Details */}
              <div className="lg:col-span-3 space-y-4 sm:space-y-6">
                {/* Publication Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {/* Left Column - Publication Info */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" />
                      Publication Details
                    </h3>
                    
                    <div className="space-y-3 text-sm">
                      {/* Publisher - Google Books only */}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Publisher:</span>
                        {data.publisher ? (
                          <span className="text-foreground text-right">{data.publisher}</span>
                        ) : false ? (
                          <Skeleton width="w-24" />
                        ) : (
                          <span className="text-muted-foreground text-right">Unknown</span>
                        )}
                      </div>
                      
                      {/* Published Date - Library first, then Google Books */}
                      {(data.publishedDate || false) && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Published:</span>
                          {data.publishedDate ? (
                            <span className="text-foreground">{data.publishedDate}</span>
                          ) : false ? (
                            <Skeleton width="w-20" />
                          ) : null}
                        </div>
                      )}
                      
                      {/* Language - Library first */}
                      {data.language && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Language:</span>
                          <span className="text-foreground capitalize">{data.language}</span>
                        </div>
                      )}
                      
                      {/* Page Count - Not available in library data */}

                      {/* Series - Library only */}
                      {data.series && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Series:</span>
                          <span className="text-foreground text-right">
                            {data.series} {data.series_index && `#${data.series_index}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column - File Info */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      File Details
                    </h3>
                    
                    <div className="space-y-3 text-sm">
                      {data.formats && data.formats.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Formats:</span>
                            <span className="text-foreground uppercase">{data.formats.join(', ')}</span>
                          </div>
                          {/* File sizes for each format */}
                          {book.file_sizes && Object.keys(book.file_sizes).length > 0 && (
                            <div className="space-y-1 pl-4 border-l-2 border-muted">
                              {Object.entries(book.file_sizes).map(([format, size]) => (
                                <div key={format} className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">{format}:</span>
                                  <span className="text-foreground">{formatFileSize(size)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Rating - Library only */}
                      {data.averageRating > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Rating:</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((starIndex) => {
                              const rating = data.averageRating || 0
                              const isFilled = rating >= starIndex
                              const isHalfFilled = rating >= starIndex - 0.5 && rating < starIndex
                              
                              return (
                                <Star
                                  key={starIndex}
                                  className={`w-4 h-4 ${
                                    isFilled
                                      ? 'fill-yellow-400 text-yellow-400'
                                      : isHalfFilled
                                      ? 'fill-yellow-200 text-yellow-400'
                                      : 'fill-muted-foreground text-muted-foreground'
                                  }`}
                                />
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {data.timestamp && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Added:</span>
                          <span className="text-foreground">{formatDate(data.timestamp)}</span>
                        </div>
                      )}
                      
                      {/* Last Modified - Library only */}
                      {data.last_modified && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Modified:</span>
                          <span className="text-foreground">{formatDate(data.last_modified)}</span>
                        </div>
                      )}
                      
                      {/* ISBN - Library only */}
                      {data.isbn && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ISBN:</span>
                          <span className="text-foreground font-mono text-xs">{data.isbn}</span>
                        </div>
                      )}
                      
                      {/* UUID - Library only */}
                      {data.uuid && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">UUID:</span>
                          <span className="text-foreground font-mono text-xs">{data.uuid.slice(0, 8)}...</span>
                        </div>
                      )}
                    </div>

                    {/* Tags - Library only */}
                    {data.tags && data.tags.length > 0 && (
                      <div className="space-y-2 pt-3 border-t border-border/50">
                        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                          <Tag className="w-4 h-4 text-primary" />
                          Tags
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {data.tags.map((tag: string, index: number) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* External Links - Not available in library data */}
                  </div>
                </div>


              </div>
            </div>

            {/* Description - Library only */}
            {data.description && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Description
                </h3>
                <div className="border border-border rounded-lg p-3 sm:p-4 bg-muted/20 overflow-hidden">
                  <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed break-words overflow-wrap-anywhere">
                    <div 
                      className="[&>p]:mb-3 [&>p:last-child]:mb-0 [&>br]:block [&>br]:mb-2 [&>b]:font-semibold [&>strong]:font-semibold [&>i]:italic [&>em]:italic [&>u]:underline [&>*]:break-words [&>*]:overflow-wrap-anywhere [&>*]:max-w-full"
                      dangerouslySetInnerHTML={{ __html: data.description }} 
                    />
                  </div>
                </div>
              </div>
            )}


          </div>
        </div>
        
        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border p-4 sm:p-6">
          <div className="flex sm:justify-between items-center gap-2 sm:gap-3">
            {/* All buttons in single row on mobile, desktop layout preserved */}
            <div className="flex gap-2 sm:gap-3 flex-1 sm:flex-none">
              {isAdmin && (
                <Button
                  onClick={handleDeleteClick}
                  disabled={deleteState !== 'idle'}
                  variant="destructive"
                  size="sm"
                  className={`px-2 sm:px-6 flex-1 sm:flex-none ${
                    deleteState === 'success' ? 'bg-green-600 hover:bg-green-700' :
                    deleteState === 'failed' ? 'bg-red-700 hover:bg-red-800' :
                    ''
                  }`}
                >
                  {deleteState === 'deleting' && (
                    <>
                      <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                      <span className="hidden sm:inline">Deleting...</span>
                      <span className="sm:hidden text-xs">Del...</span>
                    </>
                  )}
                  {deleteState === 'success' && (
                    <>
                      <Check className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Deleted</span>
                      <span className="sm:hidden text-xs">Done</span>
                    </>
                  )}
                  {deleteState === 'failed' && (
                    <>
                      <X className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Delete Failed</span>
                      <span className="sm:hidden text-xs">Error</span>
                    </>
                  )}
                  {deleteState === 'idle' && (
                    <>
                      <Trash2 className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Delete Book</span>
                      <span className="sm:hidden text-xs">Delete</span>
                    </>
                  )}
                </Button>
              )}
              
              {/* Edit Metadata Button */}
              <Button
                onClick={() => onEditMetadata?.(book.id)}
                variant="outline"
                size="sm"
                className="px-2 sm:px-6 flex-1 sm:flex-none"
              >
                <Edit className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Edit Metadata</span>
                <span className="sm:hidden text-xs">Edit</span>
              </Button>
            </div>
            
            {/* Send to e-Reader Button */}
            <Button
              onClick={handleSendToKindle}
              disabled={kindleState !== 'idle'}
              size="sm"
              className={`px-2 sm:px-8 flex-1 sm:flex-none ${
                kindleState === 'success' ? 'bg-green-600 hover:bg-green-700 text-white' :
                kindleState === 'failed' ? 'bg-red-600 hover:bg-red-700 text-white' :
                ''
              }`}
            >
              {kindleState === 'sending' && (
                <>
                  <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                  <span className="hidden sm:inline">Sending...</span>
                  <span className="sm:hidden text-xs">Send...</span>
                </>
              )}
              {kindleState === 'success' && (
                <>
                  <Check className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sent to e-Reader</span>
                  <span className="sm:hidden text-xs">Sent</span>
                </>
              )}
              {kindleState === 'failed' && (
                <>
                  <X className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Send Failed</span>
                  <span className="sm:hidden text-xs">Failed</span>
                </>
              )}
              {kindleState === 'idle' && (
                <>
                  <Send className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Send to e-Reader</span>
                  <span className="sm:hidden text-xs">Send</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            className={`absolute inset-0 bg-black transition-opacity duration-200 ${
              deleteConfirmVisible ? 'bg-opacity-50' : 'bg-opacity-0'
            }`} 
            onClick={handleDeleteCancel} 
          />
          <Card 
            className={`relative w-full max-w-sm sm:max-w-md mx-4 z-10 transition-all duration-200 ${
              deleteConfirmVisible 
                ? 'opacity-100 scale-100 translate-y-0' 
                : 'opacity-0 scale-95 translate-y-4'
            }`}
          >
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-destructive/10 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-semibold text-foreground">Delete Book</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">This action cannot be undone</p>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Are you sure you want to delete <strong className="break-words">"{book.title}"</strong>
                {book.authors && <span> by {AuthorFormatter.formatForDisplay(book.authors.join(', '))}</span>}? 
                This will permanently remove the book from your library.
              </p>
              
              <div className="flex flex-col sm:flex-row justify-end gap-3">
                <Button
                  onClick={handleDeleteCancel}
                  variant="outline"
                  size="sm"
                  className="order-2 sm:order-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteConfirm}
                  variant="destructive"
                  size="sm"
                  className="px-4 order-1 sm:order-2"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Book
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  )
}
