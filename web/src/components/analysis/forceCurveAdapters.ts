import type { CurveSeries4, ForceCurveInput } from '@krimblokk/core';
import type { AttemptSample } from '../test/types.ts';
import type { TrainRepSample } from '../train/types.ts';

function seriesFromFingerValues(samples: Array<{ fingerKg: [number, number, number, number] }>): CurveSeries4 {
  return [
    samples.map(sample => sample.fingerKg[0]),
    samples.map(sample => sample.fingerKg[1]),
    samples.map(sample => sample.fingerKg[2]),
    samples.map(sample => sample.fingerKg[3]),
  ];
}

function pctSeriesFromFingerValues(samples: Array<{ fingerPct: [number, number, number, number] }>): CurveSeries4 {
  return [
    samples.map(sample => sample.fingerPct[0]),
    samples.map(sample => sample.fingerPct[1]),
    samples.map(sample => sample.fingerPct[2]),
    samples.map(sample => sample.fingerPct[3]),
  ];
}

export function buildForceCurveInputFromAttemptSamples(samples: AttemptSample[]): ForceCurveInput {
  return {
    timesMs: samples.map(sample => sample.tMs),
    totalKg: samples.map(sample => sample.totalKg),
    fingerKg: seriesFromFingerValues(samples),
    fingerPct: pctSeriesFromFingerValues(samples),
  };
}

export function buildForceCurveInputFromTrainRepSamples(samples: TrainRepSample[]): ForceCurveInput {
  return {
    timesMs: samples.map(sample => sample.tMs),
    totalKg: samples.map(sample => sample.totalKg),
    fingerKg: seriesFromFingerValues(samples),
    fingerPct: pctSeriesFromFingerValues(samples),
  };
}
