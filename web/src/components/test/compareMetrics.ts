import { FINGER_NAMES } from '../../constants/fingers.ts';
import type { CompletedTestResult, CompareMetricId } from './types.ts';

export interface CompareMetricDescriptor {
  id: CompareMetricId;
  label: string;
  unit: string;
  description: string;
  requiresFinger?: boolean;
  normalization: 'kg' | 'none';
  available: (result: CompletedTestResult) => boolean;
  getValue: (result: CompletedTestResult, fingerIdx?: number) => number | null;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function bestAttempt(result: CompletedTestResult) {
  return result.attempts[result.summary.bestAttemptNo - 1] ?? result.attempts[0] ?? null;
}

function avgStabilityError(result: CompletedTestResult): number | null {
  const values = result.attempts
    .map(attempt => attempt.coaching.stabilityErrorPct)
    .filter((value): value is number => value !== null);
  return values.length > 0 ? mean(values) : null;
}

function avgFingerMetric(result: CompletedTestResult, picker: (resultIdx: number) => number): number {
  const values = result.attempts.map((_, resultIdx) => picker(resultIdx));
  return mean(values);
}

function hasPerFingerCapability(result: CompletedTestResult): boolean {
  return result.capabilities?.perFingerForce !== false;
}

function avgExperimentalMetric(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return filtered.length > 0 ? mean(filtered) : null;
}

export const COMPARE_METRICS: CompareMetricDescriptor[] = [
  {
    id: 'best_peak_total_kg',
    label: 'Best Peak Total',
    unit: 'kg',
    description: 'Best total peak force from the test.',
    normalization: 'kg',
    available: result => result.attempts.length > 0,
    getValue: result => Math.max(...result.attempts.map(attempt => attempt.core.peakTotalKg), 0),
  },
  {
    id: 'best_3s_mean_kg',
    label: 'Best 3s Mean',
    unit: 'kg',
    description: 'Best 3-second mean from the best attempt.',
    normalization: 'kg',
    available: result => result.attempts.length > 0,
    getValue: result => bestAttempt(result)?.core.best3sMeanKg ?? null,
  },
  {
    id: 'full_test_mean_kg',
    label: 'Full Test Mean',
    unit: 'kg',
    description: 'Average force across the best attempt.',
    normalization: 'kg',
    available: result => result.attempts.length > 0,
    getValue: result => bestAttempt(result)?.core.fullTestMeanKg ?? null,
  },
  {
    id: 'repeatability_score',
    label: 'Repeatability Score',
    unit: '/100',
    description: 'Repeatability score across attempts.',
    normalization: 'none',
    available: result => result.attempts.length > 0,
    getValue: result => result.summary.repeatabilityScore,
  },
  {
    id: 'session_trend_pct',
    label: 'Session Trend',
    unit: '%',
    description: 'Change from first to last attempt peak.',
    normalization: 'none',
    available: result => result.attempts.length > 1,
    getValue: result => result.summary.sessionTrendPct,
  },
  {
    id: 'left_right_asymmetry_pct',
    label: 'L/R Asymmetry',
    unit: '%',
    description: 'Difference vs opposite-hand reference.',
    normalization: 'none',
    available: result => result.summary.leftRightAsymmetryPct !== null,
    getValue: result => result.summary.leftRightAsymmetryPct,
  },
  {
    id: 'balance_score',
    label: 'Balance Score',
    unit: '/100',
    description: 'Average balance score across attempts.',
    normalization: 'none',
    available: result => result.attempts.length > 0,
    getValue: result => mean(result.attempts.map(attempt => attempt.coaching.balanceScore)),
  },
  {
    id: 'stability_error_pct',
    label: 'Stability Error',
    unit: '%',
    description: 'Average target stability error where target data exists.',
    normalization: 'none',
    available: result => avgStabilityError(result) !== null,
    getValue: result => avgStabilityError(result),
  },
  {
    id: 'finger_peak_kg',
    label: 'Finger Peak',
    unit: 'kg',
    description: 'Best attempt peak for the selected finger.',
    requiresFinger: true,
    normalization: 'kg',
    available: result => result.attempts.length > 0 && hasPerFingerCapability(result),
    getValue: (result, fingerIdx = 0) => bestAttempt(result)?.core.peakPerFingerKg[fingerIdx] ?? null,
  },
  {
    id: 'finger_share_pct',
    label: 'Finger Share at Peak',
    unit: '%',
    description: 'Average share at peak for the selected finger.',
    requiresFinger: true,
    normalization: 'none',
    available: result => result.attempts.length > 0 && hasPerFingerCapability(result),
    getValue: (result, fingerIdx = 0) =>
      avgFingerMetric(result, attemptIdx => result.attempts[attemptIdx].core.fingerShareAtPeakPct[fingerIdx]),
  },
  {
    id: 'finger_drift_pct',
    label: 'Finger Contribution Drift',
    unit: '%',
    description: 'Average contribution drift for the selected finger.',
    requiresFinger: true,
    normalization: 'none',
    available: result => result.attempts.length > 0 && hasPerFingerCapability(result),
    getValue: (result, fingerIdx = 0) =>
      avgFingerMetric(result, attemptIdx => result.attempts[attemptIdx].coaching.contributionDriftPct[fingerIdx]),
  },
  {
    id: 'finger_fatigue_slope_kg_s',
    label: 'Finger Fatigue Slope',
    unit: 'kg/s',
    description: 'Average per-finger fatigue slope across attempts.',
    requiresFinger: true,
    normalization: 'kg',
    available: result => result.attempts.length > 0 && hasPerFingerCapability(result),
    getValue: (result, fingerIdx = 0) =>
      avgFingerMetric(result, attemptIdx => result.attempts[attemptIdx].coaching.fatigueSlopePerFingerKgS[fingerIdx]),
  },
  {
    id: 'explosive_time_to_50_pct_peak_ms',
    label: 'Explosive Time to 50% Peak',
    unit: 'ms',
    description: 'Average time to 50% peak for explosive outputs.',
    normalization: 'none',
    available: result => avgExperimentalMetric(
      result.attempts.map(attempt => attempt.experimental?.explosive?.timeTo50PctPeakMs),
    ) !== null,
    getValue: result => avgExperimentalMetric(
      result.attempts.map(attempt => attempt.experimental?.explosive?.timeTo50PctPeakMs),
    ),
  },
  {
    id: 'explosive_time_to_90_pct_peak_ms',
    label: 'Explosive Time to 90% Peak',
    unit: 'ms',
    description: 'Average time to 90% peak for explosive outputs.',
    normalization: 'none',
    available: result => avgExperimentalMetric(
      result.attempts.map(attempt => attempt.experimental?.explosive?.timeTo90PctPeakMs),
    ) !== null,
    getValue: result => avgExperimentalMetric(
      result.attempts.map(attempt => attempt.experimental?.explosive?.timeTo90PctPeakMs),
    ),
  },
  {
    id: 'explosive_rise_slope_0_500ms_kg_s',
    label: 'Explosive 0-500ms Slope',
    unit: 'kg/s',
    description: 'Average 0-500ms rise slope for explosive outputs.',
    normalization: 'kg',
    available: result => avgExperimentalMetric(
      result.attempts.map(attempt => attempt.experimental?.explosive?.riseSlope0To500msKgS),
    ) !== null,
    getValue: result => avgExperimentalMetric(
      result.attempts.map(attempt => attempt.experimental?.explosive?.riseSlope0To500msKgS),
    ),
  },
  {
    id: 'advanced_repeated_effort_decay_pct',
    label: 'Repeated Effort Decay',
    unit: '%',
    description: 'Decay between first and last repeated efforts.',
    normalization: 'none',
    available: result => avgExperimentalMetric(
      result.attempts.map(attempt => attempt.experimental?.advancedFatigue?.repeatedEffortDecayPct),
    ) !== null,
    getValue: result => avgExperimentalMetric(
      result.attempts.map(attempt => attempt.experimental?.advancedFatigue?.repeatedEffortDecayPct),
    ),
  },
  {
    id: 'advanced_final_third_mean_peak_kg',
    label: 'Final Third Mean Peak',
    unit: 'kg',
    description: 'Average final-third mean peak from repeater-style outputs.',
    normalization: 'kg',
    available: result => avgExperimentalMetric(
      result.attempts.map(attempt => attempt.experimental?.advancedFatigue?.finalThirdMeanPeakKg),
    ) !== null,
    getValue: result => avgExperimentalMetric(
      result.attempts.map(attempt => attempt.experimental?.advancedFatigue?.finalThirdMeanPeakKg),
    ),
  },
];

export function getCompareMetric(metricId: CompareMetricId): CompareMetricDescriptor {
  return COMPARE_METRICS.find(metric => metric.id === metricId) ?? COMPARE_METRICS[0];
}

export function compareMetricLabel(metricId: CompareMetricId, fingerIdx?: number | null): string {
  const metric = getCompareMetric(metricId);
  if (!metric.requiresFinger || fingerIdx === null || fingerIdx === undefined) return metric.label;
  return `${metric.label} (${FINGER_NAMES[fingerIdx]})`;
}
