import { isLikelyRawCounts, type DeviceStreamMode } from './deviceCommands.ts';
import type { InputMode } from './settings.ts';
import type { DeviceCapabilities, Finger4, ForceSample } from './types.ts';

export type VerificationStatus = 'checking' | 'verified' | 'warning' | 'critical';
export type VerificationSeverity = 'warning' | 'critical';

export interface VerificationFinding {
  code:
    | 'awaiting_sample'
    | 'awaiting_mode_confirmation'
    | 'mode_confirmation_timeout'
    | 'mode_mismatch'
    | 'sample_rate_low'
    | 'sample_not_finite'
    | 'timestamp_regressed'
    | 'native_per_finger_missing'
    | 'total_force_only_shape_invalid'
    | 'total_mismatch'
    | 'tare_required'
    | 'kg_mode_looks_raw'
    | 'per_finger_display_unsupported';
  severity: VerificationSeverity;
  message: string;
}

export interface VerificationSnapshot {
  status: VerificationStatus;
  findings: VerificationFinding[];
  blockReason: string | null;
}

export interface VerificationCheckInput {
  sample: ForceSample | null;
  previousSampleTMs?: number | null;
  capabilities: DeviceCapabilities;
  inputMode: InputMode;
  sampleRateHz?: number | null;
  tareRequired?: boolean;
  requestedStreamMode?: DeviceStreamMode | null;
  confirmedStreamMode?: DeviceStreamMode | null;
  requireModeConfirmation?: boolean;
  modeConfirmationTimedOut?: boolean;
  requiresPerFingerDisplay?: boolean;
}

const LOW_SAMPLE_RATE_HZ = 20;

function sumFinger(values: Finger4 | null): number | null {
  if (!values) return null;
  return values[0] + values[1] + values[2] + values[3];
}

function maxTotalMismatch(totalKg: number): number {
  return Math.max(0.25, Math.abs(totalKg) * 0.03);
}

function streamModeLabel(mode: DeviceStreamMode | null | undefined): string {
  if (mode === 'raw') return 'RAW';
  if (mode === 'kg') return 'KG';
  return 'unknown';
}

function findFirstSeverity(
  findings: VerificationFinding[],
  severity: VerificationSeverity,
): VerificationFinding | undefined {
  return findings.find(finding => finding.severity === severity);
}

function allFinite(values: number[] | null | undefined): boolean {
  if (!values) return true;
  return values.every(value => Number.isFinite(value));
}

export function verificationAllowsLiveDisplay(status: VerificationStatus): boolean {
  return status === 'verified' || status === 'warning';
}

export function verificationBlocksStarts(status: VerificationStatus): boolean {
  return status === 'checking' || status === 'critical';
}

export function createVerificationSnapshot(
  status: VerificationStatus,
  findings: VerificationFinding[] = [],
  blockReason: string | null = null,
): VerificationSnapshot {
  return { status, findings, blockReason };
}

