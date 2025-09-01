import { Link, useLocation } from 'react-router-dom'
import { 
  Home, 
  Search, 
  Download, 
  Settings,
  BookOpen,
  Library,
  TrendingUp,
  Shield,
  X
} from 'lucide-react'
import { cn } from '../lib/utils'

interface SidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Search', href: '/search', icon: Search },
  { name: 'Library', href: '/library', icon: Library },
  { name: 'Hot Books', href: '/hot', icon: TrendingUp },
  { name: 'Downloads', href: '/downloads', icon: Download },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Admin Panel', href: '/admin', icon: Shield, adminOnly: true },
]

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  const location = useLocation()

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-25 lg:hidden"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-card border-r border-border transform transition-all duration-300 ease-in-out lg:static lg:inset-0 lg:h-screen overflow-x-hidden",
          open ? "w-64 translate-x-0" : "w-0 -translate-x-full lg:w-20 lg:translate-x-0"
        )}
      >
        <div className={cn("flex flex-col h-full", !open && "lg:overflow-hidden")}>
          {/* Header */}
          <div className={cn(
            "flex items-center h-16 border-b border-border flex-shrink-0",
            open ? "justify-between px-6" : "justify-center px-0"
          )}>
            <div className="flex items-center space-x-3">
              <BookOpen className="w-8 h-8 text-primary flex-shrink-0" />
              {open && <span className="text-xl font-bold whitespace-nowrap">Book Downloader</span>}
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="lg:hidden p-2 rounded-md hover:bg-accent"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className={cn(
            "flex-1 py-6 space-y-2 overflow-y-auto",
            open ? "px-4" : "px-2 overflow-x-hidden"
          )}>
            {navigation.map((item) => {
              // For now, show admin panel to all users since we only have admin login
              // In the future, you could check user permissions here
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => window.innerWidth < 1024 && onOpenChange(false)}
                  className={cn(
                    "flex items-center py-2 rounded-md text-sm font-medium transition-colors group relative",
                    open ? "px-3 space-x-3" : "justify-center w-16 h-10 mx-auto",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                  title={!open ? item.name : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {open && <span className="whitespace-nowrap">{item.name}</span>}
                  
                  {/* Tooltip for collapsed state */}
                  {!open && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-popover border border-border rounded-md text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 hidden lg:block">
                      {item.name}
                    </div>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Footer - Always visible and fixed to bottom */}
          <div className={cn(
            "border-t border-border flex-shrink-0",
            open ? "p-4" : "p-2"
          )}>
            {open ? (
              <div className="text-xs text-muted-foreground">
                Calibre Web Automated
                <br />
                Book Downloader
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
