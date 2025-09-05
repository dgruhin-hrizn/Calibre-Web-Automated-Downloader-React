import { useEffect, useRef, useState } from 'react'

export function useSeriesIntersection() {
  const [visibleSeries, setVisibleSeries] = useState<Set<number>>(new Set())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const seriesRefs = useRef<Map<number, HTMLElement>>(new Map())

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const seriesId = Number(entry.target.getAttribute('data-series-id'))
          if (entry.isIntersecting) {
            setVisibleSeries(prev => new Set([...prev, seriesId]))
          } else {
            // Keep series visible for a bit after scrolling past
            setTimeout(() => {
              setVisibleSeries(prev => {
                const newSet = new Set(prev)
                newSet.delete(seriesId)
                return newSet
              })
            }, 2000)
          }
        })
      },
      {
        rootMargin: '100px 0px', // Start loading 100px before series becomes visible
        threshold: 0.1
      }
    )

    return () => {
      observerRef.current?.disconnect()
    }
  }, [])

  const registerSeriesRef = (seriesId: number, element: HTMLElement | null) => {
    if (element) {
      seriesRefs.current.set(seriesId, element)
      observerRef.current?.observe(element)
    } else {
      const existingElement = seriesRefs.current.get(seriesId)
      if (existingElement) {
        observerRef.current?.unobserve(existingElement)
        seriesRefs.current.delete(seriesId)
      }
    }
  }

  return {
    visibleSeries,
    registerSeriesRef
  }
}
