import { useState } from 'react'
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
  const [open, setOpen] = useState(false)
  const selected = Number(year)
  const [viewStart, setViewStart] = useState(pageStart(selected))
  const current = yearKey()
  const isCurrent = year === current

  function pick(next: string) {
    onChange(next)
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className="flex size-7 items-center justify-center rounded text-lg text-muted transition-colors duration-150 hover:bg-hover"
        onClick={() => onChange(shiftYear(year, -1))}
        aria-label="上一年"
      >
        ‹
      </button>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setViewStart(pageStart(selected))
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
        aria-label="下一年"
      >
        ›
      </button>
      {open && (
        <Overlay captureBack={false} onClose={() => setOpen(false)} className="overlay-pad items-center">
          {(close) => (
            <div className="anim-panel w-full max-w-sm rounded-xl border border-line bg-page p-5">
              <h2 className="text-lg font-semibold">选择年份</h2>
              <div className="mt-4 mb-2 flex items-center justify-between">
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded text-lg text-muted hover:bg-hover"
                  onClick={() => setViewStart((start) => start - YEAR_PAGE)}
                  aria-label="上一页年份"
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
                  aria-label="下一页年份"
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {Array.from({ length: YEAR_PAGE }, (_, index) => viewStart + index).map((item) => {
                  const active = item === selected
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        pick(String(item))
                        close()
                      }}
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
                  disabled={isCurrent}
                  onClick={() => {
                    pick(current)
                    close()
                  }}
                  className={`rounded px-3 py-1.5 text-sm ${
                    isCurrent ? 'text-faint' : 'text-ink hover:bg-hover'
                  }`}
                >
                  本年
                </button>
                <button
                  type="button"
                  className="rounded px-3 py-1.5 text-sm text-muted hover:bg-hover"
                  onClick={close}
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </Overlay>
      )}
    </div>
  )
}
