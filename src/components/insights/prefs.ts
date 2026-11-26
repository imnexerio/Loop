import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import type { AggregationType } from '../../tagTypes/stats'
import type { TagType } from '../../types'
import type { ChartType } from './details'

/** The app keeps at most this many days of history */
export const MAX_HISTORY_DAYS = 60

export type RangeDays = 7 | 14 | 30

export const RANGE_OPTIONS: { value: RangeDays; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
]

export type TypeFilter = TagType | 'all'

export interface InsightsPrefs {
  range: RangeDays
  pinned: string[]
  chartType: ChartType
  aggregation: AggregationType
}

const DEFAULTS: InsightsPrefs = {
  range: 30,
  pinned: [],
  chartType: 'line',
  aggregation: 'average',
}

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

const key = (uid: string) => `insightsPrefs_${uid}`

const oneOf = <T,>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

export function loadInsightsPrefs(uid: string | undefined): InsightsPrefs {
  if (!uid) return DEFAULTS
  try {
    const raw = JSON.parse(localStorage.getItem(key(uid)) || '{}')
    return {
      range: oneOf(raw.range, [7, 14, 30] as const, DEFAULTS.range),
      pinned: stringList(raw.pinned),
      chartType: oneOf(raw.chartType, ['line', 'bar', 'area'] as const, DEFAULTS.chartType),
      aggregation: oneOf(raw.aggregation, ['average', 'sum', 'min', 'max'] as const, DEFAULTS.aggregation),
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
