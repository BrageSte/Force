import { createDefaultCustomTemplate } from './customTestStorage.ts';
import type { AthleteLevel, BenchmarkCategory, GripType, WorkoutModality } from '@krimblokk/core';
import type {
  CompareMetricId,
  CustomTestTemplate,
  HandMode,
  LivePanelId,
  ResultWidgetId,
  TargetConfig,
  TestFamily,
} from './types.ts';

export interface AiTemplateSuggestion {
  template: CustomTestTemplate;
  focus: string[];
  rationale: string[];
  warnings: string[];
}

interface FamilyProfile {
  family: TestFamily;
  name: string;
  workSec: number;
  attemptCount: number;
  restSec: number;
  countdownSec: number;
  livePanels: LivePanelId[];
  resultWidgets: ResultWidgetId[];
  compareMetric: CompareMetricId;
  autoNormalize: boolean;
}

const FAMILY_PROFILES: Record<TestFamily, FamilyProfile> = {
  max_pull: {
    family: 'max_pull',
    name: 'AI Max Strength',
    workSec: 6,
    attemptCount: 3,
    restSec: 180,
    countdownSec: 3,
    livePanels: ['timer', 'hand_progress', 'instructions', 'live_force', 'trace'],
    resultWidgets: ['summary', 'attempt_table', 'attempt_overlay', 'finger_detail', 'raw_traces', 'session_context'],
    compareMetric: 'best_peak_total_kg',
    autoNormalize: false,
  },
  duration_hold: {
    family: 'duration_hold',
    name: 'AI Duration Hold',
    workSec: 12,
    attemptCount: 4,
    restSec: 120,
    countdownSec: 3,
    livePanels: ['timer', 'hand_progress', 'instructions', 'target', 'live_force', 'contribution', 'trace'],
    resultWidgets: ['summary', 'attempt_table', 'attempt_overlay', 'finger_detail', 'target_stability', 'raw_traces', 'session_context'],
    compareMetric: 'full_test_mean_kg',
    autoNormalize: true,
  },
  repeater: {
    family: 'repeater',
    name: 'AI Repeater',
    workSec: 7,
    attemptCount: 4,
    restSec: 90,
    countdownSec: 3,
    livePanels: ['timer', 'hand_progress', 'instructions', 'target', 'live_force', 'contribution', 'trace'],
    resultWidgets: ['summary', 'attempt_table', 'attempt_overlay', 'finger_detail', 'target_stability', 'experimental', 'raw_traces', 'session_context'],
    compareMetric: 'advanced_repeated_effort_decay_pct',
    autoNormalize: true,
  },
  explosive: {
    family: 'explosive',
    name: 'AI Explosive Pull',
    workSec: 4,
    attemptCount: 5,
    restSec: 120,
    countdownSec: 3,
    livePanels: ['timer', 'hand_progress', 'instructions', 'live_force', 'trace'],
    resultWidgets: ['summary', 'attempt_table', 'attempt_overlay', 'finger_detail', 'experimental', 'raw_traces', 'session_context'],
    compareMetric: 'explosive_time_to_90_pct_peak_ms',
    autoNormalize: false,
  },
  health_capacity: {
    family: 'health_capacity',
    name: 'AI Health / Capacity',
    workSec: 20,
    attemptCount: 3,
    restSec: 90,
    countdownSec: 3,
    livePanels: ['timer', 'hand_progress', 'instructions', 'target', 'live_force', 'contribution', 'trace'],
    resultWidgets: ['summary', 'attempt_table', 'finger_detail', 'target_stability', 'experimental', 'session_context'],
    compareMetric: 'balance_score',
    autoNormalize: true,
  },
  force_curve: {
    family: 'force_curve',
    name: 'AI Force Curve',
    workSec: 8,
    attemptCount: 4,
    restSec: 120,
    countdownSec: 3,
    livePanels: ['timer', 'hand_progress', 'instructions', 'live_force', 'contribution', 'trace'],
    resultWidgets: ['summary', 'attempt_table', 'finger_detail', 'experimental', 'raw_traces', 'session_context'],
    compareMetric: 'best_peak_total_kg',
    autoNormalize: true,
  },
  custom: {
    family: 'custom',
    name: 'AI Custom Test',
    workSec: 10,
    attemptCount: 3,
    restSec: 120,
    countdownSec: 3,
    livePanels: ['timer', 'hand_progress', 'instructions', 'live_force', 'contribution', 'trace'],
    resultWidgets: ['summary', 'attempt_table', 'attempt_overlay', 'finger_detail', 'raw_traces', 'session_context'],
    compareMetric: 'best_peak_total_kg',
    autoNormalize: false,
  },
};

