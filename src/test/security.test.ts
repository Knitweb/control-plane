import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import {
  bodyWithinLimit,
  FixedWindowRateLimiter,
  isTrustedHost,
  isValidGithubDelivery,
  safeEqual,
  verifyGithubSignature,
} from '../security.js'

test('GitHub signatures require an exact HMAC match', () => {
  const body = Buffer.from('{"action":"opened"}')
  const secret = 'test-secret'
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
  assert.equal(verifyGithubSignature(body, signature, secret), true)
  assert.equal(verifyGithubSignature(body, `${signature}x`, secret), false)
  assert.equal(verifyGithubSignature(body, signature, undefined), false)
})

test('security comparisons do not accept missing or different-length values', () => {
  assert.equal(safeEqual(undefined, 'secret'), false)
  assert.equal(safeEqual('a', 'b'), false)
  assert.equal(safeEqual('secret', 'secret'), true)
})

test('webhook body limits reject oversized declared lengths', () => {
  assert.equal(bodyWithinLimit('1048576'), true)
  assert.equal(bodyWithinLimit('1048577'), false)
  assert.equal(bodyWithinLimit('not-a-number'), false)
})

test('trusted hosts and delivery identifiers are explicit', () => {
  assert.equal(isTrustedHost('localhost:8787', ['localhost']), true)
  assert.equal(isTrustedHost('evil.example', ['localhost']), false)
  assert.equal(isValidGithubDelivery('abc-123'), true)
  assert.equal(isValidGithubDelivery(''), false)
  assert.equal(isValidGithubDelivery('delivery id'), false)
})

test('webhook rate limiting uses a fixed window', () => {
  const limiter = new FixedWindowRateLimiter(2, 1000)
  assert.equal(limiter.allow('client', 0), true)
  assert.equal(limiter.allow('client', 1), true)
  assert.equal(limiter.allow('client', 2), false)
  assert.equal(limiter.allow('client', 1001), true)
})
