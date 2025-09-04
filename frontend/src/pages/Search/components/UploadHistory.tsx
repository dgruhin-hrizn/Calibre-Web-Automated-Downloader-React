import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, Loader2, Clock, FileText, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Badge } from '../../../components/ui/badge'

interface UploadRecord {
  id: number
  filename: string
  original_filename: string
  file_size: number
  file_size_formatted: string
  file_type: string
  status: 'uploading' | 'completed' | 'failed'
  started_at: string
  completed_at?: string
  error_message?: string
  session_id: string
}

interface UploadHistoryProps {
  onRefresh?: () => void
}

export function UploadHistory({ onRefresh }: UploadHistoryProps) {
  const [uploads, setUploads] = useState<UploadRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUploadHistory = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/uploads/history?limit=20', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setUploads(data.uploads || [])
        setError(null)
      } else {
        throw new Error('Failed to fetch upload history')
      }
    } catch (error) {
      console.error('Error fetching upload history:', error)
      setError('Failed to load upload history')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUploadHistory()
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      case 'uploading':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Completed</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Failed</Badge>
      case 'uploading':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Uploading</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Unknown</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString()
  }

  const getFileTypeColor = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case '.epub':
        return 'bg-purple-100 text-purple-800'
      case '.pdf':
        return 'bg-red-100 text-red-800'
      case '.mobi':
        return 'bg-orange-100 text-orange-800'
      case '.azw':
      case '.azw3':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Upload History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading upload history...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Upload History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchUploadHistory} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Upload History
          </CardTitle>
          <Button onClick={fetchUploadHistory} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {uploads.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No uploads yet</p>
            <p className="text-sm mt-1">Files you upload will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {uploads.map((upload) => (
              <div
                key={upload.id}
                className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  {getStatusIcon(upload.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm truncate" title={upload.original_filename}>
                        {upload.original_filename}
                      </p>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getFileTypeColor(upload.file_type)}`}
                      >
                        {upload.file_type.toUpperCase().replace('.', '')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{upload.file_size_formatted}</span>
                      <span>{formatDate(upload.started_at)}</span>
                      {upload.error_message && (
                        <span className="text-red-600 truncate" title={upload.error_message}>
                          {upload.error_message}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(upload.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
