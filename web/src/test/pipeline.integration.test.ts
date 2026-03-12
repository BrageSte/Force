import { afterEach, describe, expect, it } from 'vitest'
import type { DeviceStreamMode } from '@krimblokk/core'
import { pipeline } from '../pipeline/SamplePipeline.ts'
import { sendTareCommand } from '../live/sessionWorkflow.ts'
import { useAppStore } from '../stores/appStore.ts'
import { useDeviceStore } from '../stores/deviceStore.ts'
import { useLiveStore } from '../stores/liveStore.ts'
import type { DataSource } from '../types/device.ts'
import type { AcquisitionSample } from '../types/force.ts'
import { resetAllStores } from './testUtils.ts'

class FakeSource implements DataSource {
  running = false
  commands: string[] = []
  streamModes: DeviceStreamMode[] = []

  onSample: ((sample: AcquisitionSample) => void) | null = null
  onStatus: ((message: string) => void) | null = null
  onConnectionChange: ((connected: boolean) => void) | null = null

  async start(): Promise<void> {
    this.running = true
    this.onConnectionChange?.(true)
  }

  stop(): void {
    this.running = false
    this.onConnectionChange?.(false)
  }

  isRunning(): boolean {
    return this.running
  }

  sendCommand(cmd: string): void {
    this.commands.push(cmd)
  }

  setStreamMode(mode: DeviceStreamMode): void {
    this.streamModes.push(mode)
  }

  emit(sample: AcquisitionSample): void {
    this.onSample?.(sample)
  }
}

afterEach(() => {
  pipeline.disconnect()
})

describe('sample pipeline integration', () => {
  it('connects, auto-switches to raw, and records samples without direct array mutation', async () => {
    resetAllStores({ inputMode: 'MODE_KG_DIRECT' })
    useDeviceStore.getState().setSourceKind('Serial')

    const source = new FakeSource()
    await pipeline.connect(source)

    expect(useDeviceStore.getState().connected).toBe(true)

    useLiveStore.getState().startRecording()
    source.emit({ tMs: 0, values: [200000, 180000, 160000, 150000] })
    source.emit({ tMs: 20, values: [200100, 180100, 160100, 150100] })

    expect(useAppStore.getState().settings.inputMode).toBe('MODE_RAW')
    expect(source.streamModes).toContain('raw')
    expect(useLiveStore.getState().recordedSamples).toHaveLength(2)
    expect(
      useDeviceStore.getState().statusMessages.some(message =>
        message.includes('Switched to MODE_RAW automatically'),
      ),
    ).toBe(true)
  })

  it('routes tare through the shared device command workflow', () => {
    resetAllStores()
    const source = new FakeSource()

    useDeviceStore.setState({
      source,
      connected: true,
      statusMessages: [],
    })

    sendTareCommand()

    expect(source.commands).toEqual(['t'])
    expect(useDeviceStore.getState().statusMessages.at(-1)).toBe('Tare command sent')
  })
})
