import { useQueryClient } from '@tanstack/react-query'

/**
 * Global hook for invalidating library cache from anywhere in the app
 * Useful for invalidating library data after uploads or other operations
 */
export function useGlobalLibraryCache() {
  const queryClient = useQueryClient()

  const invalidateLibraryBooks = () => {
    queryClient.invalidateQueries({ queryKey: ['library', 'books'] })
    queryClient.invalidateQueries({ queryKey: ['library', 'infinite'] })
  }

  const invalidateLibraryStats = () => {
    queryClient.invalidateQueries({ queryKey: ['library', 'stats'] })
  }

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['library'] })
  }

  const invalidateAfterUpload = () => {
    // After books are uploaded to ingest, they'll be processed by CWA
    // We need to invalidate all library caches so the new books appear
    invalidateAll()
  }

  return {
    invalidateLibraryBooks,
    invalidateLibraryStats,
    invalidateAll,
    invalidateAfterUpload
  }
}
