import { createDefaultCustomTrainWorkout } from './customTrainStorage.ts';
import type { CustomTrainWorkout } from './types.ts';

export interface AiTrainWorkoutSuggestion {
  workout: CustomTrainWorkout;
  focus: string[];
  rationale: string[];
  warnings: string[];
}

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some(keyword => text.includes(keyword));
}

function parseNumber(raw: string): number {
  return Number(raw.replace(',', '.'));
}

function parseFirst(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match) return null;
  return parseNumber(match[1]);
}

function detectCategory(text: string): CustomTrainWorkout['category'] {
  if (hasAny(text, ['rfd', 'recruitment', 'explosive'])) return 'recruitment_rfd';
  if (hasAny(text, ['repeat', '7/53', '7:53', 'repeated'])) return 'repeated_max_strength';
  if (hasAny(text, ['endurance', 'repeater', '7/3', 'capacity'])) return 'strength_endurance';
  if (hasAny(text, ['health', 'rehab', 'tolerance', 'stability'])) return 'health_capacity';
  if (hasAny(text, ['curve', 'profile', 'finger specific', 'compensation'])) return 'force_curve';
  return 'max_strength';
}

function detectGrip(text: string): Pick<CustomTrainWorkout, 'gripType' | 'modality'> {
  if (hasAny(text, ['no hang', 'pull'])) return { gripType: 'no_hang_pull', modality: 'no_hang_pull' };
  if (hasAny(text, ['block', 'ergonomic'])) return { gripType: 'ergonomic_block', modality: 'ergonomic_block' };
  if (hasAny(text, ['open hand', 'open'])) return { gripType: 'open_hand', modality: 'edge' };
  if (hasAny(text, ['half crimp', 'crimp'])) return { gripType: 'half_crimp', modality: 'edge' };
  return { gripType: 'edge', modality: 'edge' };
}

export function generateAiTrainWorkoutSuggestion(input: string): AiTrainWorkoutSuggestion {
  const prompt = input.trim();
  const text = prompt.toLowerCase();
  const category = detectCategory(text);
  const grip = detectGrip(text);
  const workSec = parseFirst(text, /(\d+(?:[.,]\d+)?)\s*s(?:ec)?\s*(?:hang|work|on|pull)?/) ?? (category === 'recruitment_rfd' ? 3 : category === 'health_capacity' ? 20 : 7);
  const restSec = parseFirst(text, /(?:rest|hvile|pause|off)\s*(\d+(?:[.,]\d+)?)/) ?? (category === 'repeated_max_strength' ? 53 : category === 'recruitment_rfd' ? 20 : 3);
  const sets = parseFirst(text, /(\d+)\s*(?:sets|sett)/) ?? (category === 'recruitment_rfd' ? 4 : 3);
  const reps = parseFirst(text, /(\d+)\s*(?:reps|repetitions|hangs)/) ?? (category === 'strength_endurance' ? 6 : 4);
  const percent = parseFirst(text, /(\d+(?:[.,]\d+)?)\s*%/) ?? (category === 'max_strength' ? 85 : category === 'repeated_max_strength' ? 80 : category === 'health_capacity' ? 45 : 70);

  const base = createDefaultCustomTrainWorkout();
  const workout: CustomTrainWorkout = {
    ...base,
    name: `AI ${category.replaceAll('_', ' ')}`,
    shortName: `AI ${category.split('_')[0]}`,
    category,
    gripType: grip.gripType,
    modality: grip.modality,
    trainingGoal: prompt,
    targetIntensityLogic: `${percent}% of the latest benchmark unless manually overridden.`,
    sourceBasis: 'AI draft from free-text workout description',
    recommendationTags: ['ai_draft', category],
    targetLogic: {
      mode: 'pct_latest_benchmark',
      benchmarkId: 'standard_max',
      percent: percent / 100,
      handScoped: true,
    },
    blocks: [
      {
        id: 'warmup_block',
        label: 'Warm-up Block',
        phase: 'warmup',
        setCount: 1,
        repsPerSet: 3,
        hangSec: Math.max(3, Math.round(workSec * 0.6)),
        restBetweenRepsSec: Math.max(10, Math.round(restSec * 0.5)),
        restBetweenSetsSec: 0,
        cue: 'Ramp smoothly',
      },
      {
        id: 'main_block',
        label: 'Main Block',
        phase: 'main',
        setCount: sets,
        repsPerSet: reps,
        hangSec: workSec,
        restBetweenRepsSec: restSec,
        restBetweenSetsSec: category === 'recruitment_rfd' ? 150 : category === 'repeated_max_strength' ? 180 : 120,
        cue: category === 'recruitment_rfd' ? 'Attack the target quickly' : 'Stay inside the target band',
      },
    ],
  };

  const focus = [
    category === 'recruitment_rfd'
      ? 'Rapid force development'
      : category === 'repeated_max_strength'
        ? 'Repeated max output'
        : category === 'health_capacity'
          ? 'Stability and tolerance'
          : category === 'force_curve'
            ? 'Per-finger strategy'
            : 'Force production',
    `${grip.gripType.replaceAll('_', ' ')} context`,
    'Editable before save',
  ];

  const rationale = [
    `Workout category mapped to ${category.replaceAll('_', ' ')} from the prompt.`,
    `Main work block uses ${workSec}s work with ${restSec}s rest for ${sets} set(s) and ${reps} rep(s).`,
    `Target defaults to ${percent}% of the latest benchmark so the draft can still auto-scale by profile and hand.`,
  ];

  const warnings: string[] = [];
  if (!prompt.match(/\d/)) {
    warnings.push('No explicit timing numbers were found in the prompt, so default values were used.');
  }
  warnings.push('This draft is not saved automatically. Review it in the custom workout editor first.');

  return {
    workout,
    focus,
    rationale,
    warnings,
  };
}
