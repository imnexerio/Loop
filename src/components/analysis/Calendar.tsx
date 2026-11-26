import { useState } from 'react'
import {
  getFirstDayOfMonthUTC,
  getDaysInMonthUTC,
  getMonthName,
  getLocalToday
} from '../../utils/dateUtils'

interface CalendarProps {
  onDateSelect: (date: string) => void
  selectedDate: string | null
}

const pad2 = (n: number) => n.toString().padStart(2, '0')
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const Calendar = ({ onDateSelect, selectedDate }: CalendarProps) => {
  // Today's date in the user's timezone
  const [todayStr] = useState(getLocalToday)
  const [currentYear, setCurrentYear] = useState(() => Number(todayStr.slice(0, 4)))
  const [currentMonth, setCurrentMonth] = useState(() => Number(todayStr.slice(5, 7)) - 1) // 0-indexed

  // Show the month of a date selected from elsewhere (e.g. a note in Insights)
  const [shownSelection, setShownSelection] = useState(selectedDate)
  if (selectedDate !== shownSelection) {
    setShownSelection(selectedDate)
    if (selectedDate) {
      setCurrentYear(Number(selectedDate.slice(0, 4)))
      setCurrentMonth(Number(selectedDate.slice(5, 7)) - 1)
    }
  }

  const dateOf = (day: number) => `${currentYear}-${pad2(currentMonth + 1)}-${pad2(day)}`
  const daysInMonth = getDaysInMonthUTC(currentYear, currentMonth)
  const firstDayOfMonth = getFirstDayOfMonthUTC(currentYear, currentMonth)

  const shiftMonth = (delta: number) => {
    const total = currentYear * 12 + currentMonth + delta
    setCurrentYear(Math.floor(total / 12))
    setCurrentMonth(total % 12)
  }

  // Leading blanks, then the days of the month
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDayOfMonth }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
          {getMonthName(currentMonth)} {currentYear}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => shiftMonth(-1)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Previous month"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => shiftMonth(1)}
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
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1">
        {WEEK_DAYS.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1.5">
            {day}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {cells.map((day, index) => {
          if (day === null) return <div key={`blank-${index}`} />
          const date = dateOf(day)
          const isToday = date === todayStr
          const isSelected = date === selectedDate

          return (
            <button
              key={date}
              type="button"
              onClick={() => onDateSelect(date)}
              aria-current={isToday ? 'date' : undefined}
              aria-pressed={isSelected}
              className={`aspect-square flex items-center justify-center rounded-xl text-xs sm:text-sm tabular-nums transition-colors ${
                isSelected
                  ? 'bg-primary-600 text-white font-semibold hover:bg-primary-700'
                  : isToday
                    ? 'border-2 border-primary-500 text-primary-600 dark:text-primary-500 font-bold hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    : date > todayStr
                      ? 'text-gray-400 dark:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default Calendar
