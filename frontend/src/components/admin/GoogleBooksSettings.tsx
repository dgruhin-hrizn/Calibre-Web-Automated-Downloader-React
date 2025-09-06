import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/input';
import * as Label from '@radix-ui/react-label';
import { Alert, AlertDescription } from '../ui/alert';
import { Eye, EyeOff, ExternalLink, Check, X, AlertCircle, BookOpen } from 'lucide-react';
import { apiRequest } from '../../lib/utils';
import { useToast } from '../../hooks/useToast';

interface GoogleBooksSettings {
  apiKey: string
  isValid: boolean
  lastChecked?: string
}

const GoogleBooksSettings: React.FC = () => {
  const { showToast, ToastContainer } = useToast();
  const [googleBooksKey, setGoogleBooksKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'unchecked' | 'valid' | 'invalid'>('unchecked');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadGoogleBooksSettings();
  }, []);

  const loadGoogleBooksSettings = async () => {
    try {
      setIsLoading(true);
      const settings: GoogleBooksSettings = await apiRequest('/api/settings/google-books');
      setGoogleBooksKey(settings.apiKey || '');
      setKeyStatus(settings.isValid ? 'valid' : settings.apiKey ? 'invalid' : 'unchecked');
    } catch (error) {
      console.error('Failed to load Google Books settings:', error);
      showToast({ type: 'error', title: 'Failed to load Google Books settings' });
    } finally {
      setIsLoading(false);
    }
  };

  const testApiKey = async (key: string) => {
    if (!key.trim()) {
      setKeyStatus('unchecked');
      return false;
    }

    setIsTestingKey(true);
    try {
      const result = await apiRequest('/api/settings/google-books/test', {
        method: 'POST',
        body: JSON.stringify({ apiKey: key })
      });
      const isValid = result.valid;
      setKeyStatus(isValid ? 'valid' : 'invalid');
      
      if (isValid) {
        showToast({ type: 'success', title: 'API key is valid and working!' });
      } else {
        showToast({ type: 'error', title: 'API key is invalid or has insufficient permissions' });
      }
      
      return isValid;
    } catch (error) {
      console.error('Failed to test API key:', error);
      setKeyStatus('invalid');
      showToast({ type: 'error', title: 'Failed to test API key' });
      return false;
    } finally {
      setIsTestingKey(false);
    }
  };

  const saveGoogleBooksSettings = async () => {
    setIsSaving(true);
    
    try {
      // Test the key first if it's provided
      let isValid = false;
      if (googleBooksKey.trim()) {
        isValid = await testApiKey(googleBooksKey);
      }

      await apiRequest('/api/settings/google-books', {
        method: 'POST',
        body: JSON.stringify({ 
          apiKey: googleBooksKey,
          isValid 
        })
      });

      showToast({ type: 'success', title: 'Google Books API settings saved successfully!' });
    } catch (error) {
      console.error('Failed to save Google Books settings:', error);
      showToast({ type: 'error', title: 'Failed to save Google Books settings' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <BookOpen className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Google Books API</h2>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer />
      
      <div className="flex items-center space-x-2">
        <BookOpen className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Google Books API</h2>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Add your Google Books API key to get enhanced book information including descriptions, ratings, and additional metadata.
      </p>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label.Root htmlFor="google_api_key" className="text-sm font-medium">
            API Key
            <a 
              href="https://developers.google.com/books/docs/v1/getting_started#auth" 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-2 text-primary hover:underline inline-flex items-center"
            >
              <ExternalLink className="w-3 h-3 ml-1" />
              Get API Key
            </a>
          </Label.Root>
          
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <Input
                id="google_api_key"
                type={showApiKey ? "text" : "password"}
                value={googleBooksKey}
                onChange={(e) => {
                  setGoogleBooksKey(e.target.value);
                  setKeyStatus('unchecked');
                }}
                placeholder="Enter your Google Books API key"
                className="pr-20"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1">
                {keyStatus === 'valid' && (
                  <Check className="w-4 h-4 text-green-600" />
                )}
                {keyStatus === 'invalid' && (
                  <X className="w-4 h-4 text-red-600" />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="h-auto p-1"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => testApiKey(googleBooksKey)}
              disabled={isTestingKey || !googleBooksKey.trim()}
            >
              {isTestingKey ? 'Testing...' : 'Test'}
            </Button>
          </div>
          
          {keyStatus === 'valid' && (
            <p className="text-sm text-green-600 flex items-center">
              <Check className="w-3 h-3 mr-1" />
              API key is valid and working
            </p>
          )}
          {keyStatus === 'invalid' && (
            <p className="text-sm text-red-600 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              API key is invalid or has insufficient permissions
            </p>
          )}
        </div>

        <div className="flex space-x-4">
          <Button 
            onClick={saveGoogleBooksSettings}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Google Books Settings'}
          </Button>
        </div>
      </div>

      <Alert>
        <BookOpen className="h-4 w-4" />
        <AlertDescription>
          <strong>Enhanced Metadata:</strong> With a valid Google Books API key, you'll get richer book information 
          including detailed descriptions, user ratings, publication details, and cover images when searching.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default GoogleBooksSettings;
