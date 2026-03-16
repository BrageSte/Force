import { describe, expect, it } from 'vitest'
import { resolveSimulatorAthleteContext } from '../device/simulatorAthlete.ts'
import { createProfile, type UserProfile } from '../types/profile.ts'
import type { CompletedTestResult } from '../components/test/types.ts'

function mockResult(args: {
  protocolId: string
  hand: 'Left' | 'Right'
  completedAtIso: string
  peakKg: number
  weakestContributor?: number
}): CompletedTestResult {
  return {
    resultId: `${args.protocolId}_${args.hand}_${args.completedAtIso}`,
    protocolKind: 'builtin',
    protocolId: args.protocolId,
    protocolName: args.protocolId,
    tier: 'Core',
    hand: args.hand,
    startedAtIso: args.completedAtIso,
    completedAtIso: args.completedAtIso,
    profile: null,
    benchmarkCategory: 'max_strength',
    gripType: 'edge',
    modality: 'edge',
    athleteLevel: 'intermediate',
    targetKg: null,
    effectiveProtocol: {} as CompletedTestResult['effectiveProtocol'],
    dashboardSnapshot: {
      livePanels: [],
      resultWidgets: [],
    },
    compareTags: {
      family: 'max_pull',
      targetMode: 'none',
      intervalMode: 'continuous',
    },
    attempts: [
      {
        attemptNo: 1,
        durationS: 7,
        samples: [],
        core: {
          peakTotalKg: args.peakKg,
          peakPerFingerKg: [args.peakKg * 0.3, args.peakKg * 0.29, args.peakKg * 0.23, args.peakKg * 0.18],
          fingerShareAtPeakPct: [30, 29, 23, 18],
          averageForceKg: args.peakKg * 0.8,
          best3sMeanKg: args.peakKg * 0.75,
          fullTestMeanKg: args.peakKg * 0.7,
          impulseKgS: args.peakKg * 4,
          impulseNs: args.peakKg * 4 * 9.80665,
          forceDriftKgS: 0,
          earlyLateDropPct: 0,
        },
        coaching: {
          contributionDriftPct: [0, 0, 0, 0],
          fatigueSlopePerFingerKgS: [0, 0, 0, 0],
          takeoverFinger: 0,
          fadeFinger: 0,
          stabilityErrorPct: null,
          fingerVariabilityPct: [0, 0, 0, 0],
          balanceScore: 90,
          fingerInitiationOrder: [0, 1, 2, 3],
          fingerDropoutOrder: [3, 2, 1, 0],
          compensationMapping: [],
          fingerSynergyScore: 90,
          redistributionScore: 2,
          underRecruitmentFlags: [false, false, false, false],
        },
        advanced: {
          effortClass: 'max',
          rfd100KgS: 100,
          rfd200KgS: 90,
          fatigueIndex: 0,
          forceDriftKgS: 0,
          fingerAsymmetryPct: 5,
          redistributionScore: 2,
          fingerSynergyScore: 90,
          safetyFlags: [],
        },
        experimental: {
          note: 'test',
        },
      },
    ],
    summary: {
      bestAttemptNo: 1,
      strongestFinger: 0,
      weakestContributor: args.weakestContributor ?? 3,
      biggestFadeFinger: 3,
      takeoverFinger: 0,
      mostStableFinger: 1,
      repeatabilityScore: 90,
      leftRightAsymmetryPct: null,
      sessionTrendPct: 0,
      benchmarkScore: null,
      tacticalGripProfile: 'balanced',
      normalizedPeakKgPerKgBodyweight: null,
      safetyFlags: [],
    },
    sessionComparison: null,
    confidence: {
      core: 'High',
      coaching: 'Moderate',
      experimental: 'Low',
    },
  } as CompletedTestResult
}

describe('resolveSimulatorAthleteContext', () => {
  it('prefers the latest same-hand standard max result and carries weak-finger bias from a per-finger benchmark', () => {
    const profile = createProfile('Demo Athlete')
    profile.benchmarkReferences.standard_max = {
      Left: { manualKg: 31, preferredSource: 'manual' },
      Right: { manualKg: 34, preferredSource: 'manual' },
    }

    const athlete = resolveSimulatorAthleteContext({
      profile,
      results: [
        mockResult({
          protocolId: 'distribution_hold',
          hand: 'Right',
          completedAtIso: '2026-03-15T10:00:00.000Z',
          peakKg: 24,
          weakestContributor: 2,
        }),
        mockResult({
          protocolId: 'standard_max',
          hand: 'Right',
          completedAtIso: '2026-03-16T10:00:00.000Z',
          peakKg: 42,
        }),
      ],
      hand: 'Right',
    })

    expect(athlete.referenceMaxKg).toBe(42)
    expect(athlete.referenceSource).toBe('test')
    expect(athlete.weakFingerIndex).toBe(2)
    expect(athlete.baseFingerShare[2]).toBeLessThan(0.23)
  })

  it('falls back to the manual benchmark reference when no standard max history exists', () => {
    const profile = createProfile('Manual Demo') as UserProfile
    profile.benchmarkReferences.standard_max = {
      Left: { manualKg: 28, preferredSource: 'manual' },
      Right: { manualKg: 33, preferredSource: 'manual' },
    }

    const athlete = resolveSimulatorAthleteContext({
      profile,
      results: [],
      hand: 'Left',
    })

    expect(athlete.referenceMaxKg).toBe(28)
    expect(athlete.referenceSource).toBe('manual')
    expect(athlete.weakFingerIndex).toBeNull()
  })

  it('uses the fallback demo athlete when neither history nor manual references exist', () => {
    const athlete = resolveSimulatorAthleteContext({
      profile: createProfile('Fallback Demo'),
      results: [],
      hand: 'Right',
    })

    expect(athlete.referenceMaxKg).toBe(30)
    expect(athlete.referenceSource).toBe('fallback')
    expect(athlete.baseFingerShare).toEqual([0.3, 0.29, 0.23, 0.18])
  })
})
