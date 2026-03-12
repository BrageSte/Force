import type { EffortMetrics, ForceSample, SessionSummary, Hand } from './types.ts';
import type { AnalysisConfig } from './metrics.ts';
import type { SegmenterConfig } from './segmentation.ts';
import { analyzeEffortSamples } from './metrics.ts';
import { segmentEfforts } from './segmentation.ts';

function linearRegressionSlope(values: number[]): number {
  if (values.length < 2) return 0;
  const count = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < count; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const denominator = count * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 1e-12) return 0;
  return (count * sumXY - sumX * sumY) / denominator;
}

export function analyzeSession(
  samples: ForceSample[],
  hand: Hand,
  segmentCfg: SegmenterConfig,
  analysisCfg: AnalysisConfig,
  sessionId: string,
  startedAtIso: string,
  endedAtIso?: string,
): { efforts: EffortMetrics[]; summary: SessionSummary } {
  const ended = endedAtIso ?? new Date().toISOString();
  const ranges = segmentEfforts(samples, segmentCfg);
  const efforts: EffortMetrics[] = [];

  for (let i = 0; i < ranges.length; i++) {
    const [startIdx, endIdx] = ranges[i];
    const segment = samples.slice(startIdx, endIdx + 1);
    if (segment.length < 2) continue;
    efforts.push(analyzeEffortSamples(segment, i + 1, analysisCfg));
  }

  const peaks = efforts.map(effort => effort.peakTotalKg);
  const fatigueSlopeKgPerEffort = linearRegressionSlope(peaks);

  let bestPeakKg = 0;
  let avgPeakKg = 0;
  let firstToLastDropPct = 0;
  if (peaks.length > 0) {
    bestPeakKg = Math.max(...peaks);
    avgPeakKg = peaks.reduce((sum, value) => sum + value, 0) / peaks.length;
    if (peaks.length >= 2 && peaks[0] > 1e-9) {
      firstToLastDropPct = ((peaks[peaks.length - 1] - peaks[0]) / peaks[0]) * 100;
    }
  }

  return {
    efforts,
    summary: {
      sessionId,
      startedAtIso,
      endedAtIso: ended,
      hand,
      effortsCount: efforts.length,
      bestPeakKg,
      avgPeakKg,
      fatigueSlopeKgPerEffort,
      firstToLastDropPct,
    },
  };
}
