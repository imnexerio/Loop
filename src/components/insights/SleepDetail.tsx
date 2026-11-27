import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { SleepNight, SleepTags, buildSleepNights, rollingAverage, summarizeSleep } from '../../tagTypes/sleep'
import { formatMinutesOfDay } from '../../tagTypes/registry'
import { formatDuration, formatShortDate } from '../../tagTypes/format'
import { useSessionsInRange } from '../../hooks/useSessionsInRange'
import { addDaysToDateString, getWeekdayOfDateString, listDatesBetween } from '../../utils/dateUtils'
import { Segmented, SectionTitle, StatTile } from './details'
import { RANGE_OPTIONS, RangeDays } from './prefs'
import SleepChart from './SleepChart'

interface SleepDetailProps {
  tags: SleepTags
  today: string
  range: RangeDays
  onRangeChange: (r: RangeDays) => void
  onSelectDate: (date: string) => void
  onClose: () => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ZOOM_OPTIONS = [
  { value: 'zoom' as const, label: 'Zoom to night' },
  { value: 'full' as const, label: 'Full 24 h' },
]

const dayLabel = (date: string) => `${WEEKDAYS[getWeekdayOfDateString(date)]} ${formatShortDate(date)}`

/** "25 min later", "on time" */
const shiftText = (diff: number) =>
  Math.abs(diff) < 1 ? 'same as usual' : `${formatDuration(diff)} ${diff > 0 ? 'later' : 'earlier'} than usual`

const signed = (diff: number) => (Math.abs(diff) < 1 ? 'same' : `${diff > 0 ? '+' : '−'}${formatDuration(diff)}`)

const LegendSwatch = ({ className, line }: { className: string; line?: boolean }) => (
  <span className={`inline-block w-3.5 ${line ? 'h-0.5 rounded-full' : 'h-2.5 rounded-sm'} ${className}`} aria-hidden />
)

const NightDetail = ({ night, bedAvg, wakeAvg, meanDuration, onOpenDay }: {
  night: SleepNight
  bedAvg: number
  wakeAvg: number
  meanDuration: number
  onOpenDay: () => void
}) => (
  <div className="rounded-xl bg-gray-50 dark:bg-gray-700/40 p-3 sm:p-4" aria-live="polite">
    <div className="flex items-center justify-between gap-3 mb-3">
      <p className="font-semibold text-gray-900 dark:text-white">
        Night of {dayLabel(addDaysToDateString(night.date, -1))} → {dayLabel(night.date)}
      </p>
      <button
        type="button"
        onClick={onOpenDay}
        className="shrink-0 text-sm font-medium text-primary-600 dark:text-primary-500 hover:underline"
      >
        Open day
      </button>
    </div>
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
      <div>
        <dt className="text-xs text-gray-500 dark:text-gray-400">Slept</dt>
        <dd className="font-semibold text-gray-900 dark:text-white tabular-nums">{formatMinutesOfDay(night.bedMinutes)}</dd>
        <dd className="text-xs text-gray-500 dark:text-gray-400">{shiftText(night.start - bedAvg)}</dd>
      </div>
      <div>
        <dt className="text-xs text-gray-500 dark:text-gray-400">Woke</dt>
        <dd className="font-semibold text-gray-900 dark:text-white tabular-nums">{formatMinutesOfDay(night.wakeMinutes)}</dd>
        <dd className="text-xs text-gray-500 dark:text-gray-400">{shiftText(night.end - wakeAvg)}</dd>
      </div>
      <div>
        <dt className="text-xs text-gray-500 dark:text-gray-400">Asleep</dt>
        <dd className="font-semibold text-gray-900 dark:text-white tabular-nums">{formatDuration(night.duration)}</dd>
      </div>
      <div>
        <dt className="text-xs text-gray-500 dark:text-gray-400">vs your average</dt>
        <dd className="font-semibold text-gray-900 dark:text-white tabular-nums">{signed(night.duration - meanDuration)}</dd>
      </div>
    </dl>
  </div>
)

const SleepDetail = ({ tags, today, range, onRangeChange, onSelectDate, onClose }: SleepDetailProps) => {
  const [zoom, setZoom] = useState<'zoom' | 'full'>('zoom')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // One extra day so a bedtime logged the evening before the range still pairs
  const windowStart = addDaysToDateString(today, -(range - 1))
  const fetchStart = addDaysToDateString(windowStart, -1)
  const { byDate, loading, hasData } = useSessionsInRange(fetchStart, today)

  const { nights, gaps } = useMemo(() => {
    const all = buildSleepNights(tags, listDatesBetween(fetchStart, today), byDate)
    return {
      nights: all.nights.filter((n) => n.date >= windowStart),
      gaps: all.gaps.filter((g) => g.date >= windowStart),
    }
  }, [tags, fetchStart, windowStart, today, byDate])

  const summary = useMemo(() => summarizeSleep(nights), [nights])
  const bedAvg = useMemo(() => rollingAverage(nights.map((n) => n.start)), [nights])
  const wakeAvg = useMemo(() => rollingAverage(nights.map((n) => n.end)), [nights])

  // Until a night is tapped, show the newest one (where the chart opens)
  const found = nights.findIndex((n) => n.id === selectedId)
  const selectedIndex = found === -1 ? nights.length - 1 : found
  const selected = nights.length ? nights[selectedIndex] : null

  const openDay = (date: string) => {
    onSelectDate(date)
    onClose()
  }

  const body = (() => {
    if (loading && !hasData) {
      return <div className="h-80 rounded-xl bg-gray-100 dark:bg-gray-700/40 animate-pulse" />
    }
    if (nights.length === 0 || summary.meanDuration === null) {
      return (
        <p className="text-center text-gray-500 dark:text-gray-400 py-12">
          No nights logged in the last {range} days. Log {tags.slept.name} and {tags.woke.name} in a session to see your sleep here.
        </p>
      )
    }
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <StatTile label="Average sleep" value={formatDuration(summary.meanDuration)} hint={`${summary.count} ${summary.count === 1 ? 'night' : 'nights'}`} />
          </div>
          <StatTile
            label="Bedtime"
            value={formatMinutesOfDay(summary.meanBedtime!)}
            hint={summary.bedtimeSpread !== null ? `± ${formatDuration(summary.bedtimeSpread)}` : undefined}
          />
          <StatTile
            label="Wake-up"
            value={formatMinutesOfDay(summary.meanWake!)}
            hint={summary.wakeSpread !== null ? `± ${formatDuration(summary.wakeSpread)}` : undefined}
          />
          <StatTile label="Shortest" value={formatDuration(summary.shortest!.duration)} hint={formatShortDate(summary.shortest!.date)} />
          <StatTile label="Longest" value={formatDuration(summary.longest!.duration)} hint={formatShortDate(summary.longest!.date)} />
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Night by night</h4>
            <Segmented label="Time axis" value={zoom} onChange={setZoom} options={ZOOM_OPTIONS} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5"><LegendSwatch className="bg-[#257de0]/55 dark:bg-[#338ced]/55" />Asleep</span>
            <span className="inline-flex items-center gap-1.5"><LegendSwatch className="bg-[#257de0] dark:bg-[#338ced]" />Selected night</span>
            <span className="inline-flex items-center gap-1.5"><LegendSwatch line className="bg-[#f47230] dark:bg-[#e76624]" />Bedtime, 7-night avg</span>
            <span className="inline-flex items-center gap-1.5"><LegendSwatch line className="bg-[#00b894] dark:bg-[#00a888]" />Wake-up, 7-night avg</span>
            <span className="inline-flex items-center gap-1.5"><LegendSwatch className="bg-gray-100 dark:bg-gray-700/60 ring-1 ring-gray-200 dark:ring-gray-700" />Fri and Sat night</span>
          </div>
          <SleepChart nights={nights} selectedId={selected?.id ?? null} onSelect={setSelectedId} zoom={zoom === 'zoom'} />
        </div>

        {selected && (
          <NightDetail
            night={selected}
            bedAvg={bedAvg[selectedIndex]}
            wakeAvg={wakeAvg[selectedIndex]}
            meanDuration={summary.meanDuration}
            onOpenDay={() => openDay(selected.date)}
          />
        )}

        {gaps.length > 0 && (
          <div>
            <SectionTitle>Incomplete nights</SectionTitle>
            <ul className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
              {gaps.map((g) => (
                <li key={`${g.date}-${g.missing}`}>
                  <button
                    type="button"
                    onClick={() => openDay(g.date)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700/40"
                  >
                    <span className="text-gray-800 dark:text-gray-200">{dayLabel(g.date)}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {g.missing === 'slept'
                        ? `${tags.woke.name} logged, no ${tags.slept.name}`
                        : `${tags.slept.name} logged, no ${tags.woke.name}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  })()

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sleep-detail-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
      >
        <div className="flex items-start gap-3 p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <span className="text-2xl leading-none mt-1" aria-hidden>🌙</span>
          <div className="flex-1 min-w-0">
            <h3 id="sleep-detail-title" className="text-xl font-bold text-gray-900 dark:text-white truncate">Sleep</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tags.slept.name} to {tags.woke.name} · {nights.length} {nights.length === 1 ? 'night' : 'nights'} in the last {range} days
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

export default SleepDetail
