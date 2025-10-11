import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getTags } from '../services/dataManager'
import { Tag } from '../types'
import AnalysisTab from './AnalysisTab'
import ChatTab from './ChatTab'
import ProfileTab from './ProfileTab'
import AddSessionModal from './AddSessionModal'

type TabType = 'analysis' | 'chat' | 'profile'

const Dashboard = () => {
  const { currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('analysis')
  const [tags, setTags] = useState<Tag[]>([])
  const [showAddSession, setShowAddSession] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Load user tags
  useEffect(() => {
    if (!currentUser) return

    const loadTags = async () => {
      try {
        const userTags = await getTags(currentUser.uid)
        setTags(userTags)
      } catch (error) {
        console.error('Error loading tags:', error)
      }
    }

    loadTags()
  }, [currentUser, refreshKey])

  const handleSessionAdded = useCallback(() => {
    setShowAddSession(false)
    setRefreshKey(prev => prev + 1)
  }, [])

  const handleTagsChange = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  const getTabIcon = (tab: TabType) => {
    switch (tab) {
      case 'analysis':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        )
      case 'chat':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )
      case 'profile':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )
    }
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-6xl mx-auto">
        {/* Header with Logo */}
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 py-3">
            <div className="flex items-center gap-3">
              <img 
                src="/pwa-512x512.png"
                alt="Loop" 
                className="w-10 h-10 rounded-xl shadow-md"
              />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Loop</h1>
            </div>
          </div>
        </header>

        {/* Tab Content */}
        <div className="mb-6 p-4 sm:p-6 md:p-8">
          {activeTab === 'analysis' && (
            <AnalysisTab 
              tags={tags} 
              onAddSession={() => setShowAddSession(true)}
              refreshTrigger={refreshKey}
            />
          )}
          {activeTab === 'chat' && <ChatTab />}
          {activeTab === 'profile' && (
            <ProfileTab 
              tags={tags}
              onTagsChange={handleTagsChange}
            />
          )}
        </div>

        {/* Floating Action Button (FAB) */}
        <button
          onClick={() => setShowAddSession(true)}
          className="fixed right-6 bottom-24 w-14 h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-40"
          aria-label="Add session"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => setActiveTab('analysis')}
                className={`flex flex-col items-center justify-center py-3 transition-colors ${
                  activeTab === 'analysis'
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {getTabIcon('analysis')}
                <span className="text-xs font-medium mt-1">Analysis</span>
              </button>

              <button
                onClick={() => setActiveTab('chat')}
                className={`flex flex-col items-center justify-center py-3 transition-colors ${
                  activeTab === 'chat'
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {getTabIcon('chat')}
                <span className="text-xs font-medium mt-1">Chat</span>
              </button>

              <button
                onClick={() => setActiveTab('profile')}
                className={`flex flex-col items-center justify-center py-3 transition-colors ${
                  activeTab === 'profile'
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {getTabIcon('profile')}
                <span className="text-xs font-medium mt-1">Profile</span>
              </button>
            </div>
          </div>
        </nav>

        {/* Add Session Modal */}
        <AddSessionModal
          isOpen={showAddSession}
          onClose={() => setShowAddSession(false)}
          tags={tags}
          onSessionAdded={handleSessionAdded}
        />
      </div>
    </div>
  )
}

export default Dashboard
