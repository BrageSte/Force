import { describe, expect, it } from 'vitest'
import { resolveBenchmarkReference } from '../profile/benchmarkReferences.ts'
import { getProtocolById } from '../components/test/testLibrary.ts'
import { resolveTargetKg } from '../components/test/testProtocolUtils.ts'
import type { CompletedTestResult, TestId } from '../components/test/types.ts'
import { getTrainProtocolById } from '../components/train/trainLibrary.ts'
import { resolveTrainTarget } from '../components/train/trainUtils.ts'

function createResult(args: {
  protocolId: TestId
  hand: 'Left' | 'Right'
  peak: number
  completedAtIso: string
}): CompletedTestResult {
  const protocol = getProtocolById(args.protocolId)

  return {
    resultId: `${args.protocolId}_${args.hand}_${args.completedAtIso}`,
    protocolKind: 'builtin',
    protocolId: args.protocolId,
    protocolName: protocol.name,
    builtInId: args.protocolId,
    tier: protocol.tier,
    hand: args.hand,
    startedAtIso: args.completedAtIso,
    completedAtIso: args.completedAtIso,
    profile: {
      profileId: 'profile_1',
      name: 'Athlete',
      sex: 'Unspecified',
      weightKg: 70,
      heightCm: 180,
      dominantHand: 'Right',
      injuredFingers: [false, false, false, false],
      injuryNotes: '',
      notes: '',
    },
    benchmarkCategory: protocol.category,
    gripType: protocol.gripType,
    modality: protocol.modality,
    athleteLevel: protocol.athleteLevel,
    targetKg: null,
    effectiveProtocol: protocol,
    dashboardSnapshot: {
      livePanels: protocol.livePanels,
      resultWidgets: protocol.resultWidgets,
      compareDefaults: protocol.compareDefaults,
    },
    compareTags: {
      family: protocol.family,
      targetMode: protocol.targetMode,
      intervalMode: protocol.repeater ? 'interval' : 'continuous',
    },
    attempts: [
      {
        attemptNo: 1,
        durationS: protocol.durationSec,
        samples: [],
        core: {
          peakTotalKg: args.peak,
          peakPerFingerKg: [args.peak / 4, args.peak / 4, args.peak / 4, args.peak / 4],
          fingerShareAtPeakPct: [25, 25, 25, 25],
          averageForceKg: args.peak - 4,
          best3sMeanKg: args.peak - 2,
          fullTestMeanKg: args.peak - 5,
          impulseKgS: 100,
          impulseNs: 980,
          forceDriftKgS: -0.2,
          earlyLateDropPct: -5,
        },
        coaching: {
          contributionDriftPct: [0, 0, 0, 0],
          fatigueSlopePerFingerKgS: [0, 0, 0, 0],
          takeoverFinger: 0,
          fadeFinger: 0,
          stabilityErrorPct: null,
          fingerVariabilityPct: [0, 0, 0, 0],
          balanceScore: 85,
          fingerInitiationOrder: [0, 1, 2, 3],
          fingerDropoutOrder: [3, 2, 1, 0],
          compensationMapping: ['No dominant compensation pattern detected.'],
          fingerSynergyScore: 88,
          redistributionScore: 4,
          underRecruitmentFlags: [false, false, false, false],
        },
        advanced: {
          effortClass: protocol.id === 'explosive_pull' ? 'explosive' : 'max',
          rfd100KgS: 120,
          rfd200KgS: 100,
          fatigueIndex: 5,
          forceDriftKgS: -0.2,
          fingerAsymmetryPct: 0,
          redistributionScore: 4,
          fingerSynergyScore: 88,
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
      weakestContributor: 0,
      biggestFadeFinger: 0,
      takeoverFinger: 0,
      mostStableFinger: 0,
      repeatabilityScore: 85,
      leftRightAsymmetryPct: null,
      sessionTrendPct: 0,
      tacticalGripProfile: 'balanced',
      benchmarkScore: null,
      normalizedPeakKgPerKgBodyweight: args.peak / 70,
      safetyFlags: [],
    },
    sessionComparison: null,
    confidence: {
      core: 'High',
      coaching: 'Moderate',
      experimental: 'Low',
    },
  }
}

describe('benchmark references', () => {
  it('prefers the manual profile value when manual is selected', () => {
    const results = [
      createResult({ protocolId: 'standard_max', hand: 'Right', peak: 66, completedAtIso: '2026-03-12T10:00:00.000Z' }),
    ]

    const resolution = resolveBenchmarkReference({
      results,
      profile: {
        benchmarkReferences: {
          standard_max: {
            Left: { manualKg: null, preferredSource: 'test' },
            Right: { manualKg: 72, preferredSource: 'manual' },
          },
        },
      },
      benchmarkId: 'standard_max',
      hand: 'Right',
    })

    expect(resolution.latestTestKg).toBe(66)
    expect(resolution.manualKg).toBe(72)
    expect(resolution.effectiveSource).toBe('manual')
    expect(resolution.activeKg).toBe(72)
    expect(resolution.usedFallback).toBe(false)
  })

  it('falls back to TEST when manual is selected but unset', () => {
    const results = [
      createResult({ protocolId: 'standard_max', hand: 'Right', peak: 66, completedAtIso: '2026-03-12T10:00:00.000Z' }),
    ]

    const resolution = resolveBenchmarkReference({
      results,
      profile: {
        benchmarkReferences: {
          standard_max: {
            Left: { manualKg: null, preferredSource: 'test' },
            Right: { manualKg: null, preferredSource: 'manual' },
          },
        },
      },
      benchmarkId: 'standard_max',
      hand: 'Right',
    })

    expect(resolution.preferredSource).toBe('manual')
    expect(resolution.effectiveSource).toBe('test')
    expect(resolution.activeKg).toBe(66)
    expect(resolution.usedFallback).toBe(true)
  })

  it('uses the active standard max reference for TEST targets', () => {
    const protocol = getProtocolById('repeated_max_7_53')
    const results = [
      createResult({ protocolId: 'standard_max', hand: 'Right', peak: 66, completedAtIso: '2026-03-12T10:00:00.000Z' }),
    ]

    const targetKg = resolveTargetKg(protocol, results, 'Right', {
      profileId: 'profile_1',
      name: 'Athlete',
      sex: 'Unspecified',
      weightKg: 70,
      heightCm: 180,
      dominantHand: 'Right',
      injuredFingers: [false, false, false, false],
      injuryNotes: '',
      notes: '',
      benchmarkReferences: {
        standard_max: {
          Left: { manualKg: null, preferredSource: 'test' },
          Right: { manualKg: 70, preferredSource: 'manual' },
        },
      },
    })

    expect(targetKg).toBeCloseTo(63)
  })

  it('uses the chosen benchmark reference in TRAIN and exposes source info', () => {
    const protocol = getTrainProtocolById('strength_10s')
    const results = [
      createResult({ protocolId: 'standard_max', hand: 'Right', peak: 66, completedAtIso: '2026-03-12T10:00:00.000Z' }),
    ]

    const resolution = resolveTrainTarget(protocol, results, 'Right', {
      profileId: 'profile_1',
      name: 'Athlete',
      sex: 'Unspecified',
      weightKg: 70,
      heightCm: 180,
      dominantHand: 'Right',
      injuredFingers: [false, false, false, false],
      injuryNotes: '',
      notes: '',
      benchmarkReferences: {
        standard_max: {
          Left: { manualKg: null, preferredSource: 'test' },
          Right: { manualKg: 72, preferredSource: 'manual' },
        },
      },
    })

    expect(resolution.mode).toBe('auto_from_latest_test')
    expect(resolution.sourceMaxKg).toBe(72)
    expect(resolution.targetKg).toBeCloseTo(61.2)
    expect(resolution.benchmarkReference?.effectiveSource).toBe('manual')
    expect(resolution.rationale[0]).toContain('manual profile value')
  })
})
