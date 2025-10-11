import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getMonthDaysWithSessions } from '../../services/firestore'

interface CalendarProps {
  onDateSelect: (date: string) => void
  selectedDate: string | null
  refreshTrigger?: number
}

const Calendar = ({ onDateSelect, selectedDate, refreshTrigger }: CalendarProps) => {
  const { currentUser } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [daysWithSessions, setDaysWithSessions] = useState<Set<string>>(new Set())

  // Debug: Log when component renders
  useEffect(() => {
    console.log('📆 Calendar rendered', { selectedDate, refreshTrigger })
  })

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  
  // Memoize today's date to avoid recreating on every render
  const today = useMemo(() => new Date(), [])

  // Load days with sessions for current month
  useEffect(() => {
    if (!currentUser) return

    const loadSessionDays = async () => {
      const yearStr = year.toString()
      const monthStr = (month + 1).toString().padStart(2, '0')
      
      const days = await getMonthDaysWithSessions(currentUser.uid, yearStr, monthStr)
      setDaysWithSessions(new Set(days))
    }

    loadSessionDays()
  }, [currentUser, year, month, refreshTrigger])

  // Get first day of month and total days
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

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

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1))
  }

  const handleDateClick = (day: number) => {
    if (day < 0) return // Don't allow clicking prev/next month days
    
    const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
    console.log('🖱️ Date clicked in Calendar:', dateStr)
    onDateSelect(dateStr)
  }

  const isToday = (day: number) => {
    return day > 0 && 
           day === today.getDate() && 
           month === today.getMonth() && 
           year === today.getFullYear()
  }

  const isSelected = (day: number) => {
    if (!selectedDate || day < 0) return false
    const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
    return dateStr === selectedDate
  }

  const hasSession = (day: number) => {
    if (day < 0) return false
    const dayStr = day.toString().padStart(2, '0')
    return daysWithSessions.has(dayStr)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6 max-w-2xl mx-auto">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
          {monthNames[month]} {year}
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

          return (
            <button
              key={index}
              onClick={() => !isOtherMonth && handleDateClick(day as number)}
              disabled={isOtherMonth}
              className={`
                relative aspect-square flex items-center justify-center rounded-lg text-xs sm:text-sm font-medium
                transition-all duration-200
                ${isOtherMonth 
                  ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed' 
                  : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                }
                ${isToday(day as number) && !isSelected(day as number)
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-500'
                  : ''
                }
                ${isSelected(day as number)
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : ''
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
