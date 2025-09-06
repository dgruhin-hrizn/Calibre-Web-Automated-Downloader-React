import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
// import { QueueWidget } from './components/QueueWidget' // Disabled - using HeaderQueueWidget instead
import { QueueNotifications } from './components/QueueNotifications'
import { DragDropProvider } from './components/DragDropProvider'
import { Stats } from './pages/Stats'
import { Search } from './pages/Search'
import { Downloads } from './pages/Downloads'
import Library from './pages/Library'
import Top10 from './pages/Top10'
import Series from './pages/Series'
import Admin from './pages/Admin'
import UserProfile from './pages/UserProfile'


import { ToastProvider } from './components/ui/ToastProvider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Don't retry on 401 (auth errors) - let auth system handle it
        if (error?.status === 401 || error?.response?.status === 401) return false
        // Don't retry on other 4xx errors
        if (error?.status >= 400 && error?.status < 500) return false
        return failureCount < 2
      },
      staleTime: 5 * 60 * 1000, // 5 minutes fresh
      gcTime: 30 * 60 * 1000,   // 30 minutes in cache
      refetchOnReconnect: true,
      refetchIntervalInBackground: false,
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // Don't retry mutations on 401 errors
        if (error?.status === 401 || error?.response?.status === 401) return false
        return failureCount < 1
      },
    },
  },
})

// Make query client globally accessible for auth context
if (typeof window !== 'undefined') {
  (window as any).__REACT_QUERY_CLIENT__ = queryClient
}

function App() {
  // Start sidebar open on desktop, closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Check if we're on mobile (screen width < 1024px)
    return window.innerWidth >= 1024
  })

  // Listen for window resize to adjust sidebar behavior
  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 1024
      // Auto-open on desktop, auto-close on mobile
      setSidebarOpen(isDesktop)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])


  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <ProtectedRoute>
            <DragDropProvider>
              <ToastProvider>
                <div className="min-h-screen h-screen bg-background overflow-hidden">
                <div className="flex h-full">
                  {/* Fixed Sidebar */}
                  <div className="flex-shrink-0">
                    <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
                  </div>
                  
                  {/* Main Content */}
                  <div className="flex-1 flex flex-col min-w-0 h-full overflow-x-hidden">
                    {/* Fixed Header - Now positioned fixed */}
                    <Header 
                      onMenuClick={() => setSidebarOpen(!sidebarOpen)}
                      sidebarOpen={sidebarOpen}
                    />
                    
                    {/* Scrollable Main Content Area - Add top padding for fixed header */}
                    <main className="flex-1 overflow-auto pt-16">
                      <div className="w-full px-6 py-8 pb-24 sm:pb-8">
                        <Routes>
                          <Route path="/" element={<Library />} />
                          <Route path="/stats" element={<Stats />} />
                          <Route path="/search" element={<Search />} />
                          <Route path="/library" element={<Library />} />
                          <Route path="/my-books" element={<Library mode="mybooks" title="My Books" />} />
                          <Route path="/series" element={<Series />} />
                          <Route path="/top10" element={<Top10 />} />
                          <Route path="/downloads" element={<Downloads />} />
                          <Route path="/profile" element={<UserProfile />} />
                          <Route path="/admin" element={<Admin />} />
                        </Routes>
                      </div>
                    </main>
                  </div>
                </div>
              </div>
              
                {/* Queue Widget - Fixed Position */}
                {/* <QueueWidget /> Disabled - using HeaderQueueWidget instead */}
                
                {/* Queue Notifications - Fixed Position */}
                <QueueNotifications />
              </ToastProvider>
            </DragDropProvider>
          </ProtectedRoute>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App