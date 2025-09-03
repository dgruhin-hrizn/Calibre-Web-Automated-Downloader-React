import { useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'

/**
 * Hook to track user activity and automatically extend session
 * Records activity on:
 * - Mouse movements
 * - Keyboard events
 * - Touch events
 * - Page visibility changes
 * - Route changes (via navigation)
 */
export function useActivityTracker() {
  const { recordActivity, isAuthenticated } = useAuth()
  const lastRecordedRef = useRef<number>(0)

  const handleActivity = useCallback(() => {
    if (!isAuthenticated) return
    
    const now = Date.now()
    const THROTTLE_DELAY = 30 * 1000 // 30 seconds
    
    // Throttle at the hook level as well to prevent excessive calls
    if (now - lastRecordedRef.current >= THROTTLE_DELAY) {
      lastRecordedRef.current = now
      recordActivity()
    }
  }, [recordActivity, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return

    // Mouse and keyboard events
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ]

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true)
    })

    // Page visibility changes (user switching tabs/windows)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        handleActivity() // User returned to tab
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated, handleActivity])

  return { recordActivity: handleActivity }
}
