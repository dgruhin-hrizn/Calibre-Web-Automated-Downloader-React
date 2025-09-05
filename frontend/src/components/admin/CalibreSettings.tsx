import React from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/card';

interface CalibreSettingsProps {
  testCalibre: any;
  onTestCalibre: () => void;
}

export const CalibreSettings: React.FC<CalibreSettingsProps> = ({
  testCalibre,
  onTestCalibre
}) => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Calibre Integration</h3>
            <p className="text-sm text-muted-foreground">
              Test and monitor Calibre conversion tools
            </p>
          </div>
          <Button
            onClick={onTestCalibre}
            variant="outline"
            disabled={testCalibre.isPending}
            className="flex items-center gap-2"
          >
            {testCalibre.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Test Calibre
          </Button>
        </div>

        {testCalibre.data && (
          <div className={`p-3 rounded-md border ${
            testCalibre.data.available 
              ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' 
              : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {testCalibre.data.available ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <span className={`font-medium ${
                testCalibre.data.available ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
              }`}>
                {testCalibre.data.message}
              </span>
            </div>
            {testCalibre.data.ebook_convert_version && (
              <p className="text-sm text-muted-foreground">
                {testCalibre.data.ebook_convert_version}
              </p>
            )}
            {testCalibre.data.calibredb_version && (
              <p className="text-sm text-muted-foreground">
                {testCalibre.data.calibredb_version}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
