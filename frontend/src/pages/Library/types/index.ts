export type LibraryBook = {
  id: number
  title: string
  authors: string[]
  series?: string
  series_index?: number
  rating?: number
  pubdate?: string
  timestamp?: string
  tags: string[]
  languages: string[]
  formats: string[]
  path: string
  has_cover: boolean
  comments?: string
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
export type SortParam = 'new' | 'old' | 'az' | 'za'
