import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, RefreshCw } from 'lucide-react';
import { useUserManagement } from '../hooks/useUserManagement';
import { useRefreshThumbnails } from '../hooks/useAdminActions';
import { useAdminSettings, useUpdateAdminSettings, useTestCalibre, useConversionStatus } from '../hooks/useAdminSettings';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/card';
import type { User, UserDetails } from '../types/user';
import UserEditModal from '../components/UserEditModal';
import CreateUserModal from '../components/CreateUserModal';
import * as Dialog from '@radix-ui/react-dialog';

// Import admin components
import { AdminHeader, CalibreSettings, ConversionSettings, DownloadSettings, ConversionStatus, UsersTable } from '../components/admin';

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
  const { data: conversionStatus } = useConversionStatus();
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
      <AdminHeader
        showSettingsSection={showSettingsSection}
        onToggleSection={() => setShowSettingsSection(!showSettingsSection)}
        onCreateUser={() => setIsCreateModalOpen(true)}
        onRefreshThumbnails={() => setShowRefreshDialog(true)}
        isRefreshPending={refreshThumbnails.isPending}
      />

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
          <CalibreSettings
            testCalibre={testCalibre}
            onTestCalibre={handleTestCalibre}
          />

          {localSettings && (
            <ConversionSettings
              localSettings={localSettings}
              onSettingsChange={setLocalSettings}
              onSaveSettings={handleSaveSettings}
              updateSettings={updateSettings}
              isSettingsLoading={isSettingsLoading}
              settingsSaveMessage={settingsSaveMessage}
            />
          )}

          {localSettings && (
            <DownloadSettings
              localSettings={localSettings}
              onSettingsChange={setLocalSettings}
            />
          )}

          <ConversionStatus conversionStatus={conversionStatus} />
        </div>
      )}

      {/* User Management Section */}
      {!showSettingsSection && (
        <>
          <UsersTable
            users={users}
            onEditUser={handleEditUser}
            onDeleteUser={handleDeleteUser}
          />

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
      )}
    </div>
  );
};

export default Admin;
