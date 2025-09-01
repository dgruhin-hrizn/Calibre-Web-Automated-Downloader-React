import { useState, useCallback } from 'react'
import * as Toast from "@radix-ui/react-toast"
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react'

export interface ToastProps {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastProps[]>([])

  const showToast = useCallback((toast: Omit<ToastProps, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: ToastProps = {
      id,
      duration: 5000, // 5 seconds default
      ...toast
    }
    
    setToasts(prev => [...prev, newToast])
    
    // Auto-remove after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, newToast.duration)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const ToastContainer = useCallback(() => {
    if (toasts.length === 0) return null

    return (
      <>
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            className={`grid grid-cols-[auto_max-content] items-center gap-x-4 rounded-md border p-4 shadow-lg data-[state=open]:animate-slideIn data-[state=closed]:animate-hide data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-[transform_200ms_ease-out] data-[swipe=end]:animate-swipeOut ${getToastStyles(toast.type)}`}
            duration={toast.duration}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {getToastIcon(toast.type)}
              </div>
              <div className="flex-1">
                <Toast.Title className="text-sm font-medium">
                  {toast.title}
                </Toast.Title>
                {toast.message && (
                  <Toast.Description className="text-xs text-muted-foreground mt-1">
                    {toast.message}
                  </Toast.Description>
                )}
              </div>
            </div>
            <Toast.Close
              className="text-muted-foreground hover:text-foreground"
              onClick={() => dismissToast(toast.id)}
            >
              ×
            </Toast.Close>
          </Toast.Root>
        ))}
      </>
    )
  }, [toasts, dismissToast])

  return { showToast, dismissToast, ToastContainer }
}

function getToastIcon(type: ToastProps['type']) {
  switch (type) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-600" />
    case 'error':
      return <XCircle className="h-4 w-4 text-red-600" />
    case 'warning':
      return <AlertCircle className="h-4 w-4 text-yellow-600" />
    case 'info':
      return <Info className="h-4 w-4 text-blue-600" />
  }
}

function getToastStyles(type: ToastProps['type']) {
  switch (type) {
    case 'success':
      return 'bg-green-50 border-green-200 text-green-900'
    case 'error':
      return 'bg-red-50 border-red-200 text-red-900'
    case 'warning':
      return 'bg-yellow-50 border-yellow-200 text-yellow-900'
    case 'info':
      return 'bg-blue-50 border-blue-200 text-blue-900'
  }
}
