import { useMemo, useState } from 'react';
import type { AthleteLevel, BenchmarkCategory, GripType, WorkoutModality } from '@krimblokk/core';
import type { CustomTrainWorkout } from './types.ts';

const CATEGORY_OPTIONS: Array<{ value: BenchmarkCategory; label: string }> = [
  { value: 'max_strength', label: 'Max Strength' },
  { value: 'repeated_max_strength', label: 'Repeated Max Strength' },
  { value: 'recruitment_rfd', label: 'Recruitment / RFD' },
  { value: 'strength_endurance', label: 'Strength-Endurance' },
  { value: 'health_capacity', label: 'Health / Capacity' },
  { value: 'force_curve', label: 'Force Curve' },
];

const ATHLETE_LEVEL_OPTIONS: Array<{ value: AthleteLevel; label: string }> = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'elite', label: 'Elite' },
];

const GRIP_OPTIONS: Array<{ value: GripType; label: string }> = [
  { value: 'half_crimp', label: 'Half Crimp' },
  { value: 'open_hand', label: 'Open Hand' },
  { value: 'edge', label: 'Edge' },
  { value: 'ergonomic_block', label: 'Ergonomic Block' },
  { value: 'no_hang_pull', label: 'No-Hang Pull' },
];

const MODALITY_OPTIONS: Array<{ value: WorkoutModality; label: string }> = [
  { value: 'edge', label: 'Edge Hang' },
  { value: 'ergonomic_block', label: 'Ergonomic Block' },
  { value: 'no_hang_pull', label: 'No-Hang Pull' },
];

interface CustomTrainBuilderModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  workout: CustomTrainWorkout;
  onClose: () => void;
  onSave: (workout: CustomTrainWorkout) => void;
  onSaveAndStart: (workout: CustomTrainWorkout) => void;
  onDelete?: (workoutId: string) => void;
}

