import type { EffortMetrics, Finger4, ForceSample } from './types.ts';
import { KG_TO_N, totalKg } from './types.ts';

export interface AnalysisConfig {
  tutThresholdKg: number;
  holdPeakFraction: number;
  stabilizationShiftThreshold: number;
  stabilizationHoldMs: number;
}

export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  tutThresholdKg: 0.5,
  holdPeakFraction: 0.9,
  stabilizationShiftThreshold: 0.8,
  stabilizationHoldMs: 250,
};

function interpAtMs(timesMs: number[], values: number[], targetMs: number): number {
  if (timesMs.length === 0) return 0;
  if (targetMs <= timesMs[0]) return values[0];
  if (targetMs >= timesMs[timesMs.length - 1]) return values[values.length - 1];

  let idx = 0;
  for (let i = 0; i < timesMs.length; i += 1) {
    if (timesMs[i] >= targetMs) {
      idx = i;
      break;
    }
  }

  if (idx <= 0) return values[0];

  const t0 = timesMs[idx - 1];
  const t1 = timesMs[idx];
  const v0 = values[idx - 1];
  const v1 = values[idx];
  if (t1 <= t0) return v1;
  const frac = (targetMs - t0) / (t1 - t0);
  return v0 * (1 - frac) + v1 * frac;
}

function rfdKgS(timesMs: number[], totalValues: number[], t0Ms: number, windowMs: number): number {
  if (timesMs.length === 0) return 0;
  const f0 = interpAtMs(timesMs, totalValues, t0Ms);
  const f1 = interpAtMs(timesMs, totalValues, t0Ms + windowMs);
  return (f1 - f0) / (windowMs / 1000);
}

function durationAboveThreshold(timesMs: number[], values: number[], threshold: number): number {
  if (timesMs.length < 2) return 0;
  let accMs = 0;
  for (let i = 0; i < values.length - 1; i += 1) {
    if (values[i] >= threshold) {
      accMs += Math.max(0, timesMs[i + 1] - timesMs[i]);
    }
  }
  return accMs / 1000;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let sumSq = 0;
  for (const value of values) {
    const delta = value - m;
    sumSq += delta * delta;
  }
  return Math.sqrt(sumSq / values.length);
}

function percentages(fingersKg: Finger4[], totalsKg: number[]): Finger4[] {
  return fingersKg.map((fingerRow, index) => {
    const total = totalsKg[index];
    if (total <= 1e-9) return [0, 0, 0, 0];
    return [
      fingerRow[0] / total,
      fingerRow[1] / total,
      fingerRow[2] / total,
      fingerRow[3] / total,
    ];
  });
}

function loadShiftRateSeries(timesMs: number[], pctSeries: Finger4[]): { times: number[]; shift: number[] } {
  if (timesMs.length < 2) return { times: [], shift: [] };

  const shift: number[] = [];
  const times: number[] = [];

  for (let i = 1; i < timesMs.length; i += 1) {
    const dtSeconds = Math.max(1e-6, (timesMs[i] - timesMs[i - 1]) / 1000);
    const dp =
      Math.abs(pctSeries[i][0] - pctSeries[i - 1][0]) +
      Math.abs(pctSeries[i][1] - pctSeries[i - 1][1]) +
      Math.abs(pctSeries[i][2] - pctSeries[i - 1][2]) +
      Math.abs(pctSeries[i][3] - pctSeries[i - 1][3]);
    shift.push(dp / dtSeconds);
    times.push(timesMs[i]);
  }

  return { times, shift };
}

