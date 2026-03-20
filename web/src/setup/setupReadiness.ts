import type { DeviceCapabilities, VerificationStatus } from '@krimblokk/core';
import type { CompletedTestResult } from '../components/test/types.ts';
import type { UserProfile } from '../types/profile.ts';
import type { InputMode, SourceKind } from '../types/settings.ts';

export type SetupReadinessState =
  | 'profile_basics_missing'
  | 'device_disconnected'
  | 'verification_checking'
  | 'verification_blocked'
  | 'raw_mode_needs_tare_or_calibration'
  | 'first_benchmark_missing'
  | 'ready';

export type SetupChecklistTarget = 'profile' | 'settings' | 'test';
export type SetupChecklistTone = 'info' | 'warning' | 'danger';

export interface SetupChecklistItem {
  state: Exclude<SetupReadinessState, 'ready'>;
  tone: SetupChecklistTone;
  title: string;
  summary: string;
  ctaLabel: string;
  ctaTarget: SetupChecklistTarget;
}

export interface SetupReadinessReport {
  ready: boolean;
  primaryState: SetupReadinessState;
  states: SetupReadinessState[];
  items: SetupChecklistItem[];
  title: string;
  summary: string;
}

export interface SetupReadinessInput {
  profile: UserProfile | null;
  testResults: CompletedTestResult[];
  connected: boolean;
  deviceCapabilities: DeviceCapabilities;
  inputMode: InputMode;
  sourceKind: SourceKind;
  verificationStatus: VerificationStatus;
  verificationReason: string | null;
  tareRequired: boolean;
  calibrationScales: number[];
}

const GENERIC_PROFILE_NAME_RE = /^person(?:\s+\d+)?$/i;

function profileNameNeedsAttention(profile: UserProfile | null): boolean {
  if (!profile) return true;
  const trimmed = profile.name.trim();
  return trimmed.length === 0 || GENERIC_PROFILE_NAME_RE.test(trimmed);
}

function profileBasicsMissing(profile: UserProfile | null): boolean {
  if (!profile) return true;
  return profileNameNeedsAttention(profile) || profile.weightKg === null;
}

function hasStandardMaxBenchmark(results: CompletedTestResult[], profile: UserProfile | null): boolean {
  if (!profile) return false;
  return results.some(result =>
    result.protocolId === 'standard_max' && result.profile?.profileId === profile.profileId,
  );
}

function calibrationMissing(scales: number[]): boolean {
  return scales.some(scale => !Number.isFinite(scale) || scale <= 0);
}

function rawSetupMissing(input: SetupReadinessInput): boolean {
  if (!input.deviceCapabilities.perFingerForce) return false;
  if (input.inputMode !== 'MODE_RAW') return false;
  return input.tareRequired || calibrationMissing(input.calibrationScales);
}

function rawSetupSummary(input: SetupReadinessInput): string {
  const needsCalibration = calibrationMissing(input.calibrationScales);
  if (input.tareRequired && needsCalibration) {
    return 'Capture a fresh tare with no load and finish raw calibration before trusting LIVE, TEST or TRAIN.';
  }
  if (input.tareRequired) {
    return 'The raw stream is active, but the current zero point is not trusted yet. Re-tare before recording or benchmarking.';
  }
  if (needsCalibration) {
    return 'Raw mode is selected, but one or more channel scales are missing. Finish calibration before using per-finger force.';
  }
  return 'Review raw setup before continuing.';
}

export function deriveSetupReadiness(input: SetupReadinessInput): SetupReadinessReport {
  const items: SetupChecklistItem[] = [];

  if (input.connected && input.verificationStatus === 'critical') {
    items.push({
      state: 'verification_blocked',
      tone: 'danger',
      title: 'Resolve the verification block',
      summary: input.verificationReason ?? 'The live stream is blocked until runtime verification succeeds again.',
      ctaLabel: 'Open SETTINGS',
      ctaTarget: 'settings',
    });
  } else if (input.connected && input.verificationStatus === 'checking') {
    items.push({
      state: 'verification_checking',
      tone: 'info',
      title: 'Wait for stream verification',
      summary: input.verificationReason ?? 'The app is waiting for the first verified sample before it unlocks force display and starts.',
      ctaLabel: 'Review SETTINGS',
      ctaTarget: 'settings',
    });
  }

  if (!input.connected) {
    items.push({
      state: 'device_disconnected',
      tone: 'warning',
      title: 'Connect your device',
      summary: input.sourceKind === 'Tindeq'
        ? 'Tindeq stays total-force-only. Connect it before you rely on LIVE, TEST or TRAIN.'
        : 'Connect the active device so LIVE can verify the stream and unlock measurement.',
      ctaLabel: 'Open SETTINGS',
      ctaTarget: 'settings',
    });
  }

  if (rawSetupMissing(input)) {
    items.push({
      state: 'raw_mode_needs_tare_or_calibration',
      tone: 'warning',
      title: 'Finish raw setup',
      summary: rawSetupSummary(input),
      ctaLabel: 'Fix in SETTINGS',
      ctaTarget: 'settings',
    });
  }

  if (profileBasicsMissing(input.profile)) {
    items.push({
      state: 'profile_basics_missing',
      tone: 'warning',
      title: 'Finish profile basics',
      summary: 'Add a clear profile name and bodyweight so saved results, comparisons and coaching have useful context.',
      ctaLabel: 'Open PROFILE',
      ctaTarget: 'profile',
    });
  }

  if (!hasStandardMaxBenchmark(input.testResults, input.profile)) {
    items.push({
      state: 'first_benchmark_missing',
      tone: 'info',
      title: 'Run your first core benchmark',
      summary: 'Start with Max Strength Benchmark in TEST to establish baseline numbers for progress and auto-targets.',
      ctaLabel: 'Go to TEST',
      ctaTarget: 'test',
    });
  }

  if (items.length === 0) {
    return {
      ready: true,
      primaryState: 'ready',
      states: ['ready'],
      items: [],
      title: 'Setup ready',
      summary: 'Profile, device and benchmark basics are in place. You can stay in LIVE or move into TEST and TRAIN.',
    };
  }

  return {
    ready: false,
    primaryState: items[0].state,
    states: items.map(item => item.state),
    items,
    title: 'Complete setup',
    summary: 'Finish the remaining setup tasks so LIVE, TEST and TRAIN can rely on verified data and profile context.',
  };
}
