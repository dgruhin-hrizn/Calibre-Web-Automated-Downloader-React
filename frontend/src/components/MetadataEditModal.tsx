import React, { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Save, Loader2, Star } from 'lucide-react';
import Editor from 'react-simple-wysiwyg';
import CoverUpload, { type CoverUploadRef } from './CoverUpload';
import { Button } from './ui/Button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { cn } from '../lib/utils';
import { imageCache } from '../lib/imageCache';

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
  onSave: () => Promise<void>;
  isRefreshing?: boolean;
}

const MetadataEditModal: React.FC<MetadataEditModalProps> = ({
  bookId,
  isOpen,
  onClose,
  onSave,
  isRefreshing = false
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
  const coverUploadRef = useRef<CoverUploadRef>(null);
  
  // Simple function to update cover images with timestamp
  const handleCoverUpdated = (bookId: number) => {
    const timestamp = Date.now()
    const baseUrl = `/api/metadata/books/${bookId}/cover`
    
    // 1. Invalidate the image cache for this book's cover
    imageCache.invalidateUrl(baseUrl)
    
    // 2. Update all regular cover images with a timestamp to force reload
    const coverImages = document.querySelectorAll(`img[src*="${baseUrl}"]`) as NodeListOf<HTMLImageElement>
    
    coverImages.forEach((img) => {
      const url = new URL(img.src, window.location.origin)
      url.searchParams.set('t', timestamp.toString())
      img.src = url.toString()
    })
    
    // 3. Force re-render of CachedImage components by dispatching a custom event
    // This will trigger useEffect in CachedImage components that listen for cover updates
    const event = new CustomEvent('coverUpdated', { 
      detail: { bookId, baseUrl, timestamp } 
    })
    window.dispatchEvent(event)
  }

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
      // First, save the metadata to CWA
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
          // If there's a cover selected, upload it before triggering refresh
          if (coverUploadRef.current?.hasSelection) {
            try {
              await coverUploadRef.current.uploadSelected();
            } catch (coverError) {
              console.error('[MetadataEditModal] Cover upload failed:', coverError);
              // Don't fail the whole save for cover upload errors
            }
          }
          
          // Metadata saved successfully, now trigger the refresh process
          await onSave(); // This will handle the refresh and close the modal
        } else {
          setError(data.error || 'Failed to update metadata');
          setIsSaving(false);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update metadata');
        setIsSaving(false);
      }
    } catch (err) {
      setError('Network error saving metadata');
      console.error('Error saving metadata:', err);
      setIsSaving(false);
    }
    // Note: setIsSaving(false) is handled by parent after successful refresh
  };

  const handleInputChange = (field: keyof BookMetadata, value: string) => {
    setMetadata(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg max-h-[90vh] flex flex-col">
          {/* Header - Fixed */}
          <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
            <div>
              <Dialog.Title className="text-lg font-semibold text-foreground">
                Edit Book Metadata
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground mt-1">
                Update the book's title, authors, description, and other metadata fields.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={isSaving || isRefreshing}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </Dialog.Close>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading metadata...</span>
              </div>
            ) : (
              <div className="pb-4">
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md mb-6">
                    {error}
                  </div>
                )}

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column - Cover */}
                  <div className="lg:col-span-1 space-y-6">
                    {/* Cover Upload */}
                    <div>
                      <CoverUpload
                        ref={coverUploadRef}
                        bookId={bookId}
                        currentCoverUrl={`/api/metadata/books/${bookId}/cover`}
                        previewOnly={true}
                        onCoverUpdated={() => {
                          // Simple cover image update with timestamp
                          handleCoverUpdated(bookId);
                        }}
                      />
                    </div>
                  </div>

                  {/* Right Column - Other Metadata */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Title */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Title
                      </label>
                      <Input
                        value={metadata.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        placeholder="Book title"
                      />
                    </div>

                    {/* Authors */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Authors
                      </label>
                      <Input
                        value={metadata.authors}
                        onChange={(e) => handleInputChange('authors', e.target.value)}
                        placeholder="Author names (separate multiple authors with &)"
                      />
                    </div>

                    {/* Rating */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Rating
                      </label>
                      <div className="flex items-center space-x-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Button
                            key={star}
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleInputChange('rating', star.toString())}
                            className={cn(
                              "h-8 w-8 p-0 transition-colors",
                              parseInt(metadata.rating) >= star
                                ? 'text-yellow-500 hover:text-yellow-600'
                                : 'text-muted-foreground hover:text-yellow-400'
                            )}
                          >
                            <Star className={cn(
                              "w-5 h-5",
                              parseInt(metadata.rating) >= star ? 'fill-current' : ''
                            )} />
                          </Button>
                        ))}
                        {metadata.rating && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleInputChange('rating', '')}
                            className="ml-2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Description
                      </label>
                      <div className="border border-input rounded-md overflow-hidden [&_.rsww-editor]:bg-background [&_.rsww-editor]:text-foreground [&_.rsww-editor]:border-none [&_.rsww-toolbar]:bg-muted [&_.rsww-toolbar]:border-border [&_.rsww-toolbar]:text-foreground [&_.rsww-toolbar_button]:text-muted-foreground [&_.rsww-toolbar_button:hover]:text-foreground [&_.rsww-toolbar_button:hover]:bg-accent [&_.rsww-toolbar_select]:bg-background [&_.rsww-toolbar_select]:text-foreground [&_.rsww-toolbar_select]:border-input">
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

                    {/* Series and Series Index Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Series */}
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          Series
                        </label>
                        <Input
                          value={metadata.series}
                          onChange={(e) => handleInputChange('series', e.target.value)}
                          placeholder="Series name"
                        />
                      </div>
                      
                      {/* Series Index */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          Book #
                        </label>
                        <Input
                          type="number"
                          step="0.1"
                          value={metadata.series_index}
                          onChange={(e) => handleInputChange('series_index', e.target.value)}
                          placeholder="1"
                        />
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Tags
                      </label>
                      <Input
                        value={metadata.tags}
                        onChange={(e) => handleInputChange('tags', e.target.value)}
                        placeholder="Tags (separate with commas)"
                      />
                    </div>

                    {/* Publisher and Publication Date Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Publisher */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          Publisher
                        </label>
                        <Input
                          value={metadata.publisher}
                          onChange={(e) => handleInputChange('publisher', e.target.value)}
                          placeholder="Publisher name"
                        />
                      </div>

                      {/* Publication Date */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          Publication Date
                        </label>
                        <Input
                          type="date"
                          value={metadata.pubdate}
                          onChange={(e) => handleInputChange('pubdate', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Language and ISBN Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Language */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          Language
                        </label>
                        <select
                          value={metadata.language}
                          onChange={(e) => handleInputChange('language', e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">Select Language</option>
                          <option value="eng">English</option>
                          <option value="spa">Spanish</option>
                          <option value="fra">French</option>
                          <option value="deu">German</option>
                          <option value="ita">Italian</option>
                          <option value="por">Portuguese</option>
                          <option value="rus">Russian</option>
                          <option value="jpn">Japanese</option>
                          <option value="kor">Korean</option>
                          <option value="chi">Chinese</option>
                          <option value="ara">Arabic</option>
                          <option value="hin">Hindi</option>
                          <option value="ben">Bengali</option>
                          <option value="nld">Dutch</option>
                          <option value="swe">Swedish</option>
                          <option value="nor">Norwegian</option>
                          <option value="dan">Danish</option>
                          <option value="fin">Finnish</option>
                          <option value="pol">Polish</option>
                          <option value="cze">Czech</option>
                          <option value="hun">Hungarian</option>
                          <option value="tur">Turkish</option>
                          <option value="gre">Greek</option>
                          <option value="heb">Hebrew</option>
                          <option value="tha">Thai</option>
                          <option value="vie">Vietnamese</option>
                          <option value="ind">Indonesian</option>
                          <option value="msa">Malay</option>
                          <option value="ukr">Ukrainian</option>
                          <option value="bul">Bulgarian</option>
                          <option value="hrv">Croatian</option>
                          <option value="srp">Serbian</option>
                          <option value="slv">Slovenian</option>
                          <option value="slk">Slovak</option>
                          <option value="ron">Romanian</option>
                          <option value="cat">Catalan</option>
                          <option value="eus">Basque</option>
                          <option value="glg">Galician</option>
                        </select>
                      </div>

                      {/* ISBN */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          ISBN
                        </label>
                        <Input
                          value={metadata.isbn}
                          onChange={(e) => handleInputChange('isbn', e.target.value)}
                          placeholder="ISBN-10 or ISBN-13"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer - Fixed */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-border flex-shrink-0">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSaving || isRefreshing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || isRefreshing || isLoading}
            >
              {isSaving && !isRefreshing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : isRefreshing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving Metadata...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default MetadataEditModal;
