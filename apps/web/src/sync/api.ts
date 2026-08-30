import type { ConnectRequest, ConnectResponse, SyncRequest, SyncResponse } from '@tagledger/shared'

export class SyncApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export function describeSyncError(error: unknown): string {
  if (error instanceof SyncApiError) {
    switch (error.code) {
      case 'invalid_target_key':
        return '服务器密钥不对'
      case 'invalid_user_token':
        return '用户 token 至少 8 位'
      case 'unauthorized':
        return '同步凭证失效，请重新登录'
      case 'rate_limited':
        return '尝试太频繁，稍后再试'
      case 'payload_too_large':
        return '这次要同步的数据太大'
      case 'invalid_change':
        return '有一条本地记录服务端无法接受'
      case 'network':
        return '连不上服务器'
      default:
        return error.message || '同步失败'
    }
  }
  if (error instanceof Error && error.message) return error.message
  return '同步失败'
}

export function detectHostedOrigin(): Promise<string | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  return fetch(`${window.location.origin}/healthz`, { signal: AbortSignal.timeout(2500) })
    .then(async (response) => {
      if (!response.ok) return null
      const body = (await response.json()) as { ok?: boolean }
      return body.ok ? window.location.origin : null
    })
    .catch(() => null)
}

export function normalizeServerUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, '')
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`
  return url
}

async function readErrorCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string }
    if (body.error) return body.error
  } catch {
    /* ignore */
  }
  return `http_${response.status}`
}

async function post<T>(
  serverUrl: string,
  path: string,
  body: unknown,
  token?: string,
  timeoutMs = 20_000,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${serverUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch {
    throw new SyncApiError('network', '连不上服务器')
  }
  if (!response.ok) {
    const code = await readErrorCode(response)
    throw new SyncApiError(code, describeSyncError(new SyncApiError(code, code)))
  }
  return (await response.json()) as T
}

export function connect(serverUrl: string, request: ConnectRequest): Promise<ConnectResponse> {
  return post<ConnectResponse>(serverUrl, '/v1/connect', request)
}

export function replaceRemote(serverUrl: string, token: string): Promise<{ cursor: string }> {
  return post(serverUrl, '/v1/replace', {}, token)
}

export function syncPullPush(
  serverUrl: string,
  token: string,
  request: SyncRequest,
): Promise<SyncResponse> {
  return post<SyncResponse>(serverUrl, '/v1/sync', request, token, 60_000)
}
