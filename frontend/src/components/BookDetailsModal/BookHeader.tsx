interface BookHeaderProps {
  title: string
  authors?: string[]
  fallbackAuthor?: string
}

export function BookHeader({ title, authors, fallbackAuthor }: BookHeaderProps) {
  const displayAuthors = authors?.join(' & ') || fallbackAuthor || 'Unknown Author'
  
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-1">
        {title || 'Untitled'}
      </h1>
      <p className="text-lg text-primary font-medium">
        by {displayAuthors}
      </p>
    </div>
  )
}
