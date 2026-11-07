export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'autobill.theme'
const LEGACY_STORAGE_KEYS = ['tagbill.theme', 'tagledger.theme']

type Listener = () => void

const listeners = new Set<Listener>()

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

function readStored(): ThemeMode | null {
  try {
    let value = localStorage.getItem(STORAGE_KEY)
    if (!value) {
      for (const key of LEGACY_STORAGE_KEYS) {
        value = localStorage.getItem(key)
        if (value) {
          localStorage.setItem(STORAGE_KEY, value)
          break
        }
      }
    }
    return isThemeMode(value) ? value : null
  } catch {
    return null
  }
}

let current: ThemeMode = readStored() ?? 'system'

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function getThemeMode(): ThemeMode {
  return current
}

export function resolvedTheme(mode: ThemeMode = current): 'light' | 'dark' {
  return mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode
}

function applyTheme(): void {
  if (typeof document === 'undefined') return
  const dark = resolvedTheme() === 'dark'
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#191919' : '#F7F6F3')
}

export function setThemeMode(mode: ThemeMode): void {
  if (mode === current) return
  current = mode
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    /* ignore quota / private mode */
  }
  applyTheme()
  for (const listener of listeners) listener()
}

export function subscribeTheme(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function initTheme(): void {
  applyTheme()
  if (typeof window === 'undefined') return
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (current !== 'system') return
    applyTheme()
    for (const listener of listeners) listener()
  })
}
