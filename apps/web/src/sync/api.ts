import type { ConnectRequest, ConnectResponse, SyncRequest, SyncResponse } from '@tagbill/shared'
import { getMessages } from '../i18n'

export class SyncApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

const ERROR_CODES: Record<string, keyof ReturnType<typeof getMessages>['sync']['errors']> = {
  invalid_target_key: 'invalidTargetKey',
  invalid_user_token: 'invalidUserToken',
  unauthorized: 'unauthorized',
  rate_limited: 'rateLimited',
  payload_too_large: 'payloadTooLarge',
  invalid_change: 'invalidChange',
  network: 'network',
  failed: 'failed',
}

export function describeSyncError(error: unknown): string {
  const t = getMessages()
  const code =
    error instanceof SyncApiError ? error.code : typeof error === 'string' ? error : null
  if (code && code in ERROR_CODES) return t.sync.errors[ERROR_CODES[code]]
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string') return error
  return t.sync.errors.failed
}

export function detectHostedOrigin(): Promise<string | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  return fetch(`${window.location.origin}/healthz`, { signal: AbortSignal.timeout(2500) })
    .then(async (response) => {
      if (!response.ok) return null
      const type = response.headers.get('content-type') ?? ''
      if (!type.includes('application/json')) return null
      const body = (await response.json()) as { ok?: boolean }
      return body.ok ? window.location.origin : null
    })
    .catch(() => null)
}

export function stripServerScheme(input: string): string {
  return input.replace(/^https?:\/\//i, '')
}

export function normalizeServerUrl(input: string): string {
  const url = stripServerScheme(input.trim()).replace(/\/+$/, '')
  if (!url) return ''
  return `https://${url}`
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
    throw new SyncApiError('network', 'network')
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
