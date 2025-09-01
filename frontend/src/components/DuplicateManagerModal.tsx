import React, { useState, useEffect } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { UnifiedBookCard } from './UnifiedBookCard';

interface DuplicateBook {
  id: number;
  title: string;
  authors: string[];
  series?: string;
  series_index?: number;
  rating?: number;
  pubdate?: string;
  timestamp?: string;
  tags: string[];
  languages: string[];
  formats: string[];
  path: string;
  has_cover: boolean;
  comments?: string;
}

interface DuplicateGroup {
  reason: string;
  books: DuplicateBook[];
}

interface DuplicateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DuplicateManagerModal: React.FC<DuplicateManagerModalProps> = ({
  isOpen,
  onClose
}) => {
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const fetchDuplicates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/duplicates', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setDuplicates(data.duplicates || []);
    } catch (error) {
      console.error('Failed to fetch duplicates:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDuplicates();
      setSelectedBooks(new Set());
    }
  }, [isOpen]);

  const handleSelectBook = (bookId: number, checked: boolean) => {
    const newSelected = new Set(selectedBooks);
    if (checked) {
      newSelected.add(bookId);
    } else {
      newSelected.delete(bookId);
    }
    setSelectedBooks(newSelected);
  };

  const handleSelectGroup = (books: DuplicateBook[], checked: boolean) => {
    const newSelected = new Set(selectedBooks);
    books.forEach(book => {
      if (checked) {
        newSelected.add(book.id);
      } else {
        newSelected.delete(book.id);
      }
    });
    setSelectedBooks(newSelected);
  };

  const handleDeleteSingle = async (bookId: number) => {
    if (!confirm('Are you sure you want to delete this book? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/books/${bookId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Refresh duplicates list
      await fetchDuplicates();
      
      // Remove from selected if it was selected
      const newSelected = new Set(selectedBooks);
      newSelected.delete(bookId);
      setSelectedBooks(newSelected);
      
    } catch (error) {
      console.error('Failed to delete book:', error);
      alert('Failed to delete book. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedBooks.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedBooks.size} selected books? This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch('/api/admin/books/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          book_ids: Array.from(selectedBooks)
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Refresh duplicates list and clear selection
      await fetchDuplicates();
      setSelectedBooks(new Set());
      
    } catch (error) {
      console.error('Failed to delete books:', error);
      alert('Failed to delete selected books. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <h2 className="text-xl font-semibold">Duplicate Manager</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Scanning for duplicates...</span>
            </div>
          ) : duplicates.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Duplicates Found</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Your library is clean! No duplicate books were detected.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Actions Bar */}
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Found {duplicates.reduce((acc, group) => acc + group.books.length, 0)} duplicate books in {duplicates.length} groups
                  </span>
                  {selectedBooks.size > 0 && (
                    <Badge variant="secondary">
                      {selectedBooks.size} selected
                    </Badge>
                  )}
                </div>
                {selectedBooks.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteSelected}
                    disabled={deleting}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedBooks.size})
                  </Button>
                )}
              </div>

              {/* Duplicate Groups */}
              {duplicates.map((group, groupIndex) => (
                <Card key={groupIndex}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          Duplicate Group {groupIndex + 1}
                        </CardTitle>
                        <CardDescription>
                          {group.reason} • {group.books.length} books
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={group.books.every(book => selectedBooks.has(book.id))}
                          onCheckedChange={(checked) => handleSelectGroup(group.books, checked as boolean)}
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Select All
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {group.books.map((book) => (
                        <div key={book.id} className="relative">
                          <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
                            <Checkbox
                              checked={selectedBooks.has(book.id)}
                              onCheckedChange={(checked) => handleSelectBook(book.id, checked as boolean)}
                            />
                          </div>
                          <div className="absolute top-2 right-2 z-10">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteSingle(book.id)}
                              disabled={deleting}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <UnifiedBookCard
                            book={book}
                            onDownload={() => {}}
                            onSendToKindle={() => {}}
                            showDownloadButton={false}
                            showKindleButton={false}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50 dark:bg-gray-800">
          <Button variant="outline" onClick={() => fetchDuplicates()} disabled={loading}>
            Refresh
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
