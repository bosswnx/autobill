import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { tapHaptic } from '../lib/haptic'
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
  className,
}: {
  type: 'date' | 'time'
  value: string
  display: string
  ariaLabel: string
  onChange: (value: string) => void
  className?: string
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
        className={`inline-flex min-w-0 items-center rounded-md bg-[#f4f3f0] px-3 text-sm text-muted transition-colors duration-150 hover:bg-[#ebeae6] hover:text-ink ${className ?? ''}`}
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
      <div className="mt-4 flex items-center justify-center gap-14">
        <div className="relative">
          <WheelColumn length={24} value={hour} onChange={setHour} ariaLabel={t.pickers.hour} />
          <span className="pointer-events-none absolute top-1/2 left-full ml-1.5 -translate-y-1/2 text-sm text-muted">
            {t.pickers.hour}
          </span>
        </div>
        <div className="relative">
          <WheelColumn length={60} value={minute} onChange={setMinute} ariaLabel={t.pickers.minute} />
          <span className="pointer-events-none absolute top-1/2 left-full ml-1.5 -translate-y-1/2 text-sm text-muted">
            {t.pickers.minute}
          </span>
        </div>
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

const WHEEL_ITEM = 40
const WHEEL_VISIBLE = 5
const WHEEL_COPIES = 5

function WheelColumn({
  length,
  value,
  onChange,
  ariaLabel,
}: {
  length: number
  value: number
  onChange: (value: number) => void
  ariaLabel: string
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const fromScroll = useRef(false)
  const lastValue = useRef(value)
  const dragged = useRef(false)

  function valueOf(scrollTop: number): number {
    const index = Math.round(scrollTop / WHEEL_ITEM)
    return wrap(index, length)
  }

  function scrollToValue(next: number, behavior: ScrollBehavior) {
    const el = scroller.current
    if (!el) return
    const index = Math.round(el.scrollTop / WHEEL_ITEM)
    const copy = Math.min(WHEEL_COPIES - 2, Math.max(1, Math.floor(index / length) || Math.floor(WHEEL_COPIES / 2)))
    el.scrollTo({ top: (copy * length + wrap(next, length)) * WHEEL_ITEM, behavior })
  }

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    el.scrollTop = (Math.floor(WHEEL_COPIES / 2) * length + wrap(value, length)) * WHEEL_ITEM
    lastValue.current = value
  }, [length])

  useEffect(() => {
    if (fromScroll.current) {
      fromScroll.current = false
      return
    }
    if (lastValue.current === value) return
    lastValue.current = value
    scrollToValue(value, 'smooth')
  }, [value, length])

  useEffect(() => {
    const wheel = scroller.current
    if (!wheel) return
    let settle = 0

    function recenter() {
      const target = scroller.current
      if (!target) return
      const index = Math.round(target.scrollTop / WHEEL_ITEM)
      const copy = Math.floor(index / length)
      if (copy !== 0 && copy !== WHEEL_COPIES - 1) return
      const mid = Math.floor(WHEEL_COPIES / 2)
      target.scrollTop = (mid * length + wrap(index, length)) * WHEEL_ITEM
    }

    function onScroll() {
      const target = scroller.current
      if (!target) return
      const next = valueOf(target.scrollTop)
      if (next !== lastValue.current) {
        lastValue.current = next
        fromScroll.current = true
        onChange(next)
        tapHaptic()
      }
      window.clearTimeout(settle)
      settle = window.setTimeout(recenter, 80)
    }

    wheel.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      wheel.removeEventListener('scroll', onScroll)
      window.clearTimeout(settle)
    }
  }, [length, onChange])

  useEffect(() => {
    const wheel = scroller.current
    if (!wheel) return

    let dragging = false
    let lastY = 0
    const threshold = 4

    function onPointerDown(event: PointerEvent) {
      const target = scroller.current
      if (!target || event.pointerType === 'touch' || event.button !== 0) return
      dragging = true
      dragged.current = false
      lastY = event.clientY
      try {
        target.setPointerCapture(event.pointerId)
      } catch {
        /* synthetic pointer or already released */
      }
    }

    function onPointerMove(event: PointerEvent) {
      const target = scroller.current
      if (!target || !dragging) return
      const dy = event.clientY - lastY
      if (!dragged.current) {
        if (Math.abs(dy) < threshold) return
        dragged.current = true
        target.classList.add('is-dragging')
      }
      lastY = event.clientY
      target.scrollTop -= dy
      event.preventDefault()
    }

    function onPointerUp() {
      const target = scroller.current
      if (!target || !dragging) return
      dragging = false
      target.classList.remove('is-dragging')
    }

    function onSelectStart(event: Event) {
      event.preventDefault()
    }

    wheel.addEventListener('pointerdown', onPointerDown)
    wheel.addEventListener('pointermove', onPointerMove)
    wheel.addEventListener('pointerup', onPointerUp)
    wheel.addEventListener('pointercancel', onPointerUp)
    wheel.addEventListener('selectstart', onSelectStart)
    return () => {
      wheel.removeEventListener('pointerdown', onPointerDown)
      wheel.removeEventListener('pointermove', onPointerMove)
      wheel.removeEventListener('pointerup', onPointerUp)
      wheel.removeEventListener('pointercancel', onPointerUp)
      wheel.removeEventListener('selectstart', onSelectStart)
      wheel.classList.remove('is-dragging')
    }
  }, [])

  const items = Array.from({ length: WHEEL_COPIES * length }, (_, index) => wrap(index, length))

  return (
    <div
      className="relative w-14 overflow-hidden"
      style={{ height: WHEEL_ITEM * WHEEL_VISIBLE }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-10 -translate-y-1/2 rounded-lg bg-[rgb(55_53_47/8%)]" />
      <div
        ref={scroller}
        data-overlay-scroll
        tabIndex={0}
        role="listbox"
        aria-label={ariaLabel}
        aria-valuenow={value}
        className="picker-wheel h-full overflow-y-auto overscroll-contain outline-none"
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            onChange(wrap(value - 1, length))
          } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            onChange(wrap(value + 1, length))
          }
        }}
      >
        {items.map((item, index) => (
          <div
            key={index}
            role="option"
            aria-selected={item === value}
            className="picker-wheel-item flex w-full items-center justify-center text-xl font-medium tabular-nums text-ink"
            onClick={() => {
              if (dragged.current) return
              onChange(item)
            }}
          >
            {pad2(item)}
          </div>
        ))}
      </div>
    </div>
  )
}
