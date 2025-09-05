import { Send, Check, X, Loader2 } from 'lucide-react'
import { Button } from '../../ui/Button'
import { type UnifiedBook } from '../types'

interface KindleButtonProps {
  book: UnifiedBook
  kindleState: 'idle' | 'sending' | 'success' | 'failed'
  showKindleButton: boolean
  onSendToKindle: (book: UnifiedBook) => void
  className?: string
}

export function KindleButton({ 
  book, 
  kindleState, 
  showKindleButton, 
  onSendToKindle, 
  className 
}: KindleButtonProps) {
  if (!showKindleButton || !book.formats || book.formats.length === 0) {
    return null
  }

  const getButtonProps = () => {
    switch (kindleState) {
      case 'sending':
        return {
          variant: 'outline' as const,
          disabled: true,
          className: `${className} cursor-not-allowed`,
          children: (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="ml-1 text-xs">Sending...</span>
            </>
          )
        }
      case 'success':
        return {
          variant: 'outline' as const,
          disabled: true,
          className: `${className} bg-green-50 border-green-200 text-green-700 cursor-default`,
          children: (
            <>
              <Check className="h-4 w-4" />
              <span className="ml-1 text-xs">Sent</span>
            </>
          )
        }
      case 'failed':
        return {
          variant: 'outline' as const,
          disabled: true,
          className: `${className} bg-red-50 border-red-200 text-red-700 cursor-default`,
          children: (
            <>
              <X className="h-4 w-4" />
              <span className="ml-1 text-xs">Failed</span>
            </>
          )
        }
      default:
        return {
          variant: 'outline' as const,
          disabled: false,
          className,
          onClick: () => onSendToKindle(book),
          children: <Send className="h-4 w-4" />
        }
    }
  }

  const buttonProps = getButtonProps()
  
  return (
    <Button size="sm" {...buttonProps} />
  )
}
