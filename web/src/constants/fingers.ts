export const FINGER_NAMES = ['Index', 'Middle', 'Ring', 'Pinky'] as const;

export const FINGER_COLORS = [
  '#ef4444', // Index - red
  '#3b8df8', // Middle - blue
  '#22c55e', // Ring - green
  '#f59e0b', // Pinky - amber
] as const;

export const TOTAL_COLOR = '#60a5fa';

export function displayOrder(hand: string): number[] {
  return hand === 'Right' ? [0, 1, 2, 3] : [3, 2, 1, 0];
}
