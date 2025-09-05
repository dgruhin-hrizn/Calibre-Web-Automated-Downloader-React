import React, { useState, useEffect } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, FreeMode, Virtual } from 'swiper/modules'
import { UnifiedBookCard, type UnifiedBook } from '../../../components/UnifiedBookCard'
import type { Swiper as SwiperType } from 'swiper'

interface SeriesCarouselProps {
  series: {
    id: number
    name: string
    books: UnifiedBook[]
    booksLoaded: boolean
  }
  onBookClick: (book: UnifiedBook) => void
  onDownload: (book: UnifiedBook) => void
  onSendToKindle: (book: UnifiedBook) => void
  shouldLoadImage: (bookId: number) => boolean
  markImageLoaded: (bookId: number) => void
  isVisible: boolean
}

export function SeriesCarousel({
  series,
  onBookClick,
  onDownload,
  onSendToKindle,
  shouldLoadImage,
  markImageLoaded,
  isVisible
}: SeriesCarouselProps) {
  const [swiperInstance, setSwiperInstance] = useState<SwiperType | null>(null)
  const [activeSlides, setActiveSlides] = useState<Set<number>>(new Set([0, 1, 2])) // Load first 3 slides initially

  // Update active slides based on swiper position
  useEffect(() => {
    if (!swiperInstance) return

    const handleSlideChange = () => {
      const activeIndex = swiperInstance.activeIndex
      const slidesPerView = Math.ceil(swiperInstance.params.slidesPerView as number)
      
      // Load current slide + buffer slides
      const newActiveSlides = new Set<number>()
      for (let i = Math.max(0, activeIndex - 1); i < Math.min(series.books.length, activeIndex + slidesPerView + 1); i++) {
        newActiveSlides.add(i)
      }
      
      setActiveSlides(newActiveSlides)
    }

    swiperInstance.on('slideChange', handleSlideChange)
    swiperInstance.on('reachEnd', handleSlideChange)
    swiperInstance.on('reachBeginning', handleSlideChange)

    return () => {
      swiperInstance.off('slideChange', handleSlideChange)
      swiperInstance.off('reachEnd', handleSlideChange)
      swiperInstance.off('reachBeginning', handleSlideChange)
    }
  }, [swiperInstance, series.books.length])

  // Only render books if series is visible
  if (!isVisible || !series.booksLoaded) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        <span className="ml-2 text-sm text-muted-foreground">
          {series.booksLoaded ? 'Loading books...' : `Loading ${series.books?.length || 0} books...`}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">{series.name}</h2>
        <p className="text-sm text-muted-foreground">
          {series.books.length} book{series.books.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="series-swiper relative">
        <Swiper
          modules={[Navigation, FreeMode, Virtual]}
          spaceBetween={16}
          slidesPerView="auto"
          freeMode={true}
          navigation={{
            prevEl: `.swiper-button-prev-${series.id}`,
            nextEl: `.swiper-button-next-${series.id}`,
          }}
          virtual={{
            enabled: true,
            addSlidesAfter: 2,
            addSlidesBefore: 2,
          }}
          onSwiper={setSwiperInstance}
          className="!overflow-visible"
          style={{ 
            paddingLeft: '2px',
            paddingRight: '2px' 
          }}
        >
          {series.books.map((book, index) => (
            <SwiperSlide
              key={book.id}
              virtualIndex={index}
              style={{ width: '200px' }}
              className="!h-auto"
            >
              {/* Only render UnifiedBookCard for active slides */}
              {activeSlides.has(index) ? (
                <UnifiedBookCard
                  book={book}
                  onDetails={() => onBookClick(book)}
                  onDownload={() => onDownload(book)}
                  onSendToKindle={() => onSendToKindle(book)}
                  shouldLoadImage={() => shouldLoadImage(book.id)}
                  onImageLoaded={() => markImageLoaded(book.id)}
                  showDownloadButton={true}
                  showKindleButton={true}
                />
              ) : (
                // Placeholder for non-active slides
                <div className="w-[180px] h-[320px] bg-muted rounded-lg animate-pulse" />
              )}
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Navigation buttons */}
        {series.books.length > 3 && (
          <>
            <button
              className={`swiper-button-prev-${series.id} absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-background/80 backdrop-blur-sm border border-border rounded-full flex items-center justify-center shadow-lg hover:bg-background/90 transition-all duration-200`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              className={`swiper-button-next-${series.id} absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-background/80 backdrop-blur-sm border border-border rounded-full flex items-center justify-center shadow-lg hover:bg-background/90 transition-all duration-200`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
