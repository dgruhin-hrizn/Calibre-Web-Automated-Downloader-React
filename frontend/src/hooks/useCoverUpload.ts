import { useState } from 'react';

interface CoverUploadResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export const useCoverUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadCoverFile = async (bookId: number, file: File): Promise<CoverUploadResponse | null> => {
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('cover_file', file);

      const response = await fetch(`/api/cwa/library/books/${bookId}/cover/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to upload cover');
        return null;
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const errorMessage = 'Network error uploading cover';
      setError(errorMessage);
      console.error('Error uploading cover:', err);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const uploadCoverFromUrl = async (bookId: number, coverUrl: string): Promise<CoverUploadResponse | null> => {
    setIsUploading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cwa/library/books/${bookId}/cover/url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cover_url: coverUrl
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update cover from URL');
        return null;
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const errorMessage = 'Network error updating cover from URL';
      setError(errorMessage);
      console.error('Error updating cover from URL:', err);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadCoverFile,
    uploadCoverFromUrl,
    isUploading,
    error
  };
};
