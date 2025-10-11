/**
 * Firebase Realtime Database Service
 * Centralized service with real-time listeners
 * No caching, no offline queue - pure Firebase listeners
 */

import { 
  ref, 
  set, 
  get, 
  push,
  remove,
  onValue,
  query,
  orderByKey,
  startAt,
  endAt,
  update,
  type Unsubscribe
} from 'firebase/database'
import { database } from '../firebase/config'
import { Tag, DayLog, Session, UserProfile, StoredImage } from '../types'

// ============================================
// TYPES
// ============================================

// Internal session type (matches Firebase structure)
interface FirebaseSession {
  description: string
  tags: Record<string, any>
  imageId?: string
}

// ============================================
// TAGS OPERATIONS
// ============================================

/**
 * Subscribe to tags with real-time updates
 * Returns unsubscribe function
 */
export function subscribeToTags(
  userId: string, 
  callback: (tags: Tag[]) => void
): Unsubscribe {
  const tagsRef = ref(database, `users/${userId}/tags`)
  
  const unsubscribe = onValue(tagsRef, (snapshot) => {
    const tagsObj = snapshot.val()
    
    if (!tagsObj) {
      callback([])
      return
    }
    
    // Convert object to array
    const tags: Tag[] = Object.values(tagsObj)
    callback(tags)
  }, (error) => {
    console.error('Error subscribing to tags:', error)
    callback([])
  })
  
  return unsubscribe
}

/**
 * Get tags once (no listener)
 */
export async function getTags(userId: string): Promise<Tag[]> {
  try {
    const tagsRef = ref(database, `users/${userId}/tags`)
    const snapshot = await get(tagsRef)
    
    if (!snapshot.exists()) {
      return []
    }
    
    const tagsObj = snapshot.val()
    return Object.values(tagsObj)
  } catch (error) {
    console.error('Error getting tags:', error)
    return []
  }
}

/**
 * Create a new tag
 */
export async function createTag(userId: string, tag: Omit<Tag, 'id'>): Promise<string> {
  try {
    const tagsRef = ref(database, `users/${userId}/tags`)
    const newTagRef = push(tagsRef)
    
    const tagWithId: Tag = {
      ...tag,
      id: newTagRef.key!,
      createdAt: new Date().toISOString()
    }
    
    await set(newTagRef, tagWithId)
    return newTagRef.key!
  } catch (error) {
    console.error('Error creating tag:', error)
    throw error
  }
}

/**
 * Delete a tag
 */
export async function deleteTag(userId: string, tagId: string): Promise<void> {
  try {
    const tagRef = ref(database, `users/${userId}/tags/${tagId}`)
    await remove(tagRef)
  } catch (error) {
    console.error('Error deleting tag:', error)
    throw error
  }
}

// ============================================
// SESSION OPERATIONS
// ============================================

/**
 * Subscribe to a specific day's sessions with real-time updates
 */
export function subscribeToDayLog(
  userId: string,
  date: string,
  callback: (dayLog: DayLog | null) => void
): Unsubscribe {
  const dayRef = ref(database, `users/${userId}/sessions/${date}`)
  
  const unsubscribe = onValue(dayRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null)
      return
    }
    
    const data = snapshot.val()
    const sessionsObj = data.sessions || {}
    
    // Convert sessions object to array with timestamps
    const sessions: Session[] = Object.entries(sessionsObj).map(([timestamp, session]) => ({
      timestamp: timestamp, // Keep as string for backward compatibility
      description: (session as FirebaseSession).description,
      tags: (session as FirebaseSession).tags
    }))
    
    // Sort by timestamp (newest first)
    sessions.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp))
    
    const dayLog: DayLog = {
      date: data.date,
      sessions,
      lastUpdated: data.lastUpdated
    }
    
    callback(dayLog)
  }, (error) => {
    console.error(`Error subscribing to day log for ${date}:`, error)
    callback(null)
  })
  
  return unsubscribe
}

/**
 * Get a specific day's sessions once (no listener)
 */
