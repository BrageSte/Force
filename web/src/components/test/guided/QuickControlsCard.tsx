import type { Hand } from '../../../types/force.ts';
import type { TestRunnerPhase } from '../types.ts';

interface QuickControlsCardProps {
  phase: TestRunnerPhase;
  phaseHint: string;
  activeHand: Hand;
  onStart: () => void;
  onSkipRecovery: () => void;
}

export function QuickControlsCard({
  phase,
  phaseHint,
  activeHand,
  onStart,
  onSkipRecovery,
}: QuickControlsCardProps) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted">Quick Controls</div>
        <div className="text-sm text-muted mt-1">{phaseHint}</div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {(phase === 'ready' || phase === 'next_attempt') && (
          <button
            onClick={onStart}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white"
          >
            {phase === 'ready' ? `Start ${activeHand} Attempt` : `Start ${activeHand} Next Attempt`}
          </button>
        )}
        {phase === 'rest' && (
          <button
            onClick={onSkipRecovery}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-warning text-white"
          >
            Skip Recovery
          </button>
        )}
      </div>
    </div>
  );
}
