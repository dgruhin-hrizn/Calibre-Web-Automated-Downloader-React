import React, { useState, useEffect } from 'react'
import { imageCache } from '../../lib/imageCache'

interface CachedImageProps {
  src: string
  alt: string
  className?: string
  onLoad?: () => void
  onError?: (error: any) => void
  style?: React.CSSProperties
}

export function CachedImage({ src, alt, className, onLoad, onError, style }: CachedImageProps) {
  const [imageSrc, setImageSrc] = useState<string>('')
  const [, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (!src) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setHasError(false)

    // Get cached image or fetch and cache it
    imageCache.getImage(src)
      .then(cachedUrl => {
        setImageSrc(cachedUrl)
        setIsLoading(false)
        onLoad?.()
      })
      .catch(error => {
        setHasError(true)
        setIsLoading(false)
        onError?.(error)
      })
  }, [src]) // Remove onLoad and onError from dependencies to prevent re-renders

  // Listen for cover update events to refresh cached images
  useEffect(() => {
    const handleCoverUpdate = (event: CustomEvent) => {
      const { baseUrl } = event.detail
      
      // Check if this cached image is for the updated cover
      if (src && src.includes(baseUrl)) {
        // Clear the current image and refetch
        setImageSrc('')
        setIsLoading(true)
        setHasError(false)
        
        // Force refetch from server (cache was already invalidated)
        imageCache.getImage(src)
          .then(cachedUrl => {
            setImageSrc(cachedUrl)
            setIsLoading(false)
            onLoad?.()
          })
          .catch(error => {
            setHasError(true)
            setIsLoading(false)
            onError?.(error)
          })
      }
    }

    window.addEventListener('coverUpdated', handleCoverUpdate as EventListener)
    
    return () => {
      window.removeEventListener('coverUpdated', handleCoverUpdate as EventListener)
    }
  }, [src, onLoad, onError])

  if (!src || hasError) {
    return null
  }

  // Don't render img element until we have a valid imageSrc
  if (!imageSrc) {
    return null
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      style={style}
      onLoad={() => {
        setIsLoading(false)
        onLoad?.()
      }}
      onError={(e) => {
        setHasError(true)
        setIsLoading(false)
        onError?.(e)
      }}
    />
  )
}
