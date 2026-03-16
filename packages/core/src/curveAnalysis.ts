export type CurveSeries4 = [number[], number[], number[], number[]];

export interface ForceCurveInput {
  timesMs: number[];
  totalKg: number[];
  fingerKg: CurveSeries4;
  fingerPct?: CurveSeries4 | null;
}

export interface CurveSeriesMetrics {
  peakKg: number;
  meanKg: number;
  timeToPeakMs: number | null;
  rfd100KgS: number;
  rfd200KgS: number;
  maxRiseRateKgS: number;
}

export interface ForceCurveAnalysis {
  timesMs: number[];
  totalKg: number[];
  fingerKg: CurveSeries4;
  fingerPct: CurveSeries4 | null;
  totalRateKgS: number[];
  fingerRateKgS: CurveSeries4;
  totalMetrics: CurveSeriesMetrics;
  fingerMetrics: [
    CurveSeriesMetrics,
    CurveSeriesMetrics,
    CurveSeriesMetrics,
    CurveSeriesMetrics,
  ];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampLength(input: ForceCurveInput): number {
  const lengths = [
    input.timesMs.length,
    input.totalKg.length,
    ...input.fingerKg.map(series => series.length),
  ];
  if (input.fingerPct) {
    lengths.push(...input.fingerPct.map(series => series.length));
  }
  return Math.max(0, Math.min(...lengths));
}

function truncateSeries(series: CurveSeries4, size: number): CurveSeries4 {
  return [
    series[0].slice(0, size),
    series[1].slice(0, size),
    series[2].slice(0, size),
    series[3].slice(0, size),
  ];
}

function interpAtMs(timesMs: number[], values: number[], targetMs: number): number {
  if (timesMs.length === 0 || values.length === 0) return 0;
  if (targetMs <= timesMs[0]) return values[0] ?? 0;
  if (targetMs >= timesMs[timesMs.length - 1]) return values[values.length - 1] ?? 0;

  for (let i = 1; i < timesMs.length; i += 1) {
    const currentTime = timesMs[i];
    if (targetMs <= currentTime) {
      const prevTime = timesMs[i - 1];
      const prevValue = values[i - 1] ?? 0;
      const currentValue = values[i] ?? prevValue;
      const dtMs = currentTime - prevTime;
      if (dtMs <= 0) return currentValue;
      const alpha = (targetMs - prevTime) / dtMs;
      return prevValue + (currentValue - prevValue) * alpha;
    }
  }

  return values[values.length - 1] ?? 0;
}

function movingAverage(values: number[], radius: number): number[] {
  if (values.length <= 2 || radius <= 0) return [...values];
  const smoothed: number[] = [];

  for (let index = 0; index < values.length; index += 1) {
    const start = Math.max(0, index - radius);
    const end = Math.min(values.length - 1, index + radius);
    let total = 0;
    let count = 0;

    for (let cursor = start; cursor <= end; cursor += 1) {
      total += values[cursor] ?? 0;
      count += 1;
    }

    smoothed.push(count > 0 ? total / count : values[index] ?? 0);
  }

  return smoothed;
}

function buildRateSeries(timesMs: number[], values: number[]): number[] {
  if (timesMs.length === 0 || values.length === 0) return [];
  if (timesMs.length === 1) return [0];

  const radius = timesMs.length >= 8 ? 2 : 1;
  const smoothed = movingAverage(values, radius);
  const rate: number[] = [];

  for (let index = 0; index < smoothed.length; index += 1) {
    const prevIndex = index === 0 ? 0 : index - 1;
    const nextIndex = index === smoothed.length - 1 ? smoothed.length - 1 : index + 1;
    const dtSeconds = Math.max(1e-6, (timesMs[nextIndex] - timesMs[prevIndex]) / 1000);
    const dv = (smoothed[nextIndex] ?? 0) - (smoothed[prevIndex] ?? 0);
    rate.push(dv / dtSeconds);
  }

  return rate.map(value => (Number.isFinite(value) ? value : 0));
}

function metricsForSeries(timesMs: number[], values: number[], rateKgS: number[]): CurveSeriesMetrics {
  if (timesMs.length === 0 || values.length === 0) {
    return {
      peakKg: 0,
      meanKg: 0,
      timeToPeakMs: null,
      rfd100KgS: 0,
      rfd200KgS: 0,
      maxRiseRateKgS: 0,
    };
  }

  let peakIndex = 0;
  for (let index = 1; index < values.length; index += 1) {
    if ((values[index] ?? 0) > (values[peakIndex] ?? 0)) {
      peakIndex = index;
    }
  }

  const startTimeMs = timesMs[0] ?? 0;
  const baseline = values[0] ?? 0;
  const rfd100KgS = (interpAtMs(timesMs, values, startTimeMs + 100) - baseline) / 0.1;
  const rfd200KgS = (interpAtMs(timesMs, values, startTimeMs + 200) - baseline) / 0.2;

  return {
    peakKg: values[peakIndex] ?? 0,
    meanKg: mean(values),
    timeToPeakMs: (timesMs[peakIndex] ?? startTimeMs) - startTimeMs,
    rfd100KgS: Number.isFinite(rfd100KgS) ? rfd100KgS : 0,
    rfd200KgS: Number.isFinite(rfd200KgS) ? rfd200KgS : 0,
    maxRiseRateKgS: rateKgS.length > 0 ? Math.max(...rateKgS) : 0,
  };
}

export function analyzeForceCurve(input: ForceCurveInput): ForceCurveAnalysis {
  const size = clampLength(input);
  const timesMs = input.timesMs.slice(0, size);
  const totalKg = input.totalKg.slice(0, size);
  const fingerKg = truncateSeries(input.fingerKg, size);
  const fingerPct = input.fingerPct ? truncateSeries(input.fingerPct, size) : null;

  const totalRateKgS = buildRateSeries(timesMs, totalKg);
  const fingerRateKgS: CurveSeries4 = [
    buildRateSeries(timesMs, fingerKg[0]),
    buildRateSeries(timesMs, fingerKg[1]),
    buildRateSeries(timesMs, fingerKg[2]),
    buildRateSeries(timesMs, fingerKg[3]),
  ];

  return {
    timesMs,
    totalKg,
    fingerKg,
    fingerPct,
    totalRateKgS,
    fingerRateKgS,
    totalMetrics: metricsForSeries(timesMs, totalKg, totalRateKgS),
    fingerMetrics: [
      metricsForSeries(timesMs, fingerKg[0], fingerRateKgS[0]),
      metricsForSeries(timesMs, fingerKg[1], fingerRateKgS[1]),
      metricsForSeries(timesMs, fingerKg[2], fingerRateKgS[2]),
      metricsForSeries(timesMs, fingerKg[3], fingerRateKgS[3]),
    ],
  };
}
