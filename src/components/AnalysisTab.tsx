import { useState, useRef, useCallback } from 'react'
import Calendar from './analysis/Calendar'
import DayView from './analysis/DayView'
import InsightsSection from './insights/InsightsSection'
import { useInsightsPrefs } from './insights/prefs'
import { Tag } from '../types'
import { getLocalToday } from '../utils/dateUtils'

interface AnalysisTabProps {
  tags: Tag[]
  onAddSession: () => void
  onOpenProfile: () => void
}

const AnalysisTab = ({ tags, onAddSession, onOpenProfile }: AnalysisTabProps) => {
  // Today in the user's timezone, fixed for the life of the tab
  const [today] = useState(getLocalToday)
  const [selectedDate, setSelectedDate] = useState<string | null>(today)
  const [prefs, updatePrefs] = useInsightsPrefs()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Jump to a date picked from Insights (e.g. a note entry) and bring the day view into view
  const handleInsightDate = useCallback((date: string) => {
    setSelectedDate(date)
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <div ref={scrollRef} className="fixed inset-0 top-16 left-0 right-0 bottom-16 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Desktop: Side by Side Layout, Mobile: Stacked */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
          {/* Left Column: Calendar */}
          <div className="h-full">
            <Calendar
              onDateSelect={setSelectedDate}
              selectedDate={selectedDate}
            />
          </div>

          {/* Right Column: Day View or Placeholder */}
          <div className="h-full">
            {selectedDate ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden lg:max-h-[620px] flex flex-col">
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
                  <DayView
                    date={selectedDate}
                    tags={tags}
                    onBack={() => setSelectedDate(null)}
                    onAddSession={onAddSession}
                  />
                </div>
              </div>
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

        {/* Every tag, visualized by its type */}
        <InsightsSection
          tags={tags}
          today={today}
          prefs={prefs}
          onPrefsChange={updatePrefs}
          onSelectDate={handleInsightDate}
          onOpenProfile={onOpenProfile}
        />
      </div>
    </div>
  )
}

export default AnalysisTab
