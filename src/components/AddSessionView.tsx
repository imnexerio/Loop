import DayView from './analysis/DayView'
import { Tag } from '../types'

interface AddSessionViewProps {
  tags: Tag[]
  onAddSession: () => void
}

const AddSessionView = ({ tags, onAddSession }: AddSessionViewProps) => {
  // Always show today's date
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 top-16 left-0 right-0 bottom-16 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
      <div className="min-h-full flex items-start justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-7xl lg:max-w-6xl pb-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl">
            <DayView
              date={today}
              tags={tags}
              onBack={() => {}} // No back action needed for this view
              onAddSession={onAddSession}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddSessionView
