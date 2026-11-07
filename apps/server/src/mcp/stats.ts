import type { Category, Entry, Tag } from '@autobill/shared'

/** Mirrors apps/web/src/lib/stats.ts, without locale-dependent labels. */

export type StatsMode = 'month' | 'year'

export type SeriesPoint = {
  key: string
  label: string
  cents: number
}

export type TagAmount = {
  tagId: string
  name: string
  kind: 'expense' | 'income'
  cents: number
  share: number
}

export type TagSlice = {
  items: TagAmount[]
  totalCents: number
  remainderCents: number
  focused: boolean
}

export type CategoryAmount = {
  categoryId: string
  name: string
  path: string
  cents: number
  share: number
}

export type CategoryGroup = {
  categoryId: string
  name: string
  cents: number
  share: number
  children: CategoryAmount[]
}

export type CategoryBreakdown = {
  groups: CategoryGroup[]
  uncategorizedCents: number
  totalCents: number
}

export type PeriodStats = {
  expenseCents: number
  incomeCents: number
  netCents: number
  count: number
  avgExpenseCents: number
  avgIncomeCents: number
  expenseSeries: SeriesPoint[]
  incomeSeries: SeriesPoint[]
  assetSeries: SeriesPoint[]
  expenseCategories: CategoryBreakdown
  incomeCategories: CategoryBreakdown
  expenseTags: TagSlice
  incomeTags: TagSlice
}

export type StatsFocus = {
  expenseTagIds?: string[]
  incomeTagIds?: string[]
}

