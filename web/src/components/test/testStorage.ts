import { DEFAULT_COMPARE_METRIC, DEFAULT_LIVE_PANELS, DEFAULT_RESULT_WIDGETS } from './testConfig.ts';
import type { Hand } from '../../types/force.ts';
import { normalizeProfileSnapshot } from '../../types/profile.ts';
import { defaultConnectedDevice } from '../../device/deviceProfiles.ts';
import type {
  CompletedTestResult,
  CompareTagSnapshot,
  DashboardConfigSnapshot,
  ProtocolKind,
  TestId,
  TestProtocol,
} from './types.ts';
import { bestPeakOfResult } from './testAnalysis.ts';
import { getProtocolById } from './testLibrary.ts';

const STORAGE_KEY = 'fingerforce-test-results-v2';
const LEGACY_STORAGE_KEY = 'fingerforce-test-results-v1';

function formatLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildFallbackProtocol(protocolId: string, protocolName?: string): TestProtocol {
  try {
    return getProtocolById(protocolId as TestId);
  } catch {
    return {
      protocolKind: protocolId.startsWith('custom:') ? 'custom' : 'builtin',
      id: protocolId,
      name: protocolName ?? protocolId,
      shortName: protocolName ?? protocolId,
      tier: protocolId.startsWith('custom:') ? 'Custom' : 'Core',
      category: 'force_curve',
      family: protocolId.startsWith('custom:') ? 'custom' : 'custom',
      athleteLevel: 'intermediate',
      gripType: 'edge',
      modality: 'edge',
      supportMode: 'metadata_only',
      purpose: '',
      effortType: '',
      durationSec: 0,
      attemptCount: 0,
      countdownSec: 0,
      restSec: 0,
      guidance: [],
      outputs: [],
      handMode: 'current_hand',
      targetMode: 'none',
      targetIntensityLogic: '',
      stopConditions: [],
      capabilityRequirements: {
        requiresTotalForce: true,
        requiresPerFingerForce: false,
      },
      warmup: [],
      cooldown: [],
      scoringModel: '',
      progressionRule: '',
      reportRelativeToBodyweight: false,
      livePanels: DEFAULT_LIVE_PANELS,
      resultWidgets: DEFAULT_RESULT_WIDGETS,
      compareDefaults: { metricId: DEFAULT_COMPARE_METRIC, autoNormalize: false },
    };
  }
}

function buildFallbackDashboard(protocol: TestProtocol): DashboardConfigSnapshot {
  return {
    livePanels: protocol.livePanels ?? DEFAULT_LIVE_PANELS,
    resultWidgets: protocol.resultWidgets ?? DEFAULT_RESULT_WIDGETS,
    compareDefaults: protocol.compareDefaults ?? { metricId: DEFAULT_COMPARE_METRIC, autoNormalize: false },
  };
}

function buildFallbackTags(result: Partial<CompletedTestResult>, protocol: TestProtocol): CompareTagSnapshot {
  return result.compareTags ?? {
    family: protocol.family,
    targetMode: protocol.targetMode,
    intervalMode: protocol.repeater ? 'interval' : 'continuous',
    templateId: result.templateId,
    templateName: result.templateName,
  };
}

