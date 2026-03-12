import type { Finger4 } from './types.ts';
import type { CalibrationData } from './settings.ts';
import { normalizeCalibrationData } from './settings.ts';

export function createCalibration(data?: CalibrationData | null): CalibrationData {
  return normalizeCalibrationData(data);
}

export function rawToKg(calibration: CalibrationData, raw: Finger4): Finger4 {
  const cal = normalizeCalibrationData(calibration);
  return [
    (raw[0] - cal.offsets[0]) * cal.scales[0],
    (raw[1] - cal.offsets[1]) * cal.scales[1],
    (raw[2] - cal.offsets[2]) * cal.scales[2],
    (raw[3] - cal.offsets[3]) * cal.scales[3],
  ];
}

export function tareAll(calibration: CalibrationData, raw: Finger4): CalibrationData {
  const cal = normalizeCalibrationData(calibration);
  return {
    offsets: [raw[0], raw[1], raw[2], raw[3]],
    scales: [...cal.scales],
  };
}

export function tareFinger(calibration: CalibrationData, idx: number, rawValue: number): CalibrationData {
  const cal = normalizeCalibrationData(calibration);
  const offsets = [...cal.offsets];
  offsets[idx] = rawValue;
  return {
    offsets,
    scales: [...cal.scales],
  };
}

export function calibrateFinger(
  calibration: CalibrationData,
  idx: number,
  tareRaw: number,
  loadedRaw: number,
  knownKg: number,
): CalibrationData {
  const cal = normalizeCalibrationData(calibration);
  const delta = loadedRaw - tareRaw;
  if (Math.abs(delta) < 1e-9) {
    throw new Error('Delta too small; check load and wiring.');
  }
  if (!Number.isFinite(knownKg) || Math.abs(knownKg) < 1e-9) {
    throw new Error('Known kg must be non-zero.');
  }

  const offsets = [...cal.offsets];
  const scales = [...cal.scales];
  offsets[idx] = tareRaw;
  scales[idx] = knownKg / delta;

  return { offsets, scales };
}
