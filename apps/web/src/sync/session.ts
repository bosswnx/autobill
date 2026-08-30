import type { SyncMeta } from '../db/database'
import { db } from '../db/database'

export async function getSession(): Promise<SyncMeta | undefined> {
  return db.meta.get('sync')
}

export async function isConnected(): Promise<boolean> {
  const session = await getSession()
  return Boolean(session?.deviceToken)
}

export async function saveSession(patch: Omit<SyncMeta, 'key'> | Partial<SyncMeta>): Promise<void> {
  const current = await getSession()
  const next: SyncMeta = {
    key: 'sync',
    serverUrl: '',
    spaceId: '',
    deviceToken: '',
    cursor: null,
    lastSyncedAt: null,
    lastError: null,
    ...current,
    ...patch,
  }
  await db.meta.put(next)
}

export async function clearSession(): Promise<void> {
  await db.meta.delete('sync')
}

export async function hasLocalData(): Promise<boolean> {
  const books = await db.books.toArray()
  return books.some((book) => !book.deletedAt)
}
