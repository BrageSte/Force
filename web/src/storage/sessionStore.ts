import type { SessionPayload, SessionMeta } from '../types/force.ts';
import { getDB } from './db.ts';

export async function saveSession(payload: SessionPayload): Promise<void> {
  const db = await getDB();
  await db.put('sessions', payload);
}

export async function loadSession(sessionId: string): Promise<SessionPayload | null> {
  const db = await getDB();
  return (await db.get('sessions', sessionId)) ?? null;
}

export async function listSessions(): Promise<SessionMeta[]> {
  const db = await getDB();
  const all = await db.getAll('sessions');
  return all
    .map(s => ({
      sessionId: s.sessionId,
      startedAtIso: s.startedAtIso,
      hand: s.hand,
      profileId: s.profile?.profileId,
      profileName: s.profile?.name,
      effortsCount: s.summary?.effortsCount ?? s.efforts?.length ?? 0,
      bestPeakKg: s.summary?.bestPeakKg ?? 0,
      tag: s.tag ?? '',
    }))
    .sort((a, b) => b.startedAtIso.localeCompare(a.startedAtIso));
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDB();
  await db.delete('sessions', sessionId);
}

export function exportSessionCsv(payload: SessionPayload): void {
  const lines = [
    'effort_id,start_ms,duration_s,peak_total_kg,peak_index,peak_middle,peak_ring,peak_pinky,rfd100_kg_s,rfd200_kg_s,avg_hold_kg,tut_s,imbalance,distribution_drift_per_s,steadiness_total_kg,load_variation_cv,dominant_switch_count,load_shift_rate,stabilization_time_s,ring_pinky_share',
  ];
  for (const e of payload.efforts) {
    lines.push([
      e.effortId, e.startTMs, e.durationS.toFixed(2),
      e.peakTotalKg.toFixed(2),
      e.peakPerFingerKg[0].toFixed(2), e.peakPerFingerKg[1].toFixed(2),
      e.peakPerFingerKg[2].toFixed(2), e.peakPerFingerKg[3].toFixed(2),
      e.rfd100KgS.toFixed(1), e.rfd200KgS.toFixed(1),
      e.avgTotalKg.toFixed(2), e.tutS.toFixed(2),
      e.fingerImbalanceIndex.toFixed(2),
      e.distributionDriftPerS.toFixed(4),
      e.steadinessTotalKg.toFixed(4),
      e.loadVariationCv.toFixed(4),
      String(e.dominantSwitchCount),
      e.loadShiftRate.toFixed(4),
      e.stabilizationTimeS === null ? '' : e.stabilizationTimeS.toFixed(4),
      e.ringPinkyShare.toFixed(4),
    ].join(','));
  }
  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${payload.sessionId}_efforts.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
