import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/input';
import * as Label from '@radix-ui/react-label';
import * as Select from '@radix-ui/react-select';
import { Alert, AlertDescription } from '../ui/alert';
import { Settings, Folder, Bell, Zap, ChevronDown, Check } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

const SystemSettings: React.FC = () => {
  const { showToast, ToastContainer } = useToast();
  const [settings, setSettings] = useState({
    downloadDirectory: '/Users/username/Downloads/Books',
    concurrentDownloads: 3,
    preferredFormat: 'epub',
    notifyOnComplete: true,
    notifyOnFail: true,
    dailySummary: false,
    debugLogging: false,
    autoRetry: true,
    autoUpdate: true
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // TODO: Implement actual save logic
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      showToast({ type: 'success', title: 'System settings saved successfully!' });
    } catch (error) {
      showToast({ type: 'error', title: 'Failed to save system settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setSettings({
        downloadDirectory: '/Users/username/Downloads/Books',
        concurrentDownloads: 3,
        preferredFormat: 'epub',
        notifyOnComplete: true,
        notifyOnFail: true,
        dailySummary: false,
        debugLogging: false,
        autoRetry: true,
        autoUpdate: true
      });
      showToast({ type: 'success', title: 'Settings reset to defaults' });
    } catch (error) {
      showToast({ type: 'error', title: 'Failed to reset settings' });
    }
  };

  return (
    <div className="space-y-8">
      <ToastContainer />
      
      <div className="flex items-center space-x-2">
        <Settings className="h-5 w-5" />
        <h2 className="text-lg font-semibold">System Settings</h2>
      </div>

      {/* Download Settings */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Folder className="h-4 w-4" />
          <h3 className="text-md font-medium">Download Settings</h3>
        </div>
        
        <div className="space-y-4 pl-6">
          <div className="space-y-2">
            <Label.Root htmlFor="download_dir" className="text-sm font-medium">Download Directory</Label.Root>
            <div className="flex space-x-2">
              <Input
                id="download_dir"
                type="text"
                value={settings.downloadDirectory}
                onChange={(e) => setSettings(prev => ({ ...prev, downloadDirectory: e.target.value }))}
                className="flex-1"
                readOnly
              />
              <Button variant="outline">Browse</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label.Root htmlFor="concurrent_downloads" className="text-sm font-medium">Concurrent Downloads</Label.Root>
              <Select.Root 
                value={settings.concurrentDownloads.toString()} 
                onValueChange={(value) => setSettings(prev => ({ ...prev, concurrentDownloads: parseInt(value) }))}
              >
                <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
                  <Select.Value />
                  <Select.Icon>
                    <ChevronDown className="h-4 w-4" />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-background border border-input rounded-md shadow-md z-50">
                    <Select.Viewport className="p-1">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <Select.Item 
                          key={num} 
                          value={num.toString()}
                          className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm"
                        >
                          <Select.ItemText>{num}</Select.ItemText>
                          <Select.ItemIndicator className="ml-auto">
                            <Check className="h-3 w-3" />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            <div className="space-y-2">
              <Label.Root htmlFor="preferred_format" className="text-sm font-medium">Preferred Format</Label.Root>
              <Select.Root 
                value={settings.preferredFormat} 
                onValueChange={(value) => setSettings(prev => ({ ...prev, preferredFormat: value }))}
              >
                <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
                  <Select.Value />
                  <Select.Icon>
                    <ChevronDown className="h-4 w-4" />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-background border border-input rounded-md shadow-md z-50">
                    <Select.Viewport className="p-1">
                      {[
                        { value: 'epub', label: 'EPUB' },
                        { value: 'pdf', label: 'PDF' },
                        { value: 'mobi', label: 'MOBI' },
                        { value: 'any', label: 'Any' }
                      ].map((format) => (
                        <Select.Item 
                          key={format.value} 
                          value={format.value}
                          className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm"
                        >
                          <Select.ItemText>{format.label}</Select.ItemText>
                          <Select.ItemIndicator className="ml-auto">
                            <Check className="h-3 w-3" />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Bell className="h-4 w-4" />
          <h3 className="text-md font-medium">Notifications</h3>
        </div>
        
        <div className="space-y-3 pl-6">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={settings.notifyOnComplete}
              onChange={(e) => setSettings(prev => ({ ...prev, notifyOnComplete: e.target.checked }))}
              className="rounded" 
            />
            <span className="text-sm">Notify when downloads complete</span>
          </label>
          
          <label className="flex items-center space-x-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={settings.notifyOnFail}
              onChange={(e) => setSettings(prev => ({ ...prev, notifyOnFail: e.target.checked }))}
              className="rounded" 
            />
            <span className="text-sm">Notify when downloads fail</span>
          </label>
          
          <label className="flex items-center space-x-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={settings.dailySummary}
              onChange={(e) => setSettings(prev => ({ ...prev, dailySummary: e.target.checked }))}
              className="rounded" 
            />
            <span className="text-sm">Daily summary notifications</span>
          </label>
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Zap className="h-4 w-4" />
          <h3 className="text-md font-medium">Advanced</h3>
        </div>
        
        <div className="space-y-3 pl-6">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={settings.debugLogging}
              onChange={(e) => setSettings(prev => ({ ...prev, debugLogging: e.target.checked }))}
              className="rounded" 
            />
            <span className="text-sm">Enable debug logging</span>
          </label>
          
          <label className="flex items-center space-x-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={settings.autoRetry}
              onChange={(e) => setSettings(prev => ({ ...prev, autoRetry: e.target.checked }))}
              className="rounded" 
            />
            <span className="text-sm">Auto-retry failed downloads</span>
          </label>
          
          <label className="flex items-center space-x-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={settings.autoUpdate}
              onChange={(e) => setSettings(prev => ({ ...prev, autoUpdate: e.target.checked }))}
              className="rounded" 
            />
            <span className="text-sm">Check for updates automatically</span>
          </label>
        </div>
      </div>

      <Alert>
        <Settings className="h-4 w-4" />
        <AlertDescription>
          <strong>Note:</strong> Some settings may require a restart to take effect. 
          Changes to download directory will only apply to new downloads.
        </AlertDescription>
      </Alert>

      <div className="flex space-x-4">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button variant="outline" onClick={handleReset}>
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
};

export default SystemSettings;
