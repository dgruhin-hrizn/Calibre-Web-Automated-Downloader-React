import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Shield, Download, Upload, BookOpen, Key, Archive, Eye, RefreshCw, Settings, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useUserManagement } from '../hooks/useUserManagement';
import { useRefreshThumbnails } from '../hooks/useAdminActions';
import { useAdminSettings, useUpdateAdminSettings, useTestCalibre, useConversionStatus } from '../hooks/useAdminSettings';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/card';
import type { User, UserDetails } from '../types/user';
import UserEditModal from '../components/UserEditModal';
import CreateUserModal from '../components/CreateUserModal';
import * as Dialog from '@radix-ui/react-dialog';

const Admin: React.FC = () => {
  const { users, isLoading, error, fetchUsers, deleteUser, getUserDetails } = useUserManagement();
  const refreshThumbnails = useRefreshThumbnails();
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [showRefreshDialog, setShowRefreshDialog] = useState(false);
  
  // Admin Settings State
  const { data: appSettings, isLoading: isSettingsLoading, error: settingsError } = useAdminSettings();
  const updateSettings = useUpdateAdminSettings();
  const testCalibre = useTestCalibre();
  const { data: conversionStatus, isLoading: isStatusLoading } = useConversionStatus();
  const [showSettingsSection, setShowSettingsSection] = useState(false);
  const [settingsSaveMessage, setSettingsSaveMessage] = useState('');
  
  // Local settings state for form
  const [localSettings, setLocalSettings] = useState(appSettings);

  useEffect(() => {
    fetchUsers();
  }, []);

  // Update local settings when app settings change
  useEffect(() => {
    if (appSettings) {
      setLocalSettings(appSettings);
    }
  }, [appSettings]);

  // Settings handlers
  const handleSaveSettings = async () => {
    if (!localSettings) return;

    try {
      await updateSettings.mutateAsync(localSettings);
      setSettingsSaveMessage('Settings saved successfully!');
      setTimeout(() => setSettingsSaveMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSettingsSaveMessage('Failed to save settings');
      setTimeout(() => setSettingsSaveMessage(''), 3000);
    }
  };

  const handleTestCalibre = async () => {
    try {
      await testCalibre.mutateAsync();
    } catch (error) {
      console.error('Calibre test failed:', error);
    }
  };

  const handleEditUser = async (user: User) => {
    // Fetch detailed user information
    const userDetails = await getUserDetails(user.id);
    if (userDetails) {
      setSelectedUser(userDetails);
      setIsEditModalOpen(true);
    }
  };

  const handleDeleteUser = async (user: User) => {
    setDeleteConfirmUser(user);
  };

  const confirmDeleteUser = async () => {
    if (deleteConfirmUser) {
      const success = await deleteUser(deleteConfirmUser.id);
      if (success) {
        setDeleteConfirmUser(null);
      }
    }
  };

  const handleRefreshThumbnails = async () => {
    try {
      await refreshThumbnails.mutateAsync();
      setShowRefreshDialog(false);
      // Could add a toast notification here
    } catch (error) {
      console.error('Failed to refresh thumbnails:', error);
      // Error handling is managed by the mutation
    }
  };

  const getPermissionIcons = (permissions: string[]) => {
    const iconMap: Record<string, React.ReactNode> = {
      'Admin': <Shield className="w-4 h-4 text-destructive" title="Admin" />,
      'Download': <Download className="w-4 h-4 text-primary" title="Download" />,
      'Upload': <Upload className="w-4 h-4 text-green-600" title="Upload" />,
      'Edit': <Edit className="w-4 h-4 text-yellow-600" title="Edit" />,
      'Change Password': <Key className="w-4 h-4 text-purple-600" title="Change Password" />,
      'Edit Public Shelfs': <Archive className="w-4 h-4 text-indigo-600" title="Edit Shelfs" />,
      'Delete Books': <Trash2 className="w-4 h-4 text-destructive" title="Delete Books" />,
      'Viewer': <Eye className="w-4 h-4 text-muted-foreground" title="Viewer" />
    };

    return permissions.map((permission, index) => (
      <span key={index} className="inline-flex items-center">
        {iconMap[permission] || <BookOpen className="w-4 h-4 text-muted-foreground" title={permission} />}
      </span>
    ));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {showSettingsSection ? 'Global Settings' : 'User Administration'}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {showSettingsSection 
              ? 'Configure application-wide settings and conversion options'
              : 'Manage CWA users and their permissions'
            }
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 self-start sm:self-auto">
          <Button
            onClick={() => setShowSettingsSection(!showSettingsSection)}
            variant="outline"
            className="flex items-center gap-2"
          >
            {showSettingsSection ? <Users className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
            {showSettingsSection ? 'User Management' : 'Global Settings'}
          </Button>
          
          {!showSettingsSection && (
            <>
              <Button
                onClick={() => setShowRefreshDialog(true)}
                variant="outline"
                className="flex items-center gap-2"
                disabled={refreshThumbnails.isPending}
              >
                <RefreshCw className={`w-4 h-4 ${refreshThumbnails.isPending ? 'animate-spin' : ''}`} />
                Refresh Thumbnails
              </Button>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create User
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Error Display */}
      {(error || settingsError) && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <p className="text-destructive">{error || settingsError?.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Global Settings Section */}
      {showSettingsSection && (
        <div className="space-y-6">
          {/* Calibre Status */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Calibre Integration</h3>
                  <p className="text-sm text-muted-foreground">
                    Test and monitor Calibre conversion tools
                  </p>
                </div>
                <Button
                  onClick={handleTestCalibre}
                  variant="outline"
                  disabled={testCalibre.isPending}
                  className="flex items-center gap-2"
                >
                  {testCalibre.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Test Calibre
                </Button>
              </div>

              {testCalibre.data && (
                <div className={`p-3 rounded-md border ${
                  testCalibre.data.available 
                    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' 
                    : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {testCalibre.data.available ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className={`font-medium ${
                      testCalibre.data.available ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                    }`}>
                      {testCalibre.data.message}
                    </span>
                  </div>
                  {testCalibre.data.ebook_convert_version && (
                    <p className="text-sm text-muted-foreground">
                      {testCalibre.data.ebook_convert_version}
                    </p>
                  )}
                  {testCalibre.data.calibredb_version && (
                    <p className="text-sm text-muted-foreground">
                      {testCalibre.data.calibredb_version}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conversion Settings */}
          {localSettings && (
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
                      onClick={handleSaveSettings}
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
                  {/* Conversion Enable/Disable */}
                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={localSettings.conversion?.enabled || false}
                          onChange={(e) => setLocalSettings(prev => prev ? {
                            ...prev,
                            conversion: { ...prev.conversion, enabled: e.target.checked }
                          } : prev)}
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
                        onChange={(e) => setLocalSettings(prev => prev ? {
                          ...prev,
                          conversion: { ...prev.conversion, target_format: e.target.value }
                        } : prev)}
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
                        onChange={(e) => setLocalSettings(prev => prev ? {
                          ...prev,
                          conversion: { ...prev.conversion, quality: e.target.value as 'low' | 'medium' | 'high' }
                        } : prev)}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background"
                        disabled={!localSettings.conversion?.enabled}
                      >
                        <option value="low">Low (Faster)</option>
                        <option value="medium">Medium</option>
                        <option value="high">High (Better Quality)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={localSettings.conversion?.preserve_cover || false}
                          onChange={(e) => setLocalSettings(prev => prev ? {
                            ...prev,
                            conversion: { ...prev.conversion, preserve_cover: e.target.checked }
                          } : prev)}
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
                          onChange={(e) => setLocalSettings(prev => prev ? {
                            ...prev,
                            conversion: { ...prev.conversion, preserve_metadata: e.target.checked }
                          } : prev)}
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
                        onChange={(e) => setLocalSettings(prev => prev ? {
                          ...prev,
                          conversion: { ...prev.conversion, timeout_seconds: parseInt(e.target.value) }
                        } : prev)}
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
          )}

          {/* Download Settings */}
          {localSettings && (
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
                        onChange={(e) => setLocalSettings(prev => prev ? {
                          ...prev,
                          downloads: { ...prev.downloads, max_concurrent_downloads: parseInt(e.target.value) }
                        } : prev)}
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
                        onChange={(e) => setLocalSettings(prev => prev ? {
                          ...prev,
                          downloads: { ...prev.downloads, max_concurrent_conversions: parseInt(e.target.value) }
                        } : prev)}
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
                        onChange={(e) => setLocalSettings(prev => prev ? {
                          ...prev,
                          downloads: { ...prev.downloads, retry_attempts: parseInt(e.target.value) }
                        } : prev)}
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
                          onChange={(e) => setLocalSettings(prev => prev ? {
                            ...prev,
                            downloads: { ...prev.downloads, cleanup_temp_files: e.target.checked }
                          } : prev)}
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
          )}

          {/* Conversion Status */}
          {conversionStatus && (
            <Card>
              <CardContent className="p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold">Conversion Status</h3>
                  <p className="text-sm text-muted-foreground">
                    Monitor active conversions and library statistics
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      {conversionStatus.conversion_manager_running ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      <span className="font-medium">
                        Conversion Manager: {conversionStatus.conversion_manager_running ? 'Running' : 'Stopped'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm">
                        <span className="font-medium">Active Jobs:</span> {Object.keys(conversionStatus.active_jobs).length}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Library Books:</span> {conversionStatus.library_stats.total_books}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Format Distribution</h4>
                    <div className="space-y-1">
                      {Object.entries(conversionStatus.library_stats.formats).map(([format, count]) => (
                        <div key={format} className="flex justify-between text-sm">
                          <span className="uppercase">{format}:</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* User Management Section */}
      {!showSettingsSection && (
        <>
          {/* Users Table - Desktop */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted sticky top-0 z-10 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Kindle Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Permissions
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-foreground">
                            {user.username}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {user.kindle_email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getPermissionIcons(user.permissions)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          className="h-8 w-8 p-0"
                          title="Edit User"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(user)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Users Cards - Mobile */}
      <div className="md:hidden space-y-4">
        {users.map((user) => (
          <Card key={user.id} className="hover:bg-muted/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {user.username}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditUser(user)}
                    className="h-8 w-8 p-0"
                    title="Edit User"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteUser(user)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    title="Delete User"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              {user.kindle_email && (
                <div className="mb-3">
                  <div className="text-xs text-muted-foreground">Kindle Email</div>
                  <div className="text-sm text-foreground break-all">{user.kindle_email}</div>
                </div>
              )}
              
              <div>
                <div className="text-xs text-muted-foreground mb-2">Permissions</div>
                <div className="flex flex-wrap items-center gap-2">
                  {getPermissionIcons(user.permissions)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {users.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No users found</h3>
              <p className="text-muted-foreground mb-4">Get started by creating your first user.</p>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create User
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User count */}
      {users.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {users.length} user{users.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Edit User Modal */}
      {selectedUser && (
        <UserEditModal
          user={selectedUser}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedUser(null);
          }}
          onSave={() => {
            setIsEditModalOpen(false);
            setSelectedUser(null);
            fetchUsers();
          }}
        />
      )}

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={() => {
          setIsCreateModalOpen(false);
          fetchUsers();
        }}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <CardContent className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-destructive" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-foreground">Delete User</h3>
                  <p className="text-sm text-muted-foreground">This action cannot be undone</p>
                </div>
              </div>
              
              <p className="text-foreground mb-6">
                Are you sure you want to delete user <strong>{deleteConfirmUser.username}</strong>? 
                This will permanently remove the user and all their data.
              </p>
              
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDeleteUser}
                >
                  Delete User
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        </>
      )}

      {/* Refresh Thumbnails Confirmation Dialog */}
      <Dialog.Root open={showRefreshDialog} onOpenChange={setShowRefreshDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-lg shadow-lg p-6 w-full max-w-md z-50">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Refresh Thumbnail Cache
            </Dialog.Title>
            <Dialog.Description className="text-muted-foreground mb-6">
              Calibre-Web Automated will search for updated covers and update cover thumbnails. This may take a while depending on your library size.
            </Dialog.Description>
            
            {refreshThumbnails.error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">
                  {refreshThumbnails.error.message || 'Failed to refresh thumbnails'}
                </p>
              </div>
            )}
            
            <div className="flex justify-end space-x-3">
              <Dialog.Close asChild>
                <Button
                  variant="outline"
                  disabled={refreshThumbnails.isPending}
                >
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                onClick={handleRefreshThumbnails}
                disabled={refreshThumbnails.isPending}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshThumbnails.isPending ? 'animate-spin' : ''}`} />
                {refreshThumbnails.isPending ? 'Refreshing...' : 'Start Refresh'}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};

export default Admin;
