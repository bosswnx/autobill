import { mintAgentToken } from './mint.ts'

const env = (name: string): string | undefined =>
  process.env[name]?.trim() ||
  process.env[name.replace('TAGBILL_', 'TAGLEDGER_')]?.trim() ||
  undefined

const serverUrl = env('TAGBILL_MCP_URL') ?? process.argv[2] ?? ''
const targetKey = env('TAGBILL_TARGET_KEY') ?? process.argv[3] ?? ''
const userToken = env('TAGBILL_USER_TOKEN') ?? process.argv[4] ?? ''
const deviceName = env('TAGBILL_MCP_DEVICE_NAME') ?? process.argv[5] ?? 'AI agent'

if (!serverUrl || !targetKey || !userToken) {
  console.error(
    'usage: TAGBILL_MCP_URL=https://ledger.example.com \\\n' +
      '       TAGBILL_TARGET_KEY=... TAGBILL_USER_TOKEN=... \\\n' +
      '       npm run mcp:token -w @tagbill/server',
  )
  process.exit(1)
}

try {
  const result = await mintAgentToken({ serverUrl, targetKey, userToken, deviceName })
  console.error(`space ${result.spaceId}  device ${result.deviceName}  cloud data: ${result.hasCloudData}`)
  console.log(result.token)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
