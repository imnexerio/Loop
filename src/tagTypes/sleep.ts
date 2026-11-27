/**
 * Sleep, built from a pair of Clock Time tags: one for bedtime ("Slept")
 * and one for wake-up ("Woke").
 *
 * Duration is wake-up minus bedtime. Each time is turned into a real instant
 * (date + clock time in the timezone it was logged in), so a night that
 * crosses midnight, a DST change or a timezone change still comes out right.
 *
 * Everything here is pure, like stats.ts.
 */

import { Session, Tag } from '../types'
import { ClockValue, isClockValue } from './registry'
import { SessionsByDate, circularDiff, circularMeanMinutes } from './stats'
import { addDaysToDateString, getCurrentTimezone, zonedTimeToEpoch } from '../utils/dateUtils'

const SLEPT_NAMES = ['slept', 'sleep', 'bedtime']
const WOKE_NAMES = ['woke', 'woke up', 'wake', 'wake up']

const MINUTE = 60_000
const HOUR = 60 * MINUTE
/** A bedtime more than this long before a wake-up is not the same sleep */
const MAX_SLEEP = 18 * HOUR

export interface SleepTags {
  slept: Tag
  woke: Tag
}

/** The Clock Time tags named like "Slept" and "Woke", if the user has both */
export function findSleepTags(tags: Tag[]): SleepTags | null {
  const find = (names: string[]) =>
    tags.find((t) => t.type === 'clocktime' && names.includes(t.name.trim().toLowerCase()))
  const slept = find(SLEPT_NAMES)
  const woke = find(WOKE_NAMES)
  return slept && woke ? { slept, woke } : null
}

export interface SleepNight {
  /** Unique per night */
  id: string
  /** Date of waking up (YYYY-MM-DD): the date the session is filed under */
  date: string
  sleepAt: number
  wakeAt: number
  /** Minutes asleep */
  duration: number
  /** Bedtime and wake-up as logged, in minutes since midnight */
  bedMinutes: number
  wakeMinutes: number
  /**
   * Bedtime and wake-up as minutes after 18:00 on the evening before `date`,
   * so a night can be drawn on one continuous axis without a cut at midnight
   */
  start: number
  end: number
}

/** A day with only one half of a night logged */
export interface SleepGap {
  date: string
  missing: 'slept' | 'woke'
}

interface ClockEvent {
  at: number
  minutes: number
  date: string
}

const timezoneOf = (value: ClockValue, session: Session) =>
  value.timezone || session.timezone || getCurrentTimezone()

const eventOn = (date: string, value: ClockValue, timezone: string): ClockEvent => ({
  at: zonedTimeToEpoch(date, value.hour, value.minute, timezone),
  minutes: value.hour * 60 + value.minute,
  date,
})

function makeNight(sleep: ClockEvent, wake: ClockEvent, date: string): SleepNight {
  const duration = Math.round((wake.at - sleep.at) / MINUTE)
  const end = wake.minutes >= 18 * 60 ? wake.minutes - 18 * 60 : wake.minutes + 6 * 60
  return {
    id: `${sleep.at}-${wake.at}`,
    date,
    sleepAt: sleep.at,
    wakeAt: wake.at,
    duration,
    bedMinutes: sleep.minutes,
    wakeMinutes: wake.minutes,
    start: end - duration,
    end,
  }
}

/**
 * Every night logged across the given dates, oldest first, plus the days
 * where only one half of a night was logged.
 *
 * Pairing:
 * - Slept and Woke in the same session are one night. A bedtime later than
 *   the wake-up time was the evening before.
 * - Otherwise a wake-up takes the latest unused bedtime from the 18 hours
 *   before it.
 */
