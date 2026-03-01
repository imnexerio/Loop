/**
 * Data Manager - Simple re-exports from firebaseService
 * Kept for backward compatibility with existing components
 */

import { getAudio as getAudioFromDb, getAudioChunks } from './firebaseService'
import { recombineBase64Chunks } from './audioService'
import { StoredAudio } from '../types'

export {
  // Tags
  getTags,
  createTag as createTagCached,
  deleteTag as deleteTagCached,
  subscribeToTags,
  
  // Sessions
  getDayLog as getDayLogCached,
  addSession as addSessionCached,
  deleteSession,
  subscribeToDayLog,
  updateSessionImage,
  
  // Calendar
  getMonthDaysWithSessions as getMonthDaysWithSessionsCached,
  subscribeToMonth,
  
  // Analytics
  getTagDataRange as getChartDataCached,
  type AggregationType,
  
  // Profile
  getUserProfile,
  createUserProfile,
  updateUserProfile,
  subscribeToProfile,
  
  // Images
  saveImage,
  getImage,
  deleteImage,
  getAllImages,
  subscribeToImages,
  
  // Audio (raw Firebase access)
  saveAudio,
  deleteAudio
} from './firebaseService'

/**
 * Get audio with automatic chunk recombination
 */
export async function getAudio(
  userId: string,
  audioId: string
): Promise<(StoredAudio & { base64: string }) | null> {
  const audio = await getAudioFromDb(userId, audioId)
  
  if (!audio) {
    return null
  }
  
  if (!audio.chunkIds || audio.chunkIds.length === 0) {
    console.warn(`[DataManager] Audio ${audioId} has no chunks`)
    return null
  }
  
  try {
    const chunks = await getAudioChunks(userId, audio.chunkIds)
    
    if (chunks.length !== audio.chunkCount) {
      console.error(`[DataManager] Missing audio chunks: expected ${audio.chunkCount}, got ${chunks.length}`)
      return null
    }
    
    // Sort by chunk index
    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex)
    
    // Recombine
    const base64 = recombineBase64Chunks(chunks.map(c => c.base64))
    
    console.log(`[DataManager] Recombined ${chunks.length} chunk(s) for audio ${audioId}`)
    
    return {
      ...audio,
      base64
    }
  } catch (error) {
    console.error('[DataManager] Error recombining audio chunks:', error)
    return null
  }
}

// Deprecated - no longer used with real-time database
export function clearAllCaches() {
  console.warn('[DataManager] clearAllCaches is deprecated - no caching with real-time listeners')
}

export function clearCache() {
  console.warn('[DataManager] clearCache is deprecated - no caching with real-time listeners')
}

export function getCacheStats() {
  console.warn('[DataManager] getCacheStats is deprecated - no caching with real-time listeners')
  return { message: 'No caching with real-time listeners' }
}
