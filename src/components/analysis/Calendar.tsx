import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getMonthDaysWithSessionsCached } from '../../services/dataManager'
import { useSessionsInRange } from '../../hooks/useSessionsInRange'
import { calendarIntensities } from '../../tagTypes/stats'
import { TAG_TYPE_ORDER, getTagTypeMeta } from '../../tagTypes/registry'
import { Tag } from '../../types'
import { 
  getFirstDayOfMonthUTC, 
  getDaysInMonthUTC,
  getMonthName,
  getLocalToday
} from '../../utils/dateUtils'

interface CalendarProps {
  onDateSelect: (date: string) => void
  selectedDate: string | null
  tags: Tag[]
  /** Tag whose values shade each day, or null for plain session dots */
  colorBy: string | null
  onColorByChange: (tagId: string | null) => void
}

const pad2 = (n: number) => n.toString().padStart(2, '0')

const Calendar = ({ onDateSelect, selectedDate, tags, colorBy, onColorByChange }: CalendarProps) => {
  const { currentUser } = useAuth()
  
  // Get today's date in user's local timezone
  const [todayStr] = useState(getLocalToday)
  
  // Parse today's date to get initial year/month (user's local timezone)
  const [todayYear, todayMonth] = useMemo(() => {
    const [y, m] = todayStr.split('-').map(Number)
    return [y, m - 1] // month is 0-indexed
  }, [todayStr])
  
  const [currentYear, setCurrentYear] = useState(todayYear)
  const [currentMonth, setCurrentMonth] = useState(todayMonth)
  const [daysWithSessions, setDaysWithSessions] = useState<Set<string>>(new Set())

  // Show the month of a date selected from elsewhere (e.g. a note in Insights)
  const [shownSelection, setShownSelection] = useState(selectedDate)
  if (selectedDate !== shownSelection) {
    setShownSelection(selectedDate)
    if (selectedDate) {
      const [y, m] = selectedDate.split('-').map(Number)
      setCurrentYear(y)
      setCurrentMonth(m - 1)
    }
  }

  // Shade days by the chosen tag
  const colorTag = tags.find((t) => t.id === colorBy) ?? null
  const monthStart = `${currentYear}-${pad2(currentMonth + 1)}-01`
  const monthEnd = `${currentYear}-${pad2(currentMonth + 1)}-${pad2(getDaysInMonthUTC(currentYear, currentMonth))}`
  const monthData = useSessionsInRange(colorTag ? monthStart : null, colorTag ? monthEnd : null)
  const intensities = useMemo(
    () => (colorTag && !monthData.loading ? calendarIntensities(colorTag, monthData.dates, monthData.byDate) : {}),
    [colorTag, monthData.loading, monthData.dates, monthData.byDate]
  )
  const tagsByType = useMemo(
    () => TAG_TYPE_ORDER.map((type) => ({ type, tags: tags.filter((t) => t.type === type) })).filter((g) => g.tags.length > 0),
    [tags]
  )

  // Load days with sessions for current month
  useEffect(() => {
    if (!currentUser) return

    const loadSessionDays = async () => {
      const yearStr = currentYear.toString()
      const monthStr = (currentMonth + 1).toString().padStart(2, '0')
      
      const days = await getMonthDaysWithSessionsCached(currentUser.uid, yearStr, monthStr)
      setDaysWithSessions(new Set(days))
    }

    loadSessionDays()
  }, [currentUser, currentYear, currentMonth])

  // Get calendar layout values using UTC
  const firstDayOfMonth = getFirstDayOfMonthUTC(currentYear, currentMonth)
  const daysInMonth = getDaysInMonthUTC(currentYear, currentMonth)
  const daysInPrevMonth = getDaysInMonthUTC(currentYear, currentMonth - 1)

  // Memoize calendar days calculation to avoid recalculating on every render
  const calendarDays = useMemo(() => {
    const days: (number | null)[] = []
    
    // Previous month days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push(-(daysInPrevMonth - i))
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }
    
    // Next month days to fill the grid
    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
      days.push(-i)
    }
    
    return days
  }, [firstDayOfMonth, daysInMonth, daysInPrevMonth])

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear(currentYear - 1)
      setCurrentMonth(11)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear(currentYear + 1)
      setCurrentMonth(0)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const handleDateClick = (day: number) => {
    if (day < 0) return // Don't allow clicking prev/next month days
    
    const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
    onDateSelect(dateStr)
  }

  const isToday = (day: number) => {
    if (day < 0) return false
    const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
    return dateStr === todayStr
  }

  const isSelected = (day: number) => {
    if (!selectedDate || day < 0) return false
    const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
    return dateStr === selectedDate
  }

  const dateOf = (day: number) => `${currentYear}-${pad2(currentMonth + 1)}-${pad2(day)}`

  const hasSession = (day: number) => {
    if (day < 0) return false
    // Month query keys are full YYYY-MM-DD dates
    return daysWithSessions.has(dateOf(day))
  }

  const intensityOf = (day: number): number | undefined => (day < 0 ? undefined : intensities[dateOf(day)])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
          {getMonthName(currentMonth)} {currentYear}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Previous month"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Next month"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Color by tag */}
      {tags.length > 0 && (
        <div className="flex items-center gap-2 mb-3 text-sm">
          <label htmlFor="calendar-color-by" className="text-gray-600 dark:text-gray-400">Color by</label>
          <select
            id="calendar-color-by"
            value={colorTag?.id ?? ''}
            onChange={(e) => onColorByChange(e.target.value || null)}
            className="flex-1 min-w-0 px-2 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-hidden"
          >
            <option value="">Sessions</option>
            {tagsByType.map((group) => (
              <optgroup key={group.type} label={getTagTypeMeta(group.type).groupLabel}>
                {group.tags.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}

      {/* Week Days Header */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {calendarDays.map((day, index) => {
          if (day === null) return null
          const isOtherMonth = day < 0
          const displayDay = isOtherMonth ? Math.abs(day) : day
          const intensity = intensityOf(day)
          const shade = intensity !== undefined && !isSelected(day as number)
            ? { backgroundColor: `rgba(34, 197, 94, ${(0.2 + 0.6 * intensity).toFixed(2)})` }
            : undefined

          return (
            <button
              key={index}
              onClick={() => !isOtherMonth && handleDateClick(day as number)}
              disabled={isOtherMonth}
              style={shade}
              className={`
                relative aspect-square flex items-center justify-center rounded-lg text-xs sm:text-sm font-medium
                transition-all duration-200
                ${isOtherMonth 
                  ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed' 
                  : isToday(day as number) && !isSelected(day as number) && shade
                    ? 'text-gray-900 dark:text-white border-2 border-primary-500 font-bold'
                  : isToday(day as number) && !isSelected(day as number)
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border-2 border-primary-500 font-bold'
                    : isSelected(day as number)
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              {displayDay}
              {!isOtherMonth && hasSession(day as number) && (
                <span className={`absolute bottom-0.5 sm:bottom-1 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${isSelected(day as number) ? 'bg-white' : 'bg-primary-600'}`}></span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default Calendar
