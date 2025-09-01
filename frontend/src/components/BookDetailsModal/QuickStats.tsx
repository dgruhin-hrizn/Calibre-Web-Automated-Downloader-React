import { Star } from 'lucide-react'

interface QuickStatsProps {
  publishedDate?: string
  pageCount?: number
  averageRating?: number
  ratingsCount?: number
  format?: string
  size?: string
}

export function QuickStats({ 
  publishedDate, 
  pageCount, 
  averageRating, 
  ratingsCount, 
  format, 
  size 
}: QuickStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {publishedDate && (
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-foreground">
            {publishedDate}
          </div>
          <div className="text-xs text-muted-foreground">Published</div>
        </div>
      )}
      
      {pageCount && (
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-foreground">
            {pageCount}
          </div>
          <div className="text-xs text-muted-foreground">Pages</div>
        </div>
      )}

      {averageRating && (
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 mr-1" />
            <span className="text-lg font-bold text-foreground">
              {averageRating.toFixed(1)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {ratingsCount || 0} reviews
          </div>
        </div>
      )}

      {(format || size) && (
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-foreground">
            {format || 'Digital'}
          </div>
          <div className="text-xs text-muted-foreground">
            {size || 'Format'}
          </div>
        </div>
      )}
    </div>
  )
}
