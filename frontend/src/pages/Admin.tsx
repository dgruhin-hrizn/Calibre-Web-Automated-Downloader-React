import React, { useState } from 'react';
import { Users, Settings, Mail, BookOpen, Server, Wrench } from 'lucide-react';
import { Button } from '../components/ui/Button';

// Import admin components
import { 
  SMTPSettings,
  GoogleBooksSettings,
  SystemSettings,
  UserManagement
} from '../components/admin';

type AdminTab = 'users' | 'system' | 'calibre' | 'conversion' | 'smtp' | 'google-books';

const Admin: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AdminTab>('users');

  const tabs = [
    {
      id: 'users' as AdminTab,
      label: 'User Management',
      icon: Users,
      description: 'Manage user accounts and permissions'
    },
    {
      id: 'system' as AdminTab,
      label: 'System Settings',
      icon: Settings,
      description: 'Configure downloads, notifications, and preferences'
    },
    {
      id: 'calibre' as AdminTab,
      label: 'Calibre Integration',
      icon: Server,
      description: 'Configure Calibre library and conversion tools'
    },
    {
      id: 'conversion' as AdminTab,
      label: 'Conversion & Downloads',
      icon: Wrench,
      description: 'Manage conversion settings and download preferences'
    },
    {
      id: 'smtp' as AdminTab,
      label: 'Email Settings',
      icon: Mail,
      description: 'Configure SMTP for Send to Kindle functionality'
    },
    {
      id: 'google-books' as AdminTab,
      label: 'Google Books API',
      icon: BookOpen,
      description: 'Configure Google Books API for enhanced metadata'
    }
  ];

  const renderTabContent = () => {
    switch (currentTab) {
      case 'users':
        return <UserManagement />;
      
      case 'system':
        return <SystemSettings />;
      
      case 'calibre':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-2">
              <Server className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Calibre Integration</h2>
            </div>
            <div className="text-center py-12 text-muted-foreground">
              Calibre integration settings will be implemented here.
            </div>
          </div>
        );
      
      case 'conversion':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-2">
              <Wrench className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Conversion & Downloads</h2>
            </div>
            <div className="text-center py-12 text-muted-foreground">
              Conversion and download settings will be implemented here.
            </div>
          </div>
        );
      
      case 'smtp':
        return <SMTPSettings />;
      
      case 'google-books':
        return <GoogleBooksSettings />;
      
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Administration</h1>
        <p className="text-muted-foreground">
          Manage system settings, users, and integrations
        </p>
      </div>
      
      {/* Tab Navigation */}
      <div className="border-b border-border">
        <div className="flex space-x-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={currentTab === tab.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentTab(tab.id)}
                className="flex items-center space-x-2 whitespace-nowrap min-w-fit px-3 py-2"
                title={tab.description}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Tab Content with Animation */}
      <div className="relative min-h-[400px]">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`transition-all duration-300 ease-in-out ${
              currentTab === tab.id
                ? 'opacity-100 translate-x-0 pointer-events-auto'
                : 'opacity-0 translate-x-4 pointer-events-none absolute inset-0'
            }`}
          >
            {currentTab === tab.id && renderTabContent()}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Admin;