const FAMILY_KEYWORDS: Record<TestFamily, string[]> = {
  max_pull: ['max', 'maks', 'peak', 'strength', 'styrke', 'strongest', 'heaviest', 'hardest'],
  duration_hold: ['hold', 'utholdenhet', 'endurance', 'sustain', 'steady', 'jevn', 'stabil', 'kontroll', 'control', 'varighet'],
  repeater: ['repeater', 'intervall', 'interval', '7/3', 'power endurance', 'pump', 'recovery', 'repeat'],
  explosive: ['explosive', 'eksplosiv', 'power', 'hurtig', 'fast', 'rfd', 'snap', 'burst', 'startstyrke'],
  health_capacity: ['rehab', 'capacity', 'health', 'healthy', 'tolerance', 'kontroll', 'stability', 'stabilitet', 'vev', 'tissue', 'recovery'],
  force_curve: ['curve', 'profil', 'profile', 'finger curve', 'force curve', 'distribution', 'compensation', 'fordeling'],
  custom: ['custom', 'mixed', 'spesial', 'experiment', 'eksperiment'],
};

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some(keyword => text.includes(keyword));
}

function countMatches(text: string, keywords: string[]): number {
  return keywords.reduce((count, keyword) => count + Number(text.includes(keyword)), 0);
}

function parseNumber(raw: string): number {
  return Number(raw.replace(',', '.'));
}

function parseTimeValue(rawValue: string, rawUnit: string): number {
  const value = parseNumber(rawValue);
  const unit = rawUnit.toLowerCase();
  if (unit.startsWith('m') && unit !== 'ms') {
    return Math.round(value * 60);
  }
  return Math.round(value);
}

function parseDuration(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    return parseTimeValue(match[1], match[2]);
  }
  return null;
}

function parseCount(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    return Math.max(1, Math.round(parseNumber(match[1])));
  }
  return null;
}

function detectFamily(text: string): {
  family: TestFamily;
  dominantScore: number;
  secondaryScore: number;
} {
  const ranked = Object.entries(FAMILY_KEYWORDS)
    .map(([family, keywords]) => ({
      family: family as TestFamily,
      score: countMatches(text, keywords),
    }))
    .sort((a, b) => b.score - a.score);

  const family = ranked[0]?.score ? ranked[0].family : 'custom';
  return {
    family,
    dominantScore: ranked[0]?.score ?? 0,
    secondaryScore: ranked[1]?.score ?? 0,
  };
}

function detectHandMode(text: string): HandMode {
  if (hasAny(text, ['begge hender', 'venstre og høyre', 'left and right', 'both hands', 'alternate', 'alternating', 'annenhver'])) {
    return 'alternate_hands';
  }
  return 'current_hand';
}

