import { describe, expect, it } from 'vitest'
import { getProtocolById } from '../components/test/testLibrary.ts'
import { buildTrainRecommendations } from '../components/train/prescriptionEngine.ts'
import type { CompletedTestResult } from '../components/test/types.ts'

function createResult(args: {
  protocolId: 'standard_max' | 'explosive_pull' | 'advanced_repeater'
  hand: 'Left' | 'Right'
  peak: number
  rfd100?: number
  fatigueIndex?: number
  completedAtIso: string
}): CompletedTestResult {
  const protocol = getProtocolById(args.protocolId)
  return {
    resultId: `${args.protocolId}_${args.completedAtIso}`,
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
        durationS: 7,
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
          effortClass: args.protocolId === 'explosive_pull' ? 'explosive' : 'max',
          rfd100KgS: args.rfd100 ?? 140,
          rfd200KgS: 110,
          fatigueIndex: args.fatigueIndex ?? 6,
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
      sessionTrendPct: args.protocolId === 'advanced_repeater' ? -8 : 0,
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

describe('train prescription engine', () => {
  it('prioritizes recruitment work when peak force is high but RFD is low', () => {
    const recommendations = buildTrainRecommendations([
      createResult({ protocolId: 'standard_max', hand: 'Right', peak: 65, completedAtIso: '2026-03-11T10:00:00.000Z' }),
      createResult({ protocolId: 'explosive_pull', hand: 'Right', peak: 35, rfd100: 90, completedAtIso: '2026-03-11T11:00:00.000Z' }),
    ], 'Right')

    expect(recommendations[0]?.workoutId).toBe('recruitment_rfd_clusters')
  })
})
