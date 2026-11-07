import type {
  Book,
  Category,
  Change,
  EntityType,
  Entry,
  EntryType,
  Subscription,
  SubscriptionCadence,
  SubscriptionTime,
  Tag,
  TagKind,
} from '@autobill/shared'
import { TAG_COLOR_PALETTE } from '@autobill/shared'
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

export type CategoryDraft = {
  name: string
  kind?: TagKind
  parentId?: string | null
  color?: string
  icon?: string | null
}

export async function createCategory(bookId: string, draft: CategoryDraft): Promise<Category> {
  const kind: TagKind = draft.kind === 'income' ? 'income' : 'expense'
  const parentId = draft.parentId ?? null
  const name = draft.name.trim()
  if (!name) throw new Error('category name is required')

  if (parentId) {
    const parent = await db.categories.get(parentId)
    if (!parent || parent.deletedAt) throw new Error('parent category not found')
    if (parent.parentId) throw new Error('categories support only two levels')
    if (parent.kind !== kind) throw new Error('parent category kind mismatch')
  }

  const existing = await db.categories
    .where('bookId')
    .equals(bookId)
    .filter(
      (category) =>
        !category.deletedAt &&
        category.parentId === parentId &&
        category.kind === kind &&
        category.name === name,
    )
    .first()
  if (existing) return existing

  const used = new Set(
    (await db.categories.where('bookId').equals(bookId).toArray())
      .filter((category) => !category.deletedAt)
      .map((category) => category.color),
  )
  const color =
    draft.color ?? TAG_COLOR_PALETTE.find((item) => !used.has(item)) ?? TAG_COLOR_PALETTE[0]
  const now = nowIso()
  const category: Category = {
    id: nid(),
    bookId,
    kind,
    name,
    parentId,
    color,
    icon: draft.icon ?? null,
    rev: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  await db.categories.add(category)
  await appendChange(bookId, 'category', category.id, category.rev, category)
  return category
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'color' | 'icon'>>,
): Promise<void> {
  const current = await db.categories.get(id)
  if (!current) return
  const next: Category = {
    ...current,
    ...patch,
    name: patch.name === undefined ? current.name : patch.name.trim(),
    rev: current.rev + 1,
    updatedAt: nowIso(),
  }
  await db.categories.put(next)
  await appendChange(next.bookId, 'category', next.id, next.rev, next)
}

export async function deleteCategory(
  id: string,
  opts?: { withEntries?: boolean },
): Promise<void> {
  const current = await db.categories.get(id)
  if (!current) return
  const children = (await db.categories.where('bookId').equals(current.bookId).toArray()).filter(
    (category) => !category.deletedAt && category.parentId === id,
  )
  const ids = new Set([id, ...children.map((category) => category.id)])
  const affected = (await db.entries.where('bookId').equals(current.bookId).toArray()).filter(
    (entry) => !entry.deletedAt && entry.categoryId !== null && ids.has(entry.categoryId),
  )
  const now = nowIso()

  await db.transaction('rw', db.categories, db.entries, db.changes, async () => {
    for (const category of [current, ...children]) {
      const next: Category = {
        ...category,
        deletedAt: now,
        rev: category.rev + 1,
        updatedAt: now,
      }
      await db.categories.put(next)
      await appendChange(next.bookId, 'category', next.id, next.rev, next)
    }
    for (const entry of affected) {
      const next: Entry = opts?.withEntries
        ? { ...entry, deletedAt: now, rev: entry.rev + 1, updatedAt: now }
        : { ...entry, categoryId: null, rev: entry.rev + 1, updatedAt: now }
      await db.entries.put(next)
      await appendChange(next.bookId, 'entry', next.id, next.rev, next)
    }
  })
}

export type EntryDraft = {
  id?: string
  bookId: string
  type: EntryType
  amountCents: number
  currency: string
  accountId: string
  toAccountId: string | null
  categoryId: string | null
  tagIds: string[]
  note: string
  remark: string
  occurredAt: string
}

export async function createEntry(draft: EntryDraft): Promise<Entry> {
  const { id: requestedId, ...rest } = draft
  if (requestedId) {
    const existing = await db.entries.get(requestedId)
    if (existing) return existing
  }
  const now = nowIso()
  const entry: Entry = {
    id: requestedId ?? nid(),
    ...rest,
    rev: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  await db.entries.add(entry)
  await appendChange(entry.bookId, 'entry', entry.id, entry.rev, entry)
  return entry
}

export async function updateEntry(id: string, draft: Omit<EntryDraft, 'bookId' | 'id'>): Promise<void> {
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

export type SubscriptionDraft = {
  bookId: string
  type: Exclude<EntryType, 'transfer'>
  amountCents: number
  currency: string
  tagIds: string[]
  note: string
  times: SubscriptionTime[]
  enabled: boolean
}

function resolveCadence(value?: string): SubscriptionCadence {
  return value === 'yearly' || value === 'weekly' ? value : 'monthly'
}

function clampSlot(slot: SubscriptionDraft['times'][number], fallback?: SubscriptionCadence) {
  const cadence = resolveCadence(slot.cadence ?? fallback)
  const day =
    cadence === 'weekly'
      ? Math.min(6, Math.max(0, Math.trunc(slot.day) || 0))
      : Math.min(31, Math.max(1, Math.trunc(slot.day) || 1))
  return {
    id: slot.id || nid(),
    cadence,
    month: Math.min(12, Math.max(1, Math.trunc(slot.month) || 1)),
    day,
    fromEnd: cadence === 'monthly' && Boolean(slot.fromEnd),
    hour: Math.min(23, Math.max(0, Math.trunc(slot.hour) || 0)),
    minute: Math.min(59, Math.max(0, Math.trunc(slot.minute) || 0)),
  }
}

function clampTimes(times: SubscriptionDraft['times'], fallback?: SubscriptionCadence) {
  const slots = times.map((slot) => clampSlot(slot, fallback))
  const first = slots[0] ?? clampSlot({ id: '', month: 1, day: 1, fromEnd: false, hour: 0, minute: 0 }, fallback)
  return {
    cadence: first.cadence,
    times: slots,
    month: first.month,
    day: first.day,
    fromEnd: first.fromEnd,
    hour: first.hour,
    minute: first.minute,
  }
}

export async function createSubscription(draft: SubscriptionDraft): Promise<Subscription> {
  const now = nowIso()
  const recurrence = clampTimes(draft.times)
  const subscription: Subscription = {
    id: nid(),
    bookId: draft.bookId,
    type: draft.type === 'income' ? 'income' : 'expense',
    amountCents: draft.amountCents,
    currency: draft.currency,
    tagIds: draft.tagIds,
    note: draft.note,
    ...recurrence,
    enabled: draft.enabled,
    startsAt: now,
    rev: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  await db.subscriptions.add(subscription)
  await appendChange(subscription.bookId, 'subscription', subscription.id, subscription.rev, subscription)
  return subscription
}

export async function updateSubscription(
  id: string,
  patch: Partial<Omit<SubscriptionDraft, 'bookId'>>,
): Promise<void> {
  const current = await db.subscriptions.get(id)
  if (!current) return
  const now = nowIso()
  const mergedTimes = patch.times ?? current.times
  const recurrence = clampTimes(mergedTimes?.length ? mergedTimes : timesFallback(current), current.cadence)
  const merged = {
    type: patch.type ?? current.type,
    amountCents: patch.amountCents ?? current.amountCents,
    currency: patch.currency ?? current.currency,
    tagIds: patch.tagIds ?? current.tagIds,
    note: patch.note ?? current.note,
    enabled: patch.enabled ?? current.enabled,
  }
  const enabling = merged.enabled && !current.enabled
  const next: Subscription = {
    ...current,
    ...merged,
    ...recurrence,
    startsAt: enabling ? now : current.startsAt,
    rev: current.rev + 1,
    updatedAt: now,
  }
  await db.subscriptions.put(next)
  await appendChange(next.bookId, 'subscription', next.id, next.rev, next)
}

function timesFallback(current: Subscription): SubscriptionDraft['times'] {
  return [
    {
      id: 'legacy',
      cadence: current.cadence,
      month: current.month,
      day: current.day,
      fromEnd: Boolean(current.fromEnd),
      hour: current.hour,
      minute: current.minute,
    },
  ]
}

export async function deleteSubscription(id: string): Promise<void> {
  const current = await db.subscriptions.get(id)
  if (!current) return
  const now = nowIso()
  const next: Subscription = {
    ...current,
    deletedAt: now,
    rev: current.rev + 1,
    updatedAt: now,
  }
  await db.subscriptions.put(next)
  await appendChange(next.bookId, 'subscription', next.id, next.rev, next)
}
