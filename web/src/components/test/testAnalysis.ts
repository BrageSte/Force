import { KG_TO_N, type Finger4, type Hand, type ProfileSnapshot } from '../../types/force.ts';
import type {
  AttemptResult,
  AttemptSample,
  CompareTagSnapshot,
  CompletedTestResult,
  DashboardConfigSnapshot,
  TestProtocol,
} from './types.ts';

interface AnalyzeContext {
  oppositeHandBestPeakKg?: number | null;
  dashboardSnapshot?: DashboardConfigSnapshot;
  compareTags?: CompareTagSnapshot;
  profile?: ProfileSnapshot | null;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const sq = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / arr.length;
  return Math.sqrt(sq);
}

function slopeLinear(times: number[], values: number[]): number {
  if (times.length < 2 || values.length < 2) return 0;
  const n = Math.min(times.length, values.length);
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i++) {
    const x = times[i];
    const y = values[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-9) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

function argMax(values: number[]): number {
  if (values.length === 0) return 0;
  let idx = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[idx]) idx = i;
  }
  return idx;
}

function argMin(values: number[]): number {
  if (values.length === 0) return 0;
  let idx = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] < values[idx]) idx = i;
  }
  return idx;
}

function windowedBestMean(values: number[], windowSize: number): number {
  if (values.length === 0) return 0;
  const size = Math.max(1, Math.min(windowSize, values.length));
  let sum = 0;
  for (let i = 0; i < size; i++) sum += values[i];
  let best = sum / size;
  for (let i = size; i < values.length; i++) {
    sum += values[i] - values[i - size];
    best = Math.max(best, sum / size);
  }
  return best;
}

function interpolateAtMs(timesMs: number[], values: number[], targetMs: number): number | null {
  if (timesMs.length === 0 || values.length === 0) return null;
  if (targetMs <= timesMs[0]) return values[0];
  if (targetMs >= timesMs[timesMs.length - 1]) return values[values.length - 1];

  for (let i = 1; i < timesMs.length; i++) {
    const t1 = timesMs[i];
    if (targetMs <= t1) {
      const t0 = timesMs[i - 1];
      const v0 = values[i - 1];
      const v1 = values[i];
      if (t1 <= t0) return v1;
      const a = (targetMs - t0) / (t1 - t0);
      return v0 + (v1 - v0) * a;
    }
  }
  return values[values.length - 1];
}

function firstCrossingMs(timesMs: number[], values: number[], threshold: number): number | null {
  if (timesMs.length === 0 || values.length === 0) return null;
  if (values[0] >= threshold) return timesMs[0];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    const curr = values[i];
    if (curr >= threshold && prev < threshold) {
      const t0 = timesMs[i - 1];
      const t1 = timesMs[i];
      const frac = (threshold - prev) / Math.max(1e-9, curr - prev);
      return t0 + frac * (t1 - t0);
    }
  }
  return null;
}

function splitSegmentsBySubphase(samples: AttemptSample[]): AttemptSample[][] {
  const segments: AttemptSample[][] = [];
  let current: AttemptSample[] = [];
  let insideOn = false;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const on = s.subPhase !== 'off';
    if (on && !insideOn) {
      if (current.length > 0) {
        segments.push(current);
      }
      current = [s];
      insideOn = true;
    } else if (on && insideOn) {
      current.push(s);
    } else if (!on && insideOn) {
      if (current.length > 0) segments.push(current);
      current = [];
      insideOn = false;
    }
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

function calcSynergyMatrix(samples: AttemptSample[]): number[][] {
  const m: number[][] = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
  if (samples.length < 3) return m;

  const series: number[][] = [[], [], [], []];
  for (const s of samples) {
    for (let i = 0; i < 4; i++) series[i].push(s.fingerPct[i]);
  }

  const means = series.map(col => mean(col));
  const stds = series.map(col => std(col));

  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      let cov = 0;
      for (let k = 0; k < samples.length; k++) {
        cov += (series[i][k] - means[i]) * (series[j][k] - means[j]);
      }
      cov /= samples.length;
      const denom = stds[i] * stds[j];
      const corr = denom < 1e-9 ? 0 : cov / denom;
      m[i][j] = corr;
      m[j][i] = corr;
    }
  }
  return m;
}

