import type { Hono } from 'hono'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { resolveAgent } from './auth.ts'
import { registerTools } from './tools.ts'

const INSTRUCTIONS = `AutoBill is a personal ledger: one book, a two-level category tree, optional tags, expense/income entries, and recurring subscriptions.
Categories are the primary structure: a root category and, at most, one level of subcategories. Entries may also carry tags as extra labels.
Amounts are integer cents. Categories and tags have a kind (expense or income) that never changes.
Every write is a soft-delete-aware change that syncs to all of the user's devices on their next sync.
Read ledger_info first: it returns the book, currency, savings, counts, and the server time zone.
Call list_categories before recording: category ids or paths must already exist; create new ones with create_category.
Tags are optional; tagNames must already exist too, so create them with create_tag first.
Times use ISO 8601 or local "YYYY-MM-DD HH:mm"; omitted means now.`

export function mountMcp(app: Hono): void {
  app.all('/mcp', async (c) => {
    const agent = resolveAgent(c.req.header('Authorization'))
    if (!agent) {
      c.header('WWW-Authenticate', 'Bearer realm="autobill"')
      return c.json({ error: 'unauthorized' }, 401)
    }

    const server = new McpServer(
      { name: 'autobill', version: '0.1.0' },
      { instructions: INSTRUCTIONS },
    )
    registerTools(server, agent)

    // Stateless: one server + transport per request, JSON responses instead of SSE.
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    await server.connect(transport)
    return transport.handleRequest(c.req.raw)
  })
}
