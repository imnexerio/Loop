import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { TagInsight, AggregationType, SessionsByDate } from '../../tagTypes/stats'
import { getTagTypeMeta } from '../../tagTypes/registry'
import { HabitDetail, NumericDetail, ClockDetail, TextDetail, Segmented, ChartType } from './details'
import { RANGE_OPTIONS, RangeDays } from './prefs'

interface TagDetailProps {
  insight: TagInsight
  dates: string[]
  byDate: SessionsByDate
  range: RangeDays
  chartType: ChartType
  aggregation: AggregationType
  onRangeChange: (r: RangeDays) => void
  onChartTypeChange: (t: ChartType) => void
  onAggregationChange: (a: AggregationType) => void
  onSelectDate: (date: string) => void
  onClose: () => void
}

const TagDetail = ({
  insight, dates, byDate, range, chartType, aggregation,
  onRangeChange, onChartTypeChange, onAggregationChange, onSelectDate, onClose,
}: TagDetailProps) => {
  const meta = getTagTypeMeta(insight.tag.type)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const body = (() => {
    if (insight.count === 0 && insight.kind !== 'checkbox') {
      return (
        <p className="text-center text-gray-500 dark:text-gray-400 py-12">
          No entries in the last {range} days. Try a longer range.
        </p>
      )
    }
    switch (insight.kind) {
      case 'checkbox':
        return <HabitDetail insight={insight} />
      case 'number':
      case 'rating':
        return (
          <NumericDetail
            insight={insight}
            dates={dates}
            byDate={byDate}
            chartType={chartType}
            aggregation={aggregation}
            onChartTypeChange={onChartTypeChange}
            onAggregationChange={onAggregationChange}
          />
        )
      case 'clocktime':
        return <ClockDetail insight={insight} />
      case 'text':
        return (
          <TextDetail
            insight={insight}
            onSelectDate={(date) => {
              onSelectDate(date)
              onClose()
            }}
          />
        )
    }
  })()

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tag-detail-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
      >
        <div className="flex items-start gap-3 p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <span className="text-2xl leading-none mt-1 text-gray-700 dark:text-gray-300" aria-hidden>{meta.icon}</span>
          <div className="flex-1 min-w-0">
            <h3 id="tag-detail-title" className="text-xl font-bold text-gray-900 dark:text-white truncate">
              {insight.tag.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {meta.label} · {insight.count} {insight.count === 1 ? 'entry' : 'entries'} in the last {range} days
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -m-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 sm:px-6 pt-4">
          <Segmented label="Date range" value={range} onChange={onRangeChange} options={RANGE_OPTIONS} />
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto">{body}</div>
      </div>
    </div>,
    document.body
  )
}

export default TagDetail
