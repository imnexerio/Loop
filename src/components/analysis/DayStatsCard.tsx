import { DayLog, Tag } from '../../types'

interface DayStatsCardProps {
  dayLog: DayLog | null
  tags: Tag[]
}

const DayStatsCard = ({ dayLog, tags }: DayStatsCardProps) => {
  // Calculate stats
  const sessionCount = dayLog?.sessions?.length || 0
  const totalTags = dayLog?.sessions?.reduce((acc, session) => {
    return acc + (session.tags ? Object.keys(session.tags).length : 0)
  }, 0) || 0

  const uniqueTagsUsed = new Set(
    dayLog?.sessions?.flatMap(session => 
      session.tags ? Object.keys(session.tags) : []
    ) || []
  ).size

  const hasImages = dayLog?.sessions?.some(session => session.imageId) || false
  const imageCount = dayLog?.sessions?.filter(session => session.imageId).length || 0

  // Calculate simple score (you can make this more sophisticated)
  const calculateScore = () => {
    let score = 0
    score += sessionCount * 20 // 20 points per session (max 100 for 5 sessions)
    score += uniqueTagsUsed * 5 // 5 points per unique tag
    score += imageCount * 10 // 10 points per image
    return Math.min(score, 100)
  }

  const score = calculateScore()

  const getScoreColor = () => {
    if (score >= 80) return 'text-green-600 dark:text-green-400'
    if (score >= 60) return 'text-blue-600 dark:text-blue-400'
    if (score >= 40) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  const getScoreLabel = () => {
    if (score >= 80) return 'Excellent! 🌟'
    if (score >= 60) return 'Great! ✨'
    if (score >= 40) return 'Good! 👍'
    return 'Keep going! 💪'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
          <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white">Daily Summary</h3>
        </div>
      </div>

      {/* Score */}
      <div className="mb-4 text-center py-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <div className={`text-3xl font-bold ${getScoreColor()}`}>
          {score}
          <span className="text-lg">/100</span>
        </div>
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-1">
          {getScoreLabel()}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-lg">📝</span>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Sessions</span>
          </div>
          <span className="text-sm font-bold text-gray-900 dark:text-white">{sessionCount}</span>
        </div>

        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏷️</span>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Tags Used</span>
          </div>
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {uniqueTagsUsed}/{tags.length}
          </span>
        </div>

        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Total Entries</span>
          </div>
          <span className="text-sm font-bold text-gray-900 dark:text-white">{totalTags}</span>
        </div>

        {hasImages && (
          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-lg">📸</span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Images</span>
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{imageCount}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500"
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default DayStatsCard
