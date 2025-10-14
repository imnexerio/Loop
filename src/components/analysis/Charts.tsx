import { useState, useEffect, useMemo, memo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getChartDataCached } from '../../services/dataManager'
import { Tag } from '../../types'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface ChartsProps {
  tags: Tag[]
}

const Charts = memo(({ tags }: ChartsProps) => {
  const { currentUser } = useAuth()
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [chartData, setChartData] = useState<{ date: string; value: number | null }[]>([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<7 | 14 | 30>(30)

  // Memoize plottable tags to avoid recalculating on every render
  const plottableTags = useMemo(() => 
    tags.filter(tag => 
      tag.type === 'number' || tag.type === 'rating' || tag.type === 'time'
    ), 
    [tags]
  )

  const selectedTagData = useMemo(() => 
    plottableTags.find(t => t.id === selectedTag),
    [plottableTags, selectedTag]
  )

  useEffect(() => {
    if (!selectedTag || !currentUser) {
      setChartData([])
      return
    }

    const loadChartData = async () => {
      setLoading(true)
      try {
        const data = await getChartDataCached(currentUser.uid, selectedTag, dateRange)
        setChartData(data)
      } catch (error) {
        console.error('Error loading chart data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadChartData()
  }, [selectedTag, currentUser?.uid, dateRange])

  // Memoize formatted data to avoid recalculating on every render
  const formattedData = useMemo(() => 
    chartData
      .filter(d => d.value !== null)
      .map(d => ({
        date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: d.value
      })),
    [chartData]
  )

  if (plottableTags.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          📊 Charts
        </h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>No numeric tags available for charting.</p>
          <p className="text-sm mt-2">Create tags with Number, Rating, or Time type to see charts.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        📊 Charts
      </h3>

      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        {/* Tag Selector */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select a tag
          </label>
          <select
            value={selectedTag || ''}
            onChange={(e) => setSelectedTag(e.target.value || null)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Choose a tag...</option>
            {plottableTags.map(tag => (
              <option key={tag.id} value={tag.id}>
                {tag.name} ({tag.type})
              </option>
            ))}
          </select>
        </div>

        {/* Date Range Selector */}
        {selectedTag && (
          <div className="sm:w-40">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date range
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(Number(e.target.value) as 7 | 14 | 30)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </div>
        )}
      </div>

      {/* Chart Area */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : selectedTag && formattedData.length > 0 ? (
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#22c55e" 
                strokeWidth={2}
                dot={{ fill: '#22c55e', r: 4 }}
                activeDot={{ r: 6 }}
                name={selectedTagData?.name || 'Value'}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : selectedTag ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>No data available for <strong>{selectedTagData?.name}</strong></p>
          <p className="text-sm mt-2">Start logging sessions with this tag to see the chart</p>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Select a tag above to view its chart
        </div>
      )}
    </div>
  )
})

Charts.displayName = 'Charts'

export default Charts
