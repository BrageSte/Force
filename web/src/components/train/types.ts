import type {
  AthleteLevel,
  BenchmarkCategory,
  CustomWorkoutDefinition,
  GripType,
  SafetyFlag,
  SessionComparisonDelta,
  TacticalGripProfile,
  TrainingWorkoutDefinition,
  WorkoutModality,
  WorkoutStopCondition,
  WarmupStep,
  WorkoutTargetLogic,
} from '@krimblokk/core';
import type { DeviceCapabilities, DeviceType, Finger4, Hand, ProfileSnapshot } from '../../types/force.ts';

export type TrainPresetId =
  | 'strength_10s'
  | 'repeated_strength_7_53'
  | 'recruitment_rfd_clusters'
  | 'strength_endurance_repeaters'
  | 'health_capacity_density'
  | 'individualized_force_curve'
  | 'finger_bias_accessory';

export type TrainWorkoutId = TrainPresetId | string;
export type TrainWorkoutKind = 'builtin' | 'custom';
export type TrainTargetMode = 'auto_from_latest_test' | 'manual' | 'bodyweight_relative' | 'auto_from_first_set';
export type TrainRunnerPhase = 'ready' | 'countdown' | 'warmup' | 'work' | 'rest' | 'set_rest' | 'cooldown' | 'finished';

export interface TrainBlock {
  id: string;
  label: string;
  phase: 'warmup' | 'main' | 'cooldown';
  setCount: number;
  repsPerSet: number;
  hangSec: number;
  restBetweenRepsSec: number;
  restBetweenSetsSec: number;
  cue?: string;
}

export interface TrainProtocol extends Omit<TrainingWorkoutDefinition, 'kind' | 'blocks' | 'id'> {
  id: TrainPresetId;
  kind: 'prescribed';
  workoutKind: TrainWorkoutKind;
  blocks: TrainBlock[];
  benchmarkSourceId?: string;
  benchmarkSourceLabel?: string;
}

export interface CustomTrainWorkout extends Omit<CustomWorkoutDefinition, 'kind' | 'blocks' | 'id'> {
  id: string;
  kind: 'custom';
  workoutKind: 'custom';
  blocks: TrainBlock[];
  benchmarkSourceId?: string;
  benchmarkSourceLabel?: string;
}

export interface TrainRecommendation {
  workoutId: TrainWorkoutId;
  hand: Hand;
  priority: 'primary' | 'secondary' | 'support';
  reason: string;
  rationale: string[];
  targetAdjustments: string[];
  profileType: TacticalGripProfile;
  safetyFlags: SafetyFlag[];
}

export interface CustomTrainWorkoutDraft {
  workoutId: string;
  name: string;
  shortName: string;
  trainingGoal: string;
  athleteLevel: AthleteLevel;
  category: BenchmarkCategory;
  gripType: GripType;
  modality: WorkoutModality;
  targetLogic: WorkoutTargetLogic;
  targetModeLabel: string;
  targetIntensityLogic: string;
  benchmarkSourceId?: string;
  recommendationTags: string[];
  warmup: WarmupStep[];
  cooldown: string[];
  recoveryNotes: string[];
  stopConditions: WorkoutStopCondition[];
  blocks: TrainBlock[];
}

export interface TrainRepSample {
  tMs: number;
  totalKg: number;
  fingerKg: Finger4;
  fingerPct: Finger4;
  targetKg: number;
}

export interface TrainRepResult {
  sequenceSetNo?: number;
  blockId?: string;
  blockLabel?: string;
  blockPhase?: TrainBlock['phase'];
  setNo: number;
  repNo: number;
  plannedHangSec: number;
  actualHangS: number;
  peakTotalKg: number;
  avgHoldKg: number;
  impulseKgS: number;
  adherencePct: number;
  samples: TrainRepSample[];
}

export interface TrainSummary {
  plannedReps: number;
  completedReps: number;
  completionPct: number;
  totalTutS: number;
  peakTotalKg: number;
  avgHoldKg: number;
  avgImpulseKgS: number;
  adherencePct: number;
  sessionTrendPct: number | null;
  safetyFlags: SafetyFlag[];
}

export interface TrainSessionResult {
  trainSessionId: string;
  sessionId?: string;
  completed?: boolean;
  workoutId: TrainWorkoutId;
  workoutKind: TrainWorkoutKind;
  profile: ProfileSnapshot | null;
  presetId: TrainWorkoutId;
  presetName: string;
  category: BenchmarkCategory;
  athleteLevel: AthleteLevel;
  sourceBasis: string;
  hand: Hand;
  deviceType?: DeviceType;
  deviceName?: string;
  capabilities?: DeviceCapabilities;
  sampleSource?: string;
  protocolVersion?: number;
  gripType: GripType;
  modality: WorkoutModality;
  gripSpec: string;
  startedAtIso: string;
  completedAtIso: string;
  targetMode: TrainTargetMode;
  targetKg: number;
  sourceMaxKg: number | null;
  bodyweightRelativeTarget: number | null;
  benchmarkSourceId?: string;
  benchmarkSourceLabel?: string;
  recommendationReason: string;
  recommendationRationale: string[];
  tacticalGripProfile: TacticalGripProfile;
  blocks: TrainBlock[];
  reps: TrainRepResult[];
  summary: TrainSummary;
  sessionComparison: SessionComparisonDelta | null;
  notes: string;
}

export interface TrainSessionMeta {
  trainSessionId: string;
  sessionId?: string;
  completed?: boolean;
  startedAtIso: string;
  presetId: TrainWorkoutId;
  presetName: string;
  category: BenchmarkCategory;
  hand: Hand;
  deviceType?: DeviceType;
  deviceName?: string;
  profileId?: string;
  profileName?: string;
  targetKg: number;
  completionPct: number;
  totalTutS: number;
  peakTotalKg: number;
  avgHoldKg: number;
}