function hydrateResult(raw: unknown): CompletedTestResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Partial<CompletedTestResult>;
  if (!Array.isArray(source.attempts) || typeof source.resultId !== 'string') return null;

  const protocolId = typeof source.protocolId === 'string'
    ? source.protocolId
    : typeof source.builtInId === 'string'
      ? source.builtInId
      : 'standard_max';
  const protocol = source.effectiveProtocol ?? buildFallbackProtocol(protocolId, source.protocolName);
  const protocolKind: ProtocolKind = source.protocolKind ?? (protocolId.startsWith('custom:') ? 'custom' : 'builtin');
  const fallbackDevice = defaultConnectedDevice('Serial');

  return {
    resultId: source.resultId,
    protocolKind,
    protocolId,
    protocolName: source.protocolName ?? protocol.name,
    builtInId: source.builtInId ?? protocol.builtInId,
    tier: source.tier ?? protocol.tier,
    hand: source.hand ?? 'Right',
    deviceType: source.deviceType ?? fallbackDevice.deviceType,
    deviceName: source.deviceName ?? fallbackDevice.deviceName,
    capabilities: source.capabilities ?? fallbackDevice.capabilities,
    sampleSource: source.sampleSource ?? fallbackDevice.sourceKind,
    protocolVersion: source.protocolVersion ?? 1,
    startedAtIso: source.startedAtIso ?? new Date().toISOString(),
    completedAtIso: source.completedAtIso ?? source.startedAtIso ?? new Date().toISOString(),
    profile: normalizeProfileSnapshot(source.profile),
    benchmarkCategory: source.benchmarkCategory ?? protocol.category,
    gripType: source.gripType ?? protocol.gripType,
    modality: source.modality ?? protocol.modality,
    athleteLevel: source.athleteLevel ?? protocol.athleteLevel,
    targetKg: typeof source.targetKg === 'number' ? source.targetKg : null,
    templateId: source.templateId ?? protocol.templateId,
    templateName: source.templateName ?? protocol.name,
    templateVersion: source.templateVersion ?? protocol.templateVersion,
    effectiveProtocol: protocol,
    dashboardSnapshot: source.dashboardSnapshot ?? buildFallbackDashboard(protocol),
    compareTags: buildFallbackTags(source, protocol),
    attempts: source.attempts,
    summary: source.summary ?? {
      bestAttemptNo: 1,
      strongestFinger: 0,
      weakestContributor: 0,
      biggestFadeFinger: 0,
      takeoverFinger: 0,
      mostStableFinger: 0,
      repeatabilityScore: 0,
      leftRightAsymmetryPct: null,
      sessionTrendPct: 0,
      benchmarkScore: null,
      tacticalGripProfile: 'balanced',
      normalizedPeakKgPerKgBodyweight: null,
      safetyFlags: [],
    },
    sessionComparison: source.sessionComparison ?? null,
    prescriptionRationale: source.prescriptionRationale ?? [],
    confidence: source.confidence ?? {
      core: 'High',
      coaching: 'Moderate',
      experimental: 'Low',
    },
  };
}

export function loadTestResults(): CompletedTestResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const results = parsed
      .map(hydrateResult)
      .filter((result): result is CompletedTestResult => result !== null)
      .sort((a, b) => a.completedAtIso.localeCompare(b.completedAtIso));
    if (localStorage.getItem(STORAGE_KEY) === null && results.length > 0) {
      saveTestResults(results);
    }
    return results;
  } catch {
    return [];
  }
}

export function saveTestResults(results: CompletedTestResult[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results.slice(-600)));
  } catch {
    // Ignore storage failure.
  }
}

export function appendTestResult(result: CompletedTestResult): CompletedTestResult[] {
  const all = loadTestResults();
  all.push(result);
  saveTestResults(all);
  return all;
}

export function findLatestResult(
  results: CompletedTestResult[],
  protocolId: string,
  hand: Hand,
): CompletedTestResult | null {
  const filtered = results
    .filter(r => r.protocolId === protocolId && r.hand === hand)
    .sort((a, b) => b.completedAtIso.localeCompare(a.completedAtIso));
  return filtered[0] ?? null;
}

export function findLatestTemplateResult(
  results: CompletedTestResult[],
  templateId: string,
  hand?: Hand,
): CompletedTestResult | null {
  const filtered = results
    .filter(r => r.templateId === templateId && (!hand || r.hand === hand))
    .sort((a, b) => b.completedAtIso.localeCompare(a.completedAtIso));
  return filtered[0] ?? null;
}

export function latestStandardMaxPeakKg(
  results: CompletedTestResult[],
  hand: Hand,
): number | null {
  const r = findLatestResult(results, 'standard_max', hand);
  if (!r) return null;
  return bestPeakOfResult(r);
}

export function getSessionDateKey(iso: string): string {
  return formatLocalDateKey(new Date(iso));
}

export function listResultsForDate(
  results: CompletedTestResult[],
  dateKey: string,
  hand?: Hand,
): CompletedTestResult[] {
  return results
    .filter(r => getSessionDateKey(r.completedAtIso) === dateKey && (!hand || r.hand === hand))
    .sort((a, b) => a.completedAtIso.localeCompare(b.completedAtIso));
}
