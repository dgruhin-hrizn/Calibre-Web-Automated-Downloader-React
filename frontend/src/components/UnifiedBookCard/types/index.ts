import { type ReadStatus } from '../../ReadStatusDropdown'

// Common book interface that works for both search and library books
export interface UnifiedBook {
  id: string | number
  title: string
  author?: string  // Search books have single author string
  authors?: string[]  // Library books have authors array
  preview?: string  // Search book cover URL
  has_cover?: boolean  // Library book cover flag
  format?: string  // Search book format
  formats?: string[]  // Library book formats array
  size?: string  // Search book size
  rating?: number  // Library book rating
  tags?: string[]  // Library book tags
  series?: string  // Library book series
  series_index?: number  // Library book series index
  // Additional library book properties
  languages?: string[]
  path?: string
  pubdate?: string
  timestamp?: string
  comments?: string
  // Hot books properties
  download_count?: number
  popularity_rank?: number
  // Read status properties (from API)
  read_status?: ReadStatus
}

export interface DownloadStatus {
  progress: number
  status: 'idle' | 'downloading' | 'completed' | 'error' | 'processing' | 'waiting'
}

export interface UnifiedBookCardProps {
  book: UnifiedBook
  cardType?: 'search' | 'library'  // Make optional for backward compatibility
  viewMode?: 'grid' | 'list'  // Only used for library cards
  
  // Search-specific props
  downloadStatus?: DownloadStatus
  isPending?: boolean
  onDownload?: (book: UnifiedBook) => void
  
  // Library-specific props  
  shouldLoadImage?: (bookId: string | number) => boolean
  onImageLoaded?: (bookId: string | number) => void
  onDetails?: (book: UnifiedBook) => void
  onSendToKindle?: (book: UnifiedBook) => void | Promise<{ success: boolean; message: string }>
  
  // Button visibility controls
  showDownloadButton?: boolean
  showKindleButton?: boolean
  showHotIndicator?: boolean  // Show hot book indicators
  showReadStatus?: boolean  // Show read status dropdown for library books
}
