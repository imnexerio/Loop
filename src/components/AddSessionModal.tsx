import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { addSessionCached, getTags } from '../services/dataManager'
import { uploadSessionImage, validateImageFile } from '../services/imageService'
import { Tag } from '../types'

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const today = new Date().toISOString().split('T')[0]

  // Fetch fresh tags when modal opens
  useEffect(() => {
    if (isOpen && currentUser) {
      const fetchTags = async () => {
        setLoadingTags(true)
        try {
          const freshTags = await getTags(currentUser.uid)
          setTags(freshTags)
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
    // Allow saving if either description exists OR any tags are filled
    const hasTagValues = Object.keys(tagValues).length > 0 && 
                         Object.values(tagValues).some(v => v !== null && v !== undefined && v !== '' && v !== false)
    
    if (!currentUser || (!description.trim() && !hasTagValues)) return

    setSaving(true)
    let imageId: string | undefined = undefined
    
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
      
      // STEP 2: Save session with optional imageId
      const session: any = {
        timestamp: timestamp.toString(),
        description: description.trim() || (Object.keys(tagValues).length > 0 ? 'Tagged entry' : ''),
        tags: tagValues
      }
      
      // Add imageId if image was successfully uploaded
      if (imageId) {
        session.imageId = imageId
      }

      try {
        console.log('[AddSessionModal] Saving session...')
        await addSessionCached(currentUser.uid, today, session)
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
      
      // Focus textarea only once when modal opens (not on every re-render)
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100) // Small delay to ensure modal is fully rendered
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
            <input
              type="time"
              value={value ? `${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}` : ''}
              onChange={(e) => {
                if (e.target.value) {
                  const [hour, minute] = e.target.value.split(':').map(Number)
                  handleTagChange(tag.id, { hour, minute })
                } else {
                  handleTagChange(tag.id, null)
                }
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
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
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })}
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              What are you doing? {tags.length === 0 && '*'}
            </label>
            <textarea
              ref={textareaRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              placeholder={tags.length > 0 ? "Optional - describe what you're doing..." : "I am working on..."}
            />
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
            disabled={(!description.trim() && Object.keys(tagValues).length === 0) || saving}
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
