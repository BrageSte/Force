import type { AthleteForceProfile, SafetyFlag, TacticalGripProfile, WorkoutPrescription } from '@krimblokk/core';
import type { Hand } from '../../types/force.ts';
import type { CompletedTestResult } from '../test/types.ts';
import { getTrainProtocolById } from './trainLibrary.ts';
import type { TrainPresetId, TrainRecommendation } from './types.ts';

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function latestForProtocol(results: CompletedTestResult[], protocolId: string, hand: Hand): CompletedTestResult | null {
  return results
    .filter(result => result.protocolId === protocolId && result.hand === hand)
    .sort((a, b) => b.completedAtIso.localeCompare(a.completedAtIso))[0] ?? null;
}

function collectSafetyFlags(results: Array<CompletedTestResult | null>): SafetyFlag[] {
  return results.flatMap(result => result?.summary.safetyFlags ?? []);
}

function weakFingerIndices(results: Array<CompletedTestResult | null>): number[] {
  const values = results
    .filter((result): result is CompletedTestResult => result !== null)
    .map(result => result.summary.weakestContributor);
  return Array.from(new Set(values));
}

function inferProfileType(results: Array<CompletedTestResult | null>): TacticalGripProfile {
  return results.find(result => result?.summary.tacticalGripProfile)?.summary.tacticalGripProfile ?? 'balanced';
}

export function buildAthleteForceProfile(results: CompletedTestResult[], hand: Hand): AthleteForceProfile {
  const max = latestForProtocol(results, 'standard_max', hand);
  const repeated = latestForProtocol(results, 'repeated_max_7_53', hand) ?? latestForProtocol(results, 'advanced_repeater', hand);
  const explosive = latestForProtocol(results, 'explosive_pull', hand);
  const health = latestForProtocol(results, 'distribution_hold', hand) ?? latestForProtocol(results, 'health_capacity_benchmark', hand);
  const forceCurve = latestForProtocol(results, 'force_curve_profile', hand);
  const profileType = inferProfileType([forceCurve, explosive, max, repeated, health]);
  const weakFingers = weakFingerIndices([forceCurve, max, repeated]);
  const unstablePattern = mean([health?.summary.repeatabilityScore ?? 100, max?.summary.repeatabilityScore ?? 100]) < 74;
  const compensationRisk = collectSafetyFlags([forceCurve, health, repeated]).some(flag => flag.code === 'compensation_risk' || flag.code === 'single_finger_overload');

  const strengths: string[] = [];
  const limitations: string[] = [];

  if ((max?.summary.normalizedPeakKgPerKgBodyweight ?? 0) >= 0.8) strengths.push('High peak force relative to bodyweight');
  if (mean(explosive?.attempts.map(attempt => attempt.advanced?.rfd100KgS ?? 0) ?? []) >= 150) strengths.push('Good rapid force development');
  if (mean(repeated?.attempts.map(attempt => attempt.advanced?.fatigueIndex ?? 0) ?? [20]) < 10) strengths.push('Good repeated-force retention');

  if (mean(explosive?.attempts.map(attempt => attempt.advanced?.rfd100KgS ?? 0) ?? [0]) < 120) limitations.push('RFD is lagging behind peak force');
  if (mean(repeated?.attempts.map(attempt => attempt.advanced?.fatigueIndex ?? 0) ?? [0]) > 12) limitations.push('Force decays noticeably across repeated efforts');
  if (unstablePattern) limitations.push('Force delivery and finger sharing are unstable');
  if (compensationRisk) limitations.push('Compensation risk is rising as fatigue builds');

  return {
    profileType,
    strengths,
    limitations,
    weakFingers,
    compensationRisk,
    unstablePattern,
  };
}

function makeRecommendation(args: {
  workoutId: TrainPresetId;
  hand: Hand;
  priority: 'primary' | 'secondary' | 'support';
  reason: string;
  rationale: string[];
  targetAdjustments: string[];
  profileType: TacticalGripProfile;
  safetyFlags: SafetyFlag[];
}): TrainRecommendation {
  return {
    workoutId: args.workoutId,
    hand: args.hand,
    priority: args.priority,
    reason: args.reason,
    rationale: args.rationale,
    targetAdjustments: args.targetAdjustments,
    profileType: args.profileType,
    safetyFlags: args.safetyFlags,
  };
}

