import { en } from './en'
import { zh } from './zh'
import { setDesktopWindowTitle } from '../lib/runtime'

export type Locale = 'zh' | 'en'
export type Messages = typeof zh

export const LOCALES: { id: Locale; nativeName: string }[] = [
  { id: 'zh', nativeName: '中文' },
  { id: 'en', nativeName: 'English' },
]

export const catalogs: Record<Locale, Messages> = { zh, en }

const STORAGE_KEY = 'tagledger.locale'

type Listener = (locale: Locale) => void

const listeners = new Set<Listener>()

function isLocale(value: string | null): value is Locale {
  return value === 'zh' || value === 'en'
}

function readStored(): Locale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isLocale(value) ? value : null
  } catch {
    return null
  }
}

let current: Locale = readStored() ?? 'zh'

function applyDocumentLocale(locale: Locale): void {
  const messages = catalogs[locale]
  document.documentElement.lang = messages.htmlLang
  document.title = messages.appName
  void setDesktopWindowTitle(messages.appName)
}

export function getLocale(): Locale {
  return current
}

export function getMessages(): Messages {
  return catalogs[current]
}

export function setLocale(locale: Locale): void {
  if (locale === current) return
  current = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore quota / private mode */
  }
  applyDocumentLocale(locale)
  for (const listener of listeners) listener(locale)
}

export function subscribeLocale(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function initLocale(): void {
  applyDocumentLocale(current)
}
