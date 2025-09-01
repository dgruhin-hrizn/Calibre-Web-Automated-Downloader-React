interface CategoryTagsProps {
  categories?: string[]
}

export function CategoryTags({ categories }: CategoryTagsProps) {
  if (!categories || categories.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category: string, index: number) => (
        <span 
          key={index} 
          className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full border border-primary/20"
        >
          {category}
        </span>
      ))}
    </div>
  )
}
