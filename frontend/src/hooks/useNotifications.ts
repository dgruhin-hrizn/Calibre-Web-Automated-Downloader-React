import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../lib/utils'

export interface Notification {
  id: string
  type: 'download_completed' | 'download_failed' | 'download_started'
  title: string
  message: string
  timestamp: number
  book_id?: string
  book_title?: string
  book_author?: string
  cover_url?: string
  auto_hide?: boolean
  duration?: number
}

interface NotificationsResponse {
  notifications: Notification[]
  count: number
}

export function useRecentNotifications(limit: number = 10) {
  return useQuery({
    queryKey: ['recentNotifications', limit],
    queryFn: async (): Promise<NotificationsResponse> => {
      const response = await apiRequest(`/api/notifications/recent?limit=${limit}`)
      return response
    },
    refetchInterval: 2000, // Poll every 2 seconds for immediate notifications
    refetchIntervalInBackground: true,
  })
}