export function buildTrainRecommendations(results: CompletedTestResult[], hand: Hand): TrainRecommendation[] {
  const max = latestForProtocol(results, 'standard_max', hand);
  const repeated = latestForProtocol(results, 'repeated_max_7_53', hand) ?? latestForProtocol(results, 'advanced_repeater', hand);
  const explosive = latestForProtocol(results, 'explosive_pull', hand);
  const health = latestForProtocol(results, 'distribution_hold', hand) ?? latestForProtocol(results, 'health_capacity_benchmark', hand);
  const forceCurve = latestForProtocol(results, 'force_curve_profile', hand);
  const athleteProfile = buildAthleteForceProfile(results, hand);

  const peakRelative = max?.summary.normalizedPeakKgPerKgBodyweight ?? 0;
  const rfd = mean(explosive?.attempts.map(attempt => attempt.advanced?.rfd100KgS ?? 0) ?? []);
  const fatigueIndex = mean(repeated?.attempts.map(attempt => attempt.advanced?.fatigueIndex ?? 0) ?? []);
  const redistribution = mean(forceCurve?.attempts.map(attempt => attempt.advanced?.redistributionScore ?? 0) ?? []);
  const safetyFlags = collectSafetyFlags([max, repeated, explosive, health, forceCurve]);
  const weakFinger = athleteProfile.weakFingers[0];
  const recommendations: TrainRecommendation[] = [];

  if (peakRelative >= 0.75 && rfd > 0 && rfd < 120) {
    recommendations.push(makeRecommendation({
      workoutId: 'recruitment_rfd_clusters',
      hand,
      priority: 'primary',
      reason: 'High peak force but slower recruitment profile',
      rationale: [
        `Peak force is already decent (${peakRelative.toFixed(2)} x BW) while RFD is still modest (${rfd.toFixed(0)} kg/s).`,
        'Short explosive clusters should improve how quickly force arrives without overloading session volume.',
      ],
      targetAdjustments: ['Keep target modest and focus on intent.', 'Do not progress load unless quality and speed both improve.'],
      profileType: athleteProfile.profileType,
      safetyFlags,
    }));
  }

  if (fatigueIndex > 12 || (repeated?.summary.sessionTrendPct ?? 0) < -5) {
    recommendations.push(makeRecommendation({
      workoutId: 'repeated_strength_7_53',
      hand,
      priority: recommendations.length === 0 ? 'primary' : 'secondary',
      reason: 'Good top-end force but visible rep-to-rep decay',
      rationale: [
        `Repeated-effort fatigue is elevated (${fatigueIndex.toFixed(1)} fatigue index).`,
        '7:53 work is the cleanest bridge between peak strength and repeatable output.',
      ],
      targetAdjustments: ['Complete all sets before adding intensity.', 'Cut the session early if decay steepens sharply.'],
      profileType: athleteProfile.profileType,
      safetyFlags,
    }));
  }

  if (athleteProfile.unstablePattern || athleteProfile.compensationRisk) {
    recommendations.push(makeRecommendation({
      workoutId: 'health_capacity_density',
      hand,
      priority: recommendations.length === 0 ? 'primary' : 'secondary',
      reason: 'Current pattern suggests low tissue tolerance or unstable force sharing',
      rationale: [
        'Health/capacity work should clean up stability before more peak loading.',
        `Redistribution and compensation signals are elevated (${redistribution.toFixed(1)} redistribution score).`,
      ],
      targetAdjustments: ['Lower target if one finger starts taking over.', 'Prefer cleaner reps over higher force.'],
      profileType: athleteProfile.profileType,
      safetyFlags,
    }));
  }

  if (weakFinger !== undefined) {
    recommendations.push(makeRecommendation({
      workoutId: 'finger_bias_accessory',
      hand,
      priority: 'support',
      reason: 'One finger keeps underperforming across recent benchmarks',
      rationale: [
        `Finger index ${weakFinger + 1} keeps showing up as the weakest contributor.`,
        'Accessory bias work is useful as a lower-stress support session after the main recommendation.',
      ],
      targetAdjustments: ['Keep force submax and cue the weaker finger early in every rep.'],
      profileType: athleteProfile.profileType,
      safetyFlags,
    }));
  }

  if (forceCurve) {
    recommendations.push(makeRecommendation({
      workoutId: 'individualized_force_curve',
      hand,
      priority: recommendations.length === 0 ? 'primary' : 'secondary',
      reason: 'Use the latest per-finger force profile to drive a smarter session',
      rationale: [
        'The force-curve benchmark already captured how the hand redistributes load.',
        'This session keeps the prescription tied to measured finger behavior instead of a static template.',
      ],
      targetAdjustments: ['Review start order and dropout order after each block.'],
      profileType: athleteProfile.profileType,
      safetyFlags,
    }));
  }

  if (recommendations.length === 0) {
    const fallback = getTrainProtocolById('strength_10s');
    recommendations.push(makeRecommendation({
      workoutId: fallback.id,
      hand,
      priority: 'primary',
      reason: max ? 'Default strength session while no stronger bottleneck stands out' : 'No benchmark history yet',
      rationale: max
        ? ['Strength 10s is the default anchor session when the profile looks relatively balanced.']
        : ['Run a max benchmark soon, but this session can still be used manually until history exists.'],
      targetAdjustments: ['Use auto-target if available, otherwise start conservatively and log the result.'],
      profileType: athleteProfile.profileType,
      safetyFlags,
    }));
  }

  return recommendations.slice(0, 4);
}

export function buildPrescriptionText(recommendation: TrainRecommendation): string {
  return `${recommendation.reason}. ${recommendation.rationale[0] ?? ''}`.trim();
}

export type { WorkoutPrescription };