function stabilizationTimeS(
  timesMs: number[],
  pctSeries: Finger4[],
  startTMs: number,
  threshold: number,
  holdMs: number,
): number | null {
  const { times, shift } = loadShiftRateSeries(timesMs, pctSeries);
  if (shift.length === 0) return null;

  let candidateStart: number | null = null;
  let accumMs = 0;

  for (let i = 0; i < shift.length; i += 1) {
    if (shift[i] < threshold) {
      if (candidateStart === null) {
        candidateStart = times[i];
        accumMs = 0;
      }
      if (i > 0) {
        accumMs += Math.max(0, times[i] - times[i - 1]);
      }
      if (accumMs >= holdMs && candidateStart !== null) {
        return Math.max(0, (candidateStart - startTMs) / 1000);
      }
    } else {
      candidateStart = null;
      accumMs = 0;
    }
  }

  return null;
}

function zeroFinger4(): Finger4 {
  return [0, 0, 0, 0];
}

function hasPerFingerData(samples: ForceSample[]): samples is Array<ForceSample & { kg: Finger4 }> {
  return samples.every(sample => sample.kg !== null);
}

function analyzeTotalOnlyEffort(
  effortSamples: ForceSample[],
  effortId: number,
  config: AnalysisConfig,
): EffortMetrics {
  const timesMs = effortSamples.map(sample => sample.tMs);
  const totals = effortSamples.map(sample => totalKg(sample));
  const startTMs = timesMs[0];
  const endTMs = timesMs[timesMs.length - 1];
  const durationS = Math.max(0, (endTMs - startTMs) / 1000);

  let peakIdx = 0;
  let peakTotal = totals[0] ?? 0;
  for (let i = 1; i < totals.length; i += 1) {
    if (totals[i] > peakTotal) {
      peakTotal = totals[i];
      peakIdx = i;
    }
  }

  const holdThreshold = config.holdPeakFraction * peakTotal;
  let holdIdx = 0;
  for (let i = 0; i < totals.length; i += 1) {
    if (totals[i] >= holdThreshold) {
      holdIdx = i;
      break;
    }
  }

  const holdTotalsKg = totals.slice(holdIdx);

  return {
    effortId,
    startTMs,
    endTMs,
    durationS,
    peakTotalKg: peakTotal,
    peakPerFingerKg: null,
    timeToPeakS: Math.max(0, (timesMs[peakIdx] - startTMs) / 1000),
    rfd100KgS: rfdKgS(timesMs, totals, startTMs, 100),
    rfd200KgS: rfdKgS(timesMs, totals, startTMs, 200),
    rfd100NS: rfdKgS(timesMs, totals, startTMs, 100) * KG_TO_N,
    rfd200NS: rfdKgS(timesMs, totals, startTMs, 200) * KG_TO_N,
    avgTotalKg: holdTotalsKg.length > 0 ? mean(holdTotalsKg) : 0,
    tutS: durationAboveThreshold(timesMs, totals, config.tutThresholdKg),
    distributionDriftPerS: null,
    steadinessTotalKg: holdTotalsKg.length > 0 ? stddev(holdTotalsKg) : 0,
    steadinessPerFingerKg: null,
    fingerImbalanceIndex: null,
    loadVariationCv: null,
    dominantSwitchCount: null,
    loadShiftRate: null,
    stabilizationTimeS: null,
    ringPinkyShare: null,
    holdStartTMs: timesMs[holdIdx] ?? startTMs,
    holdEndTMs: endTMs,
    detailTMs: timesMs.map(time => time - startTMs),
    detailTotalKg: [...totals],
    detailFingerKg: null,
    detailFingerPct: null,
  };
}

