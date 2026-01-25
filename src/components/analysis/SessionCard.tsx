import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { Session, Tag } from '../../types'
import { getImage, getAudio } from '../../services/dataManager'
import ImageViewer from '../ImageViewer'
import { formatTimeInTimezone, getTimezoneAbbreviation } from '../../utils/dateUtils'
import { formatLocationShort, getGoogleMapsUrl } from '../../utils/locationUtils'

interface SessionCardProps {
  session: Session
  tags: Tag[]
}

const SessionCard = ({ session, tags }: SessionCardProps) => {
  const { currentUser } = useAuth()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageLoading, setImageLoading] = useState(false)
  const [showImageViewer, setShowImageViewer] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Audio state
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioDuration, setAudioDuration] = useState<number>(0)
  const [audioLoading, setAudioLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [isSeeking, setIsSeeking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressBarRef = useRef<HTMLDivElement | null>(null)

  // Load image if session has imageId
  useEffect(() => {
    if (!currentUser || !session.imageId) return

    const loadImage = async () => {
      setImageLoading(true)
      try {
        const image = await getImage(currentUser.uid, session.imageId!)
        if (image) {
          setImageUrl(image.base64)
        }
      } catch (error) {
        console.error('Error loading session image:', error)
      } finally {
        setImageLoading(false)
      }
    }

    loadImage()
  }, [currentUser, session.imageId])

  // Load audio if session has audioId
  useEffect(() => {
    if (!currentUser || !session.audioId) return

    const loadAudio = async () => {
      setAudioLoading(true)
      try {
        const audio = await getAudio(currentUser.uid, session.audioId!)
        if (audio) {
          setAudioUrl(audio.base64)
          setAudioDuration(audio.duration || 0)
        }
      } catch (error) {
        console.error('Error loading session audio:', error)
      } finally {
        setAudioLoading(false)
      }
    }

    loadAudio()
  }, [currentUser, session.audioId])

  // Audio playback handlers
  const togglePlayback = () => {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current && !isSeeking) {
      setPlaybackTime(audioRef.current.currentTime)
    }
  }

  const handleAudioEnded = () => {
    setIsPlaying(false)
    setPlaybackTime(0)
  }

  // Calculate seek position from mouse/touch event
  const calculateSeekPosition = (clientX: number): number => {
    if (!progressBarRef.current || audioDuration === 0) return 0
    
    const rect = progressBarRef.current.getBoundingClientRect()
    const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const percentage = clickX / rect.width
    return percentage * audioDuration
  }

  // Start seeking (mouse down or touch start)
  const handleSeekStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsSeeking(true)
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const newTime = calculateSeekPosition(clientX)
    setPlaybackTime(newTime)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
  }

  // Add/remove global mouse/touch listeners for dragging
  useEffect(() => {
    if (!isSeeking) return

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!progressBarRef.current || audioDuration === 0) return
      
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const rect = progressBarRef.current.getBoundingClientRect()
      const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width))
      const percentage = clickX / rect.width
      const newTime = percentage * audioDuration
      
      setPlaybackTime(newTime)
      if (audioRef.current) {
        audioRef.current.currentTime = newTime
      }
    }

    const handleEnd = () => {
      setIsSeeking(false)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleEnd)
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend', handleEnd)
    
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleEnd)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleEnd)
    }
  }, [isSeeking, audioDuration])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  const getTagById = (tagId: string) => {
    return tags.find(t => t.id === tagId)
  }

  const renderTagValue = (tag: Tag, value: any) => {
    switch (tag.type) {
      case 'number':
        return `${value}${tag.config.unit ? ' ' + tag.config.unit : ''}`
      case 'rating':
        return `${value}/${tag.config.max || 5}`
      case 'checkbox':
        return value ? '✓' : '✗'
      case 'text':
        return value
      case 'clocktime':
        if (value && typeof value === 'object' && 'hour' in value && 'minute' in value) {
          return `${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}`
        }
        return value
      default:
        return value
    }
  }

  // Check if card has expandable content
  const hasMoreContent = (session.description && session.description.length > 120) || (session.tags && Object.keys(session.tags).length > 3)

  return (
    <>
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700 transition-all duration-200">

      {/* Time Badge */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5 px-3 py-1 bg-primary-50 dark:bg-primary-900/30 rounded-full">
          <svg className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-semibold text-primary-700 dark:text-primary-300">
            {formatTimeInTimezone(session.timestamp, session.timezone)}
            {session.timezone && (
              <span className="ml-1 text-[10px] font-normal opacity-70">
                {getTimezoneAbbreviation(session.timezone, parseInt(session.timestamp))}
              </span>
            )}
          </span>
        </div>
        
        {/* Location Badge */}
        {session.location && (
          <a
            href={getGoogleMapsUrl(session.location)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            title={`Open in Google Maps: ${formatLocationShort(session.location)}`}
          >
            <span className="text-xs">📍</span>
            <span className="text-xs text-blue-600 dark:text-blue-400">
              {formatLocationShort(session.location)}
            </span>
          </a>
        )}
      </div>

      {/* Description */}
      {session.description && (
        <p 
          className={`text-sm text-gray-700 dark:text-gray-300 mb-3 ${isExpanded ? '' : 'line-clamp-3'}`}
          title={!isExpanded && session.description.length > 100 ? session.description : undefined}
        >
          {session.description}
        </p>
      )}

      {/* Image Thumbnail */}
      {session.imageId && (
        <div className="mb-3">
          {imageLoading ? (
            <div className="w-full h-32 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : imageUrl ? (
            <div 
              className="relative w-full h-32 rounded-lg overflow-hidden cursor-pointer group"
              onClick={() => setShowImageViewer(true)}
            >
              <img
                src={imageUrl}
                alt="Session"
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-800 rounded-full p-2">
                  <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Audio Player */}
      {session.audioId && (
        <div className="mb-3">
          {audioLoading ? (
            <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Loading audio...</span>
            </div>
          ) : audioUrl ? (
            <div className="flex items-center gap-3 p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              {/* Hidden audio element */}
              <audio
                ref={audioRef}
                src={audioUrl}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleAudioEnded}
                onLoadedMetadata={(e) => {
                  // Update duration from actual audio if available
                  const actualDuration = (e.target as HTMLAudioElement).duration
                  if (actualDuration && isFinite(actualDuration)) {
                    setAudioDuration(actualDuration)
                  }
                }}
                preload="metadata"
              />
              
              {/* Play/Pause Button */}
              <button
                onClick={togglePlayback}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white rounded-full transition-colors"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              
              {/* Progress Bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div 
                    ref={progressBarRef}
                    className={`relative flex-1 h-4 bg-purple-200 dark:bg-purple-800 rounded-full overflow-visible cursor-pointer hover:bg-purple-300 dark:hover:bg-purple-700 transition-colors select-none ${isSeeking ? 'bg-purple-300 dark:bg-purple-700' : ''}`}
                    onMouseDown={handleSeekStart}
                    onTouchStart={handleSeekStart}
                  >
                    {/* Progress fill */}
                    <div 
                      className="h-full bg-purple-600 dark:bg-purple-400 rounded-full pointer-events-none"
                      style={{ width: `${audioDuration > 0 ? (playbackTime / audioDuration) * 100 : 0}%` }}
                    />
                    {/* Seek handle/thumb */}
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-purple-600 dark:bg-purple-400 rounded-full shadow-md pointer-events-none border-2 border-white dark:border-gray-800"
                      style={{ left: `calc(${audioDuration > 0 ? (playbackTime / audioDuration) * 100 : 0}% - 8px)` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-purple-600 dark:text-purple-400">
                    {formatTime(playbackTime)}
                  </span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400">
                    {formatTime(audioDuration)}
                  </span>
                </div>
              </div>
              
              {/* Audio Icon */}
              <div className="flex-shrink-0">
                <svg className="w-4 h-4 text-purple-500 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Tags */}
      {session.tags && Object.keys(session.tags).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {Object.entries(session.tags).slice(0, isExpanded ? undefined : 3).map(([tagId, value]) => {
            const tag = getTagById(tagId)
            if (!tag) return null

            const displayValue = renderTagValue(tag, value)

            return (
              <div
                key={tagId}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs max-w-full"
                title={`${tag.name}: ${displayValue}`}
              >
                <span className="text-gray-600 dark:text-gray-400 truncate max-w-[100px]">{tag.name}:</span>
                <span className="font-medium text-gray-900 dark:text-white truncate max-w-[150px]">
                  {displayValue}
                </span>
              </div>
            )
          })}
          {!isExpanded && Object.keys(session.tags).length > 3 && (
            <div className="inline-flex items-center px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
              +{Object.keys(session.tags).length - 3}
            </div>
          )}
        </div>
      )}

      {/* Expand/Collapse Button */}
      {hasMoreContent && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors py-1"
        >
          <span className="font-medium">{isExpanded ? 'Show Less' : 'Show More'}</span>
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>

    {/* Image Viewer Modal */}
    {showImageViewer && imageUrl && (
      <ImageViewer
        imageUrl={imageUrl}
        onClose={() => setShowImageViewer(false)}
        title={`Session at ${formatTimeInTimezone(session.timestamp, session.timezone)}`}
      />
    )}
    </>
  )
}

export default SessionCard
