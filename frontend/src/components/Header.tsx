import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sun, Moon, Monitor, ChevronDown, Menu, Search, LogOut, User } from 'lucide-react'
import { Button } from './ui/Button'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cn } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'

interface HeaderProps {
  onMenuClick: () => void
  theme: 'light' | 'dark' | 'system'
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void
}

export function Header({ onMenuClick, theme, onThemeChange }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()
  const { logout, user } = useAuth()

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  const currentTheme = themeOptions.find(option => option.value === theme)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      // Simple navigation - let React Query handle caching
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}&fresh=true`)
      setSearchQuery('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch(e)
    }
  }

  return (
    <header className="h-16 bg-card border-b border-border">
      <div className="flex items-center justify-between h-full px-6">
        {/* Left section */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="hover:bg-accent"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </Button>

          {/* Simple Search - Clears everything and starts fresh */}
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search books..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-64 pl-10 pr-4 py-2 text-sm bg-background text-foreground border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </form>
        </div>

        {/* Right section */}
        <div className="flex items-center space-x-4">
          {/* Theme Selector */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center space-x-2 text-foreground">
                {currentTheme && <currentTheme.icon className="w-4 h-4" />}
                <span className="hidden sm:inline">{currentTheme?.label}</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="min-w-[8rem] bg-popover border border-border rounded-md shadow-md p-1 z-50"
                sideOffset={5}
              >
                {themeOptions.map((option) => (
                  <DropdownMenu.Item
                    key={option.value}
                    className={cn(
                      "flex items-center space-x-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer outline-none text-popover-foreground",
                      "hover:bg-accent hover:text-accent-foreground",
                      theme === option.value && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => onThemeChange(option.value as any)}
                  >
                    <option.icon className="w-4 h-4" />
                    <span>{option.label}</span>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* User Menu */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center space-x-2 text-foreground">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{user?.username}</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="min-w-[8rem] bg-popover border border-border rounded-md shadow-md p-1 z-50"
                sideOffset={5}
              >
                <DropdownMenu.Item
                  className="flex items-center space-x-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer outline-none text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                  onClick={logout}
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </header>
  )
}
