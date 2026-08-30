import { App } from '@capacitor/app'
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'

export async function initNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  document.documentElement.classList.add('is-native', `is-${Capacitor.getPlatform()}`)

  try {
    await SystemBars.setStyle({ style: SystemBarsStyle.Light })
  } catch {
    /* web 或旧壳 */
  }

  await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      history.back()
      return
    }
    if (Capacitor.getPlatform() === 'android') void App.exitApp()
  })
}
