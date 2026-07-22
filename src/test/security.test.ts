import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { bodyWithinLimit, safeEqual, verifyGithubSignature } from '../security.js'

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
