// React hooks for CWA (Calibre-Web-Automated) integration

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/utils';

// Types
export interface CWAStatus {
  connected: boolean;
  base_url: string;
  authenticated: boolean;
}

export interface CWABook {
  id: number;
  title: string;
  author: string;
  cover_url?: string;
  formats: string[];
  series?: string;
  series_index?: number;
  description?: string;
  published_date?: string;
  rating?: number;
  tags?: string[];
}

export interface CWABooksResponse {
  books: CWABook[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface CWASearchResponse {
  books: CWABook[];
  total: number;
  query: string;
  page: number;
}

export interface CWAAuthor {
  id: number;
  name: string;
  book_count: number;
}

export interface CWASeries {
  id: number;
  name: string;
  book_count: number;
}

export interface CWACategory {
  id: number;
  name: string;
  book_count: number;
}

// Hooks

/**
 * Check CWA instance connection status
 */
export function useCWAStatus() {
  return useQuery<CWAStatus>({
    queryKey: ['cwa', 'status'],
    queryFn: () => apiRequest('/api/cwa/status'),
    staleTime: 30000, // 30 seconds
    retry: 2,
  });
}

/**
 * Get books from CWA library with pagination
 */
export function useCWABooks(page = 1, perPage = 18, sort = 'new') {
  return useQuery<CWABooksResponse>({
    queryKey: ['cwa', 'books', { page, perPage, sort }],
    queryFn: () => apiRequest('/api/cwa/books', {
      method: 'GET',
      params: { page, per_page: perPage, sort }
    }),
    enabled: page > 0, // Only run if page is valid
    staleTime: 60000, // 1 minute
  });
}

/**
 * Search books in CWA library
 */
export function useCWASearch() {
  return useMutation<CWASearchResponse, Error, { query: string; page?: number }>({
    mutationFn: ({ query, page = 1 }) => 
      apiRequest('/api/cwa/search', {
        method: 'GET',
        params: { query, page }
      }),
  });
}

/**
 * Get detailed book information
 */
export function useCWABookDetails(bookId: number | null) {
  return useQuery<CWABook>({
    queryKey: ['cwa', 'book', bookId],
    queryFn: () => apiRequest(`/api/cwa/book/${bookId}`),
    enabled: !!bookId,
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Get available formats for a book
 */
export function useCWABookFormats(bookId: number | null) {
  return useQuery<{ formats: string[] }>({
    queryKey: ['cwa', 'book', bookId, 'formats'],
    queryFn: () => apiRequest(`/api/cwa/book/${bookId}/formats`),
    enabled: !!bookId,
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Get reader URL for a book
 */
export function useCWAReaderUrl() {
  return useMutation<{ reader_url: string; book_id: number; format: string }, Error, { bookId: number; format?: string }>({
    mutationFn: ({ bookId, format = 'epub' }) =>
      apiRequest(`/api/cwa/book/${bookId}/reader`, {
        method: 'GET',
        params: { format }
      }),
  });
}

/**
 * Get book cover URL
 */
export function useCWABookCover(bookId: number | null) {
  return useQuery<{ cover_url: string; book_id: number }>({
    queryKey: ['cwa', 'book', bookId, 'cover'],
    queryFn: () => apiRequest(`/api/cwa/book/${bookId}/cover`),
    enabled: !!bookId,
    staleTime: 3600000, // 1 hour (covers don't change often)
  });
}

/**
 * Download a book in specified format
 */
export function useCWADownloadBook() {
  return useMutation<Blob, Error, { bookId: number; format: string }>({
    mutationFn: async ({ bookId, format }) => {
      const response = await fetch(`/api/cwa/book/${bookId}/download/${format}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }
      
      return response.blob();
    },
  });
}

/**
 * Get authors from CWA library
 */
export function useCWAAuthors() {
  return useQuery<{ authors: CWAAuthor[] }>({
    queryKey: ['cwa', 'authors'],
    queryFn: () => apiRequest('/api/cwa/authors'),
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Get series from CWA library
 */
export function useCWASeries() {
  return useQuery<{ series: CWASeries[] }>({
    queryKey: ['cwa', 'series'],
    queryFn: () => apiRequest('/api/cwa/series'),
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Get categories from CWA library
 */
export function useCWACategories() {
  return useQuery<{ categories: CWACategory[] }>({
    queryKey: ['cwa', 'categories'],
    queryFn: () => apiRequest('/api/cwa/categories'),
    staleTime: 300000, // 5 minutes
  });
}

// Utility hooks

/**
 * Combined hook to check if CWA is available and connected
 */
export function useCWAAvailable() {
  const { data: status, isLoading } = useCWAStatus();
  
  return {
    isAvailable: status?.connected ?? false,
    isAuthenticated: status?.authenticated ?? false,
    baseUrl: status?.base_url,
    isLoading,
  };
}

/**
 * Hook to invalidate CWA-related queries (useful after operations that might change data)
 */
export function useCWAInvalidation() {
  const queryClient = useQueryClient();
  
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['cwa'] });
  };
  
  const invalidateBooks = () => {
    queryClient.invalidateQueries({ queryKey: ['cwa', 'books'] });
  };
  
  const invalidateBook = (bookId: number) => {
    queryClient.invalidateQueries({ queryKey: ['cwa', 'book', bookId] });
  };
  
  const invalidateSearch = () => {
    queryClient.invalidateQueries({ queryKey: ['cwa', 'search'] });
  };
  
  return {
    invalidateAll,
    invalidateBooks,
    invalidateBook,
    invalidateSearch,
  };
}

