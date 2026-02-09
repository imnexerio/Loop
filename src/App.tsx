import { useEffect, useState } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import { PinProvider, usePin } from './contexts/PinContext'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import PinLockScreen from './components/PinLockScreen'
import { useAuth } from './contexts/AuthContext'

function AppContent() {
  const { currentUser } = useAuth()
  const { isLocked, isLoading: pinLoading } = usePin()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  // Auto-detect system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setTheme(mediaQuery.matches ? 'dark' : 'light')

    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Apply theme to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  // Show loading while checking PIN state
  if (currentUser && pinLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Determine what to show
  let content
  if (!currentUser) {
    content = <Login />
  } else if (isLocked) {
    content = <PinLockScreen />
  } else {
    content = <Dashboard />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      {content}
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <PinProvider>
        <AppContent />
      </PinProvider>
    </AuthProvider>
  )
}

export default App
