import { randomUUID } from 'node:crypto'
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
  Syncable,
  Tag,
  TagKind,
} from '@autobill/shared'
import { TAG_COLOR_PALETTE } from '@autobill/shared'
import { applyEntity, cloudBookId, getEntityRow, insertChange, listEntityRows, withTxn } from '../db.ts'
import { nextOccurrenceOf, resolveCadence } from './schedule.ts'
import {
  buildPeriodStats,
  inMonth,
  monthKey,
  savingsCents,
  yearKey,
  type PeriodStats,
  type StatsMode,
} from './stats.ts'

export type Agent = {
  spaceId: string
  deviceKey: string
}

const DEFAULT_BOOK_NAME = '日常'

export type EntryView = Entry & {
  amountYuan: number
  tagNames: string[]
  categoryPath: string | null
}

export type TagView = Tag & { entryCount: number }

export type CategoryView = Category & {
  entryCount: number
  path: string
  depth: number
}

export type SubscriptionView = Subscription & {
  amountYuan: number
  tagNames: string[]
  nextRunAt: string | null
}

export type LedgerInfo = {
  book: Book & { openingBalanceYuan: number }
  currency: string
  openingBalanceCents: number
  savingsCents: number
  savingsYuan: number
  counts: { entries: number; categories: number; tags: number; subscriptions: number }
  serverTime: string
  timeZone: string
}

export function nowIso(): string {
  return new Date().toISOString()
}

/* ------------------------------------------------------------------ */
/* reads                                                              */
/* ------------------------------------------------------------------ */

function payloads<T>(spaceId: string, entity: EntityType): T[] {
  return listEntityRows(spaceId, entity).map((row) => JSON.parse(row.payload) as T)
}

function alive<T extends { deletedAt: string | null }>(rows: T[]): T[] {
  return rows.filter((row) => !row.deletedAt)
}

export function getBook(agent: Agent): Book | undefined {
  // Prefer the book the sync server itself calls canonical, so MCP writes land
  // in the same book a device merges to.
  const canonical = cloudBookId(agent.spaceId)
  if (canonical) {
    const row = getEntityRow(canonical)
    if (row) {
      const book = JSON.parse(row.payload) as Book
      if (!book.deletedAt) return book
    }
  }
  return alive(payloads<Book>(agent.spaceId, 'book')).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )[0]
}

