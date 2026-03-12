import type { Finger4 } from './types.ts';
import type { SmoothingMode } from './settings.ts';

export class MultiChannelSmoother {
  private mode: SmoothingMode;
  private emaAlpha: number;
  private window: number;
  private emaState: Array<number | null> = [null, null, null, null];
  private maBuf: number[][] = [[], [], [], []];

  constructor(mode: SmoothingMode = 'EMA', emaAlpha = 0.25, window = 5) {
    this.mode = mode;
    this.emaAlpha = Math.max(0.01, Math.min(0.99, emaAlpha));
    this.window = Math.max(1, Math.floor(window));
  }

  reset(): void {
    this.emaState = [null, null, null, null];
    this.maBuf = [[], [], [], []];
  }

  reconfigure(mode: SmoothingMode, emaAlpha: number, window: number): void {
    this.mode = mode;
    this.emaAlpha = Math.max(0.01, Math.min(0.99, emaAlpha));
    this.window = Math.max(1, Math.floor(window));
    this.reset();
  }

  apply(values: Finger4): Finger4 {
    if (this.mode === 'NONE') return values;

    if (this.mode === 'EMA') {
      const out: number[] = [];
      for (let i = 0; i < 4; i++) {
        const prev = this.emaState[i];
        if (prev === null) {
          this.emaState[i] = values[i];
        } else {
          this.emaState[i] = this.emaAlpha * values[i] + (1 - this.emaAlpha) * prev;
        }
        out.push(this.emaState[i] ?? values[i]);
      }
      return [out[0], out[1], out[2], out[3]];
    }

    const out: number[] = [];
    for (let i = 0; i < 4; i++) {
      this.maBuf[i].push(values[i]);
      if (this.maBuf[i].length > this.window) {
        this.maBuf[i].shift();
      }
      let sum = 0;
      for (const value of this.maBuf[i]) {
        sum += value;
      }
      out.push(sum / this.maBuf[i].length);
    }
    return [out[0], out[1], out[2], out[3]];
  }
}
