let locks = 0
let scrollY = 0
let viewportBound = false

function syncVisualViewport() {
  const view = window.visualViewport
  const top = view?.offsetTop ?? 0
  const height = view?.height ?? window.innerHeight
  const root = document.documentElement
  root.style.setProperty('--vv-top', `${top}px`)
  root.style.setProperty('--vv-height', `${height}px`)
  if (window.scrollY !== 0) window.scrollTo(0, 0)
}

function onTouchMove(event: TouchEvent) {
  const target = event.target
  if (!(target instanceof Element)) {
    event.preventDefault()
    return
  }
  const scroller = target.closest('[data-overlay-scroll]')
  if (scroller instanceof HTMLElement) {
    const canScroll = scroller.scrollHeight > scroller.clientHeight + 1
    if (canScroll) return
  }
  event.preventDefault()
}

function bindVisualViewport() {
  if (viewportBound) return
  viewportBound = true
  syncVisualViewport()
  window.visualViewport?.addEventListener('resize', syncVisualViewport)
  window.visualViewport?.addEventListener('scroll', syncVisualViewport)
  window.addEventListener('touchmove', onTouchMove, { passive: false })
}

function unbindVisualViewport() {
  if (!viewportBound) return
  viewportBound = false
  window.visualViewport?.removeEventListener('resize', syncVisualViewport)
  window.visualViewport?.removeEventListener('scroll', syncVisualViewport)
  window.removeEventListener('touchmove', onTouchMove)
  const root = document.documentElement
  root.style.removeProperty('--vv-top')
  root.style.removeProperty('--vv-height')
}

export function lockOverlayPage() {
  locks += 1
  if (locks !== 1) return
  scrollY = window.scrollY
  document.documentElement.classList.add('overlay-open')
  document.body.style.top = `-${scrollY}px`
  bindVisualViewport()
}

export function unlockOverlayPage() {
  locks = Math.max(0, locks - 1)
  if (locks !== 0) return
  unbindVisualViewport()
  document.documentElement.classList.remove('overlay-open')
  document.body.style.top = ''
  window.scrollTo(0, scrollY)
}
