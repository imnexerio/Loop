import { useState, useEffect, useCallback } from 'react'
import { PIN_MIN_LENGTH, PIN_MAX_LENGTH, PIN_LENGTH_HINT, shouldEnterSubmitPin } from '../utils/pinUtils'

type ModalMode = 'setup' | 'change' | 'remove'
type Step = 'current' | 'new' | 'confirm'

interface PinSetupModalProps {
  isOpen: boolean
  mode: ModalMode
  onClose: () => void
  onSetupPin: (pin: string) => Promise<void>
  onChangePin: (currentPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>
  onRemovePin: (currentPin: string) => Promise<{ success: boolean; error?: string }>
  onVerifyCurrentPin: (pin: string) => Promise<boolean>
}

// The steps each mode walks through, in order
const STEPS: Record<ModalMode, Step[]> = {
  setup: ['new', 'confirm'],
  change: ['current', 'new', 'confirm'],
  remove: ['current']
}

const PinSetupModal = ({
  isOpen,
  mode,
  onClose,
  onSetupPin,
  onChangePin,
  onRemovePin,
  onVerifyCurrentPin
}: PinSetupModalProps) => {
  const steps = STEPS[mode]
  const [step, setStep] = useState<Step>(steps[0])
  // Digits typed for the step on screen
  const [entry, setEntry] = useState('')
  // Values carried over from earlier steps
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [shake, setShake] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(STEPS[mode][0])
      setEntry('')
      setCurrentPin('')
      setNewPin('')
      setError('')
      setIsProcessing(false)
    }
  }, [isOpen, mode])

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const fail = (message: string) => {
    setError(message)
    triggerShake()
    setEntry('')
  }

  const canSubmit = entry.length >= PIN_MIN_LENGTH && !isProcessing

  // Runs when OK (or Enter) is pressed for the step on screen.
  // Nothing advances on its own, so every digit stays visible until then.
  const handleSubmit = useCallback(async () => {
    if (entry.length < PIN_MIN_LENGTH || isProcessing) return
    setError('')

    if (step === 'current') {
      setIsProcessing(true)
      try {
        if (mode === 'remove') {
          const result = await onRemovePin(entry)
          if (result.success) {
            onClose()
          } else {
            fail(result.error || 'Incorrect PIN')
          }
        } else {
          // Change: check the current PIN before asking for a new one
          const isValid = await onVerifyCurrentPin(entry)
          if (isValid) {
            setCurrentPin(entry)
            setEntry('')
            setStep('new')
          } else {
            fail('Current PIN is incorrect')
          }
        }
      } catch (err: any) {
        fail(err.message || (mode === 'remove' ? 'Failed to remove PIN' : 'Failed to check PIN'))
      } finally {
        setIsProcessing(false)
      }
      return
    }

    if (step === 'new') {
      setNewPin(entry)
      setEntry('')
      setStep('confirm')
      return
    }

    // Confirm step
    if (entry !== newPin) {
      fail('PINs do not match. Enter the new PIN again.')
      setNewPin('')
      setStep('new')
      return
    }

    setIsProcessing(true)
    try {
      if (mode === 'setup') {
        await onSetupPin(newPin)
        onClose()
      } else {
        const result = await onChangePin(currentPin, newPin)
        if (result.success) {
          onClose()
        } else {
          // e.g. the PIN was changed on another device - start over
          fail(result.error || 'Failed to change PIN')
          setCurrentPin('')
          setNewPin('')
          setStep('current')
        }
      }
    } catch (err: any) {
      // Keep the new PIN so the user only has to re-confirm to retry
      fail(err.message || (mode === 'setup' ? 'Failed to set PIN' : 'Failed to change PIN'))
    } finally {
      setIsProcessing(false)
    }
  }, [entry, isProcessing, step, mode, newPin, currentPin, onSetupPin, onChangePin, onRemovePin, onVerifyCurrentPin, onClose])

  const handleKeyPress = useCallback((digit: string) => {
    if (entry.length < PIN_MAX_LENGTH && !isProcessing) {
      setEntry(prev => prev + digit)
      setError('')
    }
  }, [entry.length, isProcessing])

  const handleDelete = useCallback(() => {
    if (!isProcessing) {
      setEntry(prev => prev.slice(0, -1))
      setError('')
    }
  }, [isProcessing])

  // Keyboard support
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key)
      } else if (e.key === 'Backspace') {
        handleDelete()
      } else if (e.key === 'Enter' && shouldEnterSubmitPin(e)) {
        // Stop Enter from also "clicking" whichever button has focus
        e.preventDefault()
        handleSubmit()
      } else if (e.key === 'Escape' && !isProcessing) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isProcessing, handleKeyPress, handleDelete, handleSubmit, onClose])

  if (!isOpen) return null

  const getTitle = () => {
    if (mode === 'setup') return 'Set Up PIN'
    if (mode === 'change') return 'Change PIN'
    return 'Remove PIN'
  }

  const getSubtitle = () => {
    if (step === 'current') {
      return mode === 'remove' ? 'Enter current PIN to remove' : 'Enter current PIN'
    }
    if (step === 'new') {
      return mode === 'setup' ? `Enter a PIN (${PIN_LENGTH_HINT})` : `Enter new PIN (${PIN_LENGTH_HINT})`
    }
    return mode === 'setup' ? 'Confirm your PIN' : 'Confirm new PIN'
  }

  const renderPinDots = () => {
    // Show the minimum number of slots, growing one dot per extra digit
    const dotCount = Math.max(PIN_MIN_LENGTH, entry.length)
    return (
      <div className={`flex gap-4 justify-center mb-6 ${shake ? 'animate-shake' : ''}`}>
        {Array.from({ length: dotCount }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-200 ${
              i < entry.length
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
      ['del', '0', 'ok']
    ]

    return (
      <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto" data-pin-keypad>
        {keys.flat().map((key, i) => {
          if (key === 'ok') {
            return (
              <button
                key={i}
                onClick={() => handleSubmit()}
                disabled={!canSubmit}
                className="w-16 h-16 rounded-full flex items-center justify-center bg-primary-600 hover:bg-primary-700 active:bg-primary-700 text-white text-base font-semibold transition-all duration-150 disabled:opacity-30 shadow-xs active:scale-95"
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
                disabled={isProcessing || entry.length === 0}
                className="w-16 h-16 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-30"
                aria-label="Delete"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414-6.414a2 2 0 011.414-.586H19a2 2 0 012 2v10a2 2 0 01-2 2h-8.172a2 2 0 01-1.414-.586L3 12z" />
                </svg>
              </button>
            )
          }

          return (
            <button
              key={i}
              onClick={() => handleKeyPress(key)}
              disabled={isProcessing || entry.length >= PIN_MAX_LENGTH}
              className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 text-xl font-semibold text-gray-900 dark:text-white transition-all duration-150 disabled:opacity-50 shadow-xs active:scale-95"
            >
              {key}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" data-pin-dialog>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {getTitle()}
          </h3>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-6">
            {getSubtitle()}
          </p>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* PIN Dots */}
          {renderPinDots()}

          {/* Keypad */}
          {renderKeypad()}

          {/* Processing indicator */}
          {isProcessing && (
            <div className="mt-4 flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm">Processing...</span>
            </div>
          )}

          {/* Progress indicator for multi-step flows */}
          {steps.length > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              {steps.map(s => (
                <div
                  key={s}
                  className={`w-2 h-2 rounded-full ${s === step ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

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

export default PinSetupModal
