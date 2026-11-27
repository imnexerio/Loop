/**
 * Full views for one tag, one per tag type. Opened from an insight card.
 */

import { useMemo, useState, type ReactNode } from 'react'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  HabitInsight, NumericInsight, ClockInsight, TextInsight,
  AggregationType, SessionsByDate, numericDailySeries, circularDiff,
} from '../../tagTypes/stats'
import { formatMinutesOfDay, getRatingMax } from '../../tagTypes/registry'
import { formatDuration, formatNumber, formatPercent, formatShortDate } from '../../tagTypes/format'
import { formatTimeInTimezone } from '../../utils/dateUtils'
import { HabitGrid, RatingBars } from './visuals'

export type ChartType = 'line' | 'bar' | 'area'

const CHART_COLOR = '#22c55e'
const AXIS_COLOR = '#9ca3af'

// ============================================
// SHARED PIECES
// ============================================

export const StatTile = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="rounded-xl bg-gray-50 dark:bg-gray-700/40 p-3">
    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{value}</p>
    {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
  </div>
)

export const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{children}</h4>
)

interface Option<T> { value: T; label: string }

export function Segmented<T extends string | number>({ options, value, onChange, label }: {
  options: Option<T>[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
            value === o.value
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface ChartTooltipProps {
  format: (value: number) => string
  // Filled in by Recharts
  active?: boolean
  payload?: { value?: unknown }[]
  label?: unknown
}

const ChartTooltip = ({ format, active, payload, label }: ChartTooltipProps) => {
  const value = payload?.[0]?.value
  if (!active || typeof value !== 'number') return null
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-500 dark:text-gray-400">{typeof label === 'string' ? formatShortDate(label) : ''}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{format(value)}</p>
    </div>
  )
}

// ============================================
// HABITS (checkbox)
// ============================================

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const HabitDetail = ({ insight }: { insight: HabitInsight }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatTile label="Current streak" value={`${insight.currentStreak}d`} />
      <StatTile label="Longest streak" value={`${insight.longestStreak}d`} hint="in this period" />
      <StatTile label="Completion" value={insight.rate !== null ? formatPercent(insight.rate) : '–'} />
      <StatTile label="Days done" value={`${insight.doneDays}/${insight.eligibleDays}`} />
    </div>

    <div>
      <SectionTitle>Every day</SectionTitle>
      <HabitGrid days={insight.days} variant="calendar" />
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px] bg-primary-500" /> Done</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px] bg-gray-200 dark:bg-gray-700" /> Not done</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px] border border-dashed border-primary-500" /> Today</span>
      </div>
    </div>

    <div>
      <SectionTitle>By weekday</SectionTitle>
      <div className="space-y-2">
        {insight.weekdays.map((w) => {
          const rate = w.total ? w.done / w.total : null
          return (
            <div key={w.weekday} className="flex items-center gap-3 text-sm">
              <span className="w-9 text-gray-500 dark:text-gray-400">{WEEKDAYS[w.weekday]}</span>
              <div className="flex-1 h-2.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div className="h-full rounded-full bg-primary-500" style={{ width: `${(rate ?? 0) * 100}%` }} />
              </div>
              <span className="w-16 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {rate !== null ? `${w.done}/${w.total}` : '–'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  </div>
)

// ============================================
// NUMBERS & RATINGS
// ============================================

interface NumericDetailProps {
  insight: NumericInsight
  dates: string[]
  byDate: SessionsByDate
  chartType: ChartType
  aggregation: AggregationType
  onChartTypeChange: (t: ChartType) => void
  onAggregationChange: (a: AggregationType) => void
}

export const NumericDetail = ({
  insight, dates, byDate, chartType, aggregation, onChartTypeChange, onAggregationChange,
}: NumericDetailProps) => {
  const { tag } = insight
  const unit = insight.kind === 'rating' ? `/${getRatingMax(tag)}` : tag.config?.unit ? ` ${tag.config.unit}` : ''
  const fmt = (v: number) => `${formatNumber(v)}${unit}`

  const data = useMemo(
    () => numericDailySeries(tag, dates, byDate, aggregation),
    [tag, dates, byDate, aggregation]
  )

  // Ratings get a fixed 0..max scale in even steps, unless summed (which can exceed max)
  let ratingTicks: number[] | undefined
  if (insight.kind === 'rating' && aggregation !== 'sum') {
    const max = getRatingMax(tag)
    const step = max <= 5 ? 1 : max <= 10 ? 2 : Math.ceil(max / 5)
    ratingTicks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step)
    if (ratingTicks[ratingTicks.length - 1] !== max) ratingTicks.push(max)
  }

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLOR} opacity={0.2} />
      <XAxis dataKey="date" tickFormatter={formatShortDate} stroke={AXIS_COLOR} style={{ fontSize: 12 }} minTickGap={24} />
      <YAxis
        stroke={AXIS_COLOR}
        style={{ fontSize: 12 }}
        width={40}
        domain={ratingTicks ? [0, getRatingMax(tag)] : ['auto', 'auto']}
        ticks={ratingTicks}
        allowDecimals={!ratingTicks}
      />
      <Tooltip content={<ChartTooltip format={fmt} />} />
    </>
  )

  const margin = { top: 5, right: 10, left: -10, bottom: 5 }
  const chart =
    chartType === 'bar' ? (
      <BarChart data={data} margin={margin}>
        {axes}
        <Bar dataKey="value" fill={CHART_COLOR} radius={[3, 3, 0, 0]} />
      </BarChart>
    ) : chartType === 'area' ? (
      <AreaChart data={data} margin={margin}>
        {axes}
        <Area type="monotone" dataKey="value" stroke={CHART_COLOR} fill={CHART_COLOR} fillOpacity={0.25} connectNulls />
      </AreaChart>
    ) : (
      <LineChart data={data} margin={margin}>
        {axes}
        <Line type="monotone" dataKey="value" stroke={CHART_COLOR} strokeWidth={2} dot={{ r: 3, fill: CHART_COLOR }} connectNulls />
      </LineChart>
    )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Average" value={insight.mean !== null ? fmt(insight.mean) : '–'} />
        <StatTile label="Lowest" value={insight.min !== null ? fmt(insight.min) : '–'} />
        <StatTile label="Highest" value={insight.max !== null ? fmt(insight.max) : '–'} />
        <StatTile
          label="Previous period"
          value={insight.previousMean !== null ? fmt(insight.previousMean) : '–'}
          hint="average"
        />
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <SectionTitle>Over time</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Segmented
              label="Chart type"
              value={chartType}
              onChange={onChartTypeChange}
              options={[{ value: 'line', label: 'Line' }, { value: 'bar', label: 'Bar' }, { value: 'area', label: 'Area' }]}
            />
            <select
              value={aggregation}
              onChange={(e) => onAggregationChange(e.target.value as AggregationType)}
              aria-label="Combine multiple entries per day"
              className="px-2 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-hidden"
            >
              <option value="average">Daily average</option>
              <option value="sum">Daily total</option>
              <option value="min">Daily lowest</option>
              <option value="max">Daily highest</option>
            </select>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer>
        </div>
      </div>

      {insight.distribution && (
        <div>
          <SectionTitle>How often each score was given</SectionTitle>
          <RatingBars distribution={insight.distribution} height={96} />
        </div>
      )}
    </div>
  )
}

