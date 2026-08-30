type Closer = () => void

const stack: Closer[] = []
let listening = false
let ignoreNextPop = 0

function isOverlayState(state: unknown): boolean {
  return !!state && typeof state === 'object' && 'overlay' in state
}

function onPopState() {
  if (ignoreNextPop > 0) {
    ignoreNextPop -= 1
    return
  }
  const closer = stack.pop()
  closer?.()
  if (stack.length === 0) stop()
}

function start() {
  if (listening) return
  listening = true
  window.addEventListener('popstate', onPopState)
}

function stop() {
  if (!listening) return
  listening = false
  window.removeEventListener('popstate', onPopState)
}

/** Overlay 打开时压一条历史。系统返回 / 侧滑会关掉最上层。点关闭时自己 pop，避免误关下一层。 */
export function registerOverlayBack(close: Closer): () => void {
  stack.push(close)
  history.pushState({ overlay: stack.length }, '')
  start()

  return () => {
    const index = stack.lastIndexOf(close)
    if (index === -1) return
    stack.splice(index, 1)
    if (isOverlayState(history.state)) {
      ignoreNextPop += 1
      history.back()
    }
    if (stack.length === 0) stop()
  }
}
