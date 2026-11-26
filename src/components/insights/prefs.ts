import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import type { AggregationType } from '../../tagTypes/stats'
import type { TagType } from '../../types'
import type { ChartType } from './details'

export type RangeDays = 7 | 30 | 90

export const RANGE_OPTIONS: { value: RangeDays; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
]

export type TypeFilter = TagType | 'all'

export interface InsightsPrefs {
  range: RangeDays
  pinned: string[]
  chartType: ChartType
  aggregation: AggregationType
  /** Tag used to color the calendar, or null for plain session dots */
  calendarColorBy: string | null
}

const DEFAULTS: InsightsPrefs = {
  range: 30,
  pinned: [],
  chartType: 'line',
  aggregation: 'average',
  calendarColorBy: null,
}

const key = (uid: string) => `insightsPrefs_${uid}`

const oneOf = <T,>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

export function loadInsightsPrefs(uid: string | undefined): InsightsPrefs {
  if (!uid) return DEFAULTS
  try {
    const raw = JSON.parse(localStorage.getItem(key(uid)) || '{}')
    return {
      range: oneOf(raw.range, [7, 30, 90] as const, DEFAULTS.range),
      pinned: Array.isArray(raw.pinned) ? raw.pinned.filter((id: unknown) => typeof id === 'string') : [],
      chartType: oneOf(raw.chartType, ['line', 'bar', 'area'] as const, DEFAULTS.chartType),
      aggregation: oneOf(raw.aggregation, ['average', 'sum', 'min', 'max'] as const, DEFAULTS.aggregation),
      calendarColorBy: typeof raw.calendarColorBy === 'string' ? raw.calendarColorBy : null,
    }
  } catch {
    return DEFAULTS
  }
}

export function saveInsightsPrefs(uid: string | undefined, prefs: InsightsPrefs) {
  if (!uid) return
  try {
    localStorage.setItem(key(uid), JSON.stringify(prefs))
  } catch (error) {
    console.error('Error saving insights preferences:', error)
  }
}

/** Insights preferences for the signed-in user, persisted to localStorage */
export function useInsightsPrefs() {
  const { currentUser } = useAuth()
  const uid = currentUser?.uid
  const [prefs, setPrefs] = useState(() => loadInsightsPrefs(uid))

  useEffect(() => {
    saveInsightsPrefs(uid, prefs)
  }, [uid, prefs])

  const updatePrefs = useCallback((patch: Partial<InsightsPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }))
  }, [])

  return [prefs, updatePrefs] as const
}
