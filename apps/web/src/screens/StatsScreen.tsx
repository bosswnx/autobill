import type { Book, Tag } from '@tagbill/shared'
import { useMemo, useState, type ReactNode } from 'react'
import { BarChart, LineChart, TagAmountList } from '../components/Charts'
import { MonthPager } from '../components/MonthPager'
import { TagChip } from '../components/TagChip'
import { YearPager } from '../components/YearPager'
import { useBookEntries } from '../hooks/useLedger'
import { useI18n } from '../i18n'
import { formatYuan } from '../lib/money'
import { buildPeriodStats, sanitizeTagFocus, type StatsMode, type TagSlice } from '../lib/stats'
import { monthKey, yearKey } from '../lib/time'

type Props = {
  book: Book
  tags: Tag[]
  savings: number
}

export function StatsScreen({ book, tags, savings }: Props) {
  const { t } = useI18n()
  const [mode, setMode] = useState<StatsMode>('month')
  const [month, setMonth] = useState(monthKey())
  const [year, setYear] = useState(yearKey())
  const [expenseFocus, setExpenseFocus] = useState<string[]>([])
  const [incomeFocus, setIncomeFocus] = useState<string[]>([])
  const entries = useBookEntries(book.id)
  const period = mode === 'month' ? month : year
  const expenseTagIds = useMemo(() => sanitizeTagFocus(expenseFocus, tags), [expenseFocus, tags])
  const incomeTagIds = useMemo(() => sanitizeTagFocus(incomeFocus, tags), [incomeFocus, tags])
  const stats = useMemo(
    () =>
      buildPeriodStats(mode, period, entries, tags, book.openingBalanceCents ?? 0, {
        expenseTagIds,
        incomeTagIds,
      }),
    [mode, period, entries, tags, book.openingBalanceCents, expenseTagIds, incomeTagIds],
  )

  const monthly = mode === 'month'
  const avgExpenseLabel = monthly ? t.stats.avgExpenseDay : t.stats.avgExpenseMonth
  const avgIncomeLabel = monthly ? t.stats.avgIncomeDay : t.stats.avgIncomeMonth
  const expenseChartTitle = `${monthly ? t.stats.expense : t.stats.monthlyExpense}${focusSuffix(expenseTagIds, tags)}`
  const incomeChartTitle = `${monthly ? t.stats.income : t.stats.monthlyIncome}${focusSuffix(incomeTagIds, tags)}`

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h1 className="shrink-0 whitespace-nowrap text-[40px] leading-none font-bold tracking-[-0.03em]">
            {t.stats.title}
          </h1>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <ModeSwitch
              mode={mode}
              onChange={(next) => {
                setMode(next)
                if (next === 'year') setYear(month.slice(0, 4))
                else setMonth((current) => `${year}-${current.slice(5, 7)}`)
              }}
            />
            <div className="w-[10.75rem] shrink-0">
              {mode === 'month' ? (
                <MonthPager month={month} onChange={setMonth} />
              ) : (
                <YearPager year={year} onChange={setYear} />
              )}
            </div>
          </div>
        </div>
        <div className="stats-metrics grid w-full grid-cols-2 gap-x-10 gap-y-5 min-[520px]:grid-cols-4">
          <Stat label={t.stats.totalExpense} value={formatYuan(stats.expense, { sign: 'never' })} tone="expense" />
          <Stat label={t.stats.totalIncome} value={formatYuan(stats.income, { sign: 'never' })} tone="income" />
          <Stat
            className="min-[520px]:col-start-1 min-[520px]:row-start-2"
            label={avgExpenseLabel}
            value={formatYuan(stats.avgExpense, { sign: 'never' })}
            tone="expense"
          />
          <Stat
            className="min-[520px]:col-start-2 min-[520px]:row-start-2"
            label={avgIncomeLabel}
            value={formatYuan(stats.avgIncome, { sign: 'never' })}
            tone="income"
          />
          <Stat
            className="min-[520px]:col-start-3 min-[520px]:row-start-1"
            label={t.stats.net}
            value={formatYuan(stats.net, { sign: stats.net < 0 ? 'auto' : 'never' })}
            tone={stats.net < 0 ? 'expense' : 'income'}
          />
          <Stat
            className="min-[520px]:col-start-4 min-[520px]:row-start-1"
            label={t.stats.assets}
            value={formatYuan(savings, { sign: savings < 0 ? 'auto' : 'never' })}
            tone="ink"
          />
        </div>
      </header>

      <ChartBlock title={expenseChartTitle}>
        <BarChart points={stats.expenseSeries} color="var(--color-chart-expense)" />
      </ChartBlock>
      <ChartBlock title={incomeChartTitle}>
        <BarChart points={stats.incomeSeries} color="var(--color-chart-income)" />
      </ChartBlock>
      <ChartBlock title={t.stats.assetChart}>
        <LineChart points={stats.assetSeries} color="var(--color-chart-asset)" />
      </ChartBlock>
      <TagSliceBlock
        title={t.stats.expenseTags}
        tags={tags}
        focusIds={expenseTagIds}
        onFocus={setExpenseFocus}
        slice={stats.expenseTagSlice}
        empty={t.stats.emptyExpenseTags}
      />
      <TagSliceBlock
        title={t.stats.incomeTags}
        tags={tags}
        focusIds={incomeTagIds}
        onFocus={setIncomeFocus}
        slice={stats.incomeTagSlice}
        empty={t.stats.emptyIncomeTags}
      />
    </div>
  )
}

