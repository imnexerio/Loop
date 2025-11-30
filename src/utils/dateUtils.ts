/**
 * Date Utilities - UTC Consistent
 * All date operations use UTC to ensure consistency across timezones
 */

/**
 * Get current date as YYYY-MM-DD string in UTC
 */
export function getTodayUTC(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Get a date string (YYYY-MM-DD) in UTC from a Date object
 */
export function getDateStringUTC(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Get current UTC date components
 */
export function getUTCDateComponents(date: Date = new Date()): {
  year: number
  month: number // 0-indexed (0 = January)
  day: number
} {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate()
  }
}

/**
 * Create a UTC date from year, month, day
 * Month is 0-indexed (0 = January)
 */
export function createUTCDate(year: number, month: number, day: number = 1): Date {
  return new Date(Date.UTC(year, month, day))
}

/**
 * Get first day of month (0 = Sunday) in UTC
 */
export function getFirstDayOfMonthUTC(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 1)).getUTCDay()
}

/**
 * Get number of days in a month (UTC)
 */
export function getDaysInMonthUTC(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/**
 * Format a YYYY-MM-DD date string for display (UTC)
 */
export function formatDateForDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  }
  
  return date.toLocaleDateString('en-US', options)
}

/**
 * Format a YYYY-MM-DD date string for short display (UTC)
 */
export function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  }
  
  return date.toLocaleDateString('en-US', options)
}

/**
 * Format a timestamp (milliseconds) to time string in UTC
 */
export function formatTimeUTC(timestamp: string | number): string {
  const ts = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp
  const date = new Date(ts)
  
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC'
  })
}

/**
 * Format a timestamp for chat display (relative time) in UTC
 */
export function formatTimestampRelative(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
  
  if (diffInHours < 24) {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      timeZone: 'UTC'
    })
  } else if (diffInHours < 48) {
    return 'Yesterday'
  } else if (diffInHours < 168) {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      timeZone: 'UTC'
    })
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      timeZone: 'UTC'
    })
  }
}

/**
 * Get date string for N days ago in UTC
 */
export function getDateNDaysAgoUTC(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().split('T')[0]
}

/**
 * Check if a date string is today (UTC)
 */
export function isToday(dateStr: string): boolean {
  return dateStr === getTodayUTC()
}

/**
 * Parse a YYYY-MM-DD string to get month display name
 */
export function getMonthName(month: number): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return monthNames[month]
}

/**
 * Get short month name
 */
export function getMonthNameShort(month: number): string {
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]
  return monthNames[month]
}

// ============================================
// TIMEZONE-AWARE FUNCTIONS
// ============================================

/**
 * Get the user's current IANA timezone
 * e.g., "Asia/Kolkata", "America/New_York", "Europe/London"
 */
export function getCurrentTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Format a timestamp to time string in a specific timezone
 * Falls back to UTC if timezone is invalid or not provided
 */
export function formatTimeInTimezone(timestamp: string | number, timezone?: string): string {
  const ts = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp
  const date = new Date(ts)
  
  const tz = timezone || 'UTC'
  
  try {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: tz
    })
  } catch (e) {
    // Invalid timezone, fall back to UTC
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC'
    })
  }
}

/**
 * Get date string (YYYY-MM-DD) in a specific timezone
 * This is important for determining which "day" a session belongs to
 */
export function getDateInTimezone(timestamp: number, timezone?: string): string {
  const date = new Date(timestamp)
  const tz = timezone || 'UTC'
  
  try {
    // Get date parts in the specified timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: tz
    })
    return formatter.format(date) // Returns YYYY-MM-DD format
  } catch (e) {
    // Invalid timezone, fall back to UTC
    return date.toISOString().split('T')[0]
  }
}

/**
 * Get short timezone abbreviation for display
 * e.g., "IST", "EST", "PST"
 */
export function getTimezoneAbbreviation(timezone: string, timestamp?: number): string {
  const date = timestamp ? new Date(timestamp) : new Date()
  
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    })
    const parts = formatter.formatToParts(date)
    const tzPart = parts.find(p => p.type === 'timeZoneName')
    return tzPart?.value || timezone
  } catch (e) {
    return timezone
  }
}