function averageSynergyScore(matrix: number[][]): number {
  const values: number[] = [];
  for (let i = 0; i < matrix.length; i++) {
    for (let j = i + 1; j < matrix[i].length; j++) {
      values.push(matrix[i][j]);
    }
  }
  if (values.length === 0) return 0;
  return clamp(((mean(values) + 1) / 2) * 100, 0, 100);
}

function trapezoidIntegral(timesSec: number[], values: number[]): number {
  if (timesSec.length < 2 || values.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < Math.min(timesSec.length, values.length); i++) {
    total += ((values[i - 1] + values[i]) / 2) * (timesSec[i] - timesSec[i - 1]);
  }
  return total;
}

function computeFingerInitiationOrder(samples: AttemptSample[]): number[] {
  if (samples.length === 0) return [0, 1, 2, 3];
  const windowLimit = samples[0].tMs + 200;
  const windowSamples = samples.filter(sample => sample.tMs <= windowLimit);
  const peaks: Finger4 = [
    Math.max(...samples.map(sample => sample.fingerKg[0]), 0),
    Math.max(...samples.map(sample => sample.fingerKg[1]), 0),
    Math.max(...samples.map(sample => sample.fingerKg[2]), 0),
    Math.max(...samples.map(sample => sample.fingerKg[3]), 0),
  ];
  return [0, 1, 2, 3]
    .map(index => {
      const threshold = Math.max(0.2, peaks[index] * 0.1);
      const first = windowSamples.find(sample => sample.fingerKg[index] >= threshold);
      return { index, time: first?.tMs ?? Number.POSITIVE_INFINITY };
    })
    .sort((a, b) => a.time - b.time || a.index - b.index)
    .map(item => item.index);
}

function computeFingerDropoutOrder(samples: AttemptSample[], peakIdx: number): number[] {
  if (samples.length === 0) return [0, 1, 2, 3];
  const tail = samples.slice(Math.max(peakIdx, 0));
  return [0, 1, 2, 3]
    .map(index => {
      const peak = Math.max(...samples.map(sample => sample.fingerKg[index]), 0);
      const cutoff = peak * 0.7;
      const dropout = tail.find(sample => sample.fingerKg[index] <= cutoff);
      return { index, time: dropout?.tMs ?? Number.POSITIVE_INFINITY };
    })
    .sort((a, b) => a.time - b.time || a.index - b.index)
    .map(item => item.index);
}

function buildCompensationMapping(drift: Finger4): string[] {
  const positive = [0, 1, 2, 3].filter(index => drift[index] > 2);
  const negative = [0, 1, 2, 3].filter(index => drift[index] < -2);
  if (positive.length === 0 || negative.length === 0) return ['No dominant compensation pattern detected.'];

  const label = (index: number) => ['Index', 'Middle', 'Ring', 'Pinky'][index];
  const groupedPositive = positive.map(label).join(' + ');
  const groupedNegative = negative.map(label).join(' + ');
  return [`${groupedPositive} compensate for ${groupedNegative} as fatigue rises.`];
}

function classifyEffort(protocol: TestProtocol, _durationS: number, rfd100KgS: number, repeatedEffortDecayPct: number | null): AttemptSample['effortClass'] {
  if (protocol.category === 'recruitment_rfd' || rfd100KgS >= 180) return 'explosive';
  if (protocol.category === 'max_strength' || protocol.category === 'repeated_max_strength') return 'max';
  if (protocol.category === 'strength_endurance' || (repeatedEffortDecayPct !== null && repeatedEffortDecayPct < -8)) return 'endurance';
  return 'capacity';
}

function inferTacticalGripProfile(protocol: TestProtocol, summary: {
  redistributionScore: number;
  fingerSynergyScore: number;
  fatigueIndex: number;
  rfd100KgS: number;
}): CompletedTestResult['summary']['tacticalGripProfile'] {
  if (summary.redistributionScore > 12 || summary.fingerSynergyScore < 55) return 'compensation_prone';
  if (protocol.category === 'recruitment_rfd' && summary.rfd100KgS >= 180) return 'explosive';
  if (summary.fatigueIndex < 8) return 'fatigue_resistant';
  if (protocol.gripType === 'half_crimp') return 'crimp_dominant';
  if (protocol.gripType === 'open_hand') return 'open_hand_dominant';
  return 'balanced';
}

