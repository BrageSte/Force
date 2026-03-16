import {
  DEFAULT_COMPARE_METRIC,
  DEFAULT_LIVE_PANELS,
  DEFAULT_RESULT_WIDGETS,
} from './testConfig.ts';
import type { CustomTestTemplate } from './types.ts';

const STORAGE_KEY = 'fingerforce-custom-test-templates-v1';

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  return `custom_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function hydrateTemplate(raw: unknown): CustomTestTemplate | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Partial<CustomTestTemplate>;
  const id = typeof source.id === 'string' && source.id ? source.id : makeId();
  const createdAtIso = typeof source.createdAtIso === 'string' ? source.createdAtIso : nowIso();
  const updatedAtIso = typeof source.updatedAtIso === 'string' ? source.updatedAtIso : createdAtIso;

  return {
    id,
    version: typeof source.version === 'number' && source.version > 0 ? source.version : 1,
    name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : 'Untitled Custom Test',
    purpose: typeof source.purpose === 'string' ? source.purpose : '',
    family: source.family ?? 'custom',
    category: source.category ?? 'force_curve',
    athleteLevel: source.athleteLevel ?? 'intermediate',
    gripType: source.gripType ?? 'edge',
    modality: source.modality ?? 'edge',
    handMode: source.handMode ?? 'current_hand',
    workSec: typeof source.workSec === 'number' && source.workSec > 0 ? source.workSec : 7,
    attemptCount: typeof source.attemptCount === 'number' && source.attemptCount > 0 ? source.attemptCount : 3,
    countdownSec: typeof source.countdownSec === 'number' && source.countdownSec > 0 ? source.countdownSec : 3,
    restSec: typeof source.restSec === 'number' && source.restSec >= 0 ? source.restSec : 120,
    target: source.target ?? { mode: 'none' },
    capabilityRequirements: source.capabilityRequirements ?? {
      requiresTotalForce: true,
      requiresPerFingerForce: false,
    },
    interval: source.interval
      ? {
          enabled: Boolean(source.interval.enabled),
          workSec: typeof source.interval.workSec === 'number' && source.interval.workSec > 0 ? source.interval.workSec : 7,
          restSec: typeof source.interval.restSec === 'number' && source.interval.restSec >= 0 ? source.interval.restSec : 3,
          cycles: typeof source.interval.cycles === 'number' && source.interval.cycles > 0 ? source.interval.cycles : 4,
        }
      : null,
    stopConditions: Array.isArray(source.stopConditions) ? source.stopConditions : [],
    warmup: Array.isArray(source.warmup) ? source.warmup : [],
    cooldown: Array.isArray(source.cooldown) ? source.cooldown : [],
    livePanels: Array.isArray(source.livePanels) && source.livePanels.length > 0 ? source.livePanels : DEFAULT_LIVE_PANELS,
    resultWidgets: Array.isArray(source.resultWidgets) && source.resultWidgets.length > 0 ? source.resultWidgets : DEFAULT_RESULT_WIDGETS,
    compareDefaults: source.compareDefaults ?? { metricId: DEFAULT_COMPARE_METRIC, autoNormalize: false },
    createdAtIso,
    updatedAtIso,
  };
}

export function createDefaultCustomTemplate(): CustomTestTemplate {
  const createdAtIso = nowIso();
  return {
    id: makeId(),
    version: 1,
    name: 'New Custom Test',
    purpose: '',
    family: 'custom',
    category: 'force_curve',
    athleteLevel: 'intermediate',
    gripType: 'edge',
    modality: 'edge',
    handMode: 'current_hand',
    workSec: 10,
    attemptCount: 3,
    countdownSec: 3,
    restSec: 120,
    target: { mode: 'none' },
    capabilityRequirements: {
      requiresTotalForce: true,
      requiresPerFingerForce: false,
    },
    interval: null,
    stopConditions: [],
    warmup: [],
    cooldown: [],
    livePanels: DEFAULT_LIVE_PANELS,
    resultWidgets: DEFAULT_RESULT_WIDGETS,
    compareDefaults: { metricId: DEFAULT_COMPARE_METRIC, autoNormalize: false },
    createdAtIso,
    updatedAtIso: createdAtIso,
  };
}

export function loadCustomTemplates(): CustomTestTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(hydrateTemplate)
      .filter((template): template is CustomTestTemplate => template !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export function saveCustomTemplates(templates: CustomTestTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // Ignore storage failure.
  }
}

export function upsertCustomTemplate(template: CustomTestTemplate): CustomTestTemplate[] {
  const all = loadCustomTemplates();
  const index = all.findIndex(item => item.id === template.id);
  if (index >= 0) {
    const existing = all[index];
    all[index] = {
      ...template,
      name: template.name.trim(),
      version: existing.version + 1,
      createdAtIso: existing.createdAtIso,
      updatedAtIso: nowIso(),
    };
  } else {
    all.push({
      ...template,
      name: template.name.trim(),
      version: Math.max(1, template.version),
      updatedAtIso: nowIso(),
    });
  }
  saveCustomTemplates(all);
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export function deleteCustomTemplate(templateId: string): CustomTestTemplate[] {
  const all = loadCustomTemplates().filter(template => template.id !== templateId);
  saveCustomTemplates(all);
  return all;
}

export function duplicateCustomTemplate(template: CustomTestTemplate): CustomTestTemplate {
  const createdAtIso = nowIso();
  return {
    ...template,
    id: makeId(),
    version: 1,
    name: `${template.name} Copy`,
    createdAtIso,
    updatedAtIso: createdAtIso,
  };
}
