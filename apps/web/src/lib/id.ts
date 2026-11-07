export function nid(): string {
  return crypto.randomUUID()
}

const DEVICE_KEY = 'autobill.deviceId'
const LEGACY_DEVICE_KEYS = ['tagbill.deviceId', 'tagledger.deviceId']

export function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    for (const key of LEGACY_DEVICE_KEYS) {
      const legacy = localStorage.getItem(key)
      if (!legacy) continue
      id = legacy
      localStorage.setItem(DEVICE_KEY, legacy)
      break
    }
  }
  if (!id) {
    id = nid()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}