function buildSafetyFlags(args: {
  peakTotalKg: number;
  rfd100KgS: number;
  fingerShareAtPeakPct: Finger4;
  leftRightAsymmetryPct: number | null;
  redistributionScore: number;
  stabilityErrorPct: number | null;
}): { code: string; severity: 'info' | 'warning' | 'high'; message: string }[] {
  const flags: { code: string; severity: 'info' | 'warning' | 'high'; message: string }[] = [];
  if (args.rfd100KgS > 260) {
    flags.push({ code: 'force_spike', severity: 'warning', message: 'Rapid spike detected; review setup and tissue tolerance.' });
  }
  if (args.leftRightAsymmetryPct !== null && Math.abs(args.leftRightAsymmetryPct) >= 12) {
    flags.push({ code: 'asymmetry', severity: 'high', message: 'Large left/right asymmetry detected for this benchmark.' });
  }
  if (Math.max(...args.fingerShareAtPeakPct) >= 45) {
    flags.push({ code: 'single_finger_overload', severity: 'warning', message: 'One finger is taking a very large share of the load.' });
  }
  if (args.redistributionScore >= 14) {
    flags.push({ code: 'compensation_risk', severity: 'warning', message: 'Finger redistribution rose sharply as fatigue increased.' });
  }
  if (args.stabilityErrorPct !== null && args.stabilityErrorPct >= 18) {
    flags.push({ code: 'unstable_loading', severity: 'warning', message: 'Target stability broke down during the effort.' });
  }
  if (flags.length === 0 && args.peakTotalKg > 0) {
    flags.push({ code: 'clean_session', severity: 'info', message: 'No major safety flags detected in this effort.' });
  }
  return flags;
}

function buildBenchmarkScore(args: {
  peakTotalKg: number;
  averageForceKg: number;
  impulseKgS: number;
  rfd100KgS: number;
  rfd200KgS: number;
  fatigueIndex: number;
  forceDriftKgS: number;
  fingerContributionPct: Finger4;
  fingerAsymmetryPct: number | null;
  redistributionScore: number;
  stabilityScore: number;
  leftVsRightPct: number | null;
}) {
  const overall = clamp(
    (args.peakTotalKg * 1.3) +
    (args.averageForceKg * 0.8) +
    (args.rfd100KgS * 0.06) +
    args.stabilityScore -
    args.fatigueIndex * 1.2 -
    args.redistributionScore * 1.1 -
    Math.abs(args.leftVsRightPct ?? 0) * 0.7,
    0,
    100,
  );

  return {
    overall,
    peakForceKg: args.peakTotalKg,
    averageForceKg: args.averageForceKg,
    impulseKgS: args.impulseKgS,
    rfd100KgS: Number.isFinite(args.rfd100KgS) ? args.rfd100KgS : null,
    rfd200KgS: Number.isFinite(args.rfd200KgS) ? args.rfd200KgS : null,
    fatigueIndex: args.fatigueIndex,
    forceDriftKgS: args.forceDriftKgS,
    fingerContributionPct: args.fingerContributionPct,
    fingerAsymmetryPct: args.fingerAsymmetryPct,
    redistributionScore: args.redistributionScore,
    stabilityScore: args.stabilityScore,
    leftVsRightPct: args.leftVsRightPct,
  };
}

