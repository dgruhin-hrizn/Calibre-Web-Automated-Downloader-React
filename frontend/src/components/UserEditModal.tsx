import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Save, Loader2, Shield, Download, Upload, Edit, Key, Archive, Trash2, Eye } from 'lucide-react';
import { Button } from './ui/Button';
import { useUserManagement } from '../hooks/useUserManagement';
import type { UserDetails } from '../types/user';

interface UserEditModalProps {
  user: UserDetails;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const UserEditModal: React.FC<UserEditModalProps> = ({
  user,
  isOpen,
  onClose,
  onSave
}) => {
  const { updateUser } = useUserManagement();
  const [formData, setFormData] = useState<UserDetails>(user);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData(user);
  }, [user]);

  // Radix Dialog handles escape key automatically, so we can remove the manual handling

  const handleInputChange = (field: keyof UserDetails, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePermissionChange = (permission: keyof UserDetails['permissions'], checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: checked
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const success = await updateUser(user.id, formData);
      if (success) {
        onSave();
      }
    } catch (err) {
      setError('Failed to update user');
    } finally {
      setIsSaving(false);
    }
  };

  const permissionConfig = [
    { key: 'admin' as const, label: 'Admin', icon: Shield, description: 'Full administrative access', color: 'text-red-500' },
    { key: 'download' as const, label: 'Download', icon: Download, description: 'Can download books', color: 'text-blue-500' },
    { key: 'upload' as const, label: 'Upload', icon: Upload, description: 'Can upload books and covers', color: 'text-green-500' },
    { key: 'edit' as const, label: 'Edit', icon: Edit, description: 'Can edit book metadata', color: 'text-yellow-500' },
    { key: 'passwd' as const, label: 'Change Password', icon: Key, description: 'Can change their own password', color: 'text-purple-500' },
    { key: 'edit_shelfs' as const, label: 'Edit Shelfs', icon: Archive, description: 'Can edit public shelves', color: 'text-indigo-500' },
    { key: 'delete_books' as const, label: 'Delete Books', icon: Trash2, description: 'Can delete books from library', color: 'text-red-600' },
    { key: 'viewer' as const, label: 'Viewer', icon: Eye, description: 'Read-only access', color: 'text-gray-500' }
  ];

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-50" />
        <Dialog.Content className="fixed inset-0 z-50 w-full bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] flex flex-col sm:fixed sm:left-[50%] sm:top-[50%] sm:max-w-2xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:max-h-[90vh] sm:inset-auto sm:border">
          {/* Header - Fixed */}
          <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
            <div>
              <Dialog.Title className="text-xl font-semibold text-foreground">
                Edit User: {user.username}
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          {/* Content - Scrollable */}
          <div className="p-6 flex-1 overflow-y-auto">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground">Basic Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background text-foreground"
                    placeholder="Username"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background text-foreground"
                    placeholder="user@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Kindle Email
                  </label>
                  <input
                    type="email"
                    value={formData.kindle_email}
                    onChange={(e) => handleInputChange('kindle_email', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background text-foreground"
                    placeholder="user@kindle.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Locale
                  </label>
                  <select
                    value={formData.locale}
                    onChange={(e) => handleInputChange('locale', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background text-foreground"
                  >
                    <option value="en">English</option>
                    <option value="de">Deutsch</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="it">Italiano</option>
                    <option value="ja">日本語</option>
                    <option value="zh">中文</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground">Permissions</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {permissionConfig.map(({ key, label, icon: Icon, description, color }) => (
                  <div key={key} className="flex items-start space-x-3 p-3 border border-border rounded-lg">
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        checked={formData.permissions[key]}
                        onChange={(e) => handlePermissionChange(key, e.target.checked)}
                        className="w-4 h-4 text-primary bg-background border-input rounded focus:ring-ring focus:ring-2"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <Icon className={`w-4 h-4 ${color}`} />
                        <label className="text-sm font-medium text-foreground">
                          {label}
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

          {/* Footer - Fixed */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-border flex-shrink-0">
            <Dialog.Close asChild>
              <Button
                variant="outline"
                disabled={isSaving}
              >
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default UserEditModal;
