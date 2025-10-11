import { useNetworkStatus } from '../hooks/useNetworkStatus'

const OfflineIndicator = () => {
  const { isOnline } = useNetworkStatus()

  // Don't show anything if online
  if (isOnline) {
    return null
  }

  return (
    <>
      {/* Offline Banner */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-2 text-center text-sm font-medium shadow-lg">
        <div className="flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
          <span>You're offline</span>
        </div>
        <div className="text-xs mt-1 opacity-90">
          Connect to internet to use the app
        </div>
      </div>
    </>
  )
}

export default OfflineIndicator

