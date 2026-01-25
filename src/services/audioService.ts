/**
 * Audio Service
 * Handle audio recording, compression, and storage
 * Stores voice recordings as Base64 in Firebase Realtime Database
 */

import { saveAudio as saveAudioToDb } from './firebaseService'

/**
 * Convert audio blob to Base64 string
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (reader.result) {
        resolve(reader.result as string)
      } else {
        reject(new Error('Failed to convert blob to base64'))
      }
    }
    reader.onerror = () => reject(new Error('FileReader error'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Get the best supported audio MIME type for recording
 * Prefers WebM/Opus for smaller file sizes
 */
export function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/wav'
  ]
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  
  // Fallback - let browser decide
  return ''
}

/**
 * Calculate approximate duration from blob size and bitrate
 * Used as fallback if duration isn't available
 */
export function estimateDuration(sizeBytes: number, bitrate: number = 64000): number {
  // bitrate is in bits per second
  // sizeBytes * 8 = bits
  // bits / bitrate = seconds
  return (sizeBytes * 8) / bitrate
}

/**
 * Compress audio if it's too large
 * Note: Browser-based audio compression is limited
 * We mainly rely on low bitrate recording settings
 * 
 * Max size target: 500KB for ~30 seconds of speech
 */
export async function validateAudioSize(
  base64: string,
  maxSizeKB: number = 500
): Promise<{ valid: boolean; size: number; error?: string }> {
  // Calculate size from base64
  const base64Data = base64.split(',')[1] || base64
  const padding = base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0
  const sizeBytes = (base64Data.length * 3) / 4 - padding
  const sizeKB = sizeBytes / 1024
  
  if (sizeKB > maxSizeKB) {
    return {
      valid: false,
      size: sizeBytes,
      error: `Audio too large (${sizeKB.toFixed(1)} KB). Maximum ${maxSizeKB} KB. Try a shorter recording.`
    }
  }
  
  return { valid: true, size: sizeBytes }
}

/**
 * Upload session audio recording
 * Converts blob to base64 and saves to Firebase
 * 
 * @param userId - User ID
 * @param date - Session date (YYYY-MM-DD)
 * @param sessionTimestamp - Timestamp of the session
 * @param audioBlob - Recorded audio blob
 * @param duration - Recording duration in seconds
 * @returns Audio ID for reference in session
 */
export async function uploadSessionAudio(
  userId: string,
  date: string,
  sessionTimestamp: number,
  audioBlob: Blob,
  duration: number
): Promise<string> {
  // Convert to base64
  const base64 = await blobToBase64(audioBlob)
  
  // Validate size (max 500KB)
  const validation = await validateAudioSize(base64, 500)
  if (!validation.valid) {
    throw new Error(validation.error)
  }
  
  // Save to Firebase
  const audioId = await saveAudioToDb(userId, {
    base64,
    createdAt: Date.now(),
    size: validation.size,
    duration,
    mimeType: audioBlob.type || 'audio/webm',
    sessionTimestamp,
    date
  })
  
  console.log(`[AudioService] Audio saved: ${audioId}, size: ${(validation.size / 1024).toFixed(1)} KB, duration: ${duration.toFixed(1)}s`)
  
  return audioId
}

/**
 * Check if audio recording is supported
 */
export function isAudioRecordingSupported(): boolean {
  return typeof navigator.mediaDevices?.getUserMedia === 'function' && 
         typeof MediaRecorder !== 'undefined'
}
