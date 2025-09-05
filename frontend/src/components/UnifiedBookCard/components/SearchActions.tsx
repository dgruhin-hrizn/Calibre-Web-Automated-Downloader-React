import { Download } from 'lucide-react'
import { Button } from '../../ui/Button'
import { CircularProgress } from '../../ui/CircularProgress'
import { type UnifiedBook, type DownloadStatus } from '../types'

interface SearchActionsProps {
  book: UnifiedBook
  downloadStatus?: DownloadStatus
  isPending: boolean
  onDownload?: (book: UnifiedBook) => void
}

export function SearchActions({ book, downloadStatus, isPending, onDownload }: SearchActionsProps) {
  if (!onDownload) return null
  
  // Determine if we have meaningful progress or backend is actually working
  const hasRealProgress = downloadStatus && (
    downloadStatus.progress > 0 || // Has actual progress
    downloadStatus.status === 'completed' || // Completed
    downloadStatus.status === 'error' || // Failed
    downloadStatus.status === 'processing' || // Backend processing
    downloadStatus.status === 'waiting' // Backend waiting
  )
  
  // Show pending if locally pending OR if we have 0% downloading (which is really pending)
  const showPending = isPending || (
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
  if (showPending) {
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
      <Download className="w-4 h-4 mr-1" />
      Download
    </Button>
  )
}
