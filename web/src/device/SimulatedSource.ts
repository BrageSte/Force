import type { DataSource } from '../types/device.ts';
import type { AcquisitionSample, Finger4 } from '../types/force.ts';
import type { DeviceStreamMode } from '@krimblokk/core';

interface Profile {
  kind: string;
  rampMs: number;
  holdMs: number;
  releaseMs: number;
  peakTotalKg: number;
  fingerShare: Finger4;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function randomShare(): Finger4 {
  const base = [
    randomBetween(0.20, 0.34),
    randomBetween(0.20, 0.34),
    randomBetween(0.16, 0.28),
    randomBetween(0.10, 0.23),
  ];
  const s = base.reduce((a, b) => a + b, 0);
  return base.map(b => b / s) as Finger4;
}

function makeMaxPullProfile(): Profile {
  return {
    kind: 'max_pull',
    rampMs: randomInt(350, 850),
    holdMs: randomInt(120, 450),
    releaseMs: randomInt(500, 1000),
    peakTotalKg: randomBetween(14, 42),
    fingerShare: randomShare(),
  };
}

function makeHangProfile(): Profile {
  return {
    kind: 'hang',
    rampMs: randomInt(600, 1300),
    holdMs: randomInt(3000, 9000),
    releaseMs: randomInt(800, 1800),
    peakTotalKg: randomBetween(10, 28),
    fingerShare: randomShare(),
  };
}

function gaussNoise(stddev: number): number {
  // Box-Muller transform
  const u1 = Math.random() || 1e-10;
  const u2 = Math.random();
  return stddev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export class SimulatedSource implements DataSource {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private startWallMs = 0;
  private lastEmitMs = 0;
  private currentProfile: Profile | null = null;
  private profileStartMs = 0;
  private nextAutoTriggerMs = 1500;
  private streamMode: DeviceStreamMode;
  private rawOffsets: Finger4 = [100000, 105000, 97000, 102000];
  private rawScales: Finger4 = [1e-5, 1e-5, 1e-5, 1e-5];

  onSample: ((s: AcquisitionSample) => void) | null = null;
  onStatus: ((msg: string) => void) | null = null;
  onConnectionChange: ((c: boolean) => void) | null = null;

  constructor(streamMode: DeviceStreamMode = 'kg') {
    this.streamMode = streamMode;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.startWallMs = performance.now();
    this.lastEmitMs = 0;
    this.nextAutoTriggerMs = 1500;
    this.currentProfile = null;
    this.timer = setInterval(() => this.tick(), 20); // ~50Hz
    this.onConnectionChange?.(true);
    this.onStatus?.(`Simulator connected (${this.streamMode})`);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.onConnectionChange?.(false);
    this.onStatus?.('Simulator disconnected');
  }

  isRunning(): boolean {
    return this.running;
  }

  setStreamMode(mode: DeviceStreamMode): void {
    this.streamMode = mode;
    this.onStatus?.(`Simulator stream mode: ${mode}`);
  }

  sendCommand(cmd: string): void {
    const text = cmd.trim().toLowerCase();
    if (text === 'm raw') {
      this.setStreamMode('raw');
      return;
    }
    if (text === 'm kg') {
      this.setStreamMode('kg');
      return;
    }
    if (text === 't') {
      this.onStatus?.('Simulator tare acknowledged');
      return;
    }
    this.onStatus?.(`Simulator ignored command: ${cmd.trim()}`);
  }

  private elapsedMs(): number {
    return performance.now() - this.startWallMs;
  }

  private tick(): void {
    if (!this.running) return;

    let tMs = Math.floor(this.elapsedMs());
    if (tMs <= this.lastEmitMs) tMs = this.lastEmitMs + 20;
    this.lastEmitMs = tMs;

    // Auto-trigger profiles
    if (this.currentProfile === null && tMs >= this.nextAutoTriggerMs) {
      this.currentProfile = Math.random() < 0.55 ? makeMaxPullProfile() : makeHangProfile();
      this.profileStartMs = tMs;
    }

    const kg = this.sampleKg(tMs);
    const values: Finger4 = this.streamMode === 'raw'
      ? [
          this.rawOffsets[0] + (kg[0] / this.rawScales[0]),
          this.rawOffsets[1] + (kg[1] / this.rawScales[1]),
          this.rawOffsets[2] + (kg[2] / this.rawScales[2]),
          this.rawOffsets[3] + (kg[3] / this.rawScales[3]),
        ]
      : kg;
    this.onSample?.({ tMs, values });
  }

  private sampleKg(tMs: number): Finger4 {
    const noise: Finger4 = [gaussNoise(0.03), gaussNoise(0.03), gaussNoise(0.03), gaussNoise(0.03)];

    if (this.currentProfile === null) {
      return noise; // idle drift
    }

    const p = this.currentProfile;
    const e = tMs - this.profileStartMs;
    const totalDur = p.rampMs + p.holdMs + p.releaseMs;

    if (e < 0) return noise;
    if (e >= totalDur) {
      this.currentProfile = null;
      this.nextAutoTriggerMs = tMs + randomInt(2500, 8000);
      return noise;
    }

    let gain: number;
    if (e < p.rampMs) {
      gain = e / Math.max(1, p.rampMs);
    } else if (e < p.rampMs + p.holdMs) {
      gain = 1.0;
    } else {
      const releaseE = e - (p.rampMs + p.holdMs);
      gain = Math.max(0, 1 - releaseE / Math.max(1, p.releaseMs));
    }

    // Small distribution drift
    const drift = 0.04 * Math.sin(e / 350);
    const rawShare = [
      Math.max(0.02, p.fingerShare[0] + drift),
      Math.max(0.02, p.fingerShare[1] - drift * 0.6),
      Math.max(0.02, p.fingerShare[2] - drift * 0.2),
      Math.max(0.02, p.fingerShare[3] - drift * 0.2),
    ];
    const shareSum = rawShare.reduce((a, b) => a + b, 0);
    const share = rawShare.map(s => s / shareSum);

    const totalForce = p.peakTotalKg * gain;
    return [
      totalForce * share[0] + noise[0],
      totalForce * share[1] + noise[1],
      totalForce * share[2] + noise[2],
      totalForce * share[3] + noise[3],
    ];
  }
}