export async function getDayLog(userId: string, date: string): Promise<DayLog | null> {
  try {
    const dayRef = ref(database, `users/${userId}/sessions/${date}`)
    const snapshot = await get(dayRef)
    
    if (!snapshot.exists()) {
      return null
    }
    
    const data = snapshot.val()
    const sessionsObj = data.sessions || {}
    
    // Convert sessions object to array
    const sessions: Session[] = Object.entries(sessionsObj).map(([timestamp, session]) => ({
      timestamp: timestamp,
      description: (session as FirebaseSession).description,
      tags: (session as FirebaseSession).tags
    }))
    
    // Sort by timestamp (newest first)
    sessions.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp))
    
    return {
      date: data.date,
      sessions,
      lastUpdated: data.lastUpdated
    }
  } catch (error) {
    console.error(`Error getting day log for ${date}:`, error)
    return null
  }
}

/**
 * Add a new session to a specific day
 * Uses timestamp as the session ID
 */
export async function addSession(
  userId: string,
  date: string,
  session: Omit<Session, 'timestamp'>
): Promise<number> {
  try {
    const timestamp = Date.now()
    const sessionRef = ref(database, `users/${userId}/sessions/${date}/sessions/${timestamp}`)
    
    const firebaseSession: FirebaseSession = {
      description: session.description,
      tags: session.tags
    }
    
    await set(sessionRef, firebaseSession)
    
    // Update day metadata
    const dayRef = ref(database, `users/${userId}/sessions/${date}`)
    const daySnapshot = await get(dayRef)
    
    if (!daySnapshot.exists()) {
      // First session for this day
      await set(ref(database, `users/${userId}/sessions/${date}`), {
        date,
        sessions: { [timestamp]: firebaseSession },
        lastUpdated: timestamp
      })
    } else {
      // Update lastUpdated
      await set(ref(database, `users/${userId}/sessions/${date}/date`), date)
      await set(ref(database, `users/${userId}/sessions/${date}/lastUpdated`), timestamp)
    }
    
    return timestamp
  } catch (error) {
    console.error('Error adding session:', error)
    throw error
  }
}

/**
 * Delete a specific session
 */
export async function deleteSession(
  userId: string,
  date: string,
  timestamp: string
): Promise<void> {
  try {
    const sessionRef = ref(database, `users/${userId}/sessions/${date}/sessions/${timestamp}`)
    await remove(sessionRef)
    
    // Check if this was the last session for the day
    const dayRef = ref(database, `users/${userId}/sessions/${date}/sessions`)
    const snapshot = await get(dayRef)
    
    if (!snapshot.exists()) {
      // No sessions left, remove the entire day
      const dayParentRef = ref(database, `users/${userId}/sessions/${date}`)
      await remove(dayParentRef)
    } else {
      // Update lastUpdated
      await set(ref(database, `users/${userId}/sessions/${date}/lastUpdated`), Date.now())
    }
  } catch (error) {
    console.error('Error deleting session:', error)
    throw error
  }
}

// ============================================
// CALENDAR / MONTH OPERATIONS
// ============================================

/**
 * Subscribe to a month's sessions with real-time updates
 * Returns list of dates that have sessions
 */
export function subscribeToMonth(
  userId: string,
  year: string,
  month: string,
  callback: (dates: string[]) => void
): Unsubscribe {
  const monthPrefix = `${year}-${month.padStart(2, '0')}`
  const sessionsRef = ref(database, `users/${userId}/sessions`)
  
  const monthQuery = query(
    sessionsRef,
    orderByKey(),
    startAt(monthPrefix),
    endAt(monthPrefix + '\uf8ff')
  )
  
  const unsubscribe = onValue(monthQuery, (snapshot) => {
    if (!snapshot.exists()) {
      callback([])
      return
    }
    
    const sessionsObj = snapshot.val()
    const dates = Object.keys(sessionsObj)
    callback(dates)
  }, (error) => {
    console.error(`Error subscribing to month ${year}-${month}:`, error)
    callback([])
  })
  
  return unsubscribe
}

/**
 * Get dates that have sessions for a specific month (no listener)
 */
