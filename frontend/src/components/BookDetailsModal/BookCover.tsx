import { Book } from 'lucide-react'

interface BookCoverProps {
  preview?: string
  title: string
}

export function BookCover({ preview, title }: BookCoverProps) {
  return (
    <div className="md:col-span-1">
      {preview ? (
        <img
          src={preview}
          alt={`${title} cover`}
          className="w-full max-w-[200px] mx-auto h-[300px] rounded-lg shadow-lg object-cover border border-border"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = ''
            target.style.display = 'none'
            const fallback = document.createElement('div')
            fallback.className = 'w-full max-w-[200px] mx-auto h-[300px] bg-muted rounded-lg flex items-center justify-center border border-border'
            fallback.innerHTML = '<svg class="w-16 h-16 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>'
            target.parentNode?.insertBefore(fallback, target)
          }}
        />
      ) : (
        <div className="w-full max-w-[200px] mx-auto h-[300px] bg-muted rounded-lg flex items-center justify-center border border-border">
          <Book className="w-16 h-16 text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
