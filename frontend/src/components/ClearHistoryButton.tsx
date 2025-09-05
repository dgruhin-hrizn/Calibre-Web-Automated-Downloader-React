import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Trash2, X } from 'lucide-react'
import { Button } from './ui/Button'
import { useClearDownloadHistory } from '../hooks/useDownloads'

interface ClearHistoryButtonProps {
  className?: string
}

export function ClearHistoryButton({ className }: ClearHistoryButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const clearHistory = useClearDownloadHistory()

  const handleClearHistory = () => {
    clearHistory.mutate(undefined, {
      onSuccess: (data) => {
        setIsOpen(false)
        // Optional: Show success message
        console.log(`Successfully cleared ${data.cleared} download history records`)
      },
      onError: (error) => {
        console.error('Failed to clear download history:', error)
        // Keep dialog open on error so user can retry
      }
    })
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300 ${className}`}
          disabled={clearHistory.isPending}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear History
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 w-full max-w-md z-50 border">
          <Dialog.Title className="text-lg font-semibold text-gray-900 mb-2">
            Clear Download History
          </Dialog.Title>
          
          <Dialog.Description className="text-gray-600 mb-6">
            This will permanently delete all your download history records. This action cannot be undone.
            <br />
            <br />
            <strong>Note:</strong> This only clears your download history - it won't affect your actual downloaded books or the current download queue.
          </Dialog.Description>

          <div className="flex justify-end gap-3">
            <Dialog.Close asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={clearHistory.isPending}
              >
                Cancel
              </Button>
            </Dialog.Close>
            
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearHistory}
              disabled={clearHistory.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {clearHistory.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear History
                </>
              )}
            </Button>
          </div>

          <Dialog.Close asChild>
            <button
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
