import { useState } from 'react'
import { Eye, EyeOff, BookOpen, Loader2 } from 'lucide-react'
import { Button } from './ui/Button'
import { cn } from '../lib/utils'

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<boolean>
  isLoading?: boolean
  error?: string
}

export function LoginPage({ onLogin, isLoading = false, error }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')

    if (!username.trim()) {
      setLocalError('Username is required')
      return
    }

    if (!password.trim()) {
      setLocalError('Password is required')
      return
    }

    try {
      const success = await onLogin(username.trim(), password)
      if (!success) {
        setLocalError('Invalid username or password')
      }
    } catch (err) {
      setLocalError('Login failed. Please try again.')
    }
  }

  const displayError = error || localError

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4 shadow-lg">
            <BookOpen className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            CWA Book Downloader
          </h1>
          <p className="text-muted-foreground">
            Sign in to access your book library
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-card border border-border rounded-lg shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Field */}
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-foreground">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={cn(
                  "w-full px-3 py-2 border rounded-md text-sm",
                  "bg-background text-foreground",
                  "border-border focus:border-primary focus:ring-2 focus:ring-primary/20",
                  "placeholder:text-muted-foreground",
                  "transition-colors duration-200",
                  displayError && "border-destructive focus:border-destructive focus:ring-destructive/20"
                )}
                placeholder="Enter your username"
                disabled={isLoading}
                autoComplete="username"
                autoFocus
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 pr-10 border rounded-md text-sm",
                    "bg-background text-foreground",
                    "border-border focus:border-primary focus:ring-2 focus:ring-primary/20",
                    "placeholder:text-muted-foreground",
                    "transition-colors duration-200",
                    displayError && "border-destructive focus:border-destructive focus:ring-destructive/20"
                  )}
                  placeholder="Enter your password"
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {displayError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{displayError}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !username.trim() || !password.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-muted-foreground">
            InkDrop
          </p>
        </div>
      </div>
    </div>
  )
}
