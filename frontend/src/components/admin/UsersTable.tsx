import React from 'react';
import { Users, Edit, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/card';
import { UserPermissionIcons } from './UserPermissionIcons';
import type { User } from '../../types/user';

interface UsersTableProps {
  users: User[];
  onEditUser: (user: User) => void;
  onDeleteUser: (user: User) => void;
}

export const UsersTable: React.FC<UsersTableProps> = ({
  users,
  onEditUser,
  onDeleteUser
}) => {
  return (
    <>
      {/* Desktop Table */}
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
                      <UserPermissionIcons permissions={user.permissions} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditUser(user)}
                          className="h-8 w-8 p-0"
                          title="Edit User"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteUser(user)}
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

      {/* Mobile Cards */}
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
                    onClick={() => onEditUser(user)}
                    className="h-8 w-8 p-0"
                    title="Edit User"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteUser(user)}
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
                <UserPermissionIcons permissions={user.permissions} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
};
