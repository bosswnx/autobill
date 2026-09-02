import type { Account, Book, Change, Entry, Subscription, Tag, TagKind } from '@tagledger/shared'
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

export class TagLedgerDB extends Dexie {
  books!: EntityTable<Book, 'id'>
  accounts!: EntityTable<Account, 'id'>
  tags!: EntityTable<Tag, 'id'>
  entries!: EntityTable<Entry, 'id'>
  subscriptions!: EntityTable<Subscription, 'id'>
  changes!: EntityTable<Change, 'id'>
  meta!: EntityTable<SyncMeta, 'key'>

  constructor() {
    super('tagledger')
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
  }
}

export const db = new TagLedgerDB()
