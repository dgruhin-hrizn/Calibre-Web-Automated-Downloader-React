import React from 'react';
import { Card, CardContent } from '../ui/card';

interface DownloadSettingsProps {
  localSettings: any;
  onSettingsChange: (settings: any) => void;
}

export const DownloadSettings: React.FC<DownloadSettingsProps> = ({
  localSettings,
  onSettingsChange
}) => {
  if (!localSettings) return null;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold">Download Settings</h3>
          <p className="text-sm text-muted-foreground">
            Configure download behavior and limits
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Max Concurrent Downloads
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={localSettings.downloads?.max_concurrent_downloads || 3}
                onChange={(e) => onSettingsChange({
                  ...localSettings,
                  downloads: { ...localSettings.downloads, max_concurrent_downloads: parseInt(e.target.value) }
                })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Number of books to download simultaneously (1-10)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Max Concurrent Conversions
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={localSettings.downloads?.max_concurrent_conversions || 2}
                onChange={(e) => onSettingsChange({
                  ...localSettings,
                  downloads: { ...localSettings.downloads, max_concurrent_conversions: parseInt(e.target.value) }
                })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Number of books to convert simultaneously (1-5)
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Download Retry Attempts
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={localSettings.downloads?.retry_attempts || 3}
                onChange={(e) => onSettingsChange({
                  ...localSettings,
                  downloads: { ...localSettings.downloads, retry_attempts: parseInt(e.target.value) }
                })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Number of times to retry failed downloads
              </p>
            </div>

            <div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={localSettings.downloads?.cleanup_temp_files || false}
                  onChange={(e) => onSettingsChange({
                    ...localSettings,
                    downloads: { ...localSettings.downloads, cleanup_temp_files: e.target.checked }
                  })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <span className="font-medium">Cleanup Temporary Files</span>
              </label>
              <p className="text-sm text-muted-foreground ml-7">
                Automatically remove temporary files after processing
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
