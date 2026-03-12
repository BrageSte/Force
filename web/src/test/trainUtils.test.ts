import { describe, expect, it } from 'vitest'
import { getProtocolById } from '../components/test/testLibrary.ts'
import type { CompletedTestResult } from '../components/test/types.ts'
import { getTrainProtocolById } from '../components/train/trainLibrary.ts'
import { buildTrainSummary, buildTrainTimeline, formatGripSpec, resolveTrainTarget } from '../components/train/trainUtils.ts'

function createStandardMaxResult(hand: 'Left' | 'Right', peakTotalKg: number, completedAtIso: string): CompletedTestResult {
  const protocol = getProtocolById('standard_max')

  return {
    resultId: `result_${hand}_${completedAtIso}`,
    protocolKind: 'builtin',
    protocolId: 'standard_max',
    protocolName: protocol.name,
    builtInId: 'standard_max',
    tier: protocol.tier,
    hand,
    startedAtIso: completedAtIso,
    completedAtIso,
    profile: {
      profileId: 'profile_1',
      name: 'Test Person',
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
      intervalMode: 'continuous',
    },
    attempts: [
      {
        attemptNo: 1,
        durationS: 10,
        samples: [],
        core: {
          peakTotalKg,
          peakPerFingerKg: [peakTotalKg / 4, peakTotalKg / 4, peakTotalKg / 4, peakTotalKg / 4],
          fingerShareAtPeakPct: [25, 25, 25, 25],
          averageForceKg: peakTotalKg - 4,
          best3sMeanKg: peakTotalKg - 2,
          fullTestMeanKg: peakTotalKg - 5,
          impulseKgS: 120,
          impulseNs: 1177,
          forceDriftKgS: -0.3,
          earlyLateDropPct: -3,
        },
        coaching: {
          contributionDriftPct: [0, 0, 0, 0],
          fatigueSlopePerFingerKgS: [0, 0, 0, 0],
          takeoverFinger: 0,
          fadeFinger: 0,
          stabilityErrorPct: null,
          fingerVariabilityPct: [0, 0, 0, 0],
          balanceScore: 100,
          fingerInitiationOrder: [0, 1, 2, 3],
          fingerDropoutOrder: [3, 2, 1, 0],
          compensationMapping: ['No dominant compensation pattern detected.'],
          fingerSynergyScore: 90,
          redistributionScore: 2,
          underRecruitmentFlags: [false, false, false, false],
        },
        advanced: {
          effortClass: 'max',
          rfd100KgS: 140,
          rfd200KgS: 110,
          fatigueIndex: 3,
          forceDriftKgS: -0.3,
          fingerAsymmetryPct: 0,
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
      weakestContributor: 0,
      biggestFadeFinger: 0,
      takeoverFinger: 0,
      mostStableFinger: 0,
      repeatabilityScore: 100,
      leftRightAsymmetryPct: null,
      sessionTrendPct: 0,
      tacticalGripProfile: 'balanced',
      benchmarkScore: null,
      normalizedPeakKgPerKgBodyweight: peakTotalKg / 70,
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

describe('train utilities', () => {
  it('builds the expected work and rest timeline for repeater-style workouts', () => {
    const protocol = getTrainProtocolById('strength_endurance_repeaters')
    const timeline = buildTrainTimeline(protocol.blocks)

    expect(timeline[0]).toMatchObject({ kind: 'work', blockPhase: 'warmup', setNo: 1, repNo: 1, durationSec: 5 })
    expect(timeline.at(-1)).toMatchObject({ kind: 'work', blockPhase: 'main', setNo: 4, repNo: 6, durationSec: 7 })
    expect(timeline.some(step => step.kind === 'set_rest')).toBe(true)
  })

  it('resolves auto-target from the latest standard max for the active hand', () => {
    const protocol = getTrainProtocolById('strength_10s')
    const results = [
      createStandardMaxResult('Right', 62, '2026-03-10T10:00:00.000Z'),
      createStandardMaxResult('Right', 68, '2026-03-11T10:00:00.000Z'),
      createStandardMaxResult('Left', 54, '2026-03-11T10:00:00.000Z'),
    ]

    const resolution = resolveTrainTarget(protocol, results, 'Right', results[0].profile)

    expect(resolution.mode).toBe('auto_from_latest_test')
    expect(resolution.sourceMaxKg).toBeCloseTo(68)
    expect(resolution.targetKg).toBeCloseTo(57.8)
  })

  it('falls back to bodyweight-relative targeting and computes trend summaries', () => {
    const protocol = getTrainProtocolById('health_capacity_density')
    const resolution = resolveTrainTarget(protocol, [], 'Left', {
      profileId: 'profile_1',
      name: 'Test Person',
      sex: 'Unspecified',
      weightKg: 70,
      heightCm: 180,
      dominantHand: 'Right',
      injuredFingers: [false, false, false, false],
      injuryNotes: '',
      notes: '',
    })

    expect(resolution.mode).toBe('manual')

    const summary = buildTrainSummary(
      protocol,
      [
        {
          setNo: 1,
          repNo: 1,
          plannedHangSec: 20,
          actualHangS: 18,
          peakTotalKg: 32,
          avgHoldKg: 29,
          impulseKgS: 520,
          adherencePct: 88,
          samples: [],
        },
      ],
      {
        trainSessionId: 'previous',
        workoutId: protocol.id,
        workoutKind: 'builtin',
        profile: null,
        presetId: protocol.id,
        presetName: protocol.name,
        category: protocol.category,
        athleteLevel: protocol.athleteLevel,
        sourceBasis: protocol.sourceBasis,
        hand: 'Left',
        gripType: protocol.gripType,
        modality: protocol.modality,
        gripSpec: formatGripSpec(protocol.gripType, protocol.modality),
        startedAtIso: '2026-03-01T10:00:00.000Z',
        completedAtIso: '2026-03-01T10:30:00.000Z',
        targetMode: 'manual',
        targetKg: 30,
        sourceMaxKg: null,
        bodyweightRelativeTarget: null,
        benchmarkSourceId: protocol.benchmarkSourceId,
        benchmarkSourceLabel: protocol.benchmarkSourceLabel,
        recommendationReason: 'Previous workout',
        recommendationRationale: ['Baseline'],
        tacticalGripProfile: 'balanced',
        blocks: protocol.blocks,
        reps: [],
        summary: {
          plannedReps: 16,
          completedReps: 16,
          completionPct: 100,
          totalTutS: 320,
          peakTotalKg: 30,
          avgHoldKg: 27,
          avgImpulseKgS: 500,
          adherencePct: 80,
          sessionTrendPct: null,
          safetyFlags: [],
        },
        sessionComparison: null,
        notes: '',
      },
      30,
    )

    expect(summary.completedReps).toBe(1)
    expect(summary.sessionTrendPct).toBeCloseTo(((32 - 30) / 30) * 100)
    expect(summary.avgImpulseKgS).toBeCloseTo(520)
  })
})
