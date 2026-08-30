import type { Entry, Tag } from '@tagledger/shared'
import {
  dayKey,
  daysInMonth,
  elapsedDaysInMonth,
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

export type PeriodStats = {
  expense: number
  income: number
  net: number
  avgExpense: number
  avgIncome: number
  expenseSeries: SeriesPoint[]
  incomeSeries: SeriesPoint[]
  assetSeries: SeriesPoint[]
  expenseTags: TagAmount[]
  incomeTags: TagAmount[]
}

function signedAmount(entry: Entry): number {
  if (entry.type === 'income') return entry.amountCents
  if (entry.type === 'expense') return -entry.amountCents
  return 0
}

function inPeriod(entry: Entry, mode: StatsMode, period: string): boolean {
  return mode === 'month' ? inMonth(entry.occurredAt, period) : inYear(entry.occurredAt, period)
}

export function buildPeriodStats(
  mode: StatsMode,
  period: string,
  entries: Entry[],
  tags: Tag[],
  openingBalanceCents: number,
  now = new Date(),
): PeriodStats {
  const periodEntries = entries.filter((entry) => inPeriod(entry, mode, period))
  let expense = 0
  let income = 0
  for (const entry of periodEntries) {
    if (entry.type === 'expense') expense += entry.amountCents
    if (entry.type === 'income') income += entry.amountCents
  }

  const divisor =
    mode === 'month' ? elapsedDaysInMonth(period, now) : elapsedMonthsInYear(period, now)

  const buckets = mode === 'month' ? monthBuckets(period) : yearBuckets(period)
  const expenseByKey = new Map<string, number>()
  const incomeByKey = new Map<string, number>()
  for (const entry of periodEntries) {
    const key = mode === 'month' ? dayKey(entry.occurredAt) : monthKey(new Date(entry.occurredAt))
    if (entry.type === 'expense') {
      expenseByKey.set(key, (expenseByKey.get(key) ?? 0) + entry.amountCents)
    }
    if (entry.type === 'income') {
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

  const tagMap = new Map(tags.map((tag) => [tag.id, tag]))
  const expenseTagCents = new Map<string, number>()
  const incomeTagCents = new Map<string, number>()
  for (const entry of periodEntries) {
    for (const tagId of entry.tagIds) {
      const tag = tagMap.get(tagId)
      if (!tag) continue
      if (tag.kind === 'expense' && entry.type === 'expense') {
        expenseTagCents.set(tagId, (expenseTagCents.get(tagId) ?? 0) + entry.amountCents)
      }
      if (tag.kind === 'income' && entry.type === 'income') {
        incomeTagCents.set(tagId, (incomeTagCents.get(tagId) ?? 0) + entry.amountCents)
      }
    }
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
    expenseTags: rankTags(tags, expenseTagCents, 'expense'),
    incomeTags: rankTags(tags, incomeTagCents, 'income'),
  }
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
    .sort((a, b) => b.cents - a.cents || a.tag.name.localeCompare(b.tag.name, 'zh'))
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