export async function getMonthDaysWithSessions(
  userId: string,
  year: string,
  month: string
): Promise<string[]> {
  try {
    const monthPrefix = `${year}-${month.padStart(2, '0')}`
    const sessionsRef = ref(database, `users/${userId}/sessions`)
    
    const monthQuery = query(
      sessionsRef,
      orderByKey(),
      startAt(monthPrefix),
      endAt(monthPrefix + '\uf8ff')
    )
    
    const snapshot = await get(monthQuery)
    
    if (!snapshot.exists()) {
      return []
    }
    
    return Object.keys(snapshot.val())
  } catch (error) {
    console.error(`Error getting month days for ${year}-${month}:`, error)
    return []
  }
}

// ============================================
// ANALYTICS / CHART DATA
// ============================================

/**
 * Get tag data for a date range (for charts)
 */
export async function getTagDataRange(
  userId: string,
  tagId: string,
  days: number = 30
): Promise<{ date: string; value: number | null }[]> {
  try {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days + 1)
    
    // Format dates as YYYY-MM-DD
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]
    
    const sessionsRef = ref(database, `users/${userId}/sessions`)
    const rangeQuery = query(
      sessionsRef,
      orderByKey(),
      startAt(startDateStr),
      endAt(endDateStr)
    )
    
    const snapshot = await get(rangeQuery)
    
    // Initialize result array with all dates
    const result: { date: string; value: number | null }[] = []
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      result.push({ date: dateStr, value: null })
    }
    
    if (!snapshot.exists()) {
      return result
    }
    
    // Process data
    const sessionsObj = snapshot.val()
    
    Object.entries(sessionsObj).forEach(([date, dayData]: [string, any]) => {
      const sessionsObj = dayData.sessions || {}
      const sessions: Session[] = Object.entries(sessionsObj).map(([timestamp, session]) => ({
        timestamp: timestamp,
        description: (session as FirebaseSession).description,
        tags: (session as FirebaseSession).tags
      }))
      
      // Calculate average value for this tag on this day
      const values = sessions
        .map(s => s.tags[tagId])
        .filter(v => v !== undefined && v !== null && typeof v === 'number')
      
      if (values.length > 0) {
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length
        const resultIndex = result.findIndex(r => r.date === date)
        if (resultIndex >= 0) {
          result[resultIndex].value = Math.round(avg * 100) / 100 // Round to 2 decimals
        }
      }
    })
    
    return result
  } catch (error) {
    console.error(`Error getting tag data range for ${tagId}:`, error)
    return []
  }
}

// ============================================
// PROFILE OPERATIONS
// ============================================

/**
 * Subscribe to user profile with real-time updates
 */
export function subscribeToProfile(
  userId: string,
  callback: (profile: UserProfile | null) => void
): Unsubscribe {
  const profileRef = ref(database, `users/${userId}/profile`)
  
  const unsubscribe = onValue(profileRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null)
      return
    }
    
    callback(snapshot.val() as UserProfile)
  }, (error) => {
    console.error('Error subscribing to profile:', error)
    callback(null)
  })
  
  return unsubscribe
}

/**
 * Get user profile once (no listener)
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const profileRef = ref(database, `users/${userId}/profile`)
    const snapshot = await get(profileRef)
    
    if (!snapshot.exists()) {
      return null
    }
    
    return snapshot.val() as UserProfile
  } catch (error) {
    console.error('Error getting profile:', error)
    return null
  }
}

/**
 * Create user profile
 */
