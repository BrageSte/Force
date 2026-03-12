import { formatCategoryLabel } from './trainUtils.ts';
import type { TrainSessionResult } from './types.ts';

interface TrainResultScreenProps {
  result: TrainSessionResult;
  onBackToLibrary: () => void;
}

export function TrainResultScreen({ result, onBackToLibrary }: TrainResultScreenProps) {
  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl border border-border p-4 flex items-center gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">Training Saved</div>
          <h2 className="text-xl font-semibold mt-1">{result.presetName}</h2>
          <p className="text-xs text-muted mt-1">
            {result.profile?.name ?? 'Unknown profile'} | {result.hand} hand | {result.gripSpec}
          </p>
        </div>
        <div className="flex-1" />
        <button onClick={onBackToLibrary} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/15 text-primary hover:bg-primary/20 transition-colors">
          New Training Session
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <StatCard label="Category" value={formatCategoryLabel(result.category)} detail={result.recommendationReason} />
        <StatCard label="Target" value={`${result.targetKg.toFixed(1)} kg`} detail={targetModeLabel(result)} />
        <StatCard label="Completion" value={`${result.summary.completionPct.toFixed(0)}%`} detail={`${result.summary.completedReps}/${result.summary.plannedReps} reps`} />
        <StatCard label="TUT" value={formatSeconds(result.summary.totalTutS)} detail={`Avg impulse ${result.summary.avgImpulseKgS.toFixed(1)}`} />
        <StatCard label="Peak / Avg" value={`${result.summary.peakTotalKg.toFixed(1)} / ${result.summary.avgHoldKg.toFixed(1)}`} detail={`Adherence ${result.summary.adherencePct.toFixed(0)}%`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold">Prescription Summary</h3>
              <p className="text-xs text-muted mt-1">
                Benchmark source: {result.benchmarkSourceLabel ?? result.sourceBasis}
              </p>
            </div>
            <div className="text-xs text-muted">
              {new Date(result.completedAtIso).toLocaleString()}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface-alt p-4">
            <div className="text-xs uppercase tracking-wide text-muted">Why this session was chosen</div>
            <div className="text-sm font-semibold mt-2">{result.recommendationReason}</div>
            <ul className="mt-2 space-y-1 text-sm text-text">
              {result.recommendationRationale.map(line => (
                <li key={line}>- {line}</li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Metric label="Tactical profile" value={result.tacticalGripProfile.replaceAll('_', ' ')} />
            <Metric label="Comparison" value={comparisonLabel(result)} />
            <Metric label="Safety flags" value={`${result.summary.safetyFlags.length}`} />
          </div>

          <div className="rounded-xl border border-border bg-surface-alt p-4">
            <div className="text-sm font-semibold">Safety Flags</div>
            <div className="mt-3 space-y-2">
              {result.summary.safetyFlags.map(flag => (
                <div key={`${flag.code}:${flag.message}`} className="rounded-lg border border-border bg-surface px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{flag.code.replaceAll('_', ' ')}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold ${flagTone(flag.severity)}`}>
                      {flag.severity}
                    </span>
                  </div>
                  <div className="text-xs text-muted mt-1">{flag.message}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
          <div className="text-sm font-semibold">Session Deltas</div>
          <DeltaRow label="Peak delta" value={formatDelta(result.sessionComparison?.peakDeltaPct, '%')} />
          <DeltaRow label="Endurance delta" value={formatDelta(result.sessionComparison?.enduranceDeltaPct, '%')} />
          <DeltaRow label="Stability delta" value={formatDelta(result.sessionComparison?.stabilityDeltaPct, '%')} />
          <DeltaRow label="Target mode" value={result.targetMode.replaceAll('_', ' ')} />
          <DeltaRow label="Source basis" value={result.sourceBasis} />
          <DeltaRow label="Bodyweight target" value={result.bodyweightRelativeTarget !== null ? `${result.bodyweightRelativeTarget.toFixed(2)} x BW` : '--'} />
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Rep Breakdown</h3>
          <p className="text-xs text-muted mt-1">Per-rep force, impulse and adherence for this training session.</p>
        </div>
        {result.reps.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted">No reps were captured for this session.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-alt text-muted text-xs uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left">Set</th>
                <th className="px-4 py-2.5 text-left">Rep</th>
                <th className="px-4 py-2.5 text-right">Hang</th>
                <th className="px-4 py-2.5 text-right">Avg</th>
                <th className="px-4 py-2.5 text-right">Peak</th>
                <th className="px-4 py-2.5 text-right">Impulse</th>
                <th className="px-4 py-2.5 text-right">Adherence</th>
              </tr>
            </thead>
            <tbody>
              {result.reps.map(rep => (
                <tr key={`${rep.setNo}-${rep.repNo}`} className="border-t border-border">
                  <td className="px-4 py-2.5">{rep.setNo}</td>
                  <td className="px-4 py-2.5">{rep.repNo}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{rep.actualHangS.toFixed(1)}s</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{rep.avgHoldKg.toFixed(1)} kg</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{rep.peakTotalKg.toFixed(1)} kg</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{rep.impulseKgS.toFixed(1)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{rep.adherencePct.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="text-lg font-semibold text-text mt-2">{value}</div>
      <div className="text-xs text-muted mt-2">{detail}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-alt px-3 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm font-semibold mt-1">{value}</div>
    </div>
  );
}

function DeltaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-alt px-3 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm font-semibold mt-1">{value}</div>
    </div>
  );
}

function targetModeLabel(result: TrainSessionResult): string {
  if (result.targetMode === 'manual') return 'Manual target';
  if (result.targetMode === 'auto_from_first_set') return 'Learned from first set';
  if (result.targetMode === 'bodyweight_relative' && result.bodyweightRelativeTarget !== null) {
    return `${result.bodyweightRelativeTarget.toFixed(2)} x bodyweight`;
  }
  if (result.sourceMaxKg === null) return 'Auto target';
  return `Auto from latest benchmark (${result.sourceMaxKg.toFixed(1)} kg)`;
}

function comparisonLabel(result: TrainSessionResult): string {
  if (result.sessionComparison?.peakDeltaPct === null || result.sessionComparison?.peakDeltaPct === undefined) return 'No prior comparison';
  return `${formatDelta(result.sessionComparison.peakDeltaPct, '%')} peak`;
}

function formatSeconds(totalSeconds: number): string {
  const rounded = Math.max(0, Math.round(totalSeconds));
  const mins = Math.floor(rounded / 60);
  const secs = `${rounded % 60}`.padStart(2, '0');
  return mins > 0 ? `${mins}:${secs}` : `${rounded}s`;
}

function formatDelta(value: number | null | undefined, suffix: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}${suffix}`;
}

function flagTone(severity: 'info' | 'warning' | 'high'): string {
  if (severity === 'high') return 'bg-danger/15 text-danger';
  if (severity === 'warning') return 'bg-warning/15 text-warning';
  return 'bg-success/15 text-success';
}
