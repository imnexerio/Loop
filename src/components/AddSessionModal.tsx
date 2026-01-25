import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { addSessionCached, getTags, getUserProfile } from '../services/dataManager'
import { uploadSessionImage, validateImageFile } from '../services/imageService'
import { uploadSessionAudio } from '../services/audioService'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import { Tag, Location } from '../types'
import { formatDateShort, getCurrentTimezone, getDateInTimezone } from '../utils/dateUtils'
import { getCurrentLocation } from '../utils/locationUtils'

interface AddSessionModalProps {
  isOpen: boolean
  onClose: () => void
  tags: Tag[]
  onSessionAdded: () => void
}

const AddSessionModal = ({ isOpen, onClose, tags: initialTags, onSessionAdded }: AddSessionModalProps) => {
  const { currentUser } = useAuth()
  const [description, setDescription] = useState('')
  const [tagValues, setTagValues] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [tags, setTags] = useState<Tag[]>(initialTags)
  const [loadingTags, setLoadingTags] = useState(false)
  const [trackLocation, setTrackLocation] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Voice recorder with real-time transcription + audio capture
  const {
    isRecording,
    isSupported: isVoiceSupported,
    interimTranscript,
    error: voiceError,
    audioBlob,
    audioDuration,
    startRecording,
    stopRecording,
    clearTranscript,
    clearAudio
  } = useVoiceRecorder({
    onTranscript: (text, isFinal) => {
      if (isFinal) {
        // Append final transcript to description
        setDescription(prev => prev ? prev + ' ' + text : text)
      }
    },
    language: 'en-US',
    continuous: true
  })

  // Toggle voice recording
  const handleVoiceToggle = () => {
    if (isRecording) {
      stopRecording()
    } else {
      clearTranscript()
      clearAudio()
      startRecording()
    }
  }

  // Remove recorded audio
  const handleRemoveAudio = () => {
    clearAudio()
  }

  // Get user's timezone once when component mounts
  const userTimezone = useMemo(() => getCurrentTimezone(), [])
  
  // Get today's date in user's timezone
  const today = useMemo(() => getDateInTimezone(Date.now(), userTimezone), [userTimezone])

  // Fetch fresh tags when modal opens
  useEffect(() => {
    if (isOpen && currentUser) {
      const fetchTags = async () => {
        setLoadingTags(true)
        try {
          const freshTags = await getTags(currentUser.uid)
          setTags(freshTags)
          
          // Check if location tracking is enabled
          const profile = await getUserProfile(currentUser.uid)
          const shouldTrackLocation = profile?.settings?.trackLocation ?? false
          setTrackLocation(shouldTrackLocation)
          
          // Fetch location in BACKGROUND (don't await - don't block the modal)
          if (shouldTrackLocation) {
            setLocationLoading(true)
            getCurrentLocation().then(location => {
              setCurrentLocation(location)
              setLocationLoading(false)
            })
          }
        } catch (error) {
          console.error('Error fetching tags:', error)
          // Fall back to initialTags if fetch fails
          setTags(initialTags)
        } finally {
          setLoadingTags(false)
        }
      }

      fetchTags()
    }
  }, [isOpen, currentUser, initialTags])

  // Manual save function
  const saveSession = async () => {
    // Stop recording if active
    if (isRecording) {
      stopRecording()
    }
    
    // Allow saving if any content exists: description, tags, image, or audio
    const hasTagValues = Object.keys(tagValues).length > 0 && 
                         Object.values(tagValues).some(v => v !== null && v !== undefined && v !== '' && v !== false)
    const hasContent = description.trim() || hasTagValues || selectedImage || audioBlob
    
    if (!currentUser || !hasContent) return

    setSaving(true)
    let imageId: string | undefined = undefined
    let audioId: string | undefined = undefined
    
    try {
      // Generate timestamp ONCE for both session and image
      const timestamp = Date.now()
      
      // STEP 1: Upload image FIRST if selected (this is the most likely to fail)
      if (selectedImage) {
        try {
          console.log('[AddSessionModal] Uploading image...')
          imageId = await uploadSessionImage(currentUser.uid, today, timestamp, selectedImage)
          console.log('[AddSessionModal] Image uploaded successfully:', imageId)
        } catch (imageError) {
          // Specific error handling for image upload
          console.error('[AddSessionModal] Image upload failed:', imageError)
          
          let errorMessage = 'Image Upload Failed\n\n'
          if (imageError instanceof Error) {
            const errMsg = imageError.message.toLowerCase()
            
            if (errMsg.includes('too large') || errMsg.includes('compression')) {
              errorMessage += imageError.message
            } else if (errMsg.includes('canvas') || errMsg.includes('context')) {
              errorMessage += 'Your device does not support image processing. Try a different browser.'
            } else if (errMsg.includes('blob')) {
              errorMessage += 'Image conversion failed on your device. Try a different image or browser.'
            } else if (errMsg.includes('network') || errMsg.includes('connection')) {
              errorMessage += 'Network error. Please check your internet connection.'
            } else if (errMsg.includes('permission')) {
              errorMessage += 'Permission denied. Please check your browser settings.'
            } else {
              errorMessage += imageError.message
            }
          } else {
              errorMessage += 'Unknown error occurred during image processing.'
          }
          
          // ASK USER: Do they want to save without image?
          const userChoice = window.confirm(
            errorMessage + 
            '\n\nDo you want to save the session WITHOUT the image?\n\n' +
            '• Click OK to save without image\n' +
            '• Click Cancel to go back and fix the issue'
          )
          
          if (!userChoice) {
            // User chose to cancel - keep all data and stop saving
            setSaving(false)
            return
          }
          
          // User chose to continue without image
          imageId = undefined
        }
      }
      
      // STEP 1.5: Upload audio if recorded
      if (audioBlob && audioDuration > 0) {
        try {
          console.log('[AddSessionModal] Uploading audio...')
          audioId = await uploadSessionAudio(currentUser.uid, today, timestamp, audioBlob, audioDuration)
          console.log('[AddSessionModal] Audio uploaded successfully:', audioId)
        } catch (audioError) {
          console.error('[AddSessionModal] Audio upload failed:', audioError)
          
          let errorMessage = 'Audio Upload Failed\n\n'
          if (audioError instanceof Error) {
            errorMessage += audioError.message
          } else {
            errorMessage += 'Unknown error occurred during audio upload.'
          }
          
          // ASK USER: Do they want to save without audio?
          const userChoice = window.confirm(
            errorMessage + 
            '\n\nDo you want to save the session WITHOUT the audio?\n\n' +
            '• Click OK to save without audio (text is still saved)\n' +
            '• Click Cancel to go back'
          )
          
          if (!userChoice) {
            setSaving(false)
            return
          }
          
          // User chose to continue without audio
          audioId = undefined
        }
      }
      
      // STEP 2: Save session with optional imageId
      // Clean and validate description
      const cleanDescription = description.trim().replace(/^['"`]+|['"`]+$/g, '')
      

      // Get the date in user's timezone (session belongs to the day in their local time)
      const dateInUserTimezone = getDateInTimezone(timestamp, userTimezone)
      
      const session: any = {
        timestamp: timestamp.toString(),
        timezone: userTimezone,
        tags: tagValues
      }
      
      // Add location if tracking is enabled and we have coordinates
      if (trackLocation && currentLocation) {
        session.location = currentLocation
      }
      
      // Only add description if it's not empty
      if (cleanDescription) {
        session.description = cleanDescription
      }
      
      // Add imageId if image was successfully uploaded
      if (imageId) {
        session.imageId = imageId
      }
      
      // Add audioId if audio was successfully uploaded
      if (audioId) {
        session.audioId = audioId
      }

      try {
        console.log('[AddSessionModal] Saving session...')
        // Save to the date in user's timezone (so 11 PM in India is saved to today, not tomorrow in UTC)
        await addSessionCached(currentUser.uid, dateInUserTimezone, session)
        console.log('[AddSessionModal] Session saved successfully')
      } catch (sessionError) {
        console.error('[AddSessionModal] Session save failed:', sessionError)
        
        let errorMessage = 'Failed to Save Session\n\n'
        if (sessionError instanceof Error) {
          const errMsg = sessionError.message.toLowerCase()
          
          if (errMsg.includes('network') || errMsg.includes('connection')) {
            errorMessage += 'Network error. Please check your internet connection.'
          } else if (errMsg.includes('permission')) {
            errorMessage += 'Permission denied. Please check your Firebase permissions.'
          } else if (errMsg.includes('quota') || errMsg.includes('limit')) {
            errorMessage += 'Storage limit exceeded. Please contact support.'
          } else {
            errorMessage += sessionError.message
          }
        } else {
          errorMessage += 'Unknown database error occurred.'
        }
        
        // ASK USER: Do they want to retry?
        const userChoice = window.confirm(
          errorMessage + 
          '\n\nYour data is still here. What would you like to do?\n\n' +
          '• Click OK to try saving again\n' +
          '• Click Cancel to go back and edit'
        )
        
        if (userChoice) {
          // User wants to retry - recursively call saveSession
          setSaving(false)
          await saveSession()
          return
        } else {
          // User wants to go back - stop and keep data
          setSaving(false)
          return
        }
      }
      
      // Success!
      setSaving(false)
      onSessionAdded()
      onClose()
      
    } catch (error) {
      console.error('[AddSessionModal] Unexpected error:', error)
      alert('An unexpected error occurred. Your data is still here - please try again.')
      setSaving(false)
    }
  }

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate
    const validation = validateImageFile(file)
    if (!validation.valid) {
      alert(validation.error)
      return
    }
    
    // Set file and show preview
    setSelectedImage(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  // Remove selected image
  const handleRemoveImage = () => {
    setSelectedImage(null)
    setImagePreview('')
  }

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setDescription('')
      setTagValues({})
      setSelectedImage(null)
      setImagePreview('')
      setSaving(false) // Reset saving state from previous save
      setCurrentLocation(null)
      setLocationLoading(false)
      
      // Focus textarea only once when modal opens (not on every re-render)
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100) // Small delay to ensure modal is fully rendered
    } else {
      // Stop recording when modal closes
      if (isRecording) {
        stopRecording()
      }
      clearTranscript()
      clearAudio()
    }
  }, [isOpen])

  const handleClose = () => {
    onClose()
  }

  const handleTagChange = (tagId: string, value: any) => {
    setTagValues(prev => ({
      ...prev,
      [tagId]: value
    }))
  }
  
  // Handle slider interaction with proper focus management
  // This is the CORRECT way to handle touch-based sliders on mobile
  // Range inputs don't naturally take focus, so we explicitly blur text inputs
  const handleSliderChange = (tagId: string, value: number) => {
    handleTagChange(tagId, value)
  }
  
  // Blur any focused input when user starts interacting with non-text controls
  // This provides a better mobile UX by dismissing the keyboard
  const blurFocusedInput = () => {
    if (document.activeElement instanceof HTMLInputElement || 
        document.activeElement instanceof HTMLTextAreaElement) {
      document.activeElement.blur()
    }
  }

  const renderTagInput = (tag: Tag) => {
    const value = tagValues[tag.id]

    switch (tag.type) {
      case 'number':
        return (
          <div key={tag.id} className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {tag.name} {tag.config.unit && `(${tag.config.unit})`}
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={tag.config.min || 0}
                max={tag.config.max || 100}
                value={value || tag.config.min || 0}
                onChange={(e) => handleSliderChange(tag.id, parseInt(e.target.value))}
                onMouseDown={blurFocusedInput}
                onTouchStart={blurFocusedInput}
                className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <span className="text-lg font-semibold text-gray-900 dark:text-white min-w-[60px] text-right">
                {value || tag.config.min || 0}/{tag.config.max || 100}
              </span>
            </div>
          </div>
        )

      case 'rating':
        return (
          <div key={tag.id} className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {tag.name}
            </label>
            <div className="flex gap-2">
              {Array.from({ length: tag.config.max || 5 }, (_, i) => i + 1).map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => handleTagChange(tag.id, rating)}
                  className={`w-10 h-10 rounded-lg border-2 transition-colors ${
                    (value || 0) >= rating
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'border-gray-300 dark:border-gray-600 text-gray-400 hover:border-primary-500'
                  }`}
                >
                  ★
                </button>
              ))}
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400 self-center">
                {value || 0}/{tag.config.max || 5}
              </span>
            </div>
          </div>
        )

      case 'checkbox':
        return (
          <div key={tag.id} className="mb-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={value || false}
                onChange={(e) => handleTagChange(tag.id, e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {tag.name}
              </span>
            </label>
          </div>
        )

      case 'text':
        return (
          <div key={tag.id} className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {tag.name}
            </label>
            <input
              type="text"
              value={value || ''}
              onChange={(e) => handleTagChange(tag.id, e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder={`Enter ${tag.name.toLowerCase()}`}
            />
          </div>
        )

      case 'clocktime':
        return (
          <div key={tag.id} className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {tag.name}
            </label>
            <div className="flex gap-2 items-center">
              {/* Hour Selector */}
              <select
                value={value?.hour ?? ''}
                onChange={(e) => {
                  const hour = e.target.value ? parseInt(e.target.value) : null
                  if (hour !== null) {
                    handleTagChange(tag.id, { hour, minute: value?.minute ?? 0 })
                  } else {
                    handleTagChange(tag.id, null)
                  }
                }}
                onMouseDown={blurFocusedInput}
                onTouchStart={blurFocusedInput}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="">Hour</option>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, '0')}
                  </option>
                ))}
              </select>
              
              <span className="text-lg font-semibold text-gray-600 dark:text-gray-400">:</span>
              
              {/* Minute Selector */}
              <select
                value={value?.minute ?? ''}
                onChange={(e) => {
                  const minute = e.target.value ? parseInt(e.target.value) : null
                  if (minute !== null && value?.hour !== undefined) {
                    handleTagChange(tag.id, { hour: value.hour, minute })
                  } else if (minute !== null) {
                    handleTagChange(tag.id, { hour: 0, minute })
                  }
                }}
                onMouseDown={blurFocusedInput}
                onTouchStart={blurFocusedInput}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="">Min</option>
                {Array.from({ length: 60 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, '0')}
                  </option>
                ))}
              </select>
              
              {/* Display selected time */}
              {value?.hour !== undefined && value?.minute !== undefined && (
                <div className="ml-2 px-3 py-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg min-w-[70px] text-center">
                  <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                    {String(value.hour).padStart(2, '0')}:{String(value.minute).padStart(2, '0')}
                  </span>
                </div>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Add Session
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {formatDateShort(today)}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Description */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                What are you doing? {tags.length === 0 && '*'}
              </label>
              
              {/* Voice Recording Button */}
              {isVoiceSupported && (
                <button
                  type="button"
                  onClick={handleVoiceToggle}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isRecording
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title={isRecording ? 'Stop recording' : 'Start voice input'}
                >
                  {isRecording ? (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      <span>Voice</span>
                    </>
                  )}
                </button>
              )}
            </div>
            
            {/* Voice Error */}
            {voiceError && (
              <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-xs text-red-600 dark:text-red-400">{voiceError}</p>
              </div>
            )}
            
            {/* Recording Indicator */}
            {isRecording && (
              <div className="mb-2 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                Listening... speak now
              </div>
            )}
            
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                placeholder={tags.length > 0 ? "Optional - describe what you're doing..." : "I am working on..."}
              />
              
              {/* Interim transcript preview (what's being recognized in real-time) */}
              {interimTranscript && (
                <div className="absolute bottom-2 left-3 right-3 text-sm text-gray-400 dark:text-gray-500 italic pointer-events-none">
                  {interimTranscript}...
                </div>
              )}
            </div>
            
            {/* Help text for voice */}
            {isVoiceSupported && !isRecording && !audioBlob && (
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Tip: Use voice input to dictate, then edit the text as needed
              </p>
            )}
            
            {/* Audio Recorded Indicator */}
            {audioBlob && !isRecording && (
              <div className="mt-2 flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <span className="text-xs text-green-700 dark:text-green-300">
                    Audio recorded ({audioDuration.toFixed(1)}s, {(audioBlob.size / 1024).toFixed(0)} KB) - will be saved with session
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveAudio}
                  className="p-1 text-green-600 dark:text-green-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  title="Remove audio"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Tags */}
          {loadingTags ? (
            <div className="text-center py-6">
              <div className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                Loading tags...
              </div>
            </div>
          ) : tags.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                Track your metrics (optional)
              </h3>
              {tags.map(tag => renderTagInput(tag))}
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                No tags created yet
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Create tags in your Profile to track metrics
              </p>
            </div>
          )}

          {/* Image Upload */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Add Photo (optional)
            </label>
            
            {!imagePreview ? (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg className="w-8 h-8 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Click to upload image
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    JPG, PNG, WEBP or GIF (max 10 MB)
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-xl"
                />
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                  type="button"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {selectedImage?.name} ({(selectedImage!.size / 1024).toFixed(1)} KB)
                </div>
              </div>
            )}
          </div>

          {/* Location Indicator (only shown when tracking is enabled) */}
          {trackLocation && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="text-lg">📍</span>
              {locationLoading ? (
                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  Getting location...
                </span>
              ) : currentLocation ? (
                <span className="text-green-600 dark:text-green-400">
                  Location captured ({currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)})
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">
                  Location unavailable
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={saveSession}
            disabled={(!description.trim() && Object.keys(tagValues).length === 0 && !selectedImage && !audioBlob) || saving}
            className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              'Save Session'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddSessionModal
