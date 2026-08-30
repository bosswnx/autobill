import { useState } from 'react'
import { useI18n } from '../i18n'
import { daysInMonth, formatMonthYear, nowIso, toDateInput, toTimeInput } from '../lib/time'
import { Overlay } from './Overlay'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function wrap(n: number, max: number): number {
  return ((n % max) + max) % max
}

export function CompactPicker({
  type,
  value,
  display,
  ariaLabel,
  onChange,
}: {
  type: 'date' | 'time'
  value: string
  display: string
  ariaLabel: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="inline-flex min-w-0 items-center rounded-md bg-[#f4f3f0] px-2 py-1 text-xs text-muted transition-colors duration-150 hover:bg-[#ebeae6] hover:text-ink"
      >
        <span className="truncate tabular-nums">{display}</span>
      </button>
      {open && (
        <Overlay onClose={() => setOpen(false)} className="overlay-pad items-center">
          {(close) =>
            type === 'date' ? (
              <DatePickerPanel value={value} onPick={onChange} close={close} />
            ) : (
              <TimePickerPanel value={value} onPick={onChange} close={close} />
            )
          }
        </Overlay>
      )}
    </>
  )
}

function DatePickerPanel({
  value,
  onPick,
  close,
}: {
  value: string
  onPick: (value: string) => void
  close: () => void
}) {
  const { t } = useI18n()
  const [year, month] = value.split('-').map(Number)
  const [viewYear, setViewYear] = useState(year)
  const [viewMonth, setViewMonth] = useState(month)
  const today = toDateInput(nowIso())
  const viewKey = `${viewYear}-${pad2(viewMonth)}`
  const days = daysInMonth(viewKey)
  const firstWeekday = new Date(viewYear, viewMonth - 1, 1).getDay()

  function shift(delta: number) {
    const next = new Date(viewYear, viewMonth - 1 + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth() + 1)
  }

  function pick(day: number) {
    onPick(`${viewYear}-${pad2(viewMonth)}-${pad2(day)}`)
    close()
  }

  return (
    <div className="anim-panel w-full max-w-sm rounded-xl border border-line bg-page p-5">
      <h2 className="text-lg font-semibold">{t.pickers.dateTitle}</h2>
      <div className="mt-4 mb-2 flex items-center justify-between">
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded text-lg text-muted hover:bg-hover"
          onClick={() => shift(-1)}
          aria-label={t.pickers.prevMonth}
        >
          ‹
        </button>
        <div className="text-sm font-semibold tabular-nums">
          {formatMonthYear(viewYear, viewMonth)}
        </div>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded text-lg text-muted hover:bg-hover"
          onClick={() => shift(1)}
          aria-label={t.pickers.nextMonth}
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {t.pickers.weekdays.map((day) => (
          <div key={day} className="py-1 text-[11px] text-faint">
            {day}
          </div>
        ))}
        {Array.from({ length: firstWeekday }, (_, index) => (
          <div key={`blank-${index}`} />
        ))}
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1
          const key = `${viewYear}-${pad2(viewMonth)}-${pad2(day)}`
          const active = key === value
          const isToday = key === today
          return (
            <button
              key={key}
              type="button"
              onClick={() => pick(day)}
              className={`rounded py-1.5 text-sm tabular-nums transition-colors duration-150 ${
                active
                  ? 'bg-accent text-accent-ink'
                  : isToday
                    ? 'text-accent hover:bg-hover'
                    : 'text-ink hover:bg-hover'
              }`}
            >
              {day}
            </button>
          )
        })}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          disabled={value === today}
          onClick={() => {
            onPick(today)
            close()
          }}
          className={`rounded px-3 py-1.5 text-sm ${
            value === today ? 'text-faint' : 'text-ink hover:bg-hover'
          }`}
        >
          {t.common.today}
        </button>
        <button type="button" className="rounded px-3 py-1.5 text-sm text-muted hover:bg-hover" onClick={close}>
          {t.common.cancel}
        </button>
      </div>
    </div>
  )
}

function TimePickerPanel({
  value,
  onPick,
  close,
}: {
  value: string
  onPick: (value: string) => void
  close: () => void
}) {
  const { t } = useI18n()
  const [hourPart, minutePart] = value.split(':').map(Number)
  const [hour, setHour] = useState(Number.isFinite(hourPart) ? hourPart : 0)
  const [minute, setMinute] = useState(Number.isFinite(minutePart) ? minutePart : 0)

  const picked = `${pad2(hour)}:${pad2(minute)}`
  const now = toTimeInput(nowIso())

  return (
    <div className="anim-panel w-full max-w-sm rounded-xl border border-line bg-page p-5">
      <h2 className="text-lg font-semibold">{t.pickers.timeTitle}</h2>
      <div className="mt-6 flex flex-col gap-3">
        <Stepper label={t.pickers.hour} value={hour} onShift={(delta) => setHour(wrap(hour + delta, 24))} />
        <Stepper label={t.pickers.minute} value={minute} onShift={(delta) => setMinute(wrap(minute + delta, 60))} />
      </div>
      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          disabled={picked === now}
          onClick={() => {
            onPick(now)
            close()
          }}
          className={`rounded px-3 py-1.5 text-sm ${
            picked === now ? 'text-faint' : 'text-ink hover:bg-hover'
          }`}
        >
          {t.common.now}
        </button>
        <div className="flex gap-1">
          <button type="button" className="rounded px-3 py-1.5 text-sm text-muted hover:bg-hover" onClick={close}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="rounded-md bg-accent px-4 py-1.5 text-sm text-accent-ink hover:brightness-95"
            onClick={() => {
              onPick(picked)
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

function Stepper({
  label,
  value,
  onShift,
}: {
  label: string
  value: number
  onShift: (delta: number) => void
}) {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-center gap-3">
      <span className="w-10 text-xs text-faint">{label}</span>
      <button
        type="button"
        className="flex size-8 items-center justify-center rounded text-lg text-muted hover:bg-hover"
        onClick={() => onShift(-1)}
        aria-label={t.pickers.stepperDec(label)}
      >
        ‹
      </button>
      <div className="w-12 text-center text-2xl font-semibold tabular-nums">{pad2(value)}</div>
      <button
        type="button"
        className="flex size-8 items-center justify-center rounded text-lg text-muted hover:bg-hover"
        onClick={() => onShift(1)}
        aria-label={t.pickers.stepperInc(label)}
      >
        ›
      </button>
    </div>
  )
}
