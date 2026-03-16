import { useEffect, useState } from 'react';
import { loadTrainingSession } from '../train/trainStorage.ts';
import { TrainResultScreen } from '../train/TrainResultScreen.tsx';
import type { TrainSessionResult } from '../train/types.ts';

interface HistoryTrainDetailViewProps {
  trainSessionIds: string[];
  onBack: () => void;
}

export function HistoryTrainDetailView({ trainSessionIds, onBack }: HistoryTrainDetailViewProps) {
  const [results, setResults] = useState<TrainSessionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHand, setSelectedHand] = useState<'Left' | 'Right' | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const loaded: TrainSessionResult[] = [];
      for (const id of trainSessionIds) {
        const result = await loadTrainingSession(id);
        if (result) loaded.push(result);
      }
      if (!cancelled) {
        setResults(loaded);
        setSelectedHand(loaded[0]?.hand ?? null);
        setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [trainSessionIds]);

  if (loading) {
    return (
      <div className="bg-surface rounded-xl border border-border p-8 text-center text-sm text-muted">
        Loading session data...
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt border border-border text-muted hover:text-text"
        >
          Back to History
        </button>
        <div className="bg-surface rounded-xl border border-border p-8 text-center text-sm text-muted">
          Session data not found.
        </div>
      </div>
    );
  }

  const hasBothHands = results.length > 1;
  const currentResult = results.find(r => r.hand === selectedHand) ?? results[0];
  const isIncomplete = results.some(r => r.completed === false);

  return (
    <div className="space-y-4">
      {hasBothHands && (
        <div className="bg-surface rounded-xl border border-border p-4 flex flex-wrap items-center gap-3">
          <button
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt border border-border text-muted hover:text-text"
          >
            Back to History
          </button>
          <div className="w-px h-6 bg-border" />
          <div className="text-sm font-semibold">Hand</div>
          <div className="flex gap-2">
            {results.map(r => (
              <button
                key={r.hand}
                onClick={() => setSelectedHand(r.hand)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  selectedHand === r.hand
                    ? 'border-transparent bg-primary text-white'
                    : 'border-border bg-surface-alt text-muted hover:text-text'
                }`}
              >
                {r.hand}
              </button>
            ))}
          </div>
          {isIncomplete && (
            <span className="ml-auto px-2.5 py-1 rounded-full text-[11px] font-semibold bg-warning/10 text-warning border border-warning/30">
              Incomplete
            </span>
          )}
        </div>
      )}
      <TrainResultScreen
        key={currentResult.trainSessionId}
        result={currentResult}
        onBackToLibrary={onBack}
      />
    </div>
  );
}
