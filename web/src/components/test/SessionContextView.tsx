import { bestPeakOfResult } from './testAnalysis.ts';
import type { CompletedTestResult } from './types.ts';

interface SessionContextViewProps {
  currentResult: CompletedTestResult;
  sessionResults: CompletedTestResult[];
}

function path(values: number[], width: number, height: number, max: number): string {
  if (values.length === 0) return '';
  return values
    .map((v, i) => {
      const x = values.length <= 1 ? 0 : (i / (values.length - 1)) * width;
      const y = height - (Math.max(0, v) / Math.max(1e-9, max)) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function SessionContextView({ currentResult, sessionResults }: SessionContextViewProps) {
  const ordered = [...sessionResults].sort((a, b) => a.completedAtIso.localeCompare(b.completedAtIso));
  const peaks = ordered.map(bestPeakOfResult);
  const maxPeak = Math.max(...peaks, 10);
  const testCount = ordered.length;
  const attemptCount = ordered.reduce((acc, r) => acc + r.attempts.length, 0);

  const fatigueFlags = ordered
    .slice(1)
    .map((r, i) => {
      const prev = bestPeakOfResult(ordered[i]);
      const curr = bestPeakOfResult(r);
      const dropPct = prev > 1e-9 ? ((curr - prev) / prev) * 100 : 0;
      return { id: r.resultId, dropPct, protocolName: r.protocolName };
    })
    .filter(f => f.dropPct < -5);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Tile label="Tests Today" value={String(testCount)} subtitle={currentResult.hand} />
        <Tile label="Attempts Today" value={String(attemptCount)} subtitle="Across all test types" />
        <Tile
          label="Fatigue Flags"
          value={String(fatigueFlags.length)}
          subtitle={fatigueFlags.length === 0 ? 'No major drop detected' : 'Drops > 5% between tests'}
        />
      </div>

      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="text-sm font-semibold mb-2">Trend Across Today&apos;s Tests</div>
        <svg viewBox="0 0 700 220" className="w-full h-[220px] bg-bg rounded-lg border border-border">
          <polyline
            fill="none"
            stroke="#60a5fa"
            strokeWidth="2.5"
            points={path(peaks, 700, 220, maxPeak * 1.1)}
          />
        </svg>
        <div className="mt-2 text-xs text-muted">
          Sequence is ordered by completion time. Use this to spot fatigue or potentiation across the day.
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-alt text-muted text-xs uppercase tracking-wide">
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">Test</th>
              <th className="px-3 py-2 text-right">Best Peak</th>
              <th className="px-3 py-2 text-right">Attempts</th>
              <th className="px-3 py-2 text-right">Repeatability</th>
              <th className="px-3 py-2 text-right">Session Trend</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map(r => (
              <tr key={r.resultId} className="border-t border-border">
                <td className="px-3 py-2 text-muted">
                  {new Date(r.completedAtIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-3 py-2">{r.protocolName}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{bestPeakOfResult(r).toFixed(1)} kg</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.attempts.length}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.summary.repeatabilityScore.toFixed(0)}</td>
                <td
                  className="px-3 py-2 text-right tabular-nums"
                  style={{ color: r.summary.sessionTrendPct >= -3 ? '#22c55e' : '#ef4444' }}
                >
                  {r.summary.sessionTrendPct >= 0 ? '+' : ''}
                  {r.summary.sessionTrendPct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {fatigueFlags.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
          <div className="text-sm font-semibold text-warning mb-1">Fatigue Signals</div>
          <div className="text-xs text-muted space-y-1">
            {fatigueFlags.map(f => (
              <div key={f.id}>
                {f.protocolName}: {f.dropPct.toFixed(1)}% vs previous test.
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="text-xs text-muted uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      <div className="text-xs text-muted mt-1">{subtitle}</div>
    </div>
  );
}
