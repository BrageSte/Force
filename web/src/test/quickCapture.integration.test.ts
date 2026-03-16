import { afterEach, describe, expect, it } from 'vitest'
import type { AcquisitionSample } from '../types/force.ts'
import type { DataSource } from '../types/device.ts'
import { pipeline } from '../pipeline/SamplePipeline.ts'
import { useAppStore } from '../stores/appStore.ts'
import { useDeviceStore } from '../stores/deviceStore.ts'
import { useLiveStore } from '../stores/liveStore.ts'
import { resetAllStores } from './testUtils.ts'

class MockSource implements DataSource {
  onSample: ((sample: AcquisitionSample) => void) | null = null
  onStatus: ((message: string) => void) | null = null
  onConnectionChange: ((connected: boolean) => void) | null = null

  private running = false

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

  emitValues(tMs: number, values: [number, number, number, number]): void {
    this.onSample?.({ tMs, values })
  }
}

afterEach(() => {
  pipeline.disconnect()
})

describe('quick capture integration', () => {
  it('arms on the next pull and completes after the effort ends without creating a session', async () => {
    resetAllStores({
      smoothingMode: 'NONE',
      startThresholdKg: 0.5,
      stopThresholdKg: 0.2,
      startHoldMs: 0,
      stopHoldMs: 0,
    })
    pipeline.reconfigure()

    const source = new MockSource()
    await pipeline.connect(source)

    useLiveStore.getState().setQuickMeasurePreset('peak_total_pull')
    useLiveStore.getState().armQuickCapture('peak_total_pull', 'Right')

    source.emitValues(0, [0, 0, 0, 0])
    source.emitValues(100, [1, 1, 1, 1])
    source.emitValues(200, [2, 2, 2, 2])
    source.emitValues(300, [1.2, 1.2, 1.2, 1.2])
    source.emitValues(400, [0, 0, 0, 0])
    source.emitValues(500, [0, 0, 0, 0])

    const live = useLiveStore.getState()

    expect(live.quickCapture.status).toBe('idle')
    expect(live.quickResult?.presetId).toBe('peak_total_pull')
    expect(live.quickResult?.completionReason).toBe('effort_complete')
    expect(live.quickResult?.peakTotalKg ?? 0).toBeGreaterThan(4)
    expect(useAppStore.getState().sessions).toHaveLength(0)
  })

  it('auto-stops 20-second drift holds and keeps quick results local to LIVE', async () => {
    resetAllStores({
      smoothingMode: 'NONE',
      startThresholdKg: 0.5,
      stopThresholdKg: 0.2,
      startHoldMs: 0,
      stopHoldMs: 0,
    })
    pipeline.reconfigure()

    const source = new MockSource()
    await pipeline.connect(source)

    useLiveStore.getState().setQuickMeasurePreset('drift_hold_20s')
    useLiveStore.getState().armQuickCapture('drift_hold_20s', 'Right')

    for (let second = 0; second <= 21; second += 1) {
      source.emitValues(second * 1000, [
        2 + second * 0.1,
        2.8 - second * 0.06,
        1.7 + (second % 2 === 0 ? 0.1 : -0.1),
        1.3 + second * 0.02,
      ])
    }

    const live = useLiveStore.getState()

    expect(live.quickCapture.status).toBe('idle')
    expect(live.quickResult?.presetId).toBe('drift_hold_20s')
    expect(live.quickResult?.completionReason).toBe('duration_complete')
    expect(live.quickResult?.durationS).toBeCloseTo(20, 1)
    expect(live.quickResult?.contributionDriftPct?.[0] ?? 0).toBeGreaterThan(0)
    expect(live.quickResult?.contributionDriftPct?.[1] ?? 0).toBeLessThan(0)
    expect(useAppStore.getState().sessions).toHaveLength(0)
    expect(useDeviceStore.getState().statusMessages.at(-1)).toContain('20-second capture complete')
  })
})
