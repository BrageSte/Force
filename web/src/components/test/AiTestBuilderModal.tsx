import { useState } from 'react';
import { generateAiTemplateSuggestion } from './aiTestBuilder.ts';
import { resultWidgetLabel, testFamilyLabel } from './testConfig.ts';
import type { AiTemplateSuggestion } from './aiTestBuilder.ts';
import type { CustomTestTemplate } from './types.ts';

interface AiTestBuilderModalProps {
  open: boolean;
  onClose: () => void;
  onUseTemplate: (template: CustomTestTemplate) => void;
}

const EXAMPLE_PROMPTS = [
  'Jeg vil teste utholdenhet på 70% av max med 4 sett og fokus på stabilitet.',
  'Lag en eksplosiv test for startstyrke og raske drag uten target.',
  'Jeg vil ha en repeater med 7/3 sekunder, 6 cycles og annenhver hånd.',
];

export function AiTestBuilderModal({
  open,
  onClose,
  onUseTemplate,
}: AiTestBuilderModalProps) {
  const [goal, setGoal] = useState('');
  const [suggestion, setSuggestion] = useState<AiTemplateSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleGenerate = () => {
    if (!goal.trim()) {
      setError('Describe what you want to measure or improve first.');
      setSuggestion(null);
      return;
    }
    setSuggestion(generateAiTemplateSuggestion(goal));
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-6xl max-h-[92vh] overflow-hidden bg-surface rounded-2xl border border-border shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">AI Test Builder</h2>
            <p className="text-xs text-muted mt-1">
              Describe the outcome you want and generate an editable custom template draft.
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt border border-border text-muted hover:text-text"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 grid grid-cols-1 xl:grid-cols-[1fr_1.1fr] gap-5">
          <section className="space-y-4">
            <div className="rounded-xl border border-border bg-bg p-4">
              <div className="text-sm font-semibold mb-2">Describe the test goal</div>
              <textarea
                value={goal}
                onChange={e => setGoal(e.target.value)}
                rows={8}
                placeholder="Example: I want a controlled duration test around 75% of max to compare left and right hand fatigue."
                className="bg-surface-alt border border-border rounded-lg px-3 py-3 text-sm text-text w-full resize-y"
              />
              {error && <div className="mt-2 text-xs text-danger">{error}</div>}
              <div className="mt-3 flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map(example => (
                  <button
                    key={example}
                    onClick={() => setGoal(example)}
                    className="px-3 py-1.5 rounded-full text-xs bg-surface-alt border border-border text-text"
                  >
                    {example}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleGenerate}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white"
                >
                  Generate Template
                </button>
                <span className="text-xs text-muted">
                  The generated draft can be edited before you save or run it.
                </span>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            {!suggestion ? (
              <div className="rounded-xl border border-border bg-bg p-6 text-sm text-muted h-full flex items-center justify-center text-center">
                Generate a draft to see the proposed test structure, timing, panels and result dashboard.
              </div>
            ) : (
              <>
                <TemplateSummary suggestion={suggestion} />

                <div className="rounded-xl border border-border bg-bg p-4">
                  <div className="text-sm font-semibold mb-2">Why this was chosen</div>
                  <ul className="space-y-2 text-sm text-text">
                    {suggestion.rationale.map(line => (
                      <li key={line} className="rounded-lg bg-surface-alt border border-border px-3 py-2">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>

                {suggestion.warnings.length > 0 && (
                  <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
                    <div className="text-sm font-semibold text-warning mb-2">Notes</div>
                    <ul className="space-y-2 text-sm text-warning">
                      {suggestion.warnings.map(line => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => onUseTemplate(suggestion.template)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white"
                  >
                    Open in Custom Builder
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function TemplateSummary({ suggestion }: { suggestion: AiTemplateSuggestion }) {
  const { template, focus } = suggestion;
  const intervalLabel = template.interval?.enabled
    ? `${template.interval.workSec}s / ${template.interval.restSec}s x ${template.interval.cycles}`
    : 'Continuous';
  const targetLabel = template.target.mode === 'fixed_kg'
    ? `${template.target.fixedKg} kg`
    : template.target.mode === 'percent_of_known_max'
      ? `${template.target.percentOfKnownMax}% of known max`
      : 'No target';

  return (
    <div className="rounded-xl border border-border bg-bg p-4 space-y-4">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">{template.name}</div>
            <div className="text-xs text-muted mt-1">{template.purpose}</div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-primary/15 text-primary border border-primary/30">
            {testFamilyLabel(template.family)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {focus.map(item => (
          <span
            key={item}
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-surface-alt border border-border text-text"
          >
            {item}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Work" value={`${template.workSec}s`} />
        <StatCard label="Sets" value={`${template.attemptCount}`} />
        <StatCard label="Rest" value={`${template.restSec}s`} />
        <StatCard label="Countdown" value={`${template.countdownSec}s`} />
        <StatCard label="Intervals" value={intervalLabel} />
        <StatCard label="Target" value={targetLabel} />
        <StatCard label="Hand mode" value={template.handMode === 'alternate_hands' ? 'Alternate' : 'Current'} />
        <StatCard label="Compare" value={template.compareDefaults?.metricId ?? 'best_peak_total_kg'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-surface-alt p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Live Panels</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {template.livePanels.map(panelId => (
              <span key={panelId} className="px-2 py-1 rounded-full text-[11px] bg-bg border border-border">
                {panelId}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface-alt p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Result Widgets</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {template.resultWidgets.map(widgetId => (
              <span key={widgetId} className="px-2 py-1 rounded-full text-[11px] bg-bg border border-border">
                {resultWidgetLabel(widgetId)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-alt p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="text-sm font-semibold mt-1">{value}</div>
    </div>
  );
}
