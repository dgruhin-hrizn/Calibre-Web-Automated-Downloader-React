import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '../../../components/ui/Button'

interface LibraryHeaderProps {
  isAdmin: boolean
  onManageDuplicates: () => void
}

export function LibraryHeader({ isAdmin, onManageDuplicates }: LibraryHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Library</h1>
        <p className="text-muted-foreground">Browse your CWA library collection</p>
      </div>
      
      {/* Admin Controls */}
      {isAdmin && (
        <Button
          onClick={onManageDuplicates}
          variant="outline"
          className="flex items-center gap-2"
        >
          <AlertTriangle className="h-4 w-4" />
          Manage Duplicates
        </Button>
      )}
    </div>
  )
}
