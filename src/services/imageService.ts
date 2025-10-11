/**
 * Image Service
 * Compress and convert images to Base64 for storage in Realtime Database
 * Images are stored separately from session data for efficient Gemini AI queries
 * Based on Flutter implementation strategy
 */

import { saveImage } from './dataManager'

/**
 * Check if browser supports WebP format
 * WebP provides 25-35% better compression than JPEG at same quality
 */
async function checkWebPSupport(): Promise<boolean> {
  // Check if we've already tested
  if (typeof (window as any).__webpSupport !== 'undefined') {
    return (window as any).__webpSupport
  }
  
  return new Promise((resolve) => {
    const webpData = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA='
    const img = new Image()
    
    img.onload = () => {
      const result = img.width === 1 && img.height === 1
      ;(window as any).__webpSupport = result
      resolve(result)
    }
    
    img.onerror = () => {
      ;(window as any).__webpSupport = false
      resolve(false)
    }
    
    img.src = webpData
  })
}

/**
 * Compress image file to Base64 string with smart quality preservation
 * Uses WebP format (30-50% smaller than JPEG) with JPEG fallback
 * Adaptively reduces dimensions and quality to meet size target
 * 
 * @param file - Image file from input
 * @param maxSizeKB - Maximum size in kilobytes (default: 30 KB)
 * @param initialQuality - Starting quality (default: 90 for better quality)
 * @returns Base64 string (data:image/webp;base64,... or data:image/jpeg;base64,...)
 */
export async function compressImageToBase64(
  file: File,
  maxSizeKB: number = 30,
  initialQuality: number = 90 // Start at 90 for better quality
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
        // Check WebP support (30-50% better compression than JPEG)
        const supportsWebP = await checkWebPSupport()
        const format = supportsWebP ? 'image/webp' : 'image/jpeg'
        
        console.log(`[ImageService] Original: ${img.width}x${img.height}, Format: ${format}`)
        
        let quality = initialQuality
        let base64String = ''
        let sizeInBytes = Infinity
        let iterations = 0
        const maxIterations = 20
        
        // Start with good dimensions - WebP allows larger since it's more efficient
        let maxDimension = supportsWebP ? 1600 : 1400
        let scaleFactor = 1.0
        
        // Calculate aspect ratio for smart scaling
        const aspectRatio = img.width / img.height
        const isLandscape = aspectRatio > 1
        
        // Iteratively compress until under size limit
        while (sizeInBytes > maxSizeBytes && iterations < maxIterations) {
          iterations++
          
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d', { 
            alpha: false, // No transparency = smaller file
            desynchronized: true
          })
          
          if (!ctx) {
            reject(new Error('Canvas 2D context not supported on this device'))
            return
          }
          
          // Calculate dimensions with smart scaling
          let width = img.width * scaleFactor
          let height = img.height * scaleFactor
          
          // Apply max dimension constraint (respect aspect ratio)
          const currentMaxDim = maxDimension * scaleFactor
          if (isLandscape) {
            if (width > currentMaxDim) {
              height = (height / width) * currentMaxDim
              width = currentMaxDim
            }
          } else {
            if (height > currentMaxDim) {
              width = (width / height) * currentMaxDim
              height = currentMaxDim
            }
          }
          
          // Ensure reasonable minimum size
          width = Math.max(200, Math.floor(width))
          height = Math.max(200, Math.floor(height))
          
          canvas.width = width
          canvas.height = height
          
          // High-quality rendering
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          
          // Draw and compress
          ctx.drawImage(img, 0, 0, width, height)
          base64String = canvas.toDataURL(format, quality / 100)
          
          // Validate
          if (!base64String || !base64String.includes('base64,')) {
            reject(new Error('Image compression produced invalid base64 data'))
            return
          }
          
          const base64Data = base64String.split(',')[1]
          if (!base64Data) {
            reject(new Error('Invalid base64 format after compression'))
            return
          }
          
          // Calculate actual size
          const padding = base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0
          sizeInBytes = (base64Data.length * 3) / 4 - padding
          
          console.log(
            `[ImageService] Iteration ${iterations}: ` +
            `${width}x${height}, Quality ${quality}%, ` +
            `Size ${(sizeInBytes / 1024).toFixed(2)} KB`
          )
          
          // Simple sequential reduction strategy
          if (sizeInBytes > maxSizeBytes) {
            const overSizeRatio = sizeInBytes / maxSizeBytes
            
            if (overSizeRatio > 2.0) {
              // Way too large: reduce both aggressively
              quality -= 15
              scaleFactor *= 0.85
            } else if (overSizeRatio > 1.5) {
              // Moderately large: balanced reduction
              quality -= 10
              scaleFactor *= 0.92
            } else if (overSizeRatio > 1.2) {
              // Slightly large: focus on quality first
              quality -= 8
              scaleFactor *= 0.96
            } else {
              // Very close: gentle quality reduction only
              quality -= 5
            }
            
            // Keep quality reasonable (WebP maintains better quality at lower settings)
            quality = Math.max(supportsWebP ? 55 : 45, quality)
            scaleFactor = Math.max(0.3, scaleFactor)
          }
        }
        
        // Check if we achieved acceptable size
        if (sizeInBytes > maxSizeBytes * 3) {
          reject(new Error(
            `Image is too large even after ${iterations} compression attempts. ` +
            `Final size: ${(sizeInBytes / 1024).toFixed(2)} KB, ` +
            `Maximum allowed: ${maxSizeKB} KB. ` +
            `Original: ${img.width}x${img.height}. ` +
            `Please use a smaller image.`
          ))
          return
        }
        
        if (sizeInBytes > maxSizeBytes && sizeInBytes <= maxSizeBytes * 3) {
          console.warn(
            `[ImageService] Image slightly over target but acceptable. ` +
            `Final: ${(sizeInBytes / 1024).toFixed(2)} KB (Target: ${maxSizeKB} KB)`
          )
        }
        
        console.log(
          `[ImageService] ✅ Compression successful! ` +
          `Final: ${(sizeInBytes / 1024).toFixed(2)} KB after ${iterations} iterations ` +
          `(${supportsWebP ? 'WebP' : 'JPEG'} format)`
        )
        
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
