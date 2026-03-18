import {
  analyzeEffortSamples,
  computeContributionDriftPctFromFingerPctSeries,
  type AnalysisConfig,
  type DeviceCapabilities,
} from '@krimblokk/core';
import type { EffortMetrics, Finger4, ForceSample, Hand } from '../types/force.ts';

export type LiveMeasurePresetId =
  | 'live_monitor'
  | 'peak_total_pull'
  | 'peak_per_finger'
  | 'rfd_pull'
  | 'drift_hold_20s'
  | 'stability_hold_20s'
  | 'custom_dashboard';

export type LiveMeasureMetricId =
  | 'live_total'
  | 'live_per_finger'
  | 'running_peak_total'
  | 'running_peak_per_finger'
  | 'current_share_pct'
  | 'last_effort_peak'
  | 'last_effort_rfd100'
  | 'last_effort_rfd200'
  | 'last_effort_avg_hold'
  | 'last_effort_distribution_drift'
  | 'last_effort_stability';

export type QuickCaptureMode = 'none' | 'single_effort' | 'timed_hold' | 'custom_dashboard';
export type QuickCaptureStatus = 'idle' | 'armed' | 'capturing';
export type QuickCaptureCompletionReason =
  | 'effort_complete'
  | 'duration_complete'
  | 'manual_stop'
  | 'ended_early'
  | 'verification_failed';

export interface QuickCaptureState {
  status: QuickCaptureStatus;
  presetId: LiveMeasurePresetId | null;
  hand: Hand | null;
  startedAtMs: number | null;
  startedAtIso: string | null;
  autoStopAtMs: number | null;
}

export interface QuickMeasureDefinition {
  id: LiveMeasurePresetId;
  label: string;
  description: string;
  helperText: string;
  captureMode: QuickCaptureMode;
  requiresPerFingerForce: boolean;
  captureDurationMs: number | null;
  chartVariant: 'balanced' | 'total_focus' | 'per_finger_focus';
}

export interface QuickMeasureMetricDefinition {
  id: LiveMeasureMetricId;
  label: string;
  description: string;
  requiresPerFingerForce: boolean;
}

export interface QuickMeasureResult {
  presetId: LiveMeasurePresetId;
  label: string;
  completionReason: QuickCaptureCompletionReason;
  capturedAtIso: string;
  startedAtMs: number;
  durationS: number;
  sampleCount: number;
  peakTotalKg: number;
  peakPerFingerKg: Finger4 | null;
  peakSharePct: Finger4 | null;
  timeToPeakS: number;
  rfd100KgS: number;
  rfd200KgS: number;
  avgHoldKg: number;
  totalForceDriftKgS: number | null;
  contributionDriftPct: Finger4 | null;
  distributionDriftPerS: number | null;
  steadinessTotalKg: number;
  perFingerVariationKg: Finger4 | null;
  stabilizationTimeS: number | null;
  analysis: EffortMetrics;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function slopeLinear(times: number[], values: number[]): number | null {
  if (times.length < 2 || values.length < 2) return null;

  const n = Math.min(times.length, values.length);
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i += 1) {
    sumX += times[i];
    sumY += values[i];
    sumXY += times[i] * values[i];
    sumX2 += times[i] * times[i];
  }

  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-9) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

function shareAtPeakPct(peakPerFingerKg: Finger4 | null, peakTotalKg: number): Finger4 | null {
  if (!peakPerFingerKg || peakTotalKg <= 1e-9) return null;
  return [
    (peakPerFingerKg[0] / peakTotalKg) * 100,
    (peakPerFingerKg[1] / peakTotalKg) * 100,
    (peakPerFingerKg[2] / peakTotalKg) * 100,
    (peakPerFingerKg[3] / peakTotalKg) * 100,
  ];
}

