import { useState } from 'react';

interface BookMetadata {
  title: string;
  authors: string;
  comments: string;
  tags: string;
  series: string;
  publisher: string;
}

interface MetadataEditResponse {
  book_id: number;
  metadata: BookMetadata;
  csrf_token: string;
}

interface UpdateResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: string[];
}

export const useMetadataEdit = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMetadata = async (bookId: number): Promise<MetadataEditResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cwa/library/books/${bookId}/edit`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load metadata';
      setError(errorMessage);
      console.error('Error loading metadata:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const updateMetadata = async (
    bookId: number, 
    metadata: BookMetadata, 
    csrfToken: string
  ): Promise<boolean> => {
    setIsLoading(true);
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

      const data: UpdateResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Update failed');
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update metadata';
      setError(errorMessage);
      console.error('Error updating metadata:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    loadMetadata,
    updateMetadata,
    isLoading,
    error,
    clearError: () => setError(null)
  };
};

export type { BookMetadata, MetadataEditResponse };