function detectTarget(text: string, family: TestFamily): {
  target: TargetConfig;
  needsKnownMax: boolean;
} {
  const fixedKgMatch = text.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
  if (fixedKgMatch) {
    return {
      target: {
        mode: 'fixed_kg',
        fixedKg: Math.max(1, parseNumber(fixedKgMatch[1])),
      },
      needsKnownMax: false,
    };
  }

  const percentMatch = text.match(/(\d+(?:[.,]\d+)?)\s*%/i);
  if (percentMatch) {
    return {
      target: {
        mode: 'percent_of_known_max',
        percentOfKnownMax: Math.max(1, Math.min(200, Math.round(parseNumber(percentMatch[1])))),
      },
      needsKnownMax: true,
    };
  }

  if (hasAny(text, ['submax', 'steady', 'jevn', 'kontroll', 'control', 'stabil', 'rehab', 'recovery', 'teknikk'])) {
    return {
      target: {
        mode: 'percent_of_known_max',
        percentOfKnownMax: hasAny(text, ['rehab', 'recovery']) ? 60 : 75,
      },
      needsKnownMax: true,
    };
  }

  if (family === 'duration_hold' || family === 'repeater') {
    return {
      target: { mode: 'percent_of_known_max', percentOfKnownMax: family === 'repeater' ? 70 : 75 },
      needsKnownMax: true,
    };
  }

  return {
    target: { mode: 'none' },
    needsKnownMax: false,
  };
}

function detectInterval(text: string, family: TestFamily, fallbackWorkSec: number): CustomTestTemplate['interval'] {
  const intervalPattern = text.match(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)(?:\s*(?:x|×)\s*(\d+))?/i);
  if (intervalPattern) {
    return {
      enabled: true,
      workSec: Math.max(1, Math.round(parseNumber(intervalPattern[1]))),
      restSec: Math.max(0, Math.round(parseNumber(intervalPattern[2]))),
      cycles: Math.max(1, Number(intervalPattern[3] ?? 6)),
    };
  }

  if (family !== 'repeater' && !hasAny(text, ['intervall', 'interval', 'repeater', 'repeat'])) {
    return null;
  }

  const workSec = parseDuration(text, [
    /(?:intervall|interval|work|arbeid)[^0-9]{0,12}(\d+(?:[.,]\d+)?)\s*(sekunder|sek|s|seconds?|sec|minutter|min|m)/i,
    /(\d+(?:[.,]\d+)?)\s*(sekunder|sek|s|seconds?|sec|minutter|min|m)\s*(?:arbeid|work|on)/i,
  ]) ?? fallbackWorkSec;
  const restSec = parseDuration(text, [
    /(?:intervallpause|intervall pause|off|hvile|pause|rest)[^0-9]{0,12}(\d+(?:[.,]\d+)?)\s*(sekunder|sek|s|seconds?|sec|minutter|min|m)/i,
    /(\d+(?:[.,]\d+)?)\s*(sekunder|sek|s|seconds?|sec|minutter|min|m)\s*(?:hvile|pause|rest|off)/i,
  ]) ?? 3;
  const cycles = parseCount(text, [
    /(\d+)\s*(?:cycles|sykluser|runder|rounds)/i,
    /(?:cycles|sykluser|runder|rounds)[^0-9]{0,12}(\d+)/i,
  ]) ?? 6;

  return {
    enabled: true,
    workSec,
    restSec,
    cycles,
  };
}

function detectSetCount(text: string, family: TestFamily): number | null {
  return parseCount(text, [
    /(\d+)\s*(?:sets|sett|attempts|forsok|forsøk|reps)\b/i,
    /(?:sets|sett|attempts|forsok|forsøk|reps)[^0-9]{0,12}(\d+)/i,
  ]) ?? (family === 'explosive' ? 5 : null);
}

function detectWorkSec(text: string, family: TestFamily): number | null {
  return parseDuration(text, [
    /(?:hold|heng|drag|pull|work|arbeid|effort|varighet)[^0-9]{0,12}(\d+(?:[.,]\d+)?)\s*(sekunder|sek|s|seconds?|sec|minutter|min|m)/i,
    /(\d+(?:[.,]\d+)?)\s*(sekunder|sek|s|seconds?|sec|minutter|min|m)\s*(?:hold|heng|drag|pull|work|arbeid|effort)\b/i,
  ]) ?? (family === 'explosive' ? 4 : null);
}