export const QUICK_MEASURE_PRESETS: QuickMeasureDefinition[] = [
  {
    id: 'live_monitor',
    label: 'Live Monitor',
    description: 'Continuous live view for quick checks without storing a local capture.',
    helperText: 'Watch live force, finger split, and the latest detected effort.',
    captureMode: 'none',
    requiresPerFingerForce: false,
    captureDurationMs: null,
    chartVariant: 'balanced',
  },
  {
    id: 'peak_total_pull',
    label: 'Peak Total Pull',
    description: 'Arm one short pull and capture peak total force as soon as the effort is detected.',
    helperText: 'Best for quick max-pull checks when you only need top force and timing.',
    captureMode: 'single_effort',
    requiresPerFingerForce: false,
    captureDurationMs: null,
    chartVariant: 'total_focus',
  },
  {
    id: 'peak_per_finger',
    label: 'Peak Per Finger',
    description: 'Capture one pull and break the peak out per finger at the top of the effort.',
    helperText: 'Use this on CURRENT_UNO_HX711 when you want finger peaks and peak share.',
    captureMode: 'single_effort',
    requiresPerFingerForce: true,
    captureDurationMs: null,
    chartVariant: 'per_finger_focus',
  },
  {
    id: 'rfd_pull',
    label: 'RFD Pull',
    description: 'Capture one short pull and highlight how quickly force ramps up.',
    helperText: 'Use this for fast recruitment checks with peak, RFD100, and RFD200.',
    captureMode: 'single_effort',
    requiresPerFingerForce: false,
    captureDurationMs: null,
    chartVariant: 'total_focus',
  },
  {
    id: 'drift_hold_20s',
    label: '20s Drift Hold',
    description: 'Start on the next effort and auto-stop after 20 seconds to inspect finger drift.',
    helperText: 'Shows total drift, finger contribution drift, and hold quality over a fixed 20-second window.',
    captureMode: 'timed_hold',
    requiresPerFingerForce: true,
    captureDurationMs: 20_000,
    chartVariant: 'per_finger_focus',
  },
  {
    id: 'stability_hold_20s',
    label: '20s Stability Hold',
    description: 'Start on the next effort and auto-stop after 20 seconds to inspect hold control.',
    helperText: 'Focus on steadiness, stabilization time, and average hold without turning it into a full TEST.',
    captureMode: 'timed_hold',
    requiresPerFingerForce: false,
    captureDurationMs: 20_000,
    chartVariant: 'total_focus',
  },
  {
    id: 'custom_dashboard',
    label: 'Custom Dashboard',
    description: 'Choose which live metrics you want to keep visible while monitoring force.',
    helperText: 'Live-only dashboard for quick checks. No local capture is created in this mode.',
    captureMode: 'custom_dashboard',
    requiresPerFingerForce: false,
    captureDurationMs: null,
    chartVariant: 'balanced',
  },
];

export const QUICK_MEASURE_METRICS: QuickMeasureMetricDefinition[] = [
  { id: 'live_total', label: 'Live Total', description: 'Current total force.', requiresPerFingerForce: false },
  { id: 'live_per_finger', label: 'Live Per Finger', description: 'Current per-finger kg values.', requiresPerFingerForce: true },
  { id: 'running_peak_total', label: 'Running Peak Total', description: 'Highest total force since the last clear.', requiresPerFingerForce: false },
  { id: 'running_peak_per_finger', label: 'Running Peak Per Finger', description: 'Highest per-finger force since the last clear.', requiresPerFingerForce: true },
  { id: 'current_share_pct', label: 'Current Share %', description: 'Current finger contribution percentages.', requiresPerFingerForce: true },
  { id: 'last_effort_peak', label: 'Last Effort Peak', description: 'Peak total force from the latest effort.', requiresPerFingerForce: false },
  { id: 'last_effort_rfd100', label: 'Last Effort RFD100', description: 'RFD over the first 100 ms of the latest effort.', requiresPerFingerForce: false },
  { id: 'last_effort_rfd200', label: 'Last Effort RFD200', description: 'RFD over the first 200 ms of the latest effort.', requiresPerFingerForce: false },
  { id: 'last_effort_avg_hold', label: 'Last Effort Avg Hold', description: 'Average hold force from the latest effort.', requiresPerFingerForce: false },
  { id: 'last_effort_distribution_drift', label: 'Last Effort Drift', description: 'Distribution drift from the latest effort.', requiresPerFingerForce: true },
  { id: 'last_effort_stability', label: 'Last Effort Stability', description: 'Steadiness and stabilization from the latest effort.', requiresPerFingerForce: false },
];

export const DEFAULT_CUSTOM_DASHBOARD_METRICS: LiveMeasureMetricId[] = [
  'live_total',
  'running_peak_total',
  'last_effort_peak',
  'last_effort_rfd100',
  'last_effort_avg_hold',
];

export function createIdleQuickCaptureState(): QuickCaptureState {
  return {
    status: 'idle',
    presetId: null,
    hand: null,
    startedAtMs: null,
    startedAtIso: null,
    autoStopAtMs: null,
  };
}

export function getQuickMeasureDefinition(id: LiveMeasurePresetId): QuickMeasureDefinition {
  return QUICK_MEASURE_PRESETS.find(preset => preset.id === id) ?? QUICK_MEASURE_PRESETS[0];
}

export function isQuickMeasureAvailable(
  preset: QuickMeasureDefinition | LiveMeasurePresetId,
  capabilities: DeviceCapabilities,
): boolean {
  const definition = typeof preset === 'string' ? getQuickMeasureDefinition(preset) : preset;
  return !definition.requiresPerFingerForce || capabilities.perFingerForce;
}

