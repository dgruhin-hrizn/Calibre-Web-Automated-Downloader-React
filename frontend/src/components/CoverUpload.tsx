import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { Upload, Link, Loader2, Image, X } from 'lucide-react';
import { useCoverUpload } from '../hooks/useCoverUpload';

interface CoverUploadProps {
  bookId: number;
  currentCoverUrl?: string;
  onCoverUpdated?: () => void;
  previewOnly?: boolean; // If true, only show preview, don't upload immediately
  onFileSelected?: (file: File) => void; // Callback when file is selected in preview mode
  onUrlSelected?: (url: string) => void; // Callback when URL is selected in preview mode
}

export interface CoverUploadRef {
  uploadSelected: () => Promise<any>;
  clearPreview: () => void;
  hasSelection: boolean;
}

const CoverUpload = forwardRef<CoverUploadRef, CoverUploadProps>(({
  bookId,
  currentCoverUrl,
  onCoverUpdated,
  previewOnly = false,
  onFileSelected,
  onUrlSelected
}, ref) => {
  const [activeTab, setActiveTab] = useState<'file' | 'url'>('file');
  const [urlInput, setUrlInput] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { uploadCoverFile, uploadCoverFromUrl, isUploading, error } = useCoverUpload();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    processSelectedFile(file);
  };

  const processSelectedFile = (file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp'];
    if (!validTypes.includes(file.type)) {
      alert('Please select a valid image file (JPG, PNG, WebP, or BMP)');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File size must be less than 10MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    if (previewOnly) {
      // In preview mode, just store the file and notify parent
      setSelectedFile(file);
      setSelectedUrl(null); // Clear URL selection
      onFileSelected?.(file);
    } else {
      // In immediate upload mode, upload the file
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    const result = await uploadCoverFile(bookId, file);
    if (result && result.success) {
      if (onCoverUpdated) {
        onCoverUpdated();
      }
      // Clear preview after successful upload
      setTimeout(() => {
        setPreviewUrl(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);
    }
  };

  const handleUrlUpload = async () => {
    if (!urlInput.trim()) {
      alert('Please enter a valid URL');
      return;
    }

    const url = urlInput.trim();

    if (previewOnly) {
      // In preview mode, just store the URL and show preview
      setPreviewUrl(url);
      setSelectedUrl(url);
      setSelectedFile(null); // Clear file selection
      onUrlSelected?.(url);
    } else {
      // In immediate upload mode, upload from URL
      const result = await uploadCoverFromUrl(bookId, url);
      if (result && result.success) {
        if (onCoverUpdated) {
          onCoverUpdated();
        }
        setUrlInput('');
        // Clear preview after successful upload
        setTimeout(() => {
          setPreviewUrl(null);
        }, 2000);
      }
    }
  };

  const handleUrlPreview = () => {
    if (urlInput.trim() && (urlInput.startsWith('http://') || urlInput.startsWith('https://'))) {
      setPreviewUrl(urlInput.trim());
    }
  };

  const clearPreview = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    setSelectedUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Method to upload the currently selected file/URL (for preview mode)
  const uploadSelected = async () => {
    if (selectedFile) {
      return await handleFileUpload(selectedFile);
    } else if (selectedUrl) {
      const result = await uploadCoverFromUrl(bookId, selectedUrl);
      if (result && result.success) {
        if (onCoverUpdated) {
          onCoverUpdated();
        }
        setUrlInput('');
        // Clear preview after successful upload
        setTimeout(() => {
          setPreviewUrl(null);
          setSelectedFile(null);
          setSelectedUrl(null);
        }, 2000);
      }
      return result;
    }
  };

  // Expose methods for parent component
  useImperativeHandle(ref, () => ({
    uploadSelected,
    clearPreview,
    hasSelection: selectedFile !== null || selectedUrl !== null
  }));

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the drop zone entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      processSelectedFile(file);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Cover - Display First */}
      {currentCoverUrl && !previewUrl && (
        <div className="space-y-3">
          <div className="w-full aspect-[2/3] bg-muted rounded-lg overflow-hidden">
            <img
              src={currentCoverUrl}
              alt="Current cover"
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
        </div>
      )}

      {/* Preview Cover - Display First if Available */}
      {previewUrl && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">Preview</h4>
            <button
              onClick={clearPreview}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="w-full aspect-[2/3] bg-muted rounded-lg overflow-hidden relative">
            <img
              src={previewUrl}
              alt="Cover preview"
              className="w-full h-full object-cover"
              onError={() => setPreviewUrl(null)}
            />
            {isUploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Update Cover Image
        </h3>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('file')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'file'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Upload className="w-4 h-4 inline mr-2" />
          Upload File
        </button>
        <button
          onClick={() => setActiveTab('url')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'url'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Link className="w-4 h-4 inline mr-2" />
          From URL
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* File Upload Tab */}
      {activeTab === 'file' && (
        <div className="space-y-4">
          <div 
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragOver 
                ? 'border-primary bg-primary/5 scale-105' 
                : 'border-border hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.bmp"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />
            <div className="space-y-2">
              <Upload className={`w-8 h-8 mx-auto transition-colors ${
                isDragOver ? 'text-primary' : 'text-muted-foreground'
              }`} />
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="text-primary hover:text-primary/80 font-medium disabled:opacity-50"
                >
                  Click to upload
                </button>
                <span className="text-muted-foreground"> or drag and drop</span>
              </div>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WebP, or BMP (max 10MB)
              </p>
              {isDragOver && (
                <p className="text-xs text-primary font-medium animate-pulse">
                  Drop your image here!
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* URL Upload Tab */}
      {activeTab === 'url' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Cover Image URL
            </label>
            <div className="flex space-x-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onBlur={handleUrlPreview}
                placeholder="https://example.com/cover.jpg"
                className="flex-1 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isUploading}
              />
              <button
                type="button"
                onClick={handleUrlUpload}
                disabled={isUploading || !urlInput.trim()}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-4 py-2"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Link className="w-4 h-4 mr-2" />
                    Update
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Enter a direct link to an image file (JPG, PNG, WebP, or BMP)
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

CoverUpload.displayName = 'CoverUpload';

export default CoverUpload;
export type { CoverUploadRef };
