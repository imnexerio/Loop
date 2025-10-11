/**
 * Image Service
 * Compress and convert images to Base64 for storage in Realtime Database
 * Images are stored separately from session data for efficient Gemini AI queries
 * Based on Flutter implementation strategy
 */

import { saveImage, updateSessionImage } from './dataManager'
import type { StoredImage } from '../types'

/**
 * Compress image file to Base64 string
 * Iteratively reduces quality until size is under maxSizeKB
 * Similar to Flutter's FlutterImageCompress approach
 * 
 * @param file - Image file from input
 * @param maxSizeKB - Maximum size in kilobytes (default: 30 KB)
 * @param initialQuality - Starting quality (default: 100)
 * @returns Base64 string (data:image/jpeg;base64,...)
 */
export async function compressImageToBase64(
  file: File,
  maxSizeKB: number = 30,
  initialQuality: number = 100
): Promise<string> {
  const maxSizeBytes = maxSizeKB * 1024
  
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    
    reader.onload = (e) => {
      img.src = e.target?.result as string
    }
    
    img.onload = async () => {
      let quality = initialQuality
      let base64String = ''
      let sizeInBytes = Infinity
      
      // Iteratively compress until under size limit
      while (sizeInBytes > maxSizeBytes && quality > 0) {
        // Create canvas with max dimensions (optional resize)
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!
        
        // Optional: Resize to max dimensions (similar to minWidth/minHeight in Flutter)
        const maxDimension = 1920
        let width = img.width
        let height = img.height
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension
            width = maxDimension
          } else {
            width = (width / height) * maxDimension
            height = maxDimension
          }
        }
        
        canvas.width = width
        canvas.height = height
        
        // Draw image on canvas
        ctx.drawImage(img, 0, 0, width, height)
        
        // Convert to Base64 with quality
        base64String = canvas.toBlob 
          ? await new Promise<string>((res) => {
              canvas.toBlob(
                (blob) => {
                  if (!blob) {
                    res('')
                    return
                  }
                  const blobReader = new FileReader()
                  blobReader.onload = () => res(blobReader.result as string)
                  blobReader.readAsDataURL(blob)
                },
                'image/jpeg',
                quality / 100
              )
            })
          : canvas.toDataURL('image/jpeg', quality / 100)
        
        // Calculate size
        const base64Data = base64String.split(',')[1]
        sizeInBytes = (base64Data.length * 3) / 4 // Base64 to byte size
        
        console.log(`[ImageService] Quality: ${quality}%, Size: ${(sizeInBytes / 1024).toFixed(2)} KB`)
        
        // Decrease quality for next iteration
        quality -= 10
        
        // Safety check to prevent infinite loop
        if (quality < 10 && sizeInBytes > maxSizeBytes) {
          console.warn('[ImageService] Could not compress below size limit, using lowest quality')
          break
        }
      }
      
      if (sizeInBytes > maxSizeBytes * 2) {
        reject(new Error(`Image too large even after compression (${(sizeInBytes / 1024).toFixed(2)} KB)`))
        return
      }
      
      resolve(base64String)
    }
    
    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    
    reader.readAsDataURL(file)
  })
}

/**
 * Simple file to Base64 without compression
 * For very small files or when compression is not needed
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Get image dimensions from file
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    
    reader.onload = (e) => {
      img.src = e.target?.result as string
    }
    
    img.onload = () => {
      resolve({ width: img.width, height: img.height })
    }
    
    img.onerror = reject
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Please upload JPG, PNG, WEBP, or GIF' }
  }
  
  // Check file size (10 MB max before compression)
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    return { valid: false, error: 'File too large. Maximum 10 MB' }
  }
  
  return { valid: true }
}

// ============================================
// HIGH-LEVEL HELPER FUNCTIONS
// ============================================

/**
 * Upload session image (compress + save + link to session)
 * All-in-one helper function
 */
export async function uploadSessionImage(
  userId: string,
  date: string,
  sessionTimestamp: number,
  file: File
): Promise<string> {
  // Validate
  const validation = validateImageFile(file)
  if (!validation.valid) {
    throw new Error(validation.error)
  }
  
  // Compress
  const base64 = await compressImageToBase64(file, 30)
  const sizeBytes = Math.floor((base64.length * 3) / 4) // Approximate size
  
  // Save to separate storage
  const imageId = await saveImage(userId, {
    type: 'session',
    base64,
    createdAt: Date.now(),
    size: sizeBytes,
    sessionTimestamp,
    date
  })
  
  // Link to session
  await updateSessionImage(userId, date, sessionTimestamp, imageId)
  
  return imageId
}

/**
 * Upload profile picture (compress + save + return ID)
 */
export async function uploadProfilePicture(
  userId: string,
  file: File
): Promise<string> {
  // Validate
  const validation = validateImageFile(file)
  if (!validation.valid) {
    throw new Error(validation.error)
  }
  
  // Compress
  const base64 = await compressImageToBase64(file, 30)
  const sizeBytes = Math.floor((base64.length * 3) / 4)
  
  // Save to separate storage
  const imageId = await saveImage(userId, {
    type: 'profile',
    base64,
    createdAt: Date.now(),
    size: sizeBytes
  })
  
  return imageId
}
