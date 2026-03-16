import type { TrainSessionMeta, TrainSessionResult } from './types.ts';
import { getDB } from '../../storage/db.ts';
import { defaultConnectedDevice } from '../../device/deviceProfiles.ts';

function hydrateTrainingSession(payload: TrainSessionResult): TrainSessionResult {
  if (payload.deviceType && payload.deviceName && payload.capabilities && payload.sampleSource) {
    return payload;
  }

  const device = defaultConnectedDevice('Serial');
  return {
    ...payload,
    deviceType: payload.deviceType ?? device.deviceType,
    deviceName: payload.deviceName ?? device.deviceName,
    capabilities: payload.capabilities ?? device.capabilities,
    sampleSource: payload.sampleSource ?? device.sourceKind,
    protocolVersion: payload.protocolVersion ?? 1,
  };
}

export async function saveTrainingSession(payload: TrainSessionResult): Promise<void> {
  const db = await getDB();
  await db.put('trainingSessions', payload);
}

export async function loadTrainingSession(trainSessionId: string): Promise<TrainSessionResult | null> {
  const db = await getDB();
  const payload = await db.get('trainingSessions', trainSessionId);
  return payload ? hydrateTrainingSession(payload) : null;
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
      deviceType: session.deviceType,
      deviceName: session.deviceName,
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
  return all
    .map(hydrateTrainingSession)
    .sort((a, b) => b.startedAtIso.localeCompare(a.startedAtIso));
}
