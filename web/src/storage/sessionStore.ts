import type { SessionPayload, SessionMeta } from '../types/force.ts';
import { getDB } from './db.ts';
import { defaultConnectedDevice } from '../device/deviceProfiles.ts';

function metricValue(value: number | null | undefined, digits: number): string {
  return value === null || value === undefined ? '' : value.toFixed(digits);
}

function hydrateSession(payload: SessionPayload): SessionPayload {
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

export async function saveSession(payload: SessionPayload): Promise<void> {
  const db = await getDB();
  await db.put('sessions', payload);
}

export async function loadSession(sessionId: string): Promise<SessionPayload | null> {
  const db = await getDB();
  const payload = await db.get('sessions', sessionId);
  return payload ? hydrateSession(payload) : null;
}

export async function listSessions(): Promise<SessionMeta[]> {
  const db = await getDB();
  const all = await db.getAll('sessions');
  return all
    .map(raw => {
      const s = hydrateSession(raw);
      return {
      sessionId: s.sessionId,
      startedAtIso: s.startedAtIso,
      hand: s.hand,
      deviceType: s.deviceType,
      deviceName: s.deviceName,
      profileId: s.profile?.profileId,
      profileName: s.profile?.name,
      effortsCount: s.summary?.effortsCount ?? s.efforts?.length ?? 0,
      bestPeakKg: s.summary?.bestPeakKg ?? 0,
      tag: s.tag ?? '',
      };
    })
    .sort((a, b) => b.startedAtIso.localeCompare(a.startedAtIso));
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDB();
  await db.delete('sessions', sessionId);
}

export function exportSessionCsv(payload: SessionPayload): void {
  const session = hydrateSession(payload);
  const lines = [
    'effort_id,start_ms,duration_s,peak_total_kg,peak_index,peak_middle,peak_ring,peak_pinky,rfd100_kg_s,rfd200_kg_s,avg_hold_kg,tut_s,imbalance,distribution_drift_per_s,steadiness_total_kg,load_variation_cv,dominant_switch_count,load_shift_rate,stabilization_time_s,ring_pinky_share',
  ];
  for (const e of session.efforts) {
    lines.push([
      e.effortId, e.startTMs, e.durationS.toFixed(2),
      e.peakTotalKg.toFixed(2),
      metricValue(e.peakPerFingerKg?.[0], 2), metricValue(e.peakPerFingerKg?.[1], 2),
      metricValue(e.peakPerFingerKg?.[2], 2), metricValue(e.peakPerFingerKg?.[3], 2),
      e.rfd100KgS.toFixed(1), e.rfd200KgS.toFixed(1),
      e.avgTotalKg.toFixed(2), e.tutS.toFixed(2),
      metricValue(e.fingerImbalanceIndex, 2),
      metricValue(e.distributionDriftPerS, 4),
      e.steadinessTotalKg.toFixed(4),
      metricValue(e.loadVariationCv, 4),
      e.dominantSwitchCount === null ? '' : String(e.dominantSwitchCount),
      metricValue(e.loadShiftRate, 4),
      e.stabilizationTimeS === null ? '' : e.stabilizationTimeS.toFixed(4),
      metricValue(e.ringPinkyShare, 4),
    ].join(','));
  }
  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${session.sessionId}_efforts.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
