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
 * 
 * @param file - Image file from input
 * @param maxSizeKB - Maximum size in kilobytes (default: 100 KB)
 * @param initialQuality - Starting quality (default: 92)
 * @returns Base64 string (data:image/jpeg;base64,...)
 */
export async function compressImageToBase64(
  file: File,
  maxSizeKB: number = 100,
  initialQuality: number = 92
): Promise<string> {
  const maxSizeBytes = maxSizeKB * 1024
  
  // Step 1: Read file as data URL
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      if (!e.target?.result) {
        reject(new Error('Failed to read image file: no data returned'))
        return
      }
      resolve(e.target.result as string)
    }
    reader.onerror = () => reject(new Error('Failed to read file from device storage.'))
    reader.readAsDataURL(file)
  })
  
  // Step 2: Load image and wait for it to be fully decoded
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = async () => {
      try {
        if (image.decode) {
          await image.decode()
        }
        resolve(image)
      } catch {
        resolve(image) // decode() might fail on some browsers, continue anyway
      }
    }
    image.onerror = () => reject(new Error('Failed to load image. The file may be corrupted or in an unsupported format.'))
    image.src = dataUrl
  })
  
  // Step 3: Compress iteratively
  console.log(`[ImageService] Original: ${img.width}x${img.height}`)
  
  let quality = initialQuality
  let scaleFactor = 1.0
  let base64String = ''
  let sizeInBytes = Infinity
  
  const maxDimension = 1600 // Universal max dimension
  const maxIterations = 15
  
  // Reuse single canvas
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    throw new Error('Canvas 2D context not supported on this device')
  }
  
  for (let i = 0; i < maxIterations && sizeInBytes > maxSizeBytes; i++) {
    // Calculate dimensions
    let width = img.width * scaleFactor
    let height = img.height * scaleFactor
    
    // Apply max dimension constraint
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = (height / width) * maxDimension
        width = maxDimension
      } else {
        width = (width / height) * maxDimension
        height = maxDimension
      }
    }
    
    width = Math.max(100, Math.floor(width))
    height = Math.max(100, Math.floor(height))
    
    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    
    base64String = canvas.toDataURL('image/jpeg', quality / 100)
    
    // Calculate size
    const base64Data = base64String.split(',')[1]
    if (!base64Data) throw new Error('Invalid base64 format')
    
    const padding = base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0
    sizeInBytes = (base64Data.length * 3) / 4 - padding
    
    console.log(`[ImageService] ${i + 1}: ${width}x${height}, Q${quality}%, ${(sizeInBytes / 1024).toFixed(1)} KB`)
    
    // Adjust for next iteration if needed
    if (sizeInBytes > maxSizeBytes) {
      if (quality > 50) {
        quality -= 10
      } else {
        quality = Math.max(20, quality - 5)
        scaleFactor *= 0.85
      }
    }
  }
  
  // Allow up to 2x target size (better to save than fail)
  if (sizeInBytes > maxSizeBytes * 2) {
    throw new Error(`Image too large: ${(sizeInBytes / 1024).toFixed(0)} KB. Max: ${maxSizeKB} KB`)
  }
  
  console.log(`[ImageService] Done: ${(sizeInBytes / 1024).toFixed(1)} KB`)
  return base64String
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
  
  // Compress (target: 100 KB for good quality)
  const base64 = await compressImageToBase64(file)
  const sizeBytes = Math.floor((base64.length * 3) / 4)
  
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
  
  // Compress (target: 100 KB for good quality)
  const base64 = await compressImageToBase64(file)
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
