import { useActivityTracker } from '../hooks/useActivityTracker'
import { useNavigationActivityTracker } from '../hooks/useNavigationActivityTracker'

/**
 * Component that enables global activity tracking
 * Must be rendered inside AuthProvider and Router contexts
 */
export function ActivityTracker() {
  useActivityTracker()
  useNavigationActivityTracker()
  return null // This component doesn't render anything
}
