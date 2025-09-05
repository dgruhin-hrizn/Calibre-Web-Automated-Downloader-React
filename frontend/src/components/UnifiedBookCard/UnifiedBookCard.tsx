import { useState, useCallback } from 'react'
import { Card, CardContent } from '../ui/card'
import { HotBookIndicator } from '../HotBookIndicator'
import { ReadStatusDropdown, type ReadStatus } from '../ReadStatusDropdown'
import { useReadStatus, type ReadStatus as HookReadStatus } from '../../hooks/useReadStatus'
import { BookCover, BookInfo, SearchActions, LibraryActions } from './components'
import { type UnifiedBookCardProps } from './types'
import { convertHookStatusToDropdownStatus } from './utils'

export function UnifiedBookCard({
  book,
  cardType = 'library',
  viewMode = 'grid',
  downloadStatus,
  isPending = false,
  onDownload,
  shouldLoadImage,
  onImageLoaded,
  onDetails,
  onSendToKindle,
  showKindleButton = true,
  showHotIndicator = false,
  showReadStatus = false,
}: UnifiedBookCardProps) {
  
  // State for send-to-kindle button
  const [kindleState, setKindleState] = useState<'idle' | 'sending' | 'success' | 'failed'>('idle')
  
  // Read status hook (for library books - used both for display and auto-updating on Kindle send)
  const { readStatus, updateStatus } = useReadStatus(
    cardType === 'library' ? book.id : undefined
  )

  // Wrapper function to match ReadStatusDropdown's expected signature
  const handleStatusChange = useCallback(async (_bookId: string | number, action: 'toggle' | 'mark_read' | 'mark_unread' | 'mark_in_progress' | 'mark_want_to_read') => {
    if (updateStatus) {
      await updateStatus(action)
    }
  }, [updateStatus])
  
  // Handle send to kindle with UI feedback
  const handleSendToKindle = useCallback(async (book: UnifiedBookCardProps['book']) => {
    if (!onSendToKindle || kindleState !== 'idle') return
    
    setKindleState('sending')
    
    try {
      const result = await onSendToKindle(book)
      
      // Check if onSendToKindle returns a result object with success/failure
      const wasSuccessful = typeof result === 'object' && result !== null && 'success' in result 
        ? result.success 
        : true // Assume success if no result object is returned
      
      setKindleState(wasSuccessful ? 'success' : 'failed')
      
      // If successful and we have read status functionality, mark as "Want To Read"
      if (wasSuccessful && updateStatus && cardType === 'library') {
        try {
          await updateStatus('mark_want_to_read')
        } catch (statusError) {
          // Don't fail the whole operation if read status update fails
          console.warn('Failed to update read status after sending to Kindle:', statusError)
        }
      }
      
      // Reset button state after 3 seconds
      setTimeout(() => setKindleState('idle'), 3000)
    } catch (error) {
      setKindleState('failed')
      // Reset button state after 3 seconds
      setTimeout(() => setKindleState('idle'), 3000)
    }
  }, [onSendToKindle, kindleState, updateStatus, cardType])
  
  // Determine cover URL based on book type
  const getCoverUrl = () => {
    if (cardType === 'search') {
      return book.preview
    } else {
      // For library books, use preview URL if available (e.g., from OPDS), otherwise construct URL
      if (book.preview) {
        return book.preview
      }
      return book.has_cover ? `/api/metadata/books/${book.id}/cover` : null
    }
  }
  
  const coverUrl = getCoverUrl()
  const canLoadImage = cardType === 'search' || !shouldLoadImage || shouldLoadImage(book.id)
  
  // Render for library list view
  if (cardType === 'library' && viewMode === 'list') {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex gap-4">
            {/* Cover */}
            <div className="w-16 h-24 flex-shrink-0">
              <BookCover
                book={book}
                cardType={cardType}
                aspectClass="w-full h-full rounded"
                coverUrl={coverUrl}
                canLoadImage={canLoadImage}
                bookReadStatus={book.read_status}
                hookReadStatus={readStatus}
                onImageLoaded={onImageLoaded}
                onDetails={onDetails}
              />
            </div>
            
            {/* Info */}
            <BookInfo book={book} cardType={cardType} viewMode={viewMode} />
            
            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {showHotIndicator && (
                  <HotBookIndicator 
                    downloadCount={book.download_count}
                    popularityRank={book.popularity_rank}
                    viewMode="list"
                  />
                )}
                <LibraryActions
                  book={book}
                  viewMode={viewMode}
                  kindleState={kindleState}
                  showKindleButton={showKindleButton}
                  onDetails={onDetails}
                  onSendToKindle={handleSendToKindle}
                />
              </div>
              {showReadStatus && (
                <ReadStatusDropdown
                  bookId={book.id}
                  readStatus={book.read_status || convertHookStatusToDropdownStatus(readStatus)}
                  onStatusChange={handleStatusChange}
                  size="sm"
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  // Render for grid view (both search and library)
  return (
    <Card className="hover:shadow-lg transition-shadow relative">
      <CardContent className="p-0">
        {/* Hot Indicator Overlay */}
        {showHotIndicator && (
          <HotBookIndicator 
            downloadCount={book.download_count}
            popularityRank={book.popularity_rank}
            viewMode="grid"
          />
        )}
        
        {/* Cover */}
        <BookCover
          book={book}
          cardType={cardType}
          aspectClass="aspect-[2/3] rounded-t-lg"
          coverUrl={coverUrl}
          canLoadImage={canLoadImage}
          bookReadStatus={book.read_status}
          hookReadStatus={readStatus}
          onImageLoaded={onImageLoaded}
          onDetails={onDetails}
        />
        
        {/* Info and Actions */}
        <BookInfo book={book} cardType={cardType} viewMode={viewMode} />
        
        {/* Actions */}
        <div className="px-3 pb-3">
          <div className="flex items-center justify-between gap-1">
            <div className="flex gap-1 flex-1">
              {cardType === 'search' ? (
                <SearchActions
                  book={book}
                  downloadStatus={downloadStatus}
                  isPending={isPending}
                  onDownload={onDownload}
                />
              ) : (
                <LibraryActions
                  book={book}
                  viewMode={viewMode}
                  kindleState={kindleState}
                  showKindleButton={showKindleButton}
                  onDetails={onDetails}
                  onSendToKindle={handleSendToKindle}
                />
              )}
            </div>
            {showReadStatus && cardType === 'library' && (
              <ReadStatusDropdown
                bookId={book.id}
                readStatus={book.read_status || convertHookStatusToDropdownStatus(readStatus)}
                onStatusChange={handleStatusChange}
                size="sm"
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
