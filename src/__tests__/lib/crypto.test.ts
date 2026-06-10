import { encrypt, decrypt, isEncrypted } from '@/lib/crypto'

const KEY = Buffer.alloc(32, 7).toString('base64')

describe('crypto', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, TOKEN_ENCRYPTION_KEY: KEY }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('round-trips a value through encrypt and decrypt', () => {
    const plaintext = 'super-secret-refresh-token'
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })

  it('produces ciphertext that does not contain the plaintext', () => {
    const plaintext = 'another-secret'
    const ciphertext = encrypt(plaintext)
    expect(ciphertext).not.toContain(plaintext)
    expect(ciphertext.startsWith('enc:v1:')).toBe(true)
  })

  it('produces different ciphertext each time (random IV)', () => {
    expect(encrypt('same')).not.toBe(encrypt('same'))
  })

  it('detects encrypted vs plaintext values', () => {
    expect(isEncrypted(encrypt('x'))).toBe(true)
    expect(isEncrypted('plain-legacy-token')).toBe(false)
  })

  it('throws when the ciphertext has been tampered with', () => {
    const ciphertext = encrypt('integrity-protected')
    const parts = ciphertext.split(':')
    const data = Buffer.from(parts[4], 'base64')
    data[0] ^= 0xff
    parts[4] = data.toString('base64')
    expect(() => decrypt(parts.join(':'))).toThrow()
  })

  it('throws when decrypting a malformed value', () => {
    expect(() => decrypt('not-encrypted')).toThrow()
  })

  it('throws when the key is missing', () => {
    delete process.env.TOKEN_ENCRYPTION_KEY
    expect(() => encrypt('x')).toThrow(/TOKEN_ENCRYPTION_KEY/)
  })

  it('throws when the key is not 32 bytes', () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString('base64')
    expect(() => encrypt('x')).toThrow(/32 bytes/)
  })
})
