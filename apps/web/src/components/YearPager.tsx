import { useState } from 'react'
import { useI18n } from '../i18n'
import { formatYearTitle, shiftYear, yearKey } from '../lib/time'
import { Overlay } from './Overlay'

type Props = {
  year: string
  onChange: (year: string) => void
}

const YEAR_PAGE = 12

function pageStart(year: number): number {
  return Math.floor(year / YEAR_PAGE) * YEAR_PAGE
}

export function YearPager({ year, onChange }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const selected = Number(year)
  const [viewStart, setViewStart] = useState(pageStart(selected))
  const current = yearKey()
  const [picked, setPicked] = useState(selected)

  function pick(next: string) {
    onChange(next)
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className="flex size-7 items-center justify-center rounded text-lg text-muted transition-colors duration-150 hover:bg-hover"
        onClick={() => onChange(shiftYear(year, -1))}
        aria-label={t.pickers.prevYear}
      >
        ‹
      </button>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setViewStart(pageStart(selected))
          setPicked(selected)
          setOpen(true)
        }}
        className="w-[6.75rem] shrink-0 rounded-md bg-hover px-2 py-1 text-center text-[15px] font-semibold tabular-nums transition-colors duration-150 hover:bg-active"
      >
        {formatYearTitle(year)}
      </button>
      <button
        type="button"
        className="flex size-7 items-center justify-center rounded text-lg text-muted transition-colors duration-150 hover:bg-hover"
        onClick={() => onChange(shiftYear(year, 1))}
        aria-label={t.pickers.nextYear}
      >
        ›
      </button>
      {open && (
        <Overlay captureBack={false} onClose={() => setOpen(false)} className="overlay-pad items-center">
          {(close) => (
            <div className="anim-panel w-full max-w-sm rounded-xl border border-line bg-page p-5">
              <h2 className="text-lg font-semibold">{t.pickers.yearTitle}</h2>
              <div className="mt-4 mb-2 flex items-center justify-between">
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded text-lg text-muted hover:bg-hover"
                  onClick={() => setViewStart((start) => start - YEAR_PAGE)}
                  aria-label={t.pickers.prevYearPage}
                >
                  ‹
                </button>
                <div className="text-sm font-semibold">
                  {viewStart}–{viewStart + YEAR_PAGE - 1}
                </div>
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded text-lg text-muted hover:bg-hover"
                  onClick={() => setViewStart((start) => start + YEAR_PAGE)}
                  aria-label={t.pickers.nextYearPage}
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {Array.from({ length: YEAR_PAGE }, (_, index) => viewStart + index).map((item) => {
                  const active = item === picked
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPicked(item)}
                      className={`rounded py-1.5 text-sm transition-colors duration-150 ${
                        active ? 'bg-accent text-accent-ink' : 'text-ink hover:bg-hover'
                      }`}
                    >
                      {item}
                    </button>
                  )
                })}
              </div>
              <div className="mt-5 flex items-center justify-between">
                <button
                  type="button"
                  disabled={String(picked) === current}
                  aria-pressed={String(picked) === current}
                  onClick={() => setPicked(Number(current))}
                  className={
                    String(picked) === current
                      ? 'rounded-md px-3 py-1.5 text-sm text-faint disabled:opacity-100'
                      : 'rounded-md bg-field px-3 py-1.5 text-sm text-ink transition-colors duration-150 hover:bg-field-hover'
                  }
                >
                  {t.pickers.thisYear}
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
                      pick(String(picked))
                      close()
                    }}
                  >
                    {t.common.confirm}
                  </button>
                </div>
              </div>
            </div>
          )}
        </Overlay>
      )}
    </div>
  )
}
