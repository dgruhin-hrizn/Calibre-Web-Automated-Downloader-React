import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent } from '../ui/card';

interface ConversionStatusProps {
  conversionStatus: any;
}

export const ConversionStatus: React.FC<ConversionStatusProps> = ({
  conversionStatus
}) => {
  if (!conversionStatus) return null;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold">Conversion Status</h3>
          <p className="text-sm text-muted-foreground">
            Monitor active conversions and library statistics
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              {conversionStatus.conversion_manager_running ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <span className="font-medium">
                Conversion Manager: {conversionStatus.conversion_manager_running ? 'Running' : 'Stopped'}
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">Active Jobs:</span> {Object.keys(conversionStatus.active_jobs).length}
              </p>
              <p className="text-sm">
                <span className="font-medium">Library Books:</span> {conversionStatus.library_stats.total_books}
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Format Distribution</h4>
            <div className="space-y-1">
              {Object.entries(conversionStatus.library_stats.formats).map(([format, count]) => (
                <div key={format} className="flex justify-between text-sm">
                  <span className="uppercase">{format}:</span>
                  <span>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
