import { mintAgentToken } from './mint.ts'

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

const serverUrl = env('AUTOBILL_MCP_URL') ?? process.argv[2] ?? ''
const targetKey = env('AUTOBILL_TARGET_KEY') ?? process.argv[3] ?? ''
const userToken = env('AUTOBILL_USER_TOKEN') ?? process.argv[4] ?? ''
const deviceName = env('AUTOBILL_MCP_DEVICE_NAME') ?? process.argv[5] ?? 'AI agent'

if (!serverUrl || !targetKey || !userToken) {
  console.error(
    'usage: AUTOBILL_MCP_URL=https://ledger.example.com \\\n' +
      '       AUTOBILL_TARGET_KEY=... AUTOBILL_USER_TOKEN=... \\\n' +
      '       npm run mcp:token -w @autobill/server',
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
