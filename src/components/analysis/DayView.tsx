import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getDayLogCached, subscribeToDayLog } from '../../services/dataManager'
import { DayLog, Tag } from '../../types'
import SessionCard from './SessionCard'
import { formatDateForDisplay, getDateInTimezone, getCurrentTimezone } from '../../utils/dateUtils'

interface DayViewProps {
  date: string
  tags: Tag[]
  onBack: () => void
  onAddSession: () => void
}

const DayView = ({ date, tags, onAddSession }: DayViewProps) => {
  const { currentUser } = useAuth()
  const [dayLog, setDayLog] = useState<DayLog | null>(null)
  const [loading, setLoading] = useState(true)

  // Memoize isToday check to avoid recalculating on every render (user's local timezone)
  const isTodayDate = useMemo(() => {
    const todayInUserTz = getDateInTimezone(Date.now(), getCurrentTimezone())
    return date === todayInUserTz
  }, [date])

  useEffect(() => {
    if (!currentUser) return

    setLoading(true)

    if (isTodayDate) {
      // Real-time subscription for today's date
      const unsubscribe = subscribeToDayLog(currentUser.uid, date, (log) => {
        setDayLog(log)
        setLoading(false)
      })

      return () => unsubscribe()
    } else {
      // One-time fetch for old dates
      const loadDayLog = async () => {
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
    }
  }, [currentUser, date, isTodayDate])

  const formatDate = useCallback((dateStr: string) => {
    return formatDateForDisplay(dateStr)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header with Add Button */}
      <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            {formatDate(date)}
          </h2>
          {isTodayDate && (
            <span className="text-sm text-primary-600 dark:text-primary-400 font-medium">Today</span>
          )}
        </div>
        {isTodayDate && (
          <button
            onClick={onAddSession}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Add Session</span>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6">
        {!dayLog || !dayLog.sessions || dayLog.sessions.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {isTodayDate ? 'No sessions logged yet today' : 'No sessions on this day'}
            </p>
            {isTodayDate && (
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
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
            {/* Session Cards */}
            {dayLog.sessions.map((session, index) => (
              <SessionCard
                key={index}
                session={session}
                tags={tags}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DayView
