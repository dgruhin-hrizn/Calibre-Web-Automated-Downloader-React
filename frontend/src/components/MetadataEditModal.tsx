import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Star } from 'lucide-react';
import Editor from 'react-simple-wysiwyg';
import CoverUpload from './CoverUpload';

interface BookMetadata {
  title: string;
  authors: string;
  comments: string;
  tags: string;
  series: string;
  series_index: string;
  publisher: string;
  rating: string;
  pubdate: string;
  language: string;
  isbn: string;
}

interface MetadataEditModalProps {
  bookId: number;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const MetadataEditModal: React.FC<MetadataEditModalProps> = ({
  bookId,
  isOpen,
  onClose,
  onSave
}) => {
  const [metadata, setMetadata] = useState<BookMetadata>({
    title: '',
    authors: '',
    comments: '',
    tags: '',
    series: '',
    series_index: '',
    publisher: '',
    rating: '',
    pubdate: '',
    language: '',
    isbn: ''
  });
  const [csrfToken, setCsrfToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current metadata when modal opens
  useEffect(() => {
    if (isOpen && bookId) {
      loadMetadata();
    }
  }, [isOpen, bookId]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const loadMetadata = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/cwa/library/books/${bookId}/edit`);
      if (response.ok) {
        const data = await response.json();
        setMetadata(data.metadata);
        setCsrfToken(data.csrf_token);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load metadata');
      }
    } catch (err) {
      setError('Network error loading metadata');
      console.error('Error loading metadata:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/cwa/library/books/${bookId}/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...metadata,
          csrf_token: csrfToken
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          onSave(); // Notify parent component
          onClose(); // Close modal
        } else {
          setError(data.error || 'Failed to update metadata');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update metadata');
      }
    } catch (err) {
      setError('Network error saving metadata');
      console.error('Error saving metadata:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof BookMetadata, value: string) => {
    setMetadata(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Edit Book Metadata
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-6 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600 dark:text-gray-300">Loading metadata...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={metadata.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Book title"
                />
              </div>

              {/* Authors */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Authors
                </label>
                <input
                  type="text"
                  value={metadata.authors}
                  onChange={(e) => handleInputChange('authors', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Author names (separate multiple authors with &)"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <div className="border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden [&_.rsww-editor]:bg-white [&_.rsww-editor]:dark:bg-gray-700 [&_.rsww-editor]:dark:text-white [&_.rsww-toolbar]:bg-gray-50 [&_.rsww-toolbar]:dark:bg-gray-800 [&_.rsww-toolbar]:dark:border-gray-600">
                  <Editor
                    value={metadata.comments}
                    onChange={(e) => handleInputChange('comments', e.target.value)}
                    placeholder="Book description..."
                    containerProps={{
                      style: {
                        minHeight: '120px',
                        resize: 'vertical'
                      }
                    }}
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tags
                </label>
                <input
                  type="text"
                  value={metadata.tags}
                  onChange={(e) => handleInputChange('tags', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Tags (separate with commas)"
                />
              </div>

              {/* Series and Series Index Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Series */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Series
                  </label>
                  <input
                    type="text"
                    value={metadata.series}
                    onChange={(e) => handleInputChange('series', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Series name"
                  />
                </div>
                
                {/* Series Index */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Book #
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={metadata.series_index}
                    onChange={(e) => handleInputChange('series_index', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="1"
                  />
                </div>
              </div>

              {/* Publisher */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Publisher
                </label>
                <input
                  type="text"
                  value={metadata.publisher}
                  onChange={(e) => handleInputChange('publisher', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Publisher name"
                />
              </div>

              {/* Rating */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rating
                </label>
                <div className="flex items-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleInputChange('rating', star.toString())}
                      className={`p-1 rounded transition-colors ${
                        parseInt(metadata.rating) >= star
                          ? 'text-yellow-400 hover:text-yellow-500'
                          : 'text-gray-300 dark:text-gray-600 hover:text-yellow-300'
                      }`}
                    >
                      <Star className={`w-6 h-6 ${parseInt(metadata.rating) >= star ? 'fill-current' : ''}`} />
                    </button>
                  ))}
                  {metadata.rating && (
                    <button
                      type="button"
                      onClick={() => handleInputChange('rating', '')}
                      className="ml-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Publication Date and Language Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Publication Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Publication Date
                  </label>
                  <input
                    type="date"
                    value={metadata.pubdate}
                    onChange={(e) => handleInputChange('pubdate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Language */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Language
                  </label>
                  <input
                    type="text"
                    value={metadata.language}
                    onChange={(e) => handleInputChange('language', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., English, Spanish, French"
                  />
                </div>
              </div>

              {/* ISBN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ISBN
                </label>
                <input
                  type="text"
                  value={metadata.isbn}
                  onChange={(e) => handleInputChange('isbn', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="ISBN-10 or ISBN-13"
                />
              </div>

              {/* Cover Upload */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <CoverUpload
                  bookId={bookId}
                  currentCoverUrl={`/api/metadata/books/${bookId}/cover`}
                  onCoverUpdated={() => {
                    // Refresh the cover image by adding a timestamp
                    const coverImages = document.querySelectorAll(`img[src*="/api/metadata/books/${bookId}/cover"]`);
                    coverImages.forEach((img) => {
                      const htmlImg = img as HTMLImageElement;
                      const url = new URL(htmlImg.src);
                      url.searchParams.set('t', Date.now().toString());
                      htmlImg.src = url.toString();
                    });
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer - Fixed */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MetadataEditModal;
