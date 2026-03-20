import { describe, expect, it } from 'vitest'
import { buildAiCoachingReport } from '../components/test/aiCoaching.ts'
import { getProtocolById } from '../components/test/testLibrary.ts'
import type { CompletedTestResult, TestId } from '../components/test/types.ts'

function createResult(args: {
  protocolId: TestId
  hand: 'Left' | 'Right'
  peak: number
  completedAtIso: string
  fingerShareAtPeakPct?: [number, number, number, number]
  underRecruitmentFlags?: [boolean, boolean, boolean, boolean]
  earlyLateDropPct?: number
  sessionTrendPct?: number
  repeatabilityScore?: number
  balanceScore?: number
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
        durationS: protocol.durationSec,
        samples: [],
        core: {
          peakTotalKg: args.peak,
          peakPerFingerKg: [args.peak / 4, args.peak / 4, args.peak / 4, args.peak / 4],
          fingerShareAtPeakPct: args.fingerShareAtPeakPct ?? [25, 25, 25, 25],
          averageForceKg: args.peak - 4,
          best3sMeanKg: args.peak - 2,
          fullTestMeanKg: args.peak - 5,
          impulseKgS: 100,
          impulseNs: 980,
          forceDriftKgS: -0.2,
          earlyLateDropPct: args.earlyLateDropPct ?? -4,
        },
        coaching: {
          contributionDriftPct: [0, 0, -8, 0],
          fatigueSlopePerFingerKgS: [0, 0, 0, 0],
          takeoverFinger: 0,
          fadeFinger: 2,
          stabilityErrorPct: null,
          fingerVariabilityPct: [0, 0, 0, 0],
          balanceScore: args.balanceScore ?? 82,
          fingerInitiationOrder: [0, 1, 2, 3],
          fingerDropoutOrder: [3, 2, 1, 0],
          compensationMapping: ['No dominant compensation pattern detected.'],
          fingerSynergyScore: 88,
          redistributionScore: 4,
          underRecruitmentFlags: args.underRecruitmentFlags ?? [false, false, false, false],
        },
        advanced: {
          effortClass: args.protocolId === 'explosive_pull' ? 'explosive' : 'max',
          rfd100KgS: 120,
          rfd200KgS: 110,
          fatigueIndex: 8,
          forceDriftKgS: -0.2,
          fingerAsymmetryPct: 0,
          redistributionScore: 4,
          fingerSynergyScore: 88,
          safetyFlags: [],
        },
        experimental: {
          explosive: args.protocolId === 'explosive_pull'
            ? {
                timeTo50PctPeakMs: 320,
                timeTo90PctPeakMs: 760,
                firstSecondPeakKg: 16,
                riseSlope0To500msKgS: 90,
              }
            : undefined,
          note: 'test',
        },
      },
    ],
    summary: {
      bestAttemptNo: 1,
      strongestFinger: 0,
      weakestContributor: 2,
      biggestFadeFinger: 2,
      takeoverFinger: 0,
      mostStableFinger: 1,
      repeatabilityScore: args.repeatabilityScore ?? 82,
      leftRightAsymmetryPct: null,
      sessionTrendPct: args.sessionTrendPct ?? 0,
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

describe('ai coaching', () => {
  it('recommends recruitment clusters when the primary limiter is recruitment', () => {
    const current = createResult({
      protocolId: 'standard_max',
      hand: 'Right',
      peak: 58,
      completedAtIso: '2026-03-20T10:00:00.000Z',
      fingerShareAtPeakPct: [30, 30, 8, 32],
      underRecruitmentFlags: [false, false, true, false],
    })

    const report = buildAiCoachingReport(current, [current])

    expect(report.primaryInsight.id).toBe('recruitment')
    expect(report.recommendedAction.kind).toBe('train')
    expect(report.recommendedAction.actionId).toBe('recruitment_rfd_clusters')
  })

  it('recommends repeated strength work when fatigue becomes the clearest limiter', () => {
    const current = createResult({
      protocolId: 'repeated_max_7_53',
      hand: 'Right',
      peak: 52,
      completedAtIso: '2026-03-20T11:00:00.000Z',
      earlyLateDropPct: -14,
      sessionTrendPct: -11,
      repeatabilityScore: 79,
      balanceScore: 79,
    })

    const report = buildAiCoachingReport(current, [current])

    expect(report.primaryInsight.id).toBe('fatigue')
    expect(report.recommendedAction.actionId).toBe('repeated_strength_7_53')
  })
})
