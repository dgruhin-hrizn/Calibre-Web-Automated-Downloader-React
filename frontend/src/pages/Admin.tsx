import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Shield, Download, Upload, BookOpen, Key, Archive, Eye } from 'lucide-react';
import { useUserManagement } from '../hooks/useUserManagement';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/card';
import type { User, UserDetails } from '../types/user';
import UserEditModal from '../components/UserEditModal';
import CreateUserModal from '../components/CreateUserModal';

const Admin: React.FC = () => {
  const { users, isLoading, error, fetchUsers, deleteUser, getUserDetails } = useUserManagement();
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

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

  const getPermissionIcons = (permissions: string[]) => {
    const iconMap: Record<string, React.ReactNode> = {
      'Admin': <Shield className="w-4 h-4 text-destructive" title="Admin" />,
      'Download': <Download className="w-4 h-4 text-primary" title="Download" />,
      'Upload': <Upload className="w-4 h-4 text-green-600 dark:text-green-400" title="Upload" />,
      'Edit': <Edit className="w-4 h-4 text-yellow-600 dark:text-yellow-400" title="Edit" />,
      'Change Password': <Key className="w-4 h-4 text-purple-600 dark:text-purple-400" title="Change Password" />,
      'Edit Public Shelfs': <Archive className="w-4 h-4 text-indigo-600 dark:text-indigo-400" title="Edit Shelfs" />,
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">User Administration</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage CWA users and their permissions
          </p>
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create User
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

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
      )}
    </div>
  );
};

export default Admin;
