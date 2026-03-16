import { bestPeakOfResult } from '../components/test/testAnalysis.ts';
import type { CompletedTestResult } from '../components/test/types.ts';
import type { UserProfile } from '../types/profile.ts';
import type { Finger4, Hand } from '../types/force.ts';
import type { SimulatorAthleteProfile } from './simulatorTypes.ts';

const BASE_FINGER_SHARE: Finger4 = [0.30, 0.29, 0.23, 0.18];
const FALLBACK_REFERENCE_MAX_KG = 30;

function normalizeShare(values: Finger4): Finger4 {
  const minShare = 0.08;
  const bounded = values.map(value => Math.max(minShare, value)) as Finger4;
  const sum = bounded.reduce((total, value) => total + value, 0);
  return bounded.map(value => value / sum) as Finger4;
}

function applyWeakFingerBias(baseShare: Finger4, weakFingerIndex: number | null): Finger4 {
  if (weakFingerIndex === null) return [...baseShare] as Finger4;

  const adjusted = [...baseShare] as Finger4;
  const bias = Math.min(0.018, Math.max(0.01, adjusted[weakFingerIndex] * 0.08));
  adjusted[weakFingerIndex] = Math.max(0.08, adjusted[weakFingerIndex] - bias);

  const redistribute = bias / 3;
  for (let i = 0; i < adjusted.length; i += 1) {
    if (i === weakFingerIndex) continue;
    adjusted[i] += redistribute;
  }

  return normalizeShare(adjusted);
}

function latestResultByProtocol(
  results: CompletedTestResult[],
  protocolIds: string[],
  hand: Hand,
): CompletedTestResult | null {
  return results
    .filter(result => protocolIds.includes(result.protocolId) && result.hand === hand)
    .sort((a, b) => b.completedAtIso.localeCompare(a.completedAtIso))[0] ?? null;
}

export function createDefaultSimulatorAthleteProfile(
  overrides: Partial<SimulatorAthleteProfile> = {},
): SimulatorAthleteProfile {
  return {
    referenceMaxKg: overrides.referenceMaxKg ?? FALLBACK_REFERENCE_MAX_KG,
    referenceSource: overrides.referenceSource ?? 'fallback',
    baseFingerShare: normalizeShare(overrides.baseFingerShare ?? BASE_FINGER_SHARE),
    weakFingerIndex: overrides.weakFingerIndex ?? null,
  };
}

export function resolveSimulatorAthleteContext(args: {
  profile?: UserProfile | null;
  results: CompletedTestResult[];
  hand: Hand;
}): SimulatorAthleteProfile {
  const latestMax = latestResultByProtocol(args.results, ['standard_max'], args.hand);
  const latestMaxKg = latestMax ? bestPeakOfResult(latestMax) : null;
  const manualMaxKg = args.profile?.benchmarkReferences.standard_max?.[args.hand]?.manualKg ?? null;

  const referenceMaxKg = latestMaxKg ?? manualMaxKg ?? FALLBACK_REFERENCE_MAX_KG;
  const referenceSource = latestMaxKg !== null
    ? 'test'
    : manualMaxKg !== null
      ? 'manual'
      : 'fallback';

  const latestPerFingerBenchmark = latestResultByProtocol(
    args.results,
    ['distribution_hold', 'force_curve_profile'],
    args.hand,
  );
  const weakFingerIndex = latestPerFingerBenchmark?.summary.weakestContributor ?? null;

  return createDefaultSimulatorAthleteProfile({
    referenceMaxKg,
    referenceSource,
    weakFingerIndex,
    baseFingerShare: applyWeakFingerBias(BASE_FINGER_SHARE, weakFingerIndex),
  });
}
