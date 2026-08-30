import type { Entry, Tag } from '@tagledger/shared'
import { MonthPager } from '../components/MonthPager'
import { TagChip } from '../components/TagChip'
import { useI18n } from '../i18n'
import { entryTitle } from '../lib/entryTitle'
import { formatYuan } from '../lib/money'
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
  usage: Record<string, number>
  savings: number
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
  usage,
  savings,
  filterTagIds,
  onToggleTag,
  onClearTags,
  query,
  onQueryChange,
  onOpenEntry,
}: Props) {
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]))
  const sortedTags = sortByUsage(tags, usage)
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
          <Stat label={t.ledger.savings} value={formatYuan(savings, { sign: 'never' })} />
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t.ledger.searchPlaceholder}
          className="w-full rounded-md border border-line bg-page px-3 py-2 text-sm placeholder:text-faint hover:bg-hover focus:border-accent"
        />
        <div className="flex flex-col gap-2">
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
          {filterTagIds.length > 0 && (
            <button type="button" className="self-start px-1 text-xs text-muted hover:text-ink" onClick={onClearTags}>
              {t.ledger.clearFilters}
            </button>
          )}
        </div>
      </div>

      <div key={month} className="anim-page">
      {groups.length === 0 ? (
        <EmptyState filtered={Boolean(query || filterTagIds.length)} />
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
                    tags={sortByUsage(
                      entry.tagIds
                        .map((id) => tagMap.get(id))
                        .filter((tag): tag is Tag => Boolean(tag)),
                      usage,
                    )}
                    title={entryTitle(
                      entry.note,
                      entry.type,
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
  tags,
  title,
  activeTagIds,
  onClick,
}: {
  entry: Entry
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
      className="flex w-full items-start justify-between gap-3 rounded-lg border border-[rgb(55_53_47/18%)] bg-page px-3.5 py-3 text-left transition-colors duration-150 hover:bg-hover"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm">{title}</span>
          <span className="shrink-0 text-xs text-faint">{formatClock(entry.occurredAt)}</span>
        </div>
        {tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <TagChip key={tag.id} tag={tag} active={activeTagIds.includes(tag.id)} />
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
