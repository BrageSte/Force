import { TOTAL_COLOR } from '../../constants/fingers.ts';
import type { CompletedTestResult } from './types.ts';

interface AttemptComparisonViewProps {
  result: CompletedTestResult;
}

function interpSample(samples: { tMs: number; totalKg: number }[], targetTMs: number): number {
  if (samples.length === 0) return 0;
  if (targetTMs <= samples[0].tMs) return samples[0].totalKg;
  const last = samples[samples.length - 1];
  if (targetTMs >= last.tMs) return last.totalKg;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (targetTMs <= b.tMs) {
      const f = (targetTMs - a.tMs) / Math.max(1e-9, b.tMs - a.tMs);
      return a.totalKg + (b.totalKg - a.totalKg) * f;
    }
  }
  return last.totalKg;
}

function resampleAttempt(samples: { tMs: number; totalKg: number }[], points = 120): number[] {
  if (samples.length === 0) return Array(points).fill(0);
  const endT = samples[samples.length - 1].tMs;
  if (endT <= 0) return Array(points).fill(samples[samples.length - 1].totalKg);
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const t = (i / (points - 1)) * endT;
    out.push(interpSample(samples, t));
  }
  return out;
}

function path(values: number[], width: number, height: number, maxY: number): string {
  if (values.length === 0) return '';
  return values
    .map((v, i) => {
      const x = values.length <= 1 ? 0 : (i / (values.length - 1)) * width;
      const y = height - (Math.max(0, v) / Math.max(1e-9, maxY)) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

const OVERLAY_COLORS = ['#60a5fa', '#22c55e', '#f59e0b', '#ef4444', '#8892a8', '#38bdf8'];

export function AttemptComparisonView({ result }: AttemptComparisonViewProps) {
  const attempts = result.attempts;
  const bestIdx = result.summary.bestAttemptNo - 1;
  const worstIdx = attempts.reduce((idx, a, i) => (a.core.peakTotalKg < attempts[idx].core.peakTotalKg ? i : idx), 0);
  const peakValues = attempts.map(a => a.core.peakTotalKg);
  const spread = peakValues.length > 0 ? Math.max(...peakValues) - Math.min(...peakValues) : 0;
  const overlaySeries = attempts.map(a => resampleAttempt(a.samples, 150));
  const maxY = Math.max(5, ...overlaySeries.flat());

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Tile label="Best Attempt" value={`#${result.summary.bestAttemptNo}`} subtitle={`${attempts[bestIdx]?.core.peakTotalKg.toFixed(1) ?? '0.0'} kg`} />
        <Tile label="Worst Attempt" value={`#${worstIdx + 1}`} subtitle={`${attempts[worstIdx]?.core.peakTotalKg.toFixed(1) ?? '0.0'} kg`} />
        <Tile label="Peak Spread" value={`${spread.toFixed(2)} kg`} subtitle={`Repeatability ${result.summary.repeatabilityScore.toFixed(0)}/100`} />
      </div>

      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="text-sm font-semibold mb-2">Attempt Overlay (normalized time)</div>
        <svg viewBox="0 0 760 260" className="w-full h-[260px] bg-bg rounded-lg border border-border">
          {overlaySeries.map((series, i) => (
            <polyline
              key={i}
              fill="none"
              stroke={i === bestIdx ? TOTAL_COLOR : OVERLAY_COLORS[i % OVERLAY_COLORS.length]}
              strokeWidth={i === bestIdx ? '2.8' : '1.6'}
              strokeOpacity={i === bestIdx ? '1' : '0.7'}
              points={path(series, 760, 260, maxY)}
            />
          ))}
        </svg>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {attempts.map((a, i) => (
            <span
              key={a.attemptNo}
              className="px-2 py-1 rounded-full bg-surface-alt border border-border"
              style={{ color: i === bestIdx ? TOTAL_COLOR : OVERLAY_COLORS[i % OVERLAY_COLORS.length] }}
            >
              Attempt {a.attemptNo}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-alt text-muted text-xs uppercase tracking-wide">
              <th className="px-3 py-2 text-left">Attempt</th>
              <th className="px-3 py-2 text-right">Peak</th>
              <th className="px-3 py-2 text-right">Best 3s</th>
              <th className="px-3 py-2 text-right">Full Mean</th>
              <th className="px-3 py-2 text-right">Early-Late</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2 text-right">Delta vs Best</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((a) => {
              const delta = a.core.peakTotalKg - attempts[bestIdx].core.peakTotalKg;
              return (
                <tr key={a.attemptNo} className="border-t border-border">
                  <td className="px-3 py-2">{a.attemptNo}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{a.core.peakTotalKg.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.core.best3sMeanKg.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.core.fullTestMeanKg.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.core.earlyLateDropPct.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.coaching.balanceScore.toFixed(0)}</td>
                  <td
                    className="px-3 py-2 text-right tabular-nums"
                    style={{ color: delta >= 0 ? '#22c55e' : '#ef4444' }}
                  >
                    {delta >= 0 ? '+' : ''}
                    {delta.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
