import { useState, useEffect, useCallback } from 'react'

type ModalMode = 'setup' | 'change' | 'remove'
type SetupStep = 'enter' | 'confirm'

interface PinSetupModalProps {
  isOpen: boolean
  mode: ModalMode
  onClose: () => void
  onSetupPin: (pin: string) => Promise<void>
  onChangePin: (currentPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>
  onRemovePin: (currentPin: string) => Promise<{ success: boolean; error?: string }>
}

const PIN_LENGTH = 4

const PinSetupModal = ({
  isOpen,
  mode,
  onClose,
  onSetupPin,
  onChangePin,
  onRemovePin
}: PinSetupModalProps) => {
  const [step, setStep] = useState<SetupStep>('enter')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [currentPin, setCurrentPin] = useState('')
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [shake, setShake] = useState(false)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPin('')
      setConfirmPin('')
      setCurrentPin('')
      setError('')
      setStep('enter')
      setIsProcessing(false)
    }
  }, [isOpen])

  // Get current active PIN field based on mode and step
  const getCurrentPin = () => {
    if (mode === 'setup') {
      return step === 'enter' ? pin : confirmPin
    } else if (mode === 'change') {
      if (step === 'enter') return currentPin
      return confirmPin === '' ? pin : confirmPin
    } else {
      return currentPin
    }
  }

  const setCurrentPinValue = (value: string) => {
    if (mode === 'setup') {
      if (step === 'enter') setPin(value)
      else setConfirmPin(value)
    } else if (mode === 'change') {
      if (step === 'enter') setCurrentPin(value)
      else if (pin === '' || confirmPin !== '') setPin(value)
      else setConfirmPin(value)
    } else {
      setCurrentPin(value)
    }
  }

  // Auto-advance logic
  useEffect(() => {
    const currentValue = getCurrentPin()
    if (currentValue.length === PIN_LENGTH && !isProcessing) {
      handlePinComplete()
    }
  }, [pin, confirmPin, currentPin])

  const handlePinComplete = async () => {
    setError('')

    if (mode === 'setup') {
      if (step === 'enter') {
        setStep('confirm')
      } else {
        // Confirm step
        if (pin === confirmPin) {
          setIsProcessing(true)
          try {
            await onSetupPin(pin)
            onClose()
          } catch (err: any) {
            setError(err.message || 'Failed to set PIN')
            triggerShake()
            setConfirmPin('')
          } finally {
            setIsProcessing(false)
          }
        } else {
          setError('PINs do not match. Try again.')
          triggerShake()
          setConfirmPin('')
        }
      }
    } else if (mode === 'change') {
      if (step === 'enter') {
        // Current PIN entered, move to new PIN
        setStep('confirm')
        setPin('')
        setConfirmPin('')
      } else {
        // In the new PIN flow
        if (pin.length === PIN_LENGTH && confirmPin === '') {
          // New PIN entered, now need to confirm
          // Just wait for confirm PIN to be entered
        } else if (pin.length === PIN_LENGTH && confirmPin.length === PIN_LENGTH) {
          // Both entered, verify they match
          if (pin === confirmPin) {
            setIsProcessing(true)
            try {
              const result = await onChangePin(currentPin, pin)
              if (result.success) {
                onClose()
              } else {
                setError(result.error || 'Failed to change PIN')
                triggerShake()
                // Reset to beginning
                setStep('enter')
                setCurrentPin('')
                setPin('')
                setConfirmPin('')
              }
            } catch (err: any) {
              setError(err.message || 'Failed to change PIN')
              triggerShake()
            } finally {
              setIsProcessing(false)
            }
          } else {
            setError('New PINs do not match. Try again.')
            triggerShake()
            setPin('')
            setConfirmPin('')
          }
        }
      }
    } else if (mode === 'remove') {
      setIsProcessing(true)
      try {
        const result = await onRemovePin(currentPin)
        if (result.success) {
          onClose()
        } else {
          setError(result.error || 'Incorrect PIN')
          triggerShake()
          setCurrentPin('')
        }
      } catch (err: any) {
        setError(err.message || 'Failed to remove PIN')
        triggerShake()
        setCurrentPin('')
      } finally {
        setIsProcessing(false)
      }
    }
  }

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const handleKeyPress = useCallback((digit: string) => {
    const currentValue = getCurrentPin()
    if (currentValue.length < PIN_LENGTH && !isProcessing) {
      setCurrentPinValue(currentValue + digit)
      setError('')
    }
  }, [pin, confirmPin, currentPin, step, mode, isProcessing])

  const handleDelete = useCallback(() => {
    if (!isProcessing) {
      const currentValue = getCurrentPin()
      setCurrentPinValue(currentValue.slice(0, -1))
      setError('')
    }
  }, [pin, confirmPin, currentPin, step, mode, isProcessing])

  // Keyboard support
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key)
      } else if (e.key === 'Backspace') {
        handleDelete()
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleKeyPress, handleDelete, onClose])

  if (!isOpen) return null

  const getTitle = () => {
    if (mode === 'setup') return 'Set Up PIN'
    if (mode === 'change') return 'Change PIN'
    return 'Remove PIN'
  }

  const getSubtitle = () => {
    if (mode === 'setup') {
      return step === 'enter' ? 'Enter a 4-digit PIN' : 'Confirm your PIN'
    }
    if (mode === 'change') {
      if (step === 'enter') return 'Enter current PIN'
      if (pin === '' || (pin.length === PIN_LENGTH && confirmPin !== '')) return 'Enter new PIN'
      return 'Confirm new PIN'
    }
    return 'Enter current PIN to remove'
  }

  const currentPinDisplay = getCurrentPin()

  const renderPinDots = () => {
    return (
      <div className={`flex gap-4 justify-center mb-6 ${shake ? 'animate-shake' : ''}`}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-200 ${
              i < currentPinDisplay.length
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
      ['', '0', 'del']
    ]

    return (
      <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
        {keys.flat().map((key, i) => {
          if (key === '') {
            return <div key={i} className="w-16 h-16" />
          }

          if (key === 'del') {
            return (
              <button
                key={i}
                onClick={handleDelete}
                disabled={isProcessing || currentPinDisplay.length === 0}
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
              disabled={isProcessing || currentPinDisplay.length >= PIN_LENGTH}
              className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 text-xl font-semibold text-gray-900 dark:text-white transition-all duration-150 disabled:opacity-50 shadow-sm active:scale-95"
            >
              {key}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
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
          {mode !== 'remove' && (
            <div className="mt-6 flex justify-center gap-2">
              {mode === 'setup' && (
                <>
                  <div className={`w-2 h-2 rounded-full ${step === 'enter' ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  <div className={`w-2 h-2 rounded-full ${step === 'confirm' ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`} />
                </>
              )}
              {mode === 'change' && (
                <>
                  <div className={`w-2 h-2 rounded-full ${step === 'enter' ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  <div className={`w-2 h-2 rounded-full ${step === 'confirm' && (pin === '' || confirmPin !== '') ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  <div className={`w-2 h-2 rounded-full ${step === 'confirm' && pin.length === PIN_LENGTH && confirmPin === '' ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`} />
                </>
              )}
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
