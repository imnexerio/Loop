import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { getUserProfile, updateUserProfile } from '../services/firebaseService'

// Module-level variable for unlock state - resets on every page load/refresh
// This ensures PIN is required on every new page load
let isUnlockedThisSession = false

const PIN_ATTEMPTS_KEY = 'loop_pin_attempts'
const MAX_ATTEMPTS = 5

interface PinContextType {
  // State
  isLocked: boolean
  isPinEnabled: boolean
  isLoading: boolean
  attemptsRemaining: number
  
  // Actions
  verifyPin: (pin: string) => Promise<{ success: boolean; attemptsRemaining: number }>
  setupPin: (pin: string) => Promise<void>
  changePin: (currentPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>
  removePin: (currentPin: string) => Promise<{ success: boolean; error?: string }>
  forgotPin: () => Promise<void>
  
  // For checking PIN during setup flows
  verifyCurrentPin: (pin: string) => Promise<boolean>
}

const PinContext = createContext<PinContextType | undefined>(undefined)

export const usePin = () => {
  const context = useContext(PinContext)
  if (!context) {
    throw new Error('usePin must be used within a PinProvider')
  }
  return context
}

interface PinProviderProps {
  children: ReactNode
}

/**
 * Hash a PIN using SHA-256
 * This is a client-side hash for storage
 */
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

/**
 * Get unlock state from module-level variable
 * Resets on every page load/refresh
 */
function getUnlockState(): boolean {
  return isUnlockedThisSession
}

/**
 * Set unlock state in module-level variable
 */
function setUnlockState(unlocked: boolean): void {
  isUnlockedThisSession = unlocked
}

/**
 * Get failed attempts count from session storage
 */
function getFailedAttempts(): number {
  try {
    const attempts = sessionStorage.getItem(PIN_ATTEMPTS_KEY)
    return attempts ? parseInt(attempts, 10) : 0
  } catch {
    return 0
  }
}

/**
 * Set failed attempts count in session storage
 */
function setFailedAttempts(count: number): void {
  try {
    if (count > 0) {
      sessionStorage.setItem(PIN_ATTEMPTS_KEY, count.toString())
    } else {
      sessionStorage.removeItem(PIN_ATTEMPTS_KEY)
    }
  } catch {
    // Session storage not available
  }
}

export const PinProvider = ({ children }: PinProviderProps) => {
  const { currentUser, logout } = useAuth()
  
  const [isLocked, setIsLocked] = useState(true)
  const [isPinEnabled, setIsPinEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [pinHash, setPinHash] = useState<string | null>(null)
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_ATTEMPTS)

  // Load PIN state when user changes
  useEffect(() => {
    const loadPinState = async () => {
      if (!currentUser) {
        setIsLocked(false)
        setIsPinEnabled(false)
        setPinHash(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      
      try {
        const profile = await getUserProfile(currentUser.uid)
        const storedPinHash = profile?.settings?.pinHash
        
        if (storedPinHash) {
          setIsPinEnabled(true)
          setPinHash(storedPinHash)
          
          // Check if already unlocked this session
          const alreadyUnlocked = getUnlockState()
          setIsLocked(!alreadyUnlocked)
          
          // Restore attempts count
          const failedAttempts = getFailedAttempts()
          setAttemptsRemaining(MAX_ATTEMPTS - failedAttempts)
        } else {
          setIsPinEnabled(false)
          setPinHash(null)
          setIsLocked(false)
        }
      } catch (error) {
        console.error('Error loading PIN state:', error)
        setIsLocked(false)
        setIsPinEnabled(false)
      } finally {
        setIsLoading(false)
      }
    }

    loadPinState()
  }, [currentUser])

  /**
   * Verify entered PIN against stored hash
   */
  const verifyPin = useCallback(async (pin: string): Promise<{ success: boolean; attemptsRemaining: number }> => {
    if (!pinHash) {
      return { success: true, attemptsRemaining: MAX_ATTEMPTS }
    }

    const currentAttempts = getFailedAttempts()
    
    // Check if locked out
    if (currentAttempts >= MAX_ATTEMPTS) {
      return { success: false, attemptsRemaining: 0 }
    }

    const enteredHash = await hashPin(pin)
    
    if (enteredHash === pinHash) {
      // Success - unlock and reset attempts
      setIsLocked(false)
      setUnlockState(true)
      setFailedAttempts(0)
      setAttemptsRemaining(MAX_ATTEMPTS)
      return { success: true, attemptsRemaining: MAX_ATTEMPTS }
    } else {
      // Failed - increment attempts
      const newAttempts = currentAttempts + 1
      setFailedAttempts(newAttempts)
      const remaining = MAX_ATTEMPTS - newAttempts
      setAttemptsRemaining(remaining)
      return { success: false, attemptsRemaining: remaining }
    }
  }, [pinHash])

  /**
   * Verify current PIN (for change/remove flows)
   */
  const verifyCurrentPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!pinHash) return false
    const enteredHash = await hashPin(pin)
    return enteredHash === pinHash
  }, [pinHash])

