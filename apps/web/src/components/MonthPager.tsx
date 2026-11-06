import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { formatMonthShort, formatMonthTitle, formatYearTitle, monthKey, shiftMonth } from '../lib/time'
import { Overlay } from './Overlay'

type Props = {
  month: string
  onChange: (month: string) => void
}

const YEAR_PAGE = 12
const fieldClass =
  'w-full min-w-0 rounded-md border border-line bg-page px-3 py-2 text-sm hover:bg-hover focus:border-accent'

function yearPageStart(year: number): number {
  return Math.floor(year / YEAR_PAGE) * YEAR_PAGE
}

function supportsNativeMonthInput(): boolean {
  const input = document.createElement('input')
  input.type = 'month'
  return input.type === 'month'
}

export function MonthPager({ month, onChange }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const native = useMemo(supportsNativeMonthInput, [])
  const currentMonth = monthKey()

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className="flex size-7 items-center justify-center rounded text-lg text-muted transition-colors duration-150 hover:bg-hover"
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label={t.pickers.prevMonth}
      >
        ‹
      </button>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="w-[6.75rem] shrink-0 rounded-md bg-hover px-2 py-1 text-center text-[15px] font-semibold tabular-nums transition-colors duration-150 hover:bg-active"
      >
        {formatMonthTitle(month)}
      </button>
      <button
        type="button"
        className="flex size-7 items-center justify-center rounded text-lg text-muted transition-colors duration-150 hover:bg-hover"
        onClick={() => onChange(shiftMonth(month, 1))}
        aria-label={t.pickers.nextMonth}
      >
        ›
      </button>
      {open && (
        <Overlay captureBack={false} onClose={() => setOpen(false)} className="overlay-pad items-center">
          {(close) => (
            <MonthPickerPanel
              month={month}
              native={native}
              currentMonth={currentMonth}
              onChange={onChange}
              close={close}
            />
          )}
        </Overlay>
      )}
    </div>
  )
}

function MonthPickerPanel({
  month,
  native,
  currentMonth,
  onChange,
  close,
}: {
  month: string
  native: boolean
  currentMonth: string
  onChange: (month: string) => void
  close: () => void
}) {
  const { t } = useI18n()
  const [picked, setPicked] = useState(month)
  const isCurrent = picked === currentMonth

  return (
    <div className="anim-panel w-full max-w-sm rounded-xl border border-line bg-page p-5">
      <h2 className="text-lg font-semibold">{t.pickers.monthTitle}</h2>
      {native ? (
        <NativeMonthField value={picked} onPick={setPicked} />
      ) : (
        <FallbackMonthGrid month={picked} onPick={setPicked} />
      )}
      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          disabled={isCurrent}
          aria-pressed={isCurrent}
          onClick={() => setPicked(currentMonth)}
          className={
            isCurrent
              ? 'rounded-md px-3 py-1.5 text-sm text-faint disabled:opacity-100'
              : 'rounded-md bg-field px-3 py-1.5 text-sm text-ink transition-colors duration-150 hover:bg-field-hover'
          }
        >
          {t.pickers.thisMonth}
        </button>
        <div className="flex gap-1">
          <button
            type="button"
            className="rounded-md bg-field px-3 py-1.5 text-sm text-ink transition-colors duration-150 hover:bg-field-hover"
            onClick={close}
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="rounded-md bg-accent px-4 py-1.5 text-sm text-accent-ink hover:brightness-95"
            onClick={() => {
              onChange(picked)
              close()
            }}
          >
            {t.common.confirm}
          </button>
        </div>
      </div>
    </div>
  )
}

function NativeMonthField({ value, onPick }: { value: string; onPick: (month: string) => void }) {
  const { t } = useI18n()
  return (
    <input
      type="month"
      value={value}
      onChange={(event) => {
        if (!event.target.value) return
        onPick(event.target.value)
      }}
      className={`mt-4 ${fieldClass}`}
      aria-label={t.pickers.monthAria}
    />
  )
}

function FallbackMonthGrid({ month, onPick }: { month: string; onPick: (month: string) => void }) {
  const { t } = useI18n()
  const selectedYear = Number(month.slice(0, 4))
  const selectedMonth = Number(month.slice(5, 7))
  const [pickingYear, setPickingYear] = useState(false)
  const [viewYear, setViewYear] = useState(selectedYear)
  const pageStart = yearPageStart(viewYear)

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded text-lg text-muted hover:bg-hover"
          onClick={() =>
            pickingYear ? setViewYear((year) => year - YEAR_PAGE) : setViewYear((year) => year - 1)
          }
          aria-label={pickingYear ? t.pickers.prevYearPage : t.pickers.prevYear}
        >
          ‹
        </button>
        {pickingYear ? (
          <div className="text-sm font-semibold">
            {pageStart}–{pageStart + YEAR_PAGE - 1}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPickingYear(true)}
            className="rounded px-1.5 py-0.5 text-sm font-semibold transition-colors duration-150 hover:bg-hover"
          >
            {formatYearTitle(String(viewYear))}
          </button>
        )}
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded text-lg text-muted hover:bg-hover"
          onClick={() =>
            pickingYear ? setViewYear((year) => year + YEAR_PAGE) : setViewYear((year) => year + 1)
          }
          aria-label={pickingYear ? t.pickers.nextYearPage : t.pickers.nextYear}
        >
          ›
        </button>
      </div>
      {pickingYear ? (
        <div className="grid grid-cols-4 gap-1">
          {Array.from({ length: YEAR_PAGE }, (_, index) => pageStart + index).map((year) => {
            const active = year === selectedYear
            return (
              <button
                key={year}
                type="button"
                onClick={() => {
                  setViewYear(year)
                  setPickingYear(false)
                }}
                className={`rounded py-1.5 text-sm transition-colors duration-150 ${
                  active ? 'bg-accent text-accent-ink' : 'text-ink hover:bg-hover'
                }`}
              >
                {year}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1">
          {Array.from({ length: 12 }, (_, index) => index + 1).map((item) => {
            const active = viewYear === selectedYear && item === selectedMonth
            return (
              <button
                key={item}
                type="button"
                onClick={() => onPick(`${viewYear}-${String(item).padStart(2, '0')}`)}
                className={`rounded py-1.5 text-sm transition-colors duration-150 ${
                  active ? 'bg-accent text-accent-ink' : 'text-ink hover:bg-hover'
                }`}
              >
                {formatMonthShort(item)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
