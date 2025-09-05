import React from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/card';

interface ConversionSettingsProps {
  localSettings: any;
  onSettingsChange: (settings: any) => void;
  onSaveSettings: () => void;
  updateSettings: any;
  isSettingsLoading: boolean;
  settingsSaveMessage: string;
}

export const ConversionSettings: React.FC<ConversionSettingsProps> = ({
  localSettings,
  onSettingsChange,
  onSaveSettings,
  updateSettings,
  isSettingsLoading,
  settingsSaveMessage
}) => {
  if (!localSettings) return null;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Conversion Settings</h3>
            <p className="text-sm text-muted-foreground">
              Configure automatic book format conversion
            </p>
          </div>
          <div className="flex items-center gap-2">
            {settingsSaveMessage && (
              <span className={`text-sm ${
                settingsSaveMessage.includes('success') ? 'text-green-600' : 'text-red-600'
              }`}>
                {settingsSaveMessage}
              </span>
            )}
            <Button
              onClick={onSaveSettings}
              disabled={updateSettings.isPending || isSettingsLoading}
              className="flex items-center gap-2"
            >
              {updateSettings.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Save Settings
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={localSettings.conversion?.enabled || false}
                  onChange={(e) => onSettingsChange({
                    ...localSettings,
                    conversion: { ...localSettings.conversion, enabled: e.target.checked }
                  })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <span className="font-medium">Enable Automatic Conversion</span>
              </label>
              <p className="text-sm text-muted-foreground ml-7">
                Automatically convert non-EPUB books to EPUB format
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Target Format
              </label>
              <select
                value={localSettings.conversion?.target_format || 'epub'}
                onChange={(e) => onSettingsChange({
                  ...localSettings,
                  conversion: { ...localSettings.conversion, target_format: e.target.value }
                })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                disabled={!localSettings.conversion?.enabled}
              >
                <option value="epub">EPUB</option>
                <option value="pdf">PDF</option>
                <option value="mobi">MOBI</option>
                <option value="azw3">AZW3</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Conversion Quality
              </label>
              <select
                value={localSettings.conversion?.quality || 'high'}
                onChange={(e) => onSettingsChange({
                  ...localSettings,
                  conversion: { ...localSettings.conversion, quality: e.target.value as 'low' | 'medium' | 'high' }
                })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                disabled={!localSettings.conversion?.enabled}
              >
                <option value="low">Low (Faster)</option>
                <option value="medium">Medium</option>
                <option value="high">High (Better Quality)</option>
              </select>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={localSettings.conversion?.preserve_cover || false}
                  onChange={(e) => onSettingsChange({
                    ...localSettings,
                    conversion: { ...localSettings.conversion, preserve_cover: e.target.checked }
                  })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                  disabled={!localSettings.conversion?.enabled}
                />
                <span className="font-medium">Preserve Cover</span>
              </label>
              <p className="text-sm text-muted-foreground ml-7">
                Keep original book covers during conversion
              </p>
            </div>

            <div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={localSettings.conversion?.preserve_metadata || false}
                  onChange={(e) => onSettingsChange({
                    ...localSettings,
                    conversion: { ...localSettings.conversion, preserve_metadata: e.target.checked }
                  })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                  disabled={!localSettings.conversion?.enabled}
                />
                <span className="font-medium">Preserve Metadata</span>
              </label>
              <p className="text-sm text-muted-foreground ml-7">
                Keep title, author, and other book information
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Conversion Timeout (seconds)
              </label>
              <input
                type="number"
                min="30"
                max="3600"
                value={localSettings.conversion?.timeout_seconds || 300}
                onChange={(e) => onSettingsChange({
                  ...localSettings,
                  conversion: { ...localSettings.conversion, timeout_seconds: parseInt(e.target.value) }
                })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                disabled={!localSettings.conversion?.enabled}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Maximum time to wait for conversion (30-3600 seconds)
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