export async function createUserProfile(userId: string, profile: UserProfile): Promise<void> {
  try {
    const profileRef = ref(database, `users/${userId}/profile`)
    await set(profileRef, profile)
  } catch (error) {
    console.error('Error creating profile:', error)
    throw error
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<void> {
  try {
    const profileRef = ref(database, `users/${userId}/profile`)
    const snapshot = await get(profileRef)
    
    if (!snapshot.exists()) {
      throw new Error('Profile does not exist')
    }
    
    const currentProfile = snapshot.val()
    const updatedProfile = { ...currentProfile, ...updates }
    
    await set(profileRef, updatedProfile)
  } catch (error) {
    console.error('Error updating profile:', error)
    throw error
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Unsubscribe from all listeners (cleanup utility)
 */
export function unsubscribeAll(unsubscribes: Unsubscribe[]) {
  unsubscribes.forEach(unsub => unsub())
}

// ============================================
// IMAGE STORAGE OPERATIONS
// ============================================

/**
 * Save image to separate storage
 * Returns the image ID
 */
export async function saveImage(
  userId: string,
  imageData: Omit<StoredImage, 'id'>
): Promise<string> {
  try {
    // Generate unique image ID
    const imageId = `${imageData.type}_${imageData.createdAt}_${Math.random().toString(36).substr(2, 9)}`
    const imageRef = ref(database, `users/${userId}/images/${imageId}`)
    
    const image: StoredImage = {
      id: imageId,
      ...imageData
    }
    
    await set(imageRef, image)
    console.log(`[FirebaseService] Image saved: ${imageId}`)
    
    return imageId
  } catch (error) {
    console.error('Error saving image:', error)
    throw error
  }
}

/**
 * Get image by ID
 */
export async function getImage(
  userId: string,
  imageId: string
): Promise<StoredImage | null> {
  try {
    const imageRef = ref(database, `users/${userId}/images/${imageId}`)
    const snapshot = await get(imageRef)
    
    if (!snapshot.exists()) {
      console.warn(`[FirebaseService] Image not found: ${imageId}`)
      return null
    }
    
    return snapshot.val() as StoredImage
  } catch (error) {
    console.error('Error getting image:', error)
    throw error
  }
}

/**
 * Delete image by ID
 */
export async function deleteImage(
  userId: string,
  imageId: string
): Promise<void> {
  try {
    const imageRef = ref(database, `users/${userId}/images/${imageId}`)
    await remove(imageRef)
    console.log(`[FirebaseService] Image deleted: ${imageId}`)
  } catch (error) {
    console.error('Error deleting image:', error)
    throw error
  }
}

/**
 * Get all images for a user
 */
export async function getAllImages(
  userId: string
): Promise<StoredImage[]> {
  try {
    const imagesRef = ref(database, `users/${userId}/images`)
    const snapshot = await get(imagesRef)
    
    if (!snapshot.exists()) {
      return []
    }
    
    const imagesObj = snapshot.val()
    return Object.values(imagesObj)
  } catch (error) {
    console.error('Error getting all images:', error)
    throw error
  }
}

/**
 * Get images for a specific date
 */
export async function getImagesForDate(
  userId: string,
  date: string
): Promise<StoredImage[]> {
  try {
    const imagesRef = ref(database, `users/${userId}/images`)
    const snapshot = await get(imagesRef)
    
    if (!snapshot.exists()) {
      return []
    }
    
    const imagesObj = snapshot.val() as Record<string, StoredImage>
    const dateImages = Object.values(imagesObj).filter(
      img => img.type === 'session' && img.date === date
    )
    
    return dateImages
  } catch (error) {
    console.error('Error getting images for date:', error)
    throw error
  }
}

/**
 * Update session to add image reference
 */
export async function updateSessionImage(
  userId: string,
  date: string,
  timestamp: number,
  imageId: string
): Promise<void> {
  try {
    const sessionRef = ref(database, `users/${userId}/sessions/${date}/sessions/${timestamp}`)
    await update(sessionRef, { imageId })
    console.log(`[FirebaseService] Session updated with imageId: ${imageId}`)
  } catch (error) {
    console.error('Error updating session image:', error)
    throw error
  }
}

/**
 * Subscribe to images with real-time updates
 */
export function subscribeToImages(
  userId: string,
  callback: (images: StoredImage[]) => void
): Unsubscribe {
  const imagesRef = ref(database, `users/${userId}/images`)
  
  const unsubscribe = onValue(imagesRef, (snapshot) => {
    const imagesObj = snapshot.val()
    
    if (!imagesObj) {
      callback([])
      return
    }
    
    const images = Object.values(imagesObj) as StoredImage[]
    callback(images)
  })
  
  return unsubscribe
}
