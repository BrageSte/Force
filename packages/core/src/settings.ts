import type { Finger4, Hand } from './types.ts';

export type InputMode = 'MODE_KG_DIRECT' | 'MODE_RAW';
export type SmoothingMode = 'NONE' | 'EMA' | 'MOVING_AVG';
export type SourceKind = 'Serial' | 'Simulator' | 'BLE_UART' | 'Tindeq';

export interface CalibrationData {
  offsets: number[];
  scales: number[];
}

export interface AppSettings {
  inputMode: InputMode;
  preferredSource: SourceKind;
  handDefault: Hand;
  aiCoachingEnabled: boolean;

  smoothingMode: SmoothingMode;
  smoothingAlpha: number;
  smoothingWindow: number;

  ringBufferSeconds: number;

  startThresholdKg: number;
  stopThresholdKg: number;
  startHoldMs: number;
  stopHoldMs: number;

  tutThresholdKg: number;
  holdPeakFraction: number;
  stabilizationShiftThreshold: number;
  stabilizationHoldMs: number;

  calibration: CalibrationData;
}

const DEFAULT_CALIBRATION: CalibrationData = {
  offsets: [0, 0, 0, 0],
  scales: [1e-5, 1e-5, 1e-5, 1e-5],
};

export const DEFAULT_SETTINGS: AppSettings = {
  inputMode: 'MODE_KG_DIRECT',
  preferredSource: 'Serial',
  handDefault: 'Right',
  aiCoachingEnabled: false,

  smoothingMode: 'EMA',
  smoothingAlpha: 0.25,
  smoothingWindow: 5,

  ringBufferSeconds: 50,

  startThresholdKg: 0.5,
  stopThresholdKg: 0.2,
  startHoldMs: 150,
  stopHoldMs: 300,

  tutThresholdKg: 0.5,
  holdPeakFraction: 0.9,
  stabilizationShiftThreshold: 0.8,
  stabilizationHoldMs: 250,

  calibration: DEFAULT_CALIBRATION,
};

function clampFinite(value: unknown, fallback: number, min?: number, max?: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (min !== undefined && parsed < min) return min;
  if (max !== undefined && parsed > max) return max;
  return parsed;
}

function isInputMode(value: unknown): value is InputMode {
  return value === 'MODE_KG_DIRECT' || value === 'MODE_RAW';
}

function isSmoothingMode(value: unknown): value is SmoothingMode {
  return value === 'NONE' || value === 'EMA' || value === 'MOVING_AVG';
}

function isSourceKind(value: unknown): value is SourceKind {
  return value === 'Serial' || value === 'Simulator' || value === 'BLE_UART' || value === 'Tindeq';
}

function isHand(value: unknown): value is Hand {
  return value === 'Right' || value === 'Left';
}

function normalizeFingerArray(
  value: unknown,
  fallback: Finger4,
  minimum?: number,
): Finger4 {
  if (!Array.isArray(value) || value.length !== 4) return [...fallback] as Finger4;
  const out = value.map((entry, index) =>
    clampFinite(entry, fallback[index], minimum),
  );
  return [out[0], out[1], out[2], out[3]];
}

export function normalizeCalibrationData(data?: unknown): CalibrationData {
  if (!data || typeof data !== 'object') {
    return {
      offsets: [...DEFAULT_CALIBRATION.offsets],
      scales: [...DEFAULT_CALIBRATION.scales],
    };
  }

  const input = data as Partial<CalibrationData>;
  return {
    offsets: normalizeFingerArray(input.offsets, [0, 0, 0, 0]),
    scales: normalizeFingerArray(input.scales, [1e-5, 1e-5, 1e-5, 1e-5], 0),
  };
}

export function normalizeAppSettings(raw: unknown): AppSettings {
  const data = raw && typeof raw === 'object' ? (raw as Partial<AppSettings>) : {};

  return {
    inputMode: isInputMode(data.inputMode) ? data.inputMode : DEFAULT_SETTINGS.inputMode,
    preferredSource: isSourceKind(data.preferredSource) ? data.preferredSource : DEFAULT_SETTINGS.preferredSource,
    handDefault: isHand(data.handDefault) ? data.handDefault : DEFAULT_SETTINGS.handDefault,
    aiCoachingEnabled: Boolean(data.aiCoachingEnabled),

    smoothingMode: isSmoothingMode(data.smoothingMode) ? data.smoothingMode : DEFAULT_SETTINGS.smoothingMode,
    smoothingAlpha: clampFinite(data.smoothingAlpha, DEFAULT_SETTINGS.smoothingAlpha, 0.01, 0.99),
    smoothingWindow: Math.max(1, Math.round(clampFinite(data.smoothingWindow, DEFAULT_SETTINGS.smoothingWindow, 1))),

    ringBufferSeconds: Math.max(15, Math.round(clampFinite(data.ringBufferSeconds, DEFAULT_SETTINGS.ringBufferSeconds, 15))),

    startThresholdKg: clampFinite(data.startThresholdKg, DEFAULT_SETTINGS.startThresholdKg, 0),
    stopThresholdKg: clampFinite(data.stopThresholdKg, DEFAULT_SETTINGS.stopThresholdKg, 0),
    startHoldMs: Math.max(0, Math.round(clampFinite(data.startHoldMs, DEFAULT_SETTINGS.startHoldMs, 0))),
    stopHoldMs: Math.max(0, Math.round(clampFinite(data.stopHoldMs, DEFAULT_SETTINGS.stopHoldMs, 0))),

    tutThresholdKg: clampFinite(data.tutThresholdKg, DEFAULT_SETTINGS.tutThresholdKg, 0),
    holdPeakFraction: clampFinite(data.holdPeakFraction, DEFAULT_SETTINGS.holdPeakFraction, 0.1, 1),
    stabilizationShiftThreshold: clampFinite(
      data.stabilizationShiftThreshold,
      DEFAULT_SETTINGS.stabilizationShiftThreshold,
      0,
    ),
    stabilizationHoldMs: Math.max(
      0,
      Math.round(clampFinite(data.stabilizationHoldMs, DEFAULT_SETTINGS.stabilizationHoldMs, 0)),
    ),

    calibration: normalizeCalibrationData(data.calibration),
  };
}
