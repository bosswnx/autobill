import type { Category, Entry, Tag } from '@autobill/shared'
import { MonthPager } from '../components/MonthPager'
import { TagChip } from '../components/TagChip'
import { useI18n } from '../i18n'
import { entryTitle } from '../lib/entryTitle'
import { formatYuan } from '../lib/money'
import { flattenCategoryTree } from '../lib/categories'
import { firstSortedTagName, sortByUsage, tagsOfKind } from '../lib/tags'
import { dayKey, formatClock, formatDayHeading } from '../lib/time'

type Stats = {
  expense: number
  income: number
  net: number
  count: number
}

type Props = {
  month: string
  onMonthChange: (month: string) => void
  stats: Stats
  entries: Entry[]
  tags: Tag[]
  categories: Category[]
  usage: Record<string, number>
  savings: number
  filterCategoryId: string | null
  onSelectCategory: (id: string | null) => void
  filterTagIds: string[]
  onToggleTag: (id: string) => void
  onClearTags: () => void
  query: string
  onQueryChange: (value: string) => void
  onOpenEntry: (id: string) => void
}

export function LedgerScreen({
  month,
  onMonthChange,
  stats,
  entries,
  tags,
  categories,
  usage,
  savings,
  filterCategoryId,
  onSelectCategory,
  filterTagIds,
  onToggleTag,
  onClearTags,
  query,
  onQueryChange,
  onOpenEntry,
}: Props) {
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]))
  const categoryMap = new Map(categories.map((category) => [category.id, category]))
  const sortedTags = sortByUsage(tags, usage)
  const categoryRows = flattenCategoryTree(categories)
  const groups = groupByDay(entries)
  const { t } = useI18n()

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <h1 className="shrink-0 whitespace-nowrap text-[40px] leading-none font-bold tracking-[-0.03em]">{t.ledger.title}</h1>
          <MonthPager month={month} onChange={onMonthChange} />
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Stat label={t.ledger.expense} value={formatYuan(stats.expense, { sign: 'never' })} tone="expense" />
          <Stat label={t.ledger.income} value={formatYuan(stats.income, { sign: 'never' })} tone="income" />
          <Stat
            label={t.ledger.net}
            value={formatYuan(stats.net, { sign: stats.net < 0 ? 'auto' : 'never' })}
            tone={stats.net < 0 ? 'expense' : 'income'}
          />
          <Stat
            label={t.ledger.savings}
            value={formatYuan(savings, { sign: savings < 0 ? 'auto' : 'never' })}
          />
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t.ledger.searchPlaceholder}
          className="w-full rounded-md border border-line bg-page px-3 py-2 text-sm placeholder:text-faint hover:bg-hover focus:border-accent"
        />
        <div className="flex flex-col gap-4">
          {categoryRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-faint">{t.categories.title}</span>
              <button
                type="button"
                onClick={() => onSelectCategory(null)}
                className={`rounded px-1.5 py-0.5 text-xs transition-colors duration-150 md:text-sm ${
                  filterCategoryId === null
                    ? 'bg-active text-ink'
                    : 'text-muted hover:bg-hover hover:text-ink'
                }`}
              >
                {t.ledger.all}
              </button>
              {categoryRows.map(({ category, depth }) => (
                <TagChip
                  key={category.id}
                  tag={depth > 0 ? { ...category, name: `· ${category.name}` } : category}
                  active={filterCategoryId === category.id}
                  onClick={() =>
                    onSelectCategory(filterCategoryId === category.id ? null : category.id)
                  }
                />
              ))}
            </div>
          )}
          {(['expense', 'income'] as const).map((kind) => {
            const group = tagsOfKind(sortedTags, kind)
            if (group.length === 0) return null
            return (
              <div key={kind} className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs text-faint">{t.tagKind[kind]}</span>
                {group.map((tag) => (
                  <TagChip
                    key={tag.id}
                    tag={tag}
                    active={filterTagIds.includes(tag.id)}
                    onClick={() => onToggleTag(tag.id)}
                  />
                ))}
              </div>
            )
          })}
          {(filterTagIds.length > 0 || filterCategoryId !== null) && (
            <button
              type="button"
              className="self-start px-1 text-xs text-muted hover:text-ink"
              onClick={() => {
                onClearTags()
                onSelectCategory(null)
              }}
            >
              {t.ledger.clearFilters}
            </button>
          )}
        </div>
      </div>

      <div key={month} className="anim-page">
      {groups.length === 0 ? (
        <EmptyState filtered={Boolean(query || filterTagIds.length || filterCategoryId)} />
      ) : (
        <div className="flex flex-col gap-7">
          {groups.map((group) => (
            <section key={group.key} className="flex flex-col">
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-xs font-medium text-faint">
                  {formatDayHeading(group.entries[0].occurredAt)}
                </h2>
                <span className="text-xs text-faint">{formatYuan(dayNet(group.entries))}</span>
              </div>
              <div className="flex flex-col gap-2">
                {group.entries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    category={entry.categoryId ? categoryMap.get(entry.categoryId) : undefined}
                    tags={sortByUsage(
                      entry.tagIds
                        .map((id) => tagMap.get(id))
                        .filter((tag): tag is Tag => Boolean(tag)),
                      usage,
                    )}
                    title={entryTitle(
                      entry.note,
                      entry.type,
                      (entry.categoryId ? categoryMap.get(entry.categoryId)?.name : undefined) ??
                        firstSortedTagName(entry.tagIds, tags, usage),
                    )}
                    activeTagIds={filterTagIds}
                    onClick={() => onOpenEntry(entry.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      </div>

    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'expense' | 'income'
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-faint">{label}</span>
      <span
        className={`font-medium tabular-nums ${
          tone === 'expense' ? 'text-expense' : tone === 'income' ? 'text-income' : ''
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function EntryRow({
  entry,
  category,
  tags,
  title,
  activeTagIds,
  onClick,
}: {
  entry: Entry
  category?: Category
  tags: Tag[]
  title: string
  activeTagIds: string[]
  onClick: () => void
}) {
  const amount =
    entry.type === 'expense'
      ? -entry.amountCents
      : entry.type === 'income'
        ? entry.amountCents
        : entry.amountCents
  const amountClass =
    entry.type === 'expense' ? 'text-expense' : entry.type === 'income' ? 'text-income' : 'text-ink'

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start justify-between gap-3 rounded-lg border border-line-strong bg-page px-3.5 py-3 text-left transition-colors duration-150 hover:bg-hover"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-base md:text-sm">{title}</span>
          <span className="shrink-0 text-xs text-faint">{formatClock(entry.occurredAt)}</span>
        </div>
        {(category || tags.length > 0) && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {category ? <TagChip tag={category} size="sm" /> : null}
            {tags.map((tag) => (
              <TagChip key={tag.id} tag={tag} active={activeTagIds.includes(tag.id)} size="sm" />
            ))}
          </div>
        )}
      </div>
      <div className={`shrink-0 text-sm font-medium tabular-nums ${amountClass}`}>
        {entry.type === 'transfer'
          ? formatYuan(entry.amountCents, { sign: 'never' })
          : entry.type === 'income'
            ? formatYuan(amount, { sign: 'always' })
            : formatYuan(amount)}
      </div>
    </button>
  )
}

function EmptyState({ filtered }: { filtered: boolean }) {
  const { t } = useI18n()
  return (
    <div className="px-2 py-16 text-center">
      <p className="text-base font-medium">{filtered ? t.ledger.emptyFilteredTitle : t.ledger.emptyTitle}</p>
      <p className="mt-1 text-sm text-muted">
        {filtered ? t.ledger.emptyFilteredHint : t.ledger.emptyHint}
      </p>
    </div>
  )
}

function groupByDay(entries: Entry[]): { key: string; entries: Entry[] }[] {
  const map = new Map<string, Entry[]>()
  for (const entry of entries) {
    const key = dayKey(entry.occurredAt)
    const list = map.get(key) ?? []
    list.push(entry)
    map.set(key, list)
  }
  return [...map.entries()].map(([key, group]) => ({ key, entries: group }))
}

function dayNet(entries: Entry[]): number {
  return entries.reduce((sum, entry) => {
    if (entry.type === 'expense') return sum - entry.amountCents
    if (entry.type === 'income') return sum + entry.amountCents
    return sum
  }, 0)
}