export function quickMeasureBlockReason(
  preset: QuickMeasureDefinition | LiveMeasurePresetId,
  capabilities: DeviceCapabilities,
): string | null {
  const definition = typeof preset === 'string' ? getQuickMeasureDefinition(preset) : preset;
  if (definition.requiresPerFingerForce && !capabilities.perFingerForce) {
    return `${definition.label} requires per-finger force data. This device provides total force only.`;
  }
  return null;
}

export function availableCustomDashboardMetrics(capabilities: DeviceCapabilities): QuickMeasureMetricDefinition[] {
  return QUICK_MEASURE_METRICS.filter(metric => !metric.requiresPerFingerForce || capabilities.perFingerForce);
}

export function normalizeCustomDashboardMetrics(
  metrics: LiveMeasureMetricId[],
  capabilities: DeviceCapabilities,
): LiveMeasureMetricId[] {
  const allowed = new Set(availableCustomDashboardMetrics(capabilities).map(metric => metric.id));
  const filtered = metrics.filter(metric => allowed.has(metric));
  if (filtered.length > 0) return filtered;
  return DEFAULT_CUSTOM_DASHBOARD_METRICS.filter(metric => allowed.has(metric));
}

export function shouldShowFingerSeriesForCustomDashboard(metrics: LiveMeasureMetricId[]): boolean {
  return metrics.some(metric =>
    metric === 'live_per_finger' ||
    metric === 'running_peak_per_finger' ||
    metric === 'current_share_pct' ||
    metric === 'last_effort_distribution_drift',
  );
}

export function resolveQuickMeasureChartVariant(
  presetId: LiveMeasurePresetId,
  customMetrics: LiveMeasureMetricId[],
): QuickMeasureDefinition['chartVariant'] {
  if (presetId === 'custom_dashboard') {
    return shouldShowFingerSeriesForCustomDashboard(customMetrics) ? 'per_finger_focus' : 'total_focus';
  }
  return getQuickMeasureDefinition(presetId).chartVariant;
}

export function buildQuickMeasureResult(args: {
  presetId: LiveMeasurePresetId;
  samples: ForceSample[];
  analysisConfig: AnalysisConfig;
  completionReason: QuickCaptureCompletionReason;
}): QuickMeasureResult | null {
  const { presetId, samples, analysisConfig, completionReason } = args;
  if (samples.length < 2) return null;

  const definition = getQuickMeasureDefinition(presetId);
  const analysis = analyzeEffortSamples(samples, 1, analysisConfig);
  const timesSec = analysis.detailTMs.map(time => time / 1000);
  const contributionDriftPct = analysis.detailFingerPct
    ? computeContributionDriftPctFromFingerPctSeries(analysis.detailFingerPct)
    : null;
  const totalForceDriftKgS = slopeLinear(timesSec, analysis.detailTotalKg);

  return {
    presetId,
    label: definition.label,
    completionReason,
    capturedAtIso: new Date().toISOString(),
    startedAtMs: analysis.startTMs,
    durationS: analysis.durationS,
    sampleCount: samples.length,
    peakTotalKg: analysis.peakTotalKg,
    peakPerFingerKg: analysis.peakPerFingerKg,
    peakSharePct: shareAtPeakPct(analysis.peakPerFingerKg, analysis.peakTotalKg),
    timeToPeakS: analysis.timeToPeakS,
    rfd100KgS: analysis.rfd100KgS,
    rfd200KgS: analysis.rfd200KgS,
    avgHoldKg: analysis.avgTotalKg,
    totalForceDriftKgS,
    contributionDriftPct,
    distributionDriftPerS: analysis.distributionDriftPerS,
    steadinessTotalKg: analysis.steadinessTotalKg,
    perFingerVariationKg: analysis.steadinessPerFingerKg,
    stabilizationTimeS: analysis.stabilizationTimeS,
    analysis,
  };
}

export function formatQuickCompletionReason(reason: QuickCaptureCompletionReason): string {
  switch (reason) {
    case 'duration_complete':
      return '20-second capture complete';
    case 'manual_stop':
      return 'Capture stopped manually';
    case 'ended_early':
      return 'Effort ended before the full timed hold';
    case 'verification_failed':
      return 'Quick capture aborted: runtime verification failed';
    default:
      return 'Effort capture complete';
  }
}

export function summarizeFingerPeaks(peakPerFingerKg: Finger4 | null): number | null {
  if (!peakPerFingerKg) return null;
  return mean(peakPerFingerKg);
}
