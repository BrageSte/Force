import type { DeviceStreamMode } from '@krimblokk/core';
import type { TestProtocol, TestRunnerPhase } from '../components/test/types.ts';
import type { TrainProtocol, CustomTrainWorkout, TrainRunnerPhase } from '../components/train/types.ts';
import type { TrainTimelineStep } from '../components/train/trainUtils.ts';
import type { Finger4, Hand } from '../types/force.ts';
import type {
  RestoreSimulatorArgs,
  SimulatorAthleteProfile,
  SimulatorPattern,
  SimulatorRuntimeState,
} from './simulatorTypes.ts';
import { createDefaultSimulatorAthleteProfile } from './simulatorAthlete.ts';

export interface SimulatorEffortBlueprint {
  pattern: Exclude<SimulatorPattern, 'auto'>;
  durationMs: number;
  peakTotalKg: number;
  baseFingerShare: Finger4;
  weakFingerIndex: number | null;
  rampMs: number;
  holdMs: number;
  releaseMs: number;
  noiseStdKg: number;
  repeater?: {
    onMs: number;
    offMs: number;
    cycles: number;
    totalDecayPct: number;
  };
}

const IDLE_STD_KG = 0.012;
const FREE_RUN_IDLE_GAP_MS: [number, number] = [3200, 9000];
const MAX_PULL_LADDER = [0.78, 0.86, 0.93, 1.0];
const BASE_FINGER_SHARE: Finger4 = [0.30, 0.29, 0.23, 0.18];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeShare(values: Finger4): Finger4 {
  const bounded = values.map(value => Math.max(0.08, value)) as Finger4;
  const sum = bounded.reduce((total, value) => total + value, 0);
  return bounded.map(value => value / sum) as Finger4;
}