export function buildPeriodStats(
  mode: StatsMode,
  period: string,
  entries: Entry[],
  tags: Tag[],
  categories: Category[],
  openingBalanceCents: number,
  options?: StatsFocus & { now?: Date },
): PeriodStats {
  const now = options?.now ?? new Date()
  const expenseFocus = options?.expenseTagIds ?? []
  const incomeFocus = options?.incomeTagIds ?? []
  const periodEntries = entries.filter((entry) => inPeriod(entry, mode, period))
  let expense = 0
  let income = 0
  for (const entry of periodEntries) {
    if (entry.type === 'expense') expense += entry.amountCents
    if (entry.type === 'income') income += entry.amountCents
  }

  const divisor = mode === 'month' ? daysInMonth(period) : elapsedMonthsInYear(period, now)
  const buckets = mode === 'month' ? monthBuckets(period) : yearBuckets(period)
  const expenseByKey = new Map<string, number>()
  const incomeByKey = new Map<string, number>()
  for (const entry of periodEntries) {
    const key = mode === 'month' ? dayKey(entry.occurredAt) : monthKeyOf(entry.occurredAt)
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

  return {
    expenseCents: expense,
    incomeCents: income,
    netCents: income - expense,
    count: periodEntries.length,
    avgExpenseCents: divisor ? Math.round(expense / divisor) : 0,
    avgIncomeCents: divisor ? Math.round(income / divisor) : 0,
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
    expenseCategories: buildCategoryBreakdown(periodEntries, categories, 'expense'),
    incomeCategories: buildCategoryBreakdown(periodEntries, categories, 'income'),
    expenseTags: buildTagSlice(periodEntries, tags, 'expense', expenseFocus),
    incomeTags: buildTagSlice(periodEntries, tags, 'income', incomeFocus),
  }
}

export function savingsCents(openingBalanceCents: number, entries: Entry[]): number {
  let net = 0
  for (const entry of entries) net += signedAmount(entry)
  return openingBalanceCents + net
}

export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function yearKey(date = new Date()): string {
  return String(date.getFullYear())
}

function buildTagSlice(
  entries: Entry[],
  tags: Tag[],
  kind: 'expense' | 'income',
  focusIds: string[],
): TagSlice {
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]))
  const focusSet = new Set(focusIds)
  const scoped = entries.filter(
    (entry) => entry.type === kind && focusIds.every((id) => entry.tagIds.includes(id)),
  )
  const totalCents = scoped.reduce((sum, entry) => sum + entry.amountCents, 0)
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
    if (focusIds.length > 0 && others.length === 0) remainderCents += entry.amountCents
    for (const tagId of others) {
      amounts.set(tagId, (amounts.get(tagId) ?? 0) + entry.amountCents)
    }
  }
  const items = [...amounts.entries()]
    .map(([tagId, cents]) => ({
      tagId,
      name: tagMap.get(tagId)?.name ?? tagId,
      kind,
      cents,
      share: totalCents > 0 ? Math.round((cents / totalCents) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name))
  return { items, totalCents, remainderCents, focused: focusIds.length > 0 }
}

function buildCategoryBreakdown(
  periodEntries: Entry[],
  categories: Category[],
  kind: 'expense' | 'income',
): CategoryBreakdown {
  const scoped = periodEntries.filter((entry) => entry.type === kind)
  const totalCents = scoped.reduce((sum, entry) => sum + entry.amountCents, 0)
  const byId = new Map(
    categories.filter((category) => category.kind === kind).map((category) => [category.id, category]),
  )
  const rootAmounts = new Map<string, number>()
  const childAmounts = new Map<string, number>()
  let uncategorizedCents = 0

  for (const entry of scoped) {
    const category = entry.categoryId ? byId.get(entry.categoryId) : undefined
    if (!category) {
      uncategorizedCents += entry.amountCents
      continue
    }
    if (category.parentId) {
      childAmounts.set(category.id, (childAmounts.get(category.id) ?? 0) + entry.amountCents)
      rootAmounts.set(category.parentId, (rootAmounts.get(category.parentId) ?? 0) + entry.amountCents)
    } else {
      rootAmounts.set(category.id, (rootAmounts.get(category.id) ?? 0) + entry.amountCents)
    }
  }

  const share = (cents: number) =>
    totalCents > 0 ? Math.round((cents / totalCents) * 1000) / 10 : 0
  const groups = categories
    .filter((category) => category.kind === kind && category.parentId === null)
    .map((category) => {
      const cents = rootAmounts.get(category.id) ?? 0
      const children = categories
        .filter((child) => child.parentId === category.id)
        .map((child) => ({
          categoryId: child.id,
          name: child.name,
          path: `${category.name} / ${child.name}`,
          cents: childAmounts.get(child.id) ?? 0,
          share: share(childAmounts.get(child.id) ?? 0),
        }))
        .filter((child) => child.cents > 0)
        .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name))
      return {
        categoryId: category.id,
        name: category.name,
        cents,
        share: share(cents),
        children,
      }
    })
    .filter((group) => group.cents > 0)
    .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name))

  return { groups, uncategorizedCents, totalCents }
}

function signedAmount(entry: Entry): number {
  if (entry.type === 'income') return entry.amountCents
  if (entry.type === 'expense') return -entry.amountCents
  return 0
}

function inPeriod(entry: Entry, mode: StatsMode, period: string): boolean {
  return mode === 'month' ? inMonth(entry.occurredAt, period) : inYear(entry.occurredAt, period)
}

export function inMonth(iso: string, key: string): boolean {
  return monthKeyOf(iso) === key
}

export function inYear(iso: string, year: string): boolean {
  return new Date(iso).getFullYear() === Number(year)
}

function monthKeyOf(iso: string): string {
  return monthKey(new Date(iso))
}

function daysInMonth(key: string): number {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

function elapsedMonthsInYear(year: string, now: Date): number {
  const value = Number(year)
  if (value < now.getFullYear()) return 12
  if (value > now.getFullYear()) return 0
  return now.getMonth() + 1
}

function dayKey(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function endOfDayMs(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime()
}

function endOfMonthMs(year: number, month: number): number {
  return new Date(year, month, 0, 23, 59, 59, 999).getTime()
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
