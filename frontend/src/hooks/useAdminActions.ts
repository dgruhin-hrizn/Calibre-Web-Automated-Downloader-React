import { useMutation } from '@tanstack/react-query'
import { apiRequest } from '../lib/utils'

interface RefreshThumbnailsResponse {
  success: boolean
  message?: string
  error?: string
}

export function useRefreshThumbnails() {
  return useMutation<RefreshThumbnailsResponse, Error>({
    mutationFn: async () => {
      const response = await apiRequest('/api/cwa/admin/refresh-thumbnails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      return response
    },
  })
}
