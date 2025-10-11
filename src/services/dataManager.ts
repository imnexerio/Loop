/**
 * Data Manager - Simple re-exports from firebaseService
 * Kept for backward compatibility with existing components
 */

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
  getImagesForDate,
  subscribeToImages
} from './firebaseService'

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
