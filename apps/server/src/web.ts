import { readFile } from 'node:fs/promises'
import { join, normalize, relative, sep } from 'node:path'
import { getMimeType } from 'hono/utils/mime'
import type { Hono } from 'hono'

function isApi(path: string): boolean {
  return path === '/healthz' || path.startsWith('/v1/')
}

function safeFile(webRoot: string, urlPath: string): string | null {
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '')
  const resolved = normalize(join(webRoot, rel))
  const fromRoot = relative(webRoot, resolved)
  if (!fromRoot || fromRoot.startsWith('..') || fromRoot.startsWith(`..${sep}`)) return null
  return resolved
}

export function mountWeb(app: Hono, webRoot: string): void {
  app.get('*', async (c, next) => {
    if (isApi(c.req.path)) return next()
    const file = safeFile(webRoot, c.req.path)
    if (!file) return next()
    try {
      const data = await readFile(file)
      const mime = getMimeType(file) || 'application/octet-stream'
      c.header('Content-Type', mime)
      return c.body(data)
    } catch {
      if (c.req.path.includes('.')) return next()
      const index = await readFile(join(webRoot, 'index.html'))
      return c.html(index.toString())
    }
  })
}
