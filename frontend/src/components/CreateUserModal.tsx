import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Shield, Download, Upload, Edit, Key, Archive, Trash2, Eye, UserPlus } from 'lucide-react';
import { useUserManagement } from '../hooks/useUserManagement';
import type { CreateUserData } from '../types/user';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const { createUser } = useUserManagement();
  const [formData, setFormData] = useState<CreateUserData>({
    username: '',
    email: '',
    password: '',
    kindle_email: '',
    locale: 'en',
    default_language: 'en',
    permissions: {
      admin: false,
      download: true, // Default to true for new users
      upload: false,
      edit: false,
      passwd: true, // Default to true for new users
      edit_shelfs: false,
      delete_books: false,
      viewer: false
    }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        username: '',
        email: '',
        password: '',
        kindle_email: '',
        locale: 'en',
        default_language: 'en',
        permissions: {
          admin: false,
          download: true,
          upload: false,
          edit: false,
          passwd: true,
          edit_shelfs: false,
          delete_books: false,
          viewer: false
        }
      });
      setError(null);
    }
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleInputChange = (field: keyof CreateUserData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePermissionChange = (permission: keyof CreateUserData['permissions'], checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: checked
      }
    }));
  };

  const handleSave = async () => {
    // Basic validation
    if (!formData.username.trim()) {
      setError('Username is required');
      return;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }
    if (!formData.password.trim()) {
      setError('Password is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const success = await createUser(formData);
      if (success) {
        onSave();
      }
    } catch (err) {
      setError('Failed to create user');
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
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
            <UserPlus className="w-6 h-6 mr-2 text-blue-600" />
            Create New User
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-6 flex-1 overflow-y-auto">
          {error && (
            <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Basic Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Username"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="user@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Password"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Kindle Email
                  </label>
                  <input
                    type="email"
                    value={formData.kindle_email}
                    onChange={(e) => handleInputChange('kindle_email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="user@kindle.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Locale
                  </label>
                  <select
                    value={formData.locale}
                    onChange={(e) => handleInputChange('locale', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Language
                  </label>
                  <select
                    value={formData.default_language}
                    onChange={(e) => handleInputChange('default_language', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
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
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Permissions</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select the permissions this user should have. Download and Change Password are recommended for most users.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {permissionConfig.map(({ key, label, icon: Icon, description, color }) => (
                  <div key={key} className="flex items-start space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        checked={formData.permissions[key]}
                        onChange={(e) => handlePermissionChange(key, e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <Icon className={`w-4 h-4 ${color}`} />
                        <label className="text-sm font-medium text-gray-900 dark:text-white">
                          {label}
                        </label>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
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
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Create User
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateUserModal;