function analyzeAttempt(
  protocol: TestProtocol,
  attemptNo: number,
  samples: AttemptSample[],
  targetKg: number | null,
): AttemptResult {
  const emptyFinger: Finger4 = [0, 0, 0, 0];
  if (samples.length === 0) {
    return {
      attemptNo,
      durationS: 0,
      samples: [],
      core: {
        peakTotalKg: 0,
        peakPerFingerKg: emptyFinger,
        fingerShareAtPeakPct: emptyFinger,
        averageForceKg: 0,
        best3sMeanKg: 0,
        fullTestMeanKg: 0,
        impulseKgS: 0,
        impulseNs: 0,
        forceDriftKgS: 0,
        earlyLateDropPct: 0,
      },
      coaching: {
        contributionDriftPct: emptyFinger,
        fatigueSlopePerFingerKgS: emptyFinger,
        takeoverFinger: 0,
        fadeFinger: 0,
        stabilityErrorPct: null,
        fingerVariabilityPct: emptyFinger,
        balanceScore: 0,
        fingerInitiationOrder: [0, 1, 2, 3],
        fingerDropoutOrder: [0, 1, 2, 3],
        compensationMapping: ['No attempt samples captured.'],
        fingerSynergyScore: 0,
        redistributionScore: 0,
        underRecruitmentFlags: [false, false, false, false],
      },
      advanced: {
        effortClass: 'capacity',
        rfd100KgS: null,
        rfd200KgS: null,
        fatigueIndex: 0,
        forceDriftKgS: 0,
        fingerAsymmetryPct: null,
        redistributionScore: 0,
        fingerSynergyScore: 0,
        safetyFlags: [],
      },
      experimental: {
        note: 'No attempt samples captured.',
      },
    };
  }

  const timesMs = samples.map(s => s.tMs);
  const totals = samples.map(s => s.totalKg);
  const timeSec = timesMs.map(t => t / 1000);
  const durationS = Math.max(0, (timesMs[timesMs.length - 1] - timesMs[0]) / 1000);

  const peakIdx = argMax(totals);
  const peakTotalKg = totals[peakIdx];
  const peakPerFinger: Finger4 = [
    Math.max(...samples.map(s => s.fingerKg[0])),
    Math.max(...samples.map(s => s.fingerKg[1])),
    Math.max(...samples.map(s => s.fingerKg[2])),
    Math.max(...samples.map(s => s.fingerKg[3])),
  ];
  const fingerShareAtPeakPct = samples[peakIdx].fingerPct;

  const medianDtMs = timesMs.length >= 2
    ? mean(timesMs.slice(1).map((t, i) => t - timesMs[i]))
    : 20;
  const best3sMeanKg = windowedBestMean(totals, Math.max(1, Math.round(3000 / Math.max(1, medianDtMs))));
  const fullTestMeanKg = mean(totals);
  const averageForceKg = fullTestMeanKg;
  const impulseKgS = trapezoidIntegral(timeSec, totals);
  const impulseNs = impulseKgS * KG_TO_N;
  const forceDriftKgS = slopeLinear(timeSec, totals);
  const startValue = totals[0] ?? 0;
  const rfd100KgS = ((interpolateAtMs(timesMs, totals, timesMs[0] + 100) ?? startValue) - startValue) / 0.1;
  const rfd200KgS = ((interpolateAtMs(timesMs, totals, timesMs[0] + 200) ?? startValue) - startValue) / 0.2;

  const q = Math.max(1, Math.floor(samples.length * 0.3));
  const earlyTotals = totals.slice(0, q);
  const lateTotals = totals.slice(-q);
  const earlyMean = mean(earlyTotals);
  const lateMean = mean(lateTotals);
  const earlyLateDropPct = earlyMean > 1e-9 ? ((lateMean - earlyMean) / earlyMean) * 100 : 0;

  const earlyShares: Finger4 = [
    mean(samples.slice(0, q).map(s => s.fingerPct[0])),
    mean(samples.slice(0, q).map(s => s.fingerPct[1])),
    mean(samples.slice(0, q).map(s => s.fingerPct[2])),
    mean(samples.slice(0, q).map(s => s.fingerPct[3])),
  ];
  const lateShares: Finger4 = [
    mean(samples.slice(-q).map(s => s.fingerPct[0])),
    mean(samples.slice(-q).map(s => s.fingerPct[1])),
    mean(samples.slice(-q).map(s => s.fingerPct[2])),
    mean(samples.slice(-q).map(s => s.fingerPct[3])),
  ];

  const drift: Finger4 = [
    lateShares[0] - earlyShares[0],
    lateShares[1] - earlyShares[1],
    lateShares[2] - earlyShares[2],
    lateShares[3] - earlyShares[3],
  ];

  const fatigueSlope: Finger4 = [
    slopeLinear(timeSec, samples.map(s => s.fingerKg[0])),
    slopeLinear(timeSec, samples.map(s => s.fingerKg[1])),
    slopeLinear(timeSec, samples.map(s => s.fingerKg[2])),
    slopeLinear(timeSec, samples.map(s => s.fingerKg[3])),
  ];

  const variability: Finger4 = [
    std(samples.map(s => s.fingerPct[0])),
    std(samples.map(s => s.fingerPct[1])),
    std(samples.map(s => s.fingerPct[2])),
    std(samples.map(s => s.fingerPct[3])),
  ];

  const stabilityErrorPct = targetKg && targetKg > 1e-9
    ? mean(totals.map(v => Math.abs(v - targetKg) / targetKg * 100))
    : null;

  const imbalanceAtPeak = std(Array.from(fingerShareAtPeakPct));
  const driftPenalty = mean(Array.from(drift).map(v => Math.abs(v)));
  const balanceScore = clamp(100 - imbalanceAtPeak * 2.5 - driftPenalty * 0.8, 0, 100);

  const takeoverFinger = argMax(Array.from(drift));
  const fadeKg: Finger4 = [
    mean(samples.slice(-q).map(s => s.fingerKg[0])) - mean(samples.slice(0, q).map(s => s.fingerKg[0])),
    mean(samples.slice(-q).map(s => s.fingerKg[1])) - mean(samples.slice(0, q).map(s => s.fingerKg[1])),
    mean(samples.slice(-q).map(s => s.fingerKg[2])) - mean(samples.slice(0, q).map(s => s.fingerKg[2])),
    mean(samples.slice(-q).map(s => s.fingerKg[3])) - mean(samples.slice(0, q).map(s => s.fingerKg[3])),
  ];
  const fadeFinger = argMin(Array.from(fadeKg));

  const underRecruitmentFlags: [boolean, boolean, boolean, boolean] = [
    fingerShareAtPeakPct[0] < 15,
    fingerShareAtPeakPct[1] < 15,
    fingerShareAtPeakPct[2] < 12,
    fingerShareAtPeakPct[3] < 10,
  ];

  const synergyMatrix = calcSynergyMatrix(samples);
  const fingerSynergyScore = averageSynergyScore(synergyMatrix);
  const redistributionScore = mean(Array.from(drift).map(v => Math.abs(v)));
  const fingerInitiationOrder = computeFingerInitiationOrder(samples);
  const fingerDropoutOrder = computeFingerDropoutOrder(samples, peakIdx);
  const compensationMapping = buildCompensationMapping(drift);
  const fingerAsymmetryPct = peakTotalKg > 1e-9
    ? ((Math.max(...peakPerFinger) - Math.min(...peakPerFinger)) / peakTotalKg) * 100
    : null;

  let experimental: AttemptResult['experimental'] = {
    note: 'Exploratory metrics are shown with lower confidence.',
  };
  let repeatedEffortDecayPct: number | null = null;

  if (protocol.id === 'explosive_pull') {
    const baseline = mean(totals.slice(0, Math.max(2, Math.floor(totals.length * 0.1))));
    const threshold50 = baseline + (peakTotalKg - baseline) * 0.5;
    const threshold90 = baseline + (peakTotalKg - baseline) * 0.9;
    const t50 = firstCrossingMs(timesMs, totals, threshold50);
    const t90 = firstCrossingMs(timesMs, totals, threshold90);
    const v500 = interpolateAtMs(timesMs, totals, timesMs[0] + 500);
    const firstSecondPeakKg = Math.max(...samples.filter(s => s.tMs - timesMs[0] <= 1000).map(s => s.totalKg));

    experimental = {
      note: 'Onset metrics are proxy-level due sampling and sensor constraints.',
      explosive: {
        timeTo50PctPeakMs: t50 === null ? null : t50 - timesMs[0],
        timeTo90PctPeakMs: t90 === null ? null : t90 - timesMs[0],
        firstSecondPeakKg,
        riseSlope0To500msKgS: v500 === null ? null : (v500 - baseline) / 0.5,
      },
      synergyMatrix,
    };
  } else if (protocol.id === 'advanced_repeater') {
    const onSegments = splitSegmentsBySubphase(samples);
    const peaks = onSegments.map(seg => Math.max(...seg.map(s => s.totalKg)));
    repeatedEffortDecayPct = peaks.length >= 2 && peaks[0] > 1e-9
      ? ((peaks[peaks.length - 1] - peaks[0]) / peaks[0]) * 100
      : null;
    const finalThird = peaks.slice(Math.floor(peaks.length * 2 / 3));
    const firstQuarterShares: Finger4 = [
      mean(samples.slice(0, Math.max(1, Math.floor(samples.length * 0.25))).map(s => s.fingerPct[0])),
      mean(samples.slice(0, Math.max(1, Math.floor(samples.length * 0.25))).map(s => s.fingerPct[1])),
      mean(samples.slice(0, Math.max(1, Math.floor(samples.length * 0.25))).map(s => s.fingerPct[2])),
      mean(samples.slice(0, Math.max(1, Math.floor(samples.length * 0.25))).map(s => s.fingerPct[3])),
    ];
    const lastQuarterShares: Finger4 = [
      mean(samples.slice(-Math.max(1, Math.floor(samples.length * 0.25))).map(s => s.fingerPct[0])),
      mean(samples.slice(-Math.max(1, Math.floor(samples.length * 0.25))).map(s => s.fingerPct[1])),
      mean(samples.slice(-Math.max(1, Math.floor(samples.length * 0.25))).map(s => s.fingerPct[2])),
      mean(samples.slice(-Math.max(1, Math.floor(samples.length * 0.25))).map(s => s.fingerPct[3])),
    ];

    experimental = {
      note: 'Repeater fatigue proxies are coach-facing and exploratory.',
      advancedFatigue: {
        repeatedEffortDecayPct,
        finalThirdMeanPeakKg: finalThird.length > 0 ? mean(finalThird) : null,
        strategyShiftScore:
          Math.abs(lastQuarterShares[0] - firstQuarterShares[0]) +
          Math.abs(lastQuarterShares[1] - firstQuarterShares[1]) +
          Math.abs(lastQuarterShares[2] - firstQuarterShares[2]) +
          Math.abs(lastQuarterShares[3] - firstQuarterShares[3]),
      },
      synergyMatrix,
    };
  }

  const fatigueIndex = Math.max(0, -earlyLateDropPct);
  const effortClass = classifyEffort(protocol, durationS, rfd100KgS, repeatedEffortDecayPct);
  const safetyFlags = buildSafetyFlags({
    peakTotalKg,
    rfd100KgS,
    fingerShareAtPeakPct,
    leftRightAsymmetryPct: null,
    redistributionScore,
    stabilityErrorPct,
  });

  return {
    attemptNo,
    durationS,
    samples,
    core: {
      peakTotalKg,
      peakPerFingerKg: peakPerFinger,
      fingerShareAtPeakPct,
      averageForceKg,
      best3sMeanKg,
      fullTestMeanKg,
      impulseKgS,
      impulseNs,
      forceDriftKgS,
      earlyLateDropPct,
    },
    coaching: {
      contributionDriftPct: drift,
      fatigueSlopePerFingerKgS: fatigueSlope,
      takeoverFinger,
      fadeFinger,
      stabilityErrorPct,
      fingerVariabilityPct: variability,
      balanceScore,
      fingerInitiationOrder,
      fingerDropoutOrder,
      compensationMapping,
      fingerSynergyScore,
      redistributionScore,
      underRecruitmentFlags,
    },
    advanced: {
      effortClass: effortClass ?? 'capacity',
      rfd100KgS,
      rfd200KgS,
      fatigueIndex,
      forceDriftKgS,
      fingerAsymmetryPct,
      redistributionScore,
      fingerSynergyScore,
      safetyFlags,
    },
    experimental,
  };
}

