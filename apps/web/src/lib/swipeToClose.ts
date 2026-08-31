import { useRef, type PointerEvent as ReactPointerEvent } from 'react'

const ACTIVATE = 10
const THRESHOLD = 72

function isEditingField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}

function canDismissFrom(target: EventTarget | null, root: HTMLElement): boolean {
  let el: HTMLElement | null = target instanceof HTMLElement ? target : null
  while (el && el !== root) {
    if (el.scrollHeight > el.clientHeight + 1 && el.scrollTop > 1) return false
    el = el.parentElement
  }
  return true
}

export function useSwipeToClose(close: () => void) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(close)
  closeRef.current = close
  const drag = useRef<{
    id: number
    startX: number
    startY: number
    dy: number
    active: boolean
    dragging: boolean
  } | null>(null)

  function resetStyle(dismiss: boolean) {
    const sheet = sheetRef.current
    if (!sheet) return
    if (dismiss) {
      sheet.style.transition = 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1)'
      sheet.style.transform = 'translateY(100%)'
      return
    }
    sheet.style.transition = 'transform 200ms ease-out'
    sheet.style.transform = ''
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    if (isEditingField(event.target)) return
    const sheet = sheetRef.current
    if (!sheet || !canDismissFrom(event.target, sheet)) return
    drag.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dy: 0,
      active: true,
      dragging: false,
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current
    if (!state?.active || state.id !== event.pointerId) return
    const dy = event.clientY - state.startY
    const dx = event.clientX - state.startX
    if (!state.dragging) {
      if (Math.abs(dy) < ACTIVATE && Math.abs(dx) < ACTIVATE) return
      if (dy < ACTIVATE || Math.abs(dx) > Math.abs(dy)) {
        state.active = false
        return
      }
      state.dragging = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    state.dy = Math.max(0, dy)
    const sheet = sheetRef.current
    if (!sheet) return
    event.preventDefault()
    sheet.classList.remove('anim-sheet')
    sheet.style.transition = 'none'
    sheet.style.transform = `translateY(${state.dy}px)`
    sheet.style.touchAction = 'none'
    const scroller = sheet.querySelector('[data-overlay-scroll]')
    if (scroller instanceof HTMLElement) scroller.style.overflow = 'hidden'
  }

  function finish(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    drag.current = null
    if (!state.dragging) return
    const sheet = event.currentTarget
    const blockClick = (click: Event) => {
      click.preventDefault()
      click.stopPropagation()
    }
    sheet.addEventListener('click', blockClick, { capture: true, once: true })
    if (state.dy > THRESHOLD) {
      resetStyle(true)
      closeRef.current()
      return
    }
    resetStyle(false)
    const scroller = sheet.querySelector('[data-overlay-scroll]')
    if (scroller instanceof HTMLElement) scroller.style.overflow = ''
    sheet.style.touchAction = ''
  }

  return {
    sheetRef,
    pointerProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
    },
  }
}
