/**
 * Image Service
 * Compress and convert images to Base64 for storage in Realtime Database
 * Images are stored separately from session data for efficient Gemini AI queries
 * Based on Flutter implementation strategy
 */

import { saveImage } from './dataManager'

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
      if (!e.target?.result) {
        reject(new Error('Failed to read image file: no data returned'))
        return
      }
      img.src = e.target.result as string
    }
    
    img.onload = async () => {
      try {
        let quality = initialQuality
        let base64String = ''
        let sizeInBytes = Infinity
        let iterations = 0
        const maxIterations = 15 // Prevent infinite loops
        
        // Iteratively compress until under size limit
        while (sizeInBytes > maxSizeBytes && quality >= 5 && iterations < maxIterations) {
          iterations++
          
          // Create canvas with max dimensions (optional resize)
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          // Check if canvas context is available (can be null on some devices)
          if (!ctx) {
            reject(new Error('Canvas 2D context not supported on this device'))
            return
          }
          
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
          // Try toBlob first (better quality), fallback to toDataURL
          if (typeof canvas.toBlob === 'function') {
            try {
              base64String = await new Promise<string>((res, rej) => {
                canvas.toBlob(
                  (blob) => {
                    if (!blob) {
                      rej(new Error('Blob conversion failed'))
                      return
                    }
                    const blobReader = new FileReader()
                    blobReader.onload = () => res(blobReader.result as string)
                    blobReader.onerror = () => rej(new Error('Failed to read blob'))
                    blobReader.readAsDataURL(blob)
                  },
                  'image/jpeg',
                  quality / 100
                )
              })
            } catch (blobError) {
              console.warn('[ImageService] toBlob failed, using toDataURL fallback:', blobError)
              base64String = canvas.toDataURL('image/jpeg', quality / 100)
            }
          } else {
            // Fallback for browsers that don't support toBlob
            base64String = canvas.toDataURL('image/jpeg', quality / 100)
          }
          
          // Validate base64 string
          if (!base64String || !base64String.includes('base64,')) {
            reject(new Error('Image compression produced invalid base64 data'))
            return
          }
          
          // Calculate actual size from base64 string
          const base64Data = base64String.split(',')[1]
          if (!base64Data) {
            reject(new Error('Invalid base64 format after compression'))
            return
          }
          
          // More accurate size calculation
          const padding = base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0
          sizeInBytes = (base64Data.length * 3) / 4 - padding
          
          console.log(`[ImageService] Iteration ${iterations}: Quality ${quality}%, Size ${(sizeInBytes / 1024).toFixed(2)} KB`)
          
          // Decrease quality for next iteration
          if (sizeInBytes > maxSizeBytes) {
            quality -= 10
          }
        }
        
        // Check if compression was successful
        if (sizeInBytes > maxSizeBytes * 2) {
          reject(new Error(
            `Image is too large even after compression. ` +
            `Final size: ${(sizeInBytes / 1024).toFixed(2)} KB, ` +
            `Maximum allowed: ${maxSizeKB} KB. ` +
            `Please use a smaller image.`
          ))
          return
        }
        
        if (iterations >= maxIterations) {
          console.warn(`[ImageService] Max iterations reached. Final size: ${(sizeInBytes / 1024).toFixed(2)} KB`)
        }
        
        console.log(`[ImageService] Compression successful! Final size: ${(sizeInBytes / 1024).toFixed(2)} KB`)
        resolve(base64String)
        
      } catch (error) {
        reject(new Error(`Image compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
      }
    }
    
    img.onerror = () => {
      reject(new Error('Failed to load image. The file may be corrupted or in an unsupported format.'))
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read file from device storage.'))
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
 * Upload session image (compress + save + return ID)
 * Note: Does NOT link to session - session should be created with imageId
 * This allows image upload BEFORE session creation
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
  
  // Return imageId - session will be created with this ID
  console.log(`[ImageService] Image saved successfully: ${imageId}`)
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
