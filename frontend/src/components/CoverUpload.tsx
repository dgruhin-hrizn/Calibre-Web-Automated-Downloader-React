import React, { useState, useRef } from 'react';
import { Upload, Link, Loader2, Image, X } from 'lucide-react';
import { useCoverUpload } from '../hooks/useCoverUpload';

interface CoverUploadProps {
  bookId: number;
  currentCoverUrl?: string;
  onCoverUpdated?: () => void;
}

const CoverUpload: React.FC<CoverUploadProps> = ({
  bookId,
  currentCoverUrl,
  onCoverUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'url'>('file');
  const [urlInput, setUrlInput] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { uploadCoverFile, uploadCoverFromUrl, isUploading, error } = useCoverUpload();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

    // Upload the file
    handleFileUpload(file);
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

    const result = await uploadCoverFromUrl(bookId, urlInput.trim());
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
  };

  const handleUrlPreview = () => {
    if (urlInput.trim() && (urlInput.startsWith('http://') || urlInput.startsWith('https://'))) {
      setPreviewUrl(urlInput.trim());
    }
  };

  const clearPreview = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Update Cover Image
        </h3>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('file')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'file'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Upload className="w-4 h-4 inline mr-2" />
          Upload File
        </button>
        <button
          onClick={() => setActiveTab('url')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'url'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Link className="w-4 h-4 inline mr-2" />
          From URL
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* File Upload Tab */}
      {activeTab === 'file' && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.bmp"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />
            <div className="space-y-2">
              <Upload className="w-8 h-8 mx-auto text-gray-400" />
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium disabled:opacity-50"
                >
                  Click to upload
                </button>
                <span className="text-gray-500 dark:text-gray-400"> or drag and drop</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                JPG, PNG, WebP, or BMP (max 10MB)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* URL Upload Tab */}
      {activeTab === 'url' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cover Image URL
            </label>
            <div className="flex space-x-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onBlur={handleUrlPreview}
                placeholder="https://example.com/cover.jpg"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={isUploading}
              />
              <button
                type="button"
                onClick={handleUrlUpload}
                disabled={isUploading || !urlInput.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Enter a direct link to an image file (JPG, PNG, WebP, or BMP)
            </p>
          </div>
        </div>
      )}

      {/* Preview */}
      {previewUrl && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Preview</h4>
            <button
              onClick={clearPreview}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex justify-center">
            <div className="relative w-32 h-48 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
              <img
                src={previewUrl}
                alt="Cover preview"
                className="w-full h-full object-cover"
                onError={() => setPreviewUrl(null)}
              />
              {isUploading && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Current Cover */}
      {currentCoverUrl && !previewUrl && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Cover</h4>
          <div className="flex justify-center">
            <div className="w-32 h-48 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
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
        </div>
      )}
    </div>
  );
};

export default CoverUpload;
