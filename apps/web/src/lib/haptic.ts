import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Capacitor } from '@capacitor/core'

export function tapHaptic(): void {
  if (Capacitor.isNativePlatform()) {
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
    return
  }
  try {
    navigator.vibrate?.(10)
  } catch {
    /* desktop */
  }
}
