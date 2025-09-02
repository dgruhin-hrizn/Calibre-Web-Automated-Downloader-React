export type LibraryBook = {
  id: number
  title: string
  authors: string[]
  series?: string
  series_index?: number
  rating?: number
  pubdate?: string
  timestamp?: string
  last_modified?: string
  tags: string[]
  languages: string[]
  formats: string[]
  file_sizes: Record<string, number>
  path: string
  has_cover: boolean
  comments?: string
  isbn?: string
  uuid?: string
  publishers: string[]
}

export type CWALibraryResponse = {
  totalNotFiltered: number
  rows: LibraryBook[]
  total: number
  page: number
  per_page: number
  pages: number
}

export type LibraryStats = {
  total_books: number
  total_authors: number
  total_series: number
  total_tags: number
}

export type ViewMode = 'grid' | 'list'
export type SortParam = 
  | 'new'        // Sort by date added, newest first
  | 'old'        // Sort by date added, oldest first  
  | 'abc'        // Sort title A-Z
  | 'zyx'        // Sort title Z-A
  | 'authaz'     // Sort authors A-Z
  | 'authza'     // Sort authors Z-A
  | 'pubnew'     // Sort by publication date, newest first
  | 'pubold'     // Sort by publication date, oldest first
  | 'seriesasc'  // Sort by series index ascending
  | 'seriesdesc' // Sort by series index descending
  | 'hotasc'     // Sort by download count ascending
  | 'hotdesc'    // Sort by download count descending
