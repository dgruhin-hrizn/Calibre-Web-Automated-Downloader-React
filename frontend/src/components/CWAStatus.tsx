import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/Button'
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { apiRequest } from '../lib/utils'

interface CWAStatus {
  status: 'ok' | 'error'
  cwa_url?: string
  message?: string
}

interface CWAStats {
  total_books?: number
  recent_imports?: number
  conversions_today?: number
  epub_fixes?: number
}

interface UserPermissions {
  username: string
  is_admin: boolean
  permissions: {
    admin: boolean
    stats: boolean
    settings: boolean
    library_management: boolean
  }
}

export default function CWAStatus() {
  const [status, setStatus] = useState<CWAStatus | null>(null)
  const [stats, setStats] = useState<CWAStats | null>(null)
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const checkCWAHealth = async () => {
    try {
      const response = await apiRequest('/api/cwa/health')
      setStatus(response)
    } catch (error) {
      console.error('Error checking CWA health:', error)
      setStatus({ status: 'error', message: 'Failed to connect to CWA proxy' })
    }
  }

  const checkUserPermissions = async () => {
    try {
      const response = await apiRequest('/api/cwa/user/permissions')
      setPermissions(response)
    } catch (error) {
      console.error('Error checking user permissions:', error)
      setPermissions(null)
    }
  }

  const fetchCWAStats = async () => {
    // Only fetch stats if user has permission
    if (!permissions?.permissions.stats) {
      console.log('User does not have stats permission, skipping stats fetch')
      return
    }
    
    try {
      const response = await apiRequest('/api/cwa/stats')
      setStats(response)
    } catch (error) {
      console.error('Error fetching CWA stats:', error)
      // Don't set error state here, stats are optional
    }
  }

  const refreshData = async () => {
    setRefreshing(true)
    await checkCWAHealth()
    await checkUserPermissions()
    setRefreshing(false)
  }

  // Effect to fetch stats when permissions change
  useEffect(() => {
    if (permissions?.permissions.stats && status?.status === 'ok') {
      fetchCWAStats()
    }
  }, [permissions, status])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await refreshData()
      setLoading(false)
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Checking CWA Connection...
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status?.status === 'ok' ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>CWA Connected</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-red-500" />
                <span>CWA Disconnected</span>
              </>
            )}
            <Badge variant={status?.status === 'ok' ? 'success' : 'destructive'}>
              {status?.status === 'ok' ? 'Online' : 'Offline'}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshData}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {status?.cwa_url && (
            <div className="text-sm text-gray-600">
              <strong>CWA URL:</strong> {status.cwa_url}
            </div>
          )}
          
          {status?.message && (
            <div className="text-sm text-red-600">
              <strong>Error:</strong> {status.message}
            </div>
          )}

          {/* Show stats if user has permission and stats are available */}
          {stats && status?.status === 'ok' && permissions?.permissions.stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {stats.total_books !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.total_books}</div>
                  <div className="text-sm text-gray-600">Total Books</div>
                </div>
              )}
              {stats.recent_imports !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.recent_imports}</div>
                  <div className="text-sm text-gray-600">Recent Imports</div>
                </div>
              )}
              {stats.conversions_today !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{stats.conversions_today}</div>
                  <div className="text-sm text-gray-600">Conversions Today</div>
                </div>
              )}
              {stats.epub_fixes !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{stats.epub_fixes}</div>
                  <div className="text-sm text-gray-600">EPUB Fixes</div>
                </div>
              )}
            </div>
          )}

          {/* Show message for non-admin users */}
          {status?.status === 'ok' && permissions && !permissions.permissions.stats && (
            <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded">
              <strong>👤 Logged in as:</strong> {permissions.username}<br/>
              <em>Note: Administrative statistics require admin privileges.</em>
            </div>
          )}

          {status?.status === 'ok' && (
            <div className="text-sm text-green-600 font-medium">
              ✅ CWA backend is accessible! You can now use all CWA features through the modern UI.
            </div>
          )}

          {status?.status === 'error' && (
            <div className="text-sm text-gray-600">
              <p>To connect to your CWA instance:</p>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Make sure your CWA instance is running</li>
                <li>Set the CWA_URL environment variable to your CWA URL</li>
                <li>If CWA requires authentication, set CWA_USER and CWA_PASS</li>
                <li>Restart this application</li>
              </ol>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
