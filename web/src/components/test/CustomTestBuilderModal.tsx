import { useMemo, useState } from 'react';
import { COMPARE_METRICS } from './compareMetrics.ts';
import {
  ATHLETE_LEVEL_OPTIONS,
  BENCHMARK_CATEGORY_OPTIONS,
  GRIP_TYPE_OPTIONS,
  HAND_MODE_OPTIONS,
  LIVE_PANEL_CATALOG,
  MODALITY_OPTIONS,
  RESULT_WIDGET_CATALOG,
  TARGET_MODE_OPTIONS,
  TEST_FAMILY_OPTIONS,
} from './testConfig.ts';
import type { CompareMetricId, CustomTestTemplate } from './types.ts';

interface CustomTestBuilderModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  template: CustomTestTemplate;
  onClose: () => void;
  onSave: (template: CustomTestTemplate) => void;
  onSaveAndStart: (template: CustomTestTemplate) => void;
  onDelete?: (templateId: string) => void;
}

function validate(template: CustomTestTemplate): string[] {
  const errors: string[] = [];
  if (!template.name.trim()) errors.push('Template name is required.');
  if (template.workSec <= 0) errors.push('Work duration must be greater than 0.');
  if (template.attemptCount <= 0) errors.push('Number of sets must be greater than 0.');
  if (template.countdownSec <= 0) errors.push('Countdown must be greater than 0.');
  if (template.restSec < 0) errors.push('Rest between sets cannot be negative.');
  if (template.livePanels.length === 0) errors.push('Select at least one live panel.');
  if (template.resultWidgets.length === 0) errors.push('Select at least one result widget.');

  if (template.target.mode === 'fixed_kg' && (!template.target.fixedKg || template.target.fixedKg <= 0)) {
    errors.push('Fixed kg target must be greater than 0.');
  }
  if (
    template.target.mode === 'percent_of_known_max' &&
    (!template.target.percentOfKnownMax || template.target.percentOfKnownMax <= 0 || template.target.percentOfKnownMax > 200)
  ) {
    errors.push('Percent of known max must be between 1 and 200.');
  }
  if (
    template.target.mode === 'bodyweight_relative' &&
    (!template.target.bodyweightMultiplier || template.target.bodyweightMultiplier <= 0 || template.target.bodyweightMultiplier > 4)
  ) {
    errors.push('Bodyweight multiplier must be between 0.1 and 4.0.');
  }

  if (template.interval?.enabled) {
    if (template.interval.workSec <= 0) errors.push('Interval work duration must be greater than 0.');
    if (template.interval.restSec < 0) errors.push('Interval rest cannot be negative.');
    if (template.interval.cycles <= 0) errors.push('Interval cycles must be greater than 0.');
  }

  return errors;
}

