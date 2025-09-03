import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:8084'

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
  logout: () => void
  refreshUserInfo: () => Promise<void>
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

// Cache duration: 10 minutes
const CACHE_DURATION = 10 * 60 * 1000

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<{ username: string } | undefined>(undefined)

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

  // Manual refresh function for when admin status might have changed
  const refreshUserInfo = async () => {
    setIsLoading(true)
    try {
      const userInfo = await fetchUserInfo()
      updateAuthState(userInfo)
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

  const logout = () => {
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
  }

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    isAdmin,
    login,
    logout,
    refreshUserInfo,
    user,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}