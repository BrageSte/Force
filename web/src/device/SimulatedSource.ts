import type { DeviceStreamMode } from '@krimblokk/core';
import type { DataSource } from '../types/device.ts';
import type { AcquisitionSample, Finger4 } from '../types/force.ts';
import {
  buildAutonomousSimulatorBlueprint,
  buildGuidedSimulatorBlueprint,
  createDefaultSimulatorRuntimeState,
  createRestoreSimulatorArgs,
  idleSimulatorKg,
  nextFreeRunGapMs,
  sampleSimulatorBlueprintKg,
  simulatorStateStatus,
  simulatorValuesForStreamMode,
  type SimulatorEffortBlueprint,
} from './simulatorModel.ts';
import { createDefaultSimulatorAthleteProfile } from './simulatorAthlete.ts';
import type {
  RestoreSimulatorArgs,
  SimulatorAthleteProfile,
  SimulatorRuntimeState,
} from './simulatorTypes.ts';

export class SimulatedSource implements DataSource {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private startWallMs = 0;
  private lastEmitMs = 0;
  private streamMode: DeviceStreamMode;
  private rawOffsets: Finger4 = [100000, 105000, 97000, 102000];
  private rawScales: Finger4 = [1e-5, 1e-5, 1e-5, 1e-5];
  private runtimeState: SimulatorRuntimeState = createDefaultSimulatorRuntimeState();
  private athleteProfile: SimulatorAthleteProfile = createDefaultSimulatorAthleteProfile();
  private activeBlueprint: SimulatorEffortBlueprint | null = null;
  private blueprintStartedAtMs = 0;
  private nextAutoTriggerMs = 1600;
  private lastStatusKey = '';

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
    this.activeBlueprint = null;
    this.blueprintStartedAtMs = 0;
    this.nextAutoTriggerMs = 1600;
    this.runtimeState = createDefaultSimulatorRuntimeState(this.runtimeState.hand, this.athleteProfile);
    this.timer = setInterval(() => this.tick(), 20);
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

  setSimulatorState(state: SimulatorRuntimeState): void {
    this.runtimeState = { ...state };
    this.athleteProfile = {
      referenceMaxKg: state.referenceMaxKg,
      referenceSource: this.athleteProfile.referenceSource,
      baseFingerShare: [...state.baseFingerShare] as Finger4,
      weakFingerIndex: state.weakFingerIndex,
    };

    if (state.phase === 'work') {
      this.activeBlueprint = buildGuidedSimulatorBlueprint(state);
      this.blueprintStartedAtMs = this.elapsedMs();
    } else {
      this.activeBlueprint = null;
      this.nextAutoTriggerMs = this.elapsedMs() + nextFreeRunGapMs();
    }

    this.emitStatusForState(state);
  }

  restoreDefaultSimulatorState(args?: RestoreSimulatorArgs): void {
    const restored = createRestoreSimulatorArgs(args);
    if (restored.athlete) {
      this.athleteProfile = restored.athlete;
    }
    this.runtimeState = createDefaultSimulatorRuntimeState(restored.hand, restored.athlete ?? this.athleteProfile);
    this.activeBlueprint = null;
    this.blueprintStartedAtMs = 0;
    this.nextAutoTriggerMs = this.elapsedMs() + nextFreeRunGapMs();
    this.emitStatusForState(this.runtimeState);
  }

  private elapsedMs(): number {
    return performance.now() - this.startWallMs;
  }

  private tick(): void {
    if (!this.running) return;

    let tMs = Math.floor(this.elapsedMs());
    if (tMs <= this.lastEmitMs) tMs = this.lastEmitMs + 20;
    this.lastEmitMs = tMs;

    const kg = this.sampleKg(tMs);
    const values = simulatorValuesForStreamMode(kg, this.streamMode, this.rawOffsets, this.rawScales);
    this.onSample?.({ tMs, values });
  }

  private sampleKg(tMs: number): Finger4 {
    if (this.runtimeState.mode === 'guided') {
      if (!this.activeBlueprint) return idleSimulatorKg();
      const sample = sampleSimulatorBlueprintKg(this.activeBlueprint, tMs - this.blueprintStartedAtMs);
      return sample ?? idleSimulatorKg();
    }

    if (!this.activeBlueprint && tMs >= this.nextAutoTriggerMs) {
      this.activeBlueprint = buildAutonomousSimulatorBlueprint(this.athleteProfile);
      this.blueprintStartedAtMs = tMs;
    }

    if (!this.activeBlueprint) {
      return idleSimulatorKg();
    }

    const sample = sampleSimulatorBlueprintKg(this.activeBlueprint, tMs - this.blueprintStartedAtMs);
    if (sample) {
      return sample;
    }

    this.activeBlueprint = null;
    this.nextAutoTriggerMs = tMs + nextFreeRunGapMs();
    return idleSimulatorKg();
  }

  private emitStatusForState(state: SimulatorRuntimeState): void {
    const status = simulatorStateStatus(state);
    const statusKey = [
      state.mode,
      state.phase,
      state.hand,
      state.pattern,
      state.sessionLabel ?? '',
      state.detailLabel ?? '',
      state.attemptNo ?? '',
      state.totalAttempts ?? '',
    ].join('|');
    if (statusKey === this.lastStatusKey) return;
    this.lastStatusKey = statusKey;
    this.onStatus?.(status);
  }
}
