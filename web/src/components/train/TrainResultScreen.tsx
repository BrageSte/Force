import { useMemo, useState } from 'react';
import { FINGER_COLORS, FINGER_NAMES, TOTAL_COLOR, displayOrder } from '../../constants/fingers.ts';
import { annotateTrainReps, buildTrainSetDetails, type TrainSetDetail } from './trainResultAnalysis.ts';
import { TrainRepCurvePanel } from './TrainRepCurvePanel.tsx';
import { formatCategoryLabel } from './trainUtils.ts';
import type { TrainSessionResult } from './types.ts';

interface TrainResultScreenProps {
  result: TrainSessionResult;
  onBackToLibrary: () => void;
}

function polylinePath(values: number[], width: number, height: number, maxY: number): string {
  if (values.length === 0) return '';
  const count = values.length;
  return values
    .map((value, index) => {
      const x = count <= 1 ? 0 : (index / (count - 1)) * width;
      const y = height - (Math.max(0, value) / Math.max(1e-6, maxY)) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function TrainResultScreen({ result, onBackToLibrary }: TrainResultScreenProps) {
  const setDetails = useMemo(() => buildTrainSetDetails(result.blocks, result.reps), [result.blocks, result.reps]);
  const annotatedReps = useMemo(() => annotateTrainReps(result.blocks, result.reps), [result.blocks, result.reps]);
  const fingerOrder = useMemo(() => displayOrder(result.hand), [result.hand]);
  const [selectedSetState, setSelectedSetState] = useState<{ sessionId: string; key: string | null }>({
    sessionId: result.trainSessionId,
    key: setDetails[0]?.key ?? null,
  });
  const resolvedSelectedSetKey =
    selectedSetState.sessionId === result.trainSessionId && selectedSetState.key && setDetails.some(detail => detail.key === selectedSetState.key)
      ? selectedSetState.key
      : setDetails[0]?.key ?? null;

  const selectedSet = useMemo(
    () => setDetails.find(detail => detail.key === resolvedSelectedSetKey) ?? setDetails[0] ?? null,
    [resolvedSelectedSetKey, setDetails],
  );

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

      {selectedSet && (
        <SetDetailPanel
          result={result}
          fingerOrder={fingerOrder}
          selectedSet={selectedSet}
          setDetails={setDetails}
          onSelectSet={(key) => setSelectedSetState({ sessionId: result.trainSessionId, key })}
        />
      )}

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Rep Breakdown</h3>
          <p className="text-xs text-muted mt-1">Set-by-set force, impulse and adherence for this training session.</p>
        </div>
        {annotatedReps.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted">No reps were captured for this session.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-alt text-muted text-xs uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left">Set</th>
                <th className="px-4 py-2.5 text-left">Block</th>
                <th className="px-4 py-2.5 text-left">Rep</th>
                <th className="px-4 py-2.5 text-right">Hang</th>
                <th className="px-4 py-2.5 text-right">Avg</th>
                <th className="px-4 py-2.5 text-right">Peak</th>
                <th className="px-4 py-2.5 text-right">Impulse</th>
                <th className="px-4 py-2.5 text-right">Adherence</th>
              </tr>
            </thead>
            <tbody>
              {annotatedReps.map(rep => {
                const highlighted = selectedSet?.sequenceSetNo === rep.sequenceSetNo;
                return (
                  <tr key={`${rep.sequenceSetNo}-${rep.repNo}-${rep.blockId ?? 'set'}`} className={`border-t border-border ${highlighted ? 'bg-primary/5' : ''}`}>
                    <td className="px-4 py-2.5">{rep.sequenceSetNo}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{rep.blockLabel}</td>
                    <td className="px-4 py-2.5">{rep.repNo}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{rep.actualHangS.toFixed(1)}s</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{rep.avgHoldKg.toFixed(1)} kg</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{rep.peakTotalKg.toFixed(1)} kg</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{rep.impulseKgS.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{rep.adherencePct.toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SetDetailPanel({
  result,
  fingerOrder,
  selectedSet,
  setDetails,
  onSelectSet,
}: {
  result: TrainSessionResult;
  fingerOrder: number[];
  selectedSet: TrainSetDetail;
  setDetails: TrainSetDetail[];
  onSelectSet: (key: string) => void;
}) {
  const allFingerValues = selectedSet.chart.fingerKg.flat();
  const chartMax = Math.max(result.targetKg, ...selectedSet.chart.totalKg, ...allFingerValues, 5) * 1.15;

  return (
    <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">Set Detail</h3>
          <p className="text-xs text-muted mt-1">Review one set at a time with all fingers visible in the same trace.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {setDetails.map(detail => (
            <button
              key={detail.key}
              onClick={() => onSelectSet(detail.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                detail.key === selectedSet.key
                  ? 'border-transparent bg-primary text-white'
                  : 'border-border bg-surface-alt text-muted hover:text-text'
              }`}
            >
              Set {detail.sequenceSetNo}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.08fr_0.92fr] gap-4">
        <div className="rounded-xl border border-border bg-surface-alt p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">{selectedSet.blockLabel}</div>
              <div className="text-sm font-semibold mt-1">
                Set {selectedSet.sequenceSetNo} · {formatBlockPhase(selectedSet.blockPhase)}
              </div>
            </div>
            <div className="text-xs text-muted">
              {selectedSet.summary.completedReps}/{selectedSet.summary.plannedReps} reps captured
            </div>
          </div>

          {selectedSet.chart.totalKg.length > 1 ? (
            <svg viewBox="0 0 640 220" className="w-full h-[220px] md:h-[280px] mt-4 rounded-lg bg-bg border border-border">
              {result.targetKg > 0 && (
                <>
                  <line
                    x1="0"
                    x2="640"
                    y1={(220 - ((result.targetKg * 1.05) / chartMax) * 220).toFixed(1)}
                    y2={(220 - ((result.targetKg * 1.05) / chartMax) * 220).toFixed(1)}
                    stroke="#3b8df866"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <line
                    x1="0"
                    x2="640"
                    y1={(220 - ((result.targetKg * 0.95) / chartMax) * 220).toFixed(1)}
                    y2={(220 - ((result.targetKg * 0.95) / chartMax) * 220).toFixed(1)}
                    stroke="#3b8df866"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                </>
              )}
              {selectedSet.chart.repBreakpoints.map(breakpoint => {
                const x = selectedSet.chart.totalKg.length <= 1
                  ? 0
                  : (breakpoint / (selectedSet.chart.totalKg.length - 1)) * 640;
                return (
                  <line
                    key={`break-${breakpoint}`}
                    x1={x.toFixed(1)}
                    x2={x.toFixed(1)}
                    y1="0"
                    y2="220"
                    stroke="#94a3b833"
                    strokeDasharray="5 5"
                    strokeWidth="1"
                  />
                );
              })}
              {fingerOrder.map(fingerIndex => (
                <polyline
                  key={`set-trace-${fingerIndex}`}
                  fill="none"
                  stroke={FINGER_COLORS[fingerIndex]}
                  strokeWidth="1.5"
                  strokeOpacity="0.95"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={polylinePath(selectedSet.chart.fingerKg[fingerIndex] ?? [], 640, 220, chartMax)}
                />
              ))}
              <polyline
                fill="none"
                stroke={TOTAL_COLOR}
                strokeWidth="2.4"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={polylinePath(selectedSet.chart.totalKg, 640, 220, chartMax)}
              />
            </svg>
          ) : (
            <div className="mt-4 rounded-lg border border-border bg-bg px-4 py-8 text-sm text-muted">
              No sample trace was stored for this set.
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <LegendPill label="Total" color={TOTAL_COLOR} />
            {fingerOrder.map(fingerIndex => (
              <LegendPill key={`set-legend-${fingerIndex}`} label={FINGER_NAMES[fingerIndex]} color={FINGER_COLORS[fingerIndex]} />
            ))}
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {selectedSet.reps.map(rep => (
              <div key={`rep-${rep.sequenceSetNo}-${rep.repNo}`} className="rounded-lg border border-border bg-surface px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-muted">Rep {rep.repNo}</div>
                <div className="text-sm font-semibold mt-1">{rep.peakTotalKg.toFixed(1)} kg peak</div>
                <div className="text-xs text-muted mt-1">Adherence {rep.adherencePct.toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SetMetricCard
            label="Peak"
            value={`${selectedSet.summary.peakTotalKg.toFixed(1)} kg`}
            detail={`${selectedSet.blockLabel} · set ${selectedSet.sequenceSetNo}`}
          />
          <SetMetricCard
            label="Average Hold"
            value={`${selectedSet.summary.avgHoldKg.toFixed(1)} kg`}
            detail="Average across reps in this set"
          />
          <SetMetricCard
            label="Adherence"
            value={`${selectedSet.summary.avgAdherencePct.toFixed(0)}%`}
            detail="Average target-band adherence"
          />
          <SetMetricCard
            label="TUT"
            value={formatSeconds(selectedSet.summary.totalTutS)}
            detail={`${selectedSet.summary.completedReps}/${selectedSet.summary.plannedReps} reps completed`}
          />
          <SetMetricCard
            label="Avg Impulse"
            value={selectedSet.summary.avgImpulseKgS.toFixed(1)}
            detail="Average impulse per rep"
          />
          <SetMetricCard
            label="Target"
            value={`${result.targetKg.toFixed(1)} kg`}
            detail={targetModeLabel(result)}
          />
        </div>
      </div>

      {selectedSet.reps.length > 0 && (
        <TrainRepCurvePanel
          selectedSet={selectedSet}
          targetKg={result.targetKg}
          fingerOrder={fingerOrder}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {fingerOrder.map(fingerIndex => {
          const summary = selectedSet.fingerSummaries.find(item => item.fingerIndex === fingerIndex);
          return (
            <FingerStatCard
              key={`finger-${fingerIndex}`}
              label={FINGER_NAMES[fingerIndex]}
              color={FINGER_COLORS[fingerIndex]}
              peakKg={summary?.peakKg ?? 0}
              avgKg={summary?.avgKg ?? 0}
              avgPct={summary?.avgPct ?? 0}
              maxPct={summary?.maxPct ?? 0}
            />
          );
        })}
      </div>
    </div>
  );
}

function LegendPill({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 text-text">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function SetMetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-alt p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="text-lg font-semibold text-text mt-2">{value}</div>
      <div className="text-xs text-muted mt-2">{detail}</div>
    </div>
  );
}

function FingerStatCard({
  label,
  color,
  peakKg,
  avgKg,
  avgPct,
  maxPct,
}: {
  label: string;
  color: string;
  peakKg: number;
  avgKg: number;
  avgPct: number;
  maxPct: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-alt p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="text-lg font-semibold mt-2" style={{ color }}>{peakKg.toFixed(1)} kg peak</div>
      <div className="mt-3 space-y-1 text-sm">
        <FingerMetricRow label="Average" value={`${avgKg.toFixed(1)} kg`} />
        <FingerMetricRow label="Avg share" value={`${avgPct.toFixed(1)}%`} />
        <FingerMetricRow label="Max share" value={`${maxPct.toFixed(1)}%`} />
      </div>
    </div>
  );
}

function FingerMetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
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

function formatBlockPhase(phase: 'warmup' | 'main' | 'cooldown'): string {
  if (phase === 'warmup') return 'Warm-up';
  if (phase === 'cooldown') return 'Cooldown';
  return 'Main';
}

function flagTone(severity: 'info' | 'warning' | 'high'): string {
  if (severity === 'high') return 'bg-danger/15 text-danger';
  if (severity === 'warning') return 'bg-warning/15 text-warning';
  return 'bg-success/15 text-success';
}
