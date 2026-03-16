import { useLiveStore } from '../../stores/liveStore.ts';
import { useAppStore } from '../../stores/appStore.ts';
import { useDeviceStore } from '../../stores/deviceStore.ts';
import { defaultConnectedDevice } from '../../device/deviceProfiles.ts';
import { FINGER_NAMES, FINGER_COLORS, displayOrder } from '../../constants/fingers.ts';
import { getQuickMeasureDefinition, quickMeasureBlockReason } from '../../live/quickMeasure.ts';

export function DistributionChart() {
  const latestPct = useLiveStore(s => s.latestPct);
  const hasMeaningfulLoad = useLiveStore(s => s.hasMeaningfulLoad);
  const quickMeasurePresetId = useLiveStore(s => s.quickMeasurePresetId);
  const hand = useAppStore(s => s.hand);
  const sourceKind = useDeviceStore(s => s.sourceKind);
  const activeDevice = useDeviceStore(s => s.activeDevice);
  const device = activeDevice ?? defaultConnectedDevice(sourceKind);
  const perFingerForce = device.capabilities.perFingerForce;
  const order = displayOrder(hand);
  const maxPct = Math.max(50, ...(latestPct ?? [0, 0, 0, 0]));
  const activePreset = getQuickMeasureDefinition(quickMeasurePresetId);
  const presetBlockReason = quickMeasureBlockReason(activePreset, device.capabilities);

  if (!perFingerForce) {
    return (
      <div className="bg-surface rounded-xl border border-border p-4 h-full">
        <div className="text-xs text-muted font-medium uppercase tracking-wide mb-3">Distribution</div>
        <div className="rounded-lg border border-border bg-surface-alt px-3 py-4 text-sm text-muted">
          {presetBlockReason ?? 'This device provides total force only, so finger distribution is unavailable.'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-4 h-full">
      <div className="text-xs text-muted font-medium uppercase tracking-wide mb-3">Distribution</div>
      <div className="flex items-end gap-2 h-[calc(100%-2rem)]">
        {order.map(i => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs font-semibold tabular-nums" style={{ color: FINGER_COLORS[i] }}>
              {hasMeaningfulLoad && latestPct ? `${latestPct[i].toFixed(0)}%` : '--'}
            </span>
            <div className="w-full bg-surface-alt rounded-t-md relative" style={{ height: '120px' }}>
              {hasMeaningfulLoad && latestPct && (
                <div
                  className="absolute bottom-0 w-full rounded-t-md transition-all duration-75"
                  style={{
                    height: `${Math.max(2, (latestPct[i] / maxPct) * 100)}%`,
                    backgroundColor: FINGER_COLORS[i],
                    opacity: 0.8,
                  }}
                />
              )}
            </div>
            <span className="text-[10px] text-muted">{FINGER_NAMES[i].slice(0, 3)}</span>
          </div>
        ))}
      </div>
      {!hasMeaningfulLoad && (
        <div className="mt-3 text-xs text-muted">Percentage view appears from 1.0 kg and up.</div>
      )}
    </div>
  );
}
