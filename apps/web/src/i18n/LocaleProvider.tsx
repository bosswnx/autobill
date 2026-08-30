import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  catalogs,
  getLocale,
  setLocale as persistLocale,
  subscribeLocale,
  type Locale,
  type Messages,
} from './store'

type LocaleContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Messages
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getLocale)

  useEffect(() => subscribeLocale(setLocaleState), [])

  return (
    <LocaleContext.Provider value={{ locale, setLocale: persistLocale, t: catalogs[locale] }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useI18n(): LocaleContextValue {
  const value = useContext(LocaleContext)
  if (!value) throw new Error('useI18n must be used within LocaleProvider')
  return value
}
