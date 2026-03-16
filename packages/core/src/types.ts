export const KG_TO_N = 9.80665;

export type Finger4 = [number, number, number, number];
export type FingerBool4 = [boolean, boolean, boolean, boolean];
export type Hand = 'Right' | 'Left';
export type ProfileSex = 'Male' | 'Female' | 'Other' | 'Unspecified';
export type DeviceType = 'native-bs' | 'tindeq';

export interface DeviceCapabilities {
  totalForce: boolean;
  perFingerForce: boolean;
  batteryStatus: boolean;
  tare: boolean;
  startStopStreaming: boolean;
}

export interface ConnectedDeviceInfo {
  deviceType: DeviceType;
  deviceName: string;
  deviceLabel: string;
  transport: 'serial' | 'ble' | 'simulator';
  sourceKind: string;
  capabilities: DeviceCapabilities;
  batteryMv?: number | null;
  batteryPercent?: number | null;
}

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
  source: DeviceType;
  raw: Finger4 | null;
  kg: Finger4 | null;
  totalKg: number;
  totalN: number;
  batteryMv?: number | null;
  stability?: number | null;
}

export function totalKg(sample: ForceSample): number {
  if (Number.isFinite(sample.totalKg)) {
    return sample.totalKg;
  }
  if (!sample.kg) return 0;
  return sample.kg[0] + sample.kg[1] + sample.kg[2] + sample.kg[3];
}

export interface EffortMetrics {
  effortId: number;
  startTMs: number;
  endTMs: number;
  durationS: number;

  peakTotalKg: number;
  peakPerFingerKg: Finger4 | null;
  timeToPeakS: number;

  rfd100KgS: number;
  rfd200KgS: number;
  rfd100NS: number;
  rfd200NS: number;

  avgTotalKg: number;
  tutS: number;

  distributionDriftPerS: number | null;
  steadinessTotalKg: number;
  steadinessPerFingerKg: Finger4 | null;

  fingerImbalanceIndex: number | null;
  loadVariationCv: number | null;
  dominantSwitchCount: number | null;
  loadShiftRate: number | null;
  stabilizationTimeS: number | null;
  ringPinkyShare: number | null;

  holdStartTMs: number;
  holdEndTMs: number;

  detailTMs: number[];
  detailTotalKg: number[];
  detailFingerKg: Finger4[] | null;
  detailFingerPct: Finger4[] | null;
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
  deviceType: DeviceType;
  deviceName: string;
  capabilities: DeviceCapabilities;
  sampleSource: string;
  protocolVersion: number;
  profile?: ProfileSnapshot | null;
  tag: string;
  notes: string;
  summary: SessionSummary;
  efforts: EffortMetrics[];
  samples: ForceSample[];
}

export interface SessionMeta {
  sessionId: string;
  startedAtIso: string;
  hand: Hand;
  deviceType?: DeviceType;
  deviceName?: string;
  profileId?: string;
  profileName?: string;
  effortsCount: number;
  bestPeakKg: number;
  tag: string;
}
