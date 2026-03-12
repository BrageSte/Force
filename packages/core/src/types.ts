export const KG_TO_N = 9.80665;

export type Finger4 = [number, number, number, number];
export type FingerBool4 = [boolean, boolean, boolean, boolean];
export type Hand = 'Right' | 'Left';
export type ProfileSex = 'Male' | 'Female' | 'Other' | 'Unspecified';

export interface ProfileSnapshot {
  profileId: string;
  name: string;
  sex: ProfileSex;
  weightKg: number | null;
  heightCm: number | null;
  dominantHand: Hand;
  injuredFingers: FingerBool4;
  injuryNotes: string;
  notes: string;
}

export interface AcquisitionSample {
  tMs: number;
  values: Finger4;
}

export interface ForceSample {
  tMs: number;
  raw: Finger4;
  kg: Finger4;
}

export function totalKg(sample: ForceSample): number {
  return sample.kg[0] + sample.kg[1] + sample.kg[2] + sample.kg[3];
}

export interface EffortMetrics {
  effortId: number;
  startTMs: number;
  endTMs: number;
  durationS: number;

  peakTotalKg: number;
  peakPerFingerKg: Finger4;
  timeToPeakS: number;

  rfd100KgS: number;
  rfd200KgS: number;
  rfd100NS: number;
  rfd200NS: number;

  avgTotalKg: number;
  tutS: number;

  distributionDriftPerS: number;
  steadinessTotalKg: number;
  steadinessPerFingerKg: Finger4;

  fingerImbalanceIndex: number;
  loadVariationCv: number;
  dominantSwitchCount: number;
  loadShiftRate: number;
  stabilizationTimeS: number | null;
  ringPinkyShare: number;

  holdStartTMs: number;
  holdEndTMs: number;

  detailTMs: number[];
  detailTotalKg: number[];
  detailFingerKg: Finger4[];
  detailFingerPct: Finger4[];
}

export interface SessionSummary {
  sessionId: string;
  startedAtIso: string;
  endedAtIso: string;
  hand: Hand;
  effortsCount: number;
  bestPeakKg: number;
  avgPeakKg: number;
  fatigueSlopeKgPerEffort: number;
  firstToLastDropPct: number;
}

export interface SessionPayload {
  sessionId: string;
  startedAtIso: string;
  endedAtIso: string;
  hand: Hand;
  profile?: ProfileSnapshot | null;
  tag: string;
  notes: string;
  summary: SessionSummary;
  efforts: EffortMetrics[];
  samples: Array<{
    tMs: number;
    raw: Finger4;
    kg: Finger4;
    totalKg: number;
  }>;
}

export interface SessionMeta {
  sessionId: string;
  startedAtIso: string;
  hand: Hand;
  profileId?: string;
  profileName?: string;
  effortsCount: number;
  bestPeakKg: number;
  tag: string;
}
