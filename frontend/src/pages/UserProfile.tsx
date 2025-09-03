import { useState, useEffect } from 'react'
import { Button } from '../components/ui/Button'
import { Eye, EyeOff, Check, AlertCircle, User, Mail, Languages, Lock } from 'lucide-react'
import { useToast } from '../hooks/useToast'

interface UserProfile {
  id: number
  username: string
  email: string
  kindle_email: string
  locale: string
  default_language: string
  permissions: {
    admin: boolean
    download: boolean
    upload: boolean
    edit: boolean
    passwd: boolean
    edit_shelfs: boolean
    delete_books: boolean
    viewer: boolean
  }
}

interface PasswordChangeData {
  current_password: string
  new_password: string
  confirm_password: string
}

export default function UserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setSaving] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })
  
  // Form states
  const [formData, setFormData] = useState({
    email: '',
    kindle_email: '',
    default_language: 'en'
  })
  
  const [passwordData, setPasswordData] = useState<PasswordChangeData>({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const { showToast } = useToast()

  // Language options (matching CWA structure)
  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'de', label: 'Deutsch' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
    { value: 'it', label: 'Italiano' },
    { value: 'pt', label: 'Português' },
    { value: 'ru', label: 'Русский' },
    { value: 'zh', label: '中文' },
    { value: 'ja', label: '日本語' }
  ]



  // Load user profile on mount
  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/profile', {
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        showToast({
          type: 'error',
          title: 'Error',
          description: errorData.error || 'Failed to load profile'
        })
        return
      }

      const profileData: UserProfile = await response.json()
      setProfile(profileData)
      setFormData({
        email: profileData.email,
        kindle_email: profileData.kindle_email,
        default_language: profileData.default_language
      })
    } catch (error) {
      console.error('Failed to load profile:', error)
      showToast({
        type: 'error',
        title: 'Network Error',
        description: 'Failed to load profile data'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFormChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handlePasswordChange = (field: keyof PasswordChangeData, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }))
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        showToast({
          type: 'error',
          title: 'Error',
          description: errorData.error || 'Failed to update profile'
        })
        return
      }

      showToast({
        type: 'success',
        title: 'Success',
        description: 'Profile updated successfully!'
      })
      
      // Reload profile to get updated data
      await loadProfile()
    } catch (error) {
      console.error('Failed to save profile:', error)
      showToast({
        type: 'error',
        title: 'Network Error',
        description: 'Failed to save profile changes'
      })
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      showToast({
        type: 'error',
        title: 'Error',
        description: 'New passwords do not match'
      })
      return
    }

    if (passwordData.new_password.length < 4) {
      showToast({
        type: 'error',
        title: 'Error',
        description: 'Password must be at least 4 characters long'
      })
      return
    }

    setIsChangingPassword(true)
    try {
      const response = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          current_password: passwordData.current_password,
          new_password: passwordData.new_password
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        showToast({
          type: 'error',
          title: 'Error',
          description: errorData.error || 'Failed to change password'
        })
        return
      }

      showToast({
        type: 'success',
        title: 'Success',
        description: 'Password changed successfully!'
      })
      
      // Clear password form
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      })
      setShowPasswordSection(false)
    } catch (error) {
      console.error('Failed to change password:', error)
      showToast({
        type: 'error',
        title: 'Network Error',
        description: 'Failed to change password'
      })
    } finally {
      setIsChangingPassword(false)
    }
  }

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const hasChanges = () => {
    if (!profile) return false
    return (
      formData.email !== profile.email ||
      formData.kindle_email !== profile.kindle_email ||
      formData.default_language !== profile.default_language
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">Failed to load profile data</p>
          <Button onClick={loadProfile} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Profile</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* Basic Information */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center">
            <User className="w-5 h-5 mr-2" />
            Basic Information
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Username
              </label>
              <input
                type="text"
                value={profile.username}
                disabled
                className="w-full px-3 py-2 text-sm bg-muted border border-input rounded-md cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Username cannot be changed
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Email Address
              </label>
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleFormChange('email', e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Kindle Email Address
              </label>
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={formData.kindle_email}
                  onChange={(e) => handleFormChange('kindle_email', e.target.value)}
                  placeholder="username@kindle.com"
                  className="flex-1 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Enter your Kindle's email address to send books directly to your device
              </p>
            </div>
          </div>
        </div>

        {/* Language Settings */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center">
            <Languages className="w-5 h-5 mr-2" />
            Language Preferences
          </h2>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Default Book Language
            </label>
            <div className="flex items-center space-x-2">
              <Languages className="w-4 h-4 text-muted-foreground" />
              <select
                value={formData.default_language}
                onChange={(e) => handleFormChange('default_language', e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring max-w-xs"
              >
                {languageOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Preferred language for book content and metadata
            </p>
          </div>
        </div>

        {/* Permissions (Read-only) */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Account Permissions</h2>
          <div className="bg-muted p-4 rounded-md">
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(profile.permissions).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${value ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-sm capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Permissions are managed by administrators and cannot be changed here
            </p>
          </div>
        </div>

        {/* Password Change Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center">
            <Lock className="w-5 h-5 mr-2" />
            Security
          </h2>
          
          {!showPasswordSection ? (
            <Button 
              onClick={() => setShowPasswordSection(true)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Change Password
            </Button>
          ) : (
            <div className="space-y-4 border border-border rounded-md p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Change Password</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowPasswordSection(false)
                    setPasswordData({
                      current_password: '',
                      new_password: '',
                      confirm_password: ''
                    })
                  }}
                >
                  Cancel
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? "text" : "password"}
                      value={passwordData.current_password}
                      onChange={(e) => handlePasswordChange('current_password', e.target.value)}
                      className="w-full px-3 py-2 pr-10 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('current')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? "text" : "password"}
                      value={passwordData.new_password}
                      onChange={(e) => handlePasswordChange('new_password', e.target.value)}
                      className="w-full px-3 py-2 pr-10 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('new')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? "text" : "password"}
                      value={passwordData.confirm_password}
                      onChange={(e) => handlePasswordChange('confirm_password', e.target.value)}
                      className="w-full px-3 py-2 pr-10 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('confirm')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button 
                  onClick={changePassword}
                  disabled={isChangingPassword || !passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password}
                  className="w-full sm:w-auto"
                >
                  {isChangingPassword ? 'Changing...' : 'Change Password'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex space-x-4 pt-4 border-t border-border">
          <Button 
            onClick={saveProfile}
            disabled={isSaving || !hasChanges()}
          >
            {isSaving ? 'Saving...' : 'Save Profile'}
          </Button>
          {hasChanges() && (
            <Button 
              variant="outline"
              onClick={loadProfile}
            >
              Reset Changes
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
