import { useState, useCallback } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { BookOpen, BookCheck, Clock, Loader2, Heart } from 'lucide-react'
import { Button } from './ui/Button'
import { cn } from '../lib/utils'

export interface ReadStatus {
  is_read: boolean
  is_in_progress: boolean
  is_want_to_read: boolean
  status_code: number // 0=unread, 1=read, 2=in_progress, 3=want_to_read
  last_modified: string | null
  times_started_reading: number
}

export interface ReadStatusDropdownProps {
  bookId: string | number
  readStatus?: ReadStatus
  onStatusChange?: (bookId: string | number, action: 'toggle' | 'mark_read' | 'mark_unread' | 'mark_in_progress' | 'mark_want_to_read') => Promise<void>
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}

const STATUS_CONFIG = {
  unread: {
    icon: BookOpen,
    label: 'Mark as Read',
    action: 'mark_read' as const,
    buttonIcon: BookOpen,
    buttonLabel: 'Unread',
    buttonClass: 'text-muted-foreground hover:text-foreground',
  },
  read: {
    icon: BookCheck,
    label: 'Mark as Unread',
    action: 'mark_unread' as const,
    buttonIcon: BookCheck,
    buttonLabel: 'Read',
    buttonClass: 'text-green-600 hover:text-green-700',
  },
  in_progress: {
    icon: Clock,
    label: 'Mark as Read',
    action: 'mark_read' as const,
    buttonIcon: Clock,
    buttonLabel: 'Reading',
    buttonClass: 'text-blue-600 hover:text-blue-700',
  },
  want_to_read: {
    icon: Heart,
    label: 'Mark as Read',
    action: 'mark_read' as const,
    buttonIcon: Heart,
    buttonLabel: 'Want to Read',
    buttonClass: 'text-pink-600 hover:text-pink-700',
  }
} as const

export function ReadStatusDropdown({
  bookId,
  readStatus,
  onStatusChange,
  disabled = false,
  size = 'sm',
  className
}: ReadStatusDropdownProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Determine current status
  const getCurrentStatus = (): keyof typeof STATUS_CONFIG => {
    if (!readStatus) return 'unread'
    if (readStatus.is_read) return 'read'
    if (readStatus.is_in_progress) return 'in_progress'
    if (readStatus.is_want_to_read) return 'want_to_read'
    return 'unread'
  }

  const currentStatus = getCurrentStatus()
  const config = STATUS_CONFIG[currentStatus]

  // Handle status change
  const handleStatusChange = useCallback(async (action: 'toggle' | 'mark_read' | 'mark_unread' | 'mark_in_progress' | 'mark_want_to_read') => {
    if (!onStatusChange || isLoading) return

    setIsLoading(true)
    try {
      await onStatusChange(bookId, action)
      setIsOpen(false) // Close dropdown after successful change
    } catch (error) {
      console.error('Failed to update read status:', error)
    } finally {
      setIsLoading(false)
    }
  }, [bookId, onStatusChange, isLoading])

  const buttonSize = size === 'sm' ? 'sm' : 'default'
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'

  const ButtonIcon = config.buttonIcon
  
  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="outline"
          size={buttonSize}
          disabled={disabled || isLoading}
          className={cn(
            'relative border border-border hover:bg-accent hover:text-accent-foreground',
            config.buttonClass,
            className
          )}
        >
          {isLoading ? (
            <Loader2 className={cn(iconSize, 'animate-spin')} />
          ) : (
            <ButtonIcon className={iconSize} />
          )}
          {size === 'md' && (
            <span className="ml-2 text-xs font-medium">
              {config.buttonLabel}
            </span>
          )}
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[160px] bg-background border border-border rounded-md p-1 shadow-md z-50"
          sideOffset={5}
          align="end"
          side="bottom"
          alignOffset={-5}
          avoidCollisions={true}
          collisionPadding={8}
        >
          {/* Mark as Read */}
          <DropdownMenu.Item
            className={cn(
              "flex items-center px-2 py-2 text-sm rounded-sm cursor-pointer",
              "hover:bg-accent hover:text-accent-foreground",
              "focus:bg-accent focus:text-accent-foreground focus:outline-none",
              currentStatus === 'read' && "text-muted-foreground"
            )}
            disabled={currentStatus === 'read'}
            onSelect={() => handleStatusChange('mark_read')}
          >
            <BookCheck className="w-4 h-4 mr-2 text-green-600" />
            <span>Mark as Read</span>
          </DropdownMenu.Item>

          {/* Mark as Reading */}
          <DropdownMenu.Item
            className={cn(
              "flex items-center px-2 py-2 text-sm rounded-sm cursor-pointer",
              "hover:bg-accent hover:text-accent-foreground",
              "focus:bg-accent focus:text-accent-foreground focus:outline-none",
              currentStatus === 'in_progress' && "text-muted-foreground"
            )}
            disabled={currentStatus === 'in_progress'}
            onSelect={() => handleStatusChange('mark_in_progress')}
          >
            <Clock className="w-4 h-4 mr-2 text-blue-600" />
            <span>Mark as Reading</span>
          </DropdownMenu.Item>

          {/* Mark as Want to Read */}
          <DropdownMenu.Item
            className={cn(
              "flex items-center px-2 py-2 text-sm rounded-sm cursor-pointer",
              "hover:bg-accent hover:text-accent-foreground",
              "focus:bg-accent focus:text-accent-foreground focus:outline-none",
              currentStatus === 'want_to_read' && "text-muted-foreground"
            )}
            disabled={currentStatus === 'want_to_read'}
            onSelect={() => handleStatusChange('mark_want_to_read')}
          >
            <Heart className="w-4 h-4 mr-2 text-pink-600" />
            <span>Want to Read</span>
          </DropdownMenu.Item>

          {/* Mark as Unread */}
          <DropdownMenu.Item
            className={cn(
              "flex items-center px-2 py-2 text-sm rounded-sm cursor-pointer",
              "hover:bg-accent hover:text-accent-foreground",
              "focus:bg-accent focus:text-accent-foreground focus:outline-none",
              currentStatus === 'unread' && "text-muted-foreground"
            )}
            disabled={currentStatus === 'unread'}
            onSelect={() => handleStatusChange('mark_unread')}
          >
            <BookOpen className="w-4 h-4 mr-2 text-muted-foreground" />
            <span>Mark as Unread</span>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="h-px bg-border my-1" />

          {/* Quick Toggle */}
          <DropdownMenu.Item
            className={cn(
              "flex items-center px-2 py-2 text-sm rounded-sm cursor-pointer",
              "hover:bg-accent hover:text-accent-foreground",
              "focus:bg-accent focus:text-accent-foreground focus:outline-none"
            )}
            onSelect={() => handleStatusChange('toggle')}
          >
            <div className="w-4 h-4 mr-2 flex items-center justify-center">
              <div className="w-3 h-3 border-2 border-current rounded-sm" />
            </div>
            <span>Quick Toggle</span>
          </DropdownMenu.Item>

          {/* Reading Stats (if available) */}
          {readStatus && readStatus.times_started_reading > 0 && (
            <>
              <DropdownMenu.Separator className="h-px bg-border my-1" />
              <div className="px-2 py-1 text-xs text-muted-foreground">
                Started reading {readStatus.times_started_reading} time{readStatus.times_started_reading !== 1 ? 's' : ''}
              </div>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
