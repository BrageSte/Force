import { describe, expect, it } from 'vitest'
import { analyzeEffortSamples, DEFAULT_ANALYSIS_CONFIG } from '../analytics/metrics.ts'
import type { Finger4, ForceSample } from '../types/force.ts'

function sample(tMs: number, kg: number | Finger4): ForceSample {
  const values = typeof kg === 'number'
    ? ([kg / 4, kg / 4, kg / 4, kg / 4] as Finger4)
    : kg

  return {
    tMs,
    raw: values,
    kg: values,
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

    expect(driftyMetrics.distributionDriftPerS).toBeGreaterThan(stableMetrics.distributionDriftPerS)
    expect(driftyMetrics.steadinessTotalKg).toBeGreaterThanOrEqual(stableMetrics.steadinessTotalKg)
    expect(driftyMetrics.loadVariationCv).toBeGreaterThan(stableMetrics.loadVariationCv)
  })
})
