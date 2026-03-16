import { describe, expect, it } from 'vitest';
import type { CompletedTestResult, AttemptResult } from '../components/test/types.ts';
import type { TrainRepResult } from '../components/train/types.ts';
import {
  buildAttemptCurveSummary,
  buildTrainRepCurveSummary,
  defaultAttemptIndex,
  defaultFingerIndex,
  strongestFingerInTrainRep,
} from '../components/analysis/forceCurveViewModel.ts';

function createAttempt(overrides: Partial<AttemptResult> = {}): AttemptResult {
  return {
    attemptNo: 1,
    durationS: 0.3,
    samples: [
      { tMs: 0, totalKg: 0, fingerKg: [0, 0, 0, 0], fingerPct: [0, 0, 0, 0] },
      { tMs: 100, totalKg: 5, fingerKg: [2.2, 1.5, 0.9, 0.4], fingerPct: [44, 30, 18, 8] },
      { tMs: 200, totalKg: 8, fingerKg: [3.3, 2.3, 1.5, 0.9], fingerPct: [41.25, 28.75, 18.75, 11.25] },
      { tMs: 300, totalKg: 7.5, fingerKg: [3, 2.1, 1.5, 0.9], fingerPct: [40, 28, 20, 12] },
    ],
    core: {
      peakTotalKg: 8,
      peakPerFingerKg: [3.3, 2.3, 1.5, 0.9],
      fingerShareAtPeakPct: [41.25, 28.75, 18.75, 11.25],
      averageForceKg: 5.1,
      best3sMeanKg: 5.1,
      fullTestMeanKg: 5.1,
      impulseKgS: 1.45,
      impulseNs: 14.2,
      forceDriftKgS: -0.2,
      earlyLateDropPct: -5,
    },
    coaching: {
      contributionDriftPct: [1, -1.2, 0.3, -0.1],
      fatigueSlopePerFingerKgS: [-0.5, -0.4, -0.2, -0.1],
      takeoverFinger: 0,
      fadeFinger: 1,
      stabilityErrorPct: null,
      fingerVariabilityPct: [2, 2, 2, 2],
      balanceScore: 86,
      fingerInitiationOrder: [0, 1, 2, 3],
      fingerDropoutOrder: [3, 2, 1, 0],
      compensationMapping: ['Index compensates for Middle'],
      fingerSynergyScore: 70,
      redistributionScore: 4,
      underRecruitmentFlags: [false, false, false, false],
    },
    advanced: {
      effortClass: 'max',
      rfd100KgS: 50,
      rfd200KgS: 40,
      fatigueIndex: 5,
      forceDriftKgS: -0.2,
      fingerAsymmetryPct: 30,
      redistributionScore: 4,
      fingerSynergyScore: 70,
      safetyFlags: [],
    },
    experimental: { note: 'ok' },
    ...overrides,
  };
}

function createResult(): CompletedTestResult {
  return {
    resultId: 'result-1',
    protocolKind: 'builtin',
    protocolId: 'standard_max',
    protocolName: 'Max',
    tier: 'Core',
    hand: 'Right',
    targetKg: null,
    startedAtIso: '2026-03-16T10:00:00.000Z',
    completedAtIso: '2026-03-16T10:05:00.000Z',
    effectiveProtocol: {} as CompletedTestResult['effectiveProtocol'],
    dashboardSnapshot: { livePanels: [], resultWidgets: [] },
    compareTags: {
      family: 'max_pull',
      targetMode: 'none',
      intervalMode: 'continuous',
    },
    attempts: [
      createAttempt({ attemptNo: 1, core: { ...createAttempt().core, peakTotalKg: 7 } }),
      createAttempt({ attemptNo: 2 }),
    ],
    summary: {
      bestAttemptNo: 2,
      strongestFinger: 0,
      weakestContributor: 3,
      biggestFadeFinger: 1,
      takeoverFinger: 0,
      mostStableFinger: 2,
      repeatabilityScore: 90,
      leftRightAsymmetryPct: null,
      sessionTrendPct: 1,
    },
    confidence: { core: 'High', coaching: 'Moderate', experimental: 'Low' },
  };
}

function createRep(): TrainRepResult {
  return {
    sequenceSetNo: 1,
    blockId: 'main',
    blockLabel: 'Main',
    blockPhase: 'main',
    setNo: 1,
    repNo: 1,
    plannedHangSec: 8,
    actualHangS: 7.8,
    peakTotalKg: 12,
    avgHoldKg: 9.4,
    impulseKgS: 51,
    adherencePct: 92,
    samples: [
      { tMs: 0, totalKg: 0, fingerKg: [0, 0, 0, 0], fingerPct: [0, 0, 0, 0], targetKg: 10 },
      { tMs: 100, totalKg: 7, fingerKg: [3.4, 2.2, 1, 0.4], fingerPct: [48.6, 31.4, 14.3, 5.7], targetKg: 10 },
      { tMs: 200, totalKg: 12, fingerKg: [5.3, 3.5, 2, 1.2], fingerPct: [44.2, 29.2, 16.7, 10], targetKg: 10 },
      { tMs: 300, totalKg: 10.5, fingerKg: [4.6, 3.2, 1.7, 1], fingerPct: [43.8, 30.5, 16.2, 9.5], targetKg: 10 },
    ],
  };
}

describe('force curve view model helpers', () => {
  it('chooses the best attempt and strongest finger as defaults', () => {
    const result = createResult();

    expect(defaultAttemptIndex(result)).toBe(1);
    expect(defaultFingerIndex(result)).toBe(0);
  });

  it('builds attempt curve summaries from stored attempt data', () => {
    const result = createResult();
    const summary = buildAttemptCurveSummary(result.attempts[1], 0);

    expect(summary.attemptMetrics.peakTotalKg).toBe(8);
    expect(summary.attemptMetrics.rfd100KgS).toBe(50);
    expect(summary.fingerMetrics.shareAtPeakPct).toBeCloseTo(41.25);
    expect(summary.fingerMetrics.timeToPeakMs).toBe(200);
    expect(summary.fingerMetrics.maxRiseRateKgS).toBeGreaterThan(0);
  });

  it('builds train rep summaries and identifies the strongest rep finger', () => {
    const rep = createRep();
    const strongestFinger = strongestFingerInTrainRep(rep);
    const summary = buildTrainRepCurveSummary(rep, 10, strongestFinger);

    expect(strongestFinger).toBe(0);
    expect(summary.repMetrics.targetKg).toBe(10);
    expect(summary.repMetrics.peakTotalKg).toBe(12);
    expect(summary.fingerMetrics.peakKg).toBeCloseTo(5.3);
    expect(summary.fingerMetrics.avgSharePct).toBeGreaterThan(30);
  });
});
