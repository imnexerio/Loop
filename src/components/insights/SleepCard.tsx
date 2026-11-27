import { SleepNight, SleepTags, summarizeSleep } from '../../tagTypes/sleep'
import { formatMinutesOfDay } from '../../tagTypes/registry'
import { formatDuration } from '../../tagTypes/format'
import { Sparkline } from './visuals'

interface SleepCardProps {
  tags: SleepTags
  nights: SleepNight[]
  previousNights: SleepNight[]
  rangeDays: number
  onOpen: () => void
}

/** Summary of the Slept + Woke tags as nights of sleep */
const SleepCard = ({ tags, nights, previousNights, rangeDays, onOpen }: SleepCardProps) => {
  const summary = summarizeSleep(nights)
  const previous = summarizeSleep(previousNights)

  let delta: string | null = null
  if (summary.meanDuration !== null && previous.meanDuration !== null) {
    const diff = summary.meanDuration - previous.meanDuration
    delta = Math.abs(diff) < 1 ? `same as previous ${rangeDays}d` : `${diff > 0 ? '↑' : '↓'} ${formatDuration(diff)} vs previous ${rangeDays}d`
  }

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
        <span className="text-xl leading-none mt-0.5" aria-hidden>🌙</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-white truncate">Sleep</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {tags.slept.name} + {tags.woke.name} · {summary.count} {summary.count === 1 ? 'night' : 'nights'}
          </p>
        </div>
      </div>

      {summary.meanDuration === null ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4">No nights logged in the last {rangeDays} days</p>
      ) : (
        <div className="space-y-3">
          <Sparkline values={nights.map((n) => n.duration)} />
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{formatDuration(summary.meanDuration)}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">avg</span>
            </div>
            {delta && <span className="text-xs text-gray-500 dark:text-gray-400">{delta}</span>}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
            Bed {formatMinutesOfDay(summary.meanBedtime!)}
            {summary.bedtimeSpread !== null && ` ± ${formatDuration(summary.bedtimeSpread)}`}
            {' · '}
            Wake {formatMinutesOfDay(summary.meanWake!)}
            {summary.wakeSpread !== null && ` ± ${formatDuration(summary.wakeSpread)}`}
          </p>
        </div>
      )}
    </div>
  )
}

export default SleepCard
