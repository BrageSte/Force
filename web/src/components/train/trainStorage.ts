import type { TrainSessionMeta, TrainSessionResult } from './types.ts';
import { getDB } from '../../storage/db.ts';

export async function saveTrainingSession(payload: TrainSessionResult): Promise<void> {
  const db = await getDB();
  await db.put('trainingSessions', payload);
}

export async function loadTrainingSession(trainSessionId: string): Promise<TrainSessionResult | null> {
  const db = await getDB();
  return (await db.get('trainingSessions', trainSessionId)) ?? null;
}

export async function listTrainingSessions(): Promise<TrainSessionMeta[]> {
  const all = await listTrainingSessionResults();
  return all
    .map(session => ({
      trainSessionId: session.trainSessionId,
      startedAtIso: session.startedAtIso,
      presetId: session.presetId,
      presetName: session.presetName,
      category: session.category,
      hand: session.hand,
      profileId: session.profile?.profileId,
      profileName: session.profile?.name,
      targetKg: session.targetKg,
      completionPct: session.summary.completionPct,
      totalTutS: session.summary.totalTutS,
      peakTotalKg: session.summary.peakTotalKg,
      avgHoldKg: session.summary.avgHoldKg,
    }));
}

export async function listTrainingSessionResults(): Promise<TrainSessionResult[]> {
  const db = await getDB();
  const all = await db.getAll('trainingSessions');
  return all.sort((a, b) => b.startedAtIso.localeCompare(a.startedAtIso));
}
