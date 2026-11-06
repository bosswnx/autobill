export type MintOptions = {
  serverUrl: string
  targetKey: string
  userToken: string
  deviceId?: string
  deviceName?: string
}

export type MintResult = {
  token: string
  spaceId: string
  deviceId: string
  deviceName: string
  isNewSpace: boolean
  hasCloudData: boolean
  cloudBookId: string | null
}

export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/** Exchanges the server gate (target key + user token) for a device token for an agent. */
export async function mintAgentToken(options: MintOptions): Promise<MintResult> {
  const base = normalizeBaseUrl(options.serverUrl)
  if (!base) throw new Error('server URL is required')
  const response = await fetch(`${base}/v1/mcp/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetKey: options.targetKey,
      userToken: options.userToken,
      deviceId: options.deviceId,
      deviceName: options.deviceName,
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) {
    let code = `http_${response.status}`
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) code = body.error
    } catch {
      /* ignore */
    }
    throw new Error(`token request failed: ${code}`)
  }
  return (await response.json()) as MintResult
}
