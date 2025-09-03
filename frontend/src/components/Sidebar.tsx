import { Link, useLocation } from 'react-router-dom'
import { 
  Home, 
  Search, 
  Download, 
  Settings,
  Library,
  TrendingUp,
  BookOpen,
  Users,
  X
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAdminStatus } from '../pages/Library/hooks/useAdminStatus'

interface SidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Find Books', href: '/search', icon: Search },
  { name: 'Library', href: '/library', icon: Library },
  { name: 'Series', href: '/series', icon: BookOpen },
  { name: 'Hot Books', href: '/hot', icon: TrendingUp },
  { name: 'Downloads', href: '/downloads', icon: Download },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  const location = useLocation()
  const { isAdmin } = useAdminStatus()

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
            <div className="flex items-center space-x-2">
              <img src="/droplet.png" alt="Inkdrop Logo" className="w-8 h-8 flex-shrink-0" />
              {open && <span className="text-xl font-bold whitespace-nowrap text-foreground">Inkdrop</span>}
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="lg:hidden p-2 rounded-md hover:bg-accent"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>
          </div>

          {/* Navigation */}
          <nav className={cn(
            "flex-1 py-6 space-y-2 overflow-y-auto",
            open ? "px-4" : "px-2 overflow-x-hidden"
          )}>
            {navigation.map((item) => {
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
                    <div className="absolute left-full ml-2 px-2 py-1 bg-popover border border-border rounded-md text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 hidden lg:block text-popover-foreground">
                      {item.name}
                    </div>
                  )}
                </Link>
              )
            })}
            
            {/* Admin Menu - Only show to admin users */}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => window.innerWidth < 1024 && onOpenChange(false)}
                className={cn(
                  "flex items-center py-2 rounded-md text-sm font-medium transition-colors group relative",
                  open ? "px-3 space-x-3" : "justify-center w-16 h-10 mx-auto",
                  location.pathname === "/admin"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
                title={!open ? "Administration" : undefined}
              >
                <Users className="w-5 h-5 flex-shrink-0" />
                {open && <span className="whitespace-nowrap">Administration</span>}
                
                {/* Tooltip for collapsed state */}
                {!open && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-popover border border-border rounded-md text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 hidden lg:block text-popover-foreground">
                    Administration
                  </div>
                )}
              </Link>
            )}
          </nav>

          {/* Footer - Always visible and fixed to bottom */}
          <div className={cn(
            "border-t border-border flex-shrink-0",
            open ? "p-4" : "p-2"
          )}>
            {open ? (
              <div className="text-xs text-muted-foreground">
                Inkdrop v1.3.2
              </div>
            ) : (
              <div className="flex justify-center">
                <img src="/droplet.png" alt="Inkdrop" className="w-6 h-6" />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
