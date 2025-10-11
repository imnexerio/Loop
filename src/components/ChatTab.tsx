import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getDayLogCached } from '../services/dataManager'
import { sendToGemini, generateHabitContext } from '../services/gemini'
import { Tag, DayLog } from '../types'
import ReactMarkdown from 'react-markdown'

interface ChatTabProps {
  tags: Tag[]
}

const ChatTab = ({ tags }: ChatTabProps) => {
  const { currentUser } = useAuth()
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [recentLogs, setRecentLogs] = useState<DayLog[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load chat history from localStorage
  useEffect(() => {
    if (!currentUser?.uid) return

    const storageKey = `chat_history_${currentUser.uid}`
    const savedHistory = localStorage.getItem(storageKey)

    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory)
        setMessages(parsedHistory)
      } catch (error) {
        console.error('Error loading chat history:', error)
        // Set default welcome message
        setMessages([{
          role: 'ai',
          content: 'Hello! I\'m your habit tracking assistant. I can help you analyze your habits, suggest improvements, and answer questions about your progress. What would you like to know?'
        }])
      }
    } else {
      // Set default welcome message
      setMessages([{
        role: 'ai',
        content: 'Hello! I\'m your habit tracking assistant. I can help you analyze your habits, suggest improvements, and answer questions about your progress. What would you like to know?'
      }])
    }
  }, [currentUser?.uid])

  // Save chat history to localStorage whenever messages change
  useEffect(() => {
    if (!currentUser?.uid || messages.length === 0) return

    const storageKey = `chat_history_${currentUser.uid}`
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages))
    } catch (error) {
      console.error('Error saving chat history:', error)
    }
  }, [messages, currentUser?.uid])

  // Load recent logs for context
  useEffect(() => {
    const loadRecentLogs = async () => {
      if (!currentUser) return

      const logs: DayLog[] = []
      const today = new Date()
      
      // Get last 7 days of logs
      for (let i = 0; i < 7; i++) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        
        try {
          const log = await getDayLogCached(currentUser.uid, dateStr)
          if (log && log.sessions.length > 0) {
            logs.push(log)
          }
        } catch (error) {
          console.error('Error loading log:', error)
        }
      }
      
      setRecentLogs(logs)
    }

    loadRecentLogs()
  }, [currentUser])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const suggestedQuestions = [
    'What are my most tracked habits?',
    'Show me insights from this week',
    'What patterns do you notice?',
    'How can I improve my habits?'
  ]

  const handleSend = async () => {
    if (!input.trim()) return

    // Add user message
    const userMessage = { role: 'user' as const, content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      // Generate context from user's habit data
      const dateRange = recentLogs.length > 0 
        ? { start: recentLogs[recentLogs.length - 1].date, end: recentLogs[0].date }
        : { start: 'N/A', end: 'N/A' }
      
      const habitContext = generateHabitContext(tags, recentLogs, dateRange)

      // Get AI response
      const aiResponse = await sendToGemini(
        userMessage.content,
        messages,
        habitContext
      )

      // Add AI response
      setMessages(prev => [...prev, {
        role: 'ai',
        content: aiResponse
      }])
    } catch (error: any) {
      console.error('Error getting AI response:', error)
      
      let errorMessage = '❌ Sorry, I encountered an error. Please try again.'
      
      if (error.message?.includes('API key')) {
        errorMessage = '🔑 **API Key Required**\n\nTo use the AI chat feature, you need to:\n\n1. Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)\n2. Create a `.env` file in the project root\n3. Add: `VITE_GEMINI_API_KEY=your_key_here`\n4. Restart the development server'
      }
      
      setMessages(prev => [...prev, {
        role: 'ai',
        content: errorMessage
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestion = (question: string) => {
    setInput(question)
  }

  const handleClearHistory = () => {
    if (!currentUser?.uid) return
    
    if (confirm('Are you sure you want to clear your chat history? This cannot be undone.')) {
      const storageKey = `chat_history_${currentUser.uid}`
      localStorage.removeItem(storageKey)
      setMessages([{
        role: 'ai',
        content: 'Hello! I\'m your habit tracking assistant. I can help you analyze your habits, suggest improvements, and answer questions about your progress. What would you like to know?'
      }])
    }
  }

  return (
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-16 bg-white dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            AI Assistant
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Powered by Gemini • Chat history saved locally
          </p>
        </div>
        <button
          onClick={handleClearHistory}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors group"
          aria-label="Clear history"
          title="Clear chat history"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-5xl mx-auto">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
            >
              <div
                className={`max-w-[85%] lg:max-w-[75%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-md'
                }`}
              >
              {message.role === 'user' ? (
                <p className="text-sm sm:text-base whitespace-pre-wrap">{message.content}</p>
              ) : (
                <div className="text-sm sm:text-base prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="ml-2">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      code: ({ children }) => <code className="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded text-xs">{children}</code>,
                      h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start mb-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-md">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Suggested Questions */}
        {messages.length === 1 && (
          <div className="mt-6">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
              💡 Suggested Questions:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestion(question)}
                  className="text-left px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-colors shadow-sm"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-4 sm:p-6 lg:p-8 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-5xl mx-auto flex gap-2 sm:gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask me anything about your habits..."
            className="flex-1 px-4 py-3 sm:py-4 text-base rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-6 sm:px-8 py-3 sm:py-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatTab
