// Tag types
export type TagType = 'number' | 'text' | 'checkbox' | 'rating' | 'time'

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

// Session types
export interface Session {
  timestamp: string
  description: string
  tags: Record<string, any> // tagId -> value
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
}

export interface UserProfile {
  name: string
  email: string
  createdAt: string
  settings: UserSettings
}

// UI State types
export interface CalendarDate {
  year: number
  month: number
  day: number
}

export interface SessionFormData {
  description: string
  tags: Record<string, any>
}
