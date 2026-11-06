import type { Entry, Tag } from '@tagbill/shared'
import { getLocale } from '../i18n'
import {
  dayKey,
  daysInMonth,
  elapsedMonthsInYear,
  endOfDayMs,
  endOfMonthMs,
  inMonth,
  inYear,
  monthKey,
} from './time'

export type StatsMode = 'month' | 'year'

export type SeriesPoint = {
  key: string
  label: string
  cents: number
}

export type TagAmount = {
  tag: Tag
  cents: number
}

export type TagSlice = {
  items: TagAmount[]
  total: number
  remainderCents: number
  focused: boolean
}

export type PeriodStats = {
  expense: number
  income: number
  net: number
  avgExpense: number
  avgIncome: number
  expenseSeries: SeriesPoint[]
  incomeSeries: SeriesPoint[]
  assetSeries: SeriesPoint[]
  expenseTagSlice: TagSlice
  incomeTagSlice: TagSlice
}

export type StatsFocus = {
  expenseTagIds?: string[]
  incomeTagIds?: string[]
}

function signedAmount(entry: Entry): number {
  if (entry.type === 'income') return entry.amountCents
  if (entry.type === 'expense') return -entry.amountCents
  return 0
}

function inPeriod(entry: Entry, mode: StatsMode, period: string): boolean {
  return mode === 'month' ? inMonth(entry.occurredAt, period) : inYear(entry.occurredAt, period)
}

function hasAllTags(entry: Entry, tagIds: string[]): boolean {
  return tagIds.every((id) => entry.tagIds.includes(id))
}

export function sanitizeTagFocus(ids: string[], tags: Tag[]): string[] {
  const known = new Set(tags.map((tag) => tag.id))
  const next: string[] = []
  for (const id of ids) {
    if (!known.has(id)) break
    next.push(id)
  }
  return next
}

export function formatShare(cents: number, total: number): string {
  if (total <= 0) return '0%'
  const rounded = Math.round((cents / total) * 1000) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return `${text}%`
}

export function buildPeriodStats(
  mode: StatsMode,
  period: string,
  entries: Entry[],
  tags: Tag[],
  openingBalanceCents: number,
  options?: { now?: Date } & StatsFocus,
): PeriodStats {
  const now = options?.now ?? new Date()
  const expenseTagIds = options?.expenseTagIds ?? []
  const incomeTagIds = options?.incomeTagIds ?? []
  const periodEntries = entries.filter((entry) => inPeriod(entry, mode, period))
  let expense = 0
  let income = 0
  for (const entry of periodEntries) {
    if (entry.type === 'expense') expense += entry.amountCents
    if (entry.type === 'income') income += entry.amountCents
  }

  const divisor =
    mode === 'month' ? daysInMonth(period) : elapsedMonthsInYear(period, now)

  const buckets = mode === 'month' ? monthBuckets(period) : yearBuckets(period)
  const expenseByKey = new Map<string, number>()
  const incomeByKey = new Map<string, number>()
  for (const entry of periodEntries) {
    const key = mode === 'month' ? dayKey(entry.occurredAt) : monthKey(new Date(entry.occurredAt))
    if (entry.type === 'expense' && hasAllTags(entry, expenseTagIds)) {
      expenseByKey.set(key, (expenseByKey.get(key) ?? 0) + entry.amountCents)
    }
    if (entry.type === 'income' && hasAllTags(entry, incomeTagIds)) {
      incomeByKey.set(key, (incomeByKey.get(key) ?? 0) + entry.amountCents)
    }
  }

  const sorted = [...entries].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  let running = openingBalanceCents
  let cursor = 0
  const assetSeries: SeriesPoint[] = []
  for (const bucket of buckets) {
    while (cursor < sorted.length && new Date(sorted[cursor].occurredAt).getTime() <= bucket.endMs) {
      running += signedAmount(sorted[cursor])
      cursor += 1
    }
    assetSeries.push({ key: bucket.key, label: bucket.label, cents: running })
  }

  return {
    expense,
    income,
    net: income - expense,
    avgExpense: divisor ? Math.round(expense / divisor) : 0,
    avgIncome: divisor ? Math.round(income / divisor) : 0,
    expenseSeries: buckets.map((item) => ({
      key: item.key,
      label: item.label,
      cents: expenseByKey.get(item.key) ?? 0,
    })),
    incomeSeries: buckets.map((item) => ({
      key: item.key,
      label: item.label,
      cents: incomeByKey.get(item.key) ?? 0,
    })),
    assetSeries,
    expenseTagSlice: buildTagSlice(periodEntries, tags, 'expense', expenseTagIds),
    incomeTagSlice: buildTagSlice(periodEntries, tags, 'income', incomeTagIds),
  }
}

function buildTagSlice(
  periodEntries: Entry[],
  tags: Tag[],
  kind: 'expense' | 'income',
  focusIds: string[],
): TagSlice {
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]))
  const scoped = periodEntries.filter(
    (entry) => entry.type === kind && hasAllTags(entry, focusIds),
  )
  const total = scoped.reduce((sum, entry) => sum + entry.amountCents, 0)

  if (focusIds.length === 0) {
    const amounts = new Map<string, number>()
    for (const entry of scoped) {
      for (const tagId of entry.tagIds) {
        const tag = tagMap.get(tagId)
        if (!tag || tag.kind !== kind) continue
        amounts.set(tagId, (amounts.get(tagId) ?? 0) + entry.amountCents)
      }
    }
    return { items: rankTags(tags, amounts, kind), total, remainderCents: 0, focused: false }
  }

  const focusSet = new Set(focusIds)
  const amounts = new Map<string, number>()
  let remainderCents = 0
  for (const entry of scoped) {
    const others: string[] = []
    for (const tagId of entry.tagIds) {
      if (focusSet.has(tagId)) continue
      const tag = tagMap.get(tagId)
      if (!tag || tag.kind !== kind) continue
      others.push(tagId)
    }
    if (others.length === 0) remainderCents += entry.amountCents
    for (const tagId of others) {
      amounts.set(tagId, (amounts.get(tagId) ?? 0) + entry.amountCents)
    }
  }
  return { items: rankTags(tags, amounts, kind), total, remainderCents, focused: true }
}

function rankTags(
  tags: Tag[],
  amounts: Map<string, number>,
  kind: 'expense' | 'income',
): TagAmount[] {
  return tags
    .filter((tag) => tag.kind === kind)
    .map((tag) => ({ tag, cents: amounts.get(tag.id) ?? 0 }))
    .filter((item) => item.cents > 0)
    .sort((a, b) => b.cents - a.cents || a.tag.name.localeCompare(b.tag.name, getLocale()))
}

function monthBuckets(month: string): { key: string; label: string; endMs: number }[] {
  const [year, mon] = month.split('-').map(Number)
  const days = daysInMonth(month)
  return Array.from({ length: days }, (_, index) => {
    const day = index + 1
    return {
      key: `${month}-${String(day).padStart(2, '0')}`,
      label: String(day),
      endMs: endOfDayMs(year, mon, day),
    }
  })
}

function yearBuckets(year: string): { key: string; label: string; endMs: number }[] {
  const value = Number(year)
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    return {
      key: `${year}-${String(month).padStart(2, '0')}`,
      label: String(month),
      endMs: endOfMonthMs(value, month),
    }
  })
}
