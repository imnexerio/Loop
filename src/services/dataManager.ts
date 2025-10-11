/**
 * Unified Data Manager with Offline Support
 * Centralizes all data operations with caching and state management
 * Offline-first: Reads from local storage, writes to queue when offline
 * Prevents unnecessary Firestore reads and manages data flow
 */

import { 
  getUserTags, 
  createTag, 
  deleteTag,
  getDayLog,
  addSession,
  getMonthDaysWithSessions,
  getTagDataRange
} from './firestore'
import { offlineStorage } from './offlineStorage'
import { Tag, DayLog, Session } from '../types'

// Cache structure
interface DataCache {
  tags: {
    data: Tag[] | null
    lastFetch: number
    userId: string | null
  }
  dayLogs: Map<string, { data: DayLog | null; lastFetch: number }>
  monthDays: Map<string, { data: string[]; lastFetch: number }>
  chartData: Map<string, { data: { date: string; value: number | null }[]; lastFetch: number }>
}

// Cache expiry times (in milliseconds)
const CACHE_DURATION = {
  TAGS: 5 * 60 * 1000, // 5 minutes
  DAY_LOG: 2 * 60 * 1000, // 2 minutes
  MONTH_DAYS: 5 * 60 * 1000, // 5 minutes
  CHART_DATA: 5 * 60 * 1000, // 5 minutes
}

// Initialize cache
const cache: DataCache = {
  tags: { data: null, lastFetch: 0, userId: null },
  dayLogs: new Map(),
  monthDays: new Map(),
  chartData: new Map(),
}

// Active fetch promises to prevent duplicate requests
const activeFetches = new Map<string, Promise<any>>()

/**
 * Check if cache is valid
 */
function isCacheValid(lastFetch: number, duration: number): boolean {
  return Date.now() - lastFetch < duration
}

/**
 * Get or fetch with deduplication
 */
async function getOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  // If already fetching, return the same promise
  if (activeFetches.has(key)) {
    console.log(`[DataManager] Deduplicating fetch for: ${key}`)
    return activeFetches.get(key)!
  }

  // Start new fetch
  const promise = fetcher()
  activeFetches.set(key, promise)

  try {
    const result = await promise
    return result
  } finally {
    // Clean up after fetch completes
    activeFetches.delete(key)
  }
}

// ============================================
// TAGS OPERATIONS
// ============================================

export async function getTags(userId: string, forceRefresh = false): Promise<Tag[]> {
  const cacheKey = `tags_${userId}`
  
  // Try local storage first (offline-first)
  if (!forceRefresh) {
    // Check memory cache
    if (
      cache.tags.userId === userId &&
      cache.tags.data &&
      isCacheValid(cache.tags.lastFetch, CACHE_DURATION.TAGS)
    ) {
      console.log('[DataManager] Returning cached tags from memory')
      return cache.tags.data
    }
    
    // Check IndexedDB
    try {
      const localTags = await offlineStorage.getTags(userId)
      if (localTags) {
        console.log('[DataManager] Returning tags from IndexedDB')
        // Update memory cache
        cache.tags = {
          data: localTags,
          lastFetch: Date.now(),
          userId
        }
        
        // Fetch from Firestore in background if online
        if (navigator.onLine) {
          getUserTags(userId).then(tags => {
            offlineStorage.saveTags(userId, tags)
            cache.tags = { data: tags, lastFetch: Date.now(), userId }
          }).catch(err => console.error('Background tag fetch failed:', err))
        }
        
        return localTags
      }
    } catch (error) {
      console.error('Error reading from IndexedDB:', error)
    }
  }

  // If online, fetch from Firestore
  if (!navigator.onLine) {
    console.warn('[DataManager] Offline and no cached tags available')
    return []
  }

  console.log('[DataManager] Fetching tags from Firestore')
  
  return getOrFetch(cacheKey, async () => {
    const tags = await getUserTags(userId)
    
    // Save to IndexedDB
    offlineStorage.saveTags(userId, tags).catch(err => 
      console.error('Failed to save tags to IndexedDB:', err)
    )
    
    // Update memory cache
    cache.tags = {
      data: tags,
      lastFetch: Date.now(),
      userId
    }
    
    return tags
  })
}

