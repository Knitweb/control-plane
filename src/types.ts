export type EventType =
  | 'github.issue.updated'
  | 'github.pull_request.updated'
  | 'github.workflow.completed'
  | 'agent.task.updated'
  | 'evidence.recorded'
  | 'adapter.health.updated'

export interface ProvenanceRef {
  uri: string
  sha?: string
}

export interface ControlEvent<T = unknown> {
  schema: 'knitweb.control.event/v1'
  id: string
  type: EventType
  occurred_at: string
  source: {
    system: string
    repository?: string
    ref?: string
  }
  subject: {
    kind: string
    id: string
  }
  payload: T
  correlation_id?: string
  idempotency_key: string
  provenance: ProvenanceRef[]
}

export interface EventStore {
  append(event: ControlEvent): Promise<boolean>
  recent(limit: number): Promise<ControlEvent[]>
  size(): Promise<number>
}
