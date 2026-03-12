import type { BenchmarkCategory, GripType, WorkoutModality } from '@krimblokk/core';
import type { TrainPresetId, TrainProtocol } from './types.ts';

function block(args: {
  id: string;
  label: string;
  phase: 'warmup' | 'main' | 'cooldown';
  setCount: number;
  repsPerSet: number;
  workSec: number;
  restBetweenRepsSec: number;
  restBetweenSetsSec: number;
  cue?: string;
}) {
  return {
    id: args.id,
    label: args.label,
    phase: args.phase,
    setCount: args.setCount,
    repsPerSet: args.repsPerSet,
    hangSec: args.workSec,
    restBetweenRepsSec: args.restBetweenRepsSec,
    restBetweenSetsSec: args.restBetweenSetsSec,
    cue: args.cue,
  };
}

function metadataGrip(gripType: GripType, modality: WorkoutModality): string {
  const gripLabel = gripType.replaceAll('_', ' ');
  const modalityLabel = modality.replaceAll('_', ' ');
  return `${gripLabel} · ${modalityLabel}`;
}

function createTrainProtocol(args: {
  id: TrainPresetId;
  name: string;
  shortName: string;
  category: BenchmarkCategory;
  athleteLevel: 'beginner' | 'intermediate' | 'advanced' | 'elite';
  gripType: GripType;
  modality: WorkoutModality;
  trainingGoal: string;
  targetIntensityLogic: string;
  sourceBasis: string;
  benchmarkSourceId?: string;
  benchmarkSourceLabel?: string;
  recommendationTags: string[];
  recoveryNotes: string[];
  cooldown: string[];
  progressionRule: string;
  targetLogic: {
    mode: 'pct_latest_benchmark' | 'bodyweight_relative' | 'absolute_kg';
    benchmarkId?: string;
    percent?: number | null;
    absoluteKg?: number | null;
    bodyweightMultiplier?: number | null;
    handScoped?: boolean;
  };
  blocks: TrainProtocol['blocks'];
}): TrainProtocol {
  const mainBlocks = args.blocks.filter(blockItem => blockItem.phase === 'main');
  const contractionDurationSec = mainBlocks[0]?.hangSec ?? args.blocks[0]?.hangSec ?? 0;
  const restDurationSec = mainBlocks[0]?.restBetweenRepsSec ?? args.blocks[0]?.restBetweenRepsSec ?? 0;
  const reps = mainBlocks.reduce((sum, blockItem) => sum + blockItem.repsPerSet, 0);
  const sets = mainBlocks.reduce((sum, blockItem) => sum + blockItem.setCount, 0);

  return {
    id: args.id,
    kind: 'prescribed',
    workoutKind: 'builtin',
    name: args.name,
    shortName: args.shortName,
    category: args.category,
    trainingGoal: args.trainingGoal,
    athleteLevel: args.athleteLevel,
    gripType: args.gripType,
    modality: args.modality,
    supportMode: 'metadata_only',
    contractionDurationSec,
    restDurationSec,
    reps,
    sets,
    targetIntensityLogic: args.targetIntensityLogic,
    warmup: [
      { label: `Ramp to 50% on ${metadataGrip(args.gripType, args.modality)}`, durationSec: 20, targetPctOfReference: 0.5 },
      { label: 'Ramp to 70% and rehearse clean finger distribution', durationSec: 15, targetPctOfReference: 0.7 },
    ],
    cooldown: args.cooldown,
    stopConditions: [
      { kind: 'stability_break', valuePct: 18, note: 'Stop if target control breaks down for more than one rep.' },
      { kind: 'force_drop_pct', valuePct: 20, note: 'Stop if force drops more than 20% below target.' },
      { kind: 'manual_stop', note: 'Stop immediately if tissue discomfort or unsafe loading appears.' },
    ],
    metrics: [
      'peak_force',
      'average_force',
      'impulse',
      'fatigue_index',
      'force_drift',
      'finger_contribution_percent',
      'redistribution_score',
      'stability_score',
    ],
    scoringModel: 'Session score balances completion, adherence, average force, peak force, stability and fatigue collapse.',
    progressionRule: args.progressionRule,
    sourceBasis: args.sourceBasis,
    recommendationTags: args.recommendationTags,
    targetLogic: args.targetLogic,
    recoveryNotes: args.recoveryNotes,
    blocks: args.blocks,
    benchmarkSourceId: args.benchmarkSourceId,
    benchmarkSourceLabel: args.benchmarkSourceLabel,
  };
}

