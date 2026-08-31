import type { Book, Change, EntityType, Entry, EntryType, Tag, TagKind } from '@tagledger/shared'
import { TAG_COLOR_PALETTE } from '@tagledger/shared'
import { db } from './database'
import { deviceId, nid } from '../lib/id'
import { nowIso } from '../lib/time'
import { requestSync } from '../sync/engine'

async function appendChange(
  bookId: string,
  entity: EntityType,
  entityId: string,
  rev: number,
  payload: unknown,
): Promise<void> {
  const change: Change = {
    id: nid(),
    bookId,
    entity,
    entityId,
    rev,
    payload,
    deviceId: deviceId(),
    createdAt: nowIso(),
    seq: null,
  }
  await db.changes.add(change)
  requestSync()
}

export async function createBook(name: string, currency = 'CNY'): Promise<Book> {
  const now = nowIso()
  const book: Book = {
    id: nid(),
    name,
    currency,
    openingBalanceCents: 0,
    rev: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  await db.books.add(book)
  await appendChange(book.id, 'book', book.id, book.rev, book)
  return book
}

export async function updateBook(
  id: string,
  patch: Partial<Pick<Book, 'name' | 'openingBalanceCents'>>,
): Promise<void> {
  const current = await db.books.get(id)
  if (!current) return
  const next: Book = {
    ...current,
    openingBalanceCents: current.openingBalanceCents ?? 0,
    ...patch,
    rev: current.rev + 1,
    updatedAt: nowIso(),
  }
  await db.books.put(next)
  await appendChange(next.id, 'book', next.id, next.rev, next)
}

export async function setSavings(bookId: string, currentCents: number): Promise<void> {
  const rows = (await db.entries.where('bookId').equals(bookId).toArray()).filter(
    (entry) => !entry.deletedAt,
  )
  let net = 0
  for (const entry of rows) {
    if (entry.type === 'income') net += entry.amountCents
    if (entry.type === 'expense') net -= entry.amountCents
  }
  await updateBook(bookId, { openingBalanceCents: currentCents - net })
}

export async function createTag(
  bookId: string,
  name: string,
  color?: string,
  icon?: string | null,
  kind: TagKind = 'expense',
): Promise<Tag> {
  const existing = await db.tags
    .where('bookId')
    .equals(bookId)
    .filter((tag) => !tag.deletedAt && tag.name === name && tag.kind === kind)
    .first()
  if (existing) return existing

  const used = new Set(
    (await db.tags.where('bookId').equals(bookId).toArray())
      .filter((tag) => !tag.deletedAt)
      .map((tag) => tag.color),
  )
  const picked =
    color ?? TAG_COLOR_PALETTE.find((item) => !used.has(item)) ?? TAG_COLOR_PALETTE[0]
  const now = nowIso()
  const tag: Tag = {
    id: nid(),
    bookId,
    kind,
    name,
    color: picked,
    icon: icon ?? null,
    rev: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  await db.tags.add(tag)
  await appendChange(bookId, 'tag', tag.id, tag.rev, tag)
  return tag
}

export async function updateTag(
  id: string,
  patch: Partial<Pick<Tag, 'name' | 'color' | 'icon'>>,
): Promise<void> {
  const current = await db.tags.get(id)
  if (!current) return
  const next: Tag = {
    ...current,
    ...patch,
    rev: current.rev + 1,
    updatedAt: nowIso(),
  }
  await db.tags.put(next)
  await appendChange(next.bookId, 'tag', next.id, next.rev, next)
}

export async function deleteTag(id: string, opts?: { withEntries?: boolean }): Promise<void> {
  const current = await db.tags.get(id)
  if (!current) return
  const now = nowIso()
  const tagged = opts?.withEntries
    ? (await db.entries.where('bookId').equals(current.bookId).toArray()).filter(
        (entry) => !entry.deletedAt && entry.tagIds.includes(id),
      )
    : []

  await db.transaction('rw', db.tags, db.entries, db.changes, async () => {
    const next: Tag = {
      ...current,
      deletedAt: now,
      rev: current.rev + 1,
      updatedAt: now,
    }
    await db.tags.put(next)
    await appendChange(next.bookId, 'tag', next.id, next.rev, next)

    for (const entry of tagged) {
      const deleted: Entry = {
        ...entry,
        deletedAt: now,
        rev: entry.rev + 1,
        updatedAt: now,
      }
      await db.entries.put(deleted)
      await appendChange(deleted.bookId, 'entry', deleted.id, deleted.rev, deleted)
    }
  })
}

export type EntryDraft = {
  bookId: string
  type: EntryType
  amountCents: number
  currency: string
  accountId: string
  toAccountId: string | null
  tagIds: string[]
  note: string
  occurredAt: string
}

export async function createEntry(draft: EntryDraft): Promise<Entry> {
  const now = nowIso()
  const entry: Entry = {
    id: nid(),
    ...draft,
    rev: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  await db.entries.add(entry)
  await appendChange(entry.bookId, 'entry', entry.id, entry.rev, entry)
  return entry
}

export async function updateEntry(id: string, draft: Omit<EntryDraft, 'bookId'>): Promise<void> {
  const current = await db.entries.get(id)
  if (!current) return
  const next: Entry = {
    ...current,
    ...draft,
    rev: current.rev + 1,
    updatedAt: nowIso(),
  }
  await db.entries.put(next)
  await appendChange(next.bookId, 'entry', next.id, next.rev, next)
}

export async function deleteEntry(id: string): Promise<void> {
  const current = await db.entries.get(id)
  if (!current) return
  const next: Entry = {
    ...current,
    deletedAt: nowIso(),
    rev: current.rev + 1,
    updatedAt: nowIso(),
  }
  await db.entries.put(next)
  await appendChange(next.bookId, 'entry', next.id, next.rev, next)
}
