import { mintAgentToken } from './mint.ts'

const serverUrl = process.env.TAGLEDGER_MCP_URL ?? process.argv[2] ?? ''
const targetKey = process.env.TAGLEDGER_TARGET_KEY ?? process.argv[3] ?? ''
const userToken = process.env.TAGLEDGER_USER_TOKEN ?? process.argv[4] ?? ''
const deviceName = process.env.TAGLEDGER_MCP_DEVICE_NAME ?? process.argv[5] ?? 'AI agent'

if (!serverUrl || !targetKey || !userToken) {
  console.error(
    'usage: TAGLEDGER_MCP_URL=https://ledger.example.com \\\n' +
      '       TAGLEDGER_TARGET_KEY=... TAGLEDGER_USER_TOKEN=... \\\n' +
      '       npm run mcp:token -w @tagledger/server',
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