export function ensureBook(agent: Agent): Book {
  const book = getBook(agent)
  if (book) return book
  const now = nowIso()
  const created: Book = {
    id: randomUUID(),
    name: DEFAULT_BOOK_NAME,
    currency: 'CNY',
    openingBalanceCents: 0,
    rev: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  return write(agent, 'book', created, created.id)
}

export function aliveTags(agent: Agent): Tag[] {
  return alive(payloads<Tag>(agent.spaceId, 'tag'))
}

export function aliveCategories(agent: Agent): Category[] {
  return alive(payloads<Category>(agent.spaceId, 'category'))
}

export function aliveEntries(agent: Agent, bookId?: string): Entry[] {
  const book = bookId ?? ensureBook(agent).id
  return alive(payloads<Entry>(agent.spaceId, 'entry')).filter((entry) => entry.bookId === book)
}

export function aliveSubscriptions(agent: Agent, bookId?: string): Subscription[] {
  const book = bookId ?? ensureBook(agent).id
  return alive(payloads<Subscription>(agent.spaceId, 'subscription')).filter(
    (sub) => sub.bookId === book,
  )
}

export function tagUsage(agent: Agent): Map<string, number> {
  const usage = new Map<string, number>()
  for (const entry of aliveEntries(agent)) {
    for (const tagId of entry.tagIds) usage.set(tagId, (usage.get(tagId) ?? 0) + 1)
  }
  return usage
}

export function tagView(tag: Tag, usage: Map<string, number>): TagView {
  return { ...tag, entryCount: usage.get(tag.id) ?? 0 }
}

export function categoryPathOf(
  categories: Category[],
  id: string | null | undefined,
): string | null {
  if (!id) return null
  const byId = new Map(categories.map((category) => [category.id, category]))
  const leaf = byId.get(id)
  if (!leaf) return null
  const parent = leaf.parentId ? byId.get(leaf.parentId) : undefined
  return parent ? `${parent.name}-${leaf.name}` : leaf.name
}

export function categoryUsage(agent: Agent): Map<string, number> {
  const usage = new Map<string, number>()
  for (const entry of aliveEntries(agent)) {
    if (!entry.categoryId) continue
    usage.set(entry.categoryId, (usage.get(entry.categoryId) ?? 0) + 1)
  }
  return usage
}

export function entryView(entry: Entry, tags: Tag[], categories: Category[]): EntryView {
  const names = new Map(tags.map((tag) => [tag.id, tag.name]))
  return {
    ...entry,
    amountYuan: entry.amountCents / 100,
    tagNames: entry.tagIds.map((id) => names.get(id) ?? id),
    categoryPath: categoryPathOf(categories, entry.categoryId),
  }
}

export function listCategories(agent: Agent, kind?: TagKind): CategoryView[] {
  const categories = aliveCategories(agent).filter(
    (category) => kind === undefined || category.kind === kind,
  )
  const usage = categoryUsage(agent)
  const roots = categories
    .filter((category) => category.parentId === null)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  const rows: CategoryView[] = []
  for (const root of roots) {
    rows.push({
      ...root,
      entryCount: usage.get(root.id) ?? 0,
      path: root.name,
      depth: 0,
    })
    const children = categories
      .filter((category) => category.parentId === root.id)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    for (const child of children) {
      rows.push({
        ...child,
        entryCount: usage.get(child.id) ?? 0,
        path: `${root.name}-${child.name}`,
        depth: 1,
      })
    }
  }
  return rows
}

export function subscriptionView(sub: Subscription, tags: Tag[], now = new Date()): SubscriptionView {
  const names = new Map(tags.map((tag) => [tag.id, tag.name]))
  const startsAt = new Date(sub.startsAt || sub.createdAt)
  return {
    ...sub,
    amountYuan: sub.amountCents / 100,
    tagNames: sub.tagIds.map((id) => names.get(id) ?? id),
    nextRunAt: sub.enabled ? nextOccurrenceOf(sub, startsAt, now).toISOString() : null,
  }
}

export function ledgerInfo(agent: Agent): LedgerInfo {
  const book = ensureBook(agent)
  const entries = aliveEntries(agent, book.id)
  const tags = aliveTags(agent)
  const subscriptions = aliveSubscriptions(agent, book.id)
  const savings = savingsCents(book.openingBalanceCents ?? 0, entries)
  return {
    book: { ...book, openingBalanceYuan: (book.openingBalanceCents ?? 0) / 100 },
    currency: book.currency,
    openingBalanceCents: book.openingBalanceCents ?? 0,
    savingsCents: savings,
    savingsYuan: savings / 100,
    counts: {
      entries: entries.length,
      categories: aliveCategories(agent).length,
      tags: tags.length,
      subscriptions: subscriptions.length,
    },
    serverTime: nowIso(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

export type EntryFilter = {
  month?: string
  from?: string
  to?: string
  type?: EntryType
  categoryId?: string
  tagIds?: string[]
  query?: string
  limit?: number
  offset?: number
}

export function listEntries(agent: Agent, filter: EntryFilter): EntryView[] {
  const book = ensureBook(agent)
  const tags = aliveTags(agent)
  const categories = aliveCategories(agent)
  const scope = filter.categoryId
    ? new Set([
        filter.categoryId,
        ...categories
          .filter((category) => category.parentId === filter.categoryId)
          .map((category) => category.id),
      ])
    : null
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500)
  const offset = Math.max(filter.offset ?? 0, 0)
  const needle = filter.query?.trim().toLowerCase() ?? ''
  const fromMs = filter.from ? startOfDayMs(filter.from) : null
  const toMs = filter.to ? endOfDayMs(filter.to) : null
  const tagFilter = filter.tagIds ?? []

  return aliveEntries(agent, book.id)
    .filter((entry) => {
      if (filter.month && !inMonth(entry.occurredAt, filter.month)) return false
      if (filter.type && entry.type !== filter.type) return false
      if (scope && !(entry.categoryId && scope.has(entry.categoryId))) return false
      if (tagFilter.length > 0 && !tagFilter.every((id) => entry.tagIds.includes(id))) return false
      if (needle && !entry.note.toLowerCase().includes(needle)) return false
      const at = new Date(entry.occurredAt).getTime()
      if (fromMs !== null && at < fromMs) return false
      if (toMs !== null && at > toMs) return false
      return true
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(offset, offset + limit)
    .map((entry) => entryView(entry, tags, categories))
}

export function getEntry(agent: Agent, id: string): EntryView {
  const entry = aliveEntries(agent).find((row) => row.id === id)
  if (!entry) throw new Error(`entry not found: ${id}`)
  return entryView(entry, aliveTags(agent), aliveCategories(agent))
}

export function getTag(agent: Agent, id: string): Tag {
  const tag = aliveTags(agent).find((row) => row.id === id)
  if (!tag) throw new Error(`tag not found: ${id}`)
  return tag
}

export function getSubscription(agent: Agent, id: string): Subscription {
  const sub = aliveSubscriptions(agent).find((row) => row.id === id)
  if (!sub) throw new Error(`subscription not found: ${id}`)
  return sub
}

export function listSubscriptions(agent: Agent, includeDisabled = true): SubscriptionView[] {
  const book = ensureBook(agent)
  const tags = aliveTags(agent)
  const now = new Date()
  return aliveSubscriptions(agent, book.id)
    .filter((sub) => includeDisabled || sub.enabled)
    .sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
      return a.createdAt.localeCompare(b.createdAt)
    })
    .map((sub) => subscriptionView(sub, tags, now))
}

export function stats(
  agent: Agent,
  mode: StatsMode,
  period: string,
  focus?: { expenseTagIds?: string[]; incomeTagIds?: string[] },
): PeriodStats & { mode: StatsMode; period: string; currency: string; savingsCents: number } {
  const book = ensureBook(agent)
  const entries = aliveEntries(agent, book.id)
  const tags = aliveTags(agent)
  const categories = aliveCategories(agent)
  const known = new Set(tags.map((tag) => tag.id))
  const sanitize = (ids?: string[]) => (ids ?? []).filter((id) => known.has(id))
  const result = buildPeriodStats(
    mode,
    period,
    entries,
    tags,
    categories,
    book.openingBalanceCents ?? 0,
    {
      expenseTagIds: sanitize(focus?.expenseTagIds),
      incomeTagIds: sanitize(focus?.incomeTagIds),
    },
  )
  return {
    ...result,
    mode,
    period,
    currency: book.currency,
    savingsCents: savingsCents(book.openingBalanceCents ?? 0, entries),
  }
}

export function defaultPeriod(mode: StatsMode): string {
  return mode === 'month' ? monthKey() : yearKey()
}

export function isValidPeriod(mode: StatsMode, period: string): boolean {
  return mode === 'month' ? /^\d{4}-\d{2}$/.test(period) : /^\d{4}$/.test(period)
}

/* ------------------------------------------------------------------ */
/* writes                                                             */
/* ------------------------------------------------------------------ */

function write<T extends Syncable>(agent: Agent, entity: EntityType, body: T, bookId: string): T {
  const current = getEntityRow(body.id)
  const now = nowIso()
  const rev = (current?.rev ?? 0) + 1
  // Never move updatedAt backwards: a device clock ahead of the server must not
  // make this write lose the last-write-wins comparison on every device.
  const updatedAt = current && current.updated_at > now ? current.updated_at : now
  const payload = { ...body, rev, updatedAt } as T
  const change: Change = {
    id: randomUUID(),
    bookId,
    entity,
    entityId: body.id,
    rev,
    payload,
    deviceId: agent.deviceKey,
    createdAt: now,
  }
  withTxn(() => {
    insertChange(agent.spaceId, change)
    applyEntity(agent.spaceId, change)
  })
  const stored = getEntityRow(body.id)
  return stored ? (JSON.parse(stored.payload) as T) : payload
}

export function createTag(
  agent: Agent,
  input: { name: string; kind?: TagKind; color?: string; icon?: string | null },
): TagView {
  const book = ensureBook(agent)
  const name = input.name.trim()
  if (!name) throw new Error('tag name is required')
  const kind: TagKind = input.kind === 'income' ? 'income' : 'expense'
  const existing = aliveTags(agent).find((tag) => tag.name === name && tag.kind === kind)
  if (existing) return tagView(existing, tagUsage(agent))

  const used = new Set(aliveTags(agent).map((tag) => tag.color))
  const color =
    input.color?.trim() ||
    TAG_COLOR_PALETTE.find((item) => !used.has(item)) ||
    TAG_COLOR_PALETTE[0]
  const now = nowIso()
  const tag: Tag = {
    id: randomUUID(),
    bookId: book.id,
    kind,
    name,
    color,
    icon: input.icon ?? null,
    rev: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  const saved = write(agent, 'tag', tag, book.id)
  return tagView(saved, tagUsage(agent))
}

export function updateTag(
  agent: Agent,
  id: string,
  patch: { name?: string; color?: string; icon?: string | null },
): TagView {
  const current = getTag(agent, id)
  const name = patch.name === undefined ? current.name : patch.name.trim()
  if (!name) throw new Error('tag name is required')
  const next: Tag = {
    ...current,
    name,
    color: patch.color?.trim() || current.color,
    icon: patch.icon === undefined ? current.icon : patch.icon,
  }
  return tagView(write(agent, 'tag', next, current.bookId), tagUsage(agent))
}

export function deleteTag(
  agent: Agent,
  id: string,
  options: { withEntries?: boolean } = {},
): { deletedTagId: string; deletedEntryIds: string[] } {
  const current = getTag(agent, id)
  const now = nowIso()
  const deleted = write(
    agent,
    'tag',
    { ...current, deletedAt: now },
    current.bookId,
  )
  const deletedEntryIds: string[] = []
  if (options.withEntries) {
    for (const entry of aliveEntries(agent, current.bookId)) {
      if (!entry.tagIds.includes(id)) continue
      write(agent, 'entry', { ...entry, deletedAt: now }, entry.bookId)
      deletedEntryIds.push(entry.id)
    }
  }
  return { deletedTagId: deleted.id, deletedEntryIds }
}

export function getCategory(agent: Agent, id: string): Category {
  const category = aliveCategories(agent).find((row) => row.id === id)
  if (!category) throw new Error(`category not found: ${id}`)
  return category
}

function categoryView(
  agent: Agent,
  category: Category,
  categories: Category[] = aliveCategories(agent),
): CategoryView {
  const parent = category.parentId
    ? categories.find((item) => item.id === category.parentId)
    : undefined
  return {
    ...category,
    // Children inherit the root's color and icon.
    color: parent ? parent.color : category.color,
    icon: parent ? parent.icon : category.icon,
    entryCount: categoryUsage(agent).get(category.id) ?? 0,
    path: parent ? `${parent.name}-${category.name}` : category.name,
    depth: category.parentId ? 1 : 0,
  }
}

export function createCategory(
  agent: Agent,
  input: { name: string; kind?: TagKind; parentId?: string | null; color?: string; icon?: string | null },
): CategoryView {
  const book = ensureBook(agent)
  const kind: TagKind = input.kind === 'income' ? 'income' : 'expense'
  const name = input.name.trim()
  if (!name) throw new Error('category name is required')
  const parentId = input.parentId ?? null
  const categories = aliveCategories(agent)

  if (parentId) {
    const parent = categories.find((category) => category.id === parentId)
    if (!parent) throw new Error(`parent category not found: ${parentId}`)
    if (parent.parentId) throw new Error('categories support only two levels')
    if (parent.kind !== kind) throw new Error(`parent category "${parent.name}" is ${parent.kind}, not ${kind}`)
  }

  const existing = categories.find(
    (category) =>
      category.parentId === parentId && category.kind === kind && category.name === name,
  )
  if (existing) return categoryView(agent, existing, categories)

  const parent = parentId ? categories.find((category) => category.id === parentId) : undefined
  const used = new Set(categories.map((category) => category.color))
  const color = parent
    ? parent.color
    : input.color?.trim() ||
      TAG_COLOR_PALETTE.find((item) => !used.has(item)) ||
      TAG_COLOR_PALETTE[0]
  const now = nowIso()
  const category: Category = {
    id: randomUUID(),
    bookId: book.id,
    kind,
    name,
    parentId,
    color,
    icon: parent ? parent.icon ?? null : input.icon ?? null,
    rev: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  const saved = write(agent, 'category', category, book.id)
  return categoryView(agent, saved, [...categories, saved])
}

export function updateCategory(
  agent: Agent,
  id: string,
  patch: { name?: string; color?: string; icon?: string | null },
): CategoryView {
  const current = getCategory(agent, id)
  const name = patch.name === undefined ? current.name : patch.name.trim()
  if (!name) throw new Error('category name is required')
  const isChild = Boolean(current.parentId)
  const next: Category = {
    ...current,
    name,
    color: isChild ? current.color : patch.color?.trim() || current.color,
    icon: isChild ? current.icon : patch.icon === undefined ? current.icon : patch.icon,
  }
  return categoryView(agent, write(agent, 'category', next, current.bookId))
}

export function deleteCategory(
  agent: Agent,
  id: string,
  options: { withEntries?: boolean } = {},
): { deletedCategoryIds: string[]; deletedEntryIds: string[]; uncategorizedEntryIds: string[] } {
  const current = getCategory(agent, id)
  const children = aliveCategories(agent).filter((category) => category.parentId === id)
  const now = nowIso()
  const deletedCategoryIds: string[] = []
  for (const category of [current, ...children]) {
    const deleted = write(agent, 'category', { ...category, deletedAt: now }, category.bookId)
    deletedCategoryIds.push(deleted.id)
  }

  const ids = new Set(deletedCategoryIds)
  const deletedEntryIds: string[] = []
  const uncategorizedEntryIds: string[] = []
  for (const entry of aliveEntries(agent, current.bookId)) {
    if (!entry.categoryId || !ids.has(entry.categoryId)) continue
    if (options.withEntries) {
      write(agent, 'entry', { ...entry, deletedAt: now }, entry.bookId)
      deletedEntryIds.push(entry.id)
    } else {
      write(agent, 'entry', { ...entry, categoryId: null }, entry.bookId)
      uncategorizedEntryIds.push(entry.id)
    }
  }
  return { deletedCategoryIds, deletedEntryIds, uncategorizedEntryIds }
}

function resolveCategory(
  agent: Agent,
  type: 'expense' | 'income',
  input: { categoryId?: string | null; categoryPath?: string },
): string | null {
  const categories = aliveCategories(agent)

  if (input.categoryId !== undefined) {
    if (input.categoryId === null) return null
    const category = categories.find((item) => item.id === input.categoryId)
    if (!category) {
      throw new Error(`category not found: ${input.categoryId}; create it first with create_category`)
    }
    if (category.kind !== type) {
      throw new Error(`category "${category.name}" is a ${category.kind} category, not ${type}`)
    }
    return category.id
  }

  if (input.categoryPath) {
    const parts = input.categoryPath
      .split(/[\/-]/)
      .map((part) => part.trim())
      .filter(Boolean)
    const root = categories.find(
      (category) => category.parentId === null && category.kind === type && category.name === parts[0],
    )
    if (!root) {
      throw new Error(
        `category "${input.categoryPath}" does not exist; create it first with create_category`,
      )
    }
    if (parts.length === 1) return root.id
    const child = categories.find(
      (category) => category.parentId === root.id && category.name === parts[1],
    )
    if (!child) {
      throw new Error(
        `category "${input.categoryPath}" does not exist; create it first with create_category`,
      )
    }
    return child.id
  }

  return null
}

export type EntryInput = {
  type?: EntryType
  amountCents?: number
  amountYuan?: number | string
  currency?: string
  categoryId?: string | null
  categoryPath?: string
  tagIds?: string[]
  tagNames?: string[]
  note?: string
  remark?: string
  occurredAt?: string
}

export function createEntry(agent: Agent, input: EntryInput): EntryView {
  const book = ensureBook(agent)
  const type = entryType(input.type)
  const amountCents = amountCentsFrom(input, 'amount')
  const categoryId = resolveCategory(agent, type, input)
  const tagIds = resolveTags(agent, type, input)
  const now = nowIso()
  const entry: Entry = {
    id: randomUUID(),
    bookId: book.id,
    type,
    amountCents,
    currency: input.currency?.trim() || book.currency,
    accountId: '',
    toAccountId: null,
    categoryId,
    tagIds,
    note: (input.note ?? '').trim(),
    remark: (input.remark ?? '').trim(),
    occurredAt: isoFrom(input.occurredAt),
    rev: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  return entryView(write(agent, 'entry', entry, book.id), aliveTags(agent), aliveCategories(agent))
}

export function updateEntry(agent: Agent, id: string, patch: EntryInput): EntryView {
  const book = ensureBook(agent)
  const current = aliveEntries(agent, book.id).find((entry) => entry.id === id)
  if (!current) throw new Error(`entry not found: ${id}`)
  const type = patch.type === undefined ? current.type : entryType(patch.type)
  const tagIds =
    patch.tagIds !== undefined || patch.tagNames !== undefined
      ? resolveTags(agent, tagKindOf(type), patch)
      : current.tagIds.filter((tagId) => {
          const tag = aliveTags(agent).find((row) => row.id === tagId)
          return !tag || tag.kind === tagKindOf(type)
        })
  const categoryId =
    patch.categoryId !== undefined || patch.categoryPath !== undefined
      ? resolveCategory(agent, tagKindOf(type), patch)
      : current.categoryId ?? null
  const next: Entry = {
    ...current,
    type,
    categoryId,
    amountCents:
      patch.amountCents === undefined && patch.amountYuan === undefined
        ? current.amountCents
        : amountCentsFrom(patch, 'amount'),
    currency: patch.currency?.trim() || current.currency,
    tagIds,
    note: patch.note === undefined ? current.note : patch.note.trim(),
    remark: patch.remark === undefined ? current.remark ?? '' : patch.remark.trim(),
    occurredAt: patch.occurredAt === undefined ? current.occurredAt : isoFrom(patch.occurredAt),
  }
  return entryView(write(agent, 'entry', next, book.id), aliveTags(agent), aliveCategories(agent))
}

export function deleteEntry(agent: Agent, id: string): { deletedEntryId: string } {
  const book = ensureBook(agent)
  const current = aliveEntries(agent, book.id).find((entry) => entry.id === id)
  if (!current) throw new Error(`entry not found: ${id}`)
  const deleted = write(agent, 'entry', { ...current, deletedAt: nowIso() }, book.id)
  return { deletedEntryId: deleted.id }
}

export function setSavings(agent: Agent, cents: number): Book & { openingBalanceYuan: number } {
  const book = ensureBook(agent)
  const entries = aliveEntries(agent, book.id)
  const net = savingsCents(0, entries)
  const next: Book = { ...book, openingBalanceCents: cents - net }
  const saved = write(agent, 'book', next, book.id)
  return { ...saved, openingBalanceYuan: saved.openingBalanceCents / 100 }
}

export type SubscriptionTimeInput = {
  id?: string
  cadence?: SubscriptionCadence
  month?: number
  day?: number
  fromEnd?: boolean
  hour?: number
  minute?: number
}

export type SubscriptionInput = {
  type?: 'expense' | 'income'
  amountCents?: number
  amountYuan?: number | string
  currency?: string
  tagIds?: string[]
  tagNames?: string[]
  note?: string
  times?: SubscriptionTimeInput[]
  enabled?: boolean
}

export function createSubscription(agent: Agent, input: SubscriptionInput): SubscriptionView {
  const book = ensureBook(agent)
  const type = input.type === 'income' ? 'income' : 'expense'
  if (!input.times || input.times.length === 0) {
    throw new Error('at least one time is required')
  }
  const recurrence = clampTimes(input.times)
  const now = nowIso()
  const subscription: Subscription = {
    id: randomUUID(),
    bookId: book.id,
    type,
    amountCents: amountCentsFrom(input, 'amount'),
    currency: input.currency?.trim() || book.currency,
    tagIds: resolveTags(agent, type, input),
    note: (input.note ?? '').trim(),
    ...recurrence,
    enabled: input.enabled ?? true,
    startsAt: now,
    rev: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  return subscriptionView(write(agent, 'subscription', subscription, book.id), aliveTags(agent))
}

export function updateSubscription(
  agent: Agent,
  id: string,
  patch: SubscriptionInput,
): SubscriptionView {
  const book = ensureBook(agent)
  const current = getSubscription(agent, id)
  const type = patch.type ?? current.type
  const mergedTimes = patch.times ?? current.times
  const recurrence = clampTimes(
    mergedTimes?.length ? mergedTimes : timesFallback(current),
    current.cadence,
  )
  const enabled = patch.enabled ?? current.enabled
  const next: Subscription = {
    ...current,
    type,
    amountCents:
      patch.amountCents === undefined && patch.amountYuan === undefined
        ? current.amountCents
        : amountCentsFrom(patch, 'amount'),
    currency: patch.currency?.trim() || current.currency,
    tagIds:
      patch.tagIds !== undefined || patch.tagNames !== undefined
        ? resolveTags(agent, type, patch)
        : current.tagIds,
    note: patch.note === undefined ? current.note : patch.note.trim(),
    ...recurrence,
    enabled,
    startsAt: enabled && !current.enabled ? nowIso() : current.startsAt,
  }
  return subscriptionView(write(agent, 'subscription', next, book.id), aliveTags(agent))
}

export function deleteSubscription(agent: Agent, id: string): { deletedSubscriptionId: string } {
  const current = getSubscription(agent, id)
  const deleted = write(
    agent,
    'subscription',
    { ...current, deletedAt: nowIso() },
    current.bookId,
  )
  return { deletedSubscriptionId: deleted.id }
}

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

export function amountCentsFrom(
  input: { amountCents?: number; amountYuan?: number | string },
  label: string,
): number {
  return centsFrom(input, label, false)
}

export function signedCentsFrom(
  input: { savingsCents?: number; savingsYuan?: number | string },
): number {
  return centsFrom(input, 'savings', true)
}

function centsFrom(
  input: Record<string, number | string | undefined>,
  label: string,
  allowNegative: boolean,
): number {
  const centsKey = label === 'savings' ? 'savingsCents' : 'amountCents'
  const yuanKey = label === 'savings' ? 'savingsYuan' : 'amountYuan'
  const raw = input
  const hasCents = raw[centsKey] !== undefined && raw[centsKey] !== null
  const hasYuan = raw[yuanKey] !== undefined && raw[yuanKey] !== null && raw[yuanKey] !== ''
  if (hasCents === hasYuan) {
    throw new Error(`provide exactly one of ${centsKey} or ${yuanKey}`)
  }
  const value = hasCents ? Number(raw[centsKey]) : Number(raw[yuanKey]) * 100
  if (!Number.isFinite(value)) throw new Error(`${label} is not a number`)
  const cents = Math.round(value)
  if (!allowNegative && cents < 0) throw new Error(`${label} must not be negative`)
  return cents
}

export function isoFrom(input?: string): string {
  if (input === undefined || input === '') return nowIso()
  const trimmed = input.trim()
  const naive = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed)
  if (naive) {
    const [, year, month, day, hour, minute, second] = naive
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second ?? 0),
    ).toISOString()
  }
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (dateOnly) {
    const [, year, month, day] = dateOnly
    return new Date(Number(year), Number(month) - 1, Number(day)).toISOString()
  }
  const ms = Date.parse(trimmed)
  if (!Number.isFinite(ms)) throw new Error(`invalid time: ${input}`)
  return new Date(ms).toISOString()
}

function startOfDayMs(value: string): number {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0).getTime()
}

function endOfDayMs(value: string): number {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime()
}

function entryType(value?: EntryType): 'expense' | 'income' {
  if (value === 'transfer') throw new Error('transfer entries are not supported')
  return value === 'income' ? 'income' : 'expense'
}

function tagKindOf(type: EntryType): TagKind {
  return type === 'income' ? 'income' : 'expense'
}

function resolveTags(
  agent: Agent,
  type: 'expense' | 'income',
  selector: { tagIds?: string[]; tagNames?: string[] },
): string[] {
  const tags = aliveTags(agent)
  const byId = new Map(tags.map((tag) => [tag.id, tag]))
  const ids = new Set<string>()

  for (const id of selector.tagIds ?? []) {
    const tag = byId.get(id)
    if (!tag) throw new Error(`tag not found: ${id}; create it first with create_tag`)
    if (tag.kind !== type) throw new Error(`tag "${tag.name}" is a ${tag.kind} tag, not ${type}`)
    ids.add(id)
  }

  for (const raw of selector.tagNames ?? []) {
    const name = raw.trim()
    if (!name) continue
    const found = tags.find((tag) => tag.name === name && tag.kind === type)
    if (!found) {
      throw new Error(
        `tag "${name}" does not exist; create it first with create_tag (kind: ${type})`,
      )
    }
    ids.add(found.id)
  }
  return [...ids]
}

function clampSlot(
  slot: SubscriptionTimeInput,
  fallback?: SubscriptionCadence,
): SubscriptionTime & { cadence: SubscriptionCadence } {
  const cadence = resolveCadence(slot.cadence ?? fallback)
  const day =
    cadence === 'weekly'
      ? Math.min(6, Math.max(0, Math.trunc(slot.day ?? 0)))
      : Math.min(31, Math.max(1, Math.trunc(slot.day ?? 1)))
  return {
    id: slot.id || randomUUID(),
    cadence,
    month: Math.min(12, Math.max(1, Math.trunc(slot.month ?? 1))),
    day,
    fromEnd: cadence === 'monthly' && Boolean(slot.fromEnd),
    hour: Math.min(23, Math.max(0, Math.trunc(slot.hour ?? 0))),
    minute: Math.min(59, Math.max(0, Math.trunc(slot.minute ?? 0))),
  }
}

function clampTimes(times: SubscriptionTimeInput[], fallback?: SubscriptionCadence) {
  const slots = times.map((slot) => clampSlot(slot, fallback))
  const first = slots[0] ?? clampSlot({}, fallback)
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

function timesFallback(current: Subscription): SubscriptionTimeInput[] {
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
