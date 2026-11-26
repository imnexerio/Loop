/**
 * Small, dependency-free visualizations used on insight cards and in detail views.
 */

import { HabitDayState, circularDiff } from '../../tagTypes/stats'
import { formatMinutesOfDay } from '../../tagTypes/registry'
import { formatShortDate } from '../../tagTypes/format'
import { getWeekdayOfDateString } from '../../utils/dateUtils'

const HABIT_STATE_CLASS: Record<HabitDayState, string> = {
  done: 'bg-primary-500',
  missed: 'bg-gray-200 dark:bg-gray-700',
  today: 'border border-dashed border-primary-500',
  before: 'bg-gray-100/60 dark:bg-gray-700/30',
}

const HABIT_STATE_LABEL: Record<HabitDayState, string> = {
  done: 'Done',
  missed: 'Not done',
  today: 'Not done yet today',
  before: 'Before this tag existed',
}

interface HabitGridProps {
  days: { date: string; state: HabitDayState }[]
  /** compact: chronological rows for cards; calendar: week columns with weekday rows */
  variant?: 'compact' | 'calendar'
}

export const HabitGrid = ({ days, variant = 'compact' }: HabitGridProps) => {
  if (variant === 'calendar') {
    const lead = days.length ? getWeekdayOfDateString(days[0].date) : 0
    const cells: ({ date: string; state: HabitDayState } | null)[] = [
      ...Array.from({ length: lead }, () => null),
      ...days,
    ]
    const weeks = Math.ceil(cells.length / 7)
    return (
      <div className="flex gap-2">
        <div className="grid grid-rows-7 gap-1 text-[10px] leading-none text-gray-400 dark:text-gray-500">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <span key={i} className="flex items-center h-full">{i % 2 === 1 ? d : ''}</span>
          ))}
        </div>
        <div
          className="grid grid-rows-7 grid-flow-col gap-1"
          style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1.5rem))` }}
        >
          {cells.map((cell, i) =>
            cell ? (
              <div
                key={cell.date}
                title={`${formatShortDate(cell.date)} · ${HABIT_STATE_LABEL[cell.state]}`}
                className={`aspect-square rounded-[3px] max-w-6 ${HABIT_STATE_CLASS[cell.state]}`}
              />
            ) : (
              <div key={`pad-${i}`} />
            )
          )}
        </div>
      </div>
    )
  }

  // One row for up to 15 days (7d, 14d), two rows of 15 for 30d
  const cols = Math.min(days.length, 15)
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(cols, 1)}, minmax(0, 1fr))` }}>
      {days.map((d) => (
        <div
          key={d.date}
          title={`${formatShortDate(d.date)} · ${HABIT_STATE_LABEL[d.state]}`}
          className={`aspect-square rounded-[3px] ${HABIT_STATE_CLASS[d.state]}`}
        />
      ))}
    </div>
  )
}

interface SparklineProps {
  values: (number | null)[]
  height?: number
}

/** Trend line through the days that have a value; gaps are bridged */
export const Sparkline = ({ values, height = 40 }: SparklineProps) => {
  const points = values
    .map((v, i) => (v === null ? null : { i, v }))
    .filter((p): p is { i: number; v: number } => p !== null)

  if (points.length === 0) return <div style={{ height }} />

  const lo = Math.min(...points.map((p) => p.v))
  const hi = Math.max(...points.map((p) => p.v))
  const span = values.length > 1 ? values.length - 1 : 1
  const x = (i: number) => (i / span) * 100
  const y = (v: number) => (hi > lo ? 90 - ((v - lo) / (hi - lo)) * 80 : 50)
  const d = points.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i)},${y(p.v)}`).join(' ')
  const showDots = points.length <= 20

  return (
    <div className="relative" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
        <path
          d={d}
          fill="none"
          className="stroke-primary-500"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* Dots as HTML so they stay round despite the stretched SVG */}
      {showDots &&
        points.map((p) => (
          <span
            key={p.i}
            className="absolute w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full bg-primary-500"
            style={{ left: `${x(p.i)}%`, top: `${y(p.v)}%` }}
          />
        ))}
    </div>
  )
}

interface RatingBarsProps {
  distribution: number[]
  height?: number
}

/** How often each score was given */
export const RatingBars = ({ distribution, height = 40 }: RatingBarsProps) => {
  const top = Math.max(1, ...distribution)
  const showLabels = distribution.length <= 10
  return (
    <div>
      <div className="flex items-end gap-1" style={{ height }}>
        {distribution.map((count, i) => (
          <div
            key={i}
            title={`${i + 1}: ${count} ${count === 1 ? 'time' : 'times'}`}
            className={`flex-1 rounded-t-sm ${count ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`}
            style={{ height: count ? `${Math.max(8, (count / top) * 100)}%` : 2 }}
          />
        ))}
      </div>
      {showLabels && (
        <div className="flex gap-1 mt-1 text-[10px] text-gray-400 dark:text-gray-500">
          {distribution.map((_, i) => (
            <span key={i} className="flex-1 text-center">{i + 1}</span>
          ))}
        </div>
      )}
    </div>
  )
}

interface ClockStripProps {
  minutes: (number | null)[]
  meanMinutes: number
}

/**
 * Each day's time as a dot on a strip centred on the average, so times either
 * side of midnight sit next to each other instead of at opposite ends.
 */
export const ClockStrip = ({ minutes, meanMinutes }: ClockStripProps) => {
  const offsets = minutes
    .filter((m): m is number => m !== null)
    .map((m) => circularDiff(m, meanMinutes))
  const furthest = Math.max(0, ...offsets.map(Math.abs))
  // Zoom to the data, in whole hours, between ±2h and ±12h
  const half = Math.min(720, Math.max(120, Math.ceil((furthest + 30) / 60) * 60))
  const position = (offset: number) => (offset + half) / (2 * half)

  // Labels on whole hours, skipping any too close to the edges to fit
  const step = half <= 180 ? 60 : half <= 360 ? 120 : 240
  const ticks: number[] = []
  for (let t = Math.ceil((meanMinutes - half) / step) * step; t <= meanMinutes + half; t += step) {
    const p = position(t - meanMinutes)
    if (p > 0.06 && p < 0.94) ticks.push(t)
  }

  return (
    <div>
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-px bg-gray-200 dark:bg-gray-700" />
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute top-1.5 bottom-1.5 w-px bg-gray-200 dark:bg-gray-700"
            style={{ left: `${position(t - meanMinutes) * 100}%` }}
          />
        ))}
        {offsets.map((o, i) => (
          <span
            key={i}
            className="absolute top-1/2 w-2 h-2 -ml-1 -mt-1 rounded-full bg-primary-500/70"
            style={{ left: `${position(o) * 100}%` }}
          />
        ))}
      </div>
      <div className="relative h-3 text-[10px] leading-3 text-gray-400 dark:text-gray-500">
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute -translate-x-1/2 tabular-nums"
            style={{ left: `${position(t - meanMinutes) * 100}%` }}
          >
            {formatMinutesOfDay(t)}
          </span>
        ))}
      </div>
    </div>
  )
}
