import { analyzeForceCurve } from '@krimblokk/core';
import type { ForceCurveAnalysis } from '@krimblokk/core';
import type { CompletedTestResult, AttemptResult } from '../test/types.ts';
import type { TrainRepResult } from '../train/types.ts';
import { buildForceCurveInputFromAttemptSamples, buildForceCurveInputFromTrainRepSamples } from './forceCurveAdapters.ts';

export interface AttemptCurveSummary {
  curve: ForceCurveAnalysis;
  attemptMetrics: {
    peakTotalKg: number;
    meanTotalKg: number;
    impulseKgS: number;
    durationS: number;
    rfd100KgS: number;
    rfd200KgS: number;
  };
  fingerMetrics: {
    peakKg: number;
    meanKg: number;
    shareAtPeakPct: number;
    avgSharePct: number;
    maxSharePct: number;
    timeToPeakMs: number | null;
    rfd100KgS: number;
    rfd200KgS: number;
    maxRiseRateKgS: number;
    fatigueSlopeKgS: number;
  };
}

export interface TrainRepCurveSummary {
  curve: ForceCurveAnalysis;
  repMetrics: {
    peakTotalKg: number;
    avgHoldKg: number;
    impulseKgS: number;
    actualHangS: number;
    adherencePct: number;
    targetKg: number;
  };
  fingerMetrics: {
    peakKg: number;
    meanKg: number;
    avgSharePct: number;
    maxSharePct: number;
    timeToPeakMs: number | null;
    rfd100KgS: number;
    rfd200KgS: number;
    maxRiseRateKgS: number;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function max(values: number[]): number {
  return values.length > 0 ? Math.max(...values) : 0;
}

function argMax(values: number[]): number {
  if (values.length === 0) return 0;
  let selected = 0;
  for (let index = 1; index < values.length; index += 1) {
    if ((values[index] ?? 0) > (values[selected] ?? 0)) {
      selected = index;
    }
  }
  return selected;
}

export function defaultAttemptIndex(result: CompletedTestResult): number {
  if (result.attempts.length === 0) return 0;
  return clamp(result.summary.bestAttemptNo - 1, 0, result.attempts.length - 1);
}

export function defaultFingerIndex(result: CompletedTestResult): number {
  return clamp(result.summary.strongestFinger, 0, 3);
}

export function strongestFingerInAttempt(attempt: AttemptResult): number {
  return argMax([...attempt.core.peakPerFingerKg]);
}

export function strongestFingerInTrainRep(rep: TrainRepResult): number {
  const peaks = [0, 1, 2, 3].map(fingerIndex => (
    max(rep.samples.map(sample => sample.fingerKg[fingerIndex]))
  ));
  return argMax(peaks);
}

export function buildAttemptCurveSummary(
  attempt: AttemptResult,
  fingerIndex: number,
): AttemptCurveSummary {
  const curve = analyzeForceCurve(buildForceCurveInputFromAttemptSamples(attempt.samples));
  const selectedFinger = clamp(fingerIndex, 0, 3);
  const pctSeries = curve.fingerPct?.[selectedFinger] ?? [];

  return {
    curve,
    attemptMetrics: {
      peakTotalKg: attempt.core.peakTotalKg,
      meanTotalKg: attempt.core.fullTestMeanKg,
      impulseKgS: attempt.core.impulseKgS,
      durationS: attempt.durationS,
      rfd100KgS: attempt.advanced?.rfd100KgS ?? curve.totalMetrics.rfd100KgS,
      rfd200KgS: attempt.advanced?.rfd200KgS ?? curve.totalMetrics.rfd200KgS,
    },
    fingerMetrics: {
      peakKg: attempt.core.peakPerFingerKg[selectedFinger],
      meanKg: curve.fingerMetrics[selectedFinger].meanKg,
      shareAtPeakPct: attempt.core.fingerShareAtPeakPct[selectedFinger],
      avgSharePct: mean(pctSeries),
      maxSharePct: max(pctSeries),
      timeToPeakMs: curve.fingerMetrics[selectedFinger].timeToPeakMs,
      rfd100KgS: curve.fingerMetrics[selectedFinger].rfd100KgS,
      rfd200KgS: curve.fingerMetrics[selectedFinger].rfd200KgS,
      maxRiseRateKgS: curve.fingerMetrics[selectedFinger].maxRiseRateKgS,
      fatigueSlopeKgS: attempt.coaching.fatigueSlopePerFingerKgS[selectedFinger],
    },
  };
}

export function buildTrainRepCurveSummary(
  rep: TrainRepResult,
  targetKg: number,
  fingerIndex: number,
): TrainRepCurveSummary {
  const curve = analyzeForceCurve(buildForceCurveInputFromTrainRepSamples(rep.samples));
  const selectedFinger = clamp(fingerIndex, 0, 3);
  const pctSeries = curve.fingerPct?.[selectedFinger] ?? [];

  return {
    curve,
    repMetrics: {
      peakTotalKg: rep.peakTotalKg,
      avgHoldKg: rep.avgHoldKg,
      impulseKgS: rep.impulseKgS,
      actualHangS: rep.actualHangS,
      adherencePct: rep.adherencePct,
      targetKg,
    },
    fingerMetrics: {
      peakKg: curve.fingerMetrics[selectedFinger].peakKg,
      meanKg: curve.fingerMetrics[selectedFinger].meanKg,
      avgSharePct: mean(pctSeries),
      maxSharePct: max(pctSeries),
      timeToPeakMs: curve.fingerMetrics[selectedFinger].timeToPeakMs,
      rfd100KgS: curve.fingerMetrics[selectedFinger].rfd100KgS,
      rfd200KgS: curve.fingerMetrics[selectedFinger].rfd200KgS,
      maxRiseRateKgS: curve.fingerMetrics[selectedFinger].maxRiseRateKgS,
    },
  };
}
