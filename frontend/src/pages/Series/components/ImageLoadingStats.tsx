import React from 'react'
import { Badge } from '../../../components/ui/badge'

interface ImageLoadingStatsProps {
  stats: {
    total: number
    loaded: number
    loading: number
  }
  visible?: boolean
}

export function ImageLoadingStats({ stats, visible = false }: ImageLoadingStatsProps) {
  if (!visible || stats.total === 0) return null

  const percentLoaded = Math.round((stats.loaded / stats.total) * 100)
  
  return (
    <div className="fixed bottom-4 left-4 z-50">
      <Badge variant="secondary" className="text-xs space-x-2">
        <span>Images:</span>
        <span className="text-green-600">{stats.loaded}</span>
        <span>/</span>
        <span>{stats.total}</span>
        <span>({percentLoaded}%)</span>
        {stats.loading > 0 && (
          <>
            <span>•</span>
            <span className="text-blue-600">Loading: {stats.loading}</span>
          </>
        )}
      </Badge>
    </div>
  )
}
