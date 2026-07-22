import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { JsonlOutbox } from './outbox.js'
import {
  bodyWithinLimit,
  FixedWindowRateLimiter,
  isTrustedHost,
  isValidGithubDelivery,
  maxBodyBytes,
  readBearerToken,
  safeEqual,
  verifyGithubSignature,
} from './security.js'
import { normalizeGithubWebhook } from './webhook.js'

const host = process.env.CONTROL_PLANE_HOST ?? '127.0.0.1'
const port = Number(process.env.CONTROL_PLANE_PORT ?? 8787)
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET
const adminToken = process.env.CONTROL_PLANE_ADMIN_TOKEN
const outbox = new JsonlOutbox(process.env.CONTROL_PLANE_OUTBOX_PATH ?? './data/outbox.jsonl')
const trustedHosts = (process.env.CONTROL_PLANE_TRUSTED_HOSTS ?? '127.0.0.1,localhost')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const webhookRateLimit = new FixedWindowRateLimiter(
  Number(process.env.CONTROL_PLANE_WEBHOOK_RATE_LIMIT ?? 60),
  60_000,
)

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function headers(response: ServerResponse): void {
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Referrer-Policy', 'no-referrer')
}

function send(response: ServerResponse, status: number, body: unknown): void {
  headers(response)
  response.statusCode = status
  response.end(JSON.stringify(body))
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
  if (!bodyWithinLimit(headerValue(request.headers['content-length']))) throw new Error('payload too large')
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxBodyBytes) throw new Error('payload too large')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

const server = createServer(async (request, response) => {
  try {
    const method = request.method ?? 'GET'
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

    if (!isTrustedHost(headerValue(request.headers.host), trustedHosts)) {
      send(response, 400, { error: 'untrusted host' })
      return
    }

    if (method === 'GET' && url.pathname === '/health') {
      send(response, 200, { ok: true, service: 'control-plane', events: await outbox.size() })
      return
    }

    if (method === 'GET' && url.pathname === '/api/events') {
      if (!adminToken || !safeEqual(readBearerToken(request.headers.authorization), adminToken)) {
        send(response, 401, { error: 'unauthorized' })
        return
      }
      const rawLimit = Number(url.searchParams.get('limit') ?? 50)
      const limit = Number.isSafeInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50
      send(response, 200, { events: await outbox.recent(limit) })
      return
    }

    if (method === 'POST' && url.pathname === '/webhooks/github') {
      const remoteAddress = request.socket.remoteAddress ?? 'unknown'
      if (!webhookRateLimit.allow(remoteAddress)) {
        send(response, 429, { error: 'rate limit exceeded' })
        return
      }
      const body = await readBody(request)
      if (!verifyGithubSignature(body, headerValue(request.headers['x-hub-signature-256']), webhookSecret)) {
        send(response, 401, { error: 'invalid signature' })
        return
      }
      if (!headerValue(request.headers['content-type'])?.startsWith('application/json')) {
        send(response, 415, { error: 'application/json required' })
        return
      }
      let payload: unknown
      try {
        payload = JSON.parse(body.toString('utf8'))
      } catch {
        send(response, 400, { error: 'invalid JSON' })
        return
      }
      const deliveryId = headerValue(request.headers['x-github-delivery'])
      if (!isValidGithubDelivery(deliveryId)) {
        send(response, 400, { error: 'valid GitHub delivery id required' })
        return
      }
      const event = normalizeGithubWebhook(
        headerValue(request.headers['x-github-event']),
        deliveryId,
        payload,
      )
      const accepted = await outbox.append(event)
      send(response, accepted ? 202 : 200, { accepted, event_id: event.id })
      return
    }

    send(response, 404, { error: 'not found' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'request failed'
    send(response, message === 'payload too large' ? 413 : 500, {
      error: message === 'payload too large' ? message : 'internal error',
    })
  }
})

server.listen(port, host, () => {
  console.log(`control-plane listening on ${host}:${port}`)
})