function detectRestBetweenSets(text: string): number | null {
  return parseDuration(text, [
    /(?:rest between sets|between sets|hvile mellom sett|pause mellom sett|rest|pause|hvile|recovery)[^0-9]{0,12}(\d+(?:[.,]\d+)?)\s*(sekunder|sek|s|seconds?|sec|minutter|min|m)/i,
    /(\d+(?:[.,]\d+)?)\s*(sekunder|sek|s|seconds?|sec|minutter|min|m)\s*(?:rest|pause|hvile|recovery)\b/i,
  ]);
}

function detectCountdown(text: string): number | null {
  return parseCount(text, [
    /(?:countdown|nedtelling)[^0-9]{0,12}(\d+)/i,
    /(\d+)\s*(?:sec countdown|sek nedtelling)/i,
  ]);
}

function uniquePanels(values: LivePanelId[]): LivePanelId[] {
  return Array.from(new Set(values));
}

function uniqueWidgets(values: ResultWidgetId[]): ResultWidgetId[] {
  return Array.from(new Set(values));
}

function buildName(profile: FamilyProfile, target: TargetConfig, handMode: HandMode): string {
  const segments = [profile.name];
  if (target.mode === 'fixed_kg' && target.fixedKg) segments.push(`${target.fixedKg}kg`);
  if (target.mode === 'percent_of_known_max' && target.percentOfKnownMax) segments.push(`${target.percentOfKnownMax}%`);
  if (handMode === 'alternate_hands') segments.push('Alt Hands');
  return segments.join(' ');
}

function buildFocus(family: TestFamily, target: TargetConfig, handMode: HandMode, intervalEnabled: boolean): string[] {
  const focus = [
    family === 'max_pull'
      ? 'Peak force'
      : family === 'duration_hold'
        ? 'Sustained force'
        : family === 'repeater'
          ? 'Work-rest repeatability'
          : family === 'explosive'
            ? 'Explosive intent'
            : family === 'health_capacity'
              ? 'Stability and tissue tolerance'
              : family === 'force_curve'
                ? 'Per-finger force profile'
            : 'Custom objective',
  ];

  if (target.mode !== 'none') focus.push('Target control');
  if (intervalEnabled) focus.push('Interval execution');
  if (handMode === 'alternate_hands') focus.push('Alternating hands');
  return focus;
}

const FAMILY_TO_CATEGORY: Record<TestFamily, BenchmarkCategory> = {
  max_pull: 'max_strength',
  duration_hold: 'health_capacity',
  repeater: 'strength_endurance',
  explosive: 'recruitment_rfd',
  health_capacity: 'health_capacity',
  force_curve: 'force_curve',
  custom: 'force_curve',
};

function detectAthleteLevel(text: string): AthleteLevel {
  if (hasAny(text, ['elite', 'pro', 'professional'])) return 'elite';
  if (hasAny(text, ['advanced', 'viderekommen'])) return 'advanced';
  if (hasAny(text, ['beginner', 'nybegynner'])) return 'beginner';
  return 'intermediate';
}

function detectGripType(text: string, family: TestFamily): GripType {
  if (hasAny(text, ['half crimp', 'halvcrimp', 'halv krimp', 'halfcrimp', 'crimp'])) return 'half_crimp';
  if (hasAny(text, ['open hand', 'open', 'åpen', 'apen'])) return 'open_hand';
  if (hasAny(text, ['block', 'ergonomic'])) return 'ergonomic_block';
  if (hasAny(text, ['no hang', 'pull mode', 'pull'])) return 'no_hang_pull';
  if (family === 'explosive') return 'no_hang_pull';
  return 'edge';
}

function gripTypeToModality(gripType: GripType): WorkoutModality {
  if (gripType === 'ergonomic_block') return 'ergonomic_block';
  if (gripType === 'no_hang_pull') return 'no_hang_pull';
  return 'edge';
}

