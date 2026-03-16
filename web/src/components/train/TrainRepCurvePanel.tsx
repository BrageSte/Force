import { useMemo, useState } from 'react';
import { FINGER_COLORS, FINGER_NAMES, TOTAL_COLOR } from '../../constants/fingers.ts';
import { ResultCurveChart, type ResultCurveSeries } from '../analysis/ResultCurveChart.tsx';
import { buildTrainRepCurveSummary, strongestFingerInTrainRep } from '../analysis/forceCurveViewModel.ts';
import type { TrainSetDetail } from './trainResultAnalysis.ts';

interface TrainRepCurvePanelProps {
  selectedSet: TrainSetDetail;
  targetKg: number;
  fingerOrder: number[];
}

function repKey(rep: TrainSetDetail['reps'][number]): string {
  return `${rep.sequenceSetNo}:${rep.repNo}`;
}

function formatMs(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '--';
  return `${value.toFixed(0)} ms`;
}

export function TrainRepCurvePanel({
  selectedSet,
  targetKg,
  fingerOrder,
}: TrainRepCurvePanelProps) {
  return (
    <TrainRepCurvePanelBody
      key={selectedSet.key}
      selectedSet={selectedSet}
      targetKg={targetKg}
      fingerOrder={fingerOrder}
    />
  );
}

