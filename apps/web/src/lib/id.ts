export function nid(): string {
  return crypto.randomUUID()
}

const DEVICE_KEY = 'tagledger.deviceId'

export function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = nid()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}
