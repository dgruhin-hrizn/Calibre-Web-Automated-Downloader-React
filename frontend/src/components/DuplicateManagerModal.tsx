import React, { useState, useEffect } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { Button } from './ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
// import { UnifiedBookCard } from './UnifiedBookCard';
import { AuthorFormatter } from '../utils/authorFormatter';

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
  title?: string;
  isbn?: string;
  author?: string;
  count: number;
  books: DuplicateBook[];
}

interface DuplicatesResponse {
  duplicates: {
    by_isbn: DuplicateGroup[];
    by_title_author: DuplicateGroup[];
    by_file_hash: DuplicateGroup[];
  };
  summary: {
    total_duplicate_groups: number;
    total_duplicate_books: number;
    by_category: {
      title: number;
      isbn: number;
      title_author: number;
    };
  };
}

interface DuplicateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBooksDeleted?: () => void;
}

export const DuplicateManagerModal: React.FC<DuplicateManagerModalProps> = ({
  isOpen,
  onClose,
  onBooksDeleted
}) => {
  const [duplicatesData, setDuplicatesData] = useState<DuplicatesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [fadingGroups, setFadingGroups] = useState<Set<string>>(new Set());
  const [deletingBooks, setDeletingBooks] = useState<Set<number>>(new Set());
  
  // Animation states
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  // Reset all transient state
  const resetTransientState = () => {
    setFadingGroups(new Set());
    setDeletingBooks(new Set());
    setSelectedBooks(new Set());
    setDeleting(false);
  };

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
      console.log('Duplicates API response:', data);
      setDuplicatesData(data);
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
      setIsVisible(true);
      setIsClosing(false);
    }
  }, [isOpen]);

  // Handle modal close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsVisible(false);
      setIsClosing(false);
    }, 200);
  };

  // Flatten all duplicates for easier processing with deduplication
  const getAllDuplicateGroups = () => {
    if (!duplicatesData || !duplicatesData.duplicates) return [];
    
    const duplicates = duplicatesData.duplicates;
    const groups: Array<DuplicateGroup & { type: string; reason: string }> = [];
    const seenBookSets = new Set();
    
    // Helper function to create a unique key for a set of books
    const getBookSetKey = (books: DuplicateBook[]) => {
      return books.map(book => book.id).sort().join(',');
    };
    
    // Helper function to add group if not already seen
    const addGroupIfUnique = (group: DuplicateGroup, reason: string, type: string) => {
      const bookSetKey = getBookSetKey(group.books);
      if (!seenBookSets.has(bookSetKey)) {
        seenBookSets.add(bookSetKey);
        groups.push({
          ...group,
          reason,
          type
        });
      }
    };
    
    // Add title+author duplicates first (most specific)
    if (duplicates.by_title_author) {
      duplicates.by_title_author.forEach((group: DuplicateGroup) => {
        addGroupIfUnique(
          group,
          `Same title and author: "${group.title}" by ${group.author}`,
          'title_author'
        );
      });
    }
    
    // Add ISBN duplicates (also specific)
    if (duplicates.by_isbn) {
      duplicates.by_isbn.forEach((group: DuplicateGroup) => {
        addGroupIfUnique(
          group,
          `Same ISBN: ${group.isbn}`,
          'isbn'
        );
      });
    }
    

    
    return groups;
  };

  const allGroups = getAllDuplicateGroups();
  


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
    // Mark book as being deleted for visual feedback
    setDeletingBooks(prev => new Set([...prev, bookId]));
    
    try {
      const response = await fetch(`/api/admin/books/${bookId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Add delay for smooth animation
      await new Promise(resolve => setTimeout(resolve, 300));

      // Check which groups will be affected before refresh
      const currentGroups = getAllDuplicateGroups();
      const affectedGroups = currentGroups.filter(group => 
        group.books.some(book => book.id === bookId)
      );

      // Mark groups that might disappear for fade out
      const groupsToFade = affectedGroups
        .filter(group => group.books.length <= 2) // Groups with 2 or fewer books will disappear
        .map(group => `${group.type}-${group.books.map(b => b.id).sort().join('-')}`);
      
      if (groupsToFade.length > 0) {
        setFadingGroups(new Set(groupsToFade));
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for fade animation
      }

      // Update duplicates data locally instead of refetching
      if (duplicatesData) {
        const updatedData = { ...duplicatesData };
        const duplicates = updatedData.duplicates;
        
        // Remove book from all duplicate categories
        (['by_isbn', 'by_title_author'] as const).forEach((category: keyof typeof duplicates) => {
          if (duplicates[category]) {
            duplicates[category] = duplicates[category]
              .map((group: DuplicateGroup) => ({
                ...group,
                books: group.books.filter((book: DuplicateBook) => book.id !== bookId),
                count: group.books.filter((book: DuplicateBook) => book.id !== bookId).length
              }))
              .filter((group: DuplicateGroup) => group.books.length > 1); // Remove groups with only 1 book
          }
        });
        
        // Update summary counts
        const totalBooks = Object.values(duplicates).flat()
          .reduce((sum, group) => sum + (group.books?.length || 0), 0);
        const totalGroups = Object.values(duplicates)
          .reduce((sum, category) => sum + (category?.length || 0), 0);
        
        updatedData.summary.total_duplicate_books = totalBooks;
        updatedData.summary.total_duplicate_groups = totalGroups;
        
        setDuplicatesData(updatedData);
      }
      
      // Remove from selected if it was selected
      const newSelected = new Set(selectedBooks);
      newSelected.delete(bookId);
      setSelectedBooks(newSelected);
      
      // Notify parent component that books were deleted (after animations complete)
      if (onBooksDeleted) {
        setTimeout(() => {
          onBooksDeleted();
        }, 400); // Wait for slide-out animation to complete
      }
      
    } catch (error) {
      console.error(`Failed to delete book ${bookId}:`, error);
      alert(`Failed to delete book ${bookId}. Please try again.`);
    } finally {
      setDeletingBooks(prev => {
        const newSet = new Set(prev);
        newSet.delete(bookId);
        return newSet;
      });
      // Clear fading groups after animation completes
      setTimeout(() => {
        setFadingGroups(new Set());
      }, 100);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedBooks.size === 0) return;
    
    setDeleting(true);
    const bookIds = Array.from(selectedBooks);
    const successfullyDeletedIds: number[] = [];
    const failedIds: number[] = [];
    
    try {
      // Mark all books as being deleted for visual feedback
      setDeletingBooks(new Set(bookIds));
      
      // Delete books sequentially with small delays
      for (const bookId of bookIds) {
        try {
          const response = await fetch(`/api/admin/books/${bookId}`, {
            method: 'DELETE',
            credentials: 'include'
          });

          if (response.ok) {
            successfullyDeletedIds.push(bookId);
            console.log(`Successfully deleted book ${bookId}`);
          } else {
            failedIds.push(bookId);
            console.error(`Failed to delete book ${bookId}: ${response.status}`);
          }
          
          // Small delay between deletions for smoother UX
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          failedIds.push(bookId);
          console.error(`Failed to delete book ${bookId}:`, error);
        }
      }

      // Check which groups will disappear and fade them out (only for successfully deleted books)
      const currentGroups = getAllDuplicateGroups();
      const affectedGroups = currentGroups.filter(group => 
        group.books.some(book => successfullyDeletedIds.includes(book.id))
      );

      const groupsToFade = affectedGroups
        .filter(group => {
          const remainingBooks = group.books.filter(book => !successfullyDeletedIds.includes(book.id));
          return remainingBooks.length < 2; // Groups with less than 2 remaining books will disappear
        })
        .map(group => `${group.type}-${group.books.map(b => b.id).sort().join('-')}`);
      
      if (groupsToFade.length > 0) {
        setFadingGroups(new Set(groupsToFade));
        await new Promise(resolve => setTimeout(resolve, 600)); // Wait for fade animation
      }

      // Show results
      if (successfullyDeletedIds.length > 0) {
        console.log(`Successfully deleted ${successfullyDeletedIds.length} books: ${successfullyDeletedIds.join(', ')}`);
      }
      if (failedIds.length > 0) {
        console.error(`Failed to delete ${failedIds.length} books: ${failedIds.join(', ')}`);
        alert(`Failed to delete ${failedIds.length} out of ${bookIds.length} books. Check console for details.`);
      }

      // Update duplicates data locally instead of refetching
      if (duplicatesData && successfullyDeletedIds.length > 0) {
        const updatedData = { ...duplicatesData };
        const duplicates = updatedData.duplicates;
        
        // Remove books from all duplicate categories
        (['by_isbn', 'by_title_author'] as const).forEach((category: keyof typeof duplicates) => {
          if (duplicates[category]) {
            duplicates[category] = duplicates[category]
              .map((group: DuplicateGroup) => ({
                ...group,
                books: group.books.filter((book: DuplicateBook) => !successfullyDeletedIds.includes(book.id)),
                count: group.books.filter((book: DuplicateBook) => !successfullyDeletedIds.includes(book.id)).length
              }))
              .filter((group: DuplicateGroup) => group.books.length > 1); // Remove groups with only 1 book
          }
        });
        
        // Update summary counts
        const totalBooks = Object.values(duplicates).flat()
          .reduce((sum, group) => sum + (group.books?.length || 0), 0);
        const totalGroups = Object.values(duplicates)
          .reduce((sum, category) => sum + (category?.length || 0), 0);
        
        updatedData.summary.total_duplicate_books = totalBooks;
        updatedData.summary.total_duplicate_groups = totalGroups;
        
        setDuplicatesData(updatedData);
        
        // Force a small delay to ensure state consistency
        setTimeout(() => {
          console.log('State updated after bulk delete');
        }, 50);
      }
      
      // Clear selection
      setSelectedBooks(new Set());
      
      // Notify parent component that books were deleted (only if some were successful)
      if (onBooksDeleted && successfullyDeletedIds.length > 0) {
        setTimeout(() => {
          onBooksDeleted();
        }, 700); // Wait for all animations to complete
      }
      
    } catch (error) {
      console.error('Failed to delete books:', error);
      alert('Failed to delete selected books. Please try again.');
    } finally {
      setDeleting(false);
      setDeletingBooks(new Set());
      // Clear fading groups after animation completes
      setTimeout(() => {
        setFadingGroups(new Set());
      }, 100);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className={`fixed top-0 left-0 right-0 bottom-0 bg-black backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
        isVisible && !isClosing ? 'bg-opacity-50' : 'bg-opacity-0'
      }`}
      style={{ margin: 0 }}
      onClick={handleClose}
    >
      <div 
        className={`bg-card rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col transition-all duration-200 ${
          isVisible && !isClosing 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <h2 className="text-xl font-semibold text-foreground">Duplicate Manager</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-muted-foreground">Scanning for duplicates...</span>
            </div>
          ) : allGroups.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2 text-foreground">No Duplicates Found</h3>
              <p className="text-muted-foreground">
                Your library is clean! No duplicate books were detected.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Actions Bar */}
              <div className="flex items-center justify-between bg-muted p-4 rounded-lg">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    Found {allGroups.reduce((acc, group) => acc + group.books.length, 0)} duplicate books in {allGroups.length} groups
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
              {allGroups.map((group, groupIndex) => {
                const groupKey = `${group.type}-${group.books.map(b => b.id).sort().join('-')}`;
                const isFading = fadingGroups.has(groupKey);
                
                return (
                <Collapsible.Root
                  key={groupKey} // Use stable key based on content, not index
                  open={!isFading}
                  className="overflow-hidden"
                >
                  <Collapsible.Content className="data-[state=closed]:animate-out data-[state=closed]:translate-x-full data-[state=closed]:opacity-0 data-[state=open]:animate-in data-[state=open]:translate-x-0 data-[state=open]:opacity-100 transition-all duration-300 ease-out">
                    <Card className="mb-6">
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
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {group.books.map((book) => {
                        const isBeingDeleted = deletingBooks.has(book.id);
                        
                        return (
                        <div 
                          key={book.id} 
                          className={`relative bg-card rounded-lg border border-border overflow-hidden transition-all duration-300 ${
                            isBeingDeleted 
                              ? 'opacity-50 scale-95 ring-2 ring-red-500 ring-opacity-50' 
                              : 'hover:shadow-md opacity-100 scale-100'
                          }`}
                        >
                          {/* Checkbox */}
                          <div className="absolute top-2 left-2 z-10">
                            <div className="bg-card/90 backdrop-blur-sm rounded-md p-1 shadow-sm border border-border/50">
                              <Checkbox
                                checked={selectedBooks.has(book.id)}
                                onCheckedChange={(checked) => 
                                  handleSelectBook(book.id, checked as boolean)
                                }
                              />
                            </div>
                          </div>
                          
                          {/* Delete Button */}
                          <div className="absolute top-2 right-2 z-10">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteSingle(book.id)}
                              disabled={deleting}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {/* Cover */}
                          <div className="aspect-[2/3] bg-gray-100 dark:bg-gray-700 relative">
                            <img 
                              src={`/api/metadata/books/${book.id}/cover`}
                              alt={book.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onLoad={() => {
                                console.log(`Cover loaded for book ${book.id}: ${book.title}`);
                              }}
                              onError={(e) => {
                                console.log(`Cover failed for book ${book.id}: ${book.title}, has_cover: ${book.has_cover}`);
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = document.createElement('div');
                                fallback.className = 'w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-600';
                                fallback.innerHTML = '<svg class="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path></svg>';
                                target.parentElement?.appendChild(fallback);
                              }}
                            />
                          </div>
                          
                          {/* Book Details */}
                          <div className="p-3">
                            <h4 className="font-medium text-sm text-foreground line-clamp-2 mb-1">
                              {book.title}
                            </h4>
                            <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                              {AuthorFormatter.formatForDisplay(book.authors.join(', '))}
                            </p>
                            {book.formats && book.formats.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {book.formats.slice(0, 2).map((format) => (
                                  <span key={format} className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                                    {format}
                                  </span>
                                ))}
                                {book.formats.length > 2 && (
                                  <span className="text-xs text-gray-500 self-center">+{book.formats.length - 2}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </CardContent>
                    </Card>
                  </Collapsible.Content>
                </Collapsible.Root>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50 dark:bg-gray-800">
          <Button 
            variant="outline" 
            onClick={() => {
              resetTransientState();
              fetchDuplicates();
            }} 
            disabled={loading}
          >
            Refresh
          </Button>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