function shareWithOffset(base: Finger4, offset: Finger4): Finger4 {
  return normalizeShare([
    base[0] + offset[0],
    base[1] + offset[1],
    base[2] + offset[2],
    base[3] + offset[3],
  ]);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function gaussNoise(stddev: number): number {
  const u1 = Math.random() || 1e-10;
  const u2 = Math.random();
  return stddev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function easeOutCubic(t: number): number {
  const bounded = clamp(t, 0, 1);
  return 1 - Math.pow(1 - bounded, 3);
}

function easeInOutSine(t: number): number {
  const bounded = clamp(t, 0, 1);
  return -(Math.cos(Math.PI * bounded) - 1) / 2;
}

function patternFromTestProtocol(protocol: TestProtocol): Exclude<SimulatorPattern, 'auto'> {
  if (protocol.id === 'explosive_pull' || protocol.family === 'explosive') return 'explosive_pull';
  if (protocol.id === 'force_curve_profile' || protocol.family === 'force_curve') return 'force_curve';
  if (protocol.id === 'advanced_repeater' || protocol.id === 'repeated_max_7_53' || Boolean(protocol.repeater)) return 'repeater';
  if (protocol.id === 'distribution_hold' || protocol.family === 'health_capacity' || protocol.family === 'duration_hold') return 'steady_hold';
  return 'max_pull';
}

function patternFromTrainProtocol(protocol: TrainProtocol | CustomTrainWorkout): Exclude<SimulatorPattern, 'auto'> {
  if (protocol.category === 'recruitment_rfd') return 'explosive_pull';
  if (protocol.category === 'force_curve') return 'force_curve';
  if (protocol.category === 'health_capacity' || protocol.id === 'finger_bias_accessory') return 'steady_hold';
  return 'max_pull';
}

function scaleForTrainPhase(
  step: TrainTimelineStep | null,
  targetKg: number,
): number {
  if (!step) return targetKg;
  if (step.blockPhase === 'warmup') return targetKg * 0.6;
  if (step.blockPhase === 'cooldown') return targetKg * 0.5;
  return targetKg;
}

function targetForTest(protocol: TestProtocol, attemptNo: number, athlete: SimulatorAthleteProfile, targetKg: number | null): number {
  if (protocol.id === 'standard_max') {
    const idx = clamp(attemptNo - 1, 0, MAX_PULL_LADDER.length - 1);
    return athlete.referenceMaxKg * MAX_PULL_LADDER[idx];
  }
  if (protocol.id === 'explosive_pull') return athlete.referenceMaxKg * 0.65;
  if (protocol.id === 'distribution_hold') return targetKg ?? athlete.referenceMaxKg * 0.7;
  if (protocol.id === 'advanced_repeater') return targetKg ?? athlete.referenceMaxKg * 0.72;
  if (protocol.id === 'repeated_max_7_53') return targetKg ?? athlete.referenceMaxKg * 0.9;
  if (protocol.id === 'force_curve_profile') return targetKg ?? athlete.referenceMaxKg * 0.78;

  if (targetKg !== null && targetKg > 0) return targetKg;
  if (protocol.family === 'explosive') return athlete.referenceMaxKg * 0.65;
  if (protocol.family === 'health_capacity' || protocol.family === 'duration_hold') return athlete.referenceMaxKg * 0.68;
  if (protocol.family === 'force_curve') return athlete.referenceMaxKg * 0.76;
  if (protocol.family === 'repeater') return athlete.referenceMaxKg * 0.72;
  return athlete.referenceMaxKg * 0.92;
}

function repeaterCycles(durationMs: number, onMs: number, offMs: number): number {
  if (onMs <= 0) return 1;
  if (offMs <= 0) return Math.max(1, Math.round(durationMs / onMs));
  return Math.max(1, Math.round((durationMs + offMs) / (onMs + offMs)));
}

function patternDriftOffset(
  blueprint: SimulatorEffortBlueprint,
  elapsedMs: number,
): Finger4 {
  const progress = blueprint.durationMs > 0 ? clamp(elapsedMs / blueprint.durationMs, 0, 1) : 0;
  const oscillation = Math.sin((elapsedMs / 1000) * 2.2) * 0.003;

  if (blueprint.pattern === 'explosive_pull') {
    const onset = 1 - smoothstep(0.15, 0.55, progress);
    return [
      0.014 * onset + oscillation,
      0.01 * onset + oscillation * 0.6,
      -0.012 * onset - oscillation * 0.8,
      -0.012 * onset - oscillation * 0.8,
    ];
  }

  if (blueprint.pattern === 'steady_hold') {
    const late = smoothstep(0.7, 1, progress) * 0.006;
    return [
      late * 0.3 + oscillation * 0.5,
      late * 0.2 + oscillation * 0.4,
      -late * 0.25 - oscillation * 0.45,
      -late * 0.25 - oscillation * 0.45,
    ];
  }

  if (blueprint.pattern === 'force_curve') {
    const late = smoothstep(0.55, 1, progress) * 0.018;
    return [
      late * 0.6 + oscillation,
      late * 0.4 + oscillation * 0.8,
      -late * 0.55 - oscillation * 0.8,
      -late * 0.45 - oscillation * 0.8,
    ];
  }

  if (blueprint.pattern === 'repeater' && blueprint.repeater) {
    const cycleTotalMs = blueprint.repeater.onMs + blueprint.repeater.offMs;
    const cycleIndex = Math.min(
      blueprint.repeater.cycles - 1,
      Math.floor(elapsedMs / Math.max(1, cycleTotalMs)),
    );
    const inCycleMs = elapsedMs % Math.max(1, cycleTotalMs);
    const onProgress = smoothstep(0.2, 1, inCycleMs / Math.max(1, blueprint.repeater.onMs));
    const lateFactor = blueprint.repeater.cycles > 1
      ? cycleIndex / (blueprint.repeater.cycles - 1)
      : 0;
    const takeover = (0.009 + lateFactor * 0.012) * onProgress;
    return [
      takeover + oscillation * 0.4,
      takeover * 0.65 + oscillation * 0.3,
      -takeover * 0.85 - oscillation * 0.35,
      -takeover * 0.8 - oscillation * 0.35,
    ];
  }

  const late = smoothstep(0.65, 1, progress) * 0.008;
  return [
    late * 0.35 + oscillation,
    late * 0.2 + oscillation * 0.8,
    -late * 0.3 - oscillation * 0.8,
    -late * 0.25 - oscillation * 0.8,
  ];
}

function envelopeForBlueprint(blueprint: SimulatorEffortBlueprint, elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= blueprint.durationMs) return 0;

  if (blueprint.pattern === 'repeater' && blueprint.repeater) {
    const cycleTotalMs = blueprint.repeater.onMs + blueprint.repeater.offMs;
    const cycleIndex = Math.floor(elapsedMs / Math.max(1, cycleTotalMs));
    if (cycleIndex >= blueprint.repeater.cycles) return 0;

    const inCycleMs = elapsedMs % Math.max(1, cycleTotalMs);
    if (inCycleMs >= blueprint.repeater.onMs) return 0;

    const cycleProgress = inCycleMs / Math.max(1, blueprint.repeater.onMs);
    const rise = easeOutCubic(cycleProgress / 0.24);
    const fall = 1 - smoothstep(0.82, 1, cycleProgress) * 0.08;
    const cycleEnvelope = clamp(rise * fall, 0, 1);
    const decay = blueprint.repeater.cycles > 1
      ? 1 - (blueprint.repeater.totalDecayPct * cycleIndex) / (blueprint.repeater.cycles - 1)
      : 1;
    return cycleEnvelope * decay;
  }

  if (blueprint.pattern === 'explosive_pull') {
    const rampEnd = blueprint.rampMs;
    const peakEnd = rampEnd + blueprint.holdMs;
    if (elapsedMs <= rampEnd) return easeOutCubic(elapsedMs / Math.max(1, rampEnd));
    if (elapsedMs <= peakEnd) return 0.98 + Math.sin(((elapsedMs - rampEnd) / Math.max(1, blueprint.holdMs)) * Math.PI) * 0.02;
    const releaseProgress = (elapsedMs - peakEnd) / Math.max(1, blueprint.releaseMs);
    return clamp(1 - easeOutCubic(releaseProgress), 0, 1);
  }

  if (blueprint.pattern === 'force_curve') {
    const rampEnd = blueprint.rampMs;
    const holdEnd = rampEnd + blueprint.holdMs;
    if (elapsedMs <= rampEnd) {
      const progress = elapsedMs / Math.max(1, rampEnd);
      return 0.12 + easeInOutSine(progress) * 0.88;
    }
    if (elapsedMs <= holdEnd) {
      const holdProgress = (elapsedMs - rampEnd) / Math.max(1, blueprint.holdMs);
      return 0.95 + Math.sin(holdProgress * Math.PI) * 0.03 - holdProgress * 0.03;
    }
    const releaseProgress = (elapsedMs - holdEnd) / Math.max(1, blueprint.releaseMs);
    return clamp(0.92 - easeInOutSine(releaseProgress) * 0.92, 0, 1);
  }

  const rampEnd = blueprint.rampMs;
  const holdEnd = rampEnd + blueprint.holdMs;
  if (elapsedMs <= rampEnd) return easeOutCubic(elapsedMs / Math.max(1, rampEnd));
  if (elapsedMs <= holdEnd) {
    const holdProgress = (elapsedMs - rampEnd) / Math.max(1, blueprint.holdMs);
    return 0.985 + Math.sin(holdProgress * Math.PI * 1.5) * 0.01;
  }
  const releaseProgress = (elapsedMs - holdEnd) / Math.max(1, blueprint.releaseMs);
  return clamp(1 - easeInOutSine(releaseProgress), 0, 1);
}

function guidedNoiseStd(pattern: Exclude<SimulatorPattern, 'auto'>): number {
  if (pattern === 'steady_hold') return 0.02;
  if (pattern === 'explosive_pull') return 0.03;
  return 0.025;
}

function autonomousPattern(): Exclude<SimulatorPattern, 'auto'> {
  const roll = Math.random();
  if (roll < 0.38) return 'max_pull';
  if (roll < 0.68) return 'steady_hold';
  if (roll < 0.88) return 'force_curve';
  return 'explosive_pull';
}

export function createDefaultSimulatorRuntimeState(
  hand: Hand = 'Right',
  athlete?: SimulatorAthleteProfile | null,
): SimulatorRuntimeState {
  const resolvedAthlete = athlete ?? createDefaultSimulatorAthleteProfile({
    baseFingerShare: BASE_FINGER_SHARE,
  });
  return {
    mode: 'free_run',
    phase: 'idle',
    hand,
    pattern: 'auto',
    durationMs: 0,
    targetKg: null,
    referenceMaxKg: resolvedAthlete.referenceMaxKg,
    baseFingerShare: resolvedAthlete.baseFingerShare,
    weakFingerIndex: resolvedAthlete.weakFingerIndex,
    repeater: null,
    sessionLabel: 'Live demo',
  };
}

export function createRestoreSimulatorArgs(
  args: RestoreSimulatorArgs | undefined,
): { hand: Hand; athlete: SimulatorAthleteProfile | null } {
  return {
    hand: args?.hand ?? 'Right',
    athlete: args?.athlete ?? null,
  };
}

export function buildTestSimulatorState(args: {
  protocol: TestProtocol;
  phase: TestRunnerPhase;
  hand: Hand;
  athlete: SimulatorAthleteProfile;
  targetKg: number | null;
  attemptNo: number;
}): SimulatorRuntimeState {
  const mappedPhase = args.phase === 'live_effort'
    ? 'work'
    : args.phase === 'hold_complete'
      ? 'captured'
      : args.phase === 'rest'
        ? 'rest'
        : args.phase === 'countdown'
          ? 'countdown'
          : 'idle';

  return {
    mode: 'guided',
    phase: mappedPhase,
    hand: args.hand,
    pattern: patternFromTestProtocol(args.protocol),
    durationMs: args.protocol.durationSec * 1000,
    targetKg: mappedPhase === 'work'
      ? targetForTest(args.protocol, args.attemptNo, args.athlete, args.targetKg)
      : null,
    referenceMaxKg: args.athlete.referenceMaxKg,
    baseFingerShare: args.athlete.baseFingerShare,
    weakFingerIndex: args.athlete.weakFingerIndex,
    repeater: args.protocol.repeater
      ? {
          onMs: args.protocol.repeater.onSec * 1000,
          offMs: args.protocol.repeater.offSec * 1000,
          cycles: repeaterCycles(
            args.protocol.durationSec * 1000,
            args.protocol.repeater.onSec * 1000,
            args.protocol.repeater.offSec * 1000,
          ),
          totalDecayPct: args.protocol.id === 'advanced_repeater' ? 0.04 : 0.025,
        }
      : null,
    sessionLabel: args.protocol.name,
    detailLabel: `Attempt ${args.attemptNo}`,
    attemptNo: args.attemptNo,
    totalAttempts: args.protocol.attemptCount,
  };
}

export function buildTrainSimulatorState(args: {
  protocol: TrainProtocol | CustomTrainWorkout;
  phase: TrainRunnerPhase;
  hand: Hand;
  athlete: SimulatorAthleteProfile;
  currentStep: TrainTimelineStep | null;
  targetKg: number;
}): SimulatorRuntimeState {
  const mappedPhase = args.phase === 'countdown'
    ? 'countdown'
    : args.phase === 'rest'
      ? 'rest'
      : args.phase === 'set_rest'
        ? 'set_rest'
        : args.phase === 'warmup' || args.phase === 'work' || args.phase === 'cooldown'
          ? 'work'
          : 'idle';
  const targetScale = args.currentStep ? scaleForTrainPhase(args.currentStep, args.targetKg) : args.targetKg;

  return {
    mode: 'guided',
    phase: mappedPhase,
    hand: args.hand,
    pattern: patternFromTrainProtocol(args.protocol),
    durationMs: args.currentStep ? args.currentStep.durationSec * 1000 : 0,
    targetKg: mappedPhase === 'work' ? targetScale : null,
    referenceMaxKg: args.athlete.referenceMaxKg,
    baseFingerShare: args.athlete.baseFingerShare,
    weakFingerIndex: args.athlete.weakFingerIndex,
    repeater: null,
    sessionLabel: args.protocol.name,
    detailLabel: args.currentStep ? `${args.currentStep.blockLabel} set ${args.currentStep.sequenceSetNo} rep ${args.currentStep.repNo}` : undefined,
    attemptNo: args.currentStep?.repNo,
    totalAttempts: undefined,
  };
}

export function buildGuidedSimulatorBlueprint(state: SimulatorRuntimeState): SimulatorEffortBlueprint | null {
  if (state.phase !== 'work' || state.pattern === 'auto' || !state.targetKg || state.targetKg <= 0 || state.durationMs <= 0) {
    return null;
  }

  const targetKg = state.targetKg * (1 + randomBetween(-0.04, 0.04));
  const durationMs = state.durationMs;

  if (state.pattern === 'repeater' && state.repeater) {
    return {
      pattern: 'repeater',
      durationMs,
      peakTotalKg: targetKg,
      baseFingerShare: state.baseFingerShare,
      weakFingerIndex: state.weakFingerIndex,
      rampMs: 0,
      holdMs: 0,
      releaseMs: 0,
      noiseStdKg: 0.02,
      repeater: {
        onMs: state.repeater.onMs,
        offMs: state.repeater.offMs,
        cycles: state.repeater.cycles,
        totalDecayPct: state.repeater.totalDecayPct ?? 0.03,
      },
    };
  }

  if (state.pattern === 'explosive_pull') {
    return {
      pattern: 'explosive_pull',
      durationMs,
      peakTotalKg: targetKg,
      baseFingerShare: state.baseFingerShare,
      weakFingerIndex: state.weakFingerIndex,
      rampMs: clamp(Math.round(durationMs * 0.12), 120, 260),
      holdMs: clamp(Math.round(durationMs * 0.08), 80, 180),
      releaseMs: clamp(Math.round(durationMs * 0.28), 350, 700),
      noiseStdKg: guidedNoiseStd('explosive_pull'),
    };
  }

  if (state.pattern === 'force_curve') {
    return {
      pattern: 'force_curve',
      durationMs,
      peakTotalKg: targetKg,
      baseFingerShare: state.baseFingerShare,
      weakFingerIndex: state.weakFingerIndex,
      rampMs: clamp(Math.round(durationMs * 0.44), 1400, 5200),
      holdMs: clamp(Math.round(durationMs * 0.33), 1200, 4200),
      releaseMs: clamp(durationMs - Math.round(durationMs * 0.77), 800, 2600),
      noiseStdKg: guidedNoiseStd('force_curve'),
    };
  }

  if (state.pattern === 'steady_hold') {
    const rampMs = clamp(Math.round(durationMs * 0.18), 700, 2600);
    const releaseMs = clamp(Math.round(durationMs * 0.14), 600, 2200);
    return {
      pattern: 'steady_hold',
      durationMs,
      peakTotalKg: targetKg,
      baseFingerShare: state.baseFingerShare,
      weakFingerIndex: state.weakFingerIndex,
      rampMs,
      holdMs: Math.max(300, durationMs - rampMs - releaseMs),
      releaseMs,
      noiseStdKg: guidedNoiseStd('steady_hold'),
    };
  }

  const rampMs = clamp(Math.round(durationMs * 0.17), 420, 1400);
  const releaseMs = clamp(Math.round(durationMs * 0.12), 500, 1300);
  return {
    pattern: 'max_pull',
    durationMs,
    peakTotalKg: targetKg,
    baseFingerShare: state.baseFingerShare,
    weakFingerIndex: state.weakFingerIndex,
    rampMs,
    holdMs: Math.max(250, durationMs - rampMs - releaseMs),
    releaseMs,
    noiseStdKg: guidedNoiseStd('max_pull'),
  };
}

export function buildAutonomousSimulatorBlueprint(athlete: SimulatorAthleteProfile): SimulatorEffortBlueprint {
  const pattern = autonomousPattern();

  if (pattern === 'explosive_pull') {
    const durationMs = randomInt(1400, 2600);
    return {
      pattern,
      durationMs,
      peakTotalKg: athlete.referenceMaxKg * randomBetween(0.58, 0.72),
      baseFingerShare: athlete.baseFingerShare,
      weakFingerIndex: athlete.weakFingerIndex,
      rampMs: randomInt(120, 220),
      holdMs: randomInt(90, 180),
      releaseMs: randomInt(350, 700),
      noiseStdKg: 0.03,
    };
  }

  if (pattern === 'steady_hold') {
    const durationMs = randomInt(6500, 11500);
    const rampMs = randomInt(900, 1700);
    const releaseMs = randomInt(1000, 1800);
    return {
      pattern,
      durationMs,
      peakTotalKg: athlete.referenceMaxKg * randomBetween(0.48, 0.68),
      baseFingerShare: athlete.baseFingerShare,
      weakFingerIndex: athlete.weakFingerIndex,
      rampMs,
      holdMs: Math.max(2000, durationMs - rampMs - releaseMs),
      releaseMs,
      noiseStdKg: 0.02,
    };
  }

  if (pattern === 'force_curve') {
    const durationMs = randomInt(7000, 11000);
    return {
      pattern,
      durationMs,
      peakTotalKg: athlete.referenceMaxKg * randomBetween(0.58, 0.8),
      baseFingerShare: athlete.baseFingerShare,
      weakFingerIndex: athlete.weakFingerIndex,
      rampMs: randomInt(1800, 3200),
      holdMs: randomInt(2400, 3800),
      releaseMs: randomInt(1200, 2000),
      noiseStdKg: 0.024,
    };
  }

  const durationMs = randomInt(2600, 6200);
  const rampMs = randomInt(420, 950);
  const releaseMs = randomInt(650, 1200);
  return {
    pattern: 'max_pull',
    durationMs,
    peakTotalKg: athlete.referenceMaxKg * randomBetween(0.72, 1.0),
    baseFingerShare: athlete.baseFingerShare,
    weakFingerIndex: athlete.weakFingerIndex,
    rampMs,
    holdMs: Math.max(300, durationMs - rampMs - releaseMs),
    releaseMs,
    noiseStdKg: 0.025,
  };
}

export function nextFreeRunGapMs(): number {
  return randomInt(FREE_RUN_IDLE_GAP_MS[0], FREE_RUN_IDLE_GAP_MS[1]);
}

export function idleSimulatorKg(): Finger4 {
  return [
    gaussNoise(IDLE_STD_KG),
    gaussNoise(IDLE_STD_KG),
    gaussNoise(IDLE_STD_KG),
    gaussNoise(IDLE_STD_KG),
  ];
}

export function sampleSimulatorBlueprintKg(
  blueprint: SimulatorEffortBlueprint,
  elapsedMs: number,
): Finger4 | null {
  if (elapsedMs < 0 || elapsedMs >= blueprint.durationMs) return null;

  const envelope = envelopeForBlueprint(blueprint, elapsedMs);
  if (envelope <= 0) return [0, 0, 0, 0];

  const share = shareWithOffset(
    blueprint.baseFingerShare,
    patternDriftOffset(blueprint, elapsedMs),
  );
  const totalKg = Math.max(0, blueprint.peakTotalKg * envelope);

  return [
    Math.max(0, totalKg * share[0] + gaussNoise(blueprint.noiseStdKg)),
    Math.max(0, totalKg * share[1] + gaussNoise(blueprint.noiseStdKg)),
    Math.max(0, totalKg * share[2] + gaussNoise(blueprint.noiseStdKg)),
    Math.max(0, totalKg * share[3] + gaussNoise(blueprint.noiseStdKg)),
  ];
}

export function simulatorValuesForStreamMode(
  kg: Finger4,
  streamMode: DeviceStreamMode,
  rawOffsets: Finger4,
  rawScales: Finger4,
): Finger4 {
  if (streamMode === 'kg') return kg;
  return [
    rawOffsets[0] + (kg[0] / rawScales[0]),
    rawOffsets[1] + (kg[1] / rawScales[1]),
    rawOffsets[2] + (kg[2] / rawScales[2]),
    rawOffsets[3] + (kg[3] / rawScales[3]),
  ];
}

export function simulatorStateStatus(state: SimulatorRuntimeState): string {
  if (state.mode === 'free_run') {
    return `Simulator demo: free-run (${state.hand} hand, ref ${state.referenceMaxKg.toFixed(1)} kg)`;
  }

  const parts = [
    state.sessionLabel ?? 'Guided demo',
    state.hand,
    state.pattern.replaceAll('_', ' '),
  ];
  if (state.detailLabel) parts.push(state.detailLabel);
  else if (state.attemptNo) {
    parts.push(`Attempt ${state.attemptNo}${state.totalAttempts ? `/${state.totalAttempts}` : ''}`);
  }
  return `Simulator demo: ${parts.join(' | ')}`;
}
