import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query,
  getDocs,
  Timestamp 
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { Tag, DayLog, Session, UserProfile } from '../types'

// ============================================
// USER PROFILE
// ============================================

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, 'users', userId)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile
    }
    return null
  } catch (error) {
    console.error('Error getting user profile:', error)
    throw error
  }
}

export const createUserProfile = async (userId: string, profile: UserProfile): Promise<void> => {
  try {
    const docRef = doc(db, 'users', userId)
    await setDoc(docRef, profile)
  } catch (error) {
    console.error('Error creating user profile:', error)
    throw error
  }
}

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>): Promise<void> => {
  try {
    const docRef = doc(db, 'users', userId)
    await updateDoc(docRef, updates)
  } catch (error) {
    console.error('Error updating user profile:', error)
    throw error
  }
}

// ============================================
// TAGS
// ============================================

export const getUserTags = async (userId: string): Promise<Tag[]> => {
  try {
    const tagsRef = collection(db, 'users', userId, 'tags')
    const querySnapshot = await getDocs(query(tagsRef))
    
    const tags: Tag[] = []
    querySnapshot.forEach((doc) => {
      tags.push({ id: doc.id, ...doc.data() } as Tag)
    })
    
    return tags
  } catch (error) {
    console.error('Error getting tags:', error)
    throw error
  }
}

export const createTag = async (userId: string, tag: Omit<Tag, 'id'>): Promise<string> => {
  try {
    const tagsRef = collection(db, 'users', userId, 'tags')
    const newTagRef = doc(tagsRef)
    
    await setDoc(newTagRef, {
      ...tag,
      createdAt: new Date().toISOString()
    })
    
    return newTagRef.id
  } catch (error) {
    console.error('Error creating tag:', error)
    throw error
  }
}

export const updateTag = async (userId: string, tagId: string, updates: Partial<Tag>): Promise<void> => {
  try {
    const tagRef = doc(db, 'users', userId, 'tags', tagId)
    await updateDoc(tagRef, updates)
  } catch (error) {
    console.error('Error updating tag:', error)
    throw error
  }
}

export const deleteTag = async (userId: string, tagId: string): Promise<void> => {
  try {
    const tagRef = doc(db, 'users', userId, 'tags', tagId)
    await deleteDoc(tagRef)
  } catch (error) {
    console.error('Error deleting tag:', error)
    throw error
  }
}

// ============================================
// DAILY LOGS & SESSIONS
// ============================================

export const getDayLog = async (userId: string, date: string): Promise<DayLog | null> => {
  try {
    // Parse date: "2025-10-11" -> year: 2025, month: 10, day: 11
    const [year, month, day] = date.split('-')
    
    const dayRef = doc(db, 'users', userId, 'logs', year, 'months', month, 'days', day)
    const docSnap = await getDoc(dayRef)
    
    if (docSnap.exists()) {
      return docSnap.data() as DayLog
    }
    
    // Return empty log if doesn't exist
    return {
      date,
      sessions: [],
      lastUpdated: new Date().toISOString()
    }
  } catch (error) {
    console.error('Error getting day log:', error)
    throw error
  }
}

export const addSession = async (
  userId: string, 
  date: string, 
  session: Session
): Promise<void> => {
  try {
    const [year, month, day] = date.split('-')
    const dayRef = doc(db, 'users', userId, 'logs', year, 'months', month, 'days', day)
    
    // Get existing log
    const existingLog = await getDayLog(userId, date)
    
    // Add new session
    const updatedLog: DayLog = {
      date,
      sessions: [...(existingLog?.sessions || []), session],
      lastUpdated: new Date().toISOString()
    }
    
    await setDoc(dayRef, updatedLog)
  } catch (error) {
    console.error('Error adding session:', error)
    throw error
  }
}

export const updateSession = async (
  userId: string,
  date: string,
  sessionIndex: number,
  updates: Partial<Session>
): Promise<void> => {
  try {
    const [year, month, day] = date.split('-')
    const dayRef = doc(db, 'users', userId, 'logs', year, 'months', month, 'days', day)
    
    const existingLog = await getDayLog(userId, date)
    
    if (!existingLog || !existingLog.sessions[sessionIndex]) {
      throw new Error('Session not found')
    }
    
    // Update session
    existingLog.sessions[sessionIndex] = {
      ...existingLog.sessions[sessionIndex],
      ...updates
    }
    
    existingLog.lastUpdated = new Date().toISOString()
    
    await setDoc(dayRef, existingLog)
  } catch (error) {
    console.error('Error updating session:', error)
    throw error
  }
}

// Get all days in a month that have sessions (for calendar indicators)
export const getMonthDaysWithSessions = async (
  userId: string,
  year: string,
  month: string
): Promise<string[]> => {
  try {
    const monthRef = collection(db, 'users', userId, 'logs', year, 'months', month, 'days')
    const querySnapshot = await getDocs(query(monthRef))
    
    const days: string[] = []
    querySnapshot.forEach((doc) => {
      days.push(doc.id)
    })
    
    return days
  } catch (error) {
    console.error('Error getting month days:', error)
    return []
  }
}
