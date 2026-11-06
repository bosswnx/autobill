import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { registerOverlayBack } from '../lib/overlayBack'

const GAP = 4
const EDGE = 8

export function ChoicePicker<T extends string>({
  value,
  options,
  title,
  ariaLabel,
  onChange,
}: {
  value: T
  options: { id: T; label: string }[]
  title: string
  ariaLabel: string
  onChange: (value: T) => void
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, minWidth: 0 })
  const current = options.find((option) => option.id === value)?.label ?? ''

  function close() {
    setOpen(false)
  }

  function place() {
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return
    const rect = trigger.getBoundingClientRect()
    const mw = menu.offsetWidth
    const mh = menu.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    let top = rect.bottom + GAP
    let left = rect.left
    if (top + mh > vh - EDGE) top = Math.max(EDGE, rect.top - GAP - mh)
    if (left + mw > vw - EDGE) left = Math.max(EDGE, rect.right - mw)
    if (left < EDGE) left = EDGE
    setPos({ top, left, minWidth: rect.width })
  }

  function openMenu() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + GAP, left: rect.left, minWidth: rect.width })
    setOpen(true)
  }

  useLayoutEffect(() => {
    if (!open) return
    place()
  }, [open])

  useEffect(() => {
    if (!open) return
    return registerOverlayBack(close)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }
    function onScroll() {
      close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={openMenu}
        className="rounded-md border border-line bg-page px-3 py-2 text-sm hover:bg-hover"
      >
        {current}
      </button>
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-50" onClick={close} />
            <div
              ref={menuRef}
              role="listbox"
              aria-label={title}
              style={{ top: pos.top, left: pos.left, minWidth: pos.minWidth }}
              className="anim-panel fixed z-50 rounded-md border border-line bg-page py-1 shadow-pop"
            >
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={option.id === value}
                  onClick={() => {
                    onChange(option.id)
                    close()
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-sm whitespace-nowrap transition-colors duration-150 ${
                    option.id === value ? 'bg-active text-ink' : 'text-ink hover:bg-hover'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
