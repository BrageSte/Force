import { useMemo, useState } from 'react';
import { FINGER_COLORS, FINGER_NAMES } from '../../constants/fingers.ts';
import type { CompletedTestResult } from './types.ts';

interface FingerDetailViewProps {
  result: CompletedTestResult;
  oppositeHandResult: CompletedTestResult | null;
}

function barHeight(value: number, max: number): number {
  if (max <= 1e-9) return 0;
  return (value / max) * 100;
}

function linePath(values: number[], width: number, height: number, max: number): string {
  if (values.length === 0) return '';
  return values
    .map((v, i) => {
      const x = values.length <= 1 ? 0 : (i / (values.length - 1)) * width;
      const y = height - (Math.max(0, v) / Math.max(1e-9, max)) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function FingerDetailView({ result, oppositeHandResult }: FingerDetailViewProps) {
  const [fingerIdx, setFingerIdx] = useState<number>(result.summary.strongestFinger);
  const attempts = result.attempts;

  const peakHistory = useMemo(
    () => attempts.map(a => a.core.peakPerFingerKg[fingerIdx]),
    [attempts, fingerIdx],
  );
  const shareHistory = useMemo(
    () => attempts.map(a => a.core.fingerShareAtPeakPct[fingerIdx]),
    [attempts, fingerIdx],
  );
  const driftHistory = useMemo(
    () => attempts.map(a => a.coaching.contributionDriftPct[fingerIdx]),
    [attempts, fingerIdx],
  );
  const slopeHistory = useMemo(
    () => attempts.map(a => a.coaching.fatigueSlopePerFingerKgS[fingerIdx]),
    [attempts, fingerIdx],
  );

  const bestAttemptIdx = result.summary.bestAttemptNo - 1;
  const bestSamples = attempts[bestAttemptIdx]?.samples ?? [];
  const traceKg = bestSamples.map(s => s.fingerKg[fingerIdx]);
  const traceShare = bestSamples.map(s => s.fingerPct[fingerIdx]);

  const oppPeak =
    oppositeHandResult
      ? Math.max(...oppositeHandResult.attempts.map(a => a.core.peakPerFingerKg[fingerIdx]))
      : null;
  const thisPeak = Math.max(...peakHistory, 0);
  const oppDeltaPct = oppPeak && oppPeak > 1e-9 ? ((thisPeak - oppPeak) / oppPeak) * 100 : null;

  const maxPeak = Math.max(...peakHistory, 1);
  const maxShare = Math.max(...shareHistory, 40);
  const maxTrace = Math.max(...traceKg, 5);
  const maxTraceShare = Math.max(...traceShare, 40);

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="text-sm font-semibold mb-2">Finger Detail</div>
        <div className="flex flex-wrap gap-2">
          {FINGER_NAMES.map((name, i) => (
            <button
              key={name}
              onClick={() => setFingerIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                i === fingerIdx
                  ? 'border-transparent text-white'
                  : 'border-border bg-surface-alt text-muted hover:text-text'
              }`}
              style={i === fingerIdx ? { backgroundColor: FINGER_COLORS[i] } : undefined}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-4">
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="text-xs text-muted uppercase tracking-wide mb-2">Peak Force History</div>
          <div className="flex items-end gap-2 h-40">
            {peakHistory.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[11px] tabular-nums">{v.toFixed(1)}</span>
                <div className="w-full bg-surface-alt rounded-t-md h-28 relative">
                  <div
                    className="absolute bottom-0 w-full rounded-t-md"
                    style={{
                      height: `${barHeight(v, maxPeak)}%`,
                      backgroundColor: FINGER_COLORS[fingerIdx],
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted">A{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="text-xs text-muted uppercase tracking-wide mb-2">Share At Peak History</div>
          <svg viewBox="0 0 500 160" className="w-full h-40 bg-bg rounded-lg border border-border">
            <polyline
              fill="none"
              stroke={FINGER_COLORS[fingerIdx]}
              strokeWidth="2.5"
              points={linePath(shareHistory, 500, 160, maxShare)}
            />
          </svg>
          <div className="text-xs text-muted mt-2">
            Shows how this finger&apos;s peak contribution changes attempt to attempt.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-4">
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="text-xs text-muted uppercase tracking-wide mb-2">Behavior In Best Attempt</div>
          <svg viewBox="0 0 500 170" className="w-full h-44 bg-bg rounded-lg border border-border">
            <polyline
              fill="none"
              stroke={FINGER_COLORS[fingerIdx]}
              strokeWidth="2"
              points={linePath(traceKg, 500, 170, maxTrace)}
            />
          </svg>
          <svg viewBox="0 0 500 130" className="w-full h-32 bg-bg rounded-lg border border-border mt-2">
            <polyline
              fill="none"
              stroke={FINGER_COLORS[fingerIdx]}
              strokeWidth="2"
              strokeDasharray="5 4"
              points={linePath(traceShare, 500, 130, maxTraceShare)}
            />
          </svg>
          <div className="text-xs text-muted mt-2">
            Solid line: force. Dashed line: contribution share.
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
          <div className="text-xs text-muted uppercase tracking-wide">Interpretation</div>
          <Metric label="Average Drift" value={`${(driftHistory.reduce((a, b) => a + b, 0) / Math.max(1, driftHistory.length)).toFixed(2)}%`} />
          <Metric label="Average Fatigue Slope" value={`${(slopeHistory.reduce((a, b) => a + b, 0) / Math.max(1, slopeHistory.length)).toFixed(2)} kg/s`} />
          <Metric
            label="Opposite-Hand Same Finger"
            value={oppPeak === null ? '--' : `${oppPeak.toFixed(1)} kg`}
            note={oppDeltaPct === null ? 'Run same protocol on opposite hand for comparison.' : `${oppDeltaPct >= 0 ? '+' : ''}${oppDeltaPct.toFixed(1)}% vs opposite`}
          />
          <div className="text-xs text-muted pt-1 border-t border-border">
            Use this view to spot whether this finger is improving, fading faster, or compensating for others.
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-surface-alt rounded-lg border border-border p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-base font-semibold tabular-nums mt-0.5">{value}</div>
      {note && <div className="text-xs text-muted mt-1">{note}</div>}
    </div>
  );
}
