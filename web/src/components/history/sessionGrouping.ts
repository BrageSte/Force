import type { CompletedTestResult } from '../test/types.ts';
import type { TrainSessionMeta } from '../train/types.ts';
import { bestPeakOfResult } from '../test/testAnalysis.ts';

export interface TestSessionGroup {
  sessionId: string;
  results: CompletedTestResult[];
  hands: string;
  protocolName: string;
  bestPeak: number;
  startedAtIso: string;
  completed: boolean;
}

export interface TrainSessionGroup {
  sessionId: string;
  sessions: TrainSessionMeta[];
  hands: string;
  presetName: string;
  bestPeak: number;
  startedAtIso: string;
  completed: boolean;
  targetKg: number;
  completionPct: number;
  totalTutS: number;
  avgHoldKg: number;
}

function handsLabel(hands: string[]): string {
  const unique = [...new Set(hands)];
  if (unique.length === 2) return 'L / R';
  return unique[0] ?? '';
}

export function groupTestResultsBySession(results: CompletedTestResult[]): TestSessionGroup[] {
  const grouped = new Map<string, CompletedTestResult[]>();

  for (const result of results) {
    const key = result.sessionId ?? result.resultId;
    const list = grouped.get(key) ?? [];
    list.push(result);
    grouped.set(key, list);
  }

  const groups: TestSessionGroup[] = [];
  for (const [sessionId, sessionResults] of grouped) {
    const sorted = sessionResults.sort((a, b) => a.startedAtIso.localeCompare(b.startedAtIso));
    groups.push({
      sessionId,
      results: sorted,
      hands: handsLabel(sorted.map(r => r.hand)),
      protocolName: sorted[0].protocolName,
      bestPeak: Math.max(...sorted.map(r => bestPeakOfResult(r))),
      startedAtIso: sorted[0].startedAtIso,
      completed: sorted.every(r => r.completed !== false),
    });
  }

  return groups.sort((a, b) => b.startedAtIso.localeCompare(a.startedAtIso));
}

export function groupTrainSessionsBySession(sessions: TrainSessionMeta[]): TrainSessionGroup[] {
  const grouped = new Map<string, TrainSessionMeta[]>();

  for (const session of sessions) {
    const key = session.sessionId ?? session.trainSessionId;
    const list = grouped.get(key) ?? [];
    list.push(session);
    grouped.set(key, list);
  }

  const groups: TrainSessionGroup[] = [];
  for (const [sessionId, sessionGroup] of grouped) {
    const sorted = sessionGroup.sort((a, b) => a.startedAtIso.localeCompare(b.startedAtIso));
    groups.push({
      sessionId,
      sessions: sorted,
      hands: handsLabel(sorted.map(s => s.hand)),
      presetName: sorted[0].presetName,
      bestPeak: Math.max(...sorted.map(s => s.peakTotalKg)),
      startedAtIso: sorted[0].startedAtIso,
      completed: sorted.every(s => s.completed !== false),
      targetKg: sorted[0].targetKg,
      completionPct: sorted.reduce((sum, s) => sum + s.completionPct, 0) / sorted.length,
      totalTutS: sorted.reduce((sum, s) => sum + s.totalTutS, 0),
      avgHoldKg: sorted.reduce((sum, s) => sum + s.avgHoldKg, 0) / sorted.length,
    });
  }

  return groups.sort((a, b) => b.startedAtIso.localeCompare(a.startedAtIso));
}
