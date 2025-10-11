import { useEffect, useState } from 'react'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { useAuth } from '../contexts/AuthContext'
import { syncService } from '../services/syncService'
import { offlineStorage } from '../services/offlineStorage'

const OfflineIndicator = () => {
  const { isOnline, wasOffline } = useNetworkStatus()
  const { currentUser } = useAuth()
  const [queueCount, setQueueCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [showReconnected, setShowReconnected] = useState(false)

  // Update queue count
  useEffect(() => {
    const updateQueueCount = async () => {
      if (currentUser) {
        const count = await syncService.getQueueCount(currentUser.uid)
        setQueueCount(count)
      }
    }

    updateQueueCount()
    const interval = setInterval(updateQueueCount, 5000)
    return () => clearInterval(interval)
  }, [currentUser, isOnline])

  // Auto-sync when coming back online OR when app loads with queue
  useEffect(() => {
    // Sync if: online AND (just reconnected OR has queue on mount)
    if (isOnline && currentUser && queueCount > 0) {
      // Only show reconnected banner if we actually just reconnected
      if (wasOffline) {
        setShowReconnected(true)
      }
      
      setSyncing(true)
      
      syncService.syncOfflineQueue(currentUser.uid)
        .then(({ success, failed }) => {
          console.log(`Sync complete: ${success} synced, ${failed} failed`)
          setSyncing(false)
          // Hide reconnected message after 3 seconds
          if (wasOffline) {
            setTimeout(() => setShowReconnected(false), 3000)
          }
        })
        .catch(error => {
          console.error('Sync failed:', error)
          setSyncing(false)
        })
    }
  }, [isOnline, wasOffline, currentUser, queueCount])

  // Don't show anything if online and no queue
  if (isOnline && !showReconnected && queueCount === 0) {
    return null
  }

  return (
    <>
      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-2 text-center text-sm font-medium shadow-lg">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
            </svg>
            <span>You're offline</span>
            {queueCount > 0 && (
              <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                {queueCount} pending
              </span>
            )}
          </div>
          <div className="text-xs mt-1 opacity-90">
            Changes will sync when you're back online
          </div>
        </div>
      )}

      {/* Reconnected / Syncing Banner */}
      {showReconnected && isOnline && (
        <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium shadow-lg transition-colors ${
          syncing ? 'bg-blue-500' : 'bg-green-500'
        } text-white`}>
          <div className="flex items-center justify-center gap-2">
            {syncing ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Syncing {queueCount} changes...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Back online! All changes synced</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Queue Indicator (bottom right) - only when offline with items */}
      {!isOnline && queueCount > 0 && (
        <div className="fixed bottom-20 right-4 sm:right-6 bg-gray-900 dark:bg-gray-800 text-white px-4 py-2 rounded-lg shadow-xl text-xs font-medium z-40">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
            <span>{queueCount} change{queueCount !== 1 ? 's' : ''} pending</span>
          </div>
        </div>
      )}
    </>
  )
}

export default OfflineIndicator