function TagSliceBlock({
  title,
  tags,
  focusIds,
  onFocus,
  slice,
  empty,
}: {
  title: string
  tags: Tag[]
  focusIds: string[]
  onFocus: (ids: string[]) => void
  slice: TagSlice
  empty: string
}) {
  const { t } = useI18n()
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]))
  const focused = focusIds.map((id) => tagMap.get(id)).filter((tag): tag is Tag => Boolean(tag))

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <h2 className="text-sm font-medium">{title}</h2>
        {slice.focused ? null : <span className="text-xs text-faint">{t.stats.drillHint}</span>}
        {focused.map((tag, index) => (
          <TagChip
            key={tag.id}
            tag={tag}
            size="sm"
            active
            onClick={() => {
              const next =
                index === focused.length - 1 ? focusIds.slice(0, index) : focusIds.slice(0, index + 1)
              onFocus(next)
            }}
          />
        ))}
        {slice.focused ? (
          <>
            <span className="text-xs tabular-nums text-muted">
              {formatYuan(slice.total, { sign: 'never' })}
            </span>
            <button
              type="button"
              className="px-1 text-xs text-muted hover:text-ink"
              onClick={() => onFocus([])}
            >
              {t.stats.clearFocus}
            </button>
          </>
        ) : null}
      </div>
      <TagAmountList
        items={slice.items}
        empty={empty}
        onSelectTag={(id) => onFocus(focusIds.includes(id) ? focusIds : [...focusIds, id])}
        selectLabel={t.stats.drillTag}
        shareTotal={slice.focused ? slice.total : undefined}
        remainderCents={slice.remainderCents}
        remainderLabel={focusIds.length > 1 ? t.stats.tagOnlyMany : t.stats.tagOnly}
      />
    </section>
  )
}

function focusSuffix(ids: string[], tags: Tag[]): string {
  if (ids.length === 0) return ''
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]))
  const names = ids.map((id) => tagMap.get(id)?.name).filter((name): name is string => Boolean(name))
  return names.length ? ` · ${names.join(' · ')}` : ''
}

function ModeSwitch({ mode, onChange }: { mode: StatsMode; onChange: (mode: StatsMode) => void }) {
  const { t } = useI18n()
  return (
    <div className="w-[4.25rem] shrink-0 overflow-hidden rounded-md bg-hover p-[3px]">
      <div className="relative grid grid-cols-2">
        <span
          className="pointer-events-none absolute inset-y-0 left-0 w-1/2 rounded bg-page transition-[left] duration-200 ease-out"
          style={{ left: mode === 'year' ? '50%' : '0%' }}
        />
        {(['month', 'year'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={`relative z-10 w-full py-1 text-center text-sm transition-colors duration-200 ${
              mode === item ? 'text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {item === 'month' ? t.stats.modeMonth : t.stats.modeYear}
          </button>
        ))}
      </div>
    </div>
  )
}

function ChartBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      {children}
    </section>
  )
}

function Stat({
  label,
  value,
  tone,
  className,
}: {
  label: string
  value: string
  tone: 'expense' | 'income' | 'ink'
  className?: string
}) {
  const valueClass =
    tone === 'expense' ? 'text-expense' : tone === 'income' ? 'text-income' : 'text-ink'
  return (
    <div className={className}>
      <div className="whitespace-nowrap text-xs text-faint">{label}</div>
      <div className={`mt-1 text-[15px] font-medium tabular-nums tracking-tight ${valueClass}`}>
        {value}
      </div>
    </div>
  )
}
