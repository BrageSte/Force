import type { ForceSample } from './types.ts';
import { totalKg } from './types.ts';

export interface SegmenterConfig {
  startThresholdKg: number;
  stopThresholdKg: number;
  startHoldMs: number;
  stopHoldMs: number;
}

export const DEFAULT_SEGMENTER_CONFIG: SegmenterConfig = {
  startThresholdKg: 0.5,
  stopThresholdKg: 0.2,
  startHoldMs: 150,
  stopHoldMs: 300,
};

export interface EffortEvent {
  started: boolean;
  ended: boolean;
  startIndex: number | null;
  endIndex: number | null;
  active: boolean;
}

export class OnlineEffortDetector {
  private config: SegmenterConfig;
  private activeState = false;
  private aboveSinceMs: number | null = null;
  private belowSinceMs: number | null = null;
  private candidateStartIndex: number | null = null;
  private currentStartIndex: number | null = null;

  constructor(config: SegmenterConfig) {
    this.config = config;
  }

  get active(): boolean {
    return this.activeState;
  }

  get currentStartSampleIndex(): number | null {
    return this.currentStartIndex;
  }

  reset(): void {
    this.activeState = false;
    this.aboveSinceMs = null;
    this.belowSinceMs = null;
    this.candidateStartIndex = null;
    this.currentStartIndex = null;
  }

  forceEndCurrent(): void {
    this.activeState = false;
    this.belowSinceMs = null;
  }

  update(sampleIndex: number, tMs: number, totalForceKg: number): EffortEvent {
    const event: EffortEvent = {
      started: false,
      ended: false,
      startIndex: null,
      endIndex: null,
      active: this.activeState,
    };

    if (!this.activeState) {
      if (totalForceKg > this.config.startThresholdKg) {
        if (this.aboveSinceMs === null) {
          this.aboveSinceMs = tMs;
          this.candidateStartIndex = sampleIndex;
        } else if (tMs - this.aboveSinceMs >= this.config.startHoldMs) {
          this.activeState = true;
          this.currentStartIndex = this.candidateStartIndex;
          this.belowSinceMs = null;
          event.started = true;
          event.startIndex = this.currentStartIndex;
          this.aboveSinceMs = null;
          this.candidateStartIndex = null;
        }
      } else {
        this.aboveSinceMs = null;
        this.candidateStartIndex = null;
      }
    } else if (totalForceKg < this.config.stopThresholdKg) {
      if (this.belowSinceMs === null) {
        this.belowSinceMs = tMs;
      } else if (tMs - this.belowSinceMs >= this.config.stopHoldMs) {
        event.ended = true;
        event.startIndex = this.currentStartIndex;
        event.endIndex = sampleIndex;
        this.activeState = false;
        this.belowSinceMs = null;
        this.currentStartIndex = null;
      }
    } else {
      this.belowSinceMs = null;
    }

    event.active = this.activeState;
    return event;
  }
}

export function segmentEfforts(
  samples: ForceSample[],
  config: SegmenterConfig,
): Array<[number, number]> {
  const detector = new OnlineEffortDetector(config);
  const segments: Array<[number, number]> = [];

  for (let index = 0; index < samples.length; index++) {
    const event = detector.update(index, samples[index].tMs, totalKg(samples[index]));
    if (event.ended && event.startIndex !== null && event.endIndex !== null && event.endIndex > event.startIndex) {
      segments.push([event.startIndex, event.endIndex]);
    }
  }

  if (detector.active && samples.length >= 2) {
    const startIdx = detector.currentStartSampleIndex ?? 0;
    const endIdx = samples.length - 1;
    if (endIdx > startIdx) {
      segments.push([startIdx, endIdx]);
    }
  }

  return segments;
}