export async function createTagCached(userId: string, tag: Omit<Tag, 'id'>): Promise<string> {
  console.log('[DataManager] Creating new tag')
  
  if (!navigator.onLine) {
    // Queue for later when offline
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    await offlineStorage.addToQueue({
      userId,
      type: 'CREATE_TAG',
      data: { tag: { ...tag, id: tempId } }
    })
    
    // Update local cache optimistically
    const currentTags = cache.tags.data || []
    cache.tags.data = [...currentTags, { ...tag, id: tempId } as Tag]
    
    return tempId
  }
  
  const tagId = await createTag(userId, tag)
  
  // Invalidate cache to force refresh
  cache.tags.lastFetch = 0
  
  return tagId
}

export async function deleteTagCached(userId: string, tagId: string): Promise<void> {
  console.log('[DataManager] Deleting tag')
  
  if (!navigator.onLine) {
    // Queue for later
    await offlineStorage.addToQueue({
      userId,
      type: 'DELETE_TAG',
      data: { tagId }
    })
    
    // Update local cache optimistically
    if (cache.tags.data) {
      cache.tags.data = cache.tags.data.filter(t => t.id !== tagId)
    }
    
    return
  }
  
  await deleteTag(userId, tagId)
  
  // Invalidate cache
  cache.tags.lastFetch = 0
}

// ============================================
// DAY LOG OPERATIONS
// ============================================

export async function getDayLogCached(
  userId: string,
  date: string,
  forceRefresh = false
): Promise<DayLog | null> {
  const cacheKey = `daylog_${userId}_${date}`
  const cached = cache.dayLogs.get(cacheKey)
  
  // Try local storage first (offline-first)
  if (!forceRefresh) {
    // Check memory cache
    if (cached && isCacheValid(cached.lastFetch, CACHE_DURATION.DAY_LOG)) {
      console.log(`[DataManager] Returning cached day log for ${date} from memory`)
      return cached.data
    }
    
    // Check IndexedDB
    try {
      const localDayLog = await offlineStorage.getDayLog(userId, date)
      if (localDayLog) {
        console.log(`[DataManager] Returning day log for ${date} from IndexedDB`)
        // Update memory cache
        cache.dayLogs.set(cacheKey, {
          data: localDayLog,
          lastFetch: Date.now()
        })
        
        // Fetch from Firestore in background if online
        if (navigator.onLine) {
          getDayLog(userId, date).then(dayLog => {
            if (dayLog) {
              offlineStorage.saveDayLog(userId, date, dayLog)
              cache.dayLogs.set(cacheKey, { data: dayLog, lastFetch: Date.now() })
            }
          }).catch(err => console.error('Background day log fetch failed:', err))
        }
        
        return localDayLog
      }
    } catch (error) {
      console.error('Error reading from IndexedDB:', error)
    }
  }

  // If online, fetch from Firestore
  if (!navigator.onLine) {
    console.warn(`[DataManager] Offline and no cached day log for ${date}`)
    return null
  }

  console.log(`[DataManager] Fetching day log for ${date} from Firestore`)
  
  return getOrFetch(cacheKey, async () => {
    const dayLog = await getDayLog(userId, date)
    
    // Save to IndexedDB
    if (dayLog) {
      offlineStorage.saveDayLog(userId, date, dayLog).catch(err =>
        console.error('Failed to save day log to IndexedDB:', err)
      )
    }
    
    // Update memory cache
    cache.dayLogs.set(cacheKey, {
      data: dayLog,
      lastFetch: Date.now()
    })
    
    return dayLog
  })
}

