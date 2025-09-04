import { LibraryPagination } from './LibraryPagination'
import type { SortParam } from '../types'

interface LibraryMobileFooterProps {
  // Sort controls (kept for compatibility but not used)
  sortParam: SortParam
  onSortChange: (sort: SortParam) => void
  loading: boolean
  
  // Pagination controls
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function LibraryMobileFooter({
  sortParam: _sortParam,
  onSortChange: _onSortChange,
  loading: _loading,
  currentPage,
  totalPages,
  onPageChange
}: LibraryMobileFooterProps) {
  // Only show pagination footer if there are multiple pages
  if (totalPages <= 1) {
    return null
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 border-t border-border">
      <div className="px-4 py-3">
        <div className="flex items-center justify-center">
          {/* Use the exact same pagination component as desktop */}
          <LibraryPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      </div>
    </div>
  )
}
