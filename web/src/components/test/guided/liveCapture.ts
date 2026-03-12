import type { Finger4 } from '@krimblokk/core';
import type { AttemptSample, TestProtocol } from '../types.ts';

export interface GuidedCaptureFrame {
  latestMeasuredTotalKg: number;
  latestMeasuredKg: Finger4;
  latestMeasuredPct: Finger4;
}

export function polylinePath(values: number[], width: number, height: number, maxY: number): string {
  if (values.length === 0) return '';
  const count = values.length;
  return values
    .map((value, index) => {
      const x = count <= 1 ? 0 : (index / (count - 1)) * width;
      const y = height - (Math.max(0, value) / Math.max(1e-6, maxY)) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function bestPeakOfAttempts(attempts: AttemptSample[][]): number | null {
  if (attempts.length === 0) return null;
  let best = 0;
  for (const attempt of attempts) {
    for (const sample of attempt) {
      best = Math.max(best, sample.totalKg);
    }
  }
  return best > 0 ? best : null;
}

export function buildAttemptSample(
  elapsedMs: number,
  totalKg: number,
  fingerKg: Finger4,
  fingerPct: Finger4,
  protocol: TestProtocol,
): AttemptSample {
  let subPhase: AttemptSample['subPhase'];
  if (protocol.repeater) {
    const cycleMs = (protocol.repeater.onSec + protocol.repeater.offSec) * 1000;
    const inCycleMs = elapsedMs % cycleMs;
    subPhase = inCycleMs <= protocol.repeater.onSec * 1000 ? 'on' : 'off';
  }

  return {
    tMs: elapsedMs,
    totalKg,
    fingerKg,
    fingerPct,
    subPhase,
  };
}

export function buildAttemptSampleFromMeasuredFrame(
  elapsedMs: number,
  frame: GuidedCaptureFrame,
  protocol: TestProtocol,
): AttemptSample {
  return buildAttemptSample(
    elapsedMs,
    frame.latestMeasuredTotalKg,
    frame.latestMeasuredKg,
    frame.latestMeasuredPct,
    protocol,
  );
}
