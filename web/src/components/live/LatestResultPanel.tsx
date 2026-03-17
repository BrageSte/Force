import { FINGER_COLORS, FINGER_NAMES } from '../../constants/fingers.ts';
import { defaultConnectedDevice } from '../../device/deviceProfiles.ts';
import { getQuickMeasureDefinition } from '../../live/quickMeasure.ts';
import { useDeviceStore } from '../../stores/deviceStore.ts';
import { useLiveStore } from '../../stores/liveStore.ts';
import { MetricRow } from '../shared/MetricRow.tsx';

function formatMaybe(value: number | null | undefined, digits = 1, unit = ''): string {
  if (value === null || value === undefined) return '--';
  return `${value.toFixed(digits)}${unit}`;
}

function ResultEmptyState() {
  const quickCapture = useLiveStore(s => s.quickCapture);

  const body = quickCapture.status === 'armed'
    ? 'Armed and waiting for the next effort.'
    : quickCapture.status === 'capturing'
      ? 'Capture in progress.'
      : 'Quick captures and effort summaries will appear here after the next pull or hold.';

  return <p className="text-sm text-muted">{body}</p>;
}

function EffortSummary() {
  const currentEffort = useLiveStore(s => s.currentEffort);
  const lastEffort = useLiveStore(s => s.lastEffort);

  const effort = currentEffort ?? lastEffort;
  if (!effort) {
    return <ResultEmptyState />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface-alt/70 p-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
          {currentEffort ? 'Current Effort' : 'Last Effort'}
        </div>
        <div className="mt-2 text-lg font-semibold text-text">
          {currentEffort ? 'Live segmented effort' : 'Most recent completed effort'}
        </div>
        <div className="mt-1 text-xs text-muted">
          Duration {effort.durationS.toFixed(1)}s
        </div>
      </div>

      <div className="space-y-1">
        <MetricRow label="Peak total" value={effort.peakTotalKg.toFixed(1)} unit="kg" />
        <MetricRow label="Time to peak" value={effort.timeToPeakS.toFixed(2)} unit="s" />
        <MetricRow label="RFD 0-100ms" value={effort.rfd100KgS.toFixed(1)} unit="kg/s" />
        <MetricRow label="RFD 0-200ms" value={effort.rfd200KgS.toFixed(1)} unit="kg/s" />
        <MetricRow label="Avg hold" value={effort.avgTotalKg.toFixed(1)} unit="kg" />
        <MetricRow label="Distribution drift" value={formatMaybe(effort.distributionDriftPerS, 2)} unit="/s" />
        <MetricRow label="Steadiness" value={effort.steadinessTotalKg.toFixed(2)} unit="kg" />
      </div>

      {effort.peakPerFingerKg && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Per Finger Peaks</div>
          {effort.peakPerFingerKg.map((value, index) => (
            <MetricRow
              key={FINGER_NAMES[index]}
              label={FINGER_NAMES[index]}
              value={value.toFixed(1)}
              unit="kg"
              accent={FINGER_COLORS[index]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuickResultSummary() {
  const quickMeasurePresetId = useLiveStore(s => s.quickMeasurePresetId);
  const quickResult = useLiveStore(s => s.quickResult);
  const preset = getQuickMeasureDefinition(quickMeasurePresetId);
  const activeResult = quickResult && quickResult.presetId === preset.id ? quickResult : null;

  if (!activeResult) {
    return <EffortSummary />;
  }

  const capturedAt = new Date(activeResult.capturedAtIso).toLocaleTimeString();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-success">
        <div className="text-[11px] uppercase tracking-[0.18em]">Quick Result</div>
        <div className="mt-2 text-lg font-semibold">{activeResult.label}</div>
        <div className="mt-1 text-xs">
          Captured at {capturedAt} · {activeResult.durationS.toFixed(1)}s · {activeResult.sampleCount} samples
        </div>
      </div>

      <div className="space-y-1">
        <MetricRow label="Peak total" value={activeResult.peakTotalKg.toFixed(1)} unit="kg" />
        <MetricRow label="Time to peak" value={activeResult.timeToPeakS.toFixed(2)} unit="s" />
        {preset.id === 'peak_total_pull' && (
          <>
            <MetricRow label="RFD 0-100ms" value={activeResult.rfd100KgS.toFixed(1)} unit="kg/s" />
            <MetricRow label="RFD 0-200ms" value={activeResult.rfd200KgS.toFixed(1)} unit="kg/s" />
          </>
        )}
        {preset.id === 'rfd_pull' && (
          <>
            <MetricRow label="RFD 0-100ms" value={activeResult.rfd100KgS.toFixed(1)} unit="kg/s" />
            <MetricRow label="RFD 0-200ms" value={activeResult.rfd200KgS.toFixed(1)} unit="kg/s" />
          </>
        )}
        {(preset.id === 'drift_hold_20s' || preset.id === 'stability_hold_20s') && (
          <>
            <MetricRow label="Avg hold" value={activeResult.avgHoldKg.toFixed(1)} unit="kg" />
            <MetricRow label="Total drift" value={formatMaybe(activeResult.totalForceDriftKgS, 2)} unit="kg/s" />
            <MetricRow label="Steadiness" value={activeResult.steadinessTotalKg.toFixed(2)} unit="kg" />
            <MetricRow label="Settle time" value={formatMaybe(activeResult.stabilizationTimeS, 2)} unit="s" />
          </>
        )}
        {preset.id === 'drift_hold_20s' && (
          <MetricRow label="Distribution drift" value={formatMaybe(activeResult.distributionDriftPerS, 2)} unit="/s" />
        )}
      </div>

      {preset.id === 'peak_per_finger' && activeResult.peakPerFingerKg && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Per Finger Peaks</div>
          <MetricRow label="Capture time" value={capturedAt} />
          {activeResult.peakPerFingerKg.map((value, index) => (
            <MetricRow
              key={FINGER_NAMES[index]}
              label={FINGER_NAMES[index]}
              value={value.toFixed(1)}
              unit="kg"
              detail={activeResult.peakSharePct ? `${activeResult.peakSharePct[index].toFixed(0)}% share at peak` : undefined}
              accent={FINGER_COLORS[index]}
            />
          ))}
        </div>
      )}

      {preset.id !== 'peak_per_finger' && activeResult.peakPerFingerKg && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Per Finger Peaks</div>
          {activeResult.peakPerFingerKg.map((value, index) => (
            <MetricRow
              key={FINGER_NAMES[index]}
              label={FINGER_NAMES[index]}
              value={value.toFixed(1)}
              unit="kg"
              detail={activeResult.peakSharePct ? `${activeResult.peakSharePct[index].toFixed(0)}% at peak` : undefined}
              accent={FINGER_COLORS[index]}
            />
          ))}
        </div>
      )}

      {activeResult.contributionDriftPct && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Contribution Drift</div>
          {activeResult.contributionDriftPct.map((value, index) => (
            <MetricRow
              key={`${FINGER_NAMES[index]}-drift`}
              label={FINGER_NAMES[index]}
              value={value.toFixed(1)}
              unit="%"
              accent={FINGER_COLORS[index]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function LatestResultPanel() {
  const sourceKind = useDeviceStore(s => s.sourceKind);
  const activeDevice = useDeviceStore(s => s.activeDevice);
  const device = activeDevice ?? defaultConnectedDevice(sourceKind);
  const preset = useLiveStore(s => getQuickMeasureDefinition(s.quickMeasurePresetId));

  return (
    <section aria-label="Latest Result" className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-muted">Latest Result</div>
          <div className="mt-2 text-lg font-semibold text-text">{preset.label}</div>
          <p className="mt-2 max-w-sm text-sm text-muted">
            `LIVE` keeps the latest quick capture for the active preset on top, and falls back to the newest effort
            when no matching quick result exists.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-alt/70 px-3 py-2 text-xs text-muted">
          {device.capabilities.perFingerForce ? 'Native per-finger metrics available.' : 'Total-force-only device connected.'}
        </div>
      </div>

      <div className="mt-5">
        <QuickResultSummary />
      </div>
    </section>
  );
}
