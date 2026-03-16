import { describe, expect, it } from 'vitest'
import { computeContributionDriftPctFromFingerPctSeries, type Finger4 } from '@krimblokk/core'
import { TINDEQ_CAPABILITIES } from '../device/deviceProfiles.ts'
import {
  availableCustomDashboardMetrics,
  buildQuickMeasureResult,
} from '../live/quickMeasure.ts'
import type { ForceSample } from '../types/force.ts'

function sample(tMs: number, kg: Finger4): ForceSample {
  const totalKg = kg[0] + kg[1] + kg[2] + kg[3]
  return {
    tMs,
    source: 'native-bs',
    raw: kg,
    kg,
    totalKg,
    totalN: totalKg * 9.80665,
    stability: null,
  }
}

describe('quick measure analysis', () => {
  it('uses the shared contribution drift helper for 20-second hold captures', () => {
    const samples = Array.from({ length: 21 }, (_, index) =>
      sample(index * 1000, [
        2 + index * 0.08,
        2.8 - index * 0.05,
        1.8 + (index % 2 === 0 ? 0.08 : -0.08),
        1.4 + index * 0.01,
      ]),
    )

    const result = buildQuickMeasureResult({
      presetId: 'drift_hold_20s',
      samples,
      analysisConfig: {
        tutThresholdKg: 0.5,
        holdPeakFraction: 0.9,
        stabilizationShiftThreshold: 0.8,
        stabilizationHoldMs: 250,
      },
      completionReason: 'duration_complete',
    })

    expect(result).not.toBeNull()
    expect(result?.contributionDriftPct).toEqual(
      computeContributionDriftPctFromFingerPctSeries(result?.analysis.detailFingerPct ?? []),
    )
    expect(result?.contributionDriftPct?.[0] ?? 0).toBeGreaterThan(0)
    expect(result?.contributionDriftPct?.[1] ?? 0).toBeLessThan(0)
  })

  it('filters custom dashboard metrics for total-force-only devices', () => {
    const metrics = availableCustomDashboardMetrics(TINDEQ_CAPABILITIES)

    expect(metrics.map(metric => metric.id)).toContain('live_total')
    expect(metrics.map(metric => metric.id)).not.toContain('live_per_finger')
    expect(metrics.map(metric => metric.id)).not.toContain('running_peak_per_finger')
    expect(metrics.map(metric => metric.id)).not.toContain('current_share_pct')
  })
})
