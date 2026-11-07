import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { mintAgentToken, normalizeBaseUrl } from './mint.ts'

/**
 * stdio bridge for MCP clients that cannot speak Streamable HTTP (for example
 * Claude Desktop). It forwards tools/list and tools/call to a running
 * AutoBill server. Nothing may be written to stdout except MCP messages.
 */

const env = (name: string): string | undefined => {
  const legacy = name.startsWith('AUTOBILL_')
    ? [name.replace('AUTOBILL_', 'TAGBILL_'), name.replace('AUTOBILL_', 'TAGLEDGER_')]
    : []
  for (const key of [name, ...legacy]) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return undefined
}

const serverUrl = normalizeBaseUrl(env('AUTOBILL_MCP_URL') ?? '')
let token = env('AUTOBILL_MCP_TOKEN') ?? ''

if (!serverUrl) {
  console.error('AUTOBILL_MCP_URL is required, for example https://ledger.example.com')
  process.exit(1)
}

if (!token) {
  const targetKey = env('AUTOBILL_TARGET_KEY') ?? ''
  const userToken = env('AUTOBILL_USER_TOKEN') ?? ''
  if (!targetKey || !userToken) {
    console.error('Set AUTOBILL_MCP_TOKEN, or AUTOBILL_TARGET_KEY + AUTOBILL_USER_TOKEN to mint one.')
    process.exit(1)
  }
  token = (
    await mintAgentToken({
      serverUrl,
      targetKey,
      userToken,
      deviceName: env('AUTOBILL_MCP_DEVICE_NAME') ?? 'AI agent',
    })
  ).token
}

const client = new Client({ name: 'autobill-bridge', version: '0.1.0' })
await client.connect(
  new StreamableHTTPClientTransport(new URL(`${serverUrl}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  }),
)

const server = new Server(
  { name: 'autobill', version: '0.1.0' },
  {
    capabilities: { tools: {} },
    instructions: client.getInstructions(),
  },
)

server.setRequestHandler(ListToolsRequestSchema, async (request) =>
  client.listTools(request.params),
)
server.setRequestHandler(CallToolRequestSchema, async (request) =>
  client.callTool(request.params),
)

await server.connect(new StdioServerTransport())
console.error(`autobill mcp bridge -> ${serverUrl}`)