// ============================================
// CLOCK TIMES
// ============================================

export const ClockDetail = ({ insight }: { insight: ClockInsight }) => {
  const mean = insight.meanMinutes

  // Plot times relative to the average so values either side of midnight stay together
  const { data, domain, ticks, earliest, latest } = useMemo(() => {
    if (mean === null) return { data: [], domain: [0, 1440], ticks: [], earliest: null, latest: null }
    const offsets = insight.series.map((p) => (p.minutes === null ? null : circularDiff(p.minutes, mean)))
    const present = offsets.filter((o): o is number => o !== null)
    const furthest = Math.max(0, ...present.map(Math.abs))
    const half = Math.min(720, Math.max(120, Math.ceil((furthest + 30) / 60) * 60))
    const step = half <= 180 ? 60 : half <= 360 ? 120 : 240
    const lo = mean - half
    const hi = mean + half
    const ticks: number[] = []
    for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t)
    return {
      data: insight.series.map((p, i) => ({ date: p.date, value: offsets[i] === null ? null : mean + offsets[i]! })),
      domain: [lo, hi],
      ticks,
      earliest: present.length ? mean + Math.min(...present) : null,
      latest: present.length ? mean + Math.max(...present) : null,
    }
  }, [insight.series, mean])

  if (mean === null) return null

  let shift = '–'
  if (insight.previousMeanMinutes !== null) {
    const diff = circularDiff(mean, insight.previousMeanMinutes)
    shift = Math.abs(diff) < 1 ? 'No change' : `${formatDuration(diff)} ${diff > 0 ? 'later' : 'earlier'}`
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Average time" value={formatMinutesOfDay(mean)} />
        <StatTile
          label="Consistency"
          value={insight.spreadMinutes !== null ? `± ${formatDuration(insight.spreadMinutes)}` : '–'}
          hint="from the average"
        />
        <StatTile
          label="Range"
          value={earliest !== null && latest !== null ? `${formatMinutesOfDay(earliest)}–${formatMinutesOfDay(latest)}` : '–'}
        />
        <StatTile label="vs previous period" value={shift} />
      </div>

      <div>
        <SectionTitle>Over time</SectionTitle>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLOR} opacity={0.2} />
              <XAxis dataKey="date" tickFormatter={formatShortDate} stroke={AXIS_COLOR} style={{ fontSize: 12 }} minTickGap={24} />
              <YAxis
                domain={domain}
                ticks={ticks}
                tickFormatter={formatMinutesOfDay}
                stroke={AXIS_COLOR}
                style={{ fontSize: 12 }}
                width={48}
                allowDataOverflow
              />
              <Tooltip content={<ChartTooltip format={formatMinutesOfDay} />} />
              <Line type="monotone" dataKey="value" stroke={CHART_COLOR} strokeWidth={2} dot={{ r: 3, fill: CHART_COLOR }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ============================================
// NOTES (text)
// ============================================

export const TextDetail = ({ insight, onSelectDate }: { insight: TextInsight; onSelectDate: (date: string) => void }) => {
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const entries = q ? insight.entries.filter((e) => e.value.toLowerCase().includes(q)) : insight.entries

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Search ${insight.count} ${insight.count === 1 ? 'entry' : 'entries'}`}
        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-hidden"
      />

      {entries.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
          {q ? 'No entries match your search' : 'No entries in this period'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {entries.map((e) => (
            <li key={`${e.timestamp}`} className="py-3">
              <button
                type="button"
                onClick={() => onSelectDate(e.date)}
                className="text-xs font-medium text-primary-600 dark:text-primary-500 hover:underline"
              >
                {formatShortDate(e.date)} · {formatTimeInTimezone(e.timestamp, e.timezone)}
              </button>
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap mt-0.5">{e.value}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
