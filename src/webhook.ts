import { randomUUID } from 'node:crypto'
import type { ControlEvent, EventType } from './types.js'

interface GithubRepository {
  full_name?: unknown
}

interface GithubPayload {
  action?: unknown
  repository?: GithubRepository
  issue?: { number?: unknown }
  pull_request?: { number?: unknown }
  workflow_run?: { id?: unknown; conclusion?: unknown }
  sender?: { login?: unknown }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined
}

export function normalizeGithubWebhook(
  eventName: string | undefined,
  deliveryId: string | undefined,
  payload: unknown,
): ControlEvent {
  const body = payload as GithubPayload
  const repository = stringValue(body.repository?.full_name) ?? 'unknown/unknown'
  const action = stringValue(body.action) ?? 'unknown'
  const name = eventName ?? 'unknown'
  const type: EventType =
    name === 'issues'
      ? 'github.issue.updated'
      : name === 'pull_request'
        ? 'github.pull_request.updated'
        : name === 'workflow_run'
          ? 'github.workflow.completed'
          : 'adapter.health.updated'
  const issueNumber = numberValue(body.issue?.number)
  const pullNumber = numberValue(body.pull_request?.number)
  const workflowId = numberValue(body.workflow_run?.id)
  const subjectId = issueNumber
    ? `${repository}#${issueNumber}`
    : pullNumber
      ? `${repository}#${pullNumber}`
      : workflowId
        ? `${repository}/workflow/${workflowId}`
        : `${repository}/${name}`

  const event: ControlEvent = {
    schema: 'knitweb.control.event/v1',
    id: randomUUID(),
    type,
    occurred_at: new Date().toISOString(),
    source: { system: 'github', repository },
    subject: { kind: name, id: subjectId },
    payload: { action, sender: stringValue(body.sender?.login), raw: payload },
    idempotency_key: `github:${deliveryId ?? `${name}:${repository}:${subjectId}:${action}`}`,
    provenance: [{ uri: `https://github.com/${repository}` }],
  }
  if (deliveryId) event.correlation_id = deliveryId
  return event
}
