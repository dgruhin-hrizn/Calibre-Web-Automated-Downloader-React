import { Check, X } from 'lucide-react'

interface CircularProgressProps {
  progress: number
  status: 'downloading' | 'processing' | 'waiting' | 'completed' | 'error' | 'idle'
  size?: number
  strokeWidth?: number
  showPercentage?: boolean
  showText?: boolean
}

export function CircularProgress({ 
  progress, 
  status, 
  size = 20, 
  strokeWidth = 2,
  showPercentage = false,
  showText = false
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  if (status === 'completed') {
    return (
      <div className="flex items-center gap-2">
        <div 
          className="flex items-center justify-center bg-green-100 rounded-full"
          style={{ width: size, height: size }}
        >
          <Check className="text-green-600" style={{ width: size * 0.6, height: size * 0.6 }} />
        </div>
        {showText && <span className="text-sm font-medium text-green-600">Complete</span>}
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2">
        <div 
          className="flex items-center justify-center bg-destructive/10 rounded-full"
          style={{ width: size, height: size }}
        >
          <X className="text-destructive" style={{ width: size * 0.6, height: size * 0.6 }} />
        </div>
        {showText && <span className="text-sm font-medium text-destructive">Failed</span>}
      </div>
    )
  }

  if (status === 'processing') {
    return (
      <div className="flex items-center gap-2">
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            className="animate-spin"
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="opacity-25"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * 0.75}
              className="text-purple-600"
            />
          </svg>
        </div>
        {showText && <span className="text-sm font-medium text-purple-600">Processing...</span>}
      </div>
    )
  }

  if (status === 'waiting') {
    return (
      <div className="flex items-center gap-2">
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            className="animate-pulse"
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="opacity-25"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * 0.5}
              className="text-blue-600"
            />
          </svg>
        </div>
        {showText && <span className="text-sm font-medium text-blue-600">Waiting...</span>}
      </div>
    )
  }

  if (status === 'downloading') {
    return (
      <div className="flex items-center gap-2">
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            className="-rotate-90"
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
          >
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="opacity-25"
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-300 text-primary"
            />
          </svg>
        </div>
        {showPercentage && (
          <span className="text-xs font-medium text-primary">
            {Math.round(progress)}%
          </span>
        )}
        {showText && (
          <span className="text-sm font-medium text-primary">
            Downloading
          </span>
        )}
      </div>
    )
  }

  // Idle state - just return null or a placeholder
  return null
}
