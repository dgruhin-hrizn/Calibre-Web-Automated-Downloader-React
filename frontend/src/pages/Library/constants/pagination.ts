/**
 * Pagination and scroll configuration constants
 */

// Books per page configuration (must match backend setting)
export const BOOKS_PER_PAGE = 20

// Scroll positioning offsets (controls where the scroll stops)
export const SCROLL_OFFSETS = {
  DESKTOP: 15,   // Desktop scroll offset
  MOBILE: -120   // Mobile scroll offset (adjusted for pagination-only footer)
}

// Intersection Observer settings for pagination detection
export const PAGINATION_DETECTION = {
  // How much of a book needs to be visible to trigger pagination update (0.0 to 1.0)
  VISIBILITY_THRESHOLD: 0.1 // 10% visibility required
  // All other settings are calculated dynamically based on actual DOM elements
}

// Mobile breakpoint (matches Tailwind's md breakpoint)
export const MOBILE_BREAKPOINT = 768

// CSS class selectors for DOM elements
export const SELECTORS = {
  LIBRARY_TOOLBAR: '.library-toolbar',
  HEADER: 'header'
}
