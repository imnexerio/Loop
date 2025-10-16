import { useState, useEffect, useMemo, memo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getChartDataCached } from '../../services/dataManager'
import { Tag } from '../../types'
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts'

interface ChartsProps {
  tags: Tag[]
}

type ChartType = 'line' | 'bar' | 'area'
type AggregationType = 'average' | 'sum' | 'min' | 'max'

interface ChartPreferences {
  selectedTagIds: string[]
  chartType: ChartType
  aggregationType: AggregationType
  dateRange: 7 | 14 | 30
}

// Color palette for multiple metrics
const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
]

const Charts = memo(({ tags }: ChartsProps) => {
  const { currentUser } = useAuth()
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [chartType, setChartType] = useState<ChartType>('line')
  const [aggregationType, setAggregationType] = useState<AggregationType>('average')
  const [dateRange, setDateRange] = useState<7 | 14 | 30>(30)
  const [chartData, setChartData] = useState<Record<string, { date: string; value: number | null }[]>>({})
  const [loading, setLoading] = useState(false)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)

  // Memoize plottable tags
  const plottableTags = useMemo(() => 
    tags.filter(tag => 
      tag.type === 'number' || tag.type === 'rating'
    ), 
    [tags]
  )

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (!currentUser || preferencesLoaded || plottableTags.length === 0) return

    try {
      const storageKey = `chartPreferences_${currentUser.uid}`
      const savedPrefs = localStorage.getItem(storageKey)

      if (savedPrefs) {
        const prefs: ChartPreferences = JSON.parse(savedPrefs)

        // Validate that selected tags still exist
        const validTagIds = prefs.selectedTagIds.filter((id: string) => 
          plottableTags.some(tag => tag.id === id)
        )

        if (validTagIds.length > 0) {
          setSelectedTagIds(validTagIds)
        }
        setChartType(prefs.chartType)
        setAggregationType(prefs.aggregationType)
        setDateRange(prefs.dateRange)
      }
    } catch (error) {
      console.error('Error loading chart preferences from localStorage:', error)
    } finally {
      setPreferencesLoaded(true)
    }
  }, [currentUser, plottableTags, preferencesLoaded])

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    if (!currentUser || !preferencesLoaded || selectedTagIds.length === 0) return

    try {
      const storageKey = `chartPreferences_${currentUser.uid}`
      const chartPreferences: ChartPreferences = {
        selectedTagIds,
        chartType,
        aggregationType,
        dateRange
      }

      localStorage.setItem(storageKey, JSON.stringify(chartPreferences))
    } catch (error) {
      console.error('Error saving chart preferences to localStorage:', error)
    }
  }, [currentUser, selectedTagIds, chartType, aggregationType, dateRange, preferencesLoaded])

  // Auto-select first tag if none selected (only after preferences loaded)
  useEffect(() => {
    if (plottableTags.length > 0 && selectedTagIds.length === 0 && preferencesLoaded) {
      setSelectedTagIds([plottableTags[0].id])
    }
  }, [plottableTags, selectedTagIds.length, preferencesLoaded])

  // Fetch data for all selected tags
  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser || selectedTagIds.length === 0) {
        setChartData({})
        return
      }

      setLoading(true)
      try {
        const dataPromises = selectedTagIds.map(async (tagId) => {
          const data = await getChartDataCached(currentUser.uid, tagId, dateRange)
          return { tagId, data }
        })

        const results = await Promise.all(dataPromises)
        const newChartData: Record<string, { date: string; value: number | null }[]> = {}
        
        results.forEach(({ tagId, data }) => {
          newChartData[tagId] = data
        })

        setChartData(newChartData)
      } catch (error) {
        console.error('Error fetching chart data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [currentUser, selectedTagIds, dateRange, aggregationType])

  // Handle tag selection toggle
  const handleTagToggle = (tagId: string) => {
    setSelectedTagIds(prev => {
      if (prev.includes(tagId)) {
        // Don't allow deselecting if it's the only one
        if (prev.length === 1) return prev
        return prev.filter(id => id !== tagId)
      } else {
        // Limit to 5 tags for readability
        if (prev.length >= 5) {
          alert('Maximum 5 tags can be selected at once')
          return prev
        }
        return [...prev, tagId]
      }
    })
  }

  // Merge data from all selected tags into single chart format
  const mergedChartData = useMemo(() => {
    if (Object.keys(chartData).length === 0) return []

    // Get all unique dates
    const allDates = new Set<string>()
    Object.values(chartData).forEach(data => {
      data.forEach(point => allDates.add(point.date))
    })

    // Create merged data points
    const merged = Array.from(allDates).sort().map(date => {
      const point: any = { date }
      
      selectedTagIds.forEach(tagId => {
        const tagData = chartData[tagId]
        const dataPoint = tagData?.find(d => d.date === date)
        point[tagId] = dataPoint?.value ?? null
      })

      return point
    })

    return merged
  }, [chartData, selectedTagIds])

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  // Get tag name by id
  const getTagName = (tagId: string) => {
    return plottableTags.find(t => t.id === tagId)?.name || tagId
  }

  // Render the appropriate chart type
  const renderChart = () => {
    if (mergedChartData.length === 0) return null

    const commonProps = {
      data: mergedChartData,
      margin: { top: 5, right: 10, left: -20, bottom: 5 }
    }

    const lines = selectedTagIds.map((tagId, index) => {
      const color = CHART_COLORS[index % CHART_COLORS.length]
      const name = getTagName(tagId)

      switch (chartType) {
        case 'line':
          return (
            <Line
              key={tagId}
              type="monotone"
              dataKey={tagId}
              stroke={color}
              strokeWidth={2}
              name={name}
              dot={{ fill: color, r: 3 }}
              connectNulls
            />
          )
        case 'bar':
          return (
            <Bar
              key={tagId}
              dataKey={tagId}
              fill={color}
              name={name}
            />
          )
        case 'area':
          return (
            <Area
              key={tagId}
              type="monotone"
              dataKey={tagId}
              stroke={color}
              fill={color}
              fillOpacity={0.3}
              name={name}
              connectNulls
            />
          )
      }
    })

    const ChartComponent = chartType === 'line' ? LineChart : chartType === 'bar' ? BarChart : AreaChart

    return (
      <ChartComponent {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
        <XAxis 
          dataKey="date" 
          tickFormatter={formatDate}
          stroke="#9ca3af"
          style={{ fontSize: '12px' }}
        />
        <YAxis 
          stroke="#9ca3af"
          style={{ fontSize: '12px' }}
          width={40}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            color: '#f9fafb'
          }}
          labelFormatter={(label) => `Date: ${label}`}
        />
        <Legend 
          wrapperStyle={{ fontSize: '12px' }}
          iconType="line"
        />
        {lines}
      </ChartComponent>
    )
  }

  if (plottableTags.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
        <svg className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-gray-600 dark:text-gray-400 mb-2">No plottable tags available</p>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Create tags with types: Number, Rating, or Time to see charts
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 space-y-6">
      {/* Controls Section */}
      <div className="space-y-4">
        {/* Tag Multi-Select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Metrics (up to 5)
          </label>
          <div className="flex flex-wrap gap-2">
            {plottableTags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id)
              const color = CHART_COLORS[selectedTagIds.indexOf(tag.id) % CHART_COLORS.length]
              
              return (
                <button
                  key={tag.id}
                  onClick={() => handleTagToggle(tag.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isSelected
                      ? 'text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  style={isSelected ? { backgroundColor: color } : {}}
                >
                  {tag.name}
                  {isSelected && (
                    <span className="ml-2 text-xs opacity-80">✓</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Chart Type and Aggregation Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Chart Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Chart Type
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setChartType('line')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  chartType === 'line'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Line
              </button>
              <button
                onClick={() => setChartType('bar')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  chartType === 'bar'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Bar
              </button>
              <button
                onClick={() => setChartType('area')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  chartType === 'area'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Area
              </button>
            </div>
          </div>

          {/* Aggregation Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Aggregation
            </label>
            <select
              value={aggregationType}
              onChange={(e) => setAggregationType(e.target.value as AggregationType)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="average">Daily Average</option>
              <option value="sum">Daily Sum</option>
              <option value="min">Daily Minimum</option>
              <option value="max">Daily Maximum</option>
            </select>
          </div>

          {/* Date Range Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date Range
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(Number(e.target.value) as 7 | 14 | 30)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="h-80">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading chart data...</p>
            </div>
          </div>
        ) : mergedChartData.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-600 dark:text-gray-400">No data available for selected date range</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart() || <></>}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
})

Charts.displayName = 'Charts'

export default Charts
