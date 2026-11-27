import { useCallback, useMemo, useState } from 'react'
import { Tag } from '../../types'
import { useSessionsInRange } from '../../hooks/useSessionsInRange'
import { buildInsight, InsightWindow, TagInsight } from '../../tagTypes/stats'
import { buildSleepNights, findSleepTags } from '../../tagTypes/sleep'
import { TAG_TYPE_ORDER, getTagTypeMeta } from '../../tagTypes/registry'
import { formatShortDate } from '../../tagTypes/format'
import { addDaysToDateString, listDatesBetween } from '../../utils/dateUtils'
import TagCard from './TagCard'
import TagDetail from './TagDetail'
import SleepCard from './SleepCard'
import SleepDetail from './SleepDetail'
import { Segmented } from './details'
import { InsightsPrefs, MAX_HISTORY_DAYS, RANGE_OPTIONS, TypeFilter } from './prefs'

interface InsightsSectionProps {
  tags: Tag[]
  today: string
  prefs: InsightsPrefs
  onPrefsChange: (patch: Partial<InsightsPrefs>) => void
  onSelectDate: (date: string) => void
  onOpenProfile: () => void
}

/** Pinned first (in pin order), then most used, then most recent, then name */
function sortInsights(insights: TagInsight[], pinned: string[]) {
  const pinIndex = (id: string) => {
    const i = pinned.indexOf(id)
    return i === -1 ? Infinity : i
  }
  return [...insights].sort(
    (a, b) =>
      pinIndex(a.tag.id) - pinIndex(b.tag.id) ||
      b.count - a.count ||
      (b.lastDate ?? '').localeCompare(a.lastDate ?? '') ||
      a.tag.name.localeCompare(b.tag.name)
  )
}