export function buildSleepNights(
  tags: SleepTags,
  dates: string[],
  byDate: SessionsByDate,
  now: number = Date.now()
): { nights: SleepNight[]; gaps: SleepGap[] } {
  const nights = new Map<string, SleepNight>()
  const loneSlept: ClockEvent[] = []
  const loneWoke: ClockEvent[] = []

  const add = (night: SleepNight) => {
    if (night.duration > 0) nights.set(night.id, night)
  }

  for (const date of dates) {
    for (const session of byDate[date] ?? []) {
      const slept = session.tags?.[tags.slept.id]
      const woke = session.tags?.[tags.woke.id]
      const hasSlept = isClockValue(slept)
      const hasWoke = isClockValue(woke)

      if (hasSlept && hasWoke) {
        const wake = eventOn(date, woke, timezoneOf(woke, session))
        const sleptTz = timezoneOf(slept, session)
        let sleep = eventOn(date, slept, sleptTz)
        if (sleep.at >= wake.at) sleep = eventOn(addDaysToDateString(date, -1), slept, sleptTz)
        add(makeNight(sleep, wake, date))
      } else if (hasSlept || hasWoke) {
        const value = (hasSlept ? slept : woke) as ClockValue
        const tz = timezoneOf(value, session)
        let event = eventOn(date, value, tz)
        // A time can't be logged before it happens; if it's well after the
        // moment it was logged, it was the day before
        const loggedAt = parseInt(session.timestamp)
        if (Number.isFinite(loggedAt) && event.at > loggedAt + HOUR) {
          event = { ...eventOn(addDaysToDateString(date, -1), value, tz), date }
        }
        ;(hasSlept ? loneSlept : loneWoke).push(event)
      }
    }
  }

  // Pair the leftovers
  loneSlept.sort((a, b) => a.at - b.at)
  loneWoke.sort((a, b) => a.at - b.at)
  const used = new Set<number>()
  const gaps: SleepGap[] = []

  for (const wake of loneWoke) {
    let match = -1
    for (let i = 0; i < loneSlept.length; i++) {
      const s = loneSlept[i]
      if (s.at >= wake.at) break
      if (!used.has(i) && wake.at - s.at <= MAX_SLEEP) match = i
    }
    if (match === -1) {
      gaps.push({ date: wake.date, missing: 'slept' })
    } else {
      used.add(match)
      add(makeNight(loneSlept[match], wake, wake.date))
    }
  }
  loneSlept.forEach((s, i) => {
    // A recent bedtime with no wake-up yet is a night still in progress
    if (!used.has(i) && now - s.at > MAX_SLEEP) gaps.push({ date: s.date, missing: 'woke' })
  })

  return {
    nights: [...nights.values()].sort((a, b) => a.wakeAt - b.wakeAt),
    gaps: gaps.sort((a, b) => b.date.localeCompare(a.date)),
  }
}

export interface SleepSummary {
  count: number
  meanDuration: number | null
  shortest: SleepNight | null
  longest: SleepNight | null
  /** Minutes since midnight */
  meanBedtime: number | null
  /** Average distance from the mean bedtime, in minutes */
  bedtimeSpread: number | null
  meanWake: number | null
  wakeSpread: number | null
}

const spread = (minutes: number[], mean: number | null) =>
  mean === null ? null : minutes.reduce((s, m) => s + Math.abs(circularDiff(m, mean)), 0) / minutes.length

export function summarizeSleep(nights: SleepNight[]): SleepSummary {
  if (nights.length === 0) {
    return {
      count: 0, meanDuration: null, shortest: null, longest: null,
      meanBedtime: null, bedtimeSpread: null, meanWake: null, wakeSpread: null,
    }
  }
  const bed = nights.map((n) => n.bedMinutes)
  const wake = nights.map((n) => n.wakeMinutes)
  const meanBedtime = circularMeanMinutes(bed)
  const meanWake = circularMeanMinutes(wake)
  return {
    count: nights.length,
    meanDuration: nights.reduce((s, n) => s + n.duration, 0) / nights.length,
    shortest: nights.reduce((a, b) => (b.duration < a.duration ? b : a)),
    longest: nights.reduce((a, b) => (b.duration > a.duration ? b : a)),
    meanBedtime,
    bedtimeSpread: spread(bed, meanBedtime),
    meanWake,
    wakeSpread: spread(wake, meanWake),
  }
}

/** Average of each value and the ones before it, up to `size` values */
export function rollingAverage(values: number[], size = 7): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - size + 1), i + 1)
    return slice.reduce((s, v) => s + v, 0) / slice.length
  })
}

/** "7h20" — compact, for tight chart labels */
export const formatSleepCompact = (minutes: number) => {
  const m = Math.round(minutes)
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}
