import { createHmac, timingSafeEqual } from 'node:crypto'

const MAX_BODY_BYTES = 1_048_576
const MAX_RATE_LIMIT_ENTRIES = 10_000

export function readBearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith('Bearer ')) return undefined
  const token = header.slice('Bearer '.length).trim()
  return token.length > 0 ? token : undefined
}

export function safeEqual(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function verifyGithubSignature(
  body: Buffer,
  signature: string | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !signature || !signature.startsWith('sha256=')) return false
  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
  return safeEqual(signature, expected)
}

export function bodyWithinLimit(contentLength: string | undefined): boolean {
  if (!contentLength) return true
  const length = Number(contentLength)
  return Number.isSafeInteger(length) && length >= 0 && length <= MAX_BODY_BYTES
}

export function isTrustedHost(host: string | undefined, trustedHosts: string[]): boolean {
  if (!host) return false
  const normalized = host.toLowerCase().trim().replace(/:\d+$/, '')
  return trustedHosts.some((trusted) => trusted.toLowerCase().trim() === normalized)
}

export function isValidGithubDelivery(value: string | undefined): boolean {
  return value !== undefined && /^[a-zA-Z0-9][a-zA-Z0-9-]{0,99}$/.test(value)
}

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, { startedAt: number; count: number }>()

  constructor(private readonly maxRequests: number, private readonly windowMs: number) {}

  allow(key: string, now = Date.now()): boolean {
    const current = this.entries.get(key)
    if (!current || now - current.startedAt >= this.windowMs) {
      if (this.entries.size >= MAX_RATE_LIMIT_ENTRIES) this.entries.delete(this.entries.keys().next().value as string)
      this.entries.set(key, { startedAt: now, count: 1 })
      return true
    }
    if (current.count >= this.maxRequests) return false
    current.count += 1
    return true
  }
}

export const maxBodyBytes = MAX_BODY_BYTES
