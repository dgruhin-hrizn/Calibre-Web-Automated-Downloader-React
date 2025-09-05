import { Eye } from 'lucide-react'
import { Button } from '../../ui/Button'
import { KindleButton } from './KindleButton'
import { type UnifiedBook } from '../types'

interface LibraryActionsProps {
  book: UnifiedBook
  viewMode: 'grid' | 'list'
  kindleState: 'idle' | 'sending' | 'success' | 'failed'
  showKindleButton: boolean
  onDetails?: (book: UnifiedBook) => void
  onSendToKindle: (book: UnifiedBook) => void
}

export function LibraryActions({
  book,
  viewMode,
  kindleState,
  showKindleButton,
  onDetails,
  onSendToKindle
}: LibraryActionsProps) {
  if (viewMode === 'list') {
    return (
      <div className="flex flex-col gap-2">
        {onDetails && (
          <Button size="sm" variant="outline" onClick={() => onDetails(book)}>
            <Eye className="h-4 w-4" />
          </Button>
        )}
        <KindleButton
          book={book}
          kindleState={kindleState}
          showKindleButton={showKindleButton}
          onSendToKindle={onSendToKindle}
        />
      </div>
    )
  } else {
    return (
      <div className="flex gap-1">
        {onDetails && (
          <Button size="sm" variant="outline" onClick={() => onDetails(book)} className="flex-1">
            <Eye className="h-4 w-4" />
          </Button>
        )}
        <KindleButton
          book={book}
          kindleState={kindleState}
          showKindleButton={showKindleButton}
          onSendToKindle={onSendToKindle}
          className="flex-1"
        />
      </div>
    )
  }
}
