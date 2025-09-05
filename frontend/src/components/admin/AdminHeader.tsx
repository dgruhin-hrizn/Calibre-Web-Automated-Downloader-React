import React from 'react';
import { Users, Settings, Plus, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

interface AdminHeaderProps {
  showSettingsSection: boolean;
  onToggleSection: () => void;
  onCreateUser: () => void;
  onRefreshThumbnails: () => void;
  isRefreshPending: boolean;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  showSettingsSection,
  onToggleSection,
  onCreateUser,
  onRefreshThumbnails,
  isRefreshPending
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {showSettingsSection ? 'Global Settings' : 'User Administration'}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {showSettingsSection 
            ? 'Configure application-wide settings and conversion options'
            : 'Manage Inkdrop users and their permissions'
          }
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 self-start sm:self-auto">
        <Button
          onClick={onToggleSection}
          variant="outline"
          className="flex items-center gap-2"
        >
          {showSettingsSection ? <Users className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
          {showSettingsSection ? 'User Management' : 'Global Settings'}
        </Button>
        
        {!showSettingsSection && (
          <>
            <Button
              onClick={onRefreshThumbnails}
              variant="outline"
              className="flex items-center gap-2"
              disabled={isRefreshPending}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshPending ? 'animate-spin' : ''}`} />
              Refresh Thumbnails
            </Button>
            <Button
              onClick={onCreateUser}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create User
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
