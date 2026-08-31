import type { Book, Tag } from '@tagledger/shared'
import { useMemo, useState, type ReactNode } from 'react'
import { BarChart, LineChart, TagAmountList } from '../components/Charts'
import { MonthPager } from '../components/MonthPager'
import { YearPager } from '../components/YearPager'
import { useBookEntries } from '../hooks/useLedger'
import { useI18n } from '../i18n'
import { formatYuan } from '../lib/money'
import { buildPeriodStats, type StatsMode } from '../lib/stats'
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
  const entries = useBookEntries(book.id)
  const period = mode === 'month' ? month : year
  const stats = useMemo(
    () => buildPeriodStats(mode, period, entries, tags, book.openingBalanceCents ?? 0),
    [mode, period, entries, tags, book.openingBalanceCents],
  )

  const monthly = mode === 'month'
  const avgExpenseLabel = monthly ? t.stats.avgExpenseDay : t.stats.avgExpenseMonth
  const avgIncomeLabel = monthly ? t.stats.avgIncomeDay : t.stats.avgIncomeMonth

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

      <ChartBlock title={monthly ? t.stats.expense : t.stats.monthlyExpense}>
        <BarChart points={stats.expenseSeries} color="#e03e3e" />
      </ChartBlock>
      <ChartBlock title={monthly ? t.stats.income : t.stats.monthlyIncome}>
        <BarChart points={stats.incomeSeries} color="#0f7b6c" />
      </ChartBlock>
      <ChartBlock title={t.stats.assetChart}>
        <LineChart points={stats.assetSeries} color="#787774" />
      </ChartBlock>
      <ChartBlock title={t.stats.expenseTags}>
        <TagAmountList items={stats.expenseTags} empty={t.stats.emptyExpenseTags} />
      </ChartBlock>
      <ChartBlock title={t.stats.incomeTags}>
        <TagAmountList items={stats.incomeTags} empty={t.stats.emptyIncomeTags} />
      </ChartBlock>
    </div>
  )
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
    tone === 'expense' ? 'text-expense' : tone === 'income' ? 'text-income' : 'text-black'
  return (
    <div className={className}>
      <div className="whitespace-nowrap text-xs text-faint">{label}</div>
      <div className={`mt-1 text-[15px] font-medium tabular-nums tracking-tight ${valueClass}`}>
        {value}
      </div>
    </div>
  )
}
