import { DEFAULT_COMPARE_METRIC } from './testConfig.ts';
import { latestStandardMaxPeakKg } from './testStorage.ts';
import type {
  CompareTagSnapshot,
  CompletedTestResult,
  CustomTestTemplate,
  DashboardConfigSnapshot,
  HandMode,
  TargetMode,
  TestFamily,
  TestProtocol,
} from './types.ts';
import type { Hand, ProfileSnapshot } from '../../types/force.ts';

function makeShortName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'Custom';
  return trimmed.length <= 16 ? trimmed : `${trimmed.slice(0, 13)}...`;
}

function buildRepeater(template: CustomTestTemplate): TestProtocol['repeater'] {
  if (!template.interval?.enabled) return undefined;
  return {
    onSec: template.interval.workSec,
    offSec: template.interval.restSec,
  };
}

function buildDurationSec(template: CustomTestTemplate): number {
  if (!template.interval?.enabled) return template.workSec;
  return (template.interval.workSec * template.interval.cycles) +
    (template.interval.restSec * Math.max(0, template.interval.cycles - 1));
}

function buildEffortType(template: CustomTestTemplate): string {
  if (template.interval?.enabled) {
    return `${template.interval.workSec}s work / ${template.interval.restSec}s rest x ${template.interval.cycles} within each set.`;
  }
  return `${template.workSec}-second custom effort.`;
}

function buildOutputs(template: CustomTestTemplate): string[] {
  const outputs = ['Peak total and repeatability', 'Attempt overlays and raw traces'];
  if (template.target.mode !== 'none') outputs.push('Target adherence and stability');
  if (template.interval?.enabled) outputs.push('Interval structure with on/off trace segmentation');
  outputs.push('Finger-specific coaching metrics');
  return outputs;
}

export function buildProtocolFromTemplate(template: CustomTestTemplate): TestProtocol {
  return {
    protocolKind: 'custom',
    id: `custom:${template.id}`,
    templateId: template.id,
    templateVersion: template.version,
    name: template.name,
    shortName: makeShortName(template.name),
    tier: 'Custom',
    category: template.category,
    family: template.family,
    athleteLevel: template.athleteLevel,
    gripType: template.gripType,
    modality: template.modality,
    supportMode: 'metadata_only',
    purpose: template.purpose || 'Custom test template.',
    effortType: buildEffortType(template),
    durationSec: buildDurationSec(template),
    attemptCount: template.attemptCount,
    countdownSec: template.countdownSec,
    restSec: template.restSec,
    guidance: [
      'Use the large timer as the primary cue.',
      template.target.mode === 'none'
        ? 'Pull according to the template intent and keep your setup consistent.'
        : 'Stay inside the target behavior you configured for this template.',
      template.interval?.enabled
        ? 'Respect ON/OFF transitions instead of blending the intervals together.'
        : 'Treat each set as one continuous effort.',
    ],
    outputs: buildOutputs(template),
    handMode: template.handMode,
    targetMode: template.target.mode,
    fixedTargetKg: template.target.mode === 'fixed_kg' ? template.target.fixedKg ?? null : null,
    defaultTargetPctOfMax:
      template.target.mode === 'percent_of_known_max'
        ? (template.target.percentOfKnownMax ?? 0) / 100
        : undefined,
    bodyweightMultiplier:
      template.target.mode === 'bodyweight_relative'
        ? template.target.bodyweightMultiplier ?? undefined
        : undefined,
    targetIntensityLogic: template.purpose || 'Custom benchmark logic defined by the athlete or coach.',
    stopConditions: template.stopConditions ?? [],
    warmup: template.warmup ?? [],
    cooldown: template.cooldown ?? [],
    scoringModel: 'Custom benchmark uses the standard Krimblokk metrics for force, timing, and per-finger distribution.',
    progressionRule: 'Repeat the same setup and compare score, symmetry, and stability before changing the template.',
    reportRelativeToBodyweight: template.target.mode === 'bodyweight_relative',
    repeater: buildRepeater(template),
    livePanels: template.livePanels,
    resultWidgets: template.resultWidgets,
    compareDefaults: template.compareDefaults ?? { metricId: DEFAULT_COMPARE_METRIC, autoNormalize: false },
  };
}

export function resolveTargetKg(
  protocol: TestProtocol,
  history: CompletedTestResult[],
  hand: Hand,
  profile?: ProfileSnapshot | null,
): number | null {
  if (protocol.targetMode === 'fixed_kg') {
    return protocol.fixedTargetKg ?? null;
  }
  if (protocol.targetMode === 'relative_to_max' || protocol.targetMode === 'percent_of_known_max') {
    const maxPeak = latestStandardMaxPeakKg(history, hand);
    if (!maxPeak || !protocol.defaultTargetPctOfMax) return null;
    return maxPeak * protocol.defaultTargetPctOfMax;
  }
  if (protocol.targetMode === 'bodyweight_relative') {
    if (!profile?.weightKg || !protocol.bodyweightMultiplier) return null;
    return profile.weightKg * protocol.bodyweightMultiplier;
  }
  return null;
}

export function resolveAlternateHands(
  mode: HandMode,
  fallbackAlternateHands: boolean,
  protocolKind: TestProtocol['protocolKind'],
): boolean {
  if (mode === 'alternate_hands') return true;
  if (protocolKind === 'custom') return false;
  return fallbackAlternateHands;
}

export function buildDashboardSnapshot(protocol: TestProtocol): DashboardConfigSnapshot {
  return {
    livePanels: protocol.livePanels,
    resultWidgets: protocol.resultWidgets,
    compareDefaults: protocol.compareDefaults,
  };
}

export function buildCompareTags(
  family: TestFamily,
  targetMode: TargetMode,
  intervalEnabled: boolean,
  template?: { id?: string; name?: string },
): CompareTagSnapshot {
  return {
    family,
    targetMode,
    intervalMode: intervalEnabled ? 'interval' : 'continuous',
    templateId: template?.id,
    templateName: template?.name,
  };
}
