import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getDayLogCached } from '../../services/dataManager'
import { DayLog, Tag } from '../../types'

interface DayViewProps {
  date: string
  tags: Tag[]
  onBack: () => void
  onAddSession: () => void
  refreshTrigger?: number
}

const DayView = ({ date, tags, onAddSession, refreshTrigger }: DayViewProps) => {
  const { currentUser } = useAuth()
  const [dayLog, setDayLog] = useState<DayLog | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return

    const loadDayLog = async () => {
      setLoading(true)
      try {
        const log = await getDayLogCached(currentUser.uid, date)
        setDayLog(log)
      } catch (error) {
        console.error('Error loading day log:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDayLog()
  }, [currentUser, date, refreshTrigger])

  const formatDate = useCallback((dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }, [])

  const formatTime = useCallback((timestamp: string) => {
    const d = new Date(parseInt(timestamp))
    return d.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    })
  }, [])

  const getTagById = useCallback((tagId: string) => {
    return tags.find(t => t.id === tagId)
  }, [tags])

  const renderTagValue = useCallback((tag: Tag, value: any) => {
    switch (tag.type) {
      case 'number':
        return `${value}${tag.config.unit ? ' ' + tag.config.unit : ''}`
      case 'rating':
        return `${value}/${tag.config.max || 5}`
      case 'checkbox':
        return value ? '✓ Yes' : '✗ No'
      case 'text':
        return value
      case 'time':
        return `${value} min`
      default:
        return value
    }
  }, [])

  // Memoize isToday check to avoid recalculating on every render
  const isToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return date === today
  }, [date])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            {formatDate(date)}
          </h2>
          {isToday && (
            <span className="text-sm text-primary-600 dark:text-primary-400 font-medium">Today</span>
          )}
        </div>
      </div>

      {/* Sessions */}
      <div className="p-4 sm:p-6">
        {!dayLog || !dayLog.sessions || dayLog.sessions.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {isToday ? 'No sessions logged yet today' : 'No sessions on this day'}
            </p>
            {isToday && (
              <button
                onClick={onAddSession}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add First Session
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {dayLog.sessions.map((session, index) => (
              <div
                key={index}
                className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 sm:p-5"
              >
                {/* Session Time */}
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {formatTime(session.timestamp)}
                  </span>
                </div>

                {/* Description */}
                <p className="text-gray-900 dark:text-white mb-4 whitespace-pre-wrap">
                  {session.description}
                </p>

                {/* Tags */}
                {session.tags && Object.keys(session.tags).length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(session.tags).map(([tagId, value]) => {
                      const tag = getTagById(tagId)
                      if (!tag) return null

                      return (
                        <div
                          key={tagId}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                        >
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {tag.name}:
                          </span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {renderTagValue(tag, value)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Add Session Button for Today */}
            {isToday && (
              <button
                onClick={onAddSession}
                className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-500 rounded-xl text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add New Session
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default DayView