const InsightsSection = ({ tags, today, prefs, onPrefsChange, onSelectDate, onOpenProfile }: InsightsSectionProps) => {
  const { range, pinned } = prefs
  const [filter, setFilter] = useState<TypeFilter>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [detailTagId, setDetailTagId] = useState<string | null>(null)
  const [sleepOpen, setSleepOpen] = useState(false)

  // Fetch twice the range so cards can compare with the previous period
  // (capped at the history the app keeps)
  const fetchStart = addDaysToDateString(today, -(Math.min(range * 2, MAX_HISTORY_DAYS) - 1))
  const { byDate, loading, hasData } = useSessionsInRange(fetchStart, today)

  const insightWindow = useMemo<InsightWindow>(() => {
    const windowStart = addDaysToDateString(today, -(range - 1))
    return {
      dates: listDatesBetween(windowStart, today),
      previousDates: listDatesBetween(fetchStart, addDaysToDateString(windowStart, -1)),
      today,
      byDate,
    }
  }, [today, range, fetchStart, byDate])

  const insights = useMemo(() => tags.map((tag) => buildInsight(tag, insightWindow)), [tags, insightWindow])

  // Slept + Woke tags, shown together as nights of sleep
  const sleepTags = useMemo(() => findSleepTags(tags), [tags])
  const sleep = useMemo(() => {
    if (!sleepTags) return null
    const { dates, previousDates, byDate: days } = insightWindow
    const { nights } = buildSleepNights(sleepTags, [...previousDates, ...dates], days)
    const windowStart = dates[0]
    return {
      nights: nights.filter((n) => n.date >= windowStart),
      previousNights: nights.filter((n) => n.date < windowStart),
    }
  }, [sleepTags, insightWindow])

  // Only offer filters for tag types this user actually has
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    tags.forEach((t) => counts.set(t.type, (counts.get(t.type) ?? 0) + 1))
    return counts
  }, [tags])
  const presentTypes = TAG_TYPE_ORDER.filter((t) => typeCounts.has(t))
  const activeFilter: TypeFilter = filter !== 'all' && typeCounts.has(filter) ? filter : 'all'

  const { active, inactive } = useMemo(() => {
    const visible = insights.filter((i) => activeFilter === 'all' || i.tag.type === activeFilter)
    const sorted = sortInsights(visible, pinned)
    return {
      active: sorted.filter((i) => i.count > 0 || pinned.includes(i.tag.id)),
      inactive: sorted.filter((i) => i.count === 0 && !pinned.includes(i.tag.id)),
    }
  }, [insights, activeFilter, pinned])

  const togglePin = useCallback(
    (tagId: string) => {
      onPrefsChange({
        pinned: pinned.includes(tagId) ? pinned.filter((id) => id !== tagId) : [...pinned, tagId],
      })
    },
    [pinned, onPrefsChange]
  )

  const closeDetail = useCallback(() => setDetailTagId(null), [])
  const closeSleep = useCallback(() => setSleepOpen(false), [])
  const showSleep = sleepTags !== null && sleep !== null && (activeFilter === 'all' || activeFilter === 'clocktime')
  const detailInsight = detailTagId ? insights.find((i) => i.tag.id === detailTagId) : undefined

  if (tags.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center shadow-md border border-gray-200 dark:border-gray-700">
        <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">No tags yet</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Tags are what you track in each session: habits, numbers, ratings, times or notes.
        </p>
        <button
          type="button"
          onClick={onOpenProfile}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Create a tag
        </button>
      </div>
    )
  }

  return (
    <section aria-labelledby="insights-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="insights-title" className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
          Insights
        </h3>
        <Segmented
          label="Date range"
          value={range}
          onChange={(r) => onPrefsChange({ range: r })}
          options={RANGE_OPTIONS}
        />
      </div>

      {presentTypes.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="group" aria-label="Filter by tag type">
          {(['all', ...presentTypes] as TypeFilter[]).map((t) => {
            const label = t === 'all' ? 'All' : getTagTypeMeta(t).groupLabel
            const count = t === 'all' ? tags.length : typeCounts.get(t)
            const selected = activeFilter === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setFilter(t)}
                aria-pressed={selected}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selected
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-primary-500/60'
                }`}
              >
                {t !== 'all' && <span className="mr-1" aria-hidden>{getTagTypeMeta(t).icon}</span>}
                {label}
                <span className={`ml-1.5 text-xs ${selected ? 'text-white/80' : 'text-gray-400 dark:text-gray-500'}`}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {loading && !hasData ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: Math.min(Math.max(tags.length, 1), 6) }, (_, i) => (
            <div key={i} className="h-40 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {active.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {showSleep && (
                <SleepCard
                  tags={sleepTags}
                  nights={sleep.nights}
                  previousNights={sleep.previousNights}
                  rangeDays={range}
                  onOpen={() => setSleepOpen(true)}
                />
              )}
              {active.map((insight) => (
                <TagCard
                  key={insight.tag.id}
                  insight={insight}
                  rangeDays={range}
                  pinned={pinned.includes(insight.tag.id)}
                  onTogglePin={() => togglePin(insight.tag.id)}
                  onOpen={() => setDetailTagId(insight.tag.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
              None of these tags were used in the last {range} days.
            </p>
          )}

          {inactive.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setShowInactive((v) => !v)}
                aria-expanded={showInactive}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300"
              >
                <span>Not used in the last {range} days ({inactive.length})</span>
                <svg className={`w-4 h-4 transition-transform ${showInactive ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showInactive && (
                <ul className="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                  {inactive.map(({ tag }) => (
                    <li key={tag.id}>
                      <button
                        type="button"
                        onClick={() => setDetailTagId(tag.id)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40"
                      >
                        <span aria-hidden>{getTagTypeMeta(tag.type).icon}</span>
                        <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">{tag.name}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {getTagTypeMeta(tag.type).label} · added {formatShortDate(tag.createdAt.slice(0, 10))}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {sleepOpen && sleepTags && (
        <SleepDetail
          tags={sleepTags}
          today={today}
          range={prefs.sleepRange}
          onRangeChange={(r) => onPrefsChange({ sleepRange: r })}
          onSelectDate={onSelectDate}
          onClose={closeSleep}
        />
      )}

      {detailInsight && (
        <TagDetail
          insight={detailInsight}
          dates={insightWindow.dates}
          byDate={byDate}
          range={range}
          chartType={prefs.chartType}
          aggregation={prefs.aggregation}
          onRangeChange={(r) => onPrefsChange({ range: r })}
          onChartTypeChange={(t) => onPrefsChange({ chartType: t })}
          onAggregationChange={(a) => onPrefsChange({ aggregation: a })}
          onSelectDate={onSelectDate}
          onClose={closeDetail}
        />
      )}
    </section>
  )
}

export default InsightsSection
