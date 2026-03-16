import { describe, expect, it } from 'vitest'
import { analyzeEffortSamples, DEFAULT_ANALYSIS_CONFIG } from '../analytics/metrics.ts'
import type { Finger4, ForceSample } from '../types/force.ts'

function sample(tMs: number, kg: number | Finger4): ForceSample {
  const values = typeof kg === 'number'
    ? ([kg / 4, kg / 4, kg / 4, kg / 4] as Finger4)
    : kg

  return {
    tMs,
    source: 'native-bs',
    raw: values,
    kg: values,
    totalKg: values[0] + values[1] + values[2] + values[3],
    totalN: (values[0] + values[1] + values[2] + values[3]) * 9.80665,
    stability: null,
  }
}

describe('metrics parity with reference expectations', () => {
  it('interpolates rfd at low sample rate', () => {
    const effort = [
      sample(0, 0),
      sample(100, 2),
      sample(200, 4),
      sample(300, 6),
      sample(400, 8),
      sample(500, 8),
      sample(600, 8),
    ]

    const metrics = analyzeEffortSamples(effort, 1, DEFAULT_ANALYSIS_CONFIG)

    expect(metrics.rfd100KgS).toBeGreaterThanOrEqual(18)
    expect(metrics.rfd100KgS).toBeLessThanOrEqual(22)
    expect(metrics.rfd200KgS).toBeGreaterThanOrEqual(18)
    expect(metrics.rfd200KgS).toBeLessThanOrEqual(22)
    expect(metrics.rfd100NS).toBeGreaterThan(metrics.rfd100KgS)
  })

  it('detects dominant finger switches and load shift rate', () => {
    const samples: ForceSample[] = []
    let tMs = 0

    for (let i = 0; i < 6; i += 1) {
      samples.push(sample(tMs, [4, 3, 2, 1]))
      tMs += 100
    }
    for (let i = 0; i < 6; i += 1) {
      samples.push(sample(tMs, [2, 5, 2, 1]))
      tMs += 100
    }

    const metrics = analyzeEffortSamples(samples, 1, DEFAULT_ANALYSIS_CONFIG)

    expect(metrics.dominantSwitchCount).toBe(1)
    expect(metrics.loadShiftRate).toBeGreaterThan(0)
    expect(metrics.stabilizationTimeS).not.toBeNull()
  })

  it('separates stable holds from drifty holds', () => {
    const stable = Array.from({ length: 25 }, (_, index) => sample(index * 100, [3, 3, 2.5, 1.5]))
    const drifty = Array.from({ length: 25 }, (_, index) =>
      sample(index * 100, [
        2 + index * 0.06,
        3.8 - index * 0.04,
        2.1 + (index % 2 === 0 ? 0.15 : -0.15),
        1.4 + index * 0.02,
      ]),
    )

    const stableMetrics = analyzeEffortSamples(stable, 1, DEFAULT_ANALYSIS_CONFIG)
    const driftyMetrics = analyzeEffortSamples(drifty, 2, DEFAULT_ANALYSIS_CONFIG)

    expect(driftyMetrics.distributionDriftPerS ?? 0).toBeGreaterThan(stableMetrics.distributionDriftPerS ?? 0)
    expect(driftyMetrics.steadinessTotalKg).toBeGreaterThanOrEqual(stableMetrics.steadinessTotalKg)
    expect(driftyMetrics.loadVariationCv ?? 0).toBeGreaterThan(stableMetrics.loadVariationCv ?? 0)
  })

  it('returns null per-finger metrics for total-force-only samples', () => {
    const samples: ForceSample[] = [
      { tMs: 0, source: 'tindeq', raw: null, kg: null, totalKg: 0, totalN: 0 },
      { tMs: 100, source: 'tindeq', raw: null, kg: null, totalKg: 10, totalN: 98.0665 },
      { tMs: 200, source: 'tindeq', raw: null, kg: null, totalKg: 12, totalN: 117.6798 },
      { tMs: 300, source: 'tindeq', raw: null, kg: null, totalKg: 11, totalN: 107.8732 },
    ]

    const metrics = analyzeEffortSamples(samples, 1, DEFAULT_ANALYSIS_CONFIG)

    expect(metrics.peakTotalKg).toBe(12)
    expect(metrics.peakPerFingerKg).toBeNull()
    expect(metrics.fingerImbalanceIndex).toBeNull()
    expect(metrics.detailFingerKg).toBeNull()
    expect(metrics.detailFingerPct).toBeNull()
  })
})
