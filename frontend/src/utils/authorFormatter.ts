// Comprehensive author formatting utilities for consistent display across the app

export const AuthorFormatter = {
  // Detect if a name part is in "Last, First" format
  isLastFirstFormat: (namePart: string): boolean => {
    const trimmed = namePart.trim()
    if (!trimmed.includes(',')) return false
    
    const parts = trimmed.split(',').map(p => p.trim())
    if (parts.length !== 2) return false
    
    // Both parts should be non-empty and look like names
    // Last name should be a single word, first name can be multiple words
    return parts[0].length > 0 && parts[1].length > 0 && 
           !parts[0].includes(' ') && parts[1].split(' ').length <= 3
  },

  // Convert "Last, First" to "First Last"
  convertLastFirst: (namePart: string): string => {
    const parts = namePart.split(',').map(p => p.trim())
    return `${parts[1]} ${parts[0]}`
  },

  // Format any author string for display (converts all "Last, First" to "First Last")
  formatForDisplay: (author: string): string => {
    if (!author) return author
    
    // Split by comma to handle multiple authors
    const parts = author.split(',').map(p => p.trim())
    const formattedParts: string[] = []
    
    let i = 0
    while (i < parts.length) {
      if (i + 1 < parts.length) {
        // Check if this is a "Last, First" pair
        const combined = `${parts[i]}, ${parts[i + 1]}`
        if (AuthorFormatter.isLastFirstFormat(combined)) {
          // Convert "Last, First" to "First Last"
          formattedParts.push(AuthorFormatter.convertLastFirst(combined))
          i += 2 // Skip next part as it was part of this name
          continue
        }
      }
      
      // Not a "Last, First" format, keep as-is
      formattedParts.push(parts[i])
      i++
    }
    
    return formattedParts.join(', ')
  },

  // Format for search (use first author only, converted to "First Last")
  formatForSearch: (author: string): string => {
    const displayFormat = AuthorFormatter.formatForDisplay(author)
    // Return first author only for search
    return displayFormat.split(', ')[0]
  },

  // Get all authors as array (useful for complex processing)
  getAuthorsArray: (author: string): string[] => {
    const formatted = AuthorFormatter.formatForDisplay(author)
    return formatted.split(', ').map(a => a.trim()).filter(a => a.length > 0)
  }
}

// Test examples:
// AuthorFormatter.formatForDisplay("Brown, Dan") → "Dan Brown"
// AuthorFormatter.formatForDisplay("Dan Brown") → "Dan Brown" 
// AuthorFormatter.formatForDisplay("Brown, Dan, King, Stephen") → "Dan Brown, Stephen King"
// AuthorFormatter.formatForDisplay("Dan Brown, Stephen King") → "Dan Brown, Stephen King"
// AuthorFormatter.formatForSearch("Brown, Dan, King, Stephen") → "Dan Brown"
