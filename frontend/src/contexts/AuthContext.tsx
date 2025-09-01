import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:8084'

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
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

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<{ username: string } | undefined>(undefined)

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First check if we have user data in localStorage
        const savedUser = localStorage.getItem('cwa_user')
        if (!savedUser) {
          // No saved user, definitely not authenticated
          setIsAuthenticated(false)
          setIsLoading(false)
          return
        }

        // We have saved user data, verify the session is still valid
        const response = await fetch(`${API_BASE_URL}/api/auth/check`, {
          credentials: 'include',
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.authenticated && data.user) {
            // Session is valid, restore user
            setUser(data.user)
            setIsAuthenticated(true)
          } else {
            // Invalid response, clear data
            localStorage.removeItem('cwa_user')
            setIsAuthenticated(false)
            setUser(undefined)
          }
        } else {
          // Session expired, clear stale data
          localStorage.removeItem('cwa_user')
          setIsAuthenticated(false)
          setUser(undefined)
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        // On any error, assume not authenticated
        localStorage.removeItem('cwa_user')
        setIsAuthenticated(false)
        setUser(undefined)
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
          // Store auth info
          setUser(data.user)
          localStorage.setItem('cwa_user', JSON.stringify(data.user))
          // Remove old basic auth storage
          localStorage.removeItem('cwa_auth')
          setIsAuthenticated(true)
          return true
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
    setIsAuthenticated(false)
    setUser(undefined)
    localStorage.removeItem('cwa_user')
    localStorage.removeItem('cwa_auth') // Clean up old auth storage
    
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
    login,
    logout,
    user,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}