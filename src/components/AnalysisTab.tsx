import { useState, useEffect } from 'react'
import Calendar from './analysis/Calendar'
import DayView from './analysis/DayView'
import Charts from './analysis/Charts'
import { Tag } from '../types'

interface AnalysisTabProps {
  tags: Tag[]
  onAddSession: () => void
  refreshTrigger?: number
}

const AnalysisTab = ({ tags, onAddSession, refreshTrigger }: AnalysisTabProps) => {
  // Initialize with today's date
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState<string | null>(today)

  // Auto-select today's date on mount
  useEffect(() => {
    setSelectedDate(today)
  }, [])

  const handleDateSelect = (date: string) => {
    // If clicking the same date, keep it selected (don't toggle)
    setSelectedDate(date)
  }

  return (
    <div className="fixed inset-0 top-16 left-0 right-0 bottom-16 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Desktop: Side by Side Layout, Mobile: Stacked */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Calendar */}
          <div>
            <Calendar
              onDateSelect={handleDateSelect}
              selectedDate={selectedDate}
              refreshTrigger={refreshTrigger}
            />
          </div>

          {/* Right Column: Day View or Placeholder */}
          <div>
            {selectedDate ? (
              <DayView
                date={selectedDate}
                tags={tags}
                onBack={() => setSelectedDate(null)}
                onAddSession={onAddSession}
                refreshTrigger={refreshTrigger}
              />
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 h-full flex items-center justify-center">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-lg font-medium">Select a date</p>
                  <p className="text-sm mt-2">Click on any date to view session details</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Charts Section - Full Width */}
        <Charts tags={tags} refreshTrigger={refreshTrigger} />
      </div>
    </div>
  )
}

export default AnalysisTab
