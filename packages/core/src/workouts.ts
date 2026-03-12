import type { Finger4, Hand } from './types.ts';

export type AthleteLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite';
export type GripType =
  | 'half_crimp'
  | 'open_hand'
  | 'edge'
  | 'ergonomic_block'
  | 'no_hang_pull';
export type WorkoutModality = 'edge' | 'ergonomic_block' | 'no_hang_pull';
export type BenchmarkCategory =
  | 'max_strength'
  | 'repeated_max_strength'
  | 'recruitment_rfd'
  | 'strength_endurance'
  | 'health_capacity'
  | 'force_curve';
export type WorkoutKind = 'benchmark' | 'prescribed' | 'custom';
export type WorkoutSupportMode = 'metadata_only';
export type EffortClass = 'explosive' | 'max' | 'endurance' | 'capacity';
export type TacticalGripProfile =
  | 'balanced'
  | 'crimp_dominant'
  | 'open_hand_dominant'
  | 'explosive'
  | 'fatigue_resistant'
  | 'compensation_prone';

export interface WarmupStep {
  label: string;
  durationSec?: number;
  targetPctOfReference?: number | null;
  notes?: string;
}

export interface WorkoutTargetLogic {
  mode: 'none' | 'absolute_kg' | 'pct_latest_benchmark' | 'bodyweight_relative';
  benchmarkId?: string;
  percent?: number | null;
  absoluteKg?: number | null;
  bodyweightMultiplier?: number | null;
  handScoped?: boolean;
}

export interface WorkoutStopCondition {
  kind: 'below_threshold' | 'force_drop_pct' | 'stability_break' | 'safety_flag' | 'manual_stop';
  thresholdKg?: number;
  durationMs?: number;
  valuePct?: number;
  note?: string;
}

export interface WorkoutBlock {
  id: string;
  label: string;
  phase: 'warmup' | 'main' | 'cooldown';
  setCount: number;
  repsPerSet: number;
  workSec: number;
  restBetweenRepsSec: number;
  restBetweenSetsSec: number;
  cue?: string;
}

export interface WorkoutDefinition {
  id: string;
  kind: WorkoutKind;
  name: string;
  shortName: string;
  category: BenchmarkCategory;
  trainingGoal: string;
  athleteLevel: AthleteLevel;
  gripType: GripType;
  modality: WorkoutModality;
  supportMode: WorkoutSupportMode;
  contractionDurationSec: number;
  restDurationSec: number;
  reps: number;
  sets: number;
  targetIntensityLogic: string;
  warmup: WarmupStep[];
  cooldown: string[];
  stopConditions: WorkoutStopCondition[];
  metrics: string[];
  scoringModel: string;
  progressionRule: string;
  sourceBasis: string;
  blocks: WorkoutBlock[];
}

export interface BenchmarkDefinition extends WorkoutDefinition {
  kind: 'benchmark';
  benchmarkId: string;
  reportRelativeToBodyweight: boolean;
  supportHalfCrimp: boolean;
  supportOpenHand: boolean;
}

export interface TrainingWorkoutDefinition extends WorkoutDefinition {
  kind: 'prescribed' | 'custom';
  recommendationTags: string[];
  targetLogic: WorkoutTargetLogic;
  recoveryNotes: string[];
}

export interface CustomWorkoutDefinition extends TrainingWorkoutDefinition {
  kind: 'custom';
  createdAtIso: string;
  updatedAtIso: string;
}

export interface SafetyFlag {
  code: string;
  severity: 'info' | 'warning' | 'high';
  message: string;
}

export interface BenchmarkScore {
  overall: number;
  peakForceKg: number;
  averageForceKg: number;
  impulseKgS: number;
  rfd100KgS: number | null;
  rfd200KgS: number | null;
  fatigueIndex: number;
  forceDriftKgS: number;
  fingerContributionPct: Finger4;
  fingerAsymmetryPct: number | null;
  redistributionScore: number;
  stabilityScore: number;
  leftVsRightPct: number | null;
}

export interface SessionComparisonDelta {
  peakDeltaPct: number | null;
  rfd100DeltaPct: number | null;
  enduranceDeltaPct: number | null;
  asymmetryDeltaPct: number | null;
  stabilityDeltaPct: number | null;
  takeoverPatternChanged: boolean;
}

export interface AthleteForceProfile {
  profileType: TacticalGripProfile;
  strengths: string[];
  limitations: string[];
  weakFingers: number[];
  compensationRisk: boolean;
  unstablePattern: boolean;
}

export interface WorkoutPrescription {
  workoutId: string;
  hand: Hand;
  priority: 'primary' | 'secondary' | 'support';
  reason: string;
  rationale: string[];
  targetAdjustments: string[];
  safetyFlags: SafetyFlag[];
}
