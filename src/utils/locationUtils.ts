/**
 * Location Utilities
 * GPS coordinate capture using browser Geolocation API (free, no API key needed)
 */

import { Location } from '../types'

/**
 * Get current GPS coordinates
 * Returns null if:
 * - User denies permission
 * - Geolocation not supported
 * - Timeout or error occurs
 * 
 * Uses high accuracy for better results on mobile devices
 */
export function getCurrentLocation(): Promise<Location | null> {
  return new Promise((resolve) => {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      console.warn('[Location] Geolocation not supported by browser')
      resolve(null)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: Location = {
          lat: Math.round(position.coords.latitude * 1000000) / 1000000, // 6 decimal places (~11cm precision)
          lng: Math.round(position.coords.longitude * 1000000) / 1000000
        }
        console.log('[Location] Got coordinates:', location)
        resolve(location)
      },
      (error) => {
        // Don't log as error - user may have just denied permission
        switch (error.code) {
          case error.PERMISSION_DENIED:
            console.log('[Location] Permission denied by user')
            break
          case error.POSITION_UNAVAILABLE:
            console.log('[Location] Position unavailable')
            break
          case error.TIMEOUT:
            console.log('[Location] Request timed out')
            break
          default:
            console.log('[Location] Unknown error:', error.message)
        }
        resolve(null)
      },
      {
        enableHighAccuracy: true,  // Use GPS on mobile for better accuracy
        timeout: 10000,            // 10 second timeout
        maximumAge: 60000          // Cache for 1 minute (for quick re-logs)
      }
    )
  })
}

/**
 * Check if location permission has been granted
 * Returns: 'granted' | 'denied' | 'prompt' | 'unsupported'
 */
export async function getLocationPermissionStatus(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  if (!navigator.geolocation) {
    return 'unsupported'
  }

  // Check if Permissions API is available
  if ('permissions' in navigator) {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' })
      return result.state
    } catch {
      // Permissions API failed, assume prompt
      return 'prompt'
    }
  }

  // Fallback: assume prompt (will trigger permission dialog when requested)
  return 'prompt'
}

/**
 * Format location for display
 * Returns a short string like "28.6°N, 77.2°E"
 */
export function formatLocationShort(location: Location | undefined): string {
  if (!location) return ''
  
  const latDir = location.lat >= 0 ? 'N' : 'S'
  const lngDir = location.lng >= 0 ? 'E' : 'W'
  
  return `${Math.abs(location.lat).toFixed(2)}°${latDir}, ${Math.abs(location.lng).toFixed(2)}°${lngDir}`
}

/**
 * Generate Google Maps URL for a location
 */
export function getGoogleMapsUrl(location: Location): string {
  return `https://www.google.com/maps?q=${location.lat},${location.lng}`
}
