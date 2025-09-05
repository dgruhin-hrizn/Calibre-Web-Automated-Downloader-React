import { useState, useEffect } from 'react'
import type { UnifiedBook } from '../../components/UnifiedBookCard'

export function useSeriesImageLoading(seriesBooks: Map<number, UnifiedBook[]>) {
  const [imageLoadQueue, setImageLoadQueue] = useState<number[]>([])
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set())
  const [currentlyLoadingImages, setCurrentlyLoadingImages] = useState<Set<number>>(new Set())
  
  // Reduced concurrent loading for series page (more images total)
  const MAX_CONCURRENT_IMAGES = 3

  // Update queue when series books change
  useEffect(() => {
    const allBookIds: number[] = []
    seriesBooks.forEach((books) => {
      books.forEach(book => allBookIds.push(book.id))
    })
    setImageLoadQueue(allBookIds)
  }, [seriesBooks])

  // Concurrent image loading effect
  useEffect(() => {
    if (imageLoadQueue.length === 0) return
    
    const imagesToLoad = imageLoadQueue
      .filter(id => !loadedImages.has(id) && !currentlyLoadingImages.has(id))
      .slice(0, MAX_CONCURRENT_IMAGES - currentlyLoadingImages.size)
    
    if (imagesToLoad.length > 0) {
      setCurrentlyLoadingImages(prev => new Set([...prev, ...imagesToLoad]))
    }
  }, [imageLoadQueue, loadedImages, currentlyLoadingImages])
  
  const markImageLoaded = (bookId: number) => {
    setLoadedImages(prev => new Set([...prev, bookId]))
    setCurrentlyLoadingImages(prev => {
      const newSet = new Set(prev)
      newSet.delete(bookId)
      return newSet
    })
  }
  
  const shouldLoadImage = (bookId: number) => {
    return currentlyLoadingImages.has(bookId) || loadedImages.has(bookId)
  }

  // Priority loading for visible series
  const prioritizeSeriesImages = (seriesId: number) => {
    const seriesBookIds = seriesBooks.get(seriesId)?.map(book => book.id) || []
    setImageLoadQueue(prev => {
      // Move series books to front of queue
      const otherBooks = prev.filter(id => !seriesBookIds.includes(id))
      return [...seriesBookIds, ...otherBooks]
    })
  }

  return {
    shouldLoadImage,
    markImageLoaded,
    prioritizeSeriesImages,
    loadingStats: {
      total: imageLoadQueue.length,
      loaded: loadedImages.size,
      loading: currentlyLoadingImages.size
    }
  }
}
