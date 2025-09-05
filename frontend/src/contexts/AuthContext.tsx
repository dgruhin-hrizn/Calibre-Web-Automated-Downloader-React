import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'

// Dynamic API URL detection for local network access
const getApiBaseUrl = () => {
  if (import.meta.env.PROD) {
    return '' // Production: same origin
  }
  
  // Development: detect if we're accessing from local network
  const currentHost = window.location.hostname
  
  if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
    return 'http://localhost:8084'
  }
  
  // If accessing from local network IP, use that IP for API calls
  if (currentHost.match(/^192\.168\.\d+\.\d+$/) || 
      currentHost.match(/^10\.\d+\.\d+\.\d+$/) || 
      currentHost.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/)) {
    return `http://${currentHost}:8084`
  }
  
  // Fallback to localhost
  return 'http://localhost:8084'
}

const API_BASE_URL = getApiBaseUrl()

interface CachedUserInfo {
  authenticated: boolean
  username: string
  is_admin: boolean
  timestamp: number
  expires: number
}

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  isAdmin: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: (onLogout?: () => void) => void
  refreshUserInfo: () => Promise<void>
  recordActivity: () => void
  user?: { username: string }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

// Cache duration: 10 minutes (for user info caching)
const CACHE_DURATION = 10 * 60 * 1000
// Inactivity timeout: 30 minutes
const INACTIVITY_TIMEOUT = 30 * 60 * 1000

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<{ username: string } | undefined>(undefined)
  const [lastActivity, setLastActivity] = useState<number>(Date.now())
  
  // Use refs to prevent stale closures and avoid dependency issues
  const lastActivityRef = useRef<number>(Date.now())
  const isRefreshingRef = useRef<boolean>(false)

  // Fetch fresh user info from the server
  const fetchUserInfo = async (): Promise<CachedUserInfo | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/user-info`, {
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.authenticated) {
          const now = Date.now()
          const cachedInfo: CachedUserInfo = {
            authenticated: data.authenticated,
            username: data.username,
            is_admin: data.is_admin === true,
            timestamp: now,
            expires: now + CACHE_DURATION,
          }
          
          // Cache the user info
          localStorage.setItem('cwa_user_info', JSON.stringify(cachedInfo))
          return cachedInfo
        }
      }
      
      return null
    } catch (error) {
      console.error('Failed to fetch user info:', error)
      return null
    }
  }

  // Get cached user info if still valid
  const getCachedUserInfo = (): CachedUserInfo | null => {
    try {
      const cached = localStorage.getItem('cwa_user_info')
      if (!cached) return null
      
      const userInfo: CachedUserInfo = JSON.parse(cached)
      const now = Date.now()
      
      // Check if cache is still valid
      if (now < userInfo.expires) {
        return userInfo
      }
      
      // Cache expired, remove it
      localStorage.removeItem('cwa_user_info')
      return null
    } catch (error) {
      // Invalid cache data, remove it
      localStorage.removeItem('cwa_user_info')
      return null
    }
  }

  // Update auth state from user info
  const updateAuthState = (userInfo: CachedUserInfo | null) => {
    if (userInfo && userInfo.authenticated) {
      setIsAuthenticated(true)
      setIsAdmin(userInfo.is_admin)
      setUser({ username: userInfo.username })
      
      // Also maintain backward compatibility with old cwa_user storage
      localStorage.setItem('cwa_user', JSON.stringify({ username: userInfo.username }))
    } else {
      setIsAuthenticated(false)
      setIsAdmin(false)
      setUser(undefined)
      localStorage.removeItem('cwa_user')
      localStorage.removeItem('cwa_user_info')
    }
  }

  // Record user activity and extend session if needed
  const recordActivity = useCallback(() => {
    const now = Date.now()
    const timeSinceLastActivity = now - lastActivityRef.current
    
    // Throttle activity recording to every 30 seconds to prevent excessive updates
    if (timeSinceLastActivity < 30 * 1000) {
      return
    }
    
    lastActivityRef.current = now
    setLastActivity(now)
    
    // If user is authenticated and cache is getting stale, refresh it proactively
    if (isAuthenticated && !isRefreshingRef.current) {
      const cachedInfo = getCachedUserInfo()
      if (cachedInfo) {
        const timeUntilExpiry = cachedInfo.expires - now
        // If less than 5 minutes until cache expiry, refresh it
        if (timeUntilExpiry < 5 * 60 * 1000) {
          isRefreshingRef.current = true
          fetchUserInfo().then(userInfo => {
            if (userInfo) {
              updateAuthState(userInfo)
            }
          }).catch(() => {
            // If refresh fails, user might be logged out - let normal flow handle it
          }).finally(() => {
            isRefreshingRef.current = false
          })
        }
      }
    }
  }, [isAuthenticated])

  // Manual refresh function for when admin status might have changed
  const refreshUserInfo = async () => {
    setIsLoading(true)
    try {
      const userInfo = await fetchUserInfo()
      updateAuthState(userInfo)
      recordActivity() // Update activity timestamp
    } finally {
      setIsLoading(false)
    }
  }

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First try to use cached user info
        const cachedInfo = getCachedUserInfo()
        if (cachedInfo) {
          updateAuthState(cachedInfo)
          setIsLoading(false)
          return
        }

        // No valid cache, check if we have old user data indicating a session might exist
        const savedUser = localStorage.getItem('cwa_user')
        if (!savedUser) {
          // No saved user, definitely not authenticated
          updateAuthState(null)
          setIsLoading(false)
          return
        }

        // We have old user data, fetch fresh info to verify session and get admin status
        const userInfo = await fetchUserInfo()
        updateAuthState(userInfo)
      } catch (error) {
        console.error('Auth check failed:', error)
        updateAuthState(null)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  // Inactivity timeout - logout user after 30 minutes of inactivity
  useEffect(() => {
    if (!isAuthenticated) return

    const checkInactivity = () => {
      const now = Date.now()
      const timeSinceActivity = now - lastActivityRef.current
      
      if (timeSinceActivity >= INACTIVITY_TIMEOUT) {
        console.log('User inactive for 30 minutes, logging out')
        logout(() => {
          // Navigate to root route on automatic logout
          if (typeof window !== 'undefined') {
            window.location.href = '/'
          }
        })
      }
    }

    // Check every minute for inactivity
    const inactivityTimer = setInterval(checkInactivity, 60 * 1000)
    
    return () => clearInterval(inactivityTimer)
  }, [isAuthenticated]) // Remove lastActivity from dependencies

  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true)
    try {
      // Use the new login endpoint
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.user) {
          // Login successful, now fetch full user info including admin status
          const userInfo = await fetchUserInfo()
          if (userInfo) {
            updateAuthState(userInfo)
            recordActivity() // Record login as activity
            // Remove old basic auth storage
            localStorage.removeItem('cwa_auth')
            return true
          }
        }
      }
      
      return false
    } catch (error) {
      console.error('Login failed:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const logout = (onLogout?: () => void) => {
    // Clear all auth state
    setIsAuthenticated(false)
    setIsAdmin(false)
    setUser(undefined)
    
    // Clear all cached user data
    localStorage.removeItem('cwa_user')
    localStorage.removeItem('cwa_user_info')
    localStorage.removeItem('cwa_auth') // Clean up old auth storage
    
    // Clear React Query cache to prevent data leaking between users
    // Note: This requires React Query context, we'll add this in the next phase
    if (typeof window !== 'undefined' && (window as any).__REACT_QUERY_CLIENT__) {
      (window as any).__REACT_QUERY_CLIENT__.clear()
    }
    
    // Make a logout request to clear server-side session
    fetch(`${API_BASE_URL}/api/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {
      // Ignore errors on logout
    })
    
    // Execute callback if provided (for navigation or other cleanup)
    if (onLogout) {
      onLogout()
    }
  }

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    isAdmin,
    login,
    logout,
    refreshUserInfo,
    recordActivity,
    user,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}