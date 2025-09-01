import { useState, useEffect } from 'react'

export function useAdminStatus() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/api/admin/user-info', {
          credentials: 'include'
        })
        
        if (response.ok) {
          setIsAdmin(true)
        } else {
          setIsAdmin(false)
        }
      } catch (error) {
        setIsAdmin(false)
      }
    }

    checkAdminStatus()
  }, [])

  return { isAdmin }
}
