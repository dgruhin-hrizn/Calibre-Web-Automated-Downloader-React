import { useNavigate } from 'react-router-dom'
import { Sun, Moon, Monitor, ChevronDown, Menu, LogOut, User, Settings } from 'lucide-react'
import { Button } from './ui/Button'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cn } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import { HeaderQueueWidget } from './HeaderQueueWidget'

interface HeaderProps {
  onMenuClick: () => void
  theme: 'light' | 'dark' | 'system'
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void
  sidebarOpen?: boolean
}

export function Header({ onMenuClick, theme, onThemeChange, sidebarOpen = false }: HeaderProps) {
  const navigate = useNavigate()
  const { logout, user } = useAuth()

  const themeOptions = [
    { value: 'light', label: '', icon: Sun },
    { value: 'dark', label: '', icon: Moon },
    { value: 'system', label: '', icon: Monitor },
  ]

  const currentTheme = themeOptions.find(option => option.value === theme)

  return (
    <header className={cn(
      "fixed top-0 right-0 h-16 bg-card border-b border-border z-50 transition-all duration-300",
      sidebarOpen ? "left-56 sm:left-64 lg:left-64" : "left-0 lg:left-20"
    )}>
      <div className="flex items-center justify-between h-full px-4 sm:px-6">
        {/* Left section */}
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="hover:bg-accent"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </Button>
          
          {/* Mobile Logo - Only visible on small screens */}
          <div className="flex items-center space-x-2 sm:hidden">
            <img src="/droplet.png" alt="Inkdrop Logo" className="w-6 h-6 flex-shrink-0" />
            <span className="text-lg font-bold text-foreground">Inkdrop</span>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Queue Widget */}
          <HeaderQueueWidget />

          {/* Theme Selector */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center space-x-1 sm:space-x-2 text-foreground">
                {currentTheme && <currentTheme.icon className="w-4 h-4" />}
                <ChevronDown className="w-3 h-3 hidden sm:block" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="min-w-[3rem] bg-popover border border-border rounded-md shadow-md p-1 z-50"
                sideOffset={5}
              >
                {themeOptions.map((option) => (
                  <DropdownMenu.Item
                    key={option.value}
                    className={cn(
                      "flex items-center justify-center px-2 py-1.5 text-sm rounded-sm cursor-pointer outline-none text-popover-foreground",
                      "hover:bg-accent hover:text-accent-foreground",
                      theme === option.value && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => onThemeChange(option.value as any)}
                  >
                    <option.icon className="w-4 h-4" />
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* User Menu */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center space-x-1 sm:space-x-2 text-foreground">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{user?.username}</span>
                <ChevronDown className="w-3 h-3 hidden sm:block" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="min-w-[8rem] bg-popover border border-border rounded-md shadow-md p-1 z-50"
                sideOffset={5}
                align="end"
              >
                <DropdownMenu.Item
                  className="flex items-center space-x-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer outline-none text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                  onClick={() => navigate('/profile')}
                >
                  <Settings className="w-4 h-4" />
                  <span>Profile</span>
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="h-px bg-border my-1" />
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
