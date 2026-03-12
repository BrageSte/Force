import { useState } from 'react';
import { generateAiTrainWorkoutSuggestion } from './aiTrainBuilder.ts';
import type { AiTrainWorkoutSuggestion } from './aiTrainBuilder.ts';
import type { CustomTrainWorkout } from './types.ts';

interface AiTrainBuilderModalProps {
  open: boolean;
  onClose: () => void;
  onUseWorkout: (workout: CustomTrainWorkout) => void;
}

const EXAMPLE_PROMPTS = [
  'Lag en recruitment-økt for høy peak men svak RFD, 4 sett med korte drag på block.',
  'Jeg vil ha en 7:53 økt med 3 hangs per set og tydelig fokus på repeat strength.',
  'Gi meg en health/capacity økt for ustabil fingerfordeling og lav vevstoleranse.',
];

export function AiTrainBuilderModal({
  open,
  onClose,
  onUseWorkout,
}: AiTrainBuilderModalProps) {
  const [goal, setGoal] = useState('');
  const [suggestion, setSuggestion] = useState<AiTrainWorkoutSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleGenerate = () => {
    if (!goal.trim()) {
      setError('Describe the workout you want first.');
      setSuggestion(null);
      return;
    }
    setSuggestion(generateAiTrainWorkoutSuggestion(goal));
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-6xl max-h-[92vh] overflow-hidden bg-surface rounded-2xl border border-border shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">AI Workout Draft</h2>
            <p className="text-xs text-muted mt-1">Generate a draft workout and open it in the structured editor before saving.</p>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt border border-border text-muted hover:text-text">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 grid grid-cols-1 xl:grid-cols-[1fr_1.1fr] gap-5">
          <section className="space-y-4">
            <div className="rounded-xl border border-border bg-bg p-4">
              <div className="text-sm font-semibold mb-2">Describe the training session</div>
              <textarea
                value={goal}
                onChange={e => setGoal(e.target.value)}
                rows={8}
                placeholder="Example: Make me a repeated-strength session for high peak but big drop across later reps, on open-hand edge."
                className="bg-surface-alt border border-border rounded-lg px-3 py-3 text-sm text-text w-full resize-y"
              />
              {error && <div className="mt-2 text-xs text-danger">{error}</div>}
              <div className="mt-3 flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map(example => (
                  <button key={example} onClick={() => setGoal(example)} className="px-3 py-1.5 rounded-full text-xs bg-surface-alt border border-border text-text">
                    {example}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button onClick={handleGenerate} className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white">
                  Generate Draft
                </button>
                <span className="text-xs text-muted">The draft remains editable and is never saved automatically.</span>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            {!suggestion ? (
              <div className="rounded-xl border border-border bg-bg p-6 text-sm text-muted h-full flex items-center justify-center text-center">
                Generate a draft to preview the category, target logic and block structure before it opens in the custom builder.
              </div>
            ) : (
              <>
                <WorkoutSummary suggestion={suggestion} />
                <div className="rounded-xl border border-border bg-bg p-4">
                  <div className="text-sm font-semibold mb-2">Why this draft was chosen</div>
                  <ul className="space-y-2 text-sm text-text">
                    {suggestion.rationale.map(line => (
                      <li key={line} className="rounded-lg bg-surface-alt border border-border px-3 py-2">{line}</li>
                    ))}
                  </ul>
                </div>
                {suggestion.warnings.length > 0 && (
                  <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
                    <div className="text-sm font-semibold text-warning mb-2">Notes</div>
                    <ul className="space-y-2 text-sm text-warning">
                      {suggestion.warnings.map(line => <li key={line}>{line}</li>)}
                    </ul>
                  </div>
                )}
                <div className="flex items-center justify-end gap-3">
                  <button onClick={() => onUseWorkout(suggestion.workout)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white">
                    Open in Workout Builder
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

function WorkoutSummary({ suggestion }: { suggestion: AiTrainWorkoutSuggestion }) {
  const { workout, focus } = suggestion;
  const mainBlock = workout.blocks.find(block => block.phase === 'main') ?? workout.blocks[0];
  return (
    <div className="rounded-xl border border-border bg-bg p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">{workout.name}</div>
          <div className="text-xs text-muted mt-1">{workout.trainingGoal}</div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-primary/15 text-primary border border-primary/30">
          {workout.category.replaceAll('_', ' ')}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {focus.map(item => (
          <span key={item} className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-surface-alt border border-border text-text">
            {item}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Sets" value={`${mainBlock?.setCount ?? 0}`} />
        <StatCard label="Reps" value={`${mainBlock?.repsPerSet ?? 0}`} />
        <StatCard label="Work" value={`${mainBlock?.hangSec ?? 0}s`} />
        <StatCard label="Rest" value={`${mainBlock?.restBetweenRepsSec ?? 0}s`} />
        <StatCard label="Grip" value={workout.gripType.replaceAll('_', ' ')} />
        <StatCard label="Mode" value={workout.modality.replaceAll('_', ' ')} />
        <StatCard label="Target" value={workout.targetLogic.mode.replaceAll('_', ' ')} />
        <StatCard label="Warm-up" value={`${workout.warmup.length} steps`} />
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
