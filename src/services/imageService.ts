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
        // Detect device type for adaptive compression
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        
        console.log(`[ImageService] Original image: ${img.width}x${img.height}, Device: ${isIOS ? 'iOS' : isMobile ? 'Mobile' : 'Desktop'}`)
        
        let quality = initialQuality
        let base64String = ''
        let sizeInBytes = Infinity
        let iterations = 0
        const maxIterations = 20 // Allow more iterations for difficult images
        
        // Adaptive starting dimensions based on device
        // iOS Safari produces larger files, so start with smaller dimensions
        let maxDimension = isIOS ? 1200 : isMobile ? 1400 : 1920
        let scaleFactor = 1.0 // For progressive dimension reduction
        
        // Iteratively compress until under size limit
        while (sizeInBytes > maxSizeBytes && iterations < maxIterations) {
          iterations++
          
          // Create canvas with max dimensions
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          // Check if canvas context is available (can be null on some devices)
          if (!ctx) {
            reject(new Error('Canvas 2D context not supported on this device'))
            return
          }
          
          // Calculate dimensions with progressive scaling
          let width = img.width * scaleFactor
          let height = img.height * scaleFactor
          
          // Apply max dimension constraint
          const currentMaxDim = maxDimension * scaleFactor
          if (width > currentMaxDim || height > currentMaxDim) {
            if (width > height) {
              height = (height / width) * currentMaxDim
              width = currentMaxDim
            } else {
              width = (width / height) * currentMaxDim
              height = currentMaxDim
            }
          }
          
          // Ensure dimensions are at least 100px
          width = Math.max(100, Math.floor(width))
          height = Math.max(100, Math.floor(height))
          
          canvas.width = width
          canvas.height = height
          
          // Draw image on canvas
          ctx.drawImage(img, 0, 0, width, height)
          
          // Use toDataURL for consistency across devices (toBlob behaves differently on iOS)
          // toDataURL is more predictable and reliable
          base64String = canvas.toDataURL('image/jpeg', quality / 100)
          
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
          
          console.log(
            `[ImageService] Iteration ${iterations}: ` +
            `${width}x${height}, Quality ${quality}%, ` +
            `Scale ${(scaleFactor * 100).toFixed(0)}%, ` +
            `Size ${(sizeInBytes / 1024).toFixed(2)} KB`
          )
          
          // Adaptive compression strategy
          if (sizeInBytes > maxSizeBytes) {
            if (iterations <= 3) {
              // First few iterations: reduce quality aggressively
              quality -= 15
            } else if (iterations <= 8) {
              // Middle iterations: reduce quality and dimensions
              quality -= 10
              scaleFactor *= 0.9 // Reduce dimensions by 10%
            } else {
              // Later iterations: aggressive dimension reduction
              quality = Math.max(5, quality - 5)
              scaleFactor *= 0.85 // Reduce dimensions by 15%
            }
            
            // Safety bounds
            quality = Math.max(5, quality)
            scaleFactor = Math.max(0.2, scaleFactor) // Don't go below 20% of original
          }
        }
        
        // More lenient size check - allow up to 3x the target size
        // (Better to save a slightly larger image than fail completely)
        if (sizeInBytes > maxSizeBytes * 3) {
          reject(new Error(
            `Image is too large even after ${iterations} compression attempts. ` +
            `Final size: ${(sizeInBytes / 1024).toFixed(2)} KB, ` +
            `Maximum allowed: ${maxSizeKB} KB. ` +
            `Original image: ${img.width}x${img.height}. ` +
            `Please use a smaller image or take a new photo.`
          ))
          return
        }
        
        if (iterations >= maxIterations) {
          console.warn(`[ImageService] Max iterations (${maxIterations}) reached. Final size: ${(sizeInBytes / 1024).toFixed(2)} KB`)
        }
        
        if (sizeInBytes > maxSizeBytes && sizeInBytes <= maxSizeBytes * 3) {
          console.warn(
            `[ImageService] Image slightly over target size but acceptable. ` +
            `Final: ${(sizeInBytes / 1024).toFixed(2)} KB, Target: ${maxSizeKB} KB`
          )
        }
        
        console.log(`[ImageService] Compression successful! Final size: ${(sizeInBytes / 1024).toFixed(2)} KB after ${iterations} iterations`)
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
