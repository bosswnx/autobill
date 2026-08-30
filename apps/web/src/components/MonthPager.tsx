import { useMemo, useState } from 'react'
import { formatMonthTitle, monthKey, shiftMonth } from '../lib/time'
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
  const [open, setOpen] = useState(false)
  const native = useMemo(supportsNativeMonthInput, [])
  const currentMonth = monthKey()
  const isCurrent = month === currentMonth

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className="flex size-7 items-center justify-center rounded text-lg text-muted transition-colors duration-150 hover:bg-hover"
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label="上个月"
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
        aria-label="下个月"
      >
        ›
      </button>
      {open && (
        <Overlay captureBack={false} onClose={() => setOpen(false)} className="overlay-pad items-center">
          {(close) => (
            <MonthPickerPanel
              month={month}
              native={native}
              isCurrent={isCurrent}
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
  isCurrent,
  currentMonth,
  onChange,
  close,
}: {
  month: string
  native: boolean
  isCurrent: boolean
  currentMonth: string
  onChange: (month: string) => void
  close: () => void
}) {
  function pick(next: string) {
    onChange(next)
    close()
  }

  return (
    <div className="anim-panel w-full max-w-sm rounded-xl border border-line bg-page p-5">
      <h2 className="text-lg font-semibold">选择月份</h2>
      {native ? (
        <NativeMonthField value={month} onPick={pick} />
      ) : (
        <FallbackMonthGrid month={month} onPick={pick} />
      )}
      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          disabled={isCurrent}
          onClick={() => pick(currentMonth)}
          className={`rounded px-3 py-1.5 text-sm ${
            isCurrent ? 'text-faint' : 'text-ink hover:bg-hover'
          }`}
        >
          本月
        </button>
        <button type="button" className="rounded px-3 py-1.5 text-sm text-muted hover:bg-hover" onClick={close}>
          取消
        </button>
      </div>
    </div>
  )
}

function NativeMonthField({ value, onPick }: { value: string; onPick: (month: string) => void }) {
  return (
    <input
      type="month"
      value={value}
      onChange={(event) => {
        if (!event.target.value) return
        onPick(event.target.value)
      }}
      className={`mt-4 ${fieldClass}`}
      aria-label="月份"
    />
  )
}

function FallbackMonthGrid({ month, onPick }: { month: string; onPick: (month: string) => void }) {
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
          aria-label={pickingYear ? '上一页年份' : '上一年'}
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
            {viewYear}年
          </button>
        )}
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded text-lg text-muted hover:bg-hover"
          onClick={() =>
            pickingYear ? setViewYear((year) => year + YEAR_PAGE) : setViewYear((year) => year + 1)
          }
          aria-label={pickingYear ? '下一页年份' : '下一年'}
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
                {item}月
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
