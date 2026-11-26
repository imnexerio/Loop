/**
 * Per-type statistics derived from raw sessions.
 *
 * Everything here is pure: it takes a tag, a list of dates and the sessions
 * for those dates, and returns plain data that cards and detail views render.
 */

import { Session, Tag } from '../types'
import { getTagTypeMeta, getRatingMax, isClockValue } from './registry'
import { getCurrentTimezone, getDateInTimezone, getWeekdayOfDateString } from '../utils/dateUtils'

export type SessionsByDate = Record<string, Session[]>
export type AggregationType = 'average' | 'sum' | 'min' | 'max'

export interface Entry<T = unknown> {
  date: string
  timestamp: number
  timezone?: string
  value: T
}

// ============================================
// SHARED HELPERS
// ============================================

/** Valid values of a tag across the given dates, oldest first */
export function collectEntries(tag: Tag, dates: string[], byDate: SessionsByDate): Entry[] {
  const { isValue } = getTagTypeMeta(tag.type)
  const entries: Entry[] = []
  for (const date of dates) {
    const sessions = byDate[date]
    if (!sessions) continue
    for (const session of sessions) {
      const value = session.tags?.[tag.id]
      if (isValue(value)) {
        entries.push({ date, timestamp: parseInt(session.timestamp), timezone: session.timezone, value })
      }
    }
  }
  return entries.sort((a, b) => a.timestamp - b.timestamp)
}

function groupByDate<T>(entries: Entry<T>[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const e of entries) {
    const list = map.get(e.date)
    if (list) list.push(e.value)
    else map.set(e.date, [e.value])
  }
  return map
}

