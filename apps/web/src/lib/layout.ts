import { Capacitor } from '@capacitor/core'
import { isTauri } from './runtime'

/** Shortest CSS side ≥ 600px is a tablet (Material / Apple). Phones stay below. */
const TABLET_SHORTEST_SIDE = 600

function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

function isLandscape(): boolean {
  if (isNative()) {
    const type = window.screen.orientation?.type
    if (type) return type.startsWith('landscape')
  }
  return window.innerWidth > window.innerHeight
}

export function shouldUseDesktopLayout(): boolean {
  if (typeof window === 'undefined') return false
  if (isTauri()) return true
  const shortest = Math.min(window.screen.width, window.screen.height)
  if (shortest < TABLET_SHORTEST_SIDE) return false
  return isLandscape()
}

export function applyLayoutClass(): void {
  const desktop = shouldUseDesktopLayout()
  const root = document.documentElement
  root.classList.toggle('layout-desktop', desktop)
  root.classList.toggle('layout-phone', !desktop)
}

export function initLayout(): void {
  applyLayoutClass()
  window.addEventListener('resize', applyLayoutClass)
  window.addEventListener('orientationchange', applyLayoutClass)
  window.screen.orientation?.addEventListener('change', applyLayoutClass)
}
