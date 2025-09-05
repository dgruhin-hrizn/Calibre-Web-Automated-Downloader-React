import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/utils';

export interface ConversionSettings {
  enabled: boolean;
  target_format: string;
  supported_formats: string[];
  quality: 'low' | 'medium' | 'high';
  preserve_cover: boolean;
  preserve_metadata: boolean;
  timeout_seconds: number;
}

export interface DownloadSettings {
  max_concurrent_downloads: number;
  max_concurrent_conversions: number;
  retry_attempts: number;
  timeout_seconds: number;
  cleanup_temp_files: boolean;
}

export interface AppSettings {
  conversion: ConversionSettings;
  downloads: DownloadSettings;
  calibre_library_path: string;
}

export interface CalibreTestResult {
  success: boolean;
  available: boolean;
  ebook_convert_version?: string;
  calibredb_version?: string;
  message: string;
  error?: string;
}

export interface ConversionStatus {
  success: boolean;
  conversion_manager_running: boolean;
  active_jobs: Record<string, any>;
  library_stats: {
    total_books: number;
    formats: Record<string, number>;
  };
}

export const useAdminSettings = () => {
  return useQuery<AppSettings>({
    queryKey: ['adminSettings'],
    queryFn: async () => {
      const response = await apiRequest('/api/admin/settings');
      return response.settings;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
};

export const useUpdateAdminSettings = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (settings: Partial<AppSettings>) => {
      const response = await apiRequest('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      return response;
    },
    onSuccess: (data) => {
      // Update the cache with the new settings
      queryClient.setQueryData(['adminSettings'], data.settings);
      queryClient.invalidateQueries({ queryKey: ['adminSettings'] });
    },
  });
};

export const useTestCalibre = () => {
  return useMutation<CalibreTestResult>({
    mutationFn: async () => {
      const response = await apiRequest('/api/admin/settings/test-conversion', {
        method: 'POST',
      });
      return response;
    },
  });
};

export const useConversionStatus = () => {
  return useQuery<ConversionStatus>({
    queryKey: ['conversionStatus'],
    queryFn: async () => {
      const response = await apiRequest('/api/admin/conversion/status');
      return response;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refresh every 30 seconds
    retry: 1,
  });
};