export function aggregate(values: number[], type: AggregationType): number {
  switch (type) {
    case 'sum':
      return values.reduce((s, v) => s + v, 0)
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
    case 'average':
    default:
      return values.reduce((s, v) => s + v, 0) / values.length
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Local date the tag was created, used so habits aren't penalised before they existed */
function tagStartDate(tag: Tag): string | null {
  const ms = Date.parse(tag.createdAt)
  return Number.isFinite(ms) ? getDateInTimezone(ms, getCurrentTimezone()) : null
}

// ============================================
// CLOCK MATH (circular, so 23:30 and 00:30 are 60 min apart)
// ============================================

const DAY_MINUTES = 1440

const normalizeMinutes = (m: number) => ((m % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES

/** Signed shortest distance from b to a, in minutes, in [-720, 720) */
export const circularDiff = (a: number, b: number) =>
  normalizeMinutes(a - b + DAY_MINUTES / 2) - DAY_MINUTES / 2

export function circularMeanMinutes(minutes: number[]): number | null {
  if (minutes.length === 0) return null
  let sin = 0
  let cos = 0
  for (const m of minutes) {
    const angle = (m / DAY_MINUTES) * 2 * Math.PI
    sin += Math.sin(angle)
    cos += Math.cos(angle)
  }
  // Perfectly opposed times have no meaningful mean; fall back to the first
  if (Math.hypot(sin, cos) < 1e-9) return minutes[0]
  return normalizeMinutes((Math.atan2(sin, cos) / (2 * Math.PI)) * DAY_MINUTES)
}

// ============================================
// INSIGHT TYPES
// ============================================

interface BaseInsight {
  tag: Tag
  /** Number of entries in the current window */
  count: number
  /** Most recent date with an entry in the current window */
  lastDate: string | null
}

export type HabitDayState = 'done' | 'missed' | 'today' | 'before'

export interface HabitInsight extends BaseInsight {
  kind: 'checkbox'
  days: { date: string; state: HabitDayState }[]
  doneDays: number
  /** Days that count toward the rate: after creation, excluding an unfinished today */
  eligibleDays: number
  rate: number | null
  currentStreak: number
  longestStreak: number
  weekdays: { weekday: number; done: number; total: number }[]
}

export interface NumericInsight extends BaseInsight {
  kind: 'number' | 'rating'
  /** Daily averages over the current window */
  series: { date: string; value: number | null }[]
  mean: number | null
  min: number | null
  max: number | null
  previousMean: number | null
  /** Ratings only: how many entries got each score, index 0 = score 1 */
  distribution: number[] | null
}

export interface ClockInsight extends BaseInsight {
  kind: 'clocktime'
  series: { date: string; minutes: number | null }[]
  meanMinutes: number | null
  /** Average distance from the mean time, in minutes */
  spreadMinutes: number | null
  previousMeanMinutes: number | null
}

export interface TextInsight extends BaseInsight {
  kind: 'text'
  /** Newest first */
  entries: Entry<string>[]
}

export type TagInsight = HabitInsight | NumericInsight | ClockInsight | TextInsight

export interface InsightWindow {
  /** Dates shown, oldest first, ending today */
  dates: string[]
  /** The equally long window just before `dates`, for comparisons and streaks */
  previousDates: string[]
  today: string
  byDate: SessionsByDate
}

// ============================================
// BUILDERS
// ============================================

export function numericDailySeries(
  tag: Tag,
  dates: string[],
  byDate: SessionsByDate,
  type: AggregationType = 'average'
): { date: string; value: number | null }[] {
  const perDay = groupByDate(collectEntries(tag, dates, byDate) as Entry<number>[])
  return dates.map((date) => {
    const values = perDay.get(date)
    return { date, value: values ? round2(aggregate(values, type)) : null }
  })
}

function buildNumeric(tag: Tag, w: InsightWindow, base: BaseInsight): NumericInsight {
  const values = (collectEntries(tag, w.dates, w.byDate) as Entry<number>[]).map((e) => e.value)
  const previous = (collectEntries(tag, w.previousDates, w.byDate) as Entry<number>[]).map((e) => e.value)

  let distribution: number[] | null = null
  if (tag.type === 'rating') {
    const max = getRatingMax(tag)
    distribution = Array.from({ length: max }, () => 0)
    for (const v of values) {
      const i = Math.min(max, Math.max(1, Math.round(v))) - 1
      distribution[i]++
    }
  }

  return {
    ...base,
    kind: tag.type as 'number' | 'rating',
    series: numericDailySeries(tag, w.dates, w.byDate),
    mean: values.length ? round2(aggregate(values, 'average')) : null,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    previousMean: previous.length ? round2(aggregate(previous, 'average')) : null,
    distribution,
  }
}

function buildHabit(tag: Tag, w: InsightWindow, base: BaseInsight): HabitInsight {
  const allDates = [...w.previousDates, ...w.dates]
  const perDay = groupByDate(collectEntries(tag, allDates, w.byDate) as Entry<boolean>[])
  const isDone = (date: string) => perDay.get(date)?.some(Boolean) ?? false

  // Treat the tag as starting on its creation day, or earlier if it has older entries
  let start = tagStartDate(tag)
  for (const date of perDay.keys()) {
    if (!start || date < start) start = date
  }

  const stateOf = (date: string): HabitDayState => {
    if (isDone(date)) return 'done'
    if (date === w.today) return 'today'
    if (start && date < start) return 'before'
    return 'missed'
  }

  const days = w.dates.map((date) => ({ date, state: stateOf(date) }))
  const doneDays = days.filter((d) => d.state === 'done').length
  const eligibleDays = days.filter((d) => d.state === 'done' || d.state === 'missed').length

  // Current streak: an unfinished today doesn't break it
  let currentStreak = 0
  for (let i = allDates.length - 1; i >= 0; i--) {
    const date = allDates[i]
    if (isDone(date)) currentStreak++
    else if (date === w.today) continue
    else break
  }

  let longestStreak = 0
  let run = 0
  for (const d of days) {
    run = d.state === 'done' ? run + 1 : d.state === 'today' ? run : 0
    longestStreak = Math.max(longestStreak, run)
  }

  const weekdays = Array.from({ length: 7 }, (_, weekday) => ({ weekday, done: 0, total: 0 }))
  for (const d of days) {
    if (d.state !== 'done' && d.state !== 'missed') continue
    const wd = weekdays[getWeekdayOfDateString(d.date)]
    wd.total++
    if (d.state === 'done') wd.done++
  }

  return {
    ...base,
    kind: 'checkbox',
    days,
    doneDays,
    eligibleDays,
    rate: eligibleDays > 0 ? doneDays / eligibleDays : null,
    currentStreak,
    longestStreak,
    weekdays,
  }
}

const toMinutes = (e: Entry) => (isClockValue(e.value) ? e.value.hour * 60 + e.value.minute : 0)

function buildClock(tag: Tag, w: InsightWindow, base: BaseInsight): ClockInsight {
  const entries = collectEntries(tag, w.dates, w.byDate)
  const minutes = entries.map(toMinutes)
  const meanMinutes = circularMeanMinutes(minutes)

  const perDay = new Map<string, number[]>()
  entries.forEach((e, i) => {
    const list = perDay.get(e.date)
    if (list) list.push(minutes[i])
    else perDay.set(e.date, [minutes[i]])
  })

  const spreadMinutes =
    meanMinutes === null
      ? null
      : minutes.reduce((s, m) => s + Math.abs(circularDiff(m, meanMinutes)), 0) / minutes.length

  return {
    ...base,
    kind: 'clocktime',
    series: w.dates.map((date) => {
      const day = perDay.get(date)
      return { date, minutes: day ? circularMeanMinutes(day) : null }
    }),
    meanMinutes,
    spreadMinutes,
    previousMeanMinutes: circularMeanMinutes(collectEntries(tag, w.previousDates, w.byDate).map(toMinutes)),
  }
}

function buildText(tag: Tag, w: InsightWindow, base: BaseInsight): TextInsight {
  const entries = (collectEntries(tag, w.dates, w.byDate) as Entry<string>[]).reverse()
  return { ...base, kind: 'text', entries }
}

export function buildInsight(tag: Tag, w: InsightWindow): TagInsight {
  const current = collectEntries(tag, w.dates, w.byDate)
  // A checkbox left unticked is stored as false; it isn't real use of the tag
  const used = tag.type === 'checkbox' ? current.filter((e) => e.value === true) : current
  const base: BaseInsight = {
    tag,
    count: used.length,
    lastDate: used.length ? used[used.length - 1].date : null,
  }

  switch (tag.type) {
    case 'checkbox':
      return buildHabit(tag, w, base)
    case 'clocktime':
      return buildClock(tag, w, base)
    case 'text':
      return buildText(tag, w, base)
    case 'number':
    case 'rating':
    default:
      return buildNumeric(tag, w, base)
  }
}
