// Comprehensive author formatting utilities for consistent display across the app
// Matches the backend sanitize_author_name() logic from calibre_db_manager.py

export const AuthorFormatter = {
  // Sanitize author name with all backend fixes
  // Handles: pipe characters, "Last, First" format, multiple authors, whitespace
  sanitizeAuthorName: (authorName: string): string => {
    if (!authorName) return ""
    
    let cleaned = authorName.trim()
    
    // First handle pipe character cases - assume it's separating Last|First
    if (cleaned.includes('|')) {
      const parts = cleaned.split('|', 2) // Split on first pipe only
      if (parts.length === 2) {
        const last = parts[0].trim()
        const first = parts[1].trim()
        if (last && first) {
          // Convert "Last|First" to "First Last"
          cleaned = `${first} ${last}`
        } else {
          // Fallback: just remove pipes
          cleaned = authorName.replace(/\|/g, ' ').trim()
        }
      } else {
        // Multiple pipes or other cases - just remove all pipes
        cleaned = authorName.replace(/\|/g, ' ').trim()
      }
    }
    
    // Handle "Last, First" format (but be careful not to break multiple authors)
    if (cleaned.includes(',')) {
      const parts = cleaned.split(',').map(part => part.trim())
      
      // Check if this is a single "Last, First" format vs multiple authors
      if (parts.length === 2 && parts[0] && parts[1]) {
        // Check if this looks like "Last, First" format
        // Last name should be a single word, first name can be multiple words
        if (!parts[0].includes(' ') && parts[1].split(' ').length <= 3) {
          // Convert "Last, First" to "First Last"
          cleaned = `${parts[1]} ${parts[0]}`
        } else {
          // Keep as-is (might be multiple authors or complex name)
          cleaned = parts.join(', ')
        }
      } else if (parts.length > 2) {
        // Multiple authors - process each pair
        const processedParts: string[] = []
        let i = 0
        while (i < parts.length) {
          if (i + 1 < parts.length) {
            // Check if current and next part form a "Last, First" pair
            if (!parts[i].includes(' ') && parts[i + 1].split(' ').length <= 3) {
              // This looks like "Last, First" - convert it
              processedParts.push(`${parts[i + 1]} ${parts[i]}`)
              i += 2 // Skip the next part
              continue
            }
          }
          
          // Not a "Last, First" pair, keep as-is
          processedParts.push(parts[i])
          i++
        }
        
        cleaned = processedParts.join(', ')
      }
    }
    
    // Clean up extra whitespace
    cleaned = cleaned.split(/\s+/).join(' ').trim()
    
    return cleaned
  },

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

  // Format any author string for display (uses sanitizeAuthorName for consistency)
  formatForDisplay: (author: string): string => {
    return AuthorFormatter.sanitizeAuthorName(author)
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
// AuthorFormatter.formatForDisplay("Hannah| Kristin") → "Kristin Hannah"
// AuthorFormatter.formatForDisplay("King|Stephen") → "Stephen King"  
// AuthorFormatter.formatForDisplay("Dan Brown") → "Dan Brown" 
// AuthorFormatter.formatForDisplay("Brown, Dan, King, Stephen") → "Dan Brown, Stephen King"
// AuthorFormatter.formatForDisplay("  Smith , John  ") → "John Smith"
// AuthorFormatter.formatForDisplay("Dan Brown, Stephen King") → "Dan Brown, Stephen King"
// AuthorFormatter.formatForSearch("Brown, Dan, King, Stephen") → "Dan Brown"
