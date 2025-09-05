import { ChevronDown, ArrowUp, ArrowDown, User, FileText, Calendar, Globe, BookOpen } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

export type SearchSortParam = 
  | 'title-asc'      // Title A-Z
  | 'title-desc'     // Title Z-A
  | 'author-asc'     // Author A-Z
  | 'author-desc'    // Author Z-A
  | 'format-asc'     // File Type A-Z
  | 'format-desc'    // File Type Z-A
  | 'year-asc'       // Publish Date (Oldest)
  | 'year-desc'      // Publish Date (Newest)
  | 'language-asc'   // Language A-Z
  | 'language-desc'  // Language Z-A

interface SearchSortDropdownProps {
  sortParam: SearchSortParam
  onSortChange: (sort: SearchSortParam) => void
  disabled?: boolean
  className?: string
}

// Sort options configuration with icons
const sortOptions = [
  { value: 'title-asc' as SearchSortParam, label: 'Title (A-Z)', icon: ArrowUp },
  { value: 'title-desc' as SearchSortParam, label: 'Title (Z-A)', icon: ArrowDown },
  { value: 'author-asc' as SearchSortParam, label: 'Author (A-Z)', icon: User },
  { value: 'author-desc' as SearchSortParam, label: 'Author (Z-A)', icon: User },
  { value: 'format-asc' as SearchSortParam, label: 'File Type (A-Z)', icon: FileText },
  { value: 'format-desc' as SearchSortParam, label: 'File Type (Z-A)', icon: FileText },
  { value: 'year-asc' as SearchSortParam, label: 'Publish Date (Oldest)', icon: Calendar },
  { value: 'year-desc' as SearchSortParam, label: 'Publish Date (Newest)', icon: Calendar },
  { value: 'language-asc' as SearchSortParam, label: 'Language (A-Z)', icon: Globe },
  { value: 'language-desc' as SearchSortParam, label: 'Language (Z-A)', icon: Globe }
]

export function SearchSortDropdown({
  sortParam,
  onSortChange,
  disabled = false,
  className = ''
}: SearchSortDropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          disabled={disabled}
          className={`flex items-center gap-2 ${className}`}
          title={sortOptions.find(option => option.value === sortParam)?.label || 'Sort by...'}
        >
          {(() => {
            const currentOption = sortOptions.find(option => option.value === sortParam)
            const IconComponent = currentOption?.icon || BookOpen
            return <IconComponent className="h-4 w-4" />
          })()}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content 
          className="min-w-[180px] sm:min-w-[220px] bg-background border border-border rounded-md shadow-lg p-1 z-50"
          align="end"
          sideOffset={4}
        >
          {sortOptions.map((option) => {
            const IconComponent = option.icon
            return (
              <DropdownMenu.Item
                key={option.value}
                className={`
                  flex items-center gap-3 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none
                  hover:bg-accent hover:text-accent-foreground
                  focus:bg-accent focus:text-accent-foreground
                  ${sortParam === option.value ? 'bg-accent text-accent-foreground' : ''}
                `}
                onSelect={() => onSortChange(option.value)}
              >
                <IconComponent className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{option.label}</span>
              </DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
