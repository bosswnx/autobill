import type {
  Account,
  Book,
  Category,
  Change,
  Entry,
  Subscription,
  Tag,
  TagKind,
} from '@autobill/shared'
import Dexie, { type EntityTable } from 'dexie'

export type SyncMeta = {
  key: 'sync'
  serverUrl: string
  spaceId: string
  deviceToken: string
  cursor: string | null
  lastSyncedAt: string | null
  lastError: string | null
}

export class AutoBillDB extends Dexie {
  books!: EntityTable<Book, 'id'>
  accounts!: EntityTable<Account, 'id'>
  categories!: EntityTable<Category, 'id'>
  tags!: EntityTable<Tag, 'id'>
  entries!: EntityTable<Entry, 'id'>
  subscriptions!: EntityTable<Subscription, 'id'>
  changes!: EntityTable<Change, 'id'>
  meta!: EntityTable<SyncMeta, 'key'>

  constructor() {
    super('autobill')
    this.version(1).stores({
      books: 'id, updatedAt',
      accounts: 'id, bookId, updatedAt',
      tags: 'id, bookId, name, updatedAt',
      entries: 'id, bookId, occurredAt, accountId, *tagIds, updatedAt',
      changes: 'id, bookId, createdAt, entity, entityId',
    })
    this.version(2)
      .stores({
        books: 'id, updatedAt',
        accounts: 'id, bookId, updatedAt',
        tags: 'id, bookId, kind, name, updatedAt',
        entries: 'id, bookId, occurredAt, accountId, *tagIds, updatedAt',
        changes: 'id, bookId, createdAt, entity, entityId',
      })
      .upgrade(async (tx) => {
        const tags = await tx.table('tags').toArray()
        const entries = await tx.table('entries').toArray()
        for (const tag of tags) {
          if (tag.kind === 'expense' || tag.kind === 'income') continue
          let expense = 0
          let income = 0
          for (const entry of entries) {
            if (entry.deletedAt) continue
            if (!entry.tagIds?.includes(tag.id)) continue
            if (entry.type === 'income') income += 1
            if (entry.type === 'expense') expense += 1
          }
          const kind: TagKind = income > expense ? 'income' : 'expense'
          await tx.table('tags').put({ ...tag, kind })
        }
      })
    this.version(3).stores({
      books: 'id, updatedAt',
      accounts: 'id, bookId, updatedAt',
      tags: 'id, bookId, kind, name, updatedAt',
      entries: 'id, bookId, occurredAt, accountId, *tagIds, updatedAt',
      changes: 'id, bookId, createdAt, entity, entityId, seq',
      meta: 'key',
    })
    this.version(4).stores({
      subscriptions: 'id, bookId, updatedAt',
    })
    this.version(5).stores({
      categories: 'id, bookId, parentId, kind, name, updatedAt',
    })
  }
}

export const db = new AutoBillDB()

const LEGACY_DBS = ['tagbill', 'tagledger']

/**
 * Copies a pre-rename IndexedDB database into the new one. Runs before the
 * first render; the legacy database is left untouched.
 */
export async function migrateLegacyDb(): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  try {
    const legacyName = await firstExistingDb()
    if (!legacyName) return
    if ((await Dexie.exists('autobill')) && (await db.books.count()) > 0) return
    await db.open()
    const legacy = await openLegacyDb(legacyName)
    try {
      for (const name of Array.from(legacy.objectStoreNames)) {
        const table = db.tables.find((item) => item.name === name)
        if (!table) continue
        const rows = await readAll(legacy, name)
        if (rows.length > 0) await table.bulkPut(rows)
      }
    } finally {
      legacy.close()
    }
  } catch (error) {
    console.warn('legacy -> autobill migration skipped', error)
  }
}

async function firstExistingDb(): Promise<string | null> {
  for (const name of LEGACY_DBS) {
    if (await Dexie.exists(name)) return name
  }
  return null
}

function openLegacyDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function readAll(database: IDBDatabase, store: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(store, 'readonly')
    const request = transaction.objectStore(store).getAll()
    request.onsuccess = () => resolve(request.result as unknown[])
    request.onerror = () => reject(request.error)
  })
}
