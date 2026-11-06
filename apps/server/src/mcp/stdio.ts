import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { mintAgentToken, normalizeBaseUrl } from './mint.ts'

/**
 * stdio bridge for MCP clients that cannot speak Streamable HTTP (for example
 * Claude Desktop). It forwards tools/list and tools/call to a running
 * TagLedger server. Nothing may be written to stdout except MCP messages.
 */

const serverUrl = normalizeBaseUrl(process.env.TAGLEDGER_MCP_URL ?? '')
let token = process.env.TAGLEDGER_MCP_TOKEN?.trim() ?? ''

if (!serverUrl) {
  console.error('TAGLEDGER_MCP_URL is required, for example https://ledger.example.com')
  process.exit(1)
}

if (!token) {
  const targetKey = process.env.TAGLEDGER_TARGET_KEY?.trim() ?? ''
  const userToken = process.env.TAGLEDGER_USER_TOKEN?.trim() ?? ''
  if (!targetKey || !userToken) {
    console.error('Set TAGLEDGER_MCP_TOKEN, or TAGLEDGER_TARGET_KEY + TAGLEDGER_USER_TOKEN to mint one.')
    process.exit(1)
  }
  token = (
    await mintAgentToken({
      serverUrl,
      targetKey,
      userToken,
      deviceName: process.env.TAGLEDGER_MCP_DEVICE_NAME ?? 'AI agent',
    })
  ).token
}

const client = new Client({ name: 'tagledger-bridge', version: '0.1.0' })
await client.connect(
  new StreamableHTTPClientTransport(new URL(`${serverUrl}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  }),
)

const server = new Server(
  { name: 'tagledger', version: '0.1.0' },
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
console.error(`tagledger mcp bridge -> ${serverUrl}`)