export function evaluateVerification(input: VerificationCheckInput): VerificationSnapshot {
  const findings: VerificationFinding[] = [];

  if (input.requiresPerFingerDisplay && !input.capabilities.perFingerForce) {
    findings.push({
      code: 'per_finger_display_unsupported',
      severity: 'critical',
      message: 'Per-finger display was requested, but this device only supports total force.',
    });
  }

  if (input.modeConfirmationTimedOut && input.requireModeConfirmation) {
    findings.push({
      code: 'mode_confirmation_timeout',
      severity: 'critical',
      message: `Timed out while waiting for firmware to confirm ${streamModeLabel(input.requestedStreamMode)} mode.`,
    });
  }

  if (input.requireModeConfirmation && input.requestedStreamMode && input.confirmedStreamMode) {
    if (input.requestedStreamMode !== input.confirmedStreamMode && input.modeConfirmationTimedOut) {
      findings.push({
        code: 'mode_mismatch',
        severity: 'critical',
        message: `Firmware reported ${streamModeLabel(input.confirmedStreamMode)} mode while ${streamModeLabel(input.requestedStreamMode)} mode was requested.`,
      });
    }
  }

  const sample = input.sample;
  if (!sample) {
    const criticalWithoutSample = findFirstSeverity(findings, 'critical');
    if (criticalWithoutSample) {
      return createVerificationSnapshot('critical', findings, criticalWithoutSample.message);
    }

    if (input.requireModeConfirmation && input.requestedStreamMode !== input.confirmedStreamMode) {
      return createVerificationSnapshot('checking', [
        {
          code: 'awaiting_mode_confirmation',
          severity: 'critical',
          message: `Waiting for firmware to confirm ${streamModeLabel(input.requestedStreamMode)} mode.`,
        },
        ...findings,
      ], `Waiting for firmware to confirm ${streamModeLabel(input.requestedStreamMode)} mode.`);
    }

    return createVerificationSnapshot('checking', [
      ...findings,
      {
        code: 'awaiting_sample',
        severity: 'critical',
        message: 'Waiting for the first verified sample.',
      },
    ], 'Waiting for the first verified sample.');
  }

  if (!Number.isFinite(sample.tMs) || !Number.isFinite(sample.totalKg) || !Number.isFinite(sample.totalN)) {
    findings.push({
      code: 'sample_not_finite',
      severity: 'critical',
      message: 'Received a sample with non-finite force values.',
    });
  }

  if (!allFinite(sample.raw) || !allFinite(sample.kg)) {
    findings.push({
      code: 'sample_not_finite',
      severity: 'critical',
      message: 'Received a sample with non-finite per-finger values.',
    });
  }

  if (input.previousSampleTMs !== null && input.previousSampleTMs !== undefined && sample.tMs < input.previousSampleTMs) {
    findings.push({
      code: 'timestamp_regressed',
      severity: 'critical',
      message: 'Sample timestamps moved backwards, so the live stream cannot be trusted.',
    });
  }

  if (input.capabilities.perFingerForce) {
    if (!sample.kg || !sample.raw) {
      findings.push({
        code: 'native_per_finger_missing',
        severity: 'critical',
        message: 'Native per-finger data is missing from the current sample.',
      });
    }
  } else if (sample.kg !== null || sample.raw !== null) {
    findings.push({
      code: 'total_force_only_shape_invalid',
      severity: 'critical',
      message: 'A total-force-only device exposed per-finger fields in the current sample.',
    });
  }

  const fingerSum = sumFinger(sample.kg);
  if (fingerSum !== null) {
    const allowedMismatch = maxTotalMismatch(sample.totalKg);
    if (Math.abs(fingerSum - sample.totalKg) > allowedMismatch) {
      findings.push({
        code: 'total_mismatch',
        severity: 'critical',
        message: 'The displayed total does not match the per-finger sum closely enough.',
      });
    }
  }

  if (input.tareRequired) {
    findings.push({
      code: 'tare_required',
      severity: 'critical',
      message: 'Tare is required before the live stream can be trusted again.',
    });
  }

  if (
    input.capabilities.perFingerForce &&
    input.inputMode === 'MODE_KG_DIRECT' &&
    input.confirmedStreamMode === 'kg' &&
    sample.raw &&
    isLikelyRawCounts(sample.raw)
  ) {
    findings.push({
      code: 'kg_mode_looks_raw',
      severity: 'critical',
      message: 'The stream looks like raw counts while KG mode is active.',
    });
  }

  if ((input.sampleRateHz ?? 0) > 0 && (input.sampleRateHz ?? 0) < LOW_SAMPLE_RATE_HZ) {
    findings.push({
      code: 'sample_rate_low',
      severity: 'warning',
      message: `Sample rate dropped below ${LOW_SAMPLE_RATE_HZ} Hz.`,
    });
  }

  const criticalFinding = findFirstSeverity(findings, 'critical');
  if (criticalFinding) {
    return createVerificationSnapshot('critical', findings, criticalFinding.message);
  }

  if (input.requireModeConfirmation && input.requestedStreamMode !== input.confirmedStreamMode) {
    return createVerificationSnapshot('checking', [
      {
        code: 'awaiting_mode_confirmation',
        severity: 'critical',
        message: `Waiting for firmware to confirm ${streamModeLabel(input.requestedStreamMode)} mode.`,
      },
      ...findings,
    ], `Waiting for firmware to confirm ${streamModeLabel(input.requestedStreamMode)} mode.`);
  }

  const warningFinding = findFirstSeverity(findings, 'warning');
  if (warningFinding) {
    return createVerificationSnapshot('warning', findings, null);
  }

  return createVerificationSnapshot('verified', findings, null);
}
