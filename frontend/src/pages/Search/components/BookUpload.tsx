import { useState, useRef } from 'react'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { useToast } from '../../../hooks/useToast'
import { useGlobalLibraryCache } from '../../../hooks/useGlobalLibraryCache'

interface BookUploadProps {
  onUploadComplete?: () => void
  onHistoryUpdate?: () => void
}

export function BookUpload({ onUploadComplete, onHistoryUpdate }: BookUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()
  const { invalidateAfterUpload } = useGlobalLibraryCache()

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const bookFiles = files.filter(file => 
      file.name.toLowerCase().endsWith('.epub') ||
      file.name.toLowerCase().endsWith('.pdf') ||
      file.name.toLowerCase().endsWith('.mobi') ||
      file.name.toLowerCase().endsWith('.azw') ||
      file.name.toLowerCase().endsWith('.azw3')
    )
    
    if (bookFiles.length === 0) {
      showToast({
        type: 'error',
        title: 'Invalid file types',
        message: 'Please drop valid book files (.epub, .pdf, .mobi, .azw, .azw3)'
      })
      return
    }
    
    await uploadBooks(bookFiles)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      uploadBooks(files)
    }
  }

  const uploadBooks = async (files: File[]) => {
    const fileNames = files.map(f => f.name)
    setUploadingFiles(fileNames)
    
    try {
      const formData = new FormData()
      files.forEach(file => {
        formData.append('books', file)
      })
      
      const response = await fetch('/api/ingest/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      })
      
      if (response.ok) {
        const result = await response.json()
        const uploadedFiles = result.uploaded || []
        const warnings = result.warnings || []
        
        // Show success message with uploaded files
        const fileList = uploadedFiles.map((file: string) => `• ${file}`).join('\n')
        const warningList = warnings.length > 0 ? `\n\nWarnings:\n${warnings.map((warning: string) => `• ${warning}`).join('\n')}` : ''
        
        showToast({
          type: 'success',
          title: `Successfully uploaded ${uploadedFiles.length} book(s)!`,
          message: fileList + warningList + '\n\nLibrary cache refreshed - new books will appear on next visit.',
          duration: 6000
        })
        
        // Invalidate library cache so new books appear when user visits library
        invalidateAfterUpload()
        
        onUploadComplete?.()
        onHistoryUpdate?.()
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Please try again'
      showToast({
        type: 'error',
        title: 'Upload failed',
        message: errorMessage
      })
    } finally {
      setUploadingFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-4 sm:p-6 text-center transition-colors ${
        isDragOver
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-muted-foreground/50'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".epub,.pdf,.mobi,.azw,.azw3"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {uploadingFiles.length > 0 ? (
        <div className="space-y-3">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
          <p className="font-medium">Uploading books...</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {uploadingFiles.map((fileName, index) => (
              <p key={index} className="text-sm text-muted-foreground flex items-center justify-center gap-2 break-words">
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{fileName}</span>
              </p>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Upload className="w-6 h-6 sm:w-8 sm:h-8 mx-auto text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium text-sm sm:text-base">
              Drag and drop book files here
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground px-2">
              Supports EPUB, PDF, MOBI, AZW, and AZW3 formats
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3"
          >
            <Upload className="w-4 h-4 mr-2" />
            Choose Files
          </Button>
        </div>
      )}
    </div>
  )
}
