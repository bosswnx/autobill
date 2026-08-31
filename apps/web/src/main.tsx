import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initLocale, LocaleProvider } from './i18n'
import { initLayout } from './lib/layout.ts'
import { initDesktop, initOverlayScroll } from './lib/runtime.ts'
import { initNative } from './native.ts'

initDesktop()
initLayout()
initOverlayScroll()
void initNative()
initLocale()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>,
)
