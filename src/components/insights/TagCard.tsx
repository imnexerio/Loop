import { TagInsight, circularDiff } from '../../tagTypes/stats'
import { getTagTypeMeta, formatMinutesOfDay, getRatingMax } from '../../tagTypes/registry'
import { formatDuration, formatNumber, formatPercent, formatShortDate } from '../../tagTypes/format'
import { HabitGrid, Sparkline, RatingBars, ClockStrip } from './visuals'

interface TagCardProps {
  insight: TagInsight
  rangeDays: number
  pinned: boolean
  onTogglePin: () => void
  onOpen: () => void
}

export const PinIcon = ({ filled }: { filled: boolean }) => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
)

const Delta = ({ text }: { text: string | null }) =>
  text ? <span className="text-xs text-gray-500 dark:text-gray-400">{text}</span> : null

const Headline = ({ value, suffix }: { value: string; suffix?: string }) => (
  <div className="flex items-baseline gap-1.5">
    <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{value}</span>
    {suffix && <span className="text-sm text-gray-500 dark:text-gray-400">{suffix}</span>}
  </div>
)

const CardBody = ({ insight, rangeDays }: { insight: TagInsight; rangeDays: number }) => {
  switch (insight.kind) {
    case 'checkbox':
      return (
        <div className="space-y-3">
          <HabitGrid days={insight.days} />
          <div className="flex items-baseline justify-between">
            <Headline
              value={String(insight.currentStreak)}
              suffix={`day streak${insight.currentStreak >= 3 ? ' 🔥' : ''}`}
            />
            {insight.rate !== null && (
              <span className="text-sm text-gray-500 dark:text-gray-400">{formatPercent(insight.rate)} of days</span>
            )}
          </div>
        </div>
      )

    case 'number':
    case 'rating': {
      const unit = insight.kind === 'rating' ? `/ ${getRatingMax(insight.tag)} avg` : `${insight.tag.config?.unit ?? ''} avg`.trim()
      const delta =
        insight.mean !== null && insight.previousMean !== null
          ? `${insight.mean >= insight.previousMean ? '↑' : '↓'} ${formatNumber(Math.abs(insight.mean - insight.previousMean))} vs previous ${rangeDays}d`
          : null
      return (
        <div className="space-y-3">
          {insight.kind === 'rating' && insight.distribution ? (
            <RatingBars distribution={insight.distribution} />
          ) : (
            <Sparkline values={insight.series.map((p) => p.value)} />
          )}
          <div className="flex items-baseline justify-between gap-2">
            <Headline value={insight.mean !== null ? formatNumber(insight.mean) : '–'} suffix={unit} />
            <Delta text={delta} />
          </div>
        </div>
      )
    }

    case 'clocktime': {
      if (insight.meanMinutes === null) return null
      let delta: string | null = null
      if (insight.previousMeanMinutes !== null) {
        const diff = circularDiff(insight.meanMinutes, insight.previousMeanMinutes)
        delta = Math.abs(diff) < 1 ? 'same as before' : `${formatDuration(diff)} ${diff > 0 ? 'later' : 'earlier'} than before`
      }
      return (
        <div className="space-y-3">
          <ClockStrip minutes={insight.series.map((p) => p.minutes)} meanMinutes={insight.meanMinutes} />
          <div className="flex items-baseline justify-between gap-2">
            <Headline
              value={formatMinutesOfDay(insight.meanMinutes)}
              suffix={insight.spreadMinutes !== null ? `± ${formatDuration(insight.spreadMinutes)}` : undefined}
            />
            <Delta text={delta} />
          </div>
        </div>
      )
    }

    case 'text': {
      const latest = insight.entries[0]
      return (
        <div className="space-y-2">
          {latest && (
            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 italic">
              “{latest.value}”
              <span className="not-italic text-xs text-gray-400 dark:text-gray-500 ml-1.5">{formatShortDate(latest.date)}</span>
            </p>
          )}
          <Headline value={String(insight.count)} suffix={insight.count === 1 ? 'entry' : 'entries'} />
        </div>
      )
    }
  }
}

const TagCard = ({ insight, rangeDays, pinned, onTogglePin, onOpen }: TagCardProps) => {
  const meta = getTagTypeMeta(insight.tag.type)
  const isEmpty = insight.count === 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="text-left bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700 hover:border-primary-500/60 transition-colors cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <div className="flex items-start gap-3 mb-3">
        <span className="text-xl leading-none mt-0.5 text-gray-700 dark:text-gray-300" aria-hidden>{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-white truncate">{insight.tag.name}</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {meta.label}
            {insight.kind !== 'text' && ` · ${insight.count} ${insight.count === 1 ? 'entry' : 'entries'}`}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onTogglePin()
          }}
          className={`p-1.5 -m-1.5 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
            pinned ? 'text-primary-600 dark:text-primary-500' : 'text-gray-300 dark:text-gray-600'
          }`}
          aria-label={pinned ? `Unpin ${insight.tag.name}` : `Pin ${insight.tag.name}`}
          aria-pressed={pinned}
        >
          <PinIcon filled={pinned} />
        </button>
      </div>

      {isEmpty ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4">No entries in the last {rangeDays} days</p>
      ) : (
        <CardBody insight={insight} rangeDays={rangeDays} />
      )}
    </div>
  )
}

export default TagCard
