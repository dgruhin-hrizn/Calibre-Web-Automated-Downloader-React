import { TrendingUp, Download, Crown } from 'lucide-react'
import { cn } from '../lib/utils'

// Import Google Font Squada One
const FONT_IMPORT = `
  @import url('https://fonts.googleapis.com/css2?family=Squada+One&display=swap');
`

// Inject font import
if (typeof document !== 'undefined' && !document.head.querySelector('style[data-squada-font]')) {
  const styleElement = document.createElement('style')
  styleElement.textContent = FONT_IMPORT
  styleElement.setAttribute('data-squada-font', 'true')
  document.head.appendChild(styleElement)
}

interface HotBookIndicatorProps {
  downloadCount?: number
  popularityRank?: number
  viewMode?: 'grid' | 'list'
}

export function HotBookIndicator({ downloadCount = 0, popularityRank, viewMode = 'grid' }: HotBookIndicatorProps) {
  const getRankIcon = (rank?: number) => {
    if (!rank) return <TrendingUp className="w-3 h-3" />
    
    if (rank === 1) return <Crown className="w-3 h-3 text-yellow-400" />
    if (rank <= 3) return <Crown className="w-3 h-3 text-orange-400" />
    if (rank <= 10) return <TrendingUp className="w-3 h-3 text-red-400" />
    return <TrendingUp className="w-3 h-3" />
  }

  const getRankBadgeStyle = () => {
    return "text-white/80 drop-shadow-[-3px_4px_4px_rgba(0,0,0,0.8)]"
  }

  if (viewMode === 'list') {
    return (
      <div className="flex items-center justify-end space-x-3 shrink-0">
        {/* Download Stats */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
            <Download className="w-4 h-4" />
            <span className="font-medium">{downloadCount}</span>
          </div>
          <div className="flex items-center space-x-1 text-sm">
            {getRankIcon(popularityRank)}
            <span className="font-medium">#{popularityRank || '?'}</span>
          </div>
        </div>

        {/* Rank Badge */}
        <div className={cn(
          "text-3xl leading-none [font-family:'Squada_One',Impact,'Arial_Black',sans-serif]",
          getRankBadgeStyle()
        )}>
          {String(popularityRank || '?').padStart(2, '0')}
        </div>
      </div>
    )
  }

  // Grid view - overlay badges (right-aligned)
  return (
    <>
      {/* Rank Badge - Top Right */}
      <div className={cn(
        "absolute -top-1 right-2 z-10 text-8xl leading-none [font-family:'Squada_One',Impact,'Arial_Black',sans-serif]",
        getRankBadgeStyle()      )}>
        {String(popularityRank || '?').padStart(2, '0')}
      </div>

      {/* Download Count Badge - Bottom Right */}
      <div className="absolute bottom-11 right-3 z-10 flex items-center space-x-1 bg-black/70 text-white px-2 py-1 rounded-full text-xs font-medium">
        <Download className="w-3 h-3" />
        <span>{downloadCount}</span>
      </div>

      {/* Hot Indicator - Right side, aligned with details button for top 10 */}
      {popularityRank && popularityRank <= 10 && (
        <div className="absolute bottom-4 right-3 z-10 flex items-center space-x-1 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold">
          <TrendingUp className="w-3 h-3" />
          <span>HOT</span>
        </div>
      )}
    </>
  )
}
