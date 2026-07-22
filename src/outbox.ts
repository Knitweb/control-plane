import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { ControlEvent, EventStore } from './types.js'

export class JsonlOutbox implements EventStore {
  private readonly seen = new Set<string>()
  private readonly events: ControlEvent[] = []
  private loaded = false

  constructor(private readonly filePath: string) {}

  private async load(): Promise<void> {
    if (this.loaded) return
    this.loaded = true
    try {
      const content = await readFile(this.filePath, 'utf8')
      for (const line of content.split('\n')) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line) as ControlEvent
          if (event.idempotency_key && !this.seen.has(event.idempotency_key)) {
            this.seen.add(event.idempotency_key)
            this.events.push(event)
          }
        } catch {
          // Ignore a malformed trailing line; the append-only log remains usable.
        }
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  async append(event: ControlEvent): Promise<boolean> {
    await this.load()
    if (this.seen.has(event.idempotency_key)) return false
    await mkdir(dirname(this.filePath), { recursive: true })
    await appendFile(this.filePath, `${JSON.stringify(event)}\n`, { mode: 0o600 })
    this.seen.add(event.idempotency_key)
    this.events.push(event)
    return true
  }

  async recent(limit: number): Promise<ControlEvent[]> {
    await this.load()
    return this.events.slice(Math.max(0, this.events.length - limit)).reverse()
  }

  async size(): Promise<number> {
    await this.load()
    return this.events.length
  }
}