  /**
   * Set up a new PIN
   */
  const setupPin = useCallback(async (pin: string): Promise<void> => {
    if (!currentUser) {
      throw new Error('Must be logged in to set up PIN')
    }

    const newPinHash = await hashPin(pin)
    
    // Get current profile to preserve other settings
    const profile = await getUserProfile(currentUser.uid)
    const currentSettings = profile?.settings || { llmProvider: 'gemini' as const }
    
    // Save to Firebase with merged settings
    await updateUserProfile(currentUser.uid, {
      settings: {
        ...currentSettings,
        pinHash: newPinHash
      }
    })

    // Update local state
    setPinHash(newPinHash)
    setIsPinEnabled(true)
    setIsLocked(false)
    setUnlockState(true)
    setFailedAttempts(0)
    setAttemptsRemaining(MAX_ATTEMPTS)
  }, [currentUser])

  /**
   * Change existing PIN
   */
  const changePin = useCallback(async (currentPin: string, newPin: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) {
      return { success: false, error: 'Must be logged in' }
    }

    // Verify current PIN first
    const isValid = await verifyCurrentPin(currentPin)
    if (!isValid) {
      return { success: false, error: 'Current PIN is incorrect' }
    }

    const newPinHash = await hashPin(newPin)
    
    // Get current profile to preserve other settings
    const profile = await getUserProfile(currentUser.uid)
    const currentSettings = profile?.settings || { llmProvider: 'gemini' as const }
    
    // Save to Firebase
    await updateUserProfile(currentUser.uid, {
      settings: {
        ...currentSettings,
        pinHash: newPinHash
      }
    })

    // Update local state
    setPinHash(newPinHash)
    
    return { success: true }
  }, [currentUser, verifyCurrentPin])

  /**
   * Remove PIN (requires current PIN)
   */
  const removePin = useCallback(async (currentPin: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) {
      return { success: false, error: 'Must be logged in' }
    }

    // Verify current PIN first
    const isValid = await verifyCurrentPin(currentPin)
    if (!isValid) {
      return { success: false, error: 'Current PIN is incorrect' }
    }

    // Get current profile to preserve other settings
    const profile = await getUserProfile(currentUser.uid)
    const currentSettings = profile?.settings || { llmProvider: 'gemini' as const }
    
    // Remove pinHash from settings
    const { pinHash: _removed, ...settingsWithoutPin } = currentSettings
    
    // Save to Firebase
    await updateUserProfile(currentUser.uid, {
      settings: settingsWithoutPin as any
    })

    // Update local state
    setPinHash(null)
    setIsPinEnabled(false)
    setIsLocked(false)
    setUnlockState(false)
    
    return { success: true }
  }, [currentUser, verifyCurrentPin])

  /**
   * Forgot PIN - clear PIN and logout
   * User must re-authenticate to regain access
   */
  const forgotPin = useCallback(async (): Promise<void> => {
    if (!currentUser) return

    try {
      // Get current profile to preserve other settings
      const profile = await getUserProfile(currentUser.uid)
      const currentSettings = profile?.settings || { llmProvider: 'gemini' as const }
      
      // Remove pinHash from settings
      const { pinHash: _removed, ...settingsWithoutPin } = currentSettings
      
      // Save to Firebase (clear PIN)
      await updateUserProfile(currentUser.uid, {
        settings: settingsWithoutPin as any
      })

      // Clear session storage
      setUnlockState(false)
      setFailedAttempts(0)
      
      // Logout user
      await logout()
    } catch (error) {
      console.error('Error during forgot PIN:', error)
      // Still try to logout
      await logout()
    }
  }, [currentUser, logout])

  const value: PinContextType = {
    isLocked: isPinEnabled && isLocked,
    isPinEnabled,
    isLoading,
    attemptsRemaining,
    verifyPin,
    setupPin,
    changePin,
    removePin,
    forgotPin,
    verifyCurrentPin
  }

  return (
    <PinContext.Provider value={value}>
      {children}
    </PinContext.Provider>
  )
}
