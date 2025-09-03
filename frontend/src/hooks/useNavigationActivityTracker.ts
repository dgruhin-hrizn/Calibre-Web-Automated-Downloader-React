import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * Hook to track navigation changes as user activity
 */
export function useNavigationActivityTracker() {
  const location = useLocation()
  const { recordActivity, isAuthenticated } = useAuth()
  const lastLocationRef = useRef<string>('')

  useEffect(() => {
    if (!isAuthenticated) return
    
    const currentLocation = `${location.pathname}${location.search}`
    
    // Only record activity if location actually changed
    if (currentLocation !== lastLocationRef.current) {
      lastLocationRef.current = currentLocation
      recordActivity()
    }
  }, [location.pathname, location.search, isAuthenticated, recordActivity])
}
