import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { Tag } from '../../types'
import { 
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts'
import { ref, get, query, orderByKey, startAt, endAt } from 'firebase/database'
import { database } from '../../firebase/config'

interface ClockChartsProps {
  tags: Tag[]
}

type ChartType = 'line' | 'area'

interface ClockTimeValue {
  hour: number
  minute: number
}

interface ClockTimeDataPoint {
  date: string
  dateDisplay: string
  [key: string]: string | number | null
}

interface ClockChartPreferences {
  chartType: ChartType
  dateRange: 7 | 14 | 30
}

// Color palette for multiple clock time tags
const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
]

const ClockCharts = ({ tags }: ClockChartsProps) => {
  const { currentUser } = useAuth()
  const [chartType, setChartType] = useState<ChartType>('line')
  const [dateRange, setDateRange] = useState<7 | 14 | 30>(30)
  const [chartData, setChartData] = useState<ClockTimeDataPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)

  // Filter only clocktime tags
  const clockTimeTags = useMemo(() => 
    tags.filter(tag => tag.type === 'clocktime'), 
    [tags]
  )

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (!currentUser || preferencesLoaded) return

    try {
      const storageKey = `clockChartPreferences_${currentUser.uid}`
      const savedPrefs = localStorage.getItem(storageKey)

      if (savedPrefs) {
        const prefs: ClockChartPreferences = JSON.parse(savedPrefs)
        setChartType(prefs.chartType)
        setDateRange(prefs.dateRange)
      }
    } catch (error) {
      console.error('Error loading clock chart preferences from localStorage:', error)
    } finally {
      setPreferencesLoaded(true)
    }
  }, [currentUser, preferencesLoaded])

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    if (!currentUser || !preferencesLoaded) return

    try {
      const storageKey = `clockChartPreferences_${currentUser.uid}`
      const clockChartPreferences: ClockChartPreferences = {
        chartType,
        dateRange
      }

      localStorage.setItem(storageKey, JSON.stringify(clockChartPreferences))
    } catch (error) {
      console.error('Error saving clock chart preferences to localStorage:', error)
    }
  }, [currentUser, chartType, dateRange, preferencesLoaded])

  // Convert clock time to decimal hours for plotting
  const timeToDecimal = (time: ClockTimeValue): number => {
    return time.hour + time.minute / 60
  }

  // Fetch clock time data
  useEffect(() => {
    const fetchClockTimeData = async () => {
      if (!currentUser || clockTimeTags.length === 0) {
        setChartData([])
        return
      }

      setLoading(true)
      try {
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - dateRange + 1)
        
        const startDateStr = startDate.toISOString().split('T')[0]
        const endDateStr = endDate.toISOString().split('T')[0]
        
        const sessionsRef = ref(database, `users/${currentUser.uid}/sessions`)
        const rangeQuery = query(
          sessionsRef,
          orderByKey(),
          startAt(startDateStr),
          endAt(endDateStr)
        )
        
        const snapshot = await get(rangeQuery)
        
        // Initialize result array with all dates
        const dataPoints: ClockTimeDataPoint[] = []
        for (let i = 0; i < dateRange; i++) {
          const date = new Date(startDate)
          date.setDate(date.getDate() + i)
          const dateStr = date.toISOString().split('T')[0]
          // Parse date string manually to avoid timezone issues
          const [year, month, day] = dateStr.split('-')
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const dateDisplay = `${monthNames[parseInt(month) - 1]} ${parseInt(day)}, ${year}`
          
          const dataPoint: ClockTimeDataPoint = {
            date: dateStr,
            dateDisplay
          }
          
          // Initialize all clock time tags as null
          clockTimeTags.forEach(tag => {
            dataPoint[tag.id] = null
          })
          
          dataPoints.push(dataPoint)
        }
        
        if (snapshot.exists()) {
          const sessionsObj = snapshot.val()
          
          Object.entries(sessionsObj).forEach(([date, dayData]: [string, any]) => {
            const sessionsObj = dayData.sessions || {}
            const sessions = Object.values(sessionsObj)
            
            // Find the data point for this date
            const dataPointIndex = dataPoints.findIndex(dp => dp.date === date)
            if (dataPointIndex === -1) return
            
            // Process each clock time tag
            clockTimeTags.forEach(tag => {
              const values: ClockTimeValue[] = []
              
              sessions.forEach((session: any) => {
                const tagValue = session.tags?.[tag.id]
                if (tagValue && typeof tagValue === 'object' && 'hour' in tagValue && 'minute' in tagValue) {
                  values.push(tagValue)
                }
              })
              
              // Calculate average time for the day
              if (values.length > 0) {
                const decimalTimes = values.map(timeToDecimal)
                const avgDecimal = decimalTimes.reduce((sum, val) => sum + val, 0) / values.length
                dataPoints[dataPointIndex][tag.id] = Math.round(avgDecimal * 100) / 100
              }
            })
          })
        }
        
        setChartData(dataPoints)
      } catch (error) {
        console.error('Error fetching clock time data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchClockTimeData()
  }, [currentUser, clockTimeTags, dateRange])

  // Format Y-axis ticks (0, 4, 8, 12, 16, 20, 24)
  const formatYAxis = (value: number) => {
    const hour = Math.floor(value)
    return `${String(hour).padStart(2, '0')}:00`
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            {label}
          </p>
          {payload.map((entry: any, index: number) => {
            if (entry.value !== null) {
              const decimalHours = entry.value
              const hours = Math.floor(decimalHours)
              const minutes = Math.round((decimalHours - hours) * 60)
              const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
              
              return (
                <p key={index} className="text-sm" style={{ color: entry.color }}>
                  {entry.name}: {timeStr}
                </p>
              )
            }
            return null
          })}
        </div>
      )
    }
    return null
  }

  if (clockTimeTags.length === 0) {
    return null // Don't show component if no clock time tags
  }

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 10, left: 0, bottom: 5 }
    }

    const lines = clockTimeTags.map((tag, index) => {
      const color = CHART_COLORS[index % CHART_COLORS.length]
      
      if (chartType === 'area') {
        return (
          <Area
            key={tag.id}
            type="monotone"
            dataKey={tag.id}
            stroke={color}
            fill={color}
            fillOpacity={0.2}
            strokeWidth={2}
            dot={{ r: 3, fill: color }}
            connectNulls
            name={tag.name}
          />
        )
      }
      
      return (
        <Line
          key={tag.id}
          type="monotone"
          dataKey={tag.id}
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3, fill: color }}
          connectNulls
          name={tag.name}
        />
      )
    })

    const ChartComponent = chartType === 'area' ? AreaChart : LineChart

    return (
      <ResponsiveContainer width="100%" height={300}>
        <ChartComponent {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="dateDisplay"
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            domain={[0, 24]}
            ticks={[0, 4, 8, 12, 16, 20, 24]}
            tickFormatter={formatYAxis}
            stroke="#9ca3af"
            style={{ fontSize: '12px' }}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: '14px' }}
            iconType="line"
          />
          {lines}
        </ChartComponent>
      </ResponsiveContainer>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-md border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            Clock Time Trends
          </h3>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Chart Type Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setChartType('line')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                chartType === 'line'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Line
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                chartType === 'area'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Area
            </button>
          </div>

          {/* Date Range */}
          <div className="flex gap-2">
            <button
              onClick={() => setDateRange(7)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                dateRange === 7
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setDateRange(14)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                dateRange === 14
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              14 Days
            </button>
            <button
              onClick={() => setDateRange(30)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                dateRange === 30
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              30 Days
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-[300px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : chartData.length > 0 ? (
        renderChart()
      ) : (
        <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
          <p className="text-sm">No clock time data available for the selected period</p>
        </div>
      )}

      {/* Info */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
        Showing {clockTimeTags.map(t => t.name).join(', ')} over the last {dateRange} days
      </div>
    </div>
  )
}

export default ClockCharts
