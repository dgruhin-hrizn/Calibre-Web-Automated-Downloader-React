import { CircularProgress } from '../ui/CircularProgress'
import { Button } from '../ui/Button'

interface ModalFooterProps {
  downloadStatus?: any
  isDownloading: boolean
  onDownload: () => void
}

export function ModalFooter({ downloadStatus, isDownloading, onDownload }: ModalFooterProps) {
  const hasRealProgress = downloadStatus && (
    downloadStatus.progress > 0 || 
    downloadStatus.status === 'completed' || 
    downloadStatus.status === 'error' ||
    downloadStatus.status === 'processing' ||
    downloadStatus.status === 'waiting'
  )
  const isPending = isDownloading || (downloadStatus && downloadStatus.status === 'downloading' && (downloadStatus.progress || 0) === 0)

  const renderDownloadButton = () => {
    if (downloadStatus?.status === 'completed') {
      return (
        <Button disabled>
          <div className="mr-2">
            <CircularProgress 
              progress={100} 
              status="completed" 
              size={16} 
              showPercentage={false}
            />
          </div>
          Downloaded
        </Button>
      )
    }

    if (downloadStatus?.status === 'error') {
      return (
        <Button disabled>
          <div className="mr-2">
            <CircularProgress 
              progress={0} 
              status="error" 
              size={16} 
              showPercentage={false}
            />
          </div>
          Failed
        </Button>
      )
    }

    if (hasRealProgress) {
      const status = downloadStatus.status === 'processing' ? 'processing' :
                    downloadStatus.status === 'waiting' ? 'waiting' : 'downloading'
      return (
        <Button disabled>
          <div className="mr-2">
            <CircularProgress 
              progress={downloadStatus.progress || 0} 
              status={status}
              size={16} 
              showPercentage={downloadStatus.status === 'downloading' && downloadStatus.progress > 0}
            />
          </div>
          {status === 'processing' ? 'Processing...' :
           status === 'waiting' ? 'Waiting...' :
           `${Math.round(downloadStatus.progress || 0)}% Downloading`}
        </Button>
      )
    }

    if (isPending) {
      return (
        <Button disabled>
          <div className="mr-2">
            <CircularProgress 
              progress={0} 
              status="downloading" 
              size={16} 
              showPercentage={false}
            />
          </div>
          Adding...
        </Button>
      )
    }

    return (
      <Button onClick={onDownload}>
        Download
      </Button>
    )
  }

  return (
    <div className="border-t border-border p-6 bg-muted/30">
      <div className="flex justify-end gap-3">
        {renderDownloadButton()}
      </div>
    </div>
  )
}
