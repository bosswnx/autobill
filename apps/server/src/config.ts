import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const root = dirname(fileURLToPath(import.meta.url))

export type Config = {
  port: number
  host: string
  targetKey: string
  pepper: string
  dataDir: string
  dbPath: string
  webRoot: string | null
  generatedTargetKey: boolean
}

type SecretsFile = {
  targetKey: string
  pepper: string
}

function env(name: string): string | undefined {
  // TAGLEDGER_* was the pre-rename prefix; keep reading it for existing installs.
  const legacy = name.startsWith('TAGBILL_') ? name.replace('TAGBILL_', 'TAGLEDGER_') : name
  const value = (process.env[name] ?? process.env[legacy])?.trim()
  return value || undefined
}

function dbPathFor(dataDir: string): string {
  const next = join(dataDir, 'tagbill.sqlite')
  const legacy = join(dataDir, 'tagledger.sqlite')
  if (!existsSync(next) && existsSync(legacy)) {
    for (const suffix of ['', '-wal', '-shm']) {
      if (existsSync(`${legacy}${suffix}`)) renameSync(`${legacy}${suffix}`, `${next}${suffix}`)
    }
  }
  return next
}

function webRootPath(): string | null {
  const raw = env('TAGBILL_WEB')
  const candidates = [
    raw,
    join(root, '..', '..', 'web', 'dist'),
    join(process.cwd(), '..', 'web', 'dist'),
  ]
  for (const dir of candidates) {
    if (!dir) continue
    const resolved = isAbsolute(dir) ? dir : join(process.cwd(), dir)
    if (existsSync(join(resolved, 'index.html'))) return resolved
  }
  return null
}

function dataDirPath(): string {
  const raw = env('TAGBILL_DATA') ?? join(root, '..', 'data')
  return isAbsolute(raw) ? raw : join(process.cwd(), raw)
}

function loadOrCreateSecrets(dir: string): SecretsFile {
  const path = join(dir, 'secrets.json')
  if (existsSync(path)) {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<SecretsFile>
    if (parsed.targetKey && parsed.pepper) {
      return { targetKey: parsed.targetKey, pepper: parsed.pepper }
    }
  }
  const secrets: SecretsFile = {
    targetKey: randomBytes(24).toString('base64url'),
    pepper: randomBytes(32).toString('hex'),
  }
  writeFileSync(path, `${JSON.stringify(secrets, null, 2)}\n`, { mode: 0o600 })
  return secrets
}

export function loadConfig(): Config {
  const dataDir = dataDirPath()
  mkdirSync(dataDir, { recursive: true })

  const fromEnvTarget = env('TAGBILL_TARGET_KEY')
  const fromEnvPepper = env('TAGBILL_PEPPER')
  const secrets =
    fromEnvTarget && fromEnvPepper
      ? { targetKey: fromEnvTarget, pepper: fromEnvPepper }
      : {
          ...loadOrCreateSecrets(dataDir),
          ...(fromEnvTarget ? { targetKey: fromEnvTarget } : {}),
          ...(fromEnvPepper ? { pepper: fromEnvPepper } : {}),
        }

  return {
    port: Number(env('PORT') ?? '8787'),
    host: env('HOST') ?? '0.0.0.0',
    targetKey: secrets.targetKey,
    pepper: secrets.pepper,
    dataDir,
    dbPath: dbPathFor(dataDir),
    webRoot: webRootPath(),
    generatedTargetKey: !fromEnvTarget,
  }
}
