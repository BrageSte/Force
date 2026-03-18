import { describe, expect, it } from 'vitest'
import { evaluateVerification, type DeviceCapabilities, type ForceSample } from '@krimblokk/core'

const nativeCapabilities: DeviceCapabilities = {
  totalForce: true,
  perFingerForce: true,
  batteryStatus: false,
  tare: true,
  startStopStreaming: true,
}

const totalOnlyCapabilities: DeviceCapabilities = {
  totalForce: true,
  perFingerForce: false,
  batteryStatus: true,
  tare: true,
  startStopStreaming: true,
}

function nativeSample(totalKg = 20, kg: [number, number, number, number] = [5, 5, 5, 5]): ForceSample {
  return {
    tMs: 100,
    source: 'native-bs',
    raw: kg,
    kg,
    totalKg,
    totalN: totalKg * 9.80665,
    stability: null,
  }
}

describe('verification core', () => {
  it('returns critical when native totals do not match per-finger sum', () => {
    const snapshot = evaluateVerification({
      sample: nativeSample(20, [8, 8, 8, 8]),
      capabilities: nativeCapabilities,
      inputMode: 'MODE_KG_DIRECT',
      confirmedStreamMode: 'kg',
      requestedStreamMode: 'kg',
      requireModeConfirmation: true,
    })

    expect(snapshot.status).toBe('critical')
    expect(snapshot.blockReason).toContain('per-finger sum')
  })

  it('returns critical when total-force-only samples expose per-finger fields', () => {
    const snapshot = evaluateVerification({
      sample: {
        ...nativeSample(18, [4, 4, 5, 5]),
        source: 'tindeq',
      },
      capabilities: totalOnlyCapabilities,
      inputMode: 'MODE_KG_DIRECT',
      requireModeConfirmation: false,
    })

    expect(snapshot.status).toBe('critical')
    expect(snapshot.blockReason).toContain('total-force-only')
  })

  it('returns warning for low sample rate without blocking display', () => {
    const snapshot = evaluateVerification({
      sample: nativeSample(),
      capabilities: nativeCapabilities,
      inputMode: 'MODE_KG_DIRECT',
      confirmedStreamMode: 'kg',
      requestedStreamMode: 'kg',
      requireModeConfirmation: true,
      sampleRateHz: 12,
    })

    expect(snapshot.status).toBe('warning')
    expect(snapshot.findings.some(finding => finding.code === 'sample_rate_low')).toBe(true)
  })

  it('returns critical when tare is required', () => {
    const snapshot = evaluateVerification({
      sample: nativeSample(),
      capabilities: nativeCapabilities,
      inputMode: 'MODE_KG_DIRECT',
      confirmedStreamMode: 'kg',
      requestedStreamMode: 'kg',
      requireModeConfirmation: true,
      tareRequired: true,
    })

    expect(snapshot.status).toBe('critical')
    expect(snapshot.blockReason).toContain('Tare')
  })
})
