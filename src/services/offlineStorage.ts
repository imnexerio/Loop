// IndexedDB wrapper for offline storage
const DB_NAME = 'LoopHabitTracker'
const DB_VERSION = 1

// Store names
const STORES = {
  SESSIONS: 'sessions',
  TAGS: 'tags',
  OFFLINE_QUEUE: 'offlineQueue',
  CACHE: 'cache'
}

interface OfflineQueueItem {
  id: string
  timestamp: number
  userId: string
  type: 'ADD_SESSION' | 'DELETE_SESSION' | 'CREATE_TAG' | 'DELETE_TAG'
  data: any
  retryCount: number
}

class OfflineStorage {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Sessions store - keyed by userId_date
        if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
          const sessionsStore = db.createObjectStore(STORES.SESSIONS, { keyPath: 'key' })
          sessionsStore.createIndex('userId', 'userId', { unique: false })
        }

        // Tags store - keyed by userId
        if (!db.objectStoreNames.contains(STORES.TAGS)) {
          const tagsStore = db.createObjectStore(STORES.TAGS, { keyPath: 'userId' })
        }

        // Offline queue - operations to sync when online
        if (!db.objectStoreNames.contains(STORES.OFFLINE_QUEUE)) {
          const queueStore = db.createObjectStore(STORES.OFFLINE_QUEUE, { keyPath: 'id' })
          queueStore.createIndex('timestamp', 'timestamp', { unique: false })
          queueStore.createIndex('userId', 'userId', { unique: false })
        }

        // Cache store - for general data caching
        if (!db.objectStoreNames.contains(STORES.CACHE)) {
          db.createObjectStore(STORES.CACHE, { keyPath: 'key' })
        }
      }
    })
  }

  // Sessions Management
  async saveDayLog(userId: string, date: string, dayLog: any): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.SESSIONS], 'readwrite')
      const store = transaction.objectStore(STORES.SESSIONS)
      const key = `${userId}_${date}`
      
      store.put({ key, userId, date, dayLog, updatedAt: Date.now() })
      
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async getDayLog(userId: string, date: string): Promise<any | null> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.SESSIONS], 'readonly')
      const store = transaction.objectStore(STORES.SESSIONS)
      const key = `${userId}_${date}`
      const request = store.get(key)
      
      request.onsuccess = () => {
        const result = request.result
        resolve(result ? result.dayLog : null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getAllUserSessions(userId: string): Promise<any[]> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.SESSIONS], 'readonly')
      const store = transaction.objectStore(STORES.SESSIONS)
      const index = store.index('userId')
      const request = index.getAll(userId)
      
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  // Tags Management
  async saveTags(userId: string, tags: any[]): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.TAGS], 'readwrite')
      const store = transaction.objectStore(STORES.TAGS)
      
      store.put({ userId, tags, updatedAt: Date.now() })
      
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async getTags(userId: string): Promise<any[] | null> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.TAGS], 'readonly')
      const store = transaction.objectStore(STORES.TAGS)
      const request = store.get(userId)
      
      request.onsuccess = () => {
        const result = request.result
        resolve(result ? result.tags : null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Offline Queue Management
  async addToQueue(item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    if (!this.db) await this.init()
    
    const queueItem: OfflineQueueItem = {
      ...item,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.OFFLINE_QUEUE], 'readwrite')
      const store = transaction.objectStore(STORES.OFFLINE_QUEUE)
      
      store.add(queueItem)
      
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async getQueue(userId?: string): Promise<OfflineQueueItem[]> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.OFFLINE_QUEUE], 'readonly')
      const store = transaction.objectStore(STORES.OFFLINE_QUEUE)
      
      let request: IDBRequest
      if (userId) {
        const index = store.index('userId')
        request = index.getAll(userId)
      } else {
        request = store.getAll()
      }
      
      request.onsuccess = () => {
        const items = request.result as OfflineQueueItem[]
        // Sort by timestamp
        items.sort((a, b) => a.timestamp - b.timestamp)
        resolve(items)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async removeFromQueue(id: string): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.OFFLINE_QUEUE], 'readwrite')
      const store = transaction.objectStore(STORES.OFFLINE_QUEUE)
      
      store.delete(id)
      
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async updateQueueItem(id: string, updates: Partial<OfflineQueueItem>): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.OFFLINE_QUEUE], 'readwrite')
      const store = transaction.objectStore(STORES.OFFLINE_QUEUE)
      const request = store.get(id)
      
      request.onsuccess = () => {
        const item = request.result
        if (item) {
          const updated = { ...item, ...updates }
          store.put(updated)
        }
      }
      
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async clearQueue(): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.OFFLINE_QUEUE], 'readwrite')
      const store = transaction.objectStore(STORES.OFFLINE_QUEUE)
      
      store.clear()
      
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // Cache Management
  async setCache(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CACHE], 'readwrite')
      const store = transaction.objectStore(STORES.CACHE)
      
      const cacheItem = {
        key,
        value,
        timestamp: Date.now(),
        expiresAt: ttl ? Date.now() + ttl : null
      }
      
      store.put(cacheItem)
      
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async getCache(key: string): Promise<any | null> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CACHE], 'readonly')
      const store = transaction.objectStore(STORES.CACHE)
      const request = store.get(key)
      
      request.onsuccess = () => {
        const result = request.result
        if (!result) {
          resolve(null)
          return
        }
        
        // Check if expired
        if (result.expiresAt && result.expiresAt < Date.now()) {
          // Delete expired cache
          this.deleteCache(key)
          resolve(null)
          return
        }
        
        resolve(result.value)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async deleteCache(key: string): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CACHE], 'readwrite')
      const store = transaction.objectStore(STORES.CACHE)
      
      store.delete(key)
      
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async clearExpiredCache(): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CACHE], 'readwrite')
      const store = transaction.objectStore(STORES.CACHE)
      const request = store.openCursor()
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          const item = cursor.value
          if (item.expiresAt && item.expiresAt < Date.now()) {
            cursor.delete()
          }
          cursor.continue()
        }
      }
      
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }
}

// Singleton instance
export const offlineStorage = new OfflineStorage()
