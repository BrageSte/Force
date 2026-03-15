import { describe, expect, it, vi } from 'vitest'
import { WebSerialSource } from '../device/WebSerialSource.ts'
import type { AcquisitionSample } from '../types/force.ts'

class FakeWriter {
  private readonly owner: FakeWritable
  private readonly onWrite: (chunk: Uint8Array) => Promise<void>

  constructor(owner: FakeWritable, onWrite: (chunk: Uint8Array) => Promise<void>) {
    this.owner = owner
    this.onWrite = onWrite
  }

  async write(chunk: Uint8Array): Promise<void> {
    await this.onWrite(chunk)
  }

  releaseLock(): void {
    this.owner.locked = false
  }
}

class FakeWritable {
  locked = false
  private readonly onWrite: (chunk: Uint8Array) => Promise<void>

  constructor(onWrite: (chunk: Uint8Array) => Promise<void>) {
    this.onWrite = onWrite
  }

  getWriter(): WritableStreamDefaultWriter<Uint8Array> {
    if (this.locked) {
      throw new TypeError("Failed to execute 'getWriter' on 'WritableStream': Cannot create writer when WritableStream is locked")
    }

    this.locked = true
    return new FakeWriter(this, this.onWrite) as unknown as WritableStreamDefaultWriter<Uint8Array>
  }
}

const flushMicrotasks = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('WebSerialSource', () => {
  it('queues serial commands so a second writer is not requested while the first is locked', async () => {
    const chunks: string[] = []
    let releaseFirstWrite: (() => void) | undefined

    const writable = new FakeWritable(chunk => {
      chunks.push(new TextDecoder().decode(chunk))

      if (chunks.length === 1) {
        return new Promise<void>(resolve => {
          releaseFirstWrite = resolve
        })
      }

      return Promise.resolve()
    })

    const source = new WebSerialSource()
    ;(source as unknown as { port: SerialPort; running: boolean }).port = {
      readable: null,
      writable: writable as unknown as WritableStream<Uint8Array>,
      async open() {},
      async close() {},
    }
    ;(source as unknown as { port: SerialPort; running: boolean }).running = true

    expect(() => {
      source.sendCommand('m kg')
      source.sendCommand('t')
    }).not.toThrow()

    await flushMicrotasks()
    expect(chunks).toEqual(['m kg\n'])

    if (releaseFirstWrite) {
      releaseFirstWrite()
    }
    await flushMicrotasks()

    expect(chunks).toEqual(['m kg\n', 't\n'])
  })

  it('connects, reads status/sample lines, and accepts a follow-up command after startup', async () => {
    const writes: string[] = []
    const statuses: string[] = []
    const samples: AcquisitionSample[] = []
    const connectionChanges: boolean[] = []
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const port: SerialPort = {
      readable: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('# boot ok\n# mode raw\n123,1,2,3,4\n'))
          controller.close()
        },
      }),
      writable: new WritableStream<Uint8Array>({
        async write(chunk) {
          writes.push(decoder.decode(chunk))
        },
      }),
      open: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    }

    Object.defineProperty(navigator, 'serial', {
      configurable: true,
      value: {
        requestPort: vi.fn(async () => port),
      },
    })

    const source = new WebSerialSource(115200, 'MODE_KG_DIRECT')
    ;(source as unknown as { waitForBootWindow: () => Promise<void> }).waitForBootWindow = async () => {}
    source.onStatus = message => statuses.push(message)
    source.onSample = sample => samples.push(sample)
    source.onConnectionChange = connected => connectionChanges.push(connected)

    await source.start()
    source.sendCommand('t')
    await flushMicrotasks()

    expect(connectionChanges).toContain(true)
    expect(statuses).toContain('Serial connected')
    expect(statuses).toContain('boot ok')
    expect(statuses).toContain('mode raw')
    expect(statuses).toContain('Requested firmware KG mode')
    expect(samples).toEqual([{ tMs: 123, values: [1, 2, 3, 4] }])
    expect(writes).toEqual(['m kg\n', 't\n'])

    source.stop()
    await flushMicrotasks()

    expect(connectionChanges).toContain(false)
  })
})
