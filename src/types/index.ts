// Tag types
export type TagType = 'number' | 'text' | 'checkbox' | 'rating' | 'clocktime'

export interface TagConfig {
  min?: number
  max?: number
  unit?: string
}

export interface Tag {
  id: string
  name: string
  type: TagType
  config: TagConfig
  createdAt: string
}

// Location type for GPS coordinates
export interface Location {
  lat: number
  lng: number
}

// Session types
export interface Session {
  timestamp: string
  timezone?: string // IANA timezone e.g., "Asia/Kolkata" - where session was logged
  location?: Location // GPS coordinates where session was logged
  description?: string // Optional - sessions can have just tags
  tags: Record<string, any> // tagId -> value
  imageId?: string // Optional reference to image in separate storage
  audioId?: string // Optional reference to voice recording in separate storage
}

export interface DayLog {
  date: string // YYYY-MM-DD format
  sessions: Session[]
  lastUpdated: string
}

// User profile types
export interface UserSettings {
  llmProvider: 'gemini' | 'chatgpt' | 'claude'
  llmApiKey?: string
  trackLocation?: boolean // Opt-in GPS tracking for sessions
  pinHash?: string // SHA-256 hash of user's PIN (if enabled)
}

export interface UserProfile {
  name: string
  email: string
  createdAt: string
  settings: UserSettings
  photoImageId?: string // Optional reference to profile picture
}

// Image storage types
export type ImageType = 'profile' | 'session'

export interface StoredImage {
  base64: string
  size: number
}

// Audio storage types
export interface StoredAudio {
  size: number
  duration: number // Duration in seconds
  mimeType: string // e.g., 'audio/webm', 'audio/mp4'
  chunkCount: number
  chunkIds: string[] // References to AudioChunk records
}

// Audio chunk for large recordings
export interface AudioChunk {
  chunkIndex: number
  base64: string
  size: number
}

// UI State types
export interface CalendarDate {
  year: number
  month: number
  day: number
}

export interface SessionFormData {
  description?: string // Optional - sessions can have just tags
  tags: Record<string, any>
}
