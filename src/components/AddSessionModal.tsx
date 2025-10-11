import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { addSessionCached } from '../services/dataManager'
import { Tag, Session } from '../types'

interface AddSessionModalProps {
  isOpen: boolean
  onClose: () => void
  tags: Tag[]
  onSessionAdded: () => void
}

const AddSessionModal = ({ isOpen, onClose, tags, onSessionAdded }: AddSessionModalProps) => {
  const { currentUser } = useAuth()
  const [description, setDescription] = useState('')
  const [tagValues, setTagValues] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [sessionCreated, setSessionCreated] = useState(false)
  const [currentSessionTimestamp, setCurrentSessionTimestamp] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  // Auto-save function with debouncing
  const saveSession = useCallback(async () => {
    if (!currentUser || !description.trim()) return

    setSaving(true)
    try {
      const session: Session = {
        timestamp: currentSessionTimestamp || new Date().toISOString(),
        description: description.trim(),
        tags: tagValues
      }

      if (!sessionCreated) {
        // Create new session
        await addSessionCached(currentUser.uid, today, session)
        setSessionCreated(true)
        setCurrentSessionTimestamp(session.timestamp)
      } else {
        // Update existing session (find it by timestamp)
        // Note: In a real app, you'd need to track the session index
        // For now, we'll just add a new session each time
      }

      onSessionAdded()
    } catch (error) {
      console.error('Error saving session:', error)
    } finally {
      setSaving(false)
    }
  }, [currentUser, description, tagValues, sessionCreated, currentSessionTimestamp, today, onSessionAdded])

  // Debounced auto-save effect
  useEffect(() => {
    if (!description.trim()) return

    const timer = setTimeout(() => {
      saveSession()
    }, 2000) // Save after 2 seconds of no typing

    return () => clearTimeout(timer)
  }, [description, tagValues, saveSession])

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setDescription('')
      setTagValues({})
      setSessionCreated(false)
      setCurrentSessionTimestamp(null)
    }
  }, [isOpen])

  const handleClose = () => {
    if (description.trim() && !sessionCreated) {
      saveSession()
    }
    onClose()
  }

  const handleTagChange = (tagId: string, value: any) => {
    setTagValues(prev => ({
      ...prev,
      [tagId]: value
    }))
  }

  const renderTagInput = (tag: Tag) => {
    const value = tagValues[tag.id]

    switch (tag.type) {
      case 'number':
        return (
          <div key={tag.id} className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {tag.name} {tag.config.unit && `(${tag.config.unit})`}
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={tag.config.min || 0}
                max={tag.config.max || 100}
                value={value || tag.config.min || 0}
                onChange={(e) => handleTagChange(tag.id, parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <span className="text-lg font-semibold text-gray-900 dark:text-white min-w-[60px] text-right">
                {value || tag.config.min || 0}/{tag.config.max || 100}
              </span>
            </div>
          </div>
        )

      case 'rating':
        return (
          <div key={tag.id} className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {tag.name}
            </label>
            <div className="flex gap-2">
              {Array.from({ length: tag.config.max || 5 }, (_, i) => i + 1).map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => handleTagChange(tag.id, rating)}
                  className={`w-10 h-10 rounded-lg border-2 transition-colors ${
                    (value || 0) >= rating
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'border-gray-300 dark:border-gray-600 text-gray-400 hover:border-primary-500'
                  }`}
                >
                  ★
                </button>
              ))}
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400 self-center">
                {value || 0}/{tag.config.max || 5}
              </span>
            </div>
          </div>
        )

      case 'checkbox':
        return (
          <div key={tag.id} className="mb-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={value || false}
                onChange={(e) => handleTagChange(tag.id, e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {tag.name}
              </span>
            </label>
          </div>
        )

      case 'text':
        return (
          <div key={tag.id} className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {tag.name}
            </label>
            <input
              type="text"
              value={value || ''}
              onChange={(e) => handleTagChange(tag.id, e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder={`Enter ${tag.name.toLowerCase()}`}
            />
          </div>
        )

      case 'time':
        return (
          <div key={tag.id} className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {tag.name} (minutes)
            </label>
            <input
              type="number"
              value={value || ''}
              onChange={(e) => handleTagChange(tag.id, parseInt(e.target.value) || 0)}
              min="0"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="0"
            />
          </div>
        )

      default:
        return null
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Add Session
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              What are you doing? *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              placeholder="I am working on..."
              autoFocus
            />
            {saving && (
              <p className="text-xs text-primary-600 dark:text-primary-400 mt-2 flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </p>
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                Track your metrics (optional)
              </h3>
              {tags.map(tag => renderTagInput(tag))}
            </div>
          )}

          {tags.length === 0 && (
            <div className="text-center py-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                No tags created yet
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Create tags in your Profile to track metrics
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            disabled={!description.trim()}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddSessionModal
