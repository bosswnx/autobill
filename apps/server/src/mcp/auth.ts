import { hashSecret } from '../crypto.ts'
import { findDeviceByTokenHash } from '../db.ts'
import type { Agent } from './store.ts'

/**
 * Resolves an `Authorization: Bearer <device token>` header to the space the
 * token belongs to. Device tokens are minted by POST /v1/mcp/token.
 */
export function resolveAgent(header: string | undefined): Agent | undefined {
  if (!header?.startsWith('Bearer ')) return undefined
  const token = header.slice('Bearer '.length).trim()
  if (!token) return undefined
  const device = findDeviceByTokenHash(hashSecret(token))
  if (!device) return undefined
  return { spaceId: device.space_id, deviceKey: device.device_id }
}
