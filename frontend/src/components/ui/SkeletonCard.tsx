export function SkeletonCard() {
  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden animate-pulse">
      <div className="flex flex-col h-full">
        {/* Book Cover Skeleton - Same 2:3 aspect ratio */}
        <div className="relative aspect-[2/3] bg-gray-200 dark:bg-gray-700"></div>
        
        {/* Book Info Skeleton */}
        <div className="p-3 flex-1 flex flex-col">
          <div className="flex-1 space-y-2">
            {/* Title skeleton - 2 lines */}
            <div className="space-y-1">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
            
            {/* Author skeleton */}
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
            
            {/* Metadata badges skeleton */}
            <div className="flex gap-1 mt-2">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-10"></div>
            </div>
          </div>
          
          {/* Action buttons skeleton */}
          <div className="flex flex-col gap-1.5 mt-3">
            <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
      </div>
      <div className="flex flex-wrap gap-4 justify-start">
        {Array.from({ length: count }, (_, i) => (
          <div 
            key={i}
            className="w-[calc(50%-8px)] sm:w-[225px] sm:min-w-[225px] sm:max-w-[225px]"
          >
            <SkeletonCard />
          </div>
        ))}
      </div>
    </div>
  )
}
