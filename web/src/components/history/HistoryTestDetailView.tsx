import { useMemo, useState } from 'react';
import { NavButton } from '../shared/NavButton.tsx';
import { ResultsScreen } from '../test/ResultsScreen.tsx';
import { AttemptComparisonView } from '../test/AttemptComparisonView.tsx';
import { FingerDetailView } from '../test/FingerDetailView.tsx';
import { SessionContextView } from '../test/SessionContextView.tsx';
import { BilateralSummaryView } from '../test/BilateralSummaryView.tsx';
import { loadTestResults, getSessionDateKey, listResultsForDate } from '../test/testStorage.ts';
import type { CompletedTestResult } from '../test/types.ts';

type DetailView = 'results' | 'compare' | 'finger' | 'session';
type HandView = 'left' | 'right' | 'both';

interface HistoryTestDetailViewProps {
  results: CompletedTestResult[];
  onBack: () => void;
}

export function HistoryTestDetailView({ results, onBack }: HistoryTestDetailViewProps) {
  const [view, setView] = useState<DetailView>('results');

  const leftResult = results.find(r => r.hand === 'Left') ?? null;
  const rightResult = results.find(r => r.hand === 'Right') ?? null;
  const hasBothHands = leftResult !== null && rightResult !== null;

  const defaultHandView: HandView = hasBothHands
    ? 'both'
    : leftResult ? 'left' : 'right';
  const [handView, setHandView] = useState<HandView>(defaultHandView);

  const selectedResult = useMemo(() => {
    if (handView === 'left') return leftResult;
    if (handView === 'right') return rightResult;
    return null;
  }, [handView, leftResult, rightResult]);

  const oppositeResult = useMemo(() => {
    if (!selectedResult) return null;
    return selectedResult.hand === 'Left' ? rightResult : leftResult;
  }, [leftResult, rightResult, selectedResult]);

  const allHistory = useMemo(() => loadTestResults(), []);

  const sessionResults = useMemo(() => {
    if (!selectedResult) return [];
    const dateKey = getSessionDateKey(selectedResult.completedAtIso);
    return listResultsForDate(allHistory, dateKey, selectedResult.hand);
  }, [allHistory, selectedResult]);

  const leftSessionResults = useMemo(() => {
    if (!leftResult) return [];
    return listResultsForDate(allHistory, getSessionDateKey(leftResult.completedAtIso), 'Left');
  }, [allHistory, leftResult]);

  const rightSessionResults = useMemo(() => {
    if (!rightResult) return [];
    return listResultsForDate(allHistory, getSessionDateKey(rightResult.completedAtIso), 'Right');
  }, [allHistory, rightResult]);

  const isIncomplete = results.some(r => r.completed === false);

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl border border-border p-2 flex flex-wrap gap-2">
        <button
          onClick={onBack}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt border border-border text-muted hover:text-text"
        >
          Back to History
        </button>
        <div className="w-px bg-border" />
        <NavButton active={view === 'results'} onClick={() => setView('results')} label="Summary" />
        <NavButton active={view === 'compare'} onClick={() => setView('compare')} label="Attempt Comparison" />
        <NavButton active={view === 'finger'} onClick={() => setView('finger')} label="Finger Detail" />
        <NavButton active={view === 'session'} onClick={() => setView('session')} label="Session Context" />
        {isIncomplete && (
          <span className="ml-auto px-2.5 py-1 rounded-full text-[11px] font-semibold bg-warning/10 text-warning border border-warning/30">
            Incomplete
          </span>
        )}
      </div>

      {hasBothHands && (
        <div className="bg-surface rounded-xl border border-border p-4 flex flex-wrap items-center gap-3">
          <div className="min-w-[180px]">
            <div className="text-sm font-semibold">Hand Analysis</div>
            <div className="text-xs text-muted mt-1">
              Switch between left, right, or both hands to compare force profiles.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['left', 'right', 'both'] as const).map(option => {
              const label = option === 'left' ? 'Left' : option === 'right' ? 'Right' : 'Both';
              return (
                <button
                  key={option}
                  onClick={() => setHandView(option)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    handView === option
                      ? 'border-transparent bg-primary text-white'
                      : 'border-border bg-surface-alt text-muted hover:text-text'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {view === 'results' && handView === 'both' && leftResult && rightResult && (
        <BilateralSummaryView leftResult={leftResult} rightResult={rightResult} />
      )}
      {view === 'results' && handView !== 'both' && selectedResult && (
        <ResultsScreen
          key={selectedResult.resultId}
          result={selectedResult}
          aiCoachingReport={null}
          onOpenComparison={() => setView('compare')}
          onOpenFinger={() => setView('finger')}
          onOpenSession={() => setView('session')}
          onBackToLibrary={onBack}
        />
      )}

      {view === 'compare' && handView === 'both' && leftResult && rightResult && (
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
          <HandPanel result={leftResult}>
            <AttemptComparisonView result={leftResult} />
          </HandPanel>
          <HandPanel result={rightResult}>
            <AttemptComparisonView result={rightResult} />
          </HandPanel>
        </div>
      )}
      {view === 'compare' && handView !== 'both' && selectedResult && (
        <AttemptComparisonView key={selectedResult.resultId} result={selectedResult} />
      )}

      {view === 'finger' && handView === 'both' && leftResult && rightResult && (
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
          <HandPanel result={leftResult}>
            <FingerDetailView result={leftResult} oppositeHandResult={rightResult} />
          </HandPanel>
          <HandPanel result={rightResult}>
            <FingerDetailView result={rightResult} oppositeHandResult={leftResult} />
          </HandPanel>
        </div>
      )}
      {view === 'finger' && handView !== 'both' && selectedResult && (
        <FingerDetailView
          key={selectedResult.resultId}
          result={selectedResult}
          oppositeHandResult={oppositeResult}
        />
      )}

      {view === 'session' && handView === 'both' && leftResult && rightResult && (
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
          <HandPanel result={leftResult}>
            <SessionContextView currentResult={leftResult} sessionResults={leftSessionResults} />
          </HandPanel>
          <HandPanel result={rightResult}>
            <SessionContextView currentResult={rightResult} sessionResults={rightSessionResults} />
          </HandPanel>
        </div>
      )}
      {view === 'session' && handView !== 'both' && selectedResult && (
        <SessionContextView
          key={selectedResult.resultId}
          currentResult={selectedResult}
          sessionResults={sessionResults}
        />
      )}
    </div>
  );
}

function HandPanel({ result, children }: { result: CompletedTestResult; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{result.hand} Hand</h3>
          <div className="text-xs text-muted">
            {new Date(result.completedAtIso).toLocaleString()}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}
