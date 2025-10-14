import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getTags, getUserProfile, getImage } from '../services/dataManager'
import { Tag } from '../types'
import AnalysisTab from './AnalysisTab'
import ChatTab from './ChatTab'
import ProfileTab from './ProfileTab'
import AddSessionView from './AddSessionView'
import AddSessionModal from './AddSessionModal'

type TabType = 'analysis' | 'addSession' | 'chat'

const Dashboard = () => {
  const { currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('analysis')
  const [tags, setTags] = useState<Tag[]>([])
  const [showAddSession, setShowAddSession] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showChatSidebar, setShowChatSidebar] = useState(false)
  const [profilePicture, setProfilePicture] = useState<string | null>(null)

  // Load user tags
  const loadTags = useCallback(async () => {
    if (!currentUser) return
    
    try {
      const userTags = await getTags(currentUser.uid)
      setTags(userTags)
    } catch (error) {
      console.error('Error loading tags:', error)
    }
  }, [currentUser])

  useEffect(() => {
    loadTags()
  }, [loadTags])

  // Load profile picture
  const loadProfilePicture = useCallback(async () => {
    if (!currentUser) return
    
    try {
      const profile = await getUserProfile(currentUser.uid)
      if (profile?.photoImageId) {
        const image = await getImage(currentUser.uid, profile.photoImageId)
        if (image) {
          setProfilePicture(image.base64)
        }
      }
    } catch (error) {
      console.error('Error loading profile picture:', error)
    }
  }, [currentUser])

  useEffect(() => {
    loadProfilePicture()
  }, [loadProfilePicture])

  const handleSessionAdded = useCallback(() => {
    setShowAddSession(false)
    // No need to refetch - real-time subscription handles it
  }, [])

  const handleOpenAddSession = useCallback(async () => {
    // Fetch fresh tags before opening modal
    await loadTags()
    setShowAddSession(true)
  }, [loadTags])

  const handleOpenProfile = useCallback(async () => {
    // Fetch fresh tags before opening profile
    await loadTags()
    setShowProfile(true)
  }, [loadTags])

  const handleTagsChange = useCallback(async () => {
    // Refetch tags after changes
    await loadTags()
  }, [loadTags])

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
    }
  }

  return (
    <div className="min-h-screen">
      {/* Top Header Bar */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-50 flex items-center justify-between px-4 sm:px-6">
        {/* Left Side - Hamburger menu for chat tab on mobile */}
        <div className="flex-1">
          {activeTab === 'chat' && (
            <button
              onClick={() => setShowChatSidebar(prev => !prev)}
              className="lg:hidden w-10 h-10 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors"
              aria-label="Menu"
            >
              <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
        </div>
        
        {/* App Name/Logo */}
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          Loop
        </h1>
        
        {/* Profile Icon - Right Side */}
        <div className="flex-1 flex justify-end">
          <button
            onClick={handleOpenProfile}
            className="w-10 h-10 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors overflow-hidden"
            aria-label="Profile"
          >
            {profilePicture ? (
              <img 
                src={profilePicture} 
                alt="Profile" 
                className="w-full h-full object-cover"
              />
            ) : (
              <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Tab Content - With top margin for header */}
      <div className="pt-16">
        {activeTab === 'analysis' && (
          <AnalysisTab 
            tags={tags} 
            onAddSession={handleOpenAddSession}
          />
        )}
        {activeTab === 'addSession' && (
          <AddSessionView
            tags={tags}
            onAddSession={handleOpenAddSession}
          />
        )}
        {activeTab === 'chat' && (
          <ChatTab 
            tags={tags} 
            showSidebar={showChatSidebar}
            onCloseSidebar={() => setShowChatSidebar(false)}
          />
        )}
      </div>

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
                onClick={() => setActiveTab('addSession')}
                className={`flex flex-col items-center justify-center py-3 transition-colors ${
                  activeTab === 'addSession'
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs font-medium mt-1">Add Session</span>
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

        {/* Profile Modal */}
        {showProfile && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Profile</h2>
                <button
                  onClick={() => setShowProfile(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <ProfileTab 
                  tags={tags} 
                  onTagsChange={handleTagsChange}
                  onProfileUpdate={async () => {
                    await loadProfilePicture()
                    await loadTags()
                  }}
                />
              </div>
            </div>
          </div>
        )}
    </div>
  )
}

export default Dashboard