export function analyzeCompletedTest(
  protocol: TestProtocol,
  hand: Hand,
  startedAtIso: string,
  attemptsSamples: AttemptSample[][],
  targetKg: number | null,
  context?: AnalyzeContext,
): CompletedTestResult {
  const attempts = attemptsSamples.map((samples, i) =>
    analyzeAttempt(protocol, i + 1, samples, targetKg),
  );

  const peaks = attempts.map(a => a.core.peakTotalKg);
  const bestIdx = argMax(peaks);
  const bestAttempt = attempts[bestIdx];
  const peakMean = mean(peaks);
  const peakCvPct = peakMean > 1e-9 ? (std(peaks) / peakMean) * 100 : 0;
  const repeatabilityScore = clamp(100 - peakCvPct * 4, 0, 100);

  const strongestFinger = argMax([
    mean(attempts.map(a => a.core.peakPerFingerKg[0])),
    mean(attempts.map(a => a.core.peakPerFingerKg[1])),
    mean(attempts.map(a => a.core.peakPerFingerKg[2])),
    mean(attempts.map(a => a.core.peakPerFingerKg[3])),
  ]);
  const weakestContributor = argMin([
    mean(attempts.map(a => a.core.fingerShareAtPeakPct[0])),
    mean(attempts.map(a => a.core.fingerShareAtPeakPct[1])),
    mean(attempts.map(a => a.core.fingerShareAtPeakPct[2])),
    mean(attempts.map(a => a.core.fingerShareAtPeakPct[3])),
  ]);
  const biggestFadeFinger = argMin([
    mean(attempts.map(a => a.coaching.contributionDriftPct[0])),
    mean(attempts.map(a => a.coaching.contributionDriftPct[1])),
    mean(attempts.map(a => a.coaching.contributionDriftPct[2])),
    mean(attempts.map(a => a.coaching.contributionDriftPct[3])),
  ]);
  const takeoverFinger = argMax([
    mean(attempts.map(a => a.coaching.contributionDriftPct[0])),
    mean(attempts.map(a => a.coaching.contributionDriftPct[1])),
    mean(attempts.map(a => a.coaching.contributionDriftPct[2])),
    mean(attempts.map(a => a.coaching.contributionDriftPct[3])),
  ]);
  const mostStableFinger = argMin([
    mean(attempts.map(a => a.coaching.fingerVariabilityPct[0])),
    mean(attempts.map(a => a.coaching.fingerVariabilityPct[1])),
    mean(attempts.map(a => a.coaching.fingerVariabilityPct[2])),
    mean(attempts.map(a => a.coaching.fingerVariabilityPct[3])),
  ]);

  const leftRightAsymmetryPct =
    context?.oppositeHandBestPeakKg && context.oppositeHandBestPeakKg > 1e-9
      ? ((bestAttempt.core.peakTotalKg - context.oppositeHandBestPeakKg) / context.oppositeHandBestPeakKg) * 100
      : null;

  const sessionTrendPct =
    attempts.length >= 2 && attempts[0].core.peakTotalKg > 1e-9
      ? ((attempts[attempts.length - 1].core.peakTotalKg - attempts[0].core.peakTotalKg) / attempts[0].core.peakTotalKg) * 100
      : 0;

  const avgAttemptRfd100 = mean(attempts.map(attempt => attempt.advanced?.rfd100KgS ?? 0));
  const avgAttemptRfd200 = mean(attempts.map(attempt => attempt.advanced?.rfd200KgS ?? 0));
  const avgFatigueIndex = mean(attempts.map(attempt => attempt.advanced?.fatigueIndex ?? 0));
  const avgRedistributionScore = mean(attempts.map(attempt => attempt.advanced?.redistributionScore ?? 0));
  const avgSynergyScore = mean(attempts.map(attempt => attempt.advanced?.fingerSynergyScore ?? 0));
  const allSafetyFlags = attempts.flatMap(attempt => attempt.advanced?.safetyFlags ?? []);
  const normalizedPeakKgPerKgBodyweight =
    context?.profile?.weightKg && context.profile.weightKg > 1e-9
      ? bestAttempt.core.peakTotalKg / context.profile.weightKg
      : null;
  const benchmarkScore = buildBenchmarkScore({
    peakTotalKg: bestAttempt.core.peakTotalKg,
    averageForceKg: mean(attempts.map(attempt => attempt.core.averageForceKg)),
    impulseKgS: mean(attempts.map(attempt => attempt.core.impulseKgS)),
    rfd100KgS: avgAttemptRfd100,
    rfd200KgS: avgAttemptRfd200,
    fatigueIndex: avgFatigueIndex,
    forceDriftKgS: mean(attempts.map(attempt => attempt.core.forceDriftKgS)),
    fingerContributionPct: bestAttempt.core.fingerShareAtPeakPct,
    fingerAsymmetryPct:
      bestAttempt.advanced?.fingerAsymmetryPct ?? null,
    redistributionScore: avgRedistributionScore,
    stabilityScore: mean(attempts.map(attempt => attempt.coaching.balanceScore)),
    leftVsRightPct: leftRightAsymmetryPct,
  });
  const tacticalGripProfile = inferTacticalGripProfile(protocol, {
    redistributionScore: avgRedistributionScore,
    fingerSynergyScore: avgSynergyScore,
    fatigueIndex: avgFatigueIndex,
    rfd100KgS: avgAttemptRfd100,
  });

  return {
    resultId: `${protocol.id}_${new Date().toISOString().replace(/[:.]/g, '-')}`,
    protocolKind: protocol.protocolKind,
    protocolId: protocol.id,
    protocolName: protocol.name,
    builtInId: protocol.builtInId,
    tier: protocol.tier,
    hand,
    startedAtIso,
    completedAtIso: new Date().toISOString(),
    profile: context?.profile ?? null,
    benchmarkCategory: protocol.category,
    gripType: protocol.gripType,
    modality: protocol.modality,
    athleteLevel: protocol.athleteLevel,
    targetKg,
    templateId: protocol.templateId,
    templateName: protocol.templateId ? protocol.name : undefined,
    templateVersion: protocol.templateVersion,
    effectiveProtocol: protocol,
    dashboardSnapshot: context?.dashboardSnapshot ?? {
      livePanels: protocol.livePanels,
      resultWidgets: protocol.resultWidgets,
      compareDefaults: protocol.compareDefaults,
    },
    compareTags: context?.compareTags ?? {
      family: protocol.family,
      targetMode: protocol.targetMode,
      intervalMode: protocol.repeater ? 'interval' : 'continuous',
      templateId: protocol.templateId,
      templateName: protocol.templateId ? protocol.name : undefined,
    },
    attempts,
    summary: {
      bestAttemptNo: bestIdx + 1,
      strongestFinger,
      weakestContributor,
      biggestFadeFinger,
      takeoverFinger,
      mostStableFinger,
      repeatabilityScore,
      leftRightAsymmetryPct,
      sessionTrendPct,
      benchmarkScore,
      tacticalGripProfile,
      normalizedPeakKgPerKgBodyweight,
      safetyFlags: allSafetyFlags,
    },
    sessionComparison: null,
    confidence: {
      core: 'High',
      coaching: 'Moderate',
      experimental: 'Low',
    },
  };
}

