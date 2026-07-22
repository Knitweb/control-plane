import { createHmac, timingSafeEqual } from 'node:crypto'

const MAX_BODY_BYTES = 1_048_576

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

export const maxBodyBytes = MAX_BODY_BYTES
