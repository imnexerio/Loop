import { Session, Tag } from '../../types'

interface SessionCardProps {
  session: Session
  tags: Tag[]
}

const SessionCard = ({ session, tags }: SessionCardProps) => {
  const formatTime = (timestamp: string) => {
    const d = new Date(parseInt(timestamp))
    return d.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    })
  }

  const getTagById = (tagId: string) => {
    return tags.find(t => t.id === tagId)
  }

  const renderTagValue = (tag: Tag, value: any) => {
    switch (tag.type) {
      case 'number':
        return `${value}${tag.config.unit ? ' ' + tag.config.unit : ''}`
      case 'rating':
        return `${value}/${tag.config.max || 5}`
      case 'checkbox':
        return value ? '✓' : '✗'
      case 'text':
        return value
      case 'time':
        return `${value} min`
      default:
        return value
    }
  }

  // Truncate description
  const truncateDescription = (text: string, maxLength: number = 80) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700">

      {/* Time Badge */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5 px-3 py-1 bg-primary-50 dark:bg-primary-900/30 rounded-full">
          <svg className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-semibold text-primary-700 dark:text-primary-300">
            {formatTime(session.timestamp)}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-3 min-h-[60px]">
        {truncateDescription(session.description)}
      </p>

      {/* Tags */}
      {session.tags && Object.keys(session.tags).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {Object.entries(session.tags).slice(0, 3).map(([tagId, value]) => {
            const tag = getTagById(tagId)
            if (!tag) return null

            return (
              <div
                key={tagId}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs"
              >
                <span className="text-gray-600 dark:text-gray-400">{tag.name}:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {renderTagValue(tag, value)}
                </span>
              </div>
            )
          })}
          {Object.keys(session.tags).length > 3 && (
            <div className="inline-flex items-center px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
              +{Object.keys(session.tags).length - 3}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SessionCard