export function analyzeEffortSamples(
  effortSamples: ForceSample[],
  effortId: number,
  config: AnalysisConfig = DEFAULT_ANALYSIS_CONFIG,
): EffortMetrics {
  if (effortSamples.length === 0) {
    return {
      effortId,
      startTMs: 0,
      endTMs: 0,
      durationS: 0,
      peakTotalKg: 0,
      peakPerFingerKg: null,
      timeToPeakS: 0,
      rfd100KgS: 0,
      rfd200KgS: 0,
      rfd100NS: 0,
      rfd200NS: 0,
      avgTotalKg: 0,
      tutS: 0,
      distributionDriftPerS: null,
      steadinessTotalKg: 0,
      steadinessPerFingerKg: null,
      fingerImbalanceIndex: null,
      loadVariationCv: null,
      dominantSwitchCount: null,
      loadShiftRate: null,
      stabilizationTimeS: null,
      ringPinkyShare: null,
      holdStartTMs: 0,
      holdEndTMs: 0,
      detailTMs: [],
      detailTotalKg: [],
      detailFingerKg: null,
      detailFingerPct: null,
    };
  }

  if (effortSamples.length < 2) {
    const sample = effortSamples[0];
    return {
      effortId,
      startTMs: sample.tMs,
      endTMs: sample.tMs,
      durationS: 0,
      peakTotalKg: totalKg(sample),
      peakPerFingerKg: sample.kg,
      timeToPeakS: 0,
      rfd100KgS: 0,
      rfd200KgS: 0,
      rfd100NS: 0,
      rfd200NS: 0,
      avgTotalKg: totalKg(sample),
      tutS: 0,
      distributionDriftPerS: sample.kg ? 0 : null,
      steadinessTotalKg: 0,
      steadinessPerFingerKg: sample.kg ? zeroFinger4() : null,
      fingerImbalanceIndex: sample.kg ? 0 : null,
      loadVariationCv: sample.kg ? 0 : null,
      dominantSwitchCount: sample.kg ? 0 : null,
      loadShiftRate: sample.kg ? 0 : null,
      stabilizationTimeS: null,
      ringPinkyShare: sample.kg ? 0 : null,
      holdStartTMs: sample.tMs,
      holdEndTMs: sample.tMs,
      detailTMs: [0],
      detailTotalKg: [totalKg(sample)],
      detailFingerKg: sample.kg ? [sample.kg] : null,
      detailFingerPct: sample.kg ? [zeroFinger4()] : null,
    };
  }

  if (!hasPerFingerData(effortSamples)) {
    return analyzeTotalOnlyEffort(effortSamples, effortId, config);
  }

  const timesMs = effortSamples.map(sample => sample.tMs);
  const fingers = effortSamples.map(sample => sample.kg);
  const totals = fingers.map(finger => finger[0] + finger[1] + finger[2] + finger[3]);

  const startTMs = timesMs[0];
  const endTMs = timesMs[timesMs.length - 1];
  const durationS = Math.max(0, (endTMs - startTMs) / 1000);

  let peakIdx = 0;
  let peakTotal = totals[0];
  for (let i = 1; i < totals.length; i += 1) {
    if (totals[i] > peakTotal) {
      peakTotal = totals[i];
      peakIdx = i;
    }
  }

  const peakPerFingerKg = fingers[peakIdx];
  const timeToPeakS = Math.max(0, (timesMs[peakIdx] - startTMs) / 1000);

  const rfd100KgS = rfdKgS(timesMs, totals, startTMs, 100);
  const rfd200KgS = rfdKgS(timesMs, totals, startTMs, 200);

  const holdThreshold = config.holdPeakFraction * peakTotal;
  let holdIdx = 0;
  for (let i = 0; i < totals.length; i += 1) {
    if (totals[i] >= holdThreshold) {
      holdIdx = i;
      break;
    }
  }

  const holdTimesMs = timesMs.slice(holdIdx);
  const holdFingersKg = fingers.slice(holdIdx);
  const holdTotalsKg = totals.slice(holdIdx);

  const allPct = percentages(fingers, totals);
  const holdPct = percentages(holdFingersKg, holdTotalsKg);

  const holdStartTMs = timesMs[holdIdx];
  const holdEndTMs = timesMs[timesMs.length - 1];
  const avgTotalKg = holdTotalsKg.length > 0 ? mean(holdTotalsKg) : 0;
  const tutS = durationAboveThreshold(timesMs, totals, config.tutThresholdKg);

  let distributionDriftPerS = 0;
  if (holdTimesMs.length >= 2) {
    const holdShift = loadShiftRateSeries(holdTimesMs, holdPct).shift;
    distributionDriftPerS = holdShift.length > 0 ? mean(holdShift) : 0;
  }

  const steadinessTotalKg = holdTotalsKg.length > 0 ? stddev(holdTotalsKg) : 0;
  const steadinessPerFingerKg: Finger4 = holdFingersKg.length > 0
    ? [
        stddev(holdFingersKg.map(finger => finger[0])),
        stddev(holdFingersKg.map(finger => finger[1])),
        stddev(holdFingersKg.map(finger => finger[2])),
        stddev(holdFingersKg.map(finger => finger[3])),
      ]
    : zeroFinger4();

  const fingerImbalanceIndex = holdPct.length > 0
    ? mean(holdPct.map(row => stddev(row.map(value => value * 100))))
    : 0;

  const loadVariationValues: number[] = [];
  for (let fingerIdx = 0; fingerIdx < 4; fingerIdx += 1) {
    const series = holdFingersKg.map(finger => finger[fingerIdx]);
    if (series.length === 0) {
      loadVariationValues.push(0);
      continue;
    }
    const meanAbs = mean(series.map(value => Math.abs(value)));
    if (meanAbs < 1e-9) {
      loadVariationValues.push(0);
      continue;
    }
    loadVariationValues.push(stddev(series) / meanAbs);
  }
  const loadVariationCv = loadVariationValues.length > 0 ? mean(loadVariationValues) : 0;

  let dominantSwitchCount = 0;
  let previousDominant = -1;
  for (const row of allPct) {
    let dominant = 0;
    for (let i = 1; i < row.length; i += 1) {
      if (row[i] > row[dominant]) dominant = i;
    }
    if (previousDominant >= 0 && dominant !== previousDominant) {
      dominantSwitchCount += 1;
    }
    previousDominant = dominant;
  }

  const loadShiftRateSeriesAll = loadShiftRateSeries(timesMs, allPct);
  const loadShiftRate = loadShiftRateSeriesAll.shift.length > 0 ? mean(loadShiftRateSeriesAll.shift) : 0;

  const stabilizationTimeSValue = stabilizationTimeS(
    timesMs,
    allPct,
    startTMs,
    config.stabilizationShiftThreshold,
    config.stabilizationHoldMs,
  );

  const validHoldShares = holdTotalsKg
    .map((total, index) => ({ total, fingers: holdFingersKg[index] }))
    .filter(entry => entry.total > 1e-9)
    .map(entry => (entry.fingers[2] + entry.fingers[3]) / entry.total);
  const ringPinkyShare = validHoldShares.length > 0 ? mean(validHoldShares) : 0;

  const detailTMs = timesMs.map(time => time - startTMs);
  const detailFingerPct = allPct.map(row => [
    row[0] * 100,
    row[1] * 100,
    row[2] * 100,
    row[3] * 100,
  ] as Finger4);

  return {
    effortId,
    startTMs,
    endTMs,
    durationS,
    peakTotalKg: peakTotal,
    peakPerFingerKg,
    timeToPeakS,
    rfd100KgS,
    rfd200KgS,
    rfd100NS: rfd100KgS * KG_TO_N,
    rfd200NS: rfd200KgS * KG_TO_N,
    avgTotalKg,
    tutS,
    distributionDriftPerS,
    steadinessTotalKg,
    steadinessPerFingerKg,
    fingerImbalanceIndex,
    loadVariationCv,
    dominantSwitchCount,
    loadShiftRate,
    stabilizationTimeS: stabilizationTimeSValue,
    ringPinkyShare,
    holdStartTMs,
    holdEndTMs,
    detailTMs,
    detailTotalKg: [...totals],
    detailFingerKg: fingers.map(finger => [...finger] as Finger4),
    detailFingerPct,
  };
}
