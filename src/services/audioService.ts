/**
 * Audio Service
 * Handle audio recording, compression, and storage
 * Supports chunked storage for longer recordings (unlimited duration)
 * Stores voice recordings as Base64 in Firebase Realtime Database
 */

import { saveAudio as saveAudioToDb, saveAudioChunk, getAudio, getAudioChunks } from './firebaseService'

// Maximum size per chunk in bytes (500KB)
const MAX_CHUNK_SIZE_BYTES = 500 * 1024

// Maximum base64 characters per chunk (accounting for base64 overhead: 4/3 ratio)
const MAX_CHUNK_BASE64_LENGTH = Math.floor(MAX_CHUNK_SIZE_BYTES * 4 / 3)

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
 * Calculate base64 size in bytes
 */
export function getBase64SizeBytes(base64: string): number {
  const base64Data = base64.split(',')[1] || base64
  const padding = base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0
  return (base64Data.length * 3) / 4 - padding
}

/**
 * Split base64 string into chunks
 * Each chunk is max 500KB when decoded
 */
export function splitBase64IntoChunks(base64: string): string[] {
  // Get the data URL prefix (e.g., "data:audio/webm;base64,")
  const commaIndex = base64.indexOf(',')
  const prefix = base64.substring(0, commaIndex + 1)
  const base64Data = base64.substring(commaIndex + 1)
  
  const chunks: string[] = []
  
  // Split the base64 data into chunks
  for (let i = 0; i < base64Data.length; i += MAX_CHUNK_BASE64_LENGTH) {
    const chunkData = base64Data.substring(i, i + MAX_CHUNK_BASE64_LENGTH)
    // Only first chunk gets the prefix, others are raw base64 data
    chunks.push(i === 0 ? prefix + chunkData : chunkData)
  }
  
  return chunks
}

/**
 * Recombine base64 chunks into a single base64 string
 */
export function recombineBase64Chunks(chunks: string[]): string {
  if (chunks.length === 0) return ''
  if (chunks.length === 1) return chunks[0]
  
  // First chunk has the prefix
  const firstChunk = chunks[0]
  const commaIndex = firstChunk.indexOf(',')
  const prefix = firstChunk.substring(0, commaIndex + 1)
  const firstData = firstChunk.substring(commaIndex + 1)
  
  // Combine all data
  const allData = [firstData, ...chunks.slice(1)].join('')
  
  return prefix + allData
}

/**
 * Upload session audio recording with chunked storage
 * Splits audio into 500KB chunks for unlimited duration support
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
  const totalSize = getBase64SizeBytes(base64)
  
  // Split into chunks (even small audio uses chunked format for consistency)
  const chunks = splitBase64IntoChunks(base64)
  const chunkCount = chunks.length
  
  console.log(`[AudioService] Storing audio in ${chunkCount} chunk(s) (total: ${(totalSize / 1024).toFixed(1)} KB, duration: ${duration.toFixed(1)}s)`)
  
  // Save metadata first
  const audioId = await saveAudioToDb(userId, {
    createdAt: Date.now(),
    size: totalSize,
    duration,
    mimeType: audioBlob.type || 'audio/webm',
    sessionTimestamp,
    date,
    chunkCount,
    chunkIds: [] // Will be populated as chunks are saved
  })
  
  // Save each chunk
  const chunkIds: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    const chunkSize = getBase64SizeBytes(chunks[i])
    const chunkId = await saveAudioChunk(userId, {
      audioId,
      chunkIndex: i,
      base64: chunks[i],
      size: chunkSize
    })
    chunkIds.push(chunkId)
    console.log(`[AudioService] Saved chunk ${i + 1}/${chunkCount}: ${chunkId} (${(chunkSize / 1024).toFixed(1)} KB)`)
  }
  
  // Update audio metadata with chunk IDs
  await saveAudioToDb(userId, {
    createdAt: Date.now(),
    size: totalSize,
    duration,
    mimeType: audioBlob.type || 'audio/webm',
    sessionTimestamp,
    date,
    chunkCount,
    chunkIds
  }, audioId)
  
  console.log(`[AudioService] Audio saved: ${audioId}, ${chunkCount} chunk(s), total: ${(totalSize / 1024).toFixed(1)} KB, duration: ${duration.toFixed(1)}s`)
  
  return audioId
}

/**
 * Retrieve and recombine chunked audio
 * Returns the full base64 string ready for playback
 */
export async function getFullAudioBase64(
  userId: string,
  audioId: string
): Promise<{ base64: string; mimeType: string; duration: number } | null> {
  const audio = await getAudio(userId, audioId)
  
  if (!audio) {
    console.warn(`[AudioService] Audio not found: ${audioId}`)
    return null
  }
  
  if (!audio.chunkIds || audio.chunkIds.length === 0) {
    console.warn(`[AudioService] Audio ${audioId} has no chunks`)
    return null
  }
  
  // Fetch and recombine chunks
  const chunks = await getAudioChunks(userId, audio.chunkIds)
  
  if (chunks.length !== audio.chunkCount) {
    console.error(`[AudioService] Missing chunks: expected ${audio.chunkCount}, got ${chunks.length}`)
    return null
  }
  
  // Sort by chunk index
  chunks.sort((a, b) => a.chunkIndex - b.chunkIndex)
  
  // Recombine
  const base64 = recombineBase64Chunks(chunks.map(c => c.base64))
  
  console.log(`[AudioService] Recombined ${chunks.length} chunk(s) for audio ${audioId}`)
  
  return {
    base64,
    mimeType: audio.mimeType,
    duration: audio.duration
  }
}

/**
 * Check if audio recording is supported
 */
export function isAudioRecordingSupported(): boolean {
  return typeof navigator.mediaDevices?.getUserMedia === 'function' && 
         typeof MediaRecorder !== 'undefined'
}
