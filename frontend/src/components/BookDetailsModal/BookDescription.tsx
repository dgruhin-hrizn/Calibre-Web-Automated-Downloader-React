interface BookDescriptionProps {
  description?: string
}

export function BookDescription({ description }: BookDescriptionProps) {
  if (!description) return null

  return (
    <div className="bg-muted/30 rounded-lg p-4">
      <div 
        className="text-sm text-foreground leading-relaxed max-h-24 overflow-y-auto prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: description }}
      />
    </div>
  )
}
