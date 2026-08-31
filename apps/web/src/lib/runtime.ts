export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function initDesktop(): void {
  if (!isTauri()) return
  document.documentElement.classList.add('is-tauri', 'is-desktop')
}

export async function setDesktopWindowTitle(title: string): Promise<void> {
  if (!isTauri()) return
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().setTitle(title)
  } catch {
    /* older shell */
  }
}

export function initOverlayScroll(): void {
  let timer = 0
  const root = document.documentElement
  const hide = () => root.classList.remove('is-scrolling')
  const onScroll = () => {
    root.classList.add('is-scrolling')
    window.clearTimeout(timer)
    timer = window.setTimeout(hide, 800)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
}
