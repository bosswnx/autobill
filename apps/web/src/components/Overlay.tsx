import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { lockOverlayPage, unlockOverlayPage } from '../lib/overlayLock'
import { registerOverlayBack } from '../lib/overlayBack'

const EXIT_MS = 150

type Props = {
  onClose: () => void
  children: (close: () => void) => ReactNode
  className?: string
  captureBack?: boolean
  exitMs?: number
}

export function Overlay({ onClose, children, className, captureBack = true, exitMs = EXIT_MS }: Props) {
  const [leaving, setLeaving] = useState(false)
  const closed = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const exitMsRef = useRef(exitMs)
  exitMsRef.current = exitMs

  const close = useCallback(() => {
    if (closed.current) return
    closed.current = true
    setLeaving(true)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.setTimeout(() => onCloseRef.current(), reduce ? 0 : exitMsRef.current)
  }, [])

  useEffect(() => {
    if (!captureBack) return
    return registerOverlayBack(() => close())
  }, [captureBack, close])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  useEffect(() => {
    lockOverlayPage()
    return () => unlockOverlayPage()
  }, [])

  return createPortal(
    <div
      className={`anim-overlay overlay-layer fixed z-50 flex justify-center bg-overlay ${
        leaving ? 'is-leaving' : ''
      } ${className ?? 'overlay-pad items-end sm:items-center'}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      {children(close)}
    </div>,
    document.body,
  )
}
