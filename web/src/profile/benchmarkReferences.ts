import { bestPeakOfResult } from '../components/test/testAnalysis.ts';
import type { CompletedTestResult } from '../components/test/types.ts';
import type { Hand } from '../types/force.ts';
import {
  getBenchmarkReferenceEntry,
  type BenchmarkReferenceMap,
  type BenchmarkReferenceSource,
} from '../types/profile.ts';

export interface BenchmarkReferenceProfileLike {
  benchmarkReferences?: BenchmarkReferenceMap;
}

export interface BenchmarkReferenceResolution {
  benchmarkId: string;
  hand: Hand;
  latestTestResult: CompletedTestResult | null;
  latestTestKg: number | null;
  latestTestCompletedAtIso: string | null;
  manualKg: number | null;
  preferredSource: BenchmarkReferenceSource;
  effectiveSource: BenchmarkReferenceSource | null;
  activeKg: number | null;
  usedFallback: boolean;
}

export function benchmarkReferenceSourceLabel(source: BenchmarkReferenceSource): string {
  return source === 'manual' ? 'Manual' : 'TEST';
}

export function benchmarkReferenceSourceDescription(source: BenchmarkReferenceSource | null): string {
  if (source === 'manual') return 'manual profile value';
  if (source === 'test') return 'latest TEST result';
  return 'no active reference';
}

export function findLatestBenchmarkResult(
  results: CompletedTestResult[],
  benchmarkId: string,
  hand: Hand,
): CompletedTestResult | null {
  return results
    .filter(result => result.protocolId === benchmarkId && result.hand === hand)
    .sort((a, b) => b.completedAtIso.localeCompare(a.completedAtIso))[0] ?? null;
}

export function resolveBenchmarkReference(args: {
  results: CompletedTestResult[];
  profile?: BenchmarkReferenceProfileLike | null;
  benchmarkId: string;
  hand: Hand;
}): BenchmarkReferenceResolution {
  const latestTestResult = findLatestBenchmarkResult(args.results, args.benchmarkId, args.hand);
  const latestTestKg = latestTestResult ? bestPeakOfResult(latestTestResult) : null;
  const latestTestCompletedAtIso = latestTestResult?.completedAtIso ?? null;
  const { manualKg, preferredSource } = getBenchmarkReferenceEntry(
    args.profile?.benchmarkReferences,
    args.benchmarkId,
    args.hand,
  );

  const preferredAvailable = preferredSource === 'test' ? latestTestKg !== null : manualKg !== null;
  const fallbackSource: BenchmarkReferenceSource = preferredSource === 'test' ? 'manual' : 'test';
  const fallbackAvailable = fallbackSource === 'test' ? latestTestKg !== null : manualKg !== null;
  const effectiveSource = preferredAvailable
    ? preferredSource
    : fallbackAvailable
      ? fallbackSource
      : null;
  const activeKg = effectiveSource === 'test'
    ? latestTestKg
    : effectiveSource === 'manual'
      ? manualKg
      : null;

  return {
    benchmarkId: args.benchmarkId,
    hand: args.hand,
    latestTestResult,
    latestTestKg,
    latestTestCompletedAtIso,
    manualKg,
    preferredSource,
    effectiveSource,
    activeKg,
    usedFallback: effectiveSource !== null && effectiveSource !== preferredSource,
  };
}