export const TRAIN_LIBRARY: TrainProtocol[] = [
  createTrainProtocol({
    id: 'strength_10s',
    name: 'Strength 10s',
    shortName: 'Strength 10s',
    category: 'max_strength',
    athleteLevel: 'intermediate',
    gripType: 'half_crimp',
    modality: 'edge',
    trainingGoal: 'Build high recruitment and stable peak force on controlled 10-second efforts.',
    targetIntensityLogic: '85% of the latest max-strength benchmark for the same hand.',
    sourceBasis: 'Lattice-style maximal strength work with standardized force targets.',
    benchmarkSourceId: 'standard_max',
    benchmarkSourceLabel: 'Max Strength Benchmark',
    recommendationTags: ['max_strength', 'recruitment', 'base_work'],
    recoveryNotes: ['Keep 48h between hard max sessions on the same hand.', 'Stop early if connective tissue feels sharp rather than fatigued.'],
    cooldown: ['Easy open-hand shakes', '2-3 low-load recovery pulls or finger extensor work'],
    progressionRule: 'If completion and adherence stay above 90% for two sessions, increase target by 2-3%.',
    targetLogic: { mode: 'pct_latest_benchmark', benchmarkId: 'standard_max', percent: 0.85, handScoped: true },
    blocks: [
      block({ id: 'warmup', label: 'Warm-up Primer', phase: 'warmup', setCount: 1, repsPerSet: 3, workSec: 7, restBetweenRepsSec: 30, restBetweenSetsSec: 0, cue: 'Smooth ramp, no strain' }),
      block({ id: 'main', label: 'Main Strength Block', phase: 'main', setCount: 2, repsPerSet: 3, workSec: 10, restBetweenRepsSec: 120, restBetweenSetsSec: 180, cue: 'Hit target quickly, hold steady' }),
    ],
  }),
  createTrainProtocol({
    id: 'repeated_strength_7_53',
    name: 'Repeated Strength 7:53',
    shortName: '7:53 Strength',
    category: 'repeated_max_strength',
    athleteLevel: 'advanced',
    gripType: 'half_crimp',
    modality: 'edge',
    trainingGoal: 'Keep max-strength quality repeatable across longer recovery cycles.',
    targetIntensityLogic: '80% of the latest max-strength benchmark, held for repeated 7-second bouts.',
    sourceBasis: 'Eric Horst 7-53 concepts adapted to force-targeted sessions.',
    benchmarkSourceId: 'repeated_max_7_53',
    benchmarkSourceLabel: 'Repeated Max Strength Benchmark',
    recommendationTags: ['repeated_strength', '7_53', 'fatigue_resistance'],
    recoveryNotes: ['Use full rests; this is not a density session.', 'If reps decay fast, end the block rather than grinding.' ],
    cooldown: ['Forearm flush and shoulder reset', 'Log decay and compensation notes for the next prescription'],
    progressionRule: 'Progress by adding one set before increasing target, unless force decay is already below 8%.',
    targetLogic: { mode: 'pct_latest_benchmark', benchmarkId: 'standard_max', percent: 0.8, handScoped: true },
    blocks: [
      block({ id: 'warmup', label: 'Recruitment Ramp', phase: 'warmup', setCount: 1, repsPerSet: 3, workSec: 5, restBetweenRepsSec: 25, restBetweenSetsSec: 0, cue: 'Fast but controlled recruitment' }),
      block({ id: 'main', label: '7:53 Main Block', phase: 'main', setCount: 3, repsPerSet: 3, workSec: 7, restBetweenRepsSec: 53, restBetweenSetsSec: 180, cue: 'Explode into the target and hold quality' }),
    ],
  }),
  createTrainProtocol({
    id: 'recruitment_rfd_clusters',
    name: 'Recruitment Clusters',
    shortName: 'RFD Clusters',
    category: 'recruitment_rfd',
    athleteLevel: 'advanced',
    gripType: 'ergonomic_block',
    modality: 'no_hang_pull',
    trainingGoal: 'Improve rapid force development and active finger flexion with safer cluster pulls.',
    targetIntensityLogic: 'Short explosive pulls at 55% of the latest max-strength benchmark or manual target.',
    sourceBasis: 'Camp 4 / Tyler Nelson style recruitment and active flexion logic adapted to Krimblokk.',
    benchmarkSourceId: 'explosive_pull',
    benchmarkSourceLabel: 'Recruitment / RFD Benchmark',
    recommendationTags: ['rfd', 'recruitment', 'explosive'],
    recoveryNotes: ['Keep every rep crisp. If intent slows, stop.', 'This should feel neurally demanding, not pumpy.' ],
    cooldown: ['Open/close hand cycles', 'Easy shoulder and wrist mobility'],
    progressionRule: 'Keep the same load until RFD and adherence both improve, then raise target by 2%.',
    targetLogic: { mode: 'pct_latest_benchmark', benchmarkId: 'standard_max', percent: 0.55, handScoped: true },
    blocks: [
      block({ id: 'warmup', label: 'Recruitment Warm-up', phase: 'warmup', setCount: 1, repsPerSet: 4, workSec: 3, restBetweenRepsSec: 20, restBetweenSetsSec: 0, cue: 'Fast intent, low load' }),
      block({ id: 'main', label: 'Explosive Cluster Block', phase: 'main', setCount: 4, repsPerSet: 3, workSec: 3, restBetweenRepsSec: 20, restBetweenSetsSec: 150, cue: 'Attack the pull, then reset fully' }),
    ],
  }),
  createTrainProtocol({
    id: 'strength_endurance_repeaters',
    name: 'Strength-Endurance Repeaters',
    shortName: 'Repeaters 7:3',
    category: 'strength_endurance',
    athleteLevel: 'intermediate',
    gripType: 'open_hand',
    modality: 'edge',
    trainingGoal: 'Build repeatable submax force while keeping finger contribution stable under fatigue.',
    targetIntensityLogic: '70% of the latest max-strength benchmark with 7:3 repeater structure.',
    sourceBasis: 'Lattice and Horst repeater logic adapted to Krimblokk feedback.',
    benchmarkSourceId: 'advanced_repeater',
    benchmarkSourceLabel: 'Strength-Endurance Benchmark',
    recommendationTags: ['strength_endurance', 'repeaters', 'density'],
    recoveryNotes: ['This session should feel aerobic-hard, not maximal.', 'Watch for index/middle takeover as fatigue rises.' ],
    cooldown: ['Easy extensor work', 'Record any compensation pattern notes'],
    progressionRule: 'Increase target by 2% only when last-set completion remains above 90% for two sessions.',
    targetLogic: { mode: 'pct_latest_benchmark', benchmarkId: 'standard_max', percent: 0.7, handScoped: true },
    blocks: [
      block({ id: 'warmup', label: 'Warm-up Repeaters', phase: 'warmup', setCount: 1, repsPerSet: 4, workSec: 5, restBetweenRepsSec: 5, restBetweenSetsSec: 0, cue: 'Stay relaxed and even' }),
      block({ id: 'main', label: 'Main Repeater Block', phase: 'main', setCount: 4, repsPerSet: 6, workSec: 7, restBetweenRepsSec: 3, restBetweenSetsSec: 180, cue: 'Keep force within the band' }),
    ],
  }),
  createTrainProtocol({
    id: 'health_capacity_density',
    name: 'Health Capacity Density',
    shortName: 'Capacity Density',
    category: 'health_capacity',
    athleteLevel: 'beginner',
    gripType: 'ergonomic_block',
    modality: 'ergonomic_block',
    trainingGoal: 'Build tissue tolerance and cleaner finger sharing with lower-stress density work.',
    targetIntensityLogic: '45% of latest max-strength benchmark or 0.45x bodyweight when body mass is available.',
    sourceBasis: 'Camp 4 and individualized load-management principles for safer capacity work.',
    benchmarkSourceId: 'distribution_hold',
    benchmarkSourceLabel: 'Health / Capacity Benchmark',
    recommendationTags: ['health_capacity', 'stability', 'tissue_tolerance'],
    recoveryNotes: ['This should stay submax and technically clean.', 'Use it when loading feels noisy or uneven.' ],
    cooldown: ['Gentle extensor opening', 'Shake out forearms and note any painful fingers'],
    progressionRule: 'First add reps, then add target. Do not progress if instability or pain flags appear.',
    targetLogic: { mode: 'pct_latest_benchmark', benchmarkId: 'standard_max', percent: 0.45, handScoped: true },
    blocks: [
      block({ id: 'warmup', label: 'Tissue Prep', phase: 'warmup', setCount: 1, repsPerSet: 3, workSec: 10, restBetweenRepsSec: 20, restBetweenSetsSec: 0, cue: 'Easy smooth pulls' }),
      block({ id: 'main', label: 'Capacity Density Block', phase: 'main', setCount: 3, repsPerSet: 4, workSec: 20, restBetweenRepsSec: 20, restBetweenSetsSec: 120, cue: 'Stay even across all fingers' }),
    ],
  }),
  createTrainProtocol({
    id: 'individualized_force_curve',
    name: 'Force Curve Builder',
    shortName: 'Curve Builder',
    category: 'force_curve',
    athleteLevel: 'advanced',
    gripType: 'open_hand',
    modality: 'ergonomic_block',
    trainingGoal: 'Train the specific region of the force curve that broke down in the latest benchmark profile.',
    targetIntensityLogic: '65% of latest max-strength benchmark with emphasis on stable finger cooperation.',
    sourceBasis: 'Hand of God / Grip Gains-inspired individualized prescription using Krimblokk force curves.',
    benchmarkSourceId: 'force_curve_profile',
    benchmarkSourceLabel: 'Individual Force Curve Benchmark',
    recommendationTags: ['individualized', 'force_curve', 'distribution'],
    recoveryNotes: ['Review which finger started or dropped out first.', 'Adjust target down if compensation grows set to set.' ],
    cooldown: ['Contrast easy pulls with relaxed open hand breathing'],
    progressionRule: 'Only progress when redistribution score and stability both improve versus the previous matching session.',
    targetLogic: { mode: 'pct_latest_benchmark', benchmarkId: 'standard_max', percent: 0.65, handScoped: true },
    blocks: [
      block({ id: 'warmup', label: 'Profile Prep', phase: 'warmup', setCount: 1, repsPerSet: 3, workSec: 6, restBetweenRepsSec: 20, restBetweenSetsSec: 0, cue: 'Feel which finger starts first' }),
      block({ id: 'main', label: 'Force Curve Main Block', phase: 'main', setCount: 3, repsPerSet: 4, workSec: 8, restBetweenRepsSec: 25, restBetweenSetsSec: 150, cue: 'Keep distribution quiet and stable' }),
    ],
  }),
  createTrainProtocol({
    id: 'finger_bias_accessory',
    name: 'Finger Bias Accessory',
    shortName: 'Finger Bias',
    category: 'health_capacity',
    athleteLevel: 'intermediate',
    gripType: 'ergonomic_block',
    modality: 'no_hang_pull',
    trainingGoal: 'Give a weak or dropout-prone finger cleaner work without pushing peak system fatigue too high.',
    targetIntensityLogic: '50% of latest max-strength benchmark with lighter accessory volume.',
    sourceBasis: 'Per-finger individualized accessory logic enabled by Krimblokk finger distribution data.',
    benchmarkSourceId: 'force_curve_profile',
    benchmarkSourceLabel: 'Individual Force Curve Benchmark',
    recommendationTags: ['weak_finger', 'accessory', 'compensation_control'],
    recoveryNotes: ['Keep this smooth and technical, not maximal.', 'Use it as a support session or finisher, not a full max day.' ],
    cooldown: ['Open-hand de-load and note which finger needed extra cueing'],
    progressionRule: 'Progress only if the weak finger contributes more evenly without new safety flags.',
    targetLogic: { mode: 'pct_latest_benchmark', benchmarkId: 'standard_max', percent: 0.5, handScoped: true },
    blocks: [
      block({ id: 'warmup', label: 'Finger Bias Warm-up', phase: 'warmup', setCount: 1, repsPerSet: 3, workSec: 5, restBetweenRepsSec: 15, restBetweenSetsSec: 0, cue: 'Cue the lagging finger early' }),
      block({ id: 'main', label: 'Accessory Block', phase: 'main', setCount: 3, repsPerSet: 5, workSec: 6, restBetweenRepsSec: 12, restBetweenSetsSec: 90, cue: 'Maintain even pressure without compensating' }),
    ],
  }),
];

export function getTrainProtocolById(id: TrainPresetId): TrainProtocol {
  const protocol = TRAIN_LIBRARY.find(item => item.id === id);
  if (!protocol) {
    throw new Error(`Unknown train protocol: ${id}`);
  }
  return protocol;
}

export function isTrainPresetId(id: string): id is TrainPresetId {
  return TRAIN_LIBRARY.some(item => item.id === id);
}
