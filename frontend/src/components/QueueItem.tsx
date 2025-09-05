import { useState, useEffect } from 'react'
import { 
  GripVertical, 
  Play, 
  Pause, 
  X, 
  ArrowUp, 
  ArrowDown, 
  Clock,
  Download,
  AlertCircle,
  CheckCircle,
  MoreHorizontal,
  Timer,
  Cog
} from 'lucide-react'
import { Button } from './ui/Button'
import { BookCover } from './ui/BookCover'
import { CircularProgress } from './ui/CircularProgress'
import { formatDate, formatCountdown } from '../lib/utils'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

interface QueueItemProps {
  download: any
  position?: number
  isActive?: boolean
  onCancel?: (id: string) => void
  onPause?: (id: string) => void
  onResume?: (id: string) => void
  onMoveUp?: (id: string) => void
  onMoveDown?: (id: string) => void
  onSetPriority?: (id: string, priority: 'high' | 'normal' | 'low') => void
  showDragHandle?: boolean
  showPosition?: boolean
  dragRef?: any
}

export function QueueItem({
  download,
  position,
  isActive = false,
  onCancel,
  onPause,
  onResume,
  onMoveUp,
  onMoveDown,
  onSetPriority,
  showDragHandle = false,
  showPosition = false,
  dragRef
}: QueueItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  const [countdown, setCountdown] = useState('')

  // Update countdown for waiting status
  useEffect(() => {
    if (download.status === 'waiting' && download.waitTime && download.waitStart) {
      const updateCountdown = () => {
        setCountdown(formatCountdown(download.waitTime, download.waitStart))
      }
      
      updateCountdown() // Initial update
      const interval = setInterval(updateCountdown, 1000) // Update every second
      
      return () => clearInterval(interval)
    }
  }, [download.status, download.waitTime, download.waitStart])

  const getStatusInfo = () => {
    switch (download.status) {
      case 'downloading':
        return {
          icon: <CircularProgress progress={download.progress || 0} status="downloading" size={16} />,
          label: 'Downloading',
          color: 'text-green-600',
          bgColor: 'bg-green-50'
        }
      case 'processing':
        return {
          icon: <Cog className="h-4 w-4 animate-spin" />,
          label: 'Processing',
          color: 'text-purple-600',
          bgColor: 'bg-purple-50'
        }
      case 'waiting':
        return {
          icon: <Timer className="h-4 w-4 animate-pulse" />,
          label: 'Waiting',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50'
        }
      case 'queued':
        return {
          icon: <Clock className="h-4 w-4" />,
          label: 'Queued',
          color: 'text-orange-600',
          bgColor: 'bg-orange-50'
        }
      case 'completed':
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          label: 'Completed',
          color: 'text-green-600',
          bgColor: 'bg-green-50'
        }
      case 'error':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          label: 'Failed',
          color: 'text-destructive',
          bgColor: 'bg-red-50'
        }
      default:
        return {
          icon: <Download className="h-4 w-4" />,
          label: 'Unknown',
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/50'
        }
    }
  }

  const statusInfo = getStatusInfo()

  return (
    <div 
      className={`group relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border transition-all ${
        isActive 
          ? 'border-primary bg-primary/5 shadow-sm' 
          : 'border-border hover:border-border/80 hover:bg-accent/30'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Mobile: Top row with drag handle, position, and actions */}
      <div className="flex sm:hidden items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {/* Drag Handle */}
          {showDragHandle && (
            <div 
              ref={dragRef}
              className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}

          {/* Position Badge */}
          {showPosition && position && (
            <div className="flex-shrink-0">
              <div className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold ${statusInfo.bgColor} ${statusInfo.color}`}>
                {position}
              </div>
            </div>
          )}
        </div>
        
        {/* Mobile Action Controls */}
        <div className="flex items-center gap-1">
          {/* Status-specific actions */}
          {download.status === 'downloading' && onPause && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onPause(download.id)}
              title="Pause download"
            >
              <Pause className="h-3 w-3" />
            </Button>
          )}

          {download.status === 'queued' && onResume && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onResume(download.id)}
              title="Start download"
            >
              <Play className="h-3 w-3" />
            </Button>
          )}

          {/* More Actions Menu */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content 
                className="min-w-40 bg-popover border border-border rounded-md shadow-lg p-1 z-50"
                align="end"
              >
                {onSetPriority && download.status === 'queued' && (
                  <>
                    <DropdownMenu.Item
                      className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm"
                      onClick={() => onSetPriority(download.id, 'high')}
                    >
                      Set High Priority
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm"
                      onClick={() => onSetPriority(download.id, 'normal')}
                    >
                      Set Normal Priority
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm"
                      onClick={() => onSetPriority(download.id, 'low')}
                    >
                      Set Low Priority
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator className="h-px bg-border my-1" />
                  </>
                )}
                {onCancel && (
                  <DropdownMenu.Item
                    className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm text-destructive"
                    onClick={() => onCancel(download.id)}
                  >
                    <X className="h-3 w-3 mr-2" />
                    Remove from Queue
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* Main content row */}
      <div className="flex items-start sm:items-center gap-3 sm:gap-4 w-full">
        {/* Desktop: Drag Handle */}
        {showDragHandle && (
          <div 
            ref={dragRef}
            className="hidden sm:block cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}

        {/* Desktop: Position Badge */}
        {showPosition && position && (
          <div className="hidden sm:block flex-shrink-0">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${statusInfo.bgColor} ${statusInfo.color}`}>
              {position}
            </div>
          </div>
        )}

        {/* Book Cover */}
        <BookCover 
          src={download.coverUrl || download.preview} 
          alt={download.title} 
          size="lg"
          className="flex-shrink-0"
        />

        {/* Book Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div>
            <h4 className="font-medium text-sm line-clamp-1">{download.title}</h4>
            <p className="text-xs text-muted-foreground line-clamp-1">
              by {download.author || 'Unknown Author'}
            </p>
          </div>
          
          {/* Status and Progress */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className={`flex items-center gap-1.5 ${statusInfo.color}`}>
              {statusInfo.icon}
              <span className="text-xs font-medium">{statusInfo.label}</span>
            </div>
            
            {download.status === 'downloading' && (
              <>
                <div className="text-xs text-muted-foreground">
                  {Math.round(download.progress || 0)}%
                </div>
                {download.speed && (
                  <div className="text-xs text-muted-foreground">
                    {download.speed}
                  </div>
                )}
              </>
            )}
            
            {download.status === 'waiting' && countdown && (
              <div className="text-xs font-medium text-blue-600">
                {countdown} remaining
              </div>
            )}
            
            {download.status === 'queued' && position && (
              <div className="text-xs text-muted-foreground">
                Position #{position}
              </div>
            )}
          </div>

          {/* Additional Info */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
            {download.format && (
              <span className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">
                {download.format.toUpperCase()}
              </span>
            )}
            {download.size && <span>{download.size}</span>}
            {download.timestamp && (
              <span>{formatDate(download.timestamp)}</span>
            )}
          </div>

          {/* Progress Bar for Downloading */}
          {download.status === 'downloading' && (
            <div className="w-full bg-secondary rounded-full h-1.5 mt-2">
              <div 
                className="bg-green-500 h-1.5 rounded-full transition-all duration-300" 
                style={{ width: `${download.progress || 0}%` }}
              />
            </div>
          )}
          
          {/* Countdown Bar for Waiting */}
          {download.status === 'waiting' && download.waitTime && download.waitStart && (
            <div className="w-full bg-secondary rounded-full h-1.5 mt-2">
              <div 
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-1000" 
                style={{ 
                  width: `${Math.max(0, Math.min(100, ((Date.now() / 1000 - download.waitStart) / download.waitTime) * 100))}%` 
                }}
              />
            </div>
          )}
        </div>

        {/* Desktop Action Controls */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          {/* Quick Actions - visible on hover */}
          {isHovered && download.status === 'queued' && (
            <>
              {onMoveUp && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => onMoveUp(download.id)}
                  title="Move up in queue"
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
              )}
              {onMoveDown && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => onMoveDown(download.id)}
                  title="Move down in queue"
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              )}
            </>
          )}

          {/* Status-specific actions */}
          {download.status === 'downloading' && onPause && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onPause(download.id)}
              title="Pause download"
            >
              <Pause className="h-3 w-3" />
            </Button>
          )}

          {download.status === 'queued' && onResume && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onResume(download.id)}
              title="Start download"
            >
              <Play className="h-3 w-3" />
            </Button>
          )}

          {/* More Actions Menu */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content 
                className="min-w-40 bg-popover border border-border rounded-md shadow-lg p-1 z-50"
                align="end"
              >
                {onSetPriority && download.status === 'queued' && (
                  <>
                    <DropdownMenu.Item
                      className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm"
                      onClick={() => onSetPriority(download.id, 'high')}
                    >
                      Set High Priority
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm"
                      onClick={() => onSetPriority(download.id, 'normal')}
                    >
                      Set Normal Priority
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm"
                      onClick={() => onSetPriority(download.id, 'low')}
                    >
                      Set Low Priority
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator className="h-px bg-border my-1" />
                  </>
                )}
                {onCancel && (
                  <DropdownMenu.Item
                    className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm text-destructive"
                    onClick={() => onCancel(download.id)}
                  >
                    <X className="h-3 w-3 mr-2" />
                    Remove from Queue
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </div>
  )
}
