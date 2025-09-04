import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from './ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
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
    <div className="min-h-screen bg-background flex items-start sm:items-center justify-center p-4 sm:p-6 pt-8 sm:pt-6">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4 sm:mb-6">
            <img src="/droplet.png" alt="Inkdrop Logo" className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0" />
            <span className="text-3xl sm:text-4xl font-bold text-foreground">Inkdrop</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-foreground mb-2">
            Welcome to your digital library
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Your automated book downloader and library manager
          </p>
        </div>

        {/* Login Form */}
        <Card className="shadow-lg border-0 sm:border">
          <CardHeader className="space-y-1 pb-4 sm:pb-6">
            <CardTitle className="text-xl sm:text-2xl text-center">Sign in</CardTitle>
            <CardDescription className="text-center text-sm sm:text-base">
              Enter your credentials to access your library
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-4">
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
                    "flex h-12 sm:h-10 w-full rounded-md border border-input bg-background px-4 sm:px-3 py-3 sm:py-2 text-base sm:text-sm",
                    "ring-offset-background placeholder:text-muted-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    displayError && "border-destructive focus-visible:ring-destructive"
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
                      "flex h-12 sm:h-10 w-full rounded-md border border-input bg-background px-4 sm:px-3 py-3 sm:py-2 pr-12 sm:pr-10 text-base sm:text-sm",
                      "ring-offset-background placeholder:text-muted-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      displayError && "border-destructive focus-visible:ring-destructive"
                    )}
                    placeholder="Enter your password"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full w-12 sm:w-10 px-0 hover:bg-transparent touch-manipulation"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Error Message */}
              {displayError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">{displayError}</p>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-12 sm:h-10 text-base sm:text-sm font-medium touch-manipulation"
                size="lg"
                disabled={isLoading || !username.trim() || !password.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 sm:h-4 sm:w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-4 sm:mt-6">
          <p className="text-xs sm:text-sm text-muted-foreground px-2">
            Inkdrop - Automated book downloader and library manager
          </p>
        </div>
      </div>
    </div>
  )
}