import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// Authenticated symmetric encryption for secrets stored at rest (e.g. QBO
// OAuth tokens). Ciphertext format is a versioned, colon-delimited string:
//
//   enc:v1:<iv-base64>:<authTag-base64>:<data-base64>
//
// The version prefix lets us distinguish encrypted values from legacy
// plaintext during migration, and leaves room to rotate the scheme later.

const ALGORITHM = 'aes-256-gcm'
const PREFIX = 'enc:v1'
const IV_BYTES = 12
const KEY_BYTES = 32

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY
  if (!raw) throw new Error('TOKEN_ENCRYPTION_KEY is not set')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== KEY_BYTES) {
    throw new Error(`TOKEN_ENCRYPTION_KEY must decode to 32 bytes, got ${key.length}`)
  }
  return key
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(`${PREFIX}:`)
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [PREFIX, iv.toString('base64'), authTag.toString('base64'), data.toString('base64')].join(':')
}

export function decrypt(ciphertext: string): string {
  if (!isEncrypted(ciphertext)) {
    throw new Error('Value is not in the expected encrypted format')
  }
  const [, , ivB64, tagB64, dataB64] = ciphertext.split(':')
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed ciphertext')
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
}
