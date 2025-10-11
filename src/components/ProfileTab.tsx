import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Tag, TagType } from '../types'
import { createTagCached, deleteTagCached } from '../services/dataManager'

interface ProfileTabProps {
  tags: Tag[]
  onTagsChange: () => void
}

const ProfileTab = ({ tags, onTagsChange }: ProfileTabProps) => {
  const { currentUser, logout } = useAuth()
  const [showAddTag, setShowAddTag] = useState(false)
  const [newTag, setNewTag] = useState({
    name: '',
    type: 'number' as TagType,
    min: 1,
    max: 10,
    unit: ''
  })

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const handleAddTag = async () => {
    if (!currentUser || !newTag.name.trim()) return

    try {
      const tagConfig: any = {}
      
      if (newTag.type === 'number' || newTag.type === 'rating') {
        tagConfig.min = newTag.min
        tagConfig.max = newTag.max
      }
      
      if (newTag.unit.trim()) {
        tagConfig.unit = newTag.unit
      }

      await createTagCached(currentUser.uid, {
        name: newTag.name,
        type: newTag.type,
        config: tagConfig,
        createdAt: new Date().toISOString()
      })

      setNewTag({ name: '', type: 'number', min: 1, max: 10, unit: '' })
      setShowAddTag(false)
      onTagsChange()
    } catch (error) {
      console.error('Error adding tag:', error)
    }
  }

  const handleDeleteTag = async (tagId: string) => {
    if (!currentUser) return
    if (!confirm('Are you sure you want to delete this tag?')) return

    try {
      await deleteTagCached(currentUser.uid, tagId)
      onTagsChange()
    } catch (error) {
      console.error('Error deleting tag:', error)
    }
  }

  const getTagTypeLabel = (type: TagType) => {
    const labels = {
      number: 'Number',
      rating: 'Rating',
      checkbox: 'Yes/No',
      text: 'Text',
      time: 'Time'
    }
    return labels[type]
  }

  const getTagIcon = (type: TagType) => {
    switch (type) {
      case 'number':
        return '🔢'
      case 'rating':
        return '⭐'
      case 'checkbox':
        return '✓'
      case 'text':
        return '📝'
      case 'time':
        return '⏱️'
      default:
        return '📊'
    }
  }

  return (
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-16 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Profile Info */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-full mb-4">
              <svg className="w-10 h-10 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {currentUser?.displayName || 'User'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {currentUser?.email}
            </p>
          </div>
        </div>

        {/* Tags Management */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Manage Tags
            </h3>
            <button
            onClick={() => setShowAddTag(!showAddTag)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Tag
          </button>
        </div>

        {/* Add Tag Form */}
        {showAddTag && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tag Name *
                </label>
                <input
                  type="text"
                  value={newTag.name}
                  onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="e.g., Mood, Energy, Water"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type *
                </label>
                <select
                  value={newTag.type}
                  onChange={(e) => setNewTag({ ...newTag, type: e.target.value as TagType })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="number">Number (with range)</option>
                  <option value="rating">Rating (stars)</option>
                  <option value="checkbox">Checkbox (Yes/No)</option>
                  <option value="text">Text</option>
                  <option value="time">Time (minutes)</option>
                </select>
              </div>

              {(newTag.type === 'number' || newTag.type === 'rating') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Min
                    </label>
                    <input
                      type="number"
                      value={newTag.min}
                      onChange={(e) => setNewTag({ ...newTag, min: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Max
                    </label>
                    <input
                      type="number"
                      value={newTag.max}
                      onChange={(e) => setNewTag({ ...newTag, max: parseInt(e.target.value) || 10 })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {newTag.type === 'number' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Unit (optional)
                  </label>
                  <input
                    type="text"
                    value={newTag.unit}
                    onChange={(e) => setNewTag({ ...newTag, unit: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="e.g., glasses, kg, hours"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleAddTag}
                  disabled={!newTag.name.trim()}
                  className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Add Tag
                </button>
                <button
                  onClick={() => setShowAddTag(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tags List */}
        {tags.length === 0 ? (
          <div className="text-center py-8 text-gray-600 dark:text-gray-400">
            <p className="mb-2">No tags created yet</p>
            <p className="text-sm">Add tags to track your metrics in sessions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getTagIcon(tag.type)}</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {tag.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {getTagTypeLabel(tag.type)}
                      {(tag.type === 'number' || tag.type === 'rating') && 
                        ` (${tag.config.min}-${tag.config.max}${tag.config.unit ? ' ' + tag.config.unit : ''})`
                      }
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteTag(tag.id)}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  aria-label="Delete tag"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logout */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8">
        <button
          onClick={handleLogout}
          className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
      </div>
    </div>
  )
}

export default ProfileTab
