import { App } from '@capacitor/app'
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'
import { resolvedTheme, subscribeTheme } from './lib/theme'

function applySystemBars(): void {
  const style = resolvedTheme() === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light
  void SystemBars.setStyle({ style }).catch(() => undefined)
}

export async function initNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  document.documentElement.classList.add('is-native', `is-${Capacitor.getPlatform()}`)
  document.documentElement.style.setProperty('-webkit-touch-callout', 'none')

  document.addEventListener('selectstart', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('input, textarea, [contenteditable="true"]')) return
    event.preventDefault()
  })

  applySystemBars()
  subscribeTheme(applySystemBars)

  await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      history.back()
      return
    }
    if (Capacitor.getPlatform() === 'android') void App.exitApp()
  })
}