export async function addSessionCached(
  userId: string,
  date: string,
  session: Session
): Promise<void> {
  console.log(`[DataManager] Adding session for ${date}`)
  
  if (!navigator.onLine) {
    // Queue for later when offline
    await offlineStorage.addToQueue({
      userId,
      type: 'ADD_SESSION',
      data: { date, session }
    })
    
    // Update local storage optimistically
    let dayLog = await offlineStorage.getDayLog(userId, date)
    if (!dayLog) {
      dayLog = { date, sessions: [] }
    }
    dayLog.sessions.push(session)
    await offlineStorage.saveDayLog(userId, date, dayLog)
    
    // Update memory cache
    const dayLogKey = `daylog_${userId}_${date}`
    cache.dayLogs.set(dayLogKey, {
      data: dayLog,
      lastFetch: Date.now()
    })
    
    return
  }
  
  await addSession(userId, date, session)
  
  // Invalidate related caches
  const dayLogKey = `daylog_${userId}_${date}`
  cache.dayLogs.delete(dayLogKey)
  
  // Invalidate month days cache for this month
  const [year, month] = date.split('-')
  const monthKey = `monthdays_${userId}_${year}_${month}`
  cache.monthDays.delete(monthKey)
  
  // Invalidate all chart data (might be affected)
  cache.chartData.clear()
}

// ============================================
// MONTH DAYS OPERATIONS
// ============================================

export async function getMonthDaysWithSessionsCached(
  userId: string,
  year: string,
  month: string,
  forceRefresh = false
): Promise<string[]> {
  const cacheKey = `monthdays_${userId}_${year}_${month}`
  const cached = cache.monthDays.get(cacheKey)
  
  // Return cached data if valid
  if (
    !forceRefresh &&
    cached &&
    isCacheValid(cached.lastFetch, CACHE_DURATION.MONTH_DAYS)
  ) {
    console.log(`[DataManager] Returning cached month days for ${year}-${month}`)
    return cached.data
  }

  console.log(`[DataManager] Fetching month days for ${year}-${month}`)
  
  return getOrFetch(cacheKey, async () => {
    const days = await getMonthDaysWithSessions(userId, year, month)
    
    // Update cache
    cache.monthDays.set(cacheKey, {
      data: days,
      lastFetch: Date.now()
    })
    
    return days
  })
}

// ============================================
// CHART DATA OPERATIONS
// ============================================

export async function getChartDataCached(
  userId: string,
  tagId: string,
  days: number = 30,
  forceRefresh = false
): Promise<{ date: string; value: number | null }[]> {
  const cacheKey = `chart_${userId}_${tagId}_${days}`
  const cached = cache.chartData.get(cacheKey)
  
  // Return cached data if valid
  if (
    !forceRefresh &&
    cached &&
    isCacheValid(cached.lastFetch, CACHE_DURATION.CHART_DATA)
  ) {
    console.log(`[DataManager] Returning cached chart data for tag ${tagId}`)
    return cached.data
  }

  console.log(`[DataManager] Fetching chart data for tag ${tagId}`)
  
  return getOrFetch(cacheKey, async () => {
    const data = await getTagDataRange(userId, tagId, days)
    
    // Update cache
    cache.chartData.set(cacheKey, {
      data,
      lastFetch: Date.now()
    })
    
    return data
  })
}

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Clear all caches
 */
export function clearAllCaches() {
  console.log('[DataManager] Clearing all caches')
  cache.tags = { data: null, lastFetch: 0, userId: null }
  cache.dayLogs.clear()
  cache.monthDays.clear()
  cache.chartData.clear()
}

/**
 * Clear specific cache
 */
export function clearCache(type: 'tags' | 'dayLogs' | 'monthDays' | 'chartData') {
  console.log(`[DataManager] Clearing ${type} cache`)
  if (type === 'tags') {
    cache.tags = { data: null, lastFetch: 0, userId: null }
  } else {
    cache[type].clear()
  }
}

/**
 * Get cache statistics (for debugging)
 */
export function getCacheStats() {
  return {
    tags: cache.tags.data ? `${cache.tags.data.length} items` : 'empty',
    dayLogs: cache.dayLogs.size,
    monthDays: cache.monthDays.size,
    chartData: cache.chartData.size,
    activeFetches: activeFetches.size
  }
}
