import type { CustomTrainWorkout } from './types.ts';

const STORAGE_KEY = 'fingerforce-custom-train-workouts-v1';

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  return `train_custom_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function defaultBlock() {
  return {
    id: 'main_block',
    label: 'Main Block',
    phase: 'main' as const,
    setCount: 3,
    repsPerSet: 5,
    hangSec: 7,
    restBetweenRepsSec: 3,
    restBetweenSetsSec: 180,
    cue: 'Stay inside the target band.',
  };
}

export function createDefaultCustomTrainWorkout(): CustomTrainWorkout {
  const createdAtIso = nowIso();
  return {
    id: makeId(),
    kind: 'custom',
    workoutKind: 'custom',
    name: 'New Custom Workout',
    shortName: 'Custom Workout',
    category: 'force_curve',
    trainingGoal: 'User-defined workout',
    athleteLevel: 'intermediate',
    gripType: 'edge',
    modality: 'edge',
    supportMode: 'metadata_only',
    contractionDurationSec: 7,
    restDurationSec: 3,
    reps: 5,
    sets: 3,
    targetIntensityLogic: 'Manual target or latest benchmark percentage.',
    warmup: [
      { label: 'Ramp to 50%', durationSec: 15, targetPctOfReference: 0.5 },
      { label: 'Ramp to 70%', durationSec: 10, targetPctOfReference: 0.7 },
    ],
    cooldown: ['Easy extensor work'],
    stopConditions: [
      { kind: 'stability_break', valuePct: 18, note: 'Stop if the target band becomes unstable.' },
      { kind: 'manual_stop', note: 'Stop on pain or unsafe loading.' },
    ],
    metrics: ['peak_force', 'average_force', 'impulse', 'finger_distribution'],
    scoringModel: 'Completion, adherence, peak force and stability.',
    progressionRule: 'Progress conservatively after two clean sessions.',
    sourceBasis: 'Custom user-defined workout',
    recommendationTags: ['custom'],
    targetLogic: { mode: 'pct_latest_benchmark', benchmarkId: 'standard_max', percent: 0.7, handScoped: true },
    recoveryNotes: ['Review target adherence after the session.'],
    blocks: [defaultBlock()],
    createdAtIso,
    updatedAtIso: createdAtIso,
  };
}

function hydrateWorkout(raw: unknown): CustomTrainWorkout | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Partial<CustomTrainWorkout>;
  const fallback = createDefaultCustomTrainWorkout();
  return {
    ...fallback,
    ...source,
    id: typeof source.id === 'string' && source.id ? source.id : fallback.id,
    kind: 'custom',
    workoutKind: 'custom',
    name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : fallback.name,
    shortName: typeof source.shortName === 'string' && source.shortName.trim() ? source.shortName.trim() : fallback.shortName,
    blocks: Array.isArray(source.blocks) && source.blocks.length > 0
      ? source.blocks.map((block, index) => ({
          id: typeof block.id === 'string' && block.id ? block.id : `block_${index + 1}`,
          label: typeof block.label === 'string' && block.label.trim() ? block.label : `Block ${index + 1}`,
          phase: block.phase ?? 'main',
          setCount: typeof block.setCount === 'number' && block.setCount > 0 ? block.setCount : 1,
          repsPerSet: typeof block.repsPerSet === 'number' && block.repsPerSet > 0 ? block.repsPerSet : 1,
          hangSec: typeof block.hangSec === 'number' && block.hangSec > 0 ? block.hangSec : 5,
          restBetweenRepsSec: typeof block.restBetweenRepsSec === 'number' && block.restBetweenRepsSec >= 0 ? block.restBetweenRepsSec : 0,
          restBetweenSetsSec: typeof block.restBetweenSetsSec === 'number' && block.restBetweenSetsSec >= 0 ? block.restBetweenSetsSec : 0,
          cue: typeof block.cue === 'string' ? block.cue : '',
        }))
      : fallback.blocks,
    createdAtIso: typeof source.createdAtIso === 'string' ? source.createdAtIso : fallback.createdAtIso,
    updatedAtIso: typeof source.updatedAtIso === 'string' ? source.updatedAtIso : fallback.updatedAtIso,
  };
}

export function loadCustomTrainWorkouts(): CustomTrainWorkout[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(hydrateWorkout)
      .filter((item): item is CustomTrainWorkout => item !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

function saveCustomTrainWorkouts(workouts: CustomTrainWorkout[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
  } catch {
    // ignore storage failures
  }
}

export function upsertCustomTrainWorkout(workout: CustomTrainWorkout): CustomTrainWorkout[] {
  const all = loadCustomTrainWorkouts();
  const index = all.findIndex(item => item.id === workout.id);
  const next = {
    ...workout,
    name: workout.name.trim(),
    shortName: workout.shortName.trim() || workout.name.trim(),
    updatedAtIso: nowIso(),
  };
  if (index >= 0) {
    all[index] = {
      ...next,
      createdAtIso: all[index].createdAtIso,
    };
  } else {
    all.push(next);
  }
  saveCustomTrainWorkouts(all);
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export function deleteCustomTrainWorkout(workoutId: string): CustomTrainWorkout[] {
  const all = loadCustomTrainWorkouts().filter(item => item.id !== workoutId);
  saveCustomTrainWorkouts(all);
  return all;
}

export function duplicateCustomTrainWorkout(workout: CustomTrainWorkout): CustomTrainWorkout {
  const createdAtIso = nowIso();
  return {
    ...workout,
    id: makeId(),
    name: `${workout.name} Copy`,
    shortName: `${workout.shortName} Copy`,
    createdAtIso,
    updatedAtIso: createdAtIso,
  };
}
