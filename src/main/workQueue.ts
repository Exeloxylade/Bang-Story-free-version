/** Admission control with cancellation; pausing retains waiting work. */
export class WorkQueue {
  private active = 0
  private paused = false
  private waiting: { signal: AbortSignal; start: () => void; abort: () => void }[] = []

  constructor(private readonly limit: () => number) {}

  acquire(signal: AbortSignal): Promise<() => void> {
    return new Promise((resolve, reject) => {
      const abort = (): void => {
        this.waiting = this.waiting.filter(item => item !== entry)
        reject(new Error('Canceled'))
      }
      const entry = { signal, abort, start: (): void => {
        signal.removeEventListener('abort', abort)
        this.active++
        let released = false
        resolve(() => {
          if (released) return
          released = true
          this.active--
          this.drain()
        })
      } }
      if (signal.aborted) { reject(new Error('Canceled')); return }
      signal.addEventListener('abort', abort, { once: true })
      this.waiting.push(entry)
      this.drain()
    })
  }

  pause(): void { this.paused = true }
  resume(): void { this.paused = false; this.drain() }

  private drain(): void {
    while (!this.paused && this.active < this.limit() && this.waiting.length) {
      const entry = this.waiting.shift()!
      if (entry.signal.aborted) entry.abort()
      else entry.start()
    }
  }
}
