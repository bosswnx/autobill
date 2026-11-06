import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { mintAgentToken, normalizeBaseUrl } from './mint.ts'

/**
 * stdio bridge for MCP clients that cannot speak Streamable HTTP (for example
 * Claude Desktop). It forwards tools/list and tools/call to a running
 * TagBill server. Nothing may be written to stdout except MCP messages.
 */

const env = (name: string): string | undefined =>
  process.env[name]?.trim() ||
  process.env[name.replace('TAGBILL_', 'TAGLEDGER_')]?.trim() ||
  undefined

const serverUrl = normalizeBaseUrl(env('TAGBILL_MCP_URL') ?? '')
let token = env('TAGBILL_MCP_TOKEN') ?? ''

if (!serverUrl) {
  console.error('TAGBILL_MCP_URL is required, for example https://ledger.example.com')
  process.exit(1)
}

if (!token) {
  const targetKey = env('TAGBILL_TARGET_KEY') ?? ''
  const userToken = env('TAGBILL_USER_TOKEN') ?? ''
  if (!targetKey || !userToken) {
    console.error('Set TAGBILL_MCP_TOKEN, or TAGBILL_TARGET_KEY + TAGBILL_USER_TOKEN to mint one.')
    process.exit(1)
  }
  token = (
    await mintAgentToken({
      serverUrl,
      targetKey,
      userToken,
      deviceName: env('TAGBILL_MCP_DEVICE_NAME') ?? 'AI agent',
    })
  ).token
}

const client = new Client({ name: 'tagbill-bridge', version: '0.1.0' })
await client.connect(
  new StreamableHTTPClientTransport(new URL(`${serverUrl}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  }),
)

const server = new Server(
  { name: 'tagbill', version: '0.1.0' },
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
console.error(`tagbill mcp bridge -> ${serverUrl}`)
