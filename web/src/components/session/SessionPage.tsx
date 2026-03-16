import { useEffect, useMemo, useRef } from 'react';
import uPlot from 'uplot';
import { useAppStore } from '../../stores/appStore.ts';
import { FINGER_NAMES, FINGER_COLORS, TOTAL_COLOR } from '../../constants/fingers.ts';
import { MetricRow } from '../shared/MetricRow.tsx';
import type { EffortMetrics } from '../../types/force.ts';
import { useState } from 'react';

function formatMaybe(value: number | null, digits = 1): string {
  return value === null ? '--' : value.toFixed(digits);
}

export function SessionPage() {
  const session = useAppStore(s => s.currentSession);
  const [selectedEffortId, setSelectedEffortId] = useState<number | null>(null);
  const selectedEffort = useMemo(() => {
    if (!session || session.efforts.length === 0) return null;
    if (selectedEffortId === null) return session.efforts[0];
    return session.efforts.find(e => e.effortId === selectedEffortId) ?? session.efforts[0];
  }, [selectedEffortId, session]);

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        <p>No session loaded. Record a session or load one from History.</p>
      </div>
    );
  }

  const { summary, efforts } = session;
  const hasPerFingerData = session.capabilities?.perFingerForce ?? efforts.some(effort => effort.peakPerFingerKg !== null);

  return (
    <div className="h-full flex flex-col gap-4 overflow-auto">
      {/* Summary bar */}
      <div className="bg-surface rounded-xl border border-border p-4 flex items-center gap-6 flex-wrap">
        <div>
          <span className="text-xs text-muted">Session</span>
          <p className="text-sm font-semibold">{summary.sessionId}</p>
          <p className="text-xs text-muted mt-1">
            {session.deviceName} | {session.capabilities.perFingerForce ? 'Total + per-finger' : 'Total force only'}
          </p>
          {session.profile && (
            <p className="text-xs text-muted mt-1">
              {session.profile.name} | Dominant {session.profile.dominantHand}
            </p>
          )}
        </div>
        {session.profile && <Stat label="Profile" value={session.profile.name} />}
        <Stat label="Efforts" value={String(summary.effortsCount)} />
        <Stat label="Best Peak" value={`${summary.bestPeakKg.toFixed(1)} kg`} />
        <Stat label="Avg Peak" value={`${summary.avgPeakKg.toFixed(1)} kg`} />
        <Stat label="Fatigue" value={`${summary.fatigueSlopeKgPerEffort.toFixed(2)} kg/effort`} />
        <Stat label="Drop" value={`${summary.firstToLastDropPct.toFixed(1)}%`} />
      </div>

      {/* Efforts table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-alt text-muted text-xs uppercase tracking-wide">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-right">Peak</th>
                <th className="px-3 py-2 text-right">Idx</th>
                <th className="px-3 py-2 text-right">Mid</th>
                <th className="px-3 py-2 text-right">Rng</th>
                <th className="px-3 py-2 text-right">Pnk</th>
                <th className="px-3 py-2 text-right">RFD 100</th>
                <th className="px-3 py-2 text-right">Avg</th>
                <th className="px-3 py-2 text-right">TUT</th>
                <th className="px-3 py-2 text-right">Dur</th>
                <th className="px-3 py-2 text-right">Imbal</th>
              </tr>
            </thead>
            <tbody>
              {efforts.map(e => (
                <tr
                  key={e.effortId}
                  onClick={() => setSelectedEffortId(e.effortId)}
                  className={`cursor-pointer border-t border-border transition-colors ${
                    selectedEffort?.effortId === e.effortId ? 'bg-primary/10' : 'hover:bg-surface-alt'
                  }`}
                >
                  <td className="px-3 py-2 text-muted">{e.effortId}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{e.peakTotalKg.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: FINGER_COLORS[0] }}>{formatMaybe(e.peakPerFingerKg?.[0] ?? null)}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: FINGER_COLORS[1] }}>{formatMaybe(e.peakPerFingerKg?.[1] ?? null)}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: FINGER_COLORS[2] }}>{formatMaybe(e.peakPerFingerKg?.[2] ?? null)}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: FINGER_COLORS[3] }}>{formatMaybe(e.peakPerFingerKg?.[3] ?? null)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.rfd100KgS.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.avgTotalKg.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.tutS.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.durationS.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMaybe(e.fingerImbalanceIndex, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!hasPerFingerData && (
          <div className="border-t border-border px-4 py-3 text-sm text-muted">
            This session was recorded on a total-force-only device, so per-finger metrics are unavailable.
          </div>
        )}
      </div>

      {/* Detail chart for selected effort */}
      {selectedEffort && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="text-xs text-muted uppercase tracking-wide mb-3">
            Effort #{selectedEffort.effortId} Detail
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_250px] gap-4">
            <EffortDetailChart effort={selectedEffort} />
            <div className="space-y-0.5">
              <MetricRow label="Peak" value={selectedEffort.peakTotalKg.toFixed(1)} unit="kg" />
              <MetricRow label="Time to peak" value={selectedEffort.timeToPeakS.toFixed(2)} unit="s" />
              <MetricRow label="RFD 0-100ms" value={selectedEffort.rfd100KgS.toFixed(1)} unit="kg/s" />
              <MetricRow label="RFD 0-200ms" value={selectedEffort.rfd200KgS.toFixed(1)} unit="kg/s" />
              <MetricRow label="Avg hold" value={selectedEffort.avgTotalKg.toFixed(1)} unit="kg" />
              <MetricRow label="TUT" value={selectedEffort.tutS.toFixed(1)} unit="s" />
              <MetricRow label="Duration" value={selectedEffort.durationS.toFixed(1)} unit="s" />
              <MetricRow label="Imbalance" value={formatMaybe(selectedEffort.fingerImbalanceIndex, 1)} />
              {(selectedEffort.peakPerFingerKg ?? []).map((v, i) => (
                <MetricRow
                  key={i}
                  label={`Peak ${FINGER_NAMES[i]}`}
                  value={v.toFixed(1)}
                  unit="kg"
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted">{label}</span>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function EffortDetailChart({ effort }: { effort: EffortMetrics }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const times = new Float64Array(effort.detailTMs);
    const total = new Float64Array(effort.detailTotalKg);
    const f0 = new Float64Array((effort.detailFingerKg ?? []).map(f => f[0]));
    const f1 = new Float64Array((effort.detailFingerKg ?? []).map(f => f[1]));
    const f2 = new Float64Array((effort.detailFingerKg ?? []).map(f => f[2]));
    const f3 = new Float64Array((effort.detailFingerKg ?? []).map(f => f[3]));

    const opts: uPlot.Options = {
      width: el.clientWidth,
      height: 250,
      cursor: { show: true },
      legend: { show: false },
      scales: {
        x: { time: false },
        y: { auto: true },
      },
      axes: [
        { stroke: '#8892a8', grid: { stroke: '#2e334530' }, values: (_u, vals) => vals.map(v => (v / 1000).toFixed(1) + 's'), font: '11px Sora, sans-serif' },
        { stroke: '#8892a8', grid: { stroke: '#2e334530' }, label: 'kg', font: '11px Sora, sans-serif' },
      ],
      series: [
        {},
        { label: 'Total', stroke: TOTAL_COLOR, width: 2 },
        ...(effort.detailFingerKg ? [
          { label: FINGER_NAMES[0], stroke: FINGER_COLORS[0], width: 1.5 },
          { label: FINGER_NAMES[1], stroke: FINGER_COLORS[1], width: 1.5 },
          { label: FINGER_NAMES[2], stroke: FINGER_COLORS[2], width: 1.5 },
          { label: FINGER_NAMES[3], stroke: FINGER_COLORS[3], width: 1.5 },
        ] : []),
      ],
    };

    const data = effort.detailFingerKg
      ? [times, total, f0, f1, f2, f3]
      : [times, total];
    const plot = new uPlot(opts, data, el);

    const obs = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      if (width > 0) plot.setSize({ width, height: 250 });
    });
    obs.observe(el);

    return () => { obs.disconnect(); plot.destroy(); };
  }, [effort]);

  return <div ref={containerRef} className="min-h-[250px]" />;
}