export function generateAiTemplateSuggestion(input: string): AiTemplateSuggestion {
  const prompt = input.trim();
  const text = prompt.toLowerCase();
  const { family, dominantScore, secondaryScore } = detectFamily(text);
  const profile = FAMILY_PROFILES[family];
  const defaultTemplate = createDefaultCustomTemplate();
  const handMode = detectHandMode(text);
  const athleteLevel = detectAthleteLevel(text);
  const gripType = detectGripType(text, family);
  const modality = gripTypeToModality(gripType);
  const category = FAMILY_TO_CATEGORY[family];
  const workSec = detectWorkSec(text, family) ?? profile.workSec;
  const interval = detectInterval(text, family, workSec);
  const attemptCount = detectSetCount(text, family) ?? profile.attemptCount;
  const restSec = detectRestBetweenSets(text) ?? profile.restSec;
  const countdownSec = detectCountdown(text) ?? profile.countdownSec;
  const { target, needsKnownMax } = detectTarget(text, family);

  const livePanels = uniquePanels([
    ...profile.livePanels,
    ...((target.mode !== 'none' ? ['target'] : []) as LivePanelId[]),
    ...((hasAny(text, ['finger', 'fordeling', 'distribution', 'balance', 'balanse']) ? ['contribution'] : []) as LivePanelId[]),
  ]);
  const resultWidgets = uniqueWidgets([
    ...profile.resultWidgets,
    ...((target.mode !== 'none' ? ['target_stability'] : []) as ResultWidgetId[]),
    ...((interval?.enabled ? ['experimental'] : []) as ResultWidgetId[]),
  ]);
  const compareMetric = family === 'duration_hold' && target.mode !== 'none'
    ? 'stability_error_pct'
    : profile.compareMetric;

  const template: CustomTestTemplate = {
    ...defaultTemplate,
    name: buildName(profile, target, handMode),
    purpose: prompt,
    family,
    category,
    athleteLevel,
    gripType,
    modality,
    handMode,
    workSec,
    attemptCount,
    countdownSec,
    restSec,
    target,
    capabilityRequirements: {
      requiresTotalForce: true,
      requiresPerFingerForce: hasAny(text, ['finger', 'fordeling', 'distribution', 'balance', 'balanse']),
    },
    interval,
    livePanels,
    resultWidgets,
    compareDefaults: {
      metricId: compareMetric,
      autoNormalize: profile.autoNormalize,
    },
  };

  const rationale = [
    `Primary template family: ${profile.name.replace(/^AI /, '')}.`,
    `Benchmark category mapped to ${category.replaceAll('_', ' ')} with ${gripType.replaceAll('_', ' ')} grip metadata.`,
    interval?.enabled
      ? `Using ${interval.workSec}s / ${interval.restSec}s intervals for ${interval.cycles} cycles in each set.`
      : `Using ${workSec}s continuous work blocks with ${attemptCount} set${attemptCount === 1 ? '' : 's'}.`,
    `Recovery is set to ${restSec}s between sets${handMode === 'alternate_hands' ? ', with alternating hands enabled' : ''}.`,
    target.mode === 'fixed_kg'
      ? `A fixed ${target.fixedKg?.toFixed(0)} kg target was detected from the prompt.`
      : target.mode === 'percent_of_known_max'
        ? `A ${target.percentOfKnownMax?.toFixed(0)}% of known max target was selected for more controlled effort quality.`
        : 'No explicit target was added so the user can focus on free pulling.',
    `Live panels and result widgets were biased toward ${buildFocus(family, target, handMode, Boolean(interval?.enabled))[0].toLowerCase()}.`,
  ];

  const warnings: string[] = [];
  if (dominantScore > 0 && secondaryScore === dominantScore) {
    warnings.push('The prompt matched more than one test style equally, so the draft prioritizes the first detected theme.');
  }
  if (!text.match(/\d/) && !interval?.enabled) {
    warnings.push('No explicit timing was detected in the prompt, so default timing values were used.');
  }
  if (needsKnownMax) {
    warnings.push('Percent-based targets require a saved Standard Max result on that hand when the test is started.');
  }

  return {
    template,
    focus: buildFocus(family, target, handMode, Boolean(interval?.enabled)),
    rationale,
    warnings,
  };
}
