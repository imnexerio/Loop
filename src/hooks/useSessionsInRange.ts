import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { subscribeToSessionRange } from '../services/dataManager'
import { Session } from '../types'
import { listDatesBetween } from '../utils/dateUtils'

export interface SessionRange {
  /** Every date in the range, oldest first, including days with no sessions */
  dates: string[]
  /** Sessions keyed by date; days without sessions are absent */
  byDate: Record<string, Session[]>
  /** True until the current range has loaded */
  loading: boolean
  /** True once any range has loaded; while `loading`, `byDate` holds the previous range */
  hasData: boolean
}

interface Result {
  uid: string
  key: string
  byDate: Record<string, Session[]>
}

const EMPTY: Record<string, Session[]> = {}

/**
 * Live view of every session between two dates (YYYY-MM-DD, inclusive).
 * One Firebase listener serves every consumer of the range, so cards and
 * detail views never query the same days twice. Pass null to disable.
 */
export function useSessionsInRange(startDate: string | null, endDate: string | null): SessionRange {
  const { currentUser } = useAuth()
  const uid = currentUser?.uid
  const key = uid && startDate && endDate ? `${uid}|${startDate}|${endDate}` : null

  // Results remember the key they belong to, so no reset is needed when the
  // range changes: the previous range stays visible until the new one lands.
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    if (!key || !uid || !startDate || !endDate) return
    return subscribeToSessionRange(uid, startDate, endDate, (byDate) => {
      setResult({ uid, key, byDate })
    })
  }, [key, uid, startDate, endDate])

  const dates = useMemo(
    () => (startDate && endDate ? listDatesBetween(startDate, endDate) : []),
    [startDate, endDate]
  )

  const usable = key !== null && result !== null && result.uid === uid
  return {
    dates,
    byDate: usable ? result.byDate : EMPTY,
    loading: key !== null && result?.key !== key,
    hasData: usable,
  }
}
