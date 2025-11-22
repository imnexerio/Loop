import { Tag, DayLog } from '../types'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent'

interface Message {
  role: 'user' | 'model'
  parts: { text: string }[]
}

interface GeminiRequest {
  contents: Message[]
  generationConfig?: {
    temperature?: number
    topK?: number
    topP?: number
    maxOutputTokens?: number
  }
}

interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[]
    }
    finishReason: string
  }[]
}

/**
 * Generate context from user's habit data
 */
export function generateHabitContext(
  tags: Tag[],
  recentLogs: DayLog[],
  dateRange: { start: string; end: string }
): string {
  let context = `You are a helpful AI assistant for a habit tracking app called "Loop". Here's the user's current habit tracking data:\n\n`

  // Tags information
  if (tags.length > 0) {
    context += `**Tracked Metrics:**\n`
    tags.forEach(tag => {
      const typeLabel = {
        number: 'Number',
        rating: 'Rating (1-10)',
        checkbox: 'Yes/No',
        text: 'Text',
        clocktime: 'Clock Time (HH:MM)'
      }[tag.type]
      
      context += `- ${tag.name} (${typeLabel})`
      if (tag.config?.unit) context += ` in ${tag.config.unit}`
      context += `\n`
    })
    context += `\n`
  }

  // Recent activity
  if (recentLogs.length > 0) {
    context += `**Recent Activity (${dateRange.start} to ${dateRange.end}):**\n`
    recentLogs.forEach(log => {
      context += `\n📅 ${log.date}:\n`
      log.sessions.forEach(session => {
        const time = new Date(session.timestamp).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
        // Only show description if it exists
        if (session.description) {
          context += `  • ${time}: ${session.description}\n`
        } else {
          context += `  • ${time}: (no description)\n`
        }
        
        // Add tag values (Note: imageId is intentionally excluded from context)
        Object.entries(session.tags || {}).forEach(([tagId, value]) => {
          const tag = tags.find(t => t.id === tagId)
          if (tag) {
            let displayValue = value
            if (tag.type === 'clocktime' && typeof value === 'object' && 'hour' in value && 'minute' in value) {
              displayValue = `${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}`
            } else if (tag.type === 'checkbox') {
              displayValue = value ? '✓' : '✗'
            }
            context += `    - ${tag.name}: ${displayValue}\n`
          }
        })
      })
    })
    context += `\n`
  }

  context += `Based on this data, provide helpful insights, answer questions, and suggest improvements. Be encouraging and specific. If the user asks for trends or analytics, calculate them from the data provided.`

  return context
}

/**
 * Send a message to Gemini API
 */
export async function sendToGemini(
  userMessage: string,
  conversationHistory: { role: 'user' | 'ai'; content: string }[],
  habitContext: string
): Promise<string> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    return `🔑 **Gemini API Key Not Configured**

To enable AI chat features, you need to:

1. Get a free API key from Google AI Studio:
   https://makersuite.google.com/app/apikey

2. Create a \`.env\` file in the project root with:
   \`\`\`
   VITE_GEMINI_API_KEY=your_api_key_here
   \`\`\`

3. Restart the development server

Once configured, I'll be able to analyze your habits and provide personalized insights!`
  }

  try {
    // Build conversation history for context
    const messages: Message[] = []

    // Add system context as first user message
    messages.push({
      role: 'user',
      parts: [{ text: habitContext }]
    })

    // Add conversation history (limit to last 10 messages)
    const recentHistory = conversationHistory.slice(-10)
    recentHistory.forEach(msg => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      })
    })

    // Add current user message
    messages.push({
      role: 'user',
      parts: [{ text: userMessage }]
    })

    const requestBody: GeminiRequest = {
      contents: messages,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192
      }
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Gemini API error:', errorData)
      
      if (response.status === 400) {
        throw new Error('Invalid API request. Please check your API key.')
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.')
      } else {
        throw new Error(`API error: ${response.status}`)
      }
    }

    const data: any = await response.json()
      
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0]
      // Try to extract text from various possible structures
      if (candidate?.content?.parts && candidate.content.parts.length > 0) {
        // Find the first part with text
        for (const part of candidate.content.parts) {
          if (part.text) {
            return part.text
          }
        }
      }
      
      // Alternative structure check
      if (candidate?.text) {
        return candidate.text
      }
    }
    
    throw new Error('No response generated or unexpected response format')
  } catch (error: any) {
    console.error('Error calling Gemini API:', error)
    
    if (error.message.includes('fetch')) {
      return '❌ **Connection Error**\n\nCouldn\'t connect to Gemini API. Please check your internet connection and try again.'
    }
    
    return `❌ **Error**: ${error.message}\n\nPlease try again or check your API configuration.`
  }
}

/**
 * Generate habit insights using Gemini
 */
export async function generateHabitInsights(
  tags: Tag[],
  logs: DayLog[]
): Promise<string> {
  const context = generateHabitContext(
    tags,
    logs,
    {
      start: logs[0]?.date || 'N/A',
      end: logs[logs.length - 1]?.date || 'N/A'
    }
  )

  const prompt = `Based on the user's habit tracking data, provide:
1. A summary of their habits
2. 3 key insights or patterns you notice
3. 2-3 actionable suggestions for improvement

Be encouraging and specific!`

  return sendToGemini(prompt, [], context)
}