function TrainRepCurvePanelBody({
  selectedSet,
  targetKg,
  fingerOrder,
}: TrainRepCurvePanelProps) {
  const [selectedRepKey, setSelectedRepKey] = useState<string | null>(selectedSet.reps[0] ? repKey(selectedSet.reps[0]) : null);
  const [fingerIdx, setFingerIdx] = useState<number>(selectedSet.reps[0] ? strongestFingerInTrainRep(selectedSet.reps[0]) : 0);

  const selectedRep = useMemo(
    () => selectedSet.reps.find(rep => repKey(rep) === selectedRepKey) ?? selectedSet.reps[0] ?? null,
    [selectedRepKey, selectedSet.reps],
  );

  const summary = useMemo(
    () => (selectedRep ? buildTrainRepCurveSummary(selectedRep, targetKg, fingerIdx) : null),
    [fingerIdx, selectedRep, targetKg],
  );

  const forceSeries = useMemo<ResultCurveSeries[]>(() => {
    if (!summary) return [];
    return [
      { label: 'Total', color: TOTAL_COLOR, values: summary.curve.totalKg, width: 2.5, opacity: 0.95 },
      ...fingerOrder.map(index => ({
        label: FINGER_NAMES[index],
        color: FINGER_COLORS[index],
        values: summary.curve.fingerKg[index],
        width: index === fingerIdx ? 2.8 : 1.3,
        opacity: index === fingerIdx ? 1 : 0.36,
      })),
    ];
  }, [fingerIdx, fingerOrder, summary]);

  const rateSeries = useMemo<ResultCurveSeries[]>(() => {
    if (!summary) return [];
    return [
      { label: 'Total rate', color: TOTAL_COLOR, values: summary.curve.totalRateKgS, width: 2.3, opacity: 0.92 },
      ...fingerOrder.map(index => ({
        label: `${FINGER_NAMES[index]} rate`,
        color: FINGER_COLORS[index],
        values: summary.curve.fingerRateKgS[index],
        width: index === fingerIdx ? 2.6 : 1.3,
        opacity: index === fingerIdx ? 1 : 0.32,
      })),
    ];
  }, [fingerIdx, fingerOrder, summary]);

  if (!selectedRep || !summary || selectedRep.samples.length < 2) {
    return (
      <div className="rounded-xl border border-border bg-surface-alt p-4 text-sm text-muted">
        No rep trace was stored for the selected set.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-alt p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold">Rep Curve Analysis</div>
          <div className="text-xs text-muted mt-1">
            Review a single rep with total and per-finger force plus rate-of-force over time.
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <LegendPill label="Total" color={TOTAL_COLOR} active />
          {fingerOrder.map(index => (
            <LegendPill key={`legend-${index}`} label={FINGER_NAMES[index]} color={FINGER_COLORS[index]} active={index === fingerIdx} />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-muted">Rep</div>
        <div className="flex flex-wrap gap-2">
          {selectedSet.reps.map(rep => (
            <button
              key={repKey(rep)}
              onClick={() => setSelectedRepKey(repKey(rep))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                selectedRepKey === repKey(rep)
                  ? 'border-transparent bg-primary text-white'
                  : 'border-border bg-surface text-muted hover:text-text'
              }`}
            >
              Rep {rep.repNo}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-muted">Finger</div>
        <div className="flex flex-wrap gap-2">
          {fingerOrder.map(index => (
            <button
              key={FINGER_NAMES[index]}
              onClick={() => setFingerIdx(index)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                fingerIdx === index
                  ? 'border-transparent text-white'
                  : 'border-border bg-surface text-muted hover:text-text'
              }`}
              style={fingerIdx === index ? { backgroundColor: FINGER_COLORS[index] } : undefined}
            >
              {FINGER_NAMES[index]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="text-sm font-semibold">Force Over Time</div>
          <div className="text-xs text-muted mt-1">
            Rep {selectedRep.repNo} · {selectedRep.actualHangS.toFixed(1)}s captured
          </div>
          <div className="mt-4 rounded-lg border border-border bg-bg p-2">
            <ResultCurveChart timesMs={summary.curve.timesMs} series={forceSeries} yLabel="kg" height={240} />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="text-sm font-semibold">Rate Of Force</div>
          <div className="text-xs text-muted mt-1">Derived from a lightly smoothed force trace for readability.</div>
          <div className="mt-4 rounded-lg border border-border bg-bg p-2">
            <ResultCurveChart timesMs={summary.curve.timesMs} series={rateSeries} yLabel="kg/s" height={240} zeroLine />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="text-sm font-semibold">Rep Metrics</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <MetricCard label="Peak Total" value={`${summary.repMetrics.peakTotalKg.toFixed(1)} kg`} />
            <MetricCard label="Average Hold" value={`${summary.repMetrics.avgHoldKg.toFixed(1)} kg`} />
            <MetricCard label="Impulse" value={summary.repMetrics.impulseKgS.toFixed(1)} note="kg·s" />
            <MetricCard label="Hang Time" value={`${summary.repMetrics.actualHangS.toFixed(1)} s`} />
            <MetricCard label="Adherence" value={`${summary.repMetrics.adherencePct.toFixed(0)}%`} />
            <MetricCard label="Target" value={`${summary.repMetrics.targetKg.toFixed(1)} kg`} />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="text-sm font-semibold">{FINGER_NAMES[fingerIdx]} Metrics</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <MetricCard label="Peak" value={`${summary.fingerMetrics.peakKg.toFixed(1)} kg`} color={FINGER_COLORS[fingerIdx]} />
            <MetricCard label="Mean" value={`${summary.fingerMetrics.meanKg.toFixed(1)} kg`} />
            <MetricCard label="Avg Share" value={`${summary.fingerMetrics.avgSharePct.toFixed(1)}%`} />
            <MetricCard label="Max Share" value={`${summary.fingerMetrics.maxSharePct.toFixed(1)}%`} />
            <MetricCard label="Time To Peak" value={formatMs(summary.fingerMetrics.timeToPeakMs)} />
            <MetricCard label="RFD 0-100ms" value={summary.fingerMetrics.rfd100KgS.toFixed(1)} note="kg/s" />
            <MetricCard label="RFD 0-200ms" value={summary.fingerMetrics.rfd200KgS.toFixed(1)} note="kg/s" />
            <MetricCard label="Max Rise Rate" value={summary.fingerMetrics.maxRiseRateKgS.toFixed(1)} note="kg/s" />
          </div>
        </section>
      </div>
    </div>
  );
}

function LegendPill({ label, color, active }: { label: string; color: string; active?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1 ${active ? 'bg-surface text-text' : 'bg-bg text-muted'}`}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color, opacity: active ? 1 : 0.45 }} />
      {label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  note,
  color,
}: {
  label: string;
  value: string;
  note?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-alt p-3">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="text-lg font-semibold mt-2 tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
      {note && <div className="text-xs text-muted mt-1">{note}</div>}
    </div>
  );
}
