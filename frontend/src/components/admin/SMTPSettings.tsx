import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/Button';
import { Input } from '../ui/input';
import * as Label from '@radix-ui/react-label';
import * as Select from '@radix-ui/react-select';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, Mail, TestTube, ChevronDown, Check } from 'lucide-react';
import { apiRequest } from '../../lib/utils';
import { useToast } from '../../hooks/useToast';

interface SMTPSettings {
  mail_server: string;
  mail_port: number;
  mail_use_ssl: boolean;
  mail_login: string;
  mail_password: string;
  mail_from: string;
  mail_size: number;
  mail_server_type: number;
}

const SMTPSettings: React.FC = () => {
  const { showToast, ToastContainer } = useToast();
  const [settings, setSettings] = useState<SMTPSettings>({
    mail_server: '',
    mail_port: 587,
    mail_use_ssl: false,
    mail_login: '',
    mail_password: '',
    mail_from: '',
    mail_size: 25,
    mail_server_type: 0
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('custom');

  // Common SMTP providers with correct security settings
  const smtpProviders = [
    { value: 'custom', label: 'Custom', server: '', port: 587, ssl: false },
    { value: 'gmail', label: 'Gmail', server: 'smtp.gmail.com', port: 587, ssl: false },
    { value: 'outlook', label: 'Outlook/Hotmail', server: 'smtp-mail.outlook.com', port: 587, ssl: false },
    { value: 'yahoo', label: 'Yahoo', server: 'smtp.mail.yahoo.com', port: 587, ssl: false },
    { value: 'icloud', label: 'iCloud', server: 'smtp.mail.me.com', port: 587, ssl: false },
    { value: 'zoho', label: 'Zoho', server: 'smtp.zoho.com', port: 587, ssl: false },
    { value: 'brevo', label: 'Brevo', server: 'smtp-relay.brevo.com', port: 587, ssl: false },
    { value: 'mailgun', label: 'Mailgun', server: 'smtp.mailgun.org', port: 587, ssl: false },
    { value: 'sendgrid', label: 'SendGrid', server: 'smtp.sendgrid.net', port: 587, ssl: false }
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest('/api/admin/smtp/settings');
      
      // Handle the has_password field - show placeholder if password exists
      const settingsData = {
        ...response,
        mail_password: response.has_password ? '••••••••' : ''
      };
      
      // Remove has_password from the settings object
      delete settingsData.has_password;
      
      setSettings(settingsData);
    } catch (error) {
      console.error('Failed to load SMTP settings:', error);
      showToast({ type: 'error', title: 'Failed to load SMTP settings' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProviderChange = (providerId: string) => {
    const provider = smtpProviders.find(p => p.value === providerId);
    setSelectedProvider(providerId);
    if (provider && providerId !== 'custom') {
      setSettings(prev => ({
        ...prev,
        mail_server: provider.server,
        mail_port: provider.port,
        mail_use_ssl: provider.ssl
      }));
    }
  };

  const getSecurityValue = () => {
    if (!settings.mail_use_ssl && settings.mail_port === 587) return 'starttls';
    if (settings.mail_use_ssl && settings.mail_port === 465) return 'ssl';
    return 'none';
  };

  const handleSecurityChange = (value: string) => {
    switch (value) {
      case 'starttls':
        setSettings(prev => ({ ...prev, mail_port: 587, mail_use_ssl: false }));
        break;
      case 'ssl':
        setSettings(prev => ({ ...prev, mail_port: 465, mail_use_ssl: true }));
        break;
      case 'none':
        setSettings(prev => ({ ...prev, mail_port: 25, mail_use_ssl: false }));
        break;
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      // Prepare settings data - don't send placeholder password
      const settingsToSave: any = { ...settings };
      if (settingsToSave.mail_password === '••••••••') {
        // Don't send the placeholder password - backend will keep existing password
        delete settingsToSave.mail_password;
      }
      
      await apiRequest('/api/admin/smtp/settings', {
        method: 'POST',
        body: JSON.stringify(settingsToSave)
      });
      showToast({ type: 'success', title: 'SMTP settings saved successfully' });
    } catch (error) {
      console.error('Failed to save SMTP settings:', error);
      showToast({ type: 'error', title: 'Failed to save SMTP settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      showToast({ type: 'error', title: 'Please enter a test email address' });
      return;
    }

    try {
      setIsTesting(true);
      await apiRequest('/api/admin/smtp/test', {
        method: 'POST',
        body: JSON.stringify({ test_email: testEmail })
      });
      showToast({ type: 'success', title: 'SMTP test email sent successfully!' });
    } catch (error) {
      console.error('SMTP test failed:', error);
      showToast({ type: 'error', title: 'SMTP test failed. Please check your settings.' });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <Mail className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Email Settings</h2>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading SMTP settings...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer />
      
      <div className="flex items-center space-x-2">
        <Mail className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Email Settings</h2>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Configure SMTP settings for Send to Kindle functionality
      </p>

      <Card>
        <CardContent className="space-y-6 pt-6">
          {/* Provider Quick Setup */}
          <div className="space-y-2">
            <Label.Root className="text-sm font-medium">Email Provider</Label.Root>
            <Select.Root value={selectedProvider} onValueChange={handleProviderChange}>
              <Select.Trigger className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm">
                <Select.Value placeholder="Choose a provider or select Custom" />
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="overflow-hidden rounded-md border bg-popover shadow-md">
                  <Select.Viewport className="p-1">
                    {smtpProviders.map((provider) => (
                      <Select.Item 
                        key={provider.value} 
                        value={provider.value}
                        className="relative flex cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm hover:bg-accent"
                      >
                        <Select.ItemIndicator className="absolute left-2">
                          <Check className="h-4 w-4" />
                        </Select.ItemIndicator>
                        <Select.ItemText>{provider.label}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>

          {/* Server Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label.Root htmlFor="mail_server" className="text-sm font-medium">SMTP Server</Label.Root>
              <Input
                id="mail_server"
                value={settings.mail_server}
                onChange={(e) => setSettings(prev => ({ ...prev, mail_server: e.target.value }))}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div className="space-y-2">
              <Label.Root htmlFor="mail_port" className="text-sm font-medium">Port</Label.Root>
              <Input
                id="mail_port"
                type="number"
                value={settings.mail_port}
                onChange={(e) => setSettings(prev => ({ ...prev, mail_port: parseInt(e.target.value) || 587 }))}
                placeholder="587"
              />
            </div>
          </div>

          {/* Connection Security */}
          <div className="space-y-2">
            <Label.Root className="text-sm font-medium">Connection Security</Label.Root>
            <Select.Root 
              value={getSecurityValue()} 
              onValueChange={handleSecurityChange}
            >
              <Select.Trigger className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm">
                <Select.Value />
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="overflow-hidden rounded-md border bg-popover shadow-md">
                  <Select.Viewport className="p-1">
                    <Select.Item 
                      value="starttls"
                      className="relative flex cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm hover:bg-accent"
                    >
                      <Select.ItemIndicator className="absolute left-2">
                        <Check className="h-4 w-4" />
                      </Select.ItemIndicator>
                      <Select.ItemText>STARTTLS (Port 587)</Select.ItemText>
                    </Select.Item>
                    <Select.Item 
                      value="ssl"
                      className="relative flex cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm hover:bg-accent"
                    >
                      <Select.ItemIndicator className="absolute left-2">
                        <Check className="h-4 w-4" />
                      </Select.ItemIndicator>
                      <Select.ItemText>SSL/TLS (Port 465)</Select.ItemText>
                    </Select.Item>
                    <Select.Item 
                      value="none"
                      className="relative flex cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm hover:bg-accent"
                    >
                      <Select.ItemIndicator className="absolute left-2">
                        <Check className="h-4 w-4" />
                      </Select.ItemIndicator>
                      <Select.ItemText>No Encryption (Port 25)</Select.ItemText>
                    </Select.Item>
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>

          {/* Authentication */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label.Root htmlFor="mail_login" className="text-sm font-medium">Username/Email</Label.Root>
              <Input
                id="mail_login"
                value={settings.mail_login}
                onChange={(e) => setSettings(prev => ({ ...prev, mail_login: e.target.value }))}
                placeholder="your-email@gmail.com"
              />
            </div>
            <div className="space-y-2">
              <Label.Root htmlFor="mail_password" className="text-sm font-medium">Password/App Password</Label.Root>
              <Input
                id="mail_password"
                type="password"
                value={settings.mail_password}
                onChange={(e) => setSettings(prev => ({ ...prev, mail_password: e.target.value }))}
                placeholder="Your app password"
              />
              {settings.mail_password === '••••••••' && (
                <p className="text-xs text-muted-foreground">Password is saved. Enter a new password to change it.</p>
              )}
            </div>
          </div>

          {/* From Address */}
          <div className="space-y-2">
            <Label.Root htmlFor="mail_from" className="text-sm font-medium">From Email Address</Label.Root>
            <Input
              id="mail_from"
              type="email"
              value={settings.mail_from}
              onChange={(e) => setSettings(prev => ({ ...prev, mail_from: e.target.value }))}
              placeholder="noreply@yourdomain.com"
            />
          </div>

          {/* Test Email Section */}
          <div className="border-t pt-6 space-y-4">
            <h3 className="text-md font-medium">Test Email Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2 space-y-2">
                <Label.Root htmlFor="test_email" className="text-sm font-medium">Test Email Address</Label.Root>
                <Input
                  id="test_email"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                />
              </div>
              <Button 
                onClick={handleTest} 
                disabled={isTesting || !testEmail}
                className="w-full"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <TestTube className="h-4 w-4 mr-2" />
                    Send Test
                  </>
                )}
              </Button>
            </div>
          </div>

          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              <strong>Security Note:</strong> For Gmail and most providers, you'll need to generate an "App Password" 
              rather than using your regular account password.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save SMTP Settings'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SMTPSettings;