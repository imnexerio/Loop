import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { Session, Tag } from '../../types'
import { getImage } from '../../services/dataManager'
import ImageViewer from '../ImageViewer'

interface SessionCardProps {
  session: Session
  tags: Tag[]
}

const SessionCard = ({ session, tags }: SessionCardProps) => {
  const { currentUser } = useAuth()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageLoading, setImageLoading] = useState(false)
  const [showImageViewer, setShowImageViewer] = useState(false)

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
  const formatTime = (timestamp: string) => {
    const d = new Date(parseInt(timestamp))
    return d.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    })
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
      case 'time':
        return `${value} min`
      default:
        return value
    }
  }

  // Truncate description
  const truncateDescription = (text: string, maxLength: number = 80) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  return (
    <>
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700">

      {/* Time Badge */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5 px-3 py-1 bg-primary-50 dark:bg-primary-900/30 rounded-full">
          <svg className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-semibold text-primary-700 dark:text-primary-300">
            {formatTime(session.timestamp)}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-3 min-h-[60px]">
        {truncateDescription(session.description)}
      </p>

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

      {/* Tags */}
      {session.tags && Object.keys(session.tags).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {Object.entries(session.tags).slice(0, 3).map(([tagId, value]) => {
            const tag = getTagById(tagId)
            if (!tag) return null

            return (
              <div
                key={tagId}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs"
              >
                <span className="text-gray-600 dark:text-gray-400">{tag.name}:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {renderTagValue(tag, value)}
                </span>
              </div>
            )
          })}
          {Object.keys(session.tags).length > 3 && (
            <div className="inline-flex items-center px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
              +{Object.keys(session.tags).length - 3}
            </div>
          )}
        </div>
      )}
    </div>

    {/* Image Viewer Modal */}
    {showImageViewer && imageUrl && (
      <ImageViewer
        imageUrl={imageUrl}
        onClose={() => setShowImageViewer(false)}
        title={`Session at ${formatTime(session.timestamp)}`}
      />
    )}
    </>
  )
}

export default SessionCard
