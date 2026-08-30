import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
  generatedTargetKey: boolean
}

type SecretsFile = {
  targetKey: string
  pepper: string
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value || undefined
}

function dataDirPath(): string {
  const raw = env('TAGLEDGER_DATA') ?? join(root, '..', 'data')
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

  const fromEnvTarget = env('TAGLEDGER_TARGET_KEY')
  const fromEnvPepper = env('TAGLEDGER_PEPPER')
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
    dbPath: join(dataDir, 'tagledger.sqlite'),
    generatedTargetKey: !fromEnvTarget,
  }
}
