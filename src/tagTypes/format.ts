import { getMonthNameShort } from '../utils/dateUtils'

/** 72, 72.5, 72.43 — no trailing zeros */
export const formatNumber = (n: number) => String(Math.round(n * 100) / 100)

/** "Nov 3" from YYYY-MM-DD */
export const formatShortDate = (dateStr: string) => {
  const [, month, day] = dateStr.split('-').map(Number)
  return `${getMonthNameShort(month - 1)} ${day}`
}

/** "45 min", "1h 20m" */
export const formatDuration = (minutes: number) => {
  const m = Math.round(Math.abs(minutes))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h}h ${rest}m` : `${h}h`
}

export const formatPercent = (ratio: number) => `${Math.round(ratio * 100)}%`
