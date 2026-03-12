import type { Finger4, Hand, ProfileSnapshot } from '../../types/force.ts';
import type {
  AthleteLevel,
  BenchmarkCategory,
  BenchmarkScore,
  EffortClass,
  GripType,
  SafetyFlag,
  SessionComparisonDelta,
  TacticalGripProfile,
  WarmupStep,
  WorkoutModality,
  WorkoutStopCondition,
} from '@krimblokk/core';

export type TestTier = 'Core' | 'Advanced' | 'Experimental' | 'Custom';
export type ProtocolKind = 'builtin' | 'custom';
export type TestFamily =
  | 'max_pull'
  | 'duration_hold'
  | 'repeater'
  | 'explosive'
  | 'health_capacity'
  | 'force_curve'
  | 'custom';

export type TestId =
  | 'standard_max'
  | 'repeated_max_7_53'
  | 'distribution_hold'
  | 'advanced_repeater'
  | 'explosive_pull'
  | 'health_capacity_benchmark'
  | 'force_curve_profile';

export interface ProtocolRef {
  kind: ProtocolKind;
  id: string;
}

export type HandMode = 'current_hand' | 'alternate_hands';
export type LivePanelId =
  | 'timer'
  | 'hand_progress'
  | 'instructions'
  | 'target'
  | 'live_force'
  | 'contribution'
  | 'trace';

export type ResultWidgetId =
  | 'summary'
  | 'attempt_table'
  | 'attempt_overlay'
  | 'finger_detail'
  | 'target_stability'
  | 'experimental'
  | 'raw_traces'
  | 'session_context';

export type CompareMetricId =
  | 'best_peak_total_kg'
  | 'best_3s_mean_kg'
  | 'full_test_mean_kg'
  | 'repeatability_score'
  | 'session_trend_pct'
  | 'left_right_asymmetry_pct'
  | 'balance_score'
  | 'stability_error_pct'
  | 'finger_peak_kg'
  | 'finger_share_pct'
  | 'finger_drift_pct'
  | 'finger_fatigue_slope_kg_s'
  | 'explosive_time_to_50_pct_peak_ms'
  | 'explosive_time_to_90_pct_peak_ms'
  | 'explosive_rise_slope_0_500ms_kg_s'
  | 'advanced_repeated_effort_decay_pct'
  | 'advanced_final_third_mean_peak_kg';

export interface RepeaterConfig {
  onSec: number;
  offSec: number;
}

export interface IntervalConfig {
  enabled: boolean;
  workSec: number;
  restSec: number;
  cycles: number;
}

export type TargetMode = 'none' | 'relative_to_max' | 'fixed_kg' | 'percent_of_known_max' | 'bodyweight_relative';

export interface TargetConfig {
  mode: TargetMode;
  fixedKg?: number | null;
  percentOfKnownMax?: number | null;
  bodyweightMultiplier?: number | null;
}

export interface CompareDefaults {
  metricId?: CompareMetricId;
  autoNormalize?: boolean;
}

export interface DashboardConfigSnapshot {
  livePanels: LivePanelId[];
  resultWidgets: ResultWidgetId[];
  compareDefaults?: CompareDefaults;
}

export interface CompareTagSnapshot {
  family: TestFamily;
  targetMode: TargetMode;
  intervalMode: 'continuous' | 'interval';
  templateId?: string;
  templateName?: string;
}

export interface TestProtocol {
  protocolKind: ProtocolKind;
  id: string;
  builtInId?: TestId;
  templateId?: string;
  templateVersion?: number;
  name: string;
  shortName: string;
  tier: TestTier;
  category: BenchmarkCategory;
  family: TestFamily;
  athleteLevel: AthleteLevel;
  gripType: GripType;
  modality: WorkoutModality;
  supportMode: 'metadata_only';
  purpose: string;
  effortType: string;
  durationSec: number;
  attemptCount: number;
  countdownSec: number;
  restSec: number;
  guidance: string[];
  outputs: string[];
  handMode: HandMode;
  targetMode: TargetMode;
  fixedTargetKg?: number | null;
  defaultTargetPctOfMax?: number;
  bodyweightMultiplier?: number;
  targetIntensityLogic: string;
  stopConditions: WorkoutStopCondition[];
  warmup: WarmupStep[];
  cooldown: string[];
  scoringModel: string;
  progressionRule: string;
  reportRelativeToBodyweight: boolean;
  repeater?: RepeaterConfig;
  livePanels: LivePanelId[];
  resultWidgets: ResultWidgetId[];
  compareDefaults?: CompareDefaults;
}

