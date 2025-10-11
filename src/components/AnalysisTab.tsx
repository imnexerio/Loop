import { useState } from 'react'
import Calendar from './analysis/Calendar'
import DayView from './analysis/DayView'
import { Tag } from '../types'

interface AnalysisTabProps {
  tags: Tag[]
  onAddSession: () => void
}

const AnalysisTab = ({ tags, onAddSession }: AnalysisTabProps) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleDateSelect = (date: string) => {
    setSelectedDate(date)
  }

  const handleBack = () => {
    setSelectedDate(null)
    setRefreshKey(prev => prev + 1) // Refresh calendar to show new session indicator
  }

  const handleSessionAdded = () => {
    setRefreshKey(prev => prev + 1) // Refresh view
  }

  return (
    <div>
      {selectedDate ? (
        <DayView
          key={`${selectedDate}-${refreshKey}`}
          date={selectedDate}
          tags={tags}
          onBack={handleBack}
          onAddSession={onAddSession}
        />
      ) : (
        <Calendar
          key={refreshKey}
          onDateSelect={handleDateSelect}
          selectedDate={selectedDate}
        />
      )}
    </div>
  )
}

export default AnalysisTab
