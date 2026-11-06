import type { Account, Book, Change, EntityType, Entry, Subscription, Tag } from '@tagbill/shared'
import { incomingWins } from '@tagbill/shared'
import { db } from '../db/database'
import { deviceId, nid } from '../lib/id'
import { nowIso } from '../lib/time'

type Entity = Book | Account | Tag | Entry | Subscription

function tableFor(entity: EntityType) {
  switch (entity) {
    case 'book':
      return db.books
    case 'account':
      return db.accounts
    case 'tag':
      return db.tags
    case 'entry':
      return db.entries
    case 'subscription':
      return db.subscriptions
  }
}

export function stripSeq(change: Change): Change {
  return {
    id: change.id,
    bookId: change.bookId,
    entity: change.entity,
    entityId: change.entityId,
    rev: change.rev,
    payload: change.payload,
    deviceId: change.deviceId,
    createdAt: change.createdAt,
  }
}

export async function applyChange(change: Change): Promise<void> {
  const incoming = change.payload as Entity
  if (!incoming || typeof incoming !== 'object' || incoming.id !== change.entityId) return
  const table = tableFor(change.entity)
  const current = await table.get(incoming.id)
  if (incomingWins(incoming, current)) {
    await table.put(incoming as never)
  }
  await db.changes.put({ ...change, seq: change.seq ?? null })
}

export async function unsyncedChanges(): Promise<Change[]> {
  const rows = await db.changes.filter((change) => change.seq == null).toArray()
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function clearLedger(): Promise<void> {
  await db.books.clear()
  await db.accounts.clear()
  await db.tags.clear()
  await db.entries.clear()
  await db.subscriptions.clear()
  await db.changes.clear()
}

export async function clearSeqs(): Promise<void> {
  await db.changes.toCollection().modify({ seq: null })
}

export async function rebindLocalToBook(canonicalBookId: string): Promise<void> {
  const now = nowIso()
  await db.transaction(
    'rw',
    [db.books, db.tags, db.entries, db.accounts, db.subscriptions, db.changes],
    async () => {
    await rewriteCollection(db.tags as never, 'tag', canonicalBookId, now)
    await rewriteCollection(db.entries as never, 'entry', canonicalBookId, now)
    await rewriteCollection(db.accounts as never, 'account', canonicalBookId, now)
    await rewriteCollection(db.subscriptions as never, 'subscription', canonicalBookId, now)

    const books = await db.books.toArray()
    for (const book of books) {
      if (book.id === canonicalBookId || book.deletedAt) continue
      const next: Book = {
        ...book,
        deletedAt: now,
        rev: book.rev + 1,
        updatedAt: now,
      }
      await db.books.put(next)
      await db.changes.add({
        id: nid(),
        bookId: book.id,
        entity: 'book',
        entityId: book.id,
        rev: next.rev,
        payload: next,
        deviceId: deviceId(),
        createdAt: now,
        seq: null,
      })
    }
  })
}

async function rewriteCollection<T extends { id: string; bookId: string; rev: number; updatedAt: string }>(
  table: { toArray: () => Promise<T[]>; put: (row: T) => Promise<unknown> },
  entity: EntityType,
  canonicalBookId: string,
  now: string,
): Promise<void> {
  const rows = await table.toArray()
  for (const row of rows) {
    if (row.bookId === canonicalBookId) continue
    const next = { ...row, bookId: canonicalBookId, rev: row.rev + 1, updatedAt: now }
    await table.put(next)
    const unsynced = await db.changes
      .where('entityId')
      .equals(row.id)
      .and((change) => change.seq == null)
      .first()
    if (unsynced) {
      await db.changes.put({
        ...unsynced,
        bookId: canonicalBookId,
        rev: next.rev,
        payload: next,
      })
    } else {
      await db.changes.add({
        id: nid(),
        bookId: canonicalBookId,
        entity,
        entityId: row.id,
        rev: next.rev,
        payload: next,
        deviceId: deviceId(),
        createdAt: now,
        seq: null,
      })
    }
  }
}
