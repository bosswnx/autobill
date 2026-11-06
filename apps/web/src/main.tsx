import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { migrateLegacyDb } from './db/database.ts'
import { initLocale, LocaleProvider } from './i18n'
import { initLayout } from './lib/layout.ts'
import { initDesktop, initOverlayScroll } from './lib/runtime.ts'
import { initTheme } from './lib/theme.ts'
import { initNative } from './native.ts'

async function boot(): Promise<void> {
  await migrateLegacyDb()
  initDesktop()
  initLayout()
  initOverlayScroll()
  initTheme()
  void initNative()
  initLocale()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <LocaleProvider>
        <App />
      </LocaleProvider>
    </StrictMode>,
  )
}

void boot()
