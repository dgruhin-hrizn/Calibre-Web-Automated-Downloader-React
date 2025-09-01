import { useState, useEffect } from 'react'
import type { LibraryBook } from '../types'

export function useImageLoading(books: LibraryBook[]) {
  const [imageLoadQueue, setImageLoadQueue] = useState<number[]>([])
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set())
  const [currentlyLoadingImages, setCurrentlyLoadingImages] = useState<Set<number>>(new Set())
  
  const MAX_CONCURRENT_IMAGES = 4

  // Update queue when books change
  useEffect(() => {
    const bookIds = books.map(book => book.id)
    setImageLoadQueue(bookIds)
  }, [books])

  // Concurrent image loading effect
  useEffect(() => {
    if (imageLoadQueue.length === 0) return
    
    const imagesToLoad = imageLoadQueue
      .filter(id => !loadedImages.has(id) && !currentlyLoadingImages.has(id))
      .slice(0, MAX_CONCURRENT_IMAGES - currentlyLoadingImages.size)
    
    if (imagesToLoad.length > 0) {
      setCurrentlyLoadingImages(prev => new Set([...prev, ...imagesToLoad]))
    }
  }, [imageLoadQueue, loadedImages, currentlyLoadingImages, MAX_CONCURRENT_IMAGES])
  
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

  return {
    shouldLoadImage,
    markImageLoaded
  }
}
