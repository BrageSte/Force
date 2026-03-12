import { useLiveStore } from '../../stores/liveStore.ts';
import { MetricRow } from '../shared/MetricRow.tsx';

export function EffortMetricsPanel() {
  const current = useLiveStore(s => s.currentEffort);
  const last = useLiveStore(s => s.lastEffort);

  const effort = current ?? last;
  const label = current ? 'Current Effort' : last ? 'Last Effort' : 'No effort detected';

  return (
    <div className="bg-surface rounded-xl border border-border p-4 h-full">
      <div className="text-xs text-muted font-medium uppercase tracking-wide mb-2">{label}</div>
      {effort ? (
        <div className="space-y-0.5">
          <MetricRow label="Peak" value={effort.peakTotalKg.toFixed(1)} unit="kg" />
          <MetricRow label="Time to peak" value={effort.timeToPeakS.toFixed(2)} unit="s" />
          <MetricRow label="RFD 0-100ms" value={effort.rfd100KgS.toFixed(1)} unit="kg/s" />
          <MetricRow label="RFD 0-200ms" value={effort.rfd200KgS.toFixed(1)} unit="kg/s" />
          <MetricRow label="Avg hold" value={effort.avgTotalKg.toFixed(1)} unit="kg" />
          <MetricRow label="TUT" value={effort.tutS.toFixed(1)} unit="s" />
          <MetricRow label="Duration" value={effort.durationS.toFixed(1)} unit="s" />
          <MetricRow label="Imbalance" value={effort.fingerImbalanceIndex.toFixed(1)} />
        </div>
      ) : (
        <p className="text-sm text-muted/60 mt-4">Apply force to detect an effort</p>
      )}
    </div>
  );
}
