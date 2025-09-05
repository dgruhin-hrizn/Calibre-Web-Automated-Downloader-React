import { type ReadStatus } from '../../ReadStatusDropdown'
import { type ReadStatus as HookReadStatus } from '../../../hooks/useReadStatus'

// Utility function to check if a date is today
export const isToday = (dateString?: string): boolean => {
  if (!dateString) return false
  
  const date = new Date(dateString)
  const today = new Date()
  
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear()
}

// Helper function to convert hook ReadStatus to dropdown ReadStatus
export const convertHookStatusToDropdownStatus = (hookStatus: HookReadStatus | undefined): ReadStatus | undefined => {
  if (!hookStatus) return undefined
  
  return {
    is_read: hookStatus.is_read,
    is_in_progress: hookStatus.is_in_progress,
    is_want_to_read: hookStatus.is_want_to_read,
    status_code: hookStatus.read_status, // Map read_status to status_code
    last_modified: hookStatus.last_modified,
    times_started_reading: hookStatus.times_started_reading
  }
}

// Helper function to get the appropriate blur class based on status
export const getBlurEffectClass = (bookReadStatus: ReadStatus | undefined, hookReadStatus: HookReadStatus | undefined): string => {
  const convertedStatus = convertHookStatusToDropdownStatus(hookReadStatus)
  
  const isRead = bookReadStatus?.is_read || convertedStatus?.is_read
  const isInProgress = bookReadStatus?.is_in_progress || convertedStatus?.is_in_progress
  
  if (isRead) {
    return 'grayscale blur-[1px]' // Grayscale with light blur for completed books
  } else if (isInProgress) {
    return 'blur-[1px]' // Light blur for books in progress
  }
  
  return ''
}
