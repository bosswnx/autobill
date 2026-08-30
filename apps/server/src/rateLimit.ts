type Bucket = number[]

const windows = new Map<string, Bucket>()
const WINDOW_MS = 15 * 60 * 1000
const MAX_HITS = 20

export function rateLimit(key: string): boolean {
  const now = Date.now()
  const hits = (windows.get(key) ?? []).filter((at) => now - at < WINDOW_MS)
  if (hits.length >= MAX_HITS) {
    windows.set(key, hits)
    return false
  }
  hits.push(now)
  windows.set(key, hits)
  return true
}
