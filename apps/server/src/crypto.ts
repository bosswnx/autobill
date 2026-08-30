import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export function spaceKey(userToken: string, pepper: string): string {
  return createHmac('sha256', pepper).update(userToken, 'utf8').digest('hex')
}

export function hashSecret(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function newDeviceToken(): string {
  return randomBytes(32).toString('base64url')
}

export function newId(): string {
  return randomBytes(16).toString('hex')
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) {
    timingSafeEqual(left, left)
    return false
  }
  return timingSafeEqual(left, right)
}
