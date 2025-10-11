import { useState, useEffect } from 'react'
import Calendar from './analysis/Calendar'
import DayView from './analysis/DayView'
import { Tag } from '../types'

interface AnalysisTabProps {
  tags: Tag[]
  onAddSession: () => void
  refreshTrigger?: number
}

const AnalysisTab = ({ tags, onAddSession, refreshTrigger }: AnalysisTabProps) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Debug: Log when component renders
  useEffect(() => {
    console.log('🔄 AnalysisTab rendered', { selectedDate, refreshTrigger })
  })

  const handleDateSelect = (date: string) => {
    console.log('📅 Date selected in AnalysisTab:', date)
    // If clicking the same date, keep it selected (don't toggle)
    setSelectedDate(date)
  }

  return (
    <div className="space-y-6">
      {/* Calendar - Always Visible */}
      <Calendar
        onDateSelect={handleDateSelect}
        selectedDate={selectedDate}
        refreshTrigger={refreshTrigger}
      />

      {/* Day View - Shows below calendar when date is selected */}
      {selectedDate ? (
        <DayView
          date={selectedDate}
          tags={tags}
          onBack={() => setSelectedDate(null)}
          onAddSession={onAddSession}
          refreshTrigger={refreshTrigger}
        />
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Select a date to view details
        </div>
      )}
    </div>
  )
}

export default AnalysisTab
