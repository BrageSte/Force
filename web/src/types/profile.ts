import type { FingerBool4, Hand, ProfileSex, ProfileSnapshot } from './force.ts';

export type BenchmarkReferenceSource = 'test' | 'manual';

export interface BenchmarkHandReference {
  manualKg: number | null;
  preferredSource: BenchmarkReferenceSource;
}

export interface BenchmarkReferenceByHand {
  Left: BenchmarkHandReference;
  Right: BenchmarkHandReference;
}

export type BenchmarkReferenceMap = Record<string, BenchmarkReferenceByHand>;

export interface UserProfile extends ProfileSnapshot {
  benchmarkReferences: BenchmarkReferenceMap;
  createdAtIso: string;
  updatedAtIso: string;
}

const DEFAULT_INJURED_FINGERS: FingerBool4 = [false, false, false, false];

function nextProfileId(): string {
  return `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isProfileSex(value: unknown): value is ProfileSex {
  return value === 'Male' || value === 'Female' || value === 'Other' || value === 'Unspecified';
}

function isHand(value: unknown): value is Hand {
  return value === 'Left' || value === 'Right';
}

function isBenchmarkReferenceSource(value: unknown): value is BenchmarkReferenceSource {
  return value === 'test' || value === 'manual';
}

function normalizeInjuredFingers(value: unknown): FingerBool4 {
  if (!Array.isArray(value) || value.length !== 4) return [...DEFAULT_INJURED_FINGERS];
  return [
    Boolean(value[0]),
    Boolean(value[1]),
    Boolean(value[2]),
    Boolean(value[3]),
  ];
}

function normalizeOptionalNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createEmptyBenchmarkHandReference(): BenchmarkHandReference {
  return {
    manualKg: null,
    preferredSource: 'test',
  };
}

export function createEmptyBenchmarkReferenceByHand(): BenchmarkReferenceByHand {
  return {
    Left: createEmptyBenchmarkHandReference(),
    Right: createEmptyBenchmarkHandReference(),
  };
}

function normalizeBenchmarkHandReference(value: unknown): BenchmarkHandReference {
  if (!value || typeof value !== 'object') return createEmptyBenchmarkHandReference();
  const source = value as Partial<BenchmarkHandReference>;
  return {
    manualKg: normalizeOptionalNumber(source.manualKg),
    preferredSource: isBenchmarkReferenceSource(source.preferredSource) ? source.preferredSource : 'test',
  };
}

export function normalizeBenchmarkReferences(value: unknown): BenchmarkReferenceMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const next: BenchmarkReferenceMap = {};

  for (const [benchmarkId, rawByHand] of Object.entries(source)) {
    if (!benchmarkId.trim()) continue;
    const byHand = rawByHand && typeof rawByHand === 'object' && !Array.isArray(rawByHand)
      ? rawByHand as Record<string, unknown>
      : {};
    next[benchmarkId] = {
      Left: normalizeBenchmarkHandReference(byHand.Left),
      Right: normalizeBenchmarkHandReference(byHand.Right),
    };
  }

  return next;
}

export function cloneBenchmarkReferences(value: BenchmarkReferenceMap | undefined): BenchmarkReferenceMap {
  const normalized = normalizeBenchmarkReferences(value);
  const next: BenchmarkReferenceMap = {};

  for (const [benchmarkId, byHand] of Object.entries(normalized)) {
    next[benchmarkId] = {
      Left: { ...byHand.Left },
      Right: { ...byHand.Right },
    };
  }

  return next;
}

export function getBenchmarkReferenceEntry(
  benchmarkReferences: BenchmarkReferenceMap | undefined,
  benchmarkId: string,
  hand: Hand,
): BenchmarkHandReference {
  const entry = benchmarkReferences?.[benchmarkId]?.[hand];
  return entry
    ? { ...entry }
    : createEmptyBenchmarkHandReference();
}

export function createProfile(name = 'Person 1'): UserProfile {
  const now = new Date().toISOString();
  return {
    profileId: nextProfileId(),
    name,
    sex: 'Unspecified',
    weightKg: null,
    heightCm: null,
    dominantHand: 'Right',
    injuredFingers: [...DEFAULT_INJURED_FINGERS],
    injuryNotes: '',
    notes: '',
    benchmarkReferences: {},
    createdAtIso: now,
    updatedAtIso: now,
  };
}

export function normalizeProfile(raw: unknown, fallbackName = 'Person 1'): UserProfile {
  if (!raw || typeof raw !== 'object') return createProfile(fallbackName);
  const source = raw as Partial<UserProfile>;
  const fallback = createProfile(fallbackName);

  return {
    profileId: typeof source.profileId === 'string' && source.profileId.trim() ? source.profileId : fallback.profileId,
    name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : fallback.name,
    sex: isProfileSex(source.sex) ? source.sex : fallback.sex,
    weightKg: normalizeOptionalNumber(source.weightKg),
    heightCm: normalizeOptionalNumber(source.heightCm),
    dominantHand: isHand(source.dominantHand) ? source.dominantHand : fallback.dominantHand,
    injuredFingers: normalizeInjuredFingers(source.injuredFingers),
    injuryNotes: typeof source.injuryNotes === 'string' ? source.injuryNotes : '',
    notes: typeof source.notes === 'string' ? source.notes : '',
    benchmarkReferences: normalizeBenchmarkReferences(source.benchmarkReferences),
    createdAtIso: typeof source.createdAtIso === 'string' ? source.createdAtIso : fallback.createdAtIso,
    updatedAtIso: typeof source.updatedAtIso === 'string' ? source.updatedAtIso : fallback.updatedAtIso,
  };
}

export function normalizeProfileSnapshot(raw: unknown): ProfileSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const normalized = normalizeProfile(raw, 'Legacy Profile');
  return toProfileSnapshot(normalized);
}

export function toProfileSnapshot(profile: UserProfile): ProfileSnapshot {
  return {
    profileId: profile.profileId,
    name: profile.name,
    sex: profile.sex,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    dominantHand: profile.dominantHand,
    injuredFingers: [...profile.injuredFingers],
    injuryNotes: profile.injuryNotes,
    notes: profile.notes,
  };
}
