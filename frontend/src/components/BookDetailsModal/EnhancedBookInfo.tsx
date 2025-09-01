import React from 'react'
import { Book, Star, Calendar, FileText, Globe, Hash, Tag, ExternalLink, Database } from 'lucide-react'

interface EnhancedBookInfoProps {
  book: any
  googleBooksData?: any
}

export const EnhancedBookInfo: React.FC<EnhancedBookInfoProps> = ({ book, googleBooksData }) => {
  if (!book) return null

  const volumeInfo = googleBooksData?.volumeInfo || {}
  const info = book.info || {}

  // Function to clean and enhance HTML description
  const formatDescription = (htmlContent: string) => {
    if (!htmlContent) return ''
    
    // Log the original HTML to see what we're working with
    console.log('Original HTML description:', htmlContent)
    
    // Clean up common HTML issues and enhance formatting
    const formatted = htmlContent
      .replace(/<br\s*\/?>/gi, '<br/>') // Normalize br tags
      .replace(/\n\s*\n/g, '</p><p>') // Convert double newlines to paragraphs
      .replace(/^(?!<p>)/, '<p>') // Add opening p tag if missing
      .replace(/(?!<\/p>)$/, '</p>') // Add closing p tag if missing
      .replace(/<p><\/p>/g, '') // Remove empty paragraphs
      .replace(/<p><br\/><\/p>/g, '<br/>') // Convert paragraph with just br to br
    
    console.log('Formatted HTML description:', formatted)
    return formatted
  }

  // Function to format published date to MM/DD/YYYY
  const formatPublishedDate = (dateString: string) => {
    if (!dateString) return ''
    
    // Handle different date formats from Google Books API
    try {
      let date: Date
      
      if (dateString.match(/^\d{4}$/)) {
        // Just year: "2023" -> "01/01/2023"
        date = new Date(`${dateString}-01-01`)
      } else if (dateString.match(/^\d{4}-\d{2}$/)) {
        // Year-month: "2023-05" -> "05/01/2023"
        date = new Date(`${dateString}-01`)
      } else if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Full date: "2023-05-15" -> "05/15/2023"
        date = new Date(dateString)
      } else {
        // Try to parse as-is
        date = new Date(dateString)
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return dateString // Return original if parsing fails
      }
      
      // Format as MM/DD/YYYY
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const day = date.getDate().toString().padStart(2, '0')
      const year = date.getFullYear()
      
      return `${month}/${day}/${year}`
    } catch (error) {
      console.warn('Error formatting date:', dateString, error)
      return dateString // Return original on error
    }
  }

  // Get the best available data from both sources
  const getBestData = () => {
    return {
      // Anna's Archive primary data
      title: book.title,
      author: book.author,
      publisher: book.publisher || volumeInfo.publisher,
      year: book.year || volumeInfo.publishedDate?.split('-')[0],
      language: book.language,
      format: book.format,
      size: book.size,
      
      // Google Books enhanced data
      description: volumeInfo.description,
      categories: volumeInfo.categories || [],
      averageRating: volumeInfo.averageRating,
      ratingsCount: volumeInfo.ratingsCount,
      pageCount: volumeInfo.pageCount,
      publishedDate: formatPublishedDate(volumeInfo.publishedDate) || (book.year ? `01/01/${book.year}` : ''),
      infoLink: volumeInfo.infoLink,
      previewLink: volumeInfo.previewLink,
      
      // Combined identifiers
      identifiers: {
        ...getIdentifiersFromInfo(info),
        ...(volumeInfo.industryIdentifiers ? getIdentifiersFromGoogle(volumeInfo.industryIdentifiers) : {})
      }
    }
  }

  const getIdentifiersFromInfo = (info: Record<string, string[]>) => {
    const identifiers: Record<string, string> = {}
    
    Object.entries(info).forEach(([key, values]) => {
      if (key.toLowerCase().includes('isbn')) {
        identifiers.ISBN = values[0]
      } else if (key.toLowerCase().includes('asin')) {
        identifiers.ASIN = values[0]
      } else if (key.toLowerCase().includes('goodreads')) {
        identifiers.Goodreads = values[0]
      }
    })
    
    return identifiers
  }

  const getIdentifiersFromGoogle = (industryIds: any[]) => {
    const identifiers: Record<string, string> = {}
    
    industryIds.forEach(id => {
      if (id.type === 'ISBN_13' || id.type === 'ISBN_10') {
        identifiers.ISBN = id.identifier
      }
    })
    
    return identifiers
  }

  const data = getBestData()

  return (
    <div className="space-y-6">
      {/* Publication Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column - Publication Info */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Publication Details
          </h3>
          
          <div className="space-y-3 text-sm">
            {data.publisher && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Publisher:</span>
                <span className="text-foreground text-right">{data.publisher}</span>
              </div>
            )}
            
            {data.publishedDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Published:</span>
                <span className="text-foreground">{data.publishedDate}</span>
              </div>
            )}
            
            {data.language && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Language:</span>
                <span className="text-foreground capitalize">{data.language}</span>
              </div>
            )}
            
            {data.pageCount && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pages:</span>
                <span className="text-foreground">{data.pageCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - File Info */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            File Details
          </h3>
          
          <div className="space-y-3 text-sm">
            {data.format && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Format:</span>
                <span className="text-foreground uppercase">{data.format}</span>
              </div>
            )}
            
            {data.size && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">File Size:</span>
                <span className="text-foreground">{data.size}</span>
              </div>
            )}
            
            {(data.averageRating || data.ratingsCount) && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rating:</span>
                <div className="flex items-center gap-1">
                  {data.averageRating && (
                    <>
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-foreground">{data.averageRating}</span>
                    </>
                  )}
                  {data.ratingsCount && (
                    <span className="text-muted-foreground">({data.ratingsCount} reviews)</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Categories/Genres under File Details */}
          {data.categories.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-border/50">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" />
                Categories
              </h4>
              <div className="flex flex-wrap gap-1">
                {data.categories.map((category: string, index: number) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Identifiers under File Details */}
          {Object.keys(data.identifiers).length > 0 && (
            <div className="space-y-2 pt-3 border-t border-border/50">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Hash className="w-4 h-4 text-primary" />
                Identifiers
              </h4>
              <div className="space-y-1 text-xs">
                {Object.entries(data.identifiers).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{key}:</span>
                    <span className="text-foreground font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* External Links under File Details */}
          {(data.infoLink || data.previewLink) && (
            <div className="space-y-2 pt-3 border-t border-border/50">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-primary" />
                External Links
              </h4>
              <div className="space-y-1">
                {data.infoLink && (
                  <a
                    href={data.infoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Globe className="w-3 h-3" />
                    Google Books Info
                  </a>
                )}
                {data.previewLink && (
                  <a
                    href={data.previewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline block"
                  >
                    <Book className="w-3 h-3" />
                    Google Books Preview
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {data.description && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Book className="w-5 h-5 text-primary" />
            Description
          </h3>
          <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed">
            <div 
              className="[&>p]:mb-3 [&>p:last-child]:mb-0 [&>br]:block [&>br]:mb-2 [&>b]:font-semibold [&>strong]:font-semibold [&>i]:italic [&>em]:italic [&>u]:underline [&>blockquote]:border-l-4 [&>blockquote]:border-primary/20 [&>blockquote]:pl-4 [&>blockquote]:italic [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4"
              dangerouslySetInnerHTML={{ __html: formatDescription(data.description) }} 
            />
          </div>
        </div>
      )}

      {/* Additional Anna's Archive Info */}
      {Object.keys(info).length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Additional Information
          </h3>
          <div className="grid grid-cols-1 gap-2 text-sm">
            {Object.entries(info)
              .filter(([key]) => !key.toLowerCase().includes('isbn') && 
                                !key.toLowerCase().includes('asin') && 
                                !key.toLowerCase().includes('goodreads'))
              .map(([key, values]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">{key.replace(/-/g, ' ')}:</span>
                  <span className="text-foreground text-right">
                    {Array.isArray(values) ? values.join(', ') : values}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
