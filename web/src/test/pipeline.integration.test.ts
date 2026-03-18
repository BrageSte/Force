import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DeviceStreamMode, ForceSample } from '@krimblokk/core'
import { pipeline } from '../pipeline/SamplePipeline.ts'
import { sendTareCommand } from '../live/sessionWorkflow.ts'
import { useAppStore } from '../stores/appStore.ts'
import { useDeviceStore } from '../stores/deviceStore.ts'
import { useLiveStore } from '../stores/liveStore.ts'
import { useVerificationStore } from '../stores/verificationStore.ts'
import type { DataSource, DeviceConnectionState, DeviceError, DeviceFrame, DeviceProvider, DeviceScanResult } from '../types/device.ts'
import type { AcquisitionSample } from '../types/force.ts'
import { resetAllStores } from './testUtils.ts'
import { defaultConnectedDevice } from '../device/deviceProfiles.ts'

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

  emitStatus(message: string): void {
    this.onStatus?.(message)
  }
}

class FakeTindeqProvider implements DeviceProvider {
  readonly displayName = 'Tindeq Progressor'
  readonly sourceKind = 'Tindeq'

  onForceData: ((frame: DeviceFrame) => void) | null = null
  onConnectionStateChange: ((state: DeviceConnectionState, device: ReturnType<typeof defaultConnectedDevice> | null) => void) | null = null
  onStatus: ((message: string) => void) | null = null
  onError: ((error: DeviceError) => void) | null = null

  async scanDevices(): Promise<DeviceScanResult[]> {
    return []
  }

  async connect(): Promise<void> {
    this.onConnectionStateChange?.('connected', defaultConnectedDevice('Tindeq'))
  }

  async disconnect(): Promise<void> {
    this.onConnectionStateChange?.('idle', null)
  }

  async tare(): Promise<void> {}
  async startStreaming(): Promise<void> {}
  async stopStreaming(): Promise<void> {}
  async getBatteryStatus(): Promise<number | null> {
    return null
  }

  isConnected(): boolean {
    return true
  }

  getConnectedDevice() {
    return defaultConnectedDevice('Tindeq')
  }

  emit(sample: ForceSample): void {
    this.onForceData?.({
      kind: 'force',
      sample,
    })
  }
}

afterEach(() => {
  pipeline.disconnect()
})

describe('sample pipeline integration', () => {
  it('stays in checking until firmware mode is confirmed and only records verified samples', async () => {
    resetAllStores({ inputMode: 'MODE_KG_DIRECT', smoothingMode: 'NONE' })
    useDeviceStore.getState().setSourceKind('Serial')

    const source = new FakeSource()
    await pipeline.connect(source)

    expect(useVerificationStore.getState().snapshot.status).toBe('checking')

    useLiveStore.getState().startRecording('Right')
    source.emit({ tMs: 0, values: [12, 10, 8, 6] })

    expect(useLiveStore.getState().recordedSamples).toHaveLength(0)

    source.emitStatus('mode kg')
    source.emit({ tMs: 20, values: [12, 10, 8, 6] })

    expect(useVerificationStore.getState().snapshot.status).toBe('verified')
    expect(useLiveStore.getState().recordedSamples).toHaveLength(1)
  })

  it('times out if firmware does not confirm the requested mode', async () => {
    vi.useFakeTimers()
    resetAllStores({ inputMode: 'MODE_KG_DIRECT' })
    useDeviceStore.getState().setSourceKind('Serial')

    const source = new FakeSource()
    await pipeline.connect(source)

    await vi.advanceTimersByTimeAsync(2_500)

    expect(useVerificationStore.getState().snapshot.status).toBe('critical')
    expect(useVerificationStore.getState().blockReason).toContain('Timed out')

    vi.useRealTimers()
  })

  it('auto-switches to raw and recovers once raw mode is confirmed', async () => {
    resetAllStores({ inputMode: 'MODE_KG_DIRECT' })
    useDeviceStore.getState().setSourceKind('Serial')

    const source = new FakeSource()
    await pipeline.connect(source)

    source.emitStatus('mode kg')

    useLiveStore.getState().startRecording('Right')
    source.emit({ tMs: 0, values: [200000, 180000, 160000, 150000] })

    expect(useVerificationStore.getState().snapshot.status).toBe('checking')

    source.emitStatus('mode raw')
    source.emit({ tMs: 20, values: [200100, 180100, 160100, 150100] })

    expect(useAppStore.getState().settings.inputMode).toBe('MODE_RAW')
    expect(source.streamModes).toContain('raw')
    expect(useVerificationStore.getState().snapshot.status).toBe('verified')
    expect(useLiveStore.getState().recordedSamples).toHaveLength(1)
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
    source.emitStatus('mode kg')

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
    source.emitStatus('mode kg')
    source.emit({ tMs: 0, values: [5, 6, 7, 8] })

    expect(useLiveStore.getState().latestMeasuredKg).toEqual([8, 7, 6, 5])
  })

  it('applies a new hand mapping on the very first sample after a hand switch', async () => {
    resetAllStores({ inputMode: 'MODE_KG_DIRECT', smoothingMode: 'NONE' })
    useAppStore.getState().setHand('Right')

    const source = new FakeSource()
    await pipeline.connect(source)
    source.emitStatus('mode kg')

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

  it('aborts recording when tare becomes required', async () => {
    resetAllStores({ inputMode: 'MODE_KG_DIRECT', smoothingMode: 'NONE' })
    useDeviceStore.getState().setSourceKind('Serial')

    const source = new FakeSource()
    await pipeline.connect(source)
    source.emitStatus('mode kg')

    useLiveStore.getState().startRecording('Right')
    source.emit({ tMs: 0, values: [4, 3, 2, 1] })
    expect(useLiveStore.getState().recordedSamples).toHaveLength(1)

    source.emit({ tMs: 20, values: [-10, -10, -10, -10] })

    expect(useVerificationStore.getState().snapshot.status).toBe('critical')
    expect(useLiveStore.getState().recording).toBe(false)
    expect(useLiveStore.getState().recordedSamples).toHaveLength(0)
  })

  it('verifies total-force-only Tindeq samples without per-finger data', async () => {
    resetAllStores({ preferredSource: 'Tindeq' })
    useDeviceStore.getState().setSourceKind('Tindeq')

    const provider = new FakeTindeqProvider()
    await pipeline.connect(provider)

    provider.emit({
      tMs: 0,
      source: 'tindeq',
      raw: null,
      kg: null,
      totalKg: 34.5,
      totalN: 34.5 * 9.80665,
      stability: null,
    })

    expect(useVerificationStore.getState().snapshot.status).toBe('verified')
    expect(useLiveStore.getState().latestKg).toBeNull()
    expect(useLiveStore.getState().latestTotalKg).toBeCloseTo(34.5, 5)
  })
})