export function CustomTestBuilderModal({
  open,
  mode,
  template,
  onClose,
  onSave,
  onSaveAndStart,
  onDelete,
}: CustomTestBuilderModalProps) {
  const [draft, setDraft] = useState<CustomTestTemplate>(template);

  const errors = useMemo(() => validate(draft), [draft]);
  if (!open) return null;

  const setLivePanelChecked = (panelId: CustomTestTemplate['livePanels'][number], checked: boolean) => {
    setDraft(current => ({
      ...current,
      livePanels: checked
        ? [...current.livePanels, panelId]
        : current.livePanels.filter(id => id !== panelId),
    }));
  };

  const setResultWidgetChecked = (widgetId: CustomTestTemplate['resultWidgets'][number], checked: boolean) => {
    setDraft(current => ({
      ...current,
      resultWidgets: checked
        ? [...current.resultWidgets, widgetId]
        : current.resultWidgets.filter(id => id !== widgetId),
    }));
  };

  const canSubmit = errors.length === 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden bg-surface rounded-2xl border border-border shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{mode === 'create' ? 'New Custom Test' : 'Edit Custom Test'}</h2>
            <p className="text-xs text-muted mt-1">Save the template before running. Dashboard defaults are stored on the template.</p>
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
            <Section title="Template">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="Template name">
                  <input
                    value={draft.name}
                    onChange={e => setDraft(current => ({ ...current, name: e.target.value }))}
                    className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
                  />
                </FormField>
                <FormField label="Test family">
                  <select
                    value={draft.family}
                    onChange={e => setDraft(current => ({ ...current, family: e.target.value as CustomTestTemplate['family'] }))}
                    className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
                  >
                    {TEST_FAMILY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </FormField>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <FormField label="Benchmark category">
                  <select
                    value={draft.category}
                    onChange={e => setDraft(current => ({ ...current, category: e.target.value as CustomTestTemplate['category'] }))}
                    className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
                  >
                    {BENCHMARK_CATEGORY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Athlete level">
                  <select
                    value={draft.athleteLevel}
                    onChange={e => setDraft(current => ({ ...current, athleteLevel: e.target.value as CustomTestTemplate['athleteLevel'] }))}
                    className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
                  >
                    {ATHLETE_LEVEL_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Grip type">
                  <select
                    value={draft.gripType}
                    onChange={e => setDraft(current => ({ ...current, gripType: e.target.value as CustomTestTemplate['gripType'] }))}
                    className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
                  >
                    {GRIP_TYPE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Modality">
                  <select
                    value={draft.modality}
                    onChange={e => setDraft(current => ({ ...current, modality: e.target.value as CustomTestTemplate['modality'] }))}
                    className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
                  >
                    {MODALITY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </FormField>
              </div>
              <FormField label="Purpose / notes">
                <textarea
                  value={draft.purpose}
                  onChange={e => setDraft(current => ({ ...current, purpose: e.target.value }))}
                  rows={3}
                  className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full resize-y"
                />
              </FormField>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-surface-alt px-3 py-3 text-sm text-text">
                <input
                  type="checkbox"
                  checked={draft.capabilityRequirements.requiresPerFingerForce}
                  onChange={e => setDraft(current => ({
                    ...current,
                    capabilityRequirements: {
                      ...current.capabilityRequirements,
                      requiresPerFingerForce: e.target.checked,
                    },
                  }))}
                  className="accent-blue-500"
                />
                <span>Requires per-finger force data</span>
              </label>
            </Section>

            <Section title="Timing">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <NumberField label="Work (sec)" value={draft.workSec} onChange={value => setDraft(current => ({ ...current, workSec: value }))} min={1} />
                <NumberField label="Sets" value={draft.attemptCount} onChange={value => setDraft(current => ({ ...current, attemptCount: value }))} min={1} />
                <NumberField label="Countdown" value={draft.countdownSec} onChange={value => setDraft(current => ({ ...current, countdownSec: value }))} min={1} />
                <NumberField label="Rest between sets" value={draft.restSec} onChange={value => setDraft(current => ({ ...current, restSec: value }))} min={0} />
              </div>

              <FormField label="Hand behavior">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {HAND_MODE_OPTIONS.map(option => (
                    <label key={option.value} className="flex items-center gap-2 rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm">
                      <input
                        type="radio"
                        checked={draft.handMode === option.value}
                        onChange={() => setDraft(current => ({ ...current, handMode: option.value }))}
                        className="accent-blue-500"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </FormField>
            </Section>

            <Section title="Target">
              <FormField label="Target mode">
                <select
                  value={draft.target.mode}
                  onChange={e => {
                    const mode = e.target.value as CustomTestTemplate['target']['mode'];
                    setDraft(current => ({
                      ...current,
                      target: {
                        mode,
                        fixedKg: mode === 'fixed_kg' ? current.target.fixedKg ?? 20 : null,
                        percentOfKnownMax: mode === 'percent_of_known_max' ? current.target.percentOfKnownMax ?? 70 : null,
                        bodyweightMultiplier: mode === 'bodyweight_relative' ? current.target.bodyweightMultiplier ?? 0.7 : null,
                      },
                    }));
                  }}
                  className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
                >
                  {TARGET_MODE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </FormField>
              {draft.target.mode === 'fixed_kg' && (
                <NumberField
                  label="Fixed target (kg)"
                  value={draft.target.fixedKg ?? 20}
                  onChange={value => setDraft(current => ({ ...current, target: { ...current.target, fixedKg: value } }))}
                  min={1}
                />
              )}
              {draft.target.mode === 'percent_of_known_max' && (
                <NumberField
                  label="% of known max"
                  value={draft.target.percentOfKnownMax ?? 70}
                  onChange={value => setDraft(current => ({ ...current, target: { ...current.target, percentOfKnownMax: value } }))}
                  min={1}
                  max={200}
                />
              )}
              {draft.target.mode === 'bodyweight_relative' && (
                <NumberField
                  label="Bodyweight multiplier"
                  value={draft.target.bodyweightMultiplier ?? 0.7}
                  onChange={value => setDraft(current => ({ ...current, target: { ...current.target, bodyweightMultiplier: value } }))}
                  min={0.1}
                  max={4}
                  step={0.1}
                />
              )}
            </Section>

            <Section title="Intervals Inside a Set">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(draft.interval?.enabled)}
                  onChange={e => setDraft(current => ({
                    ...current,
                    interval: e.target.checked
                      ? current.interval ?? { enabled: true, workSec: current.workSec, restSec: 3, cycles: 4 }
                      : { enabled: false, workSec: current.workSec, restSec: 3, cycles: 4 },
                  }))}
                  className="accent-blue-500"
                />
                <span>Enable work/rest intervals within each set</span>
              </label>
              {draft.interval?.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <NumberField
                    label="Interval work (sec)"
                    value={draft.interval.workSec}
                    onChange={value => setDraft(current => ({
                      ...current,
                      interval: current.interval ? { ...current.interval, workSec: value, enabled: true } : { enabled: true, workSec: value, restSec: 3, cycles: 4 },
                    }))}
                    min={1}
                  />
                  <NumberField
                    label="Interval rest (sec)"
                    value={draft.interval.restSec}
                    onChange={value => setDraft(current => ({
                      ...current,
                      interval: current.interval ? { ...current.interval, restSec: value, enabled: true } : { enabled: true, workSec: current.workSec, restSec: value, cycles: 4 },
                    }))}
                    min={0}
                  />
                  <NumberField
                    label="Cycles"
                    value={draft.interval.cycles}
                    onChange={value => setDraft(current => ({
                      ...current,
                      interval: current.interval ? { ...current.interval, cycles: value, enabled: true } : { enabled: true, workSec: current.workSec, restSec: 3, cycles: value },
                    }))}
                    min={1}
                  />
                </div>
              )}
            </Section>
          </div>

          <div className="space-y-5">
            <Section title="Live Panels">
              <div className="space-y-2">
                {LIVE_PANEL_CATALOG.map(panel => (
                  <label key={panel.id} className="flex items-start gap-3 rounded-lg border border-border bg-surface-alt px-3 py-2">
                    <input
                      type="checkbox"
                      checked={draft.livePanels.includes(panel.id)}
                      onChange={e => setLivePanelChecked(panel.id, e.target.checked)}
                      className="accent-blue-500 mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium">{panel.label}</div>
                      <div className="text-xs text-muted">{panel.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </Section>

            <Section title="Result Widgets">
              <div className="space-y-2">
                {RESULT_WIDGET_CATALOG.map(widget => (
                  <label key={widget.id} className="flex items-start gap-3 rounded-lg border border-border bg-surface-alt px-3 py-2">
                    <input
                      type="checkbox"
                      checked={draft.resultWidgets.includes(widget.id)}
                      onChange={e => setResultWidgetChecked(widget.id, e.target.checked)}
                      className="accent-blue-500 mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium">{widget.label}</div>
                      <div className="text-xs text-muted">{widget.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </Section>

            <Section title="Compare Defaults">
              <FormField label="Default metric">
                <select
                  value={draft.compareDefaults?.metricId ?? 'best_peak_total_kg'}
                  onChange={e => setDraft(current => ({
                    ...current,
                    compareDefaults: {
                      ...current.compareDefaults,
                      metricId: e.target.value as CompareMetricId,
                    },
                  }))}
                  className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
                >
                  {COMPARE_METRICS.map(metric => (
                    <option key={metric.id} value={metric.id}>{metric.label}</option>
                  ))}
                </select>
              </FormField>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(draft.compareDefaults?.autoNormalize)}
                  onChange={e => setDraft(current => ({
                    ...current,
                    compareDefaults: {
                      ...current.compareDefaults,
                      autoNormalize: e.target.checked,
                    },
                  }))}
                  className="accent-blue-500"
                />
                <span>Auto normalize by default in Compare</span>
              </label>
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
              <button
                onClick={() => onDelete(draft.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-danger/15 text-danger border border-danger/30"
              >
                Delete
              </button>
            )}
            <button
              onClick={() => onSave(draft)}
              disabled={!canSubmit}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-surface-alt border border-border text-text disabled:opacity-40"
            >
              Save Template
            </button>
            <button
              onClick={() => onSaveAndStart(draft)}
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

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max?: number;
  step?: number;
}) {
  return (
    <FormField label={label}>
      <input
        type="number"
        min={min}
        max={max}
        step={step ?? 1}
        value={Number.isFinite(value) ? value : 0}
        onChange={e => onChange(Number(e.target.value))}
        className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
      />
    </FormField>
  );
}
