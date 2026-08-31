import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { tapHaptic } from './haptic'
import { canHover } from './pointer'

const LONG_PRESS_MS = 300
const MOVE_PX = 12

type Drag = {
  id: number
  target: HTMLElement
  startX: number
  startY: number
  lastX: number
  timer: number | null
  scrubbing: boolean
}

export function useChartScrub(count: number) {
  const [index, setIndex] = useState<number | null>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const countRef = useRef(count)
  countRef.current = count
  const drag = useRef<Drag | null>(null)

  useEffect(() => {
    setIndex(null)
  }, [count])

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    function onTouchMove(event: TouchEvent) {
      if (drag.current?.scrubbing) event.preventDefault()
    }
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, [count])

  function indexAt(clientX: number): number {
    const el = areaRef.current
    const n = countRef.current
    if (!el || n <= 0) return 0
    const rect = el.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    return Math.max(0, Math.min(n - 1, Math.floor(ratio * n)))
  }

  function clearTimer() {
    const state = drag.current
    if (state?.timer == null) return
    window.clearTimeout(state.timer)
    state.timer = null
  }

  function arm(clientX: number) {
    const state = drag.current
    if (!state || state.scrubbing) return
    state.scrubbing = true
    clearTimer()
    try {
      state.target.setPointerCapture(state.id)
    } catch {
      /* pointer already released */
    }
    tapHaptic()
    setIndex(indexAt(clientX))
  }

  function finish(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    const wasScrubbing = state.scrubbing
    clearTimer()
    if (wasScrubbing) {
      try {
        state.target.releasePointerCapture(state.id)
      } catch {
        /* already released */
      }
    } else if (event.pointerType !== 'mouse') {
      const dx = event.clientX - state.startX
      const dy = event.clientY - state.startY
      if (dx * dx + dy * dy <= MOVE_PX * MOVE_PX) setIndex(indexAt(state.lastX))
    }
    drag.current = null
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.isPrimary) return
    if (event.pointerType === 'mouse') {
      if (canHover()) setIndex(indexAt(event.clientX))
      return
    }
    const target = event.currentTarget
    const timer = window.setTimeout(() => {
      if (drag.current?.id !== event.pointerId) return
      arm(drag.current.lastX)
    }, LONG_PRESS_MS)
    drag.current = {
      id: event.pointerId,
      target,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      timer,
      scrubbing: false,
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse') {
      if (canHover()) setIndex(indexAt(event.clientX))
      return
    }
    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    state.lastX = event.clientX
    if (state.scrubbing) {
      event.preventDefault()
      setIndex(indexAt(event.clientX))
      return
    }
    const dx = event.clientX - state.startX
    const dy = event.clientY - state.startY
    if (Math.abs(dy) > MOVE_PX && Math.abs(dy) > Math.abs(dx) * 1.15) {
      clearTimer()
      drag.current = null
      return
    }
    if (Math.abs(dx) > MOVE_PX && Math.abs(dx) >= Math.abs(dy)) {
      arm(event.clientX)
    }
  }

  function onPointerLeave(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && canHover() && !drag.current) setIndex(null)
  }

  function onContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault()
  }

  return {
    index,
    ref: areaRef,
    pointerProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      onPointerLeave,
      onContextMenu,
    },
  }
}
