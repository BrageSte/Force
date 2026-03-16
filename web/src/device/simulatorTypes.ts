import type { Finger4, Hand } from '../types/force.ts';

export type SimulatorRuntimeMode = 'free_run' | 'guided';
export type SimulatorPhase = 'idle' | 'countdown' | 'work' | 'rest' | 'set_rest' | 'captured';
export type SimulatorPattern = 'auto' | 'max_pull' | 'explosive_pull' | 'steady_hold' | 'repeater' | 'force_curve';
export type SimulatorReferenceSource = 'test' | 'manual' | 'fallback';

export interface SimulatorAthleteProfile {
  referenceMaxKg: number;
  referenceSource: SimulatorReferenceSource;
  baseFingerShare: Finger4;
  weakFingerIndex: number | null;
}

export interface SimulatorRepeaterConfig {
  onMs: number;
  offMs: number;
  cycles: number;
  totalDecayPct?: number;
}

export interface SimulatorRuntimeState {
  mode: SimulatorRuntimeMode;
  phase: SimulatorPhase;
  hand: Hand;
  pattern: SimulatorPattern;
  durationMs: number;
  targetKg: number | null;
  referenceMaxKg: number;
  baseFingerShare: Finger4;
  weakFingerIndex: number | null;
  repeater?: SimulatorRepeaterConfig | null;
  sessionLabel?: string;
  detailLabel?: string;
  attemptNo?: number;
  totalAttempts?: number;
}

export interface RestoreSimulatorArgs {
  hand?: Hand;
  athlete?: SimulatorAthleteProfile | null;
}
