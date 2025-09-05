import { type Book } from '../../../hooks/useDownloads'
import { type SearchSortParam } from '../components/SearchSortDropdown'

/**
 * Sort search results based on the selected sort parameter
 */
export function sortSearchResults(books: Book[], sortParam: SearchSortParam): Book[] {
  if (!books || books.length === 0) return books

  const sortedBooks = [...books]

  switch (sortParam) {
    case 'title-asc':
      return sortedBooks.sort((a, b) => 
        (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase())
      )
    
    case 'title-desc':
      return sortedBooks.sort((a, b) => 
        (b.title || '').toLowerCase().localeCompare((a.title || '').toLowerCase())
      )
    
    case 'author-asc':
      return sortedBooks.sort((a, b) => 
        (a.author || '').toLowerCase().localeCompare((b.author || '').toLowerCase())
      )
    
    case 'author-desc':
      return sortedBooks.sort((a, b) => 
        (b.author || '').toLowerCase().localeCompare((a.author || '').toLowerCase())
      )
    
    case 'format-asc':
      return sortedBooks.sort((a, b) => 
        (a.format || '').toLowerCase().localeCompare((b.format || '').toLowerCase())
      )
    
    case 'format-desc':
      return sortedBooks.sort((a, b) => 
        (b.format || '').toLowerCase().localeCompare((a.format || '').toLowerCase())
      )
    
    case 'year-asc':
      return sortedBooks.sort((a, b) => {
        const yearA = parseInt(a.year || '0', 10)
        const yearB = parseInt(b.year || '0', 10)
        return yearA - yearB
      })
    
    case 'year-desc':
      return sortedBooks.sort((a, b) => {
        const yearA = parseInt(a.year || '0', 10)
        const yearB = parseInt(b.year || '0', 10)
        return yearB - yearA
      })
    
    case 'language-asc':
      return sortedBooks.sort((a, b) => 
        (a.language || '').toLowerCase().localeCompare((b.language || '').toLowerCase())
      )
    
    case 'language-desc':
      return sortedBooks.sort((a, b) => 
        (b.language || '').toLowerCase().localeCompare((a.language || '').toLowerCase())
      )
    
    default:
      return sortedBooks
  }
}
