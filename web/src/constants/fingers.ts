import type { Finger4, Hand } from '../types/force.ts';

export const FINGER_NAMES = ['Index', 'Middle', 'Ring', 'Pinky'] as const;
export const CANONICAL_FINGER_ORDER = [0, 1, 2, 3] as const;

export const FINGER_COLORS = [
  '#ef4444', // Index - red
  '#3b8df8', // Middle - blue
  '#22c55e', // Ring - green
  '#f59e0b', // Pinky - amber
] as const;

export const TOTAL_COLOR = '#60a5fa';

// Measurement data is always normalized to canonical anatomical order:
// [Index, Middle, Ring, Pinky].
export function displayFingerOrder(hand: Hand | string): number[] {
  return hand === 'Right' ? [0, 1, 2, 3] : [3, 2, 1, 0];
}

// The physical channel order differs by hand, so we map from canonical finger
// index to the measurement channel index exactly once near sample ingestion.
export function measurementIndexForCanonicalFinger(hand: Hand | string, fingerIndex: number): number {
  return hand === 'Right' ? fingerIndex : 3 - fingerIndex;
}

export function channelNumberForFinger(hand: Hand | string, fingerIndex: number): 1 | 2 | 3 | 4 {
  return (measurementIndexForCanonicalFinger(hand, fingerIndex) + 1) as 1 | 2 | 3 | 4;
}

export function remapMeasurementToCanonicalFingers(hand: Hand | string, values: Finger4): Finger4 {
  return [
    values[measurementIndexForCanonicalFinger(hand, 0)],
    values[measurementIndexForCanonicalFinger(hand, 1)],
    values[measurementIndexForCanonicalFinger(hand, 2)],
    values[measurementIndexForCanonicalFinger(hand, 3)],
  ];
}

export function displayOrder(hand: Hand | string): number[] {
  return displayFingerOrder(hand);
}

export function channelIndexForFinger(hand: Hand | string, fingerIndex: number): number {
  return measurementIndexForCanonicalFinger(hand, fingerIndex);
}

export function remapChannelsToFingers(hand: Hand | string, values: Finger4): Finger4 {
  return remapMeasurementToCanonicalFingers(hand, values);
}
