import { useState, useEffect, useCallback } from 'react'
import { usePin } from '../contexts/PinContext'
import { useAuth } from '../contexts/AuthContext'
import { PIN_MIN_LENGTH, PIN_MAX_LENGTH, shouldEnterSubmitPin } from '../utils/pinUtils'

const PinLockScreen = () => {
  const { verifyPin, forgotPin } = usePin()
  const { currentUser } = useAuth()
  
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [showForgotConfirm, setShowForgotConfirm] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [shake, setShake] = useState(false)

  const canSubmit = pin.length >= PIN_MIN_LENGTH && !isVerifying

  // Submitted with the OK button or Enter - PINs can be 4-8 digits,
  // so there is no length at which to auto-submit
  const handleVerify = useCallback(async () => {
    if (pin.length < PIN_MIN_LENGTH || isVerifying) return

    setIsVerifying(true)
    setError('')

    try {
      const result = await verifyPin(pin)
      
      if (!result.success) {
        // Trigger shake animation
        setShake(true)
        setTimeout(() => setShake(false), 500)
        
        // Clear PIN
        setPin('')
        
        if (result.attemptsRemaining === 0) {
          setError('Too many attempts. Please reset your PIN.')
        } else {
          setError(`Wrong PIN. ${result.attemptsRemaining} attempt${result.attemptsRemaining === 1 ? '' : 's'} remaining.`)
        }
      }
      // Success - PinContext will handle unlocking
    } catch (err) {
      console.error('PIN verification error:', err)
      setError('An error occurred. Please try again.')
      setPin('')
    } finally {
      setIsVerifying(false)
    }
  }, [pin, isVerifying, verifyPin])

  const handleKeyPress = useCallback((digit: string) => {
    if (pin.length < PIN_MAX_LENGTH && !isVerifying) {
      setPin(prev => prev + digit)
      setError('')
    }
  }, [pin.length, isVerifying])

  const handleDelete = useCallback(() => {
    if (!isVerifying) {
      setPin(prev => prev.slice(0, -1))
      setError('')
    }
  }, [isVerifying])

  const handleForgotPin = async () => {
    setIsLoggingOut(true)
    try {
      await forgotPin()
    } catch (err) {
      console.error('Forgot PIN error:', err)
      setError('An error occurred. Please try again.')
      setIsLoggingOut(false)
    }
  }

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showForgotConfirm) return
      
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key)
      } else if (e.key === 'Backspace') {
        handleDelete()
      } else if (e.key === 'Enter' && shouldEnterSubmitPin(e)) {
        // Stop Enter from also "clicking" a focused keypad digit
        e.preventDefault()
        handleVerify()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyPress, handleDelete, handleVerify, showForgotConfirm])

  const renderPinDots = () => {
    // Show the minimum number of slots, growing one dot per extra digit
    const dotCount = Math.max(PIN_MIN_LENGTH, pin.length)
    return (
      <div className={`flex gap-4 justify-center mb-8 ${shake ? 'animate-shake' : ''}`}>
        {Array.from({ length: dotCount }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-200 ${
              i < pin.length
                ? 'bg-primary-600 dark:bg-primary-400 scale-110'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
          />
        ))}
      </div>
    )
  }

  const renderKeypad = () => {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['ok', '0', 'del']
    ]

    return (
      <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto" data-pin-keypad>
        {keys.flat().map((key, i) => {
          if (key === 'ok') {
            return (
              <button
                key={i}
                onClick={() => handleVerify()}
                disabled={!canSubmit}
                className="w-20 h-20 rounded-full flex items-center justify-center bg-primary-600 hover:bg-primary-700 active:bg-primary-700 text-white text-lg font-semibold transition-all duration-150 disabled:opacity-30 shadow-xs active:scale-95"
              >
                OK
              </button>
            )
          }

          if (key === 'del') {
            return (
              <button
                key={i}
                onClick={handleDelete}
                disabled={isVerifying || pin.length === 0}
                className="w-20 h-20 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-30"
                aria-label="Delete"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414-6.414a2 2 0 011.414-.586H19a2 2 0 012 2v10a2 2 0 01-2 2h-8.172a2 2 0 01-1.414-.586L3 12z" />
                </svg>
              </button>
            )
          }

          return (
            <button
              key={i}
              onClick={() => handleKeyPress(key)}
              disabled={isVerifying || pin.length >= PIN_MAX_LENGTH}
              className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 text-2xl font-semibold text-gray-900 dark:text-white transition-all duration-150 disabled:opacity-50 shadow-xs hover:shadow-md active:scale-95"
            >
              {key}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-linear-to-br from-primary-50 to-blue-50 dark:from-gray-900 dark:to-gray-800" data-pin-dialog>
      {/* Logo */}
      <div className="mb-8 text-center">
        <img 
          src="/pwa-512x512.png"
          alt="Loop Logo" 
          className="w-20 h-20 mx-auto rounded-2xl shadow-lg mb-4"
        />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Loop</h1>
        {currentUser?.displayName && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Welcome back, {currentUser.displayName.split(' ')[0]}
          </p>
        )}
      </div>

      {/* Lock Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-4">
            <svg className="w-8 h-8 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Enter PIN
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Enter your PIN and tap OK to unlock
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* PIN Dots */}
        {renderPinDots()}

        {/* Keypad */}
        {renderKeypad()}

        {/* Verifying indicator */}
        {isVerifying && (
          <div className="mt-6 flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm">Verifying...</span>
          </div>
        )}

        {/* Forgot PIN Link */}
        <div className="mt-8 text-center">
          <button
            onClick={() => setShowForgotConfirm(true)}
            disabled={isVerifying || isLoggingOut}
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium disabled:opacity-50"
          >
            Forgot PIN?
          </button>
        </div>
      </div>

      {/* Forgot PIN Confirmation Modal */}
      {showForgotConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
                <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Reset PIN?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                You'll be logged out and need to sign in again with your email or Google account. Your PIN will be removed.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowForgotConfirm(false)}
                disabled={isLoggingOut}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleForgotPin}
                disabled={isLoggingOut}
                className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoggingOut ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Logging out...
                  </>
                ) : (
                  'Logout & Reset'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom shake animation style */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
          20%, 40%, 60%, 80% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  )
}

export default PinLockScreen