export function bestPeakOfResult(result: CompletedTestResult): number {
  return Math.max(...result.attempts.map(a => a.core.peakTotalKg), 0);
}

export function buildSessionComparison(
  current: CompletedTestResult,
  previous: CompletedTestResult | null,
): CompletedTestResult['sessionComparison'] {
  if (!previous) return null;

  const currentRfd100 = mean(current.attempts.map(attempt => attempt.advanced?.rfd100KgS ?? 0));
  const previousRfd100 = mean(previous.attempts.map(attempt => attempt.advanced?.rfd100KgS ?? 0));
  const currentEndurance = mean(current.attempts.map(attempt => attempt.advanced?.fatigueIndex ?? 0));
  const previousEndurance = mean(previous.attempts.map(attempt => attempt.advanced?.fatigueIndex ?? 0));
  const currentStability = mean(current.attempts.map(attempt => attempt.coaching.balanceScore));
  const previousStability = mean(previous.attempts.map(attempt => attempt.coaching.balanceScore));

  return {
    peakDeltaPct:
      bestPeakOfResult(previous) > 1e-9
        ? ((bestPeakOfResult(current) - bestPeakOfResult(previous)) / bestPeakOfResult(previous)) * 100
        : null,
    rfd100DeltaPct:
      previousRfd100 > 1e-9
        ? ((currentRfd100 - previousRfd100) / previousRfd100) * 100
        : null,
    enduranceDeltaPct:
      previousEndurance > 1e-9
        ? ((currentEndurance - previousEndurance) / previousEndurance) * 100
        : null,
    asymmetryDeltaPct:
      current.summary.leftRightAsymmetryPct !== null && previous.summary.leftRightAsymmetryPct !== null
        ? current.summary.leftRightAsymmetryPct - previous.summary.leftRightAsymmetryPct
        : null,
    stabilityDeltaPct:
      previousStability > 1e-9
        ? ((currentStability - previousStability) / previousStability) * 100
        : null,
    takeoverPatternChanged: current.summary.takeoverFinger !== previous.summary.takeoverFinger,
  };
}
