import DayView from './analysis/DayView'
import { Tag } from '../types'

interface AddSessionViewProps {
  tags: Tag[]
  onAddSession: () => void
  refreshTrigger?: number
}

const AddSessionView = ({ tags, onAddSession, refreshTrigger }: AddSessionViewProps) => {
  // Always show today's date
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-16 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <DayView
          date={today}
          tags={tags}
          onBack={() => {}} // No back action needed for this view
          onAddSession={onAddSession}
          refreshTrigger={refreshTrigger}
        />
      </div>
    </div>
  )
}

export default AddSessionView
