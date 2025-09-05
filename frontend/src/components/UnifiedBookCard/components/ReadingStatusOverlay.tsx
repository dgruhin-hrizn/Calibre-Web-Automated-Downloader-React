import { CircleCheckBig, Clock, Heart } from 'lucide-react'
import { type ReadStatus } from '../../ReadStatusDropdown'
import { type ReadStatus as HookReadStatus } from '../../../hooks/useReadStatus'
import { convertHookStatusToDropdownStatus } from '../utils'

interface ReadingStatusOverlayProps {
  bookReadStatus?: ReadStatus
  hookReadStatus?: HookReadStatus
}

export function ReadingStatusOverlay({ bookReadStatus, hookReadStatus }: ReadingStatusOverlayProps) {
  const convertedStatus = convertHookStatusToDropdownStatus(hookReadStatus)
  
  // Check read status from either source
  const isRead = bookReadStatus?.is_read || convertedStatus?.is_read
  const isInProgress = bookReadStatus?.is_in_progress || convertedStatus?.is_in_progress
  const isWantToRead = bookReadStatus?.is_want_to_read || convertedStatus?.is_want_to_read
  
  if (isRead) {
    // Consistent style overlay for completed books
    return (
      <div className="absolute inset-0 bg-black/10">
        <div className="absolute top-2 right-2 bg-green-600/40 backdrop-blur-sm rounded-full p-2 border-2 border-green-600/60">
          <CircleCheckBig className="h-6 w-6 text-white" />
        </div>
      </div>
    )
  }
  
  if (isInProgress) {
    // Subtle overlay with transparent background for books in progress
    return (
      <div className="absolute inset-0 bg-black/10">
        <div className="absolute top-2 right-2 bg-blue-600/40 backdrop-blur-sm rounded-full p-2 border-2 border-blue-600/60">
          <Clock className="h-6 w-6 text-white" />
        </div>
      </div>
    )
  }
  
  if (isWantToRead) {
    // Subtle overlay with transparent background for want-to-read books
    return (
      <div className="absolute inset-0 bg-black/10">
        <div className="absolute top-2 right-2 bg-pink-600/40 backdrop-blur-sm rounded-full p-2 border-2 border-pink-600/60">
          <Heart className="h-6 w-6 text-white" />
        </div>
      </div>
    )
  }
  
  return null
}
