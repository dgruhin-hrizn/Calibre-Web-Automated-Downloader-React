import React from 'react';
import { Shield, Download, Upload, Edit, Key, Archive, Trash2, Eye, BookOpen } from 'lucide-react';

interface UserPermissionIconsProps {
  permissions: string[];
}

export const UserPermissionIcons: React.FC<UserPermissionIconsProps> = ({ permissions }) => {
  const getPermissionIcons = (permissions: string[]) => {
    const iconMap: Record<string, React.ReactNode> = {
      'Admin': <Shield className="w-4 h-4 text-destructive" />,
      'Download': <Download className="w-4 h-4 text-primary" />,
      'Upload': <Upload className="w-4 h-4 text-green-600" />,
      'Edit': <Edit className="w-4 h-4 text-yellow-600" />,
      'Change Password': <Key className="w-4 h-4 text-purple-600" />,
      'Edit Public Shelfs': <Archive className="w-4 h-4 text-indigo-600" />,
      'Delete Books': <Trash2 className="w-4 h-4 text-destructive" />,
      'Viewer': <Eye className="w-4 h-4 text-muted-foreground" />
    };

    return permissions.map((permission, index) => (
      <span key={index} className="inline-flex items-center" title={permission}>
        {iconMap[permission] || <BookOpen className="w-4 h-4 text-muted-foreground" />}
      </span>
    ));
  };

  return (
    <div className="flex items-center space-x-2">
      {getPermissionIcons(permissions)}
    </div>
  );
};
