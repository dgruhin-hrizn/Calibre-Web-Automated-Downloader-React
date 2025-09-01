import { BookOpen, Check } from 'lucide-react'
import { cn } from '../../lib/utils'

interface BookCoverProps {
  src?: string
  alt?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  inLibrary?: boolean
}

export function BookCover({ src, alt = 'Book cover', className, size = 'md', inLibrary = false }: BookCoverProps) {
  const sizeClasses = {
    sm: 'w-8 h-12',
    md: 'w-12 h-16', 
    lg: 'w-16 h-24'
  }

  if (!src) {
    return (
      <div className={cn(
        'relative flex items-center justify-center bg-muted border border-border rounded-sm',
        sizeClasses[size],
        className
      )}>
        <BookOpen className={cn(
          'text-muted-foreground',
          size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'
        )} />
        {inLibrary && (
          <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5 border-2 border-background shadow-sm">
            <Check className="w-2.5 h-2.5" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn(
      'relative overflow-hidden rounded-sm border border-border bg-muted',
      sizeClasses[size],
      className
    )}>
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        onError={(e) => {
          // Hide the image and show fallback on error
          const target = e.target as HTMLImageElement
          target.style.display = 'none'
          const parent = target.parentElement
          if (parent) {
            parent.innerHTML = `
              <div class="w-full h-full flex items-center justify-center">
                <svg class="text-muted-foreground ${size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                </svg>
              </div>
              ${inLibrary ? '<div class="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5 border-2 border-background shadow-sm"><svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></div>' : ''}
            `
          }
        }}
      />
      {inLibrary && (
        <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5 border-2 border-background shadow-sm">
          <Check className="w-2.5 h-2.5" />
        </div>
      )}
    </div>
  )
}
