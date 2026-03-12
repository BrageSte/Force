import type { SafetyFlag, SessionComparisonDelta, TacticalGripProfile } from '@krimblokk/core';
import type { Hand, ProfileSnapshot } from '../../types/force.ts';
import { bestPeakOfResult } from '../test/testAnalysis.ts';
import type { CompletedTestResult } from '../test/types.ts';
import type {
  CustomTrainWorkout,
  TrainBlock,
  TrainProtocol,
  TrainRecommendation,
  TrainRepResult,
  TrainSessionResult,
  TrainSummary,
  TrainTargetMode,
} from './types.ts';

export interface TrainTargetResolution {
  mode: TrainTargetMode;
  targetKg: number | null;
  sourceMaxKg: number | null;
  bodyweightRelativeTarget: number | null;
  benchmarkSourceId?: string;
  benchmarkSourceLabel?: string;
  reason: 'auto' | 'bodyweight' | 'absolute' | 'manual_required';
  rationale: string[];
}

export interface TrainTimelineStep {
  kind: 'work' | 'rest' | 'set_rest';
  durationSec: number;
  setNo: number;
  repNo: number;
  blockId: string;
  blockLabel: string;
  blockPhase: TrainBlock['phase'];
  cue?: string;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function findLatestBenchmarkResult(
  results: CompletedTestResult[],
  benchmarkId: string | undefined,
  hand: Hand,
): CompletedTestResult | null {
  if (!benchmarkId) return null;
  return results
    .filter(result => result.protocolId === benchmarkId && result.hand === hand)
    .sort((a, b) => b.completedAtIso.localeCompare(a.completedAtIso))[0] ?? null;
}

export function formatGripSpec(gripType: TrainProtocol['gripType'], modality: TrainProtocol['modality']): string {
  const grip = gripType.replaceAll('_', ' ');
  const mode = modality.replaceAll('_', ' ');
  return `${grip} · ${mode}`;
}

export function formatCategoryLabel(category: TrainProtocol['category']): string {
  if (category === 'max_strength') return 'Max Strength';
  if (category === 'repeated_max_strength') return 'Repeated Max Strength';
  if (category === 'recruitment_rfd') return 'Recruitment / RFD';
  if (category === 'strength_endurance') return 'Strength-Endurance';
  if (category === 'health_capacity') return 'Health / Capacity';
  return 'Force Curve';
}

export function resolveTrainTarget(
  protocol: TrainProtocol | CustomTrainWorkout,
  results: CompletedTestResult[],
  hand: Hand,
  profile?: ProfileSnapshot | null,
): TrainTargetResolution {
  const logic = protocol.targetLogic;
  if (logic.mode === 'absolute_kg' && logic.absoluteKg && logic.absoluteKg > 0) {
    return {
      mode: 'manual',
      targetKg: Number(logic.absoluteKg.toFixed(2)),
      sourceMaxKg: null,
      bodyweightRelativeTarget: null,
      benchmarkSourceId: protocol.benchmarkSourceId,
      benchmarkSourceLabel: protocol.benchmarkSourceLabel,
      reason: 'absolute',
      rationale: ['Workout uses a fixed absolute kg target.'],
    };
  }

  if (logic.mode === 'bodyweight_relative' && logic.bodyweightMultiplier && profile?.weightKg && profile.weightKg > 0) {
    const targetKg = Number((profile.weightKg * logic.bodyweightMultiplier).toFixed(2));
    return {
      mode: 'bodyweight_relative',
      targetKg,
      sourceMaxKg: null,
      bodyweightRelativeTarget: logic.bodyweightMultiplier,
      benchmarkSourceId: protocol.benchmarkSourceId,
      benchmarkSourceLabel: protocol.benchmarkSourceLabel,
      reason: 'bodyweight',
      rationale: [`Target resolves to ${logic.bodyweightMultiplier.toFixed(2)} x bodyweight.`],
    };
  }

  if (logic.mode === 'pct_latest_benchmark' && logic.percent && logic.percent > 0) {
    const benchmarkId = logic.benchmarkId ?? protocol.benchmarkSourceId ?? 'standard_max';
    const sourceResult = findLatestBenchmarkResult(results, benchmarkId, hand)
      ?? findLatestBenchmarkResult(results, 'standard_max', hand);
    if (sourceResult) {
      const sourceMaxKg = bestPeakOfResult(sourceResult);
      return {
        mode: 'auto_from_latest_test',
        targetKg: Number((sourceMaxKg * logic.percent).toFixed(2)),
        sourceMaxKg,
        bodyweightRelativeTarget: null,
        benchmarkSourceId: sourceResult.protocolId,
        benchmarkSourceLabel: sourceResult.protocolName,
        reason: 'auto',
        rationale: [`Target is ${(logic.percent * 100).toFixed(0)}% of the latest ${sourceResult.protocolName.toLowerCase()} for ${hand.toLowerCase()} hand.`],
      };
    }
  }

  return {
    mode: 'manual',
    targetKg: null,
    sourceMaxKg: null,
    bodyweightRelativeTarget: null,
    benchmarkSourceId: protocol.benchmarkSourceId,
    benchmarkSourceLabel: protocol.benchmarkSourceLabel,
    reason: 'manual_required',
    rationale: ['No matching benchmark was found for this profile and hand, so manual target entry is required.'],
  };
}

export function plannedRepCount(blocks: TrainBlock[]): number {
  return blocks.reduce((sum, block) => sum + block.setCount * block.repsPerSet, 0);
}

export function buildTrainTimeline(blocks: TrainBlock[]): TrainTimelineStep[] {
  const timeline: TrainTimelineStep[] = [];

  for (const block of blocks) {
    for (let setNo = 1; setNo <= block.setCount; setNo += 1) {
      for (let repNo = 1; repNo <= block.repsPerSet; repNo += 1) {
        timeline.push({
          kind: 'work',
          durationSec: block.hangSec,
          setNo,
          repNo,
          blockId: block.id,
          blockLabel: block.label,
          blockPhase: block.phase,
          cue: block.cue,
        });

        const isLastRepInSet = repNo === block.repsPerSet;
        const isLastSet = setNo === block.setCount;

        if (!isLastRepInSet) {
          timeline.push({
            kind: 'rest',
            durationSec: block.restBetweenRepsSec,
            setNo,
            repNo,
            blockId: block.id,
            blockLabel: block.label,
            blockPhase: block.phase,
            cue: block.cue,
          });
        } else if (!isLastSet && block.restBetweenSetsSec > 0) {
          timeline.push({
            kind: 'set_rest',
            durationSec: block.restBetweenSetsSec,
            setNo,
            repNo,
            blockId: block.id,
            blockLabel: block.label,
            blockPhase: block.phase,
            cue: block.cue,
          });
        }
      }
    }
  }

  return timeline;
}

function buildTrainSafetyFlags(reps: TrainRepResult[], targetKg: number): SafetyFlag[] {
  if (reps.length === 0) return [];
  const firstPeak = reps[0]?.peakTotalKg ?? 0;
  const lastPeak = reps[reps.length - 1]?.peakTotalKg ?? 0;
  const decayPct = firstPeak > 1e-9 ? ((lastPeak - firstPeak) / firstPeak) * 100 : 0;
  const maxPeak = reps.reduce((best, rep) => Math.max(best, rep.peakTotalKg), 0);
  const avgAdherence = mean(reps.map(rep => rep.adherencePct));
  const maxFingerShare = Math.max(
    ...reps.flatMap(rep => rep.samples.map(sample => Math.max(...sample.fingerPct))),
    0,
  );

  const flags: SafetyFlag[] = [];
  if (targetKg > 0 && maxPeak > targetKg * 1.18) {
    flags.push({ code: 'force_spike', severity: 'warning', message: 'Peak force rose well above the prescribed target band.' });
  }
  if (avgAdherence < 68) {
    flags.push({ code: 'unstable_loading', severity: 'warning', message: 'Target adherence stayed low, which suggests unstable loading or poor control.' });
  }
  if (decayPct < -18) {
    flags.push({ code: 'fatigue_collapse', severity: 'warning', message: 'Large force decay developed across the session.' });
  }
  if (maxFingerShare >= 45) {
    flags.push({ code: 'single_finger_overload', severity: 'high', message: 'One finger took a very large share of the load during the session.' });
  }
  if (flags.length === 0) {
    flags.push({ code: 'clean_session', severity: 'info', message: 'No major training safety flags were detected.' });
  }
  return flags;
}

export function buildTrainSummary(
  protocol: TrainProtocol | CustomTrainWorkout,
  reps: TrainRepResult[],
  previousResult: TrainSessionResult | null,
  targetKg: number,
): TrainSummary {
  const plannedReps = plannedRepCount(protocol.blocks);
  const completedReps = reps.length;
  const completionPct = plannedReps > 0 ? (completedReps / plannedReps) * 100 : 0;
  const totalTutS = reps.reduce((sum, rep) => sum + rep.actualHangS, 0);
  const peakTotalKg = reps.reduce((best, rep) => Math.max(best, rep.peakTotalKg), 0);
  const avgHoldKg = mean(reps.map(rep => rep.avgHoldKg));
  const avgImpulseKgS = mean(reps.map(rep => rep.impulseKgS));
  const adherencePct = mean(reps.map(rep => rep.adherencePct));
  const sessionTrendPct = previousResult && previousResult.summary.peakTotalKg > 1e-9
    ? ((peakTotalKg - previousResult.summary.peakTotalKg) / previousResult.summary.peakTotalKg) * 100
    : null;

  return {
    plannedReps,
    completedReps,
    completionPct,
    totalTutS,
    peakTotalKg,
    avgHoldKg,
    avgImpulseKgS,
    adherencePct,
    sessionTrendPct,
    safetyFlags: buildTrainSafetyFlags(reps, targetKg),
  };
}

export function buildTrainSessionComparison(
  currentSummary: TrainSummary,
  previousResult: TrainSessionResult | null,
): SessionComparisonDelta | null {
  if (!previousResult) return null;
  const previous = previousResult.summary;
  return {
    peakDeltaPct:
      previous.peakTotalKg > 1e-9 ? ((currentSummary.peakTotalKg - previous.peakTotalKg) / previous.peakTotalKg) * 100 : null,
    rfd100DeltaPct: null,
    enduranceDeltaPct:
      previous.totalTutS > 1e-9 ? ((currentSummary.totalTutS - previous.totalTutS) / previous.totalTutS) * 100 : null,
    asymmetryDeltaPct: null,
    stabilityDeltaPct:
      previous.adherencePct > 1e-9 ? ((currentSummary.adherencePct - previous.adherencePct) / previous.adherencePct) * 100 : null,
    takeoverPatternChanged: false,
  };
}

export function deriveTacticalGripProfile(
  latestBenchmark: CompletedTestResult | null,
  recommendation: TrainRecommendation | null,
): TacticalGripProfile {
  if (recommendation) return recommendation.profileType;
  return latestBenchmark?.summary.tacticalGripProfile ?? 'balanced';
}

export function buildTrainSessionResult(args: {
  protocol: TrainProtocol | CustomTrainWorkout;
  profile: ProfileSnapshot | null;
  hand: Hand;
  startedAtIso: string;
  targetMode: TrainTargetMode;
  targetKg: number;
  sourceMaxKg: number | null;
  bodyweightRelativeTarget?: number | null;
  benchmarkSourceId?: string;
  benchmarkSourceLabel?: string;
  reps: TrainRepResult[];
  previousResult: TrainSessionResult | null;
  recommendation?: TrainRecommendation | null;
  latestBenchmark?: CompletedTestResult | null;
  notes?: string;
}): TrainSessionResult {
  const completedAtIso = new Date().toISOString();
  const summary = buildTrainSummary(args.protocol, args.reps, args.previousResult, args.targetKg);
  return {
    trainSessionId: `train_${new Date().toISOString().replace(/[:.]/g, '-')}`,
    workoutId: args.protocol.id,
    workoutKind: args.protocol.workoutKind,
    profile: args.profile,
    presetId: args.protocol.id,
    presetName: args.protocol.name,
    category: args.protocol.category,
    athleteLevel: args.protocol.athleteLevel,
    sourceBasis: args.protocol.sourceBasis,
    hand: args.hand,
    gripType: args.protocol.gripType,
    modality: args.protocol.modality,
    gripSpec: formatGripSpec(args.protocol.gripType, args.protocol.modality),
    startedAtIso: args.startedAtIso,
    completedAtIso,
    targetMode: args.targetMode,
    targetKg: args.targetKg,
    sourceMaxKg: args.sourceMaxKg,
    bodyweightRelativeTarget: args.bodyweightRelativeTarget ?? null,
    benchmarkSourceId: args.benchmarkSourceId ?? args.protocol.benchmarkSourceId,
    benchmarkSourceLabel: args.benchmarkSourceLabel ?? args.protocol.benchmarkSourceLabel,
    recommendationReason: args.recommendation?.reason ?? 'User-selected session',
    recommendationRationale: args.recommendation?.rationale ?? ['Manual selection from the workout library.'],
    tacticalGripProfile: deriveTacticalGripProfile(args.latestBenchmark ?? null, args.recommendation ?? null),
    blocks: args.protocol.blocks,
    reps: args.reps,
    summary,
    sessionComparison: buildTrainSessionComparison(summary, args.previousResult),
    notes: args.notes ?? '',
  };
}

export function scoreRepAdherence(totalKg: number, targetKg: number): number {
  if (targetKg <= 0) return 0;
  const deltaPct = Math.abs(totalKg - targetKg) / targetKg;
  return clamp(100 - deltaPct * 100, 0, 100);
}

