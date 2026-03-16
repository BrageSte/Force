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

    useLiveStore.getState().startRecording('Right')
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

  it('maps left-hand channel order into canonical finger order before live display and recording', async () => {
    resetAllStores({ inputMode: 'MODE_KG_DIRECT', smoothingMode: 'NONE' })
    useAppStore.getState().setHand('Left')

    const source = new FakeSource()
    await pipeline.connect(source)

    useLiveStore.getState().startRecording('Left')
    source.emit({ tMs: 0, values: [1, 2, 3, 4] })

    const live = useLiveStore.getState()
    expect(live.latestChannelRaw).toEqual([1, 2, 3, 4])
    expect(live.latestRaw).toEqual([4, 3, 2, 1])
    expect(live.latestMeasuredKg).toEqual([4, 3, 2, 1])
    expect(live.recordedSamples[0]?.raw).toEqual([4, 3, 2, 1])
    expect(live.recordedSamples[0]?.kg).toEqual([4, 3, 2, 1])
  })

  it('uses the measurement hand override for guided capture mappings', async () => {
    resetAllStores({ inputMode: 'MODE_KG_DIRECT', smoothingMode: 'NONE' })
    useAppStore.getState().setHand('Right')
    useLiveStore.getState().setMeasurementHandOverride('Left')

    const source = new FakeSource()
    await pipeline.connect(source)
    source.emit({ tMs: 0, values: [5, 6, 7, 8] })

    expect(useLiveStore.getState().latestMeasuredKg).toEqual([8, 7, 6, 5])
  })

  it('applies a new hand mapping on the very first sample after a hand switch', async () => {
    resetAllStores({ inputMode: 'MODE_KG_DIRECT', smoothingMode: 'NONE' })
    useAppStore.getState().setHand('Right')

    const source = new FakeSource()
    await pipeline.connect(source)

    useLiveStore.getState().setMeasurementHandOverride('Left')
    source.emit({ tMs: 0, values: [1, 2, 3, 4] })
    expect(useLiveStore.getState().latestMeasuredKg).toEqual([4, 3, 2, 1])

    useLiveStore.getState().setMeasurementHandOverride('Right')
    source.emit({ tMs: 20, values: [10, 20, 30, 40] })

    expect(useLiveStore.getState().latestMeasuredKg).toEqual([10, 20, 30, 40])
  })

  it('routes tare through the shared device command workflow', async () => {
    resetAllStores()
    const source = new FakeSource()

    await pipeline.connect(source)

    sendTareCommand()

    expect(source.commands).toEqual(['t'])
    expect(useDeviceStore.getState().statusMessages.at(-1)).toBe('Tare command sent')
  })
})
