import { offlineStorage } from './offlineStorage'
import { addSession, getUserTags, createTag, deleteTag } from './firestore'
import { Session, Tag } from '../types'

class SyncService {
  private isSyncing = false
  private syncCallbacks: (() => void)[] = []

  // Register callback to be notified when sync completes
  onSyncComplete(callback: () => void) {
    this.syncCallbacks.push(callback)
  }

  private notifySyncComplete() {
    this.syncCallbacks.forEach(cb => cb())
  }

  async syncOfflineQueue(userId: string): Promise<{ success: number; failed: number }> {
    if (this.isSyncing) {
      console.log('Sync already in progress')
      return { success: 0, failed: 0 }
    }

    if (!navigator.onLine) {
      console.log('Cannot sync: offline')
      return { success: 0, failed: 0 }
    }

    this.isSyncing = true
    let successCount = 0
    let failedCount = 0

    try {
      const queue = await offlineStorage.getQueue(userId)
      
      if (queue.length === 0) {
        console.log('No items in queue to sync')
        this.isSyncing = false
        return { success: 0, failed: 0 }
      }

      console.log(`Starting sync of ${queue.length} queued items`)

      for (const item of queue) {
        try {
          await this.processQueueItem(item)
          await offlineStorage.removeFromQueue(item.id)
          successCount++
          console.log(`Synced: ${item.type}`)
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error)
          
          // Update retry count
          const newRetryCount = item.retryCount + 1
          
          // Remove if retried too many times (10 attempts)
          if (newRetryCount >= 10) {
            console.error(`Removing item ${item.id} after ${newRetryCount} failed attempts`)
            await offlineStorage.removeFromQueue(item.id)
            failedCount++
          } else {
            await offlineStorage.updateQueueItem(item.id, { retryCount: newRetryCount })
            failedCount++
          }
        }
      }

      console.log(`Sync complete: ${successCount} success, ${failedCount} failed`)
      this.notifySyncComplete()
      
    } catch (error) {
      console.error('Error during sync:', error)
    } finally {
      this.isSyncing = false
    }

    return { success: successCount, failed: failedCount }
  }

  private async processQueueItem(item: any): Promise<void> {
    switch (item.type) {
      case 'ADD_SESSION':
        await addSession(item.userId, item.data.date, item.data.session)
        break
        
      case 'CREATE_TAG':
        await createTag(item.userId, item.data.tag)
        break
        
      case 'DELETE_TAG':
        await deleteTag(item.userId, item.data.tagId)
        break
        
      default:
        console.warn(`Unknown queue item type: ${item.type}`)
    }
  }

  async getQueueCount(userId: string): Promise<number> {
    const queue = await offlineStorage.getQueue(userId)
    return queue.length
  }

  async clearQueue(): Promise<void> {
    await offlineStorage.clearQueue()
  }
}

export const syncService = new SyncService()
