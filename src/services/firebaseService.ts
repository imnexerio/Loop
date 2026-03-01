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
import { Tag, DayLog, Session, UserProfile, StoredImage, StoredAudio, AudioChunk, ImageType } from '../types'
import { getDateStringUTC } from '../utils/dateUtils'

// ============================================
// TYPES
// ============================================

// Internal session type (matches Firebase structure)
interface FirebaseSession {
  description?: string // Optional - sessions can have just tags
  tags: Record<string, any>
  imageId?: string
  audioId?: string // Voice recording reference
  timezone?: string // IANA timezone where session was logged
  location?: { lat: number; lng: number } // GPS coordinates
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
      timezone: (session as FirebaseSession).timezone,
      location: (session as FirebaseSession).location,
      description: (session as FirebaseSession).description,
      tags: (session as FirebaseSession).tags,
      imageId: (session as FirebaseSession).imageId,
      audioId: (session as FirebaseSession).audioId
    }))
    
    // Sort by timestamp (newest first)
    sessions.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp))
    
    const dayLog: DayLog = {
      date,
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
      timezone: (session as FirebaseSession).timezone,
      location: (session as FirebaseSession).location,
      description: (session as FirebaseSession).description,
      tags: (session as FirebaseSession).tags,
      imageId: (session as FirebaseSession).imageId,
      audioId: (session as FirebaseSession).audioId
    }))
    
    // Sort by timestamp (newest first)
    sessions.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp))
    
    return {
      date,
      sessions,
      lastUpdated: data.lastUpdated?.toString() || Date.now().toString()
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
  session: Omit<Session, 'timestamp'> | Session
): Promise<number> {
  try {
    // Use provided timestamp or generate new one
    const timestamp = 'timestamp' in session 
      ? parseInt(session.timestamp) 
      : Date.now()
    
    const sessionRef = ref(database, `users/${userId}/sessions/${date}/sessions/${timestamp}`)
    
    const firebaseSession: FirebaseSession = {
      description: session.description,
      tags: session.tags,
      imageId: 'imageId' in session ? session.imageId : undefined,
      audioId: 'audioId' in session ? session.audioId : undefined,
      timezone: 'timezone' in session ? session.timezone : undefined,
      location: 'location' in session ? session.location : undefined
    }
    
    // Remove undefined values (Firebase doesn't allow undefined)
    if (!firebaseSession.description) {
      delete firebaseSession.description
    }
    if (!firebaseSession.imageId) {
      delete firebaseSession.imageId
    }
    if (!firebaseSession.audioId) {
      delete firebaseSession.audioId
    }
    if (!firebaseSession.timezone) {
      delete firebaseSession.timezone
    }
    if (!firebaseSession.location) {
      delete firebaseSession.location
    }
    
    await set(sessionRef, firebaseSession)
    
    // Update day metadata
    const dayRef = ref(database, `users/${userId}/sessions/${date}`)
    const daySnapshot = await get(dayRef)
    
    if (!daySnapshot.exists()) {
      // First session for this day
      await set(ref(database, `users/${userId}/sessions/${date}`), {
        sessions: { [timestamp]: firebaseSession },
        lastUpdated: timestamp
      })
    } else {
      // Update lastUpdated
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

export type AggregationType = 'average' | 'sum' | 'min' | 'max'

/**
 * Get tag data for a date range (for charts)
 */
export async function getTagDataRange(
  userId: string,
  tagId: string,
  days: number = 30,
  aggregationType: AggregationType = 'average'
): Promise<{ date: string; value: number | null }[]> {
  try {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setUTCDate(startDate.getUTCDate() - days + 1)
    
    // Format dates as YYYY-MM-DD (UTC)
    const startDateStr = getDateStringUTC(startDate)
    const endDateStr = getDateStringUTC(endDate)
    
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
      date.setUTCDate(date.getUTCDate() + i)
      const dateStr = getDateStringUTC(date)
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
        timezone: (session as FirebaseSession).timezone,
        description: (session as FirebaseSession).description,
        tags: (session as FirebaseSession).tags || {}
      }))
      
      // Calculate aggregated value for this tag on this day
      const values = sessions
        .map(s => s.tags?.[tagId])
        .filter((v): v is number => v !== undefined && v !== null && typeof v === 'number')
      
      if (values.length > 0) {
        let aggregatedValue: number
        
        switch (aggregationType) {
          case 'sum':
            aggregatedValue = values.reduce((sum, val) => sum + val, 0)
            break
          case 'min':
            aggregatedValue = Math.min(...values)
            break
          case 'max':
            aggregatedValue = Math.max(...values)
            break
          case 'average':
          default:
            aggregatedValue = values.reduce((sum, val) => sum + val, 0) / values.length
            break
        }
        
        const resultIndex = result.findIndex(r => r.date === date)
        if (resultIndex >= 0) {
          result[resultIndex].value = Math.round(aggregatedValue * 100) / 100 // Round to 2 decimals
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
    
    let updatedProfile: UserProfile
    
    if (!snapshot.exists()) {
      // Create profile if it doesn't exist
      updatedProfile = {
        name: updates.name || '',
        email: updates.email || '',
        createdAt: new Date().toISOString(),
        settings: updates.settings || {
          llmProvider: 'gemini'
        },
        ...updates
      }
    } else {
      // Update existing profile
      const currentProfile = snapshot.val()
      updatedProfile = { ...currentProfile, ...updates }
    }
    
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
  type: ImageType,
  imageData: StoredImage
): Promise<string> {
  try {
    // Generate unique image ID (type prefix allows deriving type from key)
    const imageId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const imageRef = ref(database, `users/${userId}/images/${imageId}`)
    
    await set(imageRef, imageData)
    
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

// ============================================
// AUDIO STORAGE OPERATIONS
// ============================================

/**
 * Save audio recording to storage
 * Returns the audio ID
 * If audioId is provided, updates existing record
 */
export async function saveAudio(
  userId: string,
  audioData: StoredAudio,
  existingAudioId?: string
): Promise<string> {
  try {
    // Use existing ID or generate new one
    const audioId = existingAudioId || `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const audioRef = ref(database, `users/${userId}/audio/${audioId}`)
    
    await set(audioRef, audioData)
    
    return audioId
  } catch (error) {
    console.error('Error saving audio:', error)
    throw error
  }
}

/**
 * Get audio by ID
 */
export async function getAudio(
  userId: string,
  audioId: string
): Promise<StoredAudio | null> {
  try {
    const audioRef = ref(database, `users/${userId}/audio/${audioId}`)
    const snapshot = await get(audioRef)
    
    if (!snapshot.exists()) {
      console.warn(`[FirebaseService] Audio not found: ${audioId}`)
      return null
    }
    
    return snapshot.val() as StoredAudio
  } catch (error) {
    console.error('Error getting audio:', error)
    throw error
  }
}

/**
 * Delete audio by ID
 */
export async function deleteAudio(
  userId: string,
  audioId: string
): Promise<void> {
  try {
    // First get audio to find chunks
    const audio = await getAudio(userId, audioId)
    
    // Delete all chunks
    if (audio?.chunkIds && audio.chunkIds.length > 0) {
      for (const chunkId of audio.chunkIds) {
        const chunkRef = ref(database, `users/${userId}/audioChunks/${chunkId}`)
        await remove(chunkRef)
      }
      console.log(`[FirebaseService] Deleted ${audio.chunkIds.length} audio chunk(s)`)
    }
    
    // Delete the audio record
    const audioRef = ref(database, `users/${userId}/audio/${audioId}`)
    await remove(audioRef)
  } catch (error) {
    console.error('Error deleting audio:', error)
    throw error
  }
}

// ============================================
// AUDIO CHUNK OPERATIONS
// ============================================

/**
 * Save an audio chunk
 * Returns the chunk ID
 */
export async function saveAudioChunk(
  userId: string,
  audioId: string,
  chunkData: AudioChunk
): Promise<string> {
  try {
    const chunkId = `chunk_${audioId}_${chunkData.chunkIndex}_${Math.random().toString(36).substr(2, 9)}`
    const chunkRef = ref(database, `users/${userId}/audioChunks/${chunkId}`)
    
    await set(chunkRef, chunkData)
    
    return chunkId
  } catch (error) {
    console.error('Error saving audio chunk:', error)
    throw error
  }
}

/**
 * Get multiple audio chunks by their IDs
 * Returns chunks in the order they were requested
 */
export async function getAudioChunks(
  userId: string,
  chunkIds: string[]
): Promise<AudioChunk[]> {
  try {
    const chunks: AudioChunk[] = []
    
    for (const chunkId of chunkIds) {
      const chunkRef = ref(database, `users/${userId}/audioChunks/${chunkId}`)
      const snapshot = await get(chunkRef)
      
      if (snapshot.exists()) {
        chunks.push(snapshot.val() as AudioChunk)
      } else {
        console.warn(`[FirebaseService] Audio chunk not found: ${chunkId}`)
      }
    }
    
    return chunks
  } catch (error) {
    console.error('Error getting audio chunks:', error)
    throw error
  }
}

/**
 * Get a single audio chunk by ID
 */
export async function getAudioChunk(
  userId: string,
  chunkId: string
): Promise<AudioChunk | null> {
  try {
    const chunkRef = ref(database, `users/${userId}/audioChunks/${chunkId}`)
    const snapshot = await get(chunkRef)
    
    if (!snapshot.exists()) {
      return null
    }
    
    return snapshot.val() as AudioChunk
  } catch (error) {
    console.error('Error getting audio chunk:', error)
    throw error
  }
}