function parseLines(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

function validate(workout: CustomTrainWorkout): string[] {
  const errors: string[] = [];
  if (!workout.name.trim()) errors.push('Workout name is required.');
  if (workout.blocks.length === 0) errors.push('Add at least one workout block.');
  for (const block of workout.blocks) {
    if (!block.label.trim()) errors.push('Each block needs a label.');
    if (block.setCount <= 0) errors.push('Block set count must be greater than 0.');
    if (block.repsPerSet <= 0) errors.push('Block reps must be greater than 0.');
    if (block.hangSec <= 0) errors.push('Block work duration must be greater than 0.');
    if (block.restBetweenRepsSec < 0 || block.restBetweenSetsSec < 0) errors.push('Rest values cannot be negative.');
  }
  if (workout.targetLogic.mode === 'absolute_kg' && (!workout.targetLogic.absoluteKg || workout.targetLogic.absoluteKg <= 0)) {
    errors.push('Absolute kg target must be greater than 0.');
  }
  if (workout.targetLogic.mode === 'pct_latest_benchmark' && (!workout.targetLogic.percent || workout.targetLogic.percent <= 0 || workout.targetLogic.percent > 1.5)) {
    errors.push('Benchmark percent must be between 0.1 and 1.5.');
  }
  if (workout.targetLogic.mode === 'bodyweight_relative' && (!workout.targetLogic.bodyweightMultiplier || workout.targetLogic.bodyweightMultiplier <= 0 || workout.targetLogic.bodyweightMultiplier > 4)) {
    errors.push('Bodyweight multiplier must be between 0.1 and 4.0.');
  }
  return errors;
}

export function CustomTrainBuilderModal({
  open,
  mode,
  workout,
  onClose,
  onSave,
  onSaveAndStart,
  onDelete,
}: CustomTrainBuilderModalProps) {
  const [draft, setDraft] = useState<CustomTrainWorkout>(workout);
  const [warmupText, setWarmupText] = useState(draft.warmup.map(step => step.label).join('\n'));
  const [cooldownText, setCooldownText] = useState(draft.cooldown.join('\n'));
  const [recoveryText, setRecoveryText] = useState(draft.recoveryNotes.join('\n'));
  const [tagsText, setTagsText] = useState(draft.recommendationTags.join(', '));
  const errors = useMemo(() => validate(draft), [draft]);

  if (!open) return null;

  const canSubmit = errors.length === 0;

  const syncTextFields = (next: Partial<CustomTrainWorkout>) => {
    const updated = { ...draft, ...next };
    updated.warmup = parseLines(warmupText).map(label => ({ label }));
    updated.cooldown = parseLines(cooldownText);
    updated.recoveryNotes = parseLines(recoveryText);
    updated.recommendationTags = tagsText.split(',').map(item => item.trim()).filter(Boolean);
    setDraft(updated);
    return updated;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-6xl max-h-[92vh] overflow-hidden bg-surface rounded-2xl border border-border shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{mode === 'create' ? 'New Custom Workout' : 'Edit Custom Workout'}</h2>
            <p className="text-xs text-muted mt-1">Structured builder for training sessions. AI drafts should always pass through this editor before saving.</p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt border border-border text-muted hover:text-text"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
          <div className="space-y-5">
            <Section title="Workout Identity">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="Workout name">
                  <input value={draft.name} onChange={e => setDraft(current => ({ ...current, name: e.target.value, shortName: current.shortName || e.target.value }))} className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full" />
                </FormField>
                <FormField label="Short name">
                  <input value={draft.shortName} onChange={e => setDraft(current => ({ ...current, shortName: e.target.value }))} className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full" />
                </FormField>
              </div>
              <FormField label="Training goal">
                <textarea value={draft.trainingGoal} onChange={e => setDraft(current => ({ ...current, trainingGoal: e.target.value }))} rows={3} className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full resize-y" />
              </FormField>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <SelectField label="Category" value={draft.category} onChange={value => setDraft(current => ({ ...current, category: value as CustomTrainWorkout['category'] }))} options={CATEGORY_OPTIONS} />
                <SelectField label="Athlete level" value={draft.athleteLevel} onChange={value => setDraft(current => ({ ...current, athleteLevel: value as CustomTrainWorkout['athleteLevel'] }))} options={ATHLETE_LEVEL_OPTIONS} />
                <SelectField label="Grip type" value={draft.gripType} onChange={value => setDraft(current => ({ ...current, gripType: value as CustomTrainWorkout['gripType'] }))} options={GRIP_OPTIONS} />
                <SelectField label="Modality" value={draft.modality} onChange={value => setDraft(current => ({ ...current, modality: value as CustomTrainWorkout['modality'] }))} options={MODALITY_OPTIONS} />
              </div>
            </Section>

            <Section title="Target Logic">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SelectField
                  label="Target source"
                  value={draft.targetLogic.mode}
                  onChange={value => setDraft(current => ({
                    ...current,
                    targetLogic: {
                      ...current.targetLogic,
                      mode: value as CustomTrainWorkout['targetLogic']['mode'],
                    },
                  }))}
                  options={[
                    { value: 'pct_latest_benchmark', label: '% latest benchmark' },
                    { value: 'bodyweight_relative', label: 'Bodyweight relative' },
                    { value: 'absolute_kg', label: 'Absolute kg' },
                  ]}
                />
                <FormField label="Benchmark source id">
                  <input
                    value={draft.targetLogic.benchmarkId ?? ''}
                    onChange={e => setDraft(current => ({
                      ...current,
                      targetLogic: { ...current.targetLogic, benchmarkId: e.target.value || undefined },
                    }))}
                    className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                <NumberField
                  label="% of benchmark"
                  value={(draft.targetLogic.percent ?? 0.7) * 100}
                  step={1}
                  min={10}
                  max={150}
                  disabled={draft.targetLogic.mode !== 'pct_latest_benchmark'}
                  onChange={value => setDraft(current => ({
                    ...current,
                    targetLogic: { ...current.targetLogic, percent: value / 100 },
                  }))}
                />
                <NumberField
                  label="Bodyweight multiplier"
                  value={draft.targetLogic.bodyweightMultiplier ?? 0.6}
                  step={0.1}
                  min={0.1}
                  max={4}
                  disabled={draft.targetLogic.mode !== 'bodyweight_relative'}
                  onChange={value => setDraft(current => ({
                    ...current,
                    targetLogic: { ...current.targetLogic, bodyweightMultiplier: value },
                  }))}
                />
                <NumberField
                  label="Absolute kg"
                  value={draft.targetLogic.absoluteKg ?? 20}
                  step={0.5}
                  min={1}
                  disabled={draft.targetLogic.mode !== 'absolute_kg'}
                  onChange={value => setDraft(current => ({
                    ...current,
                    targetLogic: { ...current.targetLogic, absoluteKg: value },
                  }))}
                />
              </div>
              <FormField label="Target explanation">
                <textarea value={draft.targetIntensityLogic} onChange={e => setDraft(current => ({ ...current, targetIntensityLogic: e.target.value }))} rows={2} className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full resize-y" />
              </FormField>
            </Section>

            <Section title="Blocks">
              <div className="space-y-3">
                {draft.blocks.map((block, index) => (
                  <div key={block.id} className="rounded-xl border border-border bg-surface-alt p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">{block.label || `Block ${index + 1}`}</div>
                      <button
                        onClick={() => setDraft(current => ({ ...current, blocks: current.blocks.filter(item => item.id !== block.id) }))}
                        className="px-2 py-1 rounded text-xs font-medium bg-danger/15 text-danger border border-danger/30"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <FormField label="Label">
                        <input value={block.label} onChange={e => setDraft(current => ({ ...current, blocks: current.blocks.map(item => item.id === block.id ? { ...item, label: e.target.value } : item) }))} className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text w-full" />
                      </FormField>
                      <SelectField
                        label="Phase"
                        value={block.phase}
                        onChange={value => setDraft(current => ({ ...current, blocks: current.blocks.map(item => item.id === block.id ? { ...item, phase: value as typeof item.phase } : item) }))}
                        options={[
                          { value: 'warmup', label: 'Warm-up' },
                          { value: 'main', label: 'Main' },
                          { value: 'cooldown', label: 'Cooldown' },
                        ]}
                      />
                      <FormField label="Cue">
                        <input value={block.cue ?? ''} onChange={e => setDraft(current => ({ ...current, blocks: current.blocks.map(item => item.id === block.id ? { ...item, cue: e.target.value } : item) }))} className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text w-full" />
                      </FormField>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                      <NumberField label="Sets" value={block.setCount} min={1} onChange={value => setDraft(current => ({ ...current, blocks: current.blocks.map(item => item.id === block.id ? { ...item, setCount: value } : item) }))} />
                      <NumberField label="Reps" value={block.repsPerSet} min={1} onChange={value => setDraft(current => ({ ...current, blocks: current.blocks.map(item => item.id === block.id ? { ...item, repsPerSet: value } : item) }))} />
                      <NumberField label="Work sec" value={block.hangSec} min={1} onChange={value => setDraft(current => ({ ...current, blocks: current.blocks.map(item => item.id === block.id ? { ...item, hangSec: value } : item) }))} />
                      <NumberField label="Rest/rep" value={block.restBetweenRepsSec} min={0} onChange={value => setDraft(current => ({ ...current, blocks: current.blocks.map(item => item.id === block.id ? { ...item, restBetweenRepsSec: value } : item) }))} />
                      <NumberField label="Rest/set" value={block.restBetweenSetsSec} min={0} onChange={value => setDraft(current => ({ ...current, blocks: current.blocks.map(item => item.id === block.id ? { ...item, restBetweenSetsSec: value } : item) }))} />
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setDraft(current => ({
                  ...current,
                  blocks: [
                    ...current.blocks,
                    {
                      id: `block_${current.blocks.length + 1}`,
                      label: `Block ${current.blocks.length + 1}`,
                      phase: 'main',
                      setCount: 2,
                      repsPerSet: 4,
                      hangSec: 7,
                      restBetweenRepsSec: 3,
                      restBetweenSetsSec: 120,
                      cue: '',
                    },
                  ],
                }))}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-surface-alt border border-border text-text"
              >
                Add Block
              </button>
            </Section>
          </div>

          <div className="space-y-5">
            <Section title="Programming Notes">
              <FormField label="Warm-up lines (one per line)">
                <textarea value={warmupText} onChange={e => { setWarmupText(e.target.value); }} onBlur={() => syncTextFields({})} rows={4} className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full resize-y" />
              </FormField>
              <FormField label="Cooldown notes (one per line)">
                <textarea value={cooldownText} onChange={e => { setCooldownText(e.target.value); }} onBlur={() => syncTextFields({})} rows={4} className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full resize-y" />
              </FormField>
              <FormField label="Recovery notes (one per line)">
                <textarea value={recoveryText} onChange={e => { setRecoveryText(e.target.value); }} onBlur={() => syncTextFields({})} rows={4} className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full resize-y" />
              </FormField>
              <FormField label="Recommendation tags (comma separated)">
                <input value={tagsText} onChange={e => setTagsText(e.target.value)} onBlur={() => syncTextFields({})} className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full" />
              </FormField>
              <FormField label="Source basis">
                <textarea value={draft.sourceBasis} onChange={e => setDraft(current => ({ ...current, sourceBasis: e.target.value }))} rows={2} className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full resize-y" />
              </FormField>
              <FormField label="Progression rule">
                <textarea value={draft.progressionRule} onChange={e => setDraft(current => ({ ...current, progressionRule: e.target.value }))} rows={3} className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full resize-y" />
              </FormField>
            </Section>

            <Section title="Preview">
              <div className="space-y-2 text-sm">
                <PreviewRow label="Blocks" value={`${draft.blocks.length}`} />
                <PreviewRow label="Volume" value={`${draft.blocks.reduce((sum, block) => sum + block.setCount * block.repsPerSet, 0)} total reps`} />
                <PreviewRow label="Target" value={draft.targetLogic.mode.replaceAll('_', ' ')} />
                <PreviewRow label="Grip" value={`${draft.gripType.replaceAll('_', ' ')} · ${draft.modality.replaceAll('_', ' ')}`} />
              </div>
            </Section>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border bg-bg flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-danger">
            {errors.length > 0 && (
              <ul className="space-y-1">
                {errors.map(error => <li key={error}>- {error}</li>)}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {mode === 'edit' && onDelete && (
              <button onClick={() => onDelete(draft.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-danger/15 text-danger border border-danger/30">
                Delete
              </button>
            )}
            <button
              onClick={() => onSave(syncTextFields({}))}
              disabled={!canSubmit}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-surface-alt border border-border text-text disabled:opacity-40"
            >
              Save Workout
            </button>
            <button
              onClick={() => onSaveAndStart(syncTextFields({}))}
              disabled={!canSubmit}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white disabled:opacity-40"
            >
              Save & Start
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
      <div className="text-sm font-semibold">{title}</div>
      {children}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <FormField label={label}>
      <select value={value} onChange={e => onChange(e.target.value)} className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full">
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </FormField>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <FormField label={label}>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={e => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step ?? 1}
        disabled={disabled}
        className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full disabled:opacity-40"
      />
    </FormField>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-alt px-3 py-2">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}
