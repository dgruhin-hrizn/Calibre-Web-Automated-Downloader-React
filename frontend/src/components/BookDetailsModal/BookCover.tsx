
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
            fallback.className = 'w-full max-w-[200px] mx-auto h-[300px] bg-muted rounded-lg flex flex-col items-center justify-center border border-border p-4 text-center'
            fallback.innerHTML = '<img src="/droplet.png" alt="No cover available" class="w-16 h-16 mb-3 opacity-60"><span class="text-sm text-muted-foreground font-medium">No Available Cover</span>'
            target.parentNode?.insertBefore(fallback, target)
          }}
        />
      ) : (
        <div className="w-full max-w-[200px] mx-auto h-[300px] bg-muted rounded-lg flex flex-col items-center justify-center border border-border p-4 text-center">
          <img 
            src="/droplet.png" 
            alt="No cover available" 
            className="w-16 h-16 mb-3 opacity-60"
          />
          <span className="text-sm text-muted-foreground font-medium">
            No Available Cover
          </span>
        </div>
      )}
    </div>
  )
}
