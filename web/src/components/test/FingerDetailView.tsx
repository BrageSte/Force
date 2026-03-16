import { useEffect, useMemo, useState } from 'react';
import { FINGER_COLORS, FINGER_NAMES, TOTAL_COLOR } from '../../constants/fingers.ts';
import { ResultCurveChart, type ResultCurveSeries } from '../analysis/ResultCurveChart.tsx';
import {
  buildAttemptCurveSummary,
  defaultAttemptIndex,
  defaultFingerIndex,
} from '../analysis/forceCurveViewModel.ts';
import type { CompletedTestResult } from './types.ts';

interface FingerDetailViewProps {
  result: CompletedTestResult;
  oppositeHandResult: CompletedTestResult | null;
}

function formatMs(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '--';
  return `${value.toFixed(0)} ms`;
}

export function FingerDetailView({ result, oppositeHandResult }: FingerDetailViewProps) {
  const attempts = result.attempts;
  const [attemptIdx, setAttemptIdx] = useState(() => defaultAttemptIndex(result));
  const [fingerIdx, setFingerIdx] = useState(() => defaultFingerIndex(result));

  useEffect(() => {
    setAttemptIdx(defaultAttemptIndex(result));
    setFingerIdx(defaultFingerIndex(result));
  }, [result]);

  const resolvedAttemptIdx = Math.max(0, Math.min(attemptIdx, Math.max(0, attempts.length - 1)));
  const selectedAttempt = attempts[resolvedAttemptIdx] ?? null;
  const summary = useMemo(
    () => (selectedAttempt ? buildAttemptCurveSummary(selectedAttempt, fingerIdx) : null),
    [fingerIdx, selectedAttempt],
  );

  const forceSeries = useMemo<ResultCurveSeries[]>(() => {
    if (!summary) return [];
    return [
      { label: 'Total', color: TOTAL_COLOR, values: summary.curve.totalKg, width: 2.6, opacity: 0.95 },
      ...FINGER_NAMES.map((name, index) => ({
        label: name,
        color: FINGER_COLORS[index],
        values: summary.curve.fingerKg[index],
        width: index === fingerIdx ? 2.8 : 1.4,
        opacity: index === fingerIdx ? 1 : 0.38,
      })),
    ];
  }, [fingerIdx, summary]);

  const rateSeries = useMemo<ResultCurveSeries[]>(() => {
    if (!summary) return [];
    return [
      { label: 'Total rate', color: TOTAL_COLOR, values: summary.curve.totalRateKgS, width: 2.4, opacity: 0.9 },
      ...FINGER_NAMES.map((name, index) => ({
        label: `${name} rate`,
        color: FINGER_COLORS[index],
        values: summary.curve.fingerRateKgS[index],
        width: index === fingerIdx ? 2.6 : 1.3,
        opacity: index === fingerIdx ? 1 : 0.34,
      })),
    ];
  }, [fingerIdx, summary]);

  const oppositeFingerPeak = oppositeHandResult
    ? Math.max(...oppositeHandResult.attempts.map(attempt => attempt.core.peakPerFingerKg[fingerIdx]), 0)
    : null;
  const currentFingerPeak = selectedAttempt ? selectedAttempt.core.peakPerFingerKg[fingerIdx] : 0;
  const oppositeDeltaPct =
    oppositeFingerPeak && oppositeFingerPeak > 1e-9
      ? ((currentFingerPeak - oppositeFingerPeak) / oppositeFingerPeak) * 100
      : null;

  if (!selectedAttempt || !summary || selectedAttempt.samples.length < 2) {
    return (
      <div className="bg-surface rounded-xl border border-border p-4 text-sm text-muted">
        No detailed sample trace is available for this result yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
        <div>
          <div className="text-sm font-semibold">Finger Force Curve Analysis</div>
          <div className="text-xs text-muted mt-1">
            Inspect one attempt at a time. The selected finger is emphasized in both the force and rate-of-force charts.
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted">Attempt</div>
          <div className="flex flex-wrap gap-2">
            {attempts.map((attempt, index) => (
              <button
                key={`attempt-${attempt.attemptNo}`}
                onClick={() => setAttemptIdx(index)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  index === resolvedAttemptIdx
                    ? 'border-transparent bg-primary text-white'
                    : 'border-border bg-surface-alt text-muted hover:text-text'
                }`}
              >
                Attempt {attempt.attemptNo}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted">Finger</div>
          <div className="flex flex-wrap gap-2">
            {FINGER_NAMES.map((name, index) => (
              <button
                key={name}
                onClick={() => setFingerIdx(index)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  index === fingerIdx
                    ? 'border-transparent text-white'
                    : 'border-border bg-surface-alt text-muted hover:text-text'
                }`}
                style={index === fingerIdx ? { backgroundColor: FINGER_COLORS[index] } : undefined}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold">Force Over Time</div>
              <div className="text-xs text-muted mt-1">
                Attempt {selectedAttempt.attemptNo} · {selectedAttempt.durationS.toFixed(1)}s capture
              </div>
            </div>
            <LegendPills fingerIdx={fingerIdx} />
          </div>
          <div className="mt-4 rounded-lg border border-border bg-bg p-2">
            <ResultCurveChart timesMs={summary.curve.timesMs} series={forceSeries} yLabel="kg" height={250} />
          </div>
        </section>

        <section className="bg-surface rounded-xl border border-border p-4">
          <div className="text-sm font-semibold">Rate Of Force</div>
          <div className="text-xs text-muted mt-1">
            Derived from a lightly smoothed trace so the curve is readable even with sensor noise.
          </div>
          <div className="mt-4 rounded-lg border border-border bg-bg p-2">
            <ResultCurveChart timesMs={summary.curve.timesMs} series={rateSeries} yLabel="kg/s" height={250} zeroLine />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="bg-surface rounded-xl border border-border p-4">
          <div className="text-sm font-semibold">Attempt Metrics</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <MetricCard label="Peak Total" value={`${summary.attemptMetrics.peakTotalKg.toFixed(1)} kg`} />
            <MetricCard label="Mean Total" value={`${summary.attemptMetrics.meanTotalKg.toFixed(1)} kg`} />
            <MetricCard label="Impulse" value={summary.attemptMetrics.impulseKgS.toFixed(1)} note="kg·s" />
            <MetricCard label="Duration" value={`${summary.attemptMetrics.durationS.toFixed(1)} s`} />
            <MetricCard label="RFD 0-100ms" value={summary.attemptMetrics.rfd100KgS.toFixed(1)} note="kg/s" />
            <MetricCard label="RFD 0-200ms" value={summary.attemptMetrics.rfd200KgS.toFixed(1)} note="kg/s" />
          </div>
        </section>

        <section className="bg-surface rounded-xl border border-border p-4">
          <div className="text-sm font-semibold">{FINGER_NAMES[fingerIdx]} Metrics</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <MetricCard label="Peak" value={`${summary.fingerMetrics.peakKg.toFixed(1)} kg`} color={FINGER_COLORS[fingerIdx]} />
            <MetricCard label="Mean" value={`${summary.fingerMetrics.meanKg.toFixed(1)} kg`} />
            <MetricCard label="Share At Peak" value={`${summary.fingerMetrics.shareAtPeakPct.toFixed(1)}%`} />
            <MetricCard label="Avg Share" value={`${summary.fingerMetrics.avgSharePct.toFixed(1)}%`} />
            <MetricCard label="Time To Peak" value={formatMs(summary.fingerMetrics.timeToPeakMs)} />
            <MetricCard label="RFD 0-100ms" value={summary.fingerMetrics.rfd100KgS.toFixed(1)} note="kg/s" />
            <MetricCard label="RFD 0-200ms" value={summary.fingerMetrics.rfd200KgS.toFixed(1)} note="kg/s" />
            <MetricCard label="Max Rise Rate" value={summary.fingerMetrics.maxRiseRateKgS.toFixed(1)} note="kg/s" />
            <MetricCard label="Fatigue Slope" value={summary.fingerMetrics.fatigueSlopeKgS.toFixed(2)} note="kg/s" />
            <MetricCard label="Max Share" value={`${summary.fingerMetrics.maxSharePct.toFixed(1)}%`} />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <MetricCard
          label="Opposite-Hand Same Finger"
          value={oppositeFingerPeak === null ? '--' : `${oppositeFingerPeak.toFixed(1)} kg`}
          note={oppositeDeltaPct === null ? 'Run the same protocol on the opposite hand for comparison.' : `${oppositeDeltaPct >= 0 ? '+' : ''}${oppositeDeltaPct.toFixed(1)}% vs opposite`}
        />
        <MetricCard
          label="Attempt Balance Score"
          value={`${selectedAttempt.coaching.balanceScore.toFixed(0)}/100`}
          note="Current attempt only"
        />
        <MetricCard
          label="Selected Finger Drift"
          value={`${selectedAttempt.coaching.contributionDriftPct[fingerIdx] >= 0 ? '+' : ''}${selectedAttempt.coaching.contributionDriftPct[fingerIdx].toFixed(1)}%`}
          note="Late share minus early share"
        />
      </div>
    </div>
  );
}

function LegendPills({ fingerIdx }: { fingerIdx: number }) {
  return (
    <div className="flex flex-wrap gap-2 text-[11px]">
      <LegendPill label="Total" color={TOTAL_COLOR} active />
      {FINGER_NAMES.map((label, index) => (
        <LegendPill key={label} label={label} color={FINGER_COLORS[index]} active={index === fingerIdx} />
      ))}
    </div>
  );
}

function LegendPill({ label, color, active }: { label: string; color: string; active?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1 ${active ? 'bg-surface text-text' : 'bg-surface-alt text-muted'}`}>
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