export interface CustomTestTemplate {
  id: string;
  version: number;
  name: string;
  purpose: string;
  family: TestFamily;
  category: BenchmarkCategory;
  athleteLevel: AthleteLevel;
  gripType: GripType;
  modality: WorkoutModality;
  handMode: HandMode;
  workSec: number;
  attemptCount: number;
  countdownSec: number;
  restSec: number;
  target: TargetConfig;
  interval?: IntervalConfig | null;
  stopConditions?: WorkoutStopCondition[];
  warmup?: WarmupStep[];
  cooldown?: string[];
  livePanels: LivePanelId[];
  resultWidgets: ResultWidgetId[];
  compareDefaults?: CompareDefaults;
  createdAtIso: string;
  updatedAtIso: string;
}

export type TestRunnerPhase =
  | 'ready'
  | 'countdown'
  | 'live_effort'
  | 'hold_complete'
  | 'rest'
  | 'next_attempt'
  | 'finished';

export type SubPhaseTag = 'on' | 'off';

export interface AttemptSample {
  tMs: number;
  totalKg: number;
  fingerKg: Finger4;
  fingerPct: Finger4;
  effortClass?: EffortClass;
  subPhase?: SubPhaseTag;
}

export interface CoreMetrics {
  peakTotalKg: number;
  peakPerFingerKg: Finger4;
  fingerShareAtPeakPct: Finger4;
  averageForceKg: number;
  best3sMeanKg: number;
  fullTestMeanKg: number;
  impulseKgS: number;
  impulseNs: number;
  forceDriftKgS: number;
  earlyLateDropPct: number;
}

export interface CoachingMetrics {
  contributionDriftPct: Finger4;
  fatigueSlopePerFingerKgS: Finger4;
  takeoverFinger: number;
  fadeFinger: number;
  stabilityErrorPct: number | null;
  fingerVariabilityPct: Finger4;
  balanceScore: number;
  fingerInitiationOrder: number[];
  fingerDropoutOrder: number[];
  compensationMapping: string[];
  fingerSynergyScore: number;
  redistributionScore: number;
  underRecruitmentFlags: [boolean, boolean, boolean, boolean];
}

export interface AdvancedBenchmarkAnalytics {
  effortClass: EffortClass;
  rfd100KgS: number | null;
  rfd200KgS: number | null;
  fatigueIndex: number;
  forceDriftKgS: number;
  fingerAsymmetryPct: number | null;
  redistributionScore: number;
  fingerSynergyScore: number;
  safetyFlags: SafetyFlag[];
}

export interface ExplosiveExperimentalMetrics {
  timeTo50PctPeakMs: number | null;
  timeTo90PctPeakMs: number | null;
  firstSecondPeakKg: number;
  riseSlope0To500msKgS: number | null;
}

export interface AdvancedFatigueExperimentalMetrics {
  repeatedEffortDecayPct: number | null;
  finalThirdMeanPeakKg: number | null;
  strategyShiftScore: number | null;
}

export interface ExperimentalMetrics {
  explosive?: ExplosiveExperimentalMetrics;
  advancedFatigue?: AdvancedFatigueExperimentalMetrics;
  synergyMatrix?: number[][];
  note: string;
}

export interface AttemptResult {
  attemptNo: number;
  durationS: number;
  samples: AttemptSample[];
  core: CoreMetrics;
  coaching: CoachingMetrics;
  advanced?: AdvancedBenchmarkAnalytics;
  experimental?: ExperimentalMetrics;
}

export interface TestSummary {
  bestAttemptNo: number;
  strongestFinger: number;
  weakestContributor: number;
  biggestFadeFinger: number;
  takeoverFinger: number;
  mostStableFinger: number;
  repeatabilityScore: number;
  leftRightAsymmetryPct: number | null;
  sessionTrendPct: number;
  benchmarkScore?: BenchmarkScore | null;
  tacticalGripProfile?: TacticalGripProfile;
  normalizedPeakKgPerKgBodyweight?: number | null;
  safetyFlags?: SafetyFlag[];
}

export interface CompletedTestResult {
  resultId: string;
  protocolKind: ProtocolKind;
  protocolId: string;
  protocolName: string;
  builtInId?: TestId;
  tier: TestTier;
  hand: Hand;
  startedAtIso: string;
  completedAtIso: string;
  profile?: ProfileSnapshot | null;
  benchmarkCategory?: BenchmarkCategory;
  gripType?: GripType;
  modality?: WorkoutModality;
  athleteLevel?: AthleteLevel;
  targetKg: number | null;
  templateId?: string;
  templateName?: string;
  templateVersion?: number;
  effectiveProtocol: TestProtocol;
  dashboardSnapshot: DashboardConfigSnapshot;
  compareTags: CompareTagSnapshot;
  attempts: AttemptResult[];
  summary: TestSummary;
  sessionComparison?: SessionComparisonDelta | null;
  prescriptionRationale?: string[];
  confidence: {
    core: 'High';
    coaching: 'Moderate';
    experimental: 'Low';
  };
}
