import { Download, Eye } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { CircularProgress } from '../../../components/ui/CircularProgress'
import { AuthorFormatter } from '../../../utils/authorFormatter'
import { type Book } from '../../../hooks/useDownloads'

interface BookCardProps {
  book: Book
  downloads: any
  pendingDownloads: Set<string>
  onDownload: (book: Book) => void
  onDetails: (book: Book) => void
}

export function BookCard({ book, downloads, pendingDownloads, onDownload, onDetails }: BookCardProps) {
  // Library checking removed - using CWA proxy approach instead
  const downloadStatus = downloads[book.id]
  const isThisBookPending = pendingDownloads.has(book.id)

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden hover:shadow-lg transition-shadow">
      <div className="flex flex-col h-full">
        {/* Book Cover - Fixed aspect ratio for book covers (2:3 ratio) */}
        <div className="relative aspect-[2/3] bg-muted">
          {book.preview ? (
            <img 
              src={book.preview} 
              alt={`${book.title} cover`}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <div class="absolute inset-0 flex items-center justify-center">
                      <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                      </svg>
                    </div>

                  `;
                }
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
              </svg>
            </div>
          )}
          
          {/* Library indicator removed - using CWA proxy approach instead */}
        </div>
        
        {/* Book Info */}
        <div className="p-3 flex-1 flex flex-col">
          <div className="flex-1 space-y-2">
            <h3 className="font-medium text-sm leading-tight line-clamp-2 text-foreground" title={book.title}>
              {book.title}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-1" title={AuthorFormatter.formatForDisplay(book.author) || 'Unknown Author'}>
              by {AuthorFormatter.formatForDisplay(book.author) || 'Unknown Author'}
            </p>
            
            {/* Metadata */}
            <div className="flex flex-wrap gap-1">
              {book.format && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded font-medium">
                  {book.format.toUpperCase()}
                </span>
              )}
              {book.language && (
                <span className="px-1.5 py-0.5 bg-secondary text-secondary-foreground text-xs rounded">
                  {book.language.toUpperCase()}
                </span>
              )}
              {book.year && (
                <span className="px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded">
                  {book.year}
                </span>
              )}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex flex-col gap-1.5 mt-3">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs h-7"
              onClick={() => onDetails(book)}
            >
              <Eye className="w-3 h-3 mr-1" />
              Details
            </Button>
            
            {/* Download Button with Queue State Sync */}
            {(() => {
              // Determine if we have meaningful progress or backend is actually working
              const hasRealProgress = downloadStatus && (
                downloadStatus.progress > 0 || // Has actual progress
                downloadStatus.status === 'completed' || // Completed
                downloadStatus.status === 'error' || // Failed
                downloadStatus.status === 'processing' || // Backend processing
                downloadStatus.status === 'waiting' // Backend waiting
              )
              
              // Show pending if locally pending OR if we have 0% downloading (which is really pending)
              const isPending = isThisBookPending || (
                downloadStatus && 
                downloadStatus.status === 'downloading' && 
                (downloadStatus.progress || 0) === 0
              )
              
              if (hasRealProgress) {
                // Show actual queue status with progress
                return (
                  <div className="flex items-center justify-center h-7 px-3 text-xs border border-border rounded-md bg-background">
                    <CircularProgress
                      progress={downloadStatus.progress}
                      status={downloadStatus.status}
                      size={16}
                      showPercentage={downloadStatus.status === 'downloading' && downloadStatus.progress > 0}
                      showText={true}
                    />
                  </div>
                )
              }
              
              // Show download button or pending state
              if (isPending) {
                return (
                  <div className="flex items-center justify-center h-7 px-3 text-xs border border-border rounded-md bg-background">
                    <div className="relative" style={{ width: 16, height: 16 }}>
                      <svg
                        className="animate-spin text-primary"
                        width={16}
                        height={16}
                        viewBox="0 0 16 16"
                      >
                        <circle
                          cx={8}
                          cy={8}
                          r={6}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          className="opacity-25"
                        />
                        <circle
                          cx={8}
                          cy={8}
                          r={6}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeDasharray={37.7}
                          strokeDashoffset={28.3}
                        />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-primary ml-2">Queuing...</span>
                  </div>
                )
              }
              
              return (
                <Button 
                  size="sm" 
                  className="text-xs h-7"
                  onClick={() => onDownload(book)}
                  disabled={false}
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </Button>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
