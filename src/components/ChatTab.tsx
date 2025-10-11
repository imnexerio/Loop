import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getDayLogCached } from '../services/dataManager'
import { sendToGemini, generateHabitContext } from '../services/gemini'
import { Tag, DayLog } from '../types'
import ReactMarkdown from 'react-markdown'

interface ChatTabProps {
  tags: Tag[]
}

interface Chat {
  id: string
  title: string
  messages: { role: 'user' | 'ai'; content: string }[]
  createdAt: number
  lastMessageAt: number
}

const ChatTab = ({ tags }: ChatTabProps) => {
  const { currentUser } = useAuth()
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [recentLogs, setRecentLogs] = useState<DayLog[]>([])
  const [showSidebar, setShowSidebar] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const currentChat = chats.find(c => c.id === currentChatId)
  const messages = currentChat?.messages || []

  // Load all chats from localStorage
  useEffect(() => {
    if (!currentUser?.uid) return

    const storageKey = `chat_conversations_${currentUser.uid}`
    const savedChats = localStorage.getItem(storageKey)

    if (savedChats) {
      try {
        const parsedChats = JSON.parse(savedChats)
        setChats(parsedChats)
        
        // Set the most recent chat as active
        if (parsedChats.length > 0) {
          const sortedChats = [...parsedChats].sort((a, b) => b.lastMessageAt - a.lastMessageAt)
          setCurrentChatId(sortedChats[0].id)
        } else {
          createNewChat()
        }
      } catch (error) {
        console.error('Error loading chats:', error)
        createNewChat()
      }
    } else {
      createNewChat()
    }
  }, [currentUser?.uid])

  // Save chats to localStorage whenever they change
  useEffect(() => {
    if (!currentUser?.uid || chats.length === 0) return

    const storageKey = `chat_conversations_${currentUser.uid}`
    try {
      localStorage.setItem(storageKey, JSON.stringify(chats))
    } catch (error) {
      console.error('Error saving chats:', error)
    }
  }, [chats, currentUser?.uid])

  // Create a new chat
  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'New Conversation',
      messages: [{
        role: 'ai',
        content: 'Hello! I\'m your habit tracking assistant. I can help you analyze your habits, suggest improvements, and answer questions about your progress. What would you like to know?'
      }],
      createdAt: Date.now(),
      lastMessageAt: Date.now()
    }
    
    setChats(prev => [newChat, ...prev])
    setCurrentChatId(newChat.id)
    setShowSidebar(false)
  }

  // Delete a chat
  const deleteChat = (chatId: string) => {
    if (!confirm('Delete this conversation?')) return
    
    setChats(prev => {
      const filtered = prev.filter(c => c.id !== chatId)
      
      // If deleting current chat, switch to another or create new
      if (chatId === currentChatId) {
        if (filtered.length > 0) {
          setCurrentChatId(filtered[0].id)
        } else {
          createNewChat()
        }
      }
      
      return filtered
    })
  }

  // Generate chat title from first user message
  const generateChatTitle = (firstMessage: string): string => {
    const words = firstMessage.trim().split(' ')
    return words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '')
  }

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
    if (!input.trim() || !currentChatId) return

    const userMessage = { role: 'user' as const, content: input }
    const inputText = input
    setInput('')
    setLoading(true)

    // Update current chat with user message
    setChats(prev => prev.map(chat => {
      if (chat.id === currentChatId) {
        const updatedMessages = [...chat.messages, userMessage]
        
        // Update title if this is the first user message
        const title = chat.messages.length === 1 ? generateChatTitle(inputText) : chat.title
        
        return {
          ...chat,
          title,
          messages: updatedMessages,
          lastMessageAt: Date.now()
        }
      }
      return chat
    }))

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

      // Add AI response to current chat
      setChats(prev => prev.map(chat => {
        if (chat.id === currentChatId) {
          return {
            ...chat,
            messages: [...chat.messages, {
              role: 'ai',
              content: aiResponse
            }],
            lastMessageAt: Date.now()
          }
        }
        return chat
      }))
    } catch (error: any) {
      console.error('Error getting AI response:', error)
      
      let errorMessage = '❌ Sorry, I encountered an error. Please try again.'
      
      if (error.message?.includes('API key')) {
        errorMessage = '🔑 **API Key Required**\n\nTo use the AI chat feature, you need to:\n\n1. Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)\n2. Create a `.env` file in the project root\n3. Add: `VITE_GEMINI_API_KEY=your_key_here`\n4. Restart the development server'
      }
      
      // Add error message to current chat
      setChats(prev => prev.map(chat => {
        if (chat.id === currentChatId) {
          return {
            ...chat,
            messages: [...chat.messages, {
              role: 'ai',
              content: errorMessage
            }],
            lastMessageAt: Date.now()
          }
        }
        return chat
      }))
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestion = (question: string) => {
    setInput(question)
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    } else if (diffInHours < 48) {
      return 'Yesterday'
    } else if (diffInHours < 168) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="fixed inset-0 top-16 left-0 right-0 bottom-16 bg-white dark:bg-gray-900 flex">
      {/* Sidebar */}
      <div className={`${showSidebar ? 'block' : 'hidden'} lg:block w-full lg:w-80 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col absolute lg:relative inset-0 lg:inset-auto z-30 lg:z-auto`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Conversations</h3>
          <div className="flex gap-2">
            <button
              onClick={createNewChat}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="New chat"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={() => setShowSidebar(false)}
              className="lg:hidden p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto p-2">
          {chats.map(chat => (
            <button
              key={chat.id}
              onClick={() => {
                setCurrentChatId(chat.id)
                setShowSidebar(false)
              }}
              className={`w-full text-left p-3 rounded-lg mb-2 transition-colors group ${
                chat.id === currentChatId
                  ? 'bg-primary-100 dark:bg-primary-900/30 border border-primary-300 dark:border-primary-700'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {chat.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatTimestamp(chat.lastMessageAt)} • {chat.messages.length - 1} msgs
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteChat(chat.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-opacity"
                  title="Delete chat"
                >
                  <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(true)}
              className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {currentChat?.title || 'AI Assistant'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Powered by Gemini • Chat history saved locally
              </p>
            </div>
          </div>
          <button
            onClick={createNewChat}
            className="hidden lg:block p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors group"
            title="New chat"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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
    </div>
  )
}

export default ChatTab
