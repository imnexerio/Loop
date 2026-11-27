import { useLayoutEffect, useMemo, useRef } from 'react'
import { SleepNight, formatSleepCompact, rollingAverage } from '../../tagTypes/sleep'
import { formatMinutesOfDay } from '../../tagTypes/registry'
import { formatShortDate } from '../../tagTypes/format'
import { getWeekdayOfDateString } from '../../utils/dateUtils'

interface SleepChartProps {
  nights: SleepNight[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Fit the axis to the nights shown instead of a full 24 hours */
  zoom: boolean
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Fixed width per night so every column has room for its labels
const COL_W = 42
const BAR_W = 18
const AXIS_W = 46
const TOP = 22
const BOTTOM = 58

// Fill and line colors (light / dark)
const BAR = 'fill-[#257de0] dark:fill-[#338ced]'
const BED_LINE = 'stroke-[#f47230] dark:stroke-[#e76624]'
const WAKE_LINE = 'stroke-[#00b894] dark:stroke-[#00a888]'
const TEXT = 'fill-gray-500 dark:fill-gray-400'
const TEXT_STRONG = 'fill-gray-900 dark:fill-white font-semibold'
// Outline in the surface color, so labels stay readable over grid lines and averages
const HALO = 'stroke-white dark:stroke-gray-800'

/** Minutes after 18:00 the evening before → clock time */
const axisClock = (m: number) => formatMinutesOfDay(m + 18 * 60)

/**
 * One bar per night from bedtime to wake-up, on an axis that runs from the
 * evening before so nights aren't cut at midnight. Bedtime sits above each
 * bar, wake-up below it, and the hours slept, weekday and date under each
 * column. Lines show the 7-night average bedtime and wake-up.
 * Scrolls sideways; opens on the newest night.
 */
const SleepChart = ({ nights, selectedId, onSelect, zoom }: SleepChartProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)

  const layout = useMemo(() => {
    const height = zoom ? 340 : 440
    const plot = height - TOP - BOTTOM
    let lo: number
    let hi: number
    if (zoom) {
      lo = Math.floor((Math.min(...nights.map((n) => n.start)) - 45) / 60) * 60
      hi = Math.ceil((Math.max(...nights.map((n) => n.end)) + 45) / 60) * 60
    } else {
      // 18:00 to 18:00, stretched only if a night falls outside it
      lo = Math.min(0, Math.floor(Math.min(...nights.map((n) => n.start)) / 60) * 60)
      hi = Math.max(1440, Math.ceil(Math.max(...nights.map((n) => n.end)) / 60) * 60)
    }
    const step = zoom ? (hi - lo > 720 ? 120 : 60) : 180
    const ticks: number[] = []
    for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t)
    const y = (m: number) => TOP + ((m - lo) / (hi - lo)) * plot
    return { height, ticks, y, width: nights.length * COL_W + 8 }
  }, [nights, zoom])

  const bedAvg = useMemo(() => rollingAverage(nights.map((n) => n.start)), [nights])
  const wakeAvg = useMemo(() => rollingAverage(nights.map((n) => n.end)), [nights])

  // Open on the newest night whenever the set of nights changes
  const rangeKey = `${nights.length}|${nights[0]?.id}|${nights[nights.length - 1]?.id}`
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [rangeKey])

  if (nights.length === 0) return null

  const { height, ticks, y, width } = layout
  const x = (i: number) => 4 + COL_W * (i + 0.5)
  const midnight = 6 * 60
  const path = (values: number[]) => values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')
  const base = height - BOTTOM

  return (
    <div className="flex min-w-0">
      {/* Time axis stays put while the nights scroll */}
      <svg width={AXIS_W} height={height} className="shrink-0" aria-hidden>
        {ticks.map((t) => (
          <text key={t} x={AXIS_W - 6} y={y(t) + 4} textAnchor="end" className={`${TEXT} text-[10px] tabular-nums`}>
            {axisClock(t)}
          </text>
        ))}
      </svg>

      <div ref={scrollRef} className="flex-1 min-w-0 overflow-x-auto overscroll-x-contain">
        <svg width={width} height={height} role="group" aria-label="Sleep per night" className="block">
          {/* Fri and Sat nights (waking on Sat or Sun) */}
          {nights.map((n, i) => {
            const wd = getWeekdayOfDateString(n.date)
            return wd === 0 || wd === 6 ? (
              <rect key={n.id} x={x(i) - COL_W / 2} y={0} width={COL_W} height={height} className="fill-gray-100 dark:fill-gray-700/60" />
            ) : null
          })}

          {ticks.map((t) => (
            <line
              key={t}
              x1={0}
              x2={width}
              y1={y(t)}
              y2={y(t)}
              strokeDasharray={t === midnight ? '3 3' : undefined}
              className={t === midnight ? 'stroke-gray-400 dark:stroke-gray-500' : 'stroke-gray-200 dark:stroke-gray-700'}
            />
          ))}

          {nights.map((n, i) => (
            <rect
              key={n.id}
              x={x(i) - BAR_W / 2}
              y={y(n.start)}
              width={BAR_W}
              height={Math.max(2, y(n.end) - y(n.start))}
              rx={4}
              className={BAR}
              fillOpacity={n.id === selectedId ? 1 : 0.55}
            />
          ))}

          {nights.length > 1 && (
            <>
              <path d={path(bedAvg)} fill="none" strokeWidth={2} strokeLinejoin="round" className={BED_LINE} />
              <path d={path(wakeAvg)} fill="none" strokeWidth={2} strokeLinejoin="round" className={WAKE_LINE} />
            </>
          )}

          {nights.map((n, i) => {
            const selected = n.id === selectedId
            const label = `${selected ? TEXT_STRONG : TEXT} text-[10px] tabular-nums`
            const wd = getWeekdayOfDateString(n.date)
            const day = Number(n.date.slice(8))
            const showMonth = i === 0 || day === 1
            return (
              <g key={n.id}>
                <text x={x(i)} y={y(n.start) - 6} textAnchor="middle" strokeWidth={3} strokeLinejoin="round" style={{ paintOrder: 'stroke' }} className={`${label} ${HALO}`}>
                  {formatMinutesOfDay(n.bedMinutes)}
                </text>
                <text x={x(i)} y={y(n.end) + 13} textAnchor="middle" strokeWidth={3} strokeLinejoin="round" style={{ paintOrder: 'stroke' }} className={`${label} ${HALO}`}>
                  {formatMinutesOfDay(n.wakeMinutes)}
                </text>
                <text x={x(i)} y={base + 18} textAnchor="middle" className="fill-gray-900 dark:fill-white text-[11px] font-semibold tabular-nums">
                  {formatSleepCompact(n.duration)}
                </text>
                <text x={x(i)} y={base + 34} textAnchor="middle" className={label}>
                  {WEEKDAYS[wd]}
                </text>
                <text x={x(i)} y={base + 48} textAnchor="middle" className={label}>
                  {showMonth ? formatShortDate(n.date) : day}
                </text>
              </g>
            )
          })}

          {/* Tap targets: the whole column */}
          {nights.map((n, i) => (
            <rect
              key={n.id}
              x={x(i) - COL_W / 2}
              y={0}
              width={COL_W}
              height={height}
              fill="transparent"
              role="button"
              tabIndex={0}
              aria-pressed={n.id === selectedId}
              aria-label={`${formatShortDate(n.date)}: slept ${formatMinutesOfDay(n.bedMinutes)}, woke ${formatMinutesOfDay(n.wakeMinutes)}, ${formatSleepCompact(n.duration)}`}
              className="cursor-pointer outline-none focus-visible:stroke-primary-500 focus-visible:[stroke-width:2]"
              onClick={() => onSelect(n.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(n.id)
                }
              }}
            >
              <title>
                {`${formatShortDate(n.date)} · ${formatMinutesOfDay(n.bedMinutes)} → ${formatMinutesOfDay(n.wakeMinutes)} · ${formatSleepCompact(n.duration)}`}
              </title>
            </rect>
          ))}
        </svg>
      </div>
    </div>
  )
}

export default SleepChart
