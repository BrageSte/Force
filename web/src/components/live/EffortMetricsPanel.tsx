import { FINGER_COLORS, FINGER_NAMES } from '../../constants/fingers.ts';
import { getQuickMeasureDefinition, type LiveMeasureMetricId } from '../../live/quickMeasure.ts';
import { useDeviceStore } from '../../stores/deviceStore.ts';
import { useLiveStore } from '../../stores/liveStore.ts';
import { defaultConnectedDevice } from '../../device/deviceProfiles.ts';
import { MetricRow } from '../shared/MetricRow.tsx';

function formatMaybe(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined ? '--' : value.toFixed(digits);
}

function formatMetricValue(value: number | null | undefined, unit = '', digits = 1): string {
  if (value === null || value === undefined) return '--';
  return `${value.toFixed(digits)}${unit}`;
}

function EffortFallbackPanel() {
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
          <MetricRow label="Imbalance" value={effort.fingerImbalanceIndex === null ? '--' : effort.fingerImbalanceIndex.toFixed(1)} />
        </div>
      ) : (
        <p className="text-sm text-muted/60 mt-4">Apply force to detect an effort</p>
      )}
    </div>
  );
}

function LiveDashboardMetric({ id }: { id: LiveMeasureMetricId }) {
  const latestKg = useLiveStore(s => s.latestKg);
  const latestPct = useLiveStore(s => s.latestPct);
  const latestTotalKg = useLiveStore(s => s.latestTotalKg);
  const currentEffort = useLiveStore(s => s.currentEffort);
  const lastEffort = useLiveStore(s => s.lastEffort);
  const quickLivePeakTotalKg = useLiveStore(s => s.quickLivePeakTotalKg);
  const quickLivePeakPerFingerKg = useLiveStore(s => s.quickLivePeakPerFingerKg);

  const effort = currentEffort ?? lastEffort;

  if (id === 'live_per_finger' || id === 'running_peak_per_finger' || id === 'current_share_pct') {
    const values = id === 'live_per_finger'
      ? latestKg
      : id === 'running_peak_per_finger'
        ? quickLivePeakPerFingerKg
        : latestPct;
    const unit = id === 'current_share_pct' ? '%' : 'kg';

    return (
      <div className="rounded-lg border border-border bg-surface px-3 py-3">
        <div className="text-xs uppercase tracking-wide text-muted mb-2">
          {id === 'live_per_finger' ? 'Live Per Finger' : id === 'running_peak_per_finger' ? 'Running Peak Per Finger' : 'Current Share %'}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {FINGER_NAMES.map((finger, index) => (
            <div key={finger} className="rounded-md bg-surface-alt px-2 py-2">
              <div className="text-[11px] text-muted">{finger}</div>
              <div className="text-sm font-semibold tabular-nums mt-1" style={{ color: FINGER_COLORS[index] }}>
                {values ? `${values[index].toFixed(id === 'current_share_pct' ? 0 : 1)} ${unit}` : '--'}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const content = (() => {
    switch (id) {
      case 'live_total':
        return { label: 'Live Total', value: formatMetricValue(latestTotalKg, ' kg') };
      case 'running_peak_total':
        return { label: 'Running Peak Total', value: formatMetricValue(quickLivePeakTotalKg, ' kg') };
      case 'last_effort_peak':
        return { label: 'Last Effort Peak', value: effort ? `${effort.peakTotalKg.toFixed(1)} kg` : '--' };
      case 'last_effort_rfd100':
        return { label: 'Last Effort RFD100', value: effort ? `${effort.rfd100KgS.toFixed(1)} kg/s` : '--' };
      case 'last_effort_rfd200':
        return { label: 'Last Effort RFD200', value: effort ? `${effort.rfd200KgS.toFixed(1)} kg/s` : '--' };
      case 'last_effort_avg_hold':
        return { label: 'Last Effort Avg Hold', value: effort ? `${effort.avgTotalKg.toFixed(1)} kg` : '--' };
      case 'last_effort_distribution_drift':
        return { label: 'Last Effort Drift', value: effort ? formatMetricValue(effort.distributionDriftPerS, ' /s', 2) : '--' };
      case 'last_effort_stability':
        return {
          label: 'Last Effort Stability',
          value: effort ? `${effort.steadinessTotalKg.toFixed(2)} kg std` : '--',
          detail: effort ? `Settle ${formatMaybe(effort.stabilizationTimeS, 2)}s` : 'No effort yet',
        };
      default:
        return null;
    }
  })();

  if (!content) return null;

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-3">
      <div className="text-xs uppercase tracking-wide text-muted">{content.label}</div>
      <div className="text-lg font-semibold tabular-nums mt-1">{content.value}</div>
      {'detail' in content && content.detail && (
        <div className="text-xs text-muted mt-1">{content.detail}</div>
      )}
    </div>
  );
}

export function EffortMetricsPanel() {
  const sourceKind = useDeviceStore(s => s.sourceKind);
  const activeDevice = useDeviceStore(s => s.activeDevice);
  const customDashboardMetrics = useLiveStore(s => s.customDashboardMetrics);
  const quickCapture = useLiveStore(s => s.quickCapture);
  const quickResult = useLiveStore(s => s.quickResult);
  const quickMeasurePresetId = useLiveStore(s => s.quickMeasurePresetId);

  const device = activeDevice ?? defaultConnectedDevice(sourceKind);
  const preset = getQuickMeasureDefinition(quickMeasurePresetId);

  if (preset.id === 'live_monitor') {
    return <EffortFallbackPanel />;
  }

  if (preset.id === 'custom_dashboard') {
    return (
      <div className="bg-surface rounded-xl border border-border p-4 h-full">
        <div className="text-xs text-muted font-medium uppercase tracking-wide mb-2">Custom Dashboard</div>
        <div className="text-sm text-muted mb-4">
          Pick the live signals you want to keep front and center while you monitor force.
        </div>
        <div className="space-y-3">
          {customDashboardMetrics.map(metricId => (
            <LiveDashboardMetric key={metricId} id={metricId} />
          ))}
        </div>
      </div>
    );
  }

  if (!quickResult || quickResult.presetId !== preset.id) {
    return (
      <div className="bg-surface rounded-xl border border-border p-4 h-full">
        <div className="text-xs text-muted font-medium uppercase tracking-wide mb-2">Quick Result</div>
        <div className="text-sm text-muted">
          {quickCapture.status === 'armed'
            ? 'Armed and waiting for the next effort.'
            : quickCapture.status === 'capturing'
              ? 'Capture in progress.'
              : 'Arm a quick capture to see local results here.'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-4 h-full">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <div className="text-xs text-muted font-medium uppercase tracking-wide">Quick Result</div>
          <div className="text-sm font-semibold mt-1">{quickResult.label}</div>
        </div>
        <div className="text-xs text-muted">
          {quickResult.durationS.toFixed(1)}s · {quickResult.sampleCount} samples
        </div>
      </div>

      <div className="space-y-0.5">
        <MetricRow label="Peak" value={quickResult.peakTotalKg.toFixed(1)} unit="kg" />
        <MetricRow label="Time to peak" value={quickResult.timeToPeakS.toFixed(2)} unit="s" />
        {(preset.id === 'rfd_pull' || preset.id === 'peak_total_pull') && (
          <>
            <MetricRow label="RFD 0-100ms" value={quickResult.rfd100KgS.toFixed(1)} unit="kg/s" />
            <MetricRow label="RFD 0-200ms" value={quickResult.rfd200KgS.toFixed(1)} unit="kg/s" />
          </>
        )}
        {(preset.id === 'drift_hold_20s' || preset.id === 'stability_hold_20s') && (
          <>
            <MetricRow label="Avg hold" value={quickResult.avgHoldKg.toFixed(1)} unit="kg" />
            <MetricRow label="Total drift" value={formatMaybe(quickResult.totalForceDriftKgS, 2)} unit="kg/s" />
            <MetricRow label="Steadiness" value={quickResult.steadinessTotalKg.toFixed(2)} unit="kg" />
            <MetricRow label="Settle time" value={formatMaybe(quickResult.stabilizationTimeS, 2)} unit="s" />
          </>
        )}
        {preset.id === 'drift_hold_20s' && (
          <MetricRow label="Distribution drift" value={formatMaybe(quickResult.distributionDriftPerS, 2)} unit="/s" />
        )}
      </div>

      {quickResult.peakPerFingerKg && (
        <div className="mt-4 space-y-2">
          <div className="text-xs text-muted font-medium uppercase tracking-wide">Per Finger</div>
          {quickResult.peakPerFingerKg.map((value, index) => (
            <MetricRow
              key={FINGER_NAMES[index]}
              label={FINGER_NAMES[index]}
              value={`${value.toFixed(1)} kg`}
              detail={quickResult.peakSharePct ? `${quickResult.peakSharePct[index].toFixed(0)}% at peak` : undefined}
              accent={FINGER_COLORS[index]}
            />
          ))}
        </div>
      )}

      {quickResult.contributionDriftPct && (
        <div className="mt-4 space-y-2">
          <div className="text-xs text-muted font-medium uppercase tracking-wide">Contribution Drift</div>
          {quickResult.contributionDriftPct.map((value, index) => (
            <MetricRow
              key={`${FINGER_NAMES[index]}-drift`}
              label={FINGER_NAMES[index]}
              value={`${value.toFixed(1)}%`}
              accent={FINGER_COLORS[index]}
            />
          ))}
        </div>
      )}

      {!device.capabilities.perFingerForce && (
        <div className="mt-4 rounded-lg border border-border bg-surface-alt px-3 py-3 text-xs text-muted">
          This device provides total force only, so per-finger quick metrics remain unavailable.
        </div>
      )}
    </div>
  );
}